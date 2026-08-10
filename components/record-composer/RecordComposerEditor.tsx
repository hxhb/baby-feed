'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertCircle,
  Check,
  ChevronDown,
  CircleCheck,
  Clock3,
  Loader2,
  MessageSquarePlus,
  Pause,
  PenLine,
  Play,
  RotateCcw,
  Timer,
} from 'lucide-react'
import FeedingRecordFields from '@/components/FeedingRecordFields'
import HealthRecordFields, { getHealthFieldValidationMessage } from '@/components/HealthRecordFields'
import { invalidateRecordRelatedCaches } from '@/lib/cache-helpers'
import {
  buildFeedingRecordPayload,
  getFeedingValidationMessage,
  type FeedingFieldValues,
  type FeedingType,
} from '@/lib/feeding-records'
import {
  buildHealthRecordPayload,
  buildVaccineSuggestions,
  findSelectedVaccineSuggestion,
  type HealthFieldValues,
  type HealthType,
  type VaccineSuggestion,
} from '@/lib/health-records'
import { getBeijingNow, toBeijingISO } from '@/lib/time'
import {
  getRecordKind,
  getRecordTypeMeta,
  type ActiveRecordTimer,
  type BabyOption,
  type ComposerDraft,
  type ComposerRecordType,
  type DraftPatch,
  type SavedRecord,
} from './record-types'

interface Props {
  type: ComposerRecordType
  babies: BabyOption[]
  draft: ComposerDraft
  timer: ActiveRecordTimer | null
  timerNow: number
  onChange: (patch: DraftPatch, markDirty?: boolean) => void
  onSaved: (record: SavedRecord) => void
  onStartBreastTimer: (side: 'left' | 'right', babyId: string) => void
  onSwitchBreastSide: () => void
  onStartSleepTimer: (babyId: string) => void
  onFinishTimer: () => void
}

