import test from 'node:test'
import assert from 'node:assert/strict'
import { cp, mkdir, mkdtemp, readdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { createClient } from '@libsql/client'

test('durable reminder and webhook constraints arbitrate concurrent writers', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'baby-feed-concurrency-'))
  t.after(async () => rm(directory, { recursive: true, force: true }))

  const databasePath = join(directory, 'test.db')
  const databaseUrl = `file:${databasePath}`
  const migration = spawnSync(process.execPath, ['scripts/migrate.mjs'], {
    cwd: process.cwd(),
    env: { ...process.env, DATABASE_URL: databaseUrl },
    encoding: 'utf8',
  })
  assert.equal(migration.status, 0, `${migration.stdout}\n${migration.stderr}`)
  const repeatedMigration = spawnSync(process.execPath, ['scripts/migrate.mjs'], {
    cwd: process.cwd(),
    env: { ...process.env, DATABASE_URL: databaseUrl },
    encoding: 'utf8',
  })
  assert.equal(repeatedMigration.status, 0, `${repeatedMigration.stdout}\n${repeatedMigration.stderr}`)

  const first = createClient({ url: databaseUrl })
  const second = createClient({ url: databaseUrl })
  t.after(() => first.close())
  t.after(() => second.close())

  const now = '2026-08-07T09:01:17.476Z'
  await first.batch([
    {
      sql: 'INSERT INTO "User" ("id", "email", "name", "password", "role", "passwordVersion", "createdAt", "updatedAt") VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      args: ['user-1', 'test@example.com', 'Test', 'hash', 'USER', 0, now, now],
    },
    {
      sql: 'INSERT INTO "User" ("id", "email", "name", "password", "role", "passwordVersion", "createdAt", "updatedAt") VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      args: ['user-2', 'other@example.com', 'Other', 'hash', 'USER', 0, now, now],
    },
    {
      sql: 'INSERT INTO "Baby" ("id", "name", "birthDate", "gender", "createdAt", "updatedAt", "createdBy") VALUES (?, ?, ?, ?, ?, ?, ?)',
      args: ['baby-1', 'Baby', now, 'OTHER', now, now, 'user-1'],
    },
    {
      sql: 'INSERT INTO "Baby" ("id", "name", "birthDate", "gender", "createdAt", "updatedAt", "createdBy") VALUES (?, ?, ?, ?, ?, ?, ?)',
      args: ['baby-2', 'Other Baby', now, 'OTHER', now, now, 'user-2'],
    },
    {
      sql: 'INSERT INTO "ReminderRule" ("id", "userId", "babyId", "name", "enabled", "triggerType", "triggerConfig", "advanceMinutes", "notifyTitle", "createdAt", "updatedAt") VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      args: ['rule-1', 'user-1', 'baby-1', 'Feed', 1, 'interval', '{"sourceType":"feeding","intervalMinutes":180}', 0, 'Feed now', now, now],
    },
  ], 'write')

  await assert.rejects(() => first.execute({
    sql: 'INSERT INTO "FeedingRecord" ("id", "babyId", "type", "startTime", "createdAt", "updatedAt", "createdBy") VALUES (?, ?, ?, ?, ?, ?, ?)',
    args: ['feeding-cross-tenant', 'baby-2', 'FORMULA', now, now, now, 'user-1'],
  }))
  await assert.rejects(() => first.execute({
    sql: 'INSERT INTO "HealthRecord" ("id", "babyId", "type", "recordedAt", "createdAt", "updatedAt", "createdBy") VALUES (?, ?, ?, ?, ?, ?, ?)',
    args: ['health-cross-tenant', 'baby-2', 'WEIGHT', now, now, now, 'user-1'],
  }))
  await assert.rejects(() => first.execute({
    sql: 'INSERT INTO "Memo" ("id", "babyId", "title", "scheduledAt", "createdAt", "updatedAt", "createdBy") VALUES (?, ?, ?, ?, ?, ?, ?)',
    args: ['memo-cross-tenant', 'baby-2', 'Private', now, now, now, 'user-1'],
  }))
  await assert.rejects(() => first.execute({
    sql: 'INSERT INTO "ReminderRule" ("id", "userId", "babyId", "name", "enabled", "triggerType", "triggerConfig", "advanceMinutes", "notifyTitle", "createdAt", "updatedAt") VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    args: ['rule-cross-tenant', 'user-1', 'baby-2', 'Invalid', 1, 'interval', '{"sourceType":"feeding","intervalMinutes":180}', 0, 'Invalid', now, now],
  }))
  await assert.rejects(() => first.execute({
    sql: 'INSERT INTO "ReminderExecution" ("id", "ruleId", "userId", "fireKey", "status", "context", "evaluatedAt", "createdAt", "updatedAt") VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    args: ['execution-cross-tenant', 'rule-1', 'user-2', 'cross-tenant-fire', 'CLAIMED', '{}', now, now, now],
  }))

  await first.execute({
    sql: 'INSERT INTO "HealthRecord" ("id", "babyId", "type", "recordedAt", "createdAt", "updatedAt", "createdBy") VALUES (?, ?, ?, ?, ?, ?, ?)',
    args: ['health-1', 'baby-1', 'TOOTH_ERUPTION', now, now, now, 'user-1'],
  })
  await assert.rejects(() => first.execute({
    sql: 'INSERT INTO "ToothEruption" ("id", "healthRecordId", "babyId", "toothCode") VALUES (?, ?, ?, ?)',
    args: ['tooth-cross-baby', 'health-1', 'baby-2', '51'],
  }))

  const executionSql = 'INSERT INTO "ReminderExecution" ("id", "ruleId", "userId", "fireKey", "status", "context", "evaluatedAt", "createdAt", "updatedAt") VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
  const executionResults = await Promise.allSettled([
    first.execute({
      sql: executionSql,
      args: ['execution-1', 'rule-1', 'user-1', 'same-fire-key', 'CLAIMED', '{}', now, now, now],
    }),
    second.execute({
      sql: executionSql,
      args: ['execution-2', 'rule-1', 'user-1', 'same-fire-key', 'CLAIMED', '{}', now, now, now],
    }),
  ])
  assert.equal(executionResults.filter(result => result.status === 'fulfilled').length, 1)
  assert.equal(executionResults.filter(result => result.status === 'rejected').length, 1)

  const endpointSql = 'INSERT INTO "WebhookEndpoint" ("id", "userId", "url", "dedupeKey", "events", "secret", "active", "maxRetries", "retryDelay", "createdAt", "updatedAt") VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
  const endpointResults = await Promise.allSettled([
    first.execute({
      sql: endpointSql,
      args: ['endpoint-1', 'user-1', 'https://example.com/hook', 'same-endpoint-key', '["*"]', 'secret', 1, 5, 60, now, now],
    }),
    second.execute({
      sql: endpointSql,
      args: ['endpoint-2', 'user-1', 'https://example.com/hook', 'same-endpoint-key', '["*"]', 'secret', 1, 5, 60, now, now],
    }),
  ])
  assert.equal(endpointResults.filter(result => result.status === 'fulfilled').length, 1)
  assert.equal(endpointResults.filter(result => result.status === 'rejected').length, 1)

  const endpoint = await first.execute('SELECT "id" FROM "WebhookEndpoint" LIMIT 1')
  const endpointId = String(endpoint.rows[0].id)
  await first.execute({
    sql: endpointSql,
    args: ['endpoint-user-2', 'user-2', 'https://example.com/other-hook', 'other-endpoint-key', '["*"]', 'secret', 1, 5, 60, now, now],
  })
  await first.batch([
    {
      sql: 'INSERT INTO "WebhookEvent" ("id", "userId", "type", "payload", "summary", "status", "createdAt", "updatedAt") VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      args: ['event-1', 'user-1', 'reminder.fired', '{}', 'test', 'PENDING', now, now],
    },
    {
      sql: 'INSERT INTO "WebhookDelivery" ("id", "userId", "eventId", "endpointId", "status", "attemptNumber", "nextRetryAt", "createdAt", "updatedAt") VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      args: ['delivery-1', 'user-1', 'event-1', endpointId, 'PENDING', 0, now, now, now],
    },
  ], 'write')
  await assert.rejects(() => first.execute({
    sql: 'INSERT INTO "WebhookDelivery" ("id", "userId", "eventId", "endpointId", "status", "attemptNumber", "nextRetryAt", "createdAt", "updatedAt") VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    args: ['delivery-cross-tenant', 'user-1', 'event-1', 'endpoint-user-2', 'PENDING', 0, now, now, now],
  }))

  const claimSql = 'UPDATE "WebhookDelivery" SET "status" = ?, "leaseUntil" = ?, "leaseToken" = ?, "updatedAt" = ? WHERE "id" = ? AND "status" = ? AND "nextRetryAt" <= ?'
  const claims = await Promise.all([
    first.execute({ sql: claimSql, args: ['PROCESSING', '2026-08-07T09:02:17.476Z', 'lease-1', now, 'delivery-1', 'PENDING', now] }),
    second.execute({ sql: claimSql, args: ['PROCESSING', '2026-08-07T09:02:17.476Z', 'lease-2', now, 'delivery-1', 'PENDING', now] }),
  ])
  assert.deepEqual(claims.map(result => result.rowsAffected).sort(), [0, 1])

  const claimedDelivery = await first.execute('SELECT "leaseToken" FROM "WebhookDelivery" WHERE "id" = \'delivery-1\'')
  const winningToken = String(claimedDelivery.rows[0].leaseToken)
  const losingToken = winningToken === 'lease-1' ? 'lease-2' : 'lease-1'
  const staleFinalize = await second.execute({
    sql: 'UPDATE "WebhookDelivery" SET "status" = ? WHERE "id" = ? AND "status" = ? AND "leaseToken" = ?',
    args: ['SUCCESS', 'delivery-1', 'PROCESSING', losingToken],
  })
  assert.equal(staleFinalize.rowsAffected, 0)

  const inviteValue = JSON.stringify({
    createdBy: 'admin',
    createdAt: now,
    usedBy: null,
    usedAt: null,
  })
  await first.execute({
    sql: 'INSERT INTO "SiteSettings" ("id", "key", "value") VALUES (?, ?, ?)',
    args: ['invite-test', 'invite:one-time', inviteValue],
  })
  const consumedValue = JSON.stringify({
    createdBy: 'admin',
    createdAt: now,
    usedBy: 'winner',
    usedAt: now,
  })
  const inviteClaims = await Promise.all([
    first.execute({
      sql: 'UPDATE "SiteSettings" SET "value" = ? WHERE "key" = ? AND "value" = ?',
      args: [consumedValue, 'invite:one-time', inviteValue],
    }),
    second.execute({
      sql: 'UPDATE "SiteSettings" SET "value" = ? WHERE "key" = ? AND "value" = ?',
      args: [consumedValue, 'invite:one-time', inviteValue],
    }),
  ])
  assert.deepEqual(inviteClaims.map(result => result.rowsAffected).sort(), [0, 1])
})

