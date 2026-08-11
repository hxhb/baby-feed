import { invalidateRequestCache } from '@/lib/client-request-cache'

const PRIVATE_LOCAL_STORAGE_KEYS = [
  'baby-feed:record-composer-active-timer',
  'baby-feed:record-composer-recents',
]

const PRIVATE_SESSION_STORAGE_KEYS = [
  'baby-feed:add-record-feeding-draft',
  'baby-feed:add-record-health-draft',
  'baby-feed:add-record-memo-draft',
  'baby-feed:add-record-shared-draft',
  'record_saved_ts',
]

export async function clearServiceWorkerCache(): Promise<void> {
  if (typeof window === 'undefined') {
    return
  }

  try {
    if ('caches' in window) {
      const cacheNames = await window.caches.keys()
      await Promise.all(cacheNames.map((name) => window.caches.delete(name)))
    }
  } catch (error) {
    console.error('清理浏览器缓存失败:', error)
  }

  if (!('serviceWorker' in navigator) || !navigator.serviceWorker.controller) return

  try {
    const channel = new MessageChannel()
    navigator.serviceWorker.controller.postMessage(
      { type: 'CLEAR_CACHE' },
      [channel.port2],
    )

    await new Promise<void>((resolve) => {
      let settled = false
      const finish = () => {
        if (settled) return
        settled = true
        window.clearTimeout(timeoutId)
        channel.port1.close()
        resolve()
      }
      const timeoutId = window.setTimeout(finish, 1_000)
      channel.port1.onmessage = finish
    })
  } catch (error) {
    console.error('通知 Service Worker 清理缓存失败:', error)
  }
}

export function getActiveTimerStorageKey(userId: string): string {
  return `baby-feed:user:${userId}:record-composer-active-timer`
}

export function clearPrivateBrowserState(): void {
  invalidateRequestCache()
  if (typeof window === 'undefined') return

  try {
    for (const key of PRIVATE_LOCAL_STORAGE_KEYS) window.localStorage.removeItem(key)
    for (let index = window.localStorage.length - 1; index >= 0; index--) {
      const key = window.localStorage.key(index)
      if (key?.startsWith('baby-feed:user:')) window.localStorage.removeItem(key)
    }
  } catch (error) {
    console.error('清理本地私有状态失败:', error)
  }
  try {
    for (const key of PRIVATE_SESSION_STORAGE_KEYS) window.sessionStorage.removeItem(key)
  } catch (error) {
    console.error('清理会话私有状态失败:', error)
  }
}

export async function clearPrivateClientState(): Promise<void> {
  clearPrivateBrowserState()
  await clearServiceWorkerCache()
}
