import { redirect } from 'next/navigation'
import AdminPageClient from './AdminPageClient'
import { requireServerAdmin } from '@/lib/admin'

export default async function AdminPage() {
  const check = await requireServerAdmin()

  if ('error' in check) {
    redirect(check.status === 401 ? '/login' : '/')
  }

  return <AdminPageClient currentUserId={check.session.user.id} />
}
