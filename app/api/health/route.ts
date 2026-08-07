import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { validateHealthInput, validateId, HEALTH_TYPES, safeParseBody, validateDateOnlyString, validateEnum, validateSameOrigin } from '@/lib/validation'
import { buildUserActionKey, enforceRateLimit } from '@/lib/rate-limit'
import { getRateLimit } from '@/lib/rate-limit-config'
import { noStoreHeaders, getBeijingDayRange, buildSleepAwareOrClause } from '@/lib/api-helpers'
import { logError } from '@/lib/logger'
import { emitHealthCreated } from '@/lib/webhook-service'
import { rescheduleIntervalRulesForRecordChange } from '@/lib/reminder-rescheduler'
import { syncAutoVaccineReminders } from '@/lib/reminder-auto-vaccine'

export async function GET(request: NextRequest) {
  try {
    const session = await auth(request)
    if (!session?.user) {
      return NextResponse.json({ error: '未授权' }, { status: 401, headers: noStoreHeaders })
    }

    const listRateLimit = enforceRateLimit({
      key: buildUserActionKey('health-list', session.user.id, request),
      ...getRateLimit('health-list'),
    })
    if (!listRateLimit.allowed) {
      return NextResponse.json({ error: '请求过于频繁，请稍后再试' }, {
        status: 429,
        headers: {
          ...noStoreHeaders,
          'Retry-After': String(listRateLimit.retryAfterSeconds),
        },
      })
    }

    const { searchParams } = new URL(request.url)
    const babyId = searchParams.get('babyId')
    const date = searchParams.get('date')
    const type = searchParams.get('type')

    if (babyId) {
      const idCheck = validateId(babyId, 'babyId')
      if (!idCheck.valid) {
        return NextResponse.json({ error: idCheck.error }, { status: 400, headers: noStoreHeaders })
      }
    }

    if (date) {
      const dateCheck = validateDateOnlyString(date, '日期')
      if (!dateCheck.valid) {
        return NextResponse.json({ error: dateCheck.error }, { status: 400, headers: noStoreHeaders })
      }
    }

    if (type) {
      const typeCheck = validateEnum(type, HEALTH_TYPES, '健康记录类型')
      if (!typeCheck.valid) {
        return NextResponse.json({ error: typeCheck.error }, { status: 400, headers: noStoreHeaders })
      }
    }

    const whereClause: Record<string, unknown> = {
      createdBy: session.user.id
    }

    if (babyId) {
      whereClause.babyId = babyId
    }

    if (type) {
      whereClause.type = type
    }

    if (date) {
      const { start, end } = getBeijingDayRange(date)
      // For sleep records that cross midnight (e.g. 23:00 -> 06:00 next day),
      // recordedAt = sleepEndTime (next day), so they won't appear on the start day.
      // Use OR to also include records whose sleepStartTime falls within this day.
      whereClause.OR = buildSleepAwareOrClause(start, end)
    }

    const records = await prisma.healthRecord.findMany({
      where: whereClause,
      include: { baby: true },
      orderBy: { recordedAt: 'desc' }
    })

    return NextResponse.json(records, { headers: noStoreHeaders })
  } catch (error) {
    logError('获取健康记录失败', error)
    return NextResponse.json({ error: '获取失败' }, { status: 500, headers: noStoreHeaders })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth(request)
    if (!session?.user) {
      return NextResponse.json({ error: '未授权' }, { status: 401, headers: noStoreHeaders })
    }

    const createRateLimit = enforceRateLimit({
      key: buildUserActionKey('health-create', session.user.id, request),
      ...getRateLimit('health-create'),
    })
    if (!createRateLimit.allowed) {
      return NextResponse.json({ error: '操作过于频繁，请稍后再试' }, {
        status: 429,
        headers: {
          ...noStoreHeaders,
          'Retry-After': String(createRateLimit.retryAfterSeconds),
        },
      })
    }

    const originCheck = validateSameOrigin(request)
    if (!originCheck.valid) {
      return NextResponse.json({ error: originCheck.error }, { status: 403, headers: noStoreHeaders })
    }

    const { data: body, error: parseError } = await safeParseBody(request)
    if (parseError || !body) {
      return NextResponse.json({ error: parseError || '请求体格式不正确' }, { status: 400, headers: noStoreHeaders })
    }

    const {
      babyId,
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
      recordedAt,
      notes
    } = body

    if (!babyId || !type || !recordedAt) {
      return NextResponse.json({ error: '缺少必要字段' }, { status: 400, headers: noStoreHeaders })
    }

    if (typeof babyId !== 'string' || typeof type !== 'string' || typeof recordedAt !== 'string') {
      return NextResponse.json({ error: '字段类型无效' }, { status: 400, headers: noStoreHeaders })
    }

    const idCheck = validateId(babyId, 'babyId')
    if (!idCheck.valid) {
      return NextResponse.json({ error: idCheck.error }, { status: 400, headers: noStoreHeaders })
    }

    const validation = validateHealthInput(body)
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400, headers: noStoreHeaders })
    }

    const typedType = type as (typeof HEALTH_TYPES)[number]
    if (!HEALTH_TYPES.includes(typedType)) {
      return NextResponse.json({ error: '无效的健康记录类型' }, { status: 400, headers: noStoreHeaders })
    }

    const typedWeight = typeof weight === 'number' ? weight : undefined
    const typedHeight = typeof height === 'number' ? height : undefined
    const typedTemperature = typeof temperature === 'number' ? temperature : undefined
    const typedMedicationName = typeof medicationName === 'string' ? medicationName : undefined
    const typedMedicationDose = typeof medicationDose === 'string' ? medicationDose : undefined
    const typedVaccineName = typeof vaccineName === 'string' ? vaccineName : undefined
    const typedVaccineManufacturer = typeof vaccineManufacturer === 'string' ? vaccineManufacturer : undefined
    const typedVaccineDoseNumber = typeof vaccineDoseNumber === 'number' ? vaccineDoseNumber : undefined
    const typedVaccineTotalDoses = typeof vaccineTotalDoses === 'number' ? vaccineTotalDoses : undefined
    const typedDiaperType = typeof diaperType === 'string' ? diaperType : undefined
    const typedDiaperStatus = typeof diaperStatus === 'string' ? diaperStatus : undefined
    const typedAdGiven = typeof adGiven === 'boolean' ? adGiven : undefined
    const typedVitaminDGiven = typeof vitaminDGiven === 'boolean' ? vitaminDGiven : undefined
    const typedCustomName = typeof customName === 'string' ? customName : undefined
    const typedSleepStartTime = typeof body.sleepStartTime === 'string' ? body.sleepStartTime : undefined
    const typedSleepEndTime = typeof body.sleepEndTime === 'string' ? body.sleepEndTime : undefined
    const typedSleepQuality = typeof body.sleepQuality === 'string' ? body.sleepQuality : undefined
    const typedNotes = typeof notes === 'string' ? notes : undefined

    if (typedType === 'VACCINE') {
      if (!typedVaccineName?.trim()) {
        return NextResponse.json({ error: '请填写疫苗名称' }, { status: 400, headers: noStoreHeaders })
      }

      if (typedVaccineDoseNumber == null || typedVaccineTotalDoses == null) {
        return NextResponse.json({ error: '请填写当前针次和总针数' }, { status: 400, headers: noStoreHeaders })
      }
    }

    const baby = await prisma.baby.findFirst({
      where: {
        id: babyId,
        createdBy: session.user.id
      }
    })

    if (!baby) {
      return NextResponse.json({ error: '婴儿不存在' }, { status: 404, headers: noStoreHeaders })
    }

    const record = await prisma.$transaction(async tx => {
      const created = await tx.healthRecord.create({
        data: {
          babyId,
          type: typedType,
          weight: typedType === 'WEIGHT' ? (typedWeight ?? null) : null,
          height: typedType === 'HEIGHT' ? (typedHeight ?? null) : null,
          temperature: typedType === 'TEMPERATURE' ? (typedTemperature ?? null) : null,
          medicationName: typedType === 'MEDICATION' ? (typedMedicationName ?? null) : null,
          medicationDose: typedType === 'MEDICATION' ? (typedMedicationDose ?? null) : null,
          vaccineName: typedType === 'VACCINE' ? (typedVaccineName ?? null) : null,
          vaccineManufacturer: typedType === 'VACCINE' ? (typedVaccineManufacturer ?? null) : null,
          vaccineDoseNumber: typedType === 'VACCINE' ? (typedVaccineDoseNumber ?? null) : null,
          vaccineTotalDoses: typedType === 'VACCINE' ? (typedVaccineTotalDoses ?? null) : null,
          diaperType: typedType === 'DIAPER' ? (typedDiaperType ?? null) : null,
          diaperStatus: typedType === 'DIAPER' ? (typedDiaperStatus ?? null) : null,
          adGiven: typedType === 'AD_VITAMIN' ? (typedAdGiven ?? null) : null,
          vitaminDGiven: typedType === 'AD_VITAMIN' ? (typedVitaminDGiven ?? null) : null,
          customName: typedType === 'CUSTOM' ? (typedCustomName?.trim() || null) : null,
          sleepStartTime: typedType === 'SLEEP' ? (typedSleepStartTime ? new Date(typedSleepStartTime) : null) : null,
          sleepEndTime: typedType === 'SLEEP' ? (typedSleepEndTime ? new Date(typedSleepEndTime) : null) : null,
          sleepQuality: typedType === 'SLEEP' ? (typedSleepQuality ?? null) : null,
          recordedAt: new Date(recordedAt),
          notes: typedNotes,
          createdBy: session.user.id,
        },
        include: { baby: true },
      })
      await rescheduleIntervalRulesForRecordChange({
        userId: session.user.id,
        babyId,
        sourceType: 'health',
        newRecord: created,
        db: tx,
      })
      if (created.type === 'VACCINE') {
        await syncAutoVaccineReminders({
          userId: session.user.id,
          babyId: created.babyId,
          recordedAtValues: [created.recordedAt],
          db: tx,
        })
      }
      return created
    })

    await emitHealthCreated(session.user.id, record, record.baby).catch(error => {
      logError('Failed to emit health created webhook', error)
    })
    revalidatePath('/')
    revalidatePath('/stats')
    revalidatePath('/timeline')
    revalidatePath('/add')

    return NextResponse.json(record, { status: 201, headers: noStoreHeaders })
  } catch (error) {
    logError('创建健康记录失败', error)
    return NextResponse.json({ error: '创建失败' }, { status: 500, headers: noStoreHeaders })
  }
}
