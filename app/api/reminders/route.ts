import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { buildUserActionKey, enforceRateLimit } from '@/lib/rate-limit'
import { getRateLimit } from '@/lib/rate-limit-config'
import { validateString, validateId, safeParseBody, validateSameOrigin } from '@/lib/validation'
import { validateActiveSchedule, validateTriggerConfig } from '@/lib/reminder-validation'
import { noStoreHeaders } from '@/lib/api-helpers'
import { logError } from '@/lib/logger'

// Maximum reminder rules per user
const MAX_RULES_PER_USER = 50

const VALID_TRIGGER_TYPES = ['interval', 'cron', 'event_window'] as const

/**
 * GET /api/reminders
 * List all reminder rules for the current user.
 *
 * Query params:
 *   babyId?  - filter by baby ID
 *   enabled? - filter by enabled state ("true" | "false")
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth(request)
    if (!session?.user?.id) {
      return NextResponse.json({ error: '未授权' }, { status: 401, headers: noStoreHeaders })
    }

    const listRateLimit = enforceRateLimit({
      key: buildUserActionKey('reminder-list', session.user.id, request),
      ...getRateLimit('reminder-list'),
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
    const babyId = searchParams.get('babyId') || undefined
    const enabledParam = searchParams.get('enabled')

    const where: Record<string, unknown> = { userId: session.user.id }
    if (babyId) {
      where.babyId = babyId
    }
    if (enabledParam !== null) {
      where.enabled = enabledParam === 'true'
    }

    const rules = await prisma.reminderRule.findMany({
      where,
      include: {
        baby: {
          select: { name: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    const result = rules.map(r => ({
      ...r,
      babyName: r.baby.name,
      triggerConfig: JSON.parse(r.triggerConfig),
      activeSchedule: r.activeSchedule ? JSON.parse(r.activeSchedule) : null,
      baby: undefined,
    }))

    return NextResponse.json(result, { headers: noStoreHeaders })
  } catch (error) {
    logError('获取提醒规则列表失败', error)
    return NextResponse.json({ error: '获取失败' }, { status: 500, headers: noStoreHeaders })
  }
}

/**
 * POST /api/reminders
 * Create a new reminder rule.
 *
 * Request body:
 *   name:          string (required, max 100)
 *   babyId:        string cuid (required)
 *   triggerType:   "interval" | "cron" | "event_window" (required)
 *   triggerConfig: object (required)
 *   notifyTitle:   string (required, max 200)
 *   notifyBody?:   string (optional, max 500)
 *   advanceMinutes?: number (optional, default 0)
 *   enabled?:      boolean (optional, default true)
 *   activeSchedule?: object (optional)
 *   startsAt?:     string ISO date (optional)
 *   expiresAt?:    string ISO date (optional)
 */
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

    const createRateLimit = enforceRateLimit({
      key: buildUserActionKey('reminder-create', session.user.id, request),
      ...getRateLimit('reminder-create'),
    })
    if (!createRateLimit.allowed) {
      return NextResponse.json(
        { error: '操作过于频繁，请稍后再试' },
        {
          status: 429,
          headers: {
            ...noStoreHeaders,
            'Retry-After': String(createRateLimit.retryAfterSeconds),
          },
        }
      )
    }

    const { data: body, error: parseError } = await safeParseBody(request)
    if (parseError || !body) {
      return NextResponse.json({ error: parseError || '请求体格式不正确' }, { status: 400, headers: noStoreHeaders })
    }

    const {
      name,
      babyId,
      triggerType,
      triggerConfig,
      notifyTitle,
      notifyBody,
      advanceMinutes,
      enabled,
      activeSchedule,
      startsAt,
      expiresAt,
    } = body

    // Validate name
    const nameCheck = validateString(name, '规则名称', 100)
    if (!nameCheck.valid) {
      return NextResponse.json({ error: nameCheck.error }, { status: 400, headers: noStoreHeaders })
    }

    // Validate babyId
    const babyIdCheck = validateId(babyId, 'babyId')
    if (!babyIdCheck.valid) {
      return NextResponse.json({ error: babyIdCheck.error }, { status: 400, headers: noStoreHeaders })
    }

    // Validate triggerType
    if (typeof triggerType !== 'string' || !(VALID_TRIGGER_TYPES as readonly string[]).includes(triggerType)) {
      return NextResponse.json({ error: '无效的 triggerType' }, { status: 400, headers: noStoreHeaders })
    }

    // Validate triggerConfig (must be a plain object)
    if (!triggerConfig || typeof triggerConfig !== 'object' || Array.isArray(triggerConfig)) {
      return NextResponse.json({ error: 'triggerConfig 必须是对象' }, { status: 400, headers: noStoreHeaders })
    }

    // Validate triggerConfig fields against triggerType
    const configCheck = validateTriggerConfig(triggerType as string, triggerConfig as Record<string, unknown>)
    if (!configCheck.valid) {
      return NextResponse.json({ error: configCheck.error }, { status: 400, headers: noStoreHeaders })
    }

    // Validate notifyTitle
    const notifyTitleCheck = validateString(notifyTitle, '通知标题', 200)
    if (!notifyTitleCheck.valid) {
      return NextResponse.json({ error: notifyTitleCheck.error }, { status: 400, headers: noStoreHeaders })
    }

    // Validate optional notifyBody
    if (notifyBody !== undefined && notifyBody !== null) {
      const notifyBodyCheck = validateString(notifyBody, '通知内容', 500)
      if (!notifyBodyCheck.valid) {
        return NextResponse.json({ error: notifyBodyCheck.error }, { status: 400, headers: noStoreHeaders })
      }
    }

    // Validate optional advanceMinutes
    if (advanceMinutes !== undefined && advanceMinutes !== null) {
      if (typeof advanceMinutes !== 'number' || !Number.isInteger(advanceMinutes) || advanceMinutes < 0 || advanceMinutes > 1440) {
        return NextResponse.json({ error: 'advanceMinutes 必须是 0-1440 的整数' }, { status: 400, headers: noStoreHeaders })
      }
    }

    // Validate optional enabled
    if (enabled !== undefined && typeof enabled !== 'boolean') {
      return NextResponse.json({ error: 'enabled 必须是布尔值' }, { status: 400, headers: noStoreHeaders })
    }

    // Validate optional activeSchedule
    if (activeSchedule !== undefined && activeSchedule !== null) {
      const scheduleCheck = validateActiveSchedule(activeSchedule)
      if (!scheduleCheck.valid) {
        return NextResponse.json({ error: scheduleCheck.error }, { status: 400, headers: noStoreHeaders })
      }
    }

    // Validate optional date strings
    let startsAtDate: Date | null = null
    if (startsAt !== undefined && startsAt !== null) {
      const d = new Date(startsAt as string)
      if (isNaN(d.getTime())) {
        return NextResponse.json({ error: 'startsAt 日期格式不正确' }, { status: 400, headers: noStoreHeaders })
      }
      startsAtDate = d
    }

    let expiresAtDate: Date | null = null
    if (expiresAt !== undefined && expiresAt !== null) {
      const d = new Date(expiresAt as string)
      if (isNaN(d.getTime())) {
        return NextResponse.json({ error: 'expiresAt 日期格式不正确' }, { status: 400, headers: noStoreHeaders })
      }
      expiresAtDate = d
    }
    if (startsAtDate && expiresAtDate && startsAtDate >= expiresAtDate) {
      return NextResponse.json({ error: 'startsAt 必须早于 expiresAt' }, { status: 400, headers: noStoreHeaders })
    }

    // Verify baby belongs to current user (and exists)
    const baby = await prisma.baby.findFirst({
      where: { id: babyId as string, createdBy: session.user.id },
      select: { id: true },
    })
    if (!baby) {
      return NextResponse.json({ error: '宝宝不存在或无权访问' }, { status: 404, headers: noStoreHeaders })
    }

    // Enforce per-user limit using a transaction
    let rule
    try {
      rule = await prisma.$transaction(async (tx) => {
        const count = await tx.reminderRule.count({
          where: { userId: session.user.id },
        })
        if (count >= MAX_RULES_PER_USER) {
          throw new Error('LIMIT_EXCEEDED')
        }
        return tx.reminderRule.create({
          data: {
            userId: session.user.id,
            babyId: babyId as string,
            name: (name as string).trim(),
            enabled: typeof enabled === 'boolean' ? enabled : true,
            triggerType: triggerType as string,
            triggerConfig: JSON.stringify(triggerConfig),
            activeSchedule: activeSchedule != null ? JSON.stringify(activeSchedule) : null,
            advanceMinutes: typeof advanceMinutes === 'number' ? advanceMinutes : 0,
            notifyTitle: (notifyTitle as string).trim(),
            notifyBody: notifyBody != null ? String(notifyBody).trim() : null,
            startsAt: startsAtDate,
            expiresAt: expiresAtDate,
          },
          include: {
            baby: { select: { name: true } },
          },
        })
      })
    } catch (txError) {
      if (txError instanceof Error && txError.message === 'LIMIT_EXCEEDED') {
        return NextResponse.json(
          { error: `每位用户最多创建 ${MAX_RULES_PER_USER} 条提醒规则` },
          { status: 400, headers: noStoreHeaders }
        )
      }
      throw txError
    }

    const response = {
      ...rule,
      babyName: rule.baby.name,
      triggerConfig: JSON.parse(rule.triggerConfig),
      activeSchedule: rule.activeSchedule ? JSON.parse(rule.activeSchedule) : null,
      baby: undefined,
    }

    return NextResponse.json(response, { status: 201, headers: noStoreHeaders })
  } catch (error) {
    logError('创建提醒规则失败', error)
    return NextResponse.json({ error: '创建失败' }, { status: 500, headers: noStoreHeaders })
  }
}
