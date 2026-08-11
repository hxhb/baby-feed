'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { signOut } from 'next-auth/react'
import { AlertTriangle, ChevronDown, Loader2, Trash2, X } from 'lucide-react'
import AdaptiveDialog from '@/components/AdaptiveDialog'
import { clearPrivateClientState } from '@/lib/client-cache'

export default function AccountDangerZone() {
  const [expanded, setExpanded] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [password, setPassword] = useState('')
  const [confirmText, setConfirmText] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')
  const dialogRef = useRef<HTMLDivElement>(null)
  const previousFocusRef = useRef<HTMLElement | null>(null)

  const closeDialog = useCallback(() => {
    if (deleting) return
    setDialogOpen(false)
    setPassword('')
    setConfirmText('')
    setError('')
  }, [deleting])

  useEffect(() => {
    if (!dialogOpen) return

    previousFocusRef.current = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null
    const { overflow } = document.body.style
    document.body.style.overflow = 'hidden'
    const focusTimer = window.setTimeout(() => {
      dialogRef.current?.querySelector<HTMLElement>('[data-autofocus]')?.focus()
    }, 0)

    return () => {
      window.clearTimeout(focusTimer)
      document.body.style.overflow = overflow
      const previousFocus = previousFocusRef.current
      window.setTimeout(() => previousFocus?.focus(), 0)
    }
  }, [dialogOpen])

  useEffect(() => {
    if (!dialogOpen) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        closeDialog()
        return
      }
      if (event.key !== 'Tab' || !dialogRef.current) return

      const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])',
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
  }, [closeDialog, dialogOpen])

  const handleDeleteAccount = async (event: React.FormEvent) => {
    event.preventDefault()
    if (deleting) return

    setError('')
    if (!password) {
      setError('请输入密码')
      return
    }
    if (confirmText !== '确认注销') {
      setError('请输入“确认注销”以确认操作')
      return
    }

    setDeleting(true)
    try {
      const response = await fetch('/api/user/delete', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })
      const result = await response.json().catch(() => null) as { error?: string } | null
      if (!response.ok) throw new Error(result?.error || '注销失败')

      await clearPrivateClientState()
      await signOut({ callbackUrl: '/login' })
    } catch (deleteError) {
      console.error('注销账户失败:', deleteError)
      setError(deleteError instanceof Error ? deleteError.message : '注销失败，请重试')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="bg-white rounded-card px-5 py-4 shadow-card border border-slate-200 sm:px-6">
      <button
        type="button"
        onClick={() => setExpanded(value => !value)}
        aria-expanded={expanded}
        aria-controls="account-danger-content"
        className="mobile-touch-target flex w-full items-center gap-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-red-50 text-red-600" aria-hidden="true">
          <AlertTriangle size={17} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-slate-900">账户与数据</span>
          <span className="block text-xs text-slate-500">注销账户</span>
        </span>
        <ChevronDown
          size={18}
          className={`shrink-0 text-slate-400 transition-transform ${expanded ? 'rotate-180' : ''}`}
        />
      </button>

      {expanded && (
        <div id="account-danger-content" className="mt-4 flex flex-col gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-slate-600">注销后，账户和全部记录将被永久删除。</p>
          <button
            type="button"
            onClick={() => setDialogOpen(true)}
            className="mobile-touch-target inline-flex w-full shrink-0 items-center justify-center gap-2 rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-700 transition hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 sm:w-auto"
          >
            <Trash2 size={15} />
            注销账户
          </button>
        </div>
      )}

      {dialogOpen && (
        <AdaptiveDialog
          ref={dialogRef}
          labelledBy="delete-account-title"
          describedBy="delete-account-description"
          onDismiss={closeDialog}
          maxWidthClassName="sm:max-w-md"
          zIndexClassName="z-[80]"
        >
          <header className="flex min-h-16 items-center gap-3 border-b border-slate-200 px-4 sm:px-5">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-red-50 text-red-600" aria-hidden="true">
              <AlertTriangle size={20} />
            </span>
            <div className="min-w-0 flex-1">
              <h3 id="delete-account-title" className="text-lg font-semibold text-slate-950">注销账户</h3>
              <p id="delete-account-description" className="text-sm text-slate-600">此操作不可撤销</p>
            </div>
            <button
              type="button"
              onClick={closeDialog}
              disabled={deleting}
              aria-label="关闭注销账户面板"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-slate-600 transition hover:bg-slate-100 disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
            >
              <X size={21} />
            </button>
          </header>

          <form onSubmit={handleDeleteAccount} className="flex min-h-0 flex-1 flex-col">
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-5 sm:px-5">
              <div className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-3 text-sm text-red-800">
                账户信息、宝宝资料及所有记录都将被永久删除。
              </div>

              <div>
                <label htmlFor="delete-account-password" className="mb-2 block text-sm font-medium text-slate-700">当前密码</label>
                <input
                  id="delete-account-password"
                  type="password"
                  value={password}
                  onChange={(event) => { setPassword(event.target.value); setError('') }}
                  required
                  autoComplete="current-password"
                  data-autofocus
                  className="min-h-12 w-full rounded-lg border border-slate-300 px-3.5 text-base outline-none transition focus:border-red-500 focus:ring-2 focus:ring-red-500/20 sm:text-sm"
                  placeholder="请输入当前密码"
                />
              </div>

              <div>
                <label htmlFor="delete-account-confirm" className="mb-2 block text-sm font-medium text-slate-700">
                  输入 <span className="font-semibold text-red-700">确认注销</span>
                </label>
                <input
                  id="delete-account-confirm"
                  type="text"
                  value={confirmText}
                  onChange={(event) => { setConfirmText(event.target.value); setError('') }}
                  required
                  autoComplete="off"
                  className="min-h-12 w-full rounded-lg border border-slate-300 px-3.5 text-base outline-none transition focus:border-red-500 focus:ring-2 focus:ring-red-500/20 sm:text-sm"
                  placeholder="确认注销"
                />
              </div>

              {error && (
                <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">{error}</div>
              )}
            </div>

            <footer className="grid grid-cols-2 gap-2 border-t border-slate-200 px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] pt-3 sm:px-5 sm:pb-4">
              <button
                type="button"
                onClick={closeDialog}
                disabled={deleting}
                className="min-h-11 rounded-lg border border-slate-300 px-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-500"
              >
                取消
              </button>
              <button
                type="submit"
                disabled={deleting || confirmText !== '确认注销'}
                className="flex min-h-11 items-center justify-center gap-2 rounded-lg bg-red-600 px-3 text-sm font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2"
              >
                {deleting && <Loader2 size={16} className="animate-spin" />}
                {deleting ? '正在注销' : '确认注销'}
              </button>
            </footer>
          </form>
        </AdaptiveDialog>
      )}
    </div>
  )
}
