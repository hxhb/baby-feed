import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { buildUserActionKey, enforceRateLimit } from '@/lib/rate-limit'
import { getRateLimit } from '@/lib/rate-limit-config'
import { noStoreHeaders } from '@/lib/api-helpers'
import { safeParseBody, validateSameOrigin } from '@/lib/validation'
import { logError } from '@/lib/logger'

const DEFAULT_SETTINGS = {
  autoVaccineReminder: false,
  vaccineReminderDefaults: {
    windowDays: 3,
    repeatHours: 5,
    scheduleStart: '09:00',
    scheduleEnd: '22:00',
  },
}

function isValidHHMM(val: unknown): boolean {
  return typeof val === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(val)
}

/**
 * GET /api/reminders/config
 * Get current user's reminder configuration (auto-vaccine settings etc.)
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth(request)
    if (!session?.user?.id) {
      return NextResponse.json({ error: '未授权' }, { status: 401, headers: noStoreHeaders })
    }

    const rl = enforceRateLimit({
      key: buildUserActionKey('reminder-list', session.user.id, request),
      ...getRateLimit('reminder-list'),
    })
    if (!rl.allowed) {
      return NextResponse.json({ error: '请求过于频繁' }, { status: 429, headers: noStoreHeaders })
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { reminderSettings: true },
    })

    const settings = user?.reminderSettings ? JSON.parse(user.reminderSettings) : DEFAULT_SETTINGS

    return NextResponse.json(settings, { headers: noStoreHeaders })
  } catch (error) {
    logError('获取提醒配置失败', error)
    return NextResponse.json({ error: '获取失败' }, { status: 500, headers: noStoreHeaders })
  }
}

/**
 * PUT /api/reminders/config
 * Update user's reminder configuration
 */
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

    const rl = enforceRateLimit({
      key: buildUserActionKey('reminder-update', session.user.id, request),
      ...getRateLimit('reminder-update'),
    })
    if (!rl.allowed) {
      return NextResponse.json({ error: '请求过于频繁' }, { status: 429, headers: noStoreHeaders })
    }

    const { data: body, error: parseError } = await safeParseBody(request)
    if (parseError || !body) {
      return NextResponse.json({ error: parseError || '请求体格式不正确' }, { status: 400, headers: noStoreHeaders })
    }

    // Validate and merge with defaults
    const vrd = (body.vaccineReminderDefaults || {}) as Record<string, unknown>
    const settings = {
      autoVaccineReminder: typeof body.autoVaccineReminder === 'boolean' ? body.autoVaccineReminder : DEFAULT_SETTINGS.autoVaccineReminder,
      vaccineReminderDefaults: {
        windowDays: Math.max(1, Math.min(7, Number(vrd.windowDays) || DEFAULT_SETTINGS.vaccineReminderDefaults.windowDays)),
        repeatHours: Math.max(1, Math.min(24, Number(vrd.repeatHours) || DEFAULT_SETTINGS.vaccineReminderDefaults.repeatHours)),
        scheduleStart: isValidHHMM(vrd.scheduleStart) ? vrd.scheduleStart as string : DEFAULT_SETTINGS.vaccineReminderDefaults.scheduleStart,
        scheduleEnd: isValidHHMM(vrd.scheduleEnd) ? vrd.scheduleEnd as string : DEFAULT_SETTINGS.vaccineReminderDefaults.scheduleEnd,
      },
    }

    await prisma.user.update({
      where: { id: session.user.id },
      data: { reminderSettings: JSON.stringify(settings) },
    })

    return NextResponse.json(settings, { headers: noStoreHeaders })
  } catch (error) {
    logError('更新提醒配置失败', error)
    return NextResponse.json({ error: '更新失败' }, { status: 500, headers: noStoreHeaders })
  }
}
