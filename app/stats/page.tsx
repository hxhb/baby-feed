import StatsPageClient from './StatsPageClient'
import { getPreloadedBabies } from '@/lib/server-babies'

export default async function StatsPage() {
  const initialBabies = await getPreloadedBabies()

  return <StatsPageClient initialBabies={initialBabies} />
}
