'use client'

import { useState } from 'react'
import { Layout } from '@/components/Providers'
import Timeline from '@/components/Timeline'

export default function TimelinePageClient() {
  const [selectedBabyId, setSelectedBabyId] = useState<string | null>(null)

  return (
    <Layout>
      <Timeline
        selectedBabyId={selectedBabyId}
        onSelectBaby={setSelectedBabyId}
      />
    </Layout>
  )
}
