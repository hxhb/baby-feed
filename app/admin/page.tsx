import { redirect } from 'next/navigation'
import { Layout } from '@/components/Providers'
import AdminPanel from '@/components/AdminPanel'
import { requireServerAdmin } from '@/lib/admin'

export default async function AdminPage() {
  const check = await requireServerAdmin()

  if ('error' in check) {
    redirect(check.status === 401 ? '/login' : '/')
  }

  return (
    <Layout>
      <AdminPanel currentUserId={check.session.user.id} />
    </Layout>
  )
}
