-- Sprint 234 G3 recall fix (ADR 0041) — soft-delete ProductPrice.
-- Aditiva · zero DROP. Suporta seed cleanup reversível (Boss guard #2
-- LIGA não apaga): scripts/cleanup-seed-prices.mjs seta deletedAt em
-- ProductPrice.source='seed' sem remover row. UI filtra deletedAt IS NULL.
-- Rollback: UPDATE product_prices SET deleted_at = NULL;

ALTER TABLE "product_prices"
  ADD COLUMN "deleted_at" TIMESTAMP(3);

CREATE INDEX "product_prices_deleted_at_idx"
  ON "product_prices"("deleted_at");
