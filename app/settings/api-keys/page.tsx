'use client'

import { useRouter } from 'next/navigation'
import ApiKeyManager from '@/components/ApiKeyManager'

export default function ApiKeysPage() {
  const router = useRouter()

  return <ApiKeyManager onBack={() => router.push('/settings')} />
}
