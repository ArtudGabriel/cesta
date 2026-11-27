# ADR 0042 — Proposta "produto equivalente": marcas próprias mesma categoria+tipo+tamanho

- **Data:** 2026-11-27
- **Sprint:** S235 (diagnostic + proposta · Boss leva ao user)
- **Status:** **PROPOSED** (não implementar · aguarda decisão Boss/user)
- **Relaciona:** ADR 0036 (G1 EAN), ADR 0037 (G2 canonical FK), ADR 0038 (G1b audit), ADR 0040 (G3 cluster), ADR 0041 (S234 recall fix brand+size+seed)

## Contexto empírico

Diagnostics S235 em prod 2026-11-27 revelaram o **teto real** de matching exato cross-mercado:

### Diagnostic 1 — trace test set Boss (`diagnose-match-test-set.mjs`)

| Caso | Produtos prod | Mercados | Cross-mercado possível? |
|------|--------------|----------|------------------------|
| Coca-Cola Zero 2L | 2 (ambos DIA) | 1 | ❌ |
| Coca-Cola Original 2L | 4 (3 DIA + 1 seed 7-mercados) | efetivo 2 | ❌ via name diff |
| Coca-Cola Zero lata 330ml | 3 (todos DIA) | 1 | ❌ |
| Milka 125g | 1 (DIA) | 1 | ❌ |
| Leche entera 1L | 12 produtos | 2 (DIA + seed Hacendado 7-mercados) | ❌ brand mismatch 11/11 pares |

Dos 5 casos canônicos Boss, **zero** tem match exato cross-mercado em prod (fora de seed polluter).

### Diagnostic 2 — teto marca nacional (`audit-national-brand-ceiling.mjs`)

```
Total produtos ativos:        11404
Marcas próprias filtradas OUT: 2117
Marcas nacionais:              6312
Sem marca detectada:           2975

Grupos (brand nacional + size): 2791
  → multi-mercado (≥ 2 supers): 66   ← TETO REAL
  → single-mercado:             2725
```

**66 grupos é o teto absoluto** de matching exato marca nacional em prod atual. E 18 desses são seed polluter (aparecem em 7 mercados fake · ver ADR 0041 seed cleanup).

### Diagnostic 3 — variant gate (`brand-normalize.mjs` + `match-cluster.mjs`)

`VARIANT_TOKENS` + `extractVariants` + `variantMatch` gate strict rebaixa Oreo golden/original pra clusters separados, Lay's Horno/regular split. Dry-run `--limit=10982` pós-variant:

```
Size match:    98
Variant match: 78    (drop 20 flavor-divergent pairs)
Jaccard:       18
Clusters:      12
Duplicates:    16    (erro ~0% visual · Boss ≤5% target cumprido)
```

Precisão aumentou ao custo de pequena perda de recall (18 → 16). Pós-cleanup seed, esses 16 permanecem (seed impacta clusters ~8-fake dos 18 anteriores).

## Problema insoluvel por match exato

Mercadona ≈ 80% catálogo = **marca própria Hacendado** sem equivalente cross-mercado por marca. LIDL maioria marca própria também. Resultado: usuário no app vê Mercadona isolada da comparação.

Caso real empírico Leche entera 1L:
- DIA: Asturiana · Celta · Dia Láctea · Lauki · Madriz · Pascual · Puleva (7 produtos marca nacional/própria)
- Mercadona: Hacendado (1 produto)
- Aldi/Carrefour/Alcampo/Eroski/Froiz/LIDL: cada um com sua marca própria + 0-1 marca nacional

**Match exato por marca = 0 pares cross-mercado.** Usuário quer saber "quanto custa leche entera 1L em cada mercado?" — não importa se é Hacendado, Asturiana ou Dia Láctea. Todos são "leche entera 1L".

## Proposta: entidade `ProductEquivalente` (ou view semântica)

### Conceito

Introduzir **duas camadas** de matching:
1. **"Mesmo produto"** (ADR 0040 + 0041 vigentes): match exato brand+size+variant+trigram. Cross-mercado quando marca nacional presente em múltiplos supers. Teto prod ≤ 66 grupos.
2. **"Produto equivalente"** (ADR 0042 proposta): match por categoria + tipo + tamanho + variant, **independente de marca**. Ex: "Leche entera 1L" qualquer marca → equivalente cross-mercado.

