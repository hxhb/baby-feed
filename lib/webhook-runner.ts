/**
 * Webhook Delivery Runner (In-Memory)
 *
 * Processes pending webhook deliveries from an in-memory queue.
 * This is meant to be run periodically (every minute or so) via cron or a background job.
 *
 * Design: all delivery state lives in memory. Process restart clears the queue.
 * This is acceptable for a self-hosted single-instance app where webhook retries
 * are best-effort and not critical.
 */

import { activityLogger } from './activity-logger'
import { logError } from './logger'
import crypto from 'crypto'

// ─── Types ──────────────────────────────────────────────────────────────────

interface DeliveryResult {
  success: boolean
  httpStatus?: number
  error?: string
}

export interface PendingWebhookDelivery {
  id: string
  eventPayload: string    // The JSON payload to deliver
  eventType: string
  endpointId: string
  endpointUrl: string
  endpointSecret: string
  userId: string
  attemptNumber: number
  maxRetries: number
  retryDelay: number      // base delay seconds
  nextRetryAt: number     // Date.now() based
  createdAt: number
  // For activity-logger summary
  summary: string
}

// ─── In-Memory Retry Queue ──────────────────────────────────────────────────

// Use globalThis to ensure a single retry queue across all Next.js compilation
// contexts (same reason as activity-logger.ts — prevents queue duplication).
const globalForQueue = globalThis as unknown as { __webhookPendingDeliveries?: PendingWebhookDelivery[] }
const pendingDeliveries: PendingWebhookDelivery[] = globalForQueue.__webhookPendingDeliveries ??= []
const MAX_PENDING = 500
const PENDING_TTL_MS = 24 * 60 * 60 * 1000 // 24 hours

/**
 * Add a delivery to the retry queue
 */
export function enqueueDelivery(delivery: PendingWebhookDelivery): void {
  // Evict expired entries
  const now = Date.now()
  purgeExpiredPending(now)

  // Cap the queue
  if (pendingDeliveries.length >= MAX_PENDING) {
    pendingDeliveries.shift() // Remove oldest
  }

  pendingDeliveries.push(delivery)
}

/**
 * Get queue stats (for cron response)
 */
export function getQueueStats(): { pending: number } {
  purgeExpiredPending(Date.now())
  return { pending: pendingDeliveries.length }
}

function purgeExpiredPending(now: number): void {
  const cutoff = now - PENDING_TTL_MS
  while (pendingDeliveries.length > 0 && pendingDeliveries[0].createdAt < cutoff) {
    pendingDeliveries.shift()
  }
}

