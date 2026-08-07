import type { RuleEvaluator, ReminderRuleForEval, EvaluateResult } from './index'
import { buildIntervalFireKey, computeIntervalTiming, parseIntervalConfig } from '@/lib/reminder-core'
import { getIntervalSourceSnapshot } from '@/lib/reminder-rescheduler'

export const intervalEvaluator: RuleEvaluator = {
  async evaluate(rule: ReminderRuleForEval, now: Date): Promise<EvaluateResult> {
    const config = parseIntervalConfig(rule.triggerConfig)
    if (!config) {
      return { shouldFire: false }
    }

    const snapshot = await getIntervalSourceSnapshot(rule)
    if (snapshot.ongoing) {
      return {
        shouldFire: false,
        nextCheckAt: new Date(now.getTime() + 60_000),
        context: {
          sourceRecordId: snapshot.sourceRecordId,
          lastRecordTime: snapshot.sourceRecordTime?.toISOString() ?? null,
          ongoing: true,
        },
      }
    }

    if (!snapshot.sourceRecordTime) {
      const intervalMs = config.intervalMinutes * 60_000
      const slot = Math.floor((now.getTime() + rule.advanceMinutes * 60_000) / intervalMs)
      return {
        shouldFire: true,
        fireKey: buildIntervalFireKey(null, slot),
        nextCheckAt: new Date(now.getTime() + intervalMs),
        context: {
          elapsedMinutes: null,
          lastRecordTime: null,
          sourceRecordId: null,
          sourceRecordType: null,
        },
      }
    }

    const timing = computeIntervalTiming(
      snapshot.sourceRecordTime,
      now,
      config.intervalMinutes,
      rule.advanceMinutes,
    )

    console.log(
      `[IntervalEvaluator] rule=${rule.id} sourceType=${config.sourceType} ` +
      `lastRecord=${snapshot.sourceRecordTime.toISOString()} ` +
      `elapsed=${timing.elapsedMinutes}min interval=${config.intervalMinutes}min ` +
      `shouldFire=${timing.shouldFire}`
    )

    return {
      shouldFire: timing.shouldFire,
      fireKey: timing.shouldFire ? buildIntervalFireKey(snapshot.sourceRecordId, timing.slot) : undefined,
      nextCheckAt: timing.nextCheckAt,
      context: {
        elapsedMinutes: timing.elapsedMinutes,
        lastRecordTime: snapshot.sourceRecordTime.toISOString(),
        sourceRecordId: snapshot.sourceRecordId,
        sourceRecordType: snapshot.sourceRecordType,
        dueAt: timing.dueAt.toISOString(),
        slot: timing.slot,
      },
    }
  },
}
