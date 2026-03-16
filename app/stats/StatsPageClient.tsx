'use client'

import { useState } from 'react'
import { Layout } from '@/components/Providers'
import Stats from '@/components/Stats'

export default function StatsPageClient() {
  const [selectedBabyId, setSelectedBabyId] = useState<string | null>(null)

  return (
    <Layout>
      <Stats
        selectedBabyId={selectedBabyId}
        onSelectBaby={setSelectedBabyId}
      />
    </Layout>
  )
}
