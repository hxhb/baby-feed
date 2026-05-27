/**
 * Activity Logger - Generic In-Memory Log Storage
 *
 * A singleton module that supports multiple log sources with source isolation.
 * Each source has independent storage, configurable limits, and 24h TTL.
 *
 * Features:
 * - Source isolation: each source (e.g., "api-key", "webhook") has its own config and storage
 * - Lazy cleanup: expired entries are purged on read/write, no background timers
 * - Memory-bounded: configurable maxEntries per source and maxPerGroup per group
 * - Never throws: all operations are wrapped in try-catch
 *
 * Design: process restart clears all logs (by design for self-hosted single-instance app).
 */

import { randomBytes } from 'crypto'

// ─── Types ──────────────────────────────────────────────────────────────────

export interface ActivityLogEntry {
  id: string           // Random short ID (8 chars hex)
  timestamp: number    // Date.now()
  source: string       // "api-key" | "webhook" | future sources
  userId: string       // Owner user ID (for access control)
  groupKey: string     // Grouping key (keyId for api-key, endpointId for webhook)
  groupLabel: string   // Human-readable group label (key name, endpoint URL)

  // Common fields
  status: 'success' | 'failed' | 'pending'
  summary: string      // Human-readable one-line summary

  // Source-specific metadata (flexible)
  meta: Record<string, unknown>
}

export interface LogSourceConfig {
  maxEntries: number     // Per-source global max
  maxPerGroup: number    // Per-group max
  ttlMs: number          // Time-to-live in milliseconds
}

interface LogSource {
  config: LogSourceConfig
  entries: ActivityLogEntry[]
}

export interface QueryOptions {
  groupKey?: string
  status?: string
  limit?: number
  offset?: number
}

export interface QueryResult {
  entries: ActivityLogEntry[]
  total: number
}

export interface LogStats {
  total: number
  byGroup: Record<string, number>
  oldestTimestamp: number | null
}

// ─── Default Config ─────────────────────────────────────────────────────────

const DEFAULT_CONFIG: LogSourceConfig = {
  maxEntries: 500,
  maxPerGroup: 100,
  ttlMs: 24 * 60 * 60 * 1000, // 24 hours
}

// ─── ActivityLogger Class ───────────────────────────────────────────────────

class ActivityLogger {
  private sources = new Map<string, LogSource>()

  /**
   * Register a new log source with its configuration.
   * If already registered, updates the config.
   */
  registerSource(name: string, config: Partial<LogSourceConfig> = {}): void {
    const existing = this.sources.get(name)
    if (existing) {
      existing.config = { ...DEFAULT_CONFIG, ...config }
    } else {
      this.sources.set(name, {
        config: { ...DEFAULT_CONFIG, ...config },
        entries: [],
      })
    }
  }

  /**
   * Record a new log entry.
   * Automatically generates id and timestamp.
   */
  record(entry: Omit<ActivityLogEntry, 'id' | 'timestamp'>): void {
    try {
      const source = this.getOrCreateSource(entry.source)
      const now = Date.now()

      const logEntry: ActivityLogEntry = {
        ...entry,
        id: randomBytes(4).toString('hex'),
        timestamp: now,
      }

      // Add new entry
      source.entries.push(logEntry)

      // Evict expired entries
      this.purgeExpired(source, now)

      // Enforce per-source max
      if (source.entries.length > source.config.maxEntries) {
        const excess = source.entries.length - source.config.maxEntries
        source.entries.splice(0, excess)
      }

      // Enforce per-group max
      this.enforceGroupLimit(source, entry.groupKey)
    } catch {
      // Silent failure — logging should never break the app
    }
  }

  /**
   * Query logs for a source, filtered by userId (required) and optional groupKey/status.
   * Returns entries in reverse chronological order (newest first).
   */
  query(sourceName: string, userId: string, options: QueryOptions = {}): QueryResult {
    try {
      const source = this.sources.get(sourceName)
      if (!source) return { entries: [], total: 0 }

      const now = Date.now()
      this.purgeExpired(source, now)

      const { groupKey, status, limit = 50, offset = 0 } = options

      // Filter by userId + optional filters
      let filtered = source.entries.filter(e => {
        if (e.userId !== userId) return false
        if (groupKey && e.groupKey !== groupKey) return false
        if (status && e.status !== status) return false
        return true
      })

      // Reverse for newest-first
      filtered = filtered.slice().reverse()

      const total = filtered.length
      const entries = filtered.slice(offset, offset + limit)

      return { entries, total }
    } catch {
      return { entries: [], total: 0 }
    }
  }

