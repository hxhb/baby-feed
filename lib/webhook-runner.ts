/**
 * Webhook Delivery Runner
 * 
 * Processes pending webhook deliveries from the database.
 * This is meant to be run periodically (every minute or so) via cron or a background job.
 * 
 * Usage:
 *   - Deploy as a cron job: GET /api/cron/webhook-runner
 *   - Or call processWebhookDeliveries() from a background job queue
 */

import { prisma } from './prisma'
import { logError } from './logger'
import crypto from 'crypto'

interface DeliveryResult {
  success: boolean
  httpStatus?: number
  error?: string
}

/**
 * Sign the webhook payload with HMAC-SHA256
 */
function signWebhookPayload(payload: string, secret: string): string {
  return crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex')
}

/**
 * Maximum payload size allowed for webhook delivery (100 KB)
 */
const MAX_PAYLOAD_SIZE = 100 * 1024

/**
 * Sanitize error messages to prevent leaking sensitive information
 */
function sanitizeErrorMessage(error: string): string {
  const patterns = [
    /bearer\s+[^\s]+/gi,
    /authorization:\s*[^\s]+/gi,
    /token[=:]\s*\w+/gi,
    /password[=:]\s*\w+/gi,
    /api[_-]?key[=:]\s*\w+/gi,
    /secret[=:]\s*\w+/gi,
  ]

  let sanitized = error
  for (const pattern of patterns) {
    sanitized = sanitized.replace(pattern, '[REDACTED]')
  }

  return sanitized.slice(0, 200)
}

/**
 * Send a single webhook delivery
 */
async function sendWebhookDelivery(
  delivery: { id: string },
  event: { payload: string; type: string; id: string },
  endpoint: { url: string; secret: string }
): Promise<DeliveryResult> {
  try {
    const payload = event.payload

    // Enforce payload size limit
    if (payload.length > MAX_PAYLOAD_SIZE) {
      return {
        success: false,
        error: `Payload exceeds maximum size (${MAX_PAYLOAD_SIZE} bytes)`,
      }
    }

    const signature = signWebhookPayload(payload, endpoint.secret)

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 10000)

    const response = await fetch(endpoint.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Signature': signature,
        'X-Webhook-Event-Type': event.type,
        'X-Webhook-Event-ID': event.id,
        'X-Webhook-Delivery-ID': delivery.id,
        'X-Webhook-Timestamp': new Date().toISOString(),
      },
      body: payload,
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      return {
        success: false,
        httpStatus: response.status,
        error: `HTTP ${response.status}`,
      }
    }

    return {
      success: true,
      httpStatus: response.status,
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    return {
      success: false,
      error: sanitizeErrorMessage(errorMessage),
    }
  }
}

/**
 * Attempt immediate delivery of a single webhook
 *
 * Called right after creating the delivery record for real-time notifications.
 * If delivery fails, the record stays in 'pending' for the cron runner to retry.
 */
export async function sendWebhookDeliveryImmediate(deliveryId: string): Promise<void> {
  const delivery = await prisma.webhookDelivery.findUnique({
    where: { id: deliveryId },
    include: { event: true, endpoint: true },
  })
  if (!delivery || delivery.status !== 'pending') return

  const result = await sendWebhookDelivery(delivery, delivery.event, delivery.endpoint)

  if (result.success) {
    await prisma.webhookDelivery.update({
      where: { id: deliveryId },
      data: {
        status: 'success',
        sentAt: new Date(),
        respondedAt: new Date(),
        httpStatus: result.httpStatus,
      },
    })

    // Check if all deliveries for this event succeeded
    const remaining = await prisma.webhookDelivery.count({
      where: { eventId: delivery.eventId, status: { in: ['failed', 'pending'] } },
    })
    if (remaining === 0) {
      await prisma.webhookEvent.update({
        where: { id: delivery.eventId },
        data: { status: 'delivered' },
      })
    }
  } else {
    // Mark attempt sent, schedule retry for cron runner
    await prisma.webhookDelivery.update({
      where: { id: deliveryId },
      data: {
        sentAt: new Date(),
        attemptNumber: delivery.attemptNumber + 1,
        httpStatus: result.httpStatus,
        errorMessage: result.error,
        nextRetryAt: calculateNextRetry(delivery.attemptNumber, delivery.endpoint.retryDelay),
      },
    })
  }
}

/**
 * Calculate next retry time with exponential backoff
 */
function calculateNextRetry(attemptNumber: number, baseDelaySeconds: number): Date {
  // Exponential backoff: base * 2^(attempt-1), capped at 24 hours
  const exponentialDelay = Math.min(
    baseDelaySeconds * Math.pow(2, attemptNumber - 1),
    24 * 60 * 60 // 24 hours max
  )

  return new Date(Date.now() + exponentialDelay * 1000)
}

