import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { validateFeedingInput, validateId, FEEDING_TYPES, safeParseBody, validateDateOnlyString, validateSameOrigin } from '@/lib/validation'
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
      key: buildUserActionKey('feeding-list', session.user.id, request),
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

    const whereClause: Record<string, unknown> = {
      createdBy: session.user.id
    }

    if (babyId) {
      whereClause.babyId = babyId
    }

    if (date) {
      const { start, end } = getBeijingDayRange(date)
      whereClause.startTime = {
        gte: start,
        lte: end
      }
    }

    const records = await prisma.feedingRecord.findMany({
      where: whereClause,
      include: { baby: true },
      orderBy: { startTime: 'desc' }
    })

    return NextResponse.json(records, { headers: noStoreHeaders })
  } catch (error) {
    console.error('获取喂养记录失败:', error)
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
      key: buildUserActionKey('feeding-create', session.user.id, request),
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
      leftBreastDuration,
      rightBreastDuration,
      breastMilkAmount,
      formulaAmount,
      startTime,
      endTime,
      notes
    } = body

    if (!babyId || !type || !startTime) {
      return NextResponse.json({ error: '缺少必要字段' }, { status: 400, headers: noStoreHeaders })
    }

    if (typeof babyId !== 'string' || typeof type !== 'string' || typeof startTime !== 'string') {
      return NextResponse.json({ error: '字段类型无效' }, { status: 400, headers: noStoreHeaders })
    }

    const idCheck = validateId(babyId, 'babyId')
    if (!idCheck.valid) {
      return NextResponse.json({ error: idCheck.error }, { status: 400, headers: noStoreHeaders })
    }

    const validation = validateFeedingInput(body)
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400, headers: noStoreHeaders })
    }

    const typedType = type as (typeof FEEDING_TYPES)[number]
    if (!FEEDING_TYPES.includes(typedType)) {
      return NextResponse.json({ error: '无效的喂养类型' }, { status: 400, headers: noStoreHeaders })
    }

    const typedLeftBreastDuration = typeof leftBreastDuration === 'number' ? leftBreastDuration : undefined
    const typedRightBreastDuration = typeof rightBreastDuration === 'number' ? rightBreastDuration : undefined
    const typedBreastMilkAmount = typeof breastMilkAmount === 'number' ? breastMilkAmount : undefined
    const typedFormulaAmount = typeof formulaAmount === 'number' ? formulaAmount : undefined
    const typedEndTime = typeof endTime === 'string' ? endTime : undefined
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

    const record = await prisma.feedingRecord.create({
      data: {
        babyId,
        type: typedType,
        leftBreastDuration: typedType === 'BREAST_MILK' ? (typedLeftBreastDuration ?? null) : null,
        rightBreastDuration: typedType === 'BREAST_MILK' ? (typedRightBreastDuration ?? null) : null,
        breastMilkAmount: typedType === 'BREAST_MILK_BOTTLE' ? (typedBreastMilkAmount ?? null) : null,
        formulaAmount: typedType === 'FORMULA' ? (typedFormulaAmount ?? null) : null,
        adGiven: null,
        startTime: new Date(startTime),
        endTime: typedEndTime ? new Date(typedEndTime) : null,
        notes: typedNotes,
        createdBy: session.user.id
      },
      include: { baby: true }
    })

    revalidatePath('/')
    revalidatePath('/stats')
    revalidatePath('/timeline')
    revalidatePath('/add')

    return NextResponse.json(record, { status: 201, headers: noStoreHeaders })
  } catch (error) {
    console.error('创建喂养记录失败:', error)
    return NextResponse.json({ error: '创建失败' }, { status: 500, headers: noStoreHeaders })
  }
}
