'use client'

import { useState } from 'react'
import { useSearchParams } from 'next/navigation'
import dynamic from 'next/dynamic'
import type { PreloadedBaby } from '@/lib/server-babies'
import type { PreloadedStatsData } from '@/lib/server-stats'

// Dynamically import Stats with SSR disabled to avoid hydration mismatch
// caused by recharts' internal @loadable/component Suspense boundary
const Stats = dynamic(() => import('@/components/Stats'), {
  ssr: false,
  loading: () => (
    <div className="max-w-4xl mx-auto px-3 sm:px-4 py-4 space-y-4">
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    </div>
  ),
})

interface Props {
  initialBabies: PreloadedBaby[]
  initialSelectedBabyId: string | null
  initialStats: PreloadedStatsData | null
}
export default function StatsPageClient({
  initialBabies,
  initialSelectedBabyId,
  initialStats,
}: Props) {
  const searchParams = useSearchParams()
  const tabParam = searchParams.get('tab')
  const defaultTab = (tabParam === 'memos' || tabParam === 'insights') ? tabParam : 'dashboard'

  const [selectedBabyId, setSelectedBabyId] = useState<string | null>(initialSelectedBabyId)

  return (
    <Stats
      selectedBabyId={selectedBabyId}
      onSelectBaby={setSelectedBabyId}
      initialBabies={initialBabies}
      initialStats={initialStats}
      defaultTab={defaultTab}
    />
  )
}
