import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { validateMemoInput, validateId, validateInt, safeParseBody, validateSameOrigin } from '@/lib/validation'
import { buildUserActionKey, enforceRateLimit } from '@/lib/rate-limit'
import { getRateLimit } from '@/lib/rate-limit-config'
import { noStoreHeaders } from '@/lib/api-helpers'
import { logError } from '@/lib/logger'

export async function GET(request: NextRequest) {
  try {
    const session = await auth(request)
    if (!session?.user) {
      return NextResponse.json({ error: '未授权' }, { status: 401, headers: noStoreHeaders })
    }

    const listRateLimit = enforceRateLimit({
      key: buildUserActionKey('memo-list', session.user.id, request),
      ...getRateLimit('memo-list'),
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

    const { searchParams } = new URL(request.url)
    const babyId = searchParams.get('babyId')
    const completed = searchParams.get('completed')
    const date = searchParams.get('date')
    const rangeDays = searchParams.get('rangeDays')

    if (babyId) {
      const idCheck = validateId(babyId, 'babyId')
      if (!idCheck.valid) {
        return NextResponse.json({ error: idCheck.error }, { status: 400, headers: noStoreHeaders })
      }
    }

    if (completed !== null && completed !== 'true' && completed !== 'false') {
      return NextResponse.json({ error: 'completed 参数值无效，应为 true 或 false' }, { status: 400, headers: noStoreHeaders })
    }

    if (date) {
      // Only validate format (YYYY-MM-DD), allow future dates for memo range queries
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return NextResponse.json({ error: '日期格式无效，应为 YYYY-MM-DD' }, { status: 400, headers: noStoreHeaders })
      }
      const parsed = new Date(`${date}T12:00:00+08:00`)
      if (isNaN(parsed.getTime())) {
        return NextResponse.json({ error: '日期不是有效的日期' }, { status: 400, headers: noStoreHeaders })
      }
    }

    if (rangeDays) {
      if (!date) {
        return NextResponse.json({ error: 'rangeDays 需要配合 date 参数使用' }, { status: 400, headers: noStoreHeaders })
      }
      const parsedDays = Number(rangeDays)
      if (isNaN(parsedDays)) {
        return NextResponse.json({ error: '天数范围必须是数字' }, { status: 400, headers: noStoreHeaders })
      }
      const daysCheck = validateInt(parsedDays, '天数范围', 1, 365)
      if (!daysCheck.valid) {
        return NextResponse.json({ error: daysCheck.error }, { status: 400, headers: noStoreHeaders })
      }
    }

    const whereClause: Record<string, unknown> = {
      createdBy: session.user.id,
    }

    if (babyId) {
      whereClause.babyId = babyId
    }

    if (completed === 'true') {
      whereClause.completed = true
    } else if (completed === 'false') {
      whereClause.completed = false
    }

    // Date range filter: return memos whose scheduledAt is within [date - rangeDays, date + rangeDays]
    if (date) {
      const days = rangeDays ? Number(rangeDays) : 7
      const centerDate = new Date(`${date}T12:00:00+08:00`)
      const rangeStart = new Date(centerDate.getTime() - days * 24 * 60 * 60 * 1000)
      const rangeEnd = new Date(centerDate.getTime() + days * 24 * 60 * 60 * 1000)
      whereClause.scheduledAt = {
        gte: rangeStart,
        lte: rangeEnd,
      }
    }

    const records = await prisma.memo.findMany({
      where: whereClause,
      orderBy: { scheduledAt: 'asc' },
    })

    return NextResponse.json(records, { headers: noStoreHeaders })
  } catch (error) {
    logError('获取备忘录失败', error)
    return NextResponse.json({ error: '获取失败' }, { status: 500, headers: noStoreHeaders })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth(request)
    if (!session?.user) {
      return NextResponse.json({ error: '未授权' }, { status: 401, headers: noStoreHeaders })
    }

    const createRateLimit = enforceRateLimit({
      key: buildUserActionKey('memo-create', session.user.id, request),
      ...getRateLimit('memo-create'),
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

    const { babyId, title, content, scheduledAt } = body

    if (!babyId || !title || !scheduledAt) {
      return NextResponse.json({ error: '缺少必要字段' }, { status: 400, headers: noStoreHeaders })
    }

    if (typeof babyId !== 'string') {
      return NextResponse.json({ error: '字段类型无效' }, { status: 400, headers: noStoreHeaders })
    }

    const idCheck = validateId(babyId, 'babyId')
    if (!idCheck.valid) {
      return NextResponse.json({ error: idCheck.error }, { status: 400, headers: noStoreHeaders })
    }

    const validation = validateMemoInput(body)
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400, headers: noStoreHeaders })
    }

    const baby = await prisma.baby.findFirst({
      where: {
        id: babyId,
        createdBy: session.user.id,
      },
    })

    if (!baby) {
      return NextResponse.json({ error: '婴儿不存在' }, { status: 404, headers: noStoreHeaders })
    }

    const record = await prisma.memo.create({
      data: {
        babyId,
        title: (title as string).trim(),
        content: typeof content === 'string' && content.trim() ? content.trim() : null,
        scheduledAt: new Date(scheduledAt as string),
        completed: false,
        createdBy: session.user.id,
      },
    })

    revalidatePath('/stats')

    return NextResponse.json(record, { status: 201, headers: noStoreHeaders })
  } catch (error) {
    logError('创建备忘录失败', error)
    return NextResponse.json({ error: '创建失败' }, { status: 500, headers: noStoreHeaders })
  }
}
