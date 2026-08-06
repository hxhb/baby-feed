import { prisma } from '@/lib/prisma'
import { getBeijingToday } from '@/lib/time'
import { getBeijingDayRange } from '@/lib/api-helpers'
import { getPreloadedBabies, type PreloadedBaby } from '@/lib/server-babies'
import { getServerSession } from '@/lib/server-auth'
import { DEFAULT_QUICK_RECORD_KEYS, parseQuickRecordSettings, type QuickRecordKey } from '@/lib/quick-records'

export interface PreloadedDashboardFeedingRecord {
  id: string
  type: string
  startTime: string
  leftBreastDuration: number | null
  rightBreastDuration: number | null
  breastMilkAmount: number | null
  formulaAmount: number | null
  solidFoodName: string | null
  solidFoodAmount: string | null
  adGiven: boolean | null
  notes: string | null
  recordType: 'feeding'
}

export interface PreloadedDashboardHealthRecord {
  id: string
  type: string
  recordedAt: string
  weight: number | null
  height: number | null
  temperature: number | null
  medicationName: string | null
  medicationDose: string | null
  vaccineName: string | null
  vaccineManufacturer: string | null
  vaccineDoseNumber: number | null
  vaccineTotalDoses: number | null
  diaperType: string | null
  diaperStatus: string | null
  adGiven: boolean | null
  vitaminDGiven: boolean | null
  customName: string | null
  sleepStartTime: string | null
  sleepEndTime: string | null
  sleepQuality: string | null
  notes: string | null
  recordType: 'health'
}

export interface PreloadedDashboardMemo {
  id: string
  title: string
  content: string | null
  scheduledAt: string
  completed: boolean
  completedAt: string | null
}

export interface PreloadedDashboardData {
  initialBabies: PreloadedBaby[]
  initialSelectedBabyId: string | null
  initialTodayRecords: PreloadedDashboardFeedingRecord[]
  initialTodayHealthRecords: PreloadedDashboardHealthRecord[]
  initialRecentMemos: PreloadedDashboardMemo[]
  initialQuickRecordKeys: QuickRecordKey[]
}

export async function getPreloadedDashboardData(): Promise<PreloadedDashboardData> {
  const session = await getServerSession()
  if (!session?.user?.id) {
    return {
      initialBabies: [],
      initialSelectedBabyId: null,
      initialTodayRecords: [],
      initialTodayHealthRecords: [],
      initialRecentMemos: [],
      initialQuickRecordKeys: [...DEFAULT_QUICK_RECORD_KEYS],
    }
  }

  const [initialBabies, user] = await Promise.all([
    getPreloadedBabies(),
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: { quickRecordSettings: true },
    }),
  ])
  const initialSelectedBabyId = initialBabies.activeBabyId || initialBabies.babies[0]?.id || null
  const initialQuickRecordKeys = parseQuickRecordSettings(user?.quickRecordSettings)

  if (!initialSelectedBabyId) {
    return {
      initialBabies: initialBabies.babies,
      initialSelectedBabyId: null,
      initialTodayRecords: [],
      initialTodayHealthRecords: [],
      initialRecentMemos: [],
      initialQuickRecordKeys,
    }
  }

  const today = getBeijingToday()
  const { start, end } = getBeijingDayRange(today)

  // 近3天窗口：统一使用同一个时间基准，避免多次 new Date() 导致边界遗漏
  const now = new Date()
  const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000)
  const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000)

  const [feedingRecords, healthRecords, recentMemos] = await Promise.all([
    prisma.feedingRecord.findMany({
      where: {
        babyId: initialSelectedBabyId,
        createdBy: session.user.id,
        startTime: { gte: start, lte: end },
      },
      orderBy: { startTime: 'desc' },
      select: {
        id: true,
        type: true,
        startTime: true,
        leftBreastDuration: true,
        rightBreastDuration: true,
        breastMilkAmount: true,
        formulaAmount: true,
        solidFoodName: true,
        solidFoodAmount: true,
        adGiven: true,
        notes: true,
      },
    }),
    prisma.healthRecord.findMany({
      where: {
        babyId: initialSelectedBabyId,
        createdBy: session.user.id,
        recordedAt: { gte: start, lte: end },
      },
      orderBy: { recordedAt: 'desc' },
      select: {
        id: true,
        type: true,
        recordedAt: true,
        weight: true,
        height: true,
        temperature: true,
        medicationName: true,
        medicationDose: true,
        vaccineName: true,
        vaccineManufacturer: true,
        vaccineDoseNumber: true,
        vaccineTotalDoses: true,
        diaperType: true,
        diaperStatus: true,
        adGiven: true,
        vitaminDGiven: true,
        customName: true,
        sleepStartTime: true,
        sleepEndTime: true,
        sleepQuality: true,
        notes: true,
      },
    }),
    // 获取近3天内的备忘（未完成的过期备忘 + 未来3天内到期的备忘）
    prisma.memo.findMany({
      where: {
        babyId: initialSelectedBabyId,
        createdBy: session.user.id,
        completed: false,
        scheduledAt: {
          gte: threeDaysAgo,
          lte: threeDaysFromNow,
        },
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

  return {
    initialBabies: initialBabies.babies,
    initialSelectedBabyId,
    initialTodayRecords: feedingRecords.map((record) => ({
      id: record.id,
      type: record.type,
      startTime: record.startTime.toISOString(),
      leftBreastDuration: record.leftBreastDuration,
      rightBreastDuration: record.rightBreastDuration,
      breastMilkAmount: record.breastMilkAmount,
      formulaAmount: record.formulaAmount,
      solidFoodName: record.solidFoodName,
      solidFoodAmount: record.solidFoodAmount,
      adGiven: record.adGiven,
      notes: record.notes,
      recordType: 'feeding',
    })),
    initialTodayHealthRecords: healthRecords.map((record) => ({
      id: record.id,
      type: record.type,
      recordedAt: record.recordedAt.toISOString(),
      weight: record.weight,
      height: record.height,
      temperature: record.temperature,
      medicationName: record.medicationName,
      medicationDose: record.medicationDose,
      vaccineName: record.vaccineName,
      vaccineManufacturer: record.vaccineManufacturer,
      vaccineDoseNumber: record.vaccineDoseNumber,
      vaccineTotalDoses: record.vaccineTotalDoses,
      diaperType: record.diaperType,
      diaperStatus: record.diaperStatus,
      adGiven: record.adGiven,
      vitaminDGiven: record.vitaminDGiven,
      customName: record.customName,
      sleepStartTime: record.sleepStartTime?.toISOString() ?? null,
      sleepEndTime: record.sleepEndTime?.toISOString() ?? null,
      sleepQuality: record.sleepQuality,
      notes: record.notes,
      recordType: 'health',
    })),
    initialRecentMemos: recentMemos.map((memo) => ({
      id: memo.id,
      title: memo.title,
      content: memo.content,
      scheduledAt: memo.scheduledAt.toISOString(),
      completed: memo.completed,
      completedAt: memo.completedAt?.toISOString() ?? null,
    })),
    initialQuickRecordKeys,
  }
}
