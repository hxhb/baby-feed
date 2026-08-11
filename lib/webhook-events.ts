/**
 * Webhook Event Types and Payload Definitions
 * 
 * All webhook payloads include:
 * - id: Event ID from database
 * - type: Event type (e.g., "feeding.created")
 * - timestamp: ISO 8601 datetime when event occurred
 * - data: Event-specific data
 * - userId: User ID who initiated the action
 */

export const WEBHOOK_EVENTS = {
  // Feeding Record Events
  FEEDING_CREATED: 'feeding.created',
  FEEDING_UPDATED: 'feeding.updated',
  FEEDING_DELETED: 'feeding.deleted',

  // Health Record Events
  HEALTH_CREATED: 'health.created',
  HEALTH_UPDATED: 'health.updated',
  HEALTH_DELETED: 'health.deleted',

  // Memo Events
  MEMO_CREATED: 'memo.created',
  MEMO_UPDATED: 'memo.updated',
  MEMO_DELETED: 'memo.deleted',

  // User Events
  USER_DELETED: 'user.deleted',

  // Reminder Events
  REMINDER_FIRED: 'reminder.fired',
} as const

export type WebhookEventType = typeof WEBHOOK_EVENTS[keyof typeof WEBHOOK_EVENTS]

/**
 * Base webhook event payload structure
 */
export interface WebhookEventPayload {
  id: string
  type: WebhookEventType
  timestamp: string // ISO 8601
  userId: string
  data: Record<string, unknown>
}

/**
 * Feeding Record Created Event
 */
export interface FeedingCreatedEventPayload extends WebhookEventPayload {
  type: typeof WEBHOOK_EVENTS.FEEDING_CREATED
  data: {
    recordId: string
    babyId: string
    type: string // 'BREAST_MILK' | 'BREAST_MILK_BOTTLE' | 'FORMULA' | 'SOLID_FOOD'
    leftBreastDuration?: number
    rightBreastDuration?: number
    breastMilkAmount?: number
    formulaAmount?: number
    solidFoodName?: string
    solidFoodAmount?: string
    adGiven?: boolean
    startTime: string // ISO 8601
    endTime?: string // ISO 8601
    notes?: string
    createdAt: string // ISO 8601
    baby: {
      id: string
      name: string
      birthDate: string
      gender: string
    }
  }
}

/**
 * Feeding Record Updated Event
 */
export interface FeedingUpdatedEventPayload extends WebhookEventPayload {
  type: typeof WEBHOOK_EVENTS.FEEDING_UPDATED
  data: {
    recordId: string
    babyId: string
    type: string
    changes: {
      [key: string]: { old: unknown; new: unknown }
    }
    // All current fields after update
    leftBreastDuration?: number
    rightBreastDuration?: number
    breastMilkAmount?: number
    formulaAmount?: number
    solidFoodName?: string
    solidFoodAmount?: string
    adGiven?: boolean
    startTime: string
    endTime?: string
    notes?: string
    updatedAt: string // ISO 8601
    baby: {
      id: string
      name: string
    }
  }
}

/**
 * Feeding Record Deleted Event
 */
export interface FeedingDeletedEventPayload extends WebhookEventPayload {
  type: typeof WEBHOOK_EVENTS.FEEDING_DELETED
  data: {
    recordId: string
    babyId: string
    type: string
    startTime: string
    endTime?: string
    deletedAt: string // ISO 8601
  }
}

/**
 * Health Record Created Event
 */
export interface HealthCreatedEventPayload extends WebhookEventPayload {
  type: typeof WEBHOOK_EVENTS.HEALTH_CREATED
  data: {
    recordId: string
    babyId: string
    type: string // 'WEIGHT' | 'HEIGHT' | 'TEMPERATURE' | 'MEDICATION' | 'VACCINE' | 'DIAPER' | 'AD_VITAMIN' | 'SLEEP' | 'TOOTH_ERUPTION' | 'CUSTOM'
    weight?: number
    height?: number
    temperature?: number
    medicationName?: string
    medicationDose?: string
    vaccineName?: string
    vaccineManufacturer?: string
    vaccineDoseNumber?: number
    vaccineTotalDoses?: number
    diaperType?: string
    diaperStatus?: string
    adGiven?: boolean
    vitaminDGiven?: boolean
    customName?: string
    sleepStartTime?: string
    sleepEndTime?: string
    sleepQuality?: string
    toothCodes?: string[]
    recordedAt: string
    notes?: string
    createdAt: string
    baby: {
      id: string
      name: string
      birthDate: string
      gender: string
    }
  }
}

