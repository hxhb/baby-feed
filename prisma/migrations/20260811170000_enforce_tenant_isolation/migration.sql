-- Enforce tenant ownership at the database layer. Rows with inconsistent
-- historical ownership are omitted while rebuilding the affected tables.
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;

CREATE UNIQUE INDEX "Baby_id_createdBy_key" ON "Baby"("id", "createdBy");
CREATE UNIQUE INDEX "WebhookEndpoint_id_userId_key" ON "WebhookEndpoint"("id", "userId");
CREATE UNIQUE INDEX "WebhookEvent_id_userId_key" ON "WebhookEvent"("id", "userId");

CREATE TABLE "new_FeedingRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "babyId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "leftBreastDuration" INTEGER,
    "rightBreastDuration" INTEGER,
    "breastMilkAmount" REAL,
    "formulaAmount" REAL,
    "solidFoodName" TEXT,
    "solidFoodAmount" TEXT,
    "adGiven" BOOLEAN,
    "startTime" DATETIME NOT NULL,
    "endTime" DATETIME,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "createdBy" TEXT NOT NULL,
    CONSTRAINT "FeedingRecord_babyId_createdBy_fkey" FOREIGN KEY ("babyId", "createdBy") REFERENCES "Baby" ("id", "createdBy") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "FeedingRecord_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_FeedingRecord" ("adGiven", "babyId", "breastMilkAmount", "createdAt", "createdBy", "endTime", "formulaAmount", "id", "leftBreastDuration", "notes", "rightBreastDuration", "solidFoodAmount", "solidFoodName", "startTime", "type", "updatedAt")
SELECT r."adGiven", r."babyId", r."breastMilkAmount", r."createdAt", r."createdBy", r."endTime", r."formulaAmount", r."id", r."leftBreastDuration", r."notes", r."rightBreastDuration", r."solidFoodAmount", r."solidFoodName", r."startTime", r."type", r."updatedAt"
FROM "FeedingRecord" r
JOIN "Baby" b ON b."id" = r."babyId" AND b."createdBy" = r."createdBy"
JOIN "User" u ON u."id" = r."createdBy";
DROP TABLE "FeedingRecord";
ALTER TABLE "new_FeedingRecord" RENAME TO "FeedingRecord";
CREATE INDEX "FeedingRecord_createdBy_babyId_startTime_idx" ON "FeedingRecord"("createdBy", "babyId", "startTime");
CREATE INDEX "FeedingRecord_babyId_startTime_idx" ON "FeedingRecord"("babyId", "startTime");

CREATE TABLE "new_HealthRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "babyId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "weight" REAL,
    "height" REAL,
    "temperature" REAL,
    "medicationName" TEXT,
    "medicationDose" TEXT,
    "vaccineName" TEXT,
    "vaccineManufacturer" TEXT,
    "vaccineDoseNumber" INTEGER,
    "vaccineTotalDoses" INTEGER,
    "diaperType" TEXT,
    "diaperStatus" TEXT,
    "adGiven" BOOLEAN,
    "vitaminDGiven" BOOLEAN,
    "customName" TEXT,
    "sleepStartTime" DATETIME,
    "sleepEndTime" DATETIME,
    "sleepQuality" TEXT,
    "recordedAt" DATETIME NOT NULL,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "createdBy" TEXT NOT NULL,
    CONSTRAINT "HealthRecord_babyId_createdBy_fkey" FOREIGN KEY ("babyId", "createdBy") REFERENCES "Baby" ("id", "createdBy") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "HealthRecord_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_HealthRecord" ("adGiven", "babyId", "createdAt", "createdBy", "customName", "diaperStatus", "diaperType", "height", "id", "medicationDose", "medicationName", "notes", "recordedAt", "sleepEndTime", "sleepQuality", "sleepStartTime", "temperature", "type", "updatedAt", "vaccineDoseNumber", "vaccineManufacturer", "vaccineName", "vaccineTotalDoses", "vitaminDGiven", "weight")
