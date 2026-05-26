/**
 * Reminder trigger config validation
 * Shared between POST /api/reminders and PUT /api/reminders/[id]
 */

export function validateTriggerConfig(
  triggerType: string,
  config: Record<string, unknown>
): { valid: boolean; error?: string } {
  switch (triggerType) {
    case 'interval': {
      if (typeof config.sourceType !== 'string' || !['feeding', 'health'].includes(config.sourceType)) {
        return { valid: false, error: 'triggerConfig.sourceType 必须是 feeding 或 health' }
      }
      if (typeof config.intervalMinutes !== 'number' || !Number.isFinite(config.intervalMinutes) || config.intervalMinutes < 1 || config.intervalMinutes > 129600) {
        return { valid: false, error: 'triggerConfig.intervalMinutes 必须是 1-129600 的整数' }
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
