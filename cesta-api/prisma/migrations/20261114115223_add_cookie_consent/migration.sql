-- AlterTable
ALTER TABLE "users" ADD COLUMN     "cookie_consent_level" TEXT,
ADD COLUMN     "cookies_accepted_at" TIMESTAMP(3);