/**
 * Health Record Updated Event
 */
export interface HealthUpdatedEventPayload extends WebhookEventPayload {
  type: typeof WEBHOOK_EVENTS.HEALTH_UPDATED
  data: {
    recordId: string
    babyId: string
    type: string
    changes: {
      [key: string]: { old: unknown; new: unknown }
    }
    // All current fields after update
    weight?: number
    height?: number
    temperature?: number
    medicationName?: string
    medicationDose?: string
    vaccineName?: string
    vaccineManufacturer?: string
    vaccineDoseNumber?: number
    vaccineTotalDoses?: number
    diaperType?: string
    diaperStatus?: string
    adGiven?: boolean
    vitaminDGiven?: boolean
    customName?: string
    sleepStartTime?: string
    sleepEndTime?: string
    sleepQuality?: string
    toothCodes?: string[]
    recordedAt: string
    notes?: string
    updatedAt: string
    baby: {
      id: string
      name: string
    }
  }
}

/**
 * Health Record Deleted Event
 */
export interface HealthDeletedEventPayload extends WebhookEventPayload {
  type: typeof WEBHOOK_EVENTS.HEALTH_DELETED
  data: {
    recordId: string
    babyId: string
    type: string
    toothCodes?: string[]
    recordedAt: string
    deletedAt: string
  }
}

/**
 * User Deleted Event (admin action)
 */
export interface UserDeletedEventPayload extends WebhookEventPayload {
  type: typeof WEBHOOK_EVENTS.USER_DELETED
  data: {
    userId: string
    email: string
    name: string
    babiesCount: number
    feedingRecordsCount: number
    healthRecordsCount: number
    deletedAt: string
  }
}

/**
 * Memo Created Event
 */
export interface MemoCreatedEventPayload extends WebhookEventPayload {
  type: typeof WEBHOOK_EVENTS.MEMO_CREATED
  data: {
    recordId: string
    babyId: string
    title: string
    content: string | null
    scheduledAt: string
    completed: boolean
    createdAt: string
    baby: { id: string; name: string }
  }
}

/**
 * Memo Updated Event
 */
export interface MemoUpdatedEventPayload extends WebhookEventPayload {
  type: typeof WEBHOOK_EVENTS.MEMO_UPDATED
  data: {
    recordId: string
    babyId: string
    title: string
    content: string | null
    scheduledAt: string
    completed: boolean
    completedAt: string | null
    changes: { [key: string]: { old: unknown; new: unknown } }
    updatedAt: string
    baby: { id: string; name: string }
  }
}

/**
 * Memo Deleted Event
 */
export interface MemoDeletedEventPayload extends WebhookEventPayload {
  type: typeof WEBHOOK_EVENTS.MEMO_DELETED
  data: {
    recordId: string
    babyId: string
    title: string
    deletedAt: string
  }
}

/**
 * Reminder Fired Event
 */
export interface ReminderFiredEventPayload extends WebhookEventPayload {
  type: typeof WEBHOOK_EVENTS.REMINDER_FIRED
  data: {
    ruleId: string
    ruleName: string
    triggerType: string
    babyId: string
    babyName: string
    title: string
    body: string | null
    context: Record<string, unknown>
  }
}

/**
 * Union of all webhook payloads
 */
export type AnyWebhookPayload =
  | FeedingCreatedEventPayload
  | FeedingUpdatedEventPayload
  | FeedingDeletedEventPayload
  | HealthCreatedEventPayload
  | HealthUpdatedEventPayload
  | HealthDeletedEventPayload
  | MemoCreatedEventPayload
  | MemoUpdatedEventPayload
  | MemoDeletedEventPayload
  | UserDeletedEventPayload
  | ReminderFiredEventPayload

/**
 * Helper to validate event payload structure
 */
export function isValidWebhookPayload(payload: unknown): payload is AnyWebhookPayload {
  if (!payload || typeof payload !== 'object') return false
  const p = payload as Record<string, unknown>
  return (
    typeof p.id === 'string' &&
    typeof p.type === 'string' &&
    typeof p.timestamp === 'string' &&
    typeof p.userId === 'string' &&
    p.data != null && typeof p.data === 'object'
  )
}

/**
 * Get all event types that a webhook endpoint can subscribe to
 */
export function getAllEventTypes(): WebhookEventType[] {
  return Object.values(WEBHOOK_EVENTS)
}
