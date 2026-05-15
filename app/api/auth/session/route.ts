import { auth } from '@/lib/auth'
import { NextRequest, NextResponse } from 'next/server'
import { noStoreHeaders } from '@/lib/api-helpers'
import { logError } from '@/lib/logger'

export async function GET(request: NextRequest) {
  try {
    const session = await auth(request)
    
    if (!session?.user) {
      return NextResponse.json({ user: null }, { headers: noStoreHeaders })
    }

    return NextResponse.json({ user: session.user }, { headers: noStoreHeaders })
  } catch (error) {
    logError('获取会话失败', error)
    return NextResponse.json({ user: null }, { headers: noStoreHeaders })
  }
}
