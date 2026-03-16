import { withAuth } from 'next-auth/middleware'
import { NextResponse } from 'next/server'

const useSecureCookies = process.env.NEXTAUTH_URL?.startsWith('https://') ?? false
const cookiePrefix = useSecureCookies ? '__Secure-' : ''

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
        
        // 其他所有路由都需要登录
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
