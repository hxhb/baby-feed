import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { validateUrl, safeParseBody, validateSameOrigin } from '@/lib/validation'
import { buildUserActionKey, enforceRateLimit } from '@/lib/rate-limit'
import { getRateLimit } from '@/lib/rate-limit-config'
import { noStoreHeaders } from '@/lib/api-helpers'
import { logError } from '@/lib/logger'
import { getAllEventTypes } from '@/lib/webhook-events'
import { activityLogger } from '@/lib/activity-logger'
import crypto from 'crypto'

/**
 * GET /api/webhooks
 * List all webhook endpoints for the current user
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth(request)
    if (!session?.user) {
      return NextResponse.json({ error: '未授权' }, { status: 401, headers: noStoreHeaders })
    }

    const listRateLimit = enforceRateLimit({
      key: buildUserActionKey('webhook-list', session.user.id, request),
      ...getRateLimit('webhook-list'),
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

    const endpoints = await prisma.webhookEndpoint.findMany({
      where: { userId: session.user.id },
      select: {
        id: true,
        url: true,
        description: true,
        events: true,
        active: true,
        maxRetries: true,
        retryDelay: true,
        createdAt: true,
        lastTriedAt: true,
      },
      orderBy: { createdAt: 'desc' }
    })

    // Get delivery counts from in-memory activity logger
    const logStats = activityLogger.stats('webhook', session.user.id)

    const enriched = endpoints.map(ep => ({
      ...ep,
      events: JSON.parse(ep.events || '[]'),
      deliveriesCount: logStats.byGroup[ep.id] || 0,
    }))

    return NextResponse.json(enriched, { headers: noStoreHeaders })
  } catch (error) {
    logError('获取 webhook 端点失败', error)
    return NextResponse.json({ error: '获取失败' }, { status: 500, headers: noStoreHeaders })
  }
}

/**
 * POST /api/webhooks
 * Create a new webhook endpoint
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth(request)
    if (!session?.user) {
      return NextResponse.json({ error: '未授权' }, { status: 401, headers: noStoreHeaders })
    }

    const createRateLimit = enforceRateLimit({
      key: buildUserActionKey('webhook-create', session.user.id, request),
      ...getRateLimit('webhook-create'),
    })
    if (!createRateLimit.allowed) {
      return NextResponse.json(
        { error: '操作过于频繁，请稍后再试' },
        {
          status: 429,
          headers: {
            ...noStoreHeaders,
            'Retry-After': String(createRateLimit.retryAfterSeconds),
          },
        }
      )
    }

    const originCheck = validateSameOrigin(request)
    if (!originCheck.valid) {
      return NextResponse.json({ error: originCheck.error }, { status: 403, headers: noStoreHeaders })
    }

    const { data: body, error: parseError } = await safeParseBody(request)
    if (parseError || !body) {
      return NextResponse.json({ error: parseError || '请求体格式不正确' }, { status: 400, headers: noStoreHeaders })
    }

    const { url, description, events, maxRetries = 5, retryDelay = 60 } = body

    if (!url || typeof url !== 'string') {
      return NextResponse.json({ error: '缺少或无效的 URL' }, { status: 400, headers: noStoreHeaders })
    }

    const urlCheck = validateUrl(url)
    if (!urlCheck.valid) {
      return NextResponse.json({ error: urlCheck.error || 'URL 格式不正确' }, { status: 400, headers: noStoreHeaders })
    }

    if (!Array.isArray(events) || events.length === 0) {
      return NextResponse.json({ error: '必须选择至少一个事件类型' }, { status: 400, headers: noStoreHeaders })
    }

    const validEventTypes = getAllEventTypes()
    for (const event of events) {
      if (typeof event !== 'string' || (!(validEventTypes as readonly string[]).includes(event) && event !== '*')) {
        return NextResponse.json({ error: `无效的事件类型: ${event}` }, { status: 400, headers: noStoreHeaders })
      }
    }

    if (typeof maxRetries !== 'number' || maxRetries < 0 || maxRetries > 10) {
      return NextResponse.json({ error: '重试次数必须在 0-10 之间' }, { status: 400, headers: noStoreHeaders })
    }

    if (typeof retryDelay !== 'number' || retryDelay < 10 || retryDelay > 3600) {
      return NextResponse.json({ error: '重试延迟必须在 10-3600 秒之间' }, { status: 400, headers: noStoreHeaders })
    }

    // Check for duplicate URL per user (prevent accidental duplicates)
    const existingEndpoint = await prisma.webhookEndpoint.findFirst({
      where: { userId: session.user.id, url },
    })
    if (existingEndpoint) {
      return NextResponse.json(
        { error: '该 URL 已存在，请使用不同的 URL 或编辑现有端点' },
        { status: 409, headers: noStoreHeaders }
      )
    }

    // Generate a random secret for signing webhooks
    const secret = crypto.randomBytes(32).toString('hex')

    const endpoint = await prisma.webhookEndpoint.create({
      data: {
        userId: session.user.id,
        url,
        description: typeof description === 'string' && description ? description : null,
        events: JSON.stringify(events),
        secret,
        maxRetries,
        retryDelay,
      },
      select: {
        id: true,
        url: true,
        description: true,
        events: true,
        secret: true,
        active: true,
        maxRetries: true,
        retryDelay: true,
        createdAt: true,
      }
    })

    return NextResponse.json(
      {
        ...endpoint,
        events: JSON.parse(endpoint.events),
      },
      { status: 201, headers: noStoreHeaders }
    )
  } catch (error) {
    logError('创建 webhook 端点失败', error)
    return NextResponse.json({ error: '创建失败' }, { status: 500, headers: noStoreHeaders })
  }
}
