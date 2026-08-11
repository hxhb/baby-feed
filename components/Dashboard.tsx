'use client'

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { formatBeijingTime, getBeijingToday, extractDateStr, parseDateAsBeijing } from '@/lib/time'
import { invalidateRequestCache } from '@/lib/client-request-cache'
import Link from 'next/link'
import {
  Baby as BabyIcon,
  PlusCircle,
  Droplets,
  Milk,
  Pill,
  Scale,
  Thermometer,
  ChevronRight,
  Ruler,
  ClipboardList
} from 'lucide-react'
import { getRecordIcon, getRecordTitle } from '@/lib/record-display'
import type { DisplayRecord } from '@/lib/record-display'
import { useRecordComposer } from '@/components/RecordComposerProvider'
import { getQuickRecordMeta, type RecordTypeMeta } from '@/components/record-composer/record-types'
import { DEFAULT_QUICK_RECORD_KEYS, type QuickRecordKey } from '@/lib/quick-records'

interface Baby {
  id: string
  name: string
  birthDate: string
  gender: string
}

interface FeedingRecord {
  id: string
  type: string
  startTime: string
  leftBreastDuration?: number | null
  rightBreastDuration?: number | null
  breastMilkAmount?: number | null
  formulaAmount?: number | null
  solidFoodName?: string | null
  solidFoodAmount?: string | null
  adGiven?: boolean | null
  notes?: string | null
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
  vitaminDGiven?: boolean | null
  customName?: string | null
  sleepStartTime?: string | null
  sleepEndTime?: string | null
  sleepQuality?: string | null
  notes?: string | null
  recordType: 'health'
}

interface DailyStats {
  breastFeedingCount: number
  totalBreastDuration: number
  breastBottleCount: number
  totalBreastMilkAmount: number
  formulaCount: number
  totalFormulaAmount: number
  adGiven: boolean
  vitaminDGiven: boolean
  weight?: number
  height?: number
  temperature?: number
  peeCount: number
  poopCount: number
}

interface DashboardMemo {
  id: string
  title: string
  content: string | null
  scheduledAt: string
  completed: boolean
  completedAt: string | null
}

interface Props {
  selectedBabyId?: string | null
  onSelectBaby?: (id: string | null) => void
  initialBabies?: Baby[]
  initialTodayRecords?: FeedingRecord[]
  initialTodayHealthRecords?: HealthRecord[]
  initialRecentMemos?: DashboardMemo[]
  initialQuickRecordKeys?: QuickRecordKey[]
}

const quickRecordToneClasses: Record<RecordTypeMeta['tone'], { button: string; icon: string; text: string }> = {
  pink: { button: 'border-pink-100/60 from-pink-50 to-pink-100/80 focus-visible:ring-pink-500', icon: 'text-pink-500', text: 'text-pink-700' },
  blue: { button: 'border-blue-100/60 from-blue-50 to-blue-100/80 focus-visible:ring-blue-500', icon: 'text-blue-500', text: 'text-blue-700' },
  amber: { button: 'border-amber-100/60 from-amber-50 to-amber-100/80 focus-visible:ring-amber-500', icon: 'text-amber-500', text: 'text-amber-700' },
  violet: { button: 'border-violet-100/60 from-violet-50 to-violet-100/80 focus-visible:ring-violet-500', icon: 'text-violet-500', text: 'text-violet-700' },
  orange: { button: 'border-orange-100/60 from-orange-50 to-orange-100/80 focus-visible:ring-orange-500', icon: 'text-orange-500', text: 'text-orange-700' },
  emerald: { button: 'border-green-100/60 from-green-50 to-green-100/80 focus-visible:ring-emerald-500', icon: 'text-emerald-500', text: 'text-green-700' },
  red: { button: 'border-red-100/60 from-red-50 to-red-100/80 focus-visible:ring-red-500', icon: 'text-red-500', text: 'text-red-700' },
  teal: { button: 'border-teal-100/60 from-teal-50 to-teal-100/80 focus-visible:ring-teal-500', icon: 'text-teal-500', text: 'text-teal-700' },
  indigo: { button: 'border-indigo-100/60 from-indigo-50 to-indigo-100/80 focus-visible:ring-indigo-500', icon: 'text-indigo-500', text: 'text-indigo-700' },
}

