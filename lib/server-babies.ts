import { headers } from 'next/headers'
import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export interface PreloadedBaby {
  id: string
  name: string
  birthDate: string
  gender: string
  createdAt: string
}

async function getServerSession() {
  const headerStore = await headers()
  const protocol = headerStore.get('x-forwarded-proto') ?? 'http'
  const host = headerStore.get('x-forwarded-host') ?? headerStore.get('host') ?? 'localhost:3000'

  return auth(new NextRequest(`${protocol}://${host}`, { headers: headerStore }))
}

export async function getPreloadedBabies(): Promise<PreloadedBaby[]> {
  const session = await getServerSession()
  if (!session?.user?.id) {
    return []
  }

  const babies = await prisma.baby.findMany({
    where: { createdBy: session.user.id },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      name: true,
      birthDate: true,
      gender: true,
      createdAt: true,
    },
  })

  return babies.map((baby) => ({
    id: baby.id,
    name: baby.name,
    birthDate: baby.birthDate.toISOString(),
    gender: baby.gender,
    createdAt: baby.createdAt.toISOString(),
  }))
}