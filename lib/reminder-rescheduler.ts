import type { Prisma } from '@/app/generated/prisma/client'
import { prisma } from '@/lib/prisma'
import {
  computeIntervalTiming,
  parseIntervalConfig,
  recordTypeMatches,
  type IntervalTriggerConfig,
} from '@/lib/reminder-core'

type ReminderDb = Pick<
  Prisma.TransactionClient,
  'reminderRule' | 'feedingRecord' | 'healthRecord'
>

export interface IntervalRuleSnapshot {
  id: string
  userId: string
  babyId: string
  triggerConfig: string
  advanceMinutes: number
}

export interface IntervalSourceSnapshot {
  sourceRecordId: string | null
  sourceRecordTime: Date | null
  sourceRecordType: string | null
  ongoing: boolean
}

export interface RecordChangeDescriptor {
  type: string
}

function whereForTypes(config: IntervalTriggerConfig): { in: string[] } | undefined {
  const types = config.filterCondition?.type
  return types && types.length > 0 ? { in: types } : undefined
}

export async function getIntervalSourceSnapshot(
  rule: IntervalRuleSnapshot,
  db: ReminderDb = prisma,
): Promise<IntervalSourceSnapshot> {
  const config = parseIntervalConfig(rule.triggerConfig)
  if (!config) {
    return { sourceRecordId: null, sourceRecordTime: null, sourceRecordType: null, ongoing: false }
  }

  const type = whereForTypes(config)

  if (config.sourceType === 'feeding') {
    const record = await db.feedingRecord.findFirst({
      where: { babyId: rule.babyId, createdBy: rule.userId, ...(type ? { type } : {}) },
      orderBy: [{ startTime: 'desc' }, { id: 'desc' }],
      select: { id: true, type: true, startTime: true },
    })
    return {
      sourceRecordId: record?.id ?? null,
      sourceRecordTime: record?.startTime ?? null,
      sourceRecordType: record?.type ?? null,
      ongoing: false,
    }
  }

  const isSleepOnly = config.filterCondition?.type?.length === 1 && config.filterCondition.type[0] === 'SLEEP'
  if (isSleepOnly) {
    const ongoing = await db.healthRecord.findFirst({
      where: { babyId: rule.babyId, createdBy: rule.userId, type: 'SLEEP', sleepEndTime: null },
      orderBy: [{ sleepStartTime: 'desc' }, { id: 'desc' }],
      select: { id: true, type: true, sleepStartTime: true, recordedAt: true },
    })
    if (ongoing) {
      return {
        sourceRecordId: ongoing.id,
        sourceRecordTime: ongoing.sleepStartTime ?? ongoing.recordedAt,
        sourceRecordType: ongoing.type,
        ongoing: true,
      }
    }

    const completed = await db.healthRecord.findFirst({
      where: { babyId: rule.babyId, createdBy: rule.userId, type: 'SLEEP', sleepEndTime: { not: null } },
      orderBy: [{ sleepEndTime: 'desc' }, { id: 'desc' }],
      select: { id: true, type: true, sleepEndTime: true },
    })
    return {
      sourceRecordId: completed?.id ?? null,
      sourceRecordTime: completed?.sleepEndTime ?? null,
      sourceRecordType: completed?.type ?? null,
      ongoing: false,
    }
  }

  const record = await db.healthRecord.findFirst({
    where: { babyId: rule.babyId, createdBy: rule.userId, ...(type ? { type } : {}) },
    orderBy: [{ recordedAt: 'desc' }, { id: 'desc' }],
    select: { id: true, type: true, recordedAt: true },
  })
  return {
    sourceRecordId: record?.id ?? null,
    sourceRecordTime: record?.recordedAt ?? null,
    sourceRecordType: record?.type ?? null,
    ongoing: false,
  }
}

export async function rescheduleIntervalRulesForRecordChange(params: {
  userId: string
  babyId: string
  sourceType: 'feeding' | 'health'
  oldRecord?: RecordChangeDescriptor | null
  newRecord?: RecordChangeDescriptor | null
  db?: ReminderDb
  now?: Date
}): Promise<void> {
  const db = params.db ?? prisma
  const now = params.now ?? new Date()
  const rules = await db.reminderRule.findMany({
    where: {
      userId: params.userId,
      babyId: params.babyId,
      enabled: true,
      triggerType: 'interval',
    },
    select: { id: true, userId: true, babyId: true, triggerConfig: true, advanceMinutes: true },
  })

  for (const rule of rules) {
    const config = parseIntervalConfig(rule.triggerConfig)
    if (!config || config.sourceType !== params.sourceType) continue

    const oldMatches = params.oldRecord ? recordTypeMatches(config, params.oldRecord.type) : false
    const newMatches = params.newRecord ? recordTypeMatches(config, params.newRecord.type) : false
    if (!oldMatches && !newMatches) continue

    const snapshot = await getIntervalSourceSnapshot(rule, db)
    let nextCheckAt: Date | null = null
    if (snapshot.ongoing) {
      nextCheckAt = new Date(now.getTime() + 60_000)
    } else if (snapshot.sourceRecordTime) {
      const timing = computeIntervalTiming(
        snapshot.sourceRecordTime,
        now,
        config.intervalMinutes,
        rule.advanceMinutes,
      )
      nextCheckAt = timing.shouldFire ? now : timing.nextCheckAt
    }

    await db.reminderRule.updateMany({
      where: { id: rule.id, userId: params.userId, babyId: params.babyId },
      data: { nextCheckAt },
    })
  }
}
