'use client'

import { useState, useEffect, useCallback, useMemo, useRef, memo } from 'react'
import TimelineEditRecordModal from '@/components/TimelineEditRecordModal'
import { format, isToday, isYesterday } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import { formatBeijingTime, getBeijingHour } from '@/lib/time'
import { dedupeRequest, invalidateRequestCache } from '@/lib/client-request-cache'
import type { PreloadedTimelineRecord } from '@/lib/server-timeline'
import Link from 'next/link'
import { 
  Droplets, 
  Milk, 
  Pill,
  Scale,
  Thermometer,
  ChevronLeft,
  ChevronRight,
  Trash2,
  Ruler,
  Syringe,
  Baby as BabyIcon,
  Pencil,
  Moon,
  UtensilsCrossed
} from 'lucide-react'

interface Baby {
  id: string
  name: string
}

interface FeedingRecord {
  id: string
  type: string
  startTime: string
  endTime?: string | null
  leftBreastDuration?: number | null
  rightBreastDuration?: number | null
  breastMilkAmount?: number | null
  formulaAmount?: number | null
  solidFoodName?: string | null
  solidFoodAmount?: string | null
  adGiven?: boolean | null
  notes?: string | null
  babyId: string
  baby?: Baby
  recordType: 'feeding'
}

interface HealthRecord {
  id: string
  type: string
  recordedAt: string
  weight?: number | null
  height?: number | null
  temperature?: number | null
  medicationName?: string | null
  medicationDose?: string | null
  vaccineName?: string | null
  vaccineManufacturer?: string | null
  vaccineDoseNumber?: number | null
  vaccineTotalDoses?: number | null
  diaperType?: string | null
  diaperStatus?: string | null
  adGiven?: boolean | null
  sleepStartTime?: string | null
  sleepEndTime?: string | null
  sleepQuality?: string | null
  notes?: string | null
  babyId: string
  baby?: Baby
  recordType: 'health'
}

type TimelineRecord = FeedingRecord | HealthRecord

interface Props {
  selectedBabyId: string | null
  onSelectBaby: (id: string | null) => void
  initialBabies?: Baby[]
  initialSelectedBabyId?: string | null
  initialDate?: string
  initialRecords?: PreloadedTimelineRecord[]
  initialValidDates?: string[]
}

function buildTimelineCacheKey(babyId: string, dateStr: string) {
  return `timeline:${babyId}:${dateStr}`
}

function buildTimelineDatesCacheKey(babyId: string) {
  return `timeline-dates:${babyId}`
}

function dateStringToBeijingDate(dateStr: string) {
  return new Date(`${dateStr}T12:00:00+08:00`)
}

async function fetchTimelineRecords(babyId: string, dateStr: string) {
  const [feedingResponse, healthResponse] = await Promise.all([
    fetch(`/api/feeding?babyId=${babyId}&date=${dateStr}`),
    fetch(`/api/health?babyId=${babyId}&date=${dateStr}`),
  ])

  const feedingDataRaw = feedingResponse.ok ? await feedingResponse.json() : []
  const healthDataRaw = healthResponse.ok ? await healthResponse.json() : []
  const feedingData = Array.isArray(feedingDataRaw) ? feedingDataRaw : []
  const healthData = Array.isArray(healthDataRaw) ? healthDataRaw : []

  return [
    ...feedingData.map((r: FeedingRecord) => ({ ...r, recordType: 'feeding' as const })),
    ...healthData.map((r: HealthRecord) => ({ ...r, recordType: 'health' as const })),
  ].sort((a, b) => {
    const timeA = new Date(a.recordType === 'feeding' ? a.startTime : a.recordedAt).getTime()
    const timeB = new Date(b.recordType === 'feeding' ? b.startTime : b.recordedAt).getTime()
    return timeB - timeA
  })
}

async function fetchTimelineValidDates(babyId: string) {
  const response = await fetch(`/api/timeline-dates?babyId=${babyId}`)
  if (!response.ok) {
    throw new Error('获取有效日期失败')
  }

  const data = await response.json()
  return Array.isArray(data) ? data.filter((item): item is string => typeof item === 'string') : []
}

