import { createHash } from 'crypto'

export function buildWebhookEndpointDedupeKey(userId: string, url: string): string {
  const normalizedUrl = new URL(url).toString()
  return createHash('sha256').update(`${userId}\0${normalizedUrl}`).digest('hex')
}
