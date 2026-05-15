import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { validateId, safeParseBody, validateSameOrigin } from '@/lib/validation'
import { buildUserActionKey, enforceRateLimit } from '@/lib/rate-limit'
import { getRateLimit } from '@/lib/rate-limit-config'
import { noStoreHeaders } from '@/lib/api-helpers'
import { logError } from '@/lib/logger'

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
      key: buildUserActionKey('memo-update', session.user.id, request),
      ...getRateLimit('memo-update'),
    })
    if (!updateRateLimit.allowed) {
      return NextResponse.json({ error: '操作过于频繁，请稍后再试' }, {
        status: 429,
        headers: {
          ...noStoreHeaders,
          'Retry-After': String(updateRateLimit.retryAfterSeconds),
        },
      })
    }

    const originCheck = validateSameOrigin(request)
    if (!originCheck.valid) {
      return NextResponse.json({ error: originCheck.error }, { status: 403, headers: noStoreHeaders })
    }

    const idCheck = validateId(id, '备忘ID')
    if (!idCheck.valid) {
      return NextResponse.json({ error: idCheck.error }, { status: 400, headers: noStoreHeaders })
    }

    const { data: body, error: parseError } = await safeParseBody(request)
    if (parseError || !body) {
      return NextResponse.json({ error: parseError || '请求体格式不正确' }, { status: 400, headers: noStoreHeaders })
    }

    const existingMemo = await prisma.memo.findFirst({
      where: {
        id,
        createdBy: session.user.id,
      },
    })

    if (!existingMemo) {
      return NextResponse.json({ error: '备忘不存在' }, { status: 404, headers: noStoreHeaders })
    }

    // Check if there's anything to update
    const hasUpdate = body.title !== undefined || body.content !== undefined || body.scheduledAt !== undefined || body.completed !== undefined
    if (!hasUpdate) {
      return NextResponse.json({ error: '没有需要更新的字段' }, { status: 400, headers: noStoreHeaders })
    }

    // Validate individual fields before building merged body
    if (body.title !== undefined) {
      if (typeof body.title !== 'string') {
        return NextResponse.json({ error: '备忘标题必须是字符串' }, { status: 400, headers: noStoreHeaders })
      }
      if (!body.title.trim()) {
        return NextResponse.json({ error: '备忘标题不能为空' }, { status: 400, headers: noStoreHeaders })
      }
      if (body.title.length > 100) {
        return NextResponse.json({ error: '备忘标题超出最大长度 (100)' }, { status: 400, headers: noStoreHeaders })
      }
    }

    if (body.content !== undefined && body.content !== null) {
      if (typeof body.content !== 'string') {
        return NextResponse.json({ error: '备忘内容必须是字符串' }, { status: 400, headers: noStoreHeaders })
      }
      if (body.content.length > 500) {
        return NextResponse.json({ error: '备忘内容超出最大长度 (500)' }, { status: 400, headers: noStoreHeaders })
      }
    }

    if (body.scheduledAt !== undefined) {
      if (typeof body.scheduledAt !== 'string') {
        return NextResponse.json({ error: '备忘时间必须是字符串' }, { status: 400, headers: noStoreHeaders })
      }
      const scheduledDate = new Date(body.scheduledAt)
      if (isNaN(scheduledDate.getTime())) {
        return NextResponse.json({ error: '备忘时间不是有效的日期格式' }, { status: 400, headers: noStoreHeaders })
      }
      // Allow past dates (user may set a past reminder), only reject unreasonable ones (>100 years ago or >5 years in future)
      const fiveYearsMs = 5 * 365 * 24 * 60 * 60 * 1000
      const hundredYearsMs = 100 * 365 * 24 * 60 * 60 * 1000
      const now = Date.now()
      if (scheduledDate.getTime() > now + fiveYearsMs || scheduledDate.getTime() < now - hundredYearsMs) {
        return NextResponse.json({ error: '备忘时间超出合理范围' }, { status: 400, headers: noStoreHeaders })
      }
    }

    if (body.completed !== undefined) {
      if (typeof body.completed !== 'boolean') {
        return NextResponse.json({ error: '是否已完成必须是布尔值' }, { status: 400, headers: noStoreHeaders })
      }
    }

    // Build update data
    const updateData: Record<string, unknown> = {}

    if (body.title !== undefined) {
      updateData.title = (body.title as string).trim()
    }
    if (body.content !== undefined) {
      updateData.content = typeof body.content === 'string' && body.content.trim() ? body.content.trim() : null
    }
    if (body.scheduledAt !== undefined) {
      updateData.scheduledAt = new Date(body.scheduledAt as string)
    }
    if (body.completed !== undefined) {
      updateData.completed = body.completed as boolean
      // Auto-set completedAt when marking as completed
      if (body.completed === true && !existingMemo.completed) {
        updateData.completedAt = new Date()
      } else if (body.completed === false) {
        updateData.completedAt = null
      }
    }

    const record = await prisma.memo.update({
      where: { id },
      data: updateData,
    })

    revalidatePath('/stats')

    return NextResponse.json(record, { headers: noStoreHeaders })
  } catch (error) {
    logError('更新备忘录失败', error)
    return NextResponse.json({ error: '更新失败' }, { status: 500, headers: noStoreHeaders })
  }
}

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
      key: buildUserActionKey('memo-delete', session.user.id, request),
      ...getRateLimit('memo-delete'),
    })
    if (!deleteRateLimit.allowed) {
      return NextResponse.json({ error: '操作过于频繁，请稍后再试' }, {
        status: 429,
        headers: {
          ...noStoreHeaders,
          'Retry-After': String(deleteRateLimit.retryAfterSeconds),
        },
      })
    }

    const originCheck = validateSameOrigin(request)
    if (!originCheck.valid) {
      return NextResponse.json({ error: originCheck.error }, { status: 403, headers: noStoreHeaders })
    }

    const idCheck = validateId(id, '备忘ID')
    if (!idCheck.valid) {
      return NextResponse.json({ error: idCheck.error }, { status: 400, headers: noStoreHeaders })
    }

    const existingMemo = await prisma.memo.findFirst({
      where: {
        id,
        createdBy: session.user.id,
      },
    })

    if (!existingMemo) {
      return NextResponse.json({ error: '备忘不存在' }, { status: 404, headers: noStoreHeaders })
    }

    await prisma.memo.delete({
      where: { id },
    })

    revalidatePath('/stats')

    return NextResponse.json({ success: true }, { headers: noStoreHeaders })
  } catch (error) {
    logError('删除备忘录失败', error)
    return NextResponse.json({ error: '删除失败' }, { status: 500, headers: noStoreHeaders })
  }
}
