import { activityLogger } from './activity-logger'
import { logError } from './logger'
import { prisma } from './prisma'
import { buildReminderConfigFingerprint, calculateRetryDelayMs } from './reminder-core'
import { getIntervalSourceSnapshot } from './reminder-rescheduler'
import crypto from 'crypto'

interface DeliveryResult {
  success: boolean
  httpStatus?: number
  error?: string
}

const DELIVERY_LEASE_MS = 30_000

function signWebhookPayload(payload: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(payload).digest('hex')
}

const MAX_PAYLOAD_SIZE = 100 * 1024

function sanitizeErrorMessage(error: string): string {
  const patterns = [
    /bearer\s+[^\s]+/gi,
    /authorization:\s*[^\s]+/gi,
    /token[=:]\s*\w+/gi,
    /password[=:]\s*\w+/gi,
    /api[_-]?key[=:]\s*\w+/gi,
    /secret[=:]\s*\w+/gi,
  ]
  return patterns.reduce((value, pattern) => value.replace(pattern, '[REDACTED]'), error).slice(0, 200)
}

export async function sendWebhookDelivery(
  payload: string,
  eventType: string,
  eventId: string,
  deliveryId: string,
  endpoint: { url: string; secret: string },
): Promise<DeliveryResult> {
  if (payload.length > MAX_PAYLOAD_SIZE) {
    return { success: false, error: `Payload exceeds maximum size (${MAX_PAYLOAD_SIZE} bytes)` }
  }

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 10_000)
  try {
    const response = await fetch(endpoint.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Signature': signWebhookPayload(payload, endpoint.secret),
        'X-Webhook-Event-Type': eventType,
        'X-Webhook-Event-ID': eventId,
        'X-Webhook-Delivery-ID': deliveryId,
        'X-Webhook-Timestamp': new Date().toISOString(),
      },
      body: payload,
      signal: controller.signal,
    })
    if (!response.ok) return { success: false, httpStatus: response.status, error: `HTTP ${response.status}` }
    return { success: true, httpStatus: response.status }
  } catch (error) {
    return {
      success: false,
      error: sanitizeErrorMessage(error instanceof Error ? error.message : String(error)),
    }
  } finally {
    clearTimeout(timeoutId)
  }
}

async function reminderEventIsCurrent(payloadText: string): Promise<boolean> {
  try {
    const payload = JSON.parse(payloadText) as {
      type?: string
      data?: {
        ruleId?: string
        triggerType?: string
        context?: {
          sourceRecordId?: string | null
          lastRecordTime?: string | null
          configFingerprint?: string
          evaluatedAt?: string
        }
      }
    }
    if (payload.type !== 'reminder.fired') return true

    const data = payload.data
    if (!data) return false
    const ruleId = data.ruleId
    const context = data.context
    if (!ruleId) return false

    const rule = await prisma.reminderRule.findUnique({
      where: { id: ruleId },
      select: {
        id: true,
        babyId: true,
        triggerType: true,
        triggerConfig: true,
        advanceMinutes: true,
        enabled: true,
        lastFiredAt: true,
      },
    })
    if (!rule?.enabled) return false
    if (data.triggerType !== rule.triggerType) return false
    if (context?.evaluatedAt && rule.lastFiredAt?.toISOString() !== context.evaluatedAt) return false

    if (context?.configFingerprint && context.configFingerprint !== buildReminderConfigFingerprint(
      rule.triggerType,
      rule.triggerConfig,
      rule.advanceMinutes,
    )) return false
    if (rule.triggerType !== 'interval') return true
    if (!context || !Object.prototype.hasOwnProperty.call(context, 'sourceRecordId')) return true

    const snapshot = await getIntervalSourceSnapshot(rule)
    return snapshot.sourceRecordId === context.sourceRecordId
      && (snapshot.sourceRecordTime?.toISOString() ?? null) === (context.lastRecordTime ?? null)
  } catch (error) {
    logError('Failed to revalidate reminder webhook; keeping delivery pending', error)
    throw error
  }
}

async function refreshEventStatus(eventId: string): Promise<void> {
  const deliveries = await prisma.webhookDelivery.findMany({
    where: { eventId },
    select: { status: true },
  })
  let status = 'PENDING'
  if (deliveries.length === 0 || deliveries.every(item => item.status === 'SUCCESS')) status = 'DELIVERED'
  else if (deliveries.every(item => item.status === 'CANCELLED')) status = 'CANCELLED'
  else if (deliveries.every(item => item.status === 'SUCCESS' || item.status === 'CANCELLED')) status = 'DELIVERED'
  else if (deliveries.every(item => ['SUCCESS', 'CANCELLED', 'FAILED'].includes(item.status))) status = 'FAILED'
  await prisma.webhookEvent.update({ where: { id: eventId }, data: { status } })
}

function recordDeliveryActivity(params: {
  delivery: {
    id: string
    endpointId: string
    event: { userId: string; type: string; summary: string; id: string }
    endpoint: { url: string }
  }
  status: 'success' | 'failed' | 'pending'
  attemptNumber: number
  result?: DeliveryResult
}): void {
  activityLogger.record({
    source: 'webhook',
    userId: params.delivery.event.userId,
    groupKey: params.delivery.endpointId,
    groupLabel: params.delivery.endpoint.url,
    status: params.status,
    summary: params.delivery.event.summary,
    meta: {
      eventType: params.delivery.event.type,
      eventId: params.delivery.event.id,
      deliveryId: params.delivery.id,
      attemptNumber: params.attemptNumber,
      httpStatus: params.result?.httpStatus ?? null,
      errorMessage: params.result?.error ?? null,
      sentAt: new Date().toISOString(),
      endpointUrl: params.delivery.endpoint.url,
    },
  })
}

