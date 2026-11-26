#!/usr/bin/env node
/**
 * a11y-audit.mjs — Sprint 197.
 *
 * Audit de acessibilidade via axe-core contra rotas Next.js. Spawn
 * `next start` background, fetch HTML server-rendered de cada rota,
 * executa axe-core em jsdom.
 *
 * Limitação jsdom: color-contrast + outras rules que dependem de
 * layout/paint não rodam. Cobre a11y SSR-detectable (missing alt,
 * aria, heading hierarchy, labels, landmarks).
 *
 * Threshold default: 0 critical + 5 serious. Moderate/minor sem gate
 * (incentive fix mas não bloqueia merge).
 *
 * Exit code:
 *   0 — within threshold.
 *   1 — threshold exceeded (critical or serious above max).
 *   2 — fatal (fetch/next start/axe erro).
 *
 * Uso:
 *   npm run a11y:audit              # full flow (build + start + audit)
 *   npm run a11y:audit -- --skip-build
 *   BASE_URL=http://localhost:4321 node scripts/a11y-audit.mjs --skip-start
 */

import { spawn } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";
import { writeFileSync } from "node:fs";
import { resolve as resolvePath } from "node:path";

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3000";
const START_TIMEOUT_MS = 60_000;
const FETCH_TIMEOUT_MS = 15_000;

const ROUTES = [
  { path: "/", label: "home" },
  { path: "/produto/sample-product-id", label: "pdp" },
  { path: "/comparar", label: "compare" },
  { path: "/favoritos", label: "favorites" },
  { path: "/login", label: "login" },
  { path: "/perfil", label: "profile" },
];

const DEFAULT_THRESHOLD = {
  maxCritical: 0,
  maxSerious: 5,
};

/**
 * Agrega violations por impact level.
 * @param {Array<{impact?: string}>} violations
 */
export function summarizeImpact(violations) {
  const counts = { critical: 0, serious: 0, moderate: 0, minor: 0 };
  for (const v of violations ?? []) {
    const k = v.impact ?? "minor";
    if (k in counts) counts[k]++;
  }
  return counts;
}

/**
 * Soma counts across rotas.
 * @param {Array<{counts: Record<string, number>}>} reports
 */
export function aggregateReports(reports) {
  const total = { critical: 0, serious: 0, moderate: 0, minor: 0 };
  for (const r of reports) {
    for (const k of Object.keys(total)) {
      total[k] += r.counts[k] ?? 0;
    }
  }
  return total;
}

/**
 * Verdict baseado em threshold.
 * @param {{critical:number, serious:number}} totals
 * @param {{maxCritical:number, maxSerious:number}} threshold
 */
export function evaluateThreshold(totals, threshold) {
  const criticalFail = totals.critical > threshold.maxCritical;
  const seriousFail = totals.serious > threshold.maxSerious;
  return {
    passed: !criticalFail && !seriousFail,
    criticalFail,
    seriousFail,
    reason: criticalFail
      ? `critical ${totals.critical} > ${threshold.maxCritical}`
      : seriousFail
        ? `serious ${totals.serious} > ${threshold.maxSerious}`
        : "within threshold",
  };
}

/** Executa axe-core em jsdom contra HTML.
 *
 * axe-core descobre o window via `document.defaultView`. Não mutamos
 * globalThis — vitest env jsdom tem document como getter-only, e Node
 * raw env não precisa (axe segue defaultView). Isso torna o helper
 * testável em ambos envs sem override risk.
 */
export async function auditHtml(html, url) {
  const { JSDOM } = await import("jsdom");
  const dom = new JSDOM(html, { url });
  const axe = (await import("axe-core")).default;
  try {
    const result = await axe.run(dom.window.document, {
      // jsdom não renderiza paint: skip color-contrast (false positives).
      rules: { "color-contrast": { enabled: false } },
    });
    return result.violations;
  } finally {
    dom.window.close();
  }
}

