import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getServerSession } from '@/lib/server-auth'

type AuthSession = NonNullable<Awaited<ReturnType<typeof auth>>>

export type AdminCheckResult =
  | { session: AuthSession }
  | { error: string; status: number }

async function isAdminUser(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  })

  return user?.role === 'ADMIN'
}

export async function requireAdmin(request: NextRequest): Promise<AdminCheckResult> {
  const session = await auth(request)
  if (!session?.user?.id) {
    return { error: '未登录', status: 401 }
  }

  if (!(await isAdminUser(session.user.id))) {
    return { error: '无权限', status: 403 }
  }

  return { session }
}

export async function requireServerAdmin(): Promise<AdminCheckResult> {
  const session = await getServerSession()
  if (!session?.user?.id) {
    return { error: '未登录', status: 401 }
  }

  if (!(await isAdminUser(session.user.id))) {
    return { error: '无权限', status: 403 }
  }

  return { session }
}
