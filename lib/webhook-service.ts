/**
 * Webhook Service (In-Memory)
 *
 * Handles emission of webhook events. Events are delivered immediately
 * and logged to the in-memory activity logger. Failed deliveries are
 * queued for retry in the in-memory retry queue.
 */

import { prisma } from './prisma'
import { type AnyWebhookPayload, type WebhookEventType } from './webhook-events'
import { sendWebhookImmediate } from './webhook-runner'
import { logError } from './logger'
import { resetIntervalRules } from '@/lib/reminder-scheduler'
import { autoCreateVaccineReminder } from '@/lib/reminder-auto-vaccine'
import crypto from 'crypto'

/* eslint-disable @typescript-eslint/no-explicit-any */
// Record types from Prisma are complex nested objects — using `any` for the
// emit helper params keeps the webhook layer decoupled from generated types.
// The actual payload construction below is fully type-safe via explicit field access.

// ─── Field lists for change detection ────────────────────────────────────────

const FEEDING_FIELDS = [
  'type',
  'leftBreastDuration',
  'rightBreastDuration',
  'breastMilkAmount',
  'formulaAmount',
  'solidFoodName',
  'solidFoodAmount',
  'adGiven',
  'startTime',
  'endTime',
  'notes',
] as const

const HEALTH_FIELDS = [
  'type',
  'weight',
  'height',
  'temperature',
  'medicationName',
  'medicationDose',
  'vaccineName',
  'vaccineManufacturer',
  'vaccineDoseNumber',
  'vaccineTotalDoses',
  'diaperType',
  'diaperStatus',
  'adGiven',
  'sleepStartTime',
  'sleepEndTime',
  'sleepQuality',
  'recordedAt',
  'notes',
] as const

// ─── Record type labels for summary ────────────────────────────────────────

const RECORD_TYPE_LABELS: Record<string, string> = {
  BREAST_MILK: '母乳亲喂',
  BREAST_MILK_BOTTLE: '母乳瓶喂',
  FORMULA: '奶粉',
  SOLID_FOOD: '辅食',
  WEIGHT: '体重',
  HEIGHT: '身高',
  TEMPERATURE: '体温',
  MEDICATION: '服药',
  VACCINE: '疫苗',
  DIAPER: '大小便',
  AD_VITAMIN: 'AD滴剂',
  SLEEP: '睡眠',
}

const EVENT_LABELS: Record<string, string> = {
  'feeding.created': '新增喂养',
  'feeding.updated': '更新喂养',
  'feeding.deleted': '删除喂养',
  'health.created': '新增健康',
  'health.updated': '更新健康',
  'health.deleted': '删除健康',
  'memo.created': '新增备忘',
  'memo.updated': '更新备忘',
  'memo.deleted': '删除备忘',
  'user.deleted': '删除用户',
}

// ─── Shared helpers ──────────────────────────────────────────────────────────

/**
 * Detect changes between two records for a set of fields.
 * Handles Date objects by converting to ISO strings before comparison.
 */
function detectChanges(
  oldRecord: Record<string, any>,
  newRecord: Record<string, any>,
  fields: readonly string[]
): Record<string, { old: unknown; new: unknown }> {
  const changes: Record<string, { old: unknown; new: unknown }> = {}

  for (const field of fields) {
    const oldVal = oldRecord[field]
    const newVal = newRecord[field]

    const oldCompare = oldVal instanceof Date ? oldVal.toISOString() : oldVal
    const newCompare = newVal instanceof Date ? newVal.toISOString() : newVal

    if (oldCompare !== newCompare) {
      changes[field] = { old: oldCompare, new: newCompare }
    }
  }

  return changes
}

/**
 * Build a minimal baby info object for event payloads (created events).
 */
function buildBabyPayload(baby: any): { id: string; name: string; birthDate: string; gender: string } {
  return {
    id: baby.id,
    name: baby.name,
    birthDate: baby.birthDate.toISOString(),
    gender: baby.gender,
  }
}

/**
 * Build a minimal baby info object for updated events (less data needed).
 */
