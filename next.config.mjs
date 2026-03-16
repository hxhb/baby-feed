/** @type {import('next').NextConfig} */
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
        source: '/api/auth/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-store, max-age=0',
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
