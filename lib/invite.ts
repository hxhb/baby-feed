import { prisma } from '@/lib/prisma'
import crypto from 'crypto'
import type { Prisma } from '@/app/generated/prisma/client'

type InviteDb = Pick<Prisma.TransactionClient, 'siteSettings'>

const INVITE_PREFIX = 'invite:'

interface InviteData {
  createdBy: string
  createdAt: string
  usedBy: string | null
  usedAt: string | null
}

export function generateInviteCode(): string {
  return crypto.randomBytes(16).toString('hex')
}

export async function createInviteCode(createdBy: string): Promise<string> {
  const code = generateInviteCode()
  await prisma.siteSettings.create({
    data: {
      id: `invite_${code}`,
      key: `${INVITE_PREFIX}${code}`,
      value: JSON.stringify({
        createdBy,
        createdAt: new Date().toISOString(),
        usedBy: null,
        usedAt: null,
      } satisfies InviteData),
    },
  })
  return code
}

export async function validateInviteCode(code: string): Promise<boolean> {
  if (!code || typeof code !== 'string' || !/^[a-f0-9]{32}$/.test(code)) {
    return false
  }
  const record = await prisma.siteSettings.findUnique({
    where: { key: `${INVITE_PREFIX}${code}` },
  })
  if (!record) return false
  const data: InviteData = JSON.parse(record.value)
  return data.usedBy === null
}

export async function consumeInviteCode(
  code: string,
  usedBy: string,
  db: InviteDb = prisma,
): Promise<boolean> {
  const record = await db.siteSettings.findUnique({
    where: { key: `${INVITE_PREFIX}${code}` },
  })
  if (!record) return false
  const data: InviteData = JSON.parse(record.value)
  if (data.usedBy !== null) return false
  data.usedBy = usedBy
  data.usedAt = new Date().toISOString()
  const consumed = await db.siteSettings.updateMany({
    where: { key: `${INVITE_PREFIX}${code}`, value: record.value },
    data: { value: JSON.stringify(data) },
  })
  return consumed.count === 1
}

export async function listInviteCodes(): Promise<Array<{ code: string } & InviteData>> {
  const records = await prisma.siteSettings.findMany({
    where: { key: { startsWith: INVITE_PREFIX } },
  })
  return records.map(r => ({
    code: r.key.slice(INVITE_PREFIX.length),
    ...(JSON.parse(r.value) as InviteData),
  }))
}

export async function deleteInviteCode(code: string): Promise<boolean> {
  try {
    await prisma.siteSettings.delete({
      where: { key: `${INVITE_PREFIX}${code}` },
    })
    return true
  } catch {
    return false
  }
}
