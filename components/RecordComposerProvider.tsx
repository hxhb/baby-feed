'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import {
  ArrowLeft,
  Check,
  ChevronRight,
  Loader2,
  Moon,
  Plus,
  RotateCcw,
  Trash2,
  X,
} from 'lucide-react'
import AdaptiveDialog from '@/components/AdaptiveDialog'
import RecordComposerEditor from '@/components/record-composer/RecordComposerEditor'
import { getBeijingNow, toBeijingDatetimeLocal } from '@/lib/time'
import { invalidateRecordRelatedCaches } from '@/lib/cache-helpers'
import {
  createComposerDraft,
  getComposerTypeFromQuery,
  getRecordTypeMeta,
  recordTypeGroups,
  toneClasses,
  type ActiveRecordTimer,
  type BabyOption,
  type ComposerDraft,
  type ComposerRecordType,
  type DraftPatch,
  type SavedRecord,
} from '@/components/record-composer/record-types'

interface OpenComposerOptions {
  patch?: DraftPatch
  scope?: 'feeding' | 'health'
}

interface RecordComposerContextValue {
  isOpen: boolean
  openComposer: (type?: ComposerRecordType | null, options?: OpenComposerOptions) => void
  closeComposer: () => void
}

const RecordComposerContext = createContext<RecordComposerContextValue | null>(null)
const ACTIVE_TIMER_KEY = 'baby-feed:record-composer-active-timer'

export function useRecordComposer() {
  const context = useContext(RecordComposerContext)
  if (!context) throw new Error('useRecordComposer must be used within RecordComposerProvider')
  return context
}

function formatTimer(totalSeconds: number) {
  const seconds = Math.max(0, totalSeconds)
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const rest = seconds % 60
  if (hours > 0) return `${hours}:${String(minutes).padStart(2, '0')}:${String(rest).padStart(2, '0')}`
  return `${String(minutes).padStart(2, '0')}:${String(rest).padStart(2, '0')}`
}

