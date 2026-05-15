-- AlterTable: Add passwordVersion column for JWT invalidation on password change
ALTER TABLE "User" ADD COLUMN "passwordVersion" INTEGER NOT NULL DEFAULT 0;
