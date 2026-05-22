import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin'
import { validateSameOrigin } from '@/lib/validation'
import { createInviteCode, listInviteCodes } from '@/lib/invite'
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
    key: buildUserActionKey('admin-invite-list', check.session.user.id, request),
    ...getRateLimit('admin-settings-read'),
  })
  if (!rateLimit.allowed) {
    return NextResponse.json({ error: '请求过于频繁' }, { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfterSeconds) } })
  }

  try {
    const codes = await listInviteCodes()
    return NextResponse.json(codes, { headers: noStoreHeaders })
  } catch (error) {
    logError('获取邀请码列表失败', error)
    return NextResponse.json({ error: '获取邀请码列表失败' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const check = await requireAdmin(request)
  if ('error' in check) {
    return NextResponse.json({ error: check.error }, { status: check.status })
  }

  const rateLimit = enforceRateLimit({
    key: buildUserActionKey('admin-invite-create', check.session.user.id, request),
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
    const code = await createInviteCode(check.session.user.id)
    const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000'
    const url = `${baseUrl}/register?code=${code}`
    return NextResponse.json({ code, url }, { status: 201 })
  } catch (error) {
    logError('创建邀请码失败', error)
    return NextResponse.json({ error: '创建邀请码失败' }, { status: 500 })
  }
}
