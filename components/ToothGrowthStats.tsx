'use client'

import Link from 'next/link'
import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown, ChevronUp, Plus, SmilePlus } from 'lucide-react'
import ConfirmDialog from '@/components/ConfirmDialog'
import RecordActionMenu from '@/components/RecordActionMenu'
import ToothChart, { type EruptedToothState } from '@/components/ToothChart'
import TimelineEditRecordModal from '@/components/TimelineEditRecordModal'
import { StatsPanel } from '@/components/StatsUi'
import { invalidateRecordRelatedCaches } from '@/lib/cache-helpers'
import {
  buildOrderedToothEruptionEvents,
  formatEruptionOrder,
  formatToothNames,
  getToothDefinition,
  type PrimaryToothCode,
} from '@/lib/tooth-eruptions'
import { formatBeijingDateTimeLabel } from '@/lib/time'

interface ToothEruptionRecord {
  id: string
  date: string
  recordedAt: string
  createdAt: string
  notes: string | null
  toothEruptions: { toothCode: string }[]
}

interface Props {
  records: ToothEruptionRecord[]
  babyId: string
  onRecordsChanged: () => void | Promise<void>
}

async function getActionError(response: Response, fallback: string) {
  const result = await response.json().catch(() => null) as { error?: unknown } | null
  return typeof result?.error === 'string' ? result.error : fallback
}

