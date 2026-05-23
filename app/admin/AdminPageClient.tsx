'use client'

import { useRouter } from 'next/navigation'
import AdminPanel from '@/components/AdminPanel'

interface Props {
  currentUserId: string
}

export default function AdminPageClient({ currentUserId }: Props) {
  const router = useRouter()

  return <AdminPanel currentUserId={currentUserId} onBack={() => router.push('/settings')} />
}
