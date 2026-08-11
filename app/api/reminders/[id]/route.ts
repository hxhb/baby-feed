import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { buildUserActionKey, enforceRateLimit } from '@/lib/rate-limit'
import { getRateLimit } from '@/lib/rate-limit-config'
import { validateId, safeParseBody, validateSameOrigin, validateString } from '@/lib/validation'
import { validateActiveSchedule, validateTriggerConfig } from '@/lib/reminder-validation'
import { noStoreHeaders } from '@/lib/api-helpers'
import { logError } from '@/lib/logger'

const VALID_TRIGGER_TYPES = ['interval', 'cron', 'event_window'] as const

/**
 * PUT /api/reminders/[id]
 * Partially update a reminder rule.
 * If `enabled` or `triggerConfig` is updated, nextCheckAt is reset to null.
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const session = await auth(request)
    if (!session?.user?.id) {
      return NextResponse.json({ error: '未授权' }, { status: 401, headers: noStoreHeaders })
    }

    const originCheck = validateSameOrigin(request)
    if (!originCheck.valid) {
      return NextResponse.json({ error: originCheck.error }, { status: 403, headers: noStoreHeaders })
    }

    const updateRateLimit = enforceRateLimit({
      key: buildUserActionKey('reminder-update', session.user.id, request),
      ...getRateLimit('reminder-update'),
    })
    if (!updateRateLimit.allowed) {
      return NextResponse.json(
        { error: '操作过于频繁，请稍后再试' },
        {
          status: 429,
          headers: {
            ...noStoreHeaders,
            'Retry-After': String(updateRateLimit.retryAfterSeconds),
          },
        }
      )
    }

    const idCheck = validateId(id, '提醒规则 ID')
    if (!idCheck.valid) {
      return NextResponse.json({ error: idCheck.error }, { status: 400, headers: noStoreHeaders })
    }

    const { data: body, error: parseError } = await safeParseBody(request)
    if (parseError || !body) {
      return NextResponse.json({ error: parseError || '请求体格式不正确' }, { status: 400, headers: noStoreHeaders })
    }

    // Verify ownership
    const existing = await prisma.reminderRule.findFirst({
      where: { id, userId: session.user.id },
    })
    if (!existing) {
      return NextResponse.json({ error: '提醒规则不存在' }, { status: 404, headers: noStoreHeaders })
    }

    const {
      babyId,
      name,
      enabled,
      triggerType,
      triggerConfig,
      activeSchedule,
      advanceMinutes,
      notifyTitle,
      notifyBody,
      startsAt,
      expiresAt,
    } = body

    const updateData: Record<string, unknown> = {}
    let shouldResetNextCheckAt = false

    if (babyId !== undefined) {
      if (typeof babyId !== 'string') {
        return NextResponse.json({ error: 'babyId 必须是字符串' }, { status: 400, headers: noStoreHeaders })
      }

      const babyIdCheck = validateId(babyId, '宝宝 ID')
      if (!babyIdCheck.valid) {
        return NextResponse.json({ error: babyIdCheck.error }, { status: 400, headers: noStoreHeaders })
      }

      const baby = await prisma.baby.findFirst({
        where: { id: babyId, createdBy: session.user.id },
        select: { id: true },
      })
      if (!baby) {
        return NextResponse.json({ error: '宝宝不存在' }, { status: 404, headers: noStoreHeaders })
      }

      updateData.babyId = babyId
      if (babyId !== existing.babyId) {
        shouldResetNextCheckAt = true
      }
    }

    // name
    if (name !== undefined) {
      const nameCheck = validateString(name, '规则名称', 100)
      if (!nameCheck.valid) {
        return NextResponse.json({ error: nameCheck.error }, { status: 400, headers: noStoreHeaders })
      }
      updateData.name = (name as string).trim()
    }

    // enabled
    if (enabled !== undefined) {
      if (typeof enabled !== 'boolean') {
        return NextResponse.json({ error: 'enabled 必须是布尔值' }, { status: 400, headers: noStoreHeaders })
      }
      updateData.enabled = enabled
      if (enabled !== existing.enabled) {
        shouldResetNextCheckAt = true
      }
    }

    // triggerType
    if (triggerType !== undefined) {
      if (!(VALID_TRIGGER_TYPES as readonly string[]).includes(triggerType as string)) {
        return NextResponse.json({ error: '无效的 triggerType' }, { status: 400, headers: noStoreHeaders })
      }
      updateData.triggerType = triggerType as string
      let effectiveConfig: Record<string, unknown>
      try {
        effectiveConfig = triggerConfig !== undefined
          ? triggerConfig as Record<string, unknown>
          : JSON.parse(existing.triggerConfig) as Record<string, unknown>
      } catch {
        return NextResponse.json({ error: '现有 triggerConfig 格式不正确，请同时提交有效配置' }, { status: 400, headers: noStoreHeaders })
      }
      const configCheck = validateTriggerConfig(triggerType as string, effectiveConfig)
      if (!configCheck.valid) {
        return NextResponse.json({ error: configCheck.error }, { status: 400, headers: noStoreHeaders })
      }
      shouldResetNextCheckAt = true
    }

    // triggerConfig
    if (triggerConfig !== undefined) {
      if (!triggerConfig || typeof triggerConfig !== 'object' || Array.isArray(triggerConfig)) {
        return NextResponse.json({ error: 'triggerConfig 必须是对象' }, { status: 400, headers: noStoreHeaders })
      }
      // Validate triggerConfig fields against the effective triggerType
      if (body.triggerConfig !== undefined) {
        const effectiveType = (body.triggerType as string | undefined) || existing.triggerType
        const configCheck = validateTriggerConfig(effectiveType, body.triggerConfig as Record<string, unknown>)
        if (!configCheck.valid) {
          return NextResponse.json({ error: configCheck.error }, { status: 400, headers: noStoreHeaders })
        }
      }
      updateData.triggerConfig = JSON.stringify(triggerConfig)
      shouldResetNextCheckAt = true
    }

    // activeSchedule
    if (activeSchedule !== undefined) {
      if (activeSchedule === null) {
        updateData.activeSchedule = null
      } else {
        const scheduleCheck = validateActiveSchedule(activeSchedule)
        if (!scheduleCheck.valid) {
          return NextResponse.json({ error: scheduleCheck.error }, { status: 400, headers: noStoreHeaders })
        }
        updateData.activeSchedule = JSON.stringify(activeSchedule)
      }
      shouldResetNextCheckAt = true
    }

    // advanceMinutes
    if (advanceMinutes !== undefined) {
      if (typeof advanceMinutes !== 'number' || !Number.isInteger(advanceMinutes) || advanceMinutes < 0 || advanceMinutes > 1440) {
        return NextResponse.json({ error: 'advanceMinutes 必须是 0-1440 的整数' }, { status: 400, headers: noStoreHeaders })
      }
      updateData.advanceMinutes = advanceMinutes
      shouldResetNextCheckAt = true
    }

    // notifyTitle
    if (notifyTitle !== undefined) {
      const titleCheck = validateString(notifyTitle, '通知标题', 200)
      if (!titleCheck.valid) {
        return NextResponse.json({ error: titleCheck.error }, { status: 400, headers: noStoreHeaders })
      }
      shouldResetNextCheckAt = true
      updateData.notifyTitle = (notifyTitle as string).trim()
    }

    // notifyBody
    if (notifyBody !== undefined) {
      if (notifyBody === null) {
        updateData.notifyBody = null
      } else {
        const bodyCheck = validateString(notifyBody, '通知内容', 500)
        if (!bodyCheck.valid) {
          return NextResponse.json({ error: bodyCheck.error }, { status: 400, headers: noStoreHeaders })
        }
        updateData.notifyBody = String(notifyBody).trim()
      }
      shouldResetNextCheckAt = true
    }

    // startsAt
    if (startsAt !== undefined) {
      if (startsAt === null) {
        updateData.startsAt = null
      } else {
        const d = new Date(startsAt as string)
        if (isNaN(d.getTime())) {
          return NextResponse.json({ error: 'startsAt 日期格式不正确' }, { status: 400, headers: noStoreHeaders })
        }
        updateData.startsAt = d
      }
      shouldResetNextCheckAt = true
    }

    // expiresAt
    if (expiresAt !== undefined) {
      if (expiresAt === null) {
        updateData.expiresAt = null
      } else {
        const d = new Date(expiresAt as string)
        if (isNaN(d.getTime())) {
          return NextResponse.json({ error: 'expiresAt 日期格式不正确' }, { status: 400, headers: noStoreHeaders })
        }
        updateData.expiresAt = d
      }
      shouldResetNextCheckAt = true
    }

    const effectiveStartsAt = updateData.startsAt === undefined ? existing.startsAt : updateData.startsAt as Date | null
    const effectiveExpiresAt = updateData.expiresAt === undefined ? existing.expiresAt : updateData.expiresAt as Date | null
    if (effectiveStartsAt && effectiveExpiresAt && effectiveStartsAt >= effectiveExpiresAt) {
      return NextResponse.json({ error: 'startsAt 必须早于 expiresAt' }, { status: 400, headers: noStoreHeaders })
    }

    // Reset nextCheckAt if enabled or triggerConfig changed
    if (shouldResetNextCheckAt) {
      updateData.nextCheckAt = null
    }

    const claimed = await prisma.reminderRule.updateMany({
      where: { id, userId: session.user.id, updatedAt: existing.updatedAt },
      data: updateData,
    })
    if (claimed.count !== 1) throw new Error('REMINDER_UPDATE_CONFLICT')
    const updated = await prisma.reminderRule.findFirst({
      where: { id, userId: session.user.id },
      include: {
        baby: { select: { name: true } },
      },
    })
    if (!updated) throw new Error('REMINDER_UPDATE_CONFLICT')

    const response = {
      ...updated,
      babyName: updated.baby.name,
      triggerConfig: JSON.parse(updated.triggerConfig),
      activeSchedule: updated.activeSchedule ? JSON.parse(updated.activeSchedule) : null,
      baby: undefined,
    }

    return NextResponse.json(response, { headers: noStoreHeaders })
  } catch (error) {
    if (error instanceof Error && error.message === 'REMINDER_UPDATE_CONFLICT') {
      return NextResponse.json({ error: '提醒规则已被其他请求修改，请刷新后重试' }, { status: 409, headers: noStoreHeaders })
    }
    logError('更新提醒规则失败', error)
    return NextResponse.json({ error: '更新失败' }, { status: 500, headers: noStoreHeaders })
  }
}

/**
 * DELETE /api/reminders/[id]
 * Delete a reminder rule. Verifies ownership before deleting.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const session = await auth(request)
    if (!session?.user?.id) {
      return NextResponse.json({ error: '未授权' }, { status: 401, headers: noStoreHeaders })
    }

    const originCheck = validateSameOrigin(request)
    if (!originCheck.valid) {
      return NextResponse.json({ error: originCheck.error }, { status: 403, headers: noStoreHeaders })
    }

    const deleteRateLimit = enforceRateLimit({
      key: buildUserActionKey('reminder-delete', session.user.id, request),
      ...getRateLimit('reminder-delete'),
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

    const idCheck = validateId(id, '提醒规则 ID')
    if (!idCheck.valid) {
      return NextResponse.json({ error: idCheck.error }, { status: 400, headers: noStoreHeaders })
    }

    // Verify ownership
    const existing = await prisma.reminderRule.findFirst({
      where: { id, userId: session.user.id },
    })
    if (!existing) {
      return NextResponse.json({ error: '提醒规则不存在' }, { status: 404, headers: noStoreHeaders })
    }

    const deleted = await prisma.reminderRule.deleteMany({
      where: { id, userId: session.user.id, updatedAt: existing.updatedAt },
    })
    if (deleted.count !== 1) throw new Error('REMINDER_UPDATE_CONFLICT')

    return NextResponse.json({ success: true }, { headers: noStoreHeaders })
  } catch (error) {
    if (error instanceof Error && error.message === 'REMINDER_UPDATE_CONFLICT') {
      return NextResponse.json({ error: '提醒规则已被其他请求修改，请刷新后重试' }, { status: 409, headers: noStoreHeaders })
    }
    logError('删除提醒规则失败', error)
    return NextResponse.json({ error: '删除失败' }, { status: 500, headers: noStoreHeaders })
  }
}
