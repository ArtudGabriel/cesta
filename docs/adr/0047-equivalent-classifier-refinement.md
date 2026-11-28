# ADR 0047 — Equivalent classifier refinement (10 regras Boss)

- **Data:** 2026-11-28
- **Sprint:** S245b P0-CORE fix (Boss VETO --apply S245 · dry-run 41% erro)
- **Status:** Aceito (refina ADR 0046 · zero schema change)
- **Relaciona:** ADR 0046 (S245 piloto), ADR 0042 (S235 proposta)

## Contexto

Dry-run S245 `match-equivalent.mjs --limit=20000` produziu **23/56 grupos errados (41%)** — muito acima do limite Boss ≤5%. Baseline capturado em `C:/Users/gabri/Dev/cesta-review-dry-s245.txt` (340 linhas).

Erros concretos observados:

1. **"Melva en aceite de oliva"** / **"Sardinas en aceite de oliva"** / **"Filetes de caballa en aceite de oliva"** classificados como `aceite-oliva` — eram atuns/sardinhas enlatados, não azeite. Regex `\baceite\s+oliva\b` falhou porque não exigia head-noun.
2. **"Aceite de oliva suave"** + **"Aceite de oliva intenso"** no mesmo grupo — graus distintos misturados.
3. **"Agua mineral con gas Perrier"** / **"Agua con gas vitaminada Puro Exorcismo"** / **"Agua alcalina Ursu9"** tratados como `agua-mineral` — produtos funcionalmente diferentes (gaseificada/vitaminada/alcalina) misturados com plana.
4. **"Agua mineral grande Bezoya"** sem size parseável agrupada arbitrariamente.
5. **"Leche semidesnatada de cabra Covap"** no grupo `leche-semi` — leite de cabra misturado com leite de vaca.
6. **"Leche entera calcio Puleva"** + **"Leche entera Puleva"** mesmo grupo — regular + enriquecido misturados.
7. **"Huevos super grandes XL"** + **"Huevos grandes L"** + **"Huevos medianos M"** mesmo grupo `huevos · 1un×12` — grade ignorada, só pack.

## Decisão: 10 regras Boss aplicadas a `scripts/lib/equivalent-types.mjs`

### Rule 1 — Azeite (3 typeKeys separados + head-noun)

- Nome DEVE começar com `aceite` (bloqueia "melva en aceite").
- Nome DEVE conter `oliva` (bloqueia "aceite de girasol", "aceite corporal Nivea").
- Grau separa em `aceite-oliva-ve` (virgen extra) / `aceite-oliva-virgen` / `aceite-oliva-refinado` (suave/intenso/refinado — grau único).
- Suave vs intenso dentro de `refinado` separa via `variantKey` (`aceite_suave` / `aceite_intenso`).
- Aromatizados **FORA**: `trufa`, `ajo`, `guindilla`, `limon`, `romero`, `albahaca`, `aromatizad*`, `infusionad*`.

### Rule 2 — Água só plana (sem gas/vitaminada/sabor/alcalina)

- Head-noun `agua`.
- `AGUA_OUT` regex (com flexão espanhol): `gas | gasificad[ao]? | vitaminad[ao]? | alcalin[ao]? | infusionad[ao]? | aromatizad[ao]? | carbonat[ao]? | sabor` → FORA.
- typeKey único `agua-mineral-plana`.

### Rule 3 — Leite vaca regular (exclusões + enriquecido variante)

- Head-noun `leche`.
- `LECHE_OUT`: `bebida | batido | cabra | oveja | arroz | soja | coco | almendra | avena | espelta | cereales | chocolate | vainilla | fresa | cafe` → FORA.
- 3 typeKeys: `leche-entera` / `leche-semi` / `leche-desnatada`.
- Enriquecimentos (calcio/omega-3/fibra/proteinas/vitaminas) viram variantKey tokens distintos → agrupam separado do regular.

### Rule 4 — Ovos chave composta (classe + qtd + cría)

- Head-noun `huevos`.
- typeKey único `huevos`, mas `variantKey` carrega:
  - **Grade**: `huevo_s|m|l|xl` (match `S/M/L/XL` sozinho ou `pequeno/mediano/grande/super grande`).
  - **Cría**: `huevo_camperos|ecologicos|suelo|jaula`.
  - **Quantidade**: `huevo_qty_6|12|30` (match `N un[idades]`).
- Codorniz/pato/chocolate FORA.

### Rule 5 — Pão molde (variante OBRIGATÓRIA)

- Head-noun `pan` + exige `molde` explícito.
- Tostadas/rallado/precocido/hamburguesa/perrito **FORA**.
- `PAN_VARIANT_REQUIRED`: `blanco | integral | cereales | espelta | avena | maiz | proteinas | centeno | espigas | multicereal`. Sem variante → FORA.
- typeKey único `pan-molde`; variantKey (`pan_blanco` / `pan_integral` / `pan_cereales` / `pan_proteinas`) separa dentro.

