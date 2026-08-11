'use client'

import { useEffect, useCallback, useState } from 'react'
import { useSession, signOut } from 'next-auth/react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname, useRouter } from 'next/navigation'
import {
  Home,
  Calendar,
  PlusCircle,
  BarChart2,
  Settings,
  LogOut
} from 'lucide-react'
import { useRecordComposer } from '@/components/RecordComposerProvider'
import { clearPrivateClientState } from '@/lib/client-cache'

const navItems = [
  { href: '/', label: '首页', icon: Home },
  { href: '/timeline', label: '时间轴', icon: Calendar },
  { href: '/add', label: '记录', icon: PlusCircle },
  { href: '/stats', label: '统计', icon: BarChart2 },
  { href: '/settings', label: '设置', icon: Settings },
]

const authRoutes = new Set(['/login', '/register'])

export default function Navbar() {
  const { data: session, status } = useSession()
  const [isSigningOut, setIsSigningOut] = useState(false)
  const pathname = usePathname()
  const router = useRouter()
  const { isOpen: isRecordComposerOpen, openComposer } = useRecordComposer()
  const isAuthPage = authRoutes.has(pathname)
  const shouldShowNavbar = status === 'authenticated' && !!session && !isAuthPage && !isSigningOut

  const prefetchRoute = useCallback((href: string) => {
    if (href === pathname) {
      return
    }

    router.prefetch(href)
  }, [pathname, router])

  useEffect(() => {
    if (status !== 'authenticated') {
      setIsSigningOut(false)
    }
  }, [status])

  useEffect(() => {
    if (!shouldShowNavbar) {
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
  }, [prefetchRoute, shouldShowNavbar])

  const handleSignOut = async () => {
    try {
      setIsSigningOut(true)
      await clearPrivateClientState()
      await signOut({ callbackUrl: '/login' })
    } catch (error) {
      console.error('Sign out failed:', error)
      setIsSigningOut(false)
    }
  }

  if (!shouldShowNavbar) return null

  return (
    <>
      <nav className="hidden md:block sticky top-0 z-50 border-b border-gray-200 bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex justify-between h-14">
            <div className="flex items-center">
              <Link href="/" className="flex items-center space-x-2">
                <Image src="/icon.svg" alt="" width={28} height={28} priority />
                <span className="font-bold text-xl text-gray-900">Baby Feed</span>
              </Link>
            </div>

            <div className="flex items-center space-x-1">
              {navItems.map((item) => {
                const Icon = item.icon
                const isAdd = item.href === '/add'
                const isActive = pathname === item.href || (isAdd && isRecordComposerOpen)
                if (isAdd) {
                  return (
                    <button
                      key={item.href}
                      type="button"
                      onClick={() => openComposer()}
                      aria-haspopup="dialog"
                      aria-expanded={isRecordComposerOpen}
                      className={`flex min-h-11 items-center space-x-1 rounded-lg px-4 py-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                        isActive
                          ? 'bg-blue-50 text-blue-700'
                          : 'text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      <Icon size={18} />
                      <span className="text-sm font-medium">{item.label}</span>
                    </button>
                  )
                }
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onMouseEnter={() => prefetchRoute(item.href)}
                    onFocus={() => prefetchRoute(item.href)}
                    onTouchStart={() => prefetchRoute(item.href)}
                    className={`flex items-center space-x-1 px-4 py-2 rounded-lg transition ${
                      isActive
                        ? 'bg-gradient-to-r from-blue-50 to-sky-50 text-blue-600 shadow-pressed'
                        : 'text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    <Icon size={18} />
                    <span className="text-sm font-medium">{item.label}</span>
                  </Link>
                )
              })}
              <button
                type="button"
                onClick={handleSignOut}
                className="flex items-center space-x-1 px-4 py-2 rounded-lg text-gray-600 hover:bg-gray-50 transition"
              >
                <LogOut size={18} />
                <span className="text-sm font-medium">退出</span>
              </button>
            </div>
          </div>
        </div>
      </nav>

      <nav data-mobile-bottom-navigation className="md:hidden fixed inset-x-0 bottom-0 z-50 rounded-t-[28px] border-t border-blue-100/60 bg-white/98 backdrop-blur-xl shadow-nav supports-[backdrop-filter]:bg-white/92">
        <div className="mx-auto flex max-w-md items-end justify-between gap-1 px-2 pt-2 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))]">
          {navItems.map((item) => {
            const Icon = item.icon
            const isActive = pathname === item.href || (item.href === '/add' && isRecordComposerOpen)
            const isAdd = item.href === '/add'

            if (isAdd) {
              return (
                <button
                  key={item.href}
                  type="button"
                  aria-label={item.label}
                  aria-haspopup="dialog"
                  aria-expanded={isRecordComposerOpen}
                  onClick={() => openComposer()}
                  className="flex min-w-[5rem] flex-col items-center justify-end self-start border-0 !bg-transparent p-0 pt-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                >
                  <div className="mobile-touch-target -mt-5 flex h-[52px] w-[52px] items-center justify-center rounded-full bg-blue-600 shadow-[0_6px_18px_rgba(37,99,235,0.3)] ring-4 ring-white transition-colors active:bg-blue-700">
                    <Icon size={24} className="text-white" />
                  </div>
                  <span className={`mt-1 text-[11px] font-semibold ${isActive ? 'text-blue-600' : 'text-slate-400'}`}>
                    {item.label}
                  </span>
                </button>
              )
            }

            return (
              <Link
                key={item.href}
                href={item.href}
                aria-label={item.label}
                aria-current={isActive ? 'page' : undefined}
                onMouseEnter={() => prefetchRoute(item.href)}
                onFocus={() => prefetchRoute(item.href)}
                onTouchStart={() => prefetchRoute(item.href)}
                className={`mobile-touch-target flex min-h-[4.25rem] min-w-[4.5rem] flex-1 flex-col items-center justify-center rounded-2xl px-2 py-2 transition active:scale-95 ${
                  isActive
                    ? 'text-blue-600'
                    : 'text-slate-400'
                }`}
              >
                <div className={`flex h-[30px] w-[44px] items-center justify-center rounded-[15px] ${
                  isActive ? 'bg-gradient-to-br from-blue-50 to-sky-50' : ''
                }`}>
                  <Icon size={20} className={isActive ? 'fill-blue-600 text-blue-600' : ''} />
                </div>
                <span className={`mt-1 text-[11px] ${isActive ? 'font-semibold' : 'font-medium'}`}>{item.label}</span>
              </Link>
            )
          })}
        </div>
      </nav>
    </>
  )
}
