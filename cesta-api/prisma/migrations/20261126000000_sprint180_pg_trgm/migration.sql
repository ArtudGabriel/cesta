-- Sprint 180: pg_trgm extension + GIN indices pra fuzzy search em products.name / brand.
-- Grounding: S179 QA G1 FAIL design flaw (Fuse post-fetch não ajudava quando backend ILIKE
-- retornava zero matches). Fix root via Postgres trigram similarity().
--
-- pg_trgm é extension built-in no Postgres 9.1+; Neon suporta sem config extra.
-- GIN gin_trgm_ops permite similarity() + ILIKE ambos acelerados.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Índice GIN em name (coluna principal de busca)
CREATE INDEX IF NOT EXISTS "idx_product_name_trgm"
  ON "Product" USING GIN ("name" gin_trgm_ops);

-- Índice GIN em brand (secundário, menor volume)
CREATE INDEX IF NOT EXISTS "idx_product_brand_trgm"
  ON "Product" USING GIN ("brand" gin_trgm_ops);
