import { prisma } from '@/lib/prisma'
import { getServerSession } from '@/lib/server-auth'

export interface PreloadedBaby {
  id: string
  name: string
  birthDate: string
  gender: string
  createdAt: string
}

export interface PreloadedBabiesResult {
  babies: PreloadedBaby[]
  activeBabyId: string | null
}

export async function getPreloadedBabies(): Promise<PreloadedBabiesResult> {
  const session = await getServerSession()
  if (!session?.user?.id) {
    return { babies: [], activeBabyId: null }
  }

  const [user, babies] = await Promise.all([
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: { activeBabyId: true },
    }),
    prisma.baby.findMany({
      where: { createdBy: session.user.id },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        name: true,
        birthDate: true,
        gender: true,
        createdAt: true,
      },
    }),
  ])

  const normalizedBabies = babies.map((baby) => ({
    id: baby.id,
    name: baby.name,
    birthDate: baby.birthDate.toISOString(),
    gender: baby.gender,
    createdAt: baby.createdAt.toISOString(),
  }))
  const activeBabyId = normalizedBabies.some(baby => baby.id === user?.activeBabyId)
    ? user?.activeBabyId ?? null
    : null

  return {
    babies: normalizedBabies,
    activeBabyId,
  }
}
