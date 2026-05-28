'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getBeijingNow, toBeijingISO } from '@/lib/time'
import { invalidateRecordRelatedCaches } from '@/lib/cache-helpers'
import { buildHealthRecordPayload, buildVaccineSuggestions, findSelectedVaccineSuggestion, type HealthFieldValues, type HealthType, type VaccineSuggestion } from '@/lib/health-records'
import HealthRecordFields, { getHealthFieldValidationMessage } from '@/components/HealthRecordFields'
import RecordActionBar from '@/components/RecordActionBar'
import RecordTabBar, { type ActiveTab } from '@/components/RecordTabBar'
import CategorySelector, { type CategoryOption } from '@/components/CategorySelector'
import { getCategoryColorClasses } from '@/lib/category-colors'
import { RecordNotesField, RecordTimeField } from '@/components/RecordMetaFields'
import {
  Scale,
  Thermometer,
  Pill,
  Ruler,
  Syringe,
  Baby as BabyIcon,
  Moon
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

interface HealthDraft {
  type: HealthType
  weight: string
  height: string
  temperature: string
  medicationName: string
  medicationDose: string
  vaccineName: string
  vaccineManufacturer: string
  vaccineDoseNumber: string
  vaccineTotalDoses: string
  diaperType: 'PEE' | 'POOP' | 'BOTH'
  diaperStatus: string
  adGiven: boolean
}

interface Props {
  initialType?: 'WEIGHT' | 'HEIGHT' | 'TEMPERATURE' | 'MEDICATION' | 'VACCINE' | 'DIAPER' | 'AD_VITAMIN' | 'SLEEP'
  initialBabies?: BabyInfo[]
  initialSharedDraft?: SharedDraft
  onSharedDraftChange?: (draft: SharedDraft) => void
  onRecordSaved?: () => void
  activeTab: ActiveTab
  onTabChange: (tab: ActiveTab) => void
}

const HEALTH_DRAFT_STORAGE_KEY = 'baby-feed:add-record-health-draft'
const emptyHealthDraft: HealthDraft = {
  type: 'WEIGHT',
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
  adGiven: true
}


export default function HealthForm({
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
  const [type, setType] = useState<HealthType>(initialType || 'WEIGHT')
  const [weight, setWeight] = useState('')
  const [height, setHeight] = useState('')
  const [temperature, setTemperature] = useState('')
  const [medicationName, setMedicationName] = useState('')
  const [medicationDose, setMedicationDose] = useState('')
  const [vaccineName, setVaccineName] = useState('')
  const [vaccineManufacturer, setVaccineManufacturer] = useState('')
  const [vaccineDoseNumber, setVaccineDoseNumber] = useState('')
  const [vaccineTotalDoses, setVaccineTotalDoses] = useState('')
  const [vaccineSuggestions, setVaccineSuggestions] = useState<VaccineSuggestion[]>([])
  const [vaccineSuggestionsLoading, setVaccineSuggestionsLoading] = useState(false)
  const [selectedVaccineSuggestionKey, setSelectedVaccineSuggestionKey] = useState('')
  const [diaperType, setDiaperType] = useState<'PEE' | 'POOP' | 'BOTH'>('PEE')
  const [diaperStatus, setDiaperStatus] = useState('')
  const [adGiven, setAdGiven] = useState(true)
  const [sleepStartTime, setSleepStartTime] = useState('')
  const [sleepEndTime, setSleepEndTime] = useState('')
  const [recordedAt, setRecordedAt] = useState(initialSharedDraft?.eventTime || getBeijingNow())

  // When type is SLEEP, bind recordedAt to sleepEndTime
  const handleSleepEndTimeChange = (value: string) => {
    setSleepEndTime(value)
    if (value) {
      setRecordedAt(value)
    }
  }
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
    if (initialType) {
      setType(initialType)
    }
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
    setRecordedAt(currentRecordedAt => currentRecordedAt || initialSharedDraft.eventTime || getBeijingNow())
    setNotes(currentNotes => currentNotes || initialSharedDraft.notes)
  }, [initialSharedDraft])

  useEffect(() => {
    onSharedDraftChange?.({
      babyId,
      eventTime: recordedAt,
      notes
    })
  }, [babyId, recordedAt, notes, onSharedDraftChange])

  useEffect(() => {
    if (hasHydratedLocalDraft.current) {
      return
    }

    hasHydratedLocalDraft.current = true

    try {
      const rawDraft = window.sessionStorage.getItem(HEALTH_DRAFT_STORAGE_KEY)
      if (!rawDraft) {
        return
      }

      const parsedDraft = JSON.parse(rawDraft) as Partial<HealthDraft>
      if (parsedDraft.type) {
        setType(parsedDraft.type)
      }
      if (typeof parsedDraft.weight === 'string') {
        setWeight(parsedDraft.weight)
      }
      if (typeof parsedDraft.height === 'string') {
        setHeight(parsedDraft.height)
      }
      if (typeof parsedDraft.temperature === 'string') {
        setTemperature(parsedDraft.temperature)
      }
      if (typeof parsedDraft.medicationName === 'string') {
        setMedicationName(parsedDraft.medicationName)
      }
      if (typeof parsedDraft.medicationDose === 'string') {
        setMedicationDose(parsedDraft.medicationDose)
      }
      if (typeof parsedDraft.vaccineName === 'string') {
        setVaccineName(parsedDraft.vaccineName)
      }
      if (typeof parsedDraft.vaccineManufacturer === 'string') {
        setVaccineManufacturer(parsedDraft.vaccineManufacturer)
      }
      if (typeof parsedDraft.vaccineDoseNumber === 'string') {
        setVaccineDoseNumber(parsedDraft.vaccineDoseNumber)
      }
      if (typeof parsedDraft.vaccineTotalDoses === 'string') {
        setVaccineTotalDoses(parsedDraft.vaccineTotalDoses)
      }
      if (parsedDraft.diaperType === 'PEE' || parsedDraft.diaperType === 'POOP' || parsedDraft.diaperType === 'BOTH') {
        setDiaperType(parsedDraft.diaperType)
      }
      if (typeof parsedDraft.diaperStatus === 'string') {
        setDiaperStatus(parsedDraft.diaperStatus)
      }
      if (typeof parsedDraft.adGiven === 'boolean') {
        setAdGiven(parsedDraft.adGiven)
      }
    } catch (error) {
      console.error('读取健康草稿失败:', error)
    }
  }, [])

  useEffect(() => {
    try {
      const nextDraft: HealthDraft = {
        type,
        weight,
        height,
        temperature,
        medicationName,
        medicationDose,
        vaccineName,
        vaccineManufacturer,
        vaccineDoseNumber,
        vaccineTotalDoses,
        diaperType,
        diaperStatus,
        adGiven
      }

      const isEmptyDraft =
        nextDraft.type === emptyHealthDraft.type &&
        !nextDraft.weight &&
        !nextDraft.height &&
        !nextDraft.temperature &&
        !nextDraft.medicationName &&
        !nextDraft.medicationDose &&
        !nextDraft.vaccineName &&
        !nextDraft.vaccineManufacturer &&
        !nextDraft.vaccineDoseNumber &&
        !nextDraft.vaccineTotalDoses &&
        nextDraft.diaperType === emptyHealthDraft.diaperType &&
        !nextDraft.diaperStatus &&
        nextDraft.adGiven === emptyHealthDraft.adGiven

      if (isEmptyDraft) {
        window.sessionStorage.removeItem(HEALTH_DRAFT_STORAGE_KEY)
        return
      }

      window.sessionStorage.setItem(HEALTH_DRAFT_STORAGE_KEY, JSON.stringify(nextDraft))
    } catch (error) {
      console.error('保存健康草稿失败:', error)
    }
  }, [type, weight, height, temperature, medicationName, medicationDose, vaccineName, vaccineManufacturer, vaccineDoseNumber, vaccineTotalDoses, diaperType, diaperStatus, adGiven])

  useEffect(() => {
    if (!submitError) {
      return
    }

    setSubmitError('')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [babyId, type, weight, height, temperature, medicationName, medicationDose, vaccineName, vaccineManufacturer, vaccineDoseNumber, vaccineTotalDoses, diaperType, diaperStatus, adGiven, recordedAt, notes])

  useEffect(() => {
    if (type !== 'VACCINE' || !babyId) {
      setVaccineSuggestions([])
      setVaccineSuggestionsLoading(false)
      return
    }

    let cancelled = false

    const fetchVaccineSuggestions = async () => {
      setVaccineSuggestionsLoading(true)

      try {
        const response = await fetch(`/api/health?babyId=${babyId}&type=VACCINE`)
        if (!response.ok) {
          throw new Error('获取疫苗记录失败')
        }

        const data = await response.json()
        if (!Array.isArray(data) || cancelled) {
          return
        }

        setVaccineSuggestions(buildVaccineSuggestions(data))
      } catch (error) {
        console.error('获取疫苗快捷候选失败:', error)
        if (!cancelled) {
          setVaccineSuggestions([])
        }
      } finally {
        if (!cancelled) {
          setVaccineSuggestionsLoading(false)
        }
      }
    }

    fetchVaccineSuggestions()

    return () => {
      cancelled = true
    }
  }, [babyId, type])

  useEffect(() => {
    const matchedSuggestion = findSelectedVaccineSuggestion(vaccineSuggestions, {
      vaccineName,
      vaccineManufacturer,
      vaccineDoseNumber,
      vaccineTotalDoses,
    })

    setSelectedVaccineSuggestionKey(matchedSuggestion?.key || '')
  }, [vaccineDoseNumber, vaccineManufacturer, vaccineName, vaccineSuggestions, vaccineTotalDoses])

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

    return getHealthFieldValidationMessage(type, {
      weight,
      height,
      temperature,
      medicationName,
      medicationDose,
      vaccineName,
      vaccineManufacturer,
      vaccineDoseNumber,
      vaccineTotalDoses,
      diaperType,
      diaperStatus,
      adGiven,
      sleepStartTime,
      sleepEndTime,
      sleepQuality: '',
    })
  }

  const fieldValues: HealthFieldValues = {
    weight,
    height,
    temperature,
    medicationName,
    medicationDose,
    vaccineName,
    vaccineManufacturer,
    vaccineDoseNumber,
    vaccineTotalDoses,
    diaperType,
    diaperStatus,
    adGiven,
    sleepStartTime,
    sleepEndTime,
    sleepQuality: '',
  }

  const handleApplyVaccineSuggestion = (suggestion: VaccineSuggestion) => {
    setVaccineName(suggestion.vaccineName)
    setVaccineManufacturer(suggestion.vaccineManufacturer)
    setVaccineDoseNumber(String(suggestion.nextDoseNumber))
    setVaccineTotalDoses(String(suggestion.totalDoses))
  }

  const validationMessage = getValidationMessage()
  const canSubmit = babies.length > 0 && !loading && !validationMessage

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
        recordedAt: toBeijingISO(recordedAt),
        notes: notes.trim() || null,
        ...buildHealthRecordPayload(type, fieldValues),
      }

      const response = await fetch('/api/health', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      })

      if (response.ok) {
        saved = true
      } else {
        const error = await response.json()
        const message = error.error || '保存失败'
        setSubmitError(message)
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
      window.sessionStorage.removeItem(HEALTH_DRAFT_STORAGE_KEY)
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

  const typeOptions: CategoryOption[] = [
    { key: 'WEIGHT', label: '体重', icon: Scale, color: 'green' },
    { key: 'HEIGHT', label: '身高', icon: Ruler, color: 'blue' },
    { key: 'TEMPERATURE', label: '体温', icon: Thermometer, color: 'red' },
    { key: 'AD_VITAMIN', label: 'AD', icon: Pill, color: 'orange' },
    { key: 'MEDICATION', label: '服药', icon: Pill, color: 'purple' },
    { key: 'VACCINE', label: '疫苗', icon: Syringe, color: 'teal' },
    { key: 'DIAPER', label: '大小便', icon: BabyIcon, color: 'amber' },
    { key: 'SLEEP', label: '睡眠', icon: Moon, color: 'indigo' },
  ]

  const selectedTypeMeta = typeOptions.find(option => option.key === type) ?? typeOptions[0]
  const selectedTypeClasses = getCategoryColorClasses(selectedTypeMeta.color, true)
  const ActiveTypeIcon = selectedTypeMeta.icon

  const healthTypeHints: Record<string, string> = {
    WEIGHT: '建议固定时段测量更方便对比。',
    HEIGHT: '建议在相近姿势下测量，便于后续观察变化。',
    TEMPERATURE: '正常范围建议填写 35°C 到 42°C 之间的数值。',
    AD_VITAMIN: '适合快速打卡，避免遗漏每日补充记录。',
    MEDICATION: '建议至少记录药物名称，后续回看会更清晰。',
    VACCINE: '记录疫苗名称和针次进度，方便以后核对接种情况。',
    DIAPER: '记录排便状态，方便观察宝宝日常情况。',
    SLEEP: '记录宝宝入睡和醒来时间，追踪睡眠规律。',
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

      {/* 二级分类：健康子类型 */}
      <div className="rounded-2xl border border-gray-100 bg-white p-3.5 shadow-sm sm:p-4">
        <div className="mb-2 flex items-center justify-between gap-3">
          <label className="block text-sm font-medium text-gray-700">
            健康类型
          </label>
          <div className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium sm:hidden ${selectedTypeClasses.bg} ${selectedTypeClasses.text}`}>
            <ActiveTypeIcon size={14} className={selectedTypeClasses.icon} />
            {selectedTypeMeta.label}
          </div>
        </div>
        <CategorySelector
          options={typeOptions}
          value={type}
          onChange={(key) => setType(key as HealthType)}
          gridCols="grid-cols-4 sm:grid-cols-8"
        />
      </div>

      <div className="rounded-2xl border border-gray-100 bg-white p-3.5 shadow-sm sm:p-4">
        <div className="mb-3 flex items-center gap-3">
          <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl ${selectedTypeClasses.bg}`}>
            <ActiveTypeIcon size={18} className={selectedTypeClasses.icon} />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-gray-900 sm:text-base">编辑记录信息</h3>
            <p className="text-xs text-gray-500 sm:text-sm">{healthTypeHints[type] ?? healthTypeHints.WEIGHT}</p>
          </div>
        </div>

        <HealthRecordFields
          type={type}
          mode="create"
          validationMessage={validationMessage}
          vaccineSuggestions={vaccineSuggestions}
          vaccineSuggestionsLoading={vaccineSuggestionsLoading}
          selectedVaccineSuggestionKey={selectedVaccineSuggestionKey}
          onApplyVaccineSuggestion={handleApplyVaccineSuggestion}
          values={fieldValues}
          setters={{
            setWeight,
            setHeight,
            setTemperature,
            setMedicationName,
            setMedicationDose,
            setVaccineName,
            setVaccineManufacturer,
            setVaccineDoseNumber,
            setVaccineTotalDoses,
            setDiaperType,
            setDiaperStatus,
            setAdGiven,
            setSleepStartTime,
            setSleepEndTime: handleSleepEndTimeChange,
          }}
        />
      </div>

      {type !== 'SLEEP' ? (
        <RecordTimeField
          mode="create"
          value={recordedAt}
          onChange={setRecordedAt}
        />
      ) : null}

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
