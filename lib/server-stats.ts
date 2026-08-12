import { prisma } from '@/lib/prisma'
import { getPreloadedBabies, type PreloadedBaby } from '@/lib/server-babies'
import { getServerSession } from '@/lib/server-auth'
import { getBeijingDateStr, getBeijingDayRange, getBeijingTodayStr, getBeijingDaysAgoStr, splitDurationByBeijingDay, buildSleepAwareOrClause } from '@/lib/api-helpers'

export interface PreloadedStatsBaby {
  id: string
  name: string
}

export interface PreloadedStatsDay {
  date: string
  breastFeedingCount: number
  totalBreastDuration: number
  leftBreastDuration: number
  rightBreastDuration: number
  breastBottleCount: number
  totalBreastMilkAmount: number
  formulaCount: number
  totalFormulaAmount: number
  solidFoodCount: number
  adGiven: boolean
  peeCount: number
  poopCount: number
  nightFeedingCount: number
  sleepDurationMinutes: number
  sleepCount: number
  weight?: number
  height?: number
  temperature?: number
}

export interface PreloadedStatsData {
  baby: PreloadedStatsBaby
  todayStats: PreloadedStatsDay
  lastDays: PreloadedStatsDay[]
  totalStats: {
    totalFeedings: number
    totalFormulaAmount: number
    totalBreastDuration: number
    totalBreastMilkAmount: number
  }
  weightTrend: {
    date: string
    recordedAt: string
    weight: number
  }[]
  heightTrend: {
    date: string
    recordedAt: string
    height: number
  }[]
  vaccineRecords: {
    id: string
    vaccineName: string
    vaccineManufacturer: string | null
    date: string
    recordedAt: string
    notes: string | null
    vaccineDoseNumber: number | null
    vaccineTotalDoses: number | null
  }[]
  toothEruptionRecords: {
    id: string
    date: string
    recordedAt: string
    createdAt: string
    notes: string | null
    toothEruptions: { toothCode: string }[]
  }[]
  medicationRecords: {
    id: string
    medicationName: string
    medicationDose: string | null
    date: string
    recordedAt: string
    notes: string | null
  }[]
  memoRecords: {
    id: string
    title: string
    content: string | null
    scheduledAt: string
    completed: boolean
    completedAt: string | null
  }[]
  feedingIntervals: number[]
  feedingHeatmap: { date: string; hour: number; count: number }[]
  babyBirthDate: string | null
  babyGender: string | null
}

export interface PreloadedStatsPageData {
  initialBabies: PreloadedBaby[]
  initialSelectedBabyId: string | null
  initialStats: PreloadedStatsData | null
}

function createEmptyStatsDay(date: string): PreloadedStatsDay {
  return {
    date,
    breastFeedingCount: 0,
    totalBreastDuration: 0,
    leftBreastDuration: 0,
    rightBreastDuration: 0,
    breastBottleCount: 0,
    totalBreastMilkAmount: 0,
    formulaCount: 0,
    totalFormulaAmount: 0,
    solidFoodCount: 0,
    adGiven: false,
    peeCount: 0,
    poopCount: 0,
    nightFeedingCount: 0,
    sleepDurationMinutes: 0,
    sleepCount: 0,
    weight: undefined,
    height: undefined,
    temperature: undefined,
  }
}

