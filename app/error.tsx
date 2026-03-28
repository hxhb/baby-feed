'use client'

import { useEffect } from 'react'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('Page error:', error)
  }, [error])

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
      <div className="rounded-2xl border border-red-100 bg-red-50/60 p-8 shadow-sm">
        <p className="text-4xl">😵</p>
        <h2 className="mt-3 text-lg font-bold text-gray-900">页面出了点问题</h2>
        <p className="mt-1 text-sm text-gray-500">请尝试刷新或点击下方按钮重试</p>
        <button
          onClick={reset}
          className="mt-4 rounded-xl bg-blue-500 px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition active:scale-95 hover:bg-blue-600"
        >
          重试
        </button>
      </div>
    </div>
  )
}
