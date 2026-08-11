import type { LucideIcon } from 'lucide-react'
import {
  Baby,
  CalendarCheck,
  Droplets,
  FilePenLine,
  Milk,
  Moon,
  Pill,
  Ruler,
  Scale,
  SmilePlus,
  Syringe,
  Thermometer,
  UtensilsCrossed,
} from 'lucide-react'
import type { FeedingType } from '@/lib/feeding-records'
import type { DiaperType, HealthType } from '@/lib/health-records'
import type { QuickRecordKey } from '@/lib/quick-records'
import type { PrimaryToothCode } from '@/lib/tooth-eruptions'

export type ComposerRecordType = FeedingType | HealthType | 'MEMO'
export type ComposerRecordKind = 'feeding' | 'health' | 'memo'

export interface BabyOption {
  id: string
  name: string
}

export interface ComposerDraft {
  babyId: string
  eventTime: string
  notes: string
  leftBreastDuration: string
  rightBreastDuration: string
  breastMilkAmount: string
  formulaAmount: string
  solidFoodName: string
  solidFoodAmount: string
  weight: string
  height: string
  temperature: string
  medicationName: string
  medicationDose: string
  vaccineName: string
  vaccineManufacturer: string
  vaccineDoseNumber: string
  vaccineTotalDoses: string
  diaperType: DiaperType
  diaperStatus: string
  adGiven: boolean
  vitaminDGiven: boolean
  customName: string
  sleepStartTime: string
  sleepEndTime: string
  sleepQuality: string
  toothCodes: PrimaryToothCode[]
  memoTitle: string
  memoContent: string
  dirty: boolean
}

export type DraftPatch = Partial<Omit<ComposerDraft, 'dirty'>>

export interface SavedRecord {
  id: string
  kind: ComposerRecordKind
  babyId: string
  summary: string
}

export type ActiveRecordTimer =
  | {
      kind: 'breast'
      babyId: string
      side: 'left' | 'right'
      startedAt: number
      leftSeconds: number
      rightSeconds: number
    }
  | {
      kind: 'sleep'
      babyId: string
      startedAt: number
    }

export interface RecordTypeMeta {
  type: ComposerRecordType
  label: string
  description: string
  icon: LucideIcon
  tone: 'pink' | 'blue' | 'amber' | 'violet' | 'orange' | 'emerald' | 'red' | 'teal' | 'indigo'
}

export interface RecordTypeGroup {
  label: string
  types: RecordTypeMeta[]
}

export interface QuickRecordMeta extends Omit<RecordTypeMeta, 'type'> {
  key: QuickRecordKey
  kind: 'group' | 'record'
}

export const recordTypeGroups: RecordTypeGroup[] = [
  {
    label: '喂养',
    types: [
      { type: 'BREAST_MILK', label: '亲喂', description: '左右侧计时或补记时长', icon: Droplets, tone: 'pink' },
      { type: 'BREAST_MILK_BOTTLE', label: '瓶喂', description: '记录瓶喂母乳量', icon: Milk, tone: 'pink' },
      { type: 'FORMULA', label: '奶粉', description: '记录本次配方奶量', icon: Milk, tone: 'blue' },
      { type: 'SOLID_FOOD', label: '辅食', description: '记录食物和份量', icon: UtensilsCrossed, tone: 'orange' },
    ],
  },
  {
    label: '日常',
    types: [
      { type: 'DIAPER', label: '尿布', description: '小便、大便或都有', icon: Baby, tone: 'amber' },
      { type: 'SLEEP', label: '睡眠', description: '开始计时或补记睡眠', icon: Moon, tone: 'violet' },
      { type: 'AD_VITAMIN', label: 'AD / 维D', description: '分别记录两种补充剂', icon: Pill, tone: 'orange' },
      { type: 'MEMO', label: '备忘', description: '添加待办或提醒', icon: CalendarCheck, tone: 'indigo' },
    ],
  },
  {
    label: '健康',
    types: [
      { type: 'TEMPERATURE', label: '体温', description: '记录摄氏体温', icon: Thermometer, tone: 'red' },
      { type: 'WEIGHT', label: '体重', description: '记录公斤数', icon: Scale, tone: 'emerald' },
      { type: 'HEIGHT', label: '身高', description: '记录厘米数', icon: Ruler, tone: 'blue' },
      { type: 'MEDICATION', label: '服药', description: '记录药物和剂量', icon: Pill, tone: 'violet' },
      { type: 'VACCINE', label: '疫苗', description: '记录疫苗和针次', icon: Syringe, tone: 'teal' },
      { type: 'TOOTH_ERUPTION', label: '长牙', description: '选择牙位并记录萌出时间', icon: SmilePlus, tone: 'emerald' },
      { type: 'CUSTOM', label: '自定义', description: '记录其他健康事项', icon: FilePenLine, tone: 'indigo' },
    ],
  },
]

