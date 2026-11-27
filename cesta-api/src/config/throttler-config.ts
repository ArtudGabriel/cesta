/**
 * Sprint 227 retro (Reviewer 2026-11-27 14:04 · bug throttler strict global
 * bateu 3× — S98 → S227 bundle 1): named throttlers em @nestjs/throttler
 * forRoot aplicam-se A TODAS AS ROTAS simultaneamente. Um limite apertado
 * global (strict:5/60s) corta browsing publico silencioso e nao e obvio
 * ler de app.module.ts em PR review (assinatura `name:'strict'` da falsa
 * sensacao de scope).
 *
 * Config movida para arquivo dedicado + spec associado (throttler-config
 * .spec.ts) ancora regressao: strict + write devem ser "no-op globais"
 * (limit >= STRICT_GLOBAL_NO_OP_THRESHOLD) OR removidos de forRoot. Rotas
 * que precisam limite apertado usam @Throttle({strict:{limit:5,...}})
 * inline override pela rota especifica.
 */
export const STRICT_GLOBAL_NO_OP_THRESHOLD = 1_000;

export interface ThrottlerEntry {
  name: string;
  ttl: number;
  limit: number;
}

export const THROTTLER_CONFIG: ThrottlerEntry[] = [
  { name: 'default', ttl: 60_000, limit: 120 },
  { name: 'strict', ttl: 60_000, limit: 10_000 },
  { name: 'write', ttl: 60_000, limit: 10_000 },
];
