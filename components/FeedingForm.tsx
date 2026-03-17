'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { getBeijingNow, toBeijingISO } from '@/lib/time'
import { invalidateRequestCache } from '@/lib/client-request-cache'
import {
  Droplets,
  Milk,
  Clock,
  Scale,
  Pill,
  Thermometer,
  Ruler,
  Syringe,
  Baby as BabyIcon
} from 'lucide-react'
interface BabyInfo {
  id: string
  name: string
}

interface SharedDraft {
  babyId: string
  eventTime: string
  notes: string
}

interface FeedingDraft {
  breastMode: 'direct' | 'bottle'
  leftBreastDuration: string
  rightBreastDuration: string
  breastMilkAmount: string
  formulaAmount: string
}

interface Props {
  initialType: 'breast' | 'breast_bottle' | 'formula' | null
  initialBabies?: BabyInfo[]
  initialSharedDraft?: SharedDraft
  onSharedDraftChange?: (draft: SharedDraft) => void
  onRecordSaved?: () => void
}

const FEEDING_DRAFT_STORAGE_KEY = 'baby-feed:add-record-feeding-draft'
const emptyFeedingDraft: FeedingDraft = {
  breastMode: 'direct',
  leftBreastDuration: '',
  rightBreastDuration: '',
  breastMilkAmount: '',
  formulaAmount: ''
}

function invalidateRecordRelatedCaches(babyId: string) {
  invalidateRequestCache(`/api/babies`)
  invalidateRequestCache(`/api/feeding?babyId=${babyId}`)
  invalidateRequestCache(`/api/health?babyId=${babyId}`)
  invalidateRequestCache(`stats:${babyId}:`)
  invalidateRequestCache(`timeline:${babyId}:`)
}

