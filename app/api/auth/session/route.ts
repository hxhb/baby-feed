import { auth } from '@/lib/auth'
import { NextRequest, NextResponse } from 'next/server'

const noStoreHeaders = {
  'Cache-Control': 'no-store, max-age=0',
  'Pragma': 'no-cache',
}

export async function GET(request: NextRequest) {
  try {
    const session = await auth(request)
    
    if (!session?.user) {
      return NextResponse.json({ user: null }, { headers: noStoreHeaders })
    }

    return NextResponse.json({ user: session.user }, { headers: noStoreHeaders })
  } catch (error) {
    console.error('获取会话失败:', error)
    return NextResponse.json({ user: null }, { headers: noStoreHeaders })
  }
}
