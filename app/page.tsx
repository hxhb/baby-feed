'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Layout } from '@/components/Providers'
import Dashboard from '@/components/Dashboard'

export default function Home() {
  const { data: session, status } = useSession()
  const [selectedBabyId, setSelectedBabyId] = useState<string | null>(null)
  const router = useRouter()

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login')
    }
  }, [status, router])

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">加载中...</p>
        </div>
      </div>
    )
  }

  if (!session) {
    return null
  }

  return (
    <Layout>
      <Dashboard 
        selectedBabyId={selectedBabyId}
        onSelectBaby={setSelectedBabyId}
      />
    </Layout>
  )
}
