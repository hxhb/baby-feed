'use client'

import { WifiOff, RefreshCw } from 'lucide-react'

export default function OfflinePage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white flex items-center justify-center p-6">
      <div className="text-center max-w-md">
        <div className="w-24 h-24 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <WifiOff size={48} className="text-blue-400" />
        </div>
        <h1 className="text-2xl font-bold text-gray-800 mb-3">
          当前处于离线状态
        </h1>
        <p className="text-gray-500 mb-8 leading-relaxed">
          无法连接到网络，请检查您的网络连接后重试。
          <br />
          部分已缓存的页面仍可正常访问。
        </p>
        <button
          onClick={() => window.location.reload()}
          className="inline-flex items-center gap-2 px-6 py-3 bg-blue-500 text-white rounded-xl font-medium hover:bg-blue-600 active:scale-95 transition-all shadow-lg shadow-blue-500/25"
        >
          <RefreshCw size={18} />
          重新加载
        </button>
      </div>
    </div>
  )
}
