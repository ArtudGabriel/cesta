#!/usr/bin/env node
/**
 * Sprint 209 — openapi-typescript CI gate (ADR 0022).
 *
 * Gera TypeScript types do frontend a partir do spec OpenAPI do cesta-api.
 * Fluxo:
 *   1. Obter spec OpenAPI (padrão: spawn `npm --prefix ../cesta-api run openapi:dump`;
 *      override via `--from <path>` pra reusar spec previamente dumped).
 *   2. Rodar `openapi-typescript` sobre o spec → candidate .d.ts em stdout.
 *   3. Modo default (write): sobrescrever baseline committed `src/types/generated/api.baseline.d.ts`.
 *      Dev faz `git diff` pra conferir mudança e commita.
 *   4. Modo `--check` (CI gate): não escrever; comparar candidate vs baseline committed;
 *      exit 1 se drift sem baseline update.
 *
 * Usage:
 *   node scripts/generate-api-types.mjs                   # regen + overwrite baseline
 *   node scripts/generate-api-types.mjs --check           # CI drift gate
 *   node scripts/generate-api-types.mjs --from path.json  # reuse committed spec file
 *
 * Baseline committed em `src/types/generated/api.baseline.d.ts`. Outros arquivos
 * gerados são gitignored (ver `src/types/generated/.gitignore`).
 */

import { spawnSync } from 'node:child_process';
import {
  readFileSync,
  writeFileSync,
  mkdirSync,
  existsSync,
  mkdtempSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const WEB_ROOT = resolve(__dirname, '..');
const REPO_ROOT = resolve(WEB_ROOT, '..');
const API_ROOT = resolve(REPO_ROOT, 'cesta-api');
const BASELINE_PATH = resolve(
  WEB_ROOT,
  'src/types/generated/api.baseline.d.ts',
);

export function parseArgs(argv) {
  const args = { check: false, from: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--check') args.check = true;
    else if (a === '--from') args.from = argv[++i];
    else if (a.startsWith('--from=')) args.from = a.slice('--from='.length);
  }
  return args;
}

/**
 * Normaliza output do openapi-typescript pra comparação estável:
 * - newlines LF consistentes (CI linux vs dev windows).
 * - trim trailing whitespace por linha.
 * - garante trailing newline único.
 */
export function normalizeTypes(text) {
  if (typeof text !== 'string') return '';
  const lf = text.replace(/\r\n/g, '\n');
  const trimmed = lf
    .split('\n')
    .map((line) => line.replace(/[ \t]+$/g, ''))
    .join('\n');
  return trimmed.replace(/\n+$/, '') + '\n';
}

/**
 * Compara baseline vs candidate. Retorna { changed, unifiedDiff }.
 * unifiedDiff é compacto (first 40 diff lines) pra output CI legível.
 */
export function computeDrift(baselineText, candidateText) {
  const a = normalizeTypes(baselineText);
  const b = normalizeTypes(candidateText);
  if (a === b) return { changed: false, unifiedDiff: '' };

  const aLines = a.split('\n');
  const bLines = b.split('\n');
  const max = Math.max(aLines.length, bLines.length);
  const out = [];
  let shown = 0;
  for (let i = 0; i < max && shown < 40; i++) {
    const left = aLines[i];
    const right = bLines[i];
    if (left === right) continue;
    if (left !== undefined) {
      out.push(`- L${i + 1}: ${left.slice(0, 200)}`);
      shown++;
    }
    if (right !== undefined && shown < 40) {
      out.push(`+ L${i + 1}: ${right.slice(0, 200)}`);
      shown++;
    }
  }
  if (max > shown) out.push(`… (${max - shown} more lines differ, truncated)`);
  return { changed: true, unifiedDiff: out.join('\n') };
}

function dumpSpec({ apiRoot = API_ROOT } = {}) {
  const result = spawnSync(
    'npm',
    ['--prefix', apiRoot, 'run', '--silent', 'openapi:dump'],
    {
      encoding: 'utf8',
      maxBuffer: 50 * 1024 * 1024,
      shell: process.platform === 'win32',
      env: {
        ...process.env,
        // Sprint 209: buildSwaggerDocument não checa flags, mas setar aqui
        // deixa claro que spec export é modo "swagger enabled".
        SWAGGER_ENABLED: 'true',
        NODE_ENV: process.env.NODE_ENV ?? 'development',
      },
    },
  );
  if (result.status !== 0) {
    const stderr = result.stderr || result.stdout || '';
    throw new Error(
      `npm run openapi:dump failed (exit ${result.status}):\n${stderr}`,
    );
  }
  return result.stdout;
}

function runOpenapiTypescript(specJsonPath) {
  const result = spawnSync(
    'npx',
    ['--no-install', 'openapi-typescript', specJsonPath],
    {
      encoding: 'utf8',
      maxBuffer: 50 * 1024 * 1024,
      cwd: WEB_ROOT,
      shell: process.platform === 'win32',
    },
  );
  if (result.status !== 0) {
    throw new Error(
      `openapi-typescript failed (exit ${result.status}):\n${result.stderr || result.stdout}`,
    );
  }
  return result.stdout;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  let specText;
  if (args.from) {
    const specPath = resolve(args.from);
    if (!existsSync(specPath)) {
      console.error(`spec file not found: ${specPath}`);
      process.exit(2);
    }
    specText = readFileSync(specPath, 'utf8');
  } else {
    console.error('→ dumping spec via cesta-api openapi:dump …');
    specText = dumpSpec();
  }

  const tmp = mkdtempSync(join(tmpdir(), 'cesta-openapi-'));
  const specPath = join(tmp, 'openapi.json');
  writeFileSync(specPath, specText, 'utf8');

  console.error('→ running openapi-typescript …');
  const candidate = normalizeTypes(runOpenapiTypescript(specPath));

  if (args.check) {
    if (!existsSync(BASELINE_PATH)) {
      console.error(
        `baseline not found: ${BASELINE_PATH}\nrun \`npm run types:api\` to seed it.`,
      );
      process.exit(1);
    }
    const baseline = readFileSync(BASELINE_PATH, 'utf8');
    const { changed, unifiedDiff } = computeDrift(baseline, candidate);
    if (changed) {
      console.error(
        'types:api:check — drift detected between live OpenAPI spec and committed baseline.',
      );
      console.error(
        'Regenerate via `npm run types:api`, review diff, and commit the updated baseline',
      );
      console.error('along with an ADR 0022 update if the change is breaking.\n');
      console.error(unifiedDiff);
      process.exit(1);
    }
    console.error('types:api:check OK — baseline matches live spec.');
    return;
  }

  mkdirSync(dirname(BASELINE_PATH), { recursive: true });
  writeFileSync(BASELINE_PATH, candidate, 'utf8');
  console.error(
    `types:api wrote baseline → ${BASELINE_PATH} (${candidate.length} bytes).`,
  );
  console.error('Review `git diff` and commit the baseline update.');
}

const invokedDirectly =
  import.meta.url === pathToFileURL(process.argv[1] ?? '').href;
if (invokedDirectly) {
  main().catch((err) => {
    console.error(err instanceof Error ? err.stack || err.message : String(err));
    process.exit(1);
  });
}
