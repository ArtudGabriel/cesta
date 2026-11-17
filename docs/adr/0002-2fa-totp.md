# ADR 0002 — 2FA via TOTP (Sprint 99)

- **Status:** Accepted
- **Date:** 2026-11-17
- **Deciders:** Gabriel Dutra (owner), Claude Code (dev)
- **Supersedes:** —
- **Supersedido por:** —

## Contexto

Cesta armazena PII sensível (nome, email, telefone, nomes de família, restrições alimentares, listas pessoais, gastos mensais em €). GDPR aplica (Espanha). Login hoje é email/senha + JWT. Precisamos oferecer segunda camada opcional de autenticação para:

1. Proteger contas de usuários mais expostos (owners de família com dados dos membros).
2. Reduzir superfície de ataque por credential stuffing.
3. Atender expectativa de produto moderno.

Três opções realistas: TOTP (RFC 6238), SMS, WebAuthn (passkeys).

## Decisão

1. **TOTP via `otplib`** como único método de 2FA no MVP. Secret base32 por usuário, armazenado em `User.twoFactorSecret` **cifrado em repouso** (AES-256-GCM com chave em `env.TWO_FACTOR_ENC_KEY`).
2. **`User.twoFactorEnabled: boolean`** gate explícito; login ignora o fluxo 2FA se `false`.
3. **`User.twoFactorBackupCodes: string[]`** com códigos **hasheados** (bcrypt, mesmo work factor da senha). 10 códigos gerados no enroll, retornados em plain uma única vez na resposta de `/verify`. UI avisa "anote agora, não vamos mostrar de novo".
4. **Fluxo de login em duas fases.** `POST /auth/login` que casa com usuário com `twoFactorEnabled=true` **não** retorna JWT final — retorna `{ status: '2FA_REQUIRED', partialToken }`. `partialToken` é um JWT curto (5 min) com claim `scope: '2fa_pending'`. `POST /auth/2fa/challenge` troca `partialToken + code` por JWT final. Guarda da rota `/challenge` rejeita qualquer token sem o scope.
5. **Enroll em duas etapas** (`/enroll` → `/verify`). Secret pendente vive em cache Redis por 10min com chave `2fa:enroll:{userId}` (não polui o User até confirmado). `verify` move secret pendente → `User.twoFactorSecret` cifrado + habilita.
6. **Backup codes consumidos single-use**. `/recovery` lê array, compara via `bcrypt.compare` contra cada entry, remove o match e re-persiste. UI avisa quantos restam.
7. **`/disable` exige senha + código atual** (defense-in-depth contra session hijack).

## Alternativas consideradas

- **SMS.** Rejeitado: custo variável (Twilio $0.04/sms × España), SIM-swap conhecido, latência de delivery > 10s em redes móveis, dependência externa que pode falhar silenciosamente. Além disso, Cesta já tem user.phone opcional — SMS forçaria coleta obrigatória de telefone.
- **WebAuthn / Passkeys.** Rejeitado para MVP: UX cross-device no PWA ainda é fraca (iOS Safari só faz passkey synced via iCloud, Android via Google Password Manager; fallback Linux desktop é inconsistente). Também não cobre bem o caso "usuário trocou de celular". Candidato pra fase 2 **como método adicional** (coexistir com TOTP).
- **TOTP via Firebase Auth / Clerk / Supabase.** Rejeitado: vendor lock-in num pilar (auth), custo no tier pago e exige migrar o stack atual (JWT home-grown + Prisma). Over-engineering pra uma feature de 300 linhas com `otplib`.
- **Códigos por email em vez de TOTP.** Rejeitado: email não é "algo que você tem"; se o atacante comprometeu a senha, provavelmente tem acesso ao email também.

## Consequências

Positivas:
- Zero custo marginal por login (sem SMS, sem serviço externo).
- Offline no segundo fator (TOTP não precisa de rede para gerar código).
- UX padrão da indústria (usuário já tem Google Authenticator ou Authy).
- Backup codes removem o "e se perder o celular?" sem precisar de SMS fallback.

