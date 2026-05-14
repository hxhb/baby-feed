'use client'

import { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import { toBeijingDatetimeLocal, toBeijingISO, getBeijingNow } from '@/lib/time'

export interface MemoRecord {
  id: string
  title: string
  content: string | null
  scheduledAt: string
  completed: boolean
  completedAt: string | null
}

interface Props {
  memo?: MemoRecord | null
  onSave: (data: { title: string; content: string | null; scheduledAt: string }) => void
  onCancel: () => void
  saving: boolean
}

export default function MemoFormModal({ memo, onSave, onCancel, saving }: Props) {
  const [title, setTitle] = useState(memo?.title || '')
  const [content, setContent] = useState(memo?.content || '')
  const [scheduledAt, setScheduledAt] = useState(
    memo ? toBeijingDatetimeLocal(memo.scheduledAt) : getBeijingNow()
  )

  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = ''
    }
  }, [])

  const handleSave = () => {
    if (!title.trim()) return
    onSave({
      title: title.trim(),
      content: content.trim() || null,
      scheduledAt: toBeijingISO(scheduledAt),
    })
  }

  const isValid = title.trim().length > 0

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center" onClick={onCancel}>
      <div
        className="mobile-sheet w-full max-w-lg overflow-y-auto bg-white px-4 pt-3 shadow-xl sm:rounded-2xl sm:px-5 sm:pt-5"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-gray-200 sm:hidden" />
        <div className="sticky top-0 z-10 -mx-4 flex items-center justify-between bg-white/95 px-4 pb-3 backdrop-blur sm:static sm:mx-0 sm:bg-transparent sm:px-0 sm:pb-4">
          <h3 className="text-lg font-bold text-gray-900">{memo ? '编辑备忘' : '添加备忘'}</h3>
          <button type="button" onClick={onCancel} className="mobile-touch-target inline-flex items-center justify-center rounded-full text-gray-400 transition hover:bg-gray-100 hover:text-gray-600">
            <X size={22} />
          </button>
        </div>

        <div className="space-y-4 pb-6">
          {/* Title */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              备忘标题 <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="例如：接种第二针乙肝疫苗"
              maxLength={100}
              className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-2.5 text-sm text-gray-900 outline-none transition focus:border-blue-300 focus:bg-white focus:ring-2 focus:ring-blue-100"
              autoFocus
            />
          </div>

          {/* Scheduled time */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              备忘时间 <span className="text-red-400">*</span>
            </label>
            <input
              type="datetime-local"
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
              className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-2.5 text-sm text-gray-900 outline-none transition focus:border-blue-300 focus:bg-white focus:ring-2 focus:ring-blue-100"
            />
          </div>

          {/* Content */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              备忘内容 <span className="text-gray-400">(可选)</span>
            </label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="详细描述..."
              maxLength={500}
              rows={3}
              className="w-full resize-none rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-2.5 text-sm text-gray-900 outline-none transition focus:border-blue-300 focus:bg-white focus:ring-2 focus:ring-blue-100"
            />
          </div>

          {/* Action buttons */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onCancel}
              disabled={saving}
              className="flex-1 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:opacity-50"
            >
              取消
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={!isValid || saving}
              className="flex-1 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? '保存中...' : '保存'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