### Schema possível

Opção A — Nova tabela `ProductEquivalent`:

```prisma
model ProductEquivalent {
  id          String @id @default(cuid())
  categoryId  String?                                     // ex: lacteos/leche
  typeKey     String                                      // ex: "leche-entera"
  sizeCanon   String                                      // ex: "1000ml×1"
  variantKey  String  @default("")                        // ex: "sin-lactosa"
  // Membros do grupo via relação explícita:
  members     Product[] @relation("ProductEquivalentMember")
  @@unique([categoryId, typeKey, sizeCanon, variantKey])
}

// Product ganha FK nullable:
model Product {
  // ...
  equivalentId String? @map("equivalent_id")
  equivalent   ProductEquivalent? @relation("ProductEquivalentMember", fields: [equivalentId], references: [id])
}
```

Opção B — Reusa `canonicalProductId` com flag `is_equivalent` em ProductEquivalent table paralela.

Opção A é mais explícita. Opção B evita 2ª FK em Product.

### Algoritmo cluster equivalente

Reusa pipeline S234/S235 **sem** o gate `brand_match` (marca fica livre):
1. Pares cross-mercado com `category_id` igual.
2. `sizeMatchEff` igual.
3. `variantMatch` igual (strict).
4. Jaccard sobre `normalizeNameForMatch(name, brand=null)` — nome sem brand, sem size, sem variant tokens, sem genéricas → nome "tipo" (ex: "leche entera", "aceite oliva virgen extra").
5. Threshold Jaccard mais alto (≥ 0.8 talvez) porque sem brand gate, falsos positivos aumentam.

### UI separação

UI mostra 2 cards:
- **"Este produto"** (match canonical) — lista mercados onde EXATAMENTE a mesma marca/variação existe.
- **"Produtos equivalentes"** (match equivalente) — lista mercados com produto semanticamente similar · marca pode diferir · usuário decide.

Mock sugerido:

```
┌─ Coca-Cola Zero 2L ───────────────────────────────────┐
│ Mercadona (Hacendado Cola Zero 2L)   1,49€ equivalente │
│ DIA (Coca-Cola Zero 2L)              1,99€ mesmo       │
│ Carrefour (Coca-Cola Zero 2L)        1,89€ mesmo       │
└────────────────────────────────────────────────────────┘
```

Tag visual diferencia "mesmo" (verde) vs "equivalente" (amarelo + ícone info "marca diferente").

## Riscos e trade-offs

- **False positives semânticos**: "Leche entera 1L" ≠ "Leche semidesnatada 1L". Variant gate catches via `entera`/`semidesnatada`/`desnatada` tokens.
- **Category pré-requisito**: produtos sem `categoryId` (pré-S142 legacy) não cluster. Requer backfill OR fallback.
- **Expectativa usuário**: "equivalente" não é "mesmo". UI precisa deixar claro OR pode gerar percepção de bait-and-switch.
- **Complexidade** vs valor: ADR 0040 + 0041 + variant gate sem equivalente → ~16 duplicates. ADR 0042 potencialmente destrava ~500-1000 grupos equivalentes (estimativa baseada em 2791 grupos brand+size do diag 2 + 2975 unbranded).
- **Custo manutenção**: typeKey/sizeCanon canonicalization é regra de negócio. Ex: "leche-entera" vs "leche entera" vs "leche-entera-brik". Precisa dicionário/regex normalização OR gerado automaticamente via normalizeNameForMatch.

## Decisão

**PROPOSED** · aguarda Boss discutir com user:
- (I) Implementar `ProductEquivalente` + UI separada "mesmo"/"equivalente" (semana+).
- (II) Pular equivalente, aceitar teto exato (16-66 clusters) + focar outros deliverables MVP.
- (III) Híbrido: expor "equivalente" apenas em categorias-piloto (leche · agua · pan) via config env, medir impacto, decidir rollout.

## Decisão intermediária (incluída neste PR S235)

Independente da proposta: **brand dict + size pkg + seed cleanup + variant gate** (ADR 0041 S234 + variant tokens S235) ficam como foundation permanente. Melhoram precisão no "mesmo produto" track mesmo que "equivalente" não seja implementado.
