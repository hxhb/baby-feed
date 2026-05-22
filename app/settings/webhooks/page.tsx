'use client'

import { useRouter } from 'next/navigation'
import WebhookManager from '@/components/WebhookManager'

export default function WebhooksPage() {
  const router = useRouter()

  return <WebhookManager onBack={() => router.push('/settings')} />
}
