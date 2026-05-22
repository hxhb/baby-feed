/**
 * Webhook Service
 *
 * Handles emission of webhook events. Events are stored in the database
 * and immediate delivery is attempted. Failed deliveries are retried by cron.
 */

import { prisma } from './prisma'
import { type AnyWebhookPayload, type WebhookEventType } from './webhook-events'
import { sendWebhookDeliveryImmediate } from './webhook-runner'
import { logError } from './logger'

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

// ─── Core emit function ──────────────────────────────────────────────────────

/**
 * Emit a webhook event
 *
 * Creates a WebhookEvent record in the database and WebhookDelivery records
 * for each endpoint subscribed to this event type.
 */
export async function emitWebhookEvent(
  userId: string,
  eventType: WebhookEventType,
  payload: Omit<AnyWebhookPayload, 'id' | 'timestamp' | 'userId' | 'type'> & { recordId?: string; recordType?: string },
  recordId?: string,
  recordType?: string
): Promise<void> {
  try {
    // Create the event record
    const event = await prisma.webhookEvent.create({
      data: {
        userId,
        type: eventType,
        payload: JSON.stringify({
          id: '', // Will be set by the event ID
          type: eventType,
          timestamp: new Date().toISOString(),
          userId,
          ...payload,
        }),
        recordId: recordId || payload.recordId,
        recordType: recordType || payload.recordType,
      },
    })

    // Update the payload with the actual event ID
    const eventData = JSON.parse(event.payload)
    eventData.id = event.id
    await prisma.webhookEvent.update({
      where: { id: event.id },
      data: { payload: JSON.stringify(eventData) },
    })

    // Find all active endpoints subscribed to this event type
    const endpoints = await prisma.webhookEndpoint.findMany({
      where: {
        userId,
        active: true,
      },
    })

    // For each endpoint, check if it subscribes to this event
    const createdDeliveryIds: string[] = []

    for (const endpoint of endpoints) {
      const subscribedEvents = JSON.parse(endpoint.events || '[]') as string[]

      if (subscribedEvents.includes(eventType) || subscribedEvents.includes('*')) {
        const delivery = await prisma.webhookDelivery.create({
          data: {
            eventId: event.id,
            endpointId: endpoint.id,
            status: 'pending',
          },
        })
        createdDeliveryIds.push(delivery.id)
      }
    }

    // Attempt immediate delivery (non-blocking, fire-and-forget)
    for (const deliveryId of createdDeliveryIds) {
      sendWebhookDeliveryImmediate(deliveryId).catch(err => {
        logError(`Immediate webhook delivery failed for ${deliveryId}`, err)
      })
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
    record.id,
    'FeedingRecord'
  )
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
    newRecord.id,
    'FeedingRecord'
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
    record.id,
    'FeedingRecord'
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
    record.id,
    'HealthRecord'
  )
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
    newRecord.id,
    'HealthRecord'
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
    record.id,
    'HealthRecord'
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
    record.id,
    'Memo'
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
    newRecord.id,
    'Memo'
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
    record.id,
    'Memo'
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
    deletedUser.id,
    'User'
  )
}
