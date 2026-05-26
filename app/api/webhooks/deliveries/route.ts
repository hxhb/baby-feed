import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { activityLogger } from '@/lib/activity-logger'
import { buildUserActionKey, enforceRateLimit } from '@/lib/rate-limit'
import { getRateLimit } from '@/lib/rate-limit-config'
import { noStoreHeaders } from '@/lib/api-helpers'
import { logError } from '@/lib/logger'
import { validateSameOrigin } from '@/lib/validation'

/**
 * GET /api/webhooks/deliveries
 * Get webhook delivery logs from in-memory activity logger.
 *
 * Query params:
 *   endpointId? - filter by specific endpoint
 *   status?     - filter by status (success/failed/pending)
 *   limit?      - max entries (default 50, max 100)
 *   offset?     - pagination offset (default 0)
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth(request)
    if (!session?.user) {
      return NextResponse.json({ error: '未授权' }, { status: 401, headers: noStoreHeaders })
    }

    const listRateLimit = enforceRateLimit({
      key: buildUserActionKey('webhook-deliveries-list', session.user.id, request),
      ...getRateLimit('webhook-deliveries-list'),
    })
    if (!listRateLimit.allowed) {
      return NextResponse.json(
        { error: '请求过于频繁，请稍后再试' },
        {
          status: 429,
          headers: {
            ...noStoreHeaders,
            'Retry-After': String(listRateLimit.retryAfterSeconds),
          },
        }
      )
    }

    const { searchParams } = new URL(request.url)
    const endpointId = searchParams.get('endpointId') || undefined
    const status = searchParams.get('status') || undefined
    const limit = Math.min(parseInt(searchParams.get('limit') || '50') || 50, 100)
    const offset = Math.max(parseInt(searchParams.get('offset') || '0') || 0, 0)

    // If endpointId is provided, verify it belongs to this user
    if (endpointId) {
      const endpoint = await prisma.webhookEndpoint.findFirst({
        where: { id: endpointId, userId: session.user.id }
      })

      if (!endpoint) {
        return NextResponse.json({ error: 'webhook 端点不存在' }, { status: 404, headers: noStoreHeaders })
      }
    }

    const result = activityLogger.query('webhook', session.user.id, {
      groupKey: endpointId,
      status,
      limit,
      offset,
    })

    return NextResponse.json(
      {
        deliveries: result.entries,
        total: result.total,
        offset,
        limit,
      },
      { headers: noStoreHeaders }
    )
  } catch (error) {
    logError('获取 webhook 投递日志失败', error)
    return NextResponse.json({ error: '获取失败' }, { status: 500, headers: noStoreHeaders })
  }
}

/**
 * DELETE /api/webhooks/deliveries?endpointId=xxx
 * Clear webhook delivery logs from activity logger.
 *
 * Query params:
 *   endpointId? - clear logs for specific endpoint; omit to clear all
 */
export async function DELETE(request: NextRequest) {
  try {
    const session = await auth(request)
    if (!session?.user) {
      return NextResponse.json({ error: '未授权' }, { status: 401, headers: noStoreHeaders })
    }

    const deleteRateLimit = enforceRateLimit({
      key: buildUserActionKey('webhook-deliveries-delete', session.user.id, request),
      ...getRateLimit('webhook-delete'),
    })
    if (!deleteRateLimit.allowed) {
      return NextResponse.json(
        { error: '操作过于频繁，请稍后再试' },
        {
          status: 429,
          headers: {
            ...noStoreHeaders,
            'Retry-After': String(deleteRateLimit.retryAfterSeconds),
          },
        }
      )
    }

    const originCheck = validateSameOrigin(request)
    if (!originCheck.valid) {
      return NextResponse.json({ error: originCheck.error }, { status: 403, headers: noStoreHeaders })
    }

    const { searchParams } = new URL(request.url)
    const endpointId = searchParams.get('endpointId') || undefined

    // If endpointId provided, verify ownership
    if (endpointId) {
      const endpoint = await prisma.webhookEndpoint.findFirst({
        where: { id: endpointId, userId: session.user.id }
      })

      if (!endpoint) {
        return NextResponse.json({ error: 'webhook 端点不存在' }, { status: 404, headers: noStoreHeaders })
      }
    }

    const deleted = activityLogger.clear('webhook', session.user.id, endpointId)

    return NextResponse.json(
      { success: true, deleted },
      { headers: noStoreHeaders }
    )
  } catch (error) {
    logError('清理 webhook 投递日志失败', error)
    return NextResponse.json({ error: '清理失败' }, { status: 500, headers: noStoreHeaders })
  }
}
