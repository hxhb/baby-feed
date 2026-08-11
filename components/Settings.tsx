'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { signOut } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import { extractDateStr, parseDateAsBeijing } from '@/lib/time'
import { useCopyToast } from '@/components/CopyToast'
import {
  Baby,
  PlusCircle,
  Trash2,
  Edit2,
  Copy,
  X,
  Key,
  KeyRound,
  UserPen,
  Check,
  Eye,
  EyeOff,
  LogOut,
  UserCog,
  MoreVertical,
  Webhook,
  Bell,
  LayoutGrid,
  Loader2,
  Mars,
  Venus,
} from 'lucide-react'
import AdaptiveDialog from '@/components/AdaptiveDialog'
import AccountDangerZone from '@/components/AccountDangerZone'
import SystemVersion from '@/components/SystemVersion'
import { clearPrivateClientState } from '@/lib/client-cache'

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
  currentVersion: string
  initialBabies?: BabyInfo[]
  activeBabyId?: string | null
}

type ModalType = 'addBaby' | 'editBaby' | 'editName' | 'changePassword' | null

export default function SettingsComponent({ userName, userEmail, currentVersion, initialBabies = [], activeBabyId: initialActiveBabyId }: Props) {
  const router = useRouter()
  const [babies, setBabies] = useState<BabyInfo[]>(initialBabies)
  const [loading, setLoading] = useState(initialBabies.length === 0)
  const [activeModal, setActiveModal] = useState<ModalType>(null)
  const [editingBaby, setEditingBaby] = useState<BabyInfo | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [openMenuBabyId, setOpenMenuBabyId] = useState<string | null>(null)
  const [accountMenuOpen, setAccountMenuOpen] = useState(false)
  const [currentActiveBabyId, setCurrentActiveBabyId] = useState<string | null>(
    initialActiveBabyId ?? (initialBabies.length > 0 ? initialBabies[0].id : null)
  )
  const { copyToClipboard } = useCopyToast()
  
  // 宝宝表单
  const [babyName, setBabyName] = useState('')
  const [birthDate, setBirthDate] = useState('')
  const [gender, setGender] = useState<'MALE' | 'FEMALE'>('MALE')
  const [babySaving, setBabySaving] = useState(false)
  const [babyError, setBabyError] = useState('')
  const babyDialogRef = useRef<HTMLDivElement>(null)
  const babyDialogPreviousFocusRef = useRef<HTMLElement | null>(null)

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

  const handleLogout = async () => {
    await clearPrivateClientState()
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
  const handleSaveBaby = async (e: React.FormEvent) => {
    e.preventDefault()
    if (babySaving) return

    const trimmedName = babyName.trim()
    if (!trimmedName || !birthDate) {
      setBabyError('请填写完整信息')
      return
    }

    const isEditing = activeModal === 'editBaby'
    if (isEditing && !editingBaby) return

    setBabySaving(true)
    setBabyError('')
    try {
      const response = await fetch(isEditing ? `/api/babies/${editingBaby?.id}` : '/api/babies', {
        method: isEditing ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmedName, birthDate, gender }),
      })
      const result = await response.json().catch(() => null)

      if (!response.ok) throw new Error(result?.error || (isEditing ? '更新失败' : '添加失败'))

      await fetchBabies()
      closeModal()
    } catch (saveError) {
      console.error(isEditing ? '更新失败:' : '添加失败:', saveError)
      setBabyError(saveError instanceof Error ? saveError.message : '保存失败，请重试')
    } finally {
      setBabySaving(false)
    }
  }

  const handleCopyBabyId = async (id: string) => {
    await copyToClipboard(id, '宝宝 ID 已复制')
  }

  const handleDeleteBaby = async (id: string) => {
    if (!confirm('确定要删除这个宝宝吗？所有相关记录也会被删除。')) return

    try {
      const response = await fetch(`/api/babies/${id}`, { method: 'DELETE' })
      if (response.ok) {
        // If the deleted baby was active, reset to first remaining baby
        if (currentActiveBabyId === id) {
          const remaining = babies.filter(b => b.id !== id)
          const newActiveId = remaining.length > 0 ? remaining[0].id : null
          setCurrentActiveBabyId(newActiveId)
          if (newActiveId) {
            fetch('/api/user/profile', {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ activeBabyId: newActiveId })
            }).catch(() => {})
          }
        }
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
    setBabyError('')
    setActiveModal('editBaby')
  }

  const handleSetActiveBaby = async (babyId: string) => {
    setOpenMenuBabyId(null)
    try {
      const response = await fetch('/api/user/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activeBabyId: babyId })
      })
      if (response.ok) {
        setCurrentActiveBabyId(babyId)
      }
    } catch (error) {
      console.error('设置活动宝宝失败:', error)
    }
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

  // =============== 通用 ===============
  const closeModal = useCallback(() => {
    setActiveModal(null)
    setEditingBaby(null)
    // 重置宝宝表单
    setBabyName('')
    setBirthDate('')
    setGender('MALE')
    setBabyError('')
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
  }, [displayName])

  const babyDialogOpen = activeModal === 'addBaby' || activeModal === 'editBaby'

  useEffect(() => {
    if (!babyDialogOpen) return

    babyDialogPreviousFocusRef.current = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null
    const focusTimer = window.setTimeout(() => {
      babyDialogRef.current?.querySelector<HTMLElement>('[data-autofocus]')?.focus()
    }, 0)

    return () => {
      window.clearTimeout(focusTimer)
      const previousFocus = babyDialogPreviousFocusRef.current
      window.setTimeout(() => previousFocus?.focus(), 0)
    }
  }, [babyDialogOpen])

  useEffect(() => {
    if (!babyDialogOpen) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        if (!babySaving) closeModal()
        return
      }
      if (event.key !== 'Tab' || !babyDialogRef.current) return

      const focusable = Array.from(babyDialogRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      ))
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
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [babyDialogOpen, babySaving, closeModal])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto space-y-4 px-3 pb-[calc(6rem+env(safe-area-inset-bottom,0px))] pt-4 sm:space-y-5 sm:px-4 md:pb-4">
      {/* 用户信息卡片 */}
      <div className="bg-white rounded-card p-5 shadow-card border border-blue-50 sm:p-6 lg:p-7">
        <h2 className="text-lg font-bold text-slate-900 mb-4">账户信息</h2>
        <div className="flex items-center space-x-4 mb-4">
          <div className="w-14 h-14 bg-gradient-to-br from-blue-400 to-blue-600 rounded-full flex items-center justify-center text-white text-xl font-bold">
            {displayName?.charAt(0)?.toUpperCase() || '?'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-slate-900 text-lg truncate">{displayName}</p>
            <p className="text-sm text-slate-500 truncate">{userEmail}</p>
          </div>
          {/* 修改用户名/密码 下拉按钮 */}
          <div className="relative shrink-0">
            <button
              onClick={() => setAccountMenuOpen(!accountMenuOpen)}
              className="mobile-touch-target inline-flex items-center justify-center rounded-button bg-slate-50 p-2.5 text-slate-500 transition hover:bg-slate-100"
              aria-label="账户操作"
            >
              <MoreVertical size={18} />
            </button>
            {accountMenuOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setAccountMenuOpen(false)} />
                <div className="absolute right-0 top-full z-20 mt-1 w-36 rounded-element border border-slate-200 bg-white py-1 shadow-elevated">
                  <button
                    onClick={() => {
                      setAccountMenuOpen(false)
                      setNewName(displayName)
                      setActiveModal('editName')
                    }}
                    className="flex w-full items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 transition"
                  >
                    <UserPen size={14} />
                    修改用户名
                  </button>
                  <button
                    onClick={() => {
                      setAccountMenuOpen(false)
                      setActiveModal('changePassword')
                    }}
                    className="flex w-full items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 transition"
                  >
                    <KeyRound size={14} />
                    修改密码
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        <div className="space-y-2 pt-2 border-t border-gray-100">
          <button
            onClick={() => router.push('/settings/quick-records')}
            className="mobile-touch-target w-full flex items-center justify-between rounded-xl px-2 py-3 text-left transition group hover:bg-gray-50"
          >
            <div className="flex items-center space-x-3">
              <LayoutGrid size={18} className="text-slate-400 group-hover:text-emerald-500 transition" />
              <span className="text-slate-700">快捷记录管理</span>
            </div>
            <span className="text-slate-400 text-sm">›</span>
          </button>

          <button
            onClick={() => router.push('/settings/api-keys')}
            className="mobile-touch-target w-full flex items-center justify-between rounded-xl px-2 py-3 text-left transition group hover:bg-gray-50"
          >
            <div className="flex items-center space-x-3">
              <Key size={18} className="text-slate-400 group-hover:text-blue-500 transition" />
              <span className="text-slate-700">API Key 管理</span>
            </div>
            <span className="text-slate-400 text-sm">›</span>
          </button>

          <button
            onClick={() => router.push('/settings/webhooks')}
            className="mobile-touch-target w-full flex items-center justify-between rounded-xl px-2 py-3 text-left transition group hover:bg-gray-50"
          >
            <div className="flex items-center space-x-3">
              <Webhook size={18} className="text-slate-400 group-hover:text-blue-500 transition" />
              <span className="text-slate-700">Webhook 管理</span>
            </div>
            <span className="text-slate-400 text-sm">›</span>
          </button>

          <button
            onClick={() => router.push('/settings/reminders')}
            className="mobile-touch-target w-full flex items-center justify-between rounded-xl px-2 py-3 text-left transition group hover:bg-gray-50"
          >
            <div className="flex items-center space-x-3">
              <Bell size={18} className="text-slate-400 group-hover:text-violet-500 transition" />
              <span className="text-slate-700">提醒管理</span>
            </div>
            <span className="text-slate-400 text-sm">›</span>
          </button>

          {isAdmin && (
            <button
              onClick={() => router.push('/admin')}
              className="mobile-touch-target w-full flex items-center justify-between rounded-xl px-2 py-3 text-left transition group hover:bg-gray-50"
            >
              <div className="flex items-center space-x-3">
                <UserCog size={18} className="text-slate-400 group-hover:text-purple-500 transition" />
                <span className="text-slate-700">站点管理</span>
              </div>
              <span className="text-slate-400 text-sm">›</span>
            </button>
          )}

          <button
            onClick={handleLogout}
            className="mobile-touch-target w-full flex items-center justify-between rounded-xl px-2 py-3 text-left transition group hover:bg-gray-50"
          >
            <div className="flex items-center space-x-3">
              <LogOut size={18} className="text-slate-400 group-hover:text-orange-500 transition" />
              <span className="text-slate-700">退出登录</span>
            </div>
            <span className="text-slate-400 text-sm">›</span>
          </button>
        </div>
      </div>

      {/* 宝宝管理 */}
      <div className="bg-white rounded-card p-5 shadow-card border border-blue-50 sm:p-6 lg:p-7">
        <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-lg font-bold text-slate-900">宝宝管理</h2>
          <button
            onClick={() => {
              setBabyName('')
              setBirthDate('')
              setGender('MALE')
              setBabyError('')
              setActiveModal('addBaby')
            }}
            className="mobile-touch-target inline-flex w-full items-center justify-center rounded-xl bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-700 transition hover:bg-blue-100 sm:w-auto"
          >
            <PlusCircle size={16} className="mr-1.5" />
            添加宝宝
          </button>
        </div>

        {babies.length === 0 ? (
          <div className="text-center py-8 text-slate-500">
            <Baby size={48} className="mx-auto mb-2 text-gray-300" />
            <p>还没有添加宝宝</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {babies.map(baby => (
              <div
                key={baby.id}
                className={`rounded-xl border px-3 py-2.5 shadow-sm ${currentActiveBabyId === baby.id ? 'border-blue-300 bg-blue-50/50 shadow-blue-100' : 'border-slate-200 bg-slate-50/80 shadow-slate-100'}`}
              >
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-pink-100 to-blue-100">
                    <Baby size={18} className="text-blue-600" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <p className="text-sm font-semibold text-slate-900 break-words">{baby.name}</p>
                      <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${baby.gender === 'MALE' ? 'bg-blue-100 text-blue-700' : 'bg-pink-100 text-pink-700'}`}>
                        {baby.gender === 'MALE' ? '男宝' : '女宝'}
                      </span>
                      {currentActiveBabyId === baby.id && (
                        <span className="rounded-full px-1.5 py-0.5 text-[10px] font-semibold bg-emerald-100 text-emerald-700">
                          活动
                        </span>
                      )}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-slate-500">
                      <span>出生 {format(parseDateAsBeijing(baby.birthDate), 'yyyy年MM月dd日', { locale: zhCN })}</span>
                      <span className="text-slate-300">•</span>
                      <span>创建于 {format(parseDateAsBeijing(baby.createdAt), 'yyyy年MM月dd日', { locale: zhCN })}</span>
                    </div>
                  </div>
                  <div className="relative shrink-0">
                    <button
                      onClick={() => setOpenMenuBabyId(openMenuBabyId === baby.id ? null : baby.id)}
                      className="mobile-touch-target inline-flex items-center justify-center rounded-button bg-white p-2 text-slate-500 transition hover:bg-slate-100"
                      aria-label="更多操作"
                    >
                      <MoreVertical size={18} />
                    </button>
                    {openMenuBabyId === baby.id && (
                      <>
                        <div className="fixed inset-0 z-10" onClick={() => setOpenMenuBabyId(null)} />
                        <div className="absolute right-0 top-full z-20 mt-1 w-36 rounded-element border border-slate-200 bg-white py-1 shadow-elevated">
                          {currentActiveBabyId !== baby.id && (
                            <button
                              onClick={() => handleSetActiveBaby(baby.id)}
                              className="flex w-full items-center gap-2 px-3 py-2 text-sm text-blue-600 hover:bg-blue-50 transition"
                            >
                              <Check size={14} />
                              设为活动
                            </button>
                          )}
                          <button
                            onClick={() => { handleCopyBabyId(baby.id); setOpenMenuBabyId(null) }}
                            className="flex w-full items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 transition"
                          >
                            <Copy size={14} />
                            复制 ID
                          </button>
                          <button
                            onClick={() => { openEditBabyModal(baby); setOpenMenuBabyId(null) }}
                            className="flex w-full items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 transition"
                          >
                            <Edit2 size={14} />
                            编辑资料
                          </button>
                          <button
                            onClick={() => { handleDeleteBaby(baby.id); setOpenMenuBabyId(null) }}
                            className="flex w-full items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition"
                          >
                            <Trash2 size={14} />
                            删除宝宝
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <AccountDangerZone />

      <SystemVersion currentVersion={currentVersion} />

      {/* ========== 弹窗区域 ========== */}

      {/* 添加/编辑宝宝弹窗 */}
      {babyDialogOpen && (
        <AdaptiveDialog
          ref={babyDialogRef}
          labelledBy="baby-dialog-title"
          describedBy="baby-dialog-description"
          onDismiss={() => { if (!babySaving) closeModal() }}
          maxWidthClassName="sm:max-w-md"
          zIndexClassName="z-50"
        >
          <header className="flex min-h-16 items-center gap-3 border-b border-slate-200 px-4 sm:px-5">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600" aria-hidden="true">
              <Baby size={20} />
            </div>
            <div className="min-w-0 flex-1">
              <h3 id="baby-dialog-title" className="truncate text-lg font-semibold text-slate-950">
                {activeModal === 'editBaby' ? '编辑宝宝' : '添加宝宝'}
              </h3>
              <p id="baby-dialog-description" className="truncate text-sm text-slate-600">填写宝宝的基本资料</p>
            </div>
            <button
              type="button"
              onClick={closeModal}
              disabled={babySaving}
              aria-label="关闭宝宝资料面板"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-slate-600 transition hover:bg-slate-100 disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              <X size={21} />
            </button>
          </header>

          <form onSubmit={handleSaveBaby} className="flex min-h-0 flex-1 flex-col">
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-5 sm:px-5">
              {babyError ? (
                <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
                  {babyError}
                </div>
              ) : null}

              <div>
                <label htmlFor="baby-name" className="mb-2 block text-sm font-medium text-slate-700">宝宝姓名</label>
                <input
                  id="baby-name"
                  type="text"
                  value={babyName}
                  onChange={(e) => { setBabyName(e.target.value); setBabyError('') }}
                  required
                  autoComplete="name"
                  data-autofocus
                  className="min-h-12 w-full rounded-lg border border-slate-300 px-3.5 text-base outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 sm:text-sm"
                  placeholder="请输入宝宝姓名"
                />
              </div>

              <div>
                <label htmlFor="baby-birth-date" className="mb-2 block text-sm font-medium text-slate-700">出生日期</label>
                <input
                  id="baby-birth-date"
                  type="date"
                  value={birthDate}
                  onChange={(e) => { setBirthDate(e.target.value); setBabyError('') }}
                  required
                  className="min-h-12 w-full min-w-0 rounded-lg border border-slate-300 px-3.5 text-base outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 sm:text-sm"
                />
              </div>

              <fieldset>
                <legend className="mb-2 text-sm font-medium text-slate-700">性别</legend>
                <div className="grid grid-cols-2 gap-2 rounded-lg bg-slate-100 p-1" role="radiogroup" aria-label="宝宝性别">
                  <button
                    type="button"
                    role="radio"
                    aria-checked={gender === 'MALE'}
                    onClick={() => setGender('MALE')}
                    className={`flex min-h-11 items-center justify-center gap-2 rounded-md px-3 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                      gender === 'MALE' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Mars size={17} />男宝
                  </button>
                  <button
                    type="button"
                    role="radio"
                    aria-checked={gender === 'FEMALE'}
                    onClick={() => setGender('FEMALE')}
                    className={`flex min-h-11 items-center justify-center gap-2 rounded-md px-3 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink-500 ${
                      gender === 'FEMALE' ? 'bg-white text-pink-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Venus size={17} />女宝
                  </button>
                </div>
              </fieldset>
            </div>

            <footer className="border-t border-slate-200 px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] pt-3 sm:px-5 sm:pb-4">
              <button
                type="submit"
                disabled={babySaving}
                className="flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
              >
                {babySaving ? <Loader2 size={17} className="animate-spin" /> : null}
                {babySaving ? '保存中' : activeModal === 'editBaby' ? '保存修改' : '添加宝宝'}
              </button>
            </footer>
          </form>
        </AdaptiveDialog>
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
              <h3 className="text-xl font-bold text-slate-900">修改用户名</h3>
              <button onClick={closeModal} className="mobile-touch-target inline-flex items-center justify-center rounded-full p-2 text-slate-400 transition hover:bg-gray-100 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>

            {nameSuccess ? (
              <div className="flex flex-col items-center py-8">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
                  <Check size={32} className="text-green-600" />
                </div>
                <p className="text-lg font-medium text-slate-900">用户名修改成功</p>
              </div>
            ) : (
              <form onSubmit={handleUpdateName} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
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
                  className="mobile-touch-target w-full py-3 px-4 gradient-primary shadow-elevated disabled:opacity-50 text-white font-medium rounded-xl transition"
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
              <h3 className="text-xl font-bold text-slate-900">修改密码</h3>
              <button onClick={closeModal} className="mobile-touch-target inline-flex items-center justify-center rounded-full p-2 text-slate-400 transition hover:bg-gray-100 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>

            {passwordSuccess ? (
              <div className="flex flex-col items-center py-8">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
                  <Check size={32} className="text-green-600" />
                </div>
                <p className="text-lg font-medium text-slate-900">密码修改成功</p>
              </div>
            ) : (
              <form onSubmit={handleChangePassword} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
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
                      className="mobile-touch-target absolute right-2 top-1/2 inline-flex -translate-y-1/2 items-center justify-center rounded-full p-2 text-slate-400 transition hover:bg-gray-100 hover:text-slate-600"
                    >
                      {showCurrentPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
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
                      className="mobile-touch-target absolute right-2 top-1/2 inline-flex -translate-y-1/2 items-center justify-center rounded-full p-2 text-slate-400 transition hover:bg-gray-100 hover:text-slate-600"
                    >
                      {showNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}
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
                  className="mobile-touch-target w-full py-3 px-4 gradient-primary shadow-elevated disabled:opacity-50 text-white font-medium rounded-xl transition"
                >
                  {passwordLoading ? '修改中...' : '修改密码'}
                </button>
              </form>
            )}
          </div>
        </div>
      )}

    </div>
  )
}
