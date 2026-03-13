import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: '未授权' }, { status: 401 })
    }

    const baby = await prisma.baby.findFirst({
      where: {
        id,
        createdBy: session.user.id
      }
    })

    if (!baby) {
      return NextResponse.json({ error: '婴儿不存在' }, { status: 404 })
    }

    return NextResponse.json(baby)
  } catch (error) {
    console.error('获取婴儿信息失败:', error)
    return NextResponse.json({ error: '获取失败' }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: '未授权' }, { status: 401 })
    }

    const body = await request.json()
    const { name, birthDate, gender } = body

    const existingBaby = await prisma.baby.findFirst({
      where: {
        id,
        createdBy: session.user.id
      }
    })

    if (!existingBaby) {
      return NextResponse.json({ error: '婴儿不存在' }, { status: 404 })
    }

    const baby = await prisma.baby.update({
      where: { id },
      data: {
        name,
        birthDate: birthDate ? new Date(birthDate) : undefined,
        gender
      }
    })

    return NextResponse.json(baby)
  } catch (error) {
    console.error('更新婴儿信息失败:', error)
    return NextResponse.json({ error: '更新失败' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: '未授权' }, { status: 401 })
    }

    const existingBaby = await prisma.baby.findFirst({
      where: {
        id,
        createdBy: session.user.id
      }
    })

    if (!existingBaby) {
      return NextResponse.json({ error: '婴儿不存在' }, { status: 404 })
    }

    await prisma.baby.delete({
      where: { id }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('删除婴儿失败:', error)
    return NextResponse.json({ error: '删除失败' }, { status: 500 })
  }
}
