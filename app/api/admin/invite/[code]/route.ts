import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin'
import { validateSameOrigin } from '@/lib/validation'
import { deleteInviteCode } from '@/lib/invite'
import { logError } from '@/lib/logger'
import { buildUserActionKey, enforceRateLimit } from '@/lib/rate-limit'
import { getRateLimit } from '@/lib/rate-limit-config'

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const check = await requireAdmin(request)
  if ('error' in check) {
    return NextResponse.json({ error: check.error }, { status: check.status })
  }

  const rateLimit = enforceRateLimit({
    key: buildUserActionKey('admin-invite-delete', check.session.user.id, request),
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
    const { code } = await params
    const success = await deleteInviteCode(code)
    if (!success) {
      return NextResponse.json({ error: '邀请码不存在' }, { status: 404 })
    }
    return NextResponse.json({ success: true })
  } catch (error) {
    logError('删除邀请码失败', error)
    return NextResponse.json({ error: '删除邀请码失败' }, { status: 500 })
  }
}
