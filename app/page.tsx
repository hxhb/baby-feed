import Dashboard from '@/components/Dashboard'
import { getPreloadedDashboardData } from '@/lib/server-dashboard'

export default async function Home() {
  const {
    initialBabies,
    initialSelectedBabyId,
    initialTodayRecords,
    initialTodayHealthRecords,
  } = await getPreloadedDashboardData()

  return (
    <Dashboard
      selectedBabyId={initialSelectedBabyId}
      initialBabies={initialBabies}
      initialTodayRecords={initialTodayRecords}
      initialTodayHealthRecords={initialTodayHealthRecords}
    />
  )
}
