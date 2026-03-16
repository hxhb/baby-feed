import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const noStoreHeaders = {
  'Cache-Control': 'no-store, max-age=0',
  'Pragma': 'no-cache',
}

// GET /api/admin/check - 检查当前用户是否为管理员
export async function GET(request: NextRequest) {
  try {
    const session = await auth(request)
    if (!session) {
      return NextResponse.json({ isAdmin: false }, { headers: noStoreHeaders })
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true }
    })

    return NextResponse.json({ isAdmin: user?.role === 'ADMIN' }, { headers: noStoreHeaders })
  } catch (error) {
    console.error('检查管理员身份失败:', error)
    return NextResponse.json({ isAdmin: false }, { headers: noStoreHeaders })
  }
}
