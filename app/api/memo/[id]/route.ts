import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { validateMemoInput, validateId, safeParseBody, validateSameOrigin } from '@/lib/validation'
import { buildUserActionKey, enforceRateLimit } from '@/lib/rate-limit'
import { noStoreHeaders } from '@/lib/api-helpers'

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
      limit: 30,
      windowMs: 10 * 60 * 1000,
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

    // Build the merged body for validation (use existing values for unspecified fields)
    const mergedBody = {
      title: body.title !== undefined ? body.title : existingMemo.title,
      content: body.content !== undefined ? body.content : existingMemo.content,
      scheduledAt: body.scheduledAt !== undefined ? body.scheduledAt : existingMemo.scheduledAt.toISOString(),
      completed: body.completed !== undefined ? body.completed : existingMemo.completed,
    }

    const validation = validateMemoInput(mergedBody)
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400, headers: noStoreHeaders })
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
    console.error('更新备忘录失败:', error)
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
      limit: 20,
      windowMs: 15 * 60 * 1000,
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
    console.error('删除备忘录失败:', error)
    return NextResponse.json({ error: '删除失败' }, { status: 500, headers: noStoreHeaders })
  }
}
