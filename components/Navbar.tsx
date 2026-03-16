'use client'

import { useEffect, useCallback } from 'react'
import { useSession, signOut } from 'next-auth/react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { 
  Home, 
  Calendar, 
  PlusCircle, 
  BarChart2, 
  Settings, 
  LogOut
} from 'lucide-react'

const navItems = [
  { href: '/', label: '首页', icon: Home },
  { href: '/timeline', label: '时间轴', icon: Calendar },
  { href: '/add', label: '记录', icon: PlusCircle },
  { href: '/stats', label: '统计', icon: BarChart2 },
  { href: '/settings', label: '设置', icon: Settings },
]

export default function Navbar() {
  const { data: session } = useSession()
  const pathname = usePathname()
  const router = useRouter()

  const prefetchRoute = useCallback((href: string) => {
    if (href === pathname) {
      return
    }

    router.prefetch(href)
  }, [pathname, router])

  useEffect(() => {
    if (!session) {
      return
    }

    const warmRoutes = () => {
      navItems.forEach((item) => {
        prefetchRoute(item.href)
      })
    }

    const timeoutId = window.setTimeout(warmRoutes, 150)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [prefetchRoute, session])

  if (!session) return null

  return (
    <>
      {/* Desktop Top Navigation */}
      <nav className="hidden md:block bg-white shadow-sm border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex justify-between h-14">
            <div className="flex items-center">
              <Link href="/" className="flex items-center space-x-2">
                <span className="text-2xl">🍼</span>
                <span className="font-bold text-xl text-gray-900">Baby Feed</span>
              </Link>
            </div>

            <div className="flex items-center space-x-1">
              {navItems.map((item) => {
                const Icon = item.icon
                const isActive = pathname === item.href
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onMouseEnter={() => prefetchRoute(item.href)}
                    onFocus={() => prefetchRoute(item.href)}
                    onTouchStart={() => prefetchRoute(item.href)}
                    className={`flex items-center space-x-1 px-4 py-2 rounded-lg transition ${
                      isActive
                        ? 'bg-blue-50 text-blue-600'
                        : 'text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    <Icon size={18} />
                    <span className="text-sm font-medium">{item.label}</span>
                  </Link>
                )
              })}
              <button
                onClick={() => signOut({ callbackUrl: '/login' })}
                className="flex items-center space-x-1 px-4 py-2 rounded-lg text-gray-600 hover:bg-gray-50 transition"
              >
                <LogOut size={18} />
                <span className="text-sm font-medium">退出</span>
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Mobile Bottom Tab Bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 pb-safe">
        <div className="flex items-center justify-around h-14">
          {navItems.map((item) => {
            const Icon = item.icon
            const isActive = pathname === item.href
            const isAdd = item.href === '/add'

            if (isAdd) {
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onMouseEnter={() => prefetchRoute(item.href)}
                  onFocus={() => prefetchRoute(item.href)}
                  onTouchStart={() => prefetchRoute(item.href)}
                  className="flex flex-col items-center justify-center -mt-4"
                >
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center shadow-lg ${
                    isActive ? 'bg-blue-600' : 'bg-blue-500'
                  }`}>
                    <Icon size={24} className="text-white" />
                  </div>
                </Link>
              )
            }

            return (
              <Link
                key={item.href}
                href={item.href}
                onMouseEnter={() => prefetchRoute(item.href)}
                onFocus={() => prefetchRoute(item.href)}
                onTouchStart={() => prefetchRoute(item.href)}
                className={`flex flex-col items-center justify-center flex-1 py-1 transition ${
                  isActive
                    ? 'text-blue-600'
                    : 'text-gray-400'
                }`}
              >
                <Icon size={20} />
                <span className="text-[10px] mt-0.5 font-medium">{item.label}</span>
              </Link>
            )
          })}
        </div>
      </nav>
    </>
  )
}
