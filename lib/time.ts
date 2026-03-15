/**
 * 北京时间（UTC+8）工具函数
 * 确保所有时间显示和处理都基于 UTC+8，不依赖系统时区
 */

const BEIJING_OFFSET = 8 * 60 * 60 * 1000 // UTC+8 毫秒偏移

/**
 * 将任意 Date 对象转换为北京时间的 Date（通过加偏移）
 * 注意：返回的 Date 的 getUTCXxx() 方法返回的是北京时间的值
 */
function toBeijingDate(date: Date): Date {
  return new Date(date.getTime() + BEIJING_OFFSET)
}

/**
 * 格式化时间为北京时间的 HH:mm
 * @param isoString ISO 时间字符串（如 "2026-03-13T19:54:00.000Z"）
 * @returns 北京时间的 "HH:mm"（如 "03:54"）
 */
export function formatBeijingTime(isoString: string): string {
  const bj = toBeijingDate(new Date(isoString))
  const h = String(bj.getUTCHours()).padStart(2, '0')
  const m = String(bj.getUTCMinutes()).padStart(2, '0')
  return `${h}:${m}`
}

/**
 * 格式化时间为北京时间的 HH:mm:ss
 */
export function formatBeijingTimeWithSeconds(isoString: string): string {
  const bj = toBeijingDate(new Date(isoString))
  const h = String(bj.getUTCHours()).padStart(2, '0')
  const m = String(bj.getUTCMinutes()).padStart(2, '0')
  const s = String(bj.getUTCSeconds()).padStart(2, '0')
  return `${h}:${m}:${s}`
}

/**
 * 获取当前北京时间的 yyyy-MM-dd 字符串
 */
export function getBeijingToday(): string {
  const bj = toBeijingDate(new Date())
  const y = bj.getUTCFullYear()
  const m = String(bj.getUTCMonth() + 1).padStart(2, '0')
  const d = String(bj.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/**
 * 获取当前北京时间的 yyyy-MM-dd'T'HH:mm 字符串（用于 datetime-local 控件）
 */
export function getBeijingNow(): string {
  const bj = toBeijingDate(new Date())
  const y = bj.getUTCFullYear()
  const mo = String(bj.getUTCMonth() + 1).padStart(2, '0')
  const d = String(bj.getUTCDate()).padStart(2, '0')
  const h = String(bj.getUTCHours()).padStart(2, '0')
  const mi = String(bj.getUTCMinutes()).padStart(2, '0')
  return `${y}-${mo}-${d}T${h}:${mi}`
}

/**
 * 将 datetime-local 的值转为带时区的 ISO 字符串
 * @param localValue 如 "2026-03-14T03:54" 或 "2026-03-14T03:54:00"
 * @returns "2026-03-14T03:54:00+08:00"
 */
export function toBeijingISO(localValue: string): string {
  // datetime-local 可能返回 "YYYY-MM-DDTHH:MM" 或 "YYYY-MM-DDTHH:MM:SS"
  // 统一处理：先去掉可能存在的秒数部分，再附加 :00+08:00
  const parts = localValue.split('T')
  if (parts.length !== 2) return `${localValue}:00+08:00`
  const timeParts = parts[1].split(':')
  // 只取时和分，忽略可能存在的秒
  const normalizedTime = `${timeParts[0]}:${timeParts[1]}`
  return `${parts[0]}T${normalizedTime}:00+08:00`
}

/**
 * 从可能是完整 ISO 字符串或纯日期字符串中提取纯日期部分 yyyy-MM-dd
 * @param dateValue 如 "2026-01-01T00:00:00.000Z" 或 "2026-01-01"
 * @returns "2026-01-01"
 */
export function extractDateStr(dateValue: string): string {
  if (!dateValue) return ''
  // 如果包含 T，取 T 前面的部分
  return dateValue.includes('T') ? dateValue.split('T')[0] : dateValue
}

/**
 * 将日期值安全地解析为北京时间 Date（无论输入是 ISO 字符串还是纯日期）
 * @param dateValue 如 "2026-01-01T00:00:00.000Z" 或 "2026-01-01"
 * @returns Date 对象
 */
export function parseDateAsBeijing(dateValue: string): Date {
  const dateStr = extractDateStr(dateValue)
  return new Date(`${dateStr}T00:00:00+08:00`)
}

/**
 * 获取北京时间的小时数 (0-23)
 * @param isoString ISO 时间字符串
 * @returns 北京时间小时数
 */
export function getBeijingHour(isoString: string): number {
  const bj = toBeijingDate(new Date(isoString))
  return bj.getUTCHours()
}

/**
 * 将 ISO 时间字符串转换为 datetime-local 格式的北京时间字符串
 * @param isoString ISO 时间字符串（如 "2026-03-13T19:54:00.000Z"）
 * @returns "2026-03-14T03:54" 格式的字符串
 */
export function toBeijingDatetimeLocal(isoString: string): string {
  const bj = toBeijingDate(new Date(isoString))
  const y = bj.getUTCFullYear()
  const mo = String(bj.getUTCMonth() + 1).padStart(2, '0')
  const d = String(bj.getUTCDate()).padStart(2, '0')
  const h = String(bj.getUTCHours()).padStart(2, '0')
  const mi = String(bj.getUTCMinutes()).padStart(2, '0')
  return `${y}-${mo}-${d}T${h}:${mi}`
}