function findAdjacentValidDate(validDates: string[], currentDateStr: string, direction: 'prev' | 'next') {
  const currentTs = dateStringToBeijingDate(currentDateStr).getTime()

  if (direction === 'prev') {
    const olderDates = validDates.filter((dateStr) => dateStringToBeijingDate(dateStr).getTime() < currentTs)
    return olderDates[0] ?? null
  }

  const newerDates = [...validDates]
    .filter((dateStr) => dateStringToBeijingDate(dateStr).getTime() > currentTs)
    .sort((a, b) => a.localeCompare(b))
  return newerDates[0] ?? null
}

function formatBreastFeedingDetails(record: FeedingRecord) {
  const parts = [
    record.leftBreastDuration ? `左${record.leftBreastDuration}` : null,
    record.rightBreastDuration ? `右${record.rightBreastDuration}` : null,
  ].filter((part): part is string => Boolean(part))

  if (parts.length === 0) {
    return '母乳亲喂'
  }

  return `母乳亲喂 (${parts.join(' ')}分钟)`
}

function getRecordIcon(type: string) {
  switch (type) {
    case 'BREAST_MILK':
    case 'BREAST_MILK_BOTTLE':
      return <Droplets size={20} className="text-pink-500" />
    case 'FORMULA':
      return <Milk size={20} className="text-blue-500" />
    case 'AD_VITAMIN':
      return <Pill size={20} className="text-orange-500" />
    case 'WEIGHT':
      return <Scale size={20} className="text-green-500" />
    case 'HEIGHT':
      return <Ruler size={20} className="text-blue-500" />
    case 'TEMPERATURE':
      return <Thermometer size={20} className="text-red-500" />
    case 'MEDICATION':
      return <Pill size={20} className="text-purple-500" />
    case 'VACCINE':
      return <Syringe size={20} className="text-teal-500" />
    case 'DIAPER':
      return <BabyIcon size={20} className="text-amber-500" />
    case 'SLEEP':
      return <Moon size={20} className="text-indigo-500" />
    case 'SOLID_FOOD':
      return <UtensilsCrossed size={20} className="text-orange-500" />
    default:
      return null
  }
}

function getRecordTitle(record: TimelineRecord) {
  switch (record.type) {
    case 'BREAST_MILK': {
      const feeding = record as FeedingRecord
      return formatBreastFeedingDetails(feeding)
    }
    case 'BREAST_MILK_BOTTLE': {
      const feeding = record as FeedingRecord
      return `母乳瓶喂 ${feeding.breastMilkAmount}ml`
    }
    case 'FORMULA': {
      const feeding = record as FeedingRecord
      return `奶粉喂养 ${feeding.formulaAmount}ml`
    }
    case 'AD_VITAMIN': {
      const health = record as HealthRecord
      return health.adGiven ? 'AD滴剂已服用' : 'AD滴剂未服用'
    }
    case 'WEIGHT': {
      const health = record as HealthRecord
      return `体重 ${health.weight}kg`
    }
    case 'HEIGHT': {
      const health = record as HealthRecord
      return `身高 ${health.height}cm`
    }
    case 'TEMPERATURE': {
      const health = record as HealthRecord
      return `体温 ${health.temperature}°C`
    }
    case 'MEDICATION': {
      const health = record as HealthRecord
      return `服药 ${health.medicationName} ${health.medicationDose || ''}`
    }
    case 'VACCINE': {
      const health = record as HealthRecord
      return `疫苗 ${health.vaccineName}`
    }
    case 'DIAPER': {
      const health = record as HealthRecord
      const typeText = health.diaperType === 'PEE' ? '小便' : health.diaperType === 'POOP' ? '大便' : '大小便'
      return `${typeText}${health.diaperStatus ? ` (${health.diaperStatus})` : ''}`
    }
    case 'SLEEP': {
      const health = record as HealthRecord
      const sleepStart = health.sleepStartTime ? new Date(health.sleepStartTime) : null
      const sleepEnd = health.sleepEndTime ? new Date(health.sleepEndTime) : null
      if (sleepStart && sleepEnd) {
        const durationMin = Math.round((sleepEnd.getTime() - sleepStart.getTime()) / (60 * 1000))
        const hours = Math.floor(durationMin / 60)
        const mins = durationMin % 60
        return `睡眠 ${hours > 0 ? `${hours}小时` : ''}${mins > 0 ? `${mins}分钟` : ''}`
      }
      return '睡眠记录'
    }
    case 'SOLID_FOOD': {
      const feeding = record as FeedingRecord
      const name = feeding.solidFoodName || '辅食'
      const amount = feeding.solidFoodAmount
      return `${name}${amount ? ` ${amount}` : ''}`
    }
    default:
      return '未知记录'
  }
}

