-- Sprint 229 G3 (ADR 0039) — fila de revisão manual pra matches trigram
-- com confiança média. Match >= HIGH_THRESHOLD liga direto via S228 G2
-- Product.canonicalProductId; match entre LOW e HIGH entra aqui.
-- Migration ADITIVA · zero DROP/DELETE.

CREATE TABLE "product_match_reviews" (
  "id" TEXT PRIMARY KEY,
  "duplicate_product_id" TEXT NOT NULL,
  "canonical_product_id" TEXT NOT NULL,
  "similarity_score" DECIMAL(4,3) NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reviewed_at" TIMESTAMP(3)
);

ALTER TABLE "product_match_reviews"
  ADD CONSTRAINT "product_match_reviews_duplicate_product_id_fkey"
  FOREIGN KEY ("duplicate_product_id") REFERENCES "products"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "product_match_reviews"
  ADD CONSTRAINT "product_match_reviews_canonical_product_id_fkey"
  FOREIGN KEY ("canonical_product_id") REFERENCES "products"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE UNIQUE INDEX "product_match_reviews_duplicate_product_id_canonical_product_id_key"
  ON "product_match_reviews"("duplicate_product_id", "canonical_product_id");

CREATE INDEX "product_match_reviews_status_created_at_idx"
  ON "product_match_reviews"("status", "created_at");
