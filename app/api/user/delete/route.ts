import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { auth, invalidateUserCache } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { buildUserActionKey, enforceRateLimit } from '@/lib/rate-limit'
import { getRateLimit } from '@/lib/rate-limit-config'
import { safeParseBody, validateSameOrigin } from '@/lib/validation'
import { noStoreHeaders } from '@/lib/api-helpers'
import { logError } from '@/lib/logger'

// DELETE /api/user/delete - 注销账户（删除用户及所有关联数据）
export async function DELETE(request: NextRequest) {
  try {
    const session = await auth(request)
    if (!session) {
      return NextResponse.json({ error: '未授权' }, { status: 401, headers: noStoreHeaders })
    }

    const originCheck = validateSameOrigin(request)
    if (!originCheck.valid) {
      return NextResponse.json({ error: originCheck.error }, { status: 403, headers: noStoreHeaders })
    }

    const deleteAccountRateLimit = enforceRateLimit({
      key: buildUserActionKey('user-delete-account', session.user.id, request),
      ...getRateLimit('user-delete-account'),
    })
    if (!deleteAccountRateLimit.allowed) {
      return NextResponse.json(
        { error: '请求过于频繁，请稍后再试' },
        {
          status: 429,
          headers: {
            ...noStoreHeaders,
            'Retry-After': String(deleteAccountRateLimit.retryAfterSeconds),
          },
        }
      )
    }

    const { data: body, error: parseError } = await safeParseBody(request)
    if (parseError || !body) {
      return NextResponse.json({ error: parseError || '请求体格式不正确' }, { status: 400, headers: noStoreHeaders })
    }

    const { password } = body

    if (!password || typeof password !== 'string') {
      return NextResponse.json({ error: '请输入密码以确认注销' }, { status: 400, headers: noStoreHeaders })
    }

    // Get current user (only fetch needed fields)
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, password: true }
    })

    if (!user) {
      return NextResponse.json({ error: '用户不存在' }, { status: 404, headers: noStoreHeaders })
    }

    // 验证密码
    const isPasswordValid = await bcrypt.compare(password, user.password)
    if (!isPasswordValid) {
      return NextResponse.json({ error: '密码不正确' }, { status: 400, headers: noStoreHeaders })
    }

    // 利用数据库级联删除（schema 中已配置 onDelete: Cascade）
    // 使用事务确保原子性：删除用户时自动级联删除所有关联的 Baby、FeedingRecord、HealthRecord
    const userId = session.user.id

    await prisma.$transaction(async (tx) => {
      // 手动删除用户创建的喂养和健康记录（通过 createdBy 关联）
      await tx.feedingRecord.deleteMany({ where: { createdBy: userId } })
      await tx.healthRecord.deleteMany({ where: { createdBy: userId } })
      await tx.baby.deleteMany({ where: { createdBy: userId } })
      await tx.apiKey.deleteMany({ where: { userId } })
      const deleted = await tx.user.deleteMany({ where: { id: userId, password: user.password } })
      if (deleted.count !== 1) throw new Error('PASSWORD_UPDATE_CONFLICT')
    })

    // 清除缓存，使 JWT 立即失效
    invalidateUserCache(userId)

    return NextResponse.json({ message: '账户已注销' }, { headers: noStoreHeaders })
  } catch (error) {
    if (error instanceof Error && error.message === 'PASSWORD_UPDATE_CONFLICT') {
      return NextResponse.json({ error: '密码已发生变化，请重新登录后重试' }, { status: 409, headers: noStoreHeaders })
    }
    logError('注销账户失败', error)
    return NextResponse.json({ error: '注销账户失败' }, { status: 500, headers: noStoreHeaders })
  }
}
