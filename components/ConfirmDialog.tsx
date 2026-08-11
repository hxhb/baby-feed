'use client'

import { useEffect } from 'react'
import { AlertTriangle, CheckCircle2 } from 'lucide-react'

interface Props {
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: 'danger' | 'primary'
  loading?: boolean
  loadingLabel?: string
  errorMessage?: string
  onConfirm: () => void
  onCancel: () => void
}

export default function ConfirmDialog({
  title,
  message,
  confirmLabel = '确认',
  cancelLabel = '取消',
  variant = 'primary',
  loading = false,
  loadingLabel = '处理中...',
  errorMessage,
  onConfirm,
  onCancel,
}: Props) {
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = ''
    }
  }, [])

  const Icon = variant === 'danger' ? AlertTriangle : CheckCircle2
  const iconColor = variant === 'danger' ? 'text-red-500' : 'text-blue-500'
  const confirmClassName = variant === 'danger'
    ? 'bg-red-500 hover:bg-red-600 text-white'
    : 'gradient-primary text-white shadow-elevated'

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 px-4" onClick={() => !loading && onCancel()}>
      <div
        aria-busy={loading}
        className="bg-white rounded-card p-5 sm:p-6 max-w-sm w-full shadow-elevated border border-blue-50"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3 mb-4">
          <div className={`mt-0.5 ${iconColor}`}>
            <Icon size={22} />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-900">{title}</h3>
            <p className="text-sm text-slate-600 mt-1">{message}</p>
          </div>
        </div>
        {errorMessage ? (
          <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
            {errorMessage}
          </p>
        ) : null}
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="flex-1 py-2.5 px-4 bg-slate-100 text-slate-700 font-medium rounded-button hover:bg-slate-200 transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className={`flex-1 py-2.5 px-4 font-medium rounded-button transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 ${confirmClassName}`}
          >
            {loading ? loadingLabel : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
