import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { validateHealthInput, validateId, safeParseBody, validateSameOrigin } from '@/lib/validation'
import { buildUserActionKey, enforceRateLimit } from '@/lib/rate-limit'
import { getRateLimit } from '@/lib/rate-limit-config'
import { noStoreHeaders } from '@/lib/api-helpers'
import { logError } from '@/lib/logger'
import { emitHealthUpdated, emitHealthDeleted } from '@/lib/webhook-service'
import { rescheduleIntervalRulesForRecordChange } from '@/lib/reminder-rescheduler'
import { syncAutoVaccineReminders } from '@/lib/reminder-auto-vaccine'
import { formatToothNames, type PrimaryToothCode } from '@/lib/tooth-eruptions'

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
      key: buildUserActionKey('health-update', session.user.id, request),
      ...getRateLimit('health-update'),
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
      weight,
      height,
      temperature,
      medicationName,
      medicationDose,
      vaccineName,
      vaccineManufacturer,
      vaccineDoseNumber,
      vaccineTotalDoses,
      diaperType,
      diaperStatus,
      adGiven,
      vitaminDGiven,
      customName,
      toothCodes,
      recordedAt,
      notes
    } = body

    const existingRecord = await prisma.healthRecord.findFirst({
      where: {
        id,
        createdBy: session.user.id
      },
      include: { baby: true, toothEruptions: true }
    })

    if (!existingRecord) {
      return NextResponse.json({ error: '记录不存在' }, { status: 404, headers: noStoreHeaders })
    }

    const nextType = typeof type === 'string' ? type : existingRecord.type
    if (typeof nextType !== 'string') {
      return NextResponse.json({ error: '健康记录类型字段无效' }, { status: 400, headers: noStoreHeaders })
    }

    const nextRecordedAt = recordedAt === undefined
      ? existingRecord.recordedAt.toISOString()
      : typeof recordedAt === 'string'
        ? recordedAt
        : null
    if (nextRecordedAt === null) {
      return NextResponse.json({ error: '记录时间格式不正确' }, { status: 400, headers: noStoreHeaders })
    }

    const normalizedBody = {
      type: nextType,
      weight: weight === undefined ? existingRecord.weight : weight,
      height: height === undefined ? existingRecord.height : height,
      temperature: temperature === undefined ? existingRecord.temperature : temperature,
      medicationName: medicationName === undefined ? existingRecord.medicationName : medicationName,
      medicationDose: medicationDose === undefined ? existingRecord.medicationDose : medicationDose,
      vaccineName: vaccineName === undefined ? existingRecord.vaccineName : vaccineName,
      vaccineManufacturer: vaccineManufacturer === undefined ? existingRecord.vaccineManufacturer : vaccineManufacturer,
      vaccineDoseNumber: vaccineDoseNumber === undefined ? existingRecord.vaccineDoseNumber : vaccineDoseNumber,
      vaccineTotalDoses: vaccineTotalDoses === undefined ? existingRecord.vaccineTotalDoses : vaccineTotalDoses,
      diaperType: diaperType === undefined ? existingRecord.diaperType : diaperType,
      diaperStatus: diaperStatus === undefined ? existingRecord.diaperStatus : diaperStatus,
      adGiven: adGiven === undefined ? existingRecord.adGiven : adGiven,
      vitaminDGiven: vitaminDGiven === undefined ? existingRecord.vitaminDGiven : vitaminDGiven,
      customName: customName === undefined ? existingRecord.customName : customName,
      toothCodes: toothCodes === undefined ? existingRecord.toothEruptions.map(item => item.toothCode) : toothCodes,
      sleepStartTime: body.sleepStartTime === undefined ? (existingRecord.sleepStartTime ? existingRecord.sleepStartTime.toISOString() : null) : body.sleepStartTime,
      sleepEndTime: body.sleepEndTime === undefined ? (existingRecord.sleepEndTime ? existingRecord.sleepEndTime.toISOString() : null) : body.sleepEndTime,
      sleepQuality: body.sleepQuality === undefined ? existingRecord.sleepQuality : body.sleepQuality,
      recordedAt: nextRecordedAt,
      notes: notes === undefined ? existingRecord.notes : notes,
    }

    const mergedValidation = validateHealthInput(normalizedBody)
    if (!mergedValidation.valid) {
      return NextResponse.json({ error: mergedValidation.error }, { status: 400, headers: noStoreHeaders })
    }

    const normalizedToothCodes = Array.isArray(normalizedBody.toothCodes)
      ? normalizedBody.toothCodes as PrimaryToothCode[]
      : []

    if (nextType === 'TOOTH_ERUPTION') {
      if (new Date(nextRecordedAt).getTime() < existingRecord.baby.birthDate.getTime()) {
        return NextResponse.json({ error: '萌出时间不能早于宝宝出生时间' }, { status: 400, headers: noStoreHeaders })
      }
      const conflictingTeeth = await prisma.toothEruption.findMany({
        where: {
          babyId: existingRecord.babyId,
          toothCode: { in: normalizedToothCodes },
          healthRecordId: { not: id },
        },
        select: { toothCode: true },
      })
      if (conflictingTeeth.length > 0) {
        return NextResponse.json({
          error: `${formatToothNames(conflictingTeeth.map(item => item.toothCode))}已经记录过萌出时间`,
        }, { status: 409, headers: noStoreHeaders })
      }
    }

    const normalizedData = {
      type: nextType,
      weight: null as number | null,
      height: null as number | null,
      temperature: null as number | null,
      medicationName: null as string | null,
      medicationDose: null as string | null,
      vaccineName: null as string | null,
      vaccineManufacturer: null as string | null,
      vaccineDoseNumber: null as number | null,
      vaccineTotalDoses: null as number | null,
      diaperType: null as string | null,
      diaperStatus: null as string | null,
      adGiven: null as boolean | null,
      vitaminDGiven: null as boolean | null,
      customName: null as string | null,
      sleepStartTime: null as Date | null,
      sleepEndTime: null as Date | null,
      sleepQuality: null as string | null,
      recordedAt: new Date(nextRecordedAt),
      notes: normalizedBody.notes === undefined ? null : normalizedBody.notes as string | null,
    }

    if (nextType === 'WEIGHT') {
      normalizedData.weight = normalizedBody.weight === undefined ? null : normalizedBody.weight as number | null
    } else if (nextType === 'HEIGHT') {
      normalizedData.height = normalizedBody.height === undefined ? null : normalizedBody.height as number | null
    } else if (nextType === 'TEMPERATURE') {
      normalizedData.temperature = normalizedBody.temperature === undefined ? null : normalizedBody.temperature as number | null
    } else if (nextType === 'MEDICATION') {
      normalizedData.medicationName = normalizedBody.medicationName === undefined ? null : normalizedBody.medicationName as string | null
      normalizedData.medicationDose = normalizedBody.medicationDose === undefined ? null : normalizedBody.medicationDose as string | null
    } else if (nextType === 'VACCINE') {
      normalizedData.vaccineName = normalizedBody.vaccineName === undefined ? null : normalizedBody.vaccineName as string | null
      normalizedData.vaccineManufacturer = normalizedBody.vaccineManufacturer === undefined ? null : normalizedBody.vaccineManufacturer as string | null
      normalizedData.vaccineDoseNumber = normalizedBody.vaccineDoseNumber === undefined ? null : normalizedBody.vaccineDoseNumber as number | null
      normalizedData.vaccineTotalDoses = normalizedBody.vaccineTotalDoses === undefined ? null : normalizedBody.vaccineTotalDoses as number | null
    } else if (nextType === 'DIAPER') {
      normalizedData.diaperType = normalizedBody.diaperType === undefined ? null : normalizedBody.diaperType as string | null
      normalizedData.diaperStatus = normalizedBody.diaperStatus === undefined ? null : normalizedBody.diaperStatus as string | null
    } else if (nextType === 'AD_VITAMIN') {
      normalizedData.adGiven = normalizedBody.adGiven === undefined ? null : normalizedBody.adGiven as boolean | null
      normalizedData.vitaminDGiven = normalizedBody.vitaminDGiven === undefined ? null : normalizedBody.vitaminDGiven as boolean | null
    } else if (nextType === 'SLEEP') {
      normalizedData.sleepStartTime = normalizedBody.sleepStartTime ? new Date(normalizedBody.sleepStartTime as string) : null
      normalizedData.sleepEndTime = normalizedBody.sleepEndTime ? new Date(normalizedBody.sleepEndTime as string) : null
      normalizedData.sleepQuality = normalizedBody.sleepQuality === undefined ? null : normalizedBody.sleepQuality as string | null
    } else if (nextType === 'CUSTOM') {
      normalizedData.customName = typeof normalizedBody.customName === 'string' ? normalizedBody.customName.trim() || null : null
    }

    const record = await prisma.$transaction(async tx => {
      const claimed = await tx.healthRecord.updateMany({
        where: { id, updatedAt: existingRecord.updatedAt },
        data: normalizedData,
      })
      if (claimed.count !== 1) throw new Error('RECORD_UPDATE_CONFLICT')
      await tx.toothEruption.deleteMany({ where: { healthRecordId: id } })
      if (nextType === 'TOOTH_ERUPTION') {
        await tx.toothEruption.createMany({
          data: normalizedToothCodes.map(toothCode => ({
            healthRecordId: id,
            babyId: existingRecord.babyId,
            toothCode,
          })),
        })
      }
      const updated = await tx.healthRecord.findUnique({
        where: { id },
        include: { baby: true, toothEruptions: true },
      })
      if (!updated) throw new Error('RECORD_UPDATE_CONFLICT')
      await rescheduleIntervalRulesForRecordChange({
        userId: session.user.id,
        babyId: updated.babyId,
        sourceType: 'health',
        oldRecord: existingRecord,
        newRecord: updated,
        db: tx,
      })
      if (existingRecord.type === 'VACCINE' || updated.type === 'VACCINE') {
        await syncAutoVaccineReminders({
          userId: session.user.id,
          babyId: updated.babyId,
          recordedAtValues: [existingRecord.recordedAt, updated.recordedAt],
          db: tx,
        })
      }
      return updated
    })

    await emitHealthUpdated(session.user.id, existingRecord, record, record.baby).catch(error => {
      logError('Failed to emit health updated webhook', error)
    })
    return NextResponse.json(record, { headers: noStoreHeaders })
  } catch (error) {
    if (error instanceof Error && error.message === 'RECORD_UPDATE_CONFLICT') {
      return NextResponse.json({ error: '记录已被其他请求修改，请刷新后重试' }, { status: 409, headers: noStoreHeaders })
    }
    if (error && typeof error === 'object' && 'code' in error && error.code === 'P2002') {
      return NextResponse.json({ error: '所选牙齿中有牙位已经记录，请刷新后重试' }, { status: 409, headers: noStoreHeaders })
    }
    logError('更新健康记录失败', error)
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
      key: buildUserActionKey('health-delete', session.user.id, request),
      ...getRateLimit('health-delete'),
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

    const existingRecord = await prisma.healthRecord.findFirst({
      where: {
        id,
        createdBy: session.user.id
      },
      include: { toothEruptions: true },
    })

    if (!existingRecord) {
      return NextResponse.json({ error: '记录不存在' }, { status: 404, headers: noStoreHeaders })
    }

    await prisma.$transaction(async tx => {
      const deleted = await tx.healthRecord.deleteMany({
        where: { id, updatedAt: existingRecord.updatedAt },
      })
      if (deleted.count !== 1) throw new Error('RECORD_UPDATE_CONFLICT')
      await rescheduleIntervalRulesForRecordChange({
        userId: session.user.id,
        babyId: existingRecord.babyId,
        sourceType: 'health',
        oldRecord: existingRecord,
        db: tx,
      })
      if (existingRecord.type === 'VACCINE') {
        await syncAutoVaccineReminders({
          userId: session.user.id,
          babyId: existingRecord.babyId,
          recordedAtValues: [existingRecord.recordedAt],
          db: tx,
        })
      }
    })

    await emitHealthDeleted(session.user.id, existingRecord).catch(error => {
      logError('Failed to emit health deleted webhook', error)
    })
    return NextResponse.json({ success: true }, { headers: noStoreHeaders })
  } catch (error) {
    if (error instanceof Error && error.message === 'RECORD_UPDATE_CONFLICT') {
      return NextResponse.json({ error: '记录已被其他请求修改，请刷新后重试' }, { status: 409, headers: noStoreHeaders })
    }
    logError('删除健康记录失败', error)
    return NextResponse.json({ error: '删除失败' }, { status: 500, headers: noStoreHeaders })
  }
}
