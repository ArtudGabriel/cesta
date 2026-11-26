#!/usr/bin/env node
/**
 * render-sync-blueprint.ts
 *
 * Pushes cesta-api/render.yaml buildCommand into the Render dashboard
 * via the Render REST API. The cesta-api service was created manually
 * (not via Blueprint), so render.yaml does not auto-sync.
 *
 * Scope (Boss guard S184): PATCH serviceDetails.envSpecificDetails.buildCommand
 * ONLY. No rootDir change, no env vars touched (incident S134:
 * dashboard PUT wipes env block). Any other drift aborts.
 *
 * ADR 0014 explains why this script exists.
 *
 * Usage:
 *   RENDER_API_KEY=rnd_xxx node --import tsx render-sync-blueprint.ts [--apply]
 *
 * Env:
 *   RENDER_API_KEY           required
 *   CESTA_API_SERVICE_ID     optional; overrides name-based lookup
 *                            (the dashboard service is named "cesta",
 *                             not "cesta-api"; override is required)
 *   RENDER_API_BASE          optional; defaults to https://api.render.com/v1
 */

import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse as parseYaml } from 'yaml';

type EnvSpecific = { buildCommand?: string; startCommand?: string };
type ServiceObj = {
  id: string;
  name: string;
  rootDir?: string;
  serviceDetails?: {
    envSpecificDetails?: EnvSpecific;
    [k: string]: unknown;
  };
};

type BlueprintService = {
  type: string;
  name: string;
  rootDir?: string;
  buildCommand?: string;
};

type Blueprint = { services: BlueprintService[] };

const API_BASE = process.env.RENDER_API_BASE ?? 'https://api.render.com/v1';
const API_KEY = process.env.RENDER_API_KEY;
const SERVICE_ID = process.env.CESTA_API_SERVICE_ID;
const APPLY = process.argv.includes('--apply');

function die(msg: string, code = 1): never {
  console.error(`!!! ${msg}`);
  process.exit(code);
}

function here(): string {
  return dirname(fileURLToPath(import.meta.url));
}

function loadBlueprint(): BlueprintService {
  const yamlPath = resolve(here(), '..', 'cesta-api', 'render.yaml');
  const raw = readFileSync(yamlPath, 'utf8');
  const doc = parseYaml(raw) as Blueprint;
  if (!doc?.services?.length) die(`render.yaml at ${yamlPath} declares no services`);
  const svc = doc.services.find((s) => s.name === 'cesta-api');
  if (!svc) die('cesta-api service not found in render.yaml');
  if (!svc.buildCommand) die('cesta-api.buildCommand missing in render.yaml');
  return svc;
}

async function render<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      authorization: `Bearer ${API_KEY}`,
      accept: 'application/json',
      'content-type': 'application/json',
      ...(init.headers ?? {}),
    },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    die(`Render API ${init.method ?? 'GET'} ${path} -> ${res.status} ${body.slice(0, 500)}`);
  }
  return (await res.json()) as T;
}

async function getService(id: string): Promise<ServiceObj> {
  return render<ServiceObj>(`/services/${id}`);
}

function currentBuildCommand(svc: ServiceObj): string | undefined {
  return svc.serviceDetails?.envSpecificDetails?.buildCommand;
}

// Composed command: `cd ${rootDir} && ${buildCommand}` when the blueprint
// declares a rootDir AND the dashboard rootDir is empty. If the dashboard
// already carries a rootDir, prefixing with `cd ${rootDir}` would
// double-cd (dashboard cd's into rootDir, then the command cd's again).
// In that case the raw buildCommand is sufficient.
function desiredBuildCommand(bp: BlueprintService, dashboardRootDir: string): string {
  const cmd = bp.buildCommand!;
  const bpRd = bp.rootDir?.trim();
  const dashRd = dashboardRootDir.trim();
  if (!bpRd) return cmd;
  if (dashRd === bpRd) return cmd;
  if (dashRd === '') return `cd ${bpRd} && ${cmd}`;
  die(
    `rootDir mismatch and non-empty on dashboard: blueprint="${bpRd}" dashboard="${dashRd}".\n` +
      `Composing "cd ${bpRd} && ..." would double-cd. Resolve the dashboard\n` +
      `rootDir manually (empty it or align it to the blueprint) before syncing.`,
  );
}

async function patchBuildCommand(id: string, buildCommand: string): Promise<void> {
  await render(`/services/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({
      serviceDetails: { envSpecificDetails: { buildCommand } },
    }),
  });
}

async function main(): Promise<void> {
  if (!API_KEY) die('RENDER_API_KEY not set');
  if (!SERVICE_ID) {
    die(
      'CESTA_API_SERVICE_ID not set. The dashboard service is "cesta", not ' +
        '"cesta-api"; name-based lookup is intentionally omitted (Sprint 185) ' +
        'to force a conscious target. Set CESTA_API_SERVICE_ID=<srv-...>.',
    );
  }

  const bp = loadBlueprint();
  console.log(`>>> Render service id: ${SERVICE_ID}`);

  const before = await getService(SERVICE_ID);
  const beforeCmd = currentBuildCommand(before);
  const dashboardRootDir = before.rootDir ?? '';
  console.log('>>> Dashboard current buildCommand:');
  console.log(`    ${beforeCmd ?? '(unset)'}`);
  console.log(`>>> Dashboard rootDir (read-only, NOT patched): "${dashboardRootDir}"`);

  const desired = desiredBuildCommand(bp, dashboardRootDir);
  console.log('>>> Blueprint desired buildCommand:');
  console.log(`    ${desired}`);

  if (beforeCmd === desired) {
    console.log('>>> No drift. Dashboard buildCommand already matches blueprint.');
    return;
  }

  console.log('>>> Drift:');
  console.log(`    from: ${beforeCmd ?? '(unset)'}`);
  console.log(`    to:   ${desired}`);

  if (!APPLY) {
    console.log('>>> Dry run (no --apply). Re-run with --apply to PATCH.');
    return;
  }

  console.log('>>> PATCH serviceDetails.envSpecificDetails.buildCommand ...');
  await patchBuildCommand(SERVICE_ID, desired);
  console.log('>>> PATCH ok. Re-GETting service to verify isolated diff ...');

  const after = await getService(SERVICE_ID);
  const afterCmd = currentBuildCommand(after);

  const expected = {
    buildCommand: desired,
    startCommand: before.serviceDetails?.envSpecificDetails?.startCommand,
    rootDir: before.rootDir,
  };
  const actual = {
    buildCommand: afterCmd,
    startCommand: after.serviceDetails?.envSpecificDetails?.startCommand,
    rootDir: after.rootDir,
  };

  const drifted: string[] = [];
  if (actual.buildCommand !== expected.buildCommand) drifted.push('buildCommand (failed to apply)');
  if (actual.startCommand !== expected.startCommand)
    drifted.push(`startCommand (was "${expected.startCommand}" -> "${actual.startCommand}")`);
  if (actual.rootDir !== expected.rootDir)
    drifted.push(`rootDir (was "${expected.rootDir}" -> "${actual.rootDir}")`);

  if (drifted.length > 0) {
    die(
      `post-PATCH verification failed; unexpected drift:\n    - ${drifted.join('\n    - ')}\n` +
        `Rollback: PATCH buildCommand back to "${beforeCmd ?? '(unset)'}" immediately.`,
    );
  }

  console.log('>>> Verified: only buildCommand changed. startCommand and rootDir intact.');
  console.log(`>>> Service ${SERVICE_ID} dashboard now matches blueprint.`);
}

main().catch((err) => die(err instanceof Error ? err.message : String(err)));
