import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { activityLogger } from '@/lib/activity-logger'
import { buildUserActionKey, enforceRateLimit } from '@/lib/rate-limit'
import { getRateLimit } from '@/lib/rate-limit-config'
import { noStoreHeaders } from '@/lib/api-helpers'
import { validateSameOrigin } from '@/lib/validation'
import { logError } from '@/lib/logger'

/**
 * GET /api/user/api-key-logs
 * Query API Key request logs from in-memory activity logger.
 *
 * Query params:
 *   keyId?  - filter by specific API Key ID
 *   limit?  - max entries (default 50, max 100)
 *   offset? - pagination offset (default 0)
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth(request)
    if (!session?.user?.id) {
      return NextResponse.json({ error: '未授权' }, { status: 401, headers: noStoreHeaders })
    }

    const listRateLimit = enforceRateLimit({
      key: buildUserActionKey('api-key-logs-list', session.user.id, request),
      ...getRateLimit('user-api-key-list'),
    })
    if (!listRateLimit.allowed) {
      return NextResponse.json(
        { error: '请求过于频繁，请稍后再试' },
        {
          status: 429,
          headers: {
            ...noStoreHeaders,
            'Retry-After': String(listRateLimit.retryAfterSeconds),
          },
        }
      )
    }

    const { searchParams } = new URL(request.url)
    const keyId = searchParams.get('keyId') || undefined
    const limit = Math.min(parseInt(searchParams.get('limit') || '50') || 50, 100)
    const offset = Math.max(parseInt(searchParams.get('offset') || '0') || 0, 0)

    const result = activityLogger.query('api-key', session.user.id, {
      groupKey: keyId,
      limit,
      offset,
    })

    return NextResponse.json({
      logs: result.entries,
      total: result.total,
      offset,
      limit,
    }, { headers: noStoreHeaders })
  } catch (error) {
    logError('获取 API Key 日志失败', error)
    return NextResponse.json({ error: '获取失败' }, { status: 500, headers: noStoreHeaders })
  }
}

/**
 * DELETE /api/user/api-key-logs
 * Clear API Key request logs.
 *
 * Query params:
 *   keyId? - clear logs for specific key only; omit to clear all
 */
export async function DELETE(request: NextRequest) {
  try {
    const session = await auth(request)
    if (!session?.user?.id) {
      return NextResponse.json({ error: '未授权' }, { status: 401, headers: noStoreHeaders })
    }

    const originCheck = validateSameOrigin(request)
    if (!originCheck.valid) {
      return NextResponse.json({ error: originCheck.error }, { status: 403, headers: noStoreHeaders })
    }

    const deleteRateLimit = enforceRateLimit({
      key: buildUserActionKey('api-key-logs-delete', session.user.id, request),
      ...getRateLimit('user-api-key-delete'),
    })
    if (!deleteRateLimit.allowed) {
      return NextResponse.json(
        { error: '操作过于频繁，请稍后再试' },
        {
          status: 429,
          headers: {
            ...noStoreHeaders,
            'Retry-After': String(deleteRateLimit.retryAfterSeconds),
          },
        }
      )
    }

    const { searchParams } = new URL(request.url)
    const keyId = searchParams.get('keyId') || undefined

    const deleted = activityLogger.clear('api-key', session.user.id, keyId)

    return NextResponse.json({ success: true, deleted }, { headers: noStoreHeaders })
  } catch (error) {
    logError('清理 API Key 日志失败', error)
    return NextResponse.json({ error: '清理失败' }, { status: 500, headers: noStoreHeaders })
  }
}
