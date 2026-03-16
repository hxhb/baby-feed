import StatsPageClient from './StatsPageClient'
import { getPreloadedStatsPageData } from '@/lib/server-stats'

export default async function StatsPage() {
  const {
    initialBabies,
    initialSelectedBabyId,
    initialStats,
  } = await getPreloadedStatsPageData()

  return (
    <StatsPageClient
      initialBabies={initialBabies}
      initialSelectedBabyId={initialSelectedBabyId}
      initialStats={initialStats}
    />
  )
}
