import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin'
import { noStoreHeaders } from '@/lib/api-helpers'
import { logError } from '@/lib/logger'

export async function GET(request: NextRequest) {
  try {
    const check = await requireAdmin(request)
    return NextResponse.json({ isAdmin: !('error' in check) }, { headers: noStoreHeaders })
  } catch (error) {
    logError('检查管理员身份失败', error)
    return NextResponse.json({ isAdmin: false }, { headers: noStoreHeaders })
  }
}
