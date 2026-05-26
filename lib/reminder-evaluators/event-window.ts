import { prisma } from '@/lib/prisma'
import type { RuleEvaluator, ReminderRuleForEval, EvaluateResult } from './index'

interface EventWindowTriggerConfig {
  anchorTime: string
  windowHours: number
  repeatIntervalMinutes: number
}

export const eventWindowEvaluator: RuleEvaluator = {
  async evaluate(rule: ReminderRuleForEval, now: Date): Promise<EvaluateResult> {
    const config: EventWindowTriggerConfig = JSON.parse(rule.triggerConfig)
    const anchor = new Date(config.anchorTime)
    const windowEndMs = anchor.getTime() + config.windowHours * 60 * 60 * 1000

    // Window expired — auto-disable rule
    if (now.getTime() > windowEndMs) {
      await prisma.reminderRule.update({
        where: { id: rule.id },
        data: { enabled: false },
      })
      return { shouldFire: false }
    }

    const advancedNow = new Date(now.getTime() + rule.advanceMinutes * 60 * 1000)
    const elapsedSinceAnchor = advancedNow.getTime() - anchor.getTime()
    const intervalMs = Math.max(config.repeatIntervalMinutes, 1) * 60 * 1000
    const currentSlot = Math.floor(elapsedSinceAnchor / intervalMs)

    if (rule.lastFiredAt) {
      const lastElapsed = rule.lastFiredAt.getTime() - anchor.getTime()
      const lastSlot = Math.floor(lastElapsed / intervalMs)
      if (currentSlot > lastSlot) {
        return {
          shouldFire: true,
          context: { slot: currentSlot, windowEnd: new Date(windowEndMs).toISOString() },
        }
      }
      return { shouldFire: false }
    } else {
      // First fire — only after first full interval
      if (currentSlot >= 1) {
        return {
          shouldFire: true,
          context: { slot: currentSlot, windowEnd: new Date(windowEndMs).toISOString() },
        }
      }
      return { shouldFire: false }
    }
  },
}
