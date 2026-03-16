import { Suspense } from 'react'
import AddPageClient from './AddPageClient'

export default function AddPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    }>
      <AddPageClient />
    </Suspense>
  )
}
