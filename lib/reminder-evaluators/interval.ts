import { prisma } from '@/lib/prisma'
import type { RuleEvaluator, ReminderRuleForEval, EvaluateResult } from './index'

interface IntervalTriggerConfig {
  sourceType: 'feeding' | 'health'
  intervalMinutes: number
  filterCondition?: {
    type?: string[]
    [key: string]: unknown
  }
}

export const intervalEvaluator: RuleEvaluator = {
  async evaluate(rule: ReminderRuleForEval, now: Date): Promise<EvaluateResult> {
    const config: IntervalTriggerConfig = JSON.parse(rule.triggerConfig)
    const advancedNow = new Date(now.getTime() + rule.advanceMinutes * 60 * 1000)

    let lastRecordTime: Date | null = null

    if (config.sourceType === 'feeding') {
      const where: Record<string, unknown> = { babyId: rule.babyId }
      if (config.filterCondition?.type) {
        where.type = { in: config.filterCondition.type }
      }
      const record = await prisma.feedingRecord.findFirst({
        where,
        orderBy: { startTime: 'desc' },
        select: { startTime: true },
      })
      lastRecordTime = record?.startTime ?? null
    } else if (config.sourceType === 'health') {
      const where: Record<string, unknown> = { babyId: rule.babyId }
      if (config.filterCondition?.type) {
        where.type = { in: config.filterCondition.type }
      }
      const record = await prisma.healthRecord.findFirst({
        where,
        orderBy: { recordedAt: 'desc' },
        select: { recordedAt: true },
      })
      lastRecordTime = record?.recordedAt ?? null
    } else {
      return { shouldFire: false }
    }

    if (!lastRecordTime) {
      return { shouldFire: true, context: { elapsedMinutes: null, lastRecordTime: null } }
    }

    const elapsedMs = advancedNow.getTime() - lastRecordTime.getTime()
    const elapsedMinutes = Math.floor(elapsedMs / 60000)
    const shouldFire = elapsedMinutes >= config.intervalMinutes

    // Prevent re-firing within same interval
    if (shouldFire && rule.lastFiredAt) {
      const timeSinceLastFire = now.getTime() - rule.lastFiredAt.getTime()
      if (timeSinceLastFire < config.intervalMinutes * 60 * 1000) {
        console.log(
          `[IntervalEvaluator] rule=${rule.id} suppressed — ` +
          `fired ${Math.floor(timeSinceLastFire / 60000)}min ago, ` +
          `interval=${config.intervalMinutes}min`
        )
        return { shouldFire: false }
      }
    }

    console.log(
      `[IntervalEvaluator] rule=${rule.id} sourceType=${config.sourceType} ` +
      `lastRecord=${lastRecordTime.toISOString()} ` +
      `elapsed=${elapsedMinutes}min interval=${config.intervalMinutes}min ` +
      `shouldFire=${shouldFire}`
    )

    return {
      shouldFire,
      context: { elapsedMinutes, lastRecordTime: lastRecordTime.toISOString() },
    }
  },
}
