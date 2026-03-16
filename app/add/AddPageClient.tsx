'use client'

import { useSearchParams } from 'next/navigation'
import { Layout } from '@/components/Providers'
import FeedingForm from '@/components/FeedingForm'
import HealthForm from '@/components/HealthForm'

export default function AddPageClient() {
  const searchParams = useSearchParams()
  const type = searchParams.get('type')

  return (
    <Layout>
      <div className="max-w-2xl mx-auto px-4 py-6">
        {type === 'health' ? (
          <HealthForm />
        ) : type === 'ad' ? (
          <HealthForm initialType="AD_VITAMIN" />
        ) : (
          <FeedingForm initialType={type as 'breast' | 'breast_bottle' | 'formula' | null} />
        )}
      </div>
    </Layout>
  )
}