export default function ToothGrowthStats({ records, babyId, onRecordsChanged }: Props) {
  const [showAll, setShowAll] = useState(false)
  const [selectedTooth, setSelectedTooth] = useState<EruptedToothState | null>(null)
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null)
  const [editingRecord, setEditingRecord] = useState<ToothEruptionRecord | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<ToothEruptionRecord | null>(null)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [mutationError, setMutationError] = useState('')
  const [feedback, setFeedback] = useState('')
  const babyIdRef = useRef(babyId)
  const mutationIdRef = useRef(0)
  babyIdRef.current = babyId

  const orderedEvents = useMemo(() => buildOrderedToothEruptionEvents(records), [records])
  const eventById = useMemo(() => new Map(records.map(record => [record.id, record])), [records])
  const eruptedTeeth = useMemo(() => orderedEvents.flatMap(item => item.event.toothEruptions.map(tooth => ({
    toothCode: tooth.toothCode as PrimaryToothCode,
    eventId: item.event.id,
    recordedAt: item.event.recordedAt,
    orderStart: item.orderStart,
    orderEnd: item.orderEnd,
  }))), [orderedEvents])
  const newestFirst = [...orderedEvents].reverse()
  const visibleEvents = showAll ? newestFirst : newestFirst.slice(0, 3)
  const selectedEvent = selectedTooth ? eventById.get(selectedTooth.eventId) : null

  useEffect(() => {
    mutationIdRef.current += 1
    setShowAll(false)
    setSelectedTooth(null)
    setMenuOpenId(null)
    setEditingRecord(null)
    setDeleteTarget(null)
    setSaving(false)
    setDeleting(false)
    setMutationError('')
    setFeedback('')
  }, [babyId])

  useEffect(() => {
    if (selectedTooth && !eventById.has(selectedTooth.eventId)) {
      setSelectedTooth(null)
    }
  }, [eventById, selectedTooth])

  useEffect(() => {
    if (!feedback) return
    const timeoutId = window.setTimeout(() => setFeedback(''), 3_000)
    return () => window.clearTimeout(timeoutId)
  }, [feedback])

  const refreshAfterMutation = async (targetBabyId: string, mutationId: number) => {
    invalidateRecordRelatedCaches(targetBabyId)
    if (babyIdRef.current !== targetBabyId || mutationIdRef.current !== mutationId) return
    await onRecordsChanged()
  }

  const handleEditSave = async (data: Record<string, unknown>) => {
    if (!editingRecord || saving) return

    const targetRecord = editingRecord
    const targetBabyId = babyId
    const mutationId = ++mutationIdRef.current
    setSaving(true)
    setMutationError('')

    try {
      const response = await fetch(`/api/health/${targetRecord.id}?babyId=${encodeURIComponent(targetBabyId)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!response.ok) throw new Error(await getActionError(response, '保存失败，请重试'))

      if (babyIdRef.current !== targetBabyId || mutationIdRef.current !== mutationId) return
      setEditingRecord(null)
      setSelectedTooth(null)
      setFeedback('长牙记录已更新')
      await refreshAfterMutation(targetBabyId, mutationId)
    } catch (error) {
      if (babyIdRef.current === targetBabyId && mutationIdRef.current === mutationId) {
        setMutationError(error instanceof Error ? error.message : '保存失败，请重试')
      }
    } finally {
      if (babyIdRef.current === targetBabyId && mutationIdRef.current === mutationId) {
        setSaving(false)
      }
    }
  }

  const handleDeleteConfirm = async () => {
    if (!deleteTarget || deleting) return

    const targetRecord = deleteTarget
    const targetBabyId = babyId
    const mutationId = ++mutationIdRef.current
    setDeleting(true)
    setMutationError('')

    try {
      const response = await fetch(`/api/health/${targetRecord.id}?babyId=${encodeURIComponent(targetBabyId)}`, {
        method: 'DELETE',
      })
      if (!response.ok) throw new Error(await getActionError(response, '删除失败，请重试'))

      if (babyIdRef.current !== targetBabyId || mutationIdRef.current !== mutationId) return
      setDeleteTarget(null)
      setSelectedTooth(null)
      setFeedback('长牙记录已删除')
      await refreshAfterMutation(targetBabyId, mutationId)
    } catch (error) {
      if (babyIdRef.current === targetBabyId && mutationIdRef.current === mutationId) {
        setMutationError(error instanceof Error ? error.message : '删除失败，请重试')
      }
    } finally {
      if (babyIdRef.current === targetBabyId && mutationIdRef.current === mutationId) {
        setDeleting(false)
      }
    }
  }

  return (
    <StatsPanel padding="compact">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-1.5">
          <SmilePlus size={16} className="text-emerald-600" aria-hidden="true" />
          <h3 className="text-sm font-bold text-slate-900">牙齿成长</h3>
        </div>
        <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-bold tabular-nums text-emerald-700">已长 {eruptedTeeth.length}/20</span>
      </div>

      {feedback ? (
        <p className="mt-2 rounded-lg bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-800" role="status" aria-live="polite">
          {feedback}
        </p>
      ) : null}

      <div className="mt-3">
        <ToothChart
          readOnly
          compact
          eruptedTeeth={eruptedTeeth}
          onEruptedToothClick={setSelectedTooth}
        />
      </div>

      {selectedTooth && selectedEvent ? (
        <div className="mt-3 border-l-2 border-emerald-500 bg-emerald-50/50 py-2 pl-3 pr-2">
          <p className="text-sm font-semibold text-slate-900">{getToothDefinition(selectedTooth.toothCode)?.name}</p>
          <p className="mt-0.5 text-xs text-slate-600">
            {formatEruptionOrder(selectedTooth.orderStart, selectedTooth.orderEnd)} · {formatBeijingDateTimeLabel(selectedTooth.recordedAt)}
          </p>
          {selectedEvent.notes ? <p className="mt-1 text-xs leading-5 text-slate-500">{selectedEvent.notes}</p> : null}
        </div>
      ) : null}

      {visibleEvents.length > 0 ? (
        <div className="mt-3 border-t border-slate-100 pt-2">
          <p className="mb-1 text-[11px] font-semibold text-slate-500">萌出记录</p>
          <div className="divide-y divide-slate-100">
            {visibleEvents.map(item => (
              <div key={item.event.id} className="flex items-start justify-between gap-2 py-2.5">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-800">{formatEruptionOrder(item.orderStart, item.orderEnd)}</p>
                  <p className="mt-0.5 text-xs leading-5 text-slate-500">{formatToothNames(item.event.toothEruptions.map(tooth => tooth.toothCode))}</p>
                  {item.event.notes ? <p className="mt-0.5 text-xs leading-5 text-slate-500">{item.event.notes}</p> : null}
                </div>
                <div className="flex shrink-0 items-start gap-1">
                  <time dateTime={item.event.recordedAt} className="pt-2 text-right text-[11px] leading-5 text-slate-500">
                    {formatBeijingDateTimeLabel(item.event.recordedAt)}
                  </time>
                  <RecordActionMenu
                    open={menuOpenId === item.event.id}
                    onOpenChange={(open) => setMenuOpenId(open ? item.event.id : null)}
                    onEdit={() => {
                      setMutationError('')
                      setEditingRecord(item.event)
                    }}
                    onDelete={() => {
                      setMutationError('')
                      setDeleteTarget(item.event)
                    }}
                    ariaLabel={`${formatEruptionOrder(item.orderStart, item.orderEnd)}萌出记录操作`}
                  />
                </div>
              </div>
            ))}
          </div>
          {newestFirst.length > 3 ? (
            <button
              type="button"
              onClick={() => setShowAll(current => !current)}
              aria-expanded={showAll}
              className="mt-1 flex min-h-11 w-full items-center justify-center gap-1 rounded-lg text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
            >
              {showAll ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
              {showAll ? '收起记录' : `查看全部 ${newestFirst.length} 次记录`}
            </button>
          ) : null}
        </div>
      ) : (
        <div className="mt-3 flex flex-col items-center border-t border-slate-100 px-4 py-5 text-center">
          <p className="text-sm font-semibold text-slate-800">暂无长牙记录</p>
          <p className="mt-1 text-xs text-slate-500">记录后会在牙位图中显示萌出顺序和时间。</p>
          <Link
            href="/add?type=teething"
            className="mt-3 inline-flex min-h-11 items-center justify-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 text-sm font-semibold text-emerald-800 transition-colors hover:bg-emerald-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2"
          >
            <Plus size={16} />添加长牙记录
          </Link>
        </div>
      )}

      {menuOpenId ? (
        <div className="fixed inset-0 z-10" onClick={() => setMenuOpenId(null)} aria-hidden="true" />
      ) : null}

      {deleteTarget ? (
        <ConfirmDialog
          title="删除长牙记录"
          message={`确定要删除 ${formatToothNames(deleteTarget.toothEruptions.map(tooth => tooth.toothCode))} 的萌出记录吗？此操作不可恢复。`}
          confirmLabel="删除"
          loadingLabel="删除中..."
          variant="danger"
          loading={deleting}
          errorMessage={mutationError}
          onConfirm={() => void handleDeleteConfirm()}
          onCancel={() => {
            if (deleting) return
            setDeleteTarget(null)
            setMutationError('')
          }}
        />
      ) : null}

      {editingRecord ? (
        <TimelineEditRecordModal
          record={{
            ...editingRecord,
            type: 'TOOTH_ERUPTION',
            babyId,
            recordType: 'health',
            toothEruptions: editingRecord.toothEruptions.map(tooth => ({
              toothCode: tooth.toothCode as PrimaryToothCode,
            })),
          }}
          onSave={handleEditSave}
          onCancel={() => {
            if (saving) return
            setEditingRecord(null)
            setMutationError('')
          }}
          saving={saving}
          errorMessage={mutationError}
        />
      ) : null}
    </StatsPanel>
  )
}
