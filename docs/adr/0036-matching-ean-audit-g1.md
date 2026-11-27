# ADR 0036 — Matching cross-mercado G1: EAN/GTIN audit + Aldi JSON-LD extraction

- **Data:** 2026-11-27
- **Sprint:** S228 G1 (P0-CORE matching produto entre mercados)
- **Status:** Aceito (G1 code · G2-G4 sprints seguintes)
- **Relaciona:** memory [[project-product-matching-gap]], ADR 0028 (Aldi sitemap+JSON-LD), ADR 0033 (daily cron LIDL+Aldi)

## Contexto

Boss retest oficial 2026-11-27 revelou que o app não compara nada cross-mercado:

- **10.936 / 10.980 produtos em 1 mercado só** (99.6%).
- **16 produtos em 2 mercados**, **1 produto em 3 mercados**, **27 produtos em 7 mercados** (restos de seed inicial com preços fictícios).
- **Coca-Cola Zero 2L / 330ml / Milka**: cada mercado cria produto próprio porque `Product.ean` fica NULL em 99% dos casos.

Causa raiz: `catalog-sync` upsert procura match por `ean` (`CatalogSyncRepository.findProductByEan`) e, falhando, por `normalizedName`. Se nenhum dos adapters populou `ean` consistentemente, produtos ficam isolados por mercado.

## Audit per adapter (S228 G1)

| Adapter | Fonte do EAN | Status pré-S228 | Fix S228 |
|--------|-------------|----------------|----------|
| **mercadona** | API JSON (`ean` top-level) | ✅ populado | — |
| **alcampo** | JSON-LD `Product.gtin13 \|\| gtin \|\| gtin8` | ✅ populado (frozen adapter ADR 0027) | — |
| **carrefour** | API (`raw.ean`) | ✅ populado (frozen adapter) | — |
| **aldi** | JSON-LD `Product.gtin13 \|\| gtin12 \|\| gtin \|\| gtin8` | ❌ `ean: null` hardcoded | **✅ extract (S228)** |
| **dia** | API (sem campo EAN público) | ❌ `ean: null` documentado | ⚠️ G3 (trigram) |
| **eroski** | HTML sitemap (sem structured data) | ❌ `ean: null` documentado | ⚠️ G3 (trigram) |
| **froiz** | HTML cards (sem IDs estáveis) | ❌ `ean: null` documentado | ⚠️ G3 (trigram) |
| **lidl** | SEED_QUERIES + regex HTML (sem schema.org) | ❌ `ean: null` | ⚠️ G3 (trigram) |

## Decisão G1

### Fix imediato: Aldi JSON-LD gtin extraction

Aldi (`aldi.adapter.ts` S219) já parseia `application/ld+json` → `Product` block pra `offers.price`, `brand`, `image`, `description`. Adiciona-se cadeia de fallback GTIN (mesmo pattern alcampo.adapter.ts:177):

```ts
const ean = this.asString(
  product.gtin13 ?? product.gtin12 ?? product.gtin ?? product.gtin8,
);
```

Prioridade `gtin13` porque é padrão EAN-13 europeu (Aldi Nord). `asString` helper lida com JSON numérico (alguns schemas retornam número ao invés de string). NULL quando campo ausente — fallback graciosa.

### Gaps documentados: DIA / Eroski / Froiz / LIDL

Essas 4 redes **não expõem EAN público** nos adapters atuais:

- **DIA**: endpoint `/menu-rest/public/v3/products` retorna `id` interno, `name`, `price`, `brand`, mas NÃO EAN. API DIA privada (B2B) teria EAN mas requer autenticação/contrato.
- **Eroski**: sitemap + HTML tiles com `name`, `price`, `image`. JSON-LD ausente nos tiles de listagem; páginas de detalhe têm structured data **apenas em alguns SKUs** (empírico S220: <5%). Não vale custo polite-fetch per SKU.
- **Froiz**: HTML cards com `name`, `price`, `image`. Sem IDs estáveis sequer; ID derivado do nome (S221).
- **LIDL**: SEED_QUERIES + regex HTML. Produtos rotativos semanais sem EAN exposto.

Esses 4 adapters **permanecem com `ean: null`** e dependem de **G3** (matching normalizado marca+nome+tamanho + `pg_trgm` + threshold de confiança) pra merge canônico.

### Audit script expand

`scripts/audit-ean-coverage.mjs` ganha 3 views:

1. **Global EAN coverage** per adapter (% de produtos com EAN populado).
2. **Missing-image EAN breakdown** (view legado S224, útil pro backfill OFF).
3. **Multi-market matching baseline** (total products, single-market %, multi-market % — métrica-alvo G4).

Permite medir pós-deploy:
- Expected pós-S228 Aldi fix: Aldi `with_ean` passa de 0 → próximo de total (produtos sem gtin13 no JSON-LD ficam nulos, esperado ~5-10%).
- Expected pós G2 (merge por EAN exato): multi-market jump nos produtos EAN-shared entre {Mercadona, Alcampo, Carrefour, Aldi}.

## Trade-offs

- **Zero migração de dados nesta sprint.** Aldi cron noturno S225 (03:00 CET) vai popular EAN nos próximos runs — rolagem incremental, 300 produtos/run.
- **G2 (merge canônico) depende de G1 populando pelo menos 4 adapters.** Com Aldi fixado + os 3 que já funcionam (Mercadona/Alcampo/Carrefour), temos base pra matching cross-mercado em torno de 15-20% dos produtos (estimativa; depende de overlap dos catálogos).
- **DIA/Eroski/Froiz/LIDL são 4 das 6 redes principais.** Sem G3, matching fica limitado aos ~25-30% do catálogo que vêm dos adapters com EAN. G3 (trigram marca+nome+unidade) é chave pra fechar os 70% restantes, mas vem em sprint separada porque envolve algoritmo de similaridade + threshold tunning + fila de revisão.
- **Alcampo/Carrefour estão "frozen"** (Akamai anti-bot pós-S213). Os produtos que já estão no DB continuam com EAN; crescimento zero. Ainda assim o EAN que lá está serve pra merge cross-mercado (ex.: Alcampo EAN bate com Mercadona EAN → produto canônico).

## Consequências

- `products.ean` começa a popular pra Aldi no primeiro cron pós-merge.
- Baseline multi-market baixa (~0.4%) reconhecida; meta G4 ≥20% dos top-200 itens básicos.
- G2 sprint seguinte: `catalog-sync.service` ganha merge por EAN exato (`findProductByEan` já existe, mas cada adapter cria produto novo porque EAN veio null).
- G3 sprint subsequente: `pg_trgm` extension + `normalized_signature` field (marca+nome+tamanho) + fila de revisão manual pra matches abaixo do threshold.
- Rollback trivial: Aldi JSON-LD extraction é aditivo (campo que era null continua null se JSON-LD não traz gtin).
