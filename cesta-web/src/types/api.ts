/**
 * Sprint 210 — barrel over generated OpenAPI types.
 *
 * Fonte: cesta-api OpenAPI spec dumped em build CI + openapi-typescript
 * → `src/types/generated/api.baseline.d.ts` (committed, drift-checked S209
 * ADR 0022). Consumers (services/hooks/E2E mocks) importam `Schemas`/
 * `Operations` daqui e referenciam DTOs pelo nome do schema:
 *
 *   import type { Schemas } from "@/types/api";
 *   type CreateAlertPayload = Schemas["CreateAlertDto"];
 *
 * Política (ADR 0023): adoção INCREMENTAL por request payload DTOs.
 * Response DTOs com campos nullable permanecem handcrafted até backend
 * fixar `@ApiProperty({ type: X, nullable: true })` — baseline hoje
 * emite `Record<string, never> | null` nesses campos (openapi-typescript
 * output quando OpenAPI não especifica tipo + nullable).
 */

import type { components, operations } from "./generated/api.baseline";

export type Schemas = components["schemas"];
export type Operations = operations;
