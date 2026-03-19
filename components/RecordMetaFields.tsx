'use client'

import { Clock } from 'lucide-react'

interface RecordTimeFieldProps {
  label?: string
  value: string
  onChange: (value: string) => void
  mode?: 'create' | 'edit'
}

interface RecordNotesFieldProps {
  label?: string
  value: string
  onChange: (value: string) => void
  mode?: 'create' | 'edit'
  rows?: number
  placeholder?: string
  clearable?: boolean
}

export function RecordTimeField({
  label = '记录时间',
  value,
  onChange,
  mode = 'create',
}: RecordTimeFieldProps) {
  const wrapperClassName = mode === 'create'
    ? 'rounded-2xl border border-gray-100 bg-white p-2.5 shadow-sm sm:p-3'
    : ''
  const inputClassName = mode === 'create'
    ? 'w-full rounded-xl border border-gray-300 px-3 py-2 text-sm outline-none transition focus:border-transparent focus:ring-2 focus:ring-blue-500'
    : 'w-full rounded-xl border border-gray-300 px-4 py-3 text-base outline-none focus:border-transparent focus:ring-2 focus:ring-blue-500'

  return (
    <div className={wrapperClassName}>
      <div className="mb-1 flex items-center justify-between gap-2">
        <label className="block text-sm font-medium text-gray-700">
          <Clock size={14} className="mr-1 inline" />
          {label}
        </label>
      </div>
      <input
        type="datetime-local"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={inputClassName}
      />
    </div>
  )
}

export function RecordNotesField({
  label = '备注（可选）',
  value,
  onChange,
  mode = 'create',
  rows = 2,
  placeholder = '添加备注...',
  clearable = true,
}: RecordNotesFieldProps) {
  const wrapperClassName = mode === 'create'
    ? 'rounded-2xl border border-gray-100 bg-white p-3.5 shadow-sm sm:p-4'
    : ''
  const textareaClassName = mode === 'create'
    ? 'w-full resize-none rounded-xl border border-gray-300 px-3.5 py-2.5 text-sm outline-none transition focus:border-transparent focus:ring-2 focus:ring-blue-500'
    : 'w-full resize-none rounded-xl border border-gray-300 px-4 py-3 text-base outline-none focus:border-transparent focus:ring-2 focus:ring-blue-500'

  return (
    <div className={wrapperClassName}>
      <div className="mb-1.5 flex items-center justify-between gap-3">
        <label className="block text-sm font-medium text-gray-700">
          {label}
        </label>
        {clearable && value ? (
          <button
            type="button"
            onClick={() => onChange('')}
            className="mobile-touch-target rounded-lg bg-gray-50 px-2 py-1 text-[11px] font-medium text-gray-500 transition hover:bg-gray-100 hover:text-gray-700"
          >
            清空
          </button>
        ) : null}
      </div>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={rows}
        className={textareaClassName}
        placeholder={placeholder}
      />
    </div>
  )
}
