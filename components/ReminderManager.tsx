'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import {
  Bell,
  Plus,
  Trash2,
  ArrowLeft,
  RefreshCw,
  ScrollText,
  X,
  ChevronDown,
  ChevronUp,
  MoreVertical,
  Edit2,
} from 'lucide-react'

// ─── Types ───────────────────────────────────────────────────────────────────

type TriggerType = 'interval' | 'cron' | 'event_window' | 'health_interval'

interface ReminderRule {
  id: string
  babyId: string
  babyName: string
  name: string
  enabled: boolean
  triggerType: TriggerType
  triggerConfig: Record<string, unknown>
  activeSchedule: { windows: Array<{ start: string; end: string }> } | null
  notifyTitle: string
  notifyBody: string | null
  lastFiredAt: string | null
  createdAt: string
}

interface ReminderLogEntry {
  id: string
  timestamp: number
  status: 'success' | 'failed' | 'pending'
  summary: string
  groupLabel: string
}

interface BabyOption {
  id: string
  name: string
}

interface Props {
  onBack: () => void
}

// ─── Constants ──────────────────────────────────────────────────────────────

const FEEDING_TYPES = [
  { value: 'BREAST_MILK', label: '母乳亲喂' },
  { value: 'BREAST_MILK_BOTTLE', label: '母乳瓶喂' },
  { value: 'FORMULA', label: '配方奶' },
  { value: 'SOLID_FOOD', label: '辅食' },
]

const HEALTH_TYPES = [
  { value: 'WEIGHT', label: '体重' },
  { value: 'HEIGHT', label: '身高' },
  { value: 'TEMPERATURE', label: '体温' },
  { value: 'DIAPER', label: '换尿布' },
  { value: 'SLEEP', label: '睡眠' },
]

// ─── Helper Functions ───────────────────────────────────────────────────────

function getTypeIcon(type: TriggerType, triggerConfig?: Record<string, unknown>): string {
  switch (type) {
    case 'interval':
      // Distinguish feeding interval (🍼) from health interval (🩺)
      if (triggerConfig?.sourceType === 'health') return '🩺'
      return '🍼'
    case 'cron': return '⏰'
    case 'event_window': return '💉'
    case 'health_interval': return '🩺'
  }
}

function getTypeLabel(type: TriggerType): string {
  switch (type) {
    case 'interval': return '喂养超时提醒'
    case 'cron': return '每日定时提醒'
    case 'event_window': return '疫苗后监测提醒'
    case 'health_interval': return '健康定期提醒'
  }
}

function getRuleSummary(rule: ReminderRule): string {
  const parts: string[] = [rule.babyName]

  if (rule.triggerType === 'interval') {
    const config = rule.triggerConfig as { intervalMinutes?: number; sourceType?: string; filterCondition?: { type?: string[] } }
    const mins = config.intervalMinutes || 0
    if (config.sourceType === 'health') {
      const days = Math.floor(mins / (24 * 60))
      const hours = Math.round((mins % (24 * 60)) / 60)
      if (days > 0 && hours > 0) {
        parts.push(`每${days}天${hours}小时`)
      } else if (days > 0) {
        parts.push(`每${days}天`)
      } else {
        parts.push(`每${hours}小时`)
      }
      // Show health types
      if (config.filterCondition?.type?.length) {
        const labels = config.filterCondition.type
          .map(t => HEALTH_TYPES.find(ht => ht.value === t)?.label)
          .filter(Boolean)
        if (labels.length) parts.push(labels.join('/'))
      }
    } else {
      const h = Math.floor(mins / 60)
      const m = mins % 60
      parts.push(`超过${h > 0 ? h + '小时' : ''}${m > 0 ? m + '分钟' : ''}`)
      // Show feeding types
      if (config.filterCondition?.type?.length) {
        const labels = config.filterCondition.type
          .map(t => FEEDING_TYPES.find(ft => ft.value === t)?.label)
          .filter(Boolean)
        if (labels.length) parts.push(labels.join('/'))
      }
    }
  } else if (rule.triggerType === 'cron') {
    const config = rule.triggerConfig as { cronExpr?: string }
    if (config.cronExpr) {
      const [min, hour] = config.cronExpr.split(' ')
      parts.push(`每天 ${hour}:${min.padStart(2, '0')}`)
    }
  } else if (rule.triggerType === 'event_window') {
    const config = rule.triggerConfig as { windowHours?: number; repeatIntervalMinutes?: number }
    const days = Math.round((config.windowHours || 0) / 24)
    const repeatH = Math.round((config.repeatIntervalMinutes || 0) / 60)
    parts.push(`${days}天内每${repeatH}小时`)
  }

  if (rule.activeSchedule?.windows?.[0]) {
    const w = rule.activeSchedule.windows[0]
    parts.push(`${w.start}-${w.end}`)
  }

  return parts.join(' · ')
}