Negativas:
- Secret cifrado em repouso exige `env.TWO_FACTOR_ENC_KEY` **gerenciada** (adicionar ao Render dashboard + rotação documentada). Perda da chave = perda irreversível de todos os 2FAs ativos.
- Clock skew entre servidor e autenticador do usuário quebra validação. Mitigado: `otplib.authenticator.options.window = 1` (aceita ±30s).
- Usuário sem Google Authenticator / Authy / 1Password precisa instalar algo. Mitigado: UI mostra links/QR para os três mais populares + instruções.

## Observabilidade

- Sentry tag `module: auth.2fa` em erros do fluxo.
- Breadcrumbs: `2fa.enroll.initiated`, `2fa.verify.success`, `2fa.verify.failure`, `2fa.challenge.success`, `2fa.challenge.failure`, `2fa.recovery.consumed` (com `backup_codes_remaining` no data).
- Métrica ad-hoc via log structured: contagem de `failure` por userId em janela de 5min → alerta se > 5 (potencial brute force).
- Session Replay continua com `maskAllInputs: true` — nenhum campo de 2FA (`code`, `backupCode`, `password`) deve vazar.

## Segurança

- **Rate limit 5 tentativas / 15min** em `/challenge` e `/recovery` por partialToken (via `@nestjs/throttler` com override inline — ver ADR 0001).
- Rate limit **30 tentativas / dia** em `/verify` por userId (prevenir brute force do enroll).
- Rate limit **10 tentativas / 15min** em `/disable` por userId.
- Códigos de backup entregues **UMA VEZ**. Backend não tem rota para re-listar.
- `partialToken` com `jti` único, revogado no primeiro uso (prevenir replay).

## Testes (Jest — mínimo 5)

1. `enroll.spec.ts` — gera secret válido base32 + QR data URI + otpauthUrl com issuer "Cesta".
2. `verify.spec.ts` — código correto habilita 2FA + retorna 10 backup codes; código errado retorna 401 sem habilitar.
3. `challenge.spec.ts` — login com 2FA habilitado retorna `2FA_REQUIRED` + partialToken; `/challenge` com code válido emite JWT final; code inválido 401.
4. `recovery.spec.ts` — backup code válido faz login + remove código da lista; mesmo código 2ª vez retorna 401.
5. `disable.spec.ts` — senha + code corretos desabilitam; senha errada ou code errado retorna 401 e mantém habilitado.

## Acceptance Criteria (Given / When / Then — DoD Sprint 99)

1. **Given** usuário logado sem 2FA, **when** `POST /auth/2fa/enroll`, **then** resposta inclui `secret` (base32), `qrCodeDataUri` (data URI PNG) e `otpauthUrl` com formato `otpauth://totp/Cesta:{email}?secret={s}&issuer=Cesta`.
2. **Given** secret pendente válido, **when** `POST /auth/2fa/verify` com código TOTP correto, **then** resposta inclui `enabled: true` + `backupCodes: string[10]`; segunda chamada do mesmo endpoint retorna 409.
3. **Given** usuário com `twoFactorEnabled=true`, **when** `POST /auth/login` com credenciais válidas, **then** resposta é `{ status: '2FA_REQUIRED', partialToken }` sem JWT; `POST /auth/2fa/challenge` com `partialToken + code` TOTP correto emite `accessToken + refreshToken`.
4. **Given** usuário com 2FA habilitado + backup codes disponíveis, **when** `POST /auth/2fa/recovery` com `partialToken + backupCode` válido, **then** emite JWT final; `GET /auth/me` não retorna o código consumido e segunda chamada com mesmo código retorna 401.
5. **Given** 2FA habilitado, **when** `POST /auth/2fa/disable` com `password + code` corretos, **then** `User.twoFactorEnabled` vira `false`, `twoFactorSecret` e `twoFactorBackupCodes` são apagados; próximo login volta a ser single-factor.
