'use client'

import { useState, useEffect, useCallback } from 'react'
import { format } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import {
  Key,
  Plus,
  Trash2,
  Copy,
  Check,
  AlertTriangle,
  X,
  Clock,
  ArrowLeft,
  Shield,
  FileText,
  ExternalLink
} from 'lucide-react'
import { useCopyToast } from '@/components/CopyToast'

interface ApiKeyInfo {
  id: string
  name: string
  prefix: string
  lastUsedAt: string | null
  expiresAt: string | null
  createdAt: string
}

interface Props {
  onBack: () => void
}

export default function ApiKeyManager({ onBack }: Props) {
  const [keys, setKeys] = useState<ApiKeyInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showNewKeyModal, setShowNewKeyModal] = useState(false)
  const [newKeyName, setNewKeyName] = useState('')
  const [newKeyExpiry, setNewKeyExpiry] = useState<string>('0') // 0 = 永不过期
  const [createLoading, setCreateLoading] = useState(false)
  const [newlyCreatedKey, setNewlyCreatedKey] = useState('')
  const [deleteLoading, setDeleteLoading] = useState<string | null>(null)
  const { copyToClipboard } = useCopyToast()

  const fetchKeys = useCallback(async () => {
    try {
      const response = await fetch('/api/user/api-keys')
      if (response.ok) {
        const data = await response.json()
        setKeys(data)
      }
    } catch (error) {
      console.error('获取 API Key 列表失败:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchKeys()
  }, [fetchKeys])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newKeyName.trim()) return

    setCreateLoading(true)
    try {
      const expiresInDays = parseInt(newKeyExpiry)
      const response = await fetch('/api/user/api-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newKeyName.trim(),
          ...(expiresInDays > 0 ? { expiresInDays } : {})
        })
      })

      if (response.ok) {
        const data = await response.json()
        setNewlyCreatedKey(data.key)
        setShowCreateModal(false)
        setShowNewKeyModal(true)
        setNewKeyName('')
        setNewKeyExpiry('0')
        fetchKeys()
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

  const handleDelete = async (keyId: string, keyName: string) => {
    if (!confirm(`确定要删除 API Key "${keyName}" 吗？使用此 Key 的集成将立即失效。`)) return

    setDeleteLoading(keyId)
    try {
      const response = await fetch('/api/user/api-keys', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keyId })
      })

      if (response.ok) {
        setKeys(prev => prev.filter(k => k.id !== keyId))
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

  const handleCopy = async (text: string) => {
    await copyToClipboard(text, 'API Key 已复制')
  }

  const isExpired = (expiresAt: string | null) => {
    if (!expiresAt) return false
    return new Date(expiresAt) < new Date()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto px-3 sm:px-4 py-4 space-y-4 sm:space-y-5">
      {/* 顶部导航 */}
      <div className="flex items-center space-x-3">
        <button
          onClick={onBack}
          className="mobile-touch-target rounded-xl p-2 transition hover:bg-gray-100"
        >
          <ArrowLeft size={20} />
        </button>
        <div className="flex items-center space-x-2 min-w-0">
          <Key size={22} className="text-blue-600 flex-shrink-0" />
          <h1 className="text-xl font-bold text-gray-900 truncate">API Key 管理</h1>
        </div>
      </div>

      {/* 说明卡片 */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 sm:p-5">
        <div className="flex items-start space-x-3">
          <Shield size={18} className="text-blue-500 mt-0.5 flex-shrink-0" />
          <div className="text-sm text-blue-700">
            <p className="font-medium mb-1">外部集成认证</p>
            <p>
              创建 API Key 后，外部程序（如 iOS 快捷指令、自动化脚本等）可以通过
              <code className="bg-blue-100 px-1.5 py-0.5 rounded text-xs mx-1">Authorization: Bearer your-api-key</code>
              请求头调用本系统的 API 接口。
            </p>
          </div>
        </div>
      </div>

      {/* API 文档链接 */}
      <div className="bg-white rounded-card p-4 shadow-card border border-blue-50">
        <a
          href="https://github.com/hxhb/baby-feed/blob/master/docs/HTTP_REQUESTS.md"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-3 text-blue-600 hover:text-blue-700 transition"
        >
          <FileText size={20} className="shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold">API 接口文档</p>
            <p className="text-xs text-slate-500 mt-0.5">查看所有支持的 HTTP API 端点和请求格式</p>
          </div>
          <ExternalLink size={16} className="shrink-0 text-slate-400" />
        </a>
      </div>

      {/* Key 列表 */}
      <div className="bg-white rounded-2xl p-4 shadow-sm sm:p-5 lg:p-6">
        <div className="flex items-center justify-between gap-3 mb-4">
          <h2 className="text-lg font-bold text-gray-900">
            我的 Key
            <span className="text-sm font-normal text-gray-400 ml-2">({keys.length}/10)</span>
          </h2>
          <button
            onClick={() => {
              setNewKeyName('')
              setNewKeyExpiry('0')
              setShowCreateModal(true)
            }}
            disabled={keys.length >= 10}
            className="mobile-touch-target inline-flex items-center rounded-xl px-2 py-2 text-blue-600 transition disabled:cursor-not-allowed disabled:opacity-50 hover:text-blue-700"
          >
            <Plus size={20} className="mr-1" />
            创建
          </button>
        </div>

        {keys.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <Key size={48} className="mx-auto mb-2 text-gray-300" />
            <p>还没有创建 API Key</p>
            <p className="text-sm mt-1 text-gray-400">创建一个来启用外部集成</p>
          </div>
        ) : (
          <div className="space-y-3">
            {keys.map(apiKey => {
              const expired = isExpired(apiKey.expiresAt)
              return (
                <div
                  key={apiKey.id}
                  className={`rounded-xl border p-4 transition ${
                    expired
                      ? 'border-red-200 bg-red-50/50'
                      : 'border-gray-100 bg-gray-50'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium text-gray-900 break-all sm:truncate">{apiKey.name}</p>
                        {expired && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
                            已过期
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-500 mt-1 font-mono break-all">
                        {apiKey.prefix}••••••••
                      </p>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5 text-xs text-gray-400">
                        <span>
                          创建于 {format(new Date(apiKey.createdAt), 'yyyy-MM-dd HH:mm', { locale: zhCN })}
                        </span>
                        {apiKey.lastUsedAt && (
                          <>
                            <span>·</span>
                            <span className="flex items-center">
                              <Clock size={10} className="mr-0.5" />
                              最后使用 {format(new Date(apiKey.lastUsedAt), 'yyyy-MM-dd HH:mm', { locale: zhCN })}
                            </span>
                          </>
                        )}
                        {apiKey.expiresAt && !expired && (
                          <>
                            <span>·</span>
                            <span>
                              {format(new Date(apiKey.expiresAt), 'yyyy-MM-dd', { locale: zhCN })} 过期
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    <button
                      onClick={() => handleDelete(apiKey.id, apiKey.name)}
                      disabled={deleteLoading === apiKey.id}
                      title="删除 API Key"
                      className="mobile-touch-target ml-2 flex-shrink-0 rounded-xl p-2 text-gray-400 transition hover:bg-red-50 hover:text-red-500 disabled:opacity-50"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* 使用示例 */}
      <div className="bg-white rounded-2xl p-4 shadow-sm sm:p-5 lg:p-6">
        <h2 className="text-lg font-bold text-gray-900 mb-3">使用示例</h2>
        <div className="space-y-3">
          <div>
            <p className="text-sm font-medium text-gray-700 mb-1">查询喂养记录</p>
            <div className="bg-gray-900 rounded-lg p-3 overflow-x-auto">
              <code className="text-sm text-green-400 whitespace-pre">
{`curl -H "Authorization: Bearer bfk_your_key" \\
  "https://your-domain/api/feeding?babyId=xxx"`}
              </code>
            </div>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-700 mb-1">添加喂养记录</p>
            <div className="bg-gray-900 rounded-lg p-3 overflow-x-auto">
              <code className="text-sm text-green-400 whitespace-pre">
{`curl -X POST \\
  -H "Authorization: Bearer bfk_your_key" \\
  -H "Content-Type: application/json" \\
  -d '{"babyId":"xxx","type":"FORMULA",
       "startTime":"2026-03-16T08:00:00+08:00",
       "formulaAmount":120}' \\
  "https://your-domain/api/feeding"`}
              </code>
            </div>
          </div>
        </div>
      </div>

      {/* ========== 创建 API Key 弹窗 ========== */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-gray-900">创建 API Key</h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  名称 / 用途描述
                </label>
                <input
                  type="text"
                  value={newKeyName}
                  onChange={(e) => setNewKeyName(e.target.value)}
                  required
                  maxLength={100}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  placeholder="例如：iOS快捷指令、Home Assistant"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  有效期
                </label>
                <select
                  value={newKeyExpiry}
                  onChange={(e) => setNewKeyExpiry(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-white"
                >
                  <option value="0">永不过期</option>
                  <option value="7">7 天</option>
                  <option value="30">30 天</option>
                  <option value="90">90 天</option>
                  <option value="180">180 天</option>
                  <option value="365">365 天</option>
                </select>
              </div>

              <button
                type="submit"
                disabled={createLoading || !newKeyName.trim()}
                className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium rounded-lg transition"
              >
                {createLoading ? '创建中...' : '创建'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ========== 显示新 Key 弹窗 ========== */}
      {showNewKeyModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-gray-900">API Key 已创建</h3>
              <button
                onClick={() => {
                  setShowNewKeyModal(false)
                  setNewlyCreatedKey('')
                }}
                className="p-2 hover:bg-gray-100 rounded-lg transition"
              >
                <X size={20} />
              </button>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4">
              <div className="flex items-start space-x-3">
                <AlertTriangle size={18} className="text-amber-500 mt-0.5 flex-shrink-0" />
                <div className="text-sm text-amber-700">
                  <p className="font-medium">请立即复制并妥善保存此 Key！</p>
                  <p className="mt-1">关闭此窗口后将无法再次查看完整 Key。</p>
                </div>
              </div>
            </div>

            <div className="relative">
              <div className="bg-gray-900 rounded-lg p-4 pr-12">
                <code className="text-sm text-green-400 break-all">
                  {newlyCreatedKey}
                </code>
              </div>
              <button
                onClick={() => handleCopy(newlyCreatedKey)}
                className="absolute top-3 right-3 p-1.5 text-gray-400 hover:text-white rounded transition"
                title="复制"
              >
                {<Copy size={16} />}
              </button>
            </div>

            <button
              onClick={() => {
                setShowNewKeyModal(false)
                setNewlyCreatedKey('')
              }}
              className="w-full mt-4 py-3 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-lg transition"
            >
              我已保存，关闭
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
