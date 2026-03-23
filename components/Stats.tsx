'use client'

import { cloneElement, isValidElement, useState, useEffect, useCallback, useRef, type ReactElement } from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  LineChart,
  Line,
  Legend,
  LabelList,
} from 'recharts'
import { Baby as BabyIcon, ChartColumn, Clock, Droplets, Milk, Moon, Pill, Ruler, Scale, Syringe, Thermometer, TrendingUp } from 'lucide-react'
import { dedupeRequest } from '@/lib/client-request-cache'
import type { PreloadedStatsData } from '@/lib/server-stats'
import { StatsEmptyState, StatsPanel, StatsSegmentedTabs } from '@/components/StatsUi'

interface Baby {
  id: string
  name: string
}

type StatsData = PreloadedStatsData

interface Props {
  selectedBabyId: string | null
  onSelectBaby: (id: string | null) => void
  initialBabies?: Baby[]
  initialStats?: PreloadedStatsData | null
}

type MeasuredChartElement = ReactElement<{
  width?: number
  height?: number
}>

function StableResponsiveChart({
  className,
  children,
}: {
  className: string
  children: MeasuredChartElement
}) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [size, setSize] = useState({ width: 0, height: 0 })

  useEffect(() => {
    const node = containerRef.current
    if (!node) {
      return
    }

    const updateSize = () => {
      const { width, height } = node.getBoundingClientRect()
      setSize(prev => {
        const nextWidth = Math.floor(width)
        const nextHeight = Math.floor(height)

        if (prev.width === nextWidth && prev.height === nextHeight) {
          return prev
        }

        return {
          width: nextWidth,
          height: nextHeight,
        }
      })
    }

    updateSize()

    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', updateSize)
      return () => window.removeEventListener('resize', updateSize)
    }

    const observer = new ResizeObserver(() => updateSize())
    observer.observe(node)

    return () => observer.disconnect()
  }, [])

  const isReady = size.width > 0 && size.height > 0

  return (
    <div ref={containerRef} className={className} style={{ outline: 'none' }}>
      {isReady && isValidElement(children)
        ? cloneElement(children, {
            width: size.width,
            height: size.height,
          })
        : <div className="h-full w-full rounded-xl bg-white/40" />}
    </div>
  )
}

