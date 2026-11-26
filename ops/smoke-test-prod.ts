#!/usr/bin/env node
/**
 * smoke-test-prod.ts
 *
 * Automated regression suite S179-S187 contra prod cesta-gsvc.onrender.com.
 * Executar pós-restoration (ADR 0017) para confirmar retorno antes de:
 *   1. Marcar sprints S187/S186/S185 empíricos como validated em vault
 *   2. Publicar próxima feature sprint (unblock loop)
 *
 * Checks (G1 S188):
 *   - /health 200
 *   - /products total ≥8500 (baseline S186: ~9500; threshold -10%)
 *   - 6 supers ativos (mercadona, dia, eroski, froiz, aldi, lidl)
 *   - fuzzy chain determinístico 3-runs: lecge→Leche top, yogrt→Yogur top,
 *     yoguer→Yogur top (S185 tiebreak char_length ASC)
 *   - imageUrl coverage ≥70% dos top produtos (S133 blob pipeline preservado)
 *
 * Output: pass/fail por seção, resumo final, exit code 0=pass 1=fail.
 *
 * Usage:
 *   API_BASE=https://cesta-gsvc.onrender.com/api/v1 node --import tsx smoke-test-prod.ts
 *   API_BASE=http://localhost:3001/api/v1 node --import tsx smoke-test-prod.ts
 *
 * Env:
 *   API_BASE        required; prod default comentado abaixo
 *   FETCH_TIMEOUT   optional ms, default 15000
 */

import { runSmokeSuite, type Deps } from './smoke-test-prod.lib.js';

const API_BASE =
  process.env.API_BASE ?? 'https://cesta-gsvc.onrender.com/api/v1';
const FETCH_TIMEOUT = Number(process.env.FETCH_TIMEOUT ?? 15_000);

async function httpJson(path: string): Promise<unknown> {
  const url = `${API_BASE}${path}`;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { accept: 'application/json' },
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status} ${url}`);
    }
    return await res.json();
  } finally {
    clearTimeout(t);
  }
}

const deps: Deps = {
  httpJson,
  log: (msg) => process.stdout.write(msg + '\n'),
};

runSmokeSuite(deps)
  .then((report) => {
    process.exit(report.passed ? 0 : 1);
  })
  .catch((err) => {
    process.stderr.write(`FATAL: ${err instanceof Error ? err.message : String(err)}\n`);
    process.exit(2);
  });
