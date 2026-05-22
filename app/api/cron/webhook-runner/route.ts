import { NextRequest, NextResponse } from 'next/server'
import { processWebhookDeliveries, cleanupOldDeliveries, cleanupOldWebhookRecords } from '@/lib/webhook-runner'
import { logError } from '@/lib/logger'
import crypto from 'crypto'
import { buildIpActionKey, enforceRateLimit } from '@/lib/rate-limit'

/**
 * Cron endpoint for processing webhook deliveries
 *
 * This should be called periodically (every 1-5 minutes) by an external cron service.
 * Secured by CRON_SECRET environment variable (required).
 */
export async function GET(request: NextRequest) {
  try {
    // Rate limit: max 2 calls per minute to prevent abuse
    const cronRateLimit = enforceRateLimit({
      key: buildIpActionKey('cron-webhook-runner', request),
      limit: 2,
      windowMs: 60 * 1000,
    })
    if (!cronRateLimit.allowed) {
      return NextResponse.json(
        { error: 'Too many requests' },
        { status: 429 }
      )
    }

    // CRON_SECRET is required — if not set, endpoint is disabled
    const cronSecret = process.env.CRON_SECRET
    if (!cronSecret) {
      return NextResponse.json(
        { error: 'Cron endpoint not configured' },
        { status: 503 }
      )
    }

    const authHeader = request.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const token = authHeader.slice(7) // Remove "Bearer " prefix

    // Use constant-time comparison to prevent timing attacks
    try {
      const tokenBuffer = Buffer.from(token, 'utf-8')
      const secretBuffer = Buffer.from(cronSecret, 'utf-8')

      if (tokenBuffer.length !== secretBuffer.length ||
          !crypto.timingSafeEqual(tokenBuffer, secretBuffer)) {
        return NextResponse.json(
          { error: 'Unauthorized' },
          { status: 401 }
        )
      }
    } catch {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Process webhook deliveries
    const deliveryStats = await processWebhookDeliveries({ maxDeliveries: 100 })

    // Always clean up deliveries older than 1 day (cheap indexed query)
    const deliveryCleanup = await cleanupOldDeliveries(1)

    // Probabilistically clean up old event records (~10% of runs)
    let eventCleanup: { deletedEvents: number; deletedDeliveries: number } | undefined
    if (Math.random() < 0.10) {
      eventCleanup = await cleanupOldWebhookRecords(7)
    }

    return NextResponse.json({
      success: true,
      deliveries: deliveryStats,
      cleanup: {
        deliveries: deliveryCleanup,
        ...(eventCleanup ? { events: eventCleanup } : {}),
      },
    })
  } catch (error) {
    logError('Webhook runner cron failed', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