export default function StatsComponent({
  selectedBabyId,
  onSelectBaby,
  initialBabies = [],
  initialStats = null,
}: Props) {
  const formatTrendAxisDate = (value: number) => {
    const date = new Date(value)
    return `${date.getMonth() + 1}/${date.getDate()}`
  }

  const formatTrendTooltipLabel = (value: number) => {
    const date = new Date(value)
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
  }

  const formatMinutes = (minutes: number) => {
    if (minutes < 60) {
      return `${minutes}分钟`
    }

    const hours = Math.floor(minutes / 60)
    const remainingMinutes = minutes % 60
    if (remainingMinutes === 0) {
      return `${hours}小时`
    }

    return `${hours}小时${remainingMinutes}分钟`
  }

  const formatRecordedSummaryTime = (value: string) => {
    const date = new Date(value)
    return `${date.getMonth() + 1}月${date.getDate()}日 ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
  }

  const formatVaccineProgress = (doseNumber?: number | null, totalDoses?: number | null) => {
    if (!doseNumber || !totalDoses) {
      return null
    }

    return `第${doseNumber}/${totalDoses}针`
  }

  const palette = {
    sky: '#0ea5e9',
    blue: '#2563eb',
    indigo: '#4f46e5',
    teal: '#0f766e',
    emerald: '#059669',
    amber: '#d97706',
  }

  const [babies, setBabies] = useState<Baby[]>(initialBabies)
  const [stats, setStats] = useState<StatsData | null>(initialStats)
  const [loading, setLoading] = useState(initialBabies.length === 0)
  const [days, setDays] = useState(7)
  const [activeSubpage, setActiveSubpage] = useState<'dashboard' | 'insights'>('dashboard')
  const hasInitialStats = !!initialStats && selectedBabyId === initialStats.baby.id && days === 7

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

  const fetchStats = useCallback(async () => {
    if (!selectedBabyId) return

    if (hasInitialStats) {
      setStats(initialStats)
      return
    }
    
    try {
      const cacheKey = `stats:${selectedBabyId}:${days}`
      const data = await dedupeRequest(cacheKey, async () => {
        const response = await fetch(`/api/stats?babyId=${selectedBabyId}&days=${days}`)
        if (!response.ok) {
          throw new Error('获取统计数据失败')
        }
        return response.json()
      })
      setStats(data)
    } catch (error) {
      console.error('获取统计数据失败:', error)
    }
  }, [selectedBabyId, days, hasInitialStats, initialStats])

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
    fetchStats()
  }, [fetchStats])

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
        <StatsPanel className="py-16 text-center">
          <h2 className="mb-2 text-2xl font-bold text-gray-900">还没有添加宝宝</h2>
          <p className="text-gray-600">请先添加宝宝信息查看统计数据</p>
        </StatsPanel>
      </div>
    )
  }

  const chartData = stats?.lastDays.map(day => {
    const parts = day.date.split('-')
    return {
      date: `${parseInt(parts[1])}/${parseInt(parts[2])}`,
      母乳时长: day.totalBreastDuration,
      母乳瓶喂量: day.totalBreastMilkAmount,
      奶粉量: day.totalFormulaAmount,
    }
  }) || []

  const weightData = (stats?.weightTrend || []).map(p => {
    return {
      timestamp: new Date(p.recordedAt).getTime(),
      label: formatTrendAxisDate(new Date(p.recordedAt).getTime()),
      体重: p.weight
    }
  })

  const heightData = (stats?.heightTrend || []).map(p => {
    return {
      timestamp: new Date(p.recordedAt).getTime(),
      label: formatTrendAxisDate(new Date(p.recordedAt).getTime()),
      身高: p.height
    }
  })

  const latestWeightRecord = stats?.weightTrend[stats.weightTrend.length - 1] || null
  const previousWeightRecord = stats && stats.weightTrend.length > 1 ? stats.weightTrend[stats.weightTrend.length - 2] : null
  const latestHeightRecord = stats?.heightTrend[stats.heightTrend.length - 1] || null
  const previousHeightRecord = stats && stats.heightTrend.length > 1 ? stats.heightTrend[stats.heightTrend.length - 2] : null
  const latestVaccineRecord = stats?.vaccineRecords[0] || null
  const totalMilkAmount = (stats?.totalStats.totalBreastMilkAmount || 0) + (stats?.totalStats.totalFormulaAmount || 0)
  const activeFeedingDays = stats?.lastDays.filter(day => (
    day.totalBreastDuration > 0 ||
    day.totalBreastMilkAmount > 0 ||
    day.totalFormulaAmount > 0
  )).length || 0
  const totalBreastfeedingSessions = stats?.lastDays.reduce((sum, day) => sum + day.breastFeedingCount, 0) || 0
  const totalBreastMilkBottleSessions = stats?.lastDays.reduce((sum, day) => sum + day.breastBottleCount, 0) || 0
  const totalFormulaSessions = stats?.lastDays.reduce((sum, day) => sum + day.formulaCount, 0) || 0

  const averageMilkPerActiveDay = activeFeedingDays > 0 ? Math.round(totalMilkAmount / activeFeedingDays) : 0
  const averageFeedingsPerActiveDay = activeFeedingDays > 0
    ? (stats?.totalStats.totalFeedings || 0) / activeFeedingDays
    : 0
  const peakMilkIntakeDay = stats?.lastDays.reduce<StatsData['lastDays'][number] | null>((best, day) => {
    const currentTotal = day.totalBreastMilkAmount + day.totalFormulaAmount
    const bestTotal = best ? best.totalBreastMilkAmount + best.totalFormulaAmount : -1
    if (!best || currentTotal > bestTotal) {
      return day
    }
    return best
  }, null) || null
  const maxBreastfeedingDay = stats?.lastDays.reduce<StatsData['lastDays'][number] | null>((best, day) => {
    if (!best || day.totalBreastDuration > best.totalBreastDuration) {
      return day
    }
    return best
  }, null) || null
  const latestTemperatureDay = [...(stats?.lastDays || [])].reverse().find(day => typeof day.temperature === 'number') || null
  const maxTemperatureDay = stats?.lastDays.reduce<StatsData['lastDays'][number] | null>((best, day) => {
    if (typeof day.temperature !== 'number') {
      return best
    }
    if (!best || typeof best.temperature !== 'number' || day.temperature > best.temperature) {
      return day
    }
    return best
  }, null) || null
  const temperatureRecordCount = stats?.lastDays.filter(day => typeof day.temperature === 'number').length || 0
  const adGivenDays = stats?.lastDays.filter(day => day.adGiven).length || 0
  const overallWeightChange = latestWeightRecord && stats && stats.weightTrend.length > 1
    ? Number((latestWeightRecord.weight - stats.weightTrend[0].weight).toFixed(2))
    : null
  const latestWeightChange = latestWeightRecord && previousWeightRecord
    ? Number((latestWeightRecord.weight - previousWeightRecord.weight).toFixed(2))
    : null
  const overallHeightChange = latestHeightRecord && stats && stats.heightTrend.length > 1
    ? Number((latestHeightRecord.height - stats.heightTrend[0].height).toFixed(1))
    : null
  const latestHeightChange = latestHeightRecord && previousHeightRecord
    ? Number((latestHeightRecord.height - previousHeightRecord.height).toFixed(1))
    : null
  const totalPeeCount = stats?.lastDays.reduce((sum, day) => sum + day.peeCount, 0) || 0
  const totalPoopCount = stats?.lastDays.reduce((sum, day) => sum + day.poopCount, 0) || 0
  const diaperActiveDays = stats?.lastDays.filter(day => day.peeCount > 0 || day.poopCount > 0).length || 0
  const averagePeePerActiveDay = diaperActiveDays > 0 ? totalPeeCount / diaperActiveDays : 0
  const averagePoopPerActiveDay = diaperActiveDays > 0 ? totalPoopCount / diaperActiveDays : 0
  const peakDiaperDay = stats?.lastDays.reduce<StatsData['lastDays'][number] | null>((best, day) => {
    const currentTotal = day.peeCount + day.poopCount
    const bestTotal = best ? best.peeCount + best.poopCount : -1
    if (!best || currentTotal > bestTotal) {
      return day
    }
    return best
  }, null) || null
  const latestDiaperDay = [...(stats?.lastDays || [])].reverse().find(day => day.peeCount > 0 || day.poopCount > 0) || null

  // --- New insight computations ---

  // Night feeding stats (22:00 - 06:00)
  const totalNightFeedings = stats?.lastDays.reduce((sum, day) => sum + day.nightFeedingCount, 0) || 0
  const nightFeedingActiveDays = stats?.lastDays.filter(day => day.nightFeedingCount > 0).length || 0

  // Left/right breast ratio
  const totalLeftBreast = stats?.lastDays.reduce((sum, day) => sum + day.leftBreastDuration, 0) || 0
  const totalRightBreast = stats?.lastDays.reduce((sum, day) => sum + day.rightBreastDuration, 0) || 0
  const totalBreastTime = totalLeftBreast + totalRightBreast
  const leftBreastPct = totalBreastTime > 0 ? Math.round((totalLeftBreast / totalBreastTime) * 100) : 0
  const rightBreastPct = totalBreastTime > 0 ? 100 - leftBreastPct : 0

  // Feeding intervals
  const feedingIntervals = stats?.feedingIntervals || []
  const avgFeedingInterval = feedingIntervals.length > 0
    ? Math.round(feedingIntervals.reduce((a, b) => a + b, 0) / feedingIntervals.length)
    : 0
  const maxFeedingInterval = feedingIntervals.length > 0 ? Math.max(...feedingIntervals) : 0

  // Consecutive no-poop days (count from today backwards)
  const consecutiveNoPoopDays = (() => {
    const reversed = [...(stats?.lastDays || [])].reverse()
    let count = 0
    for (const day of reversed) {
      if (day.poopCount > 0) break
      count++
    }
    return count
  })()

  // Baby age in days
  const babyAgeDays = (() => {
    const birthDate = stats?.babyBirthDate
    if (!birthDate) return null
    const birth = new Date(birthDate)
    const now = new Date()
    return Math.floor((now.getTime() - birth.getTime()) / (1000 * 60 * 60 * 24))
  })()

  const babyAgeLabel = (() => {
    if (babyAgeDays === null) return null
    if (babyAgeDays < 30) return `${babyAgeDays}天`
    const months = Math.floor(babyAgeDays / 30)
    const remainDays = babyAgeDays % 30
    if (months < 12) return remainDays > 0 ? `${months}个月${remainDays}天` : `${months}个月`
    const years = Math.floor(months / 12)
    const remainMonths = months % 12
    return remainMonths > 0 ? `${years}岁${remainMonths}个月` : `${years}岁`
  })()

  // AD consecutive streak (from today backwards)
  const adConsecutiveStreak = (() => {
    const reversed = [...(stats?.lastDays || [])].reverse()
    let count = 0
    for (const day of reversed) {
      if (!day.adGiven) break
      count++
    }
    return count
  })()

  const adMissedRecently = (() => {
    const reversed = [...(stats?.lastDays || [])].reverse()
    let count = 0
    for (const day of reversed) {
      if (day.adGiven) break
      count++
    }
    return count
  })()

  // Temperature normal range ratio
  const normalTempDays = stats?.lastDays.filter(day =>
    typeof day.temperature === 'number' && day.temperature >= 36 && day.temperature <= 37.5
  ).length || 0
  const abnormalTempDays = stats?.lastDays.filter(day =>
    typeof day.temperature === 'number' && (day.temperature < 36 || day.temperature > 37.5)
  ).length || 0

  // Medication records
  const medicationRecords = stats?.medicationRecords || []
  const uniqueMedications = [...new Set(medicationRecords.map(r => r.medicationName))]

  // Daily milk amount standard deviation (feeding regularity)
  const dailyMilkAmounts = (stats?.lastDays || [])
    .map(day => day.totalBreastMilkAmount + day.totalFormulaAmount)
    .filter(amount => amount > 0)
  const milkAmountStdDev = (() => {
    if (dailyMilkAmounts.length < 2) return null
    const mean = dailyMilkAmounts.reduce((a, b) => a + b, 0) / dailyMilkAmounts.length
    const variance = dailyMilkAmounts.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / dailyMilkAmounts.length
    return Math.round(Math.sqrt(variance))
  })()
  const feedingRegularity = (() => {
    if (milkAmountStdDev === null || averageMilkPerActiveDay === 0) return null
    const cv = milkAmountStdDev / averageMilkPerActiveDay
    if (cv < 0.15) return '非常稳定'
    if (cv < 0.3) return '较为稳定'
    if (cv < 0.5) return '波动一般'
    return '波动较大'
  })()

  const chartTabs = [
    {
      key: 'breastfeeding' as const,
      label: '母乳',
      description: '亲喂时长 + 瓶喂母乳量',
      empty: false,
    },
    {
      key: 'formula' as const,
      label: '奶粉',
      description: '查看每日奶粉摄入量',
      empty: chartData.every(day => day.奶粉量 === 0),
    },
    {
      key: 'weight' as const,
      label: '体重',
      description: '按记录时间查看增长轨迹',
      empty: weightData.length === 0,
    },
    {
      key: 'height' as const,
      label: '身高',
      description: '按记录时间查看身高变化',
      empty: heightData.length === 0,
    },
  ]
  const subpageTabs = [
    {
      key: 'dashboard',
      label: '趋势与疫苗',
      description: '查看趋势工作台与疫苗记录',
    },
    {
      key: 'insights',
      label: '数据洞察',
      description: '查看喂养、成长与健康洞察',
    },
  ]
  const vaccineProgressSummary = Object.values(
    (stats?.vaccineRecords || []).reduce<Record<string, {
      vaccineName: string
      latestDoseNumber: number | null
      totalDoses: number | null
      latestRecordedAt: string
      latestDate: string
      doseEntries: {
        id: string
        recordedAt: string
        doseNumber: number | null
        totalDoses: number | null
        note: string | null
      }[]
      isCompleted: boolean
      remainingDoses: number | null
    }>>((acc, record) => {
      const key = record.vaccineName.trim().toLowerCase()
      const existing = acc[key]
      const doseNumber = record.vaccineDoseNumber ?? null
      const totalDoses = record.vaccineTotalDoses ?? null
      const isCompleted = !!doseNumber && !!totalDoses && doseNumber >= totalDoses
      const remainingDoses = !!doseNumber && !!totalDoses && doseNumber < totalDoses
        ? totalDoses - doseNumber
        : 0
      const doseEntry = {
        id: record.id,
        recordedAt: record.recordedAt,
        doseNumber,
        totalDoses,
        note: record.notes?.trim() || null,
      }

      if (!existing) {
        acc[key] = {
          vaccineName: record.vaccineName,
          latestDoseNumber: doseNumber,
          totalDoses,
          latestRecordedAt: record.recordedAt,
          latestDate: record.date,
          doseEntries: [doseEntry],
          isCompleted,
          remainingDoses,
        }
        return acc
      }

      existing.doseEntries.push(doseEntry)
      return acc
    }, {})
  ).map(item => ({
    ...item,
    doseEntries: [...item.doseEntries].sort((a, b) => new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime()),
  }))
  const pendingVaccines = vaccineProgressSummary.filter(item => item.remainingDoses && item.remainingDoses > 0)
  const totalVaccineTypes = vaccineProgressSummary.length
  const completedVaccineTypes = vaccineProgressSummary.filter(v => v.isCompleted).length
  const recentVaccineCard = (
    <div className="rounded-2xl border border-teal-100 bg-gradient-to-br from-teal-50/80 to-white p-2.5 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-teal-600">
          <Syringe size={13} />
          <p className="text-[13px] font-bold">疫苗进度</p>
        </div>
        {totalVaccineTypes > 0 && (
          <div className="flex items-center gap-1.5">
            {pendingVaccines.length > 0 && (
              <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] font-bold text-amber-700">待完成{pendingVaccines.length}种</span>
            )}
            <span className="rounded-full bg-teal-100 px-1.5 py-0.5 text-[9px] font-bold text-teal-700">{completedVaccineTypes}/{totalVaccineTypes}种</span>
          </div>
        )}
      </div>

      {totalVaccineTypes > 0 ? (
        <div className="mt-2 space-y-1">
          {/* Pending vaccines - highlighted */}
          {pendingVaccines.map(item => (
            <div key={item.vaccineName} className="flex items-center gap-2 rounded-lg border border-amber-100 bg-amber-50/60 px-2 py-1.5">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <p className="text-xs font-bold text-slate-900 truncate">{item.vaccineName}</p>
                  <span className="shrink-0 rounded-full bg-amber-200 px-1.5 py-0.5 text-[8px] font-bold text-amber-800">差{item.remainingDoses}针</span>
                </div>
                <div className="mt-0.5 flex items-center gap-1.5 text-[9px] text-slate-500">
                  <span className="font-medium text-teal-600">{formatVaccineProgress(item.latestDoseNumber, item.totalDoses) || '未标注'}</span>
                  <span>·</span>
                  <span>{item.latestDate}</span>
                </div>
              </div>
              {/* Mini progress bar */}
              {item.latestDoseNumber && item.totalDoses && (
                <div className="shrink-0 w-10">
                  <div className="flex h-1.5 overflow-hidden rounded-full bg-amber-100">
                    <div className="bg-teal-500 rounded-full transition-all" style={{ width: `${Math.round((item.latestDoseNumber / item.totalDoses) * 100)}%` }} />
                  </div>
                  <p className="mt-0.5 text-center text-[7px] text-slate-400">{item.latestDoseNumber}/{item.totalDoses}</p>
                </div>
              )}
            </div>
          ))}
          {/* Completed vaccines - compact list */}
          {vaccineProgressSummary.filter(v => v.isCompleted).length > 0 && (
            <div className="rounded-lg bg-emerald-50/60 px-2 py-1.5">
              <div className="flex flex-wrap gap-x-2 gap-y-0.5">
                {vaccineProgressSummary.filter(v => v.isCompleted).map(item => (
                  <span key={item.vaccineName} className="text-[9px] text-emerald-700">
                    ✓ <span className="font-medium">{item.vaccineName}</span>
                    {item.totalDoses && <span className="text-emerald-500">({item.totalDoses}针)</span>}
                  </span>
                ))}
              </div>
            </div>
          )}
          {/* Latest record timestamp */}
          {latestVaccineRecord && (
            <p className="text-[8px] text-slate-400 pl-0.5">最近接种 {formatRecordedSummaryTime(latestVaccineRecord.recordedAt)}</p>
          )}
        </div>
      ) : (
        <p className="mt-2 text-[11px] text-slate-400">暂无疫苗记录，添加后可查看接种进度</p>
      )}
    </div>
  )

  return (
    <div className="max-w-4xl mx-auto px-3 sm:px-4 py-4 space-y-4">
      {babies.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1">
          {babies.map(baby => (
            <button
              key={baby.id}
              onClick={() => onSelectBaby(baby.id)}
              className={`px-4 py-2 rounded-full whitespace-nowrap transition text-sm ${
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

      {stats && (
        <>
          <StatsPanel className="p-2 sm:p-3">
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:gap-3">
              <StatsSegmentedTabs
                items={subpageTabs}
                value={activeSubpage}
                onChange={(value) => setActiveSubpage(value as 'dashboard' | 'insights')}
                className="w-full sm:flex-1"
              />
              <div className="w-full sm:ml-auto sm:w-auto sm:shrink-0">
                <div className="grid grid-cols-3 gap-2 rounded-2xl bg-gray-100 p-1">
                  {[7, 14, 30].map(d => (
                    <button
                      key={d}
                      onClick={() => setDays(d)}
                      className={`rounded-2xl px-2 py-2 text-sm font-medium transition sm:px-4 ${
                        days === d
                          ? 'bg-white text-blue-700 shadow-sm'
                          : 'text-gray-600 hover:bg-white/80'
                      }`}
                    >
                      {d}天
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </StatsPanel>

          {activeSubpage === 'dashboard' && (
            <>
              <StatsPanel>
                <div>
                  <div className="flex items-center gap-2">
                    <ChartColumn size={18} className="text-blue-600" />
                    <h3 className="text-base font-bold text-gray-900">趋势工作台</h3>
                  </div>
                  <p className="mt-1 text-sm text-gray-500">
                    当前周期内的母乳、奶粉、体重、身高数据，便于对比查看。
                  </p>
                </div>

                <div className="mt-4 grid gap-4 xl:grid-cols-2">
                  <div className="min-w-0 rounded-2xl border border-pink-100 bg-pink-50/30 p-3">
                    <div className="mb-3 flex items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-gray-900">母乳趋势</p>
                        <p className="mt-1 text-xs text-gray-500">亲喂时长 + 瓶喂母乳量</p>
                      </div>
                    </div>
                    <StableResponsiveChart className="min-w-0 h-56 sm:h-72 -ml-2">
                      <BarChart data={chartData} margin={{ top: 25, right: 5, left: -10, bottom: 0 }} style={{ outline: 'none' }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} />
                        <Tooltip formatter={(value, name) => {
                          if (name === '亲喂时长(分钟)') {
                            return [`${value}分钟`, name]
                          }
                          return [`${value}ml`, name]
                        }} />
                        <Legend wrapperStyle={{ fontSize: 12 }} />
                        <Bar dataKey="母乳时长" fill="#ec4899" name="亲喂时长(分钟)" radius={[2, 2, 0, 0]}>
                          <LabelList dataKey="母乳时长" position="top" fill="#ec4899" fontSize={10} fontWeight={600} />
                        </Bar>
                        <Bar dataKey="母乳瓶喂量" fill="#a855f7" name="瓶喂量(ml)" radius={[2, 2, 0, 0]}>
                          <LabelList dataKey="母乳瓶喂量" position="top" fill="#a855f7" fontSize={10} fontWeight={600} />
                        </Bar>
                      </BarChart>
                    </StableResponsiveChart>
                  </div>

                  <div className="min-w-0 rounded-2xl border border-blue-100 bg-blue-50/40 p-3">
                    <div className="mb-3 flex items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-gray-900">奶粉趋势</p>
                        <p className="mt-1 text-xs text-blue-700">查看每日奶粉摄入量</p>
                      </div>
                    </div>
                    {chartData.every(day => day.奶粉量 === 0) ? (
                      <StatsEmptyState
                        icon={Milk}
                        title="当前周期暂无奶粉记录"
                        description="添加奶粉喂养后，这里会展示每日摄入量趋势"
                        className="py-10 text-center text-gray-400"
                      />
                    ) : (
                      <StableResponsiveChart className="min-w-0 h-56 sm:h-72 -ml-2">
                        <BarChart data={chartData} margin={{ top: 25, right: 5, left: -10, bottom: 0 }} style={{ outline: 'none' }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#dbeafe" />
                          <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#475569' }} axisLine={{ stroke: '#bfdbfe' }} tickLine={{ stroke: '#bfdbfe' }} />
                          <YAxis tick={{ fontSize: 11, fill: '#475569' }} axisLine={{ stroke: '#bfdbfe' }} tickLine={{ stroke: '#bfdbfe' }} />
                          <Tooltip formatter={(value) => [`${value}ml`, '奶粉量']} />
                          <Legend wrapperStyle={{ fontSize: 12 }} />
                          <Bar dataKey="奶粉量" fill={palette.blue} name="奶粉量(ml)" radius={[2, 2, 0, 0]} barSize={18}>
                            <LabelList dataKey="奶粉量" position="top" fill={palette.blue} fontSize={10} fontWeight={600} />
                          </Bar>
                        </BarChart>
                      </StableResponsiveChart>
                    )}
                  </div>

                  <div className="min-w-0 rounded-2xl border border-teal-100 bg-teal-50/40 p-3">
                    <div className="mb-3 flex items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-gray-900">体重趋势</p>
                        <p className="mt-1 text-xs text-teal-700">按记录时间查看增长轨迹</p>
                      </div>
                    </div>
                    {weightData.length > 0 ? (
                      <StableResponsiveChart className="min-w-0 h-56 sm:h-64 -ml-2">
                        <LineChart data={weightData} margin={{ top: 10, right: 15, left: -10, bottom: 0 }} style={{ outline: 'none' }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#ccfbf1" />
                          <XAxis
                            dataKey="timestamp"
                            type="number"
                            domain={['dataMin', 'dataMax']}
                            scale="time"
                            tick={{ fontSize: 11, fill: '#475569' }}
                            tickFormatter={formatTrendAxisDate}
                            axisLine={{ stroke: '#99f6e4' }}
                            tickLine={{ stroke: '#99f6e4' }}
                          />
                          <YAxis
                            domain={['dataMin - 0.3', 'dataMax + 0.3']}
                            tick={{ fontSize: 11, fill: '#475569' }}
                            tickFormatter={(v) => `${v}kg`}
                            axisLine={{ stroke: '#99f6e4' }}
                            tickLine={{ stroke: '#99f6e4' }}
                          />
                          <Tooltip
                            labelFormatter={(value) => formatTrendTooltipLabel(Number(value))}
                            formatter={(value) => [`${value} kg`, '体重']}
                          />
                          <Line
                            type="monotone"
                            dataKey="体重"
                            stroke={palette.teal}
                            strokeWidth={2.5}
                            dot={{ fill: palette.teal, r: 4 }}
                            activeDot={{ r: 6 }}
                          >
                            <LabelList
                              dataKey="体重"
                              position="top"
                              fill={palette.teal}
                              fontSize={11}
                              fontWeight={600}
                              formatter={(v) => `${v}kg`}
                            />
                          </Line>
                        </LineChart>
                      </StableResponsiveChart>
                    ) : (
                      <StatsEmptyState
                        icon={Scale}
                        title="暂无体重记录"
                        description="在添加记录中记录宝宝体重后，这里将展示体重变化趋势"
                      />
                    )}
                  </div>

                  <div className="min-w-0 rounded-2xl border border-indigo-100 bg-indigo-50/40 p-3">
                    <div className="mb-3 flex items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-gray-900">身高趋势</p>
                        <p className="mt-1 text-xs text-indigo-700">按记录时间查看身高变化</p>
                      </div>
                    </div>
                    {heightData.length > 0 ? (
                      <StableResponsiveChart className="min-w-0 h-56 sm:h-64 -ml-2">
                        <LineChart data={heightData} margin={{ top: 10, right: 15, left: -10, bottom: 0 }} style={{ outline: 'none' }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#e0e7ff" />
                          <XAxis
                            dataKey="timestamp"
                            type="number"
                            domain={['dataMin', 'dataMax']}
                            scale="time"
                            tick={{ fontSize: 11, fill: '#475569' }}
                            tickFormatter={formatTrendAxisDate}
                            axisLine={{ stroke: '#c7d2fe' }}
                            tickLine={{ stroke: '#c7d2fe' }}
                          />
                          <YAxis
                            domain={['dataMin - 1', 'dataMax + 1']}
                            tick={{ fontSize: 11, fill: '#475569' }}
                            tickFormatter={(v) => `${v}cm`}
                            axisLine={{ stroke: '#c7d2fe' }}
                            tickLine={{ stroke: '#c7d2fe' }}
                          />
                          <Tooltip
                            labelFormatter={(value) => formatTrendTooltipLabel(Number(value))}
                            formatter={(value) => [`${value} cm`, '身高']}
                          />
                          <Line
                            type="monotone"
                            dataKey="身高"
                            stroke={palette.indigo}
                            strokeWidth={2.5}
                            dot={{ fill: palette.indigo, r: 4 }}
                            activeDot={{ r: 6 }}
                          >
                            <LabelList
                              dataKey="身高"
                              position="top"
                              fill={palette.indigo}
                              fontSize={11}
                              fontWeight={600}
                              formatter={(v) => `${v}cm`}
                            />
                          </Line>
                        </LineChart>
                      </StableResponsiveChart>
                    ) : (
                      <StatsEmptyState
                        icon={Ruler}
                        title="暂无身高记录"
                        description="在添加记录中记录宝宝身高后，这里将展示身高变化趋势"
                      />
                    )}
                  </div>
                </div>
              </StatsPanel>

              <StatsPanel className="p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <Syringe size={15} className="text-teal-500" />
                    <h3 className="text-sm font-bold text-gray-900">疫苗记录</h3>
                  </div>
                  {vaccineProgressSummary.length > 0 && (
                    <div className="flex items-center gap-1.5">
                      {pendingVaccines.length > 0 && (
                        <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] font-bold text-amber-700">待完成{pendingVaccines.length}种</span>
                      )}
                      <span className="rounded-full bg-teal-100 px-1.5 py-0.5 text-[9px] font-bold text-teal-700">{completedVaccineTypes}/{totalVaccineTypes}种</span>
                    </div>
                  )}
                </div>
                {stats.vaccineRecords.length > 0 ? (
                  <div className="mt-2 grid gap-1.5 sm:grid-cols-2">
                    {vaccineProgressSummary.map(item => (
                      <div key={item.vaccineName} className={`rounded-xl border p-2.5 ${item.isCompleted ? 'border-emerald-100 bg-emerald-50/30' : 'border-amber-100 bg-amber-50/20'}`}>
                        {/* Header row: name + status + progress bar */}
                        <div className="flex items-center gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
                              <p className="text-xs font-bold text-gray-900 truncate">{item.vaccineName}</p>
                              <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[8px] font-bold ${item.isCompleted ? 'bg-emerald-200 text-emerald-800' : 'bg-amber-200 text-amber-800'}`}>
                                {item.isCompleted ? '已完成' : `差${item.remainingDoses}针`}
                              </span>
                            </div>
                            <div className="mt-0.5 flex items-center gap-1 text-[9px] text-slate-500">
                              <span className="font-medium text-teal-600">{formatVaccineProgress(item.latestDoseNumber, item.totalDoses) || '未标注'}</span>
                              <span>·</span>
                              <span>{item.latestDate}</span>
                            </div>
                          </div>
                          {/* Mini progress indicator */}
                          {item.latestDoseNumber && item.totalDoses && (
                            <div className="shrink-0 w-10">
                              <div className="flex h-1.5 overflow-hidden rounded-full bg-gray-100">
                                <div className={`rounded-full transition-all ${item.isCompleted ? 'bg-emerald-500' : 'bg-teal-500'}`} style={{ width: `${Math.round((item.latestDoseNumber / item.totalDoses) * 100)}%` }} />
                              </div>
                              <p className="mt-0.5 text-center text-[7px] text-slate-400">{item.latestDoseNumber}/{item.totalDoses}</p>
                            </div>
                          )}
                        </div>
                        {/* Dose entries - compact inline */}
                        <div className="mt-1.5 rounded-lg bg-white/70 px-2 py-1.5">
                          <div className="space-y-0.5 text-[10px] leading-[14px] text-slate-600">
                            {item.doseEntries.map(doseEntry => (
                              <div key={doseEntry.id} className="flex items-start gap-1">
                                <span className="shrink-0 text-slate-300 leading-[14px]">•</span>
                                <p className="min-w-0 break-words">
                                  <span className="font-semibold text-slate-700">
                                    {formatVaccineProgress(doseEntry.doseNumber, doseEntry.totalDoses) || '未标注'}
                                  </span>
                                  {' · '}
                                  <span className="text-slate-400">{formatRecordedSummaryTime(doseEntry.recordedAt)}</span>
                                  {doseEntry.note ? (
                                    <span className="text-slate-500">：{doseEntry.note}</span>
                                  ) : null}
                                </p>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <StatsEmptyState
                    icon={Syringe}
                    title="暂无疫苗记录"
                    description="添加疫苗记录后，这里会按最近时间优先展示"
                  />
                )}
              </StatsPanel>
            </>
          )}

          {activeSubpage === 'insights' && (
            <div className="space-y-2.5">

              {/* Baby age banner */}
              {babyAgeLabel && (
                <div className="flex items-center gap-2 rounded-2xl bg-gradient-to-r from-pink-50 to-purple-50 border border-pink-100 px-3 py-2">
                  <BabyIcon size={14} className="shrink-0 text-pink-500" />
                  <p className="text-xs font-medium text-gray-700">
                    <span className="font-bold text-pink-600">{stats.baby.name}</span>
                    {' · '}当前月龄 <span className="font-bold text-purple-600">{babyAgeLabel}</span>
                    {babyAgeDays !== null && <span className="text-gray-400"> ({babyAgeDays}天)</span>}
                  </p>
                </div>
              )}

              {/* Feeding insights */}
              <div className="rounded-2xl border border-blue-100 bg-gradient-to-br from-white via-blue-50/40 to-sky-50/60 p-3 shadow-sm">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 text-blue-700">
                    <Milk size={14} />
                    <p className="text-[13px] font-bold">喂养洞察</p>
                  </div>
                  <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-700">近{days}天</span>
                </div>

                {/* Core metrics - 4 col grid, compact */}
                <div className="mt-2 grid grid-cols-4 gap-1.5">
                  <div className="rounded-lg bg-white/80 border border-blue-50 px-2 py-1.5 text-center">
                    <p className="text-[9px] text-slate-500">喂养次数</p>
                    <p className="text-sm font-bold text-slate-900">{stats.totalStats.totalFeedings}</p>
                  </div>
                  <div className="rounded-lg bg-white/80 border border-blue-50 px-2 py-1.5 text-center">
                    <p className="text-[9px] text-slate-500">亲喂时长</p>
                    <p className="text-sm font-bold text-slate-900">{formatMinutes(stats.totalStats.totalBreastDuration)}</p>
                  </div>
                  <div className="rounded-lg bg-white/80 border border-blue-50 px-2 py-1.5 text-center">
                    <p className="text-[9px] text-slate-500">奶量总计</p>
                    <p className="text-sm font-bold text-slate-900">{totalMilkAmount}<span className="text-[10px] font-medium">ml</span></p>
                  </div>
                  <div className="rounded-lg bg-white/80 border border-blue-50 px-2 py-1.5 text-center">
                    <p className="text-[9px] text-slate-500">记录天数</p>
                    <p className="text-sm font-bold text-slate-900">{activeFeedingDays}<span className="text-[10px] font-medium">/{days}</span></p>
                  </div>
                </div>

                {/* Secondary metrics row */}
                <div className="mt-1.5 grid grid-cols-3 gap-1.5">
                  <div className="rounded-lg bg-blue-50/80 px-2 py-1.5 text-center">
                    <p className="text-[9px] text-blue-600">日均奶量</p>
                    <p className="text-[13px] font-bold text-slate-900">{averageMilkPerActiveDay}<span className="text-[10px] font-medium">ml</span></p>
                  </div>
                  <div className="rounded-lg bg-sky-50/80 px-2 py-1.5 text-center">
                    <p className="text-[9px] text-sky-600">日均频次</p>
                    <p className="text-[13px] font-bold text-slate-900">{averageFeedingsPerActiveDay > 0 ? averageFeedingsPerActiveDay.toFixed(1) : '-'}<span className="text-[10px] font-medium">次</span></p>
                  </div>
                  <div className="rounded-lg bg-indigo-50/80 px-2 py-1.5 text-center">
                    <p className="text-[9px] text-indigo-600">喂养规律</p>
                    <p className="text-[13px] font-bold text-slate-900">{feedingRegularity || '-'}</p>
                  </div>
                </div>

                {/* Feeding type tags */}
                <div className="mt-1.5 flex flex-wrap gap-1 text-[10px]">
                  <span className="rounded-full bg-slate-800 px-2 py-0.5 font-semibold text-white">亲喂{totalBreastfeedingSessions}次</span>
                  <span className="rounded-full bg-blue-100 px-2 py-0.5 font-semibold text-blue-700">瓶喂{totalBreastMilkBottleSessions}次</span>
                  <span className="rounded-full bg-sky-100 px-2 py-0.5 font-semibold text-sky-700">奶粉{totalFormulaSessions}次</span>
                  {totalNightFeedings > 0 && (
                    <span className="rounded-full bg-violet-100 px-2 py-0.5 font-semibold text-violet-700">夜奶{totalNightFeedings}次</span>
                  )}
                </div>

                {/* New insights: intervals + night + L/R ratio */}
                <div className="mt-2 grid grid-cols-2 gap-1.5">
                  {avgFeedingInterval > 0 && (
                    <div className="flex items-center gap-1.5 rounded-lg border border-blue-100 bg-white px-2 py-1.5">
                      <Clock size={12} className="shrink-0 text-blue-500" />
                      <div className="min-w-0">
                        <p className="text-[9px] text-slate-500">平均喂养间隔</p>
                        <p className="text-xs font-bold text-slate-900">{formatMinutes(avgFeedingInterval)}</p>
                        {maxFeedingInterval > 0 && <p className="text-[9px] text-slate-400">最长 {formatMinutes(maxFeedingInterval)}</p>}
                      </div>
                    </div>
                  )}
                  {totalNightFeedings > 0 && (
                    <div className="flex items-center gap-1.5 rounded-lg border border-violet-100 bg-white px-2 py-1.5">
                      <Moon size={12} className="shrink-0 text-violet-500" />
                      <div className="min-w-0">
                        <p className="text-[9px] text-slate-500">夜间喂养(22-06时)</p>
                        <p className="text-xs font-bold text-slate-900">{totalNightFeedings}次 / {nightFeedingActiveDays}天</p>
                        <p className="text-[9px] text-slate-400">日均 {nightFeedingActiveDays > 0 ? (totalNightFeedings / nightFeedingActiveDays).toFixed(1) : '0'}次</p>
                      </div>
                    </div>
                  )}
                  {totalBreastTime > 0 && (
                    <div className="col-span-2 rounded-lg border border-pink-100 bg-white px-2 py-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-[9px] text-slate-500">左右乳喂养比例</p>
                        <p className="text-[10px] font-bold text-slate-600">{formatMinutes(totalLeftBreast)} / {formatMinutes(totalRightBreast)}</p>
                      </div>
                      <div className="mt-1 flex h-2 overflow-hidden rounded-full bg-gray-100">
                        <div className="bg-pink-400 transition-all" style={{ width: `${leftBreastPct}%` }} />
                        <div className="bg-rose-200 transition-all" style={{ width: `${rightBreastPct}%` }} />
                      </div>
                      <div className="mt-0.5 flex justify-between text-[9px]">
                        <span className="text-pink-600 font-medium">左 {leftBreastPct}%</span>
                        <span className="text-rose-400 font-medium">右 {rightBreastPct}%</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Peak days summary - compact text */}
                <div className="mt-2 space-y-0.5 text-[11px] leading-4 text-slate-500">
                  {peakMilkIntakeDay && (peakMilkIntakeDay.totalBreastMilkAmount + peakMilkIntakeDay.totalFormulaAmount > 0) && (
                    <p>📈 {peakMilkIntakeDay.date} 奶量最高 <span className="font-semibold text-blue-700">{peakMilkIntakeDay.totalBreastMilkAmount + peakMilkIntakeDay.totalFormulaAmount}ml</span></p>
                  )}
                  {maxBreastfeedingDay && maxBreastfeedingDay.totalBreastDuration > 0 && (
                    <p>🤱 {maxBreastfeedingDay.date} 亲喂最长 <span className="font-semibold text-pink-600">{formatMinutes(maxBreastfeedingDay.totalBreastDuration)}</span></p>
                  )}
                  {milkAmountStdDev !== null && averageMilkPerActiveDay > 0 && (
                    <p>📊 日奶量波动 ±{milkAmountStdDev}ml（均值 {averageMilkPerActiveDay}ml）</p>
                  )}
                </div>
              </div>

              {/* Growth + Diaper + Health - 2 columns on mobile, 3 on desktop */}
              <div className="grid grid-cols-2 gap-2 lg:grid-cols-3">

                {/* Growth insight */}
                <div className="col-span-2 lg:col-span-1 rounded-2xl border border-emerald-100 bg-white p-2.5 shadow-sm">
                  <div className="flex items-center gap-1.5 text-emerald-600">
                    <TrendingUp size={13} />
                    <p className="text-[13px] font-bold">成长洞察</p>
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-1.5">
                    <div className="rounded-xl bg-teal-50/80 px-2.5 py-2">
                      <p className="text-[9px] font-medium text-teal-600">体重</p>
                      <p className="mt-0.5 text-base font-bold text-slate-900">
                        {latestWeightRecord ? `${latestWeightRecord.weight}kg` : '-'}
                      </p>
                      <span className={`mt-1 inline-flex rounded-full px-1.5 py-0.5 text-[9px] font-bold ${
                        latestWeightChange === null ? 'bg-gray-100 text-slate-400'
                        : latestWeightChange >= 0 ? 'bg-teal-600 text-white' : 'bg-amber-500 text-white'
                      }`}>
                        {latestWeightChange !== null ? `${latestWeightChange >= 0 ? '+' : ''}${latestWeightChange}kg` : '暂无'}
                      </span>
                      {overallWeightChange !== null && overallWeightChange !== latestWeightChange && (
                        <p className="mt-1 text-[9px] text-slate-400">整体 {overallWeightChange >= 0 ? '+' : ''}{overallWeightChange}kg</p>
                      )}
                    </div>
                    <div className="rounded-xl bg-blue-50/80 px-2.5 py-2">
                      <p className="text-[9px] font-medium text-blue-600">身高</p>
                      <p className="mt-0.5 text-base font-bold text-slate-900">
                        {latestHeightRecord ? `${latestHeightRecord.height}cm` : '-'}
                      </p>
                      <span className={`mt-1 inline-flex rounded-full px-1.5 py-0.5 text-[9px] font-bold ${
                        latestHeightChange === null ? 'bg-gray-100 text-slate-400'
                        : latestHeightChange >= 0 ? 'bg-blue-600 text-white' : 'bg-amber-500 text-white'
                      }`}>
                        {latestHeightChange !== null ? `${latestHeightChange >= 0 ? '+' : ''}${latestHeightChange}cm` : '暂无'}
                      </span>
                      {overallHeightChange !== null && overallHeightChange !== latestHeightChange && (
                        <p className="mt-1 text-[9px] text-slate-400">整体 {overallHeightChange >= 0 ? '+' : ''}{overallHeightChange}cm</p>
                      )}
                    </div>
                  </div>
                  {(latestWeightRecord || latestHeightRecord) && (
                    <div className="mt-1.5 text-[9px] text-slate-400">
                      {latestWeightRecord && <p>体重记录于 {formatRecordedSummaryTime(latestWeightRecord.recordedAt)}</p>}
                      {latestHeightRecord && <p>身高记录于 {formatRecordedSummaryTime(latestHeightRecord.recordedAt)}</p>}
                    </div>
                  )}
                </div>

                {/* Diaper insight */}
                <div className="rounded-2xl border border-violet-100 bg-white p-2.5 shadow-sm">
                  <div className="flex items-center gap-1.5 text-violet-600">
                    <Droplets size={13} />
                    <p className="text-[13px] font-bold">大小便</p>
                  </div>
                  <div className="mt-2 space-y-1.5">
                    <div className="grid grid-cols-2 gap-1">
                      <div className="rounded-lg bg-sky-50 px-2 py-1.5 text-center">
                        <p className="text-[9px] text-sky-600">小便</p>
                        <p className="text-sm font-bold text-slate-900">{totalPeeCount}<span className="text-[10px]">次</span></p>
                        <p className="text-[9px] text-slate-400">日均{diaperActiveDays > 0 ? averagePeePerActiveDay.toFixed(1) : '-'}</p>
                      </div>
                      <div className="rounded-lg bg-amber-50 px-2 py-1.5 text-center">
                        <p className="text-[9px] text-amber-600">大便</p>
                        <p className="text-sm font-bold text-slate-900">{totalPoopCount}<span className="text-[10px]">次</span></p>
                        <p className="text-[9px] text-slate-400">日均{diaperActiveDays > 0 ? averagePoopPerActiveDay.toFixed(1) : '-'}</p>
                      </div>
                    </div>
                    {consecutiveNoPoopDays >= 2 && (
                      <div className="rounded-lg bg-red-50 border border-red-100 px-2 py-1.5">
                        <p className="text-[10px] font-semibold text-red-600">⚠️ 已连续 {consecutiveNoPoopDays} 天未记录大便</p>
                      </div>
                    )}
                    {peakDiaperDay && (peakDiaperDay.peeCount > 0 || peakDiaperDay.poopCount > 0) && (
                      <p className="text-[9px] text-slate-400">高峰 {peakDiaperDay.date} 小便{peakDiaperDay.peeCount}+大便{peakDiaperDay.poopCount}</p>
                    )}
                  </div>
                </div>

                {/* Health reminder */}
                <div className="rounded-2xl border border-amber-100 bg-white p-2.5 shadow-sm">
                  <div className="flex items-center gap-1.5 text-amber-600">
                    <Thermometer size={13} />
                    <p className="text-[13px] font-bold">健康提醒</p>
                  </div>
                  <div className="mt-2 space-y-1.5">
                    {/* Temperature */}
                    <div className="rounded-lg bg-amber-50 px-2 py-1.5">
                      <div className="flex items-center justify-between">
                        <p className="text-[9px] text-amber-600">体温覆盖</p>
                        <p className="text-[10px] font-bold text-slate-700">{temperatureRecordCount}/{days}天</p>
                      </div>
                      {temperatureRecordCount > 0 && (
                        <div className="mt-1 flex gap-1">
                          {normalTempDays > 0 && (
                            <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[8px] font-semibold text-emerald-700">正常{normalTempDays}天</span>
                          )}
                          {abnormalTempDays > 0 && (
                            <span className="rounded-full bg-red-100 px-1.5 py-0.5 text-[8px] font-semibold text-red-600">异常{abnormalTempDays}天</span>
                          )}
                        </div>
                      )}
                      {latestTemperatureDay && (
                        <p className="mt-1 text-[9px] text-slate-500">最近 <span className="font-semibold">{latestTemperatureDay.temperature}°C</span> ({latestTemperatureDay.date})</p>
                      )}
                      {maxTemperatureDay && typeof maxTemperatureDay.temperature === 'number' && maxTemperatureDay.temperature > 37.5 && (
                        <p className="mt-0.5 text-[9px] text-red-500">⚠ 最高 {maxTemperatureDay.temperature}°C ({maxTemperatureDay.date})</p>
                      )}
                    </div>
                    {/* AD */}
                    <div className="rounded-lg bg-orange-50 px-2 py-1.5">
                      <div className="flex items-center justify-between">
                        <p className="text-[9px] text-orange-600">AD补充</p>
                        <p className="text-[10px] font-bold text-slate-700">{adGivenDays}/{days}天</p>
                      </div>
                      {adConsecutiveStreak > 0 && (
                        <p className="mt-1 text-[9px] text-emerald-600 font-medium">✅ 已连续服用 {adConsecutiveStreak} 天</p>
                      )}
                      {adConsecutiveStreak === 0 && adMissedRecently > 0 && (
                        <p className="mt-1 text-[9px] text-amber-600 font-medium">💊 已 {adMissedRecently} 天未服用</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Medication records - only show if there are records */}
              {medicationRecords.length > 0 && (
                <div className="rounded-2xl border border-purple-100 bg-white p-2.5 shadow-sm">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 text-purple-600">
                      <Pill size={13} />
                      <p className="text-[13px] font-bold">用药记录</p>
                    </div>
                    <span className="rounded-full bg-purple-100 px-2 py-0.5 text-[10px] font-bold text-purple-700">{medicationRecords.length}条</span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {uniqueMedications.map(name => {
                      const count = medicationRecords.filter(r => r.medicationName === name).length
                      return (
                        <span key={name} className="rounded-full bg-purple-50 border border-purple-100 px-2 py-0.5 text-[10px] font-medium text-purple-700">
                          {name} ×{count}
                        </span>
                      )
                    })}
                  </div>
                  <div className="mt-2 space-y-1">
                    {medicationRecords.slice(0, 5).map(record => (
                      <div key={record.id} className="flex items-start gap-1.5 text-[10px] text-slate-600">
                        <span className="shrink-0 text-purple-300">•</span>
                        <p className="min-w-0">
                          <span className="font-semibold text-slate-700">{record.medicationName}</span>
                          {record.medicationDose && <span className="text-slate-400"> {record.medicationDose}</span>}
                          <span className="text-slate-400"> · {formatRecordedSummaryTime(record.recordedAt)}</span>
                          {record.notes && <span className="text-slate-400">：{record.notes}</span>}
                        </p>
                      </div>
                    ))}
                    {medicationRecords.length > 5 && (
                      <p className="text-[9px] text-slate-400 pl-3">还有 {medicationRecords.length - 5} 条记录</p>
                    )}
                  </div>
                </div>
              )}

              {recentVaccineCard}
            </div>
          )}
        </>
      )}

    </div>
  )
}
