import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { validateId } from '@/lib/validation'
import { buildUserActionKey, enforceRateLimit } from '@/lib/rate-limit'
import { noStoreHeaders, getBeijingDateStr, getBeijingDayRange, getBeijingTodayStr, getBeijingDaysAgoStr, splitDurationByBeijingDay } from '@/lib/api-helpers'

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
      },
      select: {
        id: true,
        name: true,
        birthDate: true,
        gender: true,
        createdAt: true,
        updatedAt: true,
        createdBy: true,
      }
    })

    if (!baby) {
      return NextResponse.json({ error: '婴儿不存在' }, { status: 404, headers: noStoreHeaders })
    }

    const todayStr = getBeijingTodayStr()
    const startDateStr = getBeijingDaysAgoStr(days - 1)
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
          OR: [
            { recordedAt: { gte: rangeStart, lte: rangeEnd } },
            { type: 'SLEEP', sleepStartTime: { gte: rangeStart, lte: rangeEnd } },
          ],
        },
        orderBy: { recordedAt: 'asc' }
      })
    ])

    const statsMap = new Map()

    for (let i = 0; i < days; i++) {
      const date = getBeijingDaysAgoStr(i)
      statsMap.set(date, {
        date,
        breastFeedingCount: 0,
        totalBreastDuration: 0,
        leftBreastDuration: 0,
        rightBreastDuration: 0,
        breastBottleCount: 0,
        totalBreastMilkAmount: 0,
        formulaCount: 0,
        totalFormulaAmount: 0,
        adGiven: false,
        peeCount: 0,
        poopCount: 0,
        nightFeedingCount: 0,
        sleepDurationMinutes: 0,
        sleepCount: 0,
        weight: undefined,
        height: undefined,
        temperature: undefined
      })
    }

    feedingRecords.forEach(record => {
      const date = getBeijingDateStr(new Date(record.startTime))
      const dayStats = statsMap.get(date)
      
      if (dayStats) {
        const leftDur = record.leftBreastDuration || 0
        const rightDur = record.rightBreastDuration || 0

        if (record.type === 'BREAST_MILK') {
          dayStats.breastFeedingCount++
          dayStats.totalBreastDuration += leftDur + rightDur
          dayStats.leftBreastDuration += leftDur
          dayStats.rightBreastDuration += rightDur
        } else if (record.type === 'BREAST_MILK_BOTTLE') {
          dayStats.breastBottleCount++
          dayStats.totalBreastMilkAmount += record.breastMilkAmount || 0
        } else if (record.type === 'FORMULA') {
          dayStats.formulaCount++
          dayStats.totalFormulaAmount += record.formulaAmount || 0
        }

        // Night feeding detection (22:00 - 06:00 Beijing time)
        const bjTime = new Date(new Date(record.startTime).getTime() + 8 * 60 * 60 * 1000)
        const hour = bjTime.getUTCHours()
        if (hour >= 22 || hour < 6) {
          dayStats.nightFeedingCount += 1
        }
      }
    })

    // Calculate feeding intervals (minutes between consecutive feedings)
    const feedingIntervals: number[] = []
    for (let i = 1; i < feedingRecords.length; i++) {
      const prev = new Date(feedingRecords[i - 1].startTime).getTime()
      const curr = new Date(feedingRecords[i].startTime).getTime()
      const intervalMinutes = Math.round((curr - prev) / (60 * 1000))
      if (intervalMinutes > 0 && intervalMinutes < 720) {
        feedingIntervals.push(intervalMinutes)
      }
    }

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

      // SLEEP: split duration across natural day boundaries (Beijing time)
      if (record.type === 'SLEEP' && record.sleepStartTime && record.sleepEndTime) {
        splitDurationByBeijingDay(
          new Date(record.sleepStartTime).getTime(),
          new Date(record.sleepEndTime).getTime(),
          (dayStr, minutes, isStartDay) => {
            const targetStats = statsMap.get(dayStr)
            if (targetStats) {
              targetStats.sleepDurationMinutes += minutes
              if (isStartDay) {
                targetStats.sleepCount += 1
              }
            }
          },
        )
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

    const [allWeightRecords, allHeightRecords, vaccineRecords, medicationRecords] = await Promise.all([
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
      }),
      prisma.healthRecord.findMany({
        where: {
          babyId,
          createdBy: session.user.id,
          type: 'MEDICATION',
          medicationName: { not: null },
          recordedAt: {
            gte: rangeStart,
            lte: rangeEnd
          }
        },
        orderBy: { recordedAt: 'desc' },
        select: {
          id: true,
          medicationName: true,
          medicationDose: true,
          recordedAt: true,
          notes: true
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
      }),
      medicationRecords: medicationRecords.flatMap(record => {
        if (!record.medicationName) {
          return []
        }

        return {
          id: record.id,
          medicationName: record.medicationName,
          medicationDose: record.medicationDose,
          date: getBeijingDateStr(new Date(record.recordedAt)),
          recordedAt: record.recordedAt,
          notes: record.notes
        }
      }),
      feedingIntervals,
      feedingHeatmap: (() => {
        const heatmap = new Map<string, number>()
        feedingRecords.forEach((record) => {
          const bjTime = new Date(new Date(record.startTime).getTime() + 8 * 60 * 60 * 1000)
          const date = getBeijingDateStr(new Date(record.startTime))
          const hour = bjTime.getUTCHours()
          const key = `${date}|${hour}`
          heatmap.set(key, (heatmap.get(key) || 0) + 1)
        })
        return Array.from(heatmap.entries()).map(([key, count]) => {
          const [date, hourStr] = key.split('|')
          return { date, hour: Number(hourStr), count }
        })
      })(),
      babyBirthDate: baby.birthDate ? getBeijingDateStr(new Date(baby.birthDate)) : null,
    }, { headers: noStoreHeaders })
  } catch (error) {
    console.error('获取统计数据失败:', error)
    return NextResponse.json({ error: '获取失败' }, { status: 500, headers: noStoreHeaders })
  }
}
