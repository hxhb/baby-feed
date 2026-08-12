'use client'

import { cloneElement, isValidElement, useState, useEffect, useCallback, useRef, type ReactElement, type ReactNode } from 'react'
import {
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
import { Activity, AlertTriangle, Baby as BabyIcon, ChartColumn, CheckCircle2, ChevronDown, ChevronUp, ClipboardList, Clock, Droplets, Lightbulb, Milk, Moon, Pill, Ruler, Scale, Syringe, Thermometer, TrendingUp } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { dedupeRequest, invalidateRequestCache } from '@/lib/client-request-cache'
import type { PreloadedStatsData } from '@/lib/server-stats'
import { StatsEmptyState, StatsPanel, StatsRangePicker, StatsSegmentedTabs } from '@/components/StatsUi'
import MemoSection from '@/components/MemoSection'
import ToothGrowthStats from '@/components/ToothGrowthStats'
import { generateWHOCurve } from '@/lib/who-growth-standards'
import { getBeijingToday } from '@/lib/time'
import { buildVaccineProgressGroups } from '@/lib/vaccine-progress'

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
  defaultTab?: StatsSubpage
}

type StatsSubpage = 'dashboard' | 'insights' | 'memos'

type StatsRangeSelection =
  | { kind: 'preset'; days: number }
  | { kind: 'custom'; startDate: string; endDate: string }

const HEATMAP_VISIBLE_ROWS = 10
const HEATMAP_ROW_HEIGHT_PX = 24
const HEATMAP_ROW_GAP_PX = 3
const HEATMAP_MAX_HEIGHT_PX = HEATMAP_VISIBLE_ROWS * HEATMAP_ROW_HEIGHT_PX + (HEATMAP_VISIBLE_ROWS - 1) * HEATMAP_ROW_GAP_PX

