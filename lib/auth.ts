import { AuthOptions, Session } from 'next-auth'
import { JWT, getToken } from 'next-auth/jwt'
import CredentialsProvider from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import { prisma } from './prisma'
import { NextRequest } from 'next/server'

interface SessionUser {
  id: string
  email: string
  name: string
}

declare module 'next-auth' {
  interface Session {
    user: SessionUser
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string
  }
}

export const authOptions: AuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' }
      },
      async authorize(credentials) {
        console.log('authorize credentials:', credentials?.email)
        if (!credentials?.email || !credentials?.password) {
          return null
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email }
        })

        if (!user) {
          console.log('user not found')
          return null
        }

        const isPasswordValid = await bcrypt.compare(
          credentials.password,
          user.password
        )

        if (!isPasswordValid) {
          console.log('invalid password')
          return null
        }

        console.log('authorize success, user:', user.id)
        return {
          id: user.id,
          email: user.email,
          name: user.name
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
  cookies: {
    sessionToken: {
      name: `next-auth.session-token`,
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: process.env.NODE_ENV === 'production',
      },
    },
  },
  callbacks: {
    async jwt({ token, user }) {
      console.log('jwt callback, user:', user?.id, 'token id:', token.id)
      if (user) {
        token.id = user.id
      }
      return token
    },
    async session({ session, token }: { session: Session; token: JWT }) {
      console.log('session callback, token id:', token.id)
      if (session.user) {
        session.user.id = token.id as string
      }
      return session
    }
  },
  debug: process.env.NODE_ENV === 'development',
}

export async function auth(request?: NextRequest): Promise<Session | null> {
  try {
    const token = await getToken({ 
      req: request as NextRequest,
      secret: process.env.NEXTAUTH_SECRET 
    })
    
    if (!token) {
      console.log('auth: no token found')
      return null
    }
    
    return {
      user: {
        id: token.id as string,
        email: token.email as string,
        name: token.name as string
      },
      expires: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
    }
  } catch (error) {
    console.error('Auth error:', error)
    return null
  }
}