export default function FeedingForm({
  initialType,
  initialBabies = [],
  initialSharedDraft,
  onSharedDraftChange,
  onRecordSaved
}: Props) {
  const router = useRouter()
  const [babies, setBabies] = useState<BabyInfo[]>(initialBabies)
  const [loading, setLoading] = useState(false)
  const [submitError, setSubmitError] = useState('')

  const [babyId, setBabyId] = useState('')
  const [type, setType] = useState<'BREAST_MILK' | 'BREAST_MILK_BOTTLE' | 'FORMULA'>(
    initialType === 'formula' ? 'FORMULA' : initialType === 'breast_bottle' ? 'BREAST_MILK_BOTTLE' : 'BREAST_MILK'
  )
  const [breastMode, setBreastMode] = useState<'direct' | 'bottle'>(
    initialType === 'breast_bottle' ? 'bottle' : 'direct'
  )
  const [leftBreastDuration, setLeftBreastDuration] = useState('')
  const [rightBreastDuration, setRightBreastDuration] = useState('')
  const [breastMilkAmount, setBreastMilkAmount] = useState('')
  const [formulaAmount, setFormulaAmount] = useState('')
  const [startTime, setStartTime] = useState(initialSharedDraft?.eventTime || getBeijingNow())
  const [notes, setNotes] = useState(initialSharedDraft?.notes || '')
  const hasHydratedSharedDraft = useRef(false)
  const hasHydratedLocalDraft = useRef(false)

  useEffect(() => {
    if (initialBabies.length > 0) {
      setBabies(initialBabies)
      setBabyId(currentBabyId => currentBabyId || initialSharedDraft?.babyId || initialBabies[0].id)
      return
    }

    fetchBabies()
  }, [initialBabies, initialSharedDraft?.babyId])

  useEffect(() => {
    if (initialType === 'formula') {
      setBreastMode('direct')
      setType('FORMULA')
      return
    }

    if (initialType === 'breast_bottle') {
      setBreastMode('bottle')
      setType('BREAST_MILK_BOTTLE')
      return
    }

    setBreastMode('direct')
    setType('BREAST_MILK')
  }, [initialType])

  useEffect(() => {
    if (!initialSharedDraft || hasHydratedSharedDraft.current) {
      return
    }

    const hasSharedDraft = Boolean(initialSharedDraft.babyId || initialSharedDraft.eventTime || initialSharedDraft.notes)
    if (!hasSharedDraft) {
      return
    }

    hasHydratedSharedDraft.current = true
    setBabyId(currentBabyId => currentBabyId || initialSharedDraft.babyId)
    setStartTime(currentStartTime => currentStartTime || initialSharedDraft.eventTime || getBeijingNow())
    setNotes(currentNotes => currentNotes || initialSharedDraft.notes)
  }, [initialSharedDraft])

  useEffect(() => {
    onSharedDraftChange?.({
      babyId,
      eventTime: startTime,
      notes
    })
  }, [babyId, startTime, notes, onSharedDraftChange])

  useEffect(() => {
    if (hasHydratedLocalDraft.current) {
      return
    }

    hasHydratedLocalDraft.current = true

    try {
      const rawDraft = window.sessionStorage.getItem(FEEDING_DRAFT_STORAGE_KEY)
      if (!rawDraft) {
        return
      }

      const parsedDraft = JSON.parse(rawDraft) as Partial<FeedingDraft>
      if (parsedDraft.breastMode === 'direct' || parsedDraft.breastMode === 'bottle') {
        setBreastMode(parsedDraft.breastMode)
        setType(parsedDraft.breastMode === 'bottle' ? 'BREAST_MILK_BOTTLE' : 'BREAST_MILK')
      }
      if (typeof parsedDraft.leftBreastDuration === 'string') {
        setLeftBreastDuration(parsedDraft.leftBreastDuration)
      }
      if (typeof parsedDraft.rightBreastDuration === 'string') {
        setRightBreastDuration(parsedDraft.rightBreastDuration)
      }
      if (typeof parsedDraft.breastMilkAmount === 'string') {
        setBreastMilkAmount(parsedDraft.breastMilkAmount)
      }
      if (typeof parsedDraft.formulaAmount === 'string') {
        setFormulaAmount(parsedDraft.formulaAmount)
      }
    } catch (error) {
      console.error('读取喂养草稿失败:', error)
    }
  }, [])

  useEffect(() => {
    try {
      const nextDraft: FeedingDraft = {
        breastMode,
        leftBreastDuration,
        rightBreastDuration,
        breastMilkAmount,
        formulaAmount
      }

      const isEmptyDraft =
        nextDraft.breastMode === emptyFeedingDraft.breastMode &&
        !nextDraft.leftBreastDuration &&
        !nextDraft.rightBreastDuration &&
        !nextDraft.breastMilkAmount &&
        !nextDraft.formulaAmount

      if (isEmptyDraft) {
        window.sessionStorage.removeItem(FEEDING_DRAFT_STORAGE_KEY)
        return
      }

      window.sessionStorage.setItem(FEEDING_DRAFT_STORAGE_KEY, JSON.stringify(nextDraft))
    } catch (error) {
      console.error('保存喂养草稿失败:', error)
    }
  }, [breastMode, leftBreastDuration, rightBreastDuration, breastMilkAmount, formulaAmount])

  useEffect(() => {
    if (!submitError) {
      return
    }

    setSubmitError('')
  }, [babyId, type, breastMode, leftBreastDuration, rightBreastDuration, breastMilkAmount, formulaAmount, startTime, notes])

  const fetchBabies = async () => {
    try {
      const response = await fetch('/api/babies')
      if (response.ok) {
        const data = await response.json()
        if (Array.isArray(data)) {
          setBabies(data)
          if (data.length > 0) {
            setBabyId(currentBabyId => currentBabyId || initialSharedDraft?.babyId || data[0].id)
          }
        }
      }
    } catch (error) {
      console.error('获取婴儿列表失败:', error)
    }
  }

  const getValidationMessage = () => {
    if (!babyId) {
      return '请先选择宝宝'
    }

    if (type === 'BREAST_MILK') {
      const leftDuration = parseInt(leftBreastDuration, 10) || 0
      const rightDuration = parseInt(rightBreastDuration, 10) || 0

      if (leftDuration <= 0 && rightDuration <= 0) {
        return '请至少填写一侧亲喂时长'
      }
    }

    if (type === 'BREAST_MILK_BOTTLE' && !(parseFloat(breastMilkAmount) > 0)) {
      return '请填写有效的母乳量'
    }

    if (type === 'FORMULA' && !(parseFloat(formulaAmount) > 0)) {
      return '请填写有效的奶粉量'
    }

    return ''
  }

  const validationMessage = getValidationMessage()
  const canSubmit = babies.length > 0 && !loading && !validationMessage

  const applyQuickAmount = (value: number) => {
    const formatted = String(value)
    if (type === 'FORMULA') {
      setFormulaAmount(formatted)
      return
    }

    if (type === 'BREAST_MILK_BOTTLE') {
      setBreastMilkAmount(formatted)
    }
  }

  const feedingTypeCards = [
    {
      key: 'BREAST',
      title: '母乳',
      icon: Droplets,
      iconClassName: 'text-pink-500',
      active: type === 'BREAST_MILK' || type === 'BREAST_MILK_BOTTLE',
      activeClassName: 'border-pink-500 bg-pink-50/80 text-pink-700',
      inactiveClassName: 'border-pink-100 bg-pink-50/80 text-pink-700 hover:border-pink-200 hover:bg-pink-100/70',
      onClick: () => {
        setType(breastMode === 'bottle' ? 'BREAST_MILK_BOTTLE' : 'BREAST_MILK')
      }
    },
    {
      key: 'FORMULA',
      title: '奶粉',
      icon: Milk,
      iconClassName: 'text-blue-500',
      active: type === 'FORMULA',
      activeClassName: 'border-blue-500 bg-blue-50/80 text-blue-700',
      inactiveClassName: 'border-blue-100 bg-blue-50/80 text-blue-700 hover:border-blue-200 hover:bg-blue-100/70',
      onClick: () => setType('FORMULA')
    }
  ]

  const healthTypeLinks = [
    { href: '/add?type=weight', label: '体重', icon: Scale, iconClassName: 'text-green-500' },
    { href: '/add?type=height', label: '身高', icon: Ruler, iconClassName: 'text-blue-500' },
    { href: '/add?type=temperature', label: '体温', icon: Thermometer, iconClassName: 'text-red-500' },
    { href: '/add?type=ad', label: 'AD', icon: Pill, iconClassName: 'text-orange-500' },
    { href: '/add?type=medication', label: '服药', icon: Pill, iconClassName: 'text-purple-500' },
    { href: '/add?type=vaccine', label: '疫苗', icon: Syringe, iconClassName: 'text-teal-500' },
    { href: '/add?type=diaper', label: '大小便', icon: BabyIcon, iconClassName: 'text-amber-500' },
  ]

  const currentTypeMeta = type === 'FORMULA'
    ? { title: '奶粉', hint: '适合快速记录奶量，常用数值可以直接一键填写。', badgeClassName: 'bg-blue-50 text-blue-700', iconClassName: 'text-blue-500', icon: Milk }
    : breastMode === 'bottle'
      ? { title: '母乳瓶喂', hint: '可直接使用常用奶量捷径，减少重复输入。', badgeClassName: 'bg-pink-50 text-pink-700', iconClassName: 'text-pink-500', icon: Droplets }
      : { title: '母乳亲喂', hint: '左右时长可分开记录，方便回顾本次喂养情况。', badgeClassName: 'bg-pink-50 text-pink-700', iconClassName: 'text-pink-500', icon: Droplets }

  const CurrentTypeIcon = currentTypeMeta.icon

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const currentValidationMessage = getValidationMessage()
    if (currentValidationMessage) {
      setSubmitError(currentValidationMessage)
      return
    }

    setLoading(true)

    try {
      const data: Record<string, unknown> = {
        babyId,
        type,
        startTime: toBeijingISO(startTime),
        notes: notes.trim() || null
      }

      if (type === 'BREAST_MILK') {
        data.leftBreastDuration = parseInt(leftBreastDuration, 10) || 0
        data.rightBreastDuration = parseInt(rightBreastDuration, 10) || 0
      } else if (type === 'BREAST_MILK_BOTTLE') {
        data.breastMilkAmount = parseFloat(breastMilkAmount) || 0
      } else if (type === 'FORMULA') {
        data.formulaAmount = parseFloat(formulaAmount) || 0
      }

      const response = await fetch('/api/feeding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      })

      if (response.ok) {
        invalidateRecordRelatedCaches(babyId)
        window.sessionStorage.removeItem(FEEDING_DRAFT_STORAGE_KEY)
        onRecordSaved?.()
        router.replace('/')
        router.refresh()
        return
      }

      const error = await response.json()
      setSubmitError(error.error || '保存失败')
    } catch (error) {
      console.error('保存失败:', error)
      setSubmitError('保存失败，请重试')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3.5 pb-3 sm:space-y-4 sm:pb-0">
      <div className="rounded-2xl border border-gray-100 bg-white p-3.5 shadow-sm sm:p-4">
        <label className="mb-1.5 block text-sm font-medium text-gray-700">
          选择宝宝
        </label>
        {babies.length > 0 ? (
          <select
            value={babyId}
            onChange={(e) => setBabyId(e.target.value)}
            className="w-full rounded-xl border border-gray-300 px-3.5 py-2.5 text-sm text-gray-900 outline-none transition focus:border-transparent focus:ring-2 focus:ring-blue-500"
          >
            {babies.map(baby => (
              <option key={baby.id} value={baby.id}>{baby.name}</option>
            ))}
          </select>
        ) : (
          <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 px-3.5 py-3 text-sm text-gray-500">
            <p>请先在设置中添加宝宝</p>
            <Link
              href="/settings"
              className="mobile-touch-target mt-1.5 inline-flex items-center rounded-xl px-1 text-sm font-medium text-blue-600 transition hover:text-blue-700"
            >
              前往设置
            </Link>
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-gray-100 bg-white p-3.5 shadow-sm sm:p-4">
        <div className="mb-2 flex items-center justify-between gap-3">
          <label className="block text-sm font-medium text-gray-700">
            记录类型
          </label>
          <div className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium sm:hidden ${currentTypeMeta.badgeClassName}`}>
            <CurrentTypeIcon size={14} className={currentTypeMeta.iconClassName} />
            {currentTypeMeta.title}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {feedingTypeCards.map(card => {
            const Icon = card.icon
            return (
              <button
                key={card.key}
                type="button"
                onClick={card.onClick}
                className={`mobile-touch-target flex items-center justify-center gap-2 rounded-xl border py-2.5 transition ${card.active ? card.activeClassName : card.inactiveClassName}`}
              >
                <Icon size={18} className={card.iconClassName} />
                <span className="text-sm font-medium">{card.title}</span>
              </button>
            )
          })}
        </div>
        <div className="mt-3 rounded-2xl bg-gray-50/80 p-2.5 sm:p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="text-sm font-medium text-gray-700">健康</span>
            <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-medium text-gray-500">
              默认展开
            </span>
          </div>
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
            {healthTypeLinks.map(item => {
              const Icon = item.icon
              return (
                <Link
                  key={`${item.href}-${item.label}`}
                  href={item.href}
                  className="mobile-touch-target flex min-h-[68px] flex-col items-center justify-center rounded-xl border-2 border-gray-200 bg-white px-2 py-2 transition hover:border-gray-300 sm:bg-transparent"
                >
                  <Icon size={18} className={item.iconClassName} />
                  <span className="mt-1 text-[11px] font-medium leading-4 text-gray-600">
                    {item.label}
                  </span>
                </Link>
              )
            })}
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-gray-100 bg-white p-3.5 shadow-sm sm:p-4">
        <div className="mb-3 flex items-center gap-3">
          <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl ${currentTypeMeta.badgeClassName.split(' ')[0]}`}>
            <CurrentTypeIcon size={18} className={currentTypeMeta.iconClassName} />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-gray-900 sm:text-base">编辑记录信息</h3>
            <p className="text-xs text-gray-500 sm:text-sm">{currentTypeMeta.hint}</p>
          </div>
        </div>

        {(type === 'BREAST_MILK' || type === 'BREAST_MILK_BOTTLE') && (
          <div className="space-y-3">
            <div className="flex gap-1.5 rounded-2xl bg-gray-50 p-1">
              <button
                type="button"
                onClick={() => {
                  setBreastMode('direct')
                  setType('BREAST_MILK')
                }}
                className={`mobile-touch-target flex-1 rounded-xl px-3 py-2 text-sm font-medium transition ${
                  breastMode === 'direct'
                    ? 'bg-pink-500 text-white shadow-sm'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                亲喂
              </button>
              <button
                type="button"
                onClick={() => {
                  setBreastMode('bottle')
                  setType('BREAST_MILK_BOTTLE')
                }}
                className={`mobile-touch-target flex-1 rounded-xl px-3 py-2 text-sm font-medium transition ${
                  breastMode === 'bottle'
                    ? 'bg-pink-500 text-white shadow-sm'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                瓶喂
              </button>
            </div>

            {breastMode === 'direct' && (
              <div className="grid grid-cols-2 gap-2.5">
                <div className="rounded-2xl bg-gray-50/70 p-3">
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">
                    左侧（分钟）
                  </label>
                  <input
                    type="number"
                    inputMode="numeric"
                    value={leftBreastDuration}
                    onChange={(e) => setLeftBreastDuration(e.target.value)}
                    min="0"
                    className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm outline-none transition focus:border-transparent focus:ring-2 focus:ring-blue-500"
                    placeholder="10"
                  />
                </div>
                <div className="rounded-2xl bg-gray-50/70 p-3">
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">
                    右侧（分钟）
                  </label>
                  <input
                    type="number"
                    inputMode="numeric"
                    value={rightBreastDuration}
                    onChange={(e) => setRightBreastDuration(e.target.value)}
                    min="0"
                    className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm outline-none transition focus:border-transparent focus:ring-2 focus:ring-blue-500"
                    placeholder="10"
                  />
                </div>
              </div>
            )}

            {breastMode === 'bottle' && (
              <div className="rounded-2xl bg-gray-50/70 p-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <label className="text-sm font-medium text-gray-700">
                    母乳量（毫升）
                  </label>
                  <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-medium text-gray-500">
                    快捷填入
                  </span>
                </div>
                <div className="mb-2 flex flex-wrap gap-1.5">
                  {[60, 90, 120].map(value => (
                    <button
                      key={`breast-milk-${value}`}
                      type="button"
                      onClick={() => applyQuickAmount(value)}
                      className="mobile-touch-target rounded-full bg-white px-2.5 py-1.5 text-[11px] font-medium text-gray-600 transition hover:bg-gray-100 hover:text-gray-900"
                    >
                      {value}ml
                    </button>
                  ))}
                </div>
                <input
                  type="number"
                  inputMode="decimal"
                  value={breastMilkAmount}
                  onChange={(e) => setBreastMilkAmount(e.target.value)}
                  min="0"
                  step="5"
                  className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm outline-none transition focus:border-transparent focus:ring-2 focus:ring-blue-500"
                  placeholder="例如：60"
                />
              </div>
            )}
          </div>
        )}

        {type === 'FORMULA' && (
          <div className="rounded-2xl bg-gray-50/70 p-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <label className="text-sm font-medium text-gray-700">
                奶粉量（毫升）
              </label>
              <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-medium text-gray-500">
                快捷填入
              </span>
            </div>
            <div className="mb-2 flex flex-wrap gap-1.5">
              {[60, 90, 120, 150].map(value => (
                <button
                  key={`formula-${value}`}
                  type="button"
                  onClick={() => applyQuickAmount(value)}
                  className="mobile-touch-target rounded-full bg-white px-2.5 py-1.5 text-[11px] font-medium text-gray-600 transition hover:bg-gray-100 hover:text-gray-900"
                >
                  {value}ml
                </button>
              ))}
            </div>
            <input
              type="number"
              inputMode="decimal"
              value={formulaAmount}
              onChange={(e) => setFormulaAmount(e.target.value)}
              min="0"
              step="5"
              className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm outline-none transition focus:border-transparent focus:ring-2 focus:ring-blue-500"
              placeholder="例如：60"
            />
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-gray-100 bg-white p-2.5 shadow-sm sm:p-3">
        <div className="mb-1 flex items-center justify-between gap-2">
          <label className="block text-sm font-medium text-gray-700">
            <Clock size={14} className="mr-1 inline" />
            记录时间
          </label>
        </div>
        <input
          type="datetime-local"
          value={startTime}
          onChange={(e) => setStartTime(e.target.value)}
          className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm outline-none transition focus:border-transparent focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div className="rounded-2xl border border-gray-100 bg-white p-3.5 shadow-sm sm:p-4">
        <div className="mb-1.5 flex items-center justify-between gap-3">
          <label className="block text-sm font-medium text-gray-700">
            备注（可选）
          </label>
          {notes ? (
            <button
              type="button"
              onClick={() => setNotes('')}
              className="mobile-touch-target rounded-lg bg-gray-50 px-2 py-1 text-[11px] font-medium text-gray-500 transition hover:bg-gray-100 hover:text-gray-700"
            >
              清空
            </button>
          ) : null}
        </div>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          className="w-full resize-none rounded-xl border border-gray-300 px-3.5 py-2.5 text-sm outline-none transition focus:border-transparent focus:ring-2 focus:ring-blue-500"
          placeholder="添加备注..."
        />
      </div>

      <div className="sticky bottom-0 z-10 rounded-2xl border border-gray-100 bg-white/95 p-3 shadow-[0_-8px_24px_rgba(15,23,42,0.08)] backdrop-blur sm:bottom-4 sm:p-3.5 sm:shadow-sm">
        {submitError ? (
          <div className="mb-2.5 rounded-2xl border border-red-100 bg-red-50 px-3.5 py-2.5 text-sm text-red-600" role="alert">
            {submitError}
          </div>
        ) : null}
        {!submitError && validationMessage ? (
          <div className="mb-2.5 rounded-2xl border border-amber-100 bg-amber-50 px-3.5 py-2.5 text-sm text-amber-700">
            {validationMessage}
          </div>
        ) : null}
        <button
          type="submit"
          disabled={!canSubmit}
          className="mobile-touch-target w-full rounded-xl bg-blue-600 px-4 py-3 font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? '保存中...' : validationMessage ? '请先补充必填信息' : '提交记录'}
        </button>
      </div>
    </form>
  )
}
