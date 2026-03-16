import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { validateFeedingInput, validateId, FEEDING_TYPES } from '@/lib/validation'

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
      return NextResponse.json({ error: '未授权' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const babyId = searchParams.get('babyId')
    const date = searchParams.get('date')

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

    return NextResponse.json(records)
  } catch (error) {
    console.error('获取喂养记录失败:', error)
    return NextResponse.json({ error: '获取失败' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth(request)
    if (!session?.user) {
      return NextResponse.json({ error: '未授权' }, { status: 401 })
    }

    const body = await request.json()
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
      return NextResponse.json({ error: '缺少必要字段' }, { status: 400 })
    }

    // 验证 babyId 格式
    const idCheck = validateId(babyId, 'babyId')
    if (!idCheck.valid) {
      return NextResponse.json({ error: idCheck.error }, { status: 400 })
    }

    // 验证输入字段
    const validation = validateFeedingInput(body)
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400 })
    }

    // 验证 type 是否为合法枚举值（必填字段单独检查）
    if (!FEEDING_TYPES.includes(type)) {
      return NextResponse.json({ error: '无效的喂养类型' }, { status: 400 })
    }

    // 验证婴儿是否属于当前用户
    const baby = await prisma.baby.findFirst({
      where: {
        id: babyId,
        createdBy: session.user.id
      }
    })

    if (!baby) {
      return NextResponse.json({ error: '婴儿不存在' }, { status: 404 })
    }

    const record = await prisma.feedingRecord.create({
      data: {
        babyId,
        type,
        leftBreastDuration,
        rightBreastDuration,
        breastMilkAmount,
        formulaAmount,
        startTime: new Date(startTime),
        endTime: endTime ? new Date(endTime) : null,
        notes,
        createdBy: session.user.id
      },
      include: { baby: true }
    })

    return NextResponse.json(record, { status: 201 })
  } catch (error) {
    console.error('创建喂养记录失败:', error)
    return NextResponse.json({ error: '创建失败' }, { status: 500 })
  }
}
