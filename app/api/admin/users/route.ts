import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { invalidateUserCache } from '@/lib/auth'
import { requireAdmin } from '@/lib/admin'
import { prisma } from '@/lib/prisma'
import { validateId, safeParseBody, validateSameOrigin, validatePassword } from '@/lib/validation'
import { noStoreHeaders } from '@/lib/api-helpers'
import { logError } from '@/lib/logger'
import { buildUserActionKey, enforceRateLimit } from '@/lib/rate-limit'
import { getRateLimit } from '@/lib/rate-limit-config'
import { emitUserDeleted } from '@/lib/webhook-service'

export async function GET(request: NextRequest) {
  const check = await requireAdmin(request)
  if ('error' in check) {
    return NextResponse.json({ error: check.error }, { status: check.status })
  }

  const rateLimit = enforceRateLimit({
    key: buildUserActionKey('admin-users-list', check.session.user.id, request),
    ...getRateLimit('admin-users-list'),
  })
  if (!rateLimit.allowed) {
    return NextResponse.json({ error: '请求过于频繁' }, { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfterSeconds) } })
  }

  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
        _count: {
          select: {
            babies: true,
            feedingRecords: true,
            healthRecords: true,
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    })

    return NextResponse.json(users, {
      headers: noStoreHeaders,
    })
  } catch (error) {
    logError('获取用户列表失败', error)
    return NextResponse.json({ error: '获取用户列表失败' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  const check = await requireAdmin(request)
  if ('error' in check) {
    return NextResponse.json({ error: check.error }, { status: check.status })
  }

  const rateLimit = enforceRateLimit({
    key: buildUserActionKey('admin-users-delete', check.session.user.id, request),
    ...getRateLimit('admin-users-delete'),
  })
  if (!rateLimit.allowed) {
    return NextResponse.json({ error: '操作过于频繁' }, { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfterSeconds) } })
  }

  try {
    const originCheck = validateSameOrigin(request)
    if (!originCheck.valid) {
      return NextResponse.json({ error: originCheck.error }, { status: 403 })
    }

    const { data: body, error: parseError } = await safeParseBody(request)
    if (parseError || !body) {
      return NextResponse.json({ error: parseError || '请求体格式不正确' }, { status: 400 })
    }

    const { userId } = body
    
    if (typeof userId !== 'string' || !userId) {
      return NextResponse.json({ error: '缺少用户ID' }, { status: 400 })
    }

    const idCheck = validateId(userId, '用户ID')
    if (!idCheck.valid) {
      return NextResponse.json({ error: idCheck.error }, { status: 400 })
    }

    if (userId === check.session.user.id) {
      return NextResponse.json({ error: '不能删除自己的账户' }, { status: 400 })
    }

    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true, email: true, name: true }
    })

    if (!targetUser) {
      return NextResponse.json({ error: '用户不存在' }, { status: 404 })
    }

    // Get counts before deletion
    const counts = {
      babies: await prisma.baby.count({ where: { createdBy: userId } }),
      feedingRecords: await prisma.feedingRecord.count({ where: { createdBy: userId } }),
      healthRecords: await prisma.healthRecord.count({ where: { createdBy: userId } }),
    }

    await prisma.$transaction(async (tx) => {
      await tx.feedingRecord.deleteMany({ where: { createdBy: userId } })
      await tx.healthRecord.deleteMany({ where: { createdBy: userId } })
      await tx.baby.deleteMany({ where: { createdBy: userId } })
      await tx.apiKey.deleteMany({ where: { userId } })
      await tx.webhookEndpoint.deleteMany({ where: { userId } })
      await tx.user.delete({ where: { id: userId } })
    })

    // Emit webhook event to admin (fire and forget)
    emitUserDeleted(check.session.user.id, targetUser, counts).catch(error => {
      logError('Failed to emit user deleted webhook', error)
    })

    invalidateUserCache(userId)

    return NextResponse.json({ success: true })
  } catch (error) {
    logError('删除用户失败', error)
    return NextResponse.json({ error: '删除用户失败' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  const check = await requireAdmin(request)
  if ('error' in check) {
    return NextResponse.json({ error: check.error }, { status: check.status })
  }

  try {
    const originCheck = validateSameOrigin(request)
    if (!originCheck.valid) {
      return NextResponse.json({ error: originCheck.error }, { status: 403 })
    }

    const { data: body, error: parseError } = await safeParseBody(request)
    if (parseError || !body) {
      return NextResponse.json({ error: parseError || '请求体格式不正确' }, { status: 400 })
    }

    const { userId, action } = body

    if (typeof userId !== 'string' || !userId) {
      return NextResponse.json({ error: '缺少用户ID' }, { status: 400 })
    }

    const idCheck = validateId(userId, '用户ID')
    if (!idCheck.valid) {
      return NextResponse.json({ error: idCheck.error }, { status: 400 })
    }

    if (userId === check.session.user.id) {
      return NextResponse.json({ error: '不能修改自己的账户' }, { status: 400 })
    }

    // Update user info (name, email)
    if (action === 'updateInfo') {
      const rateLimit = enforceRateLimit({
        key: buildUserActionKey('admin-users-update-info', check.session.user.id, request),
        ...getRateLimit('admin-users-update-info'),
      })
      if (!rateLimit.allowed) {
        return NextResponse.json({ error: '操作过于频繁' }, { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfterSeconds) } })
      }

      const { name, email } = body

      if (typeof name !== 'string' || !name.trim() || name.length > 50) {
        return NextResponse.json({ error: '用户名不能为空且不超过50个字符' }, { status: 400 })
      }

      if (typeof email !== 'string' || !email.trim() || email.length > 255) {
        return NextResponse.json({ error: '邮箱不能为空' }, { status: 400 })
      }

      const trimmedEmail = email.trim().toLowerCase()
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
        return NextResponse.json({ error: '邮箱格式不正确' }, { status: 400 })
      }

      const existingUser = await prisma.user.findUnique({ where: { email: trimmedEmail }, select: { id: true } })
      if (existingUser && existingUser.id !== userId) {
        return NextResponse.json({ error: '该邮箱已被其他用户使用' }, { status: 409 })
      }

      await prisma.user.update({
        where: { id: userId },
        data: { name: name.trim(), email: trimmedEmail },
      })

      invalidateUserCache(userId)

      return NextResponse.json({ success: true })
    }

    // Update user password (admin reset)
    if (action === 'updatePassword') {
      const rateLimit = enforceRateLimit({
        key: buildUserActionKey('admin-users-update-password', check.session.user.id, request),
        ...getRateLimit('admin-users-update-password'),
      })
      if (!rateLimit.allowed) {
        return NextResponse.json({ error: '操作过于频繁' }, { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfterSeconds) } })
      }

      const { newPassword } = body

      if (typeof newPassword !== 'string' || !newPassword) {
        return NextResponse.json({ error: '请输入新密码' }, { status: 400 })
      }

      const passwordError = validatePassword(newPassword)
      if (passwordError) {
        return NextResponse.json({ error: passwordError }, { status: 400 })
      }

      const hashedPassword = await bcrypt.hash(newPassword, 12)
      await prisma.user.update({
        where: { id: userId },
        data: {
          password: hashedPassword,
          passwordVersion: { increment: 1 },
        },
      })

      // Revoke all API keys for security
      await prisma.apiKey.deleteMany({ where: { userId } })

      invalidateUserCache(userId)

      return NextResponse.json({ success: true })
    }

    // Existing role change logic (backward compatible, no action field)
    {
      const rateLimit = enforceRateLimit({
        key: buildUserActionKey('admin-users-role', check.session.user.id, request),
        ...getRateLimit('admin-users-role'),
      })
      if (!rateLimit.allowed) {
        return NextResponse.json({ error: '操作过于频繁' }, { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfterSeconds) } })
      }

      const { role } = body

      if (typeof role !== 'string' || !role) {
        return NextResponse.json({ error: '缺少参数' }, { status: 400 })
      }

      if (!['USER', 'ADMIN'].includes(role)) {
        return NextResponse.json({ error: '无效的角色' }, { status: 400 })
      }

      const user = await prisma.user.update({
        where: { id: userId },
        data: { role },
        select: { id: true, role: true }
      })

      return NextResponse.json(user)
    }
  } catch (error) {
    logError('修改用户失败', error)
    return NextResponse.json({ error: '操作失败' }, { status: 500 })
  }
}
