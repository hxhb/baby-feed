import { cronMatchesDate } from '@/lib/cron-parser'
import type { RuleEvaluator, ReminderRuleForEval, EvaluateResult } from './index'

interface CronTriggerConfig {
  cronExpr: string
}

export const cronEvaluator: RuleEvaluator = {
  async evaluate(rule: ReminderRuleForEval, now: Date): Promise<EvaluateResult> {
    const config: CronTriggerConfig = JSON.parse(rule.triggerConfig)

    const advancedNow = new Date(now.getTime() + rule.advanceMinutes * 60 * 1000)

    // Convert to Beijing time (UTC+8) using UTC getters on shifted timestamp
    const beijingMs = advancedNow.getTime() + 8 * 60 * 60 * 1000
    const bj = new Date(beijingMs)

    if (cronMatchesDate(config.cronExpr, bj)) {
      // Prevent duplicate fire in same minute
      if (rule.lastFiredAt) {
        const lastFireMinute = Math.floor(rule.lastFiredAt.getTime() / 60000)
        const currentMinute = Math.floor(now.getTime() / 60000)
        if (lastFireMinute === currentMinute) {
          return { shouldFire: false }
        }
      }
      return { shouldFire: true, context: { cronExpr: config.cronExpr } }
    }

    return { shouldFire: false }
  },
}
