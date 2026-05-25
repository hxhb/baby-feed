import { Suspense } from 'react'
import StatsPageClient from './StatsPageClient'
import { getPreloadedStatsPageData } from '@/lib/server-stats'

export default async function StatsPage() {
  const {
    initialBabies,
    initialSelectedBabyId,
    initialStats,
  } = await getPreloadedStatsPageData()

  return (
    <Suspense fallback={
      <div className="max-w-4xl mx-auto px-3 sm:px-4 py-4 space-y-4">
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
        </div>
      </div>
    }>
      <StatsPageClient
        initialBabies={initialBabies}
        initialSelectedBabyId={initialSelectedBabyId}
        initialStats={initialStats}
      />
    </Suspense>
  )
}
