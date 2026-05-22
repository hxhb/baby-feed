import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { buildUserActionKey, enforceRateLimit } from '@/lib/rate-limit'
import { getRateLimit } from '@/lib/rate-limit-config'
import { noStoreHeaders } from '@/lib/api-helpers'
import { logError } from '@/lib/logger'
import { validateSameOrigin } from '@/lib/validation'

// Record type labels for summary generation
const RECORD_TYPE_LABELS: Record<string, string> = {
  BREAST_MILK: '母乳亲喂',
  BREAST_MILK_BOTTLE: '母乳瓶喂',
  FORMULA: '奶粉',
  SOLID_FOOD: '辅食',
  WEIGHT: '体重',
  HEIGHT: '身高',
  TEMPERATURE: '体温',
  MEDICATION: '服药',
  VACCINE: '疫苗',
  DIAPER: '大小便',
  AD_VITAMIN: 'AD滴剂',
  SLEEP: '睡眠',
}

/**
 * Extract a human-readable summary from webhook event payload
 */
function extractPayloadSummary(payload: string): string {
  try {
    const parsed = JSON.parse(payload)
    const data = parsed.data
    if (!data) return ''

    const parts: string[] = []

    // Baby name
    const babyName = data.baby?.name
    if (babyName) parts.push(babyName)

    // Content detail
    if (data.title) {
      // Memo events
      parts.push(data.title)
    } else if (data.type && RECORD_TYPE_LABELS[data.type]) {
      // Feeding/Health events
      parts.push(RECORD_TYPE_LABELS[data.type])
      // Add amount/value detail for feeding
      if (data.formulaAmount) parts.push(`${data.formulaAmount}ml`)
      else if (data.breastMilkAmount) parts.push(`${data.breastMilkAmount}ml`)
      else if (data.weight) parts.push(`${data.weight}kg`)
      else if (data.height) parts.push(`${data.height}cm`)
      else if (data.temperature) parts.push(`${data.temperature}°C`)
    } else if (data.email) {
      // User events
      parts.push(data.email)
    }

    return parts.join(' · ')
  } catch {
    return ''
  }
}

/**
 * GET /api/webhooks/deliveries
 * Get webhook delivery logs filtered by status and endpoint
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
    const endpointId = searchParams.get('endpointId')
    const status = searchParams.get('status')
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100)
    const offset = Math.max(parseInt(searchParams.get('offset') || '0'), 0)

    // If endpointId is provided, verify it belongs to this user
    if (endpointId) {
      const endpoint = await prisma.webhookEndpoint.findFirst({
        where: { id: endpointId, userId: session.user.id }
      })

      if (!endpoint) {
        return NextResponse.json({ error: 'webhook 端点不存在' }, { status: 404, headers: noStoreHeaders })
      }
    }

    const where: Record<string, unknown> = {}

    if (endpointId) {
      where.endpointId = endpointId
    } else {
      // If no endpointId, filter by user's endpoints
      const userEndpointIds = await prisma.webhookEndpoint
        .findMany({
          where: { userId: session.user.id },
          select: { id: true }
        })
        .then(eps => eps.map(ep => ep.id))

      where.endpointId = { in: userEndpointIds }
    }

    if (status) {
      where.status = status
    }

    const deliveries = await prisma.webhookDelivery.findMany({
      where,
      include: {
        event: {
          select: {
            id: true,
            type: true,
            recordId: true,
            recordType: true,
            payload: true,
          }
        },
        endpoint: {
          select: {
            id: true,
            url: true,
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      skip: offset,
      take: limit,
    })

    const total = await prisma.webhookDelivery.count({ where })

    // Transform deliveries to include summary and exclude raw payload
    const transformedDeliveries = deliveries.map(delivery => ({
      ...delivery,
      summary: extractPayloadSummary(delivery.event.payload),
      event: {
        id: delivery.event.id,
        type: delivery.event.type,
        recordId: delivery.event.recordId,
        recordType: delivery.event.recordType,
      },
    }))

    return NextResponse.json(
      {
        deliveries: transformedDeliveries,
        total,
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
 * Clear all delivery logs for a specific webhook endpoint
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
    const endpointId = searchParams.get('endpointId')

    if (!endpointId) {
      return NextResponse.json({ error: '必须指定 endpointId' }, { status: 400, headers: noStoreHeaders })
    }

    // Verify endpoint belongs to user
    const endpoint = await prisma.webhookEndpoint.findFirst({
      where: { id: endpointId, userId: session.user.id }
    })

    if (!endpoint) {
      return NextResponse.json({ error: 'webhook 端点不存在' }, { status: 404, headers: noStoreHeaders })
    }

    // Delete all deliveries for this endpoint
    const deleteResult = await prisma.webhookDelivery.deleteMany({
      where: { endpointId }
    })

    // Clean up orphaned events (events with no remaining deliveries)
    const orphanedEvents = await prisma.webhookEvent.findMany({
      where: {
        userId: session.user.id,
        deliveries: { none: {} }
      },
      select: { id: true }
    })

    if (orphanedEvents.length > 0) {
      await prisma.webhookEvent.deleteMany({
        where: { id: { in: orphanedEvents.map(e => e.id) } }
      })
    }

    return NextResponse.json(
      { success: true, deletedDeliveries: deleteResult.count, deletedEvents: orphanedEvents.length },
      { headers: noStoreHeaders }
    )
  } catch (error) {
    logError('清理 webhook 投递日志失败', error)
    return NextResponse.json({ error: '清理失败' }, { status: 500, headers: noStoreHeaders })
  }
}