### Rule 6 — Size AUTORITATIVA do DB

- Nova helper `canonicalSize(name, packageSize, packageUnit)` prefere `sizeFromDb(packageSize, packageUnit)`; fallback `parseSize(name)`.
- Produto sem size parseável em nenhuma fonte → `bucketize` incrementa `droppedBySize` e descarta do piloto.
- Nunca inferir size padrão.

### Rule 7 — Métricas Boss no dry-run

Script imprime, além do histogram, 4 métricas críticas pro PR body:
- `Groups total`
- `Total members`
- `Groups com 2+ supermarkets` (**crítica** — grupos que de fato comparam cross-mercado)
- `Groups com Mercadona` (sanity: baseline 80% catálogo = Hacendado; equivalente deve chegar lá)

### Rule 8 — Fixtures spec ampliados

`scripts/lib/equivalent-types.spec.mjs` cobre os 7 erros concretos:
- Atum/sardinha em aceite → null
- Nivea gel / aceite corporal → null
- Perrier / Vichy Catalán / San Pellegrino / gasificada / vitaminada / alcalina / sabor → null
- Leche cabra / oveja / soja / arroz / avena / coco / almendra / chocolate / vainilla / café / bebida-láctea / batido → null
- Ovos XL vs M vs L / camperos vs suelo vs ecológicos / 6 vs 12 vs 30 → variantKey distinto
- Aceite trufa / ajo / guindilla / limón / romero → null
- Pan tostadas / rallado / hamburguesa / perrito / sem variante obrigatória → null
- Aceite suave vs intenso → variantKey distinto (`aceite_suave` / `aceite_intenso`)
- Leche regular vs calcio/omega/fibra/proteinas/vitaminas → variantKey distinto
- `canonicalSize` DB-first + null quando sem size

Total: **38 specs**, todos pass.

### Rule 9 — Dry-run imprime TODOS membros (sem slice)

Default agora é imprimir **todos** os grupos + **todos** os membros com nome completo + marca + supermarkets. Preserva `SAMPLE_GROUPS` env pra opt-in truncate (útil em debugging com limit pequeno).

### Rule 10 — Gate triplo antes de `--apply`

Fluxo S245b vinculante:
1. Dev abre PR sem `--auto` (este PR).
2. Reviewer gate 3 — code review.
3. QA gate 4 — sample 30 grupos dry-run visual review.
4. Boss lê dry-run INTEIRO (sem slice), confere métrica groups-com-2+-supers e groups-com-Mercadona.
5. Só após triplo OK Boss roda `node scripts/match-equivalent.mjs --apply` em prod (PITR Neon).

## Boss guards (vinculantes · herdados ADR 0046)

| # | Guard | Evidência |
|---|-------|-----------|
| 1 | Zero schema change | Coluna `equivalent_group_id` já existe (S245). S245b só refina classifier. |
| 2 | LIGA não apaga | Mesmo pipeline S245: UPDATE idempotente. |
| 3 | PITR Neon antes `--apply` | Script imprime timestamp UTC + rollback SQL. |
| 4 | Dry-run default | `--apply` opt-in (preservado). |
| 5 | Rollback documentado | `UPDATE products SET equivalent_group_id = NULL WHERE updated_at > '<ts>'` (herdado ADR 0046 §Rollback). |
| 6 | Strict typeKey + size + 2+ brands | Head-noun check + DB-first size + filter brands distintas. |
| 7 | Amostra pré-apply | Default imprime TODOS os grupos (rule 9 Boss). Env `SAMPLE_GROUPS=N` pra debug. |
| 8 | G0 archive pointers | Feature pequena, única nota — G0 archive NÃO exigido (Boss oversight 2026-11-28). |

## Rollback

Reverter commit do PR S245b → classifier volta ao estado S245 (ADR 0046). `equivalent_group_id` em prod permanece intacto (Boss nunca rodou --apply em S245, column está NULL).

Em caso de --apply com regressão:
```sql
UPDATE products SET equivalent_group_id = NULL
 WHERE equivalent_group_id IS NOT NULL
   AND updated_at > '<timestamp UTC do --apply>';
```

## Trade-offs

- **Tokenização regex frágil**: cada nova marca/variante pode introduzir caso não coberto. Mitigação: specs cobrem os erros concretos observados; novos casos → add test + regex + re-dry-run.
- **Head-noun check é literal**: "Aceite de oliva..." passa, mas "Oliva aceite..." falha. Nomes catálogo espanhol sempre começam com o produto — safe.
- **Enriquecidos variam de grupo**: "Leche entera Puleva" ≠ "Leche entera calcio Puleva" agora. Usuário ganha granularidade; Boss confirmou intenção (leite calcio custa mais, não é intercambiável).
- **Métrica groups-com-2+-supers pode ser baixa**: S245 baseline 56 grupos mas quantos de fato cross-mercado? Essa métrica revela isso. Target: ≥50% dos groups.

## Consequências