function formatElapsed(totalSeconds: number) {
  const safeSeconds = Math.max(0, totalSeconds)
  const hours = Math.floor(safeSeconds / 3600)
  const minutes = Math.floor((safeSeconds % 3600) / 60)
  const seconds = safeSeconds % 60
  if (hours > 0) {
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
  }
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

function getBreastTimerSeconds(timer: Extract<ActiveRecordTimer, { kind: 'breast' }>, now: number) {
  const liveSeconds = Math.max(0, Math.floor((now - timer.startedAt) / 1000))
  return {
    left: timer.leftSeconds + (timer.side === 'left' ? liveSeconds : 0),
    right: timer.rightSeconds + (timer.side === 'right' ? liveSeconds : 0),
  }
}

function getRelativeTimeLabel(value: string) {
  const time = new Date(value).getTime()
  if (!Number.isFinite(time)) return '选择时间'
  const diff = Math.abs(Date.now() - time)
  if (diff < 5 * 60 * 1000) return '刚刚'
  const date = new Date(value)
  const today = new Date()
  const sameDay = date.getFullYear() === today.getFullYear()
    && date.getMonth() === today.getMonth()
    && date.getDate() === today.getDate()
  const timeLabel = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
  return sameDay ? `今天 ${timeLabel}` : `${date.getMonth() + 1}月${date.getDate()}日 ${timeLabel}`
}

function buildSummary(type: ComposerRecordType, draft: ComposerDraft) {
  switch (type) {
    case 'BREAST_MILK': {
      const parts = []
      if (draft.leftBreastDuration) parts.push(`左${draft.leftBreastDuration}分钟`)
      if (draft.rightBreastDuration) parts.push(`右${draft.rightBreastDuration}分钟`)
      return `亲喂 · ${parts.join(' / ')}`
    }
    case 'BREAST_MILK_BOTTLE': return `瓶喂母乳 · ${draft.breastMilkAmount}ml`
    case 'FORMULA': return `奶粉 · ${draft.formulaAmount}ml`
    case 'SOLID_FOOD': return `辅食 · ${draft.solidFoodName}`
    case 'DIAPER': return `尿布 · ${draft.diaperType === 'PEE' ? '小便' : draft.diaperType === 'POOP' ? '大便' : '都有'}`
    case 'SLEEP': return '睡眠记录'
    case 'AD_VITAMIN': {
      const supplements = [draft.adGiven ? 'AD' : null, draft.vitaminDGiven ? '维生素D' : null].filter(Boolean)
      return `营养补充 · ${supplements.join(' + ')}`
    }
    case 'WEIGHT': return `体重 · ${draft.weight}kg`
    case 'HEIGHT': return `身高 · ${draft.height}cm`
    case 'TEMPERATURE': return `体温 · ${draft.temperature}°C`
    case 'MEDICATION': return `服药 · ${draft.medicationName}`
    case 'VACCINE': return `疫苗 · ${draft.vaccineName}`
    case 'CUSTOM': return `自定义 · ${draft.customName}`
    case 'MEMO': return `备忘 · ${draft.memoTitle}`
  }
}

export default function RecordComposerEditor({
  type,
  babies,
  draft,
  timer,
  timerNow,
  onChange,
  onSaved,
  onStartBreastTimer,
  onSwitchBreastSide,
  onStartSleepTimer,
  onFinishTimer,
}: Props) {
  const [loading, setLoading] = useState(false)
  const [submitAttempted, setSubmitAttempted] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [timeOpen, setTimeOpen] = useState(false)
  const [notesOpen, setNotesOpen] = useState(Boolean(draft.notes))
  const [timerMode, setTimerMode] = useState<'timer' | 'manual'>('manual')
  const [vaccineSuggestions, setVaccineSuggestions] = useState<VaccineSuggestion[]>([])
  const [vaccineSuggestionsLoading, setVaccineSuggestionsLoading] = useState(false)
  const [selectedVaccineSuggestionKey, setSelectedVaccineSuggestionKey] = useState('')
  const formRef = useRef<HTMLFormElement>(null)
  const meta = getRecordTypeMeta(type)
  const kind = getRecordKind(type)

  useEffect(() => {
    setSubmitAttempted(false)
    setSubmitError('')
    setNotesOpen(type === 'CUSTOM' || Boolean(draft.notes))
    setTimeOpen(type === 'MEMO' || type === 'CUSTOM')
    setTimerMode('manual')
    // Draft values are intentionally sampled only when entering a record type.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type])

  useEffect(() => {
    if (type !== 'VACCINE' || !draft.babyId) {
      setVaccineSuggestions([])
      setVaccineSuggestionsLoading(false)
      return
    }

    let cancelled = false
    setVaccineSuggestionsLoading(true)
    fetch(`/api/health?babyId=${draft.babyId}&type=VACCINE`)
      .then(async response => {
        if (!response.ok) throw new Error('获取疫苗记录失败')
        return response.json()
      })
      .then(records => {
        if (!cancelled) setVaccineSuggestions(buildVaccineSuggestions(Array.isArray(records) ? records : []))
      })
      .catch(error => {
        console.error(error)
        if (!cancelled) setVaccineSuggestions([])
      })
      .finally(() => {
        if (!cancelled) setVaccineSuggestionsLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [draft.babyId, type])

  useEffect(() => {
    if (submitError) setSubmitError('')
    // Only clear server errors; inline validation should stay visible and update after submit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft])

  const feedingValues: FeedingFieldValues = useMemo(() => ({
    leftBreastDuration: draft.leftBreastDuration,
    rightBreastDuration: draft.rightBreastDuration,
    breastMilkAmount: draft.breastMilkAmount,
    formulaAmount: draft.formulaAmount,
    solidFoodName: draft.solidFoodName,
    solidFoodAmount: draft.solidFoodAmount,
  }), [draft])

  const healthValues: HealthFieldValues = useMemo(() => ({
    weight: draft.weight,
    height: draft.height,
    temperature: draft.temperature,
    medicationName: draft.medicationName,
    medicationDose: draft.medicationDose,
    vaccineName: draft.vaccineName,
    vaccineManufacturer: draft.vaccineManufacturer,
    vaccineDoseNumber: draft.vaccineDoseNumber,
    vaccineTotalDoses: draft.vaccineTotalDoses,
    diaperType: draft.diaperType,
    diaperStatus: draft.diaperStatus,
    adGiven: draft.adGiven,
    vitaminDGiven: draft.vitaminDGiven,
    customName: draft.customName,
    sleepStartTime: draft.sleepStartTime,
    sleepEndTime: draft.sleepEndTime,
    sleepQuality: draft.sleepQuality,
  }), [draft])

  const validationMessage = useMemo(() => {
    if (!draft.babyId) return '请先选择宝宝'
    if (kind === 'feeding') return getFeedingValidationMessage(type as FeedingType, feedingValues)
    if (kind === 'health') return getHealthFieldValidationMessage(type as HealthType, healthValues)
    if (!draft.memoTitle.trim()) return '请输入备忘标题'
    return ''
  }, [draft.babyId, draft.memoTitle, feedingValues, healthValues, kind, type])

  const update = (patch: DraftPatch) => onChange(patch)

  const applyVaccineSuggestion = (suggestion: VaccineSuggestion) => {
    setSelectedVaccineSuggestionKey(suggestion.key)
    update({
      vaccineName: suggestion.vaccineName,
      vaccineManufacturer: suggestion.vaccineManufacturer,
      vaccineDoseNumber: String(suggestion.nextDoseNumber),
      vaccineTotalDoses: String(suggestion.totalDoses),
    })
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setSubmitAttempted(true)

    if (validationMessage) {
      window.requestAnimationFrame(() => {
        const firstInput = formRef.current?.querySelector<HTMLElement>('input:not([type="hidden"]), textarea, select')
        firstInput?.focus()
      })
      return
    }

    setLoading(true)
    setSubmitError('')

    try {
      let endpoint = '/api/feeding'
      let body: Record<string, unknown>

      if (kind === 'feeding') {
        body = {
          babyId: draft.babyId,
          type,
          startTime: toBeijingISO(draft.eventTime || getBeijingNow()),
          notes: draft.notes.trim() || null,
          ...buildFeedingRecordPayload(type as FeedingType, feedingValues),
        }
      } else if (kind === 'health') {
        endpoint = '/api/health'
        const recordTime = type === 'SLEEP'
          ? draft.sleepEndTime || draft.sleepStartTime || draft.eventTime || getBeijingNow()
          : draft.eventTime || getBeijingNow()
        body = {
          babyId: draft.babyId,
          type,
          recordedAt: toBeijingISO(recordTime),
          notes: draft.notes.trim() || null,
          ...buildHealthRecordPayload(type as HealthType, healthValues),
        }
      } else {
        endpoint = '/api/memo'
        body = {
          babyId: draft.babyId,
          title: draft.memoTitle.trim(),
          content: draft.memoContent.trim() || null,
          scheduledAt: toBeijingISO(draft.eventTime || getBeijingNow()),
        }
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || '保存失败，请重试')

      invalidateRecordRelatedCaches(draft.babyId)
      window.sessionStorage.setItem('record_saved_ts', String(Date.now()))
      window.sessionStorage.removeItem('baby-feed:add-record-feeding-draft')
      window.sessionStorage.removeItem('baby-feed:add-record-health-draft')
      window.sessionStorage.removeItem('baby-feed:add-record-memo-draft')
      window.sessionStorage.removeItem('baby-feed:add-record-shared-draft')

      onSaved({
        id: result.id,
        kind,
        babyId: draft.babyId,
        summary: buildSummary(type, draft),
      })
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : '保存失败，请重试')
    } finally {
      setLoading(false)
    }
  }

  const activeBreastTimer = timer?.kind === 'breast' && timer.babyId === draft.babyId ? timer : null
  const activeSleepTimer = timer?.kind === 'sleep' && timer.babyId === draft.babyId ? timer : null
  const breastTimerValues = activeBreastTimer ? getBreastTimerSeconds(activeBreastTimer, timerNow) : null
  const sleepElapsed = activeSleepTimer ? Math.floor((timerNow - activeSleepTimer.startedAt) / 1000) : 0
  const timerIsRunningForThisType = (type === 'BREAST_MILK' && Boolean(activeBreastTimer)) || (type === 'SLEEP' && Boolean(activeSleepTimer))
  const isLiveTimerMode = (type === 'BREAST_MILK' || type === 'SLEEP') && timerMode === 'timer'
  const showFormActions = !timerIsRunningForThisType && !isLiveTimerMode

  const renderTimerChoice = () => {
    if ((type !== 'BREAST_MILK' && type !== 'SLEEP') || timerIsRunningForThisType) return null
    const isBreast = type === 'BREAST_MILK'
    const choices = [
      {
        mode: 'timer' as const,
        title: isBreast ? '实时计时' : '现在入睡',
        description: isBreast ? '边喂边记' : '开始计时',
        icon: Timer,
      },
      {
        mode: 'manual' as const,
        title: isBreast ? '补记时长' : '补记睡眠',
        description: isBreast ? '事后填写' : '填写起止',
        icon: PenLine,
      },
    ]

    return (
      <fieldset className="mb-4">
        <legend className="mb-1.5 text-sm font-medium text-slate-700">记录方式</legend>
        <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="记录方式">
          {choices.map(choice => {
            const selected = timerMode === choice.mode
            const ChoiceIcon = choice.icon
            return (
              <button
                key={choice.mode}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => setTimerMode(choice.mode)}
                className={`relative flex min-h-[68px] items-center gap-2.5 rounded-lg border py-2 pl-2.5 pr-7 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 ${selected
                  ? isBreast ? 'border-pink-300 bg-pink-50/70' : 'border-violet-300 bg-violet-50/70'
                  : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${selected
                    ? isBreast ? 'bg-white text-pink-600' : 'bg-white text-violet-600'
                    : 'bg-slate-100 text-slate-600'
                  }`}>
                  <ChoiceIcon size={17} aria-hidden="true" />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-slate-950">{choice.title}</span>
                  <span className="mt-0.5 block truncate text-xs text-slate-600">{choice.description}</span>
                </span>
                {selected ? <CircleCheck size={16} className={`absolute right-2 top-2 ${isBreast ? 'text-pink-600' : 'text-violet-600'}`} aria-hidden="true" /> : null}
              </button>
            )
          })}
        </div>
      </fieldset>
    )
  }

  const renderBreastTimer = () => {
    if (!activeBreastTimer || !breastTimerValues) {
      return (
        <div className="rounded-lg border border-pink-100 bg-pink-50/60 p-4">
          <p className="text-sm font-medium text-slate-900">从哪一侧开始？</p>
          <p className="mt-1 text-sm text-slate-600">计时会在切换页面或刷新后继续保留。</p>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <button type="button" onClick={() => onStartBreastTimer('left', draft.babyId)} className="flex min-h-12 items-center justify-center gap-2 rounded-lg bg-pink-600 px-4 text-sm font-semibold text-white transition-colors hover:bg-pink-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink-500 focus-visible:ring-offset-2">
              <Play size={17} />左侧开始
            </button>
            <button type="button" onClick={() => onStartBreastTimer('right', draft.babyId)} className="flex min-h-12 items-center justify-center gap-2 rounded-lg border border-pink-200 bg-white px-4 text-sm font-semibold text-pink-700 transition-colors hover:bg-pink-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink-500 focus-visible:ring-offset-2">
              <Play size={17} />右侧开始
            </button>
          </div>
        </div>
      )
    }

    return (
      <div className="rounded-lg border border-pink-200 bg-pink-50/70 p-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-pink-800">正在计时 · {activeBreastTimer.side === 'left' ? '左侧' : '右侧'}</p>
            <p className="mt-1 font-mono text-3xl font-semibold tabular-nums text-slate-950">{formatElapsed(activeBreastTimer.side === 'left' ? breastTimerValues.left : breastTimerValues.right)}</p>
          </div>
          <div className="text-right text-xs leading-5 text-slate-600">
            <p>左侧 {formatElapsed(breastTimerValues.left)}</p>
            <p>右侧 {formatElapsed(breastTimerValues.right)}</p>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <button type="button" onClick={onSwitchBreastSide} className="flex min-h-11 items-center justify-center gap-2 rounded-lg border border-pink-200 bg-white px-3 text-sm font-medium text-pink-700 hover:bg-pink-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink-500">
            <RotateCcw size={16} />切换到{activeBreastTimer.side === 'left' ? '右侧' : '左侧'}
          </button>
          <button type="button" onClick={() => { onFinishTimer(); setTimerMode('manual') }} className="flex min-h-11 items-center justify-center gap-2 rounded-lg bg-slate-900 px-3 text-sm font-medium text-white hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-700">
            <Pause size={16} />完成计时
          </button>
        </div>
      </div>
    )
  }

  const renderSleepTimer = () => {
    if (!activeSleepTimer) {
      return (
        <div className="rounded-lg border border-violet-100 bg-violet-50/60 p-4">
          <p className="text-sm font-medium text-slate-900">宝宝准备睡觉了吗？</p>
          <p className="mt-1 text-sm text-slate-600">开始后可关闭面板，醒来时从全局计时条结束。</p>
          <button type="button" onClick={() => onStartSleepTimer(draft.babyId)} className="mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-violet-600 px-4 text-sm font-semibold text-white transition-colors hover:bg-violet-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2">
            <MoonIcon />开始睡眠
          </button>
        </div>
      )
    }

    return (
      <div className="rounded-lg border border-violet-200 bg-violet-50/70 p-4 text-center">
        <p className="text-sm font-medium text-violet-800">宝宝正在睡</p>
        <p className="mt-2 font-mono text-3xl font-semibold tabular-nums text-slate-950">{formatElapsed(sleepElapsed)}</p>
        <button type="button" onClick={() => { onFinishTimer(); setTimerMode('manual') }} className="mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 text-sm font-semibold text-white hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-700">
          <Check size={17} />醒了，确认时间
        </button>
      </div>
    )
  }

  const renderFields = () => {
    if (kind === 'feeding') {
      if (type === 'BREAST_MILK' && (activeBreastTimer || timerMode === 'timer')) return renderBreastTimer()
      return (
        <FeedingRecordFields
          type={type as FeedingType}
          breastMode={type === 'BREAST_MILK_BOTTLE' ? 'bottle' : 'direct'}
          mode="edit"
          values={feedingValues}
          setters={{
            setType: () => {},
            setBreastMode: () => {},
            setLeftBreastDuration: value => update({ leftBreastDuration: value }),
            setRightBreastDuration: value => update({ rightBreastDuration: value }),
            setBreastMilkAmount: value => update({ breastMilkAmount: value }),
            setFormulaAmount: value => update({ formulaAmount: value }),
            setSolidFoodName: value => update({ solidFoodName: value }),
            setSolidFoodAmount: value => update({ solidFoodAmount: value }),
          }}
        />
      )
    }

    if (kind === 'health') {
      if (type === 'SLEEP' && (activeSleepTimer || timerMode === 'timer')) return renderSleepTimer()
      return (
        <HealthRecordFields
          type={type as HealthType}
          mode="edit"
          values={healthValues}
          validationMessage={submitAttempted ? validationMessage : ''}
          vaccineSuggestions={vaccineSuggestions}
          vaccineSuggestionsLoading={vaccineSuggestionsLoading}
          selectedVaccineSuggestionKey={selectedVaccineSuggestionKey || findSelectedVaccineSuggestion(vaccineSuggestions, healthValues)?.key || ''}
          onApplyVaccineSuggestion={applyVaccineSuggestion}
          setters={{
            setWeight: value => update({ weight: value }),
            setHeight: value => update({ height: value }),
            setTemperature: value => update({ temperature: value }),
            setMedicationName: value => update({ medicationName: value }),
            setMedicationDose: value => update({ medicationDose: value }),
            setVaccineName: value => update({ vaccineName: value }),
            setVaccineManufacturer: value => update({ vaccineManufacturer: value }),
            setVaccineDoseNumber: value => update({ vaccineDoseNumber: value }),
            setVaccineTotalDoses: value => update({ vaccineTotalDoses: value }),
            setDiaperType: value => update({ diaperType: value }),
            setDiaperStatus: value => update({ diaperStatus: value }),
            setAdGiven: value => update({ adGiven: value }),
            setVitaminDGiven: value => update({ vitaminDGiven: value }),
            setCustomName: value => update({ customName: value }),
            setSleepStartTime: value => update({ sleepStartTime: value }),
            setSleepEndTime: value => update({ sleepEndTime: value }),
            setSleepQuality: value => update({ sleepQuality: value }),
          }}
        />
      )
    }

    return (
      <div className="space-y-4">
        <div>
          <label htmlFor="composer-memo-title" className="mb-1.5 block text-sm font-medium text-slate-700">备忘标题 <span className="text-red-600">*</span></label>
          <input id="composer-memo-title" value={draft.memoTitle} onChange={event => update({ memoTitle: event.target.value })} maxLength={100} autoFocus placeholder="例如：接种第二针乙肝疫苗" aria-invalid={submitAttempted && !draft.memoTitle.trim()} className="min-h-12 w-full rounded-lg border border-slate-300 bg-white px-3.5 text-base text-slate-950 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100" />
        </div>
        <div>
          <label htmlFor="composer-memo-content" className="mb-1.5 block text-sm font-medium text-slate-700">详细描述 <span className="font-normal text-slate-500">（可选）</span></label>
          <textarea id="composer-memo-content" value={draft.memoContent} onChange={event => update({ memoContent: event.target.value })} maxLength={500} rows={3} placeholder="添加需要记住的内容" className="w-full resize-none rounded-lg border border-slate-300 bg-white px-3.5 py-3 text-base text-slate-950 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100" />
        </div>
      </div>
    )
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="record-composer flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-5 pt-5 sm:px-6">
        <div className="mx-auto max-w-xl">
          {babies.length > 1 ? (
            <div className="mb-5">
              <label htmlFor="composer-baby" className="mb-1.5 block text-sm font-medium text-slate-700">记录宝宝</label>
              <select id="composer-baby" value={draft.babyId} onChange={event => update({ babyId: event.target.value })} className="min-h-12 w-full rounded-lg border border-slate-300 bg-white py-2 pl-3.5 pr-10 text-base font-medium text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100">
                {babies.map(baby => <option key={baby.id} value={baby.id}>{baby.name}</option>)}
              </select>
            </div>
          ) : null}

          {renderTimerChoice()}

          <div className="composer-fields">
            {renderFields()}
          </div>

          {showFormActions ? (
            <div className="mt-5 border-t border-slate-100 pt-4">
              {kind === 'memo' ? (
                <div>
                  <label htmlFor="composer-event-time" className="mb-1.5 flex items-center gap-2 text-sm font-medium text-slate-700">
                    <Clock3 size={17} aria-hidden="true" />备忘时间
                  </label>
                  <input id="composer-event-time" type="datetime-local" value={draft.eventTime} onChange={event => update({ eventTime: event.target.value })} className="min-h-12 w-full rounded-lg border border-slate-300 bg-white px-3.5 text-base text-slate-950 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" />
                </div>
              ) : (
                <>
                  {type !== 'CUSTOM' ? (
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <button type="button" onClick={() => setNotesOpen(current => !current)} aria-expanded={notesOpen} className="flex min-h-11 items-center gap-2 rounded-lg px-2 text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
                        <MessageSquarePlus size={17} />{notesOpen ? '收起备注' : '添加备注'}
                      </button>
                      <button type="button" onClick={() => setTimeOpen(current => !current)} aria-expanded={timeOpen} className="flex min-h-11 items-center gap-2 rounded-lg px-2 text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
                        <Clock3 size={17} />记录时间：{getRelativeTimeLabel(draft.eventTime)}<ChevronDown size={15} className={`transition-transform ${timeOpen ? 'rotate-180' : ''}`} />
                      </button>
                    </div>
                  ) : null}

                  {timeOpen ? (
                    <div className="mt-3">
                      <label htmlFor="composer-event-time" className="mb-1.5 block text-sm font-medium text-slate-700">记录时间</label>
                      <input id="composer-event-time" type="datetime-local" value={draft.eventTime} onChange={event => update({ eventTime: event.target.value })} className="min-h-12 w-full rounded-lg border border-slate-300 bg-white px-3.5 text-base text-slate-950 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" />
                    </div>
                  ) : null}

                  {notesOpen ? (
                    <div className="mt-3">
                      <label htmlFor="composer-notes" className="mb-1.5 block text-sm font-medium text-slate-700">备注 <span className="font-normal text-slate-500">（可选）</span></label>
                      <textarea id="composer-notes" value={draft.notes} onChange={event => update({ notes: event.target.value })} rows={2} placeholder="添加这次记录的补充信息" className="w-full resize-none rounded-lg border border-slate-300 bg-white px-3.5 py-3 text-base text-slate-950 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" />
                    </div>
                  ) : null}
                </>
              )}
            </div>
          ) : null}
        </div>
      </div>

      {showFormActions ? (
        <div className="border-t border-slate-200 bg-white px-4 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] pt-3 sm:px-6 sm:pb-4">
          <div className="mx-auto max-w-xl">
            {submitError ? (
              <div role="alert" className="mb-3 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
                <AlertCircle size={17} className="mt-0.5 shrink-0" />{submitError}
              </div>
            ) : submitAttempted && validationMessage ? (
              <div role="alert" className="mb-3 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-800">
                <AlertCircle size={17} className="mt-0.5 shrink-0" />{validationMessage}
              </div>
            ) : null}
            <button type="submit" disabled={loading || babies.length === 0} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 text-base font-semibold text-white transition-colors hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-slate-300">
              {loading ? <><Loader2 size={18} className="animate-spin" />保存中...</> : <><Check size={18} />保存{meta.label}记录</>}
            </button>
          </div>
        </div>
      ) : null}
    </form>
  )
}

function MoonIcon() {
  return <Play size={17} aria-hidden="true" />
}
