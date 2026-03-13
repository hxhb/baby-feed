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
      weight,
      temperature,
      medicationName,
      medicationDose,
      recordedAt,
      notes
    } = body

    const existingRecord = await prisma.healthRecord.findFirst({
      where: {
        id,
        createdBy: session.user.id
      }
    })

    if (!existingRecord) {
      return NextResponse.json({ error: '记录不存在' }, { status: 404 })
    }

    const record = await prisma.healthRecord.update({
      where: { id },
      data: {
        type,
        weight,
        temperature,
        medicationName,
        medicationDose,
        recordedAt: recordedAt ? new Date(recordedAt) : undefined,
        notes
      },
      include: { baby: true }
    })

    return NextResponse.json(record)
  } catch (error) {
    console.error('更新健康记录失败:', error)
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

    const existingRecord = await prisma.healthRecord.findFirst({
      where: {
        id,
        createdBy: session.user.id
      }
    })

    if (!existingRecord) {
      return NextResponse.json({ error: '记录不存在' }, { status: 404 })
    }

    await prisma.healthRecord.delete({
      where: { id }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('删除健康记录失败:', error)
    return NextResponse.json({ error: '删除失败' }, { status: 500 })
  }
}
