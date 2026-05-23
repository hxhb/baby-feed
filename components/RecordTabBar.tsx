'use client'

import { Droplets, Heart, CalendarCheck } from 'lucide-react'

export type ActiveTab = 'feeding' | 'health' | 'memo'

interface Props {
  activeTab: ActiveTab
  onTabChange: (tab: ActiveTab) => void
}

const tabs: { key: ActiveTab; label: string; icon: typeof Droplets }[] = [
  { key: 'feeding', label: '喂养', icon: Droplets },
  { key: 'health', label: '健康', icon: Heart },
  { key: 'memo', label: '备忘', icon: CalendarCheck },
]

export default function RecordTabBar({ activeTab, onTabChange }: Props) {
  return (
    <div className="grid grid-cols-3 gap-1.5">
      {tabs.map(tab => {
        const Icon = tab.icon
        const isActive = activeTab === tab.key
        return (
          <button
            key={tab.key}
            type="button"
            onClick={() => onTabChange(tab.key)}
            className={`mobile-touch-target flex items-center justify-center gap-1.5 rounded-button py-2.5 text-sm font-medium transition active:scale-[0.98] ${
              isActive
                ? 'gradient-primary text-white shadow-elevated'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200/80'
            }`}
          >
            <Icon size={16} className={isActive ? 'text-white' : 'text-slate-400'} />
            {tab.label}
          </button>
        )
      })}
    </div>
  )
}