export const recordTypes = recordTypeGroups.flatMap(group => group.types)

export const quickRecordGroupMeta: QuickRecordMeta[] = [
  { key: 'GROUP_FEEDING', kind: 'group', label: '喂养', description: '选择一项喂养记录', icon: Milk, tone: 'pink' },
  { key: 'GROUP_HEALTH', kind: 'group', label: '健康', description: '选择日常或健康项目', icon: Scale, tone: 'emerald' },
  { key: 'GROUP_MEMO', kind: 'group', label: '备忘', description: '添加待办或提醒', icon: CalendarCheck, tone: 'indigo' },
]

export const toneClasses: Record<RecordTypeMeta['tone'], { icon: string; soft: string; border: string; text: string }> = {
  pink: { icon: 'text-pink-600', soft: 'bg-pink-50', border: 'border-pink-200', text: 'text-pink-700' },
  blue: { icon: 'text-blue-600', soft: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700' },
  amber: { icon: 'text-amber-600', soft: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700' },
  violet: { icon: 'text-violet-600', soft: 'bg-violet-50', border: 'border-violet-200', text: 'text-violet-700' },
  orange: { icon: 'text-orange-600', soft: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-700' },
  emerald: { icon: 'text-emerald-600', soft: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700' },
  red: { icon: 'text-red-600', soft: 'bg-red-50', border: 'border-red-200', text: 'text-red-700' },
  teal: { icon: 'text-teal-600', soft: 'bg-teal-50', border: 'border-teal-200', text: 'text-teal-700' },
  indigo: { icon: 'text-indigo-600', soft: 'bg-indigo-50', border: 'border-indigo-200', text: 'text-indigo-700' },
}

export function getRecordTypeMeta(type: ComposerRecordType) {
  return recordTypes.find(item => item.type === type) ?? recordTypes[0]
}

export function getQuickRecordMeta(key: QuickRecordKey): QuickRecordMeta {
  const groupMeta = quickRecordGroupMeta.find(item => item.key === key)
  if (groupMeta) return groupMeta

  const item = getRecordTypeMeta(key as ComposerRecordType)
  return { key, kind: 'record', label: item.label, description: item.description, icon: item.icon, tone: item.tone }
}

export function getRecordKind(type: ComposerRecordType): ComposerRecordKind {
  if (type === 'MEMO') return 'memo'
  if (['BREAST_MILK', 'BREAST_MILK_BOTTLE', 'FORMULA', 'SOLID_FOOD'].includes(type)) return 'feeding'
  return 'health'
}

export function getComposerTypeFromQuery(value: string | null): ComposerRecordType | null {
  switch (value) {
    case 'breast': return 'BREAST_MILK'
    case 'breast_bottle': return 'BREAST_MILK_BOTTLE'
    case 'formula': return 'FORMULA'
    case 'solid_food': return 'SOLID_FOOD'
    case 'weight': return 'WEIGHT'
    case 'height': return 'HEIGHT'
    case 'temperature': return 'TEMPERATURE'
    case 'medication': return 'MEDICATION'
    case 'vaccine': return 'VACCINE'
    case 'diaper': return 'DIAPER'
    case 'ad': return 'AD_VITAMIN'
    case 'sleep': return 'SLEEP'
    case 'teething': return 'TOOTH_ERUPTION'
    case 'custom': return 'CUSTOM'
    case 'memo': return 'MEMO'
    default: return null
  }
}

export function createComposerDraft(babyId: string, eventTime: string): ComposerDraft {
  return {
    babyId,
    eventTime,
    notes: '',
    leftBreastDuration: '',
    rightBreastDuration: '',
    breastMilkAmount: '',
    formulaAmount: '',
    solidFoodName: '',
    solidFoodAmount: '',
    weight: '',
    height: '',
    temperature: '',
    medicationName: '',
    medicationDose: '',
    vaccineName: '',
    vaccineManufacturer: '',
    vaccineDoseNumber: '',
    vaccineTotalDoses: '',
    diaperType: 'PEE',
    diaperStatus: '',
    adGiven: true,
    vitaminDGiven: false,
    customName: '',
    sleepStartTime: '',
    sleepEndTime: '',
    sleepQuality: '',
    toothCodes: [],
    memoTitle: '',
    memoContent: '',
    dirty: false,
  }
}
