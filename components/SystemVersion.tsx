'use client'

import { useCallback, useEffect, useState } from 'react'
import { CircleCheck, ExternalLink, Package, RefreshCw } from 'lucide-react'

interface Props {
  currentVersion: string
}

interface VersionCheckResponse {
  currentVersion: string
  latestVersion: string
  updateAvailable: boolean
  releaseName: string
  releaseUrl: string
  publishedAt: string | null
  checkedAt: string
}

type VersionCheckStatus = 'idle' | 'checking' | 'success' | 'error'

function isVersionCheckResponse(value: unknown): value is VersionCheckResponse {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false

  const result = value as Partial<VersionCheckResponse>
  return typeof result.currentVersion === 'string'
    && typeof result.latestVersion === 'string'
    && typeof result.updateAvailable === 'boolean'
    && typeof result.releaseName === 'string'
    && typeof result.releaseUrl === 'string'
    && (result.publishedAt === null || typeof result.publishedAt === 'string')
    && typeof result.checkedAt === 'string'
}

function getResponseError(value: unknown): string {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return '暂时无法检查更新'
  const error = (value as { error?: unknown }).error
  return typeof error === 'string' && error ? error : '暂时无法检查更新'
}

export default function SystemVersion({ currentVersion }: Props) {
  const [status, setStatus] = useState<VersionCheckStatus>('idle')
  const [versionInfo, setVersionInfo] = useState<VersionCheckResponse | null>(null)
  const [errorMessage, setErrorMessage] = useState('')

  const checkForUpdates = useCallback(async (signal?: AbortSignal) => {
    setStatus('checking')
    setErrorMessage('')

    try {
      const response = await fetch('/api/system/version', {
        cache: 'no-store',
        signal,
      })
      const result: unknown = await response.json().catch(() => null)
      if (!response.ok) throw new Error(getResponseError(result))
      if (!isVersionCheckResponse(result)) throw new Error('版本信息格式不正确')

      setVersionInfo(result)
      setStatus('success')
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return
      setVersionInfo(null)
      setErrorMessage(error instanceof TypeError ? '暂时无法检查更新' : error instanceof Error ? error.message : '暂时无法检查更新')
      setStatus('error')
    }
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    void checkForUpdates(controller.signal)
    return () => controller.abort()
  }, [checkForUpdates])

  return (
    <div className="bg-white rounded-card p-5 shadow-card border border-blue-50 sm:p-6 lg:p-7">
      <h2 className="mb-3 text-lg font-bold text-slate-900">系统信息</h2>
      <div className="flex min-w-0 items-center gap-3 border-t border-slate-100 pt-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600" aria-hidden="true">
          <Package size={19} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <span className="text-sm font-medium text-slate-800">系统版本</span>
            <span className="text-sm font-semibold text-slate-950">{currentVersion}</span>
          </div>
          <div className="mt-1 flex min-h-5 flex-wrap items-center gap-x-2 gap-y-1 text-xs" aria-live="polite">
            {status === 'checking' && <span className="text-slate-500">正在检查更新</span>}
            {status === 'success' && versionInfo?.updateAvailable && (
              <>
                <span className="text-amber-700">发现新版本 {versionInfo.latestVersion}</span>
                <a
                  href={versionInfo.releaseUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={versionInfo.releaseName}
                  className="inline-flex items-center gap-1 font-medium text-blue-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                >
                  查看更新
                  <ExternalLink size={12} />
                </a>
              </>
            )}
            {status === 'success' && versionInfo && !versionInfo.updateAvailable && (
              <>
                <CircleCheck size={13} className="shrink-0 text-emerald-600" />
                <span className="text-emerald-700">已是最新版本</span>
              </>
            )}
            {status === 'error' && <span className="text-slate-500">{errorMessage}</span>}
            {status === 'idle' && <span className="text-slate-500">尚未检查更新</span>}
          </div>
        </div>
        <button
          type="button"
          onClick={() => { void checkForUpdates() }}
          disabled={status === 'checking'}
          aria-label="重新检查系统更新"
          title="重新检查系统更新"
          className="mobile-touch-target inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 disabled:cursor-wait disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        >
          <RefreshCw size={17} className={status === 'checking' ? 'animate-spin' : ''} />
        </button>
      </div>
    </div>
  )
}
