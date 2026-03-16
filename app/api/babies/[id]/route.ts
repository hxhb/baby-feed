import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { validateBabyInput, validateId, safeParseBody, GENDERS, validateSameOrigin } from '@/lib/validation'

const noStoreHeaders = {
  'Cache-Control': 'no-store, max-age=0',
  'Pragma': 'no-cache',
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const session = await auth(request)
    if (!session?.user) {
      return NextResponse.json({ error: '未授权' }, { status: 401, headers: noStoreHeaders })
    }

    const idCheck = validateId(id, '婴儿ID')
    if (!idCheck.valid) {
      return NextResponse.json({ error: idCheck.error }, { status: 400, headers: noStoreHeaders })
    }

    const baby = await prisma.baby.findFirst({
      where: {
        id,
        createdBy: session.user.id
      }
    })

    if (!baby) {
      return NextResponse.json({ error: '婴儿不存在' }, { status: 404, headers: noStoreHeaders })
    }

    return NextResponse.json(baby, { headers: noStoreHeaders })
  } catch (error) {
    console.error('获取婴儿信息失败:', error)
    return NextResponse.json({ error: '获取失败' }, { status: 500, headers: noStoreHeaders })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const session = await auth(request)
    if (!session?.user) {
      return NextResponse.json({ error: '未授权' }, { status: 401, headers: noStoreHeaders })
    }

    const originCheck = validateSameOrigin(request)
    if (!originCheck.valid) {
      return NextResponse.json({ error: originCheck.error }, { status: 403, headers: noStoreHeaders })
    }

    const idCheck = validateId(id, '婴儿ID')
    if (!idCheck.valid) {
      return NextResponse.json({ error: idCheck.error }, { status: 400, headers: noStoreHeaders })
    }

    const { data: body, error: parseError } = await safeParseBody(request)
    if (parseError || !body) {
      return NextResponse.json({ error: parseError || '请求体格式不正确' }, { status: 400, headers: noStoreHeaders })
    }

    const { name, birthDate, gender } = body

    const updateData: {
      name?: string
      birthDate?: Date
      gender?: (typeof GENDERS)[number]
    } = {}

    // 验证输入
    const validation = validateBabyInput(body)
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400, headers: noStoreHeaders })
    }

    if (name !== undefined) {
      if (typeof name !== 'string') {
        return NextResponse.json({ error: '姓名类型无效' }, { status: 400, headers: noStoreHeaders })
      }
      updateData.name = name
    }

    if (birthDate !== undefined) {
      if (typeof birthDate !== 'string') {
        return NextResponse.json({ error: '出生日期类型无效' }, { status: 400, headers: noStoreHeaders })
      }
      updateData.birthDate = new Date(birthDate)
    }

    if (gender !== undefined) {
      if (typeof gender !== 'string') {
        return NextResponse.json({ error: '性别类型无效' }, { status: 400, headers: noStoreHeaders })
      }
      const typedGender = gender as (typeof GENDERS)[number]
      if (!GENDERS.includes(typedGender)) {
        return NextResponse.json({ error: '无效的性别值' }, { status: 400, headers: noStoreHeaders })
      }
      updateData.gender = typedGender
    }

    const existingBaby = await prisma.baby.findFirst({
      where: {
        id,
        createdBy: session.user.id
      }
    })

    if (!existingBaby) {
      return NextResponse.json({ error: '婴儿不存在' }, { status: 404, headers: noStoreHeaders })
    }

    const baby = await prisma.baby.update({
      where: { id },
      data: updateData
    })

    return NextResponse.json(baby, { headers: noStoreHeaders })
  } catch (error) {
    console.error('更新婴儿信息失败:', error)
    return NextResponse.json({ error: '更新失败' }, { status: 500, headers: noStoreHeaders })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const session = await auth(request)
    if (!session?.user) {
      return NextResponse.json({ error: '未授权' }, { status: 401, headers: noStoreHeaders })
    }

    const originCheck = validateSameOrigin(request)
    if (!originCheck.valid) {
      return NextResponse.json({ error: originCheck.error }, { status: 403, headers: noStoreHeaders })
    }

    const idCheck = validateId(id, '婴儿ID')
    if (!idCheck.valid) {
      return NextResponse.json({ error: idCheck.error }, { status: 400, headers: noStoreHeaders })
    }

    const existingBaby = await prisma.baby.findFirst({
      where: {
        id,
        createdBy: session.user.id
      }
    })

    if (!existingBaby) {
      return NextResponse.json({ error: '婴儿不存在' }, { status: 404, headers: noStoreHeaders })
    }

    await prisma.baby.delete({
      where: { id }
    })

    return NextResponse.json({ success: true }, { headers: noStoreHeaders })
  } catch (error) {
    console.error('删除婴儿信息失败:', error)
    return NextResponse.json({ error: '删除失败' }, { status: 500, headers: noStoreHeaders })
  }
}