/**
 * Process all pending webhook deliveries
 * 
 * This should be called periodically (e.g., every minute) to handle retries
 */
export async function processWebhookDeliveries(options?: { maxDeliveries?: number }): Promise<{
  processed: number
  succeeded: number
  failed: number
  errors: string[]
}> {
  const maxDeliveries = options?.maxDeliveries || 100

  const stats = {
    processed: 0,
    succeeded: 0,
    failed: 0,
    errors: [] as string[],
  }

  try {
    // Find pending deliveries that are ready to send
    // This includes:
    // 1. New deliveries (status: 'pending', sentAt: null)
    // 2. Retry attempts (status: 'pending', nextRetryAt <= now)
    const now = new Date()
    const pendingDeliveries = await prisma.webhookDelivery.findMany({
      where: {
        status: 'pending',
        endpoint: { active: true }, // Only deliver to active endpoints
        OR: [
          { sentAt: null }, // Never sent
          { nextRetryAt: { lte: now } }, // Ready for retry
        ],
      },
      take: maxDeliveries,
      include: {
        event: true,
        endpoint: true,
      },
    })

    for (const delivery of pendingDeliveries) {
      try {
        const result = await sendWebhookDelivery(
          delivery,
          delivery.event,
          delivery.endpoint
        )

        if (result.success) {
          // Mark as delivered
          await prisma.webhookDelivery.update({
            where: { id: delivery.id },
            data: {
              status: 'success',
              sentAt: new Date(),
              respondedAt: new Date(),
              httpStatus: result.httpStatus,
            },
          })

          // Mark event as delivered if all endpoints succeeded
          const failedDeliveries = await prisma.webhookDelivery.count({
            where: {
              eventId: delivery.eventId,
              status: { in: ['failed', 'pending'] },
            },
          })

          if (failedDeliveries === 0) {
            await prisma.webhookEvent.update({
              where: { id: delivery.eventId },
              data: { status: 'delivered' },
            })
          }

          stats.succeeded++
        } else {
          // Check if we should retry
          if (delivery.attemptNumber < delivery.endpoint.maxRetries) {
            const nextRetryAt = calculateNextRetry(
              delivery.attemptNumber,
              delivery.endpoint.retryDelay
            )

            await prisma.webhookDelivery.update({
              where: { id: delivery.id },
              data: {
                status: 'pending',
                attemptNumber: delivery.attemptNumber + 1,
                sentAt: new Date(),
                respondedAt: null,
                httpStatus: result.httpStatus,
                errorMessage: result.error,
                nextRetryAt,
              },
            })
          } else {
            // Max retries exceeded
            await prisma.webhookDelivery.update({
              where: { id: delivery.id },
              data: {
                status: 'failed',
                sentAt: new Date(),
                respondedAt: new Date(),
                httpStatus: result.httpStatus,
                errorMessage: result.error,
              },
            })

            // Mark event as failed
            await prisma.webhookEvent.update({
              where: { id: delivery.eventId },
              data: { status: 'failed' },
            })
          }

          stats.failed++
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        stats.errors.push(`Delivery ${delivery.id}: ${errorMessage}`)
        logError(`Failed to process webhook delivery ${delivery.id}`, error)
      }

      stats.processed++
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    stats.errors.push(`Error fetching deliveries: ${errorMessage}`)
    logError('Error processing webhook deliveries', error)
  }

  return stats
}

/**
 * Clean up old webhook events and deliveries
 * 
 * Removes events and deliveries older than `daysToKeep` (default 30 days)
 * Call this periodically to maintain database performance
 */
export async function cleanupOldWebhookRecords(daysToKeep: number = 30): Promise<{
  deletedEvents: number
  deletedDeliveries: number
}> {
  const cutoffDate = new Date()
  cutoffDate.setDate(cutoffDate.getDate() - daysToKeep)

  try {
    // Delete old deliveries first (they reference events)
    const deliveriesResult = await prisma.webhookDelivery.deleteMany({
      where: {
        createdAt: { lt: cutoffDate },
      },
    })

    // Delete old events
    const eventsResult = await prisma.webhookEvent.deleteMany({
      where: {
        createdAt: { lt: cutoffDate },
        status: { in: ['delivered', 'failed', 'archived'] },
      },
    })

    return {
      deletedEvents: eventsResult.count,
      deletedDeliveries: deliveriesResult.count,
    }
  } catch (error) {
    logError('Error cleaning up webhook records', error)
    return { deletedEvents: 0, deletedDeliveries: 0 }
  }
}
