import { prisma } from '@/lib/prisma'
import { getServerSession } from '@/lib/server-auth'

export interface PreloadedBaby {
  id: string
  name: string
  birthDate: string
  gender: string
  createdAt: string
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