'use client'

import dynamic from 'next/dynamic'
import { useState } from 'react'
import type { PreloadedBaby } from '@/lib/server-babies'
import type { PreloadedStatsData } from '@/lib/server-stats'

const Stats = dynamic(() => import('@/components/Stats'), {
  loading: () => <StatsPageSkeleton />,
})

interface Props {
  initialBabies: PreloadedBaby[]
  initialSelectedBabyId: string | null
  initialStats: PreloadedStatsData | null
}

function StatsPageSkeleton() {
  return (
    <div className="max-w-5xl mx-auto px-4 py-4 space-y-4 animate-pulse">
      <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1">
        <div className="h-9 w-20 rounded-full bg-gray-200" />
        <div className="h-9 w-20 rounded-full bg-gray-200" />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="bg-white rounded-2xl p-4 shadow-sm space-y-2">
            <div className="h-4 w-16 rounded bg-gray-100" />
            <div className="h-7 w-14 rounded bg-gray-200" />
            <div className="h-3 w-20 rounded bg-gray-100" />
          </div>
        ))}
      </div>

      <div className="bg-white rounded-2xl p-4 shadow-sm">
        <div className="h-5 w-24 rounded bg-gray-200 mb-4" />
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="space-y-2">
              <div className="flex justify-between items-center">
                <div className="h-4 w-24 rounded bg-gray-100" />
                <div className="h-4 w-12 rounded bg-gray-100" />
              </div>
              <div className="h-2 rounded-full bg-gray-100" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default function StatsPageClient({
  initialBabies,
  initialSelectedBabyId,
  initialStats,
}: Props) {
  const [selectedBabyId, setSelectedBabyId] = useState<string | null>(initialSelectedBabyId)

  return (
    <Stats
      selectedBabyId={selectedBabyId}
      onSelectBaby={setSelectedBabyId}
      initialBabies={initialBabies}
      initialStats={initialStats}
    />
  )
}
