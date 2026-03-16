interface CacheEntry<T> {
  expiresAt: number
  promise: Promise<T>
}

const requestCache = new Map<string, CacheEntry<unknown>>()
const DEFAULT_TTL_MS = 10 * 1000
const MAX_CACHE_ENTRIES = 200

function cleanupExpiredEntries(now: number) {
  for (const [key, entry] of requestCache) {
    if (entry.expiresAt <= now) {
      requestCache.delete(key)
    }
  }
}

export function invalidateRequestCache(keyOrPrefix?: string) {
  if (!keyOrPrefix) {
    requestCache.clear()
    return
  }

  for (const key of requestCache.keys()) {
    if (key === keyOrPrefix || key.startsWith(keyOrPrefix)) {
      requestCache.delete(key)
    }
  }
}

export function dedupeRequest<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttlMs = DEFAULT_TTL_MS,
): Promise<T> {
  const now = Date.now()
  cleanupExpiredEntries(now)

  const existing = requestCache.get(key)
  if (existing && existing.expiresAt > now) {
    return existing.promise as Promise<T>
  }

  if (requestCache.size >= MAX_CACHE_ENTRIES) {
    cleanupExpiredEntries(now)
  }

  const promise = fetcher().catch((error) => {
    requestCache.delete(key)
    throw error
  })

  requestCache.set(key, {
    expiresAt: now + ttlMs,
    promise,
  })

  return promise
}
