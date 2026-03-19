import { NextRequest, NextResponse } from 'next/server'
import { invalidateUserCache } from '@/lib/auth'
import { requireAdmin } from '@/lib/admin'
import { prisma } from '@/lib/prisma'
import { validateId, safeParseBody, validateSameOrigin } from '@/lib/validation'

const noStoreHeaders = {
  'Cache-Control': 'no-store, max-age=0',
  'Pragma': 'no-cache',
}

export async function GET(request: NextRequest) {
  const check = await requireAdmin(request)
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

export async function DELETE(request: NextRequest) {
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
      select: { id: true, role: true }
    })

    if (!targetUser) {
      return NextResponse.json({ error: '用户不存在' }, { status: 404 })
    }

    await prisma.$transaction(async (tx) => {
      await tx.feedingRecord.deleteMany({ where: { createdBy: userId } })
      await tx.healthRecord.deleteMany({ where: { createdBy: userId } })
      await tx.baby.deleteMany({ where: { createdBy: userId } })
      await tx.apiKey.deleteMany({ where: { userId } })
      await tx.user.delete({ where: { id: userId } })
    })

    invalidateUserCache(userId)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('删除用户失败:', error)
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

    const { userId, role } = body

    if (typeof userId !== 'string' || typeof role !== 'string' || !userId || !role) {
      return NextResponse.json({ error: '缺少参数' }, { status: 400 })
    }

    const idCheck = validateId(userId, '用户ID')
    if (!idCheck.valid) {
      return NextResponse.json({ error: idCheck.error }, { status: 400 })
    }

    if (!['USER', 'ADMIN'].includes(role)) {
      return NextResponse.json({ error: '无效的角色' }, { status: 400 })
    }

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
