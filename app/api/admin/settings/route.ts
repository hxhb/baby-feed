import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin'
import { safeParseBody, validateSameOrigin } from '@/lib/validation'
import { getSiteSettings, setAllowRegistration } from '@/lib/site-settings'
import { noStoreHeaders } from '@/lib/api-helpers'
import { logError } from '@/lib/logger'
import { buildUserActionKey, enforceRateLimit } from '@/lib/rate-limit'
import { getRateLimit } from '@/lib/rate-limit-config'

export async function GET(request: NextRequest) {
  const check = await requireAdmin(request)
  if ('error' in check) {
    return NextResponse.json({ error: check.error }, { status: check.status })
  }

  const rateLimit = enforceRateLimit({
    key: buildUserActionKey('admin-settings-read', check.session.user.id, request),
    ...getRateLimit('admin-settings-read'),
  })
  if (!rateLimit.allowed) {
    return NextResponse.json({ error: '请求过于频繁' }, { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfterSeconds) } })
  }

  try {
    const settings = await getSiteSettings()
    return NextResponse.json(settings, {
      headers: noStoreHeaders,
    })
  } catch (error) {
    logError('获取站点设置失败', error)
    return NextResponse.json({ error: '获取站点设置失败' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  const check = await requireAdmin(request)
  if ('error' in check) {
    return NextResponse.json({ error: check.error }, { status: check.status })
  }

  const rateLimit = enforceRateLimit({
    key: buildUserActionKey('admin-settings-update', check.session.user.id, request),
    ...getRateLimit('admin-settings-update'),
  })
  if (!rateLimit.allowed) {
    return NextResponse.json({ error: '操作过于频繁' }, { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfterSeconds) } })
  }

  const originCheck = validateSameOrigin(request)
  if (!originCheck.valid) {
    return NextResponse.json({ error: originCheck.error }, { status: 403 })
  }

  try {
    const { data: body, error: parseError } = await safeParseBody(request)
    if (parseError || !body) {
      return NextResponse.json({ error: parseError || '请求体格式不正确' }, { status: 400 })
    }

    const { allowRegistration } = body

    if (typeof allowRegistration === 'boolean') {
      await setAllowRegistration(allowRegistration)
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    logError('更新站点设置失败', error)
    return NextResponse.json({ error: '更新站点设置失败' }, { status: 500 })
  }
}
