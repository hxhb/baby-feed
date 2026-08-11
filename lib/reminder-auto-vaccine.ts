import { prisma } from './prisma'
import { getBeijingDateStr, getBeijingDayRange } from './api-helpers'
import { logError } from './logger'
import type { Prisma } from '@/app/generated/prisma/client'

type VaccineReminderDb = Pick<
  Prisma.TransactionClient,
  'user' | 'healthRecord' | 'reminderRule'
>

interface VaccineReminderDefaults {
  windowDays: number
  repeatHours: number
  scheduleStart: string
  scheduleEnd: string
}

const DEFAULTS: VaccineReminderDefaults = {
  windowDays: 3,
  repeatHours: 5,
  scheduleStart: '09:00',
  scheduleEnd: '22:00',
}

function vaccineInfo(record: {
  vaccineName: string | null
  vaccineDoseNumber: number | null
  vaccineTotalDoses: number | null
}): string {
  const parts = [record.vaccineName || '疫苗']
  if (record.vaccineDoseNumber && record.vaccineTotalDoses) {
    parts.push(`第${record.vaccineDoseNumber}针/共${record.vaccineTotalDoses}针`)
  } else if (record.vaccineDoseNumber) {
    parts.push(`第${record.vaccineDoseNumber}针`)
  }
  return parts.join(' ')
}

export async function syncAutoVaccineReminders(params: {
  userId: string
  babyId: string
  recordedAtValues: Date[]
  db?: VaccineReminderDb
}): Promise<void> {
  const db = params.db ?? prisma
  const dates = [...new Set(params.recordedAtValues.map(getBeijingDateStr))]
  if (dates.length === 0) return

  const user = await db.user.findUnique({
    where: { id: params.userId },
    select: { reminderSettings: true },
  })
  if (!user?.reminderSettings) return

  let settings: { autoVaccineReminder?: boolean; vaccineReminderDefaults?: VaccineReminderDefaults }
  try {
    settings = JSON.parse(user.reminderSettings)
  } catch (error) {
    logError('[Reminder] Invalid vaccine reminder settings', error)
    return
  }
  if (!settings.autoVaccineReminder) return
  const defaults = { ...DEFAULTS, ...settings.vaccineReminderDefaults }

  for (const date of dates) {
    const sourceKey = `auto-vaccine:${date}`
    const { start, end } = getBeijingDayRange(date)
    const records = await db.healthRecord.findMany({
      where: {
        createdBy: params.userId,
        babyId: params.babyId,
        type: 'VACCINE',
        recordedAt: { gte: start, lte: end },
      },
      orderBy: [{ recordedAt: 'asc' }, { id: 'asc' }],
      select: {
        vaccineName: true,
        vaccineDoseNumber: true,
        vaccineTotalDoses: true,
        recordedAt: true,
      },
    })

    const managed = await db.reminderRule.findFirst({
      where: { userId: params.userId, babyId: params.babyId, sourceKey },
    })
    const legacy = managed ? null : await db.reminderRule.findFirst({
      where: {
        userId: params.userId,
        babyId: params.babyId,
        sourceKey: null,
        triggerType: 'event_window',
        name: { startsWith: '疫苗后测体温' },
        createdAt: { gte: start, lte: end },
      },
      orderBy: { createdAt: 'asc' },
    })
    const existing = managed ?? legacy

    if (records.length === 0) {
      if (existing) {
        await db.reminderRule.updateMany({
          where: { id: existing.id, userId: params.userId, babyId: params.babyId },
          data: { enabled: false, nextCheckAt: null, sourceKey },
        })
      }
      await db.reminderRule.updateMany({
        where: {
          userId: params.userId,
          babyId: params.babyId,
          sourceKey: null,
          triggerType: 'event_window',
          name: { startsWith: '疫苗后测体温' },
          createdAt: { gte: start, lte: end },
        },
        data: { enabled: false, nextCheckAt: null },
      })
      continue
    }

    const anchorTime = records[records.length - 1].recordedAt
    const body = records.map(record => vaccineInfo(record)).join('\n')
    const values = {
      userId: params.userId,
      babyId: params.babyId,
      name: records.length === 1
        ? `疫苗后测体温 · ${records[0].vaccineName || '疫苗'}`
        : `疫苗后测体温 · 今日${records.length}针`,
      enabled: true,
      triggerType: 'event_window',
      triggerConfig: JSON.stringify({
        anchorTime: anchorTime.toISOString(),
        windowHours: defaults.windowDays * 24,
        repeatIntervalMinutes: defaults.repeatHours * 60,
      }),
      activeSchedule: JSON.stringify({
        windows: [{ start: defaults.scheduleStart, end: defaults.scheduleEnd }],
      }),
      advanceMinutes: 0,
      notifyTitle: '该给{{babyName}}测体温了',
      notifyBody: `疫苗接种后体温监测 · ${body}`,
      sourceKey,
      lastFiredAt: null,
      nextCheckAt: null,
    }

    if (existing) {
      await db.reminderRule.updateMany({
        where: { id: existing.id, userId: params.userId, babyId: params.babyId },
        data: values,
      })
    } else {
      await db.reminderRule.upsert({
        where: { babyId_sourceKey: { babyId: params.babyId, sourceKey } },
        create: values,
        update: values,
      })
    }
    await db.reminderRule.updateMany({
      where: {
        userId: params.userId,
        babyId: params.babyId,
        sourceKey: null,
        triggerType: 'event_window',
        name: { startsWith: '疫苗后测体温' },
        createdAt: { gte: start, lte: end },
      },
      data: { enabled: false, nextCheckAt: null },
    })
  }
}
