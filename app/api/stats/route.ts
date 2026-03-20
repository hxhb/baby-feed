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

    const [feedingRecords, healthRecords] = await Promise.all([
      prisma.feedingRecord.findMany({
        where: {
          babyId,
          createdBy: session.user.id,
          startTime: {
            gte: rangeStart,
            lte: rangeEnd
          }
        },
        orderBy: { startTime: 'asc' }
      }),
      prisma.healthRecord.findMany({
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
    ])

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
        peeCount: 0,
        poopCount: 0,
        weight: undefined,
        height: undefined,
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
        } else if (record.type === 'HEIGHT' && record.height) {
          dayStats.height = record.height
        } else if (record.type === 'TEMPERATURE' && record.temperature) {
          dayStats.temperature = record.temperature
        } else if (record.type === 'AD_VITAMIN' && record.adGiven) {
          dayStats.adGiven = true
        } else if (record.type === 'DIAPER') {
          if (record.diaperType === 'PEE' || record.diaperType === 'BOTH') {
            dayStats.peeCount += 1
          }
          if (record.diaperType === 'POOP' || record.diaperType === 'BOTH') {
            dayStats.poopCount += 1
          }
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

    const [allWeightRecords, allHeightRecords, vaccineRecords] = await Promise.all([
      prisma.healthRecord.findMany({
        where: {
          babyId,
          createdBy: session.user.id,
          type: 'WEIGHT',
          weight: { not: null }
        },
        orderBy: { recordedAt: 'asc' },
        select: { weight: true, recordedAt: true }
      }),
      prisma.healthRecord.findMany({
        where: {
          babyId,
          createdBy: session.user.id,
          type: 'HEIGHT',
          height: { not: null }
        },
        orderBy: { recordedAt: 'asc' },
        select: { height: true, recordedAt: true }
      }),
      prisma.healthRecord.findMany({
        where: {
          babyId,
          createdBy: session.user.id,
          type: 'VACCINE',
          vaccineName: { not: null }
        },
        orderBy: { recordedAt: 'desc' },
        select: {
          id: true,
          vaccineName: true,
          recordedAt: true,
          notes: true,
          vaccineDoseNumber: true,
          vaccineTotalDoses: true
        }
      })
    ])

    const weightTrend = allWeightRecords.flatMap(r => {
      if (r.weight == null) {
        return []
      }

      return {
        date: getBeijingDateStr(new Date(r.recordedAt)),
        recordedAt: r.recordedAt,
        weight: r.weight
      }
    })

    const heightTrend = allHeightRecords.flatMap(r => {
      if (r.height == null) {
        return []
      }

      return {
        date: getBeijingDateStr(new Date(r.recordedAt)),
        recordedAt: r.recordedAt,
        height: r.height
      }
    })

    return NextResponse.json({
      baby,
      todayStats: todayStats || statsMap.values().next().value,
      lastDays: Array.from(statsMap.values()).reverse(),
      totalStats,
      weightTrend,
      heightTrend,
      vaccineRecords: vaccineRecords.flatMap(record => {
        if (!record.vaccineName) {
          return []
        }

        return {
          id: record.id,
          vaccineName: record.vaccineName,
          date: getBeijingDateStr(new Date(record.recordedAt)),
          recordedAt: record.recordedAt,
          notes: record.notes,
          vaccineDoseNumber: record.vaccineDoseNumber,
          vaccineTotalDoses: record.vaccineTotalDoses
        }
      })
    }, { headers: noStoreHeaders })
  } catch (error) {
    console.error('获取统计数据失败:', error)
    return NextResponse.json({ error: '获取失败' }, { status: 500, headers: noStoreHeaders })
  }
}
