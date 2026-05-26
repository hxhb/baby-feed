'use client'

import { useState, useEffect, useCallback } from 'react'
import { format } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import {
  Webhook,
  Plus,
  Trash2,
  AlertTriangle,
  X,
  ArrowLeft,
  Shield,
  Check,
  MoreVertical,
  Eye,
  Power,
  PowerOff,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Edit2,
} from 'lucide-react'
import { useCopyToast } from '@/components/CopyToast'

interface WebhookEndpointInfo {
  id: string
  url: string
  description: string | null
  events: string[]
  active: boolean
  maxRetries: number
  retryDelay: number
  createdAt: string
  lastTriedAt: string | null
  deliveriesCount: number
  secret?: string
}

interface DeliveryLog {
  id: string
  timestamp: number
  status: string
  summary?: string
  groupKey: string
  groupLabel: string
  meta: {
    eventType: string
    eventId: string
    attemptNumber: number
    httpStatus: number | null
    errorMessage: string | null
    sentAt: string | null
    endpointUrl: string
  }
}

const EVENT_LABELS: Record<string, string> = {
  'feeding.created': '新增喂养',
  'feeding.updated': '更新喂养',
  'feeding.deleted': '删除喂养',
  'health.created': '新增健康',
  'health.updated': '更新健康',
  'health.deleted': '删除健康',
  'memo.created': '新增备忘',
  'memo.updated': '更新备忘',
  'memo.deleted': '删除备忘',
  'reminder.fired': '提醒触发',
  'user.deleted': '删除用户',
  '*': '全部事件',
}

const EVENT_GROUPS = [
  {
    label: '喂养记录',
    events: ['feeding.created', 'feeding.updated', 'feeding.deleted'],
  },
  {
    label: '健康记录',
    events: ['health.created', 'health.updated', 'health.deleted'],
  },
  {
    label: '备忘录',
    events: ['memo.created', 'memo.updated', 'memo.deleted'],
  },
  {
    label: '提醒',
    events: ['reminder.fired'],
  },
]

interface Props {
  onBack: () => void
}

