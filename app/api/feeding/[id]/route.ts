import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

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
    const {
      type,
      leftBreastDuration,
      rightBreastDuration,
      formulaAmount,
      adGiven,
      startTime,
      endTime,
      notes
    } = body

    const existingRecord = await prisma.feedingRecord.findFirst({
      where: {
        id,
        createdBy: session.user.id
      }
    })

    if (!existingRecord) {
      return NextResponse.json({ error: '记录不存在' }, { status: 404 })
    }

    const record = await prisma.feedingRecord.update({
      where: { id },
      data: {
        type,
        leftBreastDuration,
        rightBreastDuration,
        formulaAmount,
        adGiven,
        startTime: startTime ? new Date(startTime) : undefined,
        endTime: endTime ? new Date(endTime) : null,
        notes
      },
      include: { baby: true }
    })

    return NextResponse.json(record)
  } catch (error) {
    console.error('更新喂养记录失败:', error)
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

    const existingRecord = await prisma.feedingRecord.findFirst({
      where: {
        id,
        createdBy: session.user.id
      }
    })

    if (!existingRecord) {
      return NextResponse.json({ error: '记录不存在' }, { status: 404 })
    }

    await prisma.feedingRecord.delete({
      where: { id }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('删除喂养记录失败:', error)
    return NextResponse.json({ error: '删除失败' }, { status: 500 })
  }
}
