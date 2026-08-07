-- Add a stable source key for internally managed reminder rules.
ALTER TABLE "ReminderRule" ADD COLUMN "sourceKey" TEXT;

-- New and edited endpoints get a normalized unique key. Existing rows remain
-- NULL so installations that already contain duplicate URLs can still migrate.
ALTER TABLE "WebhookEndpoint" ADD COLUMN "dedupeKey" TEXT;
CREATE UNIQUE INDEX "WebhookEndpoint_dedupeKey_key" ON "WebhookEndpoint"("dedupeKey");

-- Persist reminder claims so multiple scheduler processes cannot emit the same slot.
CREATE TABLE "ReminderExecution" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ruleId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "fireKey" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'CLAIMED',
    "context" TEXT NOT NULL,
    "evaluatedAt" DATETIME NOT NULL,
    "title" TEXT,
    "body" TEXT,
    "eventId" TEXT,
    "dispatchedAt" DATETIME,
    "errorMessage" TEXT,
    "archivedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ReminderExecution_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "ReminderRule" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ReminderExecution_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "ReminderExecution_fireKey_key" ON "ReminderExecution"("fireKey");
CREATE INDEX "ReminderExecution_ruleId_evaluatedAt_idx" ON "ReminderExecution"("ruleId", "evaluatedAt");
CREATE INDEX "ReminderExecution_userId_evaluatedAt_idx" ON "ReminderExecution"("userId", "evaluatedAt");
CREATE INDEX "ReminderExecution_status_createdAt_idx" ON "ReminderExecution"("status", "createdAt");
CREATE UNIQUE INDEX "ReminderRule_babyId_sourceKey_key" ON "ReminderRule"("babyId", "sourceKey");

-- Durable webhook outbox and retry state.
CREATE TABLE "WebhookEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "payload" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "recordId" TEXT,
    "recordType" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "WebhookEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "WebhookDelivery" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "eventId" TEXT NOT NULL,
    "endpointId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "attemptNumber" INTEGER NOT NULL DEFAULT 0,
    "nextRetryAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leaseUntil" DATETIME,
    "leaseToken" TEXT,
    "httpStatus" INTEGER,
    "errorMessage" TEXT,
    "sentAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "WebhookDelivery_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "WebhookEvent" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "WebhookDelivery_endpointId_fkey" FOREIGN KEY ("endpointId") REFERENCES "WebhookEndpoint" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "WebhookEvent_userId_createdAt_idx" ON "WebhookEvent"("userId", "createdAt");
CREATE INDEX "WebhookEvent_status_createdAt_idx" ON "WebhookEvent"("status", "createdAt");
CREATE INDEX "WebhookEvent_recordId_idx" ON "WebhookEvent"("recordId");
CREATE UNIQUE INDEX "WebhookDelivery_eventId_endpointId_key" ON "WebhookDelivery"("eventId", "endpointId");
CREATE INDEX "WebhookDelivery_status_nextRetryAt_idx" ON "WebhookDelivery"("status", "nextRetryAt");
CREATE INDEX "WebhookDelivery_endpointId_createdAt_idx" ON "WebhookDelivery"("endpointId", "createdAt");
