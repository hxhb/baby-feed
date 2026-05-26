'use client'

import { useRouter } from 'next/navigation'
import ReminderManager from '@/components/ReminderManager'

export default function RemindersPage() {
  const router = useRouter()

  return <ReminderManager onBack={() => router.push('/settings')} />
}
