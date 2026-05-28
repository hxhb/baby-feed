'use client'

import { type CategoryColor, getCategoryColorClasses } from '@/lib/category-colors'
import type { LucideIcon } from 'lucide-react'

export interface CategoryOption<TKey extends string = string> {
  key: TKey
  label: string
  icon: LucideIcon
  color: CategoryColor
}

interface CategorySelectorProps<TKey extends string = string> {
  options: CategoryOption<TKey>[]
  value: string
  onChange: (key: TKey) => void
  /** Tailwind grid classes. Defaults to responsive grid based on option count. */
  gridCols?: string
}

export default function CategorySelector<TKey extends string = string>({
  options,
  value,
  onChange,
  gridCols,
}: CategorySelectorProps<TKey>) {
  const cols = gridCols ?? (options.length <= 4 ? 'grid-cols-3' : 'grid-cols-4 sm:grid-cols-8')

  return (
    <div className={`grid gap-2 ${cols}`}>
      {options.map(option => {
        const isSelected = value === option.key
        const colors = getCategoryColorClasses(option.color, isSelected)
        const Icon = option.icon
        return (
          <button
            key={option.key}
            type="button"
            onClick={() => onChange(option.key)}
            className={`mobile-touch-target flex min-h-[68px] flex-col items-center justify-center rounded-xl border-2 px-2 py-2.5 transition ${
              isSelected
                ? `${colors.border} ${colors.bg}`
                : 'border-gray-200 bg-white hover:border-gray-300'
            }`}
          >
            <Icon size={18} className={`sm:size-5 ${colors.icon}`} />
            <span className={`mt-1 text-[11px] font-medium leading-4 sm:text-xs ${colors.text}`}>
              {option.label}
            </span>
          </button>
        )
      })}
    </div>
  )
}
