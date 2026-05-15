import { NextRequest } from 'next/server'

interface Bucket {
  count: number
  resetTime: number
}

interface RateLimitOptions {
  key: string
  limit: number
  windowMs: number
  maxEntries?: number
}

interface RateLimitResult {
  allowed: boolean
  remaining: number
  retryAfterSeconds: number
}

const buckets = new Map<string, Bucket>()
const DEFAULT_MAX_ENTRIES = 10000

function cleanupExpiredBuckets(now: number) {
  for (const [key, bucket] of buckets) {
    if (now > bucket.resetTime) {
      buckets.delete(key)
    }
  }
}

export function enforceRateLimit(options: RateLimitOptions): RateLimitResult {
  const now = Date.now()
  const maxEntries = options.maxEntries ?? DEFAULT_MAX_ENTRIES

  if (buckets.size > maxEntries) {
    cleanupExpiredBuckets(now)
  }

  const bucketKey = `${options.key}:${options.windowMs}:${options.limit}`
  const current = buckets.get(bucketKey)

  if (!current || now > current.resetTime) {
    buckets.set(bucketKey, {
      count: 1,
      resetTime: now + options.windowMs,
    })

    return {
      allowed: true,
      remaining: Math.max(0, options.limit - 1),
      retryAfterSeconds: Math.ceil(options.windowMs / 1000),
    }
  }

  if (current.count >= options.limit) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: Math.max(1, Math.ceil((current.resetTime - now) / 1000)),
    }
  }

  current.count += 1

  return {
    allowed: true,
    remaining: Math.max(0, options.limit - current.count),
    retryAfterSeconds: Math.max(1, Math.ceil((current.resetTime - now) / 1000)),
  }
}

export function getClientIp(request: NextRequest): string {
  // 仅在明确信任反向代理时才读取 x-forwarded-for / x-real-ip
  // 否则攻击者可伪造这些头来绕过速率限制
  if (process.env.TRUST_PROXY === 'true') {
    return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || request.headers.get('x-real-ip')
      || 'unknown'
  }
  // 非信任代理模式：使用 x-real-ip（通常由 Next.js 运行时设置，无法被外部伪造）
  // 如果都不可用则回退到固定值（单实例场景下所有用户共享限流池）
  return request.headers.get('x-real-ip') || 'unknown'
}

export function buildUserActionKey(action: string, userId: string, request: NextRequest): string {
  return `${action}:${userId}:${getClientIp(request)}`
}

export function buildIpActionKey(action: string, request: NextRequest): string {
  return `${action}:${getClientIp(request)}`
}

export function buildUserScopedKey(prefix: string, userId: string, suffix?: string): string {
  return suffix ? `${prefix}:${userId}:${suffix}` : `${prefix}:${userId}`
}
