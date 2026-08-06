import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { noStoreHeaders } from '@/lib/api-helpers'
import { logError } from '@/lib/logger'
import { prisma } from '@/lib/prisma'
import { buildUserActionKey, enforceRateLimit } from '@/lib/rate-limit'
import { getRateLimit } from '@/lib/rate-limit-config'
import {
  normalizeQuickRecordKeys,
  parseQuickRecordSettings,
  validateQuickRecordKeys,
} from '@/lib/quick-records'
import { safeParseBody, validateSameOrigin } from '@/lib/validation'

export async function GET(request: NextRequest) {
  try {
    const session = await auth(request)
    if (!session?.user?.id) {
      return NextResponse.json({ error: '未授权' }, { status: 401, headers: noStoreHeaders })
    }

    const rateLimit = enforceRateLimit({
      key: buildUserActionKey('user-quick-records-read', session.user.id, request),
      ...getRateLimit('user-quick-records-read'),
    })
    if (!rateLimit.allowed) {
      return NextResponse.json({ error: '请求过于频繁，请稍后再试' }, {
        status: 429,
        headers: { ...noStoreHeaders, 'Retry-After': String(rateLimit.retryAfterSeconds) },
      })
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { quickRecordSettings: true },
    })
    if (!user) {
      return NextResponse.json({ error: '用户不存在' }, { status: 404, headers: noStoreHeaders })
    }

    return NextResponse.json({ keys: parseQuickRecordSettings(user.quickRecordSettings) }, { headers: noStoreHeaders })
  } catch (error) {
    logError('获取快捷记录失败', error)
    return NextResponse.json({ error: '获取快捷记录失败' }, { status: 500, headers: noStoreHeaders })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await auth(request)
    if (!session?.user?.id) {
      return NextResponse.json({ error: '未授权' }, { status: 401, headers: noStoreHeaders })
    }

    const originCheck = validateSameOrigin(request)
    if (!originCheck.valid) {
      return NextResponse.json({ error: originCheck.error }, { status: 403, headers: noStoreHeaders })
    }

    const rateLimit = enforceRateLimit({
      key: buildUserActionKey('user-quick-records-update', session.user.id, request),
      ...getRateLimit('user-quick-records-update'),
    })
    if (!rateLimit.allowed) {
      return NextResponse.json({ error: '操作过于频繁，请稍后再试' }, {
        status: 429,
        headers: { ...noStoreHeaders, 'Retry-After': String(rateLimit.retryAfterSeconds) },
      })
    }

    const { data: body, error: parseError } = await safeParseBody(request)
    if (parseError || !body) {
      return NextResponse.json({ error: parseError || '请求体格式不正确' }, { status: 400, headers: noStoreHeaders })
    }

    const validationError = validateQuickRecordKeys(body.keys)
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400, headers: noStoreHeaders })
    }

    const keys = normalizeQuickRecordKeys(body.keys)
    await prisma.user.update({
      where: { id: session.user.id },
      data: { quickRecordSettings: JSON.stringify(keys) },
    })

    return NextResponse.json({ keys }, { headers: noStoreHeaders })
  } catch (error) {
    logError('更新快捷记录失败', error)
    return NextResponse.json({ error: '更新快捷记录失败' }, { status: 500, headers: noStoreHeaders })
  }
}
