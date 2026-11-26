# GitHub Actions — Repository Secrets

Documenta secrets usados pelos workflows em `.github/workflows/` (Sprint 216,
ADR 0026). Setar via **Settings → Secrets and variables → Actions** no repo
`ArtudGabriel/cesta`.

## Workflow `backfill-images.yml` (nightly cron)

Move cron backfill-images pro runner GitHub Actions pra tirar o outbound R2
de dentro do Render Hobby (ADR 0025).

### Secrets obrigatórios

| Secret                 | Origem                                                 | Uso no script                          |
| ---------------------- | ------------------------------------------------------ | -------------------------------------- |
| `DATABASE_URL`         | Neon Launch · connection string com `?sslmode=require` | `PrismaClient` → `findMany/update`      |
| `R2_ACCESS_KEY_ID`     | Cloudflare R2 · API token do bucket `cesta-products`   | `R2StorageService` → `PutObjectCommand` |
| `R2_SECRET_ACCESS_KEY` | Cloudflare R2 · API token do bucket                    | idem                                    |
| `R2_BUCKET`            | `cesta-products`                                       | key `products/{id}.{ext}`               |
| `R2_PUBLIC_BASE_URL`   | CDN público R2 · `https://pub-<hash>.r2.dev` ou domínio custom | `getPublicUrl(key)` + `isManagedUrl`    |

### Secrets opcionais

| Secret            | Quando setar                                                 |
| ----------------- | ------------------------------------------------------------ |
| `R2_ACCOUNT_ID`   | Default: endpoint `https://<account>.r2.cloudflarestorage.com` |
| `R2_S3_ENDPOINT`  | Alternativo (sandbox / jurisdiction-specific EU override)    |

Pelo menos **um** entre `R2_ACCOUNT_ID` ou `R2_S3_ENDPOINT` precisa estar
definido (standalone script valida isso antes de rodar).

### Fonte local pra copiar valores

- `$env:USERPROFILE\.claude\secrets\cloudflare-r2.env` (bucket cesta-products EU)
- `$env:USERPROFILE\.claude\secrets\render.env` (DATABASE_URL sync via Render)

### Trigger manual

Pra testar sem esperar o cron 03:00 UTC:

```
gh workflow run backfill-images.yml -f limit=20
```

Reduz `--limit` em smoke test pra economizar minutos GHA free tier.

### Observabilidade

- Logs: `gh run list --workflow=backfill-images.yml --limit=5`
- Resumo: stdout do step **Run backfill** mostra
  `scanned=N uploaded=M fallback=F errored=E`.
- Falha súbita (missing env, Prisma connect fail): workflow termina `exit 1`,
  GitHub envia e-mail de notification pro owner.

## Outros workflows

- `ci.yml`, `e2e.yml`, `keep-alive.yml` — não dependem de secrets custom (OSS
  defaults: `GITHUB_TOKEN` apenas).