// ─── Delivery Logic ─────────────────────────────────────────────────────────

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
export async function sendWebhookDelivery(
  payload: string,
  eventType: string,
  eventId: string,
  deliveryId: string,
  endpoint: { url: string; secret: string }
): Promise<DeliveryResult> {
  try {
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
        'X-Webhook-Event-Type': eventType,
        'X-Webhook-Event-ID': eventId,
        'X-Webhook-Delivery-ID': deliveryId,
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
 * Calculate next retry time with exponential backoff
 */
function calculateNextRetry(attemptNumber: number, baseDelaySeconds: number): number {
  // Exponential backoff: base * 2^(attempt-1), capped at 24 hours
  const exponentialDelay = Math.min(
    baseDelaySeconds * Math.pow(2, attemptNumber - 1),
    24 * 60 * 60 // 24 hours max
  )

  return Date.now() + exponentialDelay * 1000
}

/**
 * Attempt immediate delivery of a webhook and record the result.
 *
 * Called right after emitting the event. If delivery fails and retries are
 * configured, the delivery is added to the in-memory retry queue.
 */
export async function sendWebhookImmediate(
  payload: string,
  eventType: string,
  eventId: string,
  endpoint: { id: string; url: string; secret: string; maxRetries: number; retryDelay: number },
  userId: string,
  summary: string
): Promise<void> {
  const deliveryId = crypto.randomBytes(4).toString('hex')

  const result = await sendWebhookDelivery(payload, eventType, eventId, deliveryId, endpoint)

  if (result.success) {
    // Record success to activity logger
    activityLogger.record({
      source: 'webhook',
      userId,
      groupKey: endpoint.id,
      groupLabel: endpoint.url,
      status: 'success',
      summary,
      meta: {
        eventType,
        eventId,
        attemptNumber: 1,
        httpStatus: result.httpStatus ?? null,
        errorMessage: null,
        sentAt: new Date().toISOString(),
        endpointUrl: endpoint.url,
      },
    })
  } else {
    // Record failure to activity logger
    activityLogger.record({
      source: 'webhook',
      userId,
      groupKey: endpoint.id,
      groupLabel: endpoint.url,
      status: endpoint.maxRetries > 1 ? 'pending' : 'failed',
      summary,
      meta: {
        eventType,
        eventId,
        attemptNumber: 1,
        httpStatus: result.httpStatus ?? null,
        errorMessage: result.error ?? null,
        sentAt: new Date().toISOString(),
        endpointUrl: endpoint.url,
      },
    })

    // Queue for retry if retries are configured
    if (endpoint.maxRetries > 1) {
      enqueueDelivery({
        id: deliveryId,
        eventPayload: payload,
        eventType,
        endpointId: endpoint.id,
        endpointUrl: endpoint.url,
        endpointSecret: endpoint.secret,
        userId,
        attemptNumber: 2,
        maxRetries: endpoint.maxRetries,
        retryDelay: endpoint.retryDelay,
        nextRetryAt: calculateNextRetry(1, endpoint.retryDelay),
        createdAt: Date.now(),
        summary,
      })
    }
  }
}

/**
 * Process all pending webhook deliveries from the in-memory queue.
 *
 * This should be called periodically (e.g., every minute) to handle retries.
 */
export async function processWebhookDeliveries(options?: { maxDeliveries?: number }): Promise<{
  processed: number
  succeeded: number
  failed: number
  errors: string[]
}> {
  const maxDeliveries = options?.maxDeliveries || 100
  const now = Date.now()

  const stats = {
    processed: 0,
    succeeded: 0,
    failed: 0,
    errors: [] as string[],
  }

  // Purge expired first
  purgeExpiredPending(now)

  // Find deliveries that are ready to send
  const ready = pendingDeliveries.filter(d => d.nextRetryAt <= now)
  const toProcess = ready.slice(0, maxDeliveries)

  for (const delivery of toProcess) {
    try {
      const result = await sendWebhookDelivery(
        delivery.eventPayload,
        delivery.eventType,
        delivery.id,
        delivery.id,
        { url: delivery.endpointUrl, secret: delivery.endpointSecret }
      )

      // Remove from queue regardless of result (we'll re-enqueue if needed)
      const idx = pendingDeliveries.indexOf(delivery)
      if (idx !== -1) pendingDeliveries.splice(idx, 1)

      if (result.success) {
        activityLogger.record({
          source: 'webhook',
          userId: delivery.userId,
          groupKey: delivery.endpointId,
          groupLabel: delivery.endpointUrl,
          status: 'success',
          summary: delivery.summary,
          meta: {
            eventType: delivery.eventType,
            eventId: delivery.id,
            attemptNumber: delivery.attemptNumber,
            httpStatus: result.httpStatus ?? null,
            errorMessage: null,
            sentAt: new Date().toISOString(),
            endpointUrl: delivery.endpointUrl,
          },
        })
        stats.succeeded++
      } else {
        // Check if we should retry
        if (delivery.attemptNumber < delivery.maxRetries) {
          // Re-enqueue with incremented attempt
          enqueueDelivery({
            ...delivery,
            attemptNumber: delivery.attemptNumber + 1,
            nextRetryAt: calculateNextRetry(delivery.attemptNumber, delivery.retryDelay),
          })

          activityLogger.record({
            source: 'webhook',
            userId: delivery.userId,
            groupKey: delivery.endpointId,
            groupLabel: delivery.endpointUrl,
            status: 'pending',
            summary: delivery.summary,
            meta: {
              eventType: delivery.eventType,
              eventId: delivery.id,
              attemptNumber: delivery.attemptNumber,
              httpStatus: result.httpStatus ?? null,
              errorMessage: result.error ?? null,
              sentAt: new Date().toISOString(),
              endpointUrl: delivery.endpointUrl,
            },
          })
        } else {
          // Max retries exhausted
          activityLogger.record({
            source: 'webhook',
            userId: delivery.userId,
            groupKey: delivery.endpointId,
            groupLabel: delivery.endpointUrl,
            status: 'failed',
            summary: delivery.summary,
            meta: {
              eventType: delivery.eventType,
              eventId: delivery.id,
              attemptNumber: delivery.attemptNumber,
              httpStatus: result.httpStatus ?? null,
              errorMessage: result.error ?? null,
              sentAt: new Date().toISOString(),
              endpointUrl: delivery.endpointUrl,
            },
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

  return stats
}
