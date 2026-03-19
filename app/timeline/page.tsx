import TimelinePageClient from './TimelinePageClient'
import { getPreloadedTimelinePageData } from '@/lib/server-timeline'

export default async function TimelinePage() {
  const {
    initialBabies,
    initialSelectedBabyId,
    initialDate,
    initialRecords,
    initialValidDates,
  } = await getPreloadedTimelinePageData()

  return (
    <TimelinePageClient
      initialBabies={initialBabies}
      initialSelectedBabyId={initialSelectedBabyId}
      initialDate={initialDate}
      initialRecords={initialRecords}
      initialValidDates={initialValidDates}
    />
  )
}
