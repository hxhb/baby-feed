/**
 * Reminder trigger config validation
 * Shared between POST /api/reminders and PUT /api/reminders/[id]
 */

import { FEEDING_TYPES, HEALTH_TYPES } from '@/lib/validation'

const SOURCE_TYPES = {
  feeding: new Set<string>(FEEDING_TYPES),
  health: new Set<string>(HEALTH_TYPES),
}

export function validateTriggerConfig(
  triggerType: string,
  config: Record<string, unknown>
): { valid: boolean; error?: string } {
  switch (triggerType) {
    case 'interval': {
      if (typeof config.sourceType !== 'string' || !['feeding', 'health'].includes(config.sourceType)) {
        return { valid: false, error: 'triggerConfig.sourceType 必须是 feeding 或 health' }
      }
      if (typeof config.intervalMinutes !== 'number' || !Number.isInteger(config.intervalMinutes) || config.intervalMinutes < 1 || config.intervalMinutes > 129600) {
        return { valid: false, error: 'triggerConfig.intervalMinutes 必须是 1-129600 的整数' }
      }
      if (config.filterCondition !== undefined) {
        if (!config.filterCondition || typeof config.filterCondition !== 'object' || Array.isArray(config.filterCondition)) {
          return { valid: false, error: 'triggerConfig.filterCondition 必须是对象' }
        }
        const types = (config.filterCondition as Record<string, unknown>).type
        if (types !== undefined) {
          if (!Array.isArray(types) || types.length === 0 || types.some(type => typeof type !== 'string')) {
            return { valid: false, error: 'triggerConfig.filterCondition.type 必须是非空字符串数组' }
          }
          const allowed = SOURCE_TYPES[config.sourceType as 'feeding' | 'health']
          if (new Set(types).size !== types.length || types.some(type => !allowed.has(type as string))) {
            return { valid: false, error: 'triggerConfig.filterCondition.type 包含重复或无效类型' }
          }
        }
      }
      return { valid: true }
    }
    case 'cron': {
      if (typeof config.cronExpr !== 'string') {
        return { valid: false, error: 'triggerConfig.cronExpr 必须是字符串' }
      }
      const fields = config.cronExpr.trim().split(/\s+/)
      if (fields.length !== 5) {
        return { valid: false, error: 'triggerConfig.cronExpr 必须是有效的5段cron表达式' }
      }
      if (/\/0(?:\D|$)/.test(config.cronExpr)) {
        return { valid: false, error: 'cron 步进值不能为 0' }
      }
      // Reject * * * * * (fires every minute — almost certainly user error)
      if (config.cronExpr.trim() === '* * * * *') {
        return { valid: false, error: '不允许每分钟触发的 cron 表达式' }
      }
      return { valid: true }
    }
    case 'event_window': {
      if (typeof config.anchorTime !== 'string' || isNaN(new Date(config.anchorTime).getTime())) {
        return { valid: false, error: 'triggerConfig.anchorTime 必须是有效的日期时间' }
      }
      if (typeof config.windowHours !== 'number' || !Number.isFinite(config.windowHours) || config.windowHours < 0.1 || config.windowHours > 720) {
        return { valid: false, error: 'triggerConfig.windowHours 必须在 0.1-720 之间' }
      }
      if (typeof config.repeatIntervalMinutes !== 'number' || !Number.isFinite(config.repeatIntervalMinutes) || config.repeatIntervalMinutes < 1 || config.repeatIntervalMinutes > 14400) {
        return { valid: false, error: 'triggerConfig.repeatIntervalMinutes 必须在 1-14400 之间' }
      }
      return { valid: true }
    }
    default:
      return { valid: false, error: '无效的触发器类型' }
  }
}

export function validateActiveSchedule(value: unknown): { valid: boolean; error?: string } {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { valid: false, error: 'activeSchedule 必须是对象' }
  }
  const windows = (value as Record<string, unknown>).windows
  if (!Array.isArray(windows) || windows.length > 10) {
    return { valid: false, error: 'activeSchedule.windows 必须是最多10项的数组' }
  }
  const hhmm = /^(?:[01]\d|2[0-3]):[0-5]\d$/
  for (const window of windows) {
    if (!window || typeof window !== 'object' || Array.isArray(window)) {
      return { valid: false, error: 'activeSchedule 时间窗口格式不正确' }
    }
    const item = window as Record<string, unknown>
    if (typeof item.start !== 'string' || typeof item.end !== 'string' || !hhmm.test(item.start) || !hhmm.test(item.end)) {
      return { valid: false, error: 'activeSchedule 时间必须使用 HH:mm 格式' }
    }
  }
  return { valid: true }
}
