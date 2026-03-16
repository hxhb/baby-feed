'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Layout } from '@/components/Providers'
import AdminPanel from '@/components/AdminPanel'

export default function AdminPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null)

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login')
    }
  }, [status, router])

  useEffect(() => {
    if (session?.user?.id) {
      fetch('/api/admin/check')
        .then(res => res.json())
        .then(data => {
          if (!data.isAdmin) {
            router.push('/')
          } else {
            setIsAdmin(true)
          }
        })
        .catch(() => router.push('/'))
    }
  }, [session, router])

  if (status === 'loading' || !session || isAdmin === null) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <Layout>
      <AdminPanel 
        currentUserId={session.user.id} 
        onBack={() => router.push('/settings')} 
      />
    </Layout>
  )
}
