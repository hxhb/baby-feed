'use client'

import { useState } from 'react'
import { Layout } from '@/components/Providers'
import Timeline from '@/components/Timeline'
import type { PreloadedBaby } from '@/lib/server-babies'

interface Props {
  initialBabies: PreloadedBaby[]
}

export default function TimelinePageClient({ initialBabies }: Props) {
  const [selectedBabyId, setSelectedBabyId] = useState<string | null>(null)

  return (
    <Layout>
      <Timeline
        selectedBabyId={selectedBabyId}
        onSelectBaby={setSelectedBabyId}
        initialBabies={initialBabies}
      />
    </Layout>
  )
}
