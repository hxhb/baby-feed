'use client'

import Dashboard from '@/components/Dashboard'
import { Layout } from '@/components/Providers'
import { getPreloadedBabies } from '@/lib/server-babies'

export default async function Home() {
  const initialBabies = await getPreloadedBabies()

  return (
    <Layout>
      <Dashboard initialBabies={initialBabies} />
    </Layout>
  )
}
