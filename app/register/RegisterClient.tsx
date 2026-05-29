'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'

type RegisterClientProps = {
  allowRegistration: boolean
}

export default function RegisterClient({ allowRegistration }: RegisterClientProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const inviteCode = searchParams.get('code')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  // Allow registration if globally enabled OR if a valid invite code is present
  const canRegister = allowRegistration || !!inviteCode

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (password !== confirmPassword) {
      setError('两次输入的密码不一致')
      return
    }

    if (password.length < 6) {
      setError('密码长度至少6位')
      return
    }

    setLoading(true)

    try {
      const url = inviteCode
        ? `/api/auth/register?code=${encodeURIComponent(inviteCode)}`
        : '/api/auth/register'
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password })
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || '注册失败')
      } else {
        router.push('/login')
      }
    } catch {
      setError('注册失败，请重试')
    } finally {
      setLoading(false)
    }
  }

  if (!canRegister) {
    return (
      <div className="flex items-center justify-center auth-bg px-6 py-10">
        <div className="w-full max-w-sm space-y-10">
          {/* Logo */}
          <div className="text-center splash-logo">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-card gradient-icon shadow-elevated mb-3">
              <svg width="36" height="36" viewBox="0 0 56 56" fill="none">
                <rect x="15" y="18" width="24" height="32" rx="8" fill="white" opacity="0.95"/>
                <rect x="20" y="9" width="14" height="10" rx="5" fill="white" opacity="0.95"/>
                <path d="M23 9 Q27 3.5 31 9" fill="white" opacity="0.95" stroke="white" strokeWidth="1.5"/>
                <rect x="17" y="30" width="20" height="18" rx="6.5" fill="rgba(244,114,182,0.25)"/>
                <path d="M27 33 C25 31 22.5 31.8 22.5 33.8 C22.5 35.8 27 38.5 27 38.5 C27 38.5 31.5 35.8 31.5 33.8 C31.5 31.8 29 31 27 33Z" fill="rgba(59,130,246,0.5)"/>
              </svg>
            </div>
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Baby Feed</h1>
            <p className="text-slate-500 mt-1 text-sm mb-4">宝宝喂养记录</p>
          </div>

          {/* 注册关闭提示 */}
          <div className="bg-white p-6 sm:p-8 rounded-card shadow-card border border-blue-100/60 text-center auth-card-animate">
            <div className="w-14 h-14 bg-amber-50 border border-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-amber-500" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
              </svg>
            </div>
            <h2 className="text-lg font-bold text-slate-900 mb-2">注册已关闭</h2>
            <p className="text-slate-500 text-sm leading-relaxed mb-6">
              管理员已关闭新用户注册功能。<br />
              如需使用，请联系管理员获取邀请链接。
            </p>
            <Link
              href="/login"
              className="block w-full py-3 px-4 gradient-primary text-white font-semibold rounded-button shadow-elevated transition-all duration-200 hover:opacity-90 active:scale-[0.98] text-center"
            >
              返回登录
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-center justify-center auth-bg px-6 py-10">
      <div className="w-full max-w-sm space-y-10">
        {/* Logo */}
        <div className="text-center splash-logo">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-card gradient-icon shadow-elevated mb-3">
            <svg width="32" height="32" viewBox="0 0 56 56" fill="none">
              <rect x="15" y="18" width="24" height="32" rx="8" fill="white" opacity="0.95"/>
              <rect x="20" y="9" width="14" height="10" rx="5" fill="white" opacity="0.95"/>
              <path d="M23 9 Q27 3.5 31 9" fill="white" opacity="0.95" stroke="white" strokeWidth="1.5"/>
              <rect x="17" y="30" width="20" height="18" rx="6.5" fill="rgba(244,114,182,0.25)"/>
              <path d="M27 33 C25 31 22.5 31.8 22.5 33.8 C22.5 35.8 27 38.5 27 38.5 C27 38.5 31.5 35.8 31.5 33.8 C31.5 31.8 29 31 27 33Z" fill="rgba(59,130,246,0.5)"/>
            </svg>
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Baby Feed</h1>
          <p className="text-slate-500 mt-1 text-sm mb-4">
            {inviteCode ? '通过邀请链接注册' : '创建您的账号'}
          </p>
        </div>

        {/* 表单卡片 */}
        <form
          onSubmit={handleSubmit}
          className="bg-white p-6 sm:p-8 rounded-card shadow-card border border-blue-100/60 auth-card-animate"
        >
          {inviteCode && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-element p-3 text-sm text-emerald-700 mb-5">
              您正在通过邀请链接注册，请填写以下信息完成注册。
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-slate-700 mb-1.5">
                姓名
              </label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full px-4 py-3 border border-slate-200 rounded-element bg-slate-50 text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-blue-400/40 focus:border-blue-400 focus:bg-white outline-none transition-all duration-200"
                placeholder="请输入姓名"
                autoComplete="name"
              />
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-1.5">
                邮箱
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-4 py-3 border border-slate-200 rounded-element bg-slate-50 text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-blue-400/40 focus:border-blue-400 focus:bg-white outline-none transition-all duration-200"
                placeholder="请输入邮箱"
                autoComplete="email"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-slate-700 mb-1.5">
                密码
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full px-4 py-3 border border-slate-200 rounded-element bg-slate-50 text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-blue-400/40 focus:border-blue-400 focus:bg-white outline-none transition-all duration-200"
                placeholder="请输入密码（至少6位）"
                autoComplete="new-password"
              />
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-slate-700 mb-1.5">
                确认密码
              </label>
              <input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                className="w-full px-4 py-3 border border-slate-200 rounded-element bg-slate-50 text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-blue-400/40 focus:border-blue-400 focus:bg-white outline-none transition-all duration-200"
                placeholder="请再次输入密码"
                autoComplete="new-password"
              />
            </div>
          </div>

          {error && (
            <div className="mt-4 text-red-500 text-sm text-center bg-red-50 border border-red-100 p-3 rounded-element">
              {error}
            </div>
          )}

          {/* 操作区 */}
          <div className="mt-7">
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 gradient-primary text-white font-semibold rounded-button shadow-elevated transition-all duration-200 hover:opacity-90 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100"
            >
              {loading ? '注册中...' : '注册'}
            </button>

            <p className="mt-4 text-center text-sm text-slate-500">
              已有账号？
              <Link href="/login" className="text-blue-600 hover:text-blue-700 font-medium ml-1">
                立即登录
              </Link>
            </p>
          </div>
        </form>
      </div>
    </div>
  )
}
