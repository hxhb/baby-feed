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
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-pink-50 px-4">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">🍼 Baby Feed</h1>
          <p className="text-gray-600">新生儿喂养记录系统</p>
        </div>

        <form onSubmit={handleSubmit} className="mt-8 space-y-6 bg-white p-8 rounded-2xl shadow-lg">
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
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
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
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
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
            className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? '登录中...' : '登录'}
          </button>

          {isRegistrationAllowed && (
            <div className="text-center text-sm">
              <span className="text-gray-600">还没有账号？</span>
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