async function getPreloadedStatsForBaby(userId: string, babyId: string, days = 7): Promise<PreloadedStatsData | null> {
  const baby = await prisma.baby.findFirst({
    where: {
      id: babyId,
      createdBy: userId,
    },
    select: {
      id: true,
      name: true,
      birthDate: true,
      gender: true,
    },
  })

  if (!baby) {
    return null
  }

  const todayStr = getBeijingTodayStr()
  const startDateStr = getBeijingDaysAgoStr(days - 1)
  const { start: rangeStart } = getBeijingDayRange(startDateStr)
  const { end: rangeEnd } = getBeijingDayRange(todayStr)

  const [feedingRecords, healthRecords, allWeightRecords, allHeightRecords, vaccineRecords, toothEruptionRecords, medicationRecords, memoRecords] = await Promise.all([
    prisma.feedingRecord.findMany({
      where: {
        babyId,
        createdBy: userId,
        startTime: {
          gte: rangeStart,
          lte: rangeEnd,
        },
      },
      orderBy: { startTime: 'asc' },
    }),
    prisma.healthRecord.findMany({
      where: {
        babyId,
        createdBy: userId,
        // Include records where recordedAt is in range
        // OR sleep records whose sleepStartTime is in range (cross-midnight sleep)
        OR: buildSleepAwareOrClause(rangeStart, rangeEnd),
      },
      orderBy: { recordedAt: 'asc' },
    }),
    prisma.healthRecord.findMany({
      where: {
        babyId,
        createdBy: userId,
        type: 'WEIGHT',
        weight: { not: null },
      },
      orderBy: { recordedAt: 'asc' },
      select: { weight: true, recordedAt: true },
    }),
    prisma.healthRecord.findMany({
      where: {
        babyId,
        createdBy: userId,
        type: 'HEIGHT',
        height: { not: null },
      },
      orderBy: { recordedAt: 'asc' },
      select: { height: true, recordedAt: true },
    }),
    prisma.healthRecord.findMany({
      where: {
        babyId,
        createdBy: userId,
        type: 'VACCINE',
        vaccineName: { not: null },
      },
      orderBy: { recordedAt: 'desc' },
      select: {
        id: true,
        vaccineName: true,
        vaccineManufacturer: true,
        recordedAt: true,
        notes: true,
        vaccineDoseNumber: true,
        vaccineTotalDoses: true,
      },
    }),
    prisma.healthRecord.findMany({
      where: {
        babyId,
        createdBy: userId,
        type: 'TOOTH_ERUPTION',
      },
      orderBy: [{ recordedAt: 'asc' }, { createdAt: 'asc' }],
      select: {
        id: true,
        recordedAt: true,
        createdAt: true,
        notes: true,
        toothEruptions: { select: { toothCode: true } },
      },
    }),
    prisma.healthRecord.findMany({
      where: {
        babyId,
        createdBy: userId,
        type: 'MEDICATION',
        medicationName: { not: null },
        recordedAt: {
          gte: rangeStart,
          lte: rangeEnd,
        },
      },
      orderBy: { recordedAt: 'desc' },
      select: {
        id: true,
        medicationName: true,
        medicationDose: true,
        recordedAt: true,
        notes: true,
      },
    }),
    prisma.memo.findMany({
      where: {
        babyId,
        createdBy: userId,
      },
      orderBy: { scheduledAt: 'asc' },
      select: {
        id: true,
        title: true,
        content: true,
        scheduledAt: true,
        completed: true,
        completedAt: true,
      },
    }),
  ])

  const statsMap = new Map<string, PreloadedStatsDay>()

  for (let i = 0; i < days; i++) {
    const date = getBeijingDaysAgoStr(i)
    statsMap.set(date, createEmptyStatsDay(date))
  }

  feedingRecords.forEach((record) => {
    const date = getBeijingDateStr(new Date(record.startTime))
    const dayStats = statsMap.get(date)

    if (!dayStats) {
      return
    }

    const leftDur = record.leftBreastDuration || 0
    const rightDur = record.rightBreastDuration || 0

    if (record.type === 'BREAST_MILK') {
      dayStats.breastFeedingCount += 1
      dayStats.totalBreastDuration += leftDur + rightDur
      dayStats.leftBreastDuration += leftDur
      dayStats.rightBreastDuration += rightDur
    } else if (record.type === 'BREAST_MILK_BOTTLE') {
      dayStats.breastBottleCount += 1
      dayStats.totalBreastMilkAmount += record.breastMilkAmount || 0
    } else if (record.type === 'FORMULA') {
      dayStats.formulaCount += 1
      dayStats.totalFormulaAmount += record.formulaAmount || 0
    } else if (record.type === 'SOLID_FOOD') {
      dayStats.solidFoodCount += 1
    }

    // Night feeding detection (22:00 - 06:00 Beijing time)
    const bjTime = new Date(new Date(record.startTime).getTime() + 8 * 60 * 60 * 1000)
    const hour = bjTime.getUTCHours()
    if (hour >= 22 || hour < 6) {
      dayStats.nightFeedingCount += 1
    }
  })

  // Calculate feeding intervals (minutes between consecutive feedings)
  const feedingIntervals: number[] = []
  for (let i = 1; i < feedingRecords.length; i++) {
    const prev = new Date(feedingRecords[i - 1].startTime).getTime()
    const curr = new Date(feedingRecords[i].startTime).getTime()
    const intervalMinutes = Math.round((curr - prev) / (60 * 1000))
    if (intervalMinutes > 0 && intervalMinutes < 720) { // Ignore intervals > 12h (likely different days)
      feedingIntervals.push(intervalMinutes)
    }
  }

  healthRecords.forEach((record) => {
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
        (dayStr, minutes) => {
          const targetStats = statsMap.get(dayStr)
          if (targetStats) {
            targetStats.sleepDurationMinutes += minutes
            targetStats.sleepCount += 1
          }
        },
      )
    }
  })

  const todayStats =
    statsMap.get(todayStr) ??
    Array.from(statsMap.values())[0] ??
    createEmptyStatsDay(todayStr)

  return {
    baby,
    todayStats,
    lastDays: Array.from(statsMap.values()).reverse(),
    totalStats: {
      totalFeedings: feedingRecords.length,
      totalFormulaAmount: feedingRecords
        .filter((record) => record.type === 'FORMULA')
        .reduce((sum, record) => sum + (record.formulaAmount || 0), 0),
      totalBreastDuration: feedingRecords
        .filter((record) => record.type === 'BREAST_MILK')
        .reduce((sum, record) => sum + (record.leftBreastDuration || 0) + (record.rightBreastDuration || 0), 0),
      totalBreastMilkAmount: feedingRecords
        .filter((record) => record.type === 'BREAST_MILK_BOTTLE')
        .reduce((sum, record) => sum + (record.breastMilkAmount || 0), 0),
    },
    weightTrend: allWeightRecords.flatMap((record) => {
      if (record.weight == null) {
        return []
      }

      return {
        date: getBeijingDateStr(new Date(record.recordedAt)),
        recordedAt: record.recordedAt.toISOString(),
        weight: record.weight,
      }
    }),
    heightTrend: allHeightRecords.flatMap((record) => {
      if (record.height == null) {
        return []
      }

      return {
        date: getBeijingDateStr(new Date(record.recordedAt)),
        recordedAt: record.recordedAt.toISOString(),
        height: record.height,
      }
    }),
    vaccineRecords: vaccineRecords.flatMap((record) => {
      if (!record.vaccineName) {
        return []
      }

      return {
        id: record.id,
        vaccineName: record.vaccineName,
        vaccineManufacturer: record.vaccineManufacturer,
        date: getBeijingDateStr(new Date(record.recordedAt)),
        recordedAt: record.recordedAt.toISOString(),
        notes: record.notes,
        vaccineDoseNumber: record.vaccineDoseNumber,
        vaccineTotalDoses: record.vaccineTotalDoses,
      }
    }),
    toothEruptionRecords: toothEruptionRecords.map((record) => ({
      id: record.id,
      date: getBeijingDateStr(new Date(record.recordedAt)),
      recordedAt: record.recordedAt.toISOString(),
      createdAt: record.createdAt.toISOString(),
      notes: record.notes,
      toothEruptions: record.toothEruptions,
    })),
    medicationRecords: medicationRecords.flatMap((record) => {
      if (!record.medicationName) {
        return []
      }

      return {
        id: record.id,
        medicationName: record.medicationName,
        medicationDose: record.medicationDose,
        date: getBeijingDateStr(new Date(record.recordedAt)),
        recordedAt: record.recordedAt.toISOString(),
        notes: record.notes,
      }
    }),
    memoRecords: memoRecords.map((record) => ({
      id: record.id,
      title: record.title,
      content: record.content,
      scheduledAt: record.scheduledAt.toISOString(),
      completed: record.completed,
      completedAt: record.completedAt ? record.completedAt.toISOString() : null,
    })),
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
    babyGender: baby.gender || null,
  }
}

export async function getPreloadedStatsPageData(): Promise<PreloadedStatsPageData> {
  const session = await getServerSession()
  if (!session?.user?.id) {
    return {
      initialBabies: [],
      initialSelectedBabyId: null,
      initialStats: null,
    }
  }

  const babiesResult = await getPreloadedBabies()
  const initialSelectedBabyId = babiesResult.activeBabyId || babiesResult.babies[0]?.id || null

  if (!initialSelectedBabyId) {
    return {
      initialBabies: babiesResult.babies,
      initialSelectedBabyId: null,
      initialStats: null,
    }
  }

  const initialStats = await getPreloadedStatsForBaby(session.user.id, initialSelectedBabyId)

  return {
    initialBabies: babiesResult.babies,
    initialSelectedBabyId,
    initialStats,
  }
}
