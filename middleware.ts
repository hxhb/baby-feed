import { withAuth } from 'next-auth/middleware'
import { NextResponse, NextRequest } from 'next/server'

const useSecureCookies = process.env.NEXTAUTH_URL?.startsWith('https://') ?? false
const cookiePrefix = useSecureCookies ? '__Secure-' : ''

/**
 * 检查请求是否携带了 API Key（Bearer bfk_xxx 格式）
 * API Key 的实际验证在 lib/auth.ts 的 auth() 函数中进行
 * 这里只做格式检查，让 API Key 请求绕过 NextAuth 的 cookie 检查
 */
function hasApiKeyHeader(req: NextRequest): boolean {
  const authHeader = req.headers.get('authorization')
  if (!authHeader) return false
  return /^Bearer\s+bfk_[a-f0-9]{64}$/i.test(authHeader)
}

export default withAuth(
  function middleware(req) {
    return NextResponse.next()
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        const { pathname } = req.nextUrl
        
        // 允许访问登录页面、注册页面和离线页面
        if (pathname === '/login' || pathname === '/register' || pathname === '/offline') {
          return true
        }
        
        // 允许访问认证相关的 API 路由
        if (pathname.startsWith('/api/auth/')) {
          return true
        }
        
        // 允许访问公开的站点信息 API（精确匹配，避免未来新增路由被意外放行）
        if (pathname === '/api/site/registration-status') {
          return true
        }
        
        // 允许访问 PWA 资源和静态文件（精确匹配常见静态资源后缀）
        if (
          pathname.startsWith('/_next') ||
          pathname.startsWith('/favicon') ||
          pathname.startsWith('/icons/') ||
          pathname === '/manifest.json' ||
          pathname === '/sw.js' ||
          /\.(ico|png|jpg|jpeg|gif|svg|webp|css|js|woff|woff2|ttf|eot|map)$/i.test(pathname)
        ) {
          return true
        }

        // 携带 API Key 的 API 请求：让其通过 middleware，
        // 实际的 API Key 验证在各路由的 auth() 函数中进行
        if (pathname.startsWith('/api/') && hasApiKeyHeader(req)) {
          return true
        }

        // CORS preflight 请求（OPTIONS）直接放行
        if (req.method === 'OPTIONS' && pathname.startsWith('/api/')) {
          return true
        }
        
        // 其他所有路由都需要登录（cookie/session）
        return !!token
      },
    },
    pages: {
      signIn: '/login',
    },
    // middleware 的 cookies 类型是 Omit<CookieOption, "options">，只接受 name 字段
    cookies: {
      sessionToken: {
        name: `${cookiePrefix}next-auth.session-token`,
      },
    },
  }
)

export const config = {
  matcher: [
    /*
     * 匹配所有路径除了:
     * - _next/static (静态文件)
     * - _next/image (图片优化文件)
     * - favicon.ico (网站图标)
     */
    '/((?!_next/static|_next/image|favicon.ico|icon.svg).*)',
  ],
}
