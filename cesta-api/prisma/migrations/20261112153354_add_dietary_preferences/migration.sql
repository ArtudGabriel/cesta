-- AlterTable
ALTER TABLE "users" ADD COLUMN     "prefers_gluten_free" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "prefers_lactose_free" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "prefers_vegan" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "prefers_vegetarian" BOOLEAN NOT NULL DEFAULT false;