function isExpiredEventWindow(rule: ReminderRule): boolean {
  if (rule.triggerType !== 'event_window') return false
  const config = rule.triggerConfig as { anchorTime?: string; windowHours?: number }
  if (!config.anchorTime || !config.windowHours) return false
  const windowEnd = new Date(config.anchorTime).getTime() + config.windowHours * 3600000
  return Date.now() > windowEnd
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function ReminderManager({ onBack }: Props) {
  // ─── State ──────────────────────────────────────────────────────────────
  const [rules, setRules] = useState<ReminderRule[]>([])
  const [logs, setLogs] = useState<ReminderLogEntry[]>([])
  const [logsTotal, setLogsTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [logsLoading, setLogsLoading] = useState(false)
  const [babies, setBabies] = useState<BabyOption[]>([])

  // Modal state
  const [showModal, setShowModal] = useState(false)
  const [modalStep, setModalStep] = useState<'type' | 'form'>('type')
  const [saving, setSaving] = useState(false)
  const [editingRule, setEditingRule] = useState<ReminderRule | null>(null)

  // Kebab menu
  const [menuOpen, setMenuOpen] = useState<string | null>(null)

  // Expired section
  const [expiredExpanded, setExpiredExpanded] = useState(false)

  // Form state
  const [formType, setFormType] = useState<TriggerType>('interval')
  const [formBabyId, setFormBabyId] = useState('')

  // Interval form
  const [intervalHours, setIntervalHours] = useState(3)
  const [intervalMinutes, setIntervalMinutes] = useState(0)
  const [feedingTypes, setFeedingTypes] = useState<string[]>(['BREAST_MILK', 'BREAST_MILK_BOTTLE', 'FORMULA'])
  const [scheduleStart, setScheduleStart] = useState('06:00')
  const [scheduleEnd, setScheduleEnd] = useState('23:00')

  // Cron form
  const [cronHour, setCronHour] = useState(11)
  const [cronMinute, setCronMinute] = useState(0)
  const [cronContent, setCronContent] = useState('')

  // Event window form
  const [anchorDate, setAnchorDate] = useState('')
  const [anchorTime, setAnchorTime] = useState('14:00')
  const [windowDays, setWindowDays] = useState(3)
  const [repeatHours, setRepeatHours] = useState(5)
  const [ewScheduleStart, setEwScheduleStart] = useState('09:00')
  const [ewScheduleEnd, setEwScheduleEnd] = useState('22:00')
  const [vaccineNote, setVaccineNote] = useState('')

  // Health interval form
  const [healthTypes, setHealthTypes] = useState<string[]>(['WEIGHT', 'HEIGHT'])
  const [healthDays, setHealthDays] = useState(14)
  const [healthHours, setHealthHours] = useState(0)
  const [healthContent, setHealthContent] = useState('')

  // Auto-vaccine config
  const [autoVaccineEnabled, setAutoVaccineEnabled] = useState(false)
  const [autoWindowDays, setAutoWindowDays] = useState(3)
  const [autoRepeatHours, setAutoRepeatHours] = useState(5)
  const [autoScheduleStart, setAutoScheduleStart] = useState('09:00')
  const [autoScheduleEnd, setAutoScheduleEnd] = useState('22:00')
  const [configLoading, setConfigLoading] = useState(false)
  const [configExpanded, setConfigExpanded] = useState(false)

  const refreshTimer = useRef<ReturnType<typeof setInterval> | null>(null)

  // ─── Data Fetching ──────────────────────────────────────────────────────

  const fetchRules = useCallback(async () => {
    try {
      const res = await fetch('/api/reminders')
      if (res.ok) setRules(await res.json())
    } catch { /* silent */ } finally { setLoading(false) }
  }, [])

  const fetchLogs = useCallback(async () => {
    setLogsLoading(true)
    try {
      const res = await fetch('/api/reminders/logs?limit=30')
      if (res.ok) {
        const data = await res.json()
        setLogs(data.logs)
        setLogsTotal(data.total)
      }
    } catch { /* silent */ } finally { setLogsLoading(false) }
  }, [])

  const fetchBabies = useCallback(async () => {
    try {
      const [babiesRes, profileRes] = await Promise.all([
        fetch('/api/babies'),
        fetch('/api/user/profile'),
      ])
      if (babiesRes.ok) {
        const data = await babiesRes.json()
        setBabies(data.map((b: { id: string; name: string }) => ({ id: b.id, name: b.name })))

        // Use activeBabyId from profile, fallback to first baby
        let defaultId = data.length > 0 ? data[0].id : ''
        if (profileRes.ok) {
          const profile = await profileRes.json()
          if (profile.activeBabyId && data.some((b: { id: string }) => b.id === profile.activeBabyId)) {
            defaultId = profile.activeBabyId
          }
        }
        if (!formBabyId) setFormBabyId(defaultId)
      }
    } catch { /* silent */ }
  }, [formBabyId])

  const fetchConfig = useCallback(async () => {
    try {
      const res = await fetch('/api/reminders/config')
      if (res.ok) {
        const data = await res.json()
        setAutoVaccineEnabled(data.autoVaccineReminder ?? false)
        const d = data.vaccineReminderDefaults || {}
        setAutoWindowDays(d.windowDays ?? 3)
        setAutoRepeatHours(d.repeatHours ?? 5)
        setAutoScheduleStart(d.scheduleStart ?? '09:00')
        setAutoScheduleEnd(d.scheduleEnd ?? '22:00')
      }
    } catch { /* silent */ }
  }, [])

  useEffect(() => {
    fetchRules()
    fetchLogs()
    fetchBabies()
    fetchConfig()
  }, [fetchRules, fetchLogs, fetchBabies, fetchConfig])

  useEffect(() => {
    refreshTimer.current = setInterval(fetchLogs, 30000)
    return () => { if (refreshTimer.current) clearInterval(refreshTimer.current) }
  }, [fetchLogs])

  // ─── Actions ────────────────────────────────────────────────────────────

  const saveAutoConfig = async (enabled: boolean) => {
    setConfigLoading(true)
    setAutoVaccineEnabled(enabled)
    try {
      await fetch('/api/reminders/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          autoVaccineReminder: enabled,
          vaccineReminderDefaults: {
            windowDays: autoWindowDays,
            repeatHours: autoRepeatHours,
            scheduleStart: autoScheduleStart,
            scheduleEnd: autoScheduleEnd,
          },
        }),
      })
    } catch { /* silent */ }
    finally { setConfigLoading(false) }
  }

  const saveAutoDefaults = async () => {
    setConfigLoading(true)
    try {
      await fetch('/api/reminders/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          autoVaccineReminder: autoVaccineEnabled,
          vaccineReminderDefaults: {
            windowDays: autoWindowDays,
            repeatHours: autoRepeatHours,
            scheduleStart: autoScheduleStart,
            scheduleEnd: autoScheduleEnd,
          },
        }),
      })
    } catch { /* silent */ }
    finally { setConfigLoading(false) }
  }

  const openCreateModal = () => {
    setEditingRule(null)
    setModalStep('type')
    setShowModal(true)
    // Set defaults
    if (babies.length > 0) setFormBabyId(babies[0].id)
    // Reset today as anchor date default
    const now = new Date(Date.now() + 8 * 60 * 60 * 1000)
    setAnchorDate(now.toISOString().slice(0, 10))
    setHealthContent('')
  }

  const handleTypeSelect = (type: TriggerType) => {
    setFormType(type)
    setModalStep('form')
  }

  const handleCreate = async () => {
    if (!formBabyId) return

    setSaving(true)
    try {
      let body: Record<string, unknown> = { babyId: formBabyId }

      if (formType === 'interval') {
        const totalMinutes = intervalHours * 60 + intervalMinutes
        body = {
          ...body,
          name: '喂养超时提醒',
          triggerType: 'interval',
          triggerConfig: {
            sourceType: 'feeding',
            intervalMinutes: totalMinutes,
            filterCondition: feedingTypes.length > 0 ? { type: feedingTypes } : undefined,
          },
          activeSchedule: { windows: [{ start: scheduleStart, end: scheduleEnd }] },
          advanceMinutes: 0,
          notifyTitle: '该给{{babyName}}喂奶了',
          notifyBody: '距离上次喂养已经{{elapsed}}',
        }
      } else if (formType === 'cron') {
        body = {
          ...body,
          name: cronContent || '每日定时提醒',
          triggerType: 'cron',
          triggerConfig: { cronExpr: `${cronMinute} ${cronHour} * * *` },
          activeSchedule: null,
          advanceMinutes: 0,
          notifyTitle: cronContent || '每日定时提醒',
          notifyBody: null,
        }
      } else if (formType === 'event_window') {
        const anchorISO = `${anchorDate}T${anchorTime}:00+08:00`
        const noteName = vaccineNote.trim() ? `疫苗后测体温 · ${vaccineNote.trim()}` : '疫苗后测体温'
        const noteBody = vaccineNote.trim()
          ? `疫苗接种后体温监测 · ${vaccineNote.trim()}`
          : '疫苗接种后体温监测提醒'
        body = {
          ...body,
          name: noteName,
          triggerType: 'event_window',
          triggerConfig: {
            anchorTime: anchorISO,
            windowHours: windowDays * 24,
            repeatIntervalMinutes: repeatHours * 60,
          },
          activeSchedule: { windows: [{ start: ewScheduleStart, end: ewScheduleEnd }] },
          advanceMinutes: 0,
          notifyTitle: '该给{{babyName}}测体温了',
          notifyBody: noteBody,
        }
      } else if (formType === 'health_interval') {
        const totalMinutes = healthDays * 24 * 60 + healthHours * 60
        const healthLabels = healthTypes
          .map(t => HEALTH_TYPES.find(ht => ht.value === t)?.label)
          .filter(Boolean)
        const itemsText = healthLabels.length > 0 ? healthLabels.join('、') : '健康指标'
        const baseBody = `定期提醒：${itemsText}`
        const userNote = healthContent.trim()
        body = {
          ...body,
          name: '健康定期提醒',
          triggerType: 'interval',
          triggerConfig: {
            sourceType: 'health',
            intervalMinutes: totalMinutes,
            filterCondition: healthTypes.length > 0 ? { type: healthTypes } : undefined,
          },
          activeSchedule: null,
          advanceMinutes: 0,
          notifyTitle: `该关注一下{{babyName}}的${itemsText}了`,
          notifyBody: userNote ? `${baseBody}\n${userNote}` : baseBody,
        }
      }

      let res: Response
      if (editingRule) {
        // Edit mode: PUT
        res = await fetch(`/api/reminders/${editingRule.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
      } else {
        // Create mode: POST
        res = await fetch('/api/reminders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
      }

      if (res.ok) {
        setShowModal(false)
        setEditingRule(null)
        fetchRules()
      } else {
        const data = await res.json()
        alert(data.error || (editingRule ? '更新失败' : '创建失败'))
      }
    } catch {
      alert(editingRule ? '更新失败，请重试' : '创建失败，请重试')
    } finally {
      setSaving(false)
    }
  }

  const handleToggle = async (ruleId: string, enabled: boolean) => {
    // Optimistic update
    setRules(prev => prev.map(r => r.id === ruleId ? { ...r, enabled } : r))
    try {
      const res = await fetch(`/api/reminders/${ruleId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled }),
      })
      if (!res.ok) {
        setRules(prev => prev.map(r => r.id === ruleId ? { ...r, enabled: !enabled } : r))
      }
    } catch {
      setRules(prev => prev.map(r => r.id === ruleId ? { ...r, enabled: !enabled } : r))
    }
  }

  const handleDelete = async (ruleId: string) => {
    if (!confirm('确定要删除此提醒规则吗？')) return
    try {
      const res = await fetch(`/api/reminders/${ruleId}`, { method: 'DELETE' })
      if (res.ok) setRules(prev => prev.filter(r => r.id !== ruleId))
    } catch { alert('删除失败') }
  }

  const handleEdit = (rule: ReminderRule) => {
    setMenuOpen(null)
    setEditingRule(rule)

    // Determine effective form type
    const config = rule.triggerConfig as Record<string, unknown>
    if (rule.triggerType === 'interval' && config.sourceType === 'health') {
      setFormType('health_interval')
    } else {
      setFormType(rule.triggerType)
    }

    setFormBabyId(rule.babyId)

    // Pre-fill based on type
    if (rule.triggerType === 'interval') {
      const mins = (config.intervalMinutes as number) || 0
      if (config.sourceType === 'health') {
        setHealthDays(Math.floor(mins / (24 * 60)))
        setHealthHours(Math.round((mins % (24 * 60)) / 60))
        const filter = config.filterCondition as { type?: string[] } | undefined
        setHealthTypes(filter?.type || ['WEIGHT', 'HEIGHT'])
        // Backfill custom health content
        const body = rule.notifyBody || ''
        const newlineIdx = body.indexOf('\n')
        setHealthContent(newlineIdx >= 0 ? body.slice(newlineIdx + 1) : '')
      } else {
        setIntervalHours(Math.floor(mins / 60))
        setIntervalMinutes(mins % 60)
        const filter = config.filterCondition as { type?: string[] } | undefined
        setFeedingTypes(filter?.type || ['BREAST_MILK', 'BREAST_MILK_BOTTLE', 'FORMULA'])
        // Pre-fill active schedule
        if (rule.activeSchedule?.windows?.[0]) {
          setScheduleStart(rule.activeSchedule.windows[0].start)
          setScheduleEnd(rule.activeSchedule.windows[0].end)
        }
      }
    } else if (rule.triggerType === 'cron') {
      const cronExpr = (config.cronExpr as string) || '0 11 * * *'
      const [min, hour] = cronExpr.split(' ')
      setCronHour(parseInt(hour) || 11)
      setCronMinute(parseInt(min) || 0)
      setCronContent(rule.name === '每日定时提醒' ? '' : rule.name)
    } else if (rule.triggerType === 'event_window') {
      const anchorISO = (config.anchorTime as string) || ''
      if (anchorISO) {
        const d = new Date(anchorISO)
        const beijing = new Date(d.getTime() + 8 * 60 * 60 * 1000)
        setAnchorDate(beijing.toISOString().slice(0, 10))
        setAnchorTime(beijing.toISOString().slice(11, 16))
      }
      setWindowDays(Math.round(((config.windowHours as number) || 72) / 24))
      setRepeatHours(Math.round(((config.repeatIntervalMinutes as number) || 300) / 60))
      // Extract vaccine note from rule name
      const noteMatch = rule.name.match(/疫苗后测体温 · (.+)/)
      setVaccineNote(noteMatch ? noteMatch[1] : '')
      // Active schedule
      if (rule.activeSchedule?.windows?.[0]) {
        setEwScheduleStart(rule.activeSchedule.windows[0].start)
        setEwScheduleEnd(rule.activeSchedule.windows[0].end)
      }
    }

    setModalStep('form')
    setShowModal(true)
  }

  const handleClearLogs = async () => {
    if (!confirm('确定要清理所有执行日志吗？')) return
    try {
      const res = await fetch('/api/reminders/logs', { method: 'DELETE' })
      if (res.ok) { setLogs([]); setLogsTotal(0) }
    } catch { /* silent */ }
  }

  // ─── Loading state ──────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-violet-600" />
      </div>
    )
  }

  // ─── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="max-w-4xl mx-auto px-3 sm:px-4 py-4 space-y-4 sm:space-y-5">
      {/* Header */}
      <div className="flex items-center space-x-3">
        <button onClick={onBack} className="mobile-touch-target rounded-xl p-2 transition hover:bg-gray-100">
          <ArrowLeft size={20} />
        </button>
        <div className="flex items-center space-x-2">
          <Bell size={22} className="text-violet-600" />
          <h1 className="text-xl font-bold text-gray-900">提醒管理</h1>
        </div>
      </div>

      {/* Feature intro */}
      <div className="bg-violet-50 border border-violet-200 rounded-xl p-4">
        <p className="text-sm text-violet-700">
          <span className="font-medium">智能提醒</span>
          {' '}— 到时间后通过 Webhook 向外部发送通知（如微信、Telegram）。使用前请先在
          <button onClick={onBack} className="underline font-medium mx-0.5">设置 → Webhook 管理</button>
          中配置接收端并订阅「提醒」事件。
        </p>
      </div>

      {/* Auto-Vaccine Config Card */}
      <div className="bg-white rounded-2xl p-4 shadow-sm sm:p-5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex-1">
            <p className="font-medium text-gray-900 text-sm">添加疫苗记录时自动创建体温监测提醒</p>
            <p className="text-xs text-gray-400 mt-0.5">开启后，记录疫苗接种将自动添加定期测温提醒</p>
          </div>
          <button
            onClick={() => saveAutoConfig(!autoVaccineEnabled)}
            disabled={configLoading}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors flex-shrink-0 ${autoVaccineEnabled ? 'bg-violet-500' : 'bg-gray-300'}`}
          >
            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${autoVaccineEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
          </button>
        </div>

        {autoVaccineEnabled && (
          <div className="mt-3 pt-2 border-t border-gray-100">
            <button
              type="button"
              onClick={() => setConfigExpanded(!configExpanded)}
              className="w-full flex items-center justify-between text-xs text-gray-500 hover:text-gray-700 py-1"
            >
              <span>{autoWindowDays}天 · 每{autoRepeatHours}小时 · {autoScheduleStart}-{autoScheduleEnd}</span>
              {configExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>

            {configExpanded && (
              <div className="mt-2 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">监测天数</label>
                    <div className="flex items-center gap-1">
                      <input
                        type="number" min={1} max={7} value={autoWindowDays}
                        onChange={e => setAutoWindowDays(Math.max(1, Math.min(7, parseInt(e.target.value) || 3)))}
                        onBlur={saveAutoDefaults}
                        className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-sm text-center focus:ring-2 focus:ring-violet-500 focus:border-transparent outline-none"
                      />
                      <span className="text-xs text-gray-400">天</span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">提醒频率</label>
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-gray-400">每</span>
                      <input
                        type="number" min={1} max={24} value={autoRepeatHours}
                        onChange={e => setAutoRepeatHours(Math.max(1, Math.min(24, parseInt(e.target.value) || 5)))}
                        onBlur={saveAutoDefaults}
                        className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-sm text-center focus:ring-2 focus:ring-violet-500 focus:border-transparent outline-none"
                      />
                      <span className="text-xs text-gray-400">小时</span>
                    </div>
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">活跃时段</label>
                  <div className="flex items-center gap-2">
                    <input type="time" value={autoScheduleStart}
                      onChange={e => setAutoScheduleStart(e.target.value)} onBlur={saveAutoDefaults}
                      className="flex-1 px-2 py-1.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-violet-500 focus:border-transparent outline-none" />
                    <span className="text-xs text-gray-400">—</span>
                    <input type="time" value={autoScheduleEnd}
                      onChange={e => setAutoScheduleEnd(e.target.value)} onBlur={saveAutoDefaults}
                      className="flex-1 px-2 py-1.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-violet-500 focus:border-transparent outline-none" />
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Rule List */}
      <div className="bg-white rounded-2xl p-4 shadow-sm sm:p-5">
        <div className="flex items-center justify-between gap-3 mb-4">
          <h2 className="text-lg font-bold text-gray-900">
            我的提醒
            <span className="text-sm font-normal text-gray-400 ml-2">({rules.length})</span>
          </h2>
          <button
            onClick={openCreateModal}
            className="mobile-touch-target inline-flex items-center rounded-xl px-2 py-2 text-violet-600 transition hover:text-violet-700"
          >
            <Plus size={20} className="mr-1" />
            创建
          </button>
        </div>

        {rules.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <Bell size={48} className="mx-auto mb-2 text-gray-300" />
            <p>还没有创建提醒规则</p>
            <p className="text-sm mt-1 text-gray-400">创建一个来自动监测宝宝状态</p>
          </div>
        ) : (
          <>
            {/* Active rules */}
            <div className="space-y-3">
              {rules.filter(r => !isExpiredEventWindow(r)).map(rule => (
                <div
                  key={rule.id}
                  className={`rounded-xl border p-4 transition ${rule.enabled ? 'border-gray-100 bg-gray-50' : 'border-gray-100 bg-gray-50/50 opacity-60'}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{getTypeIcon(rule.triggerType, rule.triggerConfig)}</span>
                        <p className="font-medium text-gray-900 truncate">
                          {rule.name || getTypeLabel(rule.triggerType)}
                        </p>
                      </div>
                      <p className="text-sm text-gray-500 mt-1">{getRuleSummary(rule)}</p>
                      {rule.lastFiredAt && (
                        <p className="text-xs text-gray-400 mt-1 flex items-center gap-1">
                          上次触发: {formatDistanceToNow(new Date(rule.lastFiredAt), { locale: zhCN, addSuffix: true })}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {/* Toggle switch */}
                      <button
                        onClick={() => handleToggle(rule.id, !rule.enabled)}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${rule.enabled ? 'bg-violet-500' : 'bg-gray-300'}`}
                      >
                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${rule.enabled ? 'translate-x-6' : 'translate-x-1'}`} />
                      </button>
                      {/* Kebab menu */}
                      <div className="relative">
                        <button
                          onClick={() => setMenuOpen(menuOpen === rule.id ? null : rule.id)}
                          className="mobile-touch-target rounded-xl p-2 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
                        >
                          <MoreVertical size={16} />
                        </button>
                        {menuOpen === rule.id && (
                          <div className="absolute right-0 top-full mt-1 z-20 bg-white rounded-xl shadow-lg border border-gray-100 py-1 min-w-[100px]">
                            <button
                              onClick={() => handleEdit(rule)}
                              className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition"
                            >
                              <Edit2 size={14} />
                              编辑
                            </button>
                            <button
                              onClick={() => { setMenuOpen(null); handleDelete(rule.id) }}
                              className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition"
                            >
                              <Trash2 size={14} />
                              删除
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Expired rules section */}
            {rules.filter(r => isExpiredEventWindow(r)).length > 0 && (
              <div className="mt-4 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setExpiredExpanded(!expiredExpanded)}
                  className="flex items-center gap-2 text-sm text-gray-400 hover:text-gray-600 transition"
                >
                  {expiredExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  已过期 ({rules.filter(r => isExpiredEventWindow(r)).length})
                </button>
                {expiredExpanded && (
                  <div className="mt-2 space-y-2">
                    {rules.filter(r => isExpiredEventWindow(r)).map(rule => (
                      <div
                        key={rule.id}
                        className="rounded-xl border border-gray-100 bg-gray-50/50 p-4 opacity-60"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-lg">{getTypeIcon(rule.triggerType, rule.triggerConfig)}</span>
                              <p className="font-medium text-gray-900 truncate">
                                {rule.name || getTypeLabel(rule.triggerType)}
                              </p>
                              <span className="text-xs bg-gray-200 text-gray-500 px-1.5 py-0.5 rounded-full flex-shrink-0">已过期</span>
                            </div>
                            <p className="text-sm text-gray-500 mt-1">{getRuleSummary(rule)}</p>
                          </div>
                          <div className="relative flex-shrink-0">
                            <button
                              onClick={() => setMenuOpen(menuOpen === rule.id ? null : rule.id)}
                              className="mobile-touch-target rounded-xl p-2 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
                            >
                              <MoreVertical size={16} />
                            </button>
                            {menuOpen === rule.id && (
                              <div className="absolute right-0 top-full mt-1 z-20 bg-white rounded-xl shadow-lg border border-gray-100 py-1 min-w-[100px]">
                                <button
                                  onClick={() => { setMenuOpen(null); handleDelete(rule.id) }}
                                  className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition"
                                >
                                  <Trash2 size={14} />
                                  删除
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Execution Logs */}
      <div className="bg-white rounded-2xl p-4 shadow-sm sm:p-5">
        <div className="flex items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-gray-900">执行日志</h2>
            {logsTotal > 0 && (
              <span className="text-xs font-medium text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">{logsTotal}</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={fetchLogs} disabled={logsLoading} className="mobile-touch-target rounded-xl p-2 text-gray-400 transition hover:bg-gray-100 disabled:opacity-50">
              <RefreshCw size={16} className={logsLoading ? 'animate-spin' : ''} />
            </button>
            {logsTotal > 0 && (
              <button onClick={handleClearLogs} className="mobile-touch-target inline-flex items-center rounded-xl px-2 py-2 text-red-500 transition hover:bg-red-50">
                <Trash2 size={16} className="mr-1" />
                <span className="text-sm">清理</span>
              </button>
            )}
          </div>
        </div>

        {logs.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <ScrollText size={48} className="mx-auto mb-2 text-gray-300" />
            <p>暂无执行记录</p>
            <p className="text-sm mt-1 text-gray-400">提醒触发后将在此显示（保留 72 小时）</p>
          </div>
        ) : (
          <div className="space-y-1.5 max-h-[300px] overflow-y-auto">
            {logs.map(log => (
              <div key={log.id} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-50 text-sm">
                <span className={`flex-shrink-0 w-2 h-2 rounded-full ${log.status === 'success' ? 'bg-green-400' : log.status === 'failed' ? 'bg-red-400' : 'bg-yellow-400'}`} />
                <span className="flex-1 min-w-0 truncate text-gray-700">{log.summary}</span>
                <span className="flex-shrink-0 text-xs text-gray-400 tabular-nums">
                  {formatDistanceToNow(new Date(log.timestamp), { locale: zhCN, addSuffix: true })}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Click outside to close kebab menu */}
      {menuOpen && (
        <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(null)} />
      )}

      {/* ═══ Create/Edit Modal ═══ */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-md max-h-[85vh] overflow-y-auto shadow-xl">
            {/* Modal header */}
            <div className="flex items-center justify-between p-5 pb-3 sticky top-0 bg-white rounded-t-2xl border-b border-gray-100">
              <h3 className="text-lg font-bold text-gray-900">
                {editingRule
                  ? getTypeIcon(formType) + ' 编辑提醒'
                  : modalStep === 'type' ? '创建提醒' : getTypeIcon(formType) + ' ' + getTypeLabel(formType)}
              </h3>
              <button onClick={() => { setShowModal(false); setEditingRule(null) }} className="p-2 hover:bg-gray-100 rounded-lg transition">
                <X size={20} />
              </button>
            </div>

            <div className="p-5">
              {/* Step 1: Type selection (only in create mode) */}
              {modalStep === 'type' && !editingRule && (
                <div className="space-y-3">
                  <button
                    onClick={() => handleTypeSelect('interval')}
                    className="w-full text-left rounded-xl border-2 border-gray-100 p-4 transition hover:border-violet-300 hover:bg-violet-50/50"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">🍼</span>
                      <div>
                        <p className="font-medium text-gray-900">喂养超时提醒</p>
                        <p className="text-sm text-gray-500">超过设定时间没有喂养记录时提醒</p>
                      </div>
                    </div>
                  </button>

                  <button
                    onClick={() => handleTypeSelect('cron')}
                    className="w-full text-left rounded-xl border-2 border-gray-100 p-4 transition hover:border-violet-300 hover:bg-violet-50/50"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">⏰</span>
                      <div>
                        <p className="font-medium text-gray-900">每日定时提醒</p>
                        <p className="text-sm text-gray-500">每天固定时间提醒（如吃AD、吃药）</p>
                      </div>
                    </div>
                  </button>

                  <button
                    onClick={() => handleTypeSelect('event_window')}
                    className="w-full text-left rounded-xl border-2 border-gray-100 p-4 transition hover:border-violet-300 hover:bg-violet-50/50"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">💉</span>
                      <div>
                        <p className="font-medium text-gray-900">疫苗后监测提醒</p>
                        <p className="text-sm text-gray-500">接种疫苗后定期提醒测量体温</p>
                      </div>
                    </div>
                  </button>

                  <button
                    onClick={() => handleTypeSelect('health_interval')}
                    className="w-full text-left rounded-xl border-2 border-gray-100 p-4 transition hover:border-violet-300 hover:bg-violet-50/50"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">🩺</span>
                      <div>
                        <p className="font-medium text-gray-900">健康定期提醒</p>
                        <p className="text-sm text-gray-500">每隔一段时间提醒检测身高体重等</p>
                      </div>
                    </div>
                  </button>
                </div>
              )}

              {/* Step 2: Form per type */}
              {modalStep === 'form' && (
                <div className="space-y-5">
                  {/* Back to type selection (only in create mode) */}
                  {!editingRule && (
                    <button
                      onClick={() => setModalStep('type')}
                      className="text-sm text-violet-600 hover:text-violet-700 flex items-center gap-1"
                    >
                      <ArrowLeft size={14} /> 重新选择类型
                    </button>
                  )}

                  {/* Baby selector (common) */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">宝宝</label>
                    <select
                      value={formBabyId}
                      onChange={e => setFormBabyId(e.target.value)}
                      className="w-full px-3 py-2.5 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-violet-500 focus:border-transparent outline-none"
                    >
                      {babies.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                    </select>
                  </div>

                  {/* ── Interval Form ── */}
                  {formType === 'interval' && (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">喂养类型</label>
                        <div className="flex flex-wrap gap-2">
                          {FEEDING_TYPES.map(ft => (
                            <button
                              key={ft.value}
                              type="button"
                              onClick={() => {
                                setFeedingTypes(prev =>
                                  prev.includes(ft.value)
                                    ? prev.filter(v => v !== ft.value)
                                    : [...prev, ft.value]
                                )
                              }}
                              className={`px-3 py-1.5 rounded-full text-sm border transition ${
                                feedingTypes.includes(ft.value)
                                  ? 'bg-violet-100 border-violet-300 text-violet-700'
                                  : 'bg-white border-gray-200 text-gray-600 hover:border-violet-200'
                              }`}
                            >
                              {ft.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">超时时长</label>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min={0}
                            max={24}
                            value={intervalHours}
                            onChange={e => setIntervalHours(Math.max(0, parseInt(e.target.value) || 0))}
                            className="w-20 px-3 py-2.5 border border-gray-300 rounded-lg text-center focus:ring-2 focus:ring-violet-500 focus:border-transparent outline-none"
                          />
                          <span className="text-sm text-gray-500">小时</span>
                          <input
                            type="number"
                            min={0}
                            max={59}
                            value={intervalMinutes}
                            onChange={e => setIntervalMinutes(Math.max(0, Math.min(59, parseInt(e.target.value) || 0)))}
                            className="w-20 px-3 py-2.5 border border-gray-300 rounded-lg text-center focus:ring-2 focus:ring-violet-500 focus:border-transparent outline-none"
                          />
                          <span className="text-sm text-gray-500">分钟</span>
                        </div>
                        <p className="text-xs text-gray-400 mt-1">距上次喂养超过此时间后触发提醒</p>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">活跃时段</label>
                        <div className="flex items-center gap-2">
                          <input
                            type="time"
                            value={scheduleStart}
                            onChange={e => setScheduleStart(e.target.value)}
                            className="flex-1 px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-transparent outline-none"
                          />
                          <span className="text-gray-400">—</span>
                          <input
                            type="time"
                            value={scheduleEnd}
                            onChange={e => setScheduleEnd(e.target.value)}
                            className="flex-1 px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-transparent outline-none"
                          />
                        </div>
                        <p className="text-xs text-gray-400 mt-1">此时段外不会提醒（如夜间睡眠时）</p>
                      </div>
                    </>
                  )}

                  {/* ── Cron Form ── */}
                  {formType === 'cron' && (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">提醒时间</label>
                        <div className="flex items-center gap-2">
                          <input
                            type="time"
                            value={`${String(cronHour).padStart(2, '0')}:${String(cronMinute).padStart(2, '0')}`}
                            onChange={e => {
                              const [h, m] = e.target.value.split(':')
                              setCronHour(parseInt(h))
                              setCronMinute(parseInt(m))
                            }}
                            className="flex-1 px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-transparent outline-none"
                          />
                        </div>
                        <p className="text-xs text-gray-400 mt-1">每天此时间触发提醒（北京时间）</p>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">提醒内容</label>
                        <input
                          type="text"
                          value={cronContent}
                          onChange={e => setCronContent(e.target.value)}
                          placeholder="如：该给宝宝吃AD啦"
                          maxLength={100}
                          className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-transparent outline-none"
                        />
                      </div>
                    </>
                  )}

                  {/* ── Event Window Form ── */}
                  {formType === 'event_window' && (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">疫苗信息（可选）</label>
                        <input
                          type="text"
                          value={vaccineNote}
                          onChange={e => setVaccineNote(e.target.value)}
                          placeholder="如：乙肝疫苗 第2针/共3针"
                          maxLength={100}
                          className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-transparent outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">接种时间</label>
                        <div className="flex items-center gap-2">
                          <input
                            type="date"
                            value={anchorDate}
                            onChange={e => setAnchorDate(e.target.value)}
                            className="flex-1 px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-transparent outline-none"
                          />
                          <input
                            type="time"
                            value={anchorTime}
                            onChange={e => setAnchorTime(e.target.value)}
                            className="w-28 px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-transparent outline-none"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1.5">监测天数</label>
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              min={1}
                              max={7}
                              value={windowDays}
                              onChange={e => setWindowDays(Math.max(1, Math.min(7, parseInt(e.target.value) || 1)))}
                              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-center focus:ring-2 focus:ring-violet-500 focus:border-transparent outline-none"
                            />
                            <span className="text-sm text-gray-500">天</span>
                          </div>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1.5">提醒频率</label>
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-gray-500">每</span>
                            <input
                              type="number"
                              min={1}
                              max={24}
                              value={repeatHours}
                              onChange={e => setRepeatHours(Math.max(1, Math.min(24, parseInt(e.target.value) || 1)))}
                              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-center focus:ring-2 focus:ring-violet-500 focus:border-transparent outline-none"
                            />
                            <span className="text-sm text-gray-500">小时</span>
                          </div>
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">活跃时段</label>
                        <div className="flex items-center gap-2">
                          <input
                            type="time"
                            value={ewScheduleStart}
                            onChange={e => setEwScheduleStart(e.target.value)}
                            className="flex-1 px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-transparent outline-none"
                          />
                          <span className="text-gray-400">—</span>
                          <input
                            type="time"
                            value={ewScheduleEnd}
                            onChange={e => setEwScheduleEnd(e.target.value)}
                            className="flex-1 px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-transparent outline-none"
                          />
                        </div>
                        <p className="text-xs text-gray-400 mt-1">此时段外不会提醒</p>
                      </div>
                    </>
                  )}

                  {/* ── Health Interval Form ── */}
                  {formType === 'health_interval' && (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">检测项目</label>
                        <div className="flex flex-wrap gap-2">
                          {HEALTH_TYPES.map(ht => (
                            <button
                              key={ht.value}
                              type="button"
                              onClick={() => {
                                setHealthTypes(prev =>
                                  prev.includes(ht.value)
                                    ? prev.filter(v => v !== ht.value)
                                    : [...prev, ht.value]
                                )
                              }}
                              className={`px-3 py-1.5 rounded-full text-sm border transition ${
                                healthTypes.includes(ht.value)
                                  ? 'bg-violet-100 border-violet-300 text-violet-700'
                                  : 'bg-white border-gray-200 text-gray-600 hover:border-violet-200'
                              }`}
                            >
                              {ht.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">提醒间隔</label>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min={0}
                            max={90}
                            value={healthDays}
                            onChange={e => setHealthDays(Math.max(0, Math.min(90, parseInt(e.target.value) || 0)))}
                            className="w-16 px-2 py-2.5 border border-gray-300 rounded-lg text-center focus:ring-2 focus:ring-violet-500 focus:border-transparent outline-none"
                          />
                          <span className="text-sm text-gray-500">天</span>
                          <input
                            type="number"
                            min={0}
                            max={23}
                            value={healthHours}
                            onChange={e => setHealthHours(Math.max(0, Math.min(23, parseInt(e.target.value) || 0)))}
                            className="w-16 px-2 py-2.5 border border-gray-300 rounded-lg text-center focus:ring-2 focus:ring-violet-500 focus:border-transparent outline-none"
                          />
                          <span className="text-sm text-gray-500">小时</span>
                        </div>
                        <p className="text-xs text-gray-400 mt-1">距上次检测超过此时间后提醒</p>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">提醒内容（可选）</label>
                        <input
                          type="text"
                          value={healthContent}
                          onChange={e => setHealthContent(e.target.value)}
                          placeholder="如：该关注下宝宝的身高、体重了"
                          maxLength={100}
                          className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-transparent outline-none"
                        />
                        <p className="text-xs text-gray-400 mt-1">留空则使用默认提醒文案</p>
                      </div>
                    </>
                  )}

                  {/* Submit */}
                  <button
                    onClick={handleCreate}
                    disabled={saving || !formBabyId || (formType === 'interval' && intervalHours === 0 && intervalMinutes === 0) || (formType === 'health_interval' && healthDays === 0 && healthHours === 0)}
                    className="w-full py-3 px-4 bg-violet-600 hover:bg-violet-700 disabled:bg-violet-400 text-white font-medium rounded-lg transition"
                  >
                    {saving ? (editingRule ? '保存中...' : '创建中...') : (editingRule ? '保存修改' : '创建提醒')}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
