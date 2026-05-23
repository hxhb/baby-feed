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
  Area,
  ComposedChart,
  Legend,
  LabelList,
} from 'recharts'
import type { Props as LabelProps } from 'recharts/types/component/Label'
import { Baby as BabyIcon, ChartColumn, ChevronDown, ChevronUp, Clock, Droplets, Milk, Moon, Pill, Ruler, Scale, Syringe, Thermometer, TrendingUp } from 'lucide-react'
import { dedupeRequest, invalidateRequestCache } from '@/lib/client-request-cache'
import type { PreloadedStatsData } from '@/lib/server-stats'
import { StatsEmptyState, StatsPanel, StatsSegmentedTabs } from '@/components/StatsUi'
import MemoSection from '@/components/MemoSection'
import { generateWHOCurve } from '@/lib/who-growth-standards'

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

/**
 * 智能稀疏标签渲染器：数据点多时只显示首末点 + 均匀间隔点的标签，
 * 并上下交替偏移防止相邻标签重叠。
 */
function makeSparseLabel(
  dataKey: string,
  color: string,
  unit: string,
  totalPoints: number,
) {
  // 数据点 ≤ 5 时全部显示，> 5 时按间隔稀疏
  const THRESHOLD = 5
  const step = totalPoints > THRESHOLD ? Math.max(2, Math.floor(totalPoints / 4)) : 1

  return function SparseLabel(props: LabelProps) {
    const { x, y, width, index, value } = props as LabelProps & {
      x: number; y: number; width?: number; index: number
    }
    if (value == null || value === '') return null

    const isFirst = index === 0
    const isLast = index === totalPoints - 1
    const isStepHit = index % step === 0
    if (!isFirst && !isLast && !isStepHit) return null

    // 交替偏移：偶数索引向上 14px，奇数向上 26px
    const offsetY = (index % 2 === 0) ? -14 : -26
    const cx = (width != null) ? x + width / 2 : x

    return (
      <text
        x={cx}
        y={Math.max(10, y + offsetY)}
        textAnchor="middle"
        fontSize={10}
        fontWeight={600}
        fill={color}
      >
        {String(value)}{unit}
      </text>
    )
  }
}

/**
 * WHO 图表专用稀疏标签渲染器：
 * 合并数据中大部分行的宝宝值是 null，只有实际记录点有值。
 * 传入 babyIndices（有值点在 mergedData 中的下标列表）做稀疏 + 交替偏移。
 */
