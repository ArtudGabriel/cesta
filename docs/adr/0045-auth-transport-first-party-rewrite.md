# ADR 0045 — Auth transport first-party via Next rewrite

- **Data:** 2026-11-28
- **Sprint:** S243c (URGENTE · Boss diagnosticou prod · plano direção A autorizado)
- **Status:** Aceito
- **Relaciona:** S54 (refresh cookie httpOnly), S60 (axios refresh interceptor singleflight), S87 (singleflight race fix)

## Contexto

Prod atual: frontend `cesta-web.vercel.app` + backend `cesta-gsvc.onrender.com`. Pela Public Suffix List, **são sites diferentes**. Qualquer request XHR do front pro backend é cross-site.

Fluxo auth existente:
1. `POST /auth/login` → backend seta `refresh_token` cookie (httpOnly, Secure, SameSite=lax, path=/, **sem Domain**). Access token (JWT 15min) volta no response body.
2. Frontend persiste access em `localStorage` + `document.cookie` (vercel.app, SameSite=lax) pra o SSR (`receipt.server.ts`) reconstruir `Authorization: Bearer` via `next/headers`.
3. Pós 15min, access token expira. Axios interceptor response pega 401 → `fetch(/auth/refresh, credentials: 'include')` → espera cookie refresh ser enviado.

**Bug**: o browser não envia o cookie refresh. Causas combinadas:
- **SameSite=lax + XHR cross-site**: browser moderno não anexa cookie SameSite=lax em request XHR cross-site (só em navegação top-level).
- **iPhone Safari ITP**: mesmo subindo pra `SameSite=None; Secure`, Safari bloqueia cookie third-party pós 7d sem interação user.

Refresh retorna 401 → `setAccessToken(null)` apaga localStorage → próxima ação logada vai sem `Authorization` → backend `jwt-auth.guard.ts:34` lança **"Token ausente"**. Usuário é deslogado silenciosamente a cada 15min.

Boss diagnosticou prod 2026-11-28 ao testar iPhone Safari. "Token ausente" no `/receipts POST` pós tempo. Reprodução consistente.

## Decisão

### Proxy transparente via Next rewrite

`next.config.ts` ganha `rewrites()`:
```ts
async rewrites() {
  const upstream = process.env.API_UPSTREAM?.replace(/\/+$/, "");
  if (!upstream) return [];
  return [
    { source: "/api/v1/:path*", destination: `${upstream}/api/v1/:path*` },
  ];
}
```

- `API_UPSTREAM` é **server-side only** (sem `NEXT_PUBLIC_`). Em prod = `https://cesta-gsvc.onrender.com`. Em dev vazio → rewrite é no-op.
- `source` já contém `/api/v1`. `destination` reconstrói o full path no upstream.

Frontend (`lib/api.ts`) passa a usar `baseURL` relativo:
```ts
const DEFAULT_API_BASE_URL =
  process.env.NODE_ENV === "production" ? "/api/v1" : "http://localhost:3001/api/v1";
baseURL: process.env.NEXT_PUBLIC_API_URL ?? DEFAULT_API_BASE_URL,
```

Browser vê todas as calls como mesmo origin `cesta-web.vercel.app`. XHR não é mais cross-site.

### Set-Cookie passthrough

Backend seta refresh cookie sem `Domain=` attribute. Spec RFC 6265: na ausência de `Domain`, o browser atribui o cookie ao **host do request**. Via rewrite Vercel, o host do request é `cesta-web.vercel.app`. Browser atribui refresh cookie ao domínio vercel.app → cookie passa a ser **first-party**.

Set-Cookie fluxo via Next rewrite:
- Request: browser → vercel.app/api/v1/auth/login
- Rewrite: vercel.app → cesta-gsvc.onrender.com/api/v1/auth/login (server-to-server, interno)
- Response: backend → Set-Cookie: refresh_token=...; HttpOnly; Secure; SameSite=lax; Path=/
- Rewrite: resposta inalterada chega ao browser (Next.js rewrites forward response headers, incluindo Set-Cookie — confirmado em docs oficiais Vercel e spec `next.config.js#rewrites`).
- Browser atribui cookie ao domínio vercel.app (first-party).

