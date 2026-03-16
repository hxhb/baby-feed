import TimelinePageClient from './TimelinePageClient'
import { getPreloadedBabies } from '@/lib/server-babies'

export default async function TimelinePage() {
  const initialBabies = await getPreloadedBabies()

  return <TimelinePageClient initialBabies={initialBabies} />
}
