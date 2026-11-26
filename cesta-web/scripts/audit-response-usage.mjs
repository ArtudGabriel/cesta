#!/usr/bin/env node
/**
 * Sprint 212 — Audit response type consumers em cesta-web.
 *
 * Fecha ciclo openapi-typescript S204-S212. S211 (ADR 0024) saneou
 * baseline schemas (71 offenders @ApiProperty nullable → 0). S212 migra
 * response types em consumers (services/hooks/E2E) para importar da
 * baseline `src/types/generated/api.baseline.d.ts` via `Schemas`.
 *
 * Pattern detectado (consumer de response ainda handcrafted):
 *   1. `api.get<Envelope<X>>` / `api.post<Envelope<X>>` etc — tipo
 *      do payload envelopado por axios.
 *   2. Hook `useQuery<X>` / `useMutation<X>` com return type local.
 *   3. E2E `expect(...).toMatchObject({ ... })` — shape assertion.
 *
 * Output:
 *   - stdout markdown table (file:line, consumer, inferred-type,
 *     target-schema sugestão).
 *   - --json: JSON machine-readable.
 *   - --count: só imprime contagem total.
 *
 * Exit codes:
 *   0 — audit completou (zero gating; zero regressão silenciosa S209
 *       gate já cobre drift baseline.d.ts).
 *   1 — erro de I/O ou parse.
 *
 * Uso:
 *   node cesta-web/scripts/audit-response-usage.mjs
 *   node cesta-web/scripts/audit-response-usage.mjs --json > audit.json
 *   node cesta-web/scripts/audit-response-usage.mjs --count
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = resolve(fileURLToPath(import.meta.url), '..');
const WEB_ROOT = resolve(__dirname, '..');
const REPO_ROOT = resolve(WEB_ROOT, '..');
const SRC = resolve(WEB_ROOT, 'src');
const E2E = resolve(WEB_ROOT, 'tests', 'e2e');

const BASELINE_SCHEMAS = new Set(loadBaselineSchemaNames());

function loadBaselineSchemaNames() {
  const baselinePath = resolve(WEB_ROOT, 'src/types/generated/api.baseline.d.ts');
  const text = readFileSync(baselinePath, 'utf8');
  const names = new Set();
  const re = /^\s+([A-Z][A-Za-z0-9_]*):\s*\{/gm;
  let m;
  while ((m = re.exec(text))) names.add(m[1]);
  return names;
}

function walk(dir) {
  if (!safeStat(dir)) return [];
  const entries = readdirSync(dir);
  const files = [];
  for (const entry of entries) {
    if (entry === 'node_modules' || entry.startsWith('.') || entry === 'generated') continue;
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      files.push(...walk(full));
    } else if (/\.(ts|tsx|mts|cts)$/.test(entry) && !/\.d\.ts$/.test(entry)) {
      files.push(full);
    }
  }
  return files;
}

function safeStat(p) {
  try {
    return statSync(p);
  } catch {
    return null;
  }
}

/** Palavras que não contam como "tipo handcrafted de response". */
const PRIMITIVE_OR_IGNORED = new Set([
  'void', 'unknown', 'never', 'string', 'number', 'boolean', 'null',
  'Record', 'Partial', 'Promise', 'Array', 'ReadonlyArray',
  // Next.js e React noise
  'Metadata', 'ReactElement', 'ReactNode', 'JSX', 'FC', 'PropsWithChildren',
  'NextResponse', 'NextRequest', 'Response', 'Request', 'URL',
  'Headers', 'Blob', 'File', 'FormData', 'ArrayBuffer',
  // Utility
  'Error', 'Date', 'RegExp', 'Map', 'Set', 'WeakMap', 'WeakSet',
]);

export function stripGenerics(t) {
  return t.replace(/<[^<>]*>/g, '').trim();
}

export function normalize(t) {
  return t.replace(/\s+/g, ' ').trim();
}

/**
 * Sugere schema baseline a partir de um nome de tipo handcrafted.
 *   AuthUser → UserResponseDto
 *   Product → ProductResponseDto
 *   Favorite → FavoriteResponseDto
 *   Alert → AlertResponseDto
 *   AlertRule → AlertRuleResponseDto
 *   ShoppingList → ShoppingListResponseDto
 *   ShoppingListItem → ListItemDto
 *   AlertTrigger → AlertTriggerDto
 *
 * Heurística: tenta `<Name>ResponseDto`, `<Name>Dto`, nome exato.
 */
export function suggestSchemaFrom(typeName, baselineNames) {
  const bare = stripGenerics(typeName).replace(/\[\]$/, '');
  if (!bare || PRIMITIVE_OR_IGNORED.has(bare)) return null;

  const candidates = [
    `${bare}ResponseDto`,
    `${bare}Dto`,
    bare,
    // AuthUser → UserResponseDto
    bare.startsWith('Auth') ? `${bare.slice(4)}ResponseDto` : null,
    // ShoppingListItem → ListItemDto
    bare === 'ShoppingListItem' ? 'ListItemDto' : null,
  ].filter(Boolean);

  for (const c of candidates) {
    if (baselineNames.has(c)) return c;
  }
  return null;
}

function suggestSchema(typeName) {
  return suggestSchemaFrom(typeName, BASELINE_SCHEMAS);
}

