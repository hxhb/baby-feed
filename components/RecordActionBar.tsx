'use client'

import { Check } from 'lucide-react'

interface Props {
  mode?: 'create' | 'edit'
  submitError?: string
  validationMessage?: string
  primaryLabel: string
  loadingLabel?: string
  loading?: boolean
  disabled?: boolean
  onPrimaryClick?: () => void
  onCancel?: () => void
}

export default function RecordActionBar({
  mode = 'create',
  submitError = '',
  validationMessage = '',
  primaryLabel,
  loadingLabel = '保存中...',
  loading = false,
  disabled = false,
  onPrimaryClick,
  onCancel,
}: Props) {
  const wrapperClassName = mode === 'create'
    ? 'sticky bottom-0 z-10 rounded-card border border-blue-50 bg-white/95 p-3 shadow-nav backdrop-blur sm:bottom-4 sm:p-3.5 sm:shadow-sm'
    : 'sticky bottom-0 -mx-4 border-t border-slate-100 bg-white/95 px-4 pt-3 backdrop-blur sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:px-0'

  return (
    <div className={wrapperClassName}>
      {submitError ? (
        <div className="mb-2.5 rounded-2xl border border-red-100 bg-red-50 px-3.5 py-2.5 text-sm text-red-600" role="alert">
          {submitError}
        </div>
      ) : null}
      {!submitError && validationMessage ? (
        <div className="mb-2.5 rounded-2xl border border-amber-100 bg-amber-50 px-3.5 py-2.5 text-sm text-amber-700">
          {validationMessage}
        </div>
      ) : null}

      {mode === 'edit' ? (
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="mobile-touch-target flex-1 rounded-button bg-slate-100 px-4 py-3 text-sm font-medium text-slate-600 transition hover:bg-slate-200"
          >
            取消
          </button>
          <button
            type="button"
            onClick={onPrimaryClick}
            disabled={loading || disabled}
            className="mobile-touch-target flex flex-1 items-center justify-center gap-1 rounded-button gradient-primary px-4 py-3 text-sm font-medium text-white shadow-elevated transition hover:opacity-90 disabled:opacity-50"
          >
            {loading ? loadingLabel : (<><Check size={16} />{primaryLabel}</>)}
          </button>
        </div>
      ) : (
        <button
          type="submit"
          disabled={loading || disabled}
          className="mobile-touch-target w-full rounded-button gradient-primary px-4 py-3 font-medium text-white shadow-elevated transition hover:opacity-90 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? loadingLabel : primaryLabel}
        </button>
      )}
    </div>
  )
}
