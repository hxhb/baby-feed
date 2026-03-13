'use client'

import { useSession } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, Suspense } from 'react'
import { Layout } from '@/components/Providers'
import FeedingForm from '@/components/FeedingForm'
import HealthForm from '@/components/HealthForm'

function AddContent() {
  const { data: session, status } = useSession()
  const searchParams = useSearchParams()
  const type = searchParams.get('type')
  const router = useRouter()

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login')
    }
  }, [status, router])

  if (status === 'loading' || !session) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

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

export default function AddPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    }>
      <AddContent />
    </Suspense>
  )
}
