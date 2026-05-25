'use client'

import { useState, useCallback } from 'react'
import { ClipboardList, Plus, Check, Pencil, Trash2, ChevronDown, ChevronUp, MoreVertical } from 'lucide-react'
import { toBeijingDatetimeLocal } from '@/lib/time'
import { invalidateRequestCache } from '@/lib/client-request-cache'
import { StatsPanel, StatsEmptyState } from '@/components/StatsUi'
import MemoFormModal, { type MemoRecord } from '@/components/MemoFormModal'
import ConfirmDialog from '@/components/ConfirmDialog'

interface Props {
  memoRecords: MemoRecord[]
  babyId: string
}

function formatMemoDate(isoString: string): string {
  const dtLocal = toBeijingDatetimeLocal(isoString)
  const [datePart, timePart] = dtLocal.split('T')
  return `${datePart} ${timePart}`
}

function isOverdue(scheduledAt: string): boolean {
  return new Date(scheduledAt).getTime() < Date.now()
}

export default function MemoSection({ memoRecords: initialMemos, babyId }: Props) {
  const [memos, setMemos] = useState<MemoRecord[]>(initialMemos)
  const [showForm, setShowForm] = useState(false)
  const [editingMemo, setEditingMemo] = useState<MemoRecord | null>(null)
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [togglingId, setTogglingId] = useState<string | null>(null)
  const [showCompleted, setShowCompleted] = useState(false)
  const [confirmTarget, setConfirmTarget] = useState<{ type: 'complete' | 'delete'; memo: MemoRecord } | null>(null)
  const [memoMenuOpenId, setMemoMenuOpenId] = useState<string | null>(null)

  const pendingMemos = memos.filter(m => !m.completed)
  const completedMemos = memos.filter(m => m.completed)

  const refreshMemos = useCallback(async () => {
    try {
      const res = await fetch(`/api/memo?babyId=${babyId}`)
      if (res.ok) {
        const data = await res.json()
        setMemos(data.map((r: Record<string, unknown>) => ({
          id: r.id as string,
          title: r.title as string,
          content: (r.content as string) || null,
          scheduledAt: r.scheduledAt as string,
          completed: r.completed as boolean,
          completedAt: (r.completedAt as string) || null,
        })))
      }
    } catch {
      // silently fail, user can retry
    }
  }, [babyId])

  const handleCreate = async (data: { title: string; content: string | null; scheduledAt: string }) => {
    setSaving(true)
    try {
      const res = await fetch('/api/memo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ babyId, ...data }),
      })
      if (res.ok) {
        setShowForm(false)
        invalidateRequestCache()
        await refreshMemos()
      }
    } finally {
      setSaving(false)
    }
  }

  const handleEdit = async (data: { title: string; content: string | null; scheduledAt: string }) => {
    if (!editingMemo) return
    setSaving(true)
    try {
      const res = await fetch(`/api/memo/${editingMemo.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (res.ok) {
        setEditingMemo(null)
        invalidateRequestCache()
        await refreshMemos()
      }
    } finally {
      setSaving(false)
    }
  }

  const handleToggleComplete = async (memo: MemoRecord) => {
    // Confirm before marking as complete (not for un-completing)
    if (!memo.completed) {
      setConfirmTarget({ type: 'complete', memo })
      return
    }

    setTogglingId(memo.id)
    try {
      const res = await fetch(`/api/memo/${memo.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ completed: !memo.completed }),
      })
      if (res.ok) {
        invalidateRequestCache()
        await refreshMemos()
      }
    } finally {
      setTogglingId(null)
    }
  }

  const handleConfirmComplete = async () => {
    if (!confirmTarget || confirmTarget.type !== 'complete') return
    const memo = confirmTarget.memo
    setConfirmTarget(null)

    setTogglingId(memo.id)
    try {
      const res = await fetch(`/api/memo/${memo.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ completed: true }),
      })
      if (res.ok) {
        invalidateRequestCache()
        await refreshMemos()
      }
    } finally {
      setTogglingId(null)
    }
  }

  const handleDelete = async (memo: MemoRecord) => {
    setConfirmTarget({ type: 'delete', memo })
  }

  const handleConfirmDelete = async () => {
    if (!confirmTarget || confirmTarget.type !== 'delete') return
    const id = confirmTarget.memo.id
    setConfirmTarget(null)

    setDeletingId(id)
    try {
      const res = await fetch(`/api/memo/${id}`, {
        method: 'DELETE',
      })
      if (res.ok) {
        setMemos(prev => prev.filter(m => m.id !== id))
        invalidateRequestCache()
      }
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <>
      <StatsPanel className="p-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <ClipboardList size={15} className="text-indigo-500" />
            <h3 className="text-sm font-bold text-slate-900">备忘录</h3>
          </div>
          <div className="flex items-center gap-1.5">
            {pendingMemos.length > 0 && (
              <span className="rounded-full bg-indigo-100 px-1.5 py-0.5 text-[11px] font-bold text-indigo-700">
                {pendingMemos.length}条待办
              </span>
            )}
            <button
              type="button"
              onClick={() => setShowForm(true)}
              className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2 py-1 text-[11px] font-medium text-indigo-600 transition hover:bg-indigo-100"
            >
              <Plus size={12} />
              添加
            </button>
          </div>
        </div>

        {memos.length > 0 ? (
          <div className="mt-2.5">
            {/* Pending memos */}
            {pendingMemos.length > 0 && (
              <div className="grid gap-2 sm:grid-cols-2">
                {pendingMemos.map(memo => (
                  <MemoItem
                    key={memo.id}
                    memo={memo}
                    onToggle={() => handleToggleComplete(memo)}
                    onEdit={() => setEditingMemo(memo)}
                    onDelete={() => handleDelete(memo)}
                    toggling={togglingId === memo.id}
                    deleting={deletingId === memo.id}
                    menuOpenId={memoMenuOpenId}
                    onMenuToggle={setMemoMenuOpenId}
                  />
                ))}
              </div>
            )}

            {/* Completed memos section */}
            {completedMemos.length > 0 && (
              <div className={pendingMemos.length > 0 ? 'mt-2' : ''}>
                <button
                  type="button"
                  onClick={() => setShowCompleted(!showCompleted)}
                  className="flex w-full items-center gap-1 rounded-button px-2 py-1.5 text-[11px] font-medium text-slate-400 transition hover:bg-gray-50 hover:text-slate-600"
                >
                  {showCompleted ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                  已完成 ({completedMemos.length})
                </button>
                {showCompleted && (
                  <div className="mt-1 grid gap-1.5 sm:grid-cols-2">
                    {completedMemos.map(memo => (
                      <MemoItem
                        key={memo.id}
                        memo={memo}
                        onToggle={() => handleToggleComplete(memo)}
                        onEdit={() => setEditingMemo(memo)}
                        onDelete={() => handleDelete(memo)}
                        toggling={togglingId === memo.id}
                        deleting={deletingId === memo.id}
                        menuOpenId={memoMenuOpenId}
                        onMenuToggle={setMemoMenuOpenId}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          <StatsEmptyState
            icon={ClipboardList}
            title="暂无备忘"
            description="添加备忘来记录疫苗、体检等待办事项"
          />
        )}
      </StatsPanel>

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

  return (
    <div
      className={`rounded-xl border p-2.5 transition ${
        memo.completed
          ? 'border-gray-100 bg-gray-50/50'
          : overdue
            ? 'border-red-200 bg-red-50/30'
            : 'border-indigo-100 bg-indigo-50/20'
      }`}
    >
      <div className="flex items-start gap-2">
        {/* Toggle button */}
        <button
          type="button"
          onClick={onToggle}
          disabled={toggling}
          className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition ${
            memo.completed
              ? 'border-emerald-300 bg-emerald-100 text-emerald-600'
              : 'border-gray-300 bg-white text-transparent hover:border-emerald-300 hover:text-emerald-400'
          } disabled:opacity-50`}
          title={memo.completed ? '标记为未完成' : '标记为已完成'}
        >
          {memo.completed ? <Check size={12} /> : <Check size={12} />}
        </button>

        {/* Content */}
        <div className="min-w-0 flex-1">
          <p className={`text-sm font-medium ${memo.completed ? 'text-slate-400 line-through' : 'text-slate-900'}`}>
            {memo.title}
          </p>
          <div className="mt-0.5 flex items-center gap-1.5 text-[11px]">
            {overdue && (
              <span className="font-bold text-red-500">已过期</span>
            )}
            <span className={memo.completed ? 'text-slate-400' : overdue ? 'text-red-400' : 'text-slate-500'}>
              {formatMemoDate(memo.scheduledAt)}
            </span>
          </div>
          {memo.content && (
            <p className={`mt-1 text-xs leading-relaxed ${memo.completed ? 'text-slate-400' : 'text-slate-600'}`}>
              {memo.content}
            </p>
          )}
        </div>

        {/* Actions - dropdown menu */}
        <div className="relative shrink-0">
          <button
            type="button"
            onClick={() => onMenuToggle(isMenuOpen ? null : memo.id)}
            className="inline-flex h-7 w-7 items-center justify-center rounded-button text-slate-400 transition hover:bg-gray-100 hover:text-slate-600"
          >
            <MoreVertical size={15} />
          </button>
          {isMenuOpen && (
            <div className="absolute right-0 top-full mt-1 z-20 bg-white rounded-element shadow-elevated border border-slate-100 py-1 min-w-[100px]">
              <button
                type="button"
                onClick={() => { onMenuToggle(null); onEdit() }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 transition"
              >
                <Pencil size={14} />
                编辑
              </button>
              <button
                type="button"
                onClick={() => { onMenuToggle(null); onDelete() }}
                disabled={deleting}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition disabled:opacity-50"
              >
                <Trash2 size={14} />
                删除
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
