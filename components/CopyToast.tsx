'use client'

import { useState, useCallback, createContext, useContext, type ReactNode } from 'react'
import { Check } from 'lucide-react'

interface Toast {
  id: number
  message: string
}

interface CopyToastContextValue {
  showCopyToast: (message?: string) => void
  copyToClipboard: (text: string, message?: string) => Promise<void>
}

const CopyToastContext = createContext<CopyToastContextValue | null>(null)

export function useCopyToast() {
  const ctx = useContext(CopyToastContext)
  if (!ctx) throw new Error('useCopyToast must be used within CopyToastProvider')
  return ctx
}

let toastId = 0

export function CopyToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const showCopyToast = useCallback((message = '已复制到剪贴板') => {
    const id = ++toastId
    setToasts(prev => [...prev, { id, message }])
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id))
    }, 2000)
  }, [])

  const copyToClipboard = useCallback(async (text: string, message?: string) => {
    await navigator.clipboard.writeText(text)
    showCopyToast(message)
  }, [showCopyToast])

  return (
    <CopyToastContext.Provider value={{ showCopyToast, copyToClipboard }}>
      {children}
      {/* Toast container — fixed at top center */}
      <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[9999] flex flex-col items-center gap-2 pointer-events-none">
        {toasts.map(toast => (
          <div
            key={toast.id}
            className="animate-[toast-in_0.3s_ease] flex items-center gap-2 rounded-button bg-slate-900/90 px-4 py-2.5 text-sm font-medium text-white shadow-elevated backdrop-blur-sm"
          >
            <Check size={16} className="text-green-400" />
            {toast.message}
          </div>
        ))}
      </div>
    </CopyToastContext.Provider>
  )
}
