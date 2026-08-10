'use client'

import { useEffect, useRef, useState } from 'react'
import { AlertCircle, CalendarClock, Check, CheckCircle2, ClipboardList, Clock3, MoreVertical, Pencil, Plus, Trash2 } from 'lucide-react'
import { formatBeijingDateTimeLabel, toBeijingDatetimeLocal } from '@/lib/time'
import { invalidateRequestCache } from '@/lib/client-request-cache'
import { StatsPanel, StatsEmptyState } from '@/components/StatsUi'
import MemoFormModal, { type MemoRecord } from '@/components/MemoFormModal'
import ConfirmDialog from '@/components/ConfirmDialog'

interface Props {
  memoRecords: MemoRecord[]
  babyId: string
}

type MemoFeedback = { tone: 'success' | 'error'; message: string }

function getDefaultMemoView(memos: MemoRecord[]): 'pending' | 'completed' {
  return memos.length === 0 || memos.some(memo => !memo.completed) ? 'pending' : 'completed'
}

function parseMemoRecord(value: unknown): MemoRecord {
  if (!value || typeof value !== 'object') {
    throw new Error('服务器返回的备忘数据无效')
  }

  const record = value as Record<string, unknown>
  if (
    typeof record.id !== 'string' ||
    typeof record.title !== 'string' ||
    typeof record.scheduledAt !== 'string' ||
    typeof record.completed !== 'boolean'
  ) {
    throw new Error('服务器返回的备忘数据无效')
  }

  return {
    id: record.id,
    title: record.title,
    content: typeof record.content === 'string' ? record.content : null,
    scheduledAt: record.scheduledAt,
    completed: record.completed,
    completedAt: typeof record.completedAt === 'string' ? record.completedAt : null,
  }
}

async function requestJson(url: string, init: RequestInit, fallbackError: string): Promise<unknown> {
  const response = await fetch(url, init)
  const payload = await response.json().catch(() => null) as { error?: unknown } | null

  if (!response.ok) {
    const message = typeof payload?.error === 'string' ? payload.error : fallbackError
    throw new Error(message)
  }

  return payload
}

function formatActionError(error: unknown, fallback: string) {
  const message = error instanceof Error ? error.message : fallback
  return /重试|稍后再试/.test(message) ? message : `${message}，请重试`
}

function isOverdue(scheduledAt: string): boolean {
  return new Date(scheduledAt).getTime() < Date.now()
}

/**
 * 计算备忘的天数状态标签
 * - 未完成 + 未过期：显示"剩余X天"
 * - 未完成 + 已过期：显示"逾期X天"
 * - 已完成：显示"已完成X天"
 */
function getMemoDayLabel(memo: MemoRecord): { text: string; tone: 'completed' | 'overdue' | 'today' | 'upcoming' } | null {
  const now = Date.now()
  const nowDate = toBeijingDatetimeLocal(new Date(now).toISOString()).split('T')[0]

  const calendarDayDifference = (isoString: string) => {
    const targetDate = toBeijingDatetimeLocal(isoString).split('T')[0]
    return Math.round((new Date(`${targetDate}T00:00:00Z`).getTime() - new Date(`${nowDate}T00:00:00Z`).getTime()) / (24 * 60 * 60 * 1000))
  }

  if (memo.completed && memo.completedAt) {
    const diffDays = Math.max(0, -calendarDayDifference(memo.completedAt))
    if (diffDays === 0) {
      return { text: '今日完成', tone: 'completed' }
    }
    return { text: `已完成${diffDays}天`, tone: 'completed' }
  }

  if (!memo.completed) {
    const scheduledTime = new Date(memo.scheduledAt).getTime()
    const diffDays = calendarDayDifference(memo.scheduledAt)

    if (diffDays === 0) {
      return scheduledTime < now
        ? { text: '今日逾期', tone: 'overdue' }
        : { text: '今日到期', tone: 'today' }
    }
    if (diffDays < 0) {
      return { text: `逾期${Math.abs(diffDays)}天`, tone: 'overdue' }
    }
    return { text: `剩余${diffDays}天`, tone: 'upcoming' }
  }

  return null
}

