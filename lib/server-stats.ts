import { prisma } from '@/lib/prisma'
import { getPreloadedBabies } from '@/lib/server-babies'
import { getServerSession } from '@/lib/server-auth'

export interface PreloadedStatsBaby {
  id: string
  name: string
}

export interface PreloadedStatsDay {
  date: string
  breastFeedingCount: number
  totalBreastDuration: number
  breastBottleCount: number
  totalBreastMilkAmount: number
  formulaCount: number
  totalFormulaAmount: number
  adGiven: boolean
  peeCount: number
  poopCount: number
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
    date: string
    recordedAt: string
    notes: string | null
    vaccineDoseNumber: number | null
    vaccineTotalDoses: number | null
  }[]
}

export interface PreloadedStatsPageData {
  initialBabies: Awaited<ReturnType<typeof getPreloadedBabies>>
  initialSelectedBabyId: string | null
  initialStats: PreloadedStatsData | null
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

function createEmptyStatsDay(date: string): PreloadedStatsDay {
  return {
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
    temperature: undefined,
  }
}

function getBeijingDaysAgo(daysAgo: number): string {
  const d = new Date()
  d.setDate(d.getDate() - daysAgo)
  return getBeijingDateStr(d)
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
    },
  })

  if (!baby) {
    return null
  }

  const todayStr = getBeijingToday()
  const startDateStr = getBeijingDaysAgo(days - 1)
  const { start: rangeStart } = getBeijingDayRange(startDateStr)
  const { end: rangeEnd } = getBeijingDayRange(todayStr)

  const [feedingRecords, healthRecords, allWeightRecords, allHeightRecords, vaccineRecords] = await Promise.all([
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
        recordedAt: {
          gte: rangeStart,
          lte: rangeEnd,
        },
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
        recordedAt: true,
        notes: true,
        vaccineDoseNumber: true,
        vaccineTotalDoses: true,
      },
    }),
  ])

  const statsMap = new Map<string, PreloadedStatsDay>()

  for (let i = 0; i < days; i++) {
    const date = getBeijingDaysAgo(i)
    statsMap.set(date, createEmptyStatsDay(date))
  }

  feedingRecords.forEach((record) => {
    const date = getBeijingDateStr(new Date(record.startTime))
    const dayStats = statsMap.get(date)

    if (!dayStats) {
      return
    }

    if (record.type === 'BREAST_MILK') {
      dayStats.breastFeedingCount += 1
      dayStats.totalBreastDuration += (record.leftBreastDuration || 0) + (record.rightBreastDuration || 0)
    } else if (record.type === 'BREAST_MILK_BOTTLE') {
      dayStats.breastBottleCount += 1
      dayStats.totalBreastMilkAmount += record.breastMilkAmount || 0
    } else if (record.type === 'FORMULA') {
      dayStats.formulaCount += 1
      dayStats.totalFormulaAmount += record.formulaAmount || 0
    }
  })

  healthRecords.forEach((record) => {
    const date = getBeijingDateStr(new Date(record.recordedAt))
    const dayStats = statsMap.get(date)

    if (!dayStats) {
      return
    }

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
        date: getBeijingDateStr(new Date(record.recordedAt)),
        recordedAt: record.recordedAt.toISOString(),
        notes: record.notes,
        vaccineDoseNumber: record.vaccineDoseNumber,
        vaccineTotalDoses: record.vaccineTotalDoses,
      }
    }),
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

  const initialBabies = await getPreloadedBabies()
  const initialSelectedBabyId = initialBabies[0]?.id ?? null

  if (!initialSelectedBabyId) {
    return {
      initialBabies,
      initialSelectedBabyId: null,
      initialStats: null,
    }
  }

  const initialStats = await getPreloadedStatsForBaby(session.user.id, initialSelectedBabyId)

  return {
    initialBabies,
    initialSelectedBabyId,
    initialStats,
  }
}