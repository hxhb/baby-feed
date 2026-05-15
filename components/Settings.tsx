'use client'

import { useState, useEffect } from 'react'
import { signOut } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import { extractDateStr, parseDateAsBeijing } from '@/lib/time'
import { 
  Baby, 
  PlusCircle, 
  Trash2, 
  Edit2,
  X,
  Key,
  KeyRound,
  UserPen,
  AlertTriangle,
  Check,
  Eye,
  EyeOff,
  LogOut,
  UserCog
} from 'lucide-react'

interface BabyInfo {
  id: string
  name: string
  birthDate: string
  gender: string
  createdAt: string
}

interface Props {
  userName: string
  userEmail: string
  initialBabies?: BabyInfo[]
}

type ModalType = 'addBaby' | 'editBaby' | 'editName' | 'changePassword' | 'deleteAccount' | null

export default function SettingsComponent({ userName, userEmail, initialBabies = [] }: Props) {
  const router = useRouter()
  const [babies, setBabies] = useState<BabyInfo[]>(initialBabies)
  const [loading, setLoading] = useState(initialBabies.length === 0)
  const [activeModal, setActiveModal] = useState<ModalType>(null)
  const [editingBaby, setEditingBaby] = useState<BabyInfo | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  
  // 宝宝表单
  const [babyName, setBabyName] = useState('')
  const [birthDate, setBirthDate] = useState('')
  const [gender, setGender] = useState<'MALE' | 'FEMALE'>('MALE')

  // 用户名表单
  const [newName, setNewName] = useState(userName)
  const [nameLoading, setNameLoading] = useState(false)
  const [nameSuccess, setNameSuccess] = useState(false)
  const [nameError, setNameError] = useState('')

  // 密码表单
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showCurrentPassword, setShowCurrentPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [passwordLoading, setPasswordLoading] = useState(false)
  const [passwordSuccess, setPasswordSuccess] = useState(false)
  const [passwordError, setPasswordError] = useState('')

  // 注销账户表单
  const [deletePassword, setDeletePassword] = useState('')
  const [deleteConfirmText, setDeleteConfirmText] = useState('')
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [deleteError, setDeleteError] = useState('')

  // 当前显示的用户名（修改后即时更新）
  const [displayName, setDisplayName] = useState(userName)

  useEffect(() => {
    if (initialBabies.length > 0) {
      setBabies(initialBabies)
      setLoading(false)
    } else {
      fetchBabies()
    }

    // 检查是否为管理员
    fetch('/api/admin/check')
      .then(res => res.json())
      .then(data => setIsAdmin(data.isAdmin))
      .catch(() => {})
  }, [initialBabies])

  useEffect(() => {
    if (!activeModal) return

    const { overflow } = document.body.style
    document.body.style.overflow = 'hidden'

    return () => {
      document.body.style.overflow = overflow
    }
  }, [activeModal])

  // 清除 Service Worker 缓存（登出时调用，防止敏感数据残留）
  const clearServiceWorkerCache = async () => {
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      const mc = new MessageChannel()
      navigator.serviceWorker.controller.postMessage(
        { type: 'CLEAR_CACHE' },
        [mc.port2]
      )
      await new Promise<void>((resolve) => {
        mc.port1.onmessage = () => resolve()
        setTimeout(resolve, 1000)
      })
    }
  }

  const handleLogout = async () => {
    await clearServiceWorkerCache()
    await signOut({ callbackUrl: '/login' })
  }

  const fetchBabies = async () => {
    try {
      const response = await fetch('/api/babies')
      if (response.ok) {
        const data = await response.json()
        if (Array.isArray(data)) {
          setBabies(data)
        } else {
          setBabies([])
        }
      }
    } catch (error) {
      console.error('获取婴儿列表失败:', error)
    } finally {
      setLoading(false)
    }
  }

  // =============== 宝宝管理 ===============
  const handleAddBaby = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!babyName || !birthDate) {
      alert('请填写完整信息')
      return
    }

    try {
      const response = await fetch('/api/babies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: babyName, birthDate, gender })
      })

      if (response.ok) {
        closeModal()
        fetchBabies()
      } else {
        const error = await response.json()
        alert(error.error || '添加失败')
      }
    } catch (error) {
      console.error('添加失败:', error)
      alert('添加失败，请重试')
    }
  }

  const handleUpdateBaby = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingBaby || !babyName || !birthDate) return

    try {
      const response = await fetch(`/api/babies/${editingBaby.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: babyName, birthDate, gender })
      })

      if (response.ok) {
        closeModal()
        fetchBabies()
      } else {
        const error = await response.json()
        alert(error.error || '更新失败')
      }
    } catch (error) {
      console.error('更新失败:', error)
      alert('更新失败，请重试')
    }
  }

  const handleDeleteBaby = async (id: string) => {
    if (!confirm('确定要删除这个宝宝吗？所有相关记录也会被删除。')) return

    try {
      const response = await fetch(`/api/babies/${id}`, { method: 'DELETE' })
      if (response.ok) {
        fetchBabies()
      }
    } catch (error) {
      console.error('删除失败:', error)
    }
  }

  const openEditBabyModal = (baby: BabyInfo) => {
    setEditingBaby(baby)
    setBabyName(baby.name)
    setBirthDate(extractDateStr(baby.birthDate))
    setGender(baby.gender as 'MALE' | 'FEMALE')
    setActiveModal('editBaby')
  }

  // =============== 修改用户名 ===============
  const handleUpdateName = async (e: React.FormEvent) => {
    e.preventDefault()
    setNameError('')
    setNameSuccess(false)

    const trimmed = newName.trim()
    if (!trimmed) {
      setNameError('请输入用户名')
      return
    }
    if (trimmed === displayName) {
      setNameError('新用户名与当前一致')
      return
    }

    setNameLoading(true)
    try {
      const response = await fetch('/api/user/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmed })
      })

      if (response.ok) {
        const data = await response.json()
        setDisplayName(data.name)
        setNewName(data.name)
        setNameSuccess(true)
        // 2秒后关闭弹窗
        setTimeout(() => {
          setNameSuccess(false)
          closeModal()
          // 刷新 session 以更新全局用户名
          router.refresh()
        }, 1500)
      } else {
        const data = await response.json()
        setNameError(data.error || '修改失败')
      }
    } catch (error) {
      console.error('修改用户名失败:', error)
      setNameError('修改失败，请重试')
    } finally {
      setNameLoading(false)
    }
  }

  // =============== 修改密码 ===============
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setPasswordError('')
    setPasswordSuccess(false)

    if (!currentPassword) {
      setPasswordError('请输入当前密码')
      return
    }
    if (!newPassword) {
      setPasswordError('请输入新密码')
      return
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('两次输入的新密码不一致')
      return
    }
    if (currentPassword === newPassword) {
      setPasswordError('新密码不能与当前密码相同')
      return
    }

    setPasswordLoading(true)
    try {
      const response = await fetch('/api/user/password', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword })
      })

      if (response.ok) {
        setPasswordSuccess(true)
        setTimeout(() => {
          setPasswordSuccess(false)
          closeModal()
        }, 1500)
      } else {
        const data = await response.json()
        setPasswordError(data.error || '修改密码失败')
      }
    } catch (error) {
      console.error('修改密码失败:', error)
      setPasswordError('修改密码失败，请重试')
    } finally {
      setPasswordLoading(false)
    }
  }

  // =============== 注销账户 ===============
  const handleDeleteAccount = async (e: React.FormEvent) => {
    e.preventDefault()
    setDeleteError('')

    if (!deletePassword) {
      setDeleteError('请输入密码')
      return
    }
    if (deleteConfirmText !== '确认注销') {
      setDeleteError('请输入"确认注销"以确认操作')
      return
    }

    setDeleteLoading(true)
    try {
      const response = await fetch('/api/user/delete', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: deletePassword })
      })

      if (response.ok) {
        // 注销成功，清除缓存后退出登录
        await clearServiceWorkerCache()
        await signOut({ callbackUrl: '/login' })
      } else {
        const data = await response.json()
        setDeleteError(data.error || '注销失败')
      }
    } catch (error) {
      console.error('注销账户失败:', error)
      setDeleteError('注销失败，请重试')
    } finally {
      setDeleteLoading(false)
    }
  }

  // =============== 通用 ===============
  const closeModal = () => {
    setActiveModal(null)
    setEditingBaby(null)
    // 重置宝宝表单
    setBabyName('')
    setBirthDate('')
    setGender('MALE')
    // 重置用户名表单
    setNewName(displayName)
    setNameError('')
    setNameSuccess(false)
    // 重置密码表单
    setCurrentPassword('')
    setNewPassword('')
    setConfirmPassword('')
    setShowCurrentPassword(false)
    setShowNewPassword(false)
    setPasswordError('')
    setPasswordSuccess(false)
    // 重置注销表单
    setDeletePassword('')
    setDeleteConfirmText('')
    setDeleteError('')
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
      {/* 用户信息卡片 */}
      <div className="bg-white rounded-2xl p-5 shadow-sm sm:p-6 lg:p-7">
        <h2 className="text-lg font-bold text-gray-900 mb-4">账户信息</h2>
        <div className="flex items-center space-x-4 mb-4">
          <div className="w-14 h-14 bg-gradient-to-br from-blue-400 to-blue-600 rounded-full flex items-center justify-center text-white text-xl font-bold">
            {displayName?.charAt(0)?.toUpperCase() || '?'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-gray-900 text-lg truncate">{displayName}</p>
            <p className="text-sm text-gray-500 truncate">{userEmail}</p>
          </div>
        </div>

        <div className="space-y-2 pt-2 border-t border-gray-100">
          <button
            onClick={() => {
              setNewName(displayName)
              setActiveModal('editName')
            }}
            className="mobile-touch-target w-full flex items-center justify-between rounded-xl px-2 py-3 text-left transition group hover:bg-gray-50"
          >
            <div className="flex items-center space-x-3">
              <UserPen size={18} className="text-gray-400 group-hover:text-blue-500 transition" />
              <span className="text-gray-700">修改用户名</span>
            </div>
            <span className="text-gray-400 text-sm">›</span>
          </button>

          <button
            onClick={() => setActiveModal('changePassword')}
            className="mobile-touch-target w-full flex items-center justify-between rounded-xl px-2 py-3 text-left transition group hover:bg-gray-50"
          >
            <div className="flex items-center space-x-3">
              <KeyRound size={18} className="text-gray-400 group-hover:text-blue-500 transition" />
              <span className="text-gray-700">修改密码</span>
            </div>
            <span className="text-gray-400 text-sm">›</span>
          </button>

          <button
            onClick={() => router.push('/settings/api-keys')}
            className="mobile-touch-target w-full flex items-center justify-between rounded-xl px-2 py-3 text-left transition group hover:bg-gray-50"
          >
            <div className="flex items-center space-x-3">
              <Key size={18} className="text-gray-400 group-hover:text-blue-500 transition" />
              <span className="text-gray-700">API Key 管理</span>
            </div>
            <span className="text-gray-400 text-sm">›</span>
          </button>

          <button
            onClick={handleLogout}
            className="mobile-touch-target w-full flex items-center justify-between rounded-xl px-2 py-3 text-left transition group hover:bg-gray-50"
          >
            <div className="flex items-center space-x-3">
              <LogOut size={18} className="text-gray-400 group-hover:text-orange-500 transition" />
              <span className="text-gray-700">退出登录</span>
            </div>
            <span className="text-gray-400 text-sm">›</span>
          </button>

          {isAdmin && (
            <button
              onClick={() => router.push('/admin')}
              className="mobile-touch-target w-full flex items-center justify-between rounded-xl px-2 py-3 text-left transition group hover:bg-gray-50"
            >
              <div className="flex items-center space-x-3">
                <UserCog size={18} className="text-gray-400 group-hover:text-purple-500 transition" />
                <span className="text-gray-700">站点管理</span>
              </div>
              <span className="text-gray-400 text-sm">›</span>
            </button>
          )}
        </div>
      </div>

      {/* 宝宝管理 */}
      <div className="bg-white rounded-2xl p-5 shadow-sm sm:p-6 lg:p-7">
        <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-lg font-bold text-gray-900">宝宝管理</h2>
          <button
            onClick={() => {
              setBabyName('')
              setBirthDate('')
              setGender('MALE')
              setActiveModal('addBaby')
            }}
            className="mobile-touch-target inline-flex w-full items-center justify-center rounded-xl bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-700 transition hover:bg-blue-100 sm:w-auto"
          >
            <PlusCircle size={16} className="mr-1.5" />
            添加宝宝
          </button>
        </div>

        {babies.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <Baby size={48} className="mx-auto mb-2 text-gray-300" />
            <p>还没有添加宝宝</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {babies.map(baby => (
              <div
                key={baby.id}
                className="rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2.5 shadow-sm shadow-slate-100"
              >
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-pink-100 to-blue-100">
                    <Baby size={18} className="text-blue-600" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <p className="text-sm font-semibold text-gray-900 break-words">{baby.name}</p>
                      <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${baby.gender === 'MALE' ? 'bg-blue-100 text-blue-700' : 'bg-pink-100 text-pink-700'}`}>
                        {baby.gender === 'MALE' ? '男宝' : '女宝'}
                      </span>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-slate-500">
                      <span>出生 {format(parseDateAsBeijing(baby.birthDate), 'yyyy年MM月dd日', { locale: zhCN })}</span>
                      <span className="text-slate-300">•</span>
                      <span>创建于 {format(parseDateAsBeijing(baby.createdAt), 'yyyy年MM月dd日', { locale: zhCN })}</span>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      onClick={() => openEditBabyModal(baby)}
                      className="mobile-touch-target inline-flex items-center justify-center rounded-lg bg-white p-2 text-blue-700 transition hover:bg-blue-50"
                      aria-label={`编辑${baby.name}`}
                      title="编辑资料"
                    >
                      <Edit2 size={15} />
                    </button>
                    <button
                      onClick={() => handleDeleteBaby(baby.id)}
                      className="mobile-touch-target inline-flex items-center justify-center rounded-lg bg-white p-2 text-red-600 transition hover:bg-red-50"
                      aria-label={`删除${baby.name}`}
                      title="删除宝宝"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 危险区域 */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-red-100 sm:p-6 lg:p-7">
        <h2 className="text-lg font-bold text-red-600 mb-2">危险操作</h2>
        <p className="text-sm text-gray-500 mb-4">
          注销账户后，所有数据将被永久删除且无法恢复。
        </p>
        <button
          onClick={() => setActiveModal('deleteAccount')}
          className="mobile-touch-target inline-flex items-center space-x-2 rounded-xl border border-red-300 px-4 py-2.5 text-sm font-medium text-red-600 transition hover:bg-red-50"
        >
          <AlertTriangle size={16} />
          <span>注销账户</span>
        </button>
      </div>

      {/* ========== 弹窗区域 ========== */}

      {/* 添加/编辑宝宝弹窗 */}
      {(activeModal === 'addBaby' || activeModal === 'editBaby') && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center" onClick={closeModal}>
          <div
            className="w-full max-w-md rounded-t-3xl bg-white p-5 pb-safe shadow-2xl sm:rounded-2xl sm:p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-gray-200 sm:hidden" />
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-gray-900">
                {activeModal === 'editBaby' ? '编辑宝宝' : '添加宝宝'}
              </h3>
              <button
                onClick={closeModal}
                className="mobile-touch-target inline-flex items-center justify-center rounded-full p-2 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={activeModal === 'editBaby' ? handleUpdateBaby : handleAddBaby} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  宝宝姓名
                </label>
                <input
                  type="text"
                  value={babyName}
                  onChange={(e) => setBabyName(e.target.value)}
                  required
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  placeholder="请输入宝宝姓名"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  出生日期
                </label>
                <input
                  type="date"
                  value={birthDate}
                  onChange={(e) => setBirthDate(e.target.value)}
                  required
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  性别
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setGender('MALE')}
                    className={`mobile-touch-target flex items-center justify-center p-3 rounded-xl border-2 transition ${
                      gender === 'MALE'
                        ? 'border-blue-500 bg-blue-50 text-blue-700'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    👦 男宝
                  </button>
                  <button
                    type="button"
                    onClick={() => setGender('FEMALE')}
                    className={`mobile-touch-target flex items-center justify-center p-3 rounded-xl border-2 transition ${
                      gender === 'FEMALE'
                        ? 'border-pink-500 bg-pink-50 text-pink-700'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    👧 女宝
                  </button>
                </div>
              </div>

              <button
                type="submit"
                className="mobile-touch-target w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl transition"
              >
                {activeModal === 'editBaby' ? '保存修改' : '添加宝宝'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* 修改用户名弹窗 */}
      {activeModal === 'editName' && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center" onClick={closeModal}>
          <div
            className="w-full max-w-md rounded-t-3xl bg-white p-5 pb-safe shadow-2xl sm:rounded-2xl sm:p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-gray-200 sm:hidden" />
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-gray-900">修改用户名</h3>
              <button onClick={closeModal} className="mobile-touch-target inline-flex items-center justify-center rounded-full p-2 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>

            {nameSuccess ? (
              <div className="flex flex-col items-center py-8">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
                  <Check size={32} className="text-green-600" />
                </div>
                <p className="text-lg font-medium text-gray-900">用户名修改成功</p>
              </div>
            ) : (
              <form onSubmit={handleUpdateName} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    新用户名
                  </label>
                  <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    required
                    maxLength={50}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                    placeholder="请输入新用户名"
                  />
                </div>

                {nameError && (
                  <p className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">{nameError}</p>
                )}

                <button
                  type="submit"
                  disabled={nameLoading}
                  className="mobile-touch-target w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium rounded-xl transition"
                >
                  {nameLoading ? '保存中...' : '保存'}
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {/* 修改密码弹窗 */}
      {activeModal === 'changePassword' && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center" onClick={closeModal}>
          <div
            className="w-full max-w-md rounded-t-3xl bg-white p-5 pb-safe shadow-2xl sm:rounded-2xl sm:p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-gray-200 sm:hidden" />
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-gray-900">修改密码</h3>
              <button onClick={closeModal} className="mobile-touch-target inline-flex items-center justify-center rounded-full p-2 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>

            {passwordSuccess ? (
              <div className="flex flex-col items-center py-8">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
                  <Check size={32} className="text-green-600" />
                </div>
                <p className="text-lg font-medium text-gray-900">密码修改成功</p>
              </div>
            ) : (
              <form onSubmit={handleChangePassword} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    当前密码
                  </label>
                  <div className="relative">
                    <input
                      type={showCurrentPassword ? 'text' : 'password'}
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      required
                      className="w-full px-4 py-3 pr-12 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                      placeholder="请输入当前密码"
                    />
                    <button
                      type="button"
                      onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                      className="mobile-touch-target absolute right-2 top-1/2 inline-flex -translate-y-1/2 items-center justify-center rounded-full p-2 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
                    >
                      {showCurrentPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    新密码
                  </label>
                  <div className="relative">
                    <input
                      type={showNewPassword ? 'text' : 'password'}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      required
                      minLength={8}
                      className="w-full px-4 py-3 pr-12 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                      placeholder="至少8位，包含字母和数字"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="mobile-touch-target absolute right-2 top-1/2 inline-flex -translate-y-1/2 items-center justify-center rounded-full p-2 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
                    >
                      {showNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                  <p className="text-xs text-gray-400 mt-1">至少 8 位，包含字母和数字</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    确认新密码
                  </label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                    placeholder="再次输入新密码"
                  />
                </div>

                {passwordError && (
                  <p className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">{passwordError}</p>
                )}

                <button
                  type="submit"
                  disabled={passwordLoading}
                  className="mobile-touch-target w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium rounded-xl transition"
                >
                  {passwordLoading ? '修改中...' : '修改密码'}
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {/* 注销账户弹窗 */}
      {activeModal === 'deleteAccount' && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center" onClick={closeModal}>
          <div
            className="w-full max-w-md rounded-t-3xl bg-white p-5 pb-safe shadow-2xl sm:rounded-2xl sm:p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-gray-200 sm:hidden" />
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-red-600">注销账户</h3>
              <button onClick={closeModal} className="mobile-touch-target inline-flex items-center justify-center rounded-full p-2 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>

            <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6">
              <div className="flex items-start space-x-3">
                <AlertTriangle size={20} className="text-red-500 mt-0.5 flex-shrink-0" />
                <div className="text-sm text-red-700">
                  <p className="font-medium mb-1">此操作不可撤销！</p>
                  <p>注销账户将永久删除以下所有数据：</p>
                  <ul className="list-disc list-inside mt-1 space-y-0.5">
                    <li>您的账户信息</li>
                    <li>所有宝宝信息</li>
                    <li>所有喂养记录</li>
                    <li>所有健康记录</li>
                  </ul>
                </div>
              </div>
            </div>

            <form onSubmit={handleDeleteAccount} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  输入密码以确认身份
                </label>
                <input
                  type="password"
                  value={deletePassword}
                  onChange={(e) => setDeletePassword(e.target.value)}
                  required
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none"
                  placeholder="请输入您的密码"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  输入 <span className="font-bold text-red-600">确认注销</span> 以确认操作
                </label>
                <input
                  type="text"
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  required
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none"
                  placeholder={'请输入"确认注销"'}
                />
              </div>

              {deleteError && (
                <p className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">{deleteError}</p>
              )}

              <button
                type="submit"
                disabled={deleteLoading || deleteConfirmText !== '确认注销'}
                className="mobile-touch-target w-full py-3 px-4 bg-red-600 hover:bg-red-700 disabled:bg-gray-300 disabled:text-gray-500 text-white font-medium rounded-xl transition"
              >
                {deleteLoading ? '正在注销...' : '确认注销账户'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
