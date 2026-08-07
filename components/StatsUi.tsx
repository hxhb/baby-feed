'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { CalendarDays, LoaderCircle, PencilLine, type LucideIcon } from 'lucide-react'

interface StatsPanelProps {
  children: ReactNode
  className?: string
  padding?: 'default' | 'compact' | 'toolbar' | 'none'
}

interface StatsEmptyStateProps {
  icon: LucideIcon
  title: string
  description?: string
  className?: string
}

interface StatsSegmentedTabItem {
  key: string
  label: string
  description?: string
  icon?: LucideIcon
  disabled?: boolean
}

interface StatsSegmentedTabsProps {
  items: StatsSegmentedTabItem[]
  value: string
  onChange: (value: string) => void
  className?: string
}

interface StatsRangePickerProps {
  value: number | 'custom'
  onChange: (value: number) => void
  customStartDate: string
  customEndDate: string
  maxDate: string
  onApplyCustomRange: (startDate: string, endDate: string) => void
  options?: number[]
  loading?: boolean
  className?: string
}

const statsPanelPaddingClasses = {
  default: 'p-4',
  compact: 'p-3',
  toolbar: 'p-2 sm:p-3',
  none: 'p-0',
}

export function StatsPanel({ children, className = '', padding = 'default' }: StatsPanelProps) {
  return (
    <div className={`rounded-card border border-slate-200 bg-white shadow-card ${statsPanelPaddingClasses[padding]} ${className}`.trim()}>
      {children}
    </div>
  )
}

export function StatsEmptyState({
  icon: Icon,
  title,
  description,
  className = 'py-8 text-center text-slate-400',
}: StatsEmptyStateProps) {
  return (
    <div className={className}>
      <Icon size={32} className="mx-auto mb-2 opacity-50" />
      <p className="text-sm">{title}</p>
      {description ? <p className="mt-1 text-xs">{description}</p> : null}
    </div>
  )
}

