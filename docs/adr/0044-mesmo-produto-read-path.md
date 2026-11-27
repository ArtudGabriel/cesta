# ADR 0044 — "Mesmo produto": read path canonical aggregation + variant gate expand

- **Data:** 2026-11-28
- **Sprint:** S244 P0-CORE "mesmo produto"
- **Status:** Aceito (migration zero · read-only agregação via `canonicalProductId` FK existente)
- **Relaciona:** ADR 0037 (S228 G2 canonicalProductId), ADR 0040 (S232 G3 cluster), ADR 0041 (S234 recall fix), ADR 0042 (S235 equivalente proposta)

## Contexto

Sprints S228 (G2 canonical FK) + S232 (G3 cluster match) + S234 (recall fix brand/size/seed) + S235 (variant gate inicial) construíram o PIPELINE DE ESCRITA de "mesmo produto": `match-cluster.mjs` identifica pares cross-mercado e link-a via `UPDATE products SET canonical_product_id = <canonical.id>`.

Mas o READ PATH do app ainda não lê isso:
- `GET /products/:id` retorna o produto exato pedido (child ou canonical), sem agregar o grupo.
- `GET /products` + `GET /products/search` + `GET /products/suggest` não filtram `canonicalProductId IS NULL` nem dedupem por canonical, então o usuário vê DOIS cards pro mesmo produto (ex: "Aceite oliva virgen extra 1L Carbonell" vem duas vezes: do Carrefour e do Alcampo).
- `GET /products/compare` recebe N ids e retorna N produtos sem resolver canonical, então a CompareMatrix tem rows duplicadas.

**Falar "mesmo produto" na UI não serve de nada enquanto o backend não entrega.** S235 ADR 0042 vetou o `match-cluster.mjs --apply` até o read path estar pronto porque "linkar não muda a UI".

## Decisão

### Algoritmo read path

Dado um Product qualquer (canonical ou child):

1. **Resolve canonical**: `canonicalId = product.canonicalProductId ?? product.id`.
2. **Load grupo**: `WHERE deleted_at IS NULL AND (id = canonicalId OR canonical_product_id = canonicalId)`.
3. **Elect canonical member**: `members.find(m => m.id === canonicalId)` — determinístico, igual ao electCanonical do script (has_ean DESC → createdAt ASC → id ASC foi usado no link; mas no read, o canonical já está marcado por FK, então só pega pelo id).
4. **Aggregate prices**: concat prices de todos os membros. Dedupe por `supermarketId` preferindo o price com `lastSyncedAt` mais recente (defesa contra duplicates legado S228 que tenham price no mesmo supermarket).
5. **Populate `canonicalProductId`**: do canonical member — `null` quando grupo é standalone, string quando grupo tem history de merge via FK apontando pra si (não ocorre por construção, mas o campo serve pra identificar child quando o endpoint retorna child por acidente).

Decisão: endpoint `/products/:id` sempre RETORNA o canonical member, mesmo que o caller passe id de child. Isso simplifica frontend (`canonicalProductId` sempre null no detalhe) e garante uma URL canônica única por grupo. Follow-up: 301 redirect do child URL pro canonical em frontend router (S245 ou posterior).

### Dedupe nas listagens

`findMany`, `findForSearch`, `findSuggestions` ganham filtro `canonicalProductId IS NULL`. Isso é SAFE porque:
- Produto ativo sem canonical = canonical implícito de si mesmo (`findManyByIds` single query cobre caso de history legado).
- Child perde visibilidade direta (fica atrás do canonical). Favoritos/alerts/lists que apontam pra child continuam funcionando porque `findById` resolve ao canonical.

Alternativa descartada: `DISTINCT ON (COALESCE(canonical_product_id, id))` SQL raw. Mais complexo, requer orderBy compatível, e Prisma não suporta `DISTINCT ON` nativo. Filtro WHERE é mais limpo e idempotente.

### Variant gate expand

S235 ADR 0042 definiu `VARIANT_TOKENS` mas deixou gaps: tokens de PÚBLICO-ALVO (men/hombre/mujer/women/kids/infantil/bebe) não discriminam cosméticos/higiene masculino vs feminino. Caso prod detectado (Boss 2026-11-27): "Nivea Black and White Invisible 200ml" tem variante MEN e variante MUJER com nomes quase iguais em supermercados distintos — cluster match une errado.

Expand `VARIANT_TOKENS`:
```
'men', 'hombre', 'mujer', 'women', 'kids', 'infantil', 'bebe'
```

