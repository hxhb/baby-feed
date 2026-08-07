import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { validateId, validateUrl, safeParseBody, validateSameOrigin } from '@/lib/validation'
import { buildUserActionKey, enforceRateLimit } from '@/lib/rate-limit'
import { getRateLimit } from '@/lib/rate-limit-config'
import { noStoreHeaders } from '@/lib/api-helpers'
import { logError } from '@/lib/logger'
import { getAllEventTypes } from '@/lib/webhook-events'
import { buildWebhookEndpointDedupeKey } from '@/lib/webhook-endpoint'
import { Prisma } from '@/app/generated/prisma/client'

/**
 * PUT /api/webhooks/[id]
 * Update a webhook endpoint
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const session = await auth(request)
    if (!session?.user) {
      return NextResponse.json({ error: '未授权' }, { status: 401, headers: noStoreHeaders })
    }

    const updateRateLimit = enforceRateLimit({
      key: buildUserActionKey('webhook-update', session.user.id, request),
      ...getRateLimit('webhook-update'),
    })
    if (!updateRateLimit.allowed) {
      return NextResponse.json(
        { error: '操作过于频繁，请稍后再试' },
        {
          status: 429,
          headers: {
            ...noStoreHeaders,
            'Retry-After': String(updateRateLimit.retryAfterSeconds),
          },
        }
      )
    }

    const originCheck = validateSameOrigin(request)
    if (!originCheck.valid) {
      return NextResponse.json({ error: originCheck.error }, { status: 403, headers: noStoreHeaders })
    }

    const idCheck = validateId(id, 'endpoint ID')
    if (!idCheck.valid) {
      return NextResponse.json({ error: idCheck.error }, { status: 400, headers: noStoreHeaders })
    }

    const { data: body, error: parseError } = await safeParseBody(request)
    if (parseError || !body) {
      return NextResponse.json({ error: parseError || '请求体格式不正确' }, { status: 400, headers: noStoreHeaders })
    }

    // Check ownership
    const existing = await prisma.webhookEndpoint.findFirst({
      where: { id, userId: session.user.id }
    })

    if (!existing) {
      return NextResponse.json({ error: 'webhook 端点不存在' }, { status: 404, headers: noStoreHeaders })
    }

    const { url, description, events, maxRetries, retryDelay, active } = body

    const updateData: Record<string, unknown> = {}

    if (url !== undefined) {
      if (typeof url !== 'string') {
        return NextResponse.json({ error: 'URL 必须是字符串' }, { status: 400, headers: noStoreHeaders })
      }
      const urlCheck = validateUrl(url)
      if (!urlCheck.valid) {
        return NextResponse.json({ error: urlCheck.error || 'URL 格式不正确' }, { status: 400, headers: noStoreHeaders })
      }
      updateData.url = url
      updateData.dedupeKey = buildWebhookEndpointDedupeKey(session.user.id, url)
    }

    if (description !== undefined) {
      updateData.description = description === null ? null : String(description)
    }

    if (events !== undefined) {
      if (!Array.isArray(events) || events.length === 0) {
        return NextResponse.json({ error: '必须选择至少一个事件类型' }, { status: 400, headers: noStoreHeaders })
      }
      const validEventTypes = getAllEventTypes()
      for (const event of events) {
        if (typeof event !== 'string' || (!(validEventTypes as readonly string[]).includes(event) && event !== '*')) {
          return NextResponse.json({ error: `无效的事件类型: ${event}` }, { status: 400, headers: noStoreHeaders })
        }
      }
      updateData.events = JSON.stringify(events)
    }

    if (maxRetries !== undefined) {
      if (typeof maxRetries !== 'number' || maxRetries < 0 || maxRetries > 10) {
        return NextResponse.json({ error: '重试次数必须在 0-10 之间' }, { status: 400, headers: noStoreHeaders })
      }
      updateData.maxRetries = maxRetries
    }

    if (retryDelay !== undefined) {
      if (typeof retryDelay !== 'number' || retryDelay < 10 || retryDelay > 3600) {
        return NextResponse.json({ error: '重试延迟必须在 10-3600 秒之间' }, { status: 400, headers: noStoreHeaders })
      }
      updateData.retryDelay = retryDelay
    }

    if (active !== undefined) {
      if (typeof active !== 'boolean') {
        return NextResponse.json({ error: '激活状态必须是布尔值' }, { status: 400, headers: noStoreHeaders })
      }
      updateData.active = active
    }

    const updated = await prisma.webhookEndpoint.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        url: true,
        description: true,
        events: true,
        active: true,
        maxRetries: true,
        retryDelay: true,
        createdAt: true,
        updatedAt: true,
      }
    })

    return NextResponse.json(
      {
        ...updated,
        events: JSON.parse(updated.events),
      },
      { headers: noStoreHeaders }
    )
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return NextResponse.json(
        { error: '该 URL 已存在，请使用不同的 URL 或编辑现有端点' },
        { status: 409, headers: noStoreHeaders }
      )
    }
    logError('更新 webhook 端点失败', error)
    return NextResponse.json({ error: '更新失败' }, { status: 500, headers: noStoreHeaders })
  }
}

/**
 * DELETE /api/webhooks/[id]
 * Delete a webhook endpoint
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const session = await auth(request)
    if (!session?.user) {
      return NextResponse.json({ error: '未授权' }, { status: 401, headers: noStoreHeaders })
    }

    const deleteRateLimit = enforceRateLimit({
      key: buildUserActionKey('webhook-delete', session.user.id, request),
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

    const idCheck = validateId(id, 'endpoint ID')
    if (!idCheck.valid) {
      return NextResponse.json({ error: idCheck.error }, { status: 400, headers: noStoreHeaders })
    }

    // Check ownership
    const existing = await prisma.webhookEndpoint.findFirst({
      where: { id, userId: session.user.id }
    })

    if (!existing) {
      return NextResponse.json({ error: 'webhook 端点不存在' }, { status: 404, headers: noStoreHeaders })
    }

    await prisma.webhookEndpoint.delete({ where: { id } })

    return NextResponse.json({ success: true }, { headers: noStoreHeaders })
  } catch (error) {
    logError('删除 webhook 端点失败', error)
    return NextResponse.json({ error: '删除失败' }, { status: 500, headers: noStoreHeaders })
  }
}
