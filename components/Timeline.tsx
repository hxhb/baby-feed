'use client'

import { useState, useEffect, useCallback } from 'react'
import { format, isToday, isYesterday } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import { formatBeijingTime } from '@/lib/time'
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
  Baby as BabyIcon
} from 'lucide-react'

interface Baby {
  id: string
  name: string
}

interface FeedingRecord {
  id: string
  type: string
  startTime: string
  endTime?: string
  leftBreastDuration?: number
  rightBreastDuration?: number
  breastMilkAmount?: number
  formulaAmount?: number
  adGiven?: boolean
  notes?: string
  baby?: Baby
  recordType: 'feeding'
}

interface HealthRecord {
  id: string
  type: string
  recordedAt: string
  weight?: number
  height?: number
  temperature?: number
  medicationName?: string
  medicationDose?: string
  vaccineName?: string
  diaperType?: string
  diaperStatus?: string
  adGiven?: boolean
  notes?: string
  baby?: Baby
  recordType: 'health'
}

type TimelineRecord = FeedingRecord | HealthRecord

interface Props {
  selectedBabyId: string | null
  onSelectBaby: (id: string | null) => void
}

export default function TimelineComponent({ selectedBabyId, onSelectBaby }: Props) {
  const [babies, setBabies] = useState<Baby[]>([])
  const [records, setRecords] = useState<(FeedingRecord | HealthRecord)[]>([])
  const [loading, setLoading] = useState(true)
  const [currentDate, setCurrentDate] = useState(new Date())

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

  const fetchRecords = useCallback(async () => {
    if (!selectedBabyId) return
    
    try {
      const dateStr = format(currentDate, 'yyyy-MM-dd')
      
      const [feedingResponse, healthResponse] = await Promise.all([
        fetch(`/api/feeding?babyId=${selectedBabyId}&date=${dateStr}`),
        fetch(`/api/health?babyId=${selectedBabyId}&date=${dateStr}`)
      ])

      const feedingDataRaw = feedingResponse.ok ? await feedingResponse.json() : []
      const healthDataRaw = healthResponse.ok ? await healthResponse.json() : []
      const feedingData = Array.isArray(feedingDataRaw) ? feedingDataRaw : []
      const healthData = Array.isArray(healthDataRaw) ? healthDataRaw : []

      const allRecords = [
        ...feedingData.map((r: FeedingRecord) => ({ ...r, recordType: 'feeding' as const })),
        ...healthData.map((r: HealthRecord) => ({ ...r, recordType: 'health' as const }))
      ].sort((a, b) => {
        const timeA = new Date(a.recordType === 'feeding' ? a.startTime : a.recordedAt).getTime()
        const timeB = new Date(b.recordType === 'feeding' ? b.startTime : b.recordedAt).getTime()
        return timeB - timeA
      })

      setRecords(allRecords)
    } catch (error) {
      console.error('获取记录失败:', error)
    }
  }, [selectedBabyId, currentDate])

  useEffect(() => {
    fetchBabies()
  }, [fetchBabies])

  useEffect(() => {
    fetchRecords()
  }, [fetchRecords])

  const handleDelete = async (id: string, type: 'feeding' | 'health') => {
    if (!confirm('确定要删除这条记录吗？')) return

    try {
      const endpoint = type === 'feeding' ? `/api/feeding/${id}` : `/api/health/${id}`
      const response = await fetch(endpoint, { method: 'DELETE' })
      
      if (response.ok) {
        fetchRecords()
      }
    } catch (error) {
      console.error('删除失败:', error)
    }
  }

  const goToPreviousDay = () => {
    const prev = new Date(currentDate)
    prev.setDate(prev.getDate() - 1)
    setCurrentDate(prev)
  }

  const goToNextDay = () => {
    const next = new Date(currentDate)
    next.setDate(next.getDate() + 1)
    if (next <= new Date()) {
      setCurrentDate(next)
    }
  }

  const formatDateLabel = (date: Date) => {
    if (isToday(date)) return '今天'
    if (isYesterday(date)) return '昨天'
    return format(date, 'M月d日 EEEE', { locale: zhCN })
  }

  const getRecordIcon = (type: string) => {
    switch (type) {
      case 'BREAST_MILK':
      case 'BREAST_MILK_BOTTLE':
        return <Droplets size={20} className="text-pink-500" />
      case 'FORMULA': return <Milk size={20} className="text-blue-500" />
      case 'AD_VITAMIN': return <Pill size={20} className="text-orange-500" />
      case 'WEIGHT': return <Scale size={20} className="text-green-500" />
      case 'HEIGHT': return <Ruler size={20} className="text-blue-500" />
      case 'TEMPERATURE': return <Thermometer size={20} className="text-red-500" />
      case 'MEDICATION': return <Pill size={20} className="text-purple-500" />
      case 'VACCINE': return <Syringe size={20} className="text-teal-500" />
      case 'DIAPER': return <BabyIcon size={20} className="text-amber-500" />
      default: return null
    }
  }

  const getRecordTitle = (record: TimelineRecord) => {
    switch (record.type) {
      case 'BREAST_MILK': {
        const feeding = record as FeedingRecord
        return `母乳亲喂 ${feeding.leftBreastDuration || 0}+${feeding.rightBreastDuration || 0}分钟`
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
      default: 
        return '未知记录'
    }
  }

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
          <Link
            href="/settings"
            className="inline-flex items-center px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            添加宝宝
          </Link>
        </div>
      </div>
    )
  }

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

      {/* 日期导航 */}
      <div className="bg-white rounded-2xl p-3 shadow-sm">
        <div className="flex items-center justify-between">
          <button
            onClick={goToPreviousDay}
            className="p-2 hover:bg-gray-100 rounded-lg transition"
          >
            <ChevronLeft size={22} />
          </button>
          <div className="text-center">
            <h2 className="text-base font-bold text-gray-900">{formatDateLabel(currentDate)}</h2>
            <p className="text-xs text-gray-500">{format(currentDate, 'yyyy年MM月dd日')}</p>
          </div>
          <button
            onClick={goToNextDay}
            disabled={isToday(currentDate)}
            className={`p-2 rounded-lg transition ${
              isToday(currentDate)
                ? 'text-gray-300 cursor-not-allowed'
                : 'hover:bg-gray-100'
            }`}
          >
            <ChevronRight size={22} />
          </button>
        </div>
      </div>

      {/* 日统计 */}
      <div className="bg-white rounded-2xl p-3 shadow-sm">
        <h3 className="font-bold text-gray-900 mb-2 text-sm">当日统计</h3>
        <div className="grid grid-cols-4 gap-2 text-center">
          <div>
            <p className="text-xl font-bold text-pink-600">
              {records.filter((r) => r.type === 'BREAST_MILK' || r.type === 'BREAST_MILK_BOTTLE').length}
            </p>
            <p className="text-xs text-gray-500">母乳</p>
          </div>
          <div>
            <p className="text-xl font-bold text-blue-600">
              {records
                .filter((r): r is FeedingRecord => r.type === 'FORMULA')
                .reduce((sum, r) => sum + (r.formulaAmount || 0), 0)}
            </p>
            <p className="text-xs text-gray-500">奶粉(ml)</p>
          </div>
          <div>
            <p className="text-xl font-bold text-amber-600">
              {records.filter((r) => r.type === 'DIAPER' && ['PEE', 'BOTH'].includes((r as HealthRecord).diaperType || '')).length}
              {'/'}
              {records.filter((r) => r.type === 'DIAPER' && ['POOP', 'BOTH'].includes((r as HealthRecord).diaperType || '')).length}
            </p>
            <p className="text-xs text-gray-500">小便/大便</p>
          </div>
          <div>
            <p className="text-xl font-bold text-orange-600">
              {records.some((r) => r.type === 'AD_VITAMIN' && (r as HealthRecord).adGiven) ? '✓' : '○'}
            </p>
            <p className="text-xs text-gray-500">AD</p>
          </div>
        </div>
      </div>

      {/* 记录列表 */}
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        {records.length === 0 ? (
          <div className="text-center py-10 text-gray-500">
            <p>这一天没有记录</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {records.map((record) => {
              const time = record.recordType === 'feeding' ? record.startTime : record.recordedAt
              const isFeeding = record.recordType === 'feeding'
              
              return (
                <div
                  key={record.id}
                  className="flex items-center justify-between p-3 sm:p-4 hover:bg-gray-50 transition"
                >
                  <div className="flex items-center space-x-3 min-w-0">
                    <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                      {getRecordIcon(record.type)}
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-gray-900 text-sm truncate">{getRecordTitle(record)}</p>
                      <p className="text-xs text-gray-500">
                        {formatBeijingTime(time)}
                        {record.notes && ` · ${record.notes}`}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleDelete(record.id, isFeeding ? 'feeding' : 'health')}
                    className="p-2 text-gray-400 hover:text-red-500 transition flex-shrink-0 ml-2"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
