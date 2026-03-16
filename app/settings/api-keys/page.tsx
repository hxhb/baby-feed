'use client'

import { useRouter } from 'next/navigation'
import { Layout } from '@/components/Providers'
import ApiKeyManager from '@/components/ApiKeyManager'

export default function ApiKeysPage() {
  const router = useRouter()

  return (
    <Layout>
      <ApiKeyManager onBack={() => router.push('/settings')} />
    </Layout>
  )
}
