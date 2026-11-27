#!/usr/bin/env node
/**
 * i18n-parity.mjs — Sprint 196.
 *
 * Audit paridade entre `src/i18n/messages/es.json` (default) e
 * `src/i18n/messages/pt-BR.json`. Reporta:
 *   - Keys presentes só em ES (faltando em PT-BR).
 *   - Keys presentes só em PT-BR (faltando em ES).
 *   - Nested paths incompletos (um lado é folha, o outro é object).
 *   - Values com placeholder TODO explícito (string contém "TODO:").
 *   - ICU placeholders divergentes ({name}, {count, plural, ...}) por chave
 *     (S227 #6: pegar `Desde {since}` virando `Desde {date}` sem atualizar outro locale).
 *
 * Exit code:
 *   0 — paridade ok.
 *   1 — drift detectado.
 *
 * Uso:
 *   node scripts/i18n-parity.mjs
 *   npm run i18n:parity
 */

import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const MESSAGES_DIR = resolve(__dirname, "../src/i18n/messages");

const LOCALES = /** @type {const} */ ({
  es: resolve(MESSAGES_DIR, "es.json"),
  "pt-BR": resolve(MESSAGES_DIR, "pt-BR.json"),
});

/** Flatten nested object em { "a.b.c": "value" } map. */
export function flatten(obj, prefix = "") {
  /** @type {Record<string, { path: string; type: "leaf" | "branch" }>} */
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === "object" && !Array.isArray(v)) {
      out[path] = { path, type: "branch" };
      Object.assign(out, flatten(v, path));
    } else {
      out[path] = { path, type: "leaf" };
    }
  }
  return out;
}

/** Collect keys with "TODO:" marker em values string. */
export function collectTodos(obj, prefix = "") {
  const out = [];
  for (const [k, v] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === "object" && !Array.isArray(v)) {
      out.push(...collectTodos(v, path));
    } else if (typeof v === "string" && v.includes("TODO:")) {
      out.push(path);
    }
  }
  return out;
}

/**
 * Flatten values em { "a.b.c": "value" } map (só folhas string).
 */
export function flattenValues(obj, prefix = "") {
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === "object" && !Array.isArray(v)) {
      Object.assign(out, flattenValues(v, path));
    } else if (typeof v === "string") {
      out[path] = v;
    }
  }
  return out;
}

/**
 * ICU placeholder extraction — depth-aware.
 *
 * ICU nests `{option {literal text}}`. Regex ingênuo capturaria literal text
 * como placeholder (e.g. `{Sin productos}` → "Sin"). Stack-based tracker:
 * só captura identificador em `{` quando depth corrente é 0 (var real).
 */
