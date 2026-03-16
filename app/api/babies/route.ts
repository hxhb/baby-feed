import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { validateBabyInput, GENDERS, safeParseBody, validateSameOrigin } from '@/lib/validation'

const noStoreHeaders = {
  'Cache-Control': 'no-store, max-age=0',
  'Pragma': 'no-cache',
}

export async function GET(request: NextRequest) {
  try {
    const session = await auth(request)
    if (!session?.user?.id) {
      return NextResponse.json({ error: '未授权' }, { status: 401, headers: noStoreHeaders })
    }

    const babies = await prisma.baby.findMany({
      where: { createdBy: session.user.id },
      orderBy: { createdAt: 'desc' }
    })

    return NextResponse.json(babies, { headers: noStoreHeaders })
  } catch (error) {
    console.error('获取婴儿列表失败:', error)
    return NextResponse.json({ error: '获取失败' }, { status: 500, headers: noStoreHeaders })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth(request)
    if (!session?.user?.id) {
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

    const { name, birthDate, gender } = body

    if (!name || !birthDate || !gender) {
      return NextResponse.json({ error: '缺少必要字段' }, { status: 400, headers: noStoreHeaders })
    }

    if (typeof name !== 'string' || typeof birthDate !== 'string' || typeof gender !== 'string') {
      return NextResponse.json({ error: '字段类型无效' }, { status: 400, headers: noStoreHeaders })
    }

    // 验证输入（性别枚举、名称长度、日期格式）
    const validation = validateBabyInput(body)
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400, headers: noStoreHeaders })
    }

    const typedGender = gender as (typeof GENDERS)[number]
    if (!GENDERS.includes(typedGender)) {
      return NextResponse.json({ error: '无效的性别值' }, { status: 400, headers: noStoreHeaders })
    }

    const baby = await prisma.baby.create({
      data: {
        name,
        birthDate: new Date(birthDate),
        gender: typedGender,
        createdBy: session.user.id
      }
    })

    return NextResponse.json(baby, { status: 201, headers: noStoreHeaders })
  } catch (error) {
    console.error('创建婴儿失败:', error)
    return NextResponse.json({ error: '创建失败' }, { status: 500, headers: noStoreHeaders })
  }
}
