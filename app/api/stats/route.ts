import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { validateId } from '@/lib/validation'
import { buildUserActionKey, enforceRateLimit } from '@/lib/rate-limit'

const noStoreHeaders = {
  'Cache-Control': 'no-store, max-age=0',
  'Pragma': 'no-cache',
}

function getBeijingDateStr(date: Date): string {
  const utcMs = date.getTime()
  const bj = new Date(utcMs + 8 * 60 * 60 * 1000)
  const y = bj.getUTCFullYear()
  const m = String(bj.getUTCMonth() + 1).padStart(2, '0')
  const d = String(bj.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function getBeijingDayRange(dateStr: string) {
  const start = new Date(`${dateStr}T00:00:00+08:00`)
  const end = new Date(`${dateStr}T23:59:59.999+08:00`)
  return { start, end }
}

function getBeijingToday(): string {
  return getBeijingDateStr(new Date())
}

function getBeijingDaysAgo(daysAgo: number): string {
  const d = new Date()
  d.setDate(d.getDate() - daysAgo)
  return getBeijingDateStr(d)
}

export async function GET(request: NextRequest) {
  try {
    const session = await auth(request)
    if (!session?.user) {
      return NextResponse.json({ error: '未授权' }, { status: 401, headers: noStoreHeaders })
    }

    const statsRateLimit = enforceRateLimit({
      key: buildUserActionKey('stats-query', session.user.id, request),
      limit: 120,
      windowMs: 60 * 1000,
    })
    if (!statsRateLimit.allowed) {
      return NextResponse.json({ error: '请求过于频繁，请稍后再试' }, {
        status: 429,
        headers: {
          ...noStoreHeaders,
          'Retry-After': String(statsRateLimit.retryAfterSeconds),
        },
      })
    }

    const { searchParams } = new URL(request.url)
    const babyId = searchParams.get('babyId')
    const daysRaw = searchParams.get('days')

    let days = 7
    if (daysRaw !== null) {
      if (!/^\d{1,3}$/.test(daysRaw)) {
        return NextResponse.json({ error: 'days 参数无效' }, { status: 400, headers: noStoreHeaders })
      }

      const parsedDays = Number.parseInt(daysRaw, 10)
      if (parsedDays < 1 || parsedDays > 365) {
        return NextResponse.json({ error: 'days 参数超出范围 (1-365)' }, { status: 400, headers: noStoreHeaders })
      }
      days = parsedDays
    }

    if (!babyId) {
      return NextResponse.json({ error: '缺少babyId参数' }, { status: 400, headers: noStoreHeaders })
    }

    const idCheck = validateId(babyId, 'babyId')
    if (!idCheck.valid) {
      return NextResponse.json({ error: idCheck.error }, { status: 400, headers: noStoreHeaders })
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

    const todayStr = getBeijingToday()
    const startDateStr = getBeijingDaysAgo(days - 1)
    const { start: rangeStart } = getBeijingDayRange(startDateStr)
    const { end: rangeEnd } = getBeijingDayRange(todayStr)

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

    const statsMap = new Map()

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
    }, { headers: noStoreHeaders })
  } catch (error) {
    console.error('获取统计数据失败:', error)
    return NextResponse.json({ error: '获取失败' }, { status: 500, headers: noStoreHeaders })
  }
}
