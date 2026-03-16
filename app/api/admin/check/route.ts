import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin'

const noStoreHeaders = {
  'Cache-Control': 'no-store, max-age=0',
  'Pragma': 'no-cache',
}

export async function GET(request: NextRequest) {
  try {
    const check = await requireAdmin(request)
    return NextResponse.json({ isAdmin: !('error' in check) }, { headers: noStoreHeaders })
  } catch (error) {
    console.error('检查管理员身份失败:', error)
    return NextResponse.json({ isAdmin: false }, { headers: noStoreHeaders })
  }
}
