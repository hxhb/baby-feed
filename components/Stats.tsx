'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  Legend,
  LabelList,
} from 'recharts'
import { ChartColumn, Milk, Ruler, Scale, Syringe, Thermometer } from 'lucide-react'
import { dedupeRequest } from '@/lib/client-request-cache'
import type { PreloadedStatsData } from '@/lib/server-stats'
import { StatsEmptyState, StatsFeatureCard, StatsPanel, StatsSegmentedTabs } from '@/components/StatsUi'

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
  const breastMilkRecordDays = stats?.lastDays.filter(day => day.totalBreastDuration > 0 || day.totalBreastMilkAmount > 0).length || 0
  const formulaRecordDays = stats?.lastDays.filter(day => day.totalFormulaAmount > 0).length || 0
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
  const latestTemperatureDay = [...(stats?.lastDays || [])].find(day => typeof day.temperature === 'number') || null
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
  const latestDiaperDay = [...(stats?.lastDays || [])].find(day => day.peeCount > 0 || day.poopCount > 0) || null
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
      recordCount: number
      notes: string[]
      latestNote: string | null
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

      if (!existing) {
        acc[key] = {
          vaccineName: record.vaccineName,
          latestDoseNumber: doseNumber,
          totalDoses,
          latestRecordedAt: record.recordedAt,
          latestDate: record.date,
          recordCount: 1,
          notes: record.notes ? [record.notes] : [],
          latestNote: record.notes ?? null,
          isCompleted,
          remainingDoses,
        }
        return acc
      }

      existing.recordCount += 1
      if (record.notes) {
        existing.notes.push(record.notes)
      }
      return acc
    }, {})
  )
  const pendingVaccines = vaccineProgressSummary.filter(item => item.remainingDoses && item.remainingDoses > 0)
  const recentVaccineCard = (
    <StatsFeatureCard
      title="最近疫苗"
      icon={Syringe}
      className="border border-teal-100 bg-gradient-to-br from-teal-50 to-white"
      iconClassName="text-teal-600"
    >
      {pendingVaccines.length > 0 ? (
        <div className="space-y-2.5">
          <p className="text-xs font-medium text-teal-700">以下疫苗尚未完成，请按针次继续跟进：</p>
          {pendingVaccines.map(item => (
            <div key={item.vaccineName} className="rounded-2xl border border-teal-100 bg-white/90 px-3 py-2.5">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-900 break-words">{item.vaccineName}</p>
                  <p className="mt-1 text-[11px] text-gray-500">最近记录 {formatRecordedSummaryTime(item.latestRecordedAt)}</p>
                </div>
                <span className="shrink-0 rounded-full bg-amber-100 px-2 py-1 text-[10px] font-semibold text-amber-700">
                  还差 {item.remainingDoses} 针
                </span>
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5 text-[10px]">
                <span className="rounded-full bg-teal-100 px-2 py-1 font-medium text-teal-700">
                  {formatVaccineProgress(item.latestDoseNumber, item.totalDoses) || '未标注针次'}
                </span>
                {item.totalDoses ? (
                  <span className="rounded-full bg-slate-100 px-2 py-1 font-medium text-slate-600">
                    全程 {item.totalDoses} 针
                  </span>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      ) : latestVaccineRecord ? (
        <>
          <p className="text-lg font-bold text-teal-700 break-words">{latestVaccineRecord.vaccineName}</p>
          <p className="mt-1 text-xs text-gray-500">
            记录于 {formatRecordedSummaryTime(latestVaccineRecord.recordedAt)}
          </p>
          {formatVaccineProgress(latestVaccineRecord.vaccineDoseNumber, latestVaccineRecord.vaccineTotalDoses) ? (
            <p className="mt-2 inline-flex rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-medium text-emerald-700">
              {formatVaccineProgress(latestVaccineRecord.vaccineDoseNumber, latestVaccineRecord.vaccineTotalDoses)} · 已完成全程
            </p>
          ) : null}
        </>
      ) : (
        <p className="text-sm text-gray-400">暂无疫苗记录</p>
      )}
    </StatsFeatureCard>
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
                    <div className="min-w-0 h-56 sm:h-72 -ml-2" style={{ outline: 'none' }}>
                      <ResponsiveContainer width="100%" height="100%" minWidth={0}>
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
                      </ResponsiveContainer>
                    </div>
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
                      <div className="min-w-0 h-56 sm:h-72 -ml-2" style={{ outline: 'none' }}>
                        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
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
                        </ResponsiveContainer>
                      </div>
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
                      <div className="min-w-0 h-56 sm:h-64 -ml-2" style={{ outline: 'none' }}>
                        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
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
                        </ResponsiveContainer>
                      </div>
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
                      <div className="min-w-0 h-56 sm:h-64 -ml-2" style={{ outline: 'none' }}>
                        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
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
                        </ResponsiveContainer>
                      </div>
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

              <StatsPanel>
                <div className="mb-3 flex items-center gap-2">
                  <Syringe size={18} className="text-teal-500" />
                  <h3 className="text-base font-bold text-gray-900">疫苗记录</h3>
                </div>
                {stats.vaccineRecords.length > 0 ? (
                  <div className="grid gap-2 sm:grid-cols-2">
                    {vaccineProgressSummary.map(item => (
                      <div key={item.vaccineName} className="rounded-2xl border border-teal-200 bg-white p-3 shadow-sm shadow-teal-50">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 space-y-1">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <p className="text-[15px] font-bold leading-5 text-gray-900 break-words">{item.vaccineName}</p>
                              <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${item.isCompleted ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                                {item.isCompleted ? '已完成' : '未完成'}
                              </span>
                            </div>
                            <p className="text-[11px] font-medium text-gray-500">最近接种 {formatRecordedSummaryTime(item.latestRecordedAt)}</p>
                          </div>
                          <span className="shrink-0 rounded-xl bg-teal-50 px-2 py-1 text-[10px] font-semibold tracking-wide text-teal-700">
                            {item.latestDate.replace(/-/g, '.')}
                          </span>
                        </div>

                        <div className="mt-3 flex flex-wrap gap-1.5">
                          <span className="rounded-full bg-slate-900 px-2.5 py-1 text-[11px] font-semibold text-white">
                            {formatVaccineProgress(item.latestDoseNumber, item.totalDoses) || '未标注针次'}
                          </span>
                          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-700">
                            记录 {item.recordCount} 次
                          </span>
                          {item.totalDoses ? (
                            <span className="rounded-full bg-sky-100 px-2.5 py-1 text-[11px] font-semibold text-sky-700">
                              全程 {item.totalDoses} 针
                            </span>
                          ) : null}
                          {!item.isCompleted && item.remainingDoses ? (
                            <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-semibold text-amber-700">
                              待完成 {item.remainingDoses} 针
                            </span>
                          ) : null}
                        </div>

                        {item.latestNote ? (
                          <div className="mt-3 rounded-xl bg-slate-50 px-3 py-2">
                            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Recent Note</p>
                            <p className="mt-1 line-clamp-2 break-words text-[12px] leading-5 text-slate-700">
                              {item.latestNote}
                            </p>
                          </div>
                        ) : null}
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
            <div className="space-y-3">
              <div className="rounded-2xl border border-blue-100 bg-gradient-to-br from-white via-blue-50/50 to-sky-50/70 p-3.5 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-2 text-blue-700">
                  <div className="flex items-center gap-2">
                    <Milk size={16} />
                    <p className="text-sm font-semibold">喂养洞察</p>
                  </div>
                  <span className="rounded-full bg-blue-100 px-2.5 py-1 text-[11px] font-semibold text-blue-700">近 {days} 天</span>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2 xl:grid-cols-4">
                  <div className="rounded-xl border border-blue-100 bg-white px-2.5 py-2">
                    <p className="text-[10px] font-medium text-slate-500">总喂养次数</p>
                    <p className="mt-1 text-base font-bold text-slate-900">{stats.totalStats.totalFeedings}</p>
                  </div>
                  <div className="rounded-xl border border-blue-100 bg-white px-2.5 py-2">
                    <p className="text-[10px] font-medium text-slate-500">总亲喂时长</p>
                    <p className="mt-1 text-base font-bold text-slate-900">{formatMinutes(stats.totalStats.totalBreastDuration)}</p>
                  </div>
                  <div className="rounded-xl border border-blue-100 bg-white px-2.5 py-2">
                    <p className="text-[10px] font-medium text-slate-500">奶量总计</p>
                    <p className="mt-1 text-base font-bold text-slate-900">{totalMilkAmount}ml</p>
                  </div>
                  <div className="rounded-xl border border-blue-100 bg-white px-2.5 py-2">
                    <p className="text-[10px] font-medium text-slate-500">记录天数</p>
                    <p className="mt-1 text-base font-bold text-slate-900">{activeFeedingDays} 天</p>
                  </div>
                </div>

                <div className="mt-2 grid grid-cols-2 gap-2 xl:grid-cols-4">
                  <div className="rounded-xl bg-blue-100/70 px-2.5 py-2">
                    <p className="text-[10px] font-medium text-blue-700">平均奶量 / 日</p>
                    <p className="mt-1 text-sm font-bold text-slate-900">{averageMilkPerActiveDay}ml</p>
                  </div>
                  <div className="rounded-xl bg-sky-100/70 px-2.5 py-2">
                    <p className="text-[10px] font-medium text-sky-700">平均频次 / 日</p>
                    <p className="mt-1 text-sm font-bold text-slate-900">{averageFeedingsPerActiveDay > 0 ? `${averageFeedingsPerActiveDay.toFixed(1)} 次` : '暂无'}</p>
                  </div>
                  <div className="rounded-xl bg-indigo-100/70 px-2.5 py-2">
                    <p className="text-[10px] font-medium text-indigo-700">母乳记录天数</p>
                    <p className="mt-1 text-sm font-bold text-slate-900">{breastMilkRecordDays} 天</p>
                  </div>
                  <div className="rounded-xl bg-cyan-100/70 px-2.5 py-2">
                    <p className="text-[10px] font-medium text-cyan-700">奶粉记录天数</p>
                    <p className="mt-1 text-sm font-bold text-slate-900">{formulaRecordDays} 天</p>
                  </div>
                </div>

                <div className="mt-2 flex flex-wrap gap-1.5 text-[11px]">
                  <span className="rounded-full bg-slate-900 px-2.5 py-1 font-semibold text-white">亲喂 {totalBreastfeedingSessions} 次</span>
                  <span className="rounded-full bg-blue-100 px-2.5 py-1 font-semibold text-blue-700">瓶喂母乳 {totalBreastMilkBottleSessions} 次</span>
                  <span className="rounded-full bg-sky-100 px-2.5 py-1 font-semibold text-sky-700">奶粉 {totalFormulaSessions} 次</span>
                </div>

                <div className="mt-2 space-y-1 text-[12px] leading-5 text-slate-600">
                  <p>
                    {activeFeedingDays > 0
                      ? `近 ${days} 天共有 ${activeFeedingDays} 天有喂养记录，平均每天约 ${averageMilkPerActiveDay}ml。`
                      : `近 ${days} 天还没有可用于分析的喂养记录。`}
                  </p>
                  <p>
                    {peakMilkIntakeDay && (peakMilkIntakeDay.totalBreastMilkAmount + peakMilkIntakeDay.totalFormulaAmount > 0)
                      ? `${peakMilkIntakeDay.date} 奶量最高 ${peakMilkIntakeDay.totalBreastMilkAmount + peakMilkIntakeDay.totalFormulaAmount}ml；${maxBreastfeedingDay && maxBreastfeedingDay.totalBreastDuration > 0 ? `${maxBreastfeedingDay.date} 亲喂时长最高 ${formatMinutes(maxBreastfeedingDay.totalBreastDuration)}。` : '暂无明显亲喂峰值。'}`
                      : maxBreastfeedingDay && maxBreastfeedingDay.totalBreastDuration > 0
                        ? `${maxBreastfeedingDay.date} 的亲喂时长最高，达到 ${formatMinutes(maxBreastfeedingDay.totalBreastDuration)}。`
                        : '当前周期内还没有明显的奶量或亲喂峰值可供比较。'}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)_minmax(0,1fr)]">
                <div className="rounded-2xl border border-emerald-100 bg-white p-3.5 shadow-sm">
                  <div className="flex items-center gap-2 text-emerald-600">
                    <ChartColumn size={16} />
                    <p className="text-sm font-semibold">成长洞察</p>
                  </div>
                  <p className="mt-2 text-sm font-medium text-gray-900">
                    {latestWeightRecord || latestHeightRecord
                      ? `最近一次成长记录${latestWeightRecord ? `体重 ${latestWeightRecord.weight}kg` : ''}${latestWeightRecord && latestHeightRecord ? '，' : ''}${latestHeightRecord ? `身高 ${latestHeightRecord.height}cm` : ''}。`
                      : '当前还没有体重或身高记录，添加后可查看增长趋势。'}
                  </p>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <div className="rounded-xl border border-teal-100 bg-teal-50/80 px-3 py-2.5">
                      <div className="flex flex-col gap-2">
                        <div>
                          <p className="text-[11px] font-medium text-teal-700">体重变化</p>
                          <p className="mt-1 text-base font-bold text-slate-900">
                            {overallWeightChange !== null ? `${overallWeightChange >= 0 ? '+' : ''}${overallWeightChange}kg` : '暂无趋势'}
                          </p>
                        </div>
                        <span className={`inline-flex w-fit rounded-full px-2.5 py-1 text-[11px] font-bold ${latestWeightChange === null ? 'bg-white text-slate-500' : latestWeightChange >= 0 ? 'bg-teal-700 text-white' : 'bg-amber-500 text-white'}`}>
                          {latestWeightChange !== null ? `较上次 ${latestWeightChange >= 0 ? '+' : ''}${latestWeightChange}kg` : '较上次 暂无'}
                        </span>
                      </div>
                      <p className="mt-2 text-[11px] leading-5 text-slate-500">
                        {latestWeightRecord
                          ? `最近记录：${formatRecordedSummaryTime(latestWeightRecord.recordedAt)}`
                          : '最近记录：暂无'}
                      </p>
                    </div>
                    <div className="rounded-xl border border-blue-100 bg-blue-50/80 px-3 py-2.5">
                      <div className="flex flex-col gap-2">
                        <div>
                          <p className="text-[11px] font-medium text-blue-700">身高变化</p>
                          <p className="mt-1 text-base font-bold text-slate-900">
                            {overallHeightChange !== null ? `${overallHeightChange >= 0 ? '+' : ''}${overallHeightChange}cm` : '暂无趋势'}
                          </p>
                        </div>
                        <span className={`inline-flex w-fit rounded-full px-2.5 py-1 text-[11px] font-bold ${latestHeightChange === null ? 'bg-white text-slate-500' : latestHeightChange >= 0 ? 'bg-blue-700 text-white' : 'bg-amber-500 text-white'}`}>
                          {latestHeightChange !== null ? `较上次 ${latestHeightChange >= 0 ? '+' : ''}${latestHeightChange}cm` : '较上次 暂无'}
                        </span>
                      </div>
                      <p className="mt-2 text-[11px] leading-5 text-slate-500">
                        {latestHeightRecord
                          ? `最近记录：${formatRecordedSummaryTime(latestHeightRecord.recordedAt)}`
                          : '最近记录：暂无'}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-violet-100 bg-white p-3.5 shadow-sm">
                  <div className="flex items-center gap-2 text-violet-600">
                    <ChartColumn size={16} />
                    <p className="text-sm font-semibold">大小便趋势</p>
                  </div>
                  <p className="mt-2 text-sm font-medium text-gray-900">
                    {diaperActiveDays > 0
                      ? `近 ${days} 天共有 ${diaperActiveDays} 天记录了大小便情况。`
                      : '当前周期内还没有大小便记录，添加后可查看排泄趋势。'}
                  </p>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <div className="rounded-xl border border-sky-100 bg-sky-50/80 px-3 py-2.5">
                      <p className="text-[11px] font-medium text-sky-700">小便次数</p>
                      <p className="mt-1 text-base font-bold text-slate-900">{totalPeeCount} 次</p>
                      <p className="mt-2 text-[11px] leading-5 text-slate-500">
                        {diaperActiveDays > 0 ? `活跃日均 ${averagePeePerActiveDay.toFixed(1)} 次` : '活跃日均 暂无'}
                      </p>
                    </div>
                    <div className="rounded-xl border border-amber-100 bg-amber-50/80 px-3 py-2.5">
                      <p className="text-[11px] font-medium text-amber-700">大便次数</p>
                      <p className="mt-1 text-base font-bold text-slate-900">{totalPoopCount} 次</p>
                      <p className="mt-2 text-[11px] leading-5 text-slate-500">
                        {diaperActiveDays > 0 ? `活跃日均 ${averagePoopPerActiveDay.toFixed(1)} 次` : '活跃日均 暂无'}
                      </p>
                    </div>
                  </div>
                  <div className="mt-2 space-y-1.5 text-xs leading-5 text-gray-500">
                    <p>
                      {peakDiaperDay && (peakDiaperDay.peeCount > 0 || peakDiaperDay.poopCount > 0)
                        ? `${peakDiaperDay.date} 记录最集中，小便 ${peakDiaperDay.peeCount} 次，大便 ${peakDiaperDay.poopCount} 次。`
                        : '当前周期暂无明显的大小便峰值日。'}
                    </p>
                    <p>
                      {latestDiaperDay
                        ? `最近一次有记录的日期是 ${latestDiaperDay.date}，当天小便 ${latestDiaperDay.peeCount} 次，大便 ${latestDiaperDay.poopCount} 次。`
                        : '最近暂无大小便记录。'}
                    </p>
                  </div>
                </div>

                <div className="rounded-2xl border border-amber-100 bg-white p-4 shadow-sm">
                  <div className="flex items-center gap-2 text-amber-600">
                    <Thermometer size={16} />
                    <p className="text-sm font-semibold">健康提醒</p>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <div className="rounded-2xl bg-amber-50 px-3 py-2.5">
                      <p className="text-[11px] font-medium text-amber-600">体温记录覆盖</p>
                      <p className="mt-1 text-sm font-bold text-gray-900">{temperatureRecordCount} / {days} 天</p>
                    </div>
                    <div className="rounded-2xl bg-orange-50 px-3 py-2.5">
                      <p className="text-[11px] font-medium text-orange-600">AD 补充记录</p>
                      <p className="mt-1 text-sm font-bold text-gray-900">{adGivenDays} / {days} 天</p>
                    </div>
                  </div>
                  <p className="mt-3 text-sm font-medium text-gray-900">
                    {latestTemperatureDay
                      ? `最近一次体温记录为 ${latestTemperatureDay.temperature}°C。`
                      : '当前周期内没有体温记录。'}
                  </p>
                  <div className="mt-2 space-y-1.5 text-xs leading-5 text-gray-500">
                    <p>
                      {maxTemperatureDay && typeof maxTemperatureDay.temperature === 'number'
                        ? `当前周期最高体温为 ${maxTemperatureDay.temperature}°C，记录于 ${maxTemperatureDay.date}。`
                        : '当前周期暂无可比较的体温峰值。'}
                    </p>
                  </div>
                </div>
              </div>

              {recentVaccineCard}
            </div>
          )}
        </>
      )}

    </div>
  )
}
