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
  LabelList
} from 'recharts'
import { Scale } from 'lucide-react'

interface Baby {
  id: string
  name: string
}

interface WeightPoint {
  date: string
  weight: number
}

interface Props {
  selectedBabyId: string | null
  onSelectBaby: (id: string | null) => void
  initialBabies?: Baby[]
}

export default function StatsComponent({ selectedBabyId, onSelectBaby, initialBabies = [] }: Props) {
  const [babies, setBabies] = useState<Baby[]>(initialBabies)
  const [stats, setStats] = useState<{
    baby: Baby
    todayStats: Record<string, unknown>
    lastDays: {
      date: string
      totalBreastDuration: number
      totalBreastMilkAmount: number
      totalFormulaAmount: number
      adGiven: boolean
      temperature?: number
    }[]
    totalStats: {
      totalFeedings: number
      totalFormulaAmount: number
      totalBreastDuration: number
      totalBreastMilkAmount: number
    }
    weightTrend: WeightPoint[]
  } | null>(null)
  const [loading, setLoading] = useState(initialBabies.length === 0)
  const [days, setDays] = useState(7)

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
    
    try {
      const response = await fetch(`/api/stats?babyId=${selectedBabyId}&days=${days}`)
      if (response.ok) {
        const data = await response.json()
        setStats(data)
      }
    } catch (error) {
      console.error('获取统计数据失败:', error)
    }
  }, [selectedBabyId, days])

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
        <div className="text-center py-16">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">还没有添加宝宝</h2>
          <p className="text-gray-600">请先添加宝宝信息查看统计数据</p>
        </div>
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

  // 使用 API 返回的完整体重趋势数据
  const weightData = (stats?.weightTrend || []).map(p => {
    const parts = p.date.split('-')
    return {
      date: `${parseInt(parts[1])}/${parseInt(parts[2])}`,
      体重: p.weight
    }
  })

  const tempData = stats?.lastDays
    .filter(day => day.temperature)
    .map(day => {
      const parts = day.date.split('-')
      return {
        date: `${parseInt(parts[1])}/${parseInt(parts[2])}`,
        体温: day.temperature
      }
    }) || []

  return (
    <div className="max-w-4xl mx-auto px-3 sm:px-4 py-4 space-y-4">
      {/* 宝宝选择器 */}
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

      {/* 时间范围选择 */}
      <div className="bg-white rounded-2xl p-3 shadow-sm">
        <h3 className="text-xs font-medium text-gray-500 mb-2">趋势图时间范围</h3>
        <div className="flex gap-2">
          {[7, 14, 30].map(d => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={`flex-1 py-2 rounded-lg transition text-sm ${
                days === d
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {d}天
            </button>
          ))}
        </div>
      </div>

      {/* 母乳喂养趋势图 */}
      {stats && (
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <h3 className="text-base font-bold text-gray-900 mb-3">母乳喂养趋势</h3>
          <div className="h-56 sm:h-72 -ml-2" style={{ outline: 'none' }}>
            <ResponsiveContainer width="100%" height="100%">
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
      )}

      {/* 奶粉喂养趋势图 */}
      {stats && (
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <h3 className="text-base font-bold text-gray-900 mb-3">奶粉喂养趋势</h3>
          <div className="h-56 sm:h-72 -ml-2" style={{ outline: 'none' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 25, right: 5, left: -10, bottom: 0 }} style={{ outline: 'none' }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="奶粉量" fill="#3b82f6" name="奶粉量(ml)" radius={[2, 2, 0, 0]}>
                  <LabelList dataKey="奶粉量" position="top" fill="#3b82f6" fontSize={10} fontWeight={600} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* 体重趋势图 — 使用全量体重记录 */}
      <div className="bg-white rounded-2xl p-4 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <Scale size={18} className="text-green-500" />
          <h3 className="text-base font-bold text-gray-900">体重趋势</h3>
        </div>
        {weightData.length > 0 ? (
          <div className="h-56 sm:h-64 -ml-2" style={{ outline: 'none' }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={weightData} margin={{ top: 10, right: 15, left: -10, bottom: 0 }} style={{ outline: 'none' }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis 
                  domain={['dataMin - 0.3', 'dataMax + 0.3']} 
                  tick={{ fontSize: 11 }}
                  tickFormatter={(v) => `${v}kg`}
                />
                <Tooltip 
                  formatter={(value) => [`${value} kg`, '体重']}
                />
                <Line 
                  type="monotone" 
                  dataKey="体重" 
                  stroke="#22c55e" 
                  strokeWidth={2.5} 
                  dot={{ fill: '#22c55e', r: 4 }}
                  activeDot={{ r: 6 }}
                >
                  <LabelList 
                    dataKey="体重" 
                    position="top" 
                    fill="#16a34a" 
                    fontSize={11} 
                    fontWeight={600}
                    formatter={(v) => `${v}kg`}
                  />
                </Line>
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="text-center py-8 text-gray-400">
            <Scale size={32} className="mx-auto mb-2 opacity-50" />
            <p className="text-sm">暂无体重记录</p>
            <p className="text-xs mt-1">在添加记录中记录宝宝体重后，这里将展示体重变化趋势</p>
          </div>
        )}
      </div>

      {/* 体温趋势图 */}
      {tempData.length > 0 && (
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <h3 className="text-base font-bold text-gray-900 mb-3">体温趋势</h3>
          <div className="h-56 sm:h-64 -ml-2" style={{ outline: 'none' }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={tempData} margin={{ top: 10, right: 15, left: -10, bottom: 0 }} style={{ outline: 'none' }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis domain={[36, 38]} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(value) => [`${value}°C`, '体温']} />
                <Line 
                  type="monotone" 
                  dataKey="体温" 
                  stroke="#ef4444" 
                  strokeWidth={2} 
                  dot={{ fill: '#ef4444', r: 4 }} 
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* AD服用记录 */}
      {stats && (
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <h3 className="text-base font-bold text-gray-900 mb-3">AD服用记录</h3>
          <div className="grid grid-cols-7 gap-1">
            {stats.lastDays.map(day => {
              const parts = day.date.split('-')
              return (
                <div
                  key={day.date}
                  className={`aspect-square rounded-lg flex items-center justify-center text-xs font-medium ${
                    day.adGiven
                      ? 'bg-orange-100 text-orange-700'
                      : 'bg-gray-100 text-gray-400'
                  }`}
                  title={`${parseInt(parts[1])}月${parseInt(parts[2])}日`}
                >
                  {parseInt(parts[2])}
                </div>
              )
            })}
          </div>
          <div className="flex justify-center gap-4 mt-3 text-xs">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 bg-orange-100 rounded"></div>
              <span className="text-gray-600">已服用</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 bg-gray-100 rounded"></div>
              <span className="text-gray-600">未服用</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
