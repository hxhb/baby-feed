'use client'

import dynamic from 'next/dynamic'
import { useState } from 'react'
import { Layout } from '@/components/Providers'
import type { PreloadedBaby } from '@/lib/server-babies'
import type { PreloadedTimelineRecord } from '@/lib/server-timeline'

const Timeline = dynamic(() => import('@/components/Timeline'), {
  loading: () => <TimelinePageSkeleton />,
})

interface Props {
  initialBabies: PreloadedBaby[]
  initialSelectedBabyId: string | null
  initialDate: string
  initialRecords: PreloadedTimelineRecord[]
}

function TimelinePageSkeleton() {
  return (
    <div className="max-w-4xl mx-auto px-3 sm:px-4 py-4 space-y-4 animate-pulse">
      <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1">
        <div className="h-9 w-20 rounded-full bg-gray-200" />
        <div className="h-9 w-20 rounded-full bg-gray-200" />
      </div>

      <div className="bg-white rounded-2xl p-3 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="h-10 w-10 rounded-lg bg-gray-100" />
          <div className="space-y-2 text-center">
            <div className="h-5 w-24 rounded bg-gray-200 mx-auto" />
            <div className="h-4 w-32 rounded bg-gray-100 mx-auto" />
          </div>
          <div className="h-10 w-10 rounded-lg bg-gray-100" />
        </div>
      </div>

      <div className="bg-white rounded-2xl p-3 shadow-sm">
        <div className="h-4 w-16 rounded bg-gray-200 mb-3" />
        <div className="grid grid-cols-4 gap-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="space-y-2 text-center">
              <div className="h-6 w-10 rounded bg-gray-200 mx-auto" />
              <div className="h-3 w-12 rounded bg-gray-100 mx-auto" />
              <div className="h-3 w-14 rounded bg-gray-100 mx-auto" />
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        {Array.from({ length: 5 }).map((_, index) => (
          <div key={index} className="flex items-center justify-between p-4 border-b border-gray-100 last:border-b-0">
            <div className="flex items-center space-x-3 flex-1">
              <div className="w-9 h-9 rounded-full bg-gray-100" />
              <div className="space-y-2 flex-1">
                <div className="h-4 w-32 rounded bg-gray-200" />
                <div className="h-3 w-24 rounded bg-gray-100" />
              </div>
            </div>
            <div className="flex gap-2 ml-2">
              <div className="h-8 w-8 rounded bg-gray-100" />
              <div className="h-8 w-8 rounded bg-gray-100" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function TimelinePageClient({
  initialBabies,
  initialSelectedBabyId,
  initialDate,
  initialRecords,
}: Props) {
  const [selectedBabyId, setSelectedBabyId] = useState<string | null>(initialSelectedBabyId)

  return (
    <Layout>
      <Timeline
        selectedBabyId={selectedBabyId}
        onSelectBaby={setSelectedBabyId}
        initialBabies={initialBabies}
        initialSelectedBabyId={initialSelectedBabyId}
        initialDate={initialDate}
        initialRecords={initialRecords}
      />
    </Layout>
  )
}
