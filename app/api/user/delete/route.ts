import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// DELETE /api/user/delete - 注销账户（删除用户及所有关联数据）
export async function DELETE(request: NextRequest) {
  try {
    const session = await auth(request)
    if (!session) {
      return NextResponse.json({ error: '未授权' }, { status: 401 })
    }

    const body = await request.json()
    const { password } = body

    if (!password || typeof password !== 'string') {
      return NextResponse.json({ error: '请输入密码以确认注销' }, { status: 400 })
    }

    // 获取当前用户
    const user = await prisma.user.findUnique({
      where: { id: session.user.id }
    })

    if (!user) {
      return NextResponse.json({ error: '用户不存在' }, { status: 404 })
    }

    // 验证密码
    const isPasswordValid = await bcrypt.compare(password, user.password)
    if (!isPasswordValid) {
      return NextResponse.json({ error: '密码不正确' }, { status: 400 })
    }

    // 删除用户的所有关联数据（利用 Prisma 的级联删除）
    // 先删除子记录，再删除父记录
    const userId = session.user.id

    // 获取该用户创建的所有宝宝
    const babies = await prisma.baby.findMany({
      where: { createdBy: userId },
      select: { id: true }
    })
    const babyIds = babies.map(b => b.id)

    // 删除所有相关喂养记录
    if (babyIds.length > 0) {
      await prisma.feedingRecord.deleteMany({
        where: { babyId: { in: babyIds } }
      })

      // 删除所有相关健康记录
      await prisma.healthRecord.deleteMany({
        where: { babyId: { in: babyIds } }
      })

      // 删除所有宝宝
      await prisma.baby.deleteMany({
        where: { createdBy: userId }
      })
    }

    // 最后删除用户
    await prisma.user.delete({
      where: { id: userId }
    })

    return NextResponse.json({ message: '账户已注销' })
  } catch (error) {
    console.error('注销账户失败:', error)
    return NextResponse.json({ error: '注销账户失败' }, { status: 500 })
  }
}