function makeWHOSparseLabel(
  _dataKey: string,
  color: string,
  unit: string,
  babyIndices: number[],
) {
  const count = babyIndices.length
  const THRESHOLD = 5
  const step = count > THRESHOLD ? Math.max(2, Math.floor(count / 4)) : 1
  const indexSet = new Set(babyIndices)

  return function WHOSparseLabel(props: LabelProps) {
    const { x, y, value, index } = props as LabelProps & { x: number; y: number; index: number }
    if (value == null || value === '') return null
    if (!indexSet.has(index)) return null

    const localIdx = babyIndices.indexOf(index)
    if (localIdx === -1) return null

    const isFirst = localIdx === 0
    const isLast = localIdx === count - 1
    const isStepHit = localIdx % step === 0
    if (!isFirst && !isLast && !isStepHit) return null

    const offsetY = (localIdx % 2 === 0) ? -14 : -26

    return (
      <text
        x={x}
        y={Math.max(10, y + offsetY)}
        textAnchor="middle"
        fontSize={10}
        fontWeight={700}
        fill={color}
      >
        {String(value)}{unit}
      </text>
    )
  }
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

  /**
   * 根据日期字符串或时间戳，计算宝宝在该日的月龄和天数。
   * 返回如 "3月12天" 或 "25天"，无出生日期时返回 null。
   */
  const formatBabyAge = (dateInput: string | number): string | null => {
    if (!stats?.babyBirthDate) return null
    const birth = new Date(stats.babyBirthDate)
    const target = typeof dateInput === 'number' ? new Date(dateInput) : new Date(dateInput)
    const totalDays = Math.floor((target.getTime() - birth.getTime()) / (1000 * 60 * 60 * 24))
    if (totalDays < 0) return null
    const months = Math.floor(totalDays / 30.4375)
    const days = Math.floor(totalDays - months * 30.4375)
    if (months <= 0) return `${totalDays}天`
    return `${months}月${days}天`
  }

  /** 通用 tooltip 渲染：自动从 payload[0].payload.rawDate 或 timestamp 计算月龄 */
  const renderTooltipWithAge = (
    { active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; payload?: Record<string, unknown> }>; label?: string | number },
    formatItems: (items: Array<{ name: string; value: number }>) => React.ReactNode,
  ) => {
    if (!active || !payload?.length) return null
    const raw = payload[0].payload as Record<string, unknown> | undefined
    const rawDate = raw?.rawDate as string | undefined
    const timestamp = raw?.timestamp as number | undefined
    const ageStr = rawDate ? formatBabyAge(rawDate) : timestamp ? formatBabyAge(timestamp) : null
    return (
      <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs shadow-md">
        <p className="font-semibold text-slate-900">{label}{ageStr ? <span className="ml-1.5 font-normal text-slate-400">({ageStr})</span> : null}</p>
        {formatItems(payload.map(p => ({ name: p.name, value: p.value })))}
      </div>
    )
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
  const [freshFetch, setFreshFetch] = useState(false)
  const [showCompletedVaccines, setShowCompletedVaccines] = useState(false)
  const hasInitialStats = !freshFetch && !!initialStats && selectedBabyId === initialStats.baby.id && days === 7

  // If a record was just saved, bypass SSR initial data and force a fresh fetch
  useEffect(() => {
    if (typeof window !== 'undefined' && window.sessionStorage.getItem('record_saved_ts')) {
      invalidateRequestCache()
      setFreshFetch(true)
    }
  }, [])

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
          <h2 className="mb-2 text-2xl font-bold text-slate-900">还没有添加宝宝</h2>
          <p className="text-slate-600">请先添加宝宝信息查看统计数据</p>
        </StatsPanel>
      </div>
    )
  }

  const chartData = stats?.lastDays.map(day => {
    const parts = day.date.split('-')
    return {
      date: `${parseInt(parts[1])}/${parseInt(parts[2])}`,
      rawDate: day.date,
      母乳时长: day.totalBreastDuration,
      母乳瓶喂量: day.totalBreastMilkAmount,
      奶粉量: day.totalFormulaAmount,
      亲喂次数: day.breastFeedingCount,
      瓶喂次数: day.breastBottleCount,
      奶粉次数: day.formulaCount,
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

  // --- New trend chart data ---

  // Diaper trend data
  const diaperChartData = stats?.lastDays.map(day => {
    const parts = day.date.split('-')
    return {
      date: `${parseInt(parts[1])}/${parseInt(parts[2])}`,
      rawDate: day.date,
      小便: day.peeCount,
      大便: day.poopCount,
    }
  }) || []
  const hasDiaperData = diaperChartData.some(day => day.小便 > 0 || day.大便 > 0)

  // Feeding structure trend data
  const feedingStructureData = stats?.lastDays.map(day => {
    const parts = day.date.split('-')
    return {
      date: `${parseInt(parts[1])}/${parseInt(parts[2])}`,
      rawDate: day.date,
      亲喂: day.breastFeedingCount,
      瓶喂: day.breastBottleCount,
      奶粉: day.formulaCount,
    }
  }) || []
  const hasFeedingStructureData = feedingStructureData.some(day => day.亲喂 > 0 || day.瓶喂 > 0 || day.奶粉 > 0)

  // BMI trend data (combine weight + height records within ±3 days, prefer latest)
  const bmiData = (() => {
    const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000

    // Build a sorted array of height records with timestamps (ascending by time)
    const sortedHeights = (stats?.heightTrend || [])
      .map(h => ({ timestamp: new Date(h.recordedAt).getTime(), height: h.height }))
      .filter(h => h.height > 0)
      .sort((a, b) => a.timestamp - b.timestamp)

    // Find the best height record within ±3 days of target, preferring the latest one
    const findBestHeight = (targetTimestamp: number): number | null => {
      if (sortedHeights.length === 0) return null

      let bestHeight: number | null = null
      let bestTimestamp = -Infinity

      for (const h of sortedHeights) {
        const diff = Math.abs(h.timestamp - targetTimestamp)
        if (diff <= THREE_DAYS_MS) {
          // Within ±3 days range, prefer the latest record
          if (h.timestamp > bestTimestamp) {
            bestTimestamp = h.timestamp
            bestHeight = h.height
          }
        }
      }
      return bestHeight
    }

    const results: { timestamp: number; label: string; BMI: number; weight: number; height: number }[] = []
    for (const w of stats?.weightTrend || []) {
      const wTimestamp = new Date(w.recordedAt).getTime()
      const h = findBestHeight(wTimestamp)
      if (h && h > 0) {
        const heightM = h / 100
        const bmi = Number((w.weight / (heightM * heightM)).toFixed(1))
        results.push({
          timestamp: wTimestamp,
          label: formatTrendAxisDate(wTimestamp),
          BMI: bmi,
          weight: w.weight,
          height: h,
        })
      }
    }
    return results
  })()

  // Left/right breast trend data
  const breastSideData = stats?.lastDays.map(day => {
    const parts = day.date.split('-')
    return {
      date: `${parseInt(parts[1])}/${parseInt(parts[2])}`,
      rawDate: day.date,
      左乳: day.leftBreastDuration,
      右乳: day.rightBreastDuration,
    }
  }) || []
  const hasBreastSideData = breastSideData.some(day => day.左乳 > 0 || day.右乳 > 0)

  // Sleep trend data
  const sleepChartData = stats?.lastDays.map(day => {
    const parts = day.date.split('-')
    const totalMinutes = day.sleepDurationMinutes
    const hours = Math.floor(totalMinutes / 60)
    const minutes = totalMinutes % 60
    const sleepLabel = totalMinutes > 0
      ? (hours > 0 ? (minutes > 0 ? `${hours}h${minutes}m` : `${hours}h`) : `${minutes}m`)
      : ''
    return {
      date: `${parseInt(parts[1])}/${parseInt(parts[2])}`,
      rawDate: day.date,
      睡眠时长: Math.round(totalMinutes / 60 * 10) / 10,
      睡眠次数: day.sleepCount,
      sleepLabel,
      totalMinutes,
      hours,
      minutes,
    }
  }) || []
  const hasSleepData = sleepChartData.some(day => day.睡眠时长 > 0 || day.睡眠次数 > 0)

  // Sleep summary stats
  const sleepActiveDays = sleepChartData.filter(d => d.totalMinutes > 0).length
  const totalSleepMinutes = sleepChartData.reduce((sum, d) => sum + d.totalMinutes, 0)
  const avgSleepMinutes = sleepActiveDays > 0 ? Math.round(totalSleepMinutes / sleepActiveDays) : 0
  const avgSleepHours = Math.floor(avgSleepMinutes / 60)
  const avgSleepMins = avgSleepMinutes % 60
  const peakSleepDay = sleepChartData.reduce<typeof sleepChartData[number] | null>((best, d) => {
    if (!best || d.totalMinutes > best.totalMinutes) return d
    return best
  }, null)

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
  })).sort((a, b) => Number(a.isCompleted) - Number(b.isCompleted))
  const pendingVaccines = vaccineProgressSummary.filter(item => item.remainingDoses && item.remainingDoses > 0)
  const totalVaccineTypes = vaccineProgressSummary.length
  const completedVaccineTypes = vaccineProgressSummary.filter(v => v.isCompleted).length
  const recentVaccineCard = (
    <div className="rounded-card border border-teal-100 bg-gradient-to-br from-teal-50/80 to-white p-2.5 shadow-card">
        <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-teal-600">
          <Syringe size={14} />
          <p className="text-sm font-bold">疫苗进度</p>
        </div>
        {totalVaccineTypes > 0 && (
          <div className="flex items-center gap-1.5">
            {pendingVaccines.length > 0 && (
              <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[11px] font-bold text-amber-700">待完成{pendingVaccines.length}种</span>
            )}
            <span className="rounded-full bg-teal-100 px-1.5 py-0.5 text-[11px] font-bold text-teal-700">{completedVaccineTypes}/{totalVaccineTypes}种</span>
          </div>
        )}
      </div>

      {totalVaccineTypes > 0 ? (
        <div className="mt-2 space-y-1">
          {/* Pending vaccines - highlighted */}
          {pendingVaccines.map(item => (
            <div key={item.vaccineName} className="flex items-center gap-2 rounded-lg border border-amber-100 bg-amber-50/60 px-2.5 py-2">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <p className="text-sm font-bold text-slate-900 truncate">{item.vaccineName}</p>
                  <span className="shrink-0 rounded-full bg-amber-200 px-1.5 py-0.5 text-[10px] font-bold text-amber-800">差{item.remainingDoses}针</span>
                </div>
                <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-slate-500">
                  <span className="font-medium text-teal-600">{formatVaccineProgress(item.latestDoseNumber, item.totalDoses) || '未标注'}</span>
                  <span>·</span>
                  <span>{item.latestDate}</span>
                </div>
              </div>
              {/* Mini progress bar */}
              {item.latestDoseNumber && item.totalDoses && (
                <div className="shrink-0 w-12">
                  <div className="flex h-2 overflow-hidden rounded-full bg-amber-100">
                    <div className="bg-teal-500 rounded-full transition-all" style={{ width: `${Math.round((item.latestDoseNumber / item.totalDoses) * 100)}%` }} />
                  </div>
                  <p className="mt-0.5 text-center text-[10px] text-slate-400">{item.latestDoseNumber}/{item.totalDoses}</p>
                </div>
              )}
            </div>
          ))}
          {/* Completed vaccines - compact list */}
          {vaccineProgressSummary.filter(v => v.isCompleted).length > 0 && (
            <div className="rounded-lg bg-emerald-50/60 px-2.5 py-2">
              <div className="flex flex-wrap gap-x-2.5 gap-y-1">
                {vaccineProgressSummary.filter(v => v.isCompleted).map(item => (
                  <span key={item.vaccineName} className="text-[11px] text-emerald-700">
                    ✓ <span className="font-medium">{item.vaccineName}</span>
                    {item.totalDoses && <span className="text-emerald-500">({item.totalDoses}针)</span>}
                  </span>
                ))}
              </div>
            </div>
          )}
          {/* Latest record timestamp */}
          {latestVaccineRecord && (
            <p className="text-[11px] text-slate-400 pl-0.5">最近接种 {formatRecordedSummaryTime(latestVaccineRecord.recordedAt)}</p>
          )}
        </div>
      ) : (
        <p className="mt-2 text-xs text-slate-400">暂无疫苗记录，添加后可查看接种进度</p>
      )}
    </div>
  )

  return (
    <div className="max-w-4xl mx-auto px-3 sm:px-4 py-4 space-y-4">

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
                <div className="grid grid-cols-3 gap-2 rounded-card bg-slate-100 p-1">
                  {[7, 14, 30].map(d => (
                    <button
                      key={d}
                      onClick={() => setDays(d)}
                      className={`rounded-card px-2 py-2 text-sm font-medium transition sm:px-4 ${
                        days === d
                          ? 'bg-white text-blue-600 shadow-card'
                          : 'text-slate-500 hover:bg-white/60'
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
                    <h3 className="text-base font-bold text-slate-900">趋势工作台</h3>
                  </div>
                  <p className="mt-1 text-sm text-slate-500">
                    当前周期内的母乳、奶粉、喂养热力图、体重、身高、大小便、喂养结构、BMI、左右乳时长、睡眠数据。
                  </p>
                </div>

                <div className="mt-4 grid gap-4 xl:grid-cols-2">
                  <div className="min-w-0 rounded-card border border-pink-100 bg-gradient-to-br from-pink-50/30 to-blue-50/30 p-3 xl:col-span-2">
                    <div className="mb-3 flex items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">喂养趋势</p>
                        <p className="mt-1 text-xs text-slate-500">母乳亲喂 + 瓶喂母乳 + 奶粉</p>
                      </div>
                    </div>
                    <StableResponsiveChart className="min-w-0 h-56 sm:h-72 -ml-2">
                      <BarChart data={chartData} margin={{ top: 25, right: 5, left: -10, bottom: 0 }} style={{ outline: 'none' }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} />
                        <Tooltip content={(props) => renderTooltipWithAge(props as unknown as Parameters<typeof renderTooltipWithAge>[0], (items) => (
                          <>
                            {items.map(({ name, value }) => {
                              const d = (props as unknown as { payload?: Array<{ payload: typeof chartData[number] }> }).payload?.[0]?.payload
                              let countStr = ''
                              let dotColor = '#6b7280'
                              if (name.includes('亲喂')) { dotColor = '#ec4899'; if (d) countStr = `（${d.亲喂次数}次）` }
                              else if (name.includes('瓶喂')) { dotColor = '#a855f7'; if (d) countStr = `（${d.瓶喂次数}次）` }
                              else if (name.includes('奶粉')) { dotColor = palette.blue; if (d) countStr = `（${d.奶粉次数}次）` }
                              return (
                                <p key={name} className="mt-0.5 text-slate-600">
                                  <span style={{ color: dotColor }}>●</span> {name}：{name.includes('分钟') ? `${value}分钟` : `${value}ml`}{countStr}
                                </p>
                              )
                            })}
                          </>
                        ))} />
                        <Legend wrapperStyle={{ fontSize: 12 }} />
                        <Bar dataKey="母乳时长" fill="#ec4899" name="亲喂时长(分钟)" radius={[2, 2, 0, 0]}>
                          <LabelList dataKey="母乳时长" position="top" fill="#ec4899" fontSize={10} fontWeight={600} />
                        </Bar>
                        <Bar dataKey="母乳瓶喂量" fill="#a855f7" name="瓶喂量(ml)" radius={[2, 2, 0, 0]}>
                          <LabelList dataKey="母乳瓶喂量" position="top" fill="#a855f7" fontSize={10} fontWeight={600} />
                        </Bar>
                        <Bar dataKey="奶粉量" fill={palette.blue} name="奶粉量(ml)" radius={[2, 2, 0, 0]}>
                          <LabelList dataKey="奶粉量" position="top" fill={palette.blue} fontSize={10} fontWeight={600} />
                        </Bar>
                      </BarChart>
                    </StableResponsiveChart>
                  </div>

                  {/* Feeding heatmap */}
                  <div className="min-w-0 rounded-card border border-orange-100 bg-gradient-to-br from-orange-50/40 to-amber-50/30 p-3">
                    <div className="mb-3">
                      <p className="text-sm font-semibold text-slate-900">喂养时刻热力图</p>
                      <p className="mt-1 text-xs text-orange-700">颜色越深代表该时段喂养次数越多</p>
                    </div>
                    {(() => {
                      const heatmapRaw = stats.feedingHeatmap || []
                      if (heatmapRaw.length === 0) {
                        return (
                          <StatsEmptyState
                            icon={Clock}
                            title="暂无喂养热力图数据"
                            description="添加喂养记录后，这里会展示喂养时段分布"
                          />
                        )
                      }

                      // Group hours into 3-hour time slots
                      const timeSlots = [
                        { label: '凌晨', time: '0-3' },
                        { label: '早晨', time: '3-6' },
                        { label: '上午', time: '6-9' },
                        { label: '午前', time: '9-12' },
                        { label: '午后', time: '12-15' },
                        { label: '下午', time: '15-18' },
                        { label: '傍晚', time: '18-21' },
                        { label: '夜间', time: '21-24' },
                      ]

                      const dates = (stats.lastDays || []).map(d => d.date)

                      // Aggregate: "date|slotIdx" -> count
                      const slotCountMap = new Map<string, number>()
                      heatmapRaw.forEach(item => {
                        const slotIdx = Math.floor(item.hour / 3)
                        const key = `${item.date}|${slotIdx}`
                        slotCountMap.set(key, (slotCountMap.get(key) || 0) + item.count)
                      })

                      // Row totals (per date)
                      const rowTotals = new Map<string, number>()
                      dates.forEach(date => {
                        let rowSum = 0
                        timeSlots.forEach((_, si) => {
                          const c = slotCountMap.get(`${date}|${si}`) || 0
                          rowSum += c
                        })
                        rowTotals.set(date, rowSum)
                      })

                      const allCounts = Array.from(slotCountMap.values())
                      const maxCount = Math.max(...allCounts, 1)

                      const getCellStyle = (count: number): string => {
                        if (count === 0) return 'bg-orange-50/50'
                        const ratio = count / maxCount
                        if (ratio <= 0.2) return 'bg-orange-100'
                        if (ratio <= 0.4) return 'bg-orange-200'
                        if (ratio <= 0.6) return 'bg-orange-300'
                        if (ratio <= 0.8) return 'bg-orange-400'
                        return 'bg-orange-500'
                      }

                      const getCellText = (count: number): string => {
                        if (count === 0) return ''
                        const ratio = count / maxCount
                        return ratio > 0.5 ? 'text-white' : 'text-orange-900'
                      }

                      const formatDateLabel = (dateStr: string) => {
                        const parts = dateStr.split('-')
                        return `${parseInt(parts[1])}/${parseInt(parts[2])}`
                      }

                      // Column template: date label (30px) | 8 slots (1fr each) | row total (30px) — symmetric padding
                      const colTemplate = `30px repeat(${timeSlots.length}, 1fr) 30px`

                      return (
                        <div className="space-y-0.5">
                          {/* Header row */}
                          <div className="grid gap-[3px] items-end pb-1" style={{ gridTemplateColumns: colTemplate }}>
                            <div />
                            {timeSlots.map((slot, i) => (
                              <div key={i} className="text-center leading-tight">
                                <div className="text-[9px] font-medium text-slate-600">{slot.label}</div>
                                <div className="text-[8px] text-slate-400">{slot.time}</div>
                              </div>
                            ))}
                            <div className="text-[8px] text-slate-400 text-center">合计</div>
                          </div>
                          {/* Data rows */}
                          <div className="space-y-[3px]">
                            {dates.map(date => {
                              const dayTotal = rowTotals.get(date) || 0
                              return (
                                <div key={date} className="grid gap-[3px] items-center" style={{ gridTemplateColumns: colTemplate }}>
                                  <div className="text-[10px] text-slate-600 font-medium text-right pr-0.5 truncate">
                                    {formatDateLabel(date)}
                                  </div>
                                  {timeSlots.map((slot, slotIdx) => {
                                    const count = slotCountMap.get(`${date}|${slotIdx}`) || 0
                                    return (
                                      <div
                                        key={slotIdx}
                                        className={`h-6 rounded-[4px] flex items-center justify-center text-[11px] font-bold transition-colors ${getCellStyle(count)} ${getCellText(count)}`}
                                        title={`${formatDateLabel(date)} ${slot.label}(${slot.time}时) — ${count}次`}
                                      >
                                        {count > 0 ? count : <span className="text-[8px] text-slate-300">·</span>}
                                      </div>
                                    )
                                  })}
                                  <div className="text-center text-[10px] font-bold text-orange-600" title={`${formatDateLabel(date)} 全天共${dayTotal}次`}>
                                    {dayTotal > 0 ? dayTotal : '-'}
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                          {/* Legend */}
                          <div className="pt-1 flex items-center justify-center gap-1.5 text-[9px] text-slate-500">
                            <span>少</span>
                            <div className="flex gap-[2px]">
                              <div className="w-3.5 h-2.5 rounded-sm bg-orange-50 border border-orange-200/60" />
                              <div className="w-3.5 h-2.5 rounded-sm bg-orange-100" />
                              <div className="w-3.5 h-2.5 rounded-sm bg-orange-200" />
                              <div className="w-3.5 h-2.5 rounded-sm bg-orange-300" />
                              <div className="w-3.5 h-2.5 rounded-sm bg-orange-400" />
                              <div className="w-3.5 h-2.5 rounded-sm bg-orange-500" />
                            </div>
                            <span>多</span>
                          </div>
                        </div>
                      )
                    })()}
                  </div>

                  {/* Sleep duration trend - side by side with heatmap on PC */}
                  <div className="min-w-0 rounded-card border border-indigo-100 bg-indigo-50/30 p-3">
                    <div className="mb-3 flex items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">每日睡眠趋势</p>
                        <p className="mt-1 text-xs text-indigo-700">按自然日统计睡眠时长与次数</p>
                      </div>
                    </div>
                    {hasSleepData ? (
                      <>
                        {/* Summary row */}
                        <div className="mb-2 flex items-stretch gap-1.5">
                          <div className="flex flex-1 items-center gap-1.5 rounded-lg bg-indigo-100/60 px-2 py-1.5">
                            <p className="shrink-0 text-[10px] text-indigo-500">日均</p>
                            <p className="text-xs font-bold text-indigo-800 tabular-nums">
                              {avgSleepHours > 0 ? `${avgSleepHours}h` : ''}{avgSleepMins > 0 ? `${avgSleepMins}m` : ''}{avgSleepMinutes === 0 ? '—' : ''}
                            </p>
                          </div>
                          <div className="flex flex-1 items-center gap-1.5 rounded-lg bg-indigo-100/60 px-2 py-1.5">
                            <p className="shrink-0 text-[10px] text-indigo-500">最长</p>
                            <p className="text-xs font-bold text-indigo-800 tabular-nums">
                              {peakSleepDay && peakSleepDay.totalMinutes > 0
                                ? `${Math.floor(peakSleepDay.totalMinutes / 60)}h${peakSleepDay.totalMinutes % 60 > 0 ? `${peakSleepDay.totalMinutes % 60}m` : ''}`
                                : '—'}
                            </p>
                          </div>
                          <div className="flex flex-1 items-center gap-1.5 rounded-lg bg-indigo-100/60 px-2 py-1.5">
                            <p className="shrink-0 text-[10px] text-indigo-500">天数</p>
                            <p className="text-xs font-bold text-indigo-800 tabular-nums">{sleepActiveDays}天</p>
                          </div>
                        </div>
                        <StableResponsiveChart className="min-w-0 h-56 sm:h-64 -ml-2">
                          <BarChart data={sleepChartData} margin={{ top: 22, right: 5, left: -10, bottom: 0 }} style={{ outline: 'none' }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e0e7ff" />
                            <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#475569' }} axisLine={{ stroke: '#a5b4fc' }} tickLine={{ stroke: '#a5b4fc' }} />
                            <YAxis tick={{ fontSize: 11, fill: '#475569' }} tickFormatter={(v) => `${v}h`} axisLine={{ stroke: '#a5b4fc' }} tickLine={{ stroke: '#a5b4fc' }} domain={[0, (dataMax: number) => Math.ceil(dataMax) + 1]} />
                            <Tooltip content={({ active, payload, label }) => {
                              if (!active || !payload?.length) return null
                              const d = payload[0].payload as typeof sleepChartData[number]
                              const durationStr = d.hours > 0
                                ? (d.minutes > 0 ? `${d.hours}h ${d.minutes}m` : `${d.hours}h`)
                                : (d.minutes > 0 ? `${d.minutes}m` : '无记录')
                              const ageStr = d.rawDate ? formatBabyAge(d.rawDate) : null
                              return (
                                <div className="rounded-lg border border-indigo-100 bg-white px-3 py-2 text-xs shadow-md">
                                  <p className="font-semibold text-slate-900">{label}{ageStr ? <span className="ml-1.5 font-normal text-slate-400">({ageStr})</span> : null}</p>
                                  <p className="mt-1 text-indigo-600">时长：{durationStr}</p>
                                  <p className="text-purple-600">次数：{d.睡眠次数}次</p>
                                </div>
                              )
                            }} />
                            <Bar dataKey="睡眠时长" fill="#818cf8" name="睡眠时长(小时)" radius={[3, 3, 0, 0]} barSize={18}>
                              <LabelList dataKey="sleepLabel" position="top" fill="#4f46e5" fontSize={10} fontWeight={600} />
                            </Bar>
                          </BarChart>
                        </StableResponsiveChart>
                      </>
                    ) : (
                      <StatsEmptyState
                        icon={Moon}
                        title="暂无睡眠记录"
                        description="添加睡眠记录后，这里会展示每日睡眠趋势"
                      />
                    )}
                  </div>

                  <div className="min-w-0 rounded-card border border-teal-100 bg-teal-50/40 p-3">
                    <div className="mb-3 flex items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">体重趋势</p>
                        <p className="mt-1 text-xs text-teal-700">按记录时间查看增长轨迹</p>
                      </div>
                    </div>
                    {weightData.length > 0 ? (
                      <StableResponsiveChart className="min-w-0 h-56 sm:h-64 -ml-2">
                        <LineChart data={weightData} margin={{ top: 30, right: 15, left: -10, bottom: 0 }} style={{ outline: 'none' }}>
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
                          <Tooltip content={(props) => {
                            const p = props as unknown as Parameters<typeof renderTooltipWithAge>[0]
                            if (!p.active || !p.payload?.length) return null
                            const ts = (p.payload[0].payload as Record<string, unknown>)?.timestamp as number
                            const ageStr = ts ? formatBabyAge(ts) : null
                            return (
                              <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs shadow-md">
                                <p className="font-semibold text-slate-900">{formatTrendTooltipLabel(ts)}{ageStr ? <span className="ml-1.5 font-normal text-slate-400">({ageStr})</span> : null}</p>
                                <p className="mt-0.5 text-teal-600">体重：{p.payload[0].value} kg</p>
                              </div>
                            )
                          }} />
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
                              content={makeSparseLabel('体重', palette.teal, 'kg', weightData.length)}
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

                  <div className="min-w-0 rounded-card border border-indigo-100 bg-indigo-50/40 p-3">
                    <div className="mb-3 flex items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">身高趋势</p>
                        <p className="mt-1 text-xs text-indigo-700">按记录时间查看身高变化</p>
                      </div>
                    </div>
                    {heightData.length > 0 ? (
                      <StableResponsiveChart className="min-w-0 h-56 sm:h-64 -ml-2">
                        <LineChart data={heightData} margin={{ top: 30, right: 15, left: -10, bottom: 0 }} style={{ outline: 'none' }}>
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
                          <Tooltip content={(props) => {
                            const p = props as unknown as Parameters<typeof renderTooltipWithAge>[0]
                            if (!p.active || !p.payload?.length) return null
                            const ts = (p.payload[0].payload as Record<string, unknown>)?.timestamp as number
                            const ageStr = ts ? formatBabyAge(ts) : null
                            return (
                              <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs shadow-md">
                                <p className="font-semibold text-slate-900">{formatTrendTooltipLabel(ts)}{ageStr ? <span className="ml-1.5 font-normal text-slate-400">({ageStr})</span> : null}</p>
                                <p className="mt-0.5 text-indigo-600">身高：{p.payload[0].value} cm</p>
                              </div>
                            )
                          }} />
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
                              content={makeSparseLabel('身高', palette.indigo, 'cm', heightData.length)}
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

                  {/* BMI trend */}
                  <div className="min-w-0 rounded-card border border-emerald-100 bg-emerald-50/30 p-3">
                    <div className="mb-3 flex items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">BMI 趋势</p>
                        <p className="mt-1 text-xs text-emerald-700">体重(kg) ÷ 身高(m)² 综合评估</p>
                      </div>
                    </div>
                    {bmiData.length > 0 ? (
                      <StableResponsiveChart className="min-w-0 h-56 sm:h-64 -ml-2">
                        <LineChart data={bmiData} margin={{ top: 30, right: 15, left: -10, bottom: 0 }} style={{ outline: 'none' }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#d1fae5" />
                          <XAxis
                            dataKey="timestamp"
                            type="number"
                            domain={['dataMin', 'dataMax']}
                            scale="time"
                            tick={{ fontSize: 11, fill: '#475569' }}
                            tickFormatter={formatTrendAxisDate}
                            axisLine={{ stroke: '#6ee7b7' }}
                            tickLine={{ stroke: '#6ee7b7' }}
                          />
                          <YAxis
                            domain={['dataMin - 1', 'dataMax + 1']}
                            tick={{ fontSize: 11, fill: '#475569' }}
                            axisLine={{ stroke: '#6ee7b7' }}
                            tickLine={{ stroke: '#6ee7b7' }}
                          />
                          <Tooltip
                            content={({ active, payload }) => {
                              if (!active || !payload?.length) return null
                              const data = payload[0].payload as { timestamp: number; BMI: number; weight: number; height: number }
                              const ageStr = formatBabyAge(data.timestamp)
                              return (
                                <div className="rounded-lg border border-emerald-200 bg-white px-3 py-2 text-xs shadow-md">
                                  <p className="mb-1 font-medium text-slate-700">{formatTrendTooltipLabel(data.timestamp)}{ageStr ? <span className="ml-1.5 font-normal text-slate-400">({ageStr})</span> : null}</p>
                                  <p className="text-emerald-600">BMI: <span className="font-semibold">{data.BMI}</span></p>
                                  <p className="mt-0.5 text-slate-500">体重: {data.weight}kg · 身高: {data.height}cm</p>
                                </div>
                              )
                            }}
                          />
                          <Line
                            type="monotone"
                            dataKey="BMI"
                            stroke={palette.emerald}
                            strokeWidth={2.5}
                            dot={{ fill: palette.emerald, r: 4 }}
                            activeDot={{ r: 6 }}
                          >
                            <LabelList
                              dataKey="BMI"
                              content={makeSparseLabel('BMI', palette.emerald, '', bmiData.length)}
                            />
                          </Line>
                        </LineChart>
                      </StableResponsiveChart>
                    ) : (
                      <StatsEmptyState
                        icon={Scale}
                        title="暂无 BMI 数据"
                        description="需要同时有体重和身高记录才能计算 BMI"
                      />
                    )}
                  </div>

                </div>
              </StatsPanel>

              <StatsPanel className="p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <Syringe size={15} className="text-teal-500" />
                    <h3 className="text-sm font-bold text-slate-900">疫苗记录</h3>
                  </div>
                  {vaccineProgressSummary.length > 0 && (
                    <div className="flex items-center gap-1.5">
                      {pendingVaccines.length > 0 && (
                        <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[11px] font-bold text-amber-700">待完成{pendingVaccines.length}种</span>
                      )}
                      <span className="rounded-full bg-teal-100 px-1.5 py-0.5 text-[11px] font-bold text-teal-700">{completedVaccineTypes}/{totalVaccineTypes}种</span>
                    </div>
                  )}
                </div>
                {stats.vaccineRecords.length > 0 ? (
                  <div className="mt-2.5">
                    {/* Pending vaccines - always visible */}
                    {pendingVaccines.length > 0 && (
                      <div className="grid gap-2 sm:grid-cols-2">
                        {vaccineProgressSummary.filter(v => !v.isCompleted).map(item => (
                          <div key={item.vaccineName} className="rounded-xl border p-3 border-amber-100 bg-amber-50/20">
                            {/* Header row: name + status + progress bar */}
                            <div className="flex items-center gap-2">
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1.5">
                                  <p className="text-sm font-bold text-slate-900 truncate">{item.vaccineName}</p>
                                  <span className="shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-bold bg-amber-200 text-amber-800">
                                    差{item.remainingDoses}针
                                  </span>
                                </div>
                                <div className="mt-0.5 flex items-center gap-1 text-[11px] text-slate-500">
                                  <span className="font-medium text-teal-600">{formatVaccineProgress(item.latestDoseNumber, item.totalDoses) || '未标注'}</span>
                                  <span>·</span>
                                  <span>{item.latestDate}</span>
                                </div>
                              </div>
                              {/* Mini progress indicator */}
                              {item.latestDoseNumber && item.totalDoses && (
                                <div className="shrink-0 w-12">
                                  <div className="flex h-2 overflow-hidden rounded-full bg-slate-100">
                                    <div className="rounded-full transition-all bg-teal-500" style={{ width: `${Math.round((item.latestDoseNumber / item.totalDoses) * 100)}%` }} />
                                  </div>
                                  <p className="mt-0.5 text-center text-[10px] text-slate-400">{item.latestDoseNumber}/{item.totalDoses}</p>
                                </div>
                              )}
                            </div>
                            {/* Dose entries - compact inline */}
                            <div className="mt-2 rounded-lg bg-white/70 px-2.5 py-2">
                              <div className="space-y-1 text-xs leading-4 text-slate-600">
                                {item.doseEntries.map(doseEntry => (
                                  <div key={doseEntry.id} className="flex items-start gap-1">
                                    <span className="shrink-0 text-slate-300 leading-4">•</span>
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
                    )}

                    {/* Completed vaccines - collapsible */}
                    {completedVaccineTypes > 0 && (
                      <div className={pendingVaccines.length > 0 ? 'mt-2' : ''}>
                        <button
                          type="button"
                          onClick={() => setShowCompletedVaccines(!showCompletedVaccines)}
                          className="flex w-full items-center gap-1 rounded-lg px-2 py-1.5 text-[11px] font-medium text-slate-400 transition hover:bg-slate-50 hover:text-slate-600"
                        >
                          {showCompletedVaccines ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                          已完成 ({completedVaccineTypes})
                        </button>
                        {showCompletedVaccines && (
                          <div className="mt-1 grid gap-2 sm:grid-cols-2">
                            {vaccineProgressSummary.filter(v => v.isCompleted).map(item => (
                              <div key={item.vaccineName} className="rounded-xl border p-3 border-emerald-100 bg-emerald-50/30">
                                {/* Header row: name + status + progress bar */}
                                <div className="flex items-center gap-2">
                                  <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-1.5">
                                      <p className="text-sm font-bold text-slate-900 truncate">{item.vaccineName}</p>
                                      <span className="shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-bold bg-emerald-200 text-emerald-800">
                                        已完成
                                      </span>
                                    </div>
                                    <div className="mt-0.5 flex items-center gap-1 text-[11px] text-slate-500">
                                      <span className="font-medium text-teal-600">{formatVaccineProgress(item.latestDoseNumber, item.totalDoses) || '未标注'}</span>
                                      <span>·</span>
                                      <span>{item.latestDate}</span>
                                    </div>
                                  </div>
                                  {/* Mini progress indicator */}
                                  {item.latestDoseNumber && item.totalDoses && (
                                    <div className="shrink-0 w-12">
                                      <div className="flex h-2 overflow-hidden rounded-full bg-slate-100">
                                        <div className="rounded-full transition-all bg-emerald-500" style={{ width: `${Math.round((item.latestDoseNumber / item.totalDoses) * 100)}%` }} />
                                      </div>
                                      <p className="mt-0.5 text-center text-[10px] text-slate-400">{item.latestDoseNumber}/{item.totalDoses}</p>
                                    </div>
                                  )}
                                </div>
                                {/* Dose entries - compact inline */}
                                <div className="mt-2 rounded-lg bg-white/70 px-2.5 py-2">
                                  <div className="space-y-1 text-xs leading-4 text-slate-600">
                                    {item.doseEntries.map(doseEntry => (
                                      <div key={doseEntry.id} className="flex items-start gap-1">
                                        <span className="shrink-0 text-slate-300 leading-4">•</span>
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
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <StatsEmptyState
                    icon={Syringe}
                    title="暂无疫苗记录"
                    description="添加疫苗记录后，这里会按最近时间优先展示"
                  />
                )}
              </StatsPanel>

              {selectedBabyId && (
                <MemoSection
                  memoRecords={stats.memoRecords}
                  babyId={selectedBabyId}
                />
              )}
            </>
          )}

          {activeSubpage === 'insights' && (
            <div className="space-y-2.5">

              {/* Baby age banner */}
              {babyAgeLabel && (
                <div className="flex items-center gap-2.5 rounded-card bg-gradient-to-r from-pink-50 to-purple-50 border border-pink-100 px-3.5 py-2.5">
                  <BabyIcon size={16} className="shrink-0 text-pink-500" />
                  <p className="text-sm font-medium text-slate-700">
                    <span className="font-bold text-pink-600">{stats.baby.name}</span>
                    {' · '}当前月龄 <span className="font-bold text-purple-600">{babyAgeLabel}</span>
                    {babyAgeDays !== null && <span className="text-slate-400"> ({babyAgeDays}天)</span>}
                  </p>
                </div>
              )}

              {/* Feeding insights */}
              <div className="rounded-card border border-blue-100 bg-gradient-to-br from-white via-blue-50/40 to-sky-50/60 p-3 shadow-card">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 text-blue-700">
                    <Milk size={15} />
                    <p className="text-sm font-bold">喂养洞察</p>
                  </div>
                  <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[11px] font-bold text-blue-700">近{days}天</span>
                </div>

                {/* Core metrics - 4 col grid, compact */}
                <div className="mt-2.5 grid grid-cols-4 gap-1.5">
                  <div className="rounded-lg bg-white/80 border border-blue-50 px-2 py-2 text-center">
                    <p className="text-[11px] text-slate-500">喂养次数</p>
                    <p className="text-base font-bold text-slate-900">{stats.totalStats.totalFeedings}</p>
                  </div>
                  <div className="rounded-lg bg-white/80 border border-blue-50 px-2 py-2 text-center">
                    <p className="text-[11px] text-slate-500">亲喂时长</p>
                    <p className="text-base font-bold text-slate-900">{formatMinutes(stats.totalStats.totalBreastDuration)}</p>
                  </div>
                  <div className="rounded-lg bg-white/80 border border-blue-50 px-2 py-2 text-center">
                    <p className="text-[11px] text-slate-500">奶量总计</p>
                    <p className="text-base font-bold text-slate-900">{totalMilkAmount}<span className="text-xs font-medium">ml</span></p>
                  </div>
                  <div className="rounded-lg bg-white/80 border border-blue-50 px-2 py-2 text-center">
                    <p className="text-[11px] text-slate-500">记录天数</p>
                    <p className="text-base font-bold text-slate-900">{activeFeedingDays}<span className="text-xs font-medium">/{days}</span></p>
                  </div>
                </div>

                {/* Secondary metrics row */}
                <div className="mt-1.5 grid grid-cols-3 gap-1.5">
                  <div className="rounded-lg bg-blue-50/80 px-2 py-2 text-center">
                    <p className="text-[11px] text-blue-600">日均奶量</p>
                    <p className="text-sm font-bold text-slate-900">{averageMilkPerActiveDay}<span className="text-[11px] font-medium">ml</span></p>
                  </div>
                  <div className="rounded-lg bg-sky-50/80 px-2 py-2 text-center">
                    <p className="text-[11px] text-sky-600">日均频次</p>
                    <p className="text-sm font-bold text-slate-900">{averageFeedingsPerActiveDay > 0 ? averageFeedingsPerActiveDay.toFixed(1) : '-'}<span className="text-[11px] font-medium">次</span></p>
                  </div>
                  <div className="rounded-lg bg-indigo-50/80 px-2 py-2 text-center">
                    <p className="text-[11px] text-indigo-600">喂养规律</p>
                    <p className="text-sm font-bold text-slate-900">{feedingRegularity || '-'}</p>
                  </div>
                </div>

                {/* Feeding type tags */}
                <div className="mt-2 flex flex-wrap gap-1.5 text-[11px]">
                  <span className="rounded-full bg-slate-800 px-2.5 py-0.5 font-semibold text-white">亲喂{totalBreastfeedingSessions}次</span>
                  <span className="rounded-full bg-blue-100 px-2.5 py-0.5 font-semibold text-blue-700">瓶喂{totalBreastMilkBottleSessions}次</span>
                  <span className="rounded-full bg-sky-100 px-2.5 py-0.5 font-semibold text-sky-700">奶粉{totalFormulaSessions}次</span>
                  {totalNightFeedings > 0 && (
                    <span className="rounded-full bg-violet-100 px-2.5 py-0.5 font-semibold text-violet-700">夜奶{totalNightFeedings}次</span>
                  )}
                </div>

                {/* New insights: intervals + night + L/R ratio */}
                <div className="mt-2 grid grid-cols-2 gap-1.5">
                  {avgFeedingInterval > 0 && (
                    <div className="flex items-center gap-2 rounded-lg border border-blue-100 bg-white px-2.5 py-2">
                      <Clock size={14} className="shrink-0 text-blue-500" />
                      <div className="min-w-0">
                        <p className="text-[11px] text-slate-500">平均喂养间隔</p>
                        <p className="text-sm font-bold text-slate-900">{formatMinutes(avgFeedingInterval)}</p>
                        {maxFeedingInterval > 0 && <p className="text-[11px] text-slate-400">最长 {formatMinutes(maxFeedingInterval)}</p>}
                      </div>
                    </div>
                  )}
                  {totalNightFeedings > 0 && (
                    <div className="flex items-center gap-2 rounded-lg border border-violet-100 bg-white px-2.5 py-2">
                      <Moon size={14} className="shrink-0 text-violet-500" />
                      <div className="min-w-0">
                        <p className="text-[11px] text-slate-500">夜间喂养(22-06时)</p>
                        <p className="text-sm font-bold text-slate-900">{totalNightFeedings}次 / {nightFeedingActiveDays}天</p>
                        <p className="text-[11px] text-slate-400">日均 {nightFeedingActiveDays > 0 ? (totalNightFeedings / nightFeedingActiveDays).toFixed(1) : '0'}次</p>
                      </div>
                    </div>
                  )}
                  {totalBreastTime > 0 && (
                    <div className="col-span-2 rounded-lg border border-pink-100 bg-white px-2.5 py-2">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-[11px] text-slate-500">左右乳喂养比例</p>
                        <p className="text-xs font-bold text-slate-600">{formatMinutes(totalLeftBreast)} / {formatMinutes(totalRightBreast)}</p>
                      </div>
                      <div className="mt-1.5 flex h-2.5 overflow-hidden rounded-full bg-slate-100">
                        <div className="bg-pink-400 transition-all" style={{ width: `${leftBreastPct}%` }} />
                        <div className="bg-rose-200 transition-all" style={{ width: `${rightBreastPct}%` }} />
                      </div>
                      <div className="mt-1 flex justify-between text-[11px]">
                        <span className="text-pink-600 font-medium">左 {leftBreastPct}%</span>
                        <span className="text-rose-400 font-medium">右 {rightBreastPct}%</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Peak days summary - compact text */}
                <div className="mt-2 space-y-1 text-xs leading-[18px] text-slate-500">
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
                <div className="col-span-2 lg:col-span-1 rounded-card border border-emerald-100 bg-white p-2.5 shadow-card">
                  <div className="flex items-center gap-1.5 text-emerald-600">
                    <TrendingUp size={14} />
                    <p className="text-sm font-bold">成长洞察</p>
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-1.5">
                    <div className="rounded-xl bg-teal-50/80 px-2.5 py-2">
                      <p className="text-[11px] font-medium text-teal-600">体重</p>
                      <p className="mt-0.5 text-lg font-bold text-slate-900">
                        {latestWeightRecord ? `${latestWeightRecord.weight}kg` : '-'}
                      </p>
                      <span className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-[11px] font-bold ${
                        latestWeightChange === null ? 'bg-slate-100 text-slate-400'
                        : latestWeightChange >= 0 ? 'bg-teal-600 text-white' : 'bg-amber-500 text-white'
                      }`}>
                        {latestWeightChange !== null ? `${latestWeightChange >= 0 ? '+' : ''}${latestWeightChange}kg` : '暂无'}
                      </span>
                      {overallWeightChange !== null && overallWeightChange !== latestWeightChange && (
                        <p className="mt-1 text-[11px] text-slate-400">整体 {overallWeightChange >= 0 ? '+' : ''}{overallWeightChange}kg</p>
                      )}
                    </div>
                    <div className="rounded-xl bg-blue-50/80 px-2.5 py-2">
                      <p className="text-[11px] font-medium text-blue-600">身高</p>
                      <p className="mt-0.5 text-lg font-bold text-slate-900">
                        {latestHeightRecord ? `${latestHeightRecord.height}cm` : '-'}
                      </p>
                      <span className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-[11px] font-bold ${
                        latestHeightChange === null ? 'bg-slate-100 text-slate-400'
                        : latestHeightChange >= 0 ? 'bg-blue-600 text-white' : 'bg-amber-500 text-white'
                      }`}>
                        {latestHeightChange !== null ? `${latestHeightChange >= 0 ? '+' : ''}${latestHeightChange}cm` : '暂无'}
                      </span>
                      {overallHeightChange !== null && overallHeightChange !== latestHeightChange && (
                        <p className="mt-1 text-[11px] text-slate-400">整体 {overallHeightChange >= 0 ? '+' : ''}{overallHeightChange}cm</p>
                      )}
                    </div>
                  </div>
                  {(latestWeightRecord || latestHeightRecord) && (
                    <div className="mt-1.5 text-[11px] text-slate-400">
                      {latestWeightRecord && <p>体重记录于 {formatRecordedSummaryTime(latestWeightRecord.recordedAt)}</p>}
                      {latestHeightRecord && <p>身高记录于 {formatRecordedSummaryTime(latestHeightRecord.recordedAt)}</p>}
                    </div>
                  )}
                </div>

                {/* Diaper insight */}
                <div className="rounded-card border border-violet-100 bg-white p-2.5 shadow-card">
                  <div className="flex items-center gap-1.5 text-violet-600">
                    <Droplets size={14} />
                    <p className="text-sm font-bold">大小便</p>
                  </div>
                  <div className="mt-2 space-y-1.5">
                    <div className="grid grid-cols-2 gap-1.5">
                      <div className="rounded-lg bg-sky-50 px-2 py-2 text-center">
                        <p className="text-[11px] text-sky-600">小便</p>
                        <p className="text-base font-bold text-slate-900">{totalPeeCount}<span className="text-xs">次</span></p>
                        <p className="text-[11px] text-slate-400">日均{diaperActiveDays > 0 ? averagePeePerActiveDay.toFixed(1) : '-'}</p>
                      </div>
                      <div className="rounded-lg bg-amber-50 px-2 py-2 text-center">
                        <p className="text-[11px] text-amber-600">大便</p>
                        <p className="text-base font-bold text-slate-900">{totalPoopCount}<span className="text-xs">次</span></p>
                        <p className="text-[11px] text-slate-400">日均{diaperActiveDays > 0 ? averagePoopPerActiveDay.toFixed(1) : '-'}</p>
                      </div>
                    </div>
                    {consecutiveNoPoopDays >= 2 && (
                      <div className="rounded-lg bg-red-50 border border-red-100 px-2.5 py-2">
                        <p className="text-xs font-semibold text-red-600">⚠️ 已连续 {consecutiveNoPoopDays} 天未记录大便</p>
                      </div>
                    )}
                    {peakDiaperDay && (peakDiaperDay.peeCount > 0 || peakDiaperDay.poopCount > 0) && (
                      <p className="text-[11px] text-slate-400">高峰 {peakDiaperDay.date} 小便{peakDiaperDay.peeCount}+大便{peakDiaperDay.poopCount}</p>
                    )}
                  </div>
                </div>

                {/* Health reminder */}
                <div className="rounded-card border border-amber-100 bg-white p-2.5 shadow-card">
                  <div className="flex items-center gap-1.5 text-amber-600">
                    <Thermometer size={14} />
                    <p className="text-sm font-bold">健康提醒</p>
                  </div>
                  <div className="mt-2 space-y-1.5">
                    {/* Temperature */}
                    <div className="rounded-lg bg-amber-50 px-2.5 py-2">
                      <div className="flex items-center justify-between">
                        <p className="text-[11px] text-amber-600">体温覆盖</p>
                        <p className="text-xs font-bold text-slate-700">{temperatureRecordCount}/{days}天</p>
                      </div>
                      {temperatureRecordCount > 0 && (
                        <div className="mt-1 flex gap-1.5">
                          {normalTempDays > 0 && (
                            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">正常{normalTempDays}天</span>
                          )}
                          {abnormalTempDays > 0 && (
                            <span className="rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-semibold text-red-600">异常{abnormalTempDays}天</span>
                          )}
                        </div>
                      )}
                      {latestTemperatureDay && (
                        <p className="mt-1 text-[11px] text-slate-500">最近 <span className="font-semibold">{latestTemperatureDay.temperature}°C</span> ({latestTemperatureDay.date})</p>
                      )}
                      {maxTemperatureDay && typeof maxTemperatureDay.temperature === 'number' && maxTemperatureDay.temperature > 37.5 && (
                        <p className="mt-0.5 text-[11px] text-red-500">⚠ 最高 {maxTemperatureDay.temperature}°C ({maxTemperatureDay.date})</p>
                      )}
                    </div>
                    {/* AD */}
                    <div className="rounded-lg bg-orange-50 px-2.5 py-2">
                      <div className="flex items-center justify-between">
                        <p className="text-[11px] text-orange-600">AD补充</p>
                        <p className="text-xs font-bold text-slate-700">{adGivenDays}/{days}天</p>
                      </div>
                      {adConsecutiveStreak > 0 && (
                        <p className="mt-1 text-[11px] text-emerald-600 font-medium">✅ 已连续服用 {adConsecutiveStreak} 天</p>
                      )}
                      {adConsecutiveStreak === 0 && adMissedRecently > 0 && (
                        <p className="mt-1 text-[11px] text-amber-600 font-medium">💊 已 {adMissedRecently} 天未服用</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Trend charts moved from dashboard */}
              <div className="grid gap-2.5 xl:grid-cols-2">
                {/* Diaper trend */}
                <div className="min-w-0 rounded-card border border-amber-100 bg-amber-50/30 p-3">
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">大小便趋势</p>
                      <p className="mt-1 text-xs text-amber-700">每日大小便次数变化</p>
                    </div>
                  </div>
                  {hasDiaperData ? (
                    <StableResponsiveChart className="min-w-0 h-56 sm:h-72 -ml-2">
                      <BarChart data={diaperChartData} margin={{ top: 25, right: 5, left: -10, bottom: 0 }} barCategoryGap="25%" style={{ outline: 'none' }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#fef3c7" />
                        <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#475569' }} axisLine={{ stroke: '#fcd34d' }} tickLine={{ stroke: '#fcd34d' }} />
                        <YAxis tick={{ fontSize: 11, fill: '#475569' }} axisLine={{ stroke: '#fcd34d' }} tickLine={{ stroke: '#fcd34d' }} />
                        <Tooltip content={(props) => renderTooltipWithAge(props as unknown as Parameters<typeof renderTooltipWithAge>[0], (items) => (
                          <>
                            {items.map(({ name, value }) => (
                              <p key={name} className="mt-0.5 text-slate-600">{name}：{value}次</p>
                            ))}
                          </>
                        ))} />
                        <Legend wrapperStyle={{ fontSize: 12 }} />
                        <Bar dataKey="小便" fill="#60a5fa" name="小便" radius={[2, 2, 0, 0]} stackId="diaper" maxBarSize={32}>
                          <LabelList dataKey="小便" position="inside" fill="#fff" fontSize={10} fontWeight={600} />
                        </Bar>
                        <Bar dataKey="大便" fill="#d97706" name="大便" radius={[2, 2, 0, 0]} stackId="diaper" maxBarSize={32}>
                          <LabelList dataKey="大便" position="top" fill="#d97706" fontSize={10} fontWeight={600} />
                        </Bar>
                      </BarChart>
                    </StableResponsiveChart>
                  ) : (
                    <StatsEmptyState
                      icon={Droplets}
                      title="暂无大小便记录"
                      description="添加大小便记录后，这里会展示趋势变化"
                    />
                  )}
                </div>

                {/* Feeding structure trend */}
                <div className="min-w-0 rounded-card border border-purple-100 bg-purple-50/30 p-3">
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">喂养结构趋势</p>
                      <p className="mt-1 text-xs text-purple-700">亲喂 / 瓶喂 / 奶粉次数变化</p>
                    </div>
                  </div>
                  {hasFeedingStructureData ? (
                    <StableResponsiveChart className="min-w-0 h-56 sm:h-72 -ml-2">
                      <BarChart data={feedingStructureData} margin={{ top: 20, right: 5, left: -10, bottom: 0 }} barCategoryGap="25%" style={{ outline: 'none' }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f3e8ff" />
                        <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#475569' }} axisLine={{ stroke: '#d8b4fe' }} tickLine={{ stroke: '#d8b4fe' }} />
                        <YAxis tick={{ fontSize: 11, fill: '#475569' }} axisLine={{ stroke: '#d8b4fe' }} tickLine={{ stroke: '#d8b4fe' }} />
                        <Tooltip content={(props) => renderTooltipWithAge(props as unknown as Parameters<typeof renderTooltipWithAge>[0], (items) => (
                          <>
                            {items.map(({ name, value }) => (
                              <p key={name} className="mt-0.5 text-slate-600">{name}：{value}次</p>
                            ))}
                          </>
                        ))} />
                        <Legend wrapperStyle={{ fontSize: 12 }} />
                        <Bar dataKey="亲喂" fill="#f472b6" name="亲喂" radius={[2, 2, 0, 0]} stackId="feed" maxBarSize={32}>
                          <LabelList dataKey="亲喂" content={({ x, y, width, height, value }) => {
                            if (!value || Number(value) === 0 || !height || Number(height) < 16 || !width || Number(width) < 14) return null
                            return <text x={Number(x) + Number(width) / 2} y={Number(y) + Number(height) / 2} textAnchor="middle" dominantBaseline="central" fill="#fff" fontSize={9} fontWeight={600}>{value}</text>
                          }} />
                        </Bar>
                        <Bar dataKey="瓶喂" fill="#a78bfa" name="瓶喂" radius={[2, 2, 0, 0]} stackId="feed" maxBarSize={32}>
                          <LabelList dataKey="瓶喂" content={({ x, y, width, height, value }) => {
                            if (!value || Number(value) === 0 || !height || Number(height) < 16 || !width || Number(width) < 14) return null
                            return <text x={Number(x) + Number(width) / 2} y={Number(y) + Number(height) / 2} textAnchor="middle" dominantBaseline="central" fill="#fff" fontSize={9} fontWeight={600}>{value}</text>
                          }} />
                        </Bar>
                        <Bar dataKey="奶粉" fill="#60a5fa" name="奶粉" radius={[2, 2, 0, 0]} stackId="feed" maxBarSize={32}>
                          <LabelList dataKey="奶粉" content={({ x, y, width, value }) => {
                            if (!value || Number(value) === 0 || !width || Number(width) < 14) return null
                            return <text x={Number(x) + Number(width) / 2} y={Number(y) - 5} textAnchor="middle" fill="#60a5fa" fontSize={9} fontWeight={600}>{value}</text>
                          }} />
                        </Bar>
                      </BarChart>
                    </StableResponsiveChart>
                  ) : (
                    <StatsEmptyState
                      icon={Milk}
                      title="暂无喂养记录"
                      description="添加喂养记录后，这里会展示喂养结构变化"
                    />
                  )}
                </div>

                {/* Left/right breast duration trend */}
                <div className="min-w-0 rounded-card border border-rose-100 bg-rose-50/30 p-3">
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">左右乳时长趋势</p>
                      <p className="mt-1 text-xs text-rose-700">每日左右侧亲喂时长(分钟)</p>
                    </div>
                  </div>
                  {hasBreastSideData ? (
                    <StableResponsiveChart className="min-w-0 h-56 sm:h-72 -ml-2">
                      <BarChart data={breastSideData} margin={{ top: 25, right: 5, left: -10, bottom: 0 }} barGap={4} barCategoryGap="30%" style={{ outline: 'none' }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#ffe4e6" />
                        <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#475569' }} axisLine={{ stroke: '#fda4af' }} tickLine={{ stroke: '#fda4af' }} />
                        <YAxis tick={{ fontSize: 11, fill: '#475569' }} tickFormatter={(v) => `${v}分`} axisLine={{ stroke: '#fda4af' }} tickLine={{ stroke: '#fda4af' }} />
                        <Tooltip content={(props) => renderTooltipWithAge(props as unknown as Parameters<typeof renderTooltipWithAge>[0], (items) => (
                          <>
                            {items.map(({ name, value }) => (
                              <p key={name} className="mt-0.5 text-slate-600">{name}：{value}分钟</p>
                            ))}
                          </>
                        ))} />
                        <Legend wrapperStyle={{ fontSize: 12 }} />
                        <Bar dataKey="左乳" fill="#fb7185" name="左乳(分钟)" radius={[3, 3, 0, 0]} maxBarSize={28}>
                          <LabelList dataKey="左乳" position="top" fill="#e11d48" fontSize={10} fontWeight={600} />
                        </Bar>
                        <Bar dataKey="右乳" fill="#fb923c" name="右乳(分钟)" radius={[3, 3, 0, 0]} maxBarSize={28}>
                          <LabelList dataKey="右乳" position="top" fill="#ea580c" fontSize={10} fontWeight={600} />
                        </Bar>
                      </BarChart>
                    </StableResponsiveChart>
                  ) : (
                    <StatsEmptyState
                      icon={Droplets}
                      title="暂无亲喂记录"
                      description="添加母乳亲喂记录后，这里会展示左右侧时长趋势"
                    />
                  )}
                </div>
              </div>

              {/* Medication records - only show if there are records */}
              {medicationRecords.length > 0 && (
                <div className="rounded-card border border-purple-100 bg-white p-2.5 shadow-card">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 text-purple-600">
                      <Pill size={14} />
                      <p className="text-sm font-bold">用药记录</p>
                    </div>
                    <span className="rounded-full bg-purple-100 px-2 py-0.5 text-[11px] font-bold text-purple-700">{medicationRecords.length}条</span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {uniqueMedications.map(name => {
                      const count = medicationRecords.filter(r => r.medicationName === name).length
                      return (
                        <span key={name} className="rounded-full bg-purple-50 border border-purple-100 px-2.5 py-0.5 text-xs font-medium text-purple-700">
                          {name} ×{count}
                        </span>
                      )
                    })}
                  </div>
                  <div className="mt-2 space-y-1.5">
                    {medicationRecords.slice(0, 5).map(record => (
                      <div key={record.id} className="flex items-start gap-1.5 text-xs text-slate-600">
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
                      <p className="text-[11px] text-slate-400 pl-3">还有 {medicationRecords.length - 5} 条记录</p>
                    )}
                  </div>
                </div>
              )}

              {/* WHO Growth Curves */}
              <div className="grid gap-2.5 xl:grid-cols-2">
                {/* WHO Growth Curve - Weight */}
                {stats.babyBirthDate && (() => {
                  const gender = stats.babyGender || 'MALE'
                  const birthDate = new Date(stats.babyBirthDate!)

                  // Convert weight records to age-in-months data points
                  const weightAgeData = (stats.weightTrend || []).map(p => {
                    const recordDate = new Date(p.recordedAt)
                    const ageMonths = (recordDate.getTime() - birthDate.getTime()) / (1000 * 60 * 60 * 24 * 30.4375)
                    return {
                      ageMonths: Number(ageMonths.toFixed(2)),
                      value: p.weight,
                      date: p.date,
                    }
                  }).filter(p => p.ageMonths >= 0 && p.ageMonths <= 24)

                  if (weightAgeData.length === 0) return null

                  const minMonth = Math.max(0, Math.floor(Math.min(...weightAgeData.map(p => p.ageMonths))) - 1)
                  const maxMonth = Math.min(24, Math.ceil(Math.max(...weightAgeData.map(p => p.ageMonths))) + 1)
                  const whoCurve = generateWHOCurve(gender, 'weight', minMonth, maxMonth)

                  // Merge WHO curve and baby data
                  const mergedData = whoCurve.map(who => ({
                    ageMonths: who.ageMonths,
                    label: who.label,
                    P3: who.P3,
                    P15: who.P15,
                    P50: who.P50,
                    P85: who.P85,
                    P97: who.P97,
                    宝宝体重: undefined as number | undefined,
                  }))

                  // Insert baby data points into the merged array
                  weightAgeData.forEach(p => {
                    mergedData.push({
                      ageMonths: p.ageMonths,
                      label: `${p.ageMonths.toFixed(1)}月龄`,
                      P3: 0, P15: 0, P50: 0, P85: 0, P97: 0,
                      宝宝体重: p.value,
                    })
                  })

                  // Sort and interpolate WHO values for baby data points
                  mergedData.sort((a, b) => a.ageMonths - b.ageMonths)

                  // Re-interpolate WHO values for all points to ensure smooth areas
                  const whoFull = generateWHOCurve(gender, 'weight', minMonth, maxMonth)
                  mergedData.forEach(point => {
                    // Find surrounding WHO points for interpolation
                    const lower = whoFull.filter(w => w.ageMonths <= point.ageMonths).pop()
                    const upper = whoFull.find(w => w.ageMonths >= point.ageMonths)
                    if (lower && upper && lower.ageMonths !== upper.ageMonths) {
                      const t = (point.ageMonths - lower.ageMonths) / (upper.ageMonths - lower.ageMonths)
                      point.P3 = Number((lower.P3 + t * (upper.P3 - lower.P3)).toFixed(2))
                      point.P15 = Number((lower.P15 + t * (upper.P15 - lower.P15)).toFixed(2))
                      point.P50 = Number((lower.P50 + t * (upper.P50 - lower.P50)).toFixed(2))
                      point.P85 = Number((lower.P85 + t * (upper.P85 - lower.P85)).toFixed(2))
                      point.P97 = Number((lower.P97 + t * (upper.P97 - lower.P97)).toFixed(2))
                    } else if (lower) {
                      point.P3 = lower.P3; point.P15 = lower.P15; point.P50 = lower.P50
                      point.P85 = lower.P85; point.P97 = lower.P97
                    }
                  })

                  const weightBabyIndices = mergedData
                    .map((d, i) => d.宝宝体重 !== undefined ? i : -1)
                    .filter(i => i >= 0)

                  const genderLabel = gender === 'FEMALE' ? '女' : '男'

                  return (
                    <div className="min-w-0 rounded-card border border-cyan-100 bg-gradient-to-br from-cyan-50/40 to-teal-50/30 p-3">
                      <div className="mb-3">
                        <p className="text-sm font-semibold text-slate-900">📏 体重-月龄 WHO 成长曲线（{genderLabel}）</p>
                        <p className="mt-1 text-xs text-cyan-700">宝宝体重与 WHO 标准百分位（P3–P97）对比</p>
                      </div>
                      <StableResponsiveChart className="min-w-0 h-64 sm:h-80 -ml-2">
                        <ComposedChart data={mergedData} margin={{ top: 10, right: 15, left: -5, bottom: 0 }} style={{ outline: 'none' }}>
                          <defs>
                            <linearGradient id="whoWeightOuter" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="#06b6d4" stopOpacity={0.08} />
                              <stop offset="100%" stopColor="#06b6d4" stopOpacity={0.03} />
                            </linearGradient>
                            <linearGradient id="whoWeightInner" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="#06b6d4" stopOpacity={0.18} />
                              <stop offset="100%" stopColor="#06b6d4" stopOpacity={0.08} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="#cffafe" />
                          <XAxis
                            dataKey="ageMonths"
                            type="number"
                            domain={[minMonth, maxMonth]}
                            tick={{ fontSize: 11, fill: '#475569' }}
                            tickFormatter={(v) => `${v}月`}
                            axisLine={{ stroke: '#a5f3fc' }}
                            tickLine={{ stroke: '#a5f3fc' }}
                          />
                          <YAxis
                            tick={{ fontSize: 11, fill: '#475569' }}
                            tickFormatter={(v) => `${v}kg`}
                            axisLine={{ stroke: '#a5f3fc' }}
                            tickLine={{ stroke: '#a5f3fc' }}
                          />
                          <Tooltip
                            content={({ active, payload }) => {
                              if (!active || !payload?.length) return null
                              const data = payload[0]?.payload
                              if (!data) return null
                              const ageMonths = data.ageMonths as number
                              const months = Math.floor(ageMonths)
                              const days = Math.round((ageMonths - months) * 30.4375)
                              const ageDisplay = months > 0 ? `${months}月${days}天` : `${Math.round(ageMonths * 30.4375)}天`
                              return (
                                <div className="rounded-lg border border-cyan-200 bg-white px-3 py-2 text-xs shadow-md">
                                  <p className="mb-1 font-medium text-slate-700">{data.label || `${ageMonths.toFixed(1)}月龄`}<span className="ml-1.5 font-normal text-slate-400">({ageDisplay})</span></p>
                                  {data.宝宝体重 !== undefined && (
                                    <p className="text-teal-600 font-bold">宝宝: {data.宝宝体重} kg</p>
                                  )}
                                  <div className="mt-1 space-y-0.5 text-slate-500">
                                    <p>P97: {data.P97}kg</p>
                                    <p>P85: {data.P85}kg</p>
                                    <p className="font-medium text-cyan-600">P50: {data.P50}kg（中位数）</p>
                                    <p>P15: {data.P15}kg</p>
                                    <p>P3: {data.P3}kg</p>
                                  </div>
                                </div>
                              )
                            }}
                          />
                          {/* WHO percentile areas - outer band P3-P97 */}
                          <Area type="monotone" dataKey="P97" stroke="none" fill="url(#whoWeightOuter)" connectNulls />
                          <Area type="monotone" dataKey="P3" stroke="none" fill="#fff" connectNulls />
                          {/* WHO percentile areas - inner band P15-P85 */}
                          <Area type="monotone" dataKey="P85" stroke="none" fill="url(#whoWeightInner)" connectNulls />
                          <Area type="monotone" dataKey="P15" stroke="none" fill="#fff" connectNulls />
                          {/* WHO percentile lines */}
                          <Line type="monotone" dataKey="P3" stroke="#67e8f9" strokeWidth={1} strokeDasharray="4 3" dot={false} connectNulls />
                          <Line type="monotone" dataKey="P15" stroke="#22d3ee" strokeWidth={1} strokeDasharray="4 3" dot={false} connectNulls />
                          <Line type="monotone" dataKey="P50" stroke="#06b6d4" strokeWidth={1.5} strokeDasharray="6 3" dot={false} connectNulls />
                          <Line type="monotone" dataKey="P85" stroke="#22d3ee" strokeWidth={1} strokeDasharray="4 3" dot={false} connectNulls />
                          <Line type="monotone" dataKey="P97" stroke="#67e8f9" strokeWidth={1} strokeDasharray="4 3" dot={false} connectNulls />
                          {/* Baby's actual data */}
                          <Line
                            type="monotone"
                            dataKey="宝宝体重"
                            stroke={palette.teal}
                            strokeWidth={2.5}
                            dot={{ fill: palette.teal, r: 5, strokeWidth: 2, stroke: '#fff' }}
                            activeDot={{ r: 7 }}
                            connectNulls
                          >
                            <LabelList
                              dataKey="宝宝体重"
                              content={makeWHOSparseLabel('宝宝体重', palette.teal, 'kg', weightBabyIndices)}
                            />
                          </Line>
                        </ComposedChart>
                      </StableResponsiveChart>
                      {/* Legend */}
                      <div className="mt-2 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[11px] text-slate-500">
                        <span className="flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: palette.teal }} />宝宝实际</span>
                        <span className="flex items-center gap-1"><span className="inline-block h-0.5 w-4 border-t-2 border-dashed" style={{ borderColor: '#06b6d4' }} />P50 中位数</span>
                        <span className="flex items-center gap-1"><span className="inline-block h-3 w-4 rounded" style={{ backgroundColor: 'rgba(6,182,212,0.15)' }} />P15–P85</span>
                        <span className="flex items-center gap-1"><span className="inline-block h-3 w-4 rounded" style={{ backgroundColor: 'rgba(6,182,212,0.06)' }} />P3–P97</span>
                      </div>
                    </div>
                  )
                })()}

                {/* WHO Growth Curve - Height */}
                {stats.babyBirthDate && (() => {
                  const gender = stats.babyGender || 'MALE'
                  const birthDate = new Date(stats.babyBirthDate!)

                  const heightAgeData = (stats.heightTrend || []).map(p => {
                    const recordDate = new Date(p.recordedAt)
                    const ageMonths = (recordDate.getTime() - birthDate.getTime()) / (1000 * 60 * 60 * 24 * 30.4375)
                    return {
                      ageMonths: Number(ageMonths.toFixed(2)),
                      value: p.height,
                      date: p.date,
                    }
                  }).filter(p => p.ageMonths >= 0 && p.ageMonths <= 24)

                  if (heightAgeData.length === 0) return null

                  const minMonth = Math.max(0, Math.floor(Math.min(...heightAgeData.map(p => p.ageMonths))) - 1)
                  const maxMonth = Math.min(24, Math.ceil(Math.max(...heightAgeData.map(p => p.ageMonths))) + 1)
                  const whoCurve = generateWHOCurve(gender, 'height', minMonth, maxMonth)

                  const mergedData = whoCurve.map(who => ({
                    ageMonths: who.ageMonths,
                    label: who.label,
                    P3: who.P3,
                    P15: who.P15,
                    P50: who.P50,
                    P85: who.P85,
                    P97: who.P97,
                    宝宝身高: undefined as number | undefined,
                  }))

                  heightAgeData.forEach(p => {
                    mergedData.push({
                      ageMonths: p.ageMonths,
                      label: `${p.ageMonths.toFixed(1)}月龄`,
                      P3: 0, P15: 0, P50: 0, P85: 0, P97: 0,
                      宝宝身高: p.value,
                    })
                  })

                  mergedData.sort((a, b) => a.ageMonths - b.ageMonths)

                  const whoFull = generateWHOCurve(gender, 'height', minMonth, maxMonth)
                  mergedData.forEach(point => {
                    const lower = whoFull.filter(w => w.ageMonths <= point.ageMonths).pop()
                    const upper = whoFull.find(w => w.ageMonths >= point.ageMonths)
                    if (lower && upper && lower.ageMonths !== upper.ageMonths) {
                      const t = (point.ageMonths - lower.ageMonths) / (upper.ageMonths - lower.ageMonths)
                      point.P3 = Number((lower.P3 + t * (upper.P3 - lower.P3)).toFixed(2))
                      point.P15 = Number((lower.P15 + t * (upper.P15 - lower.P15)).toFixed(2))
                      point.P50 = Number((lower.P50 + t * (upper.P50 - lower.P50)).toFixed(2))
                      point.P85 = Number((lower.P85 + t * (upper.P85 - lower.P85)).toFixed(2))
                      point.P97 = Number((lower.P97 + t * (upper.P97 - lower.P97)).toFixed(2))
                    } else if (lower) {
                      point.P3 = lower.P3; point.P15 = lower.P15; point.P50 = lower.P50
                      point.P85 = lower.P85; point.P97 = lower.P97
                    }
                  })

                  const heightBabyIndices = mergedData
                    .map((d, i) => d.宝宝身高 !== undefined ? i : -1)
                    .filter(i => i >= 0)

                  const genderLabel = gender === 'FEMALE' ? '女' : '男'

                  return (
                    <div className="min-w-0 rounded-card border border-violet-100 bg-gradient-to-br from-violet-50/40 to-indigo-50/30 p-3">
                      <div className="mb-3">
                        <p className="text-sm font-semibold text-slate-900">📏 身高-月龄 WHO 成长曲线（{genderLabel}）</p>
                        <p className="mt-1 text-xs text-violet-700">宝宝身高与 WHO 标准百分位（P3–P97）对比</p>
                      </div>
                      <StableResponsiveChart className="min-w-0 h-64 sm:h-80 -ml-2">
                        <ComposedChart data={mergedData} margin={{ top: 10, right: 15, left: -5, bottom: 0 }} style={{ outline: 'none' }}>
                          <defs>
                            <linearGradient id="whoHeightOuter" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.08} />
                              <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0.03} />
                            </linearGradient>
                            <linearGradient id="whoHeightInner" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.18} />
                              <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0.08} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="#ede9fe" />
                          <XAxis
                            dataKey="ageMonths"
                            type="number"
                            domain={[minMonth, maxMonth]}
                            tick={{ fontSize: 11, fill: '#475569' }}
                            tickFormatter={(v) => `${v}月`}
                            axisLine={{ stroke: '#c4b5fd' }}
                            tickLine={{ stroke: '#c4b5fd' }}
                          />
                          <YAxis
                            tick={{ fontSize: 11, fill: '#475569' }}
                            tickFormatter={(v) => `${v}cm`}
                            axisLine={{ stroke: '#c4b5fd' }}
                            tickLine={{ stroke: '#c4b5fd' }}
                          />
                          <Tooltip
                            content={({ active, payload }) => {
                              if (!active || !payload?.length) return null
                              const data = payload[0]?.payload
                              if (!data) return null
                              const ageMonths = data.ageMonths as number
                              const months = Math.floor(ageMonths)
                              const days = Math.round((ageMonths - months) * 30.4375)
                              const ageDisplay = months > 0 ? `${months}月${days}天` : `${Math.round(ageMonths * 30.4375)}天`
                              return (
                                <div className="rounded-lg border border-violet-200 bg-white px-3 py-2 text-xs shadow-md">
                                  <p className="mb-1 font-medium text-slate-700">{data.label || `${ageMonths.toFixed(1)}月龄`}<span className="ml-1.5 font-normal text-slate-400">({ageDisplay})</span></p>
                                  {data.宝宝身高 !== undefined && (
                                    <p className="text-indigo-600 font-bold">宝宝: {data.宝宝身高} cm</p>
                                  )}
                                  <div className="mt-1 space-y-0.5 text-slate-500">
                                    <p>P97: {data.P97}cm</p>
                                    <p>P85: {data.P85}cm</p>
                                    <p className="font-medium text-violet-600">P50: {data.P50}cm（中位数）</p>
                                    <p>P15: {data.P15}cm</p>
                                    <p>P3: {data.P3}cm</p>
                                  </div>
                                </div>
                              )
                            }}
                          />
                          <Area type="monotone" dataKey="P97" stroke="none" fill="url(#whoHeightOuter)" connectNulls />
                          <Area type="monotone" dataKey="P3" stroke="none" fill="#fff" connectNulls />
                          <Area type="monotone" dataKey="P85" stroke="none" fill="url(#whoHeightInner)" connectNulls />
                          <Area type="monotone" dataKey="P15" stroke="none" fill="#fff" connectNulls />
                          <Line type="monotone" dataKey="P3" stroke="#c4b5fd" strokeWidth={1} strokeDasharray="4 3" dot={false} connectNulls />
                          <Line type="monotone" dataKey="P15" stroke="#a78bfa" strokeWidth={1} strokeDasharray="4 3" dot={false} connectNulls />
                          <Line type="monotone" dataKey="P50" stroke="#8b5cf6" strokeWidth={1.5} strokeDasharray="6 3" dot={false} connectNulls />
                          <Line type="monotone" dataKey="P85" stroke="#a78bfa" strokeWidth={1} strokeDasharray="4 3" dot={false} connectNulls />
                          <Line type="monotone" dataKey="P97" stroke="#c4b5fd" strokeWidth={1} strokeDasharray="4 3" dot={false} connectNulls />
                          <Line
                            type="monotone"
                            dataKey="宝宝身高"
                            stroke={palette.indigo}
                            strokeWidth={2.5}
                            dot={{ fill: palette.indigo, r: 5, strokeWidth: 2, stroke: '#fff' }}
                            activeDot={{ r: 7 }}
                            connectNulls
                          >
                            <LabelList
                              dataKey="宝宝身高"
                              content={makeWHOSparseLabel('宝宝身高', palette.indigo, 'cm', heightBabyIndices)}
                            />
                          </Line>
                        </ComposedChart>
                      </StableResponsiveChart>
                      <div className="mt-2 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[11px] text-slate-500">
                        <span className="flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: palette.indigo }} />宝宝实际</span>
                        <span className="flex items-center gap-1"><span className="inline-block h-0.5 w-4 border-t-2 border-dashed" style={{ borderColor: '#8b5cf6' }} />P50 中位数</span>
                        <span className="flex items-center gap-1"><span className="inline-block h-3 w-4 rounded" style={{ backgroundColor: 'rgba(139,92,246,0.15)' }} />P15–P85</span>
                        <span className="flex items-center gap-1"><span className="inline-block h-3 w-4 rounded" style={{ backgroundColor: 'rgba(139,92,246,0.06)' }} />P3–P97</span>
                      </div>
                    </div>
                  )
                })()}
              </div>

              {recentVaccineCard}
            </div>
          )}
        </>
      )}

    </div>
  )
}
