import { describe, expect, it } from 'vitest';
import {
  parseArgs,
  normalizeTypes,
  computeDrift,
} from './generate-api-types.mjs';

/**
 * Sprint 209 G4 — openapi-typescript CI gate (ADR 0022).
 * Testa helpers puros do script: parseArgs + normalizeTypes + computeDrift.
 * Não exercita o child_process spawn (dump/openapi-typescript), que é
 * integração e cobre via CI step types:api:check real.
 */

describe('parseArgs', () => {
  it('default: no flags → {check:false, from:null}', () => {
    expect(parseArgs([])).toEqual({ check: false, from: null });
  });

  it('--check enables check mode', () => {
    expect(parseArgs(['--check'])).toEqual({ check: true, from: null });
  });

  it('--from <path> captures spec file', () => {
    expect(parseArgs(['--from', 'spec.json'])).toEqual({
      check: false,
      from: 'spec.json',
    });
  });

  it('--from=<path> inline form', () => {
    expect(parseArgs(['--from=spec.json'])).toEqual({
      check: false,
      from: 'spec.json',
    });
  });

  it('combines --check and --from', () => {
    expect(parseArgs(['--check', '--from', 'a.json'])).toEqual({
      check: true,
      from: 'a.json',
    });
  });

  it('ignores unknown flags gracefully', () => {
    expect(parseArgs(['--weird'])).toEqual({ check: false, from: null });
  });
});

describe('normalizeTypes', () => {
  it('converts CRLF → LF', () => {
    expect(normalizeTypes('a\r\nb\r\n')).toBe('a\nb\n');
  });

  it('trims trailing whitespace per line', () => {
    expect(normalizeTypes('a   \nb\t\t\n')).toBe('a\nb\n');
  });

  it('guarantees single trailing newline', () => {
    expect(normalizeTypes('a\nb')).toBe('a\nb\n');
    expect(normalizeTypes('a\nb\n\n\n')).toBe('a\nb\n');
  });

  it('handles non-string → empty string', () => {
    expect(normalizeTypes(undefined)).toBe('');
    expect(normalizeTypes(null)).toBe('');
    expect(normalizeTypes(123)).toBe('');
  });

  it('preserves inner blank lines', () => {
    expect(normalizeTypes('a\n\nb\n')).toBe('a\n\nb\n');
  });
});

describe('computeDrift', () => {
  it('identical input → {changed:false}', () => {
    const r = computeDrift('export type A = string;\n', 'export type A = string;\n');
    expect(r.changed).toBe(false);
    expect(r.unifiedDiff).toBe('');
  });

  it('normalized-equal input (CRLF vs LF) → no drift', () => {
    const r = computeDrift('a\r\nb\r\n', 'a\nb\n');
    expect(r.changed).toBe(false);
  });

  it('whitespace trailing differences do not trigger drift', () => {
    const r = computeDrift('a   \nb\n', 'a\nb\n');
    expect(r.changed).toBe(false);
  });

  it('new line in candidate → changed with diff lines', () => {
    const r = computeDrift('a\nb\n', 'a\nb\nc\n');
    expect(r.changed).toBe(true);
    expect(r.unifiedDiff).toContain('+ L3: c');
  });

  it('modified line → changed with - and + entries', () => {
    const r = computeDrift('a\nb\n', 'a\nB\n');
    expect(r.changed).toBe(true);
    expect(r.unifiedDiff).toContain('- L2: b');
    expect(r.unifiedDiff).toContain('+ L2: B');
  });

  it('truncates diff when more than 40 lines differ', () => {
    const left = Array.from({ length: 100 }, (_, i) => `old${i}`).join('\n');
    const right = Array.from({ length: 100 }, (_, i) => `new${i}`).join('\n');
    const r = computeDrift(left, right);
    expect(r.changed).toBe(true);
    expect(r.unifiedDiff).toMatch(/more lines differ, truncated/);
  });

  it('empty baseline + non-empty candidate → changed', () => {
    const r = computeDrift('', 'export type A = string;\n');
    expect(r.changed).toBe(true);
  });
});
