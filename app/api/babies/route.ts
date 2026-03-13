import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const session = await auth(request)
    if (!session?.user?.id) {
      return NextResponse.json({ error: '未授权' }, { status: 401 })
    }

    const babies = await prisma.baby.findMany({
      where: { createdBy: session.user.id },
      orderBy: { createdAt: 'desc' }
    })

    return NextResponse.json(babies)
  } catch (error) {
    console.error('获取婴儿列表失败:', error)
    return NextResponse.json({ error: '获取失败' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth(request)
    if (!session?.user?.id) {
      return NextResponse.json({ error: '未授权' }, { status: 401 })
    }

    const body = await request.json()
    const { name, birthDate, gender } = body

    if (!name || !birthDate || !gender) {
      return NextResponse.json({ error: '缺少必要字段' }, { status: 400 })
    }

    const baby = await prisma.baby.create({
      data: {
        name,
        birthDate: new Date(birthDate),
        gender,
        createdBy: session.user.id
      }
    })

    return NextResponse.json(baby, { status: 201 })
  } catch (error) {
    console.error('创建婴儿失败:', error)
    return NextResponse.json({ error: '创建失败' }, { status: 500 })
  }
}