function buildDailyStats(feedingData: FeedingRecord[], healthData: HealthRecord[]): DailyStats {
  const latestWeightRecord = healthData.find(r => r.type === 'WEIGHT' && typeof r.weight === 'number')
  const latestHeightRecord = healthData.find(r => r.type === 'HEIGHT' && typeof r.height === 'number')
  const latestTemperatureRecord = healthData.find(r => r.type === 'TEMPERATURE' && typeof r.temperature === 'number')

  return {
    breastFeedingCount: feedingData.filter(r => r.type === 'BREAST_MILK').length,
    totalBreastDuration: feedingData
      .filter(r => r.type === 'BREAST_MILK')
      .reduce((sum, r) => sum + (r.leftBreastDuration || 0) + (r.rightBreastDuration || 0), 0),
    breastBottleCount: feedingData.filter(r => r.type === 'BREAST_MILK_BOTTLE').length,
    totalBreastMilkAmount: feedingData
      .filter(r => r.type === 'BREAST_MILK_BOTTLE')
      .reduce((sum, r) => sum + (r.breastMilkAmount || 0), 0),
    formulaCount: feedingData.filter(r => r.type === 'FORMULA').length,
    totalFormulaAmount: feedingData
      .filter(r => r.type === 'FORMULA')
      .reduce((sum, r) => sum + (r.formulaAmount || 0), 0),
    adGiven: healthData.some(r => r.type === 'AD_VITAMIN' && r.adGiven),
    vitaminDGiven: healthData.some(r => r.type === 'AD_VITAMIN' && r.vitaminDGiven),
    weight: latestWeightRecord?.weight ?? undefined,
    height: latestHeightRecord?.height ?? undefined,
    temperature: latestTemperatureRecord?.temperature ?? undefined,
    peeCount: healthData.filter(r => r.type === 'DIAPER' && (r.diaperType === 'PEE' || r.diaperType === 'BOTH')).length,
    poopCount: healthData.filter(r => r.type === 'DIAPER' && (r.diaperType === 'POOP' || r.diaperType === 'BOTH')).length,
  }
}

