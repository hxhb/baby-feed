import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { validateFeedingInput, validateId, FEEDING_TYPES, safeParseBody, validateDateOnlyString, validateSameOrigin } from '@/lib/validation'

const noStoreHeaders = {
  'Cache-Control': 'no-store, max-age=0',
  'Pragma': 'no-cache',
}

// 获取北京时间（UTC+8）的一天起止
function getBeijingDayRange(dateStr: string) {
  // dateStr 格式: "2026-03-14"
  // 北京时间 0:00 = UTC 前一天 16:00
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

    // 验证 babyId 格式
    const idCheck = validateId(babyId, 'babyId')
    if (!idCheck.valid) {
      return NextResponse.json({ error: idCheck.error }, { status: 400, headers: noStoreHeaders })
    }

    // 验证输入字段
    const validation = validateFeedingInput(body)
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400, headers: noStoreHeaders })
    }

    // 验证 type 是否为合法枚举值（必填字段单独检查）
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

    // 验证婴儿是否属于当前用户
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
        leftBreastDuration: typedLeftBreastDuration,
        rightBreastDuration: typedRightBreastDuration,
        breastMilkAmount: typedBreastMilkAmount,
        formulaAmount: typedFormulaAmount,
        startTime: new Date(startTime),
        endTime: typedEndTime ? new Date(typedEndTime) : null,
        notes: typedNotes,
        createdBy: session.user.id
      },
      include: { baby: true }
    })

    return NextResponse.json(record, { status: 201, headers: noStoreHeaders })
  } catch (error) {
    console.error('创建喂养记录失败:', error)
    return NextResponse.json({ error: '创建失败' }, { status: 500, headers: noStoreHeaders })
  }
}
