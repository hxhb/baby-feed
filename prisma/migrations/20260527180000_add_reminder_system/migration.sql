-- Add reminderSettings column to User table
ALTER TABLE "User" ADD COLUMN "reminderSettings" TEXT;

-- CreateTable: ReminderRule
CREATE TABLE "ReminderRule" (
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
    "startsAt" DATETIME,
    "expiresAt" DATETIME,
    "lastFiredAt" DATETIME,
    "nextCheckAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ReminderRule_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ReminderRule_babyId_fkey" FOREIGN KEY ("babyId") REFERENCES "Baby" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "ReminderRule_userId_enabled_idx" ON "ReminderRule"("userId", "enabled");
CREATE INDEX "ReminderRule_babyId_idx" ON "ReminderRule"("babyId");
CREATE INDEX "ReminderRule_enabled_nextCheckAt_idx" ON "ReminderRule"("enabled", "nextCheckAt");
