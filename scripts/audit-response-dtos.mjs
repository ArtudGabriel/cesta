#!/usr/bin/env node
/**
 * Sprint 211 — Audit response DTOs for @ApiProperty({ nullable: true }) sem type explícito.
 *
 * Bug ADR 0023: @ApiProperty({ nullable: true }) sem `type:` gera schema OpenAPI
 * sem shape, que openapi-typescript materializa como `Record<string, never> | null`.
 * O fix canonical (ADR 0024) adiciona `type:` explícito:
 *
 *   // antes (bad)
 *   @ApiProperty({ nullable: true }) brand: string | null;
 *
 *   // depois (fix)
 *   @ApiProperty({ type: String, nullable: true }) brand: string | null;
 *
 * Script percorre cesta-api/src e aponta cada @ApiProperty decorator que:
 *   1. Tem `nullable: true`
 *   2. NÃO tem `type:` nem `enum:` no mesmo options object (que é o que daria
 *      schema shape ao OpenAPI)
 *
 * Output:
 *   - stdout markdown table (file:line, class, field, decorator snippet,
 *     declared TS type, suggested fix).
 *   - --json: emite JSON machine-readable em stdout.
 *   - --count: só imprime contagem total.
 *
 * Exit codes:
 *   0 — audit completou (independente de offenders found, zero gating aqui)
 *   1 — erro de I/O ou parse
 *
 * Uso:
 *   node scripts/audit-response-dtos.mjs
 *   node scripts/audit-response-dtos.mjs --json > audit-output.json
 *   node scripts/audit-response-dtos.mjs --count
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = resolve(fileURLToPath(import.meta.url), '..');
const REPO_ROOT = resolve(__dirname, '..');
const API_SRC = resolve(REPO_ROOT, 'cesta-api', 'src');

function walk(dir) {
  const entries = readdirSync(dir);
  const files = [];
  for (const entry of entries) {
    if (entry === 'node_modules' || entry.startsWith('.')) continue;
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      files.push(...walk(full));
    } else if (entry.endsWith('.ts') && !entry.endsWith('.spec.ts') && !entry.endsWith('.test.ts')) {
      files.push(full);
    }
  }
  return files;
}

const TS_PRIMITIVE_MAP = {
  'string': 'String',
  'number': 'Number',
  'boolean': 'Boolean',
  'Date': 'Date',
};

function suggestType(declaredType) {
  if (!declaredType) return 'String';
  const stripped = declaredType.replace(/\s*\|\s*null\s*$/, '').trim();
  if (stripped.endsWith('[]')) {
    const inner = stripped.slice(0, -2).trim();
    const mapped = TS_PRIMITIVE_MAP[inner] ?? inner;
    return `[${mapped}]`;
  }
  return TS_PRIMITIVE_MAP[stripped] ?? `() => ${stripped}`;
}

function auditFile(file) {
  const text = readFileSync(file, 'utf8');
  const lines = text.split(/\r?\n/);
  const findings = [];

  let currentClass = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    const classMatch = line.match(/export\s+class\s+(\w+)/);
    if (classMatch) {
      currentClass = classMatch[1];
    }

    const apiPropIdx = line.indexOf('@ApiProperty');
    if (apiPropIdx === -1) continue;

    // Reconstruct multiline decorator payload: slice from `@ApiProperty(` until matching `)`
    const startIdx = line.indexOf('(', apiPropIdx);
    if (startIdx === -1) continue;

    let depth = 0;
    let endLine = i;
    let endCol = -1;
    let payload = '';
    for (let j = i; j < lines.length; j++) {
      const l = lines[j];
      const startCol = j === i ? startIdx : 0;
      for (let k = startCol; k < l.length; k++) {
        payload += l[k];
        if (l[k] === '(') depth++;
        else if (l[k] === ')') {
          depth--;
          if (depth === 0) {
            endLine = j;
            endCol = k;
            break;
          }
        }
      }
      if (depth === 0) break;
      payload += '\n';
    }
    if (depth !== 0) continue;

    const hasNullable = /nullable\s*:\s*true/.test(payload);
    if (!hasNullable) continue;

    const hasType = /(^|[\s,{])type\s*:/.test(payload);
    const hasEnum = /(^|[\s,{])enum\s*:/.test(payload);
    const hasOneOf = /oneOf\s*:/.test(payload);
    if (hasType || hasEnum || hasOneOf) continue;

    // Grab field declaration: either same line after decorator close, or next lines
    let fieldDecl = '';
    const afterDecorator = lines[endLine].slice(endCol + 1);
    if (afterDecorator.trim().length > 0) {
      fieldDecl = afterDecorator.trim();
    } else {
      for (let j = endLine + 1; j < Math.min(endLine + 5, lines.length); j++) {
        const l = lines[j].trim();
        if (l.length === 0) continue;
        if (l.startsWith('@')) break;
        fieldDecl = l;
        // Try to accumulate until `;` or `?:` complete
        let acc = l;
        for (let k = j + 1; k < Math.min(j + 4, lines.length) && !acc.includes(';'); k++) {
          acc += ' ' + lines[k].trim();
        }
        fieldDecl = acc;
        break;
      }
    }

    const fieldMatch = fieldDecl.match(/^([a-zA-Z_][\w$]*)[!?]?:\s*([^;]+);?/);
    const fieldName = fieldMatch?.[1] ?? '?';
    const tsType = fieldMatch?.[2]?.trim() ?? '?';

    findings.push({
      file: relative(REPO_ROOT, file).replace(/\\/g, '/'),
      line: i + 1,
      class: currentClass ?? '?',
      field: fieldName,
      tsType,
      decoratorSnippet: payload.replace(/\s+/g, ' ').slice(0, 120),
      suggestedType: suggestType(tsType),
      suggestedFix: `@ApiProperty({ type: ${suggestType(tsType)}, nullable: true })`,
    });
  }

  return findings;
}

function main() {
  const args = process.argv.slice(2);
  const jsonOut = args.includes('--json');
  const countOnly = args.includes('--count');

  const files = walk(API_SRC);
  const all = [];
  for (const f of files) {
    try {
      all.push(...auditFile(f));
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

  process.stdout.write(`# @ApiProperty nullable audit — ${all.length} offenders em ${byFile.size} arquivos\n\n`);
  process.stdout.write(`Pattern: \`@ApiProperty({ nullable: true })\` sem \`type:\` nem \`enum:\` nem \`oneOf:\`.\n`);
  process.stdout.write(`Fix canonical (ADR 0024): adicionar \`type:\` explícito.\n\n`);

  for (const [file, items] of byFile) {
    process.stdout.write(`## ${file}\n\n`);
    process.stdout.write(`| L | Classe | Field | TS type | Fix sugerido |\n`);
    process.stdout.write(`|---|---|---|---|---|\n`);
    for (const it of items) {
      process.stdout.write(`| ${it.line} | \`${it.class}\` | \`${it.field}\` | \`${it.tsType}\` | \`${it.suggestedFix}\` |\n`);
    }
    process.stdout.write(`\n`);
  }
}

main();
