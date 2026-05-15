import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { auth, invalidateUserCache } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { buildUserActionKey, enforceRateLimit } from '@/lib/rate-limit'
import { getRateLimit } from '@/lib/rate-limit-config'
import { safeParseBody, validateSameOrigin, validatePassword } from '@/lib/validation'
import { noStoreHeaders } from '@/lib/api-helpers'
import { logError } from '@/lib/logger'

// PUT /api/user/password - 修改密码
export async function PUT(request: NextRequest) {
  try {
    const session = await auth(request)
    if (!session) {
      return NextResponse.json({ error: '未授权' }, { status: 401, headers: noStoreHeaders })
    }

    const originCheck = validateSameOrigin(request)
    if (!originCheck.valid) {
      return NextResponse.json({ error: originCheck.error }, { status: 403, headers: noStoreHeaders })
    }

    const passwordRateLimit = enforceRateLimit({
      key: buildUserActionKey('user-password-update', session.user.id, request),
      ...getRateLimit('user-password-update'),
    })
    if (!passwordRateLimit.allowed) {
      return NextResponse.json(
        { error: '请求过于频繁，请稍后再试' },
        {
          status: 429,
          headers: {
            ...noStoreHeaders,
            'Retry-After': String(passwordRateLimit.retryAfterSeconds),
          },
        }
      )
    }

    const { data: body, error: parseError } = await safeParseBody(request)
    if (parseError || !body) {
      return NextResponse.json({ error: parseError || '请求体格式不正确' }, { status: 400, headers: noStoreHeaders })
    }

    const { currentPassword, newPassword } = body

    if (!currentPassword || !newPassword) {
      return NextResponse.json({ error: '请输入当前密码和新密码' }, { status: 400, headers: noStoreHeaders })
    }

    if (typeof currentPassword !== 'string' || typeof newPassword !== 'string') {
      return NextResponse.json({ error: '密码格式不正确' }, { status: 400, headers: noStoreHeaders })
    }

    // 验证新密码强度
    const passwordError = validatePassword(newPassword)
    if (passwordError) {
      return NextResponse.json({ error: passwordError }, { status: 400, headers: noStoreHeaders })
    }

    // 不允许新旧密码相同
    if (currentPassword === newPassword) {
      return NextResponse.json({ error: '新密码不能与当前密码相同' }, { status: 400, headers: noStoreHeaders })
    }

    // Get current user (only fetch needed fields)
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, password: true }
    })

    if (!user) {
      return NextResponse.json({ error: '用户不存在' }, { status: 404, headers: noStoreHeaders })
    }

    // 验证当前密码
    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password)
    if (!isCurrentPasswordValid) {
      return NextResponse.json({ error: '当前密码不正确' }, { status: 400, headers: noStoreHeaders })
    }

    // 哈希新密码并更新，同时递增 passwordVersion 使所有现有 JWT 失效
    const hashedPassword = await bcrypt.hash(newPassword, 12)
    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: session.user.id },
        data: {
          password: hashedPassword,
          passwordVersion: { increment: 1 },
        }
      })
      // 吊销所有 API Key（密码泄露场景下，API Key 也应失效）
      await tx.apiKey.deleteMany({ where: { userId: session.user.id } })
    })

    // 清除用户验证缓存，使 passwordVersion 检查立即生效
    invalidateUserCache(session.user.id)

    return NextResponse.json({ message: '密码修改成功，请重新登录' }, { headers: noStoreHeaders })
  } catch (error) {
    logError('修改密码失败', error)
    return NextResponse.json({ error: '修改密码失败' }, { status: 500, headers: noStoreHeaders })
  }
}
