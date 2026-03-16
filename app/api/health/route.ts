import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { validateHealthInput, validateId, HEALTH_TYPES } from '@/lib/validation'

// 获取北京时间（UTC+8）的一天起止
function getBeijingDayRange(dateStr: string) {
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
    const type = searchParams.get('type')

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

    return NextResponse.json(records)
  } catch (error) {
    console.error('获取健康记录失败:', error)
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
      return NextResponse.json({ error: '缺少必要字段' }, { status: 400 })
    }

    // 验证 babyId 格式
    const idCheck = validateId(babyId, 'babyId')
    if (!idCheck.valid) {
      return NextResponse.json({ error: idCheck.error }, { status: 400 })
    }

    // 验证输入字段（类型枚举、数值范围等）
    const validation = validateHealthInput(body)
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400 })
    }

    // 验证 type 必填枚举
    if (!HEALTH_TYPES.includes(type)) {
      return NextResponse.json({ error: '无效的健康记录类型' }, { status: 400 })
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

    const record = await prisma.healthRecord.create({
      data: {
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
        recordedAt: new Date(recordedAt),
        notes,
        createdBy: session.user.id
      },
      include: { baby: true }
    })

    return NextResponse.json(record, { status: 201 })
  } catch (error) {
    console.error('创建健康记录失败:', error)
    return NextResponse.json({ error: '创建失败' }, { status: 500 })
  }
}
