import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET /api/user/profile - 获取当前用户信息
export async function GET(request: NextRequest) {
  try {
    const session = await auth(request)
    if (!session) {
      return NextResponse.json({ error: '未授权' }, { status: 401 })
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
      return NextResponse.json({ error: '用户不存在' }, { status: 404 })
    }

    return NextResponse.json(user)
  } catch (error) {
    console.error('获取用户信息失败:', error)
    return NextResponse.json({ error: '获取用户信息失败' }, { status: 500 })
  }
}

// PUT /api/user/profile - 修改用户名
export async function PUT(request: NextRequest) {
  try {
    const session = await auth(request)
    if (!session) {
      return NextResponse.json({ error: '未授权' }, { status: 401 })
    }

    const body = await request.json()
    const { name } = body

    if (!name || typeof name !== 'string') {
      return NextResponse.json({ error: '请输入用户名' }, { status: 400 })
    }

    const trimmedName = name.trim()
    if (trimmedName.length < 1 || trimmedName.length > 50) {
      return NextResponse.json({ error: '用户名长度需在 1-50 个字符之间' }, { status: 400 })
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

    return NextResponse.json(updatedUser)
  } catch (error) {
    console.error('修改用户名失败:', error)
    return NextResponse.json({ error: '修改用户名失败' }, { status: 500 })
  }
}