SELECT r."adGiven", r."babyId", r."createdAt", r."createdBy", r."customName", r."diaperStatus", r."diaperType", r."height", r."id", r."medicationDose", r."medicationName", r."notes", r."recordedAt", r."sleepEndTime", r."sleepQuality", r."sleepStartTime", r."temperature", r."type", r."updatedAt", r."vaccineDoseNumber", r."vaccineManufacturer", r."vaccineName", r."vaccineTotalDoses", r."vitaminDGiven", r."weight"
FROM "HealthRecord" r
JOIN "Baby" b ON b."id" = r."babyId" AND b."createdBy" = r."createdBy"
JOIN "User" u ON u."id" = r."createdBy";
DROP TABLE "HealthRecord";
ALTER TABLE "new_HealthRecord" RENAME TO "HealthRecord";
CREATE INDEX "HealthRecord_createdBy_babyId_recordedAt_idx" ON "HealthRecord"("createdBy", "babyId", "recordedAt");
CREATE INDEX "HealthRecord_babyId_type_recordedAt_idx" ON "HealthRecord"("babyId", "type", "recordedAt");
CREATE UNIQUE INDEX "HealthRecord_id_babyId_key" ON "HealthRecord"("id", "babyId");

CREATE TABLE "new_ToothEruption" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "healthRecordId" TEXT NOT NULL,
    "babyId" TEXT NOT NULL,
    "toothCode" TEXT NOT NULL,
    CONSTRAINT "ToothEruption_healthRecordId_babyId_fkey" FOREIGN KEY ("healthRecordId", "babyId") REFERENCES "HealthRecord" ("id", "babyId") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ToothEruption_babyId_fkey" FOREIGN KEY ("babyId") REFERENCES "Baby" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_ToothEruption" ("babyId", "healthRecordId", "id", "toothCode")
SELECT t."babyId", t."healthRecordId", t."id", t."toothCode"
FROM "ToothEruption" t
JOIN "HealthRecord" h ON h."id" = t."healthRecordId" AND h."babyId" = t."babyId";
DROP TABLE "ToothEruption";
ALTER TABLE "new_ToothEruption" RENAME TO "ToothEruption";
CREATE INDEX "ToothEruption_healthRecordId_idx" ON "ToothEruption"("healthRecordId");
CREATE INDEX "ToothEruption_babyId_idx" ON "ToothEruption"("babyId");
CREATE UNIQUE INDEX "ToothEruption_babyId_toothCode_key" ON "ToothEruption"("babyId", "toothCode");

CREATE TABLE "new_Memo" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "babyId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT,
    "scheduledAt" DATETIME NOT NULL,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "completedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "createdBy" TEXT NOT NULL,
    CONSTRAINT "Memo_babyId_createdBy_fkey" FOREIGN KEY ("babyId", "createdBy") REFERENCES "Baby" ("id", "createdBy") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Memo_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Memo" ("babyId", "completed", "completedAt", "content", "createdAt", "createdBy", "id", "scheduledAt", "title", "updatedAt")
SELECT r."babyId", r."completed", r."completedAt", r."content", r."createdAt", r."createdBy", r."id", r."scheduledAt", r."title", r."updatedAt"
FROM "Memo" r
JOIN "Baby" b ON b."id" = r."babyId" AND b."createdBy" = r."createdBy"
JOIN "User" u ON u."id" = r."createdBy";
DROP TABLE "Memo";
ALTER TABLE "new_Memo" RENAME TO "Memo";
CREATE INDEX "Memo_createdBy_babyId_scheduledAt_idx" ON "Memo"("createdBy", "babyId", "scheduledAt");
CREATE INDEX "Memo_babyId_completed_scheduledAt_idx" ON "Memo"("babyId", "completed", "scheduledAt");

CREATE TABLE "new_ReminderRule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "babyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "triggerType" TEXT NOT NULL,
    "triggerConfig" TEXT NOT NULL,
    "activeSchedule" TEXT,
    "advanceMinutes" INTEGER NOT NULL DEFAULT 0,
    "notifyTitle" TEXT NOT NULL,
    "notifyBody" TEXT,
    "sourceKey" TEXT,
    "startsAt" DATETIME,
    "expiresAt" DATETIME,
    "lastFiredAt" DATETIME,
    "nextCheckAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ReminderRule_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ReminderRule_babyId_userId_fkey" FOREIGN KEY ("babyId", "userId") REFERENCES "Baby" ("id", "createdBy") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_ReminderRule" ("activeSchedule", "advanceMinutes", "babyId", "createdAt", "enabled", "expiresAt", "id", "lastFiredAt", "name", "nextCheckAt", "notifyBody", "notifyTitle", "sourceKey", "startsAt", "triggerConfig", "triggerType", "updatedAt", "userId")
