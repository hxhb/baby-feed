import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { NextRequest } from 'next/server'
import { Layout } from '@/components/Providers'
import AdminPanel from '@/components/AdminPanel'
import { auth } from '@/lib/auth'

async function getServerSession() {
  const headerStore = await headers()
  const protocol = headerStore.get('x-forwarded-proto') ?? 'http'
  const host = headerStore.get('x-forwarded-host') ?? headerStore.get('host') ?? 'localhost:3000'

  return auth(new NextRequest(`${protocol}://${host}`, { headers: headerStore }))
}

export default async function AdminPage() {
  const session = await getServerSession()

  if (!session?.user) {
    redirect('/login')
  }

  if (session.user.role !== 'ADMIN') {
    redirect('/')
  }

  return (
    <Layout>
      <AdminPanel currentUserId={session.user.id} />
    </Layout>
  )
}
