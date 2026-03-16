import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { validateFeedingInput, validateId, safeParseBody, validateSameOrigin } from '@/lib/validation'
import { buildUserActionKey, enforceRateLimit } from '@/lib/rate-limit'

const noStoreHeaders = {
  'Cache-Control': 'no-store, max-age=0',
  'Pragma': 'no-cache',
}

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
      key: buildUserActionKey('feeding-update', session.user.id, request),
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

    const idCheck = validateId(id, '记录ID')
    if (!idCheck.valid) {
      return NextResponse.json({ error: idCheck.error }, { status: 400, headers: noStoreHeaders })
    }

    const { data: body, error: parseError } = await safeParseBody(request)
    if (parseError || !body) {
      return NextResponse.json({ error: parseError || '请求体格式不正确' }, { status: 400, headers: noStoreHeaders })
    }

    const validation = validateFeedingInput(body)
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400, headers: noStoreHeaders })
    }

    const {
      type,
      leftBreastDuration,
      rightBreastDuration,
      breastMilkAmount,
      formulaAmount,
      adGiven,
      startTime,
      endTime,
      notes
    } = body

    const updateData: {
      type?: string
      leftBreastDuration?: number | null
      rightBreastDuration?: number | null
      breastMilkAmount?: number | null
      formulaAmount?: number | null
      adGiven?: boolean | null
      startTime?: Date
      endTime?: Date | null
      notes?: string | null
    } = {}

    if (type !== undefined) {
      if (typeof type !== 'string') {
        return NextResponse.json({ error: '喂养类型字段无效' }, { status: 400, headers: noStoreHeaders })
      }
      updateData.type = type
    }

    if (leftBreastDuration !== undefined) {
      if (leftBreastDuration !== null && typeof leftBreastDuration !== 'number') {
        return NextResponse.json({ error: '左乳时长字段无效' }, { status: 400, headers: noStoreHeaders })
      }
      updateData.leftBreastDuration = leftBreastDuration as number | null
    }

    if (rightBreastDuration !== undefined) {
      if (rightBreastDuration !== null && typeof rightBreastDuration !== 'number') {
        return NextResponse.json({ error: '右乳时长字段无效' }, { status: 400, headers: noStoreHeaders })
      }
      updateData.rightBreastDuration = rightBreastDuration as number | null
    }

    if (breastMilkAmount !== undefined) {
      if (breastMilkAmount !== null && typeof breastMilkAmount !== 'number') {
        return NextResponse.json({ error: '母乳瓶喂量字段无效' }, { status: 400, headers: noStoreHeaders })
      }
      updateData.breastMilkAmount = breastMilkAmount as number | null
    }

    if (formulaAmount !== undefined) {
      if (formulaAmount !== null && typeof formulaAmount !== 'number') {
        return NextResponse.json({ error: '奶粉量字段无效' }, { status: 400, headers: noStoreHeaders })
      }
      updateData.formulaAmount = formulaAmount as number | null
    }

    if (adGiven !== undefined) {
      if (adGiven !== null && typeof adGiven !== 'boolean') {
        return NextResponse.json({ error: 'AD 字段无效' }, { status: 400, headers: noStoreHeaders })
      }
      updateData.adGiven = adGiven as boolean | null
    }

    if (startTime !== undefined) {
      if (typeof startTime !== 'string') {
        return NextResponse.json({ error: '开始时间字段无效' }, { status: 400, headers: noStoreHeaders })
      }
      updateData.startTime = new Date(startTime)
    }

    if (endTime !== undefined) {
      if (endTime !== null && typeof endTime !== 'string') {
        return NextResponse.json({ error: '结束时间字段无效' }, { status: 400, headers: noStoreHeaders })
      }
      updateData.endTime = endTime ? new Date(endTime) : null
    }

    if (notes !== undefined) {
      if (notes !== null && typeof notes !== 'string') {
        return NextResponse.json({ error: '备注字段无效' }, { status: 400, headers: noStoreHeaders })
      }
      updateData.notes = notes as string | null
    }

    const existingRecord = await prisma.feedingRecord.findFirst({
      where: {
        id,
        createdBy: session.user.id
      }
    })

    if (!existingRecord) {
      return NextResponse.json({ error: '记录不存在' }, { status: 404, headers: noStoreHeaders })
    }

    const record = await prisma.feedingRecord.update({
      where: { id },
      data: updateData,
      include: { baby: true }
    })

    return NextResponse.json(record, { headers: noStoreHeaders })
  } catch (error) {
    console.error('更新喂养记录失败:', error)
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
      key: buildUserActionKey('feeding-delete', session.user.id, request),
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

    const idCheck = validateId(id, '记录ID')
    if (!idCheck.valid) {
      return NextResponse.json({ error: idCheck.error }, { status: 400, headers: noStoreHeaders })
    }

    const existingRecord = await prisma.feedingRecord.findFirst({
      where: {
        id,
        createdBy: session.user.id
      }
    })

    if (!existingRecord) {
      return NextResponse.json({ error: '记录不存在' }, { status: 404, headers: noStoreHeaders })
    }

    await prisma.feedingRecord.delete({
      where: { id }
    })

    return NextResponse.json({ success: true }, { headers: noStoreHeaders })
  } catch (error) {
    console.error('删除喂养记录失败:', error)
    return NextResponse.json({ error: '删除失败' }, { status: 500, headers: noStoreHeaders })
  }
}
