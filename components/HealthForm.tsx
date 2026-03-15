'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { getBeijingNow, toBeijingISO } from '@/lib/time'
import { 
  Scale, 
  Thermometer, 
  Pill,
  ArrowLeft,
  Clock,
  Ruler,
  Syringe,
  Baby as BabyIcon,
  Droplets,
  Milk
} from 'lucide-react'

interface BabyInfo {
  id: string
  name: string
}

type HealthType = 'WEIGHT' | 'HEIGHT' | 'TEMPERATURE' | 'MEDICATION' | 'VACCINE' | 'DIAPER' | 'AD_VITAMIN'

interface Props {
  initialType?: 'WEIGHT' | 'HEIGHT' | 'TEMPERATURE' | 'MEDICATION' | 'VACCINE' | 'DIAPER' | 'AD_VITAMIN'
}

export default function HealthForm({ initialType }: Props) {
  const router = useRouter()
  const [babies, setBabies] = useState<BabyInfo[]>([])
  const [loading, setLoading] = useState(false)
  
  const [babyId, setBabyId] = useState('')
  const [type, setType] = useState<HealthType>(initialType || 'WEIGHT')
  const [weight, setWeight] = useState('')
  const [height, setHeight] = useState('')
  const [temperature, setTemperature] = useState('')
  const [medicationName, setMedicationName] = useState('')
  const [medicationDose, setMedicationDose] = useState('')
  const [vaccineName, setVaccineName] = useState('')
  const [diaperType, setDiaperType] = useState<'PEE' | 'POOP' | 'BOTH'>('PEE')
  const [diaperStatus, setDiaperStatus] = useState('')
  const [adGiven, setAdGiven] = useState(true)
  const [recordedAt, setRecordedAt] = useState(getBeijingNow())
  const [notes, setNotes] = useState('')

  useEffect(() => {
    fetchBabies()
  }, [])

  useEffect(() => {
    if (initialType) {
      setType(initialType)
    }
  }, [initialType])

  const fetchBabies = async () => {
    try {
      const response = await fetch('/api/babies')
      if (response.ok) {
        const data = await response.json()
        if (Array.isArray(data)) {
          setBabies(data)
          if (data.length > 0) {
            setBabyId(data[0].id)
          }
        }
      }
    } catch (error) {
      console.error('获取婴儿列表失败:', error)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!babyId) {
      alert('请选择宝宝')
      return
    }

    setLoading(true)

    try {
      const data: Record<string, unknown> = {
        babyId,
        type,
        recordedAt: toBeijingISO(recordedAt),
        notes: notes || null
      }

      if (type === 'WEIGHT') {
        data.weight = parseFloat(weight) || null
      } else if (type === 'HEIGHT') {
        data.height = parseFloat(height) || null
      } else if (type === 'TEMPERATURE') {
        data.temperature = parseFloat(temperature) || null
      } else if (type === 'MEDICATION') {
        data.medicationName = medicationName || null
        data.medicationDose = medicationDose || null
      } else if (type === 'VACCINE') {
        data.vaccineName = vaccineName || null
      } else if (type === 'DIAPER') {
        data.diaperType = diaperType
        data.diaperStatus = diaperStatus || null
      } else if (type === 'AD_VITAMIN') {
        data.adGiven = adGiven
      }

      const response = await fetch('/api/health', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      })

      if (response.ok) {
        router.push('/')
      } else {
        const error = await response.json()
        alert(error.error || '保存失败')
      }
    } catch (error) {
      console.error('保存失败:', error)
      alert('保存失败，请重试')
    } finally {
      setLoading(false)
    }
  }

  const typeOptions = [
    { value: 'WEIGHT', label: '体重', icon: Scale, color: 'green' },
    { value: 'HEIGHT', label: '身高', icon: Ruler, color: 'blue' },
    { value: 'TEMPERATURE', label: '体温', icon: Thermometer, color: 'red' },
    { value: 'AD_VITAMIN', label: 'AD', icon: Pill, color: 'orange' },
    { value: 'MEDICATION', label: '服药', icon: Pill, color: 'purple' },
    { value: 'VACCINE', label: '疫苗', icon: Syringe, color: 'teal' },
    { value: 'DIAPER', label: '大小便', icon: BabyIcon, color: 'amber' },
  ]

  const getColorClasses = (color: string, isSelected: boolean) => {
    const colors: Record<string, { border: string; bg: string; text: string; icon: string }> = {
      green: { border: 'border-green-500', bg: 'bg-green-50', text: 'text-green-700', icon: 'text-green-500' },
      blue: { border: 'border-blue-500', bg: 'bg-blue-50', text: 'text-blue-700', icon: 'text-blue-500' },
      red: { border: 'border-red-500', bg: 'bg-red-50', text: 'text-red-700', icon: 'text-red-500' },
      orange: { border: 'border-orange-500', bg: 'bg-orange-50', text: 'text-orange-700', icon: 'text-orange-500' },
      purple: { border: 'border-purple-500', bg: 'bg-purple-50', text: 'text-purple-700', icon: 'text-purple-500' },
      teal: { border: 'border-teal-500', bg: 'bg-teal-50', text: 'text-teal-700', icon: 'text-teal-500' },
      amber: { border: 'border-amber-500', bg: 'bg-amber-50', text: 'text-amber-700', icon: 'text-amber-500' },
    }
    const c = colors[color] || colors.green
    return isSelected ? c : { border: 'border-gray-200', bg: '', text: 'text-gray-600', icon: 'text-gray-400' }
  }

  return (
    <div className="space-y-4">
      <button
        onClick={() => router.back()}
        className="flex items-center text-gray-600 hover:text-gray-900 transition"
      >
        <ArrowLeft size={20} className="mr-1" />
        <span className="text-sm">返回</span>
      </button>

      <div className="bg-white rounded-2xl p-4 sm:p-6 shadow-sm">
        <h2 className="text-lg font-bold text-gray-900 mb-4">添加健康记录</h2>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              选择宝宝
            </label>
            {babies.length > 0 ? (
              <select
                value={babyId}
                onChange={(e) => setBabyId(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              >
                {babies.map(baby => (
                  <option key={baby.id} value={baby.id}>{baby.name}</option>
                ))}
              </select>
            ) : (
              <p className="text-gray-500">请先在设置中添加宝宝</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              记录类型
            </label>
            {/* 喂养快捷入口 */}
            <div className="grid grid-cols-2 gap-2 mb-3">
              <Link
                href="/add?type=breast"
                className="flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-gray-200 hover:border-gray-300 transition"
              >
                <Droplets size={20} className="text-pink-400" />
                <span className="text-sm font-medium text-gray-600">母乳</span>
              </Link>
              <Link
                href="/add?type=formula"
                className="flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-gray-200 hover:border-gray-300 transition"
              >
                <Milk size={20} className="text-blue-400" />
                <span className="text-sm font-medium text-gray-600">奶粉</span>
              </Link>
            </div>
            {/* 健康类型选择：每行3个，自动换行 */}
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {typeOptions.map(option => {
                const isSelected = type === option.value
                const colorClasses = getColorClasses(option.color, isSelected)
                const Icon = option.icon
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setType(option.value as HealthType)}
                    className={`flex flex-col items-center py-3 px-2 rounded-xl border-2 transition ${
                      isSelected ? colorClasses.border : 'border-gray-200 hover:border-gray-300'
                    } ${isSelected ? colorClasses.bg : ''}`}
                  >
                    <Icon size={22} className={colorClasses.icon} />
                    <span className={`mt-1.5 text-xs font-medium ${colorClasses.text}`}>
                      {option.label}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          {type === 'WEIGHT' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                体重（千克）
              </label>
              <input
                type="number"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                min="0"
                step="0.01"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                placeholder="例如：3.5"
              />
            </div>
          )}

          {type === 'HEIGHT' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                身高（厘米）
              </label>
              <input
                type="number"
                value={height}
                onChange={(e) => setHeight(e.target.value)}
                min="0"
                step="0.1"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                placeholder="例如：50"
              />
            </div>
          )}

          {type === 'TEMPERATURE' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                体温（摄氏度）
              </label>
              <input
                type="number"
                value={temperature}
                onChange={(e) => setTemperature(e.target.value)}
                min="35"
                max="42"
                step="0.1"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                placeholder="例如：36.5"
              />
            </div>
          )}

          {type === 'MEDICATION' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  药物名称
                </label>
                <input
                  type="text"
                  value={medicationName}
                  onChange={(e) => setMedicationName(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  placeholder="例如：布洛芬"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  剂量
                </label>
                <input
                  type="text"
                  value={medicationDose}
                  onChange={(e) => setMedicationDose(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  placeholder="例如：2ml"
                />
              </div>
            </div>
          )}

          {type === 'VACCINE' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                疫苗名称
              </label>
              <input
                type="text"
                value={vaccineName}
                onChange={(e) => setVaccineName(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                placeholder="例如：乙肝疫苗"
              />
            </div>
          )}

          {type === 'DIAPER' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  类型
                </label>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { value: 'PEE', label: '小便', emoji: '💧' },
                    { value: 'POOP', label: '大便', emoji: '💩' },
                    { value: 'BOTH', label: '都有', emoji: '🚼' },
                  ].map(option => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setDiaperType(option.value as 'PEE' | 'POOP' | 'BOTH')}
                      className={`p-3 rounded-lg border-2 transition text-center ${
                        diaperType === option.value
                          ? 'border-amber-500 bg-amber-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <span className="text-xl">{option.emoji}</span>
                      <p className={`text-sm mt-1 ${diaperType === option.value ? 'text-amber-700 font-medium' : 'text-gray-600'}`}>
                        {option.label}
                      </p>
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  状态（可选）
                </label>
                <input
                  type="text"
                  value={diaperStatus}
                  onChange={(e) => setDiaperStatus(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  placeholder="例如：正常、稀便等"
                />
              </div>
            </div>
          )}

          {type === 'AD_VITAMIN' && (
            <div>
              <label className="flex items-center space-x-3">
                <input
                  type="checkbox"
                  checked={adGiven}
                  onChange={(e) => setAdGiven(e.target.checked)}
                  className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm font-medium text-gray-700">已服用AD滴剂</span>
              </label>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Clock size={16} className="inline mr-1" />
              记录时间
            </label>
            <input
              type="datetime-local"
              value={recordedAt}
              onChange={(e) => setRecordedAt(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              备注（可选）
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none resize-none"
              placeholder="添加备注..."
            />
          </div>

          <button
            type="submit"
            disabled={loading || babies.length === 0}
            className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? '保存中...' : '保存记录'}
          </button>
        </form>
      </div>
    </div>
  )
}
