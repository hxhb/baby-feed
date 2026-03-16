'use client'

import { SessionProvider } from 'next-auth/react'
import Navbar from './Navbar'

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <Navbar />
      <main className="min-h-screen bg-gray-50 pb-20 md:pb-0">
        {children}
      </main>
    </SessionProvider>
  )
}
