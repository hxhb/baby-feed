import { NextResponse } from 'next/server'
import { getAllowRegistration } from '@/lib/site-settings'
import { unstable_noStore as noStore } from 'next/cache'

export const dynamic = 'force-dynamic'

const publicCacheHeaders = {
  'Cache-Control': 'no-store, no-cache, must-revalidate',
}

// GET /api/site/registration-status - 查询是否允许注册（公开接口）
export async function GET() {
  noStore()
  const allowRegistration = await getAllowRegistration()

  return NextResponse.json(
    { allowRegistration },
    { headers: publicCacheHeaders }
  )
}
