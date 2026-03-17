import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { validateHealthInput, validateId, HEALTH_TYPES, safeParseBody, validateDateOnlyString, validateEnum, validateSameOrigin } from '@/lib/validation'
import { buildUserActionKey, enforceRateLimit } from '@/lib/rate-limit'

const noStoreHeaders = {
  'Cache-Control': 'no-store, max-age=0',
  'Pragma': 'no-cache',
}

function getBeijingDayRange(dateStr: string) {
  const start = new Date(`${dateStr}T00:00:00+08:00`)
  const end = new Date(`${dateStr}T23:59:59.999+08:00`)
  return { start, end }
}

export async function GET(request: NextRequest) {
  try {
    const session = await auth(request)
    if (!session?.user) {
      return NextResponse.json({ error: '未授权' }, { status: 401, headers: noStoreHeaders })
    }

    const listRateLimit = enforceRateLimit({
      key: buildUserActionKey('health-list', session.user.id, request),
      limit: 180,
      windowMs: 60 * 1000,
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
      whereClause.recordedAt = {
        gte: start,
        lte: end
      }
    }

    const records = await prisma.healthRecord.findMany({
      where: whereClause,
      include: { baby: true },
      orderBy: { recordedAt: 'desc' }
    })

    return NextResponse.json(records, { headers: noStoreHeaders })
  } catch (error) {
    console.error('获取健康记录失败:', error)
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
      limit: 60,
      windowMs: 10 * 60 * 1000,
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
      diaperType,
      diaperStatus,
      adGiven,
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
    const typedDiaperType = typeof diaperType === 'string' ? diaperType : undefined
    const typedDiaperStatus = typeof diaperStatus === 'string' ? diaperStatus : undefined
    const typedAdGiven = typeof adGiven === 'boolean' ? adGiven : undefined
    const typedNotes = typeof notes === 'string' ? notes : undefined

    const baby = await prisma.baby.findFirst({
      where: {
        id: babyId,
        createdBy: session.user.id
      }
    })

    if (!baby) {
      return NextResponse.json({ error: '婴儿不存在' }, { status: 404, headers: noStoreHeaders })
    }

    const record = await prisma.healthRecord.create({
      data: {
        babyId,
        type: typedType,
        weight: typedWeight,
        height: typedHeight,
        temperature: typedTemperature,
        medicationName: typedMedicationName,
        medicationDose: typedMedicationDose,
        vaccineName: typedVaccineName,
        diaperType: typedDiaperType,
        diaperStatus: typedDiaperStatus,
        adGiven: typedAdGiven,
        recordedAt: new Date(recordedAt),
        notes: typedNotes,
        createdBy: session.user.id
      },
      include: { baby: true }
    })

    return NextResponse.json(record, { status: 201, headers: noStoreHeaders })
  } catch (error) {
    console.error('创建健康记录失败:', error)
    return NextResponse.json({ error: '创建失败' }, { status: 500, headers: noStoreHeaders })
  }
}
