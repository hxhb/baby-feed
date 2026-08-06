'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { KeyboardEvent, PointerEvent as ReactPointerEvent } from 'react'
import {
  ArrowLeft,
  Check,
  GripVertical,
  LayoutGrid,
  Loader2,
  Save,
} from 'lucide-react'
import { useCopyToast } from '@/components/CopyToast'
import {
  getQuickRecordMeta,
  quickRecordGroupMeta,
  recordTypeGroups,
  toneClasses,
} from '@/components/record-composer/record-types'
import {
  DEFAULT_QUICK_RECORD_KEYS,
  isQuickRecordKey,
  normalizeQuickRecordKeys,
  type QuickRecordKey,
} from '@/lib/quick-records'

interface Props {
  onBack: () => void
}

function sameKeys(left: QuickRecordKey[], right: QuickRecordKey[]) {
  return left.length === right.length && left.every((key, index) => key === right[index])
}

function moveKeyToIndex(keys: QuickRecordKey[], key: QuickRecordKey, targetIndex: number) {
  const sourceIndex = keys.indexOf(key)
  const boundedTargetIndex = Math.max(0, Math.min(targetIndex, keys.length - 1))
  if (sourceIndex < 0 || sourceIndex === boundedTargetIndex) return keys

  const next = [...keys]
  const [moved] = next.splice(sourceIndex, 1)
  next.splice(boundedTargetIndex, 0, moved)
  return next
}

