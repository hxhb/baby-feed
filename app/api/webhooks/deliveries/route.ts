import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { buildUserActionKey, enforceRateLimit } from '@/lib/rate-limit'
import { getRateLimit } from '@/lib/rate-limit-config'
import { noStoreHeaders } from '@/lib/api-helpers'
import { logError } from '@/lib/logger'

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

    return NextResponse.json(
      {
        deliveries,
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