export async function attemptWebhookDelivery(deliveryId: string): Promise<'processed' | 'skipped'> {
  const now = new Date()
  const leaseUntil = new Date(now.getTime() + DELIVERY_LEASE_MS)
  const leaseToken = crypto.randomBytes(12).toString('hex')
  const claim = await prisma.webhookDelivery.updateMany({
    where: {
      id: deliveryId,
      OR: [
        { status: 'PENDING', nextRetryAt: { lte: now } },
        { status: 'PROCESSING', leaseUntil: { lt: now } },
      ],
    },
    data: { status: 'PROCESSING', leaseUntil, leaseToken },
  })
  if (claim.count !== 1) return 'skipped'

  const delivery = await prisma.webhookDelivery.findUnique({
    where: { id: deliveryId },
    include: { event: true, endpoint: true },
  })
  if (!delivery || delivery.leaseToken !== leaseToken) return 'skipped'

  try {
    if (!delivery.endpoint.active || !(await reminderEventIsCurrent(delivery.event.payload))) {
      const cancelled = await prisma.webhookDelivery.updateMany({
        where: { id: delivery.id, status: 'PROCESSING', leaseToken },
        data: {
          status: 'CANCELLED',
          leaseUntil: null,
          leaseToken: null,
          errorMessage: 'Event is no longer current',
        },
      })
      if (cancelled.count !== 1) return 'skipped'
      await refreshEventStatus(delivery.eventId)
      return 'processed'
    }

    const attemptNumber = delivery.attemptNumber + 1
    const result = await sendWebhookDelivery(
      delivery.event.payload,
      delivery.event.type,
      delivery.event.id,
      delivery.id,
      delivery.endpoint,
    )
    await prisma.webhookEndpoint.updateMany({
      where: {
        id: delivery.endpointId,
        OR: [{ lastTriedAt: null }, { lastTriedAt: { lt: now } }],
      },
      data: { lastTriedAt: new Date() },
    })

    if (result.success) {
      const finalized = await prisma.webhookDelivery.updateMany({
        where: { id: delivery.id, status: 'PROCESSING', leaseToken },
        data: {
          status: 'SUCCESS',
          attemptNumber,
          leaseUntil: null,
          leaseToken: null,
          httpStatus: result.httpStatus ?? null,
          errorMessage: null,
          sentAt: new Date(),
        },
      })
      if (finalized.count !== 1) return 'skipped'
      recordDeliveryActivity({ delivery, status: 'success', attemptNumber, result })
    } else if (attemptNumber < delivery.endpoint.maxRetries) {
      const finalized = await prisma.webhookDelivery.updateMany({
        where: { id: delivery.id, status: 'PROCESSING', leaseToken },
        data: {
          status: 'PENDING',
          attemptNumber,
          leaseUntil: null,
          leaseToken: null,
          httpStatus: result.httpStatus ?? null,
          errorMessage: result.error ?? null,
          nextRetryAt: new Date(Date.now() + calculateRetryDelayMs(attemptNumber, delivery.endpoint.retryDelay)),
        },
      })
      if (finalized.count !== 1) return 'skipped'
      recordDeliveryActivity({ delivery, status: 'pending', attemptNumber, result })
    } else {
      const finalized = await prisma.webhookDelivery.updateMany({
        where: { id: delivery.id, status: 'PROCESSING', leaseToken },
        data: {
          status: 'FAILED',
          attemptNumber,
          leaseUntil: null,
          leaseToken: null,
          httpStatus: result.httpStatus ?? null,
          errorMessage: result.error ?? null,
        },
      })
      if (finalized.count !== 1) return 'skipped'
      recordDeliveryActivity({ delivery, status: 'failed', attemptNumber, result })
    }

    await refreshEventStatus(delivery.eventId)
    return 'processed'
  } catch (error) {
    await prisma.webhookDelivery.updateMany({
      where: { id: delivery.id, status: 'PROCESSING', leaseToken },
      data: {
        status: 'PENDING',
        leaseUntil: null,
        leaseToken: null,
        errorMessage: sanitizeErrorMessage(error instanceof Error ? error.message : String(error)),
        nextRetryAt: new Date(Date.now() + 60_000),
      },
    }).catch(updateError => logError(`Failed to release webhook delivery ${delivery.id}`, updateError))
    throw error
  }
}

export async function processWebhookDeliveries(options?: { maxDeliveries?: number }): Promise<{
  processed: number
  succeeded: number
  failed: number
  errors: string[]
}> {
  const now = new Date()
  const deliveries = await prisma.webhookDelivery.findMany({
    where: {
      OR: [
        { status: 'PENDING', nextRetryAt: { lte: now } },
        { status: 'PROCESSING', leaseUntil: { lt: now } },
      ],
    },
    orderBy: { nextRetryAt: 'asc' },
    take: options?.maxDeliveries ?? 100,
    select: { id: true },
  })

  const stats = { processed: 0, succeeded: 0, failed: 0, errors: [] as string[] }
  for (const delivery of deliveries) {
    try {
      const outcome = await attemptWebhookDelivery(delivery.id)
      if (outcome === 'processed') {
        stats.processed++
        const current = await prisma.webhookDelivery.findUnique({
          where: { id: delivery.id },
          select: { status: true },
        })
        if (current?.status === 'SUCCESS') stats.succeeded++
        if (current?.status === 'FAILED') stats.failed++
      }
    } catch (error) {
      stats.errors.push(error instanceof Error ? error.message : String(error))
      logError(`Failed to process webhook delivery ${delivery.id}`, error)
    }
  }
  return stats
}

export async function getQueueStats(): Promise<{ pending: number }> {
  return {
    pending: await prisma.webhookDelivery.count({
      where: { status: { in: ['PENDING', 'PROCESSING'] } },
    }),
  }
}
