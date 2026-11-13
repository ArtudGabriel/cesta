-- AlterTable
ALTER TABLE "users" ADD COLUMN     "nutri_healthy_only" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "nutri_sort_enabled" BOOLEAN NOT NULL DEFAULT false;