Fixture de test:
- Nivea Black and White Invisible MEN 200ml (desodorante stick)
- Nivea Black and White Invisible MUJER 200ml (desodorante stick)
- Roll-on Nivea Men 50ml
- Roll-on Nivea 50ml (feminino implícito)

Expectativa: `extractVariants` extrai `{men}` e `{mujer}` em pares; `variantMatch` rejeita cluster. Zero false positive em `match-cluster.mjs --dry-run`.

## Boss guards (vinculantes)

| # | Guard | Evidência |
|---|-------|-----------|
| 1 | Migration ADITIVA | **Zero schema change**. `canonicalProductId` FK é S228 G2 (ADR 0037). |
| 2 | LIGA não apaga | Read path não escreve. Script `match-cluster.mjs --apply` só faz UPDATE canonical_product_id (herdado G3). |
| 3 | PITR Neon antes de `--apply` | Script imprime timestamp UTC + rollback SQL (herdado G3). |
| 4 | Dry-run default | `match-cluster.mjs` sem `--apply` não escreve. S244 roda `--dry-run --limit=11000` full antes do Boss decidir apply. |
| 5 | Rollback documentado | Read path: feature flag OFF → comportamento S243b volta. Script: UPDATE products SET canonical_product_id = NULL WHERE updated_at > '<ts>' (herdado G3). |
| 6 | Strict variant tokens | `VARIANT_TOKENS` + `extractVariants` + `variantMatch` gate. S244 adiciona 7 tokens público-alvo. |
| 7 | Amostra 30 pré-apply | `SAMPLE_CLUSTERS=30` env no script dry-run (herdado G3). QA review visual. |
| 8 | G0 archive pointers | docs/archive/pendente-note-2026-11-28-s243b.md já existe (merged S243b). S244 PR só anexa ponteiro se note crescer > 40 KB novamente. |

## Rollback

### Read path (código)

Reverter 2 commits do PR S244. Deploy automatic do Render pega.

Alternativo fine-grain: env `CANONICAL_READ_PATH_ENABLED=false` curto-circuita o resolve group no `ProductsRepository.findById`/`findMany` e volta ao comportamento S243b. NÃO IMPLEMENTADO neste sprint — simplicidade > reversibilidade por flag. Se regressão aparecer em prod, revert commit cobre.

### Cluster links (DB)

ADR 0040 Boss guard #5 cobre: `UPDATE products SET canonical_product_id = NULL WHERE updated_at > '<ts>'` OU PITR Neon branch do restore point pré-apply.

## Trade-offs

- **Dedupe por `canonicalProductId IS NULL` reduz count visível de produtos nas listagens**. Correto: cada cluster conta 1x, não N. Métrica "produtos no catálogo" passa a ser "canonicals vivos". Admin runs preserve raw count.
- **findById de child resolve ao canonical**: URL do child "desaparece". Frontend seguirá o `canonicalProductId` retornado pra sincronizar router. Follow-up S245: redirect server-side ou client-side.
- **Aggregated prices dedupe por supermarketId · lastSyncedAt DESC**: cluster rule S232 garante `super_ids DISJUNTOS`, então overlap por supermarket só ocorre em legado S228 pré-G3. Preferência por mais recente evita mostrar preço stale do child enquanto canonical tem o atual.
- **Variant gate expand aumenta precisão com risco mínimo de recall**: 7 tokens público-alvo são palavras-chave discriminantes do mercado espanhol (men/hombre/mujer/etc). Produto raramente tem ambos tokens no nome, então rejeição false é improvável.
- **`canonicalGroupSize` requer count adicional**: SQL extra `GROUP BY canonical_product_id` ou in-memory count via include duplicates. Baseline prod ~16 clusters (ADR 0040 `--limit=500`), full dry-run S244 revela o real. Overhead desprezível em listagens porque filtro `canonicalProductId IS NULL` já reduziu N.

## Consequências

- Usuário no detalhe vê preços cross-mercado agregados num card único + badge verde "mesmo produto" quando grupo > 1.
- `/comparar` CompareMatrix passa a comparar grupos canônicos em vez de duplicates isolados — tabela fica correta.
- Busca mostra 1 card por cluster — menos ruído, menos confusão.
- Boss `match-cluster.mjs --apply` fica desbloqueado (ADR 0042 veto expira). User autorizou terminal Boss a rodar o apply pós dry-run full + sample QA ≤5% erro.
- Métrica MVP "% produtos em 2+ mercados" começa a mover: baseline 0.4% → esperado 5-10% após apply full (depende do dry-run final).
