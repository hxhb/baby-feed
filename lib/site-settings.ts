import { prisma } from '@/lib/prisma'

export interface SiteSettings {
  allowRegistration: boolean
}

export async function getSiteSettings(): Promise<SiteSettings> {
  try {
    const settings = await prisma.siteSettings.findMany({
      where: {
        key: {
          in: ['allowRegistration'],
        },
      },
    })

    const settingsMap = new Map(settings.map((setting) => [setting.key, setting.value]))

    return {
      allowRegistration: settingsMap.get('allowRegistration') !== 'false',
    }
  } catch (error) {
    console.error('查询站点设置失败:', error)
    return {
      allowRegistration: true,
    }
  }
}

export async function getAllowRegistration(): Promise<boolean> {
  const settings = await getSiteSettings()
  return settings.allowRegistration
}

export async function setAllowRegistration(allowRegistration: boolean): Promise<void> {
  await prisma.siteSettings.upsert({
    where: { key: 'allowRegistration' },
    update: { value: String(allowRegistration) },
    create: { key: 'allowRegistration', value: String(allowRegistration) },
  })
}
