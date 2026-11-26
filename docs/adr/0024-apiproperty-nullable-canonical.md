# ADR 0024 — `@ApiProperty` nullable canonical pattern (backend response DTOs)

**Status:** Accepted — Sprint 211 (2026-11-26)

**Depends on:** ADR 0021 (OpenAPI Swagger scope), ADR 0022 (openapi-typescript CI gate), ADR 0023 (API type adoption policy)

## Contexto

S210 (ADR 0023) migrou request payloads do frontend pros types gerados pelo `openapi-typescript` a partir do spec do `cesta-api`. Response DTOs com campos nullable ficaram FROZEN: o baseline `cesta-web/src/types/generated/api.baseline.d.ts` emitia `Record<string, never> | null` nesses campos — type inutilizável (primitivos não assignam pra `{}`).

Root cause: no backend, `@ApiProperty({ nullable: true })` (sem `type:`) gera schema OpenAPI com `nullable: true` mas sem shape. `openapi-typescript` encontra schema vazio e cai no `Record<string, never>`.

Exemplo do bug:

```ts
// backend (ruim)
@ApiProperty({ nullable: true }) brand: string | null;
```

Yields em `spec.json`:

```yaml
brand:
  nullable: true
```

Que vira:

```ts
// baseline.d.ts
brand: Record<string, never> | null;  // inutilizável
```

Audit em S211 (`scripts/audit-response-dtos.mjs`) encontrou **71 offenders** em **20 arquivos** — essencialmente todos os response DTOs com campo nullable.

## Decisão

### Pattern canonical

Todo `@ApiProperty` que declara `nullable: true` MUST declarar `type:` explícito no mesmo options object, matching o TS type do campo:

```ts
// primitivos
@ApiProperty({ type: String, nullable: true }) brand: string | null;
@ApiProperty({ type: Number, nullable: true }) price: number | null;
@ApiProperty({ type: Date, nullable: true }) deletedAt: Date | null;
@ApiProperty({ type: Boolean, nullable: true }) isFeatured: boolean | null;

// arrays
@ApiProperty({ type: [String], nullable: true }) tags: string[] | null;
@ApiProperty({ type: [ItemDto], nullable: true }) items: ItemDto[] | null;

// classes (lazy ref pra evitar circular)
@ApiProperty({ type: () => UnitPriceDto, nullable: true })
unitPrice: UnitPrice | null;

// JSON arbitrário (sem schema shape útil)
@ApiProperty({ type: Object, nullable: true, description: 'JSON arbitrário' })
metadata!: unknown;
```

### Quando usar `@ApiPropertyOptional`

`@ApiPropertyOptional({ type: X, nullable: true })` aplica quando o campo é **tanto opcional (`?:` no TS) quanto nullable**. Semântica distinta de `@ApiProperty({ required: false, nullable: true })`:

- `required: false` → campo pode estar ausente da resposta (chave omitida).
- `nullable: true` → campo está presente mas valor pode ser `null`.
- Ambos → opcional **e** nullable (rare; prefer um dos dois).

Pra response DTO, normalmente `nullable: true` basta: sempre serializamos a chave, com valor possivelmente `null`.

### Quando NÃO usar `nullable: true`

Field que nunca retorna `null` não ganha `nullable: true` só porque o Prisma tipa como `| null`. Se o `fromEntity(...)` garante non-null (ex: coerção `?? 0`), deixe o schema como non-nullable e tipe o field no DTO como non-null também.

### Enums + nullable

Enum nullable OK sem `type:` — `enum:` já dá shape ao schema:

```ts
@ApiProperty({ enum: Status, nullable: true }) status: Status | null;
```

### oneOf + nullable (expressão mais fiel ao JSON Schema)

Pra união complexa, use `oneOf` ao invés de `type:`:

```ts
@ApiProperty({ oneOf: [{ $ref: getSchemaPath(FooDto) }, { type: 'null' }] })
foo: FooDto | null;
```

Esta sprint não migrou nenhum DTO pra `oneOf` — `type: () => Foo` + `nullable: true` já destrava o frontend. `oneOf` fica reservado pro caso de união legítima (ex: `FooDto | BarDto | null`).

## Trade-offs

**`type:` explícito vs `oneOf`:**