export function extractPlaceholders(str) {
  const found = new Set();
  let depth = 0;
  let i = 0;
  while (i < str.length) {
    const c = str[i];
    if (c === "{") {
      if (depth === 0) {
        const m = /^\{([a-zA-Z_][a-zA-Z0-9_]*)/.exec(str.slice(i));
        if (m) found.add(m[1]);
      }
      depth++;
      i++;
    } else if (c === "}") {
      depth = Math.max(0, depth - 1);
      i++;
    } else {
      i++;
    }
  }
  return [...found].sort();
}

export function diffPlaceholders(esObj, ptObj) {
  const esVals = flattenValues(esObj);
  const ptVals = flattenValues(ptObj);
  const diffs = [];
  for (const [path, esValue] of Object.entries(esVals)) {
    const ptValue = ptVals[path];
    if (typeof ptValue !== "string") continue;
    const esPh = extractPlaceholders(esValue);
    const ptPh = extractPlaceholders(ptValue);
    if (esPh.length !== ptPh.length || esPh.some((v, i) => v !== ptPh[i])) {
      diffs.push({ path, es: esPh, pt: ptPh });
    }
  }
  return diffs;
}

export function diffLocales(esObj, ptObj) {
  const esFlat = flatten(esObj);
  const ptFlat = flatten(ptObj);

  const onlyEs = [];
  const onlyPt = [];
  const typeMismatch = [];

  for (const path of Object.keys(esFlat)) {
    if (!(path in ptFlat)) {
      onlyEs.push(path);
    } else if (esFlat[path].type !== ptFlat[path].type) {
      typeMismatch.push({
        path,
        es: esFlat[path].type,
        pt: ptFlat[path].type,
      });
    }
  }
  for (const path of Object.keys(ptFlat)) {
    if (!(path in esFlat)) {
      onlyPt.push(path);
    }
  }

  return { onlyEs, onlyPt, typeMismatch };
}

function main() {
  const esObj = JSON.parse(readFileSync(LOCALES.es, "utf8"));
  const ptObj = JSON.parse(readFileSync(LOCALES["pt-BR"], "utf8"));

  const { onlyEs, onlyPt, typeMismatch } = diffLocales(esObj, ptObj);
  const placeholderDiffs = diffPlaceholders(esObj, ptObj);
  const esTodos = collectTodos(esObj);
  const ptTodos = collectTodos(ptObj);

  const esLeafCount = Object.values(flatten(esObj)).filter(
    (n) => n.type === "leaf",
  ).length;
  const ptLeafCount = Object.values(flatten(ptObj)).filter(
    (n) => n.type === "leaf",
  ).length;

  console.log("── i18n parity audit ──");
  console.log(`es.json    leaves: ${esLeafCount}`);
  console.log(`pt-BR.json leaves: ${ptLeafCount}`);
  console.log("");

  if (onlyEs.length > 0) {
    console.log(`[FAIL] only in ES (${onlyEs.length}):`);
    for (const p of onlyEs) console.log(`  - ${p}`);
  }
  if (onlyPt.length > 0) {
    console.log(`[FAIL] only in PT-BR (${onlyPt.length}):`);
    for (const p of onlyPt) console.log(`  - ${p}`);
  }
  if (typeMismatch.length > 0) {
    console.log(`[FAIL] type mismatch (${typeMismatch.length}):`);
    for (const m of typeMismatch) {
      console.log(`  - ${m.path} (es=${m.es}, pt-BR=${m.pt})`);
    }
  }
  if (placeholderDiffs.length > 0) {
    console.log(`[FAIL] placeholder mismatch (${placeholderDiffs.length}):`);
    for (const d of placeholderDiffs) {
      console.log(
        `  - ${d.path} (es=[${d.es.join(", ")}], pt-BR=[${d.pt.join(", ")}])`,
      );
    }
  }
  if (esTodos.length > 0) {
    console.log(`[WARN] TODO markers em ES (${esTodos.length}):`);
    for (const p of esTodos) console.log(`  - ${p}`);
  }
  if (ptTodos.length > 0) {
    console.log(`[WARN] TODO markers em PT-BR (${ptTodos.length}):`);
    for (const p of ptTodos) console.log(`  - ${p}`);
  }

  const drift =
    onlyEs.length + onlyPt.length + typeMismatch.length + placeholderDiffs.length;
  if (drift === 0) {
    console.log("");
    console.log(`✅ parity OK (${esLeafCount} leaves aligned)`);
    if (esTodos.length + ptTodos.length > 0) {
      console.log(
        `   note: ${esTodos.length + ptTodos.length} TODO marker(s) remaining — gate not blocked, follow-up translation.`,
      );
    }
    process.exit(0);
  }
  console.log("");
  console.log(`❌ ${drift} parity violation(s) — fix translations.`);
  process.exit(1);
}

// Run only when invoked directly (not when imported in tests).
const isDirect =
  import.meta.url === `file://${process.argv[1]}` ||
  import.meta.url.endsWith(process.argv[1]?.replace(/\\/g, "/") ?? "");
if (isDirect) {
  main();
}
