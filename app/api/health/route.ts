import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { startOfDay, endOfDay } from 'date-fns'

export async function GET(request: NextRequest) {
  try {
    const session = await auth()
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
      const targetDate = new Date(date)
      whereClause.recordedAt = {
        gte: startOfDay(targetDate),
        lte: endOfDay(targetDate)
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
    const session = await auth()
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
