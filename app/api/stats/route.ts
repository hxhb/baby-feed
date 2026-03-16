import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { validateId } from '@/lib/validation'

// 获取北京时间的 yyyy-MM-dd
function getBeijingDateStr(date: Date): string {
  const utcMs = date.getTime()
  const bj = new Date(utcMs + 8 * 60 * 60 * 1000)
  const y = bj.getUTCFullYear()
  const m = String(bj.getUTCMonth() + 1).padStart(2, '0')
  const d = String(bj.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

// 获取北京时间的一天起止（UTC时间戳）
function getBeijingDayRange(dateStr: string) {
  const start = new Date(`${dateStr}T00:00:00+08:00`)
  const end = new Date(`${dateStr}T23:59:59.999+08:00`)
  return { start, end }
}

// 获取北京时间的今天日期字符串
function getBeijingToday(): string {
  return getBeijingDateStr(new Date())
}

// 获取 N 天前的北京日期字符串
function getBeijingDaysAgo(daysAgo: number): string {
  const d = new Date()
  d.setDate(d.getDate() - daysAgo)
  return getBeijingDateStr(d)
}

export async function GET(request: NextRequest) {
  try {
    const session = await auth(request)
    if (!session?.user) {
      return NextResponse.json({ error: '未授权' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const babyId = searchParams.get('babyId')
    const daysParam = parseInt(searchParams.get('days') || '7')
    
    // 限制 days 范围为 1-365，防止过大值导致数据库查询过慢
    const days = Math.max(1, Math.min(365, isNaN(daysParam) ? 7 : daysParam))

    if (!babyId) {
      return NextResponse.json({ error: '缺少babyId参数' }, { status: 400 })
    }

    // 验证 babyId 格式
    const idCheck = validateId(babyId, 'babyId')
    if (!idCheck.valid) {
      return NextResponse.json({ error: idCheck.error }, { status: 400 })
    }

    const baby = await prisma.baby.findFirst({
      where: {
        id: babyId,
        createdBy: session.user.id
      }
    })

    if (!baby) {
      return NextResponse.json({ error: '婴儿不存在' }, { status: 404 })
    }

    const todayStr = getBeijingToday()
    const startDateStr = getBeijingDaysAgo(days - 1)
    const { start: rangeStart } = getBeijingDayRange(startDateStr)
    const { end: rangeEnd } = getBeijingDayRange(todayStr)

    // 获取日期范围内的喂养记录
    const feedingRecords = await prisma.feedingRecord.findMany({
      where: {
        babyId,
        createdBy: session.user.id,
        startTime: {
          gte: rangeStart,
          lte: rangeEnd
        }
      },
      orderBy: { startTime: 'asc' }
    })

    // 获取日期范围内的健康记录
    const healthRecords = await prisma.healthRecord.findMany({
      where: {
        babyId,
        createdBy: session.user.id,
        recordedAt: {
          gte: rangeStart,
          lte: rangeEnd
        }
      },
      orderBy: { recordedAt: 'asc' }
    })

    // 按北京日期分组统计
    const statsMap = new Map()

    // 初始化每天
    for (let i = 0; i < days; i++) {
      const date = getBeijingDaysAgo(i)
      statsMap.set(date, {
        date,
        breastFeedingCount: 0,
        totalBreastDuration: 0,
        breastBottleCount: 0,
        totalBreastMilkAmount: 0,
        formulaCount: 0,
        totalFormulaAmount: 0,
        adGiven: false,
        weight: undefined,
        temperature: undefined
      })
    }

    // 统计喂养记录（按北京时间归天）
    feedingRecords.forEach(record => {
      const date = getBeijingDateStr(new Date(record.startTime))
      const dayStats = statsMap.get(date)
      
      if (dayStats) {
        if (record.type === 'BREAST_MILK') {
          dayStats.breastFeedingCount++
          dayStats.totalBreastDuration += (record.leftBreastDuration || 0) + (record.rightBreastDuration || 0)
        } else if (record.type === 'BREAST_MILK_BOTTLE') {
          dayStats.breastBottleCount++
          dayStats.totalBreastMilkAmount += record.breastMilkAmount || 0
        } else if (record.type === 'FORMULA') {
          dayStats.formulaCount++
          dayStats.totalFormulaAmount += record.formulaAmount || 0
        }
      }
    })

    // 统计健康记录
    healthRecords.forEach(record => {
      const date = getBeijingDateStr(new Date(record.recordedAt))
      const dayStats = statsMap.get(date)
      
      if (dayStats) {
        if (record.type === 'WEIGHT' && record.weight) {
          dayStats.weight = record.weight
        } else if (record.type === 'TEMPERATURE' && record.temperature) {
          dayStats.temperature = record.temperature
        } else if (record.type === 'AD_VITAMIN' && record.adGiven) {
          dayStats.adGiven = true
        }
      }
    })

    // 计算总计数据
    const totalStats = {
      totalFeedings: feedingRecords.length,
      totalFormulaAmount: feedingRecords
        .filter(r => r.type === 'FORMULA')
        .reduce((sum, r) => sum + (r.formulaAmount || 0), 0),
      totalBreastDuration: feedingRecords
        .filter(r => r.type === 'BREAST_MILK')
        .reduce((sum, r) => sum + (r.leftBreastDuration || 0) + (r.rightBreastDuration || 0), 0),
      totalBreastMilkAmount: feedingRecords
        .filter(r => r.type === 'BREAST_MILK_BOTTLE')
        .reduce((sum, r) => sum + (r.breastMilkAmount || 0), 0)
    }

    const todayStats = statsMap.get(todayStr)

    // 获取该宝宝所有体重记录（用于完整的体重趋势图）
    const allWeightRecords = await prisma.healthRecord.findMany({
      where: {
        babyId,
        createdBy: session.user.id,
        type: 'WEIGHT',
        weight: { not: null }
      },
      orderBy: { recordedAt: 'asc' },
      select: { weight: true, recordedAt: true }
    })

    const weightTrend = allWeightRecords.map(r => ({
      date: getBeijingDateStr(new Date(r.recordedAt)),
      weight: r.weight
    }))

    return NextResponse.json({
      baby,
      todayStats: todayStats || statsMap.values().next().value,
      lastDays: Array.from(statsMap.values()).reverse(),
      totalStats,
      weightTrend
    })
  } catch (error) {
    console.error('获取统计数据失败:', error)
    return NextResponse.json({ error: '获取失败' }, { status: 500 })
  }
}
