import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { safeParseBody, validateSameOrigin } from '@/lib/validation'
import { buildUserActionKey, enforceRateLimit } from '@/lib/rate-limit'
import { noStoreHeaders } from '@/lib/api-helpers'

export async function GET(request: NextRequest) {
  try {
    const session = await auth(request)
    if (!session) {
      return NextResponse.json({ error: '未授权' }, { status: 401, headers: noStoreHeaders })
    }

    const profileReadRateLimit = enforceRateLimit({
      key: buildUserActionKey('user-profile-read', session.user.id, request),
      limit: 60,
      windowMs: 60 * 1000,
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
        createdAt: true,
      }
    })

    if (!user) {
      return NextResponse.json({ error: '用户不存在' }, { status: 404, headers: noStoreHeaders })
    }

    return NextResponse.json(user, { headers: noStoreHeaders })
  } catch (error) {
    console.error('获取用户信息失败:', error)
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
      limit: 10,
      windowMs: 10 * 60 * 1000,
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

    const { name } = body

    if (!name || typeof name !== 'string') {
      return NextResponse.json({ error: '请输入用户名' }, { status: 400, headers: noStoreHeaders })
    }

    const trimmedName = name.trim()
    if (trimmedName.length < 1 || trimmedName.length > 50) {
      return NextResponse.json({ error: '用户名长度需在 1-50 个字符之间' }, { status: 400, headers: noStoreHeaders })
    }

    const updatedUser = await prisma.user.update({
      where: { id: session.user.id },
      data: { name: trimmedName },
      select: {
        id: true,
        email: true,
        name: true,
      }
    })

    return NextResponse.json(updatedUser, { headers: noStoreHeaders })
  } catch (error) {
    console.error('修改用户名失败:', error)
    return NextResponse.json({ error: '修改用户名失败' }, { status: 500, headers: noStoreHeaders })
  }
}