export function RecordComposerProvider({ children }: { children: ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const { status } = useSession()
  const [isOpen, setIsOpen] = useState(false)
  const [selectedType, setSelectedType] = useState<ComposerRecordType | null>(null)
  const [babies, setBabies] = useState<BabyOption[]>([])
  const [defaultBabyId, setDefaultBabyId] = useState('')
  const [babiesLoading, setBabiesLoading] = useState(false)
  const [babiesError, setBabiesError] = useState('')
  const [drafts, setDrafts] = useState<Partial<Record<ComposerRecordType, ComposerDraft>>>({})
  const [savedRecord, setSavedRecord] = useState<SavedRecord | null>(null)
  const [toastError, setToastError] = useState('')
  const [undoing, setUndoing] = useState(false)
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false)
  const [launcherScope, setLauncherScope] = useState<'feeding' | 'health' | null>(null)
  const [activeTimer, setActiveTimer] = useState<ActiveRecordTimer | null>(null)
  const [timerNow, setTimerNow] = useState(() => Date.now())
  const panelRef = useRef<HTMLDivElement>(null)
  const discardDialogRef = useRef<HTMLDivElement>(null)
  const previousFocusRef = useRef<HTMLElement | null>(null)
  const discardPreviousFocusRef = useRef<HTMLElement | null>(null)
  const routeOpenedRef = useRef(false)

  useEffect(() => {
    try {
      window.localStorage.removeItem('baby-feed:record-composer-recents')
      const storedTimer = window.localStorage.getItem(ACTIVE_TIMER_KEY)
      if (storedTimer) setActiveTimer(JSON.parse(storedTimer) as ActiveRecordTimer)
    } catch (error) {
      console.error('恢复记录面板状态失败:', error)
    }
  }, [])

  useEffect(() => {
    try {
      if (activeTimer) window.localStorage.setItem(ACTIVE_TIMER_KEY, JSON.stringify(activeTimer))
      else window.localStorage.removeItem(ACTIVE_TIMER_KEY)
    } catch (error) {
      console.error('保存计时状态失败:', error)
    }
  }, [activeTimer])

  useEffect(() => {
    if (!activeTimer) return
    setTimerNow(Date.now())
    const interval = window.setInterval(() => setTimerNow(Date.now()), 1000)
    return () => window.clearInterval(interval)
  }, [activeTimer])

  const loadBabies = useCallback(async () => {
    if (babiesLoading || babies.length > 0) return
    setBabiesLoading(true)
    setBabiesError('')
    try {
      const [babiesResponse, profileResponse] = await Promise.all([
        fetch('/api/babies'),
        fetch('/api/user/profile'),
      ])
      if (!babiesResponse.ok) throw new Error('宝宝信息加载失败')
      const babyList = await babiesResponse.json()
      const profile = profileResponse.ok ? await profileResponse.json() : null
      const normalized = Array.isArray(babyList)
        ? babyList.map((baby: { id: string; name: string }) => ({ id: baby.id, name: baby.name }))
        : []
      const nextDefault = normalized.some(baby => baby.id === profile?.activeBabyId)
        ? profile.activeBabyId
        : normalized[0]?.id || ''
      setBabies(normalized)
      setDefaultBabyId(nextDefault)
      setDrafts(current => {
        const next = { ...current }
        Object.entries(next).forEach(([key, draft]) => {
          if (draft && !draft.babyId) next[key as ComposerRecordType] = { ...draft, babyId: nextDefault }
        })
        return next
      })
    } catch (error) {
      setBabiesError(error instanceof Error ? error.message : '宝宝信息加载失败')
    } finally {
      setBabiesLoading(false)
    }
  }, [babies.length, babiesLoading])

  useEffect(() => {
    if (isOpen && status === 'authenticated') void loadBabies()
  }, [isOpen, loadBabies, status])

  const ensureDraft = useCallback((type: ComposerRecordType, patch?: DraftPatch) => {
    setDrafts(current => {
      const existing = current[type] ?? createComposerDraft(defaultBabyId || babies[0]?.id || '', getBeijingNow())
      return {
        ...current,
        [type]: {
          ...existing,
          ...patch,
          dirty: existing.dirty,
        },
      }
    })
  }, [babies, defaultBabyId])

  const openComposer = useCallback((type: ComposerRecordType | null = null, options?: OpenComposerOptions) => {
    setSavedRecord(null)
    setToastError('')
    setShowDiscardConfirm(false)
    setLauncherScope(options?.scope ?? null)
    setSelectedType(type)
    if (type) ensureDraft(type, options?.patch)
    setIsOpen(true)
  }, [ensureDraft])

  useEffect(() => {
    if (status !== 'authenticated' || pathname !== '/add') {
      routeOpenedRef.current = false
      return
    }
    if (routeOpenedRef.current) return
    routeOpenedRef.current = true
    const queryType = getComposerTypeFromQuery(new URLSearchParams(window.location.search).get('type'))
    openComposer(queryType)
  }, [openComposer, pathname, status])

  const closeImmediately = useCallback(() => {
    setIsOpen(false)
    setSelectedType(null)
    setShowDiscardConfirm(false)
    window.setTimeout(() => previousFocusRef.current?.focus(), 0)
    if (pathname === '/add') router.replace('/')
  }, [pathname, router])

  const closeComposer = useCallback(() => {
    if (selectedType && drafts[selectedType]?.dirty) {
      discardPreviousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
      setShowDiscardConfirm(true)
      return
    }
    closeImmediately()
  }, [closeImmediately, drafts, selectedType])

  const cancelDiscard = useCallback(() => {
    setShowDiscardConfirm(false)
    window.setTimeout(() => discardPreviousFocusRef.current?.focus(), 0)
  }, [])

  useEffect(() => {
    if (!isOpen) return
    previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.setTimeout(() => panelRef.current?.querySelector<HTMLElement>('[data-autofocus]')?.focus(), 0)

    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [isOpen])

  useEffect(() => {
    if (!showDiscardConfirm) return
    window.setTimeout(() => discardDialogRef.current?.querySelector<HTMLElement>('[data-autofocus]')?.focus(), 0)
  }, [showDiscardConfirm])

  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        if (showDiscardConfirm) cancelDiscard()
        else closeComposer()
        return
      }
      const focusRoot = showDiscardConfirm ? discardDialogRef.current : panelRef.current
      if (event.key !== 'Tab' || !focusRoot) return
      const focusable = Array.from(focusRoot.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'))
      if (focusable.length === 0) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [cancelDiscard, closeComposer, isOpen, showDiscardConfirm])

  useEffect(() => {
    if (!savedRecord) return
    const timeout = window.setTimeout(() => setSavedRecord(null), 7000)
    return () => window.clearTimeout(timeout)
  }, [savedRecord])

  const updateDraft = useCallback((type: ComposerRecordType, patch: DraftPatch, markDirty = true) => {
    setDrafts(current => {
      const existing = current[type] ?? createComposerDraft(defaultBabyId || babies[0]?.id || '', getBeijingNow())
      return {
        ...current,
        [type]: { ...existing, ...patch, dirty: markDirty ? true : existing.dirty },
      }
    })
  }, [babies, defaultBabyId])

  const handleSaved = useCallback((record: SavedRecord) => {
    if (!selectedType) return
    setDrafts(current => ({
      ...current,
      [selectedType]: createComposerDraft(defaultBabyId || babies[0]?.id || '', getBeijingNow()),
    }))
    setSavedRecord(record)
    setToastError('')
    closeImmediately()
    router.refresh()
  }, [babies, closeImmediately, defaultBabyId, router, selectedType])

  const startBreastTimer = useCallback((side: 'left' | 'right', babyId: string) => {
    if (activeTimer && !window.confirm('当前有一项计时正在进行。要结束它并开始新的亲喂计时吗？')) return
    setActiveTimer({ kind: 'breast', babyId, side, startedAt: Date.now(), leftSeconds: 0, rightSeconds: 0 })
  }, [activeTimer])

  const switchBreastSide = useCallback(() => {
    setActiveTimer(current => {
      if (!current || current.kind !== 'breast') return current
      const elapsed = Math.max(0, Math.floor((Date.now() - current.startedAt) / 1000))
      return {
        ...current,
        side: current.side === 'left' ? 'right' : 'left',
        startedAt: Date.now(),
        leftSeconds: current.leftSeconds + (current.side === 'left' ? elapsed : 0),
        rightSeconds: current.rightSeconds + (current.side === 'right' ? elapsed : 0),
      }
    })
  }, [])

  const startSleepTimer = useCallback((babyId: string) => {
    if (activeTimer && !window.confirm('当前有一项计时正在进行。要结束它并开始睡眠计时吗？')) return
    setActiveTimer({ kind: 'sleep', babyId, startedAt: Date.now() })
  }, [activeTimer])

  const finishTimer = useCallback(() => {
    if (!activeTimer) return
    if (activeTimer.kind === 'breast') {
      const elapsed = Math.max(0, Math.floor((Date.now() - activeTimer.startedAt) / 1000))
      const leftSeconds = activeTimer.leftSeconds + (activeTimer.side === 'left' ? elapsed : 0)
      const rightSeconds = activeTimer.rightSeconds + (activeTimer.side === 'right' ? elapsed : 0)
      const patch: DraftPatch = {
        babyId: activeTimer.babyId,
        eventTime: toBeijingDatetimeLocal(new Date(activeTimer.startedAt - activeTimer.leftSeconds * 1000 - activeTimer.rightSeconds * 1000).toISOString()),
        leftBreastDuration: leftSeconds > 0 ? String(Math.max(1, Math.round(leftSeconds / 60))) : '',
        rightBreastDuration: rightSeconds > 0 ? String(Math.max(1, Math.round(rightSeconds / 60))) : '',
      }
      setSelectedType('BREAST_MILK')
      updateDraft('BREAST_MILK', patch)
    } else {
      setSelectedType('SLEEP')
      updateDraft('SLEEP', {
        babyId: activeTimer.babyId,
        eventTime: getBeijingNow(),
        sleepStartTime: toBeijingDatetimeLocal(new Date(activeTimer.startedAt).toISOString()),
        sleepEndTime: getBeijingNow(),
      })
    }
    setActiveTimer(null)
    setIsOpen(true)
  }, [activeTimer, updateDraft])

  const handleUndo = async () => {
    if (!savedRecord || undoing) return
    setUndoing(true)
    setToastError('')
    try {
      const response = await fetch(`/api/${savedRecord.kind === 'memo' ? 'memo' : savedRecord.kind}/${savedRecord.id}`, { method: 'DELETE' })
      if (!response.ok) {
        const result = await response.json().catch(() => null)
        throw new Error(result?.error || '撤销失败，请到时间轴中删除')
      }
      invalidateRecordRelatedCaches(savedRecord.babyId)
      window.sessionStorage.setItem('record_saved_ts', String(Date.now()))
      setSavedRecord(null)
      router.refresh()
    } catch (error) {
      setToastError(error instanceof Error ? error.message : '撤销失败，请到时间轴中删除')
    } finally {
      setUndoing(false)
    }
  }

  const selectedDraft = selectedType
    ? drafts[selectedType] ?? createComposerDraft(defaultBabyId || babies[0]?.id || '', getBeijingNow())
    : null
  const selectedMeta = selectedType ? getRecordTypeMeta(selectedType) : null
  const selectedTone = selectedMeta ? toneClasses[selectedMeta.tone] : null
  const SelectedTypeIcon = selectedMeta?.icon
  const selectedBaby = selectedDraft
    ? babies.find(baby => baby.id === selectedDraft.babyId) ?? babies[0]
    : null
  const visibleRecordTypeGroups = launcherScope === 'feeding'
    ? recordTypeGroups.filter(group => group.label === '喂养')
    : launcherScope === 'health'
      ? recordTypeGroups.filter(group => group.label !== '喂养')
      : recordTypeGroups
  const launcherTitle = launcherScope === 'feeding'
    ? '喂养记录'
    : launcherScope === 'health'
      ? '健康记录'
      : '添加记录'

  const contextValue = useMemo(() => ({ isOpen, openComposer, closeComposer }), [closeComposer, isOpen, openComposer])

  return (
    <RecordComposerContext.Provider value={contextValue}>
      {children}

      {activeTimer ? (
        <div className="fixed inset-x-3 bottom-[calc(7rem+env(safe-area-inset-bottom,0px))] z-[70] mx-auto max-w-lg rounded-xl border border-slate-200 bg-white p-2.5 shadow-[0_12px_36px_rgba(15,23,42,0.18)] md:bottom-5" role="status" aria-live="polite">
          <div className="flex items-center gap-3">
            <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${activeTimer.kind === 'breast' ? 'bg-pink-50 text-pink-600' : 'bg-violet-50 text-violet-600'}`}>
              {activeTimer.kind === 'breast' ? <RotateCcw size={19} /> : <Moon size={19} />}
            </div>
            <button type="button" onClick={() => openComposer(activeTimer.kind === 'breast' ? 'BREAST_MILK' : 'SLEEP')} className="min-w-0 flex-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
              <p className="truncate text-sm font-semibold text-slate-950">{activeTimer.kind === 'breast' ? `亲喂 · ${activeTimer.side === 'left' ? '左侧' : '右侧'}` : '宝宝正在睡'}</p>
              <p className="font-mono text-sm tabular-nums text-slate-600">{formatTimer(Math.max(0, Math.floor((timerNow - activeTimer.startedAt) / 1000)))}</p>
            </button>
            {activeTimer.kind === 'breast' ? (
              <button type="button" onClick={switchBreastSide} className="min-h-10 rounded-lg border border-slate-200 px-3 text-sm font-medium text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">换侧</button>
            ) : null}
            <button type="button" onClick={finishTimer} className="min-h-10 rounded-lg bg-slate-900 px-3 text-sm font-medium text-white hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-700">{activeTimer.kind === 'breast' ? '完成' : '醒了'}</button>
          </div>
        </div>
      ) : null}

      {isOpen ? (
        <AdaptiveDialog
          ref={panelRef}
          labelledBy="record-composer-title"
          onDismiss={closeComposer}
          overlay={showDiscardConfirm ? (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-slate-950/35 p-5">
              <div ref={discardDialogRef} role="alertdialog" aria-modal="true" aria-labelledby="discard-title" aria-describedby="discard-description" className="w-full max-w-sm rounded-xl bg-white p-4 shadow-2xl">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-red-50 text-red-600"><Trash2 size={18} /></div>
                  <h3 id="discard-title" className="text-lg font-semibold text-slate-950">放弃这次填写？</h3>
                </div>
                <p id="discard-description" className="mt-2 text-sm leading-6 text-slate-600">关闭后，本次填写的内容将不会保存。</p>
                <div className="mt-4 grid grid-cols-2 gap-2.5">
                  <button type="button" onClick={cancelDiscard} data-autofocus className="min-h-11 rounded-lg border border-slate-300 text-sm font-semibold text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">继续填写</button>
                  <button type="button" onClick={() => {
                    if (selectedType) {
                      setDrafts(current => ({
                        ...current,
                        [selectedType]: createComposerDraft(defaultBabyId || babies[0]?.id || '', getBeijingNow()),
                      }))
                    }
                    closeImmediately()
                  }} className="min-h-11 rounded-lg bg-red-600 text-sm font-semibold text-white hover:bg-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500">放弃并关闭</button>
                </div>
              </div>
            </div>
          ) : null}
        >
            <header className="flex min-h-16 items-center gap-2 border-b border-slate-200 px-3 sm:px-5">
              {selectedType ? (
                <button type="button" onClick={() => setSelectedType(null)} aria-label="返回记录类型" data-autofocus className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
                  <ArrowLeft size={20} />
                </button>
              ) : null}
              {selectedMeta && selectedTone && SelectedTypeIcon ? (
                <>
                  <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${selectedTone.soft}`} aria-hidden="true">
                    <SelectedTypeIcon size={20} className={selectedTone.icon} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h2 id="record-composer-title" className="truncate text-lg font-semibold text-slate-950">{selectedMeta.label}</h2>
                    <p className="truncate text-sm text-slate-600">
                      <span className="font-medium text-slate-700">{selectedBaby?.name || '宝宝'}</span>
                      <span aria-hidden="true"> · </span>
                      {selectedMeta.description}
                    </p>
                  </div>
                </>
              ) : (
                <div className="min-w-0 flex-1">
                  <h2 id="record-composer-title" className="truncate text-lg font-semibold text-slate-950">{launcherTitle}</h2>
                  <p className="truncate text-sm text-slate-600">{launcherScope ? '选择要添加的项目' : '刚刚发生了什么？'}</p>
                </div>
              )}
              <button type="button" onClick={closeComposer} aria-label="关闭记录面板" data-autofocus={!selectedType || undefined} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
                <X size={21} />
              </button>
            </header>

            {babiesLoading ? (
              <div className="flex min-h-80 flex-1 items-center justify-center text-slate-600"><Loader2 size={24} className="mr-2 animate-spin" />正在准备记录面板...</div>
            ) : babiesError ? (
              <div className="flex min-h-80 flex-1 flex-col items-center justify-center px-6 text-center">
                <p className="font-medium text-slate-900">{babiesError}</p>
                <button type="button" onClick={() => void loadBabies()} className="mt-4 min-h-11 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700">重新加载</button>
              </div>
            ) : babies.length === 0 ? (
              <div className="flex min-h-80 flex-1 flex-col items-center justify-center px-6 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-50 text-blue-600"><Plus size={22} /></div>
                <p className="mt-4 font-semibold text-slate-950">先添加宝宝信息</p>
                <p className="mt-1 text-sm text-slate-600">有宝宝资料后才能创建记录。</p>
                <button type="button" onClick={() => { closeImmediately(); router.push('/settings') }} className="mt-5 min-h-11 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700">前往设置</button>
              </div>
            ) : selectedType && selectedDraft ? (
              <RecordComposerEditor
                type={selectedType}
                babies={babies}
                draft={selectedDraft}
                timer={activeTimer}
                timerNow={timerNow}
                onChange={(patch, markDirty) => updateDraft(selectedType, patch, markDirty)}
                onSaved={handleSaved}
                onStartBreastTimer={startBreastTimer}
                onSwitchBreastSide={switchBreastSide}
                onStartSleepTimer={startSleepTimer}
                onFinishTimer={finishTimer}
              />
            ) : (
              <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] pt-5 sm:px-6 sm:pb-6">
                <div className="mx-auto max-w-2xl">
                  <div className="space-y-5">
                    {visibleRecordTypeGroups.map(group => (
                      <section key={group.label} aria-labelledby={`record-group-${group.label}`}>
                        <h3 id={`record-group-${group.label}`} className="mb-2 text-sm font-semibold text-slate-900">{group.label}</h3>
                        <div className="grid grid-cols-4 gap-x-2 gap-y-3 sm:grid-cols-5">
                          {group.types.map(item => {
                            const tone = toneClasses[item.tone]
                            const Icon = item.icon
                            return (
                              <button key={item.type} type="button" onClick={() => { setSelectedType(item.type); ensureDraft(item.type) }} className="group flex min-h-[76px] flex-col items-center justify-center rounded-lg px-1.5 py-2 text-center transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
                                <span className={`flex h-10 w-10 items-center justify-center rounded-lg ${tone.soft} transition-colors group-hover:ring-1 group-hover:ring-slate-200`}><Icon size={20} className={tone.icon} /></span>
                                <span className="mt-1.5 text-xs font-medium text-slate-700 sm:text-sm">{item.label}</span>
                              </button>
                            )
                          })}
                        </div>
                      </section>
                    ))}
                  </div>
                </div>
              </div>
            )}
        </AdaptiveDialog>
      ) : null}

      {savedRecord ? (
        <div className="fixed inset-x-3 top-4 z-[100] mx-auto max-w-xl rounded-xl bg-slate-950 px-4 py-3 text-white shadow-2xl" role="status" aria-live="polite">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-500/20 text-emerald-300"><Check size={19} /></div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">已记录：{savedRecord.summary}</p>
              {toastError ? <p className="mt-0.5 text-xs text-red-300">{toastError}</p> : <p className="mt-0.5 text-xs text-slate-300">数据已经保存</p>}
            </div>
            <button type="button" disabled={undoing} onClick={() => void handleUndo()} className="min-h-10 rounded-lg px-2 text-sm font-medium text-slate-200 hover:bg-white/10 hover:text-white disabled:opacity-50">{undoing ? '撤销中' : '撤销'}</button>
            <button type="button" onClick={() => openComposer()} className="flex min-h-10 items-center gap-1 rounded-lg bg-white/10 px-2.5 text-sm font-medium text-white hover:bg-white/15">继续记录<ChevronRight size={15} /></button>
          </div>
        </div>
      ) : null}
    </RecordComposerContext.Provider>
  )
}
