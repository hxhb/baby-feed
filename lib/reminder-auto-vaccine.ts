/**
 * Auto-create vaccine temperature monitoring reminders
 *
 * When a vaccine health record is created and the user has enabled
 * auto-vaccine reminders, this module creates an event_window rule
 * with deduplication (won't create duplicates on same day for same baby).
 */

import { prisma } from './prisma'
import { logError } from './logger'

interface VaccineRecord {
  id: string
  babyId: string
  vaccineName: string | null
  vaccineManufacturer: string | null
  vaccineDoseNumber: number | null
  vaccineTotalDoses: number | null
  recordedAt: Date
}

/**
 * Auto-create a vaccine monitoring reminder rule if:
 * 1. User has autoVaccineReminder enabled in their config
 * 2. No existing event_window rule was created today for this baby
 *
 * If a rule already exists today, append the new vaccine info to it.
 */
export async function autoCreateVaccineReminder(
  userId: string,
  record: VaccineRecord,
  babyName: string
): Promise<void> {
  try {
    // 1. Check user config
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { reminderSettings: true },
    })
    if (!user?.reminderSettings) return

    const settings = JSON.parse(user.reminderSettings)
    if (!settings.autoVaccineReminder) return

    const defaults = settings.vaccineReminderDefaults || {
      windowDays: 3,
      repeatHours: 5,
      scheduleStart: '09:00',
      scheduleEnd: '22:00',
    }

    // 2. Build vaccine info string
    const vaccineInfo = buildVaccineInfo(record)

    // 3. Dedup check: look for an event_window rule created today for same baby
    const todayStart = getTodayBeijingStart()

    const existingRule = await prisma.reminderRule.findFirst({
      where: {
        userId,
        babyId: record.babyId,
        triggerType: 'event_window',
        name: { startsWith: '疫苗后测体温' },
        enabled: true,
        createdAt: { gte: todayStart },
      },
    })

    if (existingRule) {
      // Update existing rule: append new vaccine info to notifyBody
      const currentBody = existingRule.notifyBody || ''
      const updatedBody = currentBody
        ? `${currentBody}\n${vaccineInfo}`
        : `疫苗接种后体温监测 · ${vaccineInfo}`

      // Update name to reflect multiple vaccines
      const updatedName = `疫苗后测体温 · 今日${await countTodayVaccines(userId, record.babyId, todayStart)}针`

      await prisma.reminderRule.update({
        where: { id: existingRule.id },
        data: {
          name: updatedName,
          notifyBody: updatedBody,
        },
      })
      return
    }

    // 4. Create new rule
    await prisma.reminderRule.create({
      data: {
        userId,
        babyId: record.babyId,
        name: `疫苗后测体温 · ${record.vaccineName || '疫苗'}`,
        enabled: true,
        triggerType: 'event_window',
        triggerConfig: JSON.stringify({
          anchorTime: record.recordedAt.toISOString(),
          windowHours: defaults.windowDays * 24,
          repeatIntervalMinutes: defaults.repeatHours * 60,
        }),
        activeSchedule: JSON.stringify({
          windows: [{ start: defaults.scheduleStart, end: defaults.scheduleEnd }],
        }),
        advanceMinutes: 0,
        notifyTitle: '该给{{babyName}}测体温了',
        notifyBody: `疫苗接种后体温监测 · ${vaccineInfo}`,
      },
    })
  } catch (error) {
    logError('[Reminder] autoCreateVaccineReminder failed', error)
  }
}

function buildVaccineInfo(record: VaccineRecord): string {
  const parts: string[] = []
  if (record.vaccineName) parts.push(record.vaccineName)
  if (record.vaccineDoseNumber && record.vaccineTotalDoses) {
    parts.push(`第${record.vaccineDoseNumber}针/共${record.vaccineTotalDoses}针`)
  } else if (record.vaccineDoseNumber) {
    parts.push(`第${record.vaccineDoseNumber}针`)
  }
  return parts.join(' ') || '疫苗接种'
}

function getTodayBeijingStart(): Date {
  const now = new Date()
  const beijingMs = now.getTime() + 8 * 60 * 60 * 1000
  const beijingDate = new Date(beijingMs)
  const year = beijingDate.getUTCFullYear()
  const month = beijingDate.getUTCMonth()
  const day = beijingDate.getUTCDate()
  // Beijing 00:00:00 = UTC 前一天 16:00:00
  return new Date(Date.UTC(year, month, day) - 8 * 60 * 60 * 1000)
}

async function countTodayVaccines(userId: string, babyId: string, todayStart: Date): Promise<number> {
  return prisma.healthRecord.count({
    where: {
      createdBy: userId,
      babyId,
      type: 'VACCINE',
      createdAt: { gte: todayStart },
    },
  })
}