function addUtcDays(date: string, days: number) {
  const value = new Date(`${date}T00:00:00Z`)
  value.setUTCDate(value.getUTCDate() + days)
  return value.toISOString().slice(0, 10)
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
function getTimeDistributedIndices(timestamps: number[], targetCount = 4) {
  const totalPoints = timestamps.length
  if (totalPoints <= targetCount) {
    return new Set(timestamps.map((_, index) => index))
  }

  const selectedIndices = [0]
  const firstTimestamp = timestamps[0]
  const lastTimestamp = timestamps[totalPoints - 1]
  let previousIndex = 0

  for (let slot = 1; slot < targetCount - 1; slot += 1) {
    const targetTimestamp = firstTimestamp + ((lastTimestamp - firstTimestamp) * slot) / (targetCount - 1)
    const minIndex = previousIndex + 1
    const maxIndex = totalPoints - (targetCount - slot)
    let nearestIndex = minIndex

    for (let index = minIndex + 1; index <= maxIndex; index += 1) {
      if (Math.abs(timestamps[index] - targetTimestamp) < Math.abs(timestamps[nearestIndex] - targetTimestamp)) {
        nearestIndex = index
      }
    }

    selectedIndices.push(nearestIndex)
    previousIndex = nearestIndex
  }

  selectedIndices.push(totalPoints - 1)
  return new Set(selectedIndices)
}

function makeSparseLabel(
  color: string,
  unit: string,
  timestamps: number[],
) {
  const labelIndices = getTimeDistributedIndices(timestamps)
  const labelOrder = new Map([...labelIndices].map((index, order) => [index, order]))

  return function SparseLabel(props: LabelProps) {
    const { x, y, width, index, value } = props as LabelProps & {
      x: number; y: number; width?: number; index: number
    }
    if (value == null || value === '') return null

    if (!labelIndices.has(index)) return null

    // 交替偏移：偶数索引向上 14px，奇数向上 26px
    const offsetY = ((labelOrder.get(index) || 0) % 2 === 0) ? -14 : -26
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

function makeKeyPointDot(timestamps: number[], color: string) {
  const keyPointIndices = getTimeDistributedIndices(timestamps)

  return function KeyPointDot({ cx, cy, index }: { cx?: number; cy?: number; index?: number }) {
    if (cx == null || cy == null || index == null || !keyPointIndices.has(index)) {
      return null
    }

    return <circle cx={cx} cy={cy} r={3.5} fill="white" stroke={color} strokeWidth={2.25} />
  }
}

interface GrowthTrendCardProps<T extends { timestamp: number }> {
  title: string
  description: string
  descriptionClassName: string
  data: T[]
  dataKey: string
  unit: string
  color: string
  axisColor: string
  yPadding: number
  emptyIcon: LucideIcon
  emptyTitle: string
  emptyDescription: string
  formatAxisDate: (timestamp: number) => string
  formatTooltipDate: (timestamp: number) => string
  formatAge: (timestamp: number) => string | null
  renderTooltipDetails?: (datum: T) => ReactNode
}

function GrowthTrendCard<T extends { timestamp: number }>({
  title,
  description,
  descriptionClassName,
  data,
  dataKey,
  unit,
  color,
  axisColor,
  yPadding,
  emptyIcon,
  emptyTitle,
  emptyDescription,
  formatAxisDate,
  formatTooltipDate,
  formatAge,
  renderTooltipDetails,
}: GrowthTrendCardProps<T>) {
  const timestamps = data.map(item => item.timestamp)

  return (
    <div className="min-w-0 rounded-card border border-slate-200 bg-white p-3 shadow-card">
      <div className="mb-3">
        <p className="text-sm font-semibold text-slate-900">{title}</p>
        <p className={`mt-1 text-xs ${descriptionClassName}`}>{description}</p>
      </div>
      {data.length > 0 ? (
        <StableResponsiveChart className="-ml-2 h-56 min-w-0 sm:h-64">
          <LineChart data={data} margin={{ top: 34, right: 28, left: -10, bottom: 0 }} style={{ outline: 'none' }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis
              dataKey="timestamp"
              type="number"
              domain={['dataMin', 'dataMax']}
              scale="time"
              tick={{ fontSize: 11, fill: '#475569' }}
              tickFormatter={formatAxisDate}
              tickCount={Math.min(data.length, 6)}
              axisLine={{ stroke: axisColor }}
              tickLine={{ stroke: axisColor }}
            />
            <YAxis
              domain={[`dataMin - ${yPadding}`, `dataMax + ${yPadding}`]}
              tick={{ fontSize: 11, fill: '#475569' }}
              tickFormatter={unit ? value => `${value}${unit}` : undefined}
              axisLine={{ stroke: axisColor }}
              tickLine={{ stroke: axisColor }}
            />
            <Tooltip content={({ active, payload }) => {
              if (!active || !payload?.length) return null
              const datum = payload[0].payload as T
              const age = formatAge(datum.timestamp)

              return (
                <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-md">
                  <p className="font-semibold text-slate-900">
                    {formatTooltipDate(datum.timestamp)}
                    {age ? <span className="ml-1.5 font-normal text-slate-400">({age})</span> : null}
                  </p>
                  <p className="mt-0.5" style={{ color }}>
                    {title.replace('趋势', '').trim()}：{String(payload[0].value)}{unit ? ` ${unit}` : ''}
                  </p>
                  {renderTooltipDetails?.(datum)}
                </div>
              )
            }} />
            <Line
              type="monotone"
              dataKey={dataKey}
              stroke={color}
              strokeWidth={2.5}
              dot={makeKeyPointDot(timestamps, color)}
              activeDot={{ r: 6 }}
              isAnimationActive={false}
            >
              <LabelList dataKey={dataKey} content={makeSparseLabel(color, unit, timestamps)} />
            </Line>
          </LineChart>
        </StableResponsiveChart>
      ) : (
        <StatsEmptyState icon={emptyIcon} title={emptyTitle} description={emptyDescription} />
      )}
    </div>
  )
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
  defaultTab = 'dashboard',
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
  const [statsRefreshing, setStatsRefreshing] = useState(false)
  const [statsError, setStatsError] = useState('')
  const [rangeSelection, setRangeSelection] = useState<StatsRangeSelection>({ kind: 'preset', days: 7 })
  const [customRange, setCustomRange] = useState(() => {
    const endDate = getBeijingToday()
    return { startDate: addUtcDays(endDate, -6), endDate }
  })
  const [activeSubpage, setActiveSubpage] = useState<StatsSubpage>(defaultTab)
  const heatmapScrollRef = useRef<HTMLDivElement | null>(null)
  const statsRequestIdRef = useRef(0)
  const initialStatsUsedRef = useRef(false)
  const [freshFetch] = useState(() => {
    if (typeof window !== 'undefined') {
      const savedTs = window.sessionStorage.getItem('record_saved_ts')
      if (savedTs && Date.now() - Number(savedTs) < 10000) {
        return true
      }
    }
    return false
  })
  const [showCompletedVaccines, setShowCompletedVaccines] = useState(false)
  const today = getBeijingToday()
  const rangeDayCount = rangeSelection.kind === 'preset'
    ? rangeSelection.days
    : Math.floor((new Date(`${rangeSelection.endDate}T00:00:00Z`).getTime() - new Date(`${rangeSelection.startDate}T00:00:00Z`).getTime()) / (24 * 60 * 60 * 1000)) + 1
  const rangeLabel = rangeSelection.kind === 'preset'
    ? `近 ${rangeSelection.days} 天`
    : `${rangeSelection.startDate.slice(5).replace('-', '/')} - ${rangeSelection.endDate.slice(5).replace('-', '/')}`
  const hasInitialStats = !freshFetch && !!initialStats && selectedBabyId === initialStats.baby.id && rangeSelection.kind === 'preset' && rangeSelection.days === 7

  // Sync activeSubpage when URL param (defaultTab) changes (e.g. browser back/forward)
  useEffect(() => {
    setActiveSubpage(defaultTab)
  }, [defaultTab])

  // If a record was just saved, invalidate cache to ensure fresh API responses
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedTs = window.sessionStorage.getItem('record_saved_ts')
      if (savedTs && Date.now() - Number(savedTs) < 10000) {
        invalidateRequestCache()
      }
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
    const requestId = ++statsRequestIdRef.current
    if (!selectedBabyId) {
      setStats(null)
      setStatsError('')
      setStatsRefreshing(false)
      return
    }

    if (hasInitialStats && !initialStatsUsedRef.current) {
      initialStatsUsedRef.current = true
      setStats(initialStats)
      setStatsError('')
      setStatsRefreshing(false)
      return
    }

    setStatsRefreshing(true)
    setStatsError('')
    setStats(previous => previous?.baby.id === selectedBabyId ? previous : null)
    try {
      const rangeQuery = rangeSelection.kind === 'preset'
        ? `days=${rangeSelection.days}`
        : `startDate=${rangeSelection.startDate}&endDate=${rangeSelection.endDate}`
      const cacheKey = `stats:${selectedBabyId}:${rangeQuery}`
      const data = await dedupeRequest<StatsData>(cacheKey, async () => {
        const response = await fetch(`/api/stats?babyId=${selectedBabyId}&${rangeQuery}`)
        if (!response.ok) {
          const payload = await response.json().catch(() => null) as { error?: unknown } | null
          throw new Error(typeof payload?.error === 'string' ? payload.error : '获取统计数据失败')
        }
        return response.json() as Promise<StatsData>
      })
      if (statsRequestIdRef.current === requestId) {
        setStats(data)
      }
    } catch (error) {
      console.error('获取统计数据失败:', error)
      if (statsRequestIdRef.current === requestId) {
        const message = error instanceof Error ? error.message : '获取统计数据失败'
        setStats(null)
        setStatsError(/重试|稍后再试/.test(message) ? message : `${message}，请重试`)
      }
    } finally {
      if (statsRequestIdRef.current === requestId) {
        setStatsRefreshing(false)
      }
    }
  }, [selectedBabyId, rangeSelection, hasInitialStats, initialStats])

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

  useEffect(() => {
    const node = heatmapScrollRef.current
    if (!node) return

    const frame = window.requestAnimationFrame(() => {
      node.scrollTop = node.scrollHeight
    })
    return () => window.cancelAnimationFrame(frame)
  }, [activeSubpage, stats?.lastDays.length])

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
        <StatsPanel padding="none" className="px-4 py-16 text-center">
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
  const isDenseRange = chartData.length > 14
  const dailyTickInterval = Math.max(0, Math.ceil(chartData.length / 6) - 1)

  const weightRecords = stats?.weightTrend || []
  const heightRecords = stats?.heightTrend || []

  const weightData = weightRecords.map(p => {
    return {
      timestamp: new Date(p.recordedAt).getTime(),
      label: formatTrendAxisDate(new Date(p.recordedAt).getTime()),
      体重: p.weight
    }
  })

  const heightData = heightRecords.map(p => {
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
    const sortedHeights = heightRecords
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
    for (const w of weightRecords) {
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

  const latestWeightRecord = weightRecords[weightRecords.length - 1] || null
  const previousWeightRecord = weightRecords.length > 1 ? weightRecords[weightRecords.length - 2] : null
  const latestHeightRecord = heightRecords[heightRecords.length - 1] || null
  const previousHeightRecord = heightRecords.length > 1 ? heightRecords[heightRecords.length - 2] : null
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
  const overallWeightChange = latestWeightRecord && weightRecords.length > 1
    ? Number((latestWeightRecord.weight - weightRecords[0].weight).toFixed(2))
    : null
  const latestWeightChange = latestWeightRecord && previousWeightRecord
    ? Number((latestWeightRecord.weight - previousWeightRecord.weight).toFixed(2))
    : null
  const overallHeightChange = latestHeightRecord && heightRecords.length > 1
    ? Number((latestHeightRecord.height - heightRecords[0].height).toFixed(1))
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
      icon: TrendingUp,
    },
    {
      key: 'insights',
      label: '数据洞察',
      description: '查看喂养、成长与健康洞察',
      icon: Lightbulb,
    },
    {
      key: 'memos',
      label: '备忘列表',
      description: '查看备忘录与待办事项',
      icon: ClipboardList,
    },
  ]

  const handleSubpageChange = (value: string) => {
    const nextSubpage = value as StatsSubpage
    setActiveSubpage(nextSubpage)

    if (typeof window === 'undefined') return

    const url = new URL(window.location.href)
    if (nextSubpage === 'dashboard') {
      url.searchParams.delete('tab')
    } else {
      url.searchParams.set('tab', nextSubpage)
    }
    window.history.pushState({}, '', `${url.pathname}${url.search}${url.hash}`)
  }
  const vaccineProgressSummary = buildVaccineProgressGroups(stats?.vaccineRecords || [])
    .map(item => ({
      ...item,
      latestDoseNumber: item.currentDoseNumber,
    }))
    .sort((a, b) => Number(a.isCompleted) - Number(b.isCompleted))
  const pendingVaccines = vaccineProgressSummary.filter(item => !item.isCompleted)
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
            <div key={item.key} className="flex items-center gap-2 rounded-lg border border-amber-100 bg-amber-50/60 px-2.5 py-2">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <p className="text-sm font-bold text-slate-900 truncate">{item.vaccineName}</p>
                  <span className="shrink-0 rounded-full bg-amber-200 px-1.5 py-0.5 text-[10px] font-bold text-amber-800">
                    {item.remainingDoses == null ? '待完善' : `差${item.remainingDoses}针`}
                  </span>
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
                  <span key={item.key} className="text-[11px] text-emerald-700">
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

      {statsError && !stats ? (
        <StatsPanel className="text-center">
          <AlertTriangle size={24} className="mx-auto text-amber-600" aria-hidden="true" />
          <p className="mt-2 text-sm font-semibold text-slate-900">统计数据暂时无法加载</p>
          <p className="mt-1 text-xs text-slate-500" role="alert">{statsError}</p>
          <button
            type="button"
            onClick={() => void fetchStats()}
            className="mt-4 min-h-11 rounded-button bg-blue-600 px-4 text-sm font-semibold text-white transition-colors hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
          >
            重新加载
          </button>
        </StatsPanel>
      ) : null}

      {stats && (
        <>
          <StatsPanel padding="toolbar">
            <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:gap-3">
              <StatsSegmentedTabs
                items={subpageTabs}
                value={activeSubpage}
                onChange={handleSubpageChange}
                className="w-full lg:flex-1"
              />
              {activeSubpage !== 'memos' ? (
                <div className="border-t border-slate-100 px-1 pt-2 lg:ml-auto lg:w-auto lg:shrink-0 lg:border-l lg:border-t-0 lg:pl-3 lg:pt-0">
                  <StatsRangePicker
                    value={rangeSelection.kind === 'preset' ? rangeSelection.days : 'custom'}
                    onChange={(days) => setRangeSelection({ kind: 'preset', days })}
                    customStartDate={customRange.startDate}
                    customEndDate={customRange.endDate}
                    maxDate={today}
                    onApplyCustomRange={(startDate, endDate) => {
                      setCustomRange({ startDate, endDate })
                      setRangeSelection({ kind: 'custom', startDate, endDate })
                    }}
                    loading={statsRefreshing}
                  />
                </div>
              ) : null}
            </div>
          </StatsPanel>

          {activeSubpage === 'dashboard' && (
            <>
              <section className="py-1">
                <div>
                  <div className="flex items-center gap-2">
                    <ChartColumn size={18} className="text-blue-600" />
                    <h3 className="text-base font-bold text-slate-900">趋势工作台</h3>
                  </div>
                  <p className="mt-1 text-sm text-slate-500">
                    喂养、大小便与睡眠按所选周期统计；体重、身高、BMI、疫苗与牙齿展示全部历史记录。
                  </p>
                </div>

                <div className="mt-4 grid gap-4 xl:grid-cols-2">
                  <div className="min-w-0 rounded-card border border-slate-200 bg-white p-3 shadow-card xl:col-span-2">
                    <div className="mb-3 flex items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">喂养趋势</p>
                        <p className="mt-1 text-xs text-slate-500">母乳亲喂 + 瓶喂母乳 + 奶粉</p>
                      </div>
                    </div>
                    <StableResponsiveChart className="min-w-0 h-56 sm:h-72 -ml-2">
                      <ComposedChart data={chartData} margin={{ top: 25, right: 5, left: -10, bottom: 0 }} style={{ outline: 'none' }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis dataKey="date" interval={dailyTickInterval} minTickGap={24} tick={{ fontSize: 11, fill: '#64748b' }} axisLine={{ stroke: '#cbd5e1' }} tickLine={false} />
                        <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
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
                        {isDenseRange ? (
                          <>
                            <Line type="monotone" dataKey="母乳时长" stroke="#db2777" strokeWidth={2} dot={false} activeDot={{ r: 5 }} name="亲喂时长(分钟)" />
                            <Line type="monotone" dataKey="母乳瓶喂量" stroke="#7c3aed" strokeWidth={2} dot={false} activeDot={{ r: 5 }} name="瓶喂量(ml)" />
                            <Line type="monotone" dataKey="奶粉量" stroke={palette.blue} strokeWidth={2} dot={false} activeDot={{ r: 5 }} name="奶粉量(ml)" />
                          </>
                        ) : (
                          <>
                            <Bar dataKey="母乳时长" fill="#db2777" name="亲喂时长(分钟)" radius={[2, 2, 0, 0]}>
                              <LabelList dataKey="母乳时长" position="top" fill="#be185d" fontSize={10} fontWeight={600} />
                            </Bar>
                            <Bar dataKey="母乳瓶喂量" fill="#7c3aed" name="瓶喂量(ml)" radius={[2, 2, 0, 0]}>
                              <LabelList dataKey="母乳瓶喂量" position="top" fill="#6d28d9" fontSize={10} fontWeight={600} />
                            </Bar>
                            <Bar dataKey="奶粉量" fill={palette.blue} name="奶粉量(ml)" radius={[2, 2, 0, 0]}>
                              <LabelList dataKey="奶粉量" position="top" fill={palette.blue} fontSize={10} fontWeight={600} />
                            </Bar>
                          </>
                        )}
                      </ComposedChart>
                    </StableResponsiveChart>
                  </div>

                  {/* Feeding heatmap */}
                  <div className="min-w-0 rounded-card border border-slate-200 bg-white p-3 shadow-card">
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
                          <div
                            ref={heatmapScrollRef}
                            className={`grid ${dates.length > HEATMAP_VISIBLE_ROWS ? 'stats-heatmap-scroll overflow-y-auto pr-1' : ''}`}
                            style={{
                              rowGap: HEATMAP_ROW_GAP_PX,
                              maxHeight: dates.length > HEATMAP_VISIBLE_ROWS ? HEATMAP_MAX_HEIGHT_PX : undefined,
                            }}
                            tabIndex={dates.length > HEATMAP_VISIBLE_ROWS ? 0 : undefined}
                            role={dates.length > HEATMAP_VISIBLE_ROWS ? 'region' : undefined}
                            aria-label={dates.length > HEATMAP_VISIBLE_ROWS ? `喂养时刻热力图，共 ${dates.length} 天，当前显示最多 ${HEATMAP_VISIBLE_ROWS} 天` : undefined}
                          >
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
                                        className={`flex items-center justify-center rounded-[4px] text-[11px] font-bold transition-colors ${getCellStyle(count)} ${getCellText(count)}`}
                                        style={{ height: HEATMAP_ROW_HEIGHT_PX }}
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
                  <div className="min-w-0 rounded-card border border-slate-200 bg-white p-3 shadow-card">
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
                          <ComposedChart data={sleepChartData} margin={{ top: 22, right: 5, left: -10, bottom: 0 }} style={{ outline: 'none' }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                            <XAxis dataKey="date" interval={dailyTickInterval} minTickGap={24} tick={{ fontSize: 11, fill: '#64748b' }} axisLine={{ stroke: '#cbd5e1' }} tickLine={false} />
                            <YAxis tick={{ fontSize: 11, fill: '#64748b' }} tickFormatter={(v) => `${v}h`} axisLine={false} tickLine={false} domain={[0, (dataMax: number) => Math.ceil(dataMax) + 1]} />
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
                            {isDenseRange ? (
                              <Line type="monotone" dataKey="睡眠时长" stroke="#4f46e5" strokeWidth={2.25} dot={false} activeDot={{ r: 5 }} name="睡眠时长(小时)" />
                            ) : (
                              <Bar dataKey="睡眠时长" fill="#6366f1" name="睡眠时长(小时)" radius={[3, 3, 0, 0]} barSize={18}>
                                <LabelList dataKey="sleepLabel" position="top" fill="#4338ca" fontSize={10} fontWeight={600} />
                              </Bar>
                            )}
                          </ComposedChart>
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

                  <GrowthTrendCard
                    title="体重趋势"
                    description="全部体重记录的增长轨迹"
                    descriptionClassName="text-teal-700"
                    data={weightData}
                    dataKey="体重"
                    unit="kg"
                    color={palette.teal}
                    axisColor="#99f6e4"
                    yPadding={0.3}
                    emptyIcon={Scale}
                    emptyTitle="暂无体重记录"
                    emptyDescription="在添加记录中记录宝宝体重后，这里将展示体重变化趋势"
                    formatAxisDate={formatTrendAxisDate}
                    formatTooltipDate={formatTrendTooltipLabel}
                    formatAge={formatBabyAge}
                  />

                  <GrowthTrendCard
                    title="身高趋势"
                    description="全部身高记录的变化趋势"
                    descriptionClassName="text-indigo-700"
                    data={heightData}
                    dataKey="身高"
                    unit="cm"
                    color={palette.indigo}
                    axisColor="#c7d2fe"
                    yPadding={1}
                    emptyIcon={Ruler}
                    emptyTitle="暂无身高记录"
                    emptyDescription="在添加记录中记录宝宝身高后，这里将展示身高变化趋势"
                    formatAxisDate={formatTrendAxisDate}
                    formatTooltipDate={formatTrendTooltipLabel}
                    formatAge={formatBabyAge}
                  />

                  <GrowthTrendCard
                    title="BMI 趋势"
                    description="根据全部身高与体重记录综合评估"
                    descriptionClassName="text-emerald-700"
                    data={bmiData}
                    dataKey="BMI"
                    unit=""
                    color={palette.emerald}
                    axisColor="#6ee7b7"
                    yPadding={1}
                    emptyIcon={Scale}
                    emptyTitle="暂无 BMI 数据"
                    emptyDescription="需要同时有体重和身高记录才能计算 BMI"
                    formatAxisDate={formatTrendAxisDate}
                    formatTooltipDate={formatTrendTooltipLabel}
                    formatAge={formatBabyAge}
                    renderTooltipDetails={data => (
                      <p className="mt-0.5 text-slate-500">体重: {data.weight}kg · 身高: {data.height}cm</p>
                    )}
                  />

                </div>
              </section>

              <StatsPanel padding="compact">
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
                          <div key={item.key} className="rounded-xl border p-3 border-amber-100 bg-amber-50/20">
                            {/* Header row: name + status + progress bar */}
                            <div className="flex items-center gap-2">
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1.5">
                                  <p className="text-sm font-bold text-slate-900 truncate">{item.vaccineName}</p>
                                  <span className="shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-bold bg-amber-200 text-amber-800">
                                    {item.remainingDoses == null ? '待完善' : `差${item.remainingDoses}针`}
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
                                  <div key={doseEntry.key} className="flex items-start gap-1">
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
                              <div key={item.key} className="rounded-xl border p-3 border-emerald-100 bg-emerald-50/30">
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
                                      <div key={doseEntry.key} className="flex items-start gap-1">
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

              {selectedBabyId ? (
                <ToothGrowthStats
                  records={stats.toothEruptionRecords || []}
                  babyId={selectedBabyId}
                  onRecordsChanged={fetchStats}
                />
              ) : null}
            </>
          )}

          {activeSubpage === 'memos' && (
            <>
              {selectedBabyId && (
                <MemoSection
                  memoRecords={stats.memoRecords || []}
                  babyId={selectedBabyId}
                />
              )}
            </>
          )}

          {activeSubpage === 'insights' && (
            <div className="space-y-3">

              {/* Period overview */}
              <section className="rounded-card border border-slate-200 bg-white p-3 shadow-card sm:p-4" aria-labelledby="period-overview-title">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
                      <BabyIcon size={18} aria-hidden="true" />
                    </span>
                    <div>
                      <h2 id="period-overview-title" className="text-sm font-bold text-slate-900">{stats.baby.name}的周期概览</h2>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {babyAgeLabel ? `当前月龄 ${babyAgeLabel}` : '当前统计数据'}
                        {babyAgeDays !== null ? ` · ${babyAgeDays}天` : ''}
                      </p>
                    </div>
                  </div>
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600">{rangeLabel}</span>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-slate-200 bg-slate-200 sm:grid-cols-4">
                  {[
                    { label: '喂养总次数', value: `${stats.totalStats.totalFeedings}`, unit: '次' },
                    { label: '奶量总计', value: `${totalMilkAmount}`, unit: 'ml' },
                    { label: '日均睡眠', value: avgSleepMinutes > 0 ? `${avgSleepHours}h${avgSleepMins > 0 ? `${avgSleepMins}m` : ''}` : '-', unit: '' },
                    { label: '尿布记录', value: `${totalPeeCount + totalPoopCount}`, unit: '次' },
                  ].map(item => (
                    <div key={item.label} className="min-w-0 bg-white px-3 py-3">
                      <p className="text-[11px] font-medium text-slate-500">{item.label}</p>
                      <p className="mt-1 truncate text-lg font-bold tabular-nums text-slate-900">
                        {item.value}<span className="ml-0.5 text-xs font-semibold text-slate-500">{item.unit}</span>
                      </p>
                    </div>
                  ))}
                </div>
                <p className="mt-2 text-[11px] text-slate-500">喂养记录覆盖 {activeFeedingDays}/{rangeDayCount} 天 · 睡眠记录覆盖 {sleepActiveDays}/{rangeDayCount} 天</p>
              </section>

              {/* Feeding insights */}
              <section className="rounded-card border border-slate-200 bg-white p-3 shadow-card sm:p-4" aria-labelledby="feeding-insights-title">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 text-blue-700">
                    <Milk size={16} aria-hidden="true" />
                    <h2 id="feeding-insights-title" className="text-sm font-bold">喂养洞察</h2>
                  </div>
                  <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-bold text-blue-700">{rangeLabel}</span>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <div className="rounded-lg bg-slate-50 px-2.5 py-2.5">
                    <p className="text-[11px] text-slate-500">喂养次数</p>
                    <p className="text-base font-bold text-slate-900">{stats.totalStats.totalFeedings}</p>
                  </div>
                  <div className="rounded-lg bg-slate-50 px-2.5 py-2.5">
                    <p className="text-[11px] text-slate-500">亲喂时长</p>
                    <p className="text-base font-bold text-slate-900">{formatMinutes(stats.totalStats.totalBreastDuration)}</p>
                  </div>
                  <div className="rounded-lg bg-slate-50 px-2.5 py-2.5">
                    <p className="text-[11px] text-slate-500">奶量总计</p>
                    <p className="text-base font-bold text-slate-900">{totalMilkAmount}<span className="text-xs font-medium">ml</span></p>
                  </div>
                  <div className="rounded-lg bg-slate-50 px-2.5 py-2.5">
                    <p className="text-[11px] text-slate-500">记录天数</p>
                    <p className="text-base font-bold text-slate-900">{activeFeedingDays}<span className="text-xs font-medium">/{rangeDayCount}</span></p>
                  </div>
                </div>

                {/* Secondary metrics row */}
                <div className="mt-1.5 grid grid-cols-3 gap-1.5">
                  <div className="rounded-lg border border-slate-200 px-2 py-2 text-center">
                    <p className="text-[11px] text-blue-600">日均奶量</p>
                    <p className="text-sm font-bold text-slate-900">{averageMilkPerActiveDay}<span className="text-[11px] font-medium">ml</span></p>
                  </div>
                  <div className="rounded-lg border border-slate-200 px-2 py-2 text-center">
                    <p className="text-[11px] text-sky-600">日均频次</p>
                    <p className="text-sm font-bold text-slate-900">{averageFeedingsPerActiveDay > 0 ? averageFeedingsPerActiveDay.toFixed(1) : '-'}<span className="text-[11px] font-medium">次</span></p>
                  </div>
                  <div className="rounded-lg border border-slate-200 px-2 py-2 text-center">
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
                    <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-2.5 py-2">
                      <Moon size={14} className="shrink-0 text-blue-600" />
                      <div className="min-w-0">
                        <p className="text-[11px] text-slate-500">夜间喂养(22-06时)</p>
                        <p className="text-sm font-bold text-slate-900">{totalNightFeedings}次 / {nightFeedingActiveDays}天</p>
                        <p className="text-[11px] text-slate-400">日均 {nightFeedingActiveDays > 0 ? (totalNightFeedings / nightFeedingActiveDays).toFixed(1) : '0'}次</p>
                      </div>
                    </div>
                  )}
                  {totalBreastTime > 0 && (
                    <div className="col-span-2 rounded-lg border border-slate-200 bg-white px-2.5 py-2">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-[11px] text-slate-500">左右乳喂养比例</p>
                        <p className="text-xs font-bold text-slate-600">{formatMinutes(totalLeftBreast)} / {formatMinutes(totalRightBreast)}</p>
                      </div>
                      <div className="mt-1.5 flex h-2.5 overflow-hidden rounded-full bg-slate-100">
                        <div className="bg-blue-600 transition-all" style={{ width: `${leftBreastPct}%` }} />
                        <div className="bg-teal-500 transition-all" style={{ width: `${rightBreastPct}%` }} />
                      </div>
                      <div className="mt-1 flex justify-between text-[11px]">
                        <span className="font-medium text-blue-700">左 {leftBreastPct}%</span>
                        <span className="font-medium text-teal-700">右 {rightBreastPct}%</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Peak days summary - compact text */}
                <div className="mt-2 space-y-1.5 border-t border-slate-100 pt-2 text-xs leading-[18px] text-slate-500">
                  {peakMilkIntakeDay && (peakMilkIntakeDay.totalBreastMilkAmount + peakMilkIntakeDay.totalFormulaAmount > 0) && (
                    <p className="flex items-start gap-1.5"><TrendingUp size={13} className="mt-0.5 shrink-0 text-blue-600" aria-hidden="true" /><span>{peakMilkIntakeDay.date} 奶量最高 <strong className="font-semibold text-blue-700">{peakMilkIntakeDay.totalBreastMilkAmount + peakMilkIntakeDay.totalFormulaAmount}ml</strong></span></p>
                  )}
                  {maxBreastfeedingDay && maxBreastfeedingDay.totalBreastDuration > 0 && (
                    <p className="flex items-start gap-1.5"><Clock size={13} className="mt-0.5 shrink-0 text-teal-600" aria-hidden="true" /><span>{maxBreastfeedingDay.date} 亲喂最长 <strong className="font-semibold text-teal-700">{formatMinutes(maxBreastfeedingDay.totalBreastDuration)}</strong></span></p>
                  )}
                  {milkAmountStdDev !== null && averageMilkPerActiveDay > 0 && (
                    <p className="flex items-start gap-1.5"><Activity size={13} className="mt-0.5 shrink-0 text-slate-500" aria-hidden="true" /><span>日奶量波动 ±{milkAmountStdDev}ml（均值 {averageMilkPerActiveDay}ml）</span></p>
                  )}
                </div>
              </section>

              {/* Growth + Diaper + Health */}
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">

                {/* Growth insight */}
                <section className="rounded-card border border-slate-200 bg-white p-3 shadow-card" aria-labelledby="growth-insight-title">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 text-blue-700">
                      <TrendingUp size={14} />
                      <h2 id="growth-insight-title" className="text-sm font-bold">成长洞察</h2>
                    </div>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500">全部记录</span>
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-1.5">
                    <div className="rounded-lg bg-slate-50 px-2.5 py-2">
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
                    <div className="rounded-lg bg-slate-50 px-2.5 py-2">
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
                </section>

                {/* Diaper insight */}
                <section className="rounded-card border border-slate-200 bg-white p-3 shadow-card" aria-labelledby="diaper-insight-title">
                  <div className="flex items-center gap-1.5 text-blue-700">
                    <Droplets size={14} />
                    <h2 id="diaper-insight-title" className="text-sm font-bold">大小便</h2>
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
                        <p className="flex items-start gap-1.5 text-xs font-semibold text-red-700"><AlertTriangle size={14} className="mt-0.5 shrink-0" aria-hidden="true" /><span>已连续 {consecutiveNoPoopDays} 天未记录大便</span></p>
                      </div>
                    )}
                    {peakDiaperDay && (peakDiaperDay.peeCount > 0 || peakDiaperDay.poopCount > 0) && (
                      <p className="text-[11px] text-slate-400">高峰 {peakDiaperDay.date} 小便{peakDiaperDay.peeCount}+大便{peakDiaperDay.poopCount}</p>
                    )}
                  </div>
                </section>

                {/* Health reminder */}
                <section className="rounded-card border border-slate-200 bg-white p-3 shadow-card" aria-labelledby="health-insight-title">
                  <div className="flex items-center gap-1.5 text-blue-700">
                    <Thermometer size={14} />
                    <h2 id="health-insight-title" className="text-sm font-bold">健康提醒</h2>
                  </div>
                  <div className="mt-2 space-y-1.5">
                    {/* Temperature */}
                    <div className="rounded-lg bg-amber-50 px-2.5 py-2">
                      <div className="flex items-center justify-between">
                        <p className="text-[11px] text-amber-600">体温覆盖</p>
                        <p className="text-xs font-bold text-slate-700">{temperatureRecordCount}/{rangeDayCount}天</p>
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
                        <p className="mt-0.5 flex items-center gap-1 text-[11px] text-red-700"><AlertTriangle size={12} aria-hidden="true" />最高 {maxTemperatureDay.temperature}°C ({maxTemperatureDay.date})</p>
                      )}
                    </div>
                    {/* AD */}
                    <div className="rounded-lg bg-orange-50 px-2.5 py-2">
                      <div className="flex items-center justify-between">
                        <p className="text-[11px] text-orange-600">AD补充</p>
                        <p className="text-xs font-bold text-slate-700">{adGivenDays}/{rangeDayCount}天</p>
                      </div>
                      {adConsecutiveStreak > 0 && (
                        <p className="mt-1 flex items-center gap-1 text-[11px] font-medium text-emerald-700"><CheckCircle2 size={12} aria-hidden="true" />已连续服用 {adConsecutiveStreak} 天</p>
                      )}
                      {adConsecutiveStreak === 0 && adMissedRecently > 0 && (
                        <p className="mt-1 flex items-center gap-1 text-[11px] font-medium text-amber-700"><Pill size={12} aria-hidden="true" />已 {adMissedRecently} 天未服用</p>
                      )}
                    </div>
                  </div>
                </section>
              </div>

              {/* Trend charts moved from dashboard */}
              <div className="grid gap-2.5 xl:grid-cols-2">
                {/* Diaper trend */}
                <div className="min-w-0 rounded-card border border-slate-200 bg-white p-3 shadow-card">
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">大小便趋势</p>
                      <p className="mt-1 text-xs text-amber-700">每日大小便次数变化</p>
                    </div>
                  </div>
                  {hasDiaperData ? (
                    <StableResponsiveChart className="min-w-0 h-56 sm:h-72 -ml-2">
                      <ComposedChart data={diaperChartData} margin={{ top: 25, right: 5, left: -10, bottom: 0 }} barCategoryGap="25%" style={{ outline: 'none' }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis dataKey="date" interval={dailyTickInterval} minTickGap={24} tick={{ fontSize: 11, fill: '#64748b' }} axisLine={{ stroke: '#cbd5e1' }} tickLine={false} />
                        <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                        <Tooltip content={(props) => renderTooltipWithAge(props as unknown as Parameters<typeof renderTooltipWithAge>[0], (items) => (
                          <>
                            {items.map(({ name, value }) => (
                              <p key={name} className="mt-0.5 text-slate-600">{name}：{value}次</p>
                            ))}
                          </>
                        ))} />
                        <Legend wrapperStyle={{ fontSize: 12 }} />
                        {isDenseRange ? (
                          <>
                            <Line type="monotone" dataKey="小便" stroke="#2563eb" strokeWidth={2} dot={false} activeDot={{ r: 5 }} name="小便" />
                            <Line type="monotone" dataKey="大便" stroke="#d97706" strokeWidth={2} dot={false} activeDot={{ r: 5 }} name="大便" />
                          </>
                        ) : (
                          <>
                            <Bar dataKey="小便" fill="#3b82f6" name="小便" radius={[2, 2, 0, 0]} stackId="diaper" maxBarSize={32}>
                              <LabelList dataKey="小便" position="inside" fill="#fff" fontSize={10} fontWeight={600} />
                            </Bar>
                            <Bar dataKey="大便" fill="#d97706" name="大便" radius={[2, 2, 0, 0]} stackId="diaper" maxBarSize={32}>
                              <LabelList dataKey="大便" position="top" fill="#b45309" fontSize={10} fontWeight={600} />
                            </Bar>
                          </>
                        )}
                      </ComposedChart>
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
                <div className="min-w-0 rounded-card border border-slate-200 bg-white p-3 shadow-card">
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">喂养结构趋势</p>
                      <p className="mt-1 text-xs text-slate-500">亲喂 / 瓶喂 / 奶粉次数变化</p>
                    </div>
                  </div>
                  {hasFeedingStructureData ? (
                    <StableResponsiveChart className="min-w-0 h-56 sm:h-72 -ml-2">
                      <ComposedChart data={feedingStructureData} margin={{ top: 20, right: 5, left: -10, bottom: 0 }} barCategoryGap="25%" style={{ outline: 'none' }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis dataKey="date" interval={dailyTickInterval} minTickGap={24} tick={{ fontSize: 11, fill: '#64748b' }} axisLine={{ stroke: '#cbd5e1' }} tickLine={false} />
                        <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                        <Tooltip content={(props) => renderTooltipWithAge(props as unknown as Parameters<typeof renderTooltipWithAge>[0], (items) => (
                          <>
                            {items.map(({ name, value }) => (
                              <p key={name} className="mt-0.5 text-slate-600">{name}：{value}次</p>
                            ))}
                          </>
                        ))} />
                        <Legend wrapperStyle={{ fontSize: 12 }} />
                        {isDenseRange ? (
                          <>
                            <Line type="monotone" dataKey="亲喂" stroke="#db2777" strokeWidth={2} dot={false} activeDot={{ r: 5 }} name="亲喂" />
                            <Line type="monotone" dataKey="瓶喂" stroke="#7c3aed" strokeWidth={2} dot={false} activeDot={{ r: 5 }} name="瓶喂" />
                            <Line type="monotone" dataKey="奶粉" stroke="#2563eb" strokeWidth={2} dot={false} activeDot={{ r: 5 }} name="奶粉" />
                          </>
                        ) : (
                          <>
                        <Bar dataKey="亲喂" fill="#db2777" name="亲喂" radius={[2, 2, 0, 0]} stackId="feed" maxBarSize={32}>
                          <LabelList dataKey="亲喂" content={({ x, y, width, height, value }) => {
                            if (!value || Number(value) === 0 || !height || Number(height) < 16 || !width || Number(width) < 14) return null
                            return <text x={Number(x) + Number(width) / 2} y={Number(y) + Number(height) / 2} textAnchor="middle" dominantBaseline="central" fill="#fff" fontSize={9} fontWeight={600}>{value}</text>
                          }} />
                        </Bar>
                        <Bar dataKey="瓶喂" fill="#7c3aed" name="瓶喂" radius={[2, 2, 0, 0]} stackId="feed" maxBarSize={32}>
                          <LabelList dataKey="瓶喂" content={({ x, y, width, height, value }) => {
                            if (!value || Number(value) === 0 || !height || Number(height) < 16 || !width || Number(width) < 14) return null
                            return <text x={Number(x) + Number(width) / 2} y={Number(y) + Number(height) / 2} textAnchor="middle" dominantBaseline="central" fill="#fff" fontSize={9} fontWeight={600}>{value}</text>
                          }} />
                        </Bar>
                        <Bar dataKey="奶粉" fill="#2563eb" name="奶粉" radius={[2, 2, 0, 0]} stackId="feed" maxBarSize={32}>
                          <LabelList dataKey="奶粉" content={({ x, y, width, value }) => {
                            if (!value || Number(value) === 0 || !width || Number(width) < 14) return null
                            return <text x={Number(x) + Number(width) / 2} y={Number(y) - 5} textAnchor="middle" fill="#2563eb" fontSize={9} fontWeight={600}>{value}</text>
                          }} />
                        </Bar>
                          </>
                        )}
                      </ComposedChart>
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
                <div className="min-w-0 rounded-card border border-slate-200 bg-white p-3 shadow-card">
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">左右乳时长趋势</p>
                      <p className="mt-1 text-xs text-slate-500">每日左右侧亲喂时长(分钟)</p>
                    </div>
                  </div>
                  {hasBreastSideData ? (
                    <StableResponsiveChart className="min-w-0 h-56 sm:h-72 -ml-2">
                      <ComposedChart data={breastSideData} margin={{ top: 25, right: 5, left: -10, bottom: 0 }} barGap={4} barCategoryGap="30%" style={{ outline: 'none' }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis dataKey="date" interval={dailyTickInterval} minTickGap={24} tick={{ fontSize: 11, fill: '#64748b' }} axisLine={{ stroke: '#cbd5e1' }} tickLine={false} />
                        <YAxis tick={{ fontSize: 11, fill: '#64748b' }} tickFormatter={(v) => `${v}分`} axisLine={false} tickLine={false} />
                        <Tooltip content={(props) => renderTooltipWithAge(props as unknown as Parameters<typeof renderTooltipWithAge>[0], (items) => (
                          <>
                            {items.map(({ name, value }) => (
                              <p key={name} className="mt-0.5 text-slate-600">{name}：{value}分钟</p>
                            ))}
                          </>
                        ))} />
                        <Legend wrapperStyle={{ fontSize: 12 }} />
                        {isDenseRange ? (
                          <>
                            <Line type="monotone" dataKey="左乳" stroke="#db2777" strokeWidth={2} dot={false} activeDot={{ r: 5 }} name="左乳(分钟)" />
                            <Line type="monotone" dataKey="右乳" stroke="#ea580c" strokeWidth={2} dot={false} activeDot={{ r: 5 }} name="右乳(分钟)" />
                          </>
                        ) : (
                          <>
                            <Bar dataKey="左乳" fill="#db2777" name="左乳(分钟)" radius={[3, 3, 0, 0]} maxBarSize={28}>
                              <LabelList dataKey="左乳" position="top" fill="#be185d" fontSize={10} fontWeight={600} />
                            </Bar>
                            <Bar dataKey="右乳" fill="#ea580c" name="右乳(分钟)" radius={[3, 3, 0, 0]} maxBarSize={28}>
                              <LabelList dataKey="右乳" position="top" fill="#c2410c" fontSize={10} fontWeight={600} />
                            </Bar>
                          </>
                        )}
                      </ComposedChart>
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
                <div className="rounded-card border border-slate-200 bg-white p-3 shadow-card">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 text-blue-700">
                      <Pill size={14} />
                      <p className="text-sm font-bold">用药记录</p>
                    </div>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-600">{medicationRecords.length}条</span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {uniqueMedications.map(name => {
                      const count = medicationRecords.filter(r => r.medicationName === name).length
                      return (
                        <span key={name} className="rounded-full border border-blue-100 bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700">
                          {name} ×{count}
                        </span>
                      )
                    })}
                  </div>
                  <div className="mt-2 space-y-1.5">
                    {medicationRecords.slice(0, 5).map(record => (
                      <div key={record.id} className="flex items-start gap-1.5 text-xs text-slate-600">
                        <span className="shrink-0 text-slate-300">•</span>
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
                    <div className="min-w-0 rounded-card border border-slate-200 bg-white p-3 shadow-card">
                      <div className="mb-3">
                        <p className="flex items-center gap-1.5 text-sm font-semibold text-slate-900"><Scale size={15} className="text-teal-700" aria-hidden="true" />体重-月龄 WHO 成长曲线（{genderLabel}）</p>
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
                    <div className="min-w-0 rounded-card border border-slate-200 bg-white p-3 shadow-card">
                      <div className="mb-3">
                        <p className="flex items-center gap-1.5 text-sm font-semibold text-slate-900"><Ruler size={15} className="text-blue-700" aria-hidden="true" />身高-月龄 WHO 成长曲线（{genderLabel}）</p>
                        <p className="mt-1 text-xs text-slate-500">宝宝身高与 WHO 标准百分位（P3–P97）对比</p>
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
