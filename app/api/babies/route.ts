import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { validateBabyInput, GENDERS, safeParseBody, validateSameOrigin } from '@/lib/validation'
import { buildUserActionKey, enforceRateLimit } from '@/lib/rate-limit'

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

    const listRateLimit = enforceRateLimit({
      key: buildUserActionKey('babies-list', session.user.id, request),
      limit: 120,
      windowMs: 60 * 1000,
    })
    if (!listRateLimit.allowed) {
      return NextResponse.json({ error: '请求过于频繁，请稍后再试' }, {
        status: 429,
        headers: {
          ...noStoreHeaders,
          'Retry-After': String(listRateLimit.retryAfterSeconds),
        },
      })
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

    const createRateLimit = enforceRateLimit({
      key: buildUserActionKey('babies-create', session.user.id, request),
      limit: 20,
      windowMs: 10 * 60 * 1000,
    })
    if (!createRateLimit.allowed) {
      return NextResponse.json({ error: '操作过于频繁，请稍后再试' }, {
        status: 429,
        headers: {
          ...noStoreHeaders,
          'Retry-After': String(createRateLimit.retryAfterSeconds),
        },
      })
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
