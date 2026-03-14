'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { getBeijingNow, toBeijingISO } from '@/lib/time'
import { 
  Droplets, 
  Milk, 
  ArrowLeft,
  Clock,
  Scale,
  Pill
} from 'lucide-react'

interface BabyInfo {
  id: string
  name: string
}

interface Props {
  initialType: 'breast' | 'breast_bottle' | 'formula' | null
}

export default function FeedingForm({ initialType }: Props) {
  const router = useRouter()
  const [babies, setBabies] = useState<BabyInfo[]>([])
  const [loading, setLoading] = useState(false)
  
  const [babyId, setBabyId] = useState('')
  const [type, setType] = useState<'BREAST_MILK' | 'BREAST_MILK_BOTTLE' | 'FORMULA'>(
    initialType === 'formula' ? 'FORMULA' : initialType === 'breast_bottle' ? 'BREAST_MILK_BOTTLE' : 'BREAST_MILK'
  )
  const [breastMode, setBreastMode] = useState<'direct' | 'bottle'>(
    initialType === 'breast_bottle' ? 'bottle' : 'direct'
  )
  const [leftBreastDuration, setLeftBreastDuration] = useState('')
  const [rightBreastDuration, setRightBreastDuration] = useState('')
  const [breastMilkAmount, setBreastMilkAmount] = useState('')
  const [formulaAmount, setFormulaAmount] = useState('')
  const [startTime, setStartTime] = useState(getBeijingNow())
  const [notes, setNotes] = useState('')

  useEffect(() => {
    fetchBabies()
  }, [])

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
        startTime: toBeijingISO(startTime),
        notes: notes || null
      }

      if (type === 'BREAST_MILK') {
        data.leftBreastDuration = parseInt(leftBreastDuration) || 0
        data.rightBreastDuration = parseInt(rightBreastDuration) || 0
      } else if (type === 'BREAST_MILK_BOTTLE') {
        data.breastMilkAmount = parseFloat(breastMilkAmount) || 0
      } else if (type === 'FORMULA') {
        data.formulaAmount = parseFloat(formulaAmount) || 0
      }

      const response = await fetch('/api/feeding', {
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

  return (
    <div className="space-y-4">
      {/* 返回按钮 */}
      <button
        onClick={() => router.back()}
        className="flex items-center text-gray-600 hover:text-gray-900 transition"
      >
        <ArrowLeft size={20} className="mr-1" />
        <span className="text-sm">返回</span>
      </button>

      <div className="bg-white rounded-2xl p-4 sm:p-6 shadow-sm">
        <h2 className="text-lg font-bold text-gray-900 mb-4">添加喂养记录</h2>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* 选择宝宝 */}
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

          {/* 记录类型 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              记录类型
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => {
                  setType(breastMode === 'bottle' ? 'BREAST_MILK_BOTTLE' : 'BREAST_MILK')
                }}
                className={`flex flex-col items-center p-4 rounded-xl border-2 transition ${
                  type === 'BREAST_MILK' || type === 'BREAST_MILK_BOTTLE'
                    ? 'border-pink-500 bg-pink-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <Droplets size={24} className={type === 'BREAST_MILK' || type === 'BREAST_MILK_BOTTLE' ? 'text-pink-500' : 'text-gray-400'} />
                <span className={`mt-2 text-sm font-medium ${type === 'BREAST_MILK' || type === 'BREAST_MILK_BOTTLE' ? 'text-pink-700' : 'text-gray-600'}`}>
                  母乳
                </span>
              </button>
              <button
                type="button"
                onClick={() => setType('FORMULA')}
                className={`flex flex-col items-center p-4 rounded-xl border-2 transition ${
                  type === 'FORMULA'
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <Milk size={24} className={type === 'FORMULA' ? 'text-blue-500' : 'text-gray-400'} />
                <span className={`mt-2 text-sm font-medium ${type === 'FORMULA' ? 'text-blue-700' : 'text-gray-600'}`}>
                  奶粉
                </span>
              </button>
              <Link
                href="/add?type=ad"
                className="flex flex-col items-center p-4 rounded-xl border-2 border-gray-200 hover:border-gray-300 transition"
              >
                <Pill size={24} className="text-gray-400" />
                <span className="mt-2 text-sm font-medium text-gray-600">
                  AD滴剂
                </span>
              </Link>
              <Link
                href="/add?type=health"
                className="flex flex-col items-center p-4 rounded-xl border-2 border-gray-200 hover:border-gray-300 transition"
              >
                <Scale size={24} className="text-gray-400" />
                <span className="mt-2 text-sm font-medium text-gray-600">
                  健康
                </span>
              </Link>
            </div>
          </div>

          {/* 母乳喂养详情 */}
          {(type === 'BREAST_MILK' || type === 'BREAST_MILK_BOTTLE') && (
            <div className="space-y-4">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setBreastMode('direct')
                    setType('BREAST_MILK')
                  }}
                  className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition ${
                    breastMode === 'direct'
                      ? 'bg-pink-500 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  亲喂
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setBreastMode('bottle')
                    setType('BREAST_MILK_BOTTLE')
                  }}
                  className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition ${
                    breastMode === 'bottle'
                      ? 'bg-pink-500 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  瓶喂
                </button>
              </div>

              {breastMode === 'direct' && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      左侧时长（分钟）
                    </label>
                    <input
                      type="number"
                      value={leftBreastDuration}
                      onChange={(e) => setLeftBreastDuration(e.target.value)}
                      min="0"
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      右侧时长（分钟）
                    </label>
                    <input
                      type="number"
                      value={rightBreastDuration}
                      onChange={(e) => setRightBreastDuration(e.target.value)}
                      min="0"
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                      placeholder="0"
                    />
                  </div>
                </div>
              )}

              {breastMode === 'bottle' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    母乳量（毫升）
                  </label>
                  <input
                    type="number"
                    value={breastMilkAmount}
                    onChange={(e) => setBreastMilkAmount(e.target.value)}
                    min="0"
                    step="5"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                    placeholder="例如：60"
                  />
                </div>
              )}
            </div>
          )}

          {/* 奶粉喂养详情 */}
          {type === 'FORMULA' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                奶粉量（毫升）
              </label>
              <input
                type="number"
                value={formulaAmount}
                onChange={(e) => setFormulaAmount(e.target.value)}
                min="0"
                step="5"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                placeholder="例如：60"
              />
            </div>
          )}

          {/* 时间 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Clock size={16} className="inline mr-1" />
              记录时间
            </label>
            <input
              type="datetime-local"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
            />
          </div>

          {/* 备注 */}
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

          {/* 提交按钮 */}
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
