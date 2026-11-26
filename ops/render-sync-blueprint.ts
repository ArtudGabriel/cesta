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
const OVERRIDE_SERVICE_ID = process.env.CESTA_API_SERVICE_ID;
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

async function findServiceId(name: string): Promise<string> {
  if (OVERRIDE_SERVICE_ID) return OVERRIDE_SERVICE_ID;
  type Row = { service: ServiceObj; cursor?: string };
  const rows = await render<Row[]>(`/services?name=${encodeURIComponent(name)}&limit=20`);
  const match = rows.find((r) => r.service?.name === name);
  if (!match) {
    die(
      `no Render service named "${name}". The dashboard service is "cesta" ` +
        `(renames pending). Set CESTA_API_SERVICE_ID=<srv-...> to override.`,
    );
  }
  return match.service.id;
}

async function getService(id: string): Promise<ServiceObj> {
  return render<ServiceObj>(`/services/${id}`);
}

function currentBuildCommand(svc: ServiceObj): string | undefined {
  return svc.serviceDetails?.envSpecificDetails?.buildCommand;
}

function desiredBuildCommand(bp: BlueprintService): string {
  const cmd = bp.buildCommand!;
  const rd = bp.rootDir?.trim();
  if (!rd) return cmd;
  return `cd ${rd} && ${cmd}`;
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

  const bp = loadBlueprint();
  const desired = desiredBuildCommand(bp);
  console.log('>>> Blueprint desired buildCommand:');
  console.log(`    ${desired}`);

  const id = await findServiceId(bp.name);
  console.log(`>>> Render service id: ${id}`);

  const before = await getService(id);
  const beforeCmd = currentBuildCommand(before);
  console.log('>>> Dashboard current buildCommand:');
  console.log(`    ${beforeCmd ?? '(unset)'}`);
  console.log(`>>> Dashboard rootDir (read-only, NOT patched): "${before.rootDir ?? ''}"`);

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
  await patchBuildCommand(id, desired);
  console.log('>>> PATCH ok. Re-GETting service to verify isolated diff ...');

  const after = await getService(id);
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
  console.log(`>>> Service ${id} dashboard now matches blueprint.`);
}

main().catch((err) => die(err instanceof Error ? err.message : String(err)));
