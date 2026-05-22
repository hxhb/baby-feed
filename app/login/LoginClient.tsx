'use client'

import { useEffect, useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

type LoginClientProps = {
  allowRegistration: boolean
}

export default function LoginClient({ allowRegistration }: LoginClientProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [isRegistrationAllowed, setIsRegistrationAllowed] = useState(allowRegistration)
  const router = useRouter()

  useEffect(() => {
    let isMounted = true

    const syncRegistrationStatus = async () => {
      try {
        const response = await fetch('/api/site/registration-status', {
          cache: 'no-store',
        })

        if (!response.ok) {
          return
        }

        const data = await response.json()
        if (isMounted && typeof data.allowRegistration === 'boolean') {
          setIsRegistrationAllowed(data.allowRegistration)
        }
      } catch (err) {
        console.error('sync registration status error:', err)
      }
    }

    syncRegistrationStatus()

    return () => {
      isMounted = false
    }
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const result = await signIn('credentials', {
        email,
        password,
        redirect: false,
        callbackUrl: '/',
      })

      if (result?.error) {
        if (result.error === 'CredentialsSignin') {
          setError('邮箱或密码错误')
        } else {
          setError(`登录失败: ${result.error}`)
        }
      } else if (result?.ok) {
        router.push('/')
        router.refresh()
      } else {
        setError('登录异常，请重试')
      }
    } catch (err) {
      console.error('login error:', err)
      setError(`登录失败: ${err instanceof Error ? err.message : '请重试'}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-brand-50 via-blue-50 to-pink-50 px-4">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center splash-logo">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-card gradient-icon shadow-elevated mb-4">
            <svg width="36" height="36" viewBox="0 0 56 56" fill="none">
              <rect x="15" y="18" width="24" height="32" rx="8" fill="white" opacity="0.95"/>
              <rect x="20" y="9" width="14" height="10" rx="5" fill="white" opacity="0.95"/>
              <path d="M23 9 Q27 3.5 31 9" fill="white" opacity="0.95" stroke="white" strokeWidth="1.5"/>
              <rect x="17" y="30" width="20" height="18" rx="6.5" fill="rgba(244,114,182,0.25)"/>
              <path d="M27 33 C25 31 22.5 31.8 22.5 33.8 C22.5 35.8 27 38.5 27 38.5 C27 38.5 31.5 35.8 31.5 33.8 C31.5 31.8 29 31 27 33Z" fill="rgba(59,130,246,0.5)"/>
            </svg>
          </div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Baby Feed</h1>
          <p className="text-slate-500 mt-1">宝宝喂养记录</p>
        </div>

        <form onSubmit={handleSubmit} className="mt-8 space-y-6 bg-white p-8 rounded-card shadow-card border border-blue-50">
          <div className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                邮箱
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-4 py-3 border border-slate-200 rounded-element focus:ring-2 focus:ring-blue-400 focus:border-blue-400 outline-none transition bg-white"
                placeholder="请输入邮箱"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                密码
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full px-4 py-3 border border-slate-200 rounded-element focus:ring-2 focus:ring-blue-400 focus:border-blue-400 outline-none transition bg-white"
                placeholder="请输入密码"
              />
            </div>
          </div>

          {error && (
            <div className="text-red-500 text-sm text-center bg-red-50 p-3 rounded-lg">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 px-4 gradient-primary text-white font-medium rounded-button shadow-elevated transition hover:opacity-90 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? '登录中...' : '登录'}
          </button>

          {isRegistrationAllowed && (
            <div className="text-center text-sm">
              <span className="text-slate-500">还没有账号？</span>
              <Link href="/register" className="text-blue-600 hover:text-blue-700 font-medium ml-1">
                立即注册
              </Link>
            </div>
          )}
        </form>
      </div>
    </div>
  )
}