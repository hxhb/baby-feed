import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { validateId } from '@/lib/validation'
import { buildUserActionKey, enforceRateLimit } from '@/lib/rate-limit'
import { getTimelineValidDates } from '@/lib/server-timeline'
import { noStoreHeaders } from '@/lib/api-helpers'

export async function GET(request: NextRequest) {
  try {
    const session = await auth(request)
    if (!session?.user) {
      return NextResponse.json({ error: '未授权' }, { status: 401, headers: noStoreHeaders })
    }

    const listRateLimit = enforceRateLimit({
      key: buildUserActionKey('timeline-valid-dates', session.user.id, request),
      limit: 180,
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

    const { searchParams } = new URL(request.url)
    const babyId = searchParams.get('babyId')

    if (!babyId) {
      return NextResponse.json({ error: '缺少babyId参数' }, { status: 400, headers: noStoreHeaders })
    }

    const idCheck = validateId(babyId, 'babyId')
    if (!idCheck.valid) {
      return NextResponse.json({ error: idCheck.error }, { status: 400, headers: noStoreHeaders })
    }

    const validDates = await getTimelineValidDates(session.user.id, babyId)
    return NextResponse.json(validDates, { headers: noStoreHeaders })
  } catch (error) {
    console.error('获取时间轴有效日期失败:', error)
    return NextResponse.json({ error: '获取失败' }, { status: 500, headers: noStoreHeaders })
  }
}