export function StatsSegmentedTabs({
  items,
  value,
  onChange,
  className = '',
}: StatsSegmentedTabsProps) {
  return (
    <nav
      aria-label="统计视图"
      className={`grid grid-cols-3 gap-1 rounded-card border border-slate-100 bg-slate-100/80 p-1 lg:flex lg:flex-wrap ${className}`.trim()}
    >
      {items.map(item => {
        const active = item.key === value
        const Icon = item.icon

        return (
          <button
            key={item.key}
            type="button"
            onClick={() => !item.disabled && onChange(item.key)}
            disabled={item.disabled}
            aria-current={active ? 'page' : undefined}
            aria-label={item.description ? `${item.label}：${item.description}` : item.label}
            className={`group flex min-h-[52px] min-w-0 items-center justify-center gap-1 rounded-button px-1.5 py-1.5 text-xs font-semibold transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1 sm:gap-2 sm:text-sm lg:min-h-11 lg:flex-none lg:px-3.5 lg:py-2 ${
              active
                ? 'bg-white text-blue-700 shadow-card'
                : item.disabled
                  ? 'cursor-not-allowed text-slate-300'
                  : 'text-slate-500 hover:bg-white/60 hover:text-slate-700 active:bg-white/80'
            }`}
            title={item.description}
          >
            {Icon ? (
              <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition-colors duration-200 ${
                active ? 'bg-blue-600 text-white' : 'bg-white/70 text-slate-400 group-hover:text-slate-600'
              }`}>
                <Icon size={16} strokeWidth={2} aria-hidden="true" />
              </span>
            ) : null}
            <span className="min-w-0 leading-tight">{item.label}</span>
          </button>
        )
      })}
    </nav>
  )
}

export function StatsRangePicker({
  value,
  onChange,
  customStartDate,
  customEndDate,
  maxDate,
  onApplyCustomRange,
  options = [7, 14, 30],
  loading = false,
  className = '',
}: StatsRangePickerProps) {
  const [showCustomRange, setShowCustomRange] = useState(false)
  const [draftStartDate, setDraftStartDate] = useState(customStartDate)
  const [draftEndDate, setDraftEndDate] = useState(customEndDate)
  const [rangeError, setRangeError] = useState('')

  useEffect(() => {
    setDraftStartDate(customStartDate)
    setDraftEndDate(customEndDate)
  }, [customEndDate, customStartDate])

  const rangeLabel = value === 'custom'
    ? `${customStartDate.slice(5).replace('-', '/')} - ${customEndDate.slice(5).replace('-', '/')}`
    : `近 ${value} 天`

  const handleChoice = (nextValue: string) => {
    if (nextValue === 'custom') {
      setDraftStartDate(customStartDate)
      setDraftEndDate(customEndDate)
      setShowCustomRange(true)
      setRangeError('')
      return
    }

    setShowCustomRange(false)
    onChange(Number(nextValue))
  }

  const handleCustomSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!draftStartDate || !draftEndDate) {
      setRangeError('请选择开始和结束日期')
      return
    }
    const start = new Date(`${draftStartDate}T00:00:00Z`)
    const end = new Date(`${draftEndDate}T00:00:00Z`)
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      setRangeError('请选择有效的日期范围')
      return
    }
    if (draftEndDate > maxDate) {
      setRangeError('结束日期不能晚于今天')
      return
    }
    if (start > end) {
      setRangeError('开始日期不能晚于结束日期')
      return
    }
    const rangeDays = Math.floor((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)) + 1
    if (rangeDays > 365) {
      setRangeError('日期范围不能超过365天')
      return
    }

    setRangeError('')
    onApplyCustomRange(draftStartDate, draftEndDate)
    setShowCustomRange(false)
  }

  return (
    <div className={`relative w-full lg:w-auto ${className}`.trim()}>
      <div className="flex w-full items-center justify-between gap-3 lg:w-auto lg:justify-end">
        <div className="flex items-center gap-2 text-slate-500">
          <CalendarDays size={16} className="text-blue-600" aria-hidden="true" />
          <span className="flex flex-col">
            <span id="stats-range-label" className="text-xs font-semibold sm:text-sm">数据范围</span>
            <span className="text-[11px] font-medium text-slate-400 lg:hidden">{rangeLabel}</span>
          </span>
        </div>

        <div className="flex items-center gap-2 lg:hidden">
          <div className="relative">
            {loading ? (
              <LoaderCircle
                size={15}
                className="pointer-events-none absolute left-3 top-1/2 z-10 -translate-y-1/2 animate-spin text-blue-600 motion-reduce:animate-none"
                aria-hidden="true"
              />
            ) : null}
            <select
              aria-labelledby="stats-range-label"
              aria-busy={loading}
              value={showCustomRange ? 'custom' : value}
              onChange={(event) => handleChoice(event.target.value)}
              className={`min-h-11 w-[124px] rounded-button border border-slate-200 bg-white py-2 pr-9 text-sm font-semibold text-slate-700 shadow-sm outline-none transition-colors focus:border-blue-400 focus:ring-2 focus:ring-blue-100 ${loading ? 'pl-9' : 'pl-3'}`}
            >
              {options.map(option => (
                <option key={option} value={option}>近 {option} 天</option>
              ))}
              <option value="custom">自定义日期</option>
            </select>
          </div>
          {value === 'custom' || showCustomRange ? (
            <button
              type="button"
              onClick={() => handleChoice('custom')}
              aria-label="修改自定义日期范围"
              aria-expanded={showCustomRange}
              title="修改自定义日期范围"
              className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-button border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                showCustomRange
                  ? 'border-blue-200 bg-blue-50 text-blue-700'
                  : 'border-slate-200 bg-white text-slate-500 shadow-sm hover:border-blue-200 hover:text-blue-700'
              }`}
            >
              <PencilLine size={17} aria-hidden="true" />
            </button>
          ) : null}
        </div>

        <div
          className="hidden grid-cols-4 gap-1 rounded-card bg-slate-100 p-1 lg:grid"
          aria-label="选择数据范围"
          aria-busy={loading}
        >
          {options.map(option => (
            <button
              key={option}
              type="button"
              onClick={() => handleChoice(String(option))}
              aria-pressed={value === option}
              className={`min-h-11 min-w-[64px] rounded-button px-3 py-2 text-sm font-semibold transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                value === option
                  ? 'bg-white text-blue-700 shadow-card'
                  : 'text-slate-500 hover:bg-white/60 hover:text-slate-700'
              }`}
            >
              {loading && value === option ? (
                <LoaderCircle size={15} className="mx-auto animate-spin motion-reduce:animate-none" aria-label="正在更新数据" />
              ) : `${option}天`}
            </button>
          ))}
          <button
            type="button"
            onClick={() => handleChoice('custom')}
            aria-pressed={value === 'custom'}
            className={`min-h-11 min-w-[76px] rounded-button px-3 py-2 text-sm font-semibold transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
              value === 'custom'
                ? 'bg-white text-blue-700 shadow-card'
                : 'text-slate-500 hover:bg-white/60 hover:text-slate-700'
            }`}
          >
            {loading && value === 'custom' ? (
              <LoaderCircle size={15} className="mx-auto animate-spin motion-reduce:animate-none" aria-label="正在更新数据" />
            ) : value === 'custom' ? (
              <span className="flex items-center justify-center gap-1"><PencilLine size={14} aria-hidden="true" />修改</span>
            ) : '自定义'}
          </button>
        </div>
      </div>

      {showCustomRange ? (
        <form
          onSubmit={handleCustomSubmit}
          className="mt-2 border-t border-slate-100 pt-3 lg:absolute lg:right-0 lg:top-full lg:z-20 lg:mt-2 lg:w-[420px] lg:rounded-card lg:border lg:border-slate-200 lg:bg-white lg:p-4 lg:shadow-elevated"
          aria-label="自定义日期范围"
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="space-y-1.5 text-xs font-semibold text-slate-600">
              <span>开始日期</span>
              <input
                type="date"
                value={draftStartDate}
                max={draftEndDate || maxDate}
                onChange={(event) => setDraftStartDate(event.target.value)}
                className="min-h-11 w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-800 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                required
              />
            </label>
            <label className="space-y-1.5 text-xs font-semibold text-slate-600">
              <span>结束日期</span>
              <input
                type="date"
                value={draftEndDate}
                min={draftStartDate}
                max={maxDate}
                onChange={(event) => setDraftEndDate(event.target.value)}
                className="min-h-11 w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-800 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                required
              />
            </label>
          </div>
          {rangeError ? <p className="mt-2 text-xs font-medium text-red-600" role="alert">{rangeError}</p> : null}
          <div className="mt-3 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setShowCustomRange(false)
                setRangeError('')
              }}
              className="min-h-11 rounded-lg px-4 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              取消
            </button>
            <button
              type="submit"
              className="min-h-11 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white transition-colors hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
            >
              应用范围
            </button>
          </div>
        </form>
      ) : null}
    </div>
  )
}
