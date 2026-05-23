'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Droplets, Heart, CalendarCheck } from 'lucide-react'

type ActiveTab = 'feeding' | 'health' | 'memo'

function getActiveTab(type: string | null): ActiveTab {
  if (type === 'memo') return 'memo'
  if (!type || ['breast', 'breast_bottle', 'formula', 'solid_food'].includes(type)) return 'feeding'
  return 'health'
}

const tabs: { key: ActiveTab; label: string; href: string; icon: typeof Droplets }[] = [
  { key: 'feeding', label: '喂养', href: '/add?type=breast', icon: Droplets },
  { key: 'health', label: '健康', href: '/add?type=health', icon: Heart },
  { key: 'memo', label: '备忘', href: '/add?type=memo', icon: CalendarCheck },
]

export default function RecordTabBar() {
  const searchParams = useSearchParams()
  const type = searchParams.get('type')
  const activeTab = getActiveTab(type)

  return (
    <div className="grid grid-cols-3 gap-1.5">
      {tabs.map(tab => {
        const Icon = tab.icon
        const isActive = activeTab === tab.key
        return (
          <Link
            key={tab.key}
            href={tab.href}
            replace
            className={`mobile-touch-target flex items-center justify-center gap-1.5 rounded-button py-2.5 text-sm font-medium transition active:scale-[0.98] ${
              isActive
                ? 'gradient-primary text-white shadow-elevated'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200/80'
            }`}
          >
            <Icon size={16} className={isActive ? 'text-white' : 'text-slate-400'} />
            {tab.label}
          </Link>
        )
      })}
    </div>
  )
}