/**
 * Patterns investigados por linha:
 *   api.<method><Envelope<TYPE>>(...)
 *   api.<method><TYPE>(...)   (sem envelope — ex: lib/api direct)
 *   useQuery<TYPE>(...)       (hook explicit return)
 *   useMutation<TYPE, ...>()  (hook explicit return)
 *   expect(...).toMatchObject({ ... })  — shape assertion inline (E2E)
 *   : Promise<TYPE>           (service function signature)
 */
const PATTERNS = [
  {
    kind: 'axios-envelope',
    re: /\bapi\.(get|post|put|patch|delete)<\s*Envelope<\s*([^<>]+?)\s*>\s*>/g,
    typeIdx: 2,
  },
  {
    kind: 'axios-raw',
    re: /\bapi\.(get|post|put|patch|delete)<\s*([A-Z][A-Za-z0-9_]*(?:\[\])?)\s*>/g,
    typeIdx: 2,
  },
  {
    kind: 'promise-return',
    re: /:\s*Promise<\s*([A-Z][A-Za-z0-9_]*(?:\[\])?)\s*>\s*\{/g,
    typeIdx: 1,
  },
  {
    kind: 'query-generic',
    re: /\buse(Query|Mutation)<\s*([A-Z][A-Za-z0-9_]*(?:\[\])?)/g,
    typeIdx: 2,
  },
  {
    kind: 'e2e-matchObject',
    re: /\.toMatchObject\(/g,
    typeIdx: null,
    e2eOnly: true,
  },
];

function auditFile(file, isE2E) {
  const text = readFileSync(file, 'utf8');
  const lines = text.split(/\r?\n/);
  const findings = [];

  const importsBaseline = /from\s+["']@\/types\/api["']/.test(text);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    for (const p of PATTERNS) {
      if (p.e2eOnly && !isE2E) continue;
      p.re.lastIndex = 0;
      let m;
      while ((m = p.re.exec(line))) {
        if (p.typeIdx === null) {
          findings.push({
            file: relative(REPO_ROOT, file).replaceAll('\\', '/'),
            line: i + 1,
            consumer: p.kind,
            inferredType: 'inline-object',
            targetSchema: null,
            alreadyBaseline: importsBaseline,
            raw: normalize(line).slice(0, 120),
          });
          continue;
        }
        const t = normalize(m[p.typeIdx]);
        const bare = stripGenerics(t).replace(/\[\]$/, '');
        if (!bare || PRIMITIVE_OR_IGNORED.has(bare)) continue;
        findings.push({
          file: relative(REPO_ROOT, file).replaceAll('\\', '/'),
          line: i + 1,
          consumer: p.kind,
          inferredType: t,
          targetSchema: suggestSchema(t),
          alreadyBaseline: importsBaseline,
          raw: normalize(line).slice(0, 120),
        });
      }
    }
  }
  return findings;
}

export function main() {
  const args = process.argv.slice(2);
  const jsonOut = args.includes('--json');
  const countOnly = args.includes('--count');

  const srcFiles = walk(SRC);
  const e2eFiles = walk(E2E);

  const all = [];
  for (const f of srcFiles) {
    try {
      all.push(...auditFile(f, false));
    } catch (err) {
      process.stderr.write(`parse error: ${f}: ${err.message}\n`);
      process.exit(1);
    }
  }
  for (const f of e2eFiles) {
    try {
      all.push(...auditFile(f, true));
    } catch (err) {
      process.stderr.write(`parse error: ${f}: ${err.message}\n`);
      process.exit(1);
    }
  }

  if (countOnly) {
    process.stdout.write(`${all.length}\n`);
    return;
  }

  if (jsonOut) {
    process.stdout.write(JSON.stringify(all, null, 2) + '\n');
    return;
  }

  const byFile = new Map();
  for (const f of all) {
    if (!byFile.has(f.file)) byFile.set(f.file, []);
    byFile.get(f.file).push(f);
  }

  const withTarget = all.filter((f) => f.targetSchema);
  const withoutTarget = all.filter((f) => !f.targetSchema && f.inferredType !== 'inline-object');
  const e2eInline = all.filter((f) => f.inferredType === 'inline-object');

  process.stdout.write(
    `# Response usage audit — ${all.length} consumers em ${byFile.size} arquivos\n\n`
  );
  process.stdout.write(`- ${withTarget.length} com schema baseline sugerido\n`);
  process.stdout.write(`- ${withoutTarget.length} sem match baseline (business-logic transform, local DTO, etc)\n`);
  process.stdout.write(`- ${e2eInline.length} E2E toMatchObject inline (shape assertions)\n\n`);

  for (const [file, items] of byFile) {
    process.stdout.write(`## ${file}\n\n`);
    process.stdout.write(`| L | Consumer | TS type | Target schema |\n`);
    process.stdout.write(`|---|---|---|---|\n`);
    for (const it of items) {
      const target = it.targetSchema ? `\`Schemas["${it.targetSchema}"]\`` : '—';
      process.stdout.write(`| ${it.line} | \`${it.consumer}\` | \`${it.inferredType}\` | ${target} |\n`);
    }
    process.stdout.write(`\n`);
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  main();
}
