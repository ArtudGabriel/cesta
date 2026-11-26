# ADR 0019 — Bundle size baseline + gate strategy

- **Date:** 2026-11-26
- **Status:** Accepted (Sprint 199)
- **Related:** Sprint 194 (coverage threshold), Sprint 197 (a11y audit), Sprint 198 (Playwright E2E), Sprint 76 (compression gzip).

## Context

Cesta é PWA mobile-first comparação de preços. **Public target:** usuários Madrid, maioria mobile Chrome, redes móveis variadas (4G urbano, edge rural). First Load JS impacta direto:
- Time-to-Interactive (TTI) em connection slow.
- Dados consumidos (user paga por GB em muitos planos ES).
- Lighthouse score Performance (afeta PWA badge).

Até S198, zero gate em bundle size — feature sprints podiam adicionar dep pesada sem sinal CI.

## Decision

**Gate CI per-route** via script `cesta-web/scripts/bundle-size.mjs`:
- Lê `.next/app-build-manifest.json` post-build.
- Computa gzipped size (level 9) de cada chunk referenciado.
- Agrega por route: `firstLoadBytes` (total) + `pageOnlyBytes` (excluding shared) + `sharedBytes`.
- **Shared chunk** = presente em ≥50% das routes (heurística pra webpack runtime/framework).
- Enforce threshold per-route.

## Thresholds

| Métrica | Limite (gzip) | Rationale |
|---|---:|---|
| `firstLoadJsMaxBytes` | 200 KB | Lighthouse "Reduce JavaScript" audit threshold recommends <200KB compressed pra mobile 4G. Google PageSpeed baseline + Next.js blog performance recommendations. |
| `perPageMaxBytes` | 50 KB | Isola custo de código de rota nova — shared JS cresce lento, page bundle individual deve ser enxuto. Ampliável quando rota precisa lib pesada (ex: chart lib em /comparar); sprint dedicado justifica + atualiza limit. |

Ambos **gzip bytes**. Raw sizes podem ser 3-4x maiores.

## CI gate behavior

**Primeiro ciclo (S199):** `continue-on-error: true`. Baseline gathering — primeira run captura real sizes pós-merge sem bloquear.

**S200+:** Flip `continue-on-error: false` após:
1. Primeira run CI post-merge expor baseline no artifact `bundle-size`.
2. Review Dev + Boss confirmar baseline razoável (ou identificar bloat pra fix).
3. Ajustar threshold se razoável (bump) ou refactor dep pesada.

**Policy:**
- Violation = PR bloqueado (post-S200 switch).
- Threshold bump requer ADR novo documentando motivo (feature específica que justifica).
- Growth-% comparison (>10% baseline) é follow-up S20X — requer baseline JSON commited no repo.

## Alternatives considered

**A) `@next/bundle-analyzer`** (visual report HTML):
- Pros: existing devDep, interactive treemap.
- Cons: não enforce; só análise manual.
- Decision: mantemos complementar — Dev roda local pra debug; CI gate é o script dedicated.

**B) Size-limit (npm pkg)**:
- Pros: popular, maduro.
- Cons: config YAML separado, menos integrado com Next manifest, não entende route ↔ chunks mapping.
- Decision: script custom é thin wrapper que aproveita Next manifest nativo.

**C) BundleWatch**:
- Pros: comparação vs base branch built-in.
- Cons: requires external service account.
- Decision: zero-cost stack constraint veta.

## Consequences

- Dev vê size impact de nova dep antes do merge.
- Thresholds documentados = conversation centrada em trade-off (dep pesada vs feature value).
- Follow-up pós-MVP: expand pra incluir CSS size + image optimization assertions + font subset validation.

## Follow-up

- S200: flip continue-on-error após baseline review.
- S20X: baseline JSON commited + growth-% gate (>10% baseline = fail).
- S20X: integrate com Vercel bundle analyzer webhook (deploy preview comment).
