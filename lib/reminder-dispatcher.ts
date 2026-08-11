/**
 * Reminder Notification Dispatcher
 *
 * Handles template rendering, webhook emission, and activity logging
 * when a reminder rule fires.
 */

import { prisma } from './prisma'
import { activityLogger } from './activity-logger'
import { emitWebhookEvent } from './webhook-service'
import { logError } from './logger'

interface FireReminderParams {
  rule: {
    id: string
    userId: string
    babyId: string
    name: string
    triggerType: string
    notifyTitle: string
    notifyBody: string | null
    advanceMinutes: number
  }
  context: Record<string, unknown>
  now: Date
  eventId: string
}

/**
 * Render a template string, replacing {{variable}} placeholders
 */
function renderTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? `{{${key}}}`)
}

/**
 * Format elapsed minutes as human-readable string
 */
function formatElapsed(minutes: number | null): string {
  if (minutes === null) return '未知时间'
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  if (hours > 0 && mins > 0) return `${hours}小时${mins}分钟`
  if (hours > 0) return `${hours}小时`
  return `${mins}分钟`
}

/**
 * Format a Date as Beijing time string
 */
function formatBeijingNow(date: Date): string {
  const beijing = new Date(date.getTime() + 8 * 60 * 60 * 1000)
  const month = String(beijing.getUTCMonth() + 1).padStart(2, '0')
  const day = String(beijing.getUTCDate()).padStart(2, '0')
  const hour = String(beijing.getUTCHours()).padStart(2, '0')
  const minute = String(beijing.getUTCMinutes()).padStart(2, '0')
  return `${month}-${day} ${hour}:${minute}`
}

/**
 * Fire a reminder: render templates, emit webhook, log to activity-logger
 */
export async function fireReminder({ rule, context, now, eventId }: FireReminderParams): Promise<{
  title: string
  body: string | null
  eventId: string | null
}> {
  try {
    // Get baby name for template
    const baby = await prisma.baby.findFirst({
      where: { id: rule.babyId, createdBy: rule.userId },
      select: { name: true },
    })
    const babyName = baby?.name ?? '宝宝'

    // Build template variables
    const vars: Record<string, string> = {
      babyName,
      ruleName: rule.name,
      now: formatBeijingNow(now),
      elapsed: formatElapsed(context.elapsedMinutes as number | null),
    }

    const renderedTitle = renderTemplate(rule.notifyTitle, vars)
    const renderedBody = rule.notifyBody ? renderTemplate(rule.notifyBody, vars) : null

    // Emit webhook event
    const emitted = await emitWebhookEvent(
      rule.userId,
      'reminder.fired',
      {
        data: {
          ruleId: rule.id,
          ruleName: rule.name,
          triggerType: rule.triggerType,
          babyId: rule.babyId,
          babyName,
          title: renderedTitle,
          body: renderedBody,
          context,
        },
      },
      { eventId },
    )

    // Log to activity-logger
    activityLogger.record({
      source: 'reminder',
      userId: rule.userId,
      groupKey: rule.id,
      groupLabel: rule.name,
      status: 'success',
      summary: `${rule.name} · ${renderedTitle}`,
      meta: {
        ruleId: rule.id,
        triggerType: rule.triggerType,
        babyId: rule.babyId,
        babyName,
        title: renderedTitle,
        body: renderedBody,
        webhookDelivered: true,
        context,
      },
    })
    return { title: renderedTitle, body: renderedBody, eventId: emitted.eventId }
  } catch (error) {
    logError(`Reminder dispatch failed for rule ${rule.id}`, error)

    // Log failure
    activityLogger.record({
      source: 'reminder',
      userId: rule.userId,
      groupKey: rule.id,
      groupLabel: rule.name,
      status: 'failed',
      summary: `${rule.name} · 发送失败`,
      meta: {
        ruleId: rule.id,
        triggerType: rule.triggerType,
        error: error instanceof Error ? error.message : String(error),
      },
    })
    throw error
  }
}