function buildBabyPayloadBrief(baby: any): { id: string; name: string } {
  return { id: baby.id, name: baby.name }
}

/**
 * Generate a human-readable summary from event data
 */
function buildSummary(eventType: WebhookEventType, data: any): string {
  const parts: string[] = []

  // Event type label
  const eventLabel = EVENT_LABELS[eventType]
  if (eventLabel) parts.push(eventLabel)

  // Baby name
  const babyName = data?.baby?.name
  if (babyName) parts.push(babyName)

  // Content detail
  if (data?.title) {
    parts.push(data.title)
  } else if (data?.type && RECORD_TYPE_LABELS[data.type]) {
    parts.push(RECORD_TYPE_LABELS[data.type])
    if (data.formulaAmount) parts.push(`${data.formulaAmount}ml`)
    else if (data.breastMilkAmount) parts.push(`${data.breastMilkAmount}ml`)
    else if (data.weight) parts.push(`${data.weight}kg`)
    else if (data.height) parts.push(`${data.height}cm`)
    else if (data.temperature) parts.push(`${data.temperature}°C`)
  } else if (data?.email) {
    parts.push(data.email)
  }

  return parts.join(' · ')
}

// ─── Core emit function ──────────────────────────────────────────────────────

/**
 * Emit a webhook event
 *
 * Finds all active endpoints subscribed to this event type,
 * delivers the payload immediately, and logs the result.
 * Failed deliveries are queued for retry.
 */
export async function emitWebhookEvent(
  userId: string,
  eventType: WebhookEventType,
  payload: Omit<AnyWebhookPayload, 'id' | 'timestamp' | 'userId' | 'type'> & { recordId?: string; recordType?: string },
): Promise<void> {
  try {
    const eventId = crypto.randomBytes(8).toString('hex')

    // Build the full payload
    const fullPayload = JSON.stringify({
      id: eventId,
      type: eventType,
      timestamp: new Date().toISOString(),
      userId,
      ...payload,
    })

    // Generate summary for activity logger
    const summary = buildSummary(eventType, payload.data)

    // Find all active endpoints subscribed to this event type
    const endpoints = await prisma.webhookEndpoint.findMany({
      where: {
        userId,
        active: true,
      },
    })

    // For each endpoint, check if it subscribes to this event and deliver
    for (const endpoint of endpoints) {
      const subscribedEvents = JSON.parse(endpoint.events || '[]') as string[]

      if (subscribedEvents.includes(eventType) || subscribedEvents.includes('*')) {
        // Fire-and-forget immediate delivery (non-blocking)
        sendWebhookImmediate(
          fullPayload,
          eventType,
          eventId,
          {
            id: endpoint.id,
            url: endpoint.url,
            secret: endpoint.secret,
            maxRetries: endpoint.maxRetries,
            retryDelay: endpoint.retryDelay,
          },
          userId,
          summary
        ).catch(err => {
          logError(`Immediate webhook delivery failed for endpoint ${endpoint.id}`, err)
        })
      }
    }
  } catch (error) {
    logError(`Failed to emit webhook event: ${eventType}`, error)
    // Don't throw - webhook failures should not block the main operation
  }
}

// ─── Feeding event emitters ──────────────────────────────────────────────────

export async function emitFeedingCreated(
  userId: string,
  record: any,
  baby: any
): Promise<void> {
  await emitWebhookEvent(
    userId,
    'feeding.created',
    {
      recordId: record.id,
      recordType: 'FeedingRecord',
      data: {
        recordId: record.id,
        babyId: record.babyId,
        type: record.type,
        leftBreastDuration: record.leftBreastDuration,
        rightBreastDuration: record.rightBreastDuration,
        breastMilkAmount: record.breastMilkAmount,
        formulaAmount: record.formulaAmount,
        solidFoodName: record.solidFoodName,
        solidFoodAmount: record.solidFoodAmount,
        adGiven: record.adGiven,
        startTime: record.startTime.toISOString(),
        endTime: record.endTime?.toISOString(),
        notes: record.notes,
        createdAt: record.createdAt.toISOString(),
        baby: buildBabyPayload(baby),
      },
    },
  )
  // Reset interval reminder timers for feeding
  resetIntervalRules(userId, record.babyId, 'feeding').catch(() => {})
}