  /**
   * Clear logs for a source (all for user, or specific group).
   * Returns number of entries deleted.
   */
  clear(sourceName: string, userId: string, groupKey?: string): number {
    try {
      const source = this.sources.get(sourceName)
      if (!source) return 0

      const before = source.entries.length
      source.entries = source.entries.filter(e => {
        if (e.userId !== userId) return true // Keep other users' entries
        if (groupKey && e.groupKey !== groupKey) return true // Keep other groups
        return false // Remove this entry
      })

      return before - source.entries.length
    } catch {
      return 0
    }
  }

  /**
   * Get statistics for a source filtered by userId.
   */
  stats(sourceName: string, userId: string): LogStats {
    try {
      const source = this.sources.get(sourceName)
      if (!source) return { total: 0, byGroup: {}, oldestTimestamp: null }

      const now = Date.now()
      this.purgeExpired(source, now)

      const userEntries = source.entries.filter(e => e.userId === userId)
      const byGroup: Record<string, number> = {}
      let oldestTimestamp: number | null = null

      for (const entry of userEntries) {
        byGroup[entry.groupKey] = (byGroup[entry.groupKey] || 0) + 1
        if (oldestTimestamp === null || entry.timestamp < oldestTimestamp) {
          oldestTimestamp = entry.timestamp
        }
      }

      return { total: userEntries.length, byGroup, oldestTimestamp }
    } catch {
      return { total: 0, byGroup: {}, oldestTimestamp: null }
    }
  }

  // ─── Private Helpers ────────────────────────────────────────────────────

  private getOrCreateSource(name: string): LogSource {
    let source = this.sources.get(name)
    if (!source) {
      source = { config: { ...DEFAULT_CONFIG }, entries: [] }
      this.sources.set(name, source)
    }
    return source
  }

  private purgeExpired(source: LogSource, now: number): void {
    const cutoff = now - source.config.ttlMs
    // Since entries are appended chronologically, find first non-expired
    let firstValid = 0
    while (firstValid < source.entries.length && source.entries[firstValid].timestamp < cutoff) {
      firstValid++
    }
    if (firstValid > 0) {
      source.entries.splice(0, firstValid)
    }
  }

  private enforceGroupLimit(source: LogSource, groupKey: string): void {
    const groupEntries = source.entries.filter(e => e.groupKey === groupKey)
    if (groupEntries.length > source.config.maxPerGroup) {
      const excess = groupEntries.length - source.config.maxPerGroup
      // Remove oldest entries for this group
      let removed = 0
      source.entries = source.entries.filter(e => {
        if (e.groupKey === groupKey && removed < excess) {
          removed++
          return false
        }
        return true
      })
    }
  }
}

// ─── Singleton Instance ─────────────────────────────────────────────────────

// Use globalThis to ensure a single instance across all Next.js compilation
// contexts (instrumentation, route handlers, RSC). Without this, each webpack
// entry point creates its own ActivityLogger — writes go to one instance while
// reads come from another (always empty).
const globalForLogger = globalThis as unknown as { __activityLogger?: ActivityLogger }

export const activityLogger = globalForLogger.__activityLogger ??= (() => {
  const logger = new ActivityLogger()

  // Register default sources
  logger.registerSource('api-key', {
    maxEntries: 500,
    maxPerGroup: 100,
    ttlMs: 24 * 60 * 60 * 1000,
  })

  logger.registerSource('webhook', {
    maxEntries: 1000,
    maxPerGroup: 200,
    ttlMs: 24 * 60 * 60 * 1000,
  })

  logger.registerSource('reminder', {
    maxEntries: 1000,
    maxPerGroup: 200,
    ttlMs: 72 * 60 * 60 * 1000, // 72 hours
  })

  return logger
})()
