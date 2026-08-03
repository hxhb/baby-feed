'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getBeijingNow, toBeijingISO } from '@/lib/time'
import { invalidateRecordRelatedCaches } from '@/lib/cache-helpers'
import { buildFeedingRecordPayload, getFeedingValidationMessage, getBreastModeFromType, type BreastMode, type FeedingFieldValues, type FeedingType } from '@/lib/feeding-records'
import FeedingRecordFields from '@/components/FeedingRecordFields'
import RecordActionBar from '@/components/RecordActionBar'
import RecordTabBar, { type ActiveTab } from '@/components/RecordTabBar'
import { RecordNotesField, RecordTimeField } from '@/components/RecordMetaFields'
import CategorySelector, { type CategoryOption } from '@/components/CategorySelector'
import { getCategoryColorClasses } from '@/lib/category-colors'
import {
  Droplets,
  Milk,
  UtensilsCrossed
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
  breastMode: BreastMode
  leftBreastDuration: string
  rightBreastDuration: string
  breastMilkAmount: string
  formulaAmount: string
  solidFoodName: string
  solidFoodAmount: string
}

interface Props {
  initialType: 'breast' | 'breast_bottle' | 'formula' | 'solid_food' | null
  initialBabies?: BabyInfo[]
  initialSharedDraft?: SharedDraft
  onSharedDraftChange?: (draft: SharedDraft) => void
  onRecordSaved?: () => void
  activeTab: ActiveTab
  onTabChange: (tab: ActiveTab) => void
}

const FEEDING_DRAFT_STORAGE_KEY = 'baby-feed:add-record-feeding-draft'
const emptyFeedingDraft: FeedingDraft = {
  breastMode: 'direct',
  leftBreastDuration: '',
  rightBreastDuration: '',
  breastMilkAmount: '',
  formulaAmount: '',
  solidFoodName: '',
  solidFoodAmount: '',
}


