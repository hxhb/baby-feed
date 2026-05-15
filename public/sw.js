/// <reference lib="webworker" />

const CACHE_NAME = 'baby-feed-v3'
const OFFLINE_URL = '/offline'

// 预缓存的静态资源
const PRECACHE_URLS = [
  '/',
  '/offline',
  '/manifest.json',
  '/icons/icon-192x192.svg',
  '/icons/icon-512x512.svg',
]

// 安装事件：预缓存核心资源
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_URLS)
    }).then(() => {
      return self.skipWaiting()
    })
  )
})

// 激活事件：清理旧缓存
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      )
    }).then(() => {
      return self.clients.claim()
    })
  )
})

// 带超时的网络请求（用于导航请求加速）
function fetchWithTimeout(request, timeoutMs) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout')), timeoutMs)
    fetch(request).then((response) => {
      clearTimeout(timer)
      resolve(response)
    }).catch((err) => {
      clearTimeout(timer)
      reject(err)
    })
  })
}

// 请求拦截
self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  // 跳过非 GET 请求
  if (request.method !== 'GET') return

  // 跳过 API 请求（不缓存动态数据）
  if (url.pathname.startsWith('/api/')) return

  // 跳过 next-auth 相关请求
  if (url.pathname.includes('next-auth')) return

  // 跳过浏览器扩展请求
  if (!url.protocol.startsWith('http')) return

  // 跳过 Next.js RSC (React Server Components) 请求，避免缓存过期的动态数据
  if (url.searchParams.has('_rsc') || request.headers.get('RSC') === '1') return

  // 跳过 Next.js data 请求
  if (url.pathname.startsWith('/_next/data/')) return

  // 导航请求（页面跳转）：网络优先 + 超时竞速
  if (request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          // 3秒内网络响应则使用网络版本
          const response = await fetchWithTimeout(request, 3000)
          if (response.ok) {
            const clone = response.clone()
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, clone)
            })
          }
          return response
        } catch {
          // 网络超时或失败，立即从缓存取
          const cached = await caches.match(request)
          if (cached) return cached
          // 无缓存则显示离线页
          const offlinePage = await caches.match(OFFLINE_URL)
          return offlinePage || new Response('Offline', { status: 503 })
        }
      })()
    )
    return
  }

  // 静态资源（JS/CSS/字体/图片）：缓存优先
  if (
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.startsWith('/icons/') ||
    url.pathname.endsWith('.svg') ||
    url.pathname.endsWith('.woff') ||
    url.pathname.endsWith('.woff2')
  ) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached
        return fetch(request).then((response) => {
          if (response.ok) {
            const clone = response.clone()
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, clone)
            })
          }
          return response
        })
      })
    )
    return
  }

  // 其他请求：网络优先，缓存兜底
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok) {
          const clone = response.clone()
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, clone)
          })
        }
        return response
      })
      .catch(() => {
        return caches.match(request)
      })
  )
})

// 接收前端消息：登出时清除所有缓存，防止敏感数据残留
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'CLEAR_CACHE') {
    event.waitUntil(
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((name) => caches.delete(name))
        )
      }).then(() => {
        if (event.ports && event.ports[0]) {
          event.ports[0].postMessage({ cleared: true })
        }
      })
    )
  }
})
