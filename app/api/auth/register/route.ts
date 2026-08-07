import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { logError } from '@/lib/logger'
import { enforceRateLimit, buildIpActionKey } from '@/lib/rate-limit'
import { getRateLimit } from '@/lib/rate-limit-config'
import { safeParseBody, validatePassword } from '@/lib/validation'
import { getAllowRegistration } from '@/lib/site-settings'
import { validateInviteCode, consumeInviteCode } from '@/lib/invite'
import { Prisma } from '@/app/generated/prisma/client'

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export async function POST(request: NextRequest) {
  try {
    const url = new URL(request.url)
    const inviteCode = url.searchParams.get('code')

    const allowRegistration = await getAllowRegistration()
    const inviteRequired = !allowRegistration
    if (inviteRequired) {
      if (!inviteCode || !(await validateInviteCode(inviteCode))) {
        return NextResponse.json({ error: '管理员已关闭注册功能' }, { status: 403 })
      }
    }

    const registerRateLimit = enforceRateLimit({
      key: buildIpActionKey('auth-register', request),
      ...getRateLimit('auth-register'),
    })
    if (!registerRateLimit.allowed) {
      return NextResponse.json(
        { error: '请求过于频繁，请稍后再试' },
        {
          status: 429,
          headers: {
            'Retry-After': String(registerRateLimit.retryAfterSeconds),
          },
        }
      )
    }

    const { data: body, error: parseError } = await safeParseBody(request)
    if (parseError || !body) {
      return NextResponse.json({ error: parseError || '请求体格式不正确' }, { status: 400 })
    }

    const { email, password, name } = body

    if (!email || !password || !name) {
      return NextResponse.json({ error: '缺少必要字段' }, { status: 400 })
    }

    if (typeof email !== 'string' || !EMAIL_REGEX.test(email)) {
      return NextResponse.json({ error: '邮箱格式不正确' }, { status: 400 })
    }

    if (typeof name !== 'string' || name.trim().length < 1 || name.trim().length > 50) {
      return NextResponse.json({ error: '用户名长度需在 1-50 个字符之间' }, { status: 400 })
    }

    if (typeof password !== 'string') {
      return NextResponse.json({ error: '密码格式不正确' }, { status: 400 })
    }
    const passwordError = validatePassword(password)
    if (passwordError) {
      return NextResponse.json({ error: passwordError }, { status: 400 })
    }

    const existingUser = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() }
    })

    if (existingUser) {
      return NextResponse.json({ error: '注册失败，请检查输入信息' }, { status: 400 })
    }

    const hashedPassword = await bcrypt.hash(password, 12)

    const user = await prisma.$transaction(async tx => {
      const created = await tx.user.create({
        data: {
          email: email.toLowerCase().trim(),
          password: hashedPassword,
          name: name.trim()
        }
      })

      if (inviteCode) {
        const consumed = await consumeInviteCode(inviteCode, created.id, tx)
        if (inviteRequired && !consumed) throw new Error('INVITE_CONFLICT')
      }
      return created
    })

    return NextResponse.json({
      id: user.id,
      email: user.email,
      name: user.name
    }, { status: 201 })
  } catch (error) {
    if (error instanceof Error && error.message === 'INVITE_CONFLICT') {
      return NextResponse.json({ error: '邀请码已失效或已被使用' }, { status: 409 })
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return NextResponse.json({ error: '注册失败，请检查输入信息' }, { status: 400 })
    }
    logError('注册失败', error)
    return NextResponse.json({ error: '注册失败' }, { status: 500 })
  }
}
