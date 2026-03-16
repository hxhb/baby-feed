import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { safeParseBody, validateSameOrigin } from '@/lib/validation'

const noStoreHeaders = {
  'Cache-Control': 'no-store, max-age=0',
  'Pragma': 'no-cache',
}

// GET /api/user/profile - 获取当前用户信息
export async function GET(request: NextRequest) {
  try {
    const session = await auth(request)
    if (!session) {
      return NextResponse.json({ error: '未授权' }, { status: 401, headers: noStoreHeaders })
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

// PUT /api/user/profile - 修改用户名
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
