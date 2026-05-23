'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { getBeijingNow, toBeijingISO } from '@/lib/time'
import { invalidateRecordRelatedCaches } from '@/lib/cache-helpers'
import RecordActionBar from '@/components/RecordActionBar'
import RecordTabBar from '@/components/RecordTabBar'
import {
  CalendarCheck
} from 'lucide-react'

interface BabyInfo {
  id: string
  name: string
}

interface SharedDraft {
  babyId: string
  eventTime: string
  notes: string
}

interface Props {
  initialBabies?: BabyInfo[]
  initialSharedDraft?: SharedDraft
  onSharedDraftChange?: (draft: SharedDraft) => void
  onRecordSaved?: () => void
}

const MEMO_DRAFT_STORAGE_KEY = 'baby-feed:add-record-memo-draft'

interface MemoDraft {
  title: string
  content: string
  scheduledAt: string
}

export default function MemoForm({
  initialBabies = [],
  initialSharedDraft,
  onSharedDraftChange,
  onRecordSaved
}: Props) {
  const router = useRouter()
  const [babies, setBabies] = useState<BabyInfo[]>(initialBabies)
  const [loading, setLoading] = useState(false)
  const [submitError, setSubmitError] = useState('')

  const [babyId, setBabyId] = useState('')
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [scheduledAt, setScheduledAt] = useState(getBeijingNow())
  const hasHydratedSharedDraft = useRef(false)
  const hasHydratedLocalDraft = useRef(false)

  useEffect(() => {
    if (initialBabies.length > 0) {
      setBabies(initialBabies)
      setBabyId(currentBabyId => currentBabyId || initialSharedDraft?.babyId || initialBabies[0].id)
      return
    }

    fetchBabies()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialBabies, initialSharedDraft?.babyId])

  useEffect(() => {
    if (!initialSharedDraft || hasHydratedSharedDraft.current) {
      return
    }

    const hasSharedDraft = Boolean(initialSharedDraft.babyId || initialSharedDraft.eventTime)
    if (!hasSharedDraft) {
      return
    }

    hasHydratedSharedDraft.current = true
    setBabyId(currentBabyId => currentBabyId || initialSharedDraft.babyId)
    if (initialSharedDraft.eventTime) {
      setScheduledAt(currentScheduledAt => currentScheduledAt || initialSharedDraft.eventTime)
    }
  }, [initialSharedDraft])

  useEffect(() => {
    onSharedDraftChange?.({
      babyId,
      eventTime: scheduledAt,
      notes: ''
    })
  }, [babyId, scheduledAt, onSharedDraftChange])

  // Hydrate local draft
  useEffect(() => {
    if (hasHydratedLocalDraft.current) return
    hasHydratedLocalDraft.current = true

    try {
      const rawDraft = window.sessionStorage.getItem(MEMO_DRAFT_STORAGE_KEY)
      if (!rawDraft) return

      const parsedDraft = JSON.parse(rawDraft) as Partial<MemoDraft>
      if (typeof parsedDraft.title === 'string') setTitle(parsedDraft.title)
      if (typeof parsedDraft.content === 'string') setContent(parsedDraft.content)
      if (typeof parsedDraft.scheduledAt === 'string' && parsedDraft.scheduledAt) {
        setScheduledAt(parsedDraft.scheduledAt)
      }
    } catch (error) {
      console.error('读取备忘草稿失败:', error)
    }
  }, [])

  // Persist local draft
  useEffect(() => {
    try {
      const nextDraft: MemoDraft = { title, content, scheduledAt }
      const isEmpty = !nextDraft.title && !nextDraft.content

      if (isEmpty) {
        window.sessionStorage.removeItem(MEMO_DRAFT_STORAGE_KEY)
        return
      }

      window.sessionStorage.setItem(MEMO_DRAFT_STORAGE_KEY, JSON.stringify(nextDraft))
    } catch (error) {
      console.error('保存备忘草稿失败:', error)
    }
  }, [title, content, scheduledAt])

  // Clear error on field change
  useEffect(() => {
    if (!submitError) return
    setSubmitError('')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [babyId, title, content, scheduledAt])

  const fetchBabies = async () => {
    try {
      const response = await fetch('/api/babies')
      if (response.ok) {
        const data = await response.json()
        if (Array.isArray(data)) {
          setBabies(data)
          if (data.length > 0) {
            setBabyId(currentBabyId => currentBabyId || initialSharedDraft?.babyId || data[0].id)
          }
        }
      }
    } catch (error) {
      console.error('获取婴儿列表失败:', error)
    }
  }

  const getValidationMessage = useCallback(() => {
    if (!babyId) return '请先选择宝宝'
    if (!title.trim()) return '请输入备忘标题'
    return ''
  }, [babyId, title])

  const validationMessage = getValidationMessage()
  const canSubmit = babies.length > 0 && !loading && !validationMessage

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const currentValidation = getValidationMessage()
    if (currentValidation) {
      setSubmitError(currentValidation)
      return
    }

    setLoading(true)

    let saved = false
    try {
      const response = await fetch('/api/memo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          babyId,
          title: title.trim(),
          content: content.trim() || null,
          scheduledAt: toBeijingISO(scheduledAt),
        })
      })

      if (response.ok) {
        saved = true
      } else {
        const error = await response.json()
        setSubmitError(error.error || '保存失败')
      }
    } catch (error) {
      console.error('保存失败:', error)
      setSubmitError('保存失败，请重试')
    } finally {
      setLoading(false)
    }

    if (saved) {
      invalidateRecordRelatedCaches(babyId)
      window.sessionStorage.removeItem(MEMO_DRAFT_STORAGE_KEY)
      window.sessionStorage.setItem('record_saved', '1')
      onRecordSaved?.()
      try {
        router.replace('/')
        router.refresh()
      } catch {
        // navigation error doesn't affect saved result
      }
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3.5 pb-3 sm:space-y-4 sm:pb-0">
      {/* 宝宝选择 + 一级分类 */}
      <div className="rounded-2xl border border-gray-100 bg-white p-3.5 shadow-sm sm:p-4 space-y-3.5">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">
            选择宝宝
          </label>
          {babies.length > 0 ? (
            <select
              value={babyId}
              onChange={(e) => setBabyId(e.target.value)}
              className="w-full rounded-xl border border-gray-300 px-3.5 py-2.5 text-sm text-gray-900 outline-none transition focus:border-transparent focus:ring-2 focus:ring-blue-500"
            >
              {babies.map(baby => (
                <option key={baby.id} value={baby.id}>{baby.name}</option>
              ))}
            </select>
          ) : (
            <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 px-3.5 py-3 text-sm text-gray-500">
              <p>请先在设置中添加宝宝</p>
              <Link
                href="/settings"
                className="mobile-touch-target mt-1.5 inline-flex items-center rounded-xl px-1 text-sm font-medium text-blue-600 transition hover:text-blue-700"
              >
                前往设置
              </Link>
            </div>
          )}
        </div>

        {/* 一级分类：喂养 / 健康 / 备忘 */}
        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">
            记录类型
          </label>
          <RecordTabBar />
        </div>
      </div>

      {/* Memo form fields */}
      <div className="rounded-2xl border border-gray-100 bg-white p-3.5 shadow-sm sm:p-4">
        <div className="mb-3 flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-indigo-50">
            <CalendarCheck size={18} className="text-indigo-500" />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-gray-900 sm:text-base">编辑备忘</h3>
            <p className="text-xs text-gray-500 sm:text-sm">记录待办事项、提醒或重要备忘信息。</p>
          </div>
        </div>

        <div className="space-y-3">
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
              className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-2.5 text-[16px] text-gray-900 outline-none transition focus:border-blue-300 focus:bg-white focus:ring-2 focus:ring-blue-100"
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
              className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-2.5 text-[16px] text-gray-900 outline-none transition focus:border-blue-300 focus:bg-white focus:ring-2 focus:ring-blue-100"
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
              className="w-full resize-none rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-2.5 text-[16px] text-gray-900 outline-none transition focus:border-blue-300 focus:bg-white focus:ring-2 focus:ring-blue-100"
            />
          </div>
        </div>
      </div>

      <RecordActionBar
        mode="create"
        submitError={submitError}
        validationMessage={validationMessage}
        primaryLabel={validationMessage ? '请先补充必填信息' : '保存备忘'}
        loadingLabel="保存中..."
        loading={loading}
        disabled={!canSubmit}
      />
    </form>
  )
}
