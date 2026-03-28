'use client'

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html lang="zh-CN">
      <body>
        <div style={{
          display: 'flex',
          minHeight: '100vh',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1rem',
          fontFamily: 'system-ui, -apple-system, sans-serif',
        }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#111' }}>
            应用发生了严重错误
          </h2>
          <p style={{ marginTop: '0.5rem', fontSize: '0.875rem', color: '#666' }}>
            请刷新页面重试
          </p>
          <button
            onClick={reset}
            style={{
              marginTop: '1rem',
              padding: '0.625rem 1.5rem',
              borderRadius: '0.75rem',
              border: 'none',
              backgroundColor: '#3b82f6',
              color: '#fff',
              fontSize: '0.875rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            刷新重试
          </button>
        </div>
      </body>
    </html>
  )
}
