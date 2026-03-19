'use client'

import { useState } from 'react'
import Timeline from '@/components/Timeline'
import type { PreloadedBaby } from '@/lib/server-babies'
import type { PreloadedTimelineRecord } from '@/lib/server-timeline'

interface Props {
  initialBabies: PreloadedBaby[]
  initialSelectedBabyId: string | null
  initialDate: string
  initialRecords: PreloadedTimelineRecord[]
  initialValidDates: string[]
}

export default function TimelinePageClient({
  initialBabies,
  initialSelectedBabyId,
  initialDate,
  initialRecords,
  initialValidDates,
}: Props) {
  const [selectedBabyId, setSelectedBabyId] = useState<string | null>(initialSelectedBabyId)

  return (
    <Timeline
      selectedBabyId={selectedBabyId}
      onSelectBaby={setSelectedBabyId}
      initialBabies={initialBabies}
      initialSelectedBabyId={initialSelectedBabyId}
      initialDate={initialDate}
      initialRecords={initialRecords}
      initialValidDates={initialValidDates}
    />
  )
}
