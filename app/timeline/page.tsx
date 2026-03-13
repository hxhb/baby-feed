'use client'

import { useSession } from 'next-auth/react'
import { redirect } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Layout } from '@/components/Providers'
import Timeline from '@/components/Timeline'

export default function TimelinePage() {
  const { data: session, status } = useSession()
  const [selectedBabyId, setSelectedBabyId] = useState<string | null>(null)

  useEffect(() => {
    if (status === 'unauthenticated') {
      redirect('/login')
    }
  }, [status])

  if (status === 'loading' || !session) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <Layout>
      <Timeline 
        selectedBabyId={selectedBabyId}
        onSelectBaby={setSelectedBabyId}
      />
    </Layout>
  )
}
