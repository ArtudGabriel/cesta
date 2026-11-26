# ADR 0011 — CJS Import Strategy (cesta-api)

**Status:** Accepted
**Date:** 2026-11-26
**Sprint:** S178 (preventivo pós-S177 HOTFIX P1 `sharp` crash prod)

## Context

cesta-api `tsconfig.json` historicamente omitia `esModuleInterop`, mantendo apenas `allowSyntheticDefaultImports: true`. A combinação é sintaticamente permissiva (TS aceita `import X from 'pkg'`) mas semanticamente quebrada em runtime para bibliotecas CJS puras cujo `module.exports = fn` não possui propriedade `.default`.

### Falhas observadas

- **S?** HTML-scrape adapters: `require()` + `resolve unwrap` aplicado point-by-point (memory `feedback-ts-cjs-default-import`).
- **S177** HOTFIX P1 prod: `import sharp from 'sharp'` → TS emitiu `sharp_1.default` → runtime `undefined` → `(0, sharp_1.default) is not a function` ao chamar `sharp(imagePath)` dentro do OCR worker, crashando todo upload de ticket.

### Audit

Backend tinha apenas 2 default imports (`helmet`, `ioredis` — ambos felizmente escrevem `.default` via workaround própria) + 4 namespace imports CJS puros usados como função/construtor (`compression`, `cookie-parser`, `jszip` em 2 locais) que compilavam só por acaso via quirk do TS 5.

## Decision

**Opção A — Enable `esModuleInterop: true` na raiz do `tsconfig.json` (cesta-api).**

Rejeitada Opção B (continuar patches point-by-point com `require()` + `unwrap`) porque:

1. Não escala — cada novo CJS puro no projeto exige lembrar do patch (regressão silenciosa até produção).
2. Ruído visual — `require() + unwrap` comment pattern duplicado em cada arquivo.
3. Opção A é standard NestJS boilerplate; dev onboarding espera.

### O que `esModuleInterop: true` faz em runtime

TS passa a emitir o helper `__importDefault`:

```js
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
const sharp_1 = __importDefault(require("sharp"));
// sharp_1.default agora é a factory função
```

Para ESM libs reais (helmet 8+, lodash-es, etc) o `__esModule` flag existe e `mod` passa direto. Para CJS puros (`sharp`, `compression`, `cookie-parser`, `jszip`) o wrapper `{default: mod}` é criado, permitindo `.default` apontar pra factory function.

Comportamento 100% backward-compatible para imports que já funcionavam.

## Consequences

### Positive

- Default imports funcionam universalmente para CJS + ESM libs.
- Zero patches `require + unwrap` ongoing — S177 fix revertido para `import sharp from 'sharp'` canônico.
- Alinha cesta-api ao padrão NestJS/TypeScript community.
- Preventivo: novos imports CJS puros no futuro funcionam sem surpresa.

### Negative

- 4 `import * as X from 'pkg'` (namespace imports usados como função/construtor) precisaram converter para default imports porque TS agora corretamente marca namespace como não-callable/constructable. Correção mecânica:
  - `src/main.ts`: `import * as compression from 'compression'` → `import compression from 'compression'`
  - `src/main.ts`: `import * as cookieParser from 'cookie-parser'` → `import cookieParser from 'cookie-parser'`
  - `src/modules/imports/imports-parse.util.ts`: `import * as JSZip from 'jszip'` → `import JSZip from 'jszip'`
  - `src/modules/users/users-export.util.ts`: idem.
  - 2 spec files (jszip): idem.
- Bundle emit ganha `__importDefault` helper (~15 bytes) por arquivo com default import — negligível.

### Neutral

- cesta-web frontend fora de escopo deste ADR (Next.js + Vite têm interop por padrão).

## Alternatives considered

- **B — Patches point-by-point** `require('pkg')` + `(pkg as {default?}).default ?? pkg`. Funciona mas acumula dívida técnica + risco regressão em cada novo CJS lib. Rejeitado.
- **C — Migrar para `moduleResolution: 'bundler'` + `module: 'esnext'`** com downstream `ts-node --esm` / Node ESM nativo. Scope muito maior (afeta Jest config, require paths, build output). Deferido para possível ADR futuro.

## Verification

- `cesta-api` jest: 500/500 pass (sem regressão nas 53 test suites)
- `cesta-api` nest build: OK
- Spec regression `receipts.processor.spec.ts` (S177) continua passando — valida que default import canônico funciona em runtime via helper.

## References

- Memory `feedback-ts-cjs-default-import` (padrão identificado S?-S178)
- S177 HOTFIX P1 PR#134 (ponto crítico prod)
- TS docs: https://www.typescriptlang.org/tsconfig#esModuleInterop
