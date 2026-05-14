import { prisma } from '@/lib/prisma'
import { getPreloadedBabies } from '@/lib/server-babies'
import { getServerSession } from '@/lib/server-auth'
import { getBeijingToday } from '@/lib/time'
import { getBeijingDateStr, getBeijingDayRange, buildSleepAwareOrClause } from '@/lib/api-helpers'

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
  babyId: string
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
  vaccineManufacturer?: string | null
  vaccineDoseNumber?: number | null
  vaccineTotalDoses?: number | null
  diaperType?: string | null
  diaperStatus?: string | null
  adGiven?: boolean | null
  sleepStartTime?: string | null
  sleepEndTime?: string | null
  sleepQuality?: string | null
  notes?: string | null
  babyId: string
  baby?: PreloadedTimelineBaby
  recordType: 'health'
}

export type PreloadedTimelineRecord = PreloadedTimelineFeedingRecord | PreloadedTimelineHealthRecord

export interface PreloadedTimelinePageData {
  initialBabies: Awaited<ReturnType<typeof getPreloadedBabies>>
  initialSelectedBabyId: string | null
  initialDate: string
  initialRecords: PreloadedTimelineRecord[]
  initialValidDates: string[]
}

export async function getTimelineValidDates(userId: string, babyId: string): Promise<string[]> {
  const [feedingDates, healthDates] = await Promise.all([
    prisma.feedingRecord.findMany({
      where: {
        babyId,
        createdBy: userId,
      },
      select: {
        startTime: true,
      },
      orderBy: { startTime: 'desc' },
    }),
    prisma.healthRecord.findMany({
      where: {
        babyId,
        createdBy: userId,
      },
      select: {
        recordedAt: true,
        type: true,
        sleepStartTime: true,
      },
      orderBy: { recordedAt: 'desc' },
    }),
  ])

  const validDates = new Set<string>()

  feedingDates.forEach((record) => {
    validDates.add(getBeijingDateStr(record.startTime))
  })

  healthDates.forEach((record) => {
    validDates.add(getBeijingDateStr(record.recordedAt))
    // For cross-midnight sleep records, also mark the sleep start date as valid
    if (record.type === 'SLEEP' && record.sleepStartTime) {
      validDates.add(getBeijingDateStr(record.sleepStartTime))
    }
  })

  return Array.from(validDates).sort((a, b) => b.localeCompare(a))
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
        babyId: true,
      },
    }),
    // Query health records: include records where recordedAt is in range
    // OR sleep records whose sleepStartTime is in range (cross-midnight sleep)
    prisma.healthRecord.findMany({
      where: {
        babyId,
        createdBy: userId,
        OR: buildSleepAwareOrClause(start, end),
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
        sleepStartTime: true,
        sleepEndTime: true,
        sleepQuality: true,
        notes: true,
        babyId: true,
      },
    }),
  ])

  const { start: dayStart, end: dayEnd } = getBeijingDayRange(dateStr)
  const dayStartMs = dayStart.getTime()
  const dayEndMs = dayEnd.getTime()

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
      sleepStartTime: record.sleepStartTime?.toISOString() ?? null,
      sleepEndTime: record.sleepEndTime?.toISOString() ?? null,
      recordType: 'health' as const,
    })),
  ].sort((a, b) => {
    const getTime = (rec: typeof a) => {
      if (rec.recordType === 'feeding') return new Date(rec.startTime).getTime()
      if (rec.type === 'SLEEP' && rec.sleepStartTime) {
        const startMs = new Date(rec.sleepStartTime).getTime()
        // If sleep started on this date, sort by start time;
        // otherwise it's a cross-midnight record viewed from the end date — sort by wake time
        if (startMs >= dayStartMs && startMs <= dayEndMs) return startMs
        return new Date(rec.sleepEndTime ?? rec.recordedAt).getTime()
      }
      return new Date(rec.recordedAt).getTime()
    }
    return getTime(b) - getTime(a)
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
      initialValidDates: [],
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
      initialValidDates: [],
    }
  }

  const [initialRecords, initialValidDates] = await Promise.all([
    getPreloadedTimelineRecords(session.user.id, initialSelectedBabyId, initialDate),
    getTimelineValidDates(session.user.id, initialSelectedBabyId),
  ])

  return {
    initialBabies,
    initialSelectedBabyId,
    initialDate,
    initialRecords,
    initialValidDates,
  }
}