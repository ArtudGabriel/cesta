-- Sprint 228 G2 (ADR 0037) — Matching canônico cross-mercado por EAN.
-- Adiciona Product.canonical_product_id self-FK nullable.
-- Duplicatas detectadas pelo catalog-sync em runtime apontam para o Product
-- canônico (o primeiro com EAN populado). UI filtra canonical_product_id IS
-- NULL em G4.

ALTER TABLE "products"
  ADD COLUMN "canonical_product_id" TEXT;

ALTER TABLE "products"
  ADD CONSTRAINT "products_canonical_product_id_fkey"
  FOREIGN KEY ("canonical_product_id") REFERENCES "products"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "products_canonical_product_id_idx"
  ON "products"("canonical_product_id");