function DeleteConfirmDialog({ 
  onConfirm, 
  onCancel 
}: { 
  onConfirm: () => void
  onCancel: () => void 
}) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
      <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-xl">
        <h3 className="text-lg font-bold text-gray-900 mb-2">确认删除</h3>
        <p className="text-gray-600 mb-6">确定要删除这条记录吗？此操作不可恢复。</p>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 py-2.5 px-4 bg-gray-100 text-gray-700 font-medium rounded-lg hover:bg-gray-200 transition"
          >
            取消
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="flex-1 py-2.5 px-4 bg-red-500 text-white font-medium rounded-lg hover:bg-red-600 transition"
          >
            删除
          </button>
        </div>
      </div>
    </div>
  )
}

const TimelineRecordItem = memo(function TimelineRecordItem({
  record,
  onEdit,
  onDelete,
}: {
  record: TimelineRecord
  onEdit: (record: TimelineRecord) => void
  onDelete: (id: string, type: 'feeding' | 'health') => void
}) {
  const time = record.recordType === 'feeding' ? record.startTime : record.recordedAt
  const isFeeding = record.recordType === 'feeding'

  return (
    <div className="flex items-center justify-between p-3 sm:p-4 hover:bg-gray-50 transition">
      <div className="flex items-center space-x-3 min-w-0 flex-1">
        <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
          {getRecordIcon(record.type)}
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-medium text-gray-900 text-sm truncate">{getRecordTitle(record)}</p>
          <p className="text-xs text-gray-500">
            {formatBeijingTime(time)}
            {record.notes && <span className="ml-1 text-gray-400">· {record.notes}</span>}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-1 flex-shrink-0 ml-2">
        <button type="button" onClick={() => onEdit(record)} className="p-2 text-gray-400 hover:text-blue-500 transition" title="编辑">
          <Pencil size={15} />
        </button>
        <button type="button" onClick={() => onDelete(record.id, isFeeding ? 'feeding' : 'health')} className="p-2 text-gray-400 hover:text-red-500 transition" title="删除">
          <Trash2 size={15} />
        </button>
      </div>
    </div>
  )
})

const TimelineRecordSection = memo(function TimelineRecordSection({
  label,
  records,
  onEdit,
  onDelete,
}: {
  label: string
  records: TimelineRecord[]
  onEdit: (record: TimelineRecord) => void
  onDelete: (id: string, type: 'feeding' | 'health') => void
}) {
  if (records.length === 0) return null

  return (
    <div>
      <div className="flex items-center gap-2 px-3 pt-3 pb-1">
        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{label}</span>
        <div className="flex-1 h-px bg-gray-100"></div>
        <span className="text-xs text-gray-400">{records.length}条</span>
      </div>
      <div className="divide-y divide-gray-100">
        {records.map((record) => (
          <TimelineRecordItem key={record.id} record={record} onEdit={onEdit} onDelete={onDelete} />
        ))}
      </div>
    </div>
  )
})