export default function QuickRecordSettings({ onBack }: Props) {
  const { showCopyToast } = useCopyToast()
  const [keys, setKeys] = useState<QuickRecordKey[]>([...DEFAULT_QUICK_RECORD_KEYS])
  const [savedKeys, setSavedKeys] = useState<QuickRecordKey[]>([...DEFAULT_QUICK_RECORD_KEYS])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [draggingKey, setDraggingKey] = useState<QuickRecordKey | null>(null)
  const [sortAnnouncement, setSortAnnouncement] = useState('')
  const draggingKeyRef = useRef<QuickRecordKey | null>(null)
  const dragPointerIdRef = useRef<number | null>(null)
  const pointerPositionRef = useRef({ y: 0 })
  const autoScrollFrameRef = useRef<number | null>(null)

  useEffect(() => {
    let active = true

    async function loadSettings() {
      try {
        const response = await fetch('/api/user/quick-records')
        const result = await response.json().catch(() => null)
        if (!response.ok) throw new Error(result?.error || '获取快捷记录失败')
        const loadedKeys = normalizeQuickRecordKeys(result?.keys)
        if (!active) return
        setKeys(loadedKeys)
        setSavedKeys(loadedKeys)
      } catch (loadError) {
        if (active) setError(loadError instanceof Error ? loadError.message : '获取快捷记录失败')
      } finally {
        if (active) setLoading(false)
      }
    }

    void loadSettings()
    return () => { active = false }
  }, [])

  useEffect(() => () => {
    draggingKeyRef.current = null
    if (autoScrollFrameRef.current !== null) {
      window.cancelAnimationFrame(autoScrollFrameRef.current)
    }
  }, [])

  const sections = useMemo(() => [
    { label: '一级入口', items: quickRecordGroupMeta },
    ...recordTypeGroups.map(group => ({
      label: group.label,
      items: group.types
        .filter(item => isQuickRecordKey(item.type))
        .map(item => getQuickRecordMeta(item.type as QuickRecordKey)),
    })).filter(section => section.items.length > 0),
  ], [])

  const dirty = !sameKeys(keys, savedKeys)

  const toggleKey = (key: QuickRecordKey) => {
    setError('')
    setKeys(current => {
      if (!current.includes(key)) return [...current, key]
      if (current.length === 1) {
        setError('请至少保留一个快捷记录')
        return current
      }
      return current.filter(item => item !== key)
    })
  }

  const announcePosition = useCallback((key: QuickRecordKey, position: number) => {
    setSortAnnouncement(`已将${getQuickRecordMeta(key).label}移到第 ${position} 位`)
  }, [])

  const reorderFromPointer = useCallback((clientY: number) => {
    const sourceKey = draggingKeyRef.current
    if (!sourceKey) return

    const rows = Array.from(document.querySelectorAll<HTMLElement>('[data-quick-record-key]'))
    const sourceIndex = rows.findIndex(row => row.dataset.quickRecordKey === sourceKey)
    if (sourceIndex < 0) return

    const otherRows = rows.filter(row => row.dataset.quickRecordKey !== sourceKey)
    const nextRowIndex = otherRows.findIndex(row => {
      const bounds = row.getBoundingClientRect()
      return clientY < bounds.top + bounds.height / 2
    })
    const targetIndex = nextRowIndex < 0 ? otherRows.length : nextRowIndex
    if (sourceIndex === targetIndex) return

    setKeys(current => moveKeyToIndex(current, sourceKey, targetIndex))
    announcePosition(sourceKey, targetIndex + 1)
  }, [announcePosition])

  const stopAutoScroll = useCallback(() => {
    if (autoScrollFrameRef.current !== null) {
      window.cancelAnimationFrame(autoScrollFrameRef.current)
      autoScrollFrameRef.current = null
    }
  }, [])

  const runAutoScroll = useCallback(() => {
    if (!draggingKeyRef.current) {
      autoScrollFrameRef.current = null
      return
    }

    const { y } = pointerPositionRef.current
    const edgeSize = Math.min(96, window.innerHeight * 0.15)
    const topDistance = y
    const bottomDistance = window.innerHeight - y
    let scrollAmount = 0

    if (topDistance < edgeSize) {
      scrollAmount = -Math.ceil(12 * (1 - Math.max(0, topDistance) / edgeSize))
    } else if (bottomDistance < edgeSize) {
      scrollAmount = Math.ceil(12 * (1 - Math.max(0, bottomDistance) / edgeSize))
    }

    if (scrollAmount !== 0) {
      window.scrollBy(0, scrollAmount)
      reorderFromPointer(y)
    }
    autoScrollFrameRef.current = window.requestAnimationFrame(runAutoScroll)
  }, [reorderFromPointer])

  useEffect(() => {
    if (!draggingKey) return

    const handlePointerMove = (event: globalThis.PointerEvent) => {
      if (event.pointerId !== dragPointerIdRef.current) return
      event.preventDefault()
      pointerPositionRef.current = { y: event.clientY }
      reorderFromPointer(event.clientY)
    }

    const handlePointerEnd = (event: globalThis.PointerEvent) => {
      if (event.pointerId !== dragPointerIdRef.current) return
      const movedKey = draggingKeyRef.current
      draggingKeyRef.current = null
      dragPointerIdRef.current = null
      setDraggingKey(null)
      stopAutoScroll()
      if (movedKey) setSortAnnouncement(`${getQuickRecordMeta(movedKey).label}排序完成`)
    }

    window.addEventListener('pointermove', handlePointerMove, { passive: false })
    window.addEventListener('pointerup', handlePointerEnd)
    window.addEventListener('pointercancel', handlePointerEnd)
    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerEnd)
      window.removeEventListener('pointercancel', handlePointerEnd)
    }
  }, [draggingKey, reorderFromPointer, stopAutoScroll])

  const startDragging = (event: ReactPointerEvent<HTMLButtonElement>, key: QuickRecordKey) => {
    if (!event.isPrimary || event.button !== 0) return
    event.preventDefault()
    draggingKeyRef.current = key
    dragPointerIdRef.current = event.pointerId
    pointerPositionRef.current = { y: event.clientY }
    setDraggingKey(key)
    setSortAnnouncement(`正在移动${getQuickRecordMeta(key).label}`)
    stopAutoScroll()
    autoScrollFrameRef.current = window.requestAnimationFrame(runAutoScroll)
  }

  const handleSortKeyDown = (event: KeyboardEvent<HTMLButtonElement>, key: QuickRecordKey) => {
    const currentIndex = keys.indexOf(key)
    let targetIndex = currentIndex

    if (event.key === 'ArrowUp') targetIndex = currentIndex - 1
    else if (event.key === 'ArrowDown') targetIndex = currentIndex + 1
    else if (event.key === 'Home') targetIndex = 0
    else if (event.key === 'End') targetIndex = keys.length - 1
    else return

    event.preventDefault()
    const next = moveKeyToIndex(keys, key, targetIndex)
    if (next === keys) return
    setKeys(next)
    announcePosition(key, Math.max(0, Math.min(targetIndex, keys.length - 1)) + 1)
  }

  const saveSettings = async () => {
    if (!dirty || saving) return
    setSaving(true)
    setError('')
    try {
      const response = await fetch('/api/user/quick-records', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keys }),
      })
      const result = await response.json().catch(() => null)
      if (!response.ok) throw new Error(result?.error || '保存快捷记录失败')
      const updatedKeys = normalizeQuickRecordKeys(result?.keys)
      setKeys(updatedKeys)
      setSavedKeys(updatedKeys)
      showCopyToast('快捷记录已保存')
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : '保存快捷记录失败')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-slate-600">
        <Loader2 size={24} className="mr-2 animate-spin text-blue-600" />
        正在加载快捷记录
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-4xl space-y-4 px-3 py-4 sm:space-y-5 sm:px-4">
      <header className="flex items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          aria-label="返回设置"
          className="mobile-touch-target flex shrink-0 items-center justify-center rounded-xl text-slate-600 transition hover:bg-slate-100 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        >
          <ArrowLeft size={20} />
        </button>
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <LayoutGrid size={22} className="shrink-0 text-emerald-500" />
          <h1 className="truncate text-xl font-bold text-slate-900">快捷记录管理</h1>
        </div>
        <button
          type="button"
          onClick={() => void saveSettings()}
          disabled={!dirty || saving}
          className="mobile-touch-target inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-blue-600 px-3 text-sm font-semibold text-white transition hover:bg-blue-700 active:scale-95 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
        >
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
          {saving ? '保存中' : '保存'}
        </button>
      </header>

      {error ? (
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <section className="overflow-hidden rounded-card border border-blue-50 bg-white shadow-card" aria-labelledby="enabled-quick-records">
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
          <h2 id="enabled-quick-records" className="text-base font-bold text-slate-900">首页快捷记录</h2>
          <span className="text-sm tabular-nums text-slate-500">{keys.length} 项</span>
        </div>
        <div className={`divide-y divide-slate-100 ${draggingKey ? 'select-none' : ''}`}>
          {keys.map(key => {
            const item = getQuickRecordMeta(key)
            const tone = toneClasses[item.tone]
            const Icon = item.icon
            return (
              <div
                key={key}
                data-quick-record-key={key}
                className={`flex min-h-[64px] items-center gap-3 px-4 py-2.5 transition-[background-color,box-shadow] ${draggingKey === key ? 'relative z-10 bg-blue-50 shadow-sm' : 'bg-white'}`}
              >
                <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${tone.soft}`}>
                  <Icon size={18} className={tone.icon} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-slate-900">{item.label}</p>
                  <p className="truncate text-xs text-slate-500">{item.description}</p>
                </div>
                <button
                  type="button"
                  data-quick-record-drag-handle
                  onPointerDown={event => startDragging(event, key)}
                  onKeyDown={event => handleSortKeyDown(event, key)}
                  aria-label={`拖动调整${item.label}顺序`}
                  aria-grabbed={draggingKey === key}
                  title="拖动调整顺序"
                  className={`mobile-touch-target flex shrink-0 touch-none items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${draggingKey === key ? 'cursor-grabbing bg-blue-100 text-blue-600' : 'cursor-grab'}`}
                >
                  <GripVertical size={20} />
                </button>
              </div>
            )
          })}
        </div>
        <div className="sr-only" aria-live="polite" aria-atomic="true">{sortAnnouncement}</div>
      </section>

      <section className="rounded-card border border-blue-50 bg-white p-4 shadow-card" aria-labelledby="available-quick-records">
        <h2 id="available-quick-records" className="text-base font-bold text-slate-900">全部项目</h2>
        <div className="mt-4 space-y-5">
          {sections.map(section => (
            <div key={section.label}>
              <h3 className="mb-2 text-xs font-semibold text-slate-500">{section.label}</h3>
              <div className="grid gap-2 sm:grid-cols-2">
                {section.items.map(item => {
                  const enabled = keys.includes(item.key)
                  const tone = toneClasses[item.tone]
                  const Icon = item.icon
                  return (
                    <label key={item.key} className="flex min-h-[58px] cursor-pointer items-center gap-3 rounded-xl border border-slate-200 px-3 py-2 transition hover:bg-slate-50 focus-within:ring-2 focus-within:ring-blue-500">
                      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${tone.soft}`}>
                        <Icon size={18} className={tone.icon} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-slate-900">{item.label}</span>
                        <span className="block truncate text-xs text-slate-500">{item.description}</span>
                      </span>
                      <input
                        type="checkbox"
                        checked={enabled}
                        onChange={() => toggleKey(item.key)}
                        aria-label={`${enabled ? '停用' : '启用'}${item.label}`}
                        className="h-5 w-5 shrink-0 accent-blue-600"
                      />
                    </label>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className="flex min-h-6 items-center justify-end text-sm text-slate-500" aria-live="polite">
        {!dirty && !error ? <span className="inline-flex items-center gap-1"><Check size={15} className="text-emerald-500" />配置已保存</span> : null}
      </div>
    </div>
  )
}