- Precisão clássifier esperada **≥95%** pós S245b vs 59% S245.
- Mercadona (Hacendado dominante) continua representada se estiver nos grupos restantes.
- Catálogo piloto efetivo menor (ovos XL ≠ L ≠ M por exemplo) mas semanticamente correto.
- Boss pode rodar --apply com confiança pós triplo-OK.

---

## Amend S245c (2026-11-28 pós 2ª dry-run Boss)

Dry-run S245b (44 grupos, 160 membros) teve 5 erros = **11%** vs limite ≤5%. Boss documentou em `C:/Users/gabri/Dev/cesta-review-dry-s245b.txt`. Correções S245c no mesmo PR #230 (commit novo):

### Bug 1 — Água permissiva demais

`classifyAgua` default fallthrough `'agua-mineral-plana'` casou com qualquer `^agua` → incluiu colonia, oxigenada, micelar, destilada, fuerte, plancha, coco, tónica, perfumada no bucket.

**Fix**: `AGUA_REQUIRED` regex `\b(mineral|manantial)\b` — SEM essas palavras-chave, produto sai do piloto. `AGUA_OUT` expandido com 11 outliers novos.

### Bug 2 — `huevo_l` leak em outros typeKeys

`PILOT_VARIANT_PATTERNS.huevo_l` incluía `(?:^|\s)l(?:\s|,|$)` que casava `" L "` em "Leche entera 1 L", "Aceite virgen extra 1 L", "Agua mineral 1 L". Todo grupo não-huevos carregou `huevo_l` no variantKey → poluiu chave.

**Fix**: `variantCanon(name, typeKey)` agora scopa as patterns por typeKey:
- `LECHE_VARIANT_PATTERNS` (enriquecidos) — só pra `leche-*`.
- `HUEVO_VARIANT_PATTERNS` (grade/cría/qty) — só pra `huevos`.
- `PAN_VARIANT_PATTERNS` (blanco/integral/cereales/proteinas) — só pra `pan-molde`.
- `ACEITE_VARIANT_PATTERNS` (suave/intenso) — só pra `aceite-*`.
- Tokens genéricos S235 (zero/golden/horno/men/mujer) mantidos globais.

### Bug 3 — Ovos ZERO grupos

`canonicalSize` DB-first retornava size diferente por supermarket (Mercadona packageSize=1 UNIT vs DIA packageSize=12 UNIT). Grupos por size → cada combinação em bucket próprio, raramente com 2+ brands.

**Fix**: para `typeKey === 'huevos'`, `sizeCanon` é CONSTANTE `{value:1, unit:'un', pack:1}`. Toda discriminação vai pro variantKey (`huevo_qty_12`, `huevo_l`, `huevo_camperos`). `HUEVO_VARIANT_PATTERNS.huevo_qty_12` agora aceita `"docena"`; `huevo_qty_6` aceita `"media docena"`.

### Bug 4 — Leite Hacendado missing (diagnose)

Nenhum grupo leche no dry-run S245b tinha Mercadona. Hipótese: Hacendado leche com `canonical_product_id` NOT NULL (linkados pelo S244) OR prices inativos.

**Fix**: script `match-equivalent.mjs` agora emite seção `DIAGNOSTIC S245c (bug 4) — Mercadona leche candidates` listando TODOS produtos Mercadona cujo `classifyTypeKey` retornou `leche-*` com seus `canonicalSize` e supers. Boss lê essa seção pra entender se é bug de dados (Hacendado linked wrong) ou bug de código.

### Bug 5 — `enriq_proteinas` falha com acento + English

Regex original `\bproteinas?\b/i` NÃO casava:
- `"proteínas"` (com acento agudo) — accent não strip-ada em variantCanon.
- `"dinamic protein"` (English, Pascual).

**Fix**: regex `\bprote[ií]nas?\b|\bprotein\b`. Agora "sin lactosa alta en proteínas" e "sin lactosa dinamic protein" variantKey distinto de "sin lactosa" regular.

### Specs S245c adicionais

- `agua colonia/oxigenada/micelar/destilada/fuerte/plancha/coco/tónica/perfumada` → `null`.
- `agua grande` sem "mineral"/"manantial" → `null`.
- `variantCanon` leche/aceite/agua 1L **NÃO** carrega `huevo_l`.
- `huevo_qty_12` aceita `docena`; `huevo_qty_6` aceita `media docena`.
- `enriq_proteinas` match `proteínas` (acento) e `protein` (English); não match em "sin lactosa" sozinho.
- `pan_blanco` presente em pan molde; `huevo_l` NÃO presente.

**Total specs S245c**: **45/45 pass** (vs 38 S245b).

### DoD S245c

- [x] Fixtures cada bug (bugs 1-5).
- [ ] Dry-run full novo erro ≤5%.
- [ ] Ovos ≥1 grupo.
- [ ] Leite Hacendado em grupo com DIA (OR diagnose explicar por que não).

Os 3 últimos exigem Boss rodar dry-run pós merge do commit S245c neste PR.
