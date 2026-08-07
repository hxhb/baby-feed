'use client'

import type { ReactNode } from 'react'
import { CalendarDays, LoaderCircle, type LucideIcon } from 'lucide-react'

interface StatsPanelProps {
  children: ReactNode
  className?: string
}

interface StatsFeatureCardProps {
  children: ReactNode
  title: string
  icon: LucideIcon
  className?: string
  iconClassName?: string
  titleClassName?: string
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
  value: number
  onChange: (value: number) => void
  options?: number[]
  loading?: boolean
  className?: string
}

export function StatsPanel({ children, className = '' }: StatsPanelProps) {
  return <div className={`rounded-card bg-white p-4 shadow-card border border-blue-50 ${className}`.trim()}>{children}</div>
}

export function StatsFeatureCard({
  children,
  title,
  icon: Icon,
  className = '',
  iconClassName = 'text-white',
  titleClassName = 'text-sm font-semibold text-slate-900',
}: StatsFeatureCardProps) {
  return (
    <div className={`rounded-card bg-white p-4 shadow-card border border-blue-50 ${className}`.trim()}>
      <div className="mb-2 flex items-center gap-2">
        <Icon size={16} className={iconClassName} />
        <h3 className={titleClassName}>{title}</h3>
      </div>
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
  options = [7, 14, 30],
  loading = false,
  className = '',
}: StatsRangePickerProps) {
  return (
    <div className={`flex w-full items-center justify-between gap-3 lg:w-auto lg:justify-end ${className}`.trim()}>
      <div className="flex items-center gap-2 text-slate-500">
        <CalendarDays size={16} className="text-blue-600" aria-hidden="true" />
        <span id="stats-range-label" className="text-xs font-semibold sm:text-sm">数据范围</span>
      </div>

      <div className="relative lg:hidden">
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
          value={value}
          onChange={(event) => onChange(Number(event.target.value))}
          className={`min-h-11 w-[112px] rounded-button border border-slate-200 bg-white py-2 pr-9 text-sm font-semibold text-slate-700 shadow-sm outline-none transition-colors focus:border-blue-400 focus:ring-2 focus:ring-blue-100 ${loading ? 'pl-9' : 'pl-3'}`}
        >
          {options.map(option => (
            <option key={option} value={option}>近 {option} 天</option>
          ))}
        </select>
      </div>

      <div
        className="hidden grid-cols-3 gap-1 rounded-card bg-slate-100 p-1 lg:grid"
        aria-label="选择数据范围"
        aria-busy={loading}
      >
        {options.map(option => (
          <button
            key={option}
            type="button"
            onClick={() => onChange(option)}
            aria-pressed={value === option}
            className={`min-h-11 min-w-[68px] rounded-button px-3 py-2 text-sm font-semibold transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
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
      </div>
    </div>
  )
}
