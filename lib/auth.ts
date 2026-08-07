import { AuthOptions, Session } from 'next-auth'
import { JWT, getToken } from 'next-auth/jwt'
import CredentialsProvider from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import { prisma } from './prisma'
import { NextRequest } from 'next/server'
import { authByApiKey } from './api-key'
import { logError } from '@/lib/logger'
import { enforceRateLimit } from './rate-limit'
import { getRateLimit } from './rate-limit-config'

interface SessionUser {
  id: string
  email: string
  name: string
  role: string
}

declare module 'next-auth' {
  interface Session {
    user: SessionUser
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string
    role: string
    passwordVersion: number
  }
}

// 判断是否通过 HTTPS 访问（影响 cookie 的 Secure 标志和名称前缀）
// 注意：去掉 NEXTAUTH_URL 末尾的斜杠，避免 NextAuth 拼接回调 URL 时出现双斜杠
const nextAuthUrl = process.env.NEXTAUTH_URL?.replace(/\/+$/, '')
const useSecureCookies = nextAuthUrl?.startsWith('https://') ?? false
// HTTPS 时 NextAuth 默认用 __Secure- 前缀，HTTP 时不带前缀
const cookiePrefix = useSecureCookies ? '__Secure-' : ''

export const authOptions: AuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' }
      },
      async authorize(credentials, req) {
        if (!credentials?.email || !credentials?.password) {
          return null
        }

        // Fix 1: 登录接口速率限制 — 防止暴力破解密码
        const ip = (req?.headers && typeof req.headers === 'object')
          ? (req.headers as Record<string, string>)['x-forwarded-for']?.split(',')[0]?.trim()
            || (req.headers as Record<string, string>)['x-real-ip']
            || 'unknown'
          : 'unknown'

        const loginRateLimit = enforceRateLimit({
          key: `auth-login:${ip}`,
          ...getRateLimit('auth-login'),
        })
        if (!loginRateLimit.allowed) {
          return null
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email }
        })

        if (!user) {
          return null
        }

        const isPasswordValid = await bcrypt.compare(
          credentials.password,
          user.password
        )

        if (!isPasswordValid) {
          return null
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          passwordVersion: user.passwordVersion,
        }
      }
    })
  ],
  session: {
    strategy: 'jwt',
    // Fix 3: 缩短 JWT 有效期从 30 天到 7 天，降低 token 被盗后的攻击窗口
    maxAge: 7 * 24 * 60 * 60,
  },
  pages: {
    signIn: '/login'
  },
  // useSecureCookies 必须和 cookie 配置中的 secure 标志保持一致
  // 这告诉 NextAuth 内部在读取/写入 cookie 时使用正确的名称前缀
  useSecureCookies,
  cookies: {
    sessionToken: {
      name: `${cookiePrefix}next-auth.session-token`,
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: useSecureCookies,
      },
    },
    callbackUrl: {
      name: `${cookiePrefix}next-auth.callback-url`,
      options: {
        sameSite: 'lax',
        path: '/',
        secure: useSecureCookies,
      },
    },
    csrfToken: {
      // CSRF token 始终不使用 __Secure- 前缀（NextAuth 约定）
      name: 'next-auth.csrf-token',
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: useSecureCookies,
      },
    },
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.role = (user as SessionUser & { passwordVersion?: number }).role
        // Fix 3: 将 passwordVersion 存入 JWT，用于检测密码是否已更改
        token.passwordVersion = (user as SessionUser & { passwordVersion?: number }).passwordVersion ?? 0
      }
      return token
    },
    async session({ session, token }: { session: Session; token: JWT }) {
      if (session.user) {
        session.user.id = token.id as string
        session.user.role = token.role as string
      }
      return session
    }
  },
  // 仅允许在非生产环境开启 debug，避免生产日志泄露敏感信息
  debug: process.env.NODE_ENV !== 'production' && process.env.NEXTAUTH_DEBUG === 'true',
}

interface UserCacheEntry {
  exists: boolean
  passwordVersion: number
  role: string
}

async function validateUser(userId: string): Promise<UserCacheEntry | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, passwordVersion: true, role: true }
  })

  return {
    exists: !!user,
    passwordVersion: user?.passwordVersion ?? 0,
    role: user?.role ?? 'USER',
  }
}

// Kept for call-site compatibility. Validation is intentionally uncached so
// password, deletion, and role changes are visible across all app processes.
export function invalidateUserCache(_userId: string) {
  void _userId
}

export async function auth(request: NextRequest): Promise<Session | null> {
  try {
    // 1. 优先尝试 Cookie/Session 认证
    const token = await getToken({
      req: request,
      secret: process.env.NEXTAUTH_SECRET,
      // 显式指定 cookie 名，与 authOptions.cookies.sessionToken.name 保持一致
      cookieName: `${cookiePrefix}next-auth.session-token`,
      // 在反向代理场景下 secureCookie 必须与 useSecureCookies 一致
      secureCookie: useSecureCookies,
    })

    if (token) {
      const userId = token.id as string
      if (!userId) {
        return null
      }

      // Fix 3: 验证用户存在性 + 密码版本（防止被删除或密码变更后 JWT 仍有效）
      const userEntry = await validateUser(userId)
      if (!userEntry || !userEntry.exists) {
        return null
      }

      // 如果 JWT 中的 passwordVersion 与数据库不一致，说明密码已更改，强制重新登录
      const tokenPasswordVersion = (token.passwordVersion as number) ?? 0
      if (tokenPasswordVersion < userEntry.passwordVersion) {
        return null
      }

      return {
        user: {
          id: token.id as string,
          email: token.email as string,
          name: token.name as string,
          role: userEntry.role
        },
        expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
      }
    }

    // 2. Cookie 无效时，尝试 API Key 认证（从 Authorization: Bearer bfk_xxx 头）
    return await authByApiKey(request)
  } catch (error) {
    logError('Auth error', error)
    return null
  }
}
