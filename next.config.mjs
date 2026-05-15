/** @type {import('next').NextConfig} */
const trustedCorsOrigin = (() => {
  const rawOrigin = process.env.CORS_ALLOWED_ORIGIN || process.env.NEXTAUTH_URL || 'http://localhost:3000';

  try {
    return new URL(rawOrigin).origin;
  } catch {
    return 'http://localhost:3000';
  }
})();

const nextConfig = {
  output: 'standalone',
  // 标记为外部包，确保 Next.js 从 node_modules 加载而非 bundle
  // 这些包要么含原生二进制（libsql），要么是其传递依赖链的一部分
  serverExternalPackages: [
    '@prisma/client',
    '@prisma/adapter-libsql',
    'libsql',
    '@libsql/client',
    'bcryptjs',
  ],
  // 信任反向代理传递的 X-Forwarded-* 头
  // 这对于 HTTPS 反向代理 → HTTP 容器 的场景至关重要
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-store, max-age=0',
          },
          {
            key: 'Pragma',
            value: 'no-cache',
          },
        ],
      },
      {
        source: '/api/auth/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-store, max-age=0',
          },
        ],
      },
      {
        // 为业务 API 添加受限 CORS 支持（供受信任前端通过 API Key 调用）
        // 不再使用通配符，避免任意第三方站点跨域读取敏感数据
        source: '/api/:path((?!auth/).*)',
        headers: [
          {
            key: 'Access-Control-Allow-Origin',
            value: trustedCorsOrigin,
          },
          {
            key: 'Access-Control-Allow-Methods',
            value: 'GET, POST, PUT, DELETE, OPTIONS',
          },
          {
            key: 'Access-Control-Allow-Headers',
            value: 'Authorization, Content-Type',
          },
          {
            key: 'Access-Control-Max-Age',
            value: '86400',
          },
          {
            key: 'Vary',
            value: 'Origin',
          },
        ],
      },
      {
        // 所有路由添加安全响应头
        source: '/:path*',
        headers: [
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
          {
            key: 'Content-Security-Policy',
            // 开发模式需要 'unsafe-eval'（React Refresh / HMR），生产环境不需要
            value: process.env.NODE_ENV === 'production'
              ? "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self'; frame-ancestors 'none'"
              : "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self'; frame-ancestors 'none'",
          },
        ],
      },
    ];
  },
  experimental: {
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },
};

export default nextConfig;