| Opção | Pros | Cons |
|---|---|---|
| `{ type: X, nullable: true }` | Verbose mínimo; openapi-typescript materializa `X \| null` limpo. | Mentira parcial no spec (Swagger emite `nullable: true` como extensão OAS 3.0; OAS 3.1 prefere `oneOf`). |
| `{ oneOf: [{ $ref }, { type: 'null' }] }` | Fiel ao JSON Schema; semântica clara. | Verbose; precisa `getSchemaPath`; frontend lida com union discriminator. |

**Decisão:** `type:` explícito vence pela ergonomia e pelo fato do `@nestjs/swagger@7.x` ainda emite OAS 3.0 por default. Revisitar quando migrarmos pra OAS 3.1.

**`Object` vs classe real pra JSON arbitrário:**

`metadata!: unknown` (admin audit log) e `summary!: ImportSummary | null` (import) foram patched com `type: Object`:

- Admin `metadata` é intencionalmente livre por tipo de audit event → `Object` fiel.
- Import `summary` tem shape definida em `interface ImportSummary` — interface TS não carrega metadata runtime. Pra schema fiel, teria que converter pra `class ImportSummaryDto` com `@ApiProperty` em cada campo. Deferido: frontend consome como `Record<string, unknown> | null`. Follow-up `Sprint 212+` se o form de review de import precisar typing fiel.

## Migration path (Sprint 211 executado)

1. ✅ Script `scripts/audit-response-dtos.mjs` — percorre `cesta-api/src/**/*.ts`, extrai `@ApiProperty({ ... nullable: true ... })` sem `type:` nem `enum:` nem `oneOf:`, emite tabela markdown ou JSON com fix sugerido.
2. ✅ Aplicou fix em **71 fields / 20 arquivos**. Replace in place, zero `_v2`, zero fallback.
3. ✅ Regenerou `cesta-web/src/types/generated/api.baseline.d.ts` via `npm run types:api`. Diff: `Record<string, never>` → `string|number|Date \| null` em todos fields migrados.
4. ✅ `npm run types:api:check` OK — baseline matches live spec.
5. ⏭ **S212+**: migrar response types handcrafted no frontend (`features/*/types/*.types.ts`) pra `Schemas["XxxResponseDto"]` agora que baseline carrega types concretos. Deletar handcrafted duplicates.

## Enforcement contínuo

Audit script fica committed em `scripts/audit-response-dtos.mjs`. Rodagem manual:

```bash
node scripts/audit-response-dtos.mjs           # markdown report
node scripts/audit-response-dtos.mjs --count   # contagem
node scripts/audit-response-dtos.mjs --json    # JSON structured
```

**Opcional (S212+):** adicionar CI step que falha se `audit-response-dtos.mjs --count > 0` previne regressão silenciosa. Não aplicado em S211 pra não acoplar duas sprints.

## Consequências

### Positivas

- Frontend finalmente pode consumir response DTOs direto do baseline → encerra defer S210 de response types.
- Audit script committed previne regressão: dev que adiciona `@ApiProperty({ nullable: true })` novo sem `type:` pode rodar o script e descobrir imediatamente.
- Schema OpenAPI emitido fica mais informativo pra qualquer consumer externo (SDK gen, Postman, etc).

### Negativas / trade-offs

- `type: Object` pra JSON arbitrário emite schema fraco (apenas "it's an object"). Aceitável pra audit metadata; menos ideal pra import summary (follow-up noted).
- `@nestjs/swagger` default emite `nullable: true` (OAS 3.0 extension). Pra puristas OAS 3.1, `oneOf` seria mais correto — adiado.

### Riscos

- Audit script usa regex sobre source code; pode ter falso-negativo em casos exóticos (ex: decorator options montados dinamicamente, spread operator em config). Mitigação: script é opt-in, não bloqueia CI; dev sempre pode fazer manual audit quando necessário.

## Referências

- S210 ADR 0023: API type adoption policy
- S209 ADR 0022: openapi-typescript CI gate
- S208 ADR 0021: OpenAPI Swagger scope
- Issue upstream `@nestjs/swagger` nullable without type: documentação não cobre explicitamente, mas comportamento é consequência de `nullable: true` ser OAS 3.0 extension sem shape implícita.
