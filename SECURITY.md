# Security Policy — Cesta

> Política de segurança para o projeto [Cesta](./README.md) (`cesta-api` + `cesta-web`).
> Fonte da verdade da última atualização: `git log -1 --format=%cs SECURITY.md`.

---

## Reporting a Vulnerability

Reporte vulnerabilidades em privado — **não abra issue pública**.

- **Canal único:** [GitHub Security Advisory privado](https://github.com/ArtudGabriel/cesta/security/advisories/new). Cria draft criptografado, visível apenas aos maintainers do repo, não indexa até publicação.
- **PGP:** desnecessário — GitHub Advisory já criptografa em trânsito + repouso.

Inclua no advisory:
1. Descrição do problema + impacto estimado (confidentiality / integrity / availability).
2. Passo-a-passo pra reproduzir (request/response, credenciais de teste, artefatos mínimos).
3. Versão / commit SHA afetado (`main` ou branch específica).
4. Sugestão de mitigação, se houver.

Não exercitar o problema em produção além do necessário pra confirmar. Não exfiltrar dado real de usuário. Não postar PoC pública antes do fix publicado.

---

## Supported Versions

| Versão | Suportada |
|---|---|
| `main` (último commit) | Sim — único branch com fix garantido |
| Tags/releases anteriores | Não |

Cesta ainda é pré-1.0; só o `main` recebe patch. Fork, branch ou deploy antigo não é coberto.

---

## SLA de Resposta

| Severidade | Triage (primeira resposta) | Fix em produção |
|---|---|---|
| **Critical** (RCE, auth bypass, PII leak massivo) | ≤ 24h | ≤ 7 dias |
| **High** (priv escalation, XSS persistente, SQLi) | ≤ 48h | ≤ 14 dias |
| **Medium** (CSRF, info disclosure limitado) | ≤ 5 dias | ≤ 30 dias |
| **Low** (defense-in-depth, hardening) | ≤ 10 dias | próximo ciclo |

SLA conta em dias úteis. Para dependências com vulnerabilidade upstream, o SLA começa quando o fix upstream fica disponível.

---

## Escopo

### In scope

- `cesta-api` (NestJS) — autenticação, autorização, endpoints REST, workers BullMQ, integrações OCR/email/push.
- `cesta-web` (Next.js) — frontend PWA, API routes, service worker, cookies/storage.
- Repositório GitHub `ArtudGabriel/cesta` — workflows CI/CD, secrets management, branch protection.
- Dependências diretas em `package.json` de ambos os pacotes (via `npm audit` gate).

### Out of scope (infra terceirizada)

- **Vercel** (hosting `cesta-web`) — reportar em https://vercel.com/security
- **Render** (hosting `cesta-api`) — reportar em https://render.com/security
- **Neon** (Postgres) — reportar em https://neon.tech/security
- **Upstash** (Redis + QStash) — reportar em https://upstash.com/trust
- **Sentry** (observability) — reportar em https://sentry.io/security/
- **Resend** (email) — reportar em https://resend.com/security

Issues exclusivamente nessas plataformas devem ser reportadas diretamente a elas. O time Cesta coordena se o problema afeta integração.

---

## GDPR / Privacy

Cesta opera na Comunidade de Madrid → **GDPR aplica**.

- Session Replay (Sentry) roda com `maskAllText: true` + `maskAllInputs: true` + `blockAllMedia: true` + `sendDefaultPii: false`.
- PII do usuário (nome, email, telefone, gastos, membros família, restrições alimentares, listas pessoais) sempre com `data-sentry-mask`.
- Dados nutricionais (Art. 9 GDPR — categorias especiais) nunca saem do backend sem autenticação.
- Contexto completo: [`CLAUDE.md`](./CLAUDE.md) seção "GDPR / Privacy (Sprint 59)".

Vulnerabilidades envolvendo exposure de PII sobem para **Critical** automaticamente.

---

## Processo de disclosure

1. Reporter abre GitHub Security Advisory privado.
2. Maintainer triagia dentro do SLA e confirma recebimento no próprio advisory.
3. Fix desenvolvido em branch privada; patch validado localmente + CI.
4. Fix merge em `main`; deploy produção.
5. Advisory público publicado (CVE quando aplicável) creditando reporter se consentido.
6. Release notes mencionam a correção sem detalhar PoC até 90 dias pós-fix.

---

## Dependency Scanning (CI gate)

- CI roda `npm audit --omit=dev --audit-level=high` em `cesta-api` e `cesta-web` a cada push/PR em `main`.
- **High ou Critical em `dependencies` prod → CI falha, merge bloqueado.**
- Dev dependencies ficam fora do gate (menor blast radius em prod).
- Baseline local reproduzível: `cd cesta-{api,web} && npm audit --omit=dev --audit-level=high`.

---

## Appendix A — Baseline audit (Sprint 79)

Snapshot do primeiro gate pós-SECURITY.md. Data do snapshot: `git log -1 --format=%cs SECURITY.md` (commit inicial do arquivo).

### `cesta-api`

Pré-mitigação:

| Pacote | Severidade | CVE / Advisory | Caminho |
|---|---|---|---|
| `zod` < 4.6.6 | high | [GHSA-mrhx-c7xc-m3w5](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5) (memory exhaustion em oversized collections) | `@vercel/blob` → `@vercel/oidc` → `@vercel/cli-config` → `zod` |

Mitigação aplicada nesta sprint: `package.json` `overrides.zod: "^4.6.6"` — bump minor transitivo sem downgrade de `@vercel/blob` (fix oficial seria `@vercel/blob@2.4.0`, SemVerMajor breaking — deferido).

Pós-mitigação: `0 high · 0 critical` em prod deps (320 total). Gate CI verde.

### `cesta-web`

Pré-mitigação: `0 high · 0 critical` em prod deps (199 total). Nenhuma ação necessária.

### Deferido para Sprint 80+

- `@vercel/blob@2.9.0` → `2.4.0`: downgrade SemVerMajor rompe API do upload que `cesta-api/src/modules/products/products.service.ts` usa. Reavaliar quando `@vercel/oidc` publicar fix forward-compatible.
- Dev-only moderates (8 no `cesta-api`): fora do gate `--omit=dev`. Revisar no próximo sprint de housekeeping.

---

## Contato

- Repositório: https://github.com/ArtudGabriel/cesta
- Maintainer: [@ArtudGabriel](https://github.com/ArtudGabriel)
- Advisories: https://github.com/ArtudGabriel/cesta/security/advisories
