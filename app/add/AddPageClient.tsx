'use client'

import { useSearchParams } from 'next/navigation'
import { Layout } from '@/components/Providers'
import FeedingForm from '@/components/FeedingForm'
import HealthForm from '@/components/HealthForm'
import type { PreloadedBaby } from '@/lib/server-babies'

interface Props {
  initialBabies: PreloadedBaby[]
}

export default function AddPageClient({ initialBabies }: Props) {
  const searchParams = useSearchParams()
  const type = searchParams.get('type')

  return (
    <Layout>
      <div className="max-w-2xl mx-auto px-4 py-6">
        {type === 'health' ? (
          <HealthForm initialBabies={initialBabies} />
        ) : type === 'ad' ? (
          <HealthForm initialType="AD_VITAMIN" initialBabies={initialBabies} />
        ) : (
          <FeedingForm
            initialType={type as 'breast' | 'breast_bottle' | 'formula' | null}
            initialBabies={initialBabies}
          />
        )}
      </div>
    </Layout>
  )
}