export default function MemoSection({ memoRecords: initialMemos, babyId }: Props) {
  const [memos, setMemos] = useState<MemoRecord[]>(initialMemos)
  const [showForm, setShowForm] = useState(false)
  const [editingMemo, setEditingMemo] = useState<MemoRecord | null>(null)
  const [saving, setSaving] = useState(false)
  const [deletingIds, setDeletingIds] = useState<Set<string>>(() => new Set())
  const [togglingIds, setTogglingIds] = useState<Set<string>>(() => new Set())
  const [activeView, setActiveView] = useState<'pending' | 'completed'>(() => getDefaultMemoView(initialMemos))
  const [confirmTarget, setConfirmTarget] = useState<{ type: 'complete' | 'delete'; memo: MemoRecord } | null>(null)
  const [memoMenuOpenId, setMemoMenuOpenId] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<MemoFeedback | null>(null)
  const activeBabyIdRef = useRef(babyId)
  const previousBabyIdRef = useRef(babyId)
  const saveRequestIdRef = useRef(0)
  activeBabyIdRef.current = babyId

  const now = Date.now()
  const nextWeek = now + 7 * 24 * 60 * 60 * 1000
  const pendingMemos = memos
    .filter(memo => !memo.completed)
    .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime())
  const completedMemos = memos
    .filter(memo => memo.completed)
    .sort((a, b) => new Date(b.completedAt || b.scheduledAt).getTime() - new Date(a.completedAt || a.scheduledAt).getTime())
  const overdueMemos = pendingMemos.filter(memo => new Date(memo.scheduledAt).getTime() < now)
  const upcomingMemos = pendingMemos.filter(memo => {
    const scheduledAt = new Date(memo.scheduledAt).getTime()
    return scheduledAt >= now && scheduledAt <= nextWeek
  })
  const laterMemos = pendingMemos.filter(memo => new Date(memo.scheduledAt).getTime() > nextWeek)
  const pendingGroups = [
    { key: 'overdue', label: '已逾期', description: '需要优先处理', icon: AlertCircle, iconClass: 'text-red-600', memos: overdueMemos },
    { key: 'upcoming', label: '近 7 天', description: '即将到期', icon: Clock3, iconClass: 'text-amber-600', memos: upcomingMemos },
    { key: 'later', label: '稍后', description: '按到期时间排列', icon: CalendarClock, iconClass: 'text-blue-600', memos: laterMemos },
  ].filter(group => group.memos.length > 0)

  useEffect(() => {
    if (previousBabyIdRef.current !== babyId) {
      previousBabyIdRef.current = babyId
      saveRequestIdRef.current += 1
      setMemos(initialMemos)
      setActiveView(getDefaultMemoView(initialMemos))
      setShowForm(false)
      setEditingMemo(null)
      setSaving(false)
      setDeletingIds(new Set())
      setTogglingIds(new Set())
      setConfirmTarget(null)
      setMemoMenuOpenId(null)
      setFeedback(null)
    }
  }, [babyId, initialMemos])

  useEffect(() => {
    if (!feedback) return
    const timer = window.setTimeout(() => setFeedback(null), feedback.tone === 'success' ? 3000 : 5000)
    return () => window.clearTimeout(timer)
  }, [feedback])

  const setItemBusy = (
    setter: React.Dispatch<React.SetStateAction<Set<string>>>,
    id: string,
    busy: boolean,
  ) => {
    setter(previous => {
      const next = new Set(previous)
      if (busy) next.add(id)
      else next.delete(id)
      return next
    })
  }

  const replaceMemo = (updatedMemo: MemoRecord) => {
    setMemos(previous => previous.map(memo => memo.id === updatedMemo.id ? updatedMemo : memo))
  }

  const handleCreate = async (data: { title: string; content: string | null; scheduledAt: string }) => {
    const requestBabyId = babyId
    const requestId = ++saveRequestIdRef.current
    setSaving(true)
    setFeedback(null)
    try {
      const createdMemo = parseMemoRecord(await requestJson('/api/memo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ babyId, ...data }),
      }, '创建备忘失败'))
      if (activeBabyIdRef.current === requestBabyId) {
        setMemos(previous => [...previous, createdMemo])
        setShowForm(false)
        setActiveView('pending')
        setFeedback({ tone: 'success', message: '备忘已添加' })
        invalidateRequestCache()
      }
    } catch (error) {
      if (activeBabyIdRef.current === requestBabyId) {
        setFeedback({ tone: 'error', message: formatActionError(error, '创建备忘失败') })
      }
    } finally {
      if (saveRequestIdRef.current === requestId) setSaving(false)
    }
  }

  const handleEdit = async (data: { title: string; content: string | null; scheduledAt: string }) => {
    if (!editingMemo) return
    const requestBabyId = babyId
    const requestId = ++saveRequestIdRef.current
    const editingId = editingMemo.id
    setSaving(true)
    setFeedback(null)
    try {
      const updatedMemo = parseMemoRecord(await requestJson(`/api/memo/${editingId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }, '更新备忘失败'))
      if (activeBabyIdRef.current === requestBabyId) {
        replaceMemo(updatedMemo)
        setEditingMemo(null)
        setFeedback({ tone: 'success', message: '备忘已更新' })
        invalidateRequestCache()
      }
    } catch (error) {
      if (activeBabyIdRef.current === requestBabyId) {
        setFeedback({ tone: 'error', message: formatActionError(error, '更新备忘失败') })
      }
    } finally {
      if (saveRequestIdRef.current === requestId) setSaving(false)
    }
  }

  const handleToggleComplete = async (memo: MemoRecord) => {
    // Confirm before marking as complete (not for un-completing)
    if (!memo.completed) {
      setConfirmTarget({ type: 'complete', memo })
      return
    }

    const requestBabyId = babyId
    setItemBusy(setTogglingIds, memo.id, true)
    setFeedback(null)
    try {
      const updatedMemo = parseMemoRecord(await requestJson(`/api/memo/${memo.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ completed: !memo.completed }),
      }, '更新备忘状态失败'))
      if (activeBabyIdRef.current === requestBabyId) {
        replaceMemo(updatedMemo)
        setFeedback({ tone: 'success', message: '备忘已恢复为待办' })
        invalidateRequestCache()
      }
    } catch (error) {
      if (activeBabyIdRef.current === requestBabyId) {
        setFeedback({ tone: 'error', message: formatActionError(error, '更新备忘状态失败') })
      }
    } finally {
      setItemBusy(setTogglingIds, memo.id, false)
    }
  }

  const handleConfirmComplete = async () => {
    if (!confirmTarget || confirmTarget.type !== 'complete') return
    const memo = confirmTarget.memo
    setConfirmTarget(null)

    const requestBabyId = babyId
    setItemBusy(setTogglingIds, memo.id, true)
    setFeedback(null)
    try {
      const updatedMemo = parseMemoRecord(await requestJson(`/api/memo/${memo.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ completed: true }),
      }, '完成备忘失败'))
      if (activeBabyIdRef.current === requestBabyId) {
        replaceMemo(updatedMemo)
        setFeedback({ tone: 'success', message: '备忘已完成' })
        invalidateRequestCache()
      }
    } catch (error) {
      if (activeBabyIdRef.current === requestBabyId) {
        setFeedback({ tone: 'error', message: formatActionError(error, '完成备忘失败') })
      }
    } finally {
      setItemBusy(setTogglingIds, memo.id, false)
    }
  }

  const handleDelete = async (memo: MemoRecord) => {
    setConfirmTarget({ type: 'delete', memo })
  }

  const handleConfirmDelete = async () => {
    if (!confirmTarget || confirmTarget.type !== 'delete') return
    const id = confirmTarget.memo.id
    const requestBabyId = babyId
    setConfirmTarget(null)

    setItemBusy(setDeletingIds, id, true)
    setFeedback(null)
    try {
      await requestJson(`/api/memo/${id}`, {
        method: 'DELETE',
      }, '删除备忘失败')
      if (activeBabyIdRef.current === requestBabyId) {
        setMemos(prev => prev.filter(m => m.id !== id))
        setFeedback({ tone: 'success', message: '备忘已删除' })
        invalidateRequestCache()
      }
    } catch (error) {
      if (activeBabyIdRef.current === requestBabyId) {
        setFeedback({ tone: 'error', message: formatActionError(error, '删除备忘失败') })
      }
    } finally {
      setItemBusy(setDeletingIds, id, false)
    }
  }

  const renderMemoItem = (memo: MemoRecord) => (
    <MemoItem
      key={memo.id}
      memo={memo}
      onToggle={() => handleToggleComplete(memo)}
      onEdit={() => setEditingMemo(memo)}
      onDelete={() => handleDelete(memo)}
      toggling={togglingIds.has(memo.id)}
      deleting={deletingIds.has(memo.id)}
      menuOpenId={memoMenuOpenId}
      onMenuToggle={setMemoMenuOpenId}
    />
  )

  const handleTabKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
    event.preventDefault()
    const nextView = event.key === 'ArrowLeft' || event.key === 'Home' ? 'pending' : 'completed'
    setActiveView(nextView)
    document.getElementById(`memo-tab-${nextView}`)?.focus()
  }

  return (
    <>
      {feedback ? (
        <div
          className={`fixed inset-x-3 top-4 z-[100] mx-auto flex max-w-md items-center gap-2.5 rounded-element px-4 py-3 text-sm font-semibold shadow-elevated ${
            feedback.tone === 'success'
              ? 'bg-slate-950 text-white'
              : 'border border-red-200 bg-red-50 text-red-700'
          }`}
          role={feedback.tone === 'error' ? 'alert' : 'status'}
          aria-live={feedback.tone === 'error' ? 'assertive' : 'polite'}
          aria-atomic="true"
        >
          {feedback.tone === 'success'
            ? <CheckCircle2 size={18} className="shrink-0 text-emerald-300" aria-hidden="true" />
            : <AlertCircle size={18} className="shrink-0" aria-hidden="true" />}
          <span>{feedback.message}</span>
        </div>
      ) : null}

      <section className="space-y-3" aria-labelledby="memo-section-title">
        <StatsPanel>
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-start gap-2.5">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
                <ClipboardList size={18} aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <h2 id="memo-section-title" className="text-sm font-bold text-slate-900">备忘与待办</h2>
                <p className="mt-0.5 text-xs leading-5 text-slate-500">按到期时间整理，重要事项更容易找到</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowForm(true)}
              className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-button bg-blue-600 px-3.5 text-sm font-semibold text-white transition-colors duration-200 hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
            >
              <Plus size={17} aria-hidden="true" />
              添加备忘
            </button>
          </div>

          <div className="mt-4 grid grid-cols-3 divide-x divide-slate-200 rounded-lg border border-slate-200 bg-slate-50 py-2.5">
            <div className="px-2 text-center">
              <p className="text-lg font-bold tabular-nums text-slate-900">{pendingMemos.length}</p>
              <p className="text-[11px] font-medium text-slate-500">待处理</p>
            </div>
            <div className="px-2 text-center">
              <p className={`text-lg font-bold tabular-nums ${upcomingMemos.length > 0 ? 'text-amber-700' : 'text-slate-900'}`}>{upcomingMemos.length}</p>
              <p className="text-[11px] font-medium text-slate-500">近 7 天</p>
            </div>
            <div className="px-2 text-center">
              <p className={`text-lg font-bold tabular-nums ${overdueMemos.length > 0 ? 'text-red-600' : 'text-slate-900'}`}>{overdueMemos.length}</p>
              <p className="text-[11px] font-medium text-slate-500">已逾期</p>
            </div>
          </div>
        </StatsPanel>

        <StatsPanel padding="none">
          <div className="border-b border-slate-200 p-2">
            <div
              className="grid grid-cols-2 gap-1 rounded-lg bg-slate-100 p-1"
              role="tablist"
              aria-label="筛选备忘状态"
              onKeyDown={handleTabKeyDown}
            >
              <button
                type="button"
                role="tab"
                id="memo-tab-pending"
                aria-controls="memo-panel-pending"
                aria-selected={activeView === 'pending'}
                tabIndex={activeView === 'pending' ? 0 : -1}
                onClick={() => setActiveView('pending')}
                className={`min-h-11 rounded-button px-3 text-sm font-semibold transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${activeView === 'pending' ? 'bg-white text-blue-700 shadow-card' : 'text-slate-500 hover:bg-white/60 hover:text-slate-700'}`}
              >
                待办 <span className="ml-1 tabular-nums">{pendingMemos.length}</span>
              </button>
              <button
                type="button"
                role="tab"
                id="memo-tab-completed"
                aria-controls="memo-panel-completed"
                aria-selected={activeView === 'completed'}
                tabIndex={activeView === 'completed' ? 0 : -1}
                onClick={() => setActiveView('completed')}
                className={`min-h-11 rounded-button px-3 text-sm font-semibold transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${activeView === 'completed' ? 'bg-white text-emerald-700 shadow-card' : 'text-slate-500 hover:bg-white/60 hover:text-slate-700'}`}
              >
                已完成 <span className="ml-1 tabular-nums">{completedMemos.length}</span>
              </button>
            </div>
          </div>

          <div
            id="memo-panel-pending"
            role="tabpanel"
            aria-labelledby="memo-tab-pending"
            tabIndex={activeView === 'pending' ? 0 : -1}
            hidden={activeView !== 'pending'}
            className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500"
          >
            {activeView !== 'pending' ? null : memos.length === 0 ? (
              <StatsEmptyState
                icon={ClipboardList}
                title="暂无备忘"
                description="添加备忘来记录疫苗、体检等待办事项"
              />
            ) : pendingGroups.length > 0 ? (
              <div>
                {pendingGroups.map(group => {
                  const GroupIcon = group.icon
                  return (
                    <section key={group.key} aria-labelledby={`memo-group-${group.key}`}>
                      <div className="flex items-center justify-between gap-3 border-b border-slate-100 bg-slate-50 px-4 py-2.5">
                        <div className="flex min-w-0 items-center gap-2">
                          <GroupIcon size={15} className={group.iconClass} aria-hidden="true" />
                          <h3 id={`memo-group-${group.key}`} className="text-xs font-bold text-slate-700">{group.label}</h3>
                          <span className="text-[11px] text-slate-400">{group.description}</span>
                        </div>
                        <span className="shrink-0 text-xs font-semibold tabular-nums text-slate-500">{group.memos.length}</span>
                      </div>
                      <div className="divide-y divide-slate-100">
                        {group.memos.map(renderMemoItem)}
                      </div>
                    </section>
                  )
                })}
              </div>
            ) : (
              <StatsEmptyState
                icon={CheckCircle2}
                title="待办已清空"
                description="当前没有需要处理的备忘事项"
              />
            )}
          </div>

          <div
            id="memo-panel-completed"
            role="tabpanel"
            aria-labelledby="memo-tab-completed"
            tabIndex={activeView === 'completed' ? 0 : -1}
            hidden={activeView !== 'completed'}
            className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500"
          >
            {activeView !== 'completed' ? null : memos.length === 0 ? (
              <StatsEmptyState
                icon={ClipboardList}
                title="暂无备忘"
                description="添加备忘来记录疫苗、体检等待办事项"
              />
            ) : completedMemos.length > 0 ? (
              <div>
                <div className="flex items-center gap-2 border-b border-slate-100 bg-emerald-50/50 px-4 py-2.5">
                  <CheckCircle2 size={15} className="text-emerald-600" aria-hidden="true" />
                  <h3 className="text-xs font-bold text-slate-700">最近完成</h3>
                  <span className="text-[11px] text-slate-400">按完成时间排列</span>
                </div>
                <div className="divide-y divide-slate-100">
                  {completedMemos.map(renderMemoItem)}
                </div>
              </div>
            ) : (
              <StatsEmptyState
                icon={CheckCircle2}
                title="暂无已完成事项"
                description="完成的备忘会集中显示在这里"
              />
            )}
          </div>
        </StatsPanel>
      </section>

      {/* Create modal */}
      {showForm && (
        <MemoFormModal
          onSave={handleCreate}
          onCancel={() => setShowForm(false)}
          saving={saving}
        />
      )}

      {/* Edit modal */}
      {editingMemo && (
        <MemoFormModal
          memo={editingMemo}
          onSave={handleEdit}
          onCancel={() => setEditingMemo(null)}
          saving={saving}
        />
      )}

      {/* Menu backdrop */}
      {memoMenuOpenId && (
        <div className="fixed inset-0 z-10" onClick={() => setMemoMenuOpenId(null)} />
      )}

      {/* Confirm dialog */}
      {confirmTarget && confirmTarget.type === 'complete' && (
        <ConfirmDialog
          title="确认完成"
          message={`确定要将「${confirmTarget.memo.title}」标记为已完成吗？`}
          confirmLabel="完成"
          variant="primary"
          onConfirm={handleConfirmComplete}
          onCancel={() => setConfirmTarget(null)}
        />
      )}

      {confirmTarget && confirmTarget.type === 'delete' && (
        <ConfirmDialog
          title="确认删除"
          message={`确定要删除「${confirmTarget.memo.title}」吗？此操作不可恢复。`}
          confirmLabel="删除"
          variant="danger"
          onConfirm={handleConfirmDelete}
          onCancel={() => setConfirmTarget(null)}
        />
      )}
    </>
  )
}

interface MemoItemProps {
  memo: MemoRecord
  onToggle: () => void
  onEdit: () => void
  onDelete: () => void
  toggling: boolean
  deleting: boolean
  menuOpenId: string | null
  onMenuToggle: (id: string | null) => void
}

function MemoItem({ memo, onToggle, onEdit, onDelete, toggling, deleting, menuOpenId, onMenuToggle }: MemoItemProps) {
  const overdue = !memo.completed && isOverdue(memo.scheduledAt)
  const isMenuOpen = menuOpenId === memo.id
  const dayLabel = getMemoDayLabel(memo)
  const dayLabelClass = dayLabel ? {
    completed: 'bg-emerald-50 text-emerald-700',
    overdue: 'bg-red-50 text-red-700',
    today: 'bg-amber-50 text-amber-700',
    upcoming: 'bg-blue-50 text-blue-700',
  }[dayLabel.tone] : ''

  return (
    <article className={`relative flex items-start gap-1.5 px-3 py-3 transition-colors duration-200 sm:px-4 ${memo.completed ? 'bg-slate-50/40' : overdue ? 'bg-red-50/20' : 'bg-white hover:bg-slate-50/70'}`}>
      <button
        type="button"
        onClick={onToggle}
        disabled={toggling}
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-button transition-colors duration-200 hover:bg-emerald-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
        aria-label={memo.completed ? `将${memo.title}标记为未完成` : `将${memo.title}标记为已完成`}
        title={memo.completed ? '标记为未完成' : '标记为已完成'}
      >
        <span className={`flex h-5 w-5 items-center justify-center rounded-md border transition-colors ${memo.completed ? 'border-emerald-500 bg-emerald-500 text-white' : overdue ? 'border-red-300 bg-white text-transparent' : 'border-slate-300 bg-white text-transparent'}`}>
          {memo.completed ? <Check size={13} strokeWidth={3} aria-hidden="true" /> : null}
        </span>
      </button>

      <div className="min-w-0 flex-1 py-1">
        <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
          <p className={`min-w-0 text-sm font-semibold leading-5 ${memo.completed ? 'text-slate-400 line-through' : 'text-slate-900'}`}>
            {memo.title}
          </p>
          {dayLabel ? (
            <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums ${dayLabelClass}`}>
              {dayLabel.text}
            </span>
          ) : null}
        </div>
        <div className={`mt-1 flex items-center gap-1.5 text-[11px] ${memo.completed ? 'text-slate-400' : overdue ? 'text-red-600' : 'text-slate-500'}`}>
          <CalendarClock size={13} aria-hidden="true" />
          <time dateTime={memo.scheduledAt}>{formatBeijingDateTimeLabel(memo.scheduledAt)}</time>
        </div>
        {memo.content ? (
          <p className={`mt-1.5 text-xs leading-5 ${memo.completed ? 'text-slate-400' : 'text-slate-600'}`}>
            {memo.content}
          </p>
        ) : null}
      </div>

      <div className="relative shrink-0">
        <button
          type="button"
          onClick={() => onMenuToggle(isMenuOpen ? null : memo.id)}
          className="inline-flex h-11 w-11 items-center justify-center rounded-button text-slate-400 transition-colors duration-200 hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          aria-label={`打开${memo.title}的操作菜单`}
          aria-haspopup="menu"
          aria-expanded={isMenuOpen}
        >
          <MoreVertical size={18} aria-hidden="true" />
        </button>
        {isMenuOpen ? (
          <div className="absolute right-0 top-full z-20 mt-1 min-w-[128px] rounded-element border border-slate-200 bg-white py-1 shadow-elevated" role="menu">
            <button
              type="button"
              role="menuitem"
              onClick={() => { onMenuToggle(null); onEdit() }}
              className="flex min-h-11 w-full items-center gap-2 px-3 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:bg-blue-50"
            >
              <Pencil size={15} aria-hidden="true" />
              编辑
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={() => { onMenuToggle(null); onDelete() }}
              disabled={deleting}
              className="flex min-h-11 w-full items-center gap-2 px-3 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 focus-visible:outline-none focus-visible:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Trash2 size={15} aria-hidden="true" />
              删除
            </button>
          </div>
        ) : null}
      </div>
    </article>
  )
}
