'use client'

import { useState } from 'react'
import { X, Clock, Check } from 'lucide-react'
import { toBeijingDatetimeLocal, toBeijingISO } from '@/lib/time'

interface FeedingRecord {
  id: string
  type: string
  startTime: string
  endTime?: string | null
  leftBreastDuration?: number | null
  rightBreastDuration?: number | null
  breastMilkAmount?: number | null
  formulaAmount?: number | null
  adGiven?: boolean | null
  notes?: string | null
  recordType: 'feeding'
}

interface HealthRecord {
  id: string
  type: string
  recordedAt: string
  weight?: number | null
  height?: number | null
  temperature?: number | null
  medicationName?: string | null
  medicationDose?: string | null
  vaccineName?: string | null
  diaperType?: string | null
  diaperStatus?: string | null
  adGiven?: boolean | null
  notes?: string | null
  recordType: 'health'
}

type TimelineRecord = FeedingRecord | HealthRecord

interface Props {
  record: TimelineRecord
  onSave: (data: Record<string, unknown>) => void
  onCancel: () => void
  saving: boolean
}

export default function TimelineEditRecordModal({ record, onSave, onCancel, saving }: Props) {
  const isFeeding = record.recordType === 'feeding'
  const feedingRecord = isFeeding ? (record as FeedingRecord) : null
  const healthRecord = !isFeeding ? (record as HealthRecord) : null

  const timeStr = isFeeding ? feedingRecord!.startTime : healthRecord!.recordedAt
  const [editTime, setEditTime] = useState(toBeijingDatetimeLocal(timeStr))
  const [editNotes, setEditNotes] = useState(record.notes || '')

  const [leftDuration, setLeftDuration] = useState(String(feedingRecord?.leftBreastDuration || ''))
  const [rightDuration, setRightDuration] = useState(String(feedingRecord?.rightBreastDuration || ''))
  const [breastMilkAmt, setBreastMilkAmt] = useState(String(feedingRecord?.breastMilkAmount || ''))
  const [formulaAmt, setFormulaAmt] = useState(String(feedingRecord?.formulaAmount || ''))

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
      notes: editNotes || null,
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
      } else if (record.type === 'VACCINE') data.vaccineName = vaccineName || null
      else if (record.type === 'DIAPER') {
        data.diaperType = diaperType
        data.diaperStatus = diaperStatus || null
      } else if (record.type === 'AD_VITAMIN') data.adGiven = adGiven
    }

    onSave(data)
  }

  const getTypeLabel = () => {
    switch (record.type) {
      case 'BREAST_MILK':
        return '母乳亲喂'
      case 'BREAST_MILK_BOTTLE':
        return '母乳瓶喂'
      case 'FORMULA':
        return '奶粉喂养'
      case 'AD_VITAMIN':
        return 'AD滴剂'
      case 'WEIGHT':
        return '体重'
      case 'HEIGHT':
        return '身高'
      case 'TEMPERATURE':
        return '体温'
      case 'MEDICATION':
        return '服药'
      case 'VACCINE':
        return '疫苗'
      case 'DIAPER':
        return '大小便'
      default:
        return '记录'
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center" onClick={onCancel}>
      <div
        className="mobile-sheet w-full max-w-lg overflow-y-auto bg-white px-4 pt-3 shadow-xl sm:rounded-2xl sm:px-5 sm:pt-5"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-gray-200 sm:hidden" />
        <div className="sticky top-0 z-10 -mx-4 flex items-center justify-between bg-white/95 px-4 pb-3 backdrop-blur sm:static sm:mx-0 sm:bg-transparent sm:px-0 sm:pb-4">
          <h3 className="text-lg font-bold text-gray-900">编辑{getTypeLabel()}</h3>
          <button type="button" onClick={onCancel} className="mobile-touch-target inline-flex items-center justify-center rounded-full text-gray-400 transition hover:bg-gray-100 hover:text-gray-600">
            <X size={22} />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              <Clock size={14} className="inline mr-1" />
              记录时间
            </label>
            <input
              type="datetime-local"
              value={editTime}
              onChange={(e) => setEditTime(e.target.value)}
              className="w-full rounded-xl border border-gray-300 px-4 py-3 text-base outline-none focus:border-transparent focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {record.type === 'BREAST_MILK' && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">左侧（分钟）</label>
                <input type="number" value={leftDuration} onChange={(e) => setLeftDuration(e.target.value)} min="0" className="w-full rounded-xl border border-gray-300 px-4 py-3 text-base outline-none focus:border-transparent focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">右侧（分钟）</label>
                <input type="number" value={rightDuration} onChange={(e) => setRightDuration(e.target.value)} min="0" className="w-full rounded-xl border border-gray-300 px-4 py-3 text-base outline-none focus:border-transparent focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>
          )}

          {record.type === 'BREAST_MILK_BOTTLE' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">母乳量（ml）</label>
              <input type="number" value={breastMilkAmt} onChange={(e) => setBreastMilkAmt(e.target.value)} min="0" step="5" className="w-full rounded-xl border border-gray-300 px-4 py-3 text-base outline-none focus:border-transparent focus:ring-2 focus:ring-blue-500" />
            </div>
          )}

          {record.type === 'FORMULA' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">奶粉量（ml）</label>
              <input type="number" value={formulaAmt} onChange={(e) => setFormulaAmt(e.target.value)} min="0" step="5" className="w-full rounded-xl border border-gray-300 px-4 py-3 text-base outline-none focus:border-transparent focus:ring-2 focus:ring-blue-500" />
            </div>
          )}

          {record.type === 'WEIGHT' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">体重（kg）</label>
              <input type="number" value={weight} onChange={(e) => setWeight(e.target.value)} min="0" step="0.01" className="w-full rounded-xl border border-gray-300 px-4 py-3 text-base outline-none focus:border-transparent focus:ring-2 focus:ring-blue-500" />
            </div>
          )}

          {record.type === 'HEIGHT' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">身高（cm）</label>
              <input type="number" value={height} onChange={(e) => setHeight(e.target.value)} min="0" step="0.1" className="w-full rounded-xl border border-gray-300 px-4 py-3 text-base outline-none focus:border-transparent focus:ring-2 focus:ring-blue-500" />
            </div>
          )}

          {record.type === 'TEMPERATURE' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">体温（°C）</label>
              <input type="number" value={temperature} onChange={(e) => setTemperature(e.target.value)} min="35" max="42" step="0.1" className="w-full rounded-xl border border-gray-300 px-4 py-3 text-base outline-none focus:border-transparent focus:ring-2 focus:ring-blue-500" />
            </div>
          )}

          {record.type === 'MEDICATION' && (
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">药物名称</label>
                <input type="text" value={medicationName} onChange={(e) => setMedicationName(e.target.value)} className="w-full rounded-xl border border-gray-300 px-4 py-3 text-base outline-none focus:border-transparent focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">剂量</label>
                <input type="text" value={medicationDose} onChange={(e) => setMedicationDose(e.target.value)} className="w-full rounded-xl border border-gray-300 px-4 py-3 text-base outline-none focus:border-transparent focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>
          )}

          {record.type === 'VACCINE' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">疫苗名称</label>
              <input type="text" value={vaccineName} onChange={(e) => setVaccineName(e.target.value)} className="w-full rounded-xl border border-gray-300 px-4 py-3 text-base outline-none focus:border-transparent focus:ring-2 focus:ring-blue-500" />
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
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setDiaperType(opt.value)}
                      className={`mobile-touch-target rounded-xl border-2 px-2 py-3 text-sm font-medium transition ${
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
                <input type="text" value={diaperStatus} onChange={(e) => setDiaperStatus(e.target.value)} className="w-full rounded-xl border border-gray-300 px-4 py-3 text-base outline-none focus:border-transparent focus:ring-2 focus:ring-blue-500" placeholder="例如：正常、稀便等" />
              </div>
            </div>
          )}

          {record.type === 'AD_VITAMIN' && (
            <label className="flex items-center space-x-3 rounded-xl bg-gray-50 px-3 py-3">
              <input type="checkbox" checked={adGiven} onChange={(e) => setAdGiven(e.target.checked)} className="h-5 w-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
              <span className="text-sm font-medium text-gray-700">已服用AD滴剂</span>
            </label>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">备注</label>
            <textarea value={editNotes} onChange={(e) => setEditNotes(e.target.value)} rows={3} className="w-full rounded-xl border border-gray-300 px-4 py-3 text-base outline-none focus:border-transparent focus:ring-2 focus:ring-blue-500 resize-none" placeholder="添加备注..." />
          </div>

          <div className="sticky bottom-0 -mx-4 flex gap-3 border-t border-gray-100 bg-white/95 px-4 pt-3 backdrop-blur sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:px-0">
            <button type="button" onClick={onCancel} className="mobile-touch-target flex-1 rounded-xl bg-gray-100 px-4 py-3 text-sm font-medium text-gray-700 transition hover:bg-gray-200">取消</button>
            <button type="button" onClick={handleSave} disabled={saving} className="mobile-touch-target flex flex-1 items-center justify-center gap-1 rounded-xl bg-blue-600 px-4 py-3 text-sm font-medium text-white transition hover:bg-blue-700 disabled:opacity-50">
              {saving ? '保存中...' : (<><Check size={16} />保存</>)}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}