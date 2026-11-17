-- Sprint 96 — push notifications fase 1. Campos pra idempotência no cron
-- alert-price-check (2h): só reenvia push se preço mudou vs last_notified_price.
ALTER TABLE "alerts" ADD COLUMN "last_notified_at"    TIMESTAMP(3);
ALTER TABLE "alerts" ADD COLUMN "last_notified_price" DECIMAL(10, 2);
