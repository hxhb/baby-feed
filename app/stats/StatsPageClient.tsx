'use client'

import { useState } from 'react'
import { Layout } from '@/components/Providers'
import Stats from '@/components/Stats'
import type { PreloadedBaby } from '@/lib/server-babies'
import type { PreloadedStatsData } from '@/lib/server-stats'

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
  const [selectedBabyId, setSelectedBabyId] = useState<string | null>(initialSelectedBabyId)

  return (
    <Layout>
      <Stats
        selectedBabyId={selectedBabyId}
        onSelectBaby={setSelectedBabyId}
        initialBabies={initialBabies}
        initialStats={initialStats}
      />
    </Layout>
  )
}