Subsequentes XHR `fetch('/api/v1/auth/refresh', credentials: 'include')` são same-origin → browser envia cookie → backend recebe → refresh funciona.

### SSR path inalterado

`receipt.server.ts` continua chamando o upstream direto via `API_URL` (`https://cesta-gsvc.onrender.com/api/v1`). Server-to-server, sem browser, sem SameSite. Não há razão pra rotear via Vercel edge (hop extra desnecessário).

## Boss guards (vinculantes)

| # | Guard | Evidência |
|---|-------|-----------|
| 1 | Rewrite ADITIVO | `rewrites()` novo em next.config.ts · sem touch em redirects, images, turbopack |
| 2 | Zero schema change | DB intocado · auth fluxo preservado · só muda caminho de transporte |
| 3 | Set-Cookie passthrough | Documentado Next.js rewrites + validado via E2E WebKit |
| 4 | Latência extra medida | PR body anota cdg1 (Vercel edge) → oregon (Render) hop extra |
| 5 | Rollback curto | `git revert <SHA>` + deploy Vercel reverte · OR unset `API_UPSTREAM` env → rewrite vira no-op |
| 6 | Spec coverage | Unit test rewrite function + E2E Playwright WebKit iPhone DoD 4 passos |
| 7 | G0 archive | docs/archive/pendente-note-2026-11-28-s243c.md + sprints-note-2026-11-28-s243c.md |
| 8 | 4 .md gate | CLAUDE.md + cesta.md + identidade + consolidado cross-check (zero cor hardcoded · S243c é infra/transporte, fora roadmap feature mas Boss P0 urgente) |

## E2E DoD (Playwright WebKit iPhone)

4 passos vinculantes:
1. **Login** com email+senha → session cookie first-party + access token em localStorage.
2. **Upload ticket** → POST `/api/v1/receipts` → 200/202 com jobId.
3. **Expirar access** → `localStorage.removeItem('cesta_access_token')` + `document.cookie = 'cesta_access_token=; max-age=0'`.
4. **Nova ação logada** (GET `/api/v1/receipts`) → axios 401 → interceptor refresh → novo access → retry → 200. **SEM modal LoginGate**.

## Rollback

### Immediate (feature flag via env)

Unset `API_UPSTREAM` env no Vercel → `rewrites()` retorna `[]` → próximo deploy sem proxy. Frontend precisa também voltar baseURL absoluto, então o rollback completo é via `git revert`.

### Revert commit

`git revert <sha_commit_s243c>` + push → Vercel auto-deploy reverte. Retornam todos os sintomas pré-S243c.

### Rollback parcial (manter rewrite, voltar lib/api.ts)

Se descobrirem problema no baseURL relativo mas rewrite funcionar, reverter só `lib/api.ts` pra `process.env.NEXT_PUBLIC_API_URL`. Consumer ainda pode setar var com valor absoluto se preferir.

## Trade-offs

- **Latência extra**: 1 hop Vercel edge → Render. Vercel cdg1 (Europa) → Render oregon (US West) ≈ **150-250ms RTT adicional** vs call direto. Aceitável vs sessão quebrada 15min. Alternativa longo prazo: mover backend pra Vercel edge functions OU mesma região Vercel.
- **Vercel bandwidth**: todo tráfego API agora conta no quota Vercel Hobby (100GB/mês). API responses são JSON pequenos (<10KB típico) → risco baixo atual.
- **Debugging**: logs de request passam primeiro pela Vercel edge, então Render; falhas edge vs upstream precisam diferenciar nos dois places.
- **Env vars drift**: `API_URL` (SSR direct) e `API_UPSTREAM` (rewrite) passam a ser 2 vars correlacionadas. Risco de dev setar uma e esquecer outra. Mitigado: `.env.example` documenta ambas com comentário cross-referenciado.

## Consequências

- iPhone Safari ITP não quebra mais refresh (cookie é first-party agora).
- SameSite=lax funciona porque XHR é same-origin.
- `withCredentials: true` preservado — browser mantém regra de não enviar cookies em XHR mesmo same-origin sem flag.
- Zero mudança backend (stays stateless re: transporte).
- Zero mudança SSR (receipt.server.ts chama direto via `API_URL`).
- Rollback via revert + redeploy — menor que 2min de downtime.
