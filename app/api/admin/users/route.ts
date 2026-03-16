import { NextRequest, NextResponse } from 'next/server'
import { auth, invalidateUserCache } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { validateId, safeParseBody, validateSameOrigin } from '@/lib/validation'

const noStoreHeaders = {
  'Cache-Control': 'no-store, max-age=0',
  'Pragma': 'no-cache',
}

// 检查是否为管理员
async function checkAdmin(request: NextRequest) {
  const session = await auth(request)
  if (!session) {
    return { error: '未登录', status: 401 }
  }
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true }
  })
  if (user?.role !== 'ADMIN') {
    return { error: '无权限', status: 403 }
  }
  return { session }
}

// GET /api/admin/users - 获取所有用户列表
export async function GET(request: NextRequest) {
  const check = await checkAdmin(request)
  if ('error' in check) {
    return NextResponse.json({ error: check.error }, { status: check.status })
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
    console.error('获取用户列表失败:', error)
    return NextResponse.json({ error: '获取用户列表失败' }, { status: 500 })
  }
}

// DELETE /api/admin/users - 删除指定用户
export async function DELETE(request: NextRequest) {
  const check = await checkAdmin(request)
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

    const { userId } = body
    
    if (typeof userId !== 'string' || !userId) {
      return NextResponse.json({ error: '缺少用户ID' }, { status: 400 })
    }

    // 验证 userId 格式
    const idCheck = validateId(userId, '用户ID')
    if (!idCheck.valid) {
      return NextResponse.json({ error: idCheck.error }, { status: 400 })
    }

    // 不能删除自己
    if (userId === check.session.user.id) {
      return NextResponse.json({ error: '不能删除自己的账户' }, { status: 400 })
    }

    // 检查目标用户是否存在
    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true }
    })

    if (!targetUser) {
      return NextResponse.json({ error: '用户不存在' }, { status: 404 })
    }

    // 使用事务确保删除的原子性
    await prisma.$transaction(async (tx) => {
      await tx.feedingRecord.deleteMany({ where: { createdBy: userId } })
      await tx.healthRecord.deleteMany({ where: { createdBy: userId } })
      await tx.baby.deleteMany({ where: { createdBy: userId } })
      await tx.user.delete({ where: { id: userId } })
    })

    // 清除被删除用户的存在性缓存，使其 JWT 立即失效
    invalidateUserCache(userId)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('删除用户失败:', error)
    return NextResponse.json({ error: '删除用户失败' }, { status: 500 })
  }
}

// PUT /api/admin/users - 修改用户角色
export async function PUT(request: NextRequest) {
  const check = await checkAdmin(request)
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

    const { userId, role } = body

    if (typeof userId !== 'string' || typeof role !== 'string' || !userId || !role) {
      return NextResponse.json({ error: '缺少参数' }, { status: 400 })
    }

    // 验证 userId 格式
    const idCheck = validateId(userId, '用户ID')
    if (!idCheck.valid) {
      return NextResponse.json({ error: idCheck.error }, { status: 400 })
    }

    if (!['USER', 'ADMIN'].includes(role)) {
      return NextResponse.json({ error: '无效的角色' }, { status: 400 })
    }

    // 不能修改自己的角色
    if (userId === check.session.user.id) {
      return NextResponse.json({ error: '不能修改自己的角色' }, { status: 400 })
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data: { role },
      select: { id: true, role: true }
    })

    return NextResponse.json(user)
  } catch (error) {
    console.error('修改用户角色失败:', error)
    return NextResponse.json({ error: '修改用户角色失败' }, { status: 500 })
  }
}
