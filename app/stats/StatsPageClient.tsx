'use client'

import { useState } from 'react'
import { Layout } from '@/components/Providers'
import Stats from '@/components/Stats'
import type { PreloadedBaby } from '@/lib/server-babies'

interface Props {
  initialBabies: PreloadedBaby[]
}

export default function StatsPageClient({ initialBabies }: Props) {
  const [selectedBabyId, setSelectedBabyId] = useState<string | null>(null)

  return (
    <Layout>
      <Stats
        selectedBabyId={selectedBabyId}
        onSelectBaby={setSelectedBabyId}
        initialBabies={initialBabies}
      />
    </Layout>
  )
}
