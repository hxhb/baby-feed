import Dashboard from '@/components/Dashboard'
import { getPreloadedDashboardData } from '@/lib/server-dashboard'

export default async function Home() {
  const {
    initialBabies,
    initialSelectedBabyId,
    initialTodayRecords,
    initialTodayHealthRecords,
    initialRecentMemos,
    initialQuickRecordKeys,
  } = await getPreloadedDashboardData()

  return (
    <Dashboard
      selectedBabyId={initialSelectedBabyId}
      initialBabies={initialBabies}
      initialTodayRecords={initialTodayRecords}
      initialTodayHealthRecords={initialTodayHealthRecords}
      initialRecentMemos={initialRecentMemos}
      initialQuickRecordKeys={initialQuickRecordKeys}
    />
  )
}
