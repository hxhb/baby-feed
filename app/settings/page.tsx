import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { NextRequest } from 'next/server'
import { Layout } from '@/components/Providers'
import Settings from '@/components/Settings'
import { auth } from '@/lib/auth'

async function getServerSession() {
  const headerStore = await headers()
  const protocol = headerStore.get('x-forwarded-proto') ?? 'http'
  const host = headerStore.get('x-forwarded-host') ?? headerStore.get('host') ?? 'localhost:3000'

  return auth(new NextRequest(`${protocol}://${host}`, { headers: headerStore }))
}

export default async function SettingsPage() {
  const session = await getServerSession()

  if (!session?.user) {
    redirect('/login')
  }

  return (
    <Layout>
      <Settings userName={session.user.name} userEmail={session.user.email} />
    </Layout>
  )
}
