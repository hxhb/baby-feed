'use client'

import type { Session } from 'next-auth'
import { SessionProvider } from 'next-auth/react'
import Navbar from './Navbar'
import { CopyToastProvider } from './CopyToast'
import { RecordComposerProvider } from './RecordComposerProvider'

export function Providers({
  children,
  session,
}: {
  children: React.ReactNode
  session: Session | null
}) {
  return (
    <SessionProvider session={session}>
      <CopyToastProvider>
        <RecordComposerProvider>
          <Navbar />
          <main className="min-h-screen bg-gray-50 pb-safe-tabbar md:pb-0">
            {children}
          </main>
        </RecordComposerProvider>
      </CopyToastProvider>
    </SessionProvider>
  )
}
