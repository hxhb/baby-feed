'use client'

import { useState, useEffect, useCallback } from 'react'
import { format } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import Link from 'next/link'
import { 
  Baby, 
  PlusCircle, 
  Droplets, 
  Milk, 
  Pill,
  Scale,
  Thermometer,
  ChevronRight,
  Ruler,
  Syringe
} from 'lucide-react'

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
  leftBreastDuration?: number
  rightBreastDuration?: number
  breastMilkAmount?: number
  formulaAmount?: number
  adGiven?: boolean
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
  vaccineName?: string
  diaperType?: string
  diaperStatus?: string
  adGiven?: boolean
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
  weight?: number
  height?: number
  temperature?: number
  peeCount: number
  poopCount: number
}

interface Props {
  selectedBabyId: string | null
  onSelectBaby: (id: string | null) => void
}

export default function Dashboard({ selectedBabyId, onSelectBaby }: Props) {
  const [babies, setBabies] = useState<Baby[]>([])
  const [todayRecords, setTodayRecords] = useState<FeedingRecord[]>([])
  const [todayHealthRecords, setTodayHealthRecords] = useState<HealthRecord[]>([])
  const [stats, setStats] = useState<DailyStats | null>(null)
  const [loading, setLoading] = useState(true)

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

  const fetchTodayData = useCallback(async () => {
    if (!selectedBabyId) return
    
    try {
      const today = format(new Date(), 'yyyy-MM-dd')
      
      const feedingResponse = await fetch(
        `/api/feeding?babyId=${selectedBabyId}&date=${today}`
      )
      const feedingDataRaw = feedingResponse.ok ? await feedingResponse.json() : []
      const feedingData: FeedingRecord[] = Array.isArray(feedingDataRaw) ? feedingDataRaw : []
      setTodayRecords(feedingData.map(r => ({ ...r, recordType: 'feeding' as const })))

      const healthResponse = await fetch(
        `/api/health?babyId=${selectedBabyId}&date=${today}`
      )
      const healthDataRaw = healthResponse.ok ? await healthResponse.json() : []
      const healthData: HealthRecord[] = Array.isArray(healthDataRaw) ? healthDataRaw : []
      setTodayHealthRecords(healthData.map(r => ({ ...r, recordType: 'health' as const })))

      const todayStats: DailyStats = {
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
        weight: healthData.find(r => r.type === 'WEIGHT')?.weight,
        height: healthData.find(r => r.type === 'HEIGHT')?.height,
        temperature: healthData.find(r => r.type === 'TEMPERATURE')?.temperature,
        peeCount: healthData.filter(r => r.type === 'DIAPER' && (r.diaperType === 'PEE' || r.diaperType === 'BOTH')).length,
        poopCount: healthData.filter(r => r.type === 'DIAPER' && (r.diaperType === 'POOP' || r.diaperType === 'BOTH')).length
      }
      setStats(todayStats)
    } catch (error) {
      console.error('获取今日数据失败:', error)
    }
  }, [selectedBabyId])

  useEffect(() => {
    fetchBabies()
  }, [fetchBabies])

  useEffect(() => {
    fetchTodayData()
  }, [fetchTodayData])

  const calculateAge = (birthDate: string) => {
    const birth = new Date(birthDate)
    const today = new Date()
    const diffTime = today.getTime() - birth.getTime()
    const totalDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))
    
    const months = (today.getFullYear() - birth.getFullYear()) * 12 + 
                   (today.getMonth() - birth.getMonth())
    const days = today.getDate() - birth.getDate()
    
    if (months === 0) {
      return `第${totalDays + 1}天`
    }
    return `${months}个月${days > 0 ? days + '天' : ''} (第${totalDays + 1}天)`
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
          <Baby size={64} className="mx-auto text-gray-300 mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">还没有添加宝宝</h2>
          <p className="text-gray-600 mb-6">请先添加宝宝信息开始记录</p>
          <Link
            href="/settings"
            className="inline-flex items-center px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            <PlusCircle size={20} className="mr-2" />
            添加宝宝
          </Link>
        </div>
      </div>
    )
  }

  const selectedBaby = babies.find(b => b.id === selectedBabyId)

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
      {/* 宝宝选择器 */}
      {babies.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-2">
          {babies.map(baby => (
            <button
              key={baby.id}
              onClick={() => onSelectBaby(baby.id)}
              className={`px-4 py-2 rounded-full whitespace-nowrap transition ${
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

      {/* 宝宝信息卡片 */}
      {selectedBaby && (
        <div className="bg-white rounded-2xl p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="w-16 h-16 bg-gradient-to-br from-pink-100 to-blue-100 rounded-full flex items-center justify-center">
                <Baby size={32} className="text-blue-600" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-900">{selectedBaby.name}</h2>
                <p className="text-gray-600">
                  {selectedBaby.gender === 'MALE' ? '👦 男宝' : '👧 女宝'} · {calculateAge(selectedBaby.birthDate)}
                </p>
              </div>
            </div>
            <div className="text-right text-sm text-gray-500">
              <p>出生日期</p>
              <p className="font-medium text-gray-900">
                {format(new Date(selectedBaby.birthDate), 'yyyy年MM月dd日', { locale: zhCN })}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 今日概览 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <Droplets size={20} className="text-pink-500" />
            <span className="text-xs text-gray-500">母乳</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">
            {(stats?.breastFeedingCount || 0) + (stats?.breastBottleCount || 0)}
          </p>
          <p className="text-xs text-gray-500">
            {stats?.totalBreastDuration || 0}分钟 · {stats?.totalBreastMilkAmount || 0}ml
          </p>
        </div>

        <div className="bg-white rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <Milk size={20} className="text-blue-500" />
            <span className="text-xs text-gray-500">奶粉</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{stats?.formulaCount || 0}</p>
          <p className="text-xs text-gray-500">次 · {stats?.totalFormulaAmount || 0}ml</p>
        </div>

        <div className="bg-white rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <Pill size={20} className="text-orange-500" />
            <span className="text-xs text-gray-500">AD</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">
            {stats?.adGiven ? '✓' : '○'}
          </p>
          <p className="text-xs text-gray-500">{stats?.adGiven ? '已服用' : '未服用'}</p>
        </div>

        <div className="bg-white rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <Baby size={20} className="text-amber-500" />
            <span className="text-xs text-gray-500">大小便</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">
            {stats?.peeCount || 0} / {stats?.poopCount || 0}
          </p>
          <p className="text-xs text-gray-500">小便 / 大便</p>
        </div>
      </div>

      {/* 今日健康数据 */}
      {stats && (stats.temperature || stats.weight || stats.height) && (
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <h3 className="text-sm font-medium text-gray-500 mb-3">今日健康数据</h3>
          <div className="flex flex-wrap gap-4">
            {stats.temperature && (
              <div className="flex items-center gap-2 px-3 py-2 bg-red-50 rounded-lg">
                <Thermometer size={18} className="text-red-500" />
                <span className="text-sm font-medium text-gray-900">{stats.temperature}°C</span>
                <span className="text-xs text-gray-500">体温</span>
              </div>
            )}
            {stats.weight && (
              <div className="flex items-center gap-2 px-3 py-2 bg-green-50 rounded-lg">
                <Scale size={18} className="text-green-500" />
                <span className="text-sm font-medium text-gray-900">{stats.weight}kg</span>
                <span className="text-xs text-gray-500">体重</span>
              </div>
            )}
            {stats.height && (
              <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 rounded-lg">
                <Ruler size={18} className="text-blue-500" />
                <span className="text-sm font-medium text-gray-900">{stats.height}cm</span>
                <span className="text-xs text-gray-500">身高</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 快捷操作 */}
      <div className="bg-white rounded-2xl p-6 shadow-sm">
        <h3 className="text-lg font-bold text-gray-900 mb-4">快捷记录</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Link
            href="/add?type=breast"
            className="flex flex-col items-center p-4 bg-pink-50 rounded-xl hover:bg-pink-100 transition"
          >
            <Droplets size={24} className="text-pink-500 mb-2" />
            <span className="text-sm font-medium text-gray-700">母乳</span>
          </Link>
          <Link
            href="/add?type=formula"
            className="flex flex-col items-center p-4 bg-blue-50 rounded-xl hover:bg-blue-100 transition"
          >
            <Milk size={24} className="text-blue-500 mb-2" />
            <span className="text-sm font-medium text-gray-700">奶粉喂养</span>
          </Link>
          <Link
            href="/add?type=ad"
            className="flex flex-col items-center p-4 bg-orange-50 rounded-xl hover:bg-orange-100 transition"
          >
            <Pill size={24} className="text-orange-500 mb-2" />
            <span className="text-sm font-medium text-gray-700">AD滴剂</span>
          </Link>
          <Link
            href="/add?type=health"
            className="flex flex-col items-center p-4 bg-green-50 rounded-xl hover:bg-green-100 transition"
          >
            <Scale size={24} className="text-green-500 mb-2" />
            <span className="text-sm font-medium text-gray-700">健康记录</span>
          </Link>
        </div>
      </div>

      {/* 今日记录列表 */}
      <div className="bg-white rounded-2xl p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-gray-900">今日记录</h3>
          <Link
            href="/timeline"
            className="text-sm text-blue-600 hover:text-blue-700 flex items-center"
          >
            查看全部 <ChevronRight size={16} />
          </Link>
        </div>

        {todayRecords.length === 0 && todayHealthRecords.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <p>今天还没有记录</p>
            <p className="text-sm mt-1">点击上方快捷按钮开始记录</p>
          </div>
        ) : (
          <div className="space-y-3">
            {[...todayRecords, ...todayHealthRecords]
              .sort((a, b) => new Date(b.recordType === 'feeding' ? b.startTime : b.recordedAt).getTime() - new Date(a.recordType === 'feeding' ? a.startTime : a.recordedAt).getTime())
              .map((record) => {
                const isFeeding = record.recordType === 'feeding'
                const time = isFeeding ? (record as FeedingRecord).startTime : (record as HealthRecord).recordedAt
                const feedingRecord = isFeeding ? (record as FeedingRecord) : null
                const healthRecord = !isFeeding ? (record as HealthRecord) : null
                
                return (
                  <div
                    key={record.id}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                  >
                    <div className="flex items-center space-x-3">
                        {(record.type === 'BREAST_MILK' || record.type === 'BREAST_MILK_BOTTLE') && <Droplets size={20} className="text-pink-500" />}
                        {record.type === 'FORMULA' && <Milk size={20} className="text-blue-500" />}
                        {record.type === 'AD_VITAMIN' && <Pill size={20} className="text-orange-500" />}
                        {record.type === 'WEIGHT' && <Scale size={20} className="text-green-500" />}
                        {record.type === 'HEIGHT' && <Ruler size={20} className="text-blue-500" />}
                        {record.type === 'TEMPERATURE' && <Thermometer size={20} className="text-red-500" />}
                        {record.type === 'MEDICATION' && <Pill size={20} className="text-purple-500" />}
                        {record.type === 'VACCINE' && <Syringe size={20} className="text-teal-500" />}
                        {record.type === 'DIAPER' && <Baby size={20} className="text-amber-500" />}
                        
                        <div>
                          <p className="font-medium text-gray-900">
                            {record.type === 'BREAST_MILK' && '母乳亲喂'}
                            {record.type === 'BREAST_MILK_BOTTLE' && `母乳瓶喂 ${feedingRecord?.breastMilkAmount}ml`}
                            {record.type === 'FORMULA' && `奶粉 ${feedingRecord?.formulaAmount}ml`}
                            {record.type === 'AD_VITAMIN' && 'AD滴剂'}
                            {record.type === 'WEIGHT' && `体重 ${healthRecord?.weight}kg`}
                            {record.type === 'HEIGHT' && `身高 ${healthRecord?.height}cm`}
                            {record.type === 'TEMPERATURE' && `体温 ${healthRecord?.temperature}°C`}
                            {record.type === 'MEDICATION' && `服药 ${healthRecord?.medicationName}`}
                            {record.type === 'VACCINE' && `疫苗 ${healthRecord?.vaccineName}`}
                            {record.type === 'DIAPER' && `${healthRecord?.diaperType === 'PEE' ? '小便' : healthRecord?.diaperType === 'POOP' ? '大便' : '大小便'}`}
                          </p>
                          <p className="text-xs text-gray-500">
                            {format(new Date(time), 'HH:mm')}
                          </p>
                        </div>
                      </div>
                     
                      {record.type === 'BREAST_MILK' && feedingRecord && (
                        <span className="text-sm text-gray-600">
                          {feedingRecord.leftBreastDuration || 0}+{feedingRecord.rightBreastDuration || 0}分钟
                        </span>
                      )}
                      {record.type === 'BREAST_MILK_BOTTLE' && feedingRecord && (
                        <span className="text-sm text-gray-600">
                          {feedingRecord.breastMilkAmount}ml
                        </span>
                      )}
                     {record.type === 'AD_VITAMIN' && healthRecord?.adGiven && (
                       <span className="text-sm text-orange-600">已服用</span>
                     )}
                  </div>
                )
              })}
          </div>
        )}
      </div>
    </div>
  )
}
