-- AlterTable: Add solid food fields to FeedingRecord
ALTER TABLE "FeedingRecord" ADD COLUMN "solidFoodName" TEXT;
ALTER TABLE "FeedingRecord" ADD COLUMN "solidFoodAmount" TEXT;

-- AlterTable: Add sleep fields to HealthRecord
ALTER TABLE "HealthRecord" ADD COLUMN "sleepStartTime" DATETIME;
ALTER TABLE "HealthRecord" ADD COLUMN "sleepEndTime" DATETIME;
ALTER TABLE "HealthRecord" ADD COLUMN "sleepQuality" TEXT;
