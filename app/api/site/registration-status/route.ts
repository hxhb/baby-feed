import { NextResponse } from 'next/server'
import { getAllowRegistration } from '@/lib/site-settings'

const publicCacheHeaders = {
  'Cache-Control': 'public, max-age=60, stale-while-revalidate=300',
}

// GET /api/site/registration-status - 查询是否允许注册（公开接口）
export async function GET() {
  const allowRegistration = await getAllowRegistration()

  return NextResponse.json(
    { allowRegistration },
    { headers: publicCacheHeaders }
  )
}