SELECT r."activeSchedule", r."advanceMinutes", r."babyId", r."createdAt", r."enabled", r."expiresAt", r."id", r."lastFiredAt", r."name", r."nextCheckAt", r."notifyBody", r."notifyTitle", r."sourceKey", r."startsAt", r."triggerConfig", r."triggerType", r."updatedAt", r."userId"
FROM "ReminderRule" r
JOIN "Baby" b ON b."id" = r."babyId" AND b."createdBy" = r."userId"
JOIN "User" u ON u."id" = r."userId";
DROP TABLE "ReminderRule";
ALTER TABLE "new_ReminderRule" RENAME TO "ReminderRule";
CREATE INDEX "ReminderRule_userId_enabled_idx" ON "ReminderRule"("userId", "enabled");
CREATE INDEX "ReminderRule_babyId_idx" ON "ReminderRule"("babyId");
CREATE INDEX "ReminderRule_enabled_nextCheckAt_idx" ON "ReminderRule"("enabled", "nextCheckAt");
CREATE UNIQUE INDEX "ReminderRule_id_userId_key" ON "ReminderRule"("id", "userId");
CREATE UNIQUE INDEX "ReminderRule_babyId_sourceKey_key" ON "ReminderRule"("babyId", "sourceKey");

CREATE TABLE "new_ReminderExecution" (
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
    CONSTRAINT "ReminderExecution_ruleId_userId_fkey" FOREIGN KEY ("ruleId", "userId") REFERENCES "ReminderRule" ("id", "userId") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ReminderExecution_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_ReminderExecution" ("archivedAt", "body", "context", "createdAt", "dispatchedAt", "errorMessage", "evaluatedAt", "eventId", "fireKey", "id", "ruleId", "status", "title", "updatedAt", "userId")
SELECT e."archivedAt", e."body", e."context", e."createdAt", e."dispatchedAt", e."errorMessage", e."evaluatedAt", e."eventId", e."fireKey", e."id", e."ruleId", e."status", e."title", e."updatedAt", e."userId"
FROM "ReminderExecution" e
JOIN "ReminderRule" r ON r."id" = e."ruleId" AND r."userId" = e."userId"
JOIN "User" u ON u."id" = e."userId";
DROP TABLE "ReminderExecution";
ALTER TABLE "new_ReminderExecution" RENAME TO "ReminderExecution";
CREATE UNIQUE INDEX "ReminderExecution_fireKey_key" ON "ReminderExecution"("fireKey");
CREATE INDEX "ReminderExecution_ruleId_evaluatedAt_idx" ON "ReminderExecution"("ruleId", "evaluatedAt");
CREATE INDEX "ReminderExecution_userId_evaluatedAt_idx" ON "ReminderExecution"("userId", "evaluatedAt");
CREATE INDEX "ReminderExecution_status_createdAt_idx" ON "ReminderExecution"("status", "createdAt");

CREATE TABLE "new_WebhookDelivery" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
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
    CONSTRAINT "WebhookDelivery_eventId_userId_fkey" FOREIGN KEY ("eventId", "userId") REFERENCES "WebhookEvent" ("id", "userId") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "WebhookDelivery_endpointId_userId_fkey" FOREIGN KEY ("endpointId", "userId") REFERENCES "WebhookEndpoint" ("id", "userId") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_WebhookDelivery" ("attemptNumber", "createdAt", "endpointId", "errorMessage", "eventId", "httpStatus", "id", "leaseToken", "leaseUntil", "nextRetryAt", "sentAt", "status", "updatedAt", "userId")
SELECT d."attemptNumber", d."createdAt", d."endpointId", d."errorMessage", d."eventId", d."httpStatus", d."id", d."leaseToken", d."leaseUntil", d."nextRetryAt", d."sentAt", d."status", d."updatedAt", e."userId"
FROM "WebhookDelivery" d
JOIN "WebhookEvent" e ON e."id" = d."eventId"
JOIN "WebhookEndpoint" p ON p."id" = d."endpointId" AND p."userId" = e."userId";
DROP TABLE "WebhookDelivery";
ALTER TABLE "new_WebhookDelivery" RENAME TO "WebhookDelivery";
CREATE INDEX "WebhookDelivery_userId_status_nextRetryAt_idx" ON "WebhookDelivery"("userId", "status", "nextRetryAt");
CREATE INDEX "WebhookDelivery_status_nextRetryAt_idx" ON "WebhookDelivery"("status", "nextRetryAt");
CREATE INDEX "WebhookDelivery_endpointId_createdAt_idx" ON "WebhookDelivery"("endpointId", "createdAt");
CREATE UNIQUE INDEX "WebhookDelivery_eventId_endpointId_key" ON "WebhookDelivery"("eventId", "endpointId");

PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