export async function emitFeedingUpdated(
  userId: string,
  oldRecord: any,
  newRecord: any,
  baby: any
): Promise<void> {
  const changes = detectChanges(oldRecord, newRecord, FEEDING_FIELDS)

  await emitWebhookEvent(
    userId,
    'feeding.updated',
    {
      recordId: newRecord.id,
      recordType: 'FeedingRecord',
      data: {
        recordId: newRecord.id,
        babyId: newRecord.babyId,
        type: newRecord.type,
        changes,
        leftBreastDuration: newRecord.leftBreastDuration,
        rightBreastDuration: newRecord.rightBreastDuration,
        breastMilkAmount: newRecord.breastMilkAmount,
        formulaAmount: newRecord.formulaAmount,
        solidFoodName: newRecord.solidFoodName,
        solidFoodAmount: newRecord.solidFoodAmount,
        adGiven: newRecord.adGiven,
        startTime: newRecord.startTime.toISOString(),
        endTime: newRecord.endTime?.toISOString(),
        notes: newRecord.notes,
        updatedAt: newRecord.updatedAt.toISOString(),
        baby: buildBabyPayloadBrief(baby),
      },
    },
  )
}

export async function emitFeedingDeleted(
  userId: string,
  record: any
): Promise<void> {
  await emitWebhookEvent(
    userId,
    'feeding.deleted',
    {
      recordId: record.id,
      recordType: 'FeedingRecord',
      data: {
        recordId: record.id,
        babyId: record.babyId,
        type: record.type,
        startTime: record.startTime.toISOString(),
        endTime: record.endTime?.toISOString(),
        deletedAt: new Date().toISOString(),
      },
    },
  )
}

// ─── Health event emitters ───────────────────────────────────────────────────

export async function emitHealthCreated(
  userId: string,
  record: any,
  baby: any
): Promise<void> {
  await emitWebhookEvent(
    userId,
    'health.created',
    {
      recordId: record.id,
      recordType: 'HealthRecord',
      data: {
        recordId: record.id,
        babyId: record.babyId,
        type: record.type,
        weight: record.weight,
        height: record.height,
        temperature: record.temperature,
        medicationName: record.medicationName,
        medicationDose: record.medicationDose,
        vaccineName: record.vaccineName,
        vaccineManufacturer: record.vaccineManufacturer,
        vaccineDoseNumber: record.vaccineDoseNumber,
        vaccineTotalDoses: record.vaccineTotalDoses,
        diaperType: record.diaperType,
        diaperStatus: record.diaperStatus,
        adGiven: record.adGiven,
        sleepStartTime: record.sleepStartTime?.toISOString(),
        sleepEndTime: record.sleepEndTime?.toISOString(),
        sleepQuality: record.sleepQuality,
        recordedAt: record.recordedAt.toISOString(),
        notes: record.notes,
        createdAt: record.createdAt.toISOString(),
        baby: buildBabyPayload(baby),
      },
    },
  )
  // Reset interval reminder timers for health
  resetIntervalRules(userId, record.babyId, 'health').catch(() => {})

  // Auto-create vaccine monitoring reminder if configured
  if (record.type === 'VACCINE') {
    autoCreateVaccineReminder(userId, record, baby.name).catch(() => {})
  }
}

