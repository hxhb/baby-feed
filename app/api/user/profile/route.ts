import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { safeParseBody, validateSameOrigin } from '@/lib/validation'
import { buildUserActionKey, enforceRateLimit } from '@/lib/rate-limit'
import { getRateLimit } from '@/lib/rate-limit-config'
import { noStoreHeaders } from '@/lib/api-helpers'
import { logError } from '@/lib/logger'

export async function GET(request: NextRequest) {
  try {
    const session = await auth(request)
    if (!session) {
      return NextResponse.json({ error: '未授权' }, { status: 401, headers: noStoreHeaders })
    }

    const profileReadRateLimit = enforceRateLimit({
      key: buildUserActionKey('user-profile-read', session.user.id, request),
      ...getRateLimit('user-profile-read'),
    })
    if (!profileReadRateLimit.allowed) {
      return NextResponse.json({ error: '请求过于频繁，请稍后再试' }, {
        status: 429,
        headers: {
          ...noStoreHeaders,
          'Retry-After': String(profileReadRateLimit.retryAfterSeconds),
        },
      })
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        email: true,
        name: true,
        activeBabyId: true,
        createdAt: true,
      }
    })

    if (!user) {
      return NextResponse.json({ error: '用户不存在' }, { status: 404, headers: noStoreHeaders })
    }

    return NextResponse.json(user, { headers: noStoreHeaders })
  } catch (error) {
    logError('获取用户信息失败', error)
    return NextResponse.json({ error: '获取用户信息失败' }, { status: 500, headers: noStoreHeaders })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await auth(request)
    if (!session) {
      return NextResponse.json({ error: '未授权' }, { status: 401, headers: noStoreHeaders })
    }

    const profileUpdateRateLimit = enforceRateLimit({
      key: buildUserActionKey('user-profile-update', session.user.id, request),
      ...getRateLimit('user-profile-update'),
    })
    if (!profileUpdateRateLimit.allowed) {
      return NextResponse.json({ error: '操作过于频繁，请稍后再试' }, {
        status: 429,
        headers: {
          ...noStoreHeaders,
          'Retry-After': String(profileUpdateRateLimit.retryAfterSeconds),
        },
      })
    }

    const originCheck = validateSameOrigin(request)
    if (!originCheck.valid) {
      return NextResponse.json({ error: originCheck.error }, { status: 403, headers: noStoreHeaders })
    }

    const { data: body, error: parseError } = await safeParseBody(request)
    if (parseError || !body) {
      return NextResponse.json({ error: parseError || '请求体格式不正确' }, { status: 400, headers: noStoreHeaders })
    }

    const { name, activeBabyId } = body

    const updateData: Record<string, unknown> = {}

    // Handle name update
    if (name !== undefined) {
      if (!name || typeof name !== 'string') {
        return NextResponse.json({ error: '请输入用户名' }, { status: 400, headers: noStoreHeaders })
      }
      const trimmedName = name.trim()
      if (trimmedName.length < 1 || trimmedName.length > 50) {
        return NextResponse.json({ error: '用户名长度需在 1-50 个字符之间' }, { status: 400, headers: noStoreHeaders })
      }
      updateData.name = trimmedName
    }

    // Handle activeBabyId update
    if (activeBabyId !== undefined) {
      if (activeBabyId !== null && typeof activeBabyId !== 'string') {
        return NextResponse.json({ error: 'activeBabyId 格式不正确' }, { status: 400, headers: noStoreHeaders })
      }
      updateData.activeBabyId = activeBabyId
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: '没有需要更新的字段' }, { status: 400, headers: noStoreHeaders })
    }

    const updatedUser = await prisma.$transaction(async tx => {
      if (typeof activeBabyId === 'string' && activeBabyId) {
        const baby = await tx.baby.findFirst({
          where: { id: activeBabyId, createdBy: session.user.id },
          select: { id: true },
        })
        if (!baby) throw new Error('BABY_NOT_FOUND')
      }
      return tx.user.update({
        where: { id: session.user.id },
        data: updateData,
        select: {
          id: true,
          email: true,
          name: true,
          activeBabyId: true,
        },
      })
    })

    return NextResponse.json(updatedUser, { headers: noStoreHeaders })
  } catch (error) {
    if (error instanceof Error && error.message === 'BABY_NOT_FOUND') {
      return NextResponse.json({ error: '宝宝不存在' }, { status: 404, headers: noStoreHeaders })
    }
    logError('修改用户名失败', error)
    return NextResponse.json({ error: '修改用户名失败' }, { status: 500, headers: noStoreHeaders })
  }
}
