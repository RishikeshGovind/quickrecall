// lib/serverCache.ts
// Very small in-memory cache for server-side code (route handlers, etc).

type CacheEntry<T> = {
  value: T
  expiresAt: number
}

const cache = new Map<string, CacheEntry<unknown>>()

export async function getCached<T>(
  key: string,
  ttlMs: number,
  loader: () => Promise<T>,
): Promise<T> {
  const now = Date.now()
  const existing = cache.get(key)
  if (existing && existing.expiresAt > now) {
    return existing.value as T
  }

  const value = await loader()
  cache.set(key, { value, expiresAt: now + ttlMs })
  return value
}

export function setCache<T>(key: string, value: T, ttlMs: number) {
  const now = Date.now()
  cache.set(key, { value, expiresAt: now + ttlMs })
}

export function clearCacheKey(key: string) {
  cache.delete(key)
}

export function clearAllCache() {
  cache.clear()
}