export async function emitHealthUpdated(
  userId: string,
  oldRecord: any,
  newRecord: any,
  baby: any
): Promise<void> {
  const changes = detectChanges(oldRecord, newRecord, HEALTH_FIELDS)

  await emitWebhookEvent(
    userId,
    'health.updated',
    {
      recordId: newRecord.id,
      recordType: 'HealthRecord',
      data: {
        recordId: newRecord.id,
        babyId: newRecord.babyId,
        type: newRecord.type,
        changes,
        weight: newRecord.weight,
        height: newRecord.height,
        temperature: newRecord.temperature,
        medicationName: newRecord.medicationName,
        medicationDose: newRecord.medicationDose,
        vaccineName: newRecord.vaccineName,
        vaccineManufacturer: newRecord.vaccineManufacturer,
        vaccineDoseNumber: newRecord.vaccineDoseNumber,
        vaccineTotalDoses: newRecord.vaccineTotalDoses,
        diaperType: newRecord.diaperType,
        diaperStatus: newRecord.diaperStatus,
        adGiven: newRecord.adGiven,
        sleepStartTime: newRecord.sleepStartTime?.toISOString(),
        sleepEndTime: newRecord.sleepEndTime?.toISOString(),
        sleepQuality: newRecord.sleepQuality,
        recordedAt: newRecord.recordedAt.toISOString(),
        notes: newRecord.notes,
        updatedAt: newRecord.updatedAt.toISOString(),
        baby: buildBabyPayloadBrief(baby),
      },
    },
  )
}

export async function emitHealthDeleted(
  userId: string,
  record: any
): Promise<void> {
  await emitWebhookEvent(
    userId,
    'health.deleted',
    {
      recordId: record.id,
      recordType: 'HealthRecord',
      data: {
        recordId: record.id,
        babyId: record.babyId,
        type: record.type,
        recordedAt: record.recordedAt.toISOString(),
        deletedAt: new Date().toISOString(),
      },
    },
  )
}

// ─── Memo event emitters ─────────────────────────────────────────────────────

const MEMO_FIELDS = [
  'title',
  'content',
  'scheduledAt',
  'completed',
  'completedAt',
] as const

export async function emitMemoCreated(
  userId: string,
  record: any,
  baby: any
): Promise<void> {
  await emitWebhookEvent(
    userId,
    'memo.created',
    {
      recordId: record.id,
      recordType: 'Memo',
      data: {
        recordId: record.id,
        babyId: record.babyId,
        title: record.title,
        content: record.content,
        scheduledAt: record.scheduledAt.toISOString(),
        completed: record.completed,
        createdAt: record.createdAt.toISOString(),
        baby: buildBabyPayloadBrief(baby),
      },
    },
  )
}

export async function emitMemoUpdated(
  userId: string,
  oldRecord: any,
  newRecord: any,
  baby: any
): Promise<void> {
  const changes = detectChanges(oldRecord, newRecord, MEMO_FIELDS)

  await emitWebhookEvent(
    userId,
    'memo.updated',
    {
      recordId: newRecord.id,
      recordType: 'Memo',
      data: {
        recordId: newRecord.id,
        babyId: newRecord.babyId,
        title: newRecord.title,
        content: newRecord.content,
        scheduledAt: newRecord.scheduledAt.toISOString(),
        completed: newRecord.completed,
        completedAt: newRecord.completedAt?.toISOString() ?? null,
        changes,
        updatedAt: newRecord.updatedAt.toISOString(),
        baby: buildBabyPayloadBrief(baby),
      },
    },
  )
}

export async function emitMemoDeleted(
  userId: string,
  record: any
): Promise<void> {
  await emitWebhookEvent(
    userId,
    'memo.deleted',
    {
      recordId: record.id,
      recordType: 'Memo',
      data: {
        recordId: record.id,
        babyId: record.babyId,
        title: record.title,
        deletedAt: new Date().toISOString(),
      },
    },
  )
}

// ─── User event emitters ─────────────────────────────────────────────────────

export async function emitUserDeleted(
  adminUserId: string,
  deletedUser: any,
  counts: { babies: number; feedingRecords: number; healthRecords: number }
): Promise<void> {
  await emitWebhookEvent(
    adminUserId,
    'user.deleted',
    {
      recordId: deletedUser.id,
      recordType: 'User',
      data: {
        userId: deletedUser.id,
        email: deletedUser.email,
        name: deletedUser.name,
        babiesCount: counts.babies,
        feedingRecordsCount: counts.feedingRecords,
        healthRecordsCount: counts.healthRecords,
        deletedAt: new Date().toISOString(),
      },
    },
  )
}