export default function WebhookManager({ onBack }: Props) {
  const [endpoints, setEndpoints] = useState<WebhookEndpointInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showSecretModal, setShowSecretModal] = useState(false)
  const [newUrl, setNewUrl] = useState('')
  const [newDescription, setNewDescription] = useState('')
  const [newEvents, setNewEvents] = useState<string[]>([])
  const [createLoading, setCreateLoading] = useState(false)
  const [newlyCreatedSecret, setNewlyCreatedSecret] = useState('')
  const [deleteLoading, setDeleteLoading] = useState<string | null>(null)
  const [toggleLoading, setToggleLoading] = useState<string | null>(null)
  const [expandedEndpoint, setExpandedEndpoint] = useState<string | null>(null)
  const [deliveryLogs, setDeliveryLogs] = useState<DeliveryLog[]>([])
  const [deliveryLoading, setDeliveryLoading] = useState(false)
  const [menuOpen, setMenuOpen] = useState<string | null>(null)
  const [visibleUrls, setVisibleUrls] = useState<Set<string>>(new Set())
  const [clearingDeliveries, setClearingDeliveries] = useState<string | null>(null)

  // Edit modal state
  const [editingEndpoint, setEditingEndpoint] = useState<WebhookEndpointInfo | null>(null)
  const [editEvents, setEditEvents] = useState<string[]>([])
  const [editLoading, setEditLoading] = useState(false)
  const { copyToClipboard } = useCopyToast()

  const fetchEndpoints = useCallback(async () => {
    try {
      const response = await fetch('/api/webhooks')
      if (response.ok) {
        const data = await response.json()
        setEndpoints(data)
      }
    } catch (error) {
      console.error('获取 Webhook 列表失败:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchEndpoints()
  }, [fetchEndpoints])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newUrl.trim() || newEvents.length === 0) return

    setCreateLoading(true)
    try {
      const response = await fetch('/api/webhooks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: newUrl.trim(),
          description: newDescription.trim() || undefined,
          events: newEvents,
        }),
      })

      if (response.ok) {
        const data = await response.json()
        setNewlyCreatedSecret(data.secret)
        setShowCreateModal(false)
        setShowSecretModal(true)
        setNewUrl('')
        setNewDescription('')
        setNewEvents([])
        fetchEndpoints()
      } else {
        const data = await response.json()
        alert(data.error || '创建失败')
      }
    } catch {
      alert('创建失败，请重试')
    } finally {
      setCreateLoading(false)
    }
  }

  const handleDelete = async (id: string, url: string) => {
    if (!confirm(`确定要删除 Webhook "${url}" 吗？`)) return

    setDeleteLoading(id)
    setMenuOpen(null)
    try {
      const response = await fetch(`/api/webhooks/${id}`, { method: 'DELETE' })
      if (response.ok) {
        setEndpoints(prev => prev.filter(ep => ep.id !== id))
      } else {
        const data = await response.json()
        alert(data.error || '删除失败')
      }
    } catch {
      alert('删除失败')
    } finally {
      setDeleteLoading(null)
    }
  }

  const handleToggleActive = async (id: string, currentActive: boolean) => {
    setToggleLoading(id)
    setMenuOpen(null)
    try {
      const response = await fetch(`/api/webhooks/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: !currentActive }),
      })
      if (response.ok) {
        setEndpoints(prev =>
          prev.map(ep => (ep.id === id ? { ...ep, active: !currentActive } : ep))
        )
      } else {
        const data = await response.json()
        alert(data.error || '操作失败')
      }
    } catch {
      alert('操作失败')
    } finally {
      setToggleLoading(null)
    }
  }

  const handleViewDeliveries = async (endpointId: string) => {
    if (expandedEndpoint === endpointId) {
      setExpandedEndpoint(null)
      return
    }
    setExpandedEndpoint(endpointId)
    setDeliveryLoading(true)
    try {
      const response = await fetch(`/api/webhooks/deliveries?endpointId=${endpointId}&limit=20`)
      if (response.ok) {
        const data = await response.json()
        setDeliveryLogs(data.deliveries)
      }
    } catch (error) {
      console.error('获取投递日志失败:', error)
    } finally {
      setDeliveryLoading(false)
    }
  }

  const handleClearDeliveries = async (endpointId: string) => {
    if (!confirm('确定要清理此 Webhook 的所有投递日志吗？')) return

    setClearingDeliveries(endpointId)
    setMenuOpen(null)
    try {
      const response = await fetch(`/api/webhooks/deliveries?endpointId=${endpointId}`, { method: 'DELETE' })
      if (response.ok) {
        // Refresh delivery logs if this endpoint is expanded
        if (expandedEndpoint === endpointId) {
          setDeliveryLogs([])
        }
        // Update the deliveries count in endpoint list
        setEndpoints(prev =>
          prev.map(ep => (ep.id === endpointId ? { ...ep, deliveriesCount: 0 } : ep))
        )
      } else {
        const data = await response.json()
        alert(data.error || '清理失败')
      }
    } catch {
      alert('清理失败')
    } finally {
      setClearingDeliveries(null)
    }
  }

  const handleEditEvents = (endpoint: WebhookEndpointInfo) => {
    setEditingEndpoint(endpoint)
    setEditEvents(endpoint.events.includes('*') ? ['*'] : [...endpoint.events])
    setMenuOpen(null)
  }

  const handleSaveEvents = async () => {
    if (!editingEndpoint) return
    setEditLoading(true)
    try {
      const response = await fetch(`/api/webhooks/${editingEndpoint.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ events: editEvents }),
      })
      if (response.ok) {
        setEndpoints(prev => prev.map(ep =>
          ep.id === editingEndpoint.id ? { ...ep, events: editEvents } : ep
        ))
        setEditingEndpoint(null)
      } else {
        const data = await response.json()
        alert(data.error || '保存失败')
      }
    } catch {
      alert('保存失败')
    } finally {
      setEditLoading(false)
    }
  }

  const toggleUrlVisibility = (endpointId: string) => {
    setVisibleUrls(prev => {
      const next = new Set(prev)
      if (next.has(endpointId)) {
        next.delete(endpointId)
      } else {
        next.add(endpointId)
      }
      return next
    })
  }

  const toggleEvent = (event: string) => {
    if (event === '*') {
      setNewEvents(newEvents.includes('*') ? [] : ['*'])
    } else {
      const eventsWithoutStar = newEvents.filter(e => e !== '*')
      if (eventsWithoutStar.includes(event)) {
        setNewEvents(eventsWithoutStar.filter(e => e !== event))
      } else {
        setNewEvents([...eventsWithoutStar, event])
      }
    }
  }

  const getStatusDot = (status: string) => {
    switch (status) {
      case 'success':
        return <span className="inline-block w-2 h-2 rounded-full bg-emerald-500" />
      case 'failed':
        return <span className="inline-block w-2 h-2 rounded-full bg-red-500" />
      case 'pending':
        return <span className="inline-block w-2 h-2 rounded-full bg-amber-400" />
      default:
        return <span className="inline-block w-2 h-2 rounded-full bg-slate-300" />
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-brand-100 border-t-brand-500"></div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto px-3 sm:px-4 py-4 space-y-4 sm:space-y-5">
      {/* Header */}
      <div className="flex items-center space-x-3">
        <button
          onClick={onBack}
          className="mobile-touch-target rounded-element p-2 transition hover:bg-slate-100 active:scale-95"
        >
          <ArrowLeft size={20} className="text-slate-600" />
        </button>
        <div className="flex items-center space-x-2 min-w-0">
          <Webhook size={22} className="text-blue-500 flex-shrink-0" />
          <h1 className="text-xl font-bold text-slate-900 truncate">Webhook 管理</h1>
        </div>
      </div>

      {/* Info Card */}
      <div className="bg-white rounded-card p-4 sm:p-5 shadow-card border border-blue-50">
        <div className="flex items-start space-x-3">
          <Shield size={18} className="text-blue-500 mt-0.5 flex-shrink-0" />
          <div className="text-sm text-slate-600">
            <p className="font-semibold text-slate-800 mb-1">实时事件通知</p>
            <p>
              配置 Webhook 后，当记录发生变化时系统会自动向您的 URL 发送 HTTP POST 请求。
              每个请求通过
              <code className="bg-blue-50 px-1.5 py-0.5 rounded text-xs text-blue-700 mx-0.5">X-Webhook-Signature</code>
              头携带 HMAC-SHA256 签名。
            </p>
          </div>
        </div>
      </div>

      {/* Endpoint List */}
      <div className="bg-white rounded-card p-4 shadow-card border border-blue-50 sm:p-5">
        <div className="flex items-center justify-between gap-3 mb-4">
          <h2 className="text-base font-bold text-slate-900">
            我的 Webhook
            <span className="text-sm font-normal text-slate-400 ml-2">({endpoints.length}/10)</span>
          </h2>
          <button
            onClick={() => {
              setNewUrl('')
              setNewDescription('')
              setNewEvents([])
              setShowCreateModal(true)
            }}
            disabled={endpoints.length >= 10}
            className="mobile-touch-target inline-flex items-center gap-1 rounded-button px-3 py-2 text-sm font-medium text-white gradient-primary shadow-elevated transition active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Plus size={16} />
            创建
          </button>
        </div>

        {endpoints.length === 0 ? (
          <div className="text-center py-10 text-slate-400">
            <Webhook size={40} className="mx-auto mb-3 text-slate-200" />
            <p className="font-medium text-slate-500">还没有 Webhook</p>
            <p className="text-sm mt-1">创建一个来接收实时事件通知</p>
          </div>
        ) : (
          <div className="space-y-3">
            {endpoints.map(endpoint => (
              <div key={endpoint.id}>
                <div
                  className={`rounded-element border p-4 transition ${
                    endpoint.active
                      ? 'border-slate-100 bg-slate-50/50'
                      : 'border-amber-100 bg-amber-50/30'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      {/* Name + Status */}
                      <div className="flex items-center gap-2">
                        <span className={`inline-block w-2 h-2 rounded-full flex-shrink-0 ${endpoint.active ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                        <p className="text-sm font-medium text-slate-800 truncate">
                          {endpoint.description || '未命名 Webhook'}
                        </p>
                      </div>

                      {/* URL (hidden by default) */}
                      <div className="mt-1 ml-4">
                        {visibleUrls.has(endpoint.id) ? (
                          <div className="flex items-center gap-1.5">
                            <p className="text-xs text-slate-500 truncate">{endpoint.url}</p>
                            <button
                              type="button"
                              onClick={() => toggleUrlVisibility(endpoint.id)}
                              className="text-[11px] text-blue-500 hover:text-blue-600 font-medium flex-shrink-0"
                            >
                              隐藏
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => toggleUrlVisibility(endpoint.id)}
                            className="text-[11px] text-blue-500 hover:text-blue-600 font-medium"
                          >
                            显示地址
                          </button>
                        )}
                      </div>

                      {/* Event tags */}
                      <div className="flex flex-wrap gap-1 mt-2.5 ml-4">
                        {endpoint.events.map(event => (
                          <span
                            key={event}
                            className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-blue-50 text-blue-600"
                          >
                            {EVENT_LABELS[event] || event}
                          </span>
                        ))}
                      </div>

                      {/* Meta info */}
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 ml-4 text-[11px] text-slate-400">
                        <span>{format(new Date(endpoint.createdAt), 'yyyy-MM-dd', { locale: zhCN })} 创建</span>
                        <span>·</span>
                        <span>投递 {endpoint.deliveriesCount} 次</span>
                        {!endpoint.active && (
                          <>
                            <span>·</span>
                            <span className="text-amber-600 font-medium">已暂停</span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="relative flex-shrink-0">
                      <button
                        onClick={() => setMenuOpen(menuOpen === endpoint.id ? null : endpoint.id)}
                        className="mobile-touch-target rounded-element p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                      >
                        <MoreVertical size={16} />
                      </button>

                      {menuOpen === endpoint.id && (
                        <div className="absolute right-0 top-full mt-1 z-20 bg-white rounded-element shadow-elevated border border-slate-100 py-1 min-w-[140px]">
                          <button
                            onClick={() => handleEditEvents(endpoint)}
                            className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 transition"
                          >
                            <Edit2 size={14} />
                            编辑事件
                          </button>
                          <button
                            onClick={() => handleToggleActive(endpoint.id, endpoint.active)}
                            disabled={toggleLoading === endpoint.id}
                            className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 transition"
                          >
                            {endpoint.active ? <PowerOff size={14} /> : <Power size={14} />}
                            {endpoint.active ? '暂停' : '启用'}
                          </button>
                          <button
                            onClick={() => { setMenuOpen(null); handleViewDeliveries(endpoint.id) }}
                            className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 transition"
                          >
                            <Eye size={14} />
                            投递日志
                          </button>
                          <button
                            onClick={() => handleClearDeliveries(endpoint.id)}
                            disabled={clearingDeliveries === endpoint.id}
                            className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 transition"
                          >
                            <RefreshCw size={14} />
                            清理日志
                          </button>
                          <button
                            onClick={() => handleDelete(endpoint.id, endpoint.url)}
                            disabled={deleteLoading === endpoint.id}
                            className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition"
                          >
                            <Trash2 size={14} />
                            删除
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Delivery log toggle */}
                  <button
                    onClick={() => handleViewDeliveries(endpoint.id)}
                    className="mt-3 ml-4 flex items-center gap-1 text-xs text-blue-500 hover:text-blue-600 font-medium transition"
                  >
                    {expandedEndpoint === endpoint.id ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                    {expandedEndpoint === endpoint.id ? '收起日志' : '投递日志'}
                  </button>
                </div>

                {/* Delivery logs */}
                {expandedEndpoint === endpoint.id && (
                  <div className="mt-2 ml-6 rounded-element border border-slate-100 bg-white overflow-hidden">
                    {deliveryLoading ? (
                      <div className="flex items-center justify-center py-6">
                        <RefreshCw size={16} className="animate-spin text-blue-500" />
                      </div>
                    ) : deliveryLogs.length === 0 ? (
                      <div className="text-center py-6 text-xs text-slate-400">暂无投递记录</div>
                    ) : (
                      <div className="divide-y divide-slate-50">
                        {deliveryLogs.map(log => (
                          <div key={log.id} className="px-3 py-2.5 text-xs">
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2">
                                {getStatusDot(log.status)}
                                <span className="text-slate-700 font-medium">
                                  {EVENT_LABELS[log.meta.eventType] || log.meta.eventType}
                                </span>
                                {log.meta.attemptNumber > 1 && (
                                  <span className="text-slate-400">#{log.meta.attemptNumber}</span>
                                )}
                              </div>
                              <span className="text-slate-400 tabular-nums">
                                {log.meta.sentAt
                                  ? format(new Date(log.meta.sentAt), 'MM-dd HH:mm:ss', { locale: zhCN })
                                  : '—'}
                              </span>
                            </div>
                            {log.summary && (
                              <p className="mt-0.5 ml-4 text-slate-500 truncate">{log.summary}</p>
                            )}
                            {log.meta.errorMessage && (
                              <p className="mt-1 text-red-500 break-all ml-4">{log.meta.errorMessage}</p>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Signature verification */}
      <div className="bg-white rounded-card p-4 shadow-card border border-blue-50 sm:p-5">
        <h2 className="text-base font-bold text-slate-900 mb-3">签名验证示例</h2>
        <p className="text-xs text-slate-500 mb-3">
          使用 Secret 验证 <code className="bg-slate-100 px-1 py-0.5 rounded text-[11px]">X-Webhook-Signature</code> 头确保请求来自本系统：
        </p>
        <div className="bg-slate-900 rounded-element p-3 overflow-x-auto">
          <code className="text-xs text-green-400 whitespace-pre leading-relaxed">
{`const crypto = require('crypto');

function verifyWebhook(body, signature, secret) {
  const expected = crypto
    .createHmac('sha256', secret)
    .update(body)
    .digest('hex');
  try {
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expected)
    );
  } catch { return false; }
}`}
          </code>
        </div>
      </div>

      {/* ========== Create Modal ========== */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-card p-5 sm:p-6 w-full max-w-md max-h-[85vh] overflow-y-auto shadow-elevated">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold text-slate-900">创建 Webhook</h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="p-2 hover:bg-slate-100 rounded-element transition"
              >
                <X size={18} className="text-slate-400" />
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-4">
              {/* URL */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">目标 URL</label>
                <input
                  type="url"
                  value={newUrl}
                  onChange={(e) => setNewUrl(e.target.value)}
                  required
                  className="w-full px-3.5 py-2.5 border border-slate-200 rounded-element focus:ring-2 focus:ring-blue-400 focus:border-blue-400 outline-none text-[16px] text-slate-800 placeholder:text-slate-400"
                  placeholder="https://your-server.com/webhook"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">描述<span className="text-slate-400 font-normal">（可选）</span></label>
                <input
                  type="text"
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  maxLength={200}
                  className="w-full px-3.5 py-2.5 border border-slate-200 rounded-element focus:ring-2 focus:ring-blue-400 focus:border-blue-400 outline-none text-[16px] text-slate-800 placeholder:text-slate-400"
                  placeholder="例如：Home Assistant 集成"
                />
              </div>

              {/* Event selection */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">订阅事件</label>

                {/* Select All */}
                <label className="flex items-center gap-3 px-3 py-2 rounded-element border border-blue-200 bg-blue-50/50 mb-2.5 cursor-pointer transition hover:bg-blue-50">
                  <input
                    type="checkbox"
                    checked={newEvents.includes('*')}
                    onChange={() => toggleEvent('*')}
                    className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm font-medium text-blue-700">全部事件</span>
                </label>

                {/* Grouped events — compact row per category */}
                <div className="rounded-element border border-slate-200 divide-y divide-slate-100 overflow-hidden">
                  {EVENT_GROUPS.map(group => (
                    <div key={group.label} className="flex items-center justify-between px-3 py-2.5">
                      <span className="text-sm text-slate-700 font-medium">{group.label}</span>
                      <div className="flex items-center gap-3">
                        {group.events.map(event => {
                          const shortLabel = event.endsWith('.created') ? '增' : event.endsWith('.updated') ? '改' : event.endsWith('.deleted') ? '删' : event.endsWith('.fired') ? '通知' : '其他'
                          return (
                            <label key={event} className="flex items-center gap-1 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={newEvents.includes(event) || newEvents.includes('*')}
                                onChange={() => toggleEvent(event)}
                                disabled={newEvents.includes('*')}
                                className="h-3.5 w-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 disabled:opacity-40"
                              />
                              <span className="text-xs text-slate-500">{shortLabel}</span>
                            </label>
                          )
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <button
                type="submit"
                disabled={createLoading || !newUrl.trim() || newEvents.length === 0}
                className="w-full py-3 px-4 font-medium text-white rounded-button gradient-primary shadow-elevated transition active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {createLoading ? '创建中...' : '创建 Webhook'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ========== Secret Display Modal ========== */}
      {showSecretModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-card p-5 sm:p-6 w-full max-w-md shadow-elevated">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-slate-900">Webhook 已创建</h3>
              <button
                onClick={() => { setShowSecretModal(false); setNewlyCreatedSecret('') }}
                className="p-2 hover:bg-slate-100 rounded-element transition"
              >
                <X size={18} className="text-slate-400" />
              </button>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-element p-3.5 mb-4">
              <div className="flex items-start space-x-2.5">
                <AlertTriangle size={16} className="text-amber-500 mt-0.5 flex-shrink-0" />
                <div className="text-xs text-amber-700">
                  <p className="font-semibold">请立即复制并保存此签名密钥！</p>
                  <p className="mt-0.5">关闭后无法再次查看。此密钥用于验证请求签名。</p>
                </div>
              </div>
            </div>

            <div className="relative">
              <div className="bg-slate-900 rounded-element p-3.5 pr-12">
                <code className="text-xs text-green-400 break-all leading-relaxed">
                  {newlyCreatedSecret}
                </code>
              </div>
              <button
                onClick={() => copyToClipboard(newlyCreatedSecret, 'Webhook Secret 已复制')}
                className="absolute top-2.5 right-2.5 p-1.5 text-slate-400 hover:text-white rounded-element transition"
                title="复制"
              >
                <Check size={14} />
              </button>
            </div>

            <button
              onClick={() => { setShowSecretModal(false); setNewlyCreatedSecret('') }}
              className="w-full mt-4 py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-button transition active:scale-[0.98]"
            >
              我已保存，关闭
            </button>
          </div>
        </div>
      )}

      {/* Click outside to close menu */}
      {menuOpen && (
        <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(null)} />
      )}

      {/* ========== Edit Events Modal ========== */}
      {editingEndpoint && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-card p-5 sm:p-6 w-full max-w-md max-h-[85vh] overflow-y-auto shadow-elevated">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-slate-900">编辑订阅事件</h3>
              <button onClick={() => setEditingEndpoint(null)} className="p-2 hover:bg-slate-100 rounded-element transition">
                <X size={20} />
              </button>
            </div>

            <p className="text-xs text-slate-500 mb-4 truncate">{editingEndpoint.url}</p>

            {/* All events toggle — same style as create modal */}
            <label className="flex items-center gap-2 mb-3 cursor-pointer">
              <input
                type="checkbox"
                checked={editEvents.includes('*')}
                onChange={e => setEditEvents(e.target.checked ? ['*'] : [])}
                className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm font-medium text-blue-700">全部事件</span>
            </label>

            {/* Grouped events — compact row per category (unified with create modal) */}
            <div className="rounded-element border border-slate-200 divide-y divide-slate-100 overflow-hidden">
              {EVENT_GROUPS.map(group => (
                <div key={group.label} className="flex items-center justify-between px-3 py-2.5">
                  <span className="text-sm text-slate-700 font-medium">{group.label}</span>
                  <div className="flex items-center gap-3">
                    {group.events.map(event => {
                      const shortLabel = event.endsWith('.created') ? '增' : event.endsWith('.updated') ? '改' : event.endsWith('.deleted') ? '删' : event.endsWith('.fired') ? '通知' : '其他'
                      return (
                        <label key={event} className="flex items-center gap-1 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={editEvents.includes(event) || editEvents.includes('*')}
                            onChange={() => {
                              setEditEvents(prev =>
                                prev.includes(event)
                                  ? prev.filter(e => e !== event)
                                  : [...prev.filter(e => e !== '*'), event]
                              )
                            }}
                            disabled={editEvents.includes('*')}
                            className="h-3.5 w-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 disabled:opacity-40"
                          />
                          <span className="text-xs text-slate-500">{shortLabel}</span>
                        </label>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>

            <button
              onClick={handleSaveEvents}
              disabled={editLoading || (editEvents.length === 0)}
              className="w-full mt-5 py-2.5 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium rounded-button transition"
            >
              {editLoading ? '保存中...' : '保存'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
