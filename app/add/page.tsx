import { Suspense } from 'react'
import AddPageClient from './AddPageClient'
import { getPreloadedBabies } from '@/lib/server-babies'

export default async function AddPage() {
  const { babies, activeBabyId } = await getPreloadedBabies()

  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    }>
      <AddPageClient initialBabies={babies} activeBabyId={activeBabyId} />
    </Suspense>
  )
}