export default function FeedingForm({
  initialType,
  initialBabies = [],
  initialSharedDraft,
  onSharedDraftChange,
  onRecordSaved,
  activeTab,
  onTabChange
}: Props) {
  const router = useRouter()
  const [babies, setBabies] = useState<BabyInfo[]>(initialBabies)
  const [loading, setLoading] = useState(false)
  const [submitError, setSubmitError] = useState('')

  const [babyId, setBabyId] = useState('')
  const [type, setType] = useState<FeedingType>(
    initialType === 'formula' ? 'FORMULA' : initialType === 'breast_bottle' ? 'BREAST_MILK_BOTTLE' : initialType === 'solid_food' ? 'SOLID_FOOD' : 'BREAST_MILK'
  )
  const [breastMode, setBreastMode] = useState<BreastMode>(
    initialType === 'breast_bottle' ? 'bottle' : 'direct'
  )
  const [leftBreastDuration, setLeftBreastDuration] = useState('')
  const [rightBreastDuration, setRightBreastDuration] = useState('')
  const [breastMilkAmount, setBreastMilkAmount] = useState('')
  const [formulaAmount, setFormulaAmount] = useState('')
  const [solidFoodName, setSolidFoodName] = useState('')
  const [solidFoodAmount, setSolidFoodAmount] = useState('')
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

    if (initialType === 'solid_food') {
      setBreastMode('direct')
      setType('SOLID_FOOD')
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

    // Skip draft restoration when a specific non-breast type is explicitly requested via URL
    const isExplicitNonBreastType = initialType === 'solid_food' || initialType === 'formula'

    try {
      const rawDraft = window.sessionStorage.getItem(FEEDING_DRAFT_STORAGE_KEY)
      if (!rawDraft) {
        return
      }

      const parsedDraft = JSON.parse(rawDraft) as Partial<FeedingDraft>
      if (!isExplicitNonBreastType && (parsedDraft.breastMode === 'direct' || parsedDraft.breastMode === 'bottle')) {
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
      if (typeof parsedDraft.solidFoodName === 'string') {
        setSolidFoodName(parsedDraft.solidFoodName)
      }
      if (typeof parsedDraft.solidFoodAmount === 'string') {
        setSolidFoodAmount(parsedDraft.solidFoodAmount)
      }
    } catch (error) {
      console.error('读取喂养草稿失败:', error)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    try {
      const nextDraft: FeedingDraft = {
        breastMode,
        leftBreastDuration,
        rightBreastDuration,
        breastMilkAmount,
        formulaAmount,
        solidFoodName,
        solidFoodAmount
      }

      const isEmptyDraft =
        nextDraft.breastMode === emptyFeedingDraft.breastMode &&
        !nextDraft.leftBreastDuration &&
        !nextDraft.rightBreastDuration &&
        !nextDraft.breastMilkAmount &&
        !nextDraft.formulaAmount &&
        !nextDraft.solidFoodName &&
        !nextDraft.solidFoodAmount

      if (isEmptyDraft) {
        window.sessionStorage.removeItem(FEEDING_DRAFT_STORAGE_KEY)
        return
      }

      window.sessionStorage.setItem(FEEDING_DRAFT_STORAGE_KEY, JSON.stringify(nextDraft))
    } catch (error) {
      console.error('保存喂养草稿失败:', error)
    }
  }, [breastMode, leftBreastDuration, rightBreastDuration, breastMilkAmount, formulaAmount, solidFoodName, solidFoodAmount])

  useEffect(() => {
    if (!submitError) {
      return
    }

    setSubmitError('')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [babyId, type, breastMode, leftBreastDuration, rightBreastDuration, breastMilkAmount, formulaAmount, solidFoodName, solidFoodAmount, startTime, notes])

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

  const fieldValues: FeedingFieldValues = {
    leftBreastDuration,
    rightBreastDuration,
    breastMilkAmount,
    formulaAmount,
    solidFoodName,
    solidFoodAmount,
  }

  const getValidationMessage = () => {
    if (!babyId) {
      return '请先选择宝宝'
    }

    return getFeedingValidationMessage(type, fieldValues)
  }

  const validationMessage = getValidationMessage()
  const canSubmit = babies.length > 0 && !loading && !validationMessage

  const feedingTypeOptions: CategoryOption[] = [
    {
      key: 'BREAST',
      label: '母乳',
      icon: Droplets,
      color: 'pink',
    },
    {
      key: 'FORMULA',
      label: '奶粉',
      icon: Milk,
      color: 'blue',
    },
    {
      key: 'SOLID_FOOD',
      label: '辅食',
      icon: UtensilsCrossed,
      color: 'orange',
    },
  ]

  const selectedFeedingKey = type === 'BREAST_MILK' || type === 'BREAST_MILK_BOTTLE' ? 'BREAST' : type

  const handleFeedingTypeChange = (key: string) => {
    if (key === 'BREAST') {
      setType(breastMode === 'bottle' ? 'BREAST_MILK_BOTTLE' : 'BREAST_MILK')
    } else {
      setType(key as FeedingType)
    }
  }

  const currentTypeMeta = type === 'FORMULA'
    ? { title: '奶粉', hint: '适合快速记录奶量，常用数值可以直接一键填写。', color: 'blue' as const, icon: Milk }
    : type === 'SOLID_FOOD'
      ? { title: '辅食', hint: '记录辅食种类和量，追踪宝宝辅食添加进度。', color: 'orange' as const, icon: UtensilsCrossed }
      : breastMode === 'bottle'
        ? { title: '母乳瓶喂', hint: '可直接使用常用奶量捷径，减少重复输入。', color: 'pink' as const, icon: Droplets }
        : { title: '母乳亲喂', hint: '左右时长可分开记录，方便回顾本次喂养情况。', color: 'pink' as const, icon: Droplets }

  const CurrentTypeIcon = currentTypeMeta.icon
  const currentColorClasses = getCategoryColorClasses(currentTypeMeta.color, true)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const currentValidationMessage = getValidationMessage()
    if (currentValidationMessage) {
      setSubmitError(currentValidationMessage)
      return
    }

    setLoading(true)

    let saved = false
    try {
      const data: Record<string, unknown> = {
        babyId,
        type,
        startTime: toBeijingISO(startTime),
        notes: notes.trim() || null,
        ...buildFeedingRecordPayload(type, fieldValues)
      }

      const response = await fetch('/api/feeding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      })

      if (response.ok) {
        saved = true
      } else {
        const error = await response.json()
        setSubmitError(error.error || '保存失败')
      }
    } catch (error) {
      console.error('保存失败:', error)
      setSubmitError('保存失败，请重试')
    } finally {
      setLoading(false)
    }

    // 保存成功后的跳转操作放在 try 外部，避免 router 异常触发假失败
    if (saved) {
      invalidateRecordRelatedCaches(babyId)
      window.sessionStorage.removeItem(FEEDING_DRAFT_STORAGE_KEY)
      window.sessionStorage.setItem('record_saved_ts', String(Date.now()))
      onRecordSaved?.()
      try {
        router.replace('/')
        router.refresh()
      } catch {
        // 导航错误不影响已保存的结果
      }
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3.5 pb-3 sm:space-y-4 sm:pb-0">
      {/* 一级分类：喂养 / 健康 / 备忘 */}
      <div className="rounded-2xl border border-gray-100 bg-white p-3.5 shadow-sm sm:p-4">
        <label className="mb-1.5 block text-sm font-medium text-gray-700">
          记录类型
        </label>
        <RecordTabBar activeTab={activeTab} onTabChange={onTabChange} />
      </div>

      {/* 二级分类：喂养子类型 */}
      <div className="rounded-2xl border border-gray-100 bg-white p-3.5 shadow-sm sm:p-4">
        <div className="mb-2 flex items-center justify-between gap-3">
          <label className="block text-sm font-medium text-gray-700">
            喂养类型
          </label>
          <div className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium sm:hidden ${currentColorClasses.bg} ${currentColorClasses.text}`}>
            <CurrentTypeIcon size={14} className={currentColorClasses.icon} />
            {currentTypeMeta.title}
          </div>
        </div>
        <CategorySelector
          options={feedingTypeOptions}
          value={selectedFeedingKey}
          onChange={handleFeedingTypeChange}
          gridCols="grid-cols-3"
        />
      </div>

      <div className="rounded-2xl border border-gray-100 bg-white p-3.5 shadow-sm sm:p-4">
        <div className="mb-3 flex items-center gap-3">
          <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl ${currentColorClasses.bg}`}>
            <CurrentTypeIcon size={18} className={currentColorClasses.icon} />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-gray-900 sm:text-base">编辑记录信息</h3>
            <p className="text-xs text-gray-500 sm:text-sm">{currentTypeMeta.hint}</p>
          </div>
        </div>

        <FeedingRecordFields
          type={type}
          breastMode={breastMode}
          mode="create"
          values={fieldValues}
          setters={{
            setType: (nextType) => {
              setType(nextType)
              setBreastMode(getBreastModeFromType(nextType))
            },
            setBreastMode,
            setLeftBreastDuration,
            setRightBreastDuration,
            setBreastMilkAmount,
            setFormulaAmount,
            setSolidFoodName,
            setSolidFoodAmount,
          }}
        />
      </div>

      <RecordTimeField
        mode="create"
        value={startTime}
        onChange={setStartTime}
      />

      <RecordNotesField
        mode="create"
        value={notes}
        onChange={setNotes}
      />

      <RecordActionBar
        mode="create"
        submitError={submitError}
        validationMessage={validationMessage}
        primaryLabel={validationMessage ? '请先补充必填信息' : '提交记录'}
        loadingLabel="保存中..."
        loading={loading}
        disabled={!canSubmit}
      />
    </form>
  )
}
