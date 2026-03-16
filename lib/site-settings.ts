import { prisma } from '@/lib/prisma'

export async function getAllowRegistration(): Promise<boolean> {
  try {
    const setting = await prisma.siteSettings.findUnique({
      where: { key: 'allowRegistration' }
    })

    return setting?.value !== 'false'
  } catch (error) {
    console.error('查询注册状态失败:', error)
    return true
  }
}
