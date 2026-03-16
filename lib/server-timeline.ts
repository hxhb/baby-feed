import { prisma } from '@/lib/prisma'
import { getPreloadedBabies } from '@/lib/server-babies'
import { getServerSession } from '@/lib/server-auth'
import { getBeijingToday } from '@/lib/time'

export interface PreloadedTimelineBaby {
  id: string
  name: string
}

export interface PreloadedTimelineFeedingRecord {
  id: string
  type: string
  startTime: string
  endTime?: string | null
  leftBreastDuration?: number | null
  rightBreastDuration?: number | null
  breastMilkAmount?: number | null
  formulaAmount?: number | null
  adGiven?: boolean | null
  notes?: string | null
  baby?: PreloadedTimelineBaby
  recordType: 'feeding'
}

export interface PreloadedTimelineHealthRecord {
  id: string
  type: string
  recordedAt: string
  weight?: number | null
  height?: number | null
  temperature?: number | null
  medicationName?: string | null
  medicationDose?: string | null
  vaccineName?: string | null
  diaperType?: string | null
  diaperStatus?: string | null
  adGiven?: boolean | null
  notes?: string | null
  baby?: PreloadedTimelineBaby
  recordType: 'health'
}

export type PreloadedTimelineRecord = PreloadedTimelineFeedingRecord | PreloadedTimelineHealthRecord

export interface PreloadedTimelinePageData {
  initialBabies: Awaited<ReturnType<typeof getPreloadedBabies>>
  initialSelectedBabyId: string | null
  initialDate: string
  initialRecords: PreloadedTimelineRecord[]
}

function getBeijingDayRange(dateStr: string) {
  return {
    start: new Date(`${dateStr}T00:00:00+08:00`),
    end: new Date(`${dateStr}T23:59:59.999+08:00`),
  }
}

async function getPreloadedTimelineRecords(userId: string, babyId: string, dateStr: string): Promise<PreloadedTimelineRecord[]> {
  const { start, end } = getBeijingDayRange(dateStr)

  const [feedingRecords, healthRecords] = await Promise.all([
    prisma.feedingRecord.findMany({
      where: {
        babyId,
        createdBy: userId,
        startTime: { gte: start, lte: end },
      },
      orderBy: { startTime: 'desc' },
      select: {
        id: true,
        type: true,
        startTime: true,
        endTime: true,
        leftBreastDuration: true,
        rightBreastDuration: true,
        breastMilkAmount: true,
        formulaAmount: true,
        adGiven: true,
        notes: true,
      },
    }),
    prisma.healthRecord.findMany({
      where: {
        babyId,
        createdBy: userId,
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
        diaperType: true,
        diaperStatus: true,
        adGiven: true,
        notes: true,
      },
    }),
  ])

  return [
    ...feedingRecords.map((record) => ({
      ...record,
      startTime: record.startTime.toISOString(),
      endTime: record.endTime?.toISOString() ?? null,
      recordType: 'feeding' as const,
    })),
    ...healthRecords.map((record) => ({
      ...record,
      recordedAt: record.recordedAt.toISOString(),
      recordType: 'health' as const,
    })),
  ].sort((a, b) => {
    const timeA = new Date(a.recordType === 'feeding' ? a.startTime : a.recordedAt).getTime()
    const timeB = new Date(b.recordType === 'feeding' ? b.startTime : b.recordedAt).getTime()
    return timeB - timeA
  })
}

export async function getPreloadedTimelinePageData(): Promise<PreloadedTimelinePageData> {
  const session = await getServerSession()
  const initialDate = getBeijingToday()

  if (!session?.user?.id) {
    return {
      initialBabies: [],
      initialSelectedBabyId: null,
      initialDate,
      initialRecords: [],
    }
  }

  const initialBabies = await getPreloadedBabies()
  const initialSelectedBabyId = initialBabies[0]?.id ?? null

  if (!initialSelectedBabyId) {
    return {
      initialBabies,
      initialSelectedBabyId: null,
      initialDate,
      initialRecords: [],
    }
  }

  const initialRecords = await getPreloadedTimelineRecords(session.user.id, initialSelectedBabyId, initialDate)

  return {
    initialBabies,
    initialSelectedBabyId,
    initialDate,
    initialRecords,
  }
}