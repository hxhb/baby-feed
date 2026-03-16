'use client'

import { useState, useEffect, useCallback } from 'react'
import { format } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import {
  Users,
  Shield,
  ShieldOff,
  Trash2,
  ToggleLeft,
  ToggleRight,
  ArrowLeft,
  UserCog,
  Database
} from 'lucide-react'

interface UserInfo {
  id: string
  email: string
  name: string
  role: string
  createdAt: string
  _count: {
    babies: number
    feedingRecords: number
    healthRecords: number
  }
}

interface Props {
  currentUserId: string
  onBack?: () => void
}

export default function AdminPanel({ currentUserId, onBack }: Props) {
  const [users, setUsers] = useState<UserInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [allowRegistration, setAllowRegistration] = useState(true)
  const [settingsLoading, setSettingsLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  const fetchUsers = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/users')
      if (response.ok) {
        const data = await response.json()
        setUsers(data)
      }
    } catch (error) {
      console.error('获取用户列表失败:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchSettings = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/settings')
      if (response.ok) {
        const data = await response.json()
        setAllowRegistration(data.allowRegistration)
      }
    } catch (error) {
      console.error('获取站点设置失败:', error)
    } finally {
      setSettingsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchUsers()
    fetchSettings()
  }, [fetchUsers, fetchSettings])

  const handleToggleRegistration = async () => {
    const newValue = !allowRegistration
    setAllowRegistration(newValue)
    try {
      const response = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ allowRegistration: newValue })
      })
      if (!response.ok) {
        setAllowRegistration(!newValue) // 回滚
        alert('操作失败')
      }
    } catch {
      setAllowRegistration(!newValue) // 回滚
      alert('操作失败')
    }
  }

  const handleToggleRole = async (userId: string, currentRole: string) => {
    const newRole = currentRole === 'ADMIN' ? 'USER' : 'ADMIN'
    setActionLoading(userId)
    try {
      const response = await fetch('/api/admin/users', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, role: newRole })
      })
      if (response.ok) {
        setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: newRole } : u))
      } else {
        const data = await response.json()
        alert(data.error || '操作失败')
      }
    } catch {
      alert('操作失败')
    } finally {
      setActionLoading(null)
    }
  }

  const handleDeleteUser = async (userId: string, userName: string) => {
    if (!confirm(`确定要删除用户 "${userName}" 吗？该用户的所有数据将被永久删除。`)) return
    
    setActionLoading(userId)
    try {
      const response = await fetch('/api/admin/users', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId })
      })
      if (response.ok) {
        setUsers(prev => prev.filter(u => u.id !== userId))
      } else {
        const data = await response.json()
        alert(data.error || '删除失败')
      }
    } catch {
      alert('删除失败')
    } finally {
      setActionLoading(null)
    }
  }

  if (loading || settingsLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto px-3 sm:px-4 py-4 space-y-4">
      {/* 顶部导航 */}
      <div className="flex items-center space-x-3">
        {onBack && (
          <button
            onClick={onBack}
            className="p-2 hover:bg-gray-100 rounded-lg transition"
          >
            <ArrowLeft size={20} />
          </button>
        )}
        <div className="flex items-center space-x-2">
          <UserCog size={22} className="text-blue-600" />
          <h1 className="text-xl font-bold text-gray-900">站点管理</h1>
        </div>
      </div>

      {/* 注册开关 */}
      <div className="bg-white rounded-2xl p-5 shadow-sm">
        <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center space-x-2">
          <Database size={18} className="text-gray-500" />
          <span>站点设置</span>
        </h2>
        
        <div className="flex items-center justify-between py-3">
          <div>
            <p className="font-medium text-gray-900">允许新用户注册</p>
            <p className="text-sm text-gray-500 mt-0.5">
              {allowRegistration ? '当前允许新用户注册账号' : '当前已关闭注册，只有管理员可以邀请用户'}
            </p>
          </div>
          <button
            onClick={handleToggleRegistration}
            className="flex-shrink-0 ml-4"
          >
            {allowRegistration ? (
              <ToggleRight size={36} className="text-green-500" />
            ) : (
              <ToggleLeft size={36} className="text-gray-400" />
            )}
          </button>
        </div>
      </div>

      {/* 用户列表 */}
      <div className="bg-white rounded-2xl p-5 shadow-sm">
        <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center space-x-2">
          <Users size={18} className="text-gray-500" />
          <span>注册用户</span>
          <span className="text-sm font-normal text-gray-400">({users.length})</span>
        </h2>

        <div className="space-y-3">
          {users.map(user => {
            const isCurrentUser = user.id === currentUserId
            const isAdmin = user.role === 'ADMIN'
            const isLoading = actionLoading === user.id

            return (
              <div
                key={user.id}
                className={`p-4 rounded-xl border transition ${
                  isCurrentUser ? 'border-blue-200 bg-blue-50/50' : 'border-gray-100 bg-gray-50'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2">
                      <p className="font-medium text-gray-900 truncate">{user.name}</p>
                      {isAdmin && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                          <Shield size={10} className="mr-0.5" />
                          管理员
                        </span>
                      )}
                      {isCurrentUser && (
                        <span className="text-xs text-gray-400">(我)</span>
                      )}
                    </div>
                    <p className="text-sm text-gray-500 mt-0.5 truncate">{user.email}</p>
                    <div className="flex items-center space-x-3 mt-1.5 text-xs text-gray-400">
                      <span>
                        注册于 {format(new Date(user.createdAt), 'yyyy-MM-dd', { locale: zhCN })}
                      </span>
                      <span>·</span>
                      <span>{user._count.babies} 个宝宝</span>
                      <span>·</span>
                      <span>{user._count.feedingRecords + user._count.healthRecords} 条记录</span>
                    </div>
                  </div>

                  {!isCurrentUser && (
                    <div className="flex items-center space-x-1 ml-3 flex-shrink-0">
                      <button
                        onClick={() => handleToggleRole(user.id, user.role)}
                        disabled={isLoading}
                        title={isAdmin ? '取消管理员' : '设为管理员'}
                        className={`p-2 rounded-lg transition disabled:opacity-50 ${
                          isAdmin 
                            ? 'text-blue-600 hover:bg-blue-100' 
                            : 'text-gray-400 hover:bg-gray-200'
                        }`}
                      >
                        {isAdmin ? <ShieldOff size={16} /> : <Shield size={16} />}
                      </button>
                      <button
                        onClick={() => handleDeleteUser(user.id, user.name)}
                        disabled={isLoading}
                        title="删除用户"
                        className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition disabled:opacity-50"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
