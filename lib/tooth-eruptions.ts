export const PRIMARY_TOOTH_CODES = [
  '55', '54', '53', '52', '51',
  '61', '62', '63', '64', '65',
  '75', '74', '73', '72', '71',
  '81', '82', '83', '84', '85',
] as const

export type PrimaryToothCode = typeof PRIMARY_TOOTH_CODES[number]
export type ToothJaw = 'UPPER' | 'LOWER'
export type ToothSide = 'LEFT' | 'RIGHT'

export interface ToothDefinition {
  code: PrimaryToothCode
  name: string
  shortName: string
  jaw: ToothJaw
  side: ToothSide
  position: 'CENTRAL_INCISOR' | 'LATERAL_INCISOR' | 'CANINE' | 'FIRST_MOLAR' | 'SECOND_MOLAR'
}

const POSITION_NAMES = {
  CENTRAL_INCISOR: '门牙',
  LATERAL_INCISOR: '侧门牙',
  CANINE: '尖牙',
  FIRST_MOLAR: '第一乳磨牙',
  SECOND_MOLAR: '第二乳磨牙',
} as const

function defineTooth(
  code: PrimaryToothCode,
  jaw: ToothJaw,
  side: ToothSide,
  position: ToothDefinition['position'],
): ToothDefinition {
  const jawName = jaw === 'UPPER' ? '上' : '下'
  const sideName = side === 'LEFT' ? '左' : '右'
  const positionName = POSITION_NAMES[position]
  return {
    code,
    jaw,
    side,
    position,
    name: `${sideName}${jawName}${positionName}`,
    shortName: `${sideName}${jawName}${positionName}`,
  }
}

export const PRIMARY_TEETH: readonly ToothDefinition[] = [
  defineTooth('55', 'UPPER', 'RIGHT', 'SECOND_MOLAR'),
  defineTooth('54', 'UPPER', 'RIGHT', 'FIRST_MOLAR'),
  defineTooth('53', 'UPPER', 'RIGHT', 'CANINE'),
  defineTooth('52', 'UPPER', 'RIGHT', 'LATERAL_INCISOR'),
  defineTooth('51', 'UPPER', 'RIGHT', 'CENTRAL_INCISOR'),
  defineTooth('61', 'UPPER', 'LEFT', 'CENTRAL_INCISOR'),
  defineTooth('62', 'UPPER', 'LEFT', 'LATERAL_INCISOR'),
  defineTooth('63', 'UPPER', 'LEFT', 'CANINE'),
  defineTooth('64', 'UPPER', 'LEFT', 'FIRST_MOLAR'),
  defineTooth('65', 'UPPER', 'LEFT', 'SECOND_MOLAR'),
  defineTooth('75', 'LOWER', 'LEFT', 'SECOND_MOLAR'),
  defineTooth('74', 'LOWER', 'LEFT', 'FIRST_MOLAR'),
  defineTooth('73', 'LOWER', 'LEFT', 'CANINE'),
  defineTooth('72', 'LOWER', 'LEFT', 'LATERAL_INCISOR'),
  defineTooth('71', 'LOWER', 'LEFT', 'CENTRAL_INCISOR'),
  defineTooth('81', 'LOWER', 'RIGHT', 'CENTRAL_INCISOR'),
  defineTooth('82', 'LOWER', 'RIGHT', 'LATERAL_INCISOR'),
  defineTooth('83', 'LOWER', 'RIGHT', 'CANINE'),
  defineTooth('84', 'LOWER', 'RIGHT', 'FIRST_MOLAR'),
  defineTooth('85', 'LOWER', 'RIGHT', 'SECOND_MOLAR'),
]

const primaryToothCodeSet = new Set<string>(PRIMARY_TOOTH_CODES)
const toothByCode = new Map(PRIMARY_TEETH.map(tooth => [tooth.code, tooth]))

export function isPrimaryToothCode(value: unknown): value is PrimaryToothCode {
  return typeof value === 'string' && primaryToothCodeSet.has(value)
}

export function getPrimaryToothCodesValidationError(value: unknown): string | null {
  if (value === undefined || value === null) return null
  if (!Array.isArray(value)) return '牙位必须是数组'
  if (value.length < 1 || value.length > PRIMARY_TOOTH_CODES.length) {
    return `请选择 1 到 ${PRIMARY_TOOTH_CODES.length} 颗乳牙`
  }
  if (!value.every(isPrimaryToothCode)) return '牙位中包含无效的乳牙编号'
  if (new Set(value).size !== value.length) return '牙位不能重复选择'
  return null
}

export function getToothDefinition(code: string) {
  return toothByCode.get(code as PrimaryToothCode)
}

export function formatToothNames(codes: readonly string[]) {
  return codes
    .map(code => getToothDefinition(code)?.name ?? code)
    .join('、')
}

export interface ToothEruptionEventLike {
  id: string
  recordedAt: string | Date
  createdAt?: string | Date | null
  toothEruptions: readonly { toothCode: string }[]
}

export interface OrderedToothEruptionEvent<T extends ToothEruptionEventLike> {
  event: T
  orderStart: number
  orderEnd: number
}

function timeValue(value: string | Date | null | undefined) {
  if (!value) return 0
  const result = new Date(value).getTime()
  return Number.isFinite(result) ? result : 0
}

export function buildOrderedToothEruptionEvents<T extends ToothEruptionEventLike>(
  events: readonly T[],
): OrderedToothEruptionEvent<T>[] {
  let eruptedCount = 0
  return [...events]
    .filter(event => event.toothEruptions.length > 0)
    .sort((left, right) => {
      return timeValue(left.recordedAt) - timeValue(right.recordedAt)
        || timeValue(left.createdAt) - timeValue(right.createdAt)
        || left.id.localeCompare(right.id)
    })
    .map(event => {
      const orderStart = eruptedCount + 1
      eruptedCount += event.toothEruptions.length
      return { event, orderStart, orderEnd: eruptedCount }
    })
}

export function formatEruptionOrder(orderStart: number, orderEnd: number) {
  return orderStart === orderEnd
    ? `第 ${orderStart} 颗`
    : `第 ${orderStart}-${orderEnd} 颗（同时）`
}
