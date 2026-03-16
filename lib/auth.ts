import { AuthOptions, Session } from 'next-auth'
import { JWT, getToken } from 'next-auth/jwt'
import CredentialsProvider from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import { prisma } from './prisma'
import { NextRequest } from 'next/server'
import { authByApiKey } from './api-key'

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
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
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
          role: user.role
        }
      }
    })
  ],
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60,
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
        token.role = (user as SessionUser).role
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
  // 生产环境开启 debug 以便排查问题，确认正常后可关闭
  debug: process.env.NEXTAUTH_DEBUG === 'true',
}

// 用户存在性缓存（5分钟TTL），避免每次请求都查询数据库
// 用于检测已被管理员删除但JWT尚未过期的用户
const userExistsCache = new Map<string, { exists: boolean; expiry: number }>()
const USER_CACHE_TTL = 5 * 60 * 1000 // 5分钟
const USER_CACHE_MAX_SIZE = 5000

async function checkUserExists(userId: string): Promise<boolean> {
  const now = Date.now()
  const cached = userExistsCache.get(userId)
  
  if (cached && now < cached.expiry) {
    return cached.exists
  }

  // 清理过期缓存
  if (userExistsCache.size > USER_CACHE_MAX_SIZE) {
    for (const [key, val] of userExistsCache) {
      if (now > val.expiry) userExistsCache.delete(key)
    }
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true }
  })
  
  const exists = !!user
  userExistsCache.set(userId, { exists, expiry: now + USER_CACHE_TTL })
  return exists
}

// 当用户被删除时，清除缓存（供 admin API 调用）
export function invalidateUserCache(userId: string) {
  userExistsCache.delete(userId)
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
      // 检查用户是否仍然存在（防止被管理员删除后 JWT 仍有效）
      const userId = token.id as string
      if (!userId || !(await checkUserExists(userId))) {
        return null
      }
      
      return {
        user: {
          id: token.id as string,
          email: token.email as string,
          name: token.name as string,
          role: (token.role as string) || 'USER'
        },
        expires: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
      }
    }

    // 2. Cookie 无效时，尝试 API Key 认证（从 Authorization: Bearer bfk_xxx 头）
    return await authByApiKey(request)
  } catch (error) {
    console.error('Auth error:', error)
    return null
  }
}
