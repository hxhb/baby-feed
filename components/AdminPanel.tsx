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
  Database,
  Link2,
  Copy,
  Check,
  UserPlus,
  MoreVertical,
  UserPen,
  KeyRound,
  Eye,
  EyeOff,
  AlertTriangle,
  X
} from 'lucide-react'
import { useCopyToast } from '@/components/CopyToast'

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
  const [inviteCodes, setInviteCodes] = useState<Array<{ code: string; createdBy: string; createdAt: string; usedBy: string | null; usedAt: string | null }>>([])
  const [inviteLoading, setInviteLoading] = useState(false)
  const { copyToClipboard } = useCopyToast()

  // 用户操作菜单和弹窗状态
  const [menuOpen, setMenuOpen] = useState<string | null>(null)
  const [userModal, setUserModal] = useState<'editInfo' | 'changePassword' | 'deleteUser' | null>(null)
  const [selectedUser, setSelectedUser] = useState<UserInfo | null>(null)

  // 修改用户信息表单
  const [editName, setEditName] = useState('')
  const [editEmail, setEditEmail] = useState('')
  const [editInfoLoading, setEditInfoLoading] = useState(false)
  const [editInfoError, setEditInfoError] = useState('')
  const [editInfoSuccess, setEditInfoSuccess] = useState(false)

  // 修改用户密码表单
  const [newUserPassword, setNewUserPassword] = useState('')
  const [confirmNewUserPassword, setConfirmNewUserPassword] = useState('')
  const [showNewUserPassword, setShowNewUserPassword] = useState(false)
  const [changePwLoading, setChangePwLoading] = useState(false)
  const [changePwError, setChangePwError] = useState('')
  const [changePwSuccess, setChangePwSuccess] = useState(false)

  // 删除用户
  const [deleteConfirmText, setDeleteConfirmText] = useState('')
  const [deleteStep, setDeleteStep] = useState(1)
  const [deleteLoading2, setDeleteLoading2] = useState(false)
  const [deleteError, setDeleteError] = useState('')

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

  const fetchInviteCodes = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/invite')
      if (response.ok) {
        const data = await response.json()
        setInviteCodes(data)
      }
    } catch (error) {
      console.error('获取邀请码失败:', error)
    }
  }, [])

  useEffect(() => {
    fetchUsers()
    fetchSettings()
    fetchInviteCodes()
  }, [fetchUsers, fetchSettings, fetchInviteCodes])

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
    setMenuOpen(null)
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

  const handleCreateInvite = async () => {
    setInviteLoading(true)
    try {
      const response = await fetch('/api/admin/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
      if (response.ok) {
        const data = await response.json()
        await copyToClipboard(data.url, '邀请链接已复制')
        fetchInviteCodes()
      } else {
        const data = await response.json()
        alert(data.error || '创建失败')
      }
    } catch {
      alert('创建失败')
    } finally {
      setInviteLoading(false)
    }
  }

  const handleDeleteInvite = async (code: string) => {
    if (!confirm('确定要删除这个邀请码吗？')) return
    try {
      const response = await fetch(`/api/admin/invite/${code}`, { method: 'DELETE' })
      if (response.ok) {
        setInviteCodes(prev => prev.filter(c => c.code !== code))
      }
    } catch {
      alert('删除失败')
    }
  }

  const handleCopyInviteUrl = async (code: string) => {
    const baseUrl = window.location.origin
    await copyToClipboard(`${baseUrl}/register?code=${code}`, '邀请链接已复制')
  }

  // ========== 用户操作处理 ==========

  const openUserModal = (user: UserInfo, type: 'editInfo' | 'changePassword' | 'deleteUser') => {
    setSelectedUser(user)
    setUserModal(type)
    setMenuOpen(null)
    if (type === 'editInfo') {
      setEditName(user.name)
      setEditEmail(user.email)
      setEditInfoError('')
      setEditInfoSuccess(false)
      setEditInfoLoading(false)
    } else if (type === 'changePassword') {
      setNewUserPassword('')
      setConfirmNewUserPassword('')
      setShowNewUserPassword(false)
      setChangePwError('')
      setChangePwSuccess(false)
      setChangePwLoading(false)
    } else if (type === 'deleteUser') {
      setDeleteConfirmText('')
      setDeleteStep(1)
      setDeleteError('')
      setDeleteLoading2(false)
    }
  }

  const closeUserModal = () => {
    setUserModal(null)
    setSelectedUser(null)
    setEditInfoLoading(false)
    setChangePwLoading(false)
    setDeleteLoading2(false)
  }

  const handleUpdateUserInfo = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedUser) return

    setEditInfoLoading(true)
    setEditInfoError('')

    try {
      const response = await fetch('/api/admin/users', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: selectedUser.id,
          action: 'updateInfo',
          name: editName.trim(),
          email: editEmail.trim(),
        }),
      })

      if (response.ok) {
        setEditInfoSuccess(true)
        setUsers(prev => prev.map(u =>
          u.id === selectedUser.id
            ? { ...u, name: editName.trim(), email: editEmail.trim().toLowerCase() }
            : u
        ))
        setTimeout(closeUserModal, 1500)
      } else {
        const data = await response.json()
        setEditInfoError(data.error || '操作失败')
      }
    } catch {
      setEditInfoError('网络错误，请重试')
    } finally {
      setEditInfoLoading(false)
    }
  }

  const handleUpdateUserPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedUser) return

    if (newUserPassword !== confirmNewUserPassword) {
      setChangePwError('两次输入的密码不一致')
      return
    }

    setChangePwLoading(true)
    setChangePwError('')

    try {
      const response = await fetch('/api/admin/users', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: selectedUser.id,
          action: 'updatePassword',
          newPassword: newUserPassword,
        }),
      })

      if (response.ok) {
        setChangePwSuccess(true)
        setTimeout(closeUserModal, 1500)
      } else {
        const data = await response.json()
        setChangePwError(data.error || '操作失败')
      }
    } catch {
      setChangePwError('网络错误，请重试')
    } finally {
      setChangePwLoading(false)
    }
  }

  const handleDeleteUserExec = async () => {
    if (!selectedUser) return

    setDeleteLoading2(true)
    setDeleteError('')

    try {
      const response = await fetch('/api/admin/users', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: selectedUser.id }),
      })

      if (response.ok) {
        setUsers(prev => prev.filter(u => u.id !== selectedUser.id))
        closeUserModal()
      } else {
        const data = await response.json()
        setDeleteError(data.error || '删除失败')
        setDeleteStep(1)
      }
    } catch {
      setDeleteError('网络错误，请重试')
      setDeleteStep(1)
    } finally {
      setDeleteLoading2(false)
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
            className="mobile-touch-target rounded-element p-2 transition hover:bg-slate-100 active:scale-95"
          >
            <ArrowLeft size={20} className="text-slate-600" />
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

      {/* 邀请注册 */}
      <div className="bg-white rounded-2xl p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-900 flex items-center space-x-2">
            <UserPlus size={18} className="text-gray-500" />
            <span>邀请注册</span>
          </h2>
          <button
            onClick={handleCreateInvite}
            disabled={inviteLoading}
            className="inline-flex items-center rounded-xl bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-700 transition hover:bg-blue-100 disabled:opacity-50"
          >
            <Link2 size={14} className="mr-1.5" />
            {inviteLoading ? '生成中...' : '生成邀请链接'}
          </button>
        </div>

        <p className="text-sm text-gray-500 mb-3">
          生成一次性邀请链接，即使关闭了注册，被邀请人也可以通过该链接注册账号。链接用后即废。
        </p>

        {inviteCodes.length === 0 ? (
          <div className="text-center py-4 text-sm text-gray-400">
            暂无邀请码，点击上方按钮生成
          </div>
        ) : (
          <div className="space-y-2">
            {inviteCodes.map(invite => (
              <div
                key={invite.code}
                className={`flex items-center justify-between rounded-xl border p-3 ${
                  invite.usedBy ? 'border-gray-100 bg-gray-50 opacity-60' : 'border-blue-100 bg-blue-50/50'
                }`}
              >
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-mono text-gray-600 truncate">{invite.code.slice(0, 8)}••••</p>
                  <p className="text-[11px] text-gray-400 mt-0.5">
                    {invite.usedBy
                      ? `已使用 · ${new Date(invite.usedAt!).toLocaleDateString('zh-CN')}`
                      : `未使用 · 创建于 ${new Date(invite.createdAt).toLocaleDateString('zh-CN')}`}
                  </p>
                </div>
                <div className="flex items-center gap-1 ml-2">
                  {!invite.usedBy && (
                    <button
                      onClick={() => handleCopyInviteUrl(invite.code)}
                      className="p-2 text-blue-600 hover:bg-blue-100 rounded-lg transition"
                      title="复制邀请链接"
                    >
                      <Copy size={14} />
                    </button>
                  )}
                  <button
                    onClick={() => handleDeleteInvite(invite.code)}
                    className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition"
                    title="删除邀请码"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
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
                    <div className="relative flex-shrink-0">
                      <button
                        onClick={() => setMenuOpen(menuOpen === user.id ? null : user.id)}
                        className="mobile-touch-target rounded-element p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                      >
                        <MoreVertical size={16} />
                      </button>

                      {menuOpen === user.id && (
                        <>
                          <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(null)} />
                          <div className="absolute right-0 top-full mt-1 z-20 bg-white rounded-element shadow-elevated border border-slate-100 py-1 min-w-[140px]">
                            <button
                              onClick={() => openUserModal(user, 'editInfo')}
                              className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 transition"
                            >
                              <UserPen size={14} />
                              修改信息
                            </button>
                            <button
                              onClick={() => openUserModal(user, 'changePassword')}
                              className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 transition"
                            >
                              <KeyRound size={14} />
                              修改密码
                            </button>
                            <button
                              onClick={() => handleToggleRole(user.id, user.role)}
                              disabled={isLoading}
                              className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 transition disabled:opacity-50"
                            >
                              {isAdmin ? <ShieldOff size={14} /> : <Shield size={14} />}
                              {isAdmin ? '取消管理员' : '设为管理员'}
                            </button>
                            <button
                              onClick={() => openUserModal(user, 'deleteUser')}
                              className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition"
                            >
                              <Trash2 size={14} />
                              删除用户
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

    {/* ========== 修改用户信息弹窗 ========== */}
    {userModal === 'editInfo' && selectedUser && (
      <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center" onClick={closeUserModal}>
        <div
          className="w-full max-w-md rounded-t-3xl bg-white p-5 pb-safe shadow-2xl sm:rounded-2xl sm:p-6"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-gray-200 sm:hidden" />
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-bold text-slate-900">修改用户信息</h3>
            <button onClick={closeUserModal} className="mobile-touch-target inline-flex items-center justify-center rounded-full p-2 text-slate-400 transition hover:bg-gray-100 hover:text-slate-600">
              <X size={20} />
            </button>
          </div>

          {editInfoSuccess ? (
            <div className="flex flex-col items-center py-8">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
                <Check size={32} className="text-green-600" />
              </div>
              <p className="text-lg font-medium text-slate-900">用户信息修改成功</p>
            </div>
          ) : (
            <form onSubmit={handleUpdateUserInfo} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  用户名
                </label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  required
                  maxLength={50}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  placeholder="请输入用户名"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  邮箱
                </label>
                <input
                  type="email"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  required
                  maxLength={255}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  placeholder="请输入邮箱"
                />
              </div>

              {editInfoError && (
                <p className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">{editInfoError}</p>
              )}

              <button
                type="submit"
                disabled={editInfoLoading}
                className="mobile-touch-target w-full py-3 px-4 gradient-primary shadow-elevated disabled:opacity-50 text-white font-medium rounded-xl transition"
              >
                {editInfoLoading ? '保存中...' : '保存'}
              </button>
            </form>
          )}
        </div>
      </div>
    )}

    {/* ========== 修改用户密码弹窗 ========== */}
    {userModal === 'changePassword' && selectedUser && (
      <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center" onClick={closeUserModal}>
        <div
          className="w-full max-w-md rounded-t-3xl bg-white p-5 pb-safe shadow-2xl sm:rounded-2xl sm:p-6"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-gray-200 sm:hidden" />
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-bold text-slate-900">修改用户密码</h3>
            <button onClick={closeUserModal} className="mobile-touch-target inline-flex items-center justify-center rounded-full p-2 text-slate-400 transition hover:bg-gray-100 hover:text-slate-600">
              <X size={20} />
            </button>
          </div>

          {changePwSuccess ? (
            <div className="flex flex-col items-center py-8">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
                <Check size={32} className="text-green-600" />
              </div>
              <p className="text-lg font-medium text-slate-900">密码修改成功</p>
              <p className="text-sm text-slate-500 mt-1">用户下次登录时需使用新密码</p>
            </div>
          ) : (
            <form onSubmit={handleUpdateUserPassword} className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 mb-4">
                <p className="text-sm text-blue-700">
                  正在为用户 <span className="font-semibold">{selectedUser.name}</span> 重置密码
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  新密码
                </label>
                <div className="relative">
                  <input
                    type={showNewUserPassword ? 'text' : 'password'}
                    value={newUserPassword}
                    onChange={(e) => setNewUserPassword(e.target.value)}
                    required
                    minLength={8}
                    className="w-full px-4 py-3 pr-12 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                    placeholder="至少8位，包含字母和数字"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewUserPassword(!showNewUserPassword)}
                    className="mobile-touch-target absolute right-2 top-1/2 inline-flex -translate-y-1/2 items-center justify-center rounded-full p-2 text-slate-400 transition hover:bg-gray-100 hover:text-slate-600"
                  >
                    {showNewUserPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                <p className="text-xs text-slate-400 mt-1">至少 8 位，包含字母和数字</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  确认新密码
                </label>
                <input
                  type="password"
                  value={confirmNewUserPassword}
                  onChange={(e) => setConfirmNewUserPassword(e.target.value)}
                  required
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  placeholder="再次输入新密码"
                />
              </div>

              {changePwError && (
                <p className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">{changePwError}</p>
              )}

              <button
                type="submit"
                disabled={changePwLoading}
                className="mobile-touch-target w-full py-3 px-4 gradient-primary shadow-elevated disabled:opacity-50 text-white font-medium rounded-xl transition"
              >
                {changePwLoading ? '修改中...' : '修改密码'}
              </button>
            </form>
          )}
        </div>
      </div>
    )}

    {/* ========== 删除用户弹窗（三级确认） ========== */}
    {userModal === 'deleteUser' && selectedUser && (
      <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center" onClick={closeUserModal}>
        <div
          className="w-full max-w-md rounded-t-3xl bg-white p-5 pb-safe shadow-2xl sm:rounded-2xl sm:p-6"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-gray-200 sm:hidden" />
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-bold text-red-600">删除用户</h3>
            <button onClick={closeUserModal} className="mobile-touch-target inline-flex items-center justify-center rounded-full p-2 text-slate-400 transition hover:bg-gray-100 hover:text-slate-600">
              <X size={20} />
            </button>
          </div>

          {deleteStep === 1 && (
            <>
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6">
                <div className="flex items-start space-x-3">
                  <AlertTriangle size={20} className="text-red-500 mt-0.5 flex-shrink-0" />
                  <div className="text-sm text-red-700">
                    <p className="font-medium mb-1">此操作不可撤销！</p>
                    <p>删除用户 <span className="font-semibold">{selectedUser.name}</span> 将永久删除以下所有数据：</p>
                    <ul className="list-disc list-inside mt-1 space-y-0.5">
                      <li>该用户的账户信息</li>
                      <li>所有宝宝信息（{selectedUser._count.babies} 个）</li>
                      <li>所有喂养记录（{selectedUser._count.feedingRecords} 条）</li>
                      <li>所有健康记录（{selectedUser._count.healthRecords} 条）</li>
                      <li>API Key 和 Webhook 配置</li>
                    </ul>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    请输入 <span className="font-bold text-red-600">确认删除</span> 以继续
                  </label>
                  <input
                    type="text"
                    value={deleteConfirmText}
                    onChange={(e) => setDeleteConfirmText(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none"
                    placeholder="确认删除"
                  />
                </div>

                {deleteError && (
                  <p className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">{deleteError}</p>
                )}

                <button
                  onClick={() => { setDeleteStep(2); setDeleteError('') }}
                  disabled={deleteConfirmText !== '确认删除'}
                  className="mobile-touch-target w-full py-3 px-4 bg-red-600 text-white font-medium rounded-xl transition hover:bg-red-700 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  确定
                </button>
              </div>
            </>
          )}

          {deleteStep === 2 && (
            <>
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6">
                <div className="flex items-start space-x-3">
                  <AlertTriangle size={20} className="text-red-500 mt-0.5 flex-shrink-0" />
                  <div className="text-sm text-red-700">
                    <p className="font-medium mb-1">最终确认</p>
                    <p>确定要永久删除用户 <span className="font-semibold">{selectedUser.name}</span>（{selectedUser.email}）吗？</p>
                    <p className="mt-2 font-medium">此操作无法撤销，所有数据将被永久删除。</p>
                  </div>
                </div>
              </div>

              {deleteError && (
                <p className="text-sm text-red-600 bg-red-50 p-3 rounded-lg mb-4">{deleteError}</p>
              )}

              <div className="flex gap-3">
                <button
                  onClick={() => setDeleteStep(1)}
                  disabled={deleteLoading2}
                  className="mobile-touch-target flex-1 py-3 px-4 bg-slate-100 text-slate-600 font-medium rounded-xl transition hover:bg-slate-200 active:scale-[0.98] disabled:opacity-50"
                >
                  取消
                </button>
                <button
                  onClick={handleDeleteUserExec}
                  disabled={deleteLoading2}
                  className="mobile-touch-target flex-1 py-3 px-4 bg-red-600 text-white font-medium rounded-xl transition hover:bg-red-700 active:scale-[0.98] disabled:opacity-50"
                >
                  {deleteLoading2 ? '删除中...' : '确认删除'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    )}
    </div>
  )
}
