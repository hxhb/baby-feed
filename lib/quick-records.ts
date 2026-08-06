import { FEEDING_TYPES, type FeedingType } from '@/lib/feeding-records'
import { HEALTH_TYPES, type HealthType } from '@/lib/health-records'

export type QuickRecordGroupKey = 'GROUP_FEEDING' | 'GROUP_HEALTH' | 'GROUP_MEMO'
export type QuickRecordKey = QuickRecordGroupKey | FeedingType | HealthType

export const QUICK_RECORD_GROUP_KEYS: readonly QuickRecordGroupKey[] = [
  'GROUP_FEEDING',
  'GROUP_HEALTH',
  'GROUP_MEMO',
]

export const QUICK_RECORD_ITEM_KEYS: readonly (FeedingType | HealthType)[] = [
  ...FEEDING_TYPES,
  ...HEALTH_TYPES,
]

export const QUICK_RECORD_KEYS: readonly QuickRecordKey[] = [
  ...QUICK_RECORD_GROUP_KEYS,
  ...QUICK_RECORD_ITEM_KEYS,
]

export const DEFAULT_QUICK_RECORD_KEYS: readonly QuickRecordKey[] = [
  'BREAST_MILK',
  'FORMULA',
  'GROUP_HEALTH',
  'GROUP_MEMO',
]

const quickRecordKeySet = new Set<string>(QUICK_RECORD_KEYS)

export function isQuickRecordKey(value: unknown): value is QuickRecordKey {
  return typeof value === 'string' && quickRecordKeySet.has(value)
}

export function normalizeQuickRecordKeys(value: unknown): QuickRecordKey[] {
  if (!Array.isArray(value)) return [...DEFAULT_QUICK_RECORD_KEYS]

  const seen = new Set<QuickRecordKey>()
  const keys = value.filter((key): key is QuickRecordKey => {
    if (!isQuickRecordKey(key) || seen.has(key)) return false
    seen.add(key)
    return true
  })

  return keys.length > 0 ? keys : [...DEFAULT_QUICK_RECORD_KEYS]
}

export function parseQuickRecordSettings(value: string | null | undefined): QuickRecordKey[] {
  if (!value) return [...DEFAULT_QUICK_RECORD_KEYS]

  try {
    return normalizeQuickRecordKeys(JSON.parse(value))
  } catch {
    return [...DEFAULT_QUICK_RECORD_KEYS]
  }
}

export function validateQuickRecordKeys(value: unknown): string | null {
  if (!Array.isArray(value)) return '快捷记录格式不正确'
  if (value.length === 0) return '请至少保留一个快捷记录'
  if (value.length > QUICK_RECORD_KEYS.length) return '快捷记录数量超出限制'
  if (value.some(key => !isQuickRecordKey(key))) return '快捷记录中包含不支持的项目'
  if (new Set(value).size !== value.length) return '快捷记录中包含重复项目'
  return null
}
