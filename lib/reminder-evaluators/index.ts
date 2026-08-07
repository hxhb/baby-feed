/**
 * Evaluator Registry
 * Maps triggerType strings to their evaluator implementations.
 */

import { intervalEvaluator } from './interval'
import { cronEvaluator } from './cron'
import { eventWindowEvaluator } from './event-window'

export interface EvaluateResult {
  shouldFire: boolean
  context?: Record<string, unknown>
  fireKey?: string
  nextCheckAt?: Date
  disableRule?: boolean
}

export interface ReminderRuleForEval {
  id: string
  userId: string
  babyId: string
  triggerType: string
  triggerConfig: string
  advanceMinutes: number
  lastFiredAt: Date | null
}

export interface RuleEvaluator {
  evaluate(rule: ReminderRuleForEval, now: Date): Promise<EvaluateResult>
}

const evaluators: Record<string, RuleEvaluator> = {
  interval: intervalEvaluator,
  cron: cronEvaluator,
  event_window: eventWindowEvaluator,
}

export function getEvaluator(triggerType: string): RuleEvaluator | undefined {
  return evaluators[triggerType]
}