test('tenant isolation migration preserves valid rows and removes inconsistent ownership', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'baby-feed-isolation-migration-'))
  t.after(async () => rm(directory, { recursive: true, force: true }))

  const migrationName = '20260811170000_enforce_tenant_isolation'
  const sourceMigrations = join(process.cwd(), 'prisma', 'migrations')
  const temporaryMigrations = join(directory, 'prisma', 'migrations')
  await mkdir(temporaryMigrations, { recursive: true })
  const migrationDirectories = await readdir(sourceMigrations, { withFileTypes: true })
  for (const entry of migrationDirectories) {
    if (!entry.isDirectory() || entry.name === migrationName) continue
    await cp(
      join(sourceMigrations, entry.name),
      join(temporaryMigrations, entry.name),
      { recursive: true },
    )
  }

  const databaseUrl = `file:${join(directory, 'upgrade.db')}`
  const migrateScript = join(process.cwd(), 'scripts', 'migrate.mjs')
  const migrate = () => spawnSync(process.execPath, [migrateScript], {
    cwd: directory,
    env: { ...process.env, DATABASE_URL: databaseUrl },
    encoding: 'utf8',
  })
  const initialMigration = migrate()
  assert.equal(initialMigration.status, 0, `${initialMigration.stdout}\n${initialMigration.stderr}`)

  const client = createClient({ url: databaseUrl })
  t.after(() => client.close())
  const now = '2026-08-11T08:00:00.000Z'
  await client.batch([
    {
      sql: 'INSERT INTO "User" ("id", "email", "name", "password", "role", "passwordVersion", "createdAt", "updatedAt") VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      args: ['user-1', 'upgrade-one@example.com', 'One', 'hash', 'USER', 0, now, now],
    },
    {
      sql: 'INSERT INTO "User" ("id", "email", "name", "password", "role", "passwordVersion", "createdAt", "updatedAt") VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      args: ['user-2', 'upgrade-two@example.com', 'Two', 'hash', 'USER', 0, now, now],
    },
    {
      sql: 'INSERT INTO "Baby" ("id", "name", "birthDate", "gender", "createdAt", "updatedAt", "createdBy") VALUES (?, ?, ?, ?, ?, ?, ?)',
      args: ['baby-1', 'One Baby', now, 'FEMALE', now, now, 'user-1'],
    },
    {
      sql: 'INSERT INTO "Baby" ("id", "name", "birthDate", "gender", "createdAt", "updatedAt", "createdBy") VALUES (?, ?, ?, ?, ?, ?, ?)',
      args: ['baby-2', 'Two Baby', now, 'MALE', now, now, 'user-2'],
    },
    {
      sql: 'INSERT INTO "FeedingRecord" ("id", "babyId", "type", "startTime", "createdAt", "updatedAt", "createdBy") VALUES (?, ?, ?, ?, ?, ?, ?)',
      args: ['feeding-valid', 'baby-1', 'FORMULA', now, now, now, 'user-1'],
    },
    {
      sql: 'INSERT INTO "FeedingRecord" ("id", "babyId", "type", "startTime", "createdAt", "updatedAt", "createdBy") VALUES (?, ?, ?, ?, ?, ?, ?)',
      args: ['feeding-invalid', 'baby-2', 'FORMULA', now, now, now, 'user-1'],
    },
    {
      sql: 'INSERT INTO "HealthRecord" ("id", "babyId", "type", "recordedAt", "createdAt", "updatedAt", "createdBy") VALUES (?, ?, ?, ?, ?, ?, ?)',
      args: ['health-valid', 'baby-1', 'TOOTH_ERUPTION', now, now, now, 'user-1'],
    },
    {
      sql: 'INSERT INTO "HealthRecord" ("id", "babyId", "type", "recordedAt", "createdAt", "updatedAt", "createdBy") VALUES (?, ?, ?, ?, ?, ?, ?)',
      args: ['health-invalid', 'baby-2', 'WEIGHT', now, now, now, 'user-1'],
    },
    {
      sql: 'INSERT INTO "ToothEruption" ("id", "healthRecordId", "babyId", "toothCode") VALUES (?, ?, ?, ?)',
      args: ['tooth-valid', 'health-valid', 'baby-1', '51'],
    },
    {
      sql: 'INSERT INTO "ToothEruption" ("id", "healthRecordId", "babyId", "toothCode") VALUES (?, ?, ?, ?)',
      args: ['tooth-invalid', 'health-valid', 'baby-2', '61'],
    },
    {
      sql: 'INSERT INTO "Memo" ("id", "babyId", "title", "scheduledAt", "createdAt", "updatedAt", "createdBy") VALUES (?, ?, ?, ?, ?, ?, ?)',
      args: ['memo-valid', 'baby-1', 'Valid', now, now, now, 'user-1'],
    },
    {
      sql: 'INSERT INTO "Memo" ("id", "babyId", "title", "scheduledAt", "createdAt", "updatedAt", "createdBy") VALUES (?, ?, ?, ?, ?, ?, ?)',
      args: ['memo-invalid', 'baby-2', 'Invalid', now, now, now, 'user-1'],
    },
    {
      sql: 'INSERT INTO "ReminderRule" ("id", "userId", "babyId", "name", "enabled", "triggerType", "triggerConfig", "advanceMinutes", "notifyTitle", "createdAt", "updatedAt") VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      args: ['rule-valid', 'user-1', 'baby-1', 'Valid', 1, 'interval', '{}', 0, 'Valid', now, now],
    },
    {
      sql: 'INSERT INTO "ReminderRule" ("id", "userId", "babyId", "name", "enabled", "triggerType", "triggerConfig", "advanceMinutes", "notifyTitle", "createdAt", "updatedAt") VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      args: ['rule-invalid', 'user-1', 'baby-2', 'Invalid', 1, 'interval', '{}', 0, 'Invalid', now, now],
    },
    {
      sql: 'INSERT INTO "ReminderExecution" ("id", "ruleId", "userId", "fireKey", "status", "context", "evaluatedAt", "createdAt", "updatedAt") VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      args: ['execution-valid', 'rule-valid', 'user-1', 'fire-valid', 'CLAIMED', '{}', now, now, now],
    },
    {
      sql: 'INSERT INTO "ReminderExecution" ("id", "ruleId", "userId", "fireKey", "status", "context", "evaluatedAt", "createdAt", "updatedAt") VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      args: ['execution-invalid', 'rule-valid', 'user-2', 'fire-invalid', 'CLAIMED', '{}', now, now, now],
    },
    {
      sql: 'INSERT INTO "WebhookEndpoint" ("id", "userId", "url", "events", "secret", "active", "maxRetries", "retryDelay", "createdAt", "updatedAt") VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      args: ['endpoint-1', 'user-1', 'https://example.com/one', '["*"]', 'secret', 1, 5, 60, now, now],
    },
    {
      sql: 'INSERT INTO "WebhookEndpoint" ("id", "userId", "url", "events", "secret", "active", "maxRetries", "retryDelay", "createdAt", "updatedAt") VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      args: ['endpoint-2', 'user-2', 'https://example.com/two', '["*"]', 'secret', 1, 5, 60, now, now],
    },
    {
      sql: 'INSERT INTO "WebhookEvent" ("id", "userId", "type", "payload", "summary", "status", "createdAt", "updatedAt") VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      args: ['event-1', 'user-1', 'feeding.created', '{}', 'Event', 'PENDING', now, now],
    },
    {
      sql: 'INSERT INTO "WebhookDelivery" ("id", "eventId", "endpointId", "status", "attemptNumber", "nextRetryAt", "createdAt", "updatedAt") VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      args: ['delivery-valid', 'event-1', 'endpoint-1', 'PENDING', 0, now, now, now],
    },
    {
      sql: 'INSERT INTO "WebhookDelivery" ("id", "eventId", "endpointId", "status", "attemptNumber", "nextRetryAt", "createdAt", "updatedAt") VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      args: ['delivery-invalid', 'event-1', 'endpoint-2', 'PENDING', 0, now, now, now],
    },
  ], 'write')

  await cp(
    join(sourceMigrations, migrationName),
    join(temporaryMigrations, migrationName),
    { recursive: true },
  )
  const isolationMigration = migrate()
  assert.equal(isolationMigration.status, 0, `${isolationMigration.stdout}\n${isolationMigration.stderr}`)

  const expectedRows = [
    ['FeedingRecord', 'feeding-valid'],
    ['HealthRecord', 'health-valid'],
    ['ToothEruption', 'tooth-valid'],
    ['Memo', 'memo-valid'],
    ['ReminderRule', 'rule-valid'],
    ['ReminderExecution', 'execution-valid'],
    ['WebhookDelivery', 'delivery-valid'],
  ]
  for (const [table, id] of expectedRows) {
    const rows = await client.execute(`SELECT "id" FROM "${table}"`)
    assert.deepEqual(rows.rows.map(row => String(row.id)), [id])
  }
  const delivery = await client.execute('SELECT "userId" FROM "WebhookDelivery" WHERE "id" = \'delivery-valid\'')
  assert.equal(delivery.rows[0].userId, 'user-1')
  const foreignKeyCheck = await client.execute('PRAGMA foreign_key_check')
  assert.equal(foreignKeyCheck.rows.length, 0)
})
