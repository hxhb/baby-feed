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
  return <div className={`rounded-2xl bg-white p-4 shadow-sm ${className}`.trim()}>{children}</div>
}

export function StatsFeatureCard({
  children,
  title,
  icon: Icon,
  className = '',
  iconClassName = 'text-gray-500',
  titleClassName = 'text-sm font-semibold text-gray-900',
}: StatsFeatureCardProps) {
  return (
    <div className={`rounded-2xl bg-white p-4 shadow-sm ${className}`.trim()}>
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
  className = 'py-8 text-center text-gray-400',
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
    <div className={`flex gap-2 overflow-x-auto rounded-2xl bg-gray-50 p-1 ${className}`.trim()}>
      {items.map(item => {
        const active = item.key === value

        return (
          <button
            key={item.key}
            type="button"
            onClick={() => !item.disabled && onChange(item.key)}
            disabled={item.disabled}
            className={`min-w-fit rounded-xl px-4 py-2 text-sm font-medium whitespace-nowrap transition ${
              active
                ? 'bg-white text-gray-900 shadow-sm'
                : item.disabled
                  ? 'cursor-not-allowed text-gray-400'
                  : 'text-gray-600 hover:bg-white hover:text-gray-900'
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
