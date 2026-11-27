-- Sprint 224 (MVP Bloco 2 fotos) — add Product.source_image_url
-- Preserva invariante ADR 0008 (imageUrl = storage gerenciado only);
-- sourceImageUrl guarda URL de origem do adapter pra backfill scan-and-upload
-- quando catálogo não tem EAN (OpenFoodFacts fallback inútil pra todos 1618
-- missing-image produtos — audit S224 confirmou ean=NULL em 100%).

ALTER TABLE "products" ADD COLUMN "source_image_url" TEXT;
