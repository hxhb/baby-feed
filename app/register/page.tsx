export const dynamic = 'force-dynamic'

import { Suspense } from 'react'
import { getAllowRegistration } from '@/lib/site-settings'
import RegisterClient from '@/app/register/RegisterClient'

export default async function RegisterPage() {
  const allowRegistration = await getAllowRegistration()

  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-brand-100 border-t-brand-500"></div>
      </div>
    }>
      <RegisterClient allowRegistration={allowRegistration} />
    </Suspense>
  )
}