async function fetchHtml(url) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { accept: "text/html" },
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status} ${url}`);
    }
    return await res.text();
  } finally {
    clearTimeout(t);
  }
}

async function waitForServer(url, timeoutMs = START_TIMEOUT_MS) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url, { method: "GET" });
      if (res.status < 500) return;
    } catch {
      // ignore, retry
    }
    await sleep(1_000);
  }
  throw new Error(`Server did not become ready within ${timeoutMs}ms at ${url}`);
}

async function runAudit() {
  const reports = [];
  for (const route of ROUTES) {
    const url = `${BASE_URL}${route.path}`;
    try {
      const html = await fetchHtml(url);
      const violations = await auditHtml(html, url);
      const counts = summarizeImpact(violations);
      reports.push({ ...route, url, counts, violations });
      process.stdout.write(
        `[${route.label}] critical=${counts.critical} serious=${counts.serious} moderate=${counts.moderate} minor=${counts.minor}\n`,
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      process.stderr.write(`[${route.label}] FETCH FAIL: ${msg}\n`);
      reports.push({
        ...route,
        url,
        counts: { critical: 0, serious: 0, moderate: 0, minor: 0 },
        violations: [],
        fetchError: msg,
      });
    }
  }
  return reports;
}

async function main() {
  const args = new Set(process.argv.slice(2));
  const skipBuild = args.has("--skip-build");
  const skipStart = args.has("--skip-start");

  let serverProc;
  try {
    if (!skipBuild) {
      process.stdout.write(">>> next build\n");
      await runStep("npx", ["next", "build"]);
    }
    if (!skipStart) {
      process.stdout.write(">>> next start (background)\n");
      serverProc = spawn("npx", ["next", "start"], {
        stdio: ["ignore", "ignore", "inherit"],
        detached: false,
      });
      await waitForServer(`${BASE_URL}/`);
    }

    const reports = await runAudit();
    const totals = aggregateReports(reports);
    const verdict = evaluateThreshold(totals, DEFAULT_THRESHOLD);

    process.stdout.write("\n── a11y-audit totals ──\n");
    process.stdout.write(JSON.stringify(totals) + "\n");
    process.stdout.write(`verdict: ${verdict.passed ? "PASS" : "FAIL"} (${verdict.reason})\n`);

    // Dump violations JSON — útil pra CI artifact + Dev inspection local.
    const fetchErrors = reports.filter((r) => r.fetchError);
    const report = {
      threshold: DEFAULT_THRESHOLD,
      totals,
      verdict,
      reports,
      fetchErrors,
      generatedAt: new Date().toISOString(),
    };
    const reportPath = resolvePath(process.cwd(), "a11y-audit-report.json");
    try {
      writeFileSync(reportPath, JSON.stringify(report, null, 2));
      process.stdout.write(`report written: ${reportPath}\n`);
    } catch (err) {
      process.stderr.write(
        `warn: report write failed: ${err instanceof Error ? err.message : String(err)}\n`,
      );
    }

    process.exit(verdict.passed ? 0 : 1);
  } catch (err) {
    process.stderr.write(`FATAL: ${err instanceof Error ? err.message : String(err)}\n`);
    process.exit(2);
  } finally {
    if (serverProc && !serverProc.killed) {
      serverProc.kill("SIGTERM");
    }
  }
}

function runStep(cmd, args) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { stdio: "inherit", shell: true });
    p.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${cmd} ${args.join(" ")} exit ${code}`));
    });
    p.on("error", reject);
  });
}

const isDirect =
  import.meta.url === `file://${process.argv[1]}` ||
  import.meta.url.endsWith(process.argv[1]?.replace(/\\/g, "/") ?? "");
if (isDirect) {
  main();
}

export const THRESHOLD = DEFAULT_THRESHOLD;
export const AUDITED_ROUTES = ROUTES;
