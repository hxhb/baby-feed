'use client'

import { useState, useEffect, useCallback } from 'react'
import { format, isToday, isYesterday } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import { formatBeijingTime, getBeijingHour, toBeijingDatetimeLocal, toBeijingISO } from '@/lib/time'
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
  Baby as BabyIcon,
  Pencil,
  X,
  Clock,
  Check
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

// 删除确认弹窗组件
function DeleteConfirmDialog({ 
  onConfirm, 
  onCancel 
}: { 
  onConfirm: () => void
  onCancel: () => void 
}) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
      <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-xl">
        <h3 className="text-lg font-bold text-gray-900 mb-2">确认删除</h3>
        <p className="text-gray-600 mb-6">确定要删除这条记录吗？此操作不可恢复。</p>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 py-2.5 px-4 bg-gray-100 text-gray-700 font-medium rounded-lg hover:bg-gray-200 transition"
          >
            取消
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 py-2.5 px-4 bg-red-500 text-white font-medium rounded-lg hover:bg-red-600 transition"
          >
            删除
          </button>
        </div>
      </div>
    </div>
  )
}

// 编辑弹窗组件
function EditRecordModal({
  record,
  onSave,
  onCancel,
  saving
}: {
  record: TimelineRecord
  onSave: (data: Record<string, unknown>) => void
  onCancel: () => void
  saving: boolean
}) {
  const isFeeding = record.recordType === 'feeding'
  const feedingRecord = isFeeding ? record as FeedingRecord : null
  const healthRecord = !isFeeding ? record as HealthRecord : null

  const timeStr = isFeeding ? feedingRecord!.startTime : healthRecord!.recordedAt
  const [editTime, setEditTime] = useState(toBeijingDatetimeLocal(timeStr))
  const [editNotes, setEditNotes] = useState(record.notes || '')

  // Feeding fields
  const [leftDuration, setLeftDuration] = useState(String(feedingRecord?.leftBreastDuration || ''))
  const [rightDuration, setRightDuration] = useState(String(feedingRecord?.rightBreastDuration || ''))
  const [breastMilkAmt, setBreastMilkAmt] = useState(String(feedingRecord?.breastMilkAmount || ''))
  const [formulaAmt, setFormulaAmt] = useState(String(feedingRecord?.formulaAmount || ''))

  // Health fields
  const [weight, setWeight] = useState(String(healthRecord?.weight || ''))
  const [height, setHeight] = useState(String(healthRecord?.height || ''))
  const [temperature, setTemperature] = useState(String(healthRecord?.temperature || ''))
  const [medicationName, setMedicationName] = useState(healthRecord?.medicationName || '')
  const [medicationDose, setMedicationDose] = useState(healthRecord?.medicationDose || '')
  const [vaccineName, setVaccineName] = useState(healthRecord?.vaccineName || '')
  const [diaperType, setDiaperType] = useState(healthRecord?.diaperType || 'PEE')
  const [diaperStatus, setDiaperStatus] = useState(healthRecord?.diaperStatus || '')
  const [adGiven, setAdGiven] = useState(healthRecord?.adGiven ?? true)

  const handleSave = () => {
    const timeISO = toBeijingISO(editTime)
    const data: Record<string, unknown> = {
      type: record.type,
      notes: editNotes || null
    }

    if (isFeeding) {
      data.startTime = timeISO
      if (record.type === 'BREAST_MILK') {
        data.leftBreastDuration = parseInt(leftDuration) || 0
        data.rightBreastDuration = parseInt(rightDuration) || 0
      } else if (record.type === 'BREAST_MILK_BOTTLE') {
        data.breastMilkAmount = parseFloat(breastMilkAmt) || 0
      } else if (record.type === 'FORMULA') {
        data.formulaAmount = parseFloat(formulaAmt) || 0
      }
    } else {
      data.recordedAt = timeISO
      if (record.type === 'WEIGHT') data.weight = parseFloat(weight) || null
      else if (record.type === 'HEIGHT') data.height = parseFloat(height) || null
      else if (record.type === 'TEMPERATURE') data.temperature = parseFloat(temperature) || null
      else if (record.type === 'MEDICATION') {
        data.medicationName = medicationName || null
        data.medicationDose = medicationDose || null
      }
      else if (record.type === 'VACCINE') data.vaccineName = vaccineName || null
      else if (record.type === 'DIAPER') {
        data.diaperType = diaperType
        data.diaperStatus = diaperStatus || null
      }
      else if (record.type === 'AD_VITAMIN') data.adGiven = adGiven
    }

    onSave(data)
  }

  const getTypeLabel = () => {
    switch (record.type) {
      case 'BREAST_MILK': return '母乳亲喂'
      case 'BREAST_MILK_BOTTLE': return '母乳瓶喂'
      case 'FORMULA': return '奶粉喂养'
      case 'AD_VITAMIN': return 'AD滴剂'
      case 'WEIGHT': return '体重'
      case 'HEIGHT': return '身高'
      case 'TEMPERATURE': return '体温'
      case 'MEDICATION': return '服药'
      case 'VACCINE': return '疫苗'
      case 'DIAPER': return '大小便'
      default: return '记录'
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl p-5 w-full max-w-lg max-h-[85vh] overflow-y-auto shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-gray-900">编辑{getTypeLabel()}</h3>
          <button onClick={onCancel} className="p-1 text-gray-400 hover:text-gray-600">
            <X size={22} />
          </button>
        </div>

        <div className="space-y-4">
          {/* 记录时间 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              <Clock size={14} className="inline mr-1" />
              记录时间
            </label>
            <input
              type="datetime-local"
              value={editTime}
              onChange={(e) => setEditTime(e.target.value)}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm"
            />
          </div>

          {/* 根据类型显示不同字段 */}
          {record.type === 'BREAST_MILK' && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">左侧（分钟）</label>
                <input
                  type="number"
                  value={leftDuration}
                  onChange={(e) => setLeftDuration(e.target.value)}
                  min="0"
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">右侧（分钟）</label>
                <input
                  type="number"
                  value={rightDuration}
                  onChange={(e) => setRightDuration(e.target.value)}
                  min="0"
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm"
                />
              </div>
            </div>
          )}

          {record.type === 'BREAST_MILK_BOTTLE' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">母乳量（ml）</label>
              <input
                type="number"
                value={breastMilkAmt}
                onChange={(e) => setBreastMilkAmt(e.target.value)}
                min="0"
                step="5"
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm"
              />
            </div>
          )}

          {record.type === 'FORMULA' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">奶粉量（ml）</label>
              <input
                type="number"
                value={formulaAmt}
                onChange={(e) => setFormulaAmt(e.target.value)}
                min="0"
                step="5"
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm"
              />
            </div>
          )}

          {record.type === 'WEIGHT' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">体重（kg）</label>
              <input
                type="number"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                min="0"
                step="0.01"
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm"
              />
            </div>
          )}

          {record.type === 'HEIGHT' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">身高（cm）</label>
              <input
                type="number"
                value={height}
                onChange={(e) => setHeight(e.target.value)}
                min="0"
                step="0.1"
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm"
              />
            </div>
          )}

          {record.type === 'TEMPERATURE' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">体温（°C）</label>
              <input
                type="number"
                value={temperature}
                onChange={(e) => setTemperature(e.target.value)}
                min="35"
                max="42"
                step="0.1"
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm"
              />
            </div>
          )}

          {record.type === 'MEDICATION' && (
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">药物名称</label>
                <input
                  type="text"
                  value={medicationName}
                  onChange={(e) => setMedicationName(e.target.value)}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">剂量</label>
                <input
                  type="text"
                  value={medicationDose}
                  onChange={(e) => setMedicationDose(e.target.value)}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm"
                />
              </div>
            </div>
          )}

          {record.type === 'VACCINE' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">疫苗名称</label>
              <input
                type="text"
                value={vaccineName}
                onChange={(e) => setVaccineName(e.target.value)}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm"
              />
            </div>
          )}

          {record.type === 'DIAPER' && (
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">类型</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { value: 'PEE', label: '小便' },
                    { value: 'POOP', label: '大便' },
                    { value: 'BOTH', label: '都有' },
                  ].map(opt => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setDiaperType(opt.value)}
                      className={`py-2 rounded-lg border-2 text-sm font-medium transition ${
                        diaperType === opt.value
                          ? 'border-amber-500 bg-amber-50 text-amber-700'
                          : 'border-gray-200 text-gray-600 hover:border-gray-300'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">状态（可选）</label>
                <input
                  type="text"
                  value={diaperStatus}
                  onChange={(e) => setDiaperStatus(e.target.value)}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm"
                  placeholder="例如：正常、稀便等"
                />
              </div>
            </div>
          )}

          {record.type === 'AD_VITAMIN' && (
            <label className="flex items-center space-x-3">
              <input
                type="checkbox"
                checked={adGiven}
                onChange={(e) => setAdGiven(e.target.checked)}
                className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm font-medium text-gray-700">已服用AD滴剂</span>
            </label>
          )}

          {/* 备注 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">备注</label>
            <textarea
              value={editNotes}
              onChange={(e) => setEditNotes(e.target.value)}
              rows={2}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none resize-none text-sm"
              placeholder="添加备注..."
            />
          </div>

          {/* 操作按钮 */}
          <div className="flex gap-3 pt-1">
            <button
              onClick={onCancel}
              className="flex-1 py-2.5 px-4 bg-gray-100 text-gray-700 font-medium rounded-lg hover:bg-gray-200 transition text-sm"
            >
              取消
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 py-2.5 px-4 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition disabled:opacity-50 text-sm flex items-center justify-center gap-1"
            >
              {saving ? '保存中...' : (
                <>
                  <Check size={16} />
                  保存
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function TimelineComponent({ selectedBabyId, onSelectBaby }: Props) {
  const [babies, setBabies] = useState<Baby[]>([])
  const [records, setRecords] = useState<(FeedingRecord | HealthRecord)[]>([])
  const [loading, setLoading] = useState(true)
  const [currentDate, setCurrentDate] = useState(new Date())
  
  // 删除确认状态
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; type: 'feeding' | 'health' } | null>(null)
  
  // 编辑状态
  const [editingRecord, setEditingRecord] = useState<TimelineRecord | null>(null)
  const [saving, setSaving] = useState(false)

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

  // 删除确认流程
  const handleDeleteClick = (id: string, type: 'feeding' | 'health') => {
    setDeleteTarget({ id, type })
  }

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return

    try {
      const endpoint = deleteTarget.type === 'feeding' 
        ? `/api/feeding/${deleteTarget.id}` 
        : `/api/health/${deleteTarget.id}`
      const response = await fetch(endpoint, { method: 'DELETE' })
      
      if (response.ok) {
        fetchRecords()
      }
    } catch (error) {
      console.error('删除失败:', error)
    } finally {
      setDeleteTarget(null)
    }
  }

  // 编辑保存
  const handleEditSave = async (data: Record<string, unknown>) => {
    if (!editingRecord) return

    setSaving(true)
    try {
      const isFeeding = editingRecord.recordType === 'feeding'
      const endpoint = isFeeding 
        ? `/api/feeding/${editingRecord.id}` 
        : `/api/health/${editingRecord.id}`
      
      const response = await fetch(endpoint, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      })

      if (response.ok) {
        setEditingRecord(null)
        fetchRecords()
      } else {
        const err = await response.json()
        alert(err.error || '保存失败')
      }
    } catch (error) {
      console.error('更新失败:', error)
      alert('保存失败，请重试')
    } finally {
      setSaving(false)
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

  // 按上午/下午分组
  const groupRecordsByPeriod = (records: TimelineRecord[]) => {
    const morning: TimelineRecord[] = []
    const afternoon: TimelineRecord[] = []
    
    records.forEach(record => {
      const time = record.recordType === 'feeding' 
        ? (record as FeedingRecord).startTime 
        : (record as HealthRecord).recordedAt
      const hour = getBeijingHour(time)
      if (hour < 12) {
        morning.push(record)
      } else {
        afternoon.push(record)
      }
    })

    return { morning, afternoon }
  }

  // 母乳统计：亲喂次数 + 瓶喂毫升
  const breastFeedingCount = records.filter(r => r.type === 'BREAST_MILK').length
  const breastBottleCount = records.filter(r => r.type === 'BREAST_MILK_BOTTLE').length
  const totalBreastMilkBottleAmount = records
    .filter((r): r is FeedingRecord => r.type === 'BREAST_MILK_BOTTLE')
    .reduce((sum, r) => sum + (r.breastMilkAmount || 0), 0)

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

  const { morning, afternoon } = groupRecordsByPeriod(records)

  const renderRecordItem = (record: TimelineRecord) => {
    const time = record.recordType === 'feeding' ? record.startTime : record.recordedAt
    const isFeeding = record.recordType === 'feeding'
    
    return (
      <div
        key={record.id}
        className="flex items-center justify-between p-3 sm:p-4 hover:bg-gray-50 transition"
      >
        <div className="flex items-center space-x-3 min-w-0 flex-1">
          <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
            {getRecordIcon(record.type)}
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-medium text-gray-900 text-sm truncate">{getRecordTitle(record)}</p>
            <p className="text-xs text-gray-500">
              {formatBeijingTime(time)}
              {record.notes && <span className="ml-1 text-gray-400">· {record.notes}</span>}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0 ml-2">
          <button
            onClick={() => setEditingRecord(record)}
            className="p-2 text-gray-400 hover:text-blue-500 transition"
            title="编辑"
          >
            <Pencil size={15} />
          </button>
          <button
            onClick={() => handleDeleteClick(record.id, isFeeding ? 'feeding' : 'health')}
            className="p-2 text-gray-400 hover:text-red-500 transition"
            title="删除"
          >
            <Trash2 size={15} />
          </button>
        </div>
      </div>
    )
  }

  const renderRecordSection = (label: string, sectionRecords: TimelineRecord[]) => {
    if (sectionRecords.length === 0) return null
    return (
      <div>
        <div className="flex items-center gap-2 px-3 pt-3 pb-1">
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{label}</span>
          <div className="flex-1 h-px bg-gray-100"></div>
          <span className="text-xs text-gray-400">{sectionRecords.length}条</span>
        </div>
        <div className="divide-y divide-gray-100">
          {sectionRecords.map(renderRecordItem)}
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
              {breastFeedingCount + breastBottleCount}
            </p>
            <p className="text-xs text-gray-500">母乳</p>
            <p className="text-[10px] text-gray-400 leading-tight mt-0.5">
              亲喂{breastFeedingCount}次
            </p>
            {breastBottleCount > 0 && (
              <p className="text-[10px] text-gray-400 leading-tight">
                瓶喂{breastBottleCount}次（{totalBreastMilkBottleAmount}ml）
              </p>
            )}
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

      {/* 记录列表（按上午/下午分组） */}
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        {records.length === 0 ? (
          <div className="text-center py-10 text-gray-500">
            <p>这一天没有记录</p>
          </div>
        ) : (
          <div>
            {renderRecordSection('下午', afternoon)}
            {renderRecordSection('上午', morning)}
          </div>
        )}
      </div>

      {/* 删除确认弹窗 */}
      {deleteTarget && (
        <DeleteConfirmDialog
          onConfirm={handleDeleteConfirm}
          onCancel={() => setDeleteTarget(null)}
        />
      )}

      {/* 编辑弹窗 */}
      {editingRecord && (
        <EditRecordModal
          record={editingRecord}
          onSave={handleEditSave}
          onCancel={() => setEditingRecord(null)}
          saving={saving}
        />
      )}
    </div>
  )
}
