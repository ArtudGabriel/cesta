# Sprint 200 — MARCO audit snapshot

> Executado 2026-11-26 · Branch `chore/sprint-200-marco-consolidate` · Base HEAD `80d5d1e` (S199 verde main).
> Prod **SUSPENDED** (Render billing 2026-11-26, memory `project-render-suspended-billing-2026-11`). Snapshot code-only.

## Verdict

**All CI gates green** no último merge em `main` (S199, run 45863060797). Local snapshot confirma i18n parity; bundle size + a11y foram **deferred para CI** (bundle manifest stale localmente; a11y script usa `spawn("npx")` sem `shell:true` → ENOENT em Windows PowerShell / git-bash — não bloqueia MARCO, CI roda em ubuntu).

Fonte da verdade para MARCO: **GitHub Actions run `45863060797` (S199 merge)** e re-run deste PR S200.

---

## Gates

### 1. Coverage — `cesta-api` (jest)

| Métrica | Threshold global | Fonte | Enforce |
|---|---:|:---|:---:|
| statements | 55% | `cesta-api/package.json` `jest.coverageThreshold.global` | CI step `Coverage threshold gate (jest --coverage)` |
| branches | 46% | mesmo | mesmo |
| functions | 41% | mesmo | mesmo |
| lines | 55% | mesmo | mesmo |

- Rebase doc S194: PR #156 — split `test:ci` do `test:coverage:gate` em CI para distinguir falha de teste vs falha de threshold.
- Último CI (S199): **passed** (`API (lint + test + build): success`).

### 2. Coverage — `cesta-web` (vitest)

| Métrica | Threshold | Fonte |
|---|---:|:---|
| statements | 33% | `cesta-web/vitest.config.ts` `coverage.thresholds` |
| branches | 27% | mesmo |
| functions | 28% | mesmo |
| lines | 33% | mesmo |

- Rebase doc S194 (comentários em vitest.config.ts): statements 35.28% / branches 29.75% / functions 30.3% / lines 35.81% — thresholds 2pp abaixo pra evitar flapping.
- Último CI (S199): **passed** (`Web (lint + typecheck + build): success`).

### 3. i18n parity — `cesta-web/scripts/i18n-parity.mjs`

Local run (2026-11-26 branch S200):

```
── i18n parity audit ──
es.json    leaves: 739
pt-BR.json leaves: 739

✅ parity OK (739 leaves aligned)
```

- Introduzido S196 (PR #159) — enforce `es.json` ≡ `pt-BR.json` leaf parity.
- CI step: `i18n parity (es ↔ pt-BR)` em job Web.

### 4. a11y audit — `cesta-web/scripts/a11y-audit.mjs`

- Introduzido S197 (PR #160) — axe-core + jsdom roda contra HTML server-rendered em cada rota.
- Local Windows: **spawn ENOENT** (`spawn npx` sem `shell:true` em `child_process.spawn` linha ~190). Backlog nit S20X: adicionar `shell: process.platform === "win32"`. Não bloqueia MARCO — roda em ubuntu CI.
- Último CI (S199): **passed** (step `a11y audit (axe-core + jsdom) [post-build]` dentro de job Web).

### 5. bundle size — `cesta-web/scripts/bundle-size.mjs`

| Threshold | Valor (gzip) | Rationale |
|---|---:|:---|
| `firstLoadJsMaxBytes` | 200_000 bytes | Lighthouse "Reduce JavaScript" audit mobile 4G |
| `perPageMaxBytes` | 50_000 bytes | Isola custo de código por rota nova |

- Introduzido S199 (PR #162, ADR 0019). CI atualmente em `continue-on-error: true` — baseline gathering, flip para enforce pós-S200 review.
- Local: manifest `.next/app-build-manifest.json` ausente (rebuild required); `node bundle-size.mjs --json` imprime `warn: manifest sem routes parseáveis — bundle gate skipped (no violations).`
- Último CI (S199): **passed** (step `bundle size gate` — run bootstrap, não enforce).

### 6. E2E Playwright — `cesta-web/e2e/`

- Infra S198 (PR #161) — workflow `.github/workflows/e2e.yml`, smoke tests apenas. Não parte do audit MARCO; listado para completude.

---

## JSON summary

```json
{
  "snapshot_date": "2026-11-26",
  "branch": "chore/sprint-200-marco-consolidate",
  "base_sha": "80d5d1e",
  "source_of_truth_ci_run": {
    "id": "45863060797",
    "head_sha": "80d5d1eabe45cb7464fa7af5ab6f0f9746f5636e",
    "url": "https://github.com/ArtudGabriel/cesta/actions/runs/45863060797",
    "conclusion": "success",
    "jobs": [
      { "name": "API (lint + test + build)", "conclusion": "success" },
      { "name": "Web (lint + typecheck + build)", "conclusion": "success" }
    ]
  },
  "gates": {
    "api_coverage": {
      "runner": "jest",
      "thresholds": { "statements": 55, "branches": 46, "functions": 41, "lines": 55 },
      "ci_status": "passed",
      "source": "cesta-api/package.json"
    },
    "web_coverage": {
      "runner": "vitest",
      "thresholds": { "statements": 33, "branches": 27, "functions": 28, "lines": 33 },
      "ci_status": "passed",
      "source": "cesta-web/vitest.config.ts"
    },
    "i18n_parity": {
      "runner": "node scripts/i18n-parity.mjs",
      "locales": ["es", "pt-BR"],
      "leaves_per_locale": 739,
      "parity": "OK",
      "local_status": "passed",
      "ci_status": "passed"
    },
    "a11y_audit": {
      "runner": "node scripts/a11y-audit.mjs",
      "engine": "axe-core + jsdom",
      "local_status": "skipped (windows spawn ENOENT bug — backlog nit)",
      "ci_status": "passed"
    },
    "bundle_size": {
      "runner": "node scripts/bundle-size.mjs",
      "thresholds_bytes_gzip": { "first_load_js_max": 200000, "per_page_max": 50000 },
      "ci_enforcement": "continue-on-error (baseline gathering)",
      "local_status": "skipped (no .next/app-build-manifest.json)",
      "ci_status": "passed (non-enforcing)"
    }
  }
}
```

---

## Backlog nits surfaced durante S200

| ID | Escopo | Severity | Descrição |
|---|:---|:---|:---|
| S20X-nit-01 | `cesta-web/scripts/a11y-audit.mjs` | P3 | `child_process.spawn("npx", [...])` em line ~190 sem `shell: true` → Windows ENOENT. Fix: `shell: process.platform === "win32"`. |
| S20X-nit-02 | `cesta-web/scripts/bundle-size.mjs` | P3 | Fallback silencioso quando manifest ausente: `warn ... bundle gate skipped (no violations)`. Considerar `exit 1` com flag `--require-manifest` para CI-only enforcement. Já tratado parcialmente via `continue-on-error`. |
| S20X-bundle-enforce | CI gate | P2 | Flip `continue-on-error: false` para bundle size pós-baseline review (ver ADR 0019 "Follow-up"). |

Não são blockers do MARCO — vão para rolling nits backlog (memory `project-sprint-109-backlog`).
