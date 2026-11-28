-- Sprint 245 (ADR 0046): "produto equivalente" piloto 5 categorias.
-- Agrupa produtos cross-market cross-brand pelo mesmo typeKey + sizeCanon
-- (ex: "Leche entera 1L" de Hacendado/Dia/Milsani forma 1 grupo).
-- Migration ADITIVA (Boss guard #1): ADD COLUMN + CREATE INDEX apenas.
-- Zero DROP/DELETE/ALTER de colunas existentes.

ALTER TABLE "products" ADD COLUMN "equivalent_group_id" TEXT;

CREATE INDEX "products_equivalent_group_id_idx" ON "products"("equivalent_group_id");
