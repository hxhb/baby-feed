import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { validateFeedingInput, validateId, safeParseBody, validateSameOrigin } from '@/lib/validation'
import { buildUserActionKey, enforceRateLimit } from '@/lib/rate-limit'
import { getRateLimit } from '@/lib/rate-limit-config'
import { noStoreHeaders } from '@/lib/api-helpers'
import { logError } from '@/lib/logger'
import { emitFeedingUpdated, emitFeedingDeleted } from '@/lib/webhook-service'
import { rescheduleIntervalRulesForRecordChange } from '@/lib/reminder-rescheduler'

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
      ...getRateLimit('feeding-update'),
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

    const existingRecord = await prisma.feedingRecord.findFirst({
      where: {
        id,
        createdBy: session.user.id
      },
      include: { baby: true }
    })

    if (!existingRecord) {
      return NextResponse.json({ error: '记录不存在' }, { status: 404, headers: noStoreHeaders })
    }

    const nextType = typeof type === 'string' ? type : existingRecord.type
    if (typeof nextType !== 'string') {
      return NextResponse.json({ error: '喂养类型字段无效' }, { status: 400, headers: noStoreHeaders })
    }

    const nextStartTime = startTime === undefined
      ? existingRecord.startTime.toISOString()
      : typeof startTime === 'string'
        ? startTime
        : null
    if (nextStartTime === null) {
      return NextResponse.json({ error: '开始时间格式不正确' }, { status: 400, headers: noStoreHeaders })
    }

    const nextEndTime = endTime === undefined
      ? existingRecord.endTime?.toISOString() ?? null
      : endTime === null
        ? null
        : typeof endTime === 'string'
          ? endTime
          : undefined
    if (nextEndTime === undefined) {
      return NextResponse.json({ error: '结束时间格式不正确' }, { status: 400, headers: noStoreHeaders })
    }

    const normalizedBody = {
      type: nextType,
      leftBreastDuration: leftBreastDuration === undefined ? existingRecord.leftBreastDuration : leftBreastDuration,
      rightBreastDuration: rightBreastDuration === undefined ? existingRecord.rightBreastDuration : rightBreastDuration,
      breastMilkAmount: breastMilkAmount === undefined ? existingRecord.breastMilkAmount : breastMilkAmount,
      formulaAmount: formulaAmount === undefined ? existingRecord.formulaAmount : formulaAmount,
      solidFoodName: body.solidFoodName === undefined ? existingRecord.solidFoodName : body.solidFoodName,
      solidFoodAmount: body.solidFoodAmount === undefined ? existingRecord.solidFoodAmount : body.solidFoodAmount,
      adGiven: adGiven === undefined ? existingRecord.adGiven : adGiven,
      startTime: nextStartTime,
      endTime: nextEndTime,
      notes: notes === undefined ? existingRecord.notes : notes,
    }

    const mergedValidation = validateFeedingInput(normalizedBody)
    if (!mergedValidation.valid) {
      return NextResponse.json({ error: mergedValidation.error }, { status: 400, headers: noStoreHeaders })
    }

    const normalizedData = {
      type: nextType,
      leftBreastDuration: null as number | null,
      rightBreastDuration: null as number | null,
      breastMilkAmount: null as number | null,
      formulaAmount: null as number | null,
      solidFoodName: null as string | null,
      solidFoodAmount: null as string | null,
      adGiven: normalizedBody.adGiven === undefined ? null : normalizedBody.adGiven as boolean | null,
      startTime: new Date(nextStartTime),
      endTime: nextEndTime ? new Date(nextEndTime) : null,
      notes: normalizedBody.notes === undefined ? null : normalizedBody.notes as string | null,
    }

    if (nextType === 'BREAST_MILK') {
      normalizedData.leftBreastDuration = normalizedBody.leftBreastDuration === undefined ? null : normalizedBody.leftBreastDuration as number | null
      normalizedData.rightBreastDuration = normalizedBody.rightBreastDuration === undefined ? null : normalizedBody.rightBreastDuration as number | null
    } else if (nextType === 'BREAST_MILK_BOTTLE') {
      normalizedData.breastMilkAmount = normalizedBody.breastMilkAmount === undefined ? null : normalizedBody.breastMilkAmount as number | null
    } else if (nextType === 'FORMULA') {
      normalizedData.formulaAmount = normalizedBody.formulaAmount === undefined ? null : normalizedBody.formulaAmount as number | null
    } else if (nextType === 'SOLID_FOOD') {
      normalizedData.solidFoodName = normalizedBody.solidFoodName === undefined ? null : normalizedBody.solidFoodName as string | null
      normalizedData.solidFoodAmount = normalizedBody.solidFoodAmount === undefined ? null : normalizedBody.solidFoodAmount as string | null
    }

    const record = await prisma.$transaction(async tx => {
      const claimed = await tx.feedingRecord.updateMany({
        where: { id, updatedAt: existingRecord.updatedAt },
        data: normalizedData,
      })
      if (claimed.count !== 1) throw new Error('RECORD_UPDATE_CONFLICT')
      const updated = await tx.feedingRecord.findUnique({ where: { id }, include: { baby: true } })
      if (!updated) throw new Error('RECORD_UPDATE_CONFLICT')
      await rescheduleIntervalRulesForRecordChange({
        userId: session.user.id,
        babyId: updated.babyId,
        sourceType: 'feeding',
        oldRecord: existingRecord,
        newRecord: updated,
        db: tx,
      })
      return updated
    })

    await emitFeedingUpdated(session.user.id, existingRecord, record, record.baby).catch(error => {
      logError('Failed to emit feeding updated webhook', error)
    })

    return NextResponse.json(record, { headers: noStoreHeaders })
  } catch (error) {
    if (error instanceof Error && error.message === 'RECORD_UPDATE_CONFLICT') {
      return NextResponse.json({ error: '记录已被其他请求修改，请刷新后重试' }, { status: 409, headers: noStoreHeaders })
    }
    logError('更新喂养记录失败', error)
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
      ...getRateLimit('feeding-delete'),
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

    await prisma.$transaction(async tx => {
      const deleted = await tx.feedingRecord.deleteMany({
        where: { id, updatedAt: existingRecord.updatedAt },
      })
      if (deleted.count !== 1) throw new Error('RECORD_UPDATE_CONFLICT')
      await rescheduleIntervalRulesForRecordChange({
        userId: session.user.id,
        babyId: existingRecord.babyId,
        sourceType: 'feeding',
        oldRecord: existingRecord,
        db: tx,
      })
    })

    await emitFeedingDeleted(session.user.id, existingRecord).catch(error => {
      logError('Failed to emit feeding deleted webhook', error)
    })

    return NextResponse.json({ success: true }, { headers: noStoreHeaders })
  } catch (error) {
    if (error instanceof Error && error.message === 'RECORD_UPDATE_CONFLICT') {
      return NextResponse.json({ error: '记录已被其他请求修改，请刷新后重试' }, { status: 409, headers: noStoreHeaders })
    }
    logError('删除喂养记录失败', error)
    return NextResponse.json({ error: '删除失败' }, { status: 500, headers: noStoreHeaders })
  }
}
