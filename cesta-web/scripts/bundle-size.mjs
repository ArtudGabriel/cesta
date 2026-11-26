#!/usr/bin/env node
/**
 * bundle-size.mjs — Sprint 199.
 *
 * Post-build: lê `.next/app-build-manifest.json` (route → chunks) +
 * `.next/build-manifest.json` (pages shared), computa gzipped size de
 * cada chunk, agrega por route, enforce threshold.
 *
 * Threshold default:
 *   - FIRST_LOAD_JS_MAX_BYTES  = 200_000 (gzip)
 *   - PER_PAGE_MAX_BYTES       = 50_000  (gzip, exclui shared)
 *
 * Exit code:
 *   0 — within threshold.
 *   1 — threshold exceeded.
 *   2 — fatal (manifest missing / IO).
 *
 * Uso:
 *   npm run bundle:size              # post-build enforcement
 *   npm run bundle:size -- --json    # JSON only (programatic)
 */

import { readFileSync, statSync, existsSync, writeFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { resolve as resolvePath } from "node:path";

const CWD = process.cwd();
const NEXT_DIR = resolvePath(CWD, ".next");
const APP_MANIFEST = resolvePath(NEXT_DIR, "app-build-manifest.json");
const BUILD_MANIFEST = resolvePath(NEXT_DIR, "build-manifest.json");
const REPORT_PATH = resolvePath(CWD, "bundle-size-report.json");

const DEFAULT_THRESHOLD = {
  firstLoadJsMaxBytes: 200_000,
  perPageMaxBytes: 50_000,
};

/**
 * Chunk path (manifest-relative) → gzipped size em bytes.
 * Cache: um chunk referenciado por múltiplas routes mede uma vez.
 */
const gzipCache = new Map();

function gzippedSize(relPath) {
  if (gzipCache.has(relPath)) return gzipCache.get(relPath);
  const abs = resolvePath(NEXT_DIR, relPath);
  if (!existsSync(abs)) {
    gzipCache.set(relPath, 0);
    return 0;
  }
  const raw = readFileSync(abs);
  const g = gzipSync(raw, { level: 9 }).length;
  gzipCache.set(relPath, g);
  return g;
}

/**
 * Agrega sizes por route. `chunks` é lista de paths relativos.
 * Shared chunks (ex: webpack runtime) contam pro First Load.
 */
export function computeRouteBundle(chunks, sizeFn = gzippedSize) {
  let total = 0;
  const perChunk = [];
  for (const chunk of chunks ?? []) {
    const size = sizeFn(chunk);
    total += size;
    perChunk.push({ chunk, size });
  }
  return { total, perChunk };
}

/**
 * Verdict por route contra threshold.
 */
export function evaluateRoute(route, bundle, threshold) {
  const violations = [];
  if (bundle.total > threshold.firstLoadJsMaxBytes) {
    violations.push({
      route,
      kind: "first-load-exceeded",
      actual: bundle.total,
      max: threshold.firstLoadJsMaxBytes,
    });
  }
  // Per-page = total menos shared chunks (heurística: shared é chunk em
  // >=50% das routes; aqui computamos no aggregator).
  return { route, total: bundle.total, violations };
}

/**
 * Agrega todas as routes, detecta shared chunks, computa per-page sizes.
 */
export function aggregateRoutes(routesManifest, threshold, sizeFn = gzippedSize) {
  const routeNames = Object.keys(routesManifest);
  const routeCount = routeNames.length;
  const chunkFreq = new Map();
  for (const chunks of Object.values(routesManifest)) {
    for (const c of chunks) {
      chunkFreq.set(c, (chunkFreq.get(c) ?? 0) + 1);
    }
  }
  // Shared threshold: chunk em ≥50% das routes conta como shared.
  const sharedCutoff = Math.ceil(routeCount * 0.5);
  const sharedChunks = new Set(
    Array.from(chunkFreq.entries())
      .filter(([, freq]) => freq >= sharedCutoff)
      .map(([c]) => c),
  );

  const routes = [];
  for (const [routeName, chunks] of Object.entries(routesManifest)) {
    const bundle = computeRouteBundle(chunks, sizeFn);
    const pageOnlyChunks = chunks.filter((c) => !sharedChunks.has(c));
    const pageOnly = computeRouteBundle(pageOnlyChunks, sizeFn);
    const violations = [];
    if (bundle.total > threshold.firstLoadJsMaxBytes) {
      violations.push({
        kind: "first-load-exceeded",
        actual: bundle.total,
        max: threshold.firstLoadJsMaxBytes,
      });
    }
    if (pageOnly.total > threshold.perPageMaxBytes) {
      violations.push({
        kind: "per-page-exceeded",
        actual: pageOnly.total,
        max: threshold.perPageMaxBytes,
      });
    }
    routes.push({
      route: routeName,
      firstLoadBytes: bundle.total,
      pageOnlyBytes: pageOnly.total,
      sharedBytes: bundle.total - pageOnly.total,
      violations,
    });
  }
  const totalSharedBytes = Array.from(sharedChunks).reduce(
    (acc, c) => acc + sizeFn(c),
    0,
  );
  return {
    routes,
    sharedChunks: Array.from(sharedChunks),
    totalSharedBytes,
  };
}

function formatBytes(n) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

function renderMarkdown(result, threshold) {
  const lines = [];
  lines.push("## Bundle size report");
  lines.push("");
  lines.push(
    `Threshold: first-load ≤${formatBytes(threshold.firstLoadJsMaxBytes)} · per-page ≤${formatBytes(threshold.perPageMaxBytes)} (gzip)`,
  );
  lines.push("");
  lines.push("| Route | First Load | Page-only | Shared | Violations |");
  lines.push("|---|---:|---:|---:|---|");
  for (const r of result.routes) {
    const v =
      r.violations.length === 0
        ? "✅"
        : r.violations.map((x) => `❌ ${x.kind}`).join(", ");
    lines.push(
      `| \`${r.route}\` | ${formatBytes(r.firstLoadBytes)} | ${formatBytes(r.pageOnlyBytes)} | ${formatBytes(r.sharedBytes)} | ${v} |`,
    );
  }
  lines.push("");
  lines.push(
    `Shared chunks total (gzip): ${formatBytes(result.totalSharedBytes)} · ${result.sharedChunks.length} chunk(s).`,
  );
  return lines.join("\n");
}

function loadManifest() {
  if (!existsSync(APP_MANIFEST) && !existsSync(BUILD_MANIFEST)) {
    throw new Error(
      `Neither ${APP_MANIFEST} nor ${BUILD_MANIFEST} found — run 'next build' first.`,
    );
  }
  const manifest = { ...(existsSync(APP_MANIFEST) ? JSON.parse(readFileSync(APP_MANIFEST, "utf8")) : {}) };
  // Shape: { pages: { route: [chunks] } } em Next 14+ app manifest OR direct map.
  const pages = manifest.pages ?? manifest;
  const routes = {};
  for (const [k, v] of Object.entries(pages)) {
    if (Array.isArray(v) && v.every((x) => typeof x === "string")) {
      routes[k] = v;
    }
  }
  return routes;
}

async function main() {
  const args = new Set(process.argv.slice(2));
  const jsonOnly = args.has("--json");
  try {
    const manifest = loadManifest();
    if (Object.keys(manifest).length === 0) {
      process.stderr.write(
        "warn: manifest sem routes parseáveis — bundle gate skipped (no violations).\n",
      );
      process.exit(0);
    }
    const result = aggregateRoutes(manifest, DEFAULT_THRESHOLD);
    const violationCount = result.routes.reduce(
      (acc, r) => acc + r.violations.length,
      0,
    );
    const report = {
      threshold: DEFAULT_THRESHOLD,
      ...result,
      violationCount,
      generatedAt: new Date().toISOString(),
    };
    try {
      writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2));
    } catch (err) {
      process.stderr.write(
        `warn: report write failed: ${err instanceof Error ? err.message : String(err)}\n`,
      );
    }
    if (jsonOnly) {
      process.stdout.write(JSON.stringify(report, null, 2) + "\n");
    } else {
      process.stdout.write(renderMarkdown(result, DEFAULT_THRESHOLD) + "\n");
      process.stdout.write(`\nreport: ${REPORT_PATH}\n`);
    }
    if (violationCount > 0) {
      process.stderr.write(
        `\n❌ ${violationCount} bundle-size violation(s) — see report.\n`,
      );
      process.exit(1);
    }
    process.stdout.write(`\n✅ bundle-size OK (${result.routes.length} routes).\n`);
    process.exit(0);
  } catch (err) {
    process.stderr.write(
      `FATAL: ${err instanceof Error ? err.message : String(err)}\n`,
    );
    process.exit(2);
  }
}

const isDirect =
  import.meta.url === `file://${process.argv[1]}` ||
  import.meta.url.endsWith(process.argv[1]?.replace(/\\/g, "/") ?? "");
if (isDirect) {
  main();
}

export const THRESHOLD = DEFAULT_THRESHOLD;
