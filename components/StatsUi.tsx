'use client'

import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'

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
  disabled?: boolean
}

interface StatsSegmentedTabsProps {
  items: StatsSegmentedTabItem[]
  value: string
  onChange: (value: string) => void
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
    <div className={`flex flex-wrap gap-2 rounded-card bg-slate-50 p-1 ${className}`.trim()}>
      {items.map(item => {
        const active = item.key === value

        return (
          <button
            key={item.key}
            type="button"
            onClick={() => !item.disabled && onChange(item.key)}
            disabled={item.disabled}
            className={`min-w-0 flex-1 rounded-button px-3 py-2 text-sm font-medium transition sm:flex-none sm:px-4 ${
              active
                ? 'bg-white text-blue-600 shadow-card'
                : item.disabled
                  ? 'cursor-not-allowed text-slate-300'
                  : 'text-slate-500 hover:bg-white/60 hover:text-slate-700'
            }`}
            title={item.description}
          >
            {item.label}
          </button>
        )
      })}
    </div>
  )
}
