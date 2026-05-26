-- CreateIndex: Optimize FeedingRecord queries
CREATE INDEX "FeedingRecord_createdBy_babyId_startTime_idx" ON "FeedingRecord"("createdBy", "babyId", "startTime");
CREATE INDEX "FeedingRecord_babyId_startTime_idx" ON "FeedingRecord"("babyId", "startTime");

-- CreateIndex: Optimize HealthRecord queries
CREATE INDEX "HealthRecord_createdBy_babyId_recordedAt_idx" ON "HealthRecord"("createdBy", "babyId", "recordedAt");
CREATE INDEX "HealthRecord_babyId_type_recordedAt_idx" ON "HealthRecord"("babyId", "type", "recordedAt");

-- CreateIndex: Optimize Baby queries
CREATE INDEX "Baby_createdBy_idx" ON "Baby"("createdBy");

-- CreateIndex: Optimize ApiKey queries
CREATE INDEX "ApiKey_userId_idx" ON "ApiKey"("userId");
