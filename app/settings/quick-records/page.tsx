'use client'

import { useRouter } from 'next/navigation'
import QuickRecordSettings from '@/components/QuickRecordSettings'

export default function QuickRecordsPage() {
  const router = useRouter()

  return <QuickRecordSettings onBack={() => router.push('/settings')} />
}