export default function TimelineComponent({
  selectedBabyId,
  onSelectBaby,
  initialBabies = [],
  initialSelectedBabyId = null,
  initialDate,
  initialRecords = [],
  initialValidDates = [],
}: Props) {
  const [babies, setBabies] = useState<Baby[]>(initialBabies)
  const [records, setRecords] = useState<TimelineRecord[]>(initialRecords)
  const [validDates, setValidDates] = useState<string[]>(initialValidDates)
  const [loading, setLoading] = useState(initialBabies.length === 0)
  const [isFetchingRecords, setIsFetchingRecords] = useState(false)
  const [currentDate, setCurrentDate] = useState(() => (
    initialDate ? new Date(`${initialDate}T12:00:00+08:00`) : new Date()
  ))
  const [isCalendarOpen, setIsCalendarOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; type: 'feeding' | 'health' } | null>(null)
  const [editingRecord, setEditingRecord] = useState<TimelineRecord | null>(null)
  const [saving, setSaving] = useState(false)
  const latestRequestKeyRef = useRef<string | null>(null)
  const datePickerWrapperRef = useRef<HTMLDivElement | null>(null)
  const calendarInputRef = useRef<HTMLInputElement | null>(null)
  const currentDateStr = format(currentDate, 'yyyy-MM-dd')
  const hasInitialRecords = !!initialDate && selectedBabyId === initialSelectedBabyId && currentDateStr === initialDate
  const hasInitialValidDates = selectedBabyId === initialSelectedBabyId

  const fetchBabies = useCallback(async () => {
    try {
      const response = await fetch('/api/babies')
      if (!response.ok) {
        console.error('获取婴儿列表失败')
        setBabies([])
        return
      }
      const data = await response.json()
      if (Array.isArray(data)) {
        setBabies(data)
        if (data.length > 0 && !selectedBabyId) {
          onSelectBaby(data[0].id)
        }
      } else {
        setBabies([])
      }
    } catch (error) {
      console.error('获取婴儿列表失败:', error)
      setBabies([])
    } finally {
      setLoading(false)
    }
  }, [selectedBabyId, onSelectBaby])

  const fetchRecordsForDate = useCallback(async (
    babyId: string,
    dateStr: string,
    options?: { applyResult?: boolean; background?: boolean }
  ) => {
    const cacheKey = buildTimelineCacheKey(babyId, dateStr)
    const shouldApplyResult = options?.applyResult ?? true
    const isBackground = options?.background ?? false
    const requestKey = `${babyId}:${dateStr}`

    if (shouldApplyResult && !isBackground) {
      latestRequestKeyRef.current = requestKey
      setIsFetchingRecords(true)
    }

    try {
      const allRecords = await dedupeRequest(cacheKey, () => fetchTimelineRecords(babyId, dateStr))
      if (shouldApplyResult && latestRequestKeyRef.current === requestKey) {
        setRecords(allRecords)
      }
      return allRecords
    } catch (error) {
      console.error('获取记录失败:', error)
      return null
    } finally {
      if (shouldApplyResult && !isBackground && latestRequestKeyRef.current === requestKey) {
        setIsFetchingRecords(false)
      }
    }
  }, [])

  const fetchValidDates = useCallback(async (babyId: string) => {
    try {
      const cacheKey = buildTimelineDatesCacheKey(babyId)
      const data = await dedupeRequest(cacheKey, () => fetchTimelineValidDates(babyId))
      setValidDates(data)
      return data
    } catch (error) {
      console.error('获取有效日期失败:', error)
      setValidDates([])
      return []
    }
  }, [])

  const syncDateToNearestValid = useCallback(async (babyId: string, nextValidDates?: string[]) => {
    const availableDates = nextValidDates ?? validDates
    if (availableDates.length === 0) {
      setRecords([])
      return
    }

    if (availableDates.includes(currentDateStr)) {
      return
    }

    const newerDate = findAdjacentValidDate(availableDates, currentDateStr, 'next')
    const olderDate = findAdjacentValidDate(availableDates, currentDateStr, 'prev')
    const targetDateStr = newerDate ?? olderDate ?? availableDates[0]

    if (!targetDateStr || targetDateStr === currentDateStr) {
      return
    }

    setCurrentDate(dateStringToBeijingDate(targetDateStr))
    await fetchRecordsForDate(babyId, targetDateStr)
  }, [currentDateStr, fetchRecordsForDate, validDates])

  const prefetchDate = useCallback((babyId: string, dateStr: string) => {
    void fetchRecordsForDate(babyId, dateStr, { applyResult: false, background: true })
  }, [fetchRecordsForDate])

  const prefetchAdjacentDates = useCallback((babyId: string, centerDateStr: string) => {
    const previousDateStr = findAdjacentValidDate(validDates, centerDateStr, 'prev')
    const nextDateStr = findAdjacentValidDate(validDates, centerDateStr, 'next')

    if (previousDateStr) {
      prefetchDate(babyId, previousDateStr)
    }

    if (nextDateStr) {
      prefetchDate(babyId, nextDateStr)
    }
  }, [prefetchDate, validDates])

  useEffect(() => {
    if (initialBabies.length > 0) {
      setBabies(initialBabies)
      setLoading(false)
      if (!selectedBabyId) {
        onSelectBaby(initialBabies[0].id)
      }
      return
    }

    fetchBabies()
  }, [fetchBabies, initialBabies, onSelectBaby, selectedBabyId])

  useEffect(() => {
    if (!selectedBabyId) return

    if (hasInitialValidDates) {
      setValidDates(initialValidDates)
      return
    }

    void fetchValidDates(selectedBabyId)
  }, [fetchValidDates, hasInitialValidDates, initialValidDates, selectedBabyId])

  useEffect(() => {
    if (!selectedBabyId) return

    if (hasInitialRecords) {
      setRecords(initialRecords)
      prefetchAdjacentDates(selectedBabyId, currentDateStr)
      return
    }

    void fetchRecordsForDate(selectedBabyId, currentDateStr)
  }, [selectedBabyId, currentDateStr, hasInitialRecords, initialRecords, fetchRecordsForDate, prefetchAdjacentDates])

  useEffect(() => {
    if (!selectedBabyId || isFetchingRecords) return
    prefetchAdjacentDates(selectedBabyId, currentDateStr)
  }, [selectedBabyId, currentDateStr, isFetchingRecords, prefetchAdjacentDates])

  useEffect(() => {
    if (!selectedBabyId || isFetchingRecords) return
    void syncDateToNearestValid(selectedBabyId)
  }, [currentDateStr, isFetchingRecords, selectedBabyId, syncDateToNearestValid, validDates])

  useEffect(() => {
    if (!isCalendarOpen) {
      return
    }

    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      if (!datePickerWrapperRef.current) {
        return
      }

      const target = event.target
      if (target instanceof Node && !datePickerWrapperRef.current.contains(target)) {
        setIsCalendarOpen(false)
      }
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsCalendarOpen(false)
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('touchstart', handlePointerDown)
    document.addEventListener('keydown', handleEscape)

    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('touchstart', handlePointerDown)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [isCalendarOpen])

  const handleDeleteClick = useCallback((id: string, type: 'feeding' | 'health') => {
    setDeleteTarget({ id, type })
  }, [])

  const handleDeleteConfirm = async () => {
    if (!deleteTarget || !selectedBabyId) return

    try {
      const endpoint = deleteTarget.type === 'feeding' 
        ? `/api/feeding/${deleteTarget.id}` 
        : `/api/health/${deleteTarget.id}`
      const response = await fetch(endpoint, { method: 'DELETE' })
      
      if (response.ok) {
        invalidateRequestCache(`timeline:${selectedBabyId}:`)
        invalidateRequestCache(buildTimelineDatesCacheKey(selectedBabyId))
        const nextValidDates = await fetchValidDates(selectedBabyId)
        await syncDateToNearestValid(selectedBabyId, nextValidDates)
      }
    } catch (error) {
      console.error('删除失败:', error)
    } finally {
      setDeleteTarget(null)
    }
  }

  const handleEditStart = useCallback((record: TimelineRecord) => {
    setEditingRecord(record)
  }, [])

  const handleEditCancel = useCallback(() => {
    setEditingRecord(null)
  }, [])

  const handleEditSave = async (data: Record<string, unknown>) => {
    if (!editingRecord || !selectedBabyId) return

    setSaving(true)
    try {
      const isFeeding = editingRecord.recordType === 'feeding'
      const endpoint = isFeeding 
        ? `/api/feeding/${editingRecord.id}` 
        : `/api/health/${editingRecord.id}`
      
      const response = await fetch(endpoint, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      })

      if (response.ok) {
        setEditingRecord(null)
        invalidateRequestCache(`timeline:${selectedBabyId}:`)
        invalidateRequestCache(buildTimelineDatesCacheKey(selectedBabyId))
        const nextValidDates = await fetchValidDates(selectedBabyId)
        await syncDateToNearestValid(selectedBabyId, nextValidDates)
      } else {
        const err = await response.json()
        alert(err.error || '保存失败')
      }
    } catch (error) {
      console.error('更新失败:', error)
      alert('保存失败，请重试')
    } finally {
      setSaving(false)
    }
  }

  const handleBabyHover = useCallback((babyId: string) => {
    prefetchDate(babyId, currentDateStr)
  }, [currentDateStr, prefetchDate])

  const goToPreviousDay = useCallback(() => {
    const previousDateStr = findAdjacentValidDate(validDates, currentDateStr, 'prev')
    if (!previousDateStr) {
      return
    }

    if (selectedBabyId) {
      prefetchDate(selectedBabyId, previousDateStr)
    }

    setCurrentDate(dateStringToBeijingDate(previousDateStr))
  }, [currentDateStr, prefetchDate, selectedBabyId, validDates])

  const goToNextDay = useCallback(() => {
    const nextDateStr = findAdjacentValidDate(validDates, currentDateStr, 'next')
    if (!nextDateStr) {
      return
    }

    if (selectedBabyId) {
      prefetchDate(selectedBabyId, nextDateStr)
    }

    setCurrentDate(dateStringToBeijingDate(nextDateStr))
  }, [currentDateStr, prefetchDate, selectedBabyId, validDates])

  const handleCalendarDateChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const nextDateStr = event.target.value
    if (!nextDateStr || nextDateStr === currentDateStr || !validDates.includes(nextDateStr)) {
      return
    }

    if (selectedBabyId) {
      prefetchAdjacentDates(selectedBabyId, nextDateStr)
    }

    setCurrentDate(dateStringToBeijingDate(nextDateStr))
    setIsCalendarOpen(false)
  }, [currentDateStr, prefetchAdjacentDates, selectedBabyId, validDates])

  const openCalendarPicker = useCallback(() => {
    const input = calendarInputRef.current as (HTMLInputElement & { showPicker?: () => void }) | null
    if (!input) {
      setIsCalendarOpen(true)
      return
    }

    if (typeof input.showPicker === 'function') {
      input.showPicker()
      return
    }

    setIsCalendarOpen(true)
  }, [])

  const formatDateLabel = (date: Date) => {
    if (isToday(date)) return '今天'
    if (isYesterday(date)) return '昨天'
    return format(date, 'M月d日 EEEE', { locale: zhCN })
  }

  const groupedRecords = useMemo(() => {
    const morning: TimelineRecord[] = []
    const afternoon: TimelineRecord[] = []

    records.forEach(record => {
      const time = record.recordType === 'feeding'
        ? (record as FeedingRecord).startTime
        : (record as HealthRecord).recordedAt
      const hour = getBeijingHour(time)
      if (hour < 12) {
        morning.push(record)
      } else {
        afternoon.push(record)
      }
    })

    return { morning, afternoon }
  }, [records])

  const timelineSummary = useMemo(() => {
    let breastFeedingCount = 0
    let breastBottleCount = 0
    let totalBreastMilkBottleAmount = 0
    let totalFormulaAmount = 0
    let peeCount = 0
    let poopCount = 0
    let hasAdVitamin = false

    records.forEach((record) => {
      if (record.type === 'BREAST_MILK') {
        breastFeedingCount += 1
        return
      }

      if (record.type === 'BREAST_MILK_BOTTLE') {
        breastBottleCount += 1
        totalBreastMilkBottleAmount += (record as FeedingRecord).breastMilkAmount || 0
        return
      }

      if (record.type === 'FORMULA') {
        totalFormulaAmount += (record as FeedingRecord).formulaAmount || 0
        return
      }

      if (record.type === 'DIAPER') {
        const diaperType = (record as HealthRecord).diaperType || ''
        if (diaperType === 'PEE' || diaperType === 'BOTH') {
          peeCount += 1
        }
        if (diaperType === 'POOP' || diaperType === 'BOTH') {
          poopCount += 1
        }
        return
      }

      if (record.type === 'AD_VITAMIN' && (record as HealthRecord).adGiven) {
        hasAdVitamin = true
      }
    })

    return {
      breastFeedingCount,
      breastBottleCount,
      totalBreastMilkBottleAmount,
      totalFormulaAmount,
      peeCount,
      poopCount,
      hasAdVitamin,
    }
  }, [records])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (babies.length === 0) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="text-center py-16">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">还没有添加宝宝</h2>
          <p className="text-gray-600 mb-6">请先添加宝宝信息开始记录</p>
          <Link href="/settings" className="inline-flex items-center px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition">
            添加宝宝
          </Link>
        </div>
      </div>
    )
  }

  const { morning, afternoon } = groupedRecords
  const previousValidDate = findAdjacentValidDate(validDates, currentDateStr, 'prev')
  const nextValidDate = findAdjacentValidDate(validDates, currentDateStr, 'next')

  return (
    <div className="max-w-4xl mx-auto px-3 sm:px-4 py-4 space-y-4">
      {babies.length > 1 && (
        <div className="mobile-scroll-row flex gap-2 overflow-x-auto pb-2 -mx-1 px-1">
          {babies.map(baby => (
            <button
              key={baby.id}
              onClick={() => onSelectBaby(baby.id)}
              onMouseEnter={() => handleBabyHover(baby.id)}
              onFocus={() => handleBabyHover(baby.id)}
              onTouchStart={() => handleBabyHover(baby.id)}
              className={`mobile-touch-target rounded-full whitespace-nowrap px-4 py-2.5 text-sm transition ${
                baby.id === selectedBabyId
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              {baby.name}
            </button>
          ))}
        </div>
      )}

      <div className="bg-white rounded-2xl p-3 shadow-sm">
        <div className="flex items-center justify-between gap-2">
          <button
            onClick={goToPreviousDay}
            onMouseEnter={() => {
              if (!selectedBabyId || !previousValidDate) return
              prefetchDate(selectedBabyId, previousValidDate)
            }}
            onFocus={() => {
              if (!selectedBabyId || !previousValidDate) return
              prefetchDate(selectedBabyId, previousValidDate)
            }}
            onTouchStart={() => {
              if (!selectedBabyId || !previousValidDate) return
              prefetchDate(selectedBabyId, previousValidDate)
            }}
            disabled={!previousValidDate}
            className={`mobile-touch-target inline-flex flex-shrink-0 items-center justify-center rounded-xl transition ${
              previousValidDate
                ? 'bg-gray-50 text-gray-700 hover:bg-gray-100'
                : 'cursor-not-allowed bg-gray-50 text-gray-300'
            }`}
          >
            <ChevronLeft size={22} />
          </button>
          <div ref={datePickerWrapperRef} className="relative min-w-0 flex-1 text-center">
            <div className="px-2 py-1.5">
              <h2 className="text-base font-bold text-gray-900">{formatDateLabel(currentDate)}</h2>
              <button
                type="button"
                onClick={openCalendarPicker}
                className="mt-1 inline-flex rounded-lg px-2 py-1 text-xs text-gray-500 transition hover:bg-gray-50 hover:text-gray-700"
                aria-expanded={isCalendarOpen}
                aria-haspopup="dialog"
              >
                {format(currentDate, 'yyyy年MM月dd日')}
              </button>
              <input
                ref={calendarInputRef}
                type="date"
                value={currentDateStr}
                min={validDates[validDates.length - 1] || currentDateStr}
                max={validDates[0] || currentDateStr}
                onChange={handleCalendarDateChange}
                list="timeline-valid-dates"
                className="sr-only"
                tabIndex={-1}
                aria-hidden="true"
              />
            </div>

            {isCalendarOpen && (
              <div className="absolute left-1/2 top-full z-20 mt-2 w-full max-w-xs -translate-x-1/2 rounded-2xl border border-gray-100 bg-white p-3 text-left shadow-xl">
                <div className="mb-2">
                  <p className="text-sm font-semibold text-gray-900">快捷切换日期</p>
                  <p className="mt-1 text-xs text-gray-500">只支持切换到已有记录的日期</p>
                </div>
                <input
                  type="date"
                  value={currentDateStr}
                  min={validDates[validDates.length - 1] || currentDateStr}
                  max={validDates[0] || currentDateStr}
                  onChange={handleCalendarDateChange}
                  list="timeline-valid-dates"
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-700 outline-none transition focus:border-blue-500 focus:bg-white"
                />
                <datalist id="timeline-valid-dates">
                  {validDates.map((dateStr) => (
                    <option key={dateStr} value={dateStr} />
                  ))}
                </datalist>
                <div className="mt-2 flex flex-wrap gap-2">
                  {validDates.slice(0, 6).map((dateStr) => (
                    <button
                      key={dateStr}
                      type="button"
                      onClick={() => {
                        if (dateStr === currentDateStr) {
                          setIsCalendarOpen(false)
                          return
                        }
                        if (selectedBabyId) {
                          prefetchAdjacentDates(selectedBabyId, dateStr)
                        }
                        setCurrentDate(dateStringToBeijingDate(dateStr))
                        setIsCalendarOpen(false)
                      }}
                      className={`rounded-full px-3 py-1.5 text-xs transition ${
                        dateStr === currentDateStr
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {formatDateLabel(dateStringToBeijingDate(dateStr))}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
          <button
            onClick={goToNextDay}
            onMouseEnter={() => {
              if (!selectedBabyId || !nextValidDate) return
              prefetchDate(selectedBabyId, nextValidDate)
            }}
            onFocus={() => {
              if (!selectedBabyId || !nextValidDate) return
              prefetchDate(selectedBabyId, nextValidDate)
            }}
            onTouchStart={() => {
              if (!selectedBabyId || !nextValidDate) return
              prefetchDate(selectedBabyId, nextValidDate)
            }}
            disabled={!nextValidDate}
            className={`mobile-touch-target inline-flex flex-shrink-0 items-center justify-center rounded-xl transition ${
              nextValidDate
                ? 'bg-gray-50 text-gray-700 hover:bg-gray-100'
                : 'cursor-not-allowed bg-gray-50 text-gray-300'
            }`}
          >
            <ChevronRight size={22} />
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl p-3 shadow-sm">
        <h3 className="font-bold text-gray-900 mb-2 text-sm">当日统计</h3>
        <div className="grid grid-cols-4 gap-2 text-center">
          <div>
            <p className="text-xl font-bold text-pink-600">{timelineSummary.breastFeedingCount + timelineSummary.breastBottleCount}</p>
            <p className="text-xs text-gray-500">母乳</p>
            <p className="text-[10px] text-gray-400 leading-tight mt-0.5">亲喂{timelineSummary.breastFeedingCount}次</p>
            {timelineSummary.breastBottleCount > 0 && (
              <p className="text-[10px] text-gray-400 leading-tight">瓶喂{timelineSummary.breastBottleCount}次（{timelineSummary.totalBreastMilkBottleAmount}ml）</p>
            )}
          </div>
          <div>
            <p className="text-xl font-bold text-blue-600">{timelineSummary.totalFormulaAmount}</p>
            <p className="text-xs text-gray-500">奶粉(ml)</p>
          </div>
          <div>
            <p className="text-xl font-bold text-amber-600">
              {timelineSummary.peeCount}
              {'/'}
              {timelineSummary.poopCount}
            </p>
            <p className="text-xs text-gray-500">小便/大便</p>
          </div>
          <div>
            <p className="text-xl font-bold text-orange-600">{timelineSummary.hasAdVitamin ? '✓' : '○'}</p>
            <p className="text-xs text-gray-500">AD</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-3 pt-3 pb-1 min-h-8">
          <div className="text-xs text-gray-400">共 {records.length} 条记录</div>
          {isFetchingRecords && (
            <div className="inline-flex items-center gap-1.5 text-xs text-blue-500">
              <span className="inline-block h-2 w-2 rounded-full bg-blue-500 animate-pulse" />
              正在加载记录...
            </div>
          )}
        </div>

        <div className={isFetchingRecords ? 'opacity-70 transition-opacity' : 'transition-opacity'}>
          {records.length === 0 ? (
            <div className="text-center py-10 text-gray-500">
              <p>这一天没有记录</p>
            </div>
          ) : (
            <div>
              <TimelineRecordSection label="下午" records={afternoon} onEdit={handleEditStart} onDelete={handleDeleteClick} />
              <TimelineRecordSection label="上午" records={morning} onEdit={handleEditStart} onDelete={handleDeleteClick} />
            </div>
          )}
        </div>
      </div>

      {deleteTarget && (
        <DeleteConfirmDialog onConfirm={handleDeleteConfirm} onCancel={() => setDeleteTarget(null)} />
      )}

      {editingRecord && (
        <TimelineEditRecordModal record={editingRecord} onSave={handleEditSave} onCancel={handleEditCancel} saving={saving} />
      )}
    </div>
  )
}