export default function Dashboard({
  selectedBabyId,
  onSelectBaby,
  initialBabies = [],
  initialTodayRecords = [],
  initialTodayHealthRecords = [],
  initialRecentMemos = [],
  initialQuickRecordKeys = [...DEFAULT_QUICK_RECORD_KEYS],
}: Props) {
  const { openComposer } = useRecordComposer()
  const [babies, setBabies] = useState<Baby[]>(initialBabies)
  const [internalSelectedBabyId, setInternalSelectedBabyId] = useState<string | null>(initialBabies[0]?.id ?? null)
  const [todayRecords, setTodayRecords] = useState<FeedingRecord[]>(initialTodayRecords)
  const [todayHealthRecords, setTodayHealthRecords] = useState<HealthRecord[]>(initialTodayHealthRecords)
  const [stats, setStats] = useState<DailyStats | null>(
    initialTodayRecords.length > 0 || initialTodayHealthRecords.length > 0
      ? buildDailyStats(initialTodayRecords, initialTodayHealthRecords)
      : null,
  )
  const [loading, setLoading] = useState(initialBabies.length === 0)
  const [freshFetch] = useState(() => {
    if (typeof window !== 'undefined') {
      const savedTs = window.sessionStorage.getItem('record_saved_ts')
      if (savedTs && Date.now() - Number(savedTs) < 10000) {
        return true
      }
    }
    return false
  })
  const preloadedBabyIdRef = useRef<string | null>(selectedBabyId ?? initialBabies[0]?.id ?? null)

  const resolvedSelectedBabyId = selectedBabyId ?? internalSelectedBabyId
  const hasInitialTodayData = !freshFetch && (initialTodayRecords.length > 0 || initialTodayHealthRecords.length > 0)

  const openQuickRecord = (key: QuickRecordKey) => {
    if (key === 'GROUP_FEEDING') {
      openComposer(null, { scope: 'feeding' })
      return
    }
    if (key === 'GROUP_HEALTH') {
      openComposer(null, { scope: 'health' })
      return
    }
    openComposer(key === 'GROUP_MEMO' ? 'MEMO' : key, { patch: { babyId: resolvedSelectedBabyId || '' } })
  }

  // If a record was just saved, invalidate cache to ensure fresh API responses
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedTs = window.sessionStorage.getItem('record_saved_ts')
      if (savedTs && Date.now() - Number(savedTs) < 10000) {
        invalidateRequestCache()
      }
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleSelectBaby = useCallback((id: string | null) => {
    if (onSelectBaby) {
      onSelectBaby(id)
      return
    }
    setInternalSelectedBabyId(id)
  }, [onSelectBaby])

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
        if (data.length > 0 && !resolvedSelectedBabyId) {
          handleSelectBaby(data[0].id)
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
  }, [resolvedSelectedBabyId, handleSelectBaby])

  const fetchTodayData = useCallback(async () => {
    if (!resolvedSelectedBabyId) return

    if (hasInitialTodayData && resolvedSelectedBabyId === preloadedBabyIdRef.current) {
      setTodayRecords(initialTodayRecords)
      setTodayHealthRecords(initialTodayHealthRecords)
      setStats(buildDailyStats(initialTodayRecords, initialTodayHealthRecords))
      return
    }
    
    try {
      const today = getBeijingToday()
      
      const feedingResponse = await fetch(
        `/api/feeding?babyId=${resolvedSelectedBabyId}&date=${today}`
      )
      const feedingDataRaw = feedingResponse.ok ? await feedingResponse.json() : []
      const feedingData: FeedingRecord[] = Array.isArray(feedingDataRaw)
        ? feedingDataRaw.map(r => ({ ...r, recordType: 'feeding' as const }))
        : []
      setTodayRecords(feedingData)

      const healthResponse = await fetch(
        `/api/health?babyId=${resolvedSelectedBabyId}&date=${today}`
      )
      const healthDataRaw = healthResponse.ok ? await healthResponse.json() : []
      const healthData: HealthRecord[] = Array.isArray(healthDataRaw)
        ? healthDataRaw.map(r => ({ ...r, recordType: 'health' as const }))
        : []
      setTodayHealthRecords(healthData)
      setStats(buildDailyStats(feedingData, healthData))
    } catch (error) {
      console.error('获取今日数据失败:', error)
    }
  }, [resolvedSelectedBabyId, hasInitialTodayData, initialTodayHealthRecords, initialTodayRecords])

  useEffect(() => {
    if (initialBabies.length > 0) {
      setBabies(initialBabies)
      setLoading(false)
      if (!resolvedSelectedBabyId) {
        handleSelectBaby(initialBabies[0].id)
      }
      return
    }

    fetchBabies()
  }, [fetchBabies, handleSelectBaby, initialBabies, resolvedSelectedBabyId])

  useEffect(() => {
    fetchTodayData()
  }, [fetchTodayData])

  const calculateAge = (birthDate: string) => {
    const birth = parseDateAsBeijing(birthDate)
    const now = new Date()
    const diffTime = now.getTime() - birth.getTime()
    const totalDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))
    
    let months = (now.getFullYear() - birth.getFullYear()) * 12 + 
                 (now.getMonth() - birth.getMonth())
    let days = now.getDate() - birth.getDate()
    
    if (days < 0) {
      months -= 1
      const prevMonth = new Date(now.getFullYear(), now.getMonth(), 0)
      days += prevMonth.getDate()
    }
    
    if (months <= 0) {
      return `${totalDays + 1}天`
    }
    return `${months}月${days}天·第${totalDays + 1}天`
  }

  const sortedTodayRecords = useMemo(() => {
    return [...todayRecords, ...todayHealthRecords]
      .sort((a, b) => {
        const getTime = (rec: typeof a) => {
          if (rec.recordType === 'feeding') return new Date(rec.startTime).getTime()
          const hr = rec as HealthRecord
          return new Date((hr.type === 'SLEEP' && hr.sleepStartTime) ? hr.sleepStartTime : hr.recordedAt).getTime()
        }
        return getTime(b) - getTime(a)
      })
  }, [todayRecords, todayHealthRecords])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-brand-100 border-t-brand-500"></div>
      </div>
    )
  }

  if (babies.length === 0) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="text-center py-16">
          <BabyIcon size={64} className="mx-auto text-gray-300 mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">还没有添加宝宝</h2>
          <p className="text-gray-600 mb-6">请先添加宝宝信息开始记录</p>
          <Link
            href="/settings"
            className="inline-flex items-center px-6 py-3 gradient-primary text-white rounded-button shadow-elevated hover:opacity-90 transition"
          >
            <PlusCircle size={20} className="mr-2" />
            添加宝宝
          </Link>
        </div>
      </div>
    )
  }

  const selectedBaby = babies.find(b => b.id === resolvedSelectedBabyId)

  return (
    <div className="max-w-4xl mx-auto px-3 sm:px-4 py-4 space-y-4">

      {selectedBaby && (
        <div className="bg-white rounded-card p-4 sm:p-6 shadow-card border border-blue-50">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 sm:w-14 sm:h-14 bg-gradient-to-br from-pink-100 to-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
              <BabyIcon size={24} className="text-blue-600 sm:hidden" />
              <BabyIcon size={28} className="text-blue-600 hidden sm:block" />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-lg sm:text-xl font-bold text-gray-900 truncate">{selectedBaby.name}</h2>
              <p className="text-xs sm:text-sm text-gray-500 whitespace-nowrap overflow-hidden text-ellipsis">
                {calculateAge(selectedBaby.birthDate)} · {extractDateStr(selectedBaby.birthDate).replace(/-/g, '.')}出生
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white rounded-card p-3 shadow-card border border-blue-50">
          <div className="flex items-center justify-between mb-1.5">
            <Droplets size={20} className="text-pink-500" />
            <span className="text-xs text-slate-400 font-medium">母乳</span>
          </div>
          <p className="text-2xl font-extrabold text-slate-900 tracking-tight">
            {(stats?.breastFeedingCount || 0) + (stats?.breastBottleCount || 0)}
          </p>
          <p className="text-xs text-slate-500">
            亲喂{stats?.breastFeedingCount || 0}次 · {stats?.totalBreastDuration || 0}分钟
          </p>
          {(stats?.breastBottleCount || 0) > 0 && (
            <p className="text-xs text-slate-500">
              瓶喂{stats?.breastBottleCount || 0}次（{stats?.totalBreastMilkAmount || 0}ml）
            </p>
          )}
        </div>

        <div className="bg-white rounded-card p-3 shadow-card border border-blue-50">
          <div className="flex items-center justify-between mb-1.5">
            <Milk size={20} className="text-blue-500" />
            <span className="text-xs text-slate-400 font-medium">奶粉</span>
          </div>
          <p className="text-2xl font-extrabold text-slate-900 tracking-tight">{stats?.formulaCount || 0}</p>
          <p className="text-xs text-slate-500">次 · {stats?.totalFormulaAmount || 0}ml</p>
        </div>

        <div className="bg-white rounded-card p-3 shadow-card border border-blue-50">
          <div className="flex items-center justify-between mb-1.5">
            <Pill size={20} className="text-orange-500" />
            <span className="text-xs text-slate-400 font-medium">营养补充</span>
          </div>
          <p className="text-lg font-extrabold text-slate-900">
            AD {stats?.adGiven ? '✓' : '○'} · 维D {stats?.vitaminDGiven ? '✓' : '○'}
          </p>
          <p className="text-xs text-slate-500">今日补充状态</p>
        </div>

        <div className="bg-white rounded-card p-3 shadow-card border border-blue-50">
          <div className="flex items-center justify-between mb-1.5">
            <BabyIcon size={20} className="text-amber-500" />
            <span className="text-xs text-slate-400 font-medium">大小便</span>
          </div>
          <p className="text-2xl font-extrabold text-slate-900 tracking-tight">
            {stats?.peeCount || 0} / {stats?.poopCount || 0}
          </p>
          <p className="text-xs text-slate-500">小便 / 大便</p>
        </div>
      </div>

      {stats && (stats.temperature || stats.weight || stats.height) && (
        <div className="bg-white rounded-card p-3 shadow-card border border-blue-50">
          <h3 className="text-xs font-medium text-gray-500 mb-2">今日健康数据</h3>
          <div className="flex flex-wrap gap-2">
            {stats.temperature && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 rounded-lg">
                <Thermometer size={16} className="text-red-500" />
                <span className="text-sm font-medium text-gray-900">{stats.temperature}°C</span>
              </div>
            )}
            {stats.weight && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-green-50 rounded-lg">
                <Scale size={16} className="text-green-500" />
                <span className="text-sm font-medium text-gray-900">{stats.weight}kg</span>
              </div>
            )}
            {stats.height && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 rounded-lg">
                <Ruler size={16} className="text-blue-500" />
                <span className="text-sm font-medium text-gray-900">{stats.height}cm</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 近3天备忘提醒 - 紧凑控件 */}
      {initialRecentMemos.length > 0 && (
        <div className="bg-white rounded-card p-3 shadow-card border border-indigo-50">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5">
              <ClipboardList size={14} className="text-indigo-500" />
              <h3 className="text-xs font-medium text-gray-500">近期备忘</h3>
            </div>
            <Link href="/stats?tab=memos" className="text-[11px] text-indigo-500 hover:text-indigo-700 transition">
              查看全部
            </Link>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {initialRecentMemos.map(memo => {
              const scheduledTime = new Date(memo.scheduledAt).getTime()
              const now = Date.now()
              const diffMs = scheduledTime - now
              const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24))
              const isOverdue = diffDays < 0
              const isToday = diffDays === 0

              let badgeText: string
              let containerClass: string
              if (isOverdue) {
                badgeText = `逾期${Math.abs(diffDays)}天`
                containerClass = 'bg-red-50 border-red-100'
              } else if (isToday) {
                badgeText = '今天'
                containerClass = 'bg-amber-50 border-amber-100'
              } else {
                badgeText = `${diffDays}天后`
                containerClass = 'bg-indigo-50 border-indigo-100'
              }

              return (
                <div key={memo.id} className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg border ${containerClass}`}>
                  <span className="text-xs text-slate-700 truncate max-w-[8rem]">{memo.title}</span>
                  <span className={`shrink-0 text-[10px] font-bold ${isOverdue ? 'text-red-600' : isToday ? 'text-amber-600' : 'text-indigo-600'}`}>
                    {badgeText}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      <div className="bg-white rounded-card p-4 shadow-card border border-blue-50">
        <h3 className="text-base font-bold text-slate-900 mb-3">快捷记录</h3>
        <div className="grid grid-cols-4 gap-2">
          {initialQuickRecordKeys.map(key => {
            const item = getQuickRecordMeta(key)
            const tone = quickRecordToneClasses[item.tone]
            const Icon = item.icon
            return (
              <button
                key={key}
                type="button"
                onClick={() => openQuickRecord(key)}
                aria-label={`添加${item.label}记录`}
                className={`flex w-full flex-col items-center rounded-button border bg-gradient-to-b py-3 transition hover:shadow-pressed active:scale-95 focus-visible:outline-none focus-visible:ring-2 ${tone.button}`}
              >
                <span className="mb-1.5"><Icon size={22} className={tone.icon} /></span>
                <span className={`max-w-full truncate px-1 text-[11px] font-semibold ${tone.text}`}>{item.label}</span>
              </button>
            )
          })}
        </div>
      </div>

      <div className="bg-white rounded-card p-4 shadow-card border border-blue-50">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-base font-bold text-slate-900">今日记录</h3>
          <Link href="/timeline" className="text-sm text-blue-600 hover:text-blue-700 flex items-center">
            全部 <ChevronRight size={16} />
          </Link>
        </div>

        {todayRecords.length === 0 && todayHealthRecords.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <p>今天还没有记录</p>
            <p className="text-sm mt-1">点击上方快捷按钮开始记录</p>
          </div>
        ) : (
          <div className="space-y-3">
            {sortedTodayRecords
              .map((record) => {
                const time = record.recordType === 'feeding'
                  ? (record as FeedingRecord).startTime
                  : ((record as HealthRecord).type === 'SLEEP' && (record as HealthRecord).sleepStartTime)
                    ? (record as HealthRecord).sleepStartTime!
                    : (record as HealthRecord).recordedAt
                
                return (
                  <div
                    key={record.id}
                    className="flex items-center justify-between p-3 bg-slate-50/80 rounded-element border border-slate-100/60"
                  >
                    <div className="flex items-center space-x-3 min-w-0 flex-1">
                      <div className="w-9 h-9 rounded-full bg-white shadow-sm flex items-center justify-center flex-shrink-0">
                        {getRecordIcon(record.type)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="break-words text-sm font-medium leading-5 text-gray-900">
                          {getRecordTitle(record as DisplayRecord)}
                        </p>
                        <p className="text-xs text-gray-500">
                          {formatBeijingTime(time)}
                          {record.notes && <span className="ml-1 text-gray-400">· {record.notes}</span>}
                        </p>
                      </div>
                    </div>
                  </div>
                )
              })}
          </div>
        )}
      </div>
    </div>
  )
}
