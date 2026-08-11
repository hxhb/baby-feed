'use client'

import { useEffect, useMemo, useState } from 'react'
import { Info, Loader2 } from 'lucide-react'
import ToothChart, { type EruptedToothState } from '@/components/ToothChart'
import {
  buildOrderedToothEruptionEvents,
  formatEruptionOrder,
  formatToothNames,
  getToothDefinition,
  type PrimaryToothCode,
  type ToothEruptionEventLike,
} from '@/lib/tooth-eruptions'

interface ToothRecord extends ToothEruptionEventLike {
  createdAt: string
  notes?: string | null
}

interface Props {
  babyId?: string
  recordedAt?: string
  selectedCodes: PrimaryToothCode[]
  onChange: (codes: PrimaryToothCode[]) => void
  currentRecordId?: string
  validationMessage?: string
}

function formatDate(value: string | Date) {
  return new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(new Date(value))
}

export default function ToothEruptionFields({
  babyId,
  recordedAt,
  selectedCodes,
  onChange,
  currentRecordId,
  validationMessage = '',
}: Props) {
  const [records, setRecords] = useState<ToothRecord[]>([])
  const [loading, setLoading] = useState(Boolean(babyId))
  const [loadError, setLoadError] = useState('')
  const [detail, setDetail] = useState<EruptedToothState | null>(null)

  useEffect(() => {
    if (!babyId) {
      setRecords([])
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    setLoadError('')
    fetch(`/api/health?babyId=${babyId}&type=TOOTH_ERUPTION`)
      .then(async response => {
        const result = await response.json().catch(() => null)
        if (!response.ok) throw new Error(result?.error || '获取牙齿记录失败')
        return result
      })
      .then(result => {
        if (!cancelled) setRecords(Array.isArray(result) ? result : [])
      })
      .catch(error => {
        if (!cancelled) setLoadError(error instanceof Error ? error.message : '获取牙齿记录失败')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [babyId])

  const { eruptedTeeth, previewOrder, totalCount } = useMemo(() => {
    const otherRecords = records.filter(record => record.id !== currentRecordId)
    const draftRecord: ToothRecord | null = selectedCodes.length > 0 ? {
      id: currentRecordId || '__tooth_draft__',
      recordedAt: recordedAt || new Date().toISOString(),
      createdAt: new Date().toISOString(),
      toothEruptions: selectedCodes.map(toothCode => ({ toothCode })),
    } : null
    const ordered = buildOrderedToothEruptionEvents(draftRecord ? [...otherRecords, draftRecord] : otherRecords)
    const otherIds = new Set(otherRecords.map(record => record.id))
    const states = ordered.flatMap(item => otherIds.has(item.event.id)
      ? item.event.toothEruptions.map(tooth => ({
          toothCode: tooth.toothCode as PrimaryToothCode,
          eventId: item.event.id,
          recordedAt: new Date(item.event.recordedAt).toISOString(),
          orderStart: item.orderStart,
          orderEnd: item.orderEnd,
        }))
      : [])
    const preview = draftRecord ? ordered.find(item => item.event.id === draftRecord.id) : null
    return {
      eruptedTeeth: states,
      previewOrder: preview ? formatEruptionOrder(preview.orderStart, preview.orderEnd) : '',
      totalCount: states.length + selectedCodes.length,
    }
  }, [currentRecordId, recordedAt, records, selectedCodes])

  const toggleTooth = (code: PrimaryToothCode) => {
    setDetail(null)
    onChange(selectedCodes.includes(code)
      ? selectedCodes.filter(item => item !== code)
      : [...selectedCodes, code])
  }

  return (
    <fieldset className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <legend className="text-sm font-semibold text-slate-900">选择本次长出的牙齿</legend>
          <p className="mt-0.5 text-xs leading-5 text-slate-500">可以同时选择多颗，系统会按同一批萌出记录。</p>
        </div>
        <span className="shrink-0 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold tabular-nums text-emerald-700">{totalCount}/20</span>
      </div>

      {loading ? (
        <div className="flex min-h-40 items-center justify-center gap-2 text-sm text-slate-500">
          <Loader2 size={17} className="animate-spin" />正在加载牙位
        </div>
      ) : (
        <ToothChart
          selectedCodes={selectedCodes}
          eruptedTeeth={eruptedTeeth}
          onToggle={toggleTooth}
          onEruptedToothClick={setDetail}
        />
      )}

      {loadError ? <p role="alert" className="text-sm text-red-600">{loadError}</p> : null}
      {detail ? (
        <div className="flex items-start gap-2 rounded-lg border border-emerald-100 bg-emerald-50/70 px-3 py-2.5 text-sm text-emerald-900">
          <Info size={16} className="mt-0.5 shrink-0" />
          <p><span className="font-semibold">{getToothDefinition(detail.toothCode)?.name}</span> · {formatEruptionOrder(detail.orderStart, detail.orderEnd)} · {formatDate(detail.recordedAt)}</p>
        </div>
      ) : null}

      {selectedCodes.length > 0 ? (
        <div className="border-l-2 border-emerald-400 pl-3">
          <p className="text-sm font-semibold text-slate-900">本次选择 {selectedCodes.length} 颗</p>
          <p className="mt-0.5 text-xs leading-5 text-slate-600">{formatToothNames(selectedCodes)}</p>
          {previewOrder ? <p className="mt-1 text-xs font-semibold text-emerald-700">预计顺序：{previewOrder}</p> : null}
        </div>
      ) : null}

      {validationMessage ? <p role="alert" className="text-sm text-red-600">{validationMessage}</p> : null}
    </fieldset>
  )
}
