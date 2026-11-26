# ADR 0023 — API type adoption policy (frontend consumes generated types)

**Status:** Accepted — Sprint 210 (2026-11-26)

**Depends on:** ADR 0021 (OpenAPI Swagger scope), ADR 0022 (openapi-typescript CI gate)

## Contexto

S209 shipped `openapi-typescript` CI gate + committed baseline `cesta-web/src/types/generated/api.baseline.d.ts`. Payoff pendente era migrar frontend consumers (services, hooks, E2E mocks) dos types handcrafted para os generated, prevenindo drift silenciosa.

S210 atacou a migração e descobriu uma classe de problemas no backend:

**Nullable `@ApiProperty` leak.** Vários DTOs usam `@ApiProperty({ nullable: true })` SEM especificar `type: String|Number|...`. Resultado no OpenAPI spec:

```yaml
cheapestTotal:
  nullable: true
```

Sem `type`, openapi-typescript emite:

```ts
cheapestTotal: Record<string, never> | null;
```

Que é `{} | null` em TS, inutilizável — primitivos (string/number) não são assignáveis a `Record<string, never>`. Response DTOs afetados: `ShoppingListResponseDto`, `ReviewResponseDto`, `AlertResponseDto`, `AlertTriggerDto`, `ProductResponseDto`, `PriceByMarketDto`, `UserResponseDto`, `SoftDeletedUserRowDto`, `AuditLogRowDto`, `FamilyBasketResponseDto`, outros.

Request DTOs **não** têm esse problema porque campos opcionais são expressados via `?:` em TS.

## Decisão

### Adoção incremental por tipo de payload

| Categoria | Política | Exemplo |
|---|---|---|
| **Request payloads** (POST/PATCH body, PUT body) | **Adotar baseline** via `Schemas["XxxDto"]` alias | `type CreateAlertPayload = Schemas["CreateAlertDto"]` |
| **Query params** | **Adotar baseline** via `Operations["XxxController_findMany"]["parameters"]["query"]` | `type ProductFilters = Pick<FindManyQuery, ...>` |
| **Response DTOs com nullable fields** | **Handcrafted FROZEN** até backend fixar `@ApiProperty({ type, nullable })` | `Alert`, `Review`, `ShoppingList`, `Product` ficam em `features/*/types/*.types.ts` |
| **Response DTOs sem nullable fields** | **Adotar baseline** | `AdapterListResponseDto`, `CancelDeleteResponseDto` etc |

### Barrel import

Consumers importam `Schemas` + `Operations` de `@/types/api` (barrel thin sobre `api.baseline.d.ts`). Nunca importar `api.baseline.d.ts` direto — o barrel isola trocas futuras do caminho gerado.

### Replace in place, sem paralelismo

Zero types `_v2`. Zero fallback. Handcrafted response types ficam ATÉ o backend fixar — não há interface paralela.

## Consequências

### Positivas

- Request payloads ganham drift-check automático via S209 CI gate.
- Query filter types alinham UI com backend (previne 400 de param desconhecido).
- E2E mock types referenciam feature types canônicas (zero divergência entre teste e código prod).
- ADR explícito ancorará S211+ scope de backend `@ApiProperty` fix.

### Negativas / trade-offs

- Response DTO migration deferida até backend fix → sprint útil mas não total payoff.
- Pick<> + intersect no `ProductFilters` adiciona uma camada de indirect — justificado pela restrição S151.

### Riscos

- Frontend form validation (`zod`) continua handcrafted — drift possível entre schema zod e DTO baseline. Mitigação: S211+ considerar codegen Zod a partir do OpenAPI (ex: `openapi-zod-client`).

## S211+ follow-up

1. **Backend `@ApiProperty` nullable fix.** Audit controllers com nullable fields + migrar pra pattern:
   ```ts
   @ApiProperty({ type: String, nullable: true, example: "..." })
   nome!: string | null;
   ```
2. **Response DTO adoption wave.** Pós backend fix, deletar handcrafted response types + adotar `Schemas["XxxResponseDto"]`.
3. **Zod ↔ OpenAPI alignment.** Avaliar `openapi-zod-client` ou gerar Zod a partir do spec.
4. **Family-basket + favorites adoption.** Deferred S210 (focou top 5 mais usados).

## Referências

- S209 ADR 0022: openapi-typescript CI gate
- S208 ADR 0021: OpenAPI Swagger scope (17/17 controllers)
- openapi-typescript upstream: https://openapi-ts.dev/
