#!/usr/bin/env node
// scripts/changelog-backfill.mjs
//
// Backfill helper for CHANGELOG.md — groups git log entries by sprint number
// and emits a Markdown table with SHA + PR cross-ref per entry.
//
// Usage:
//   node scripts/changelog-backfill.mjs                  # default: S100 anchor → HEAD
//   node scripts/changelog-backfill.mjs --base <sha>     # custom base
//   node scripts/changelog-backfill.mjs --from <N>       # lowest sprint to include
//   node scripts/changelog-backfill.mjs --to   <N>       # highest sprint to include
//   node scripts/changelog-backfill.mjs --json           # emit JSON instead of table
//
// Grouping rules (memory feedback-changelog-anti-hallucination):
//   - Each row MUST carry a verifiable short SHA.
//   - Sprint number extracted from commit subject via /sprint\s+(\d+)/i.
//   - PR number from trailing (#NNN) if present.
//   - Commits without a sprint number land under "untagged" and surface a warning.

import { execFileSync } from 'node:child_process';

const DEFAULT_BASE = 'f1896ed'; // docs: sprint 100 marco — CHANGELOG + README refresh (#44)
const SEP = '\x1f';

function parseArgs(argv) {
  const args = { base: DEFAULT_BASE, from: null, to: null, json: false };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--base') args.base = argv[++i];
    else if (a === '--from') args.from = Number(argv[++i]);
    else if (a === '--to') args.to = Number(argv[++i]);
    else if (a === '--json') args.json = true;
    else if (a === '--help' || a === '-h') {
      process.stdout.write(
        'Usage: node scripts/changelog-backfill.mjs [--base <sha>] [--from N] [--to N] [--json]\n',
      );
      process.exit(0);
    } else {
      process.stderr.write(`unknown arg: ${a}\n`);
      process.exit(2);
    }
  }
  return args;
}

function gitLog(baseSha) {
  const range = `${baseSha}..HEAD`;
  const out = execFileSync(
    'git',
    ['log', '--reverse', '--no-merges', `--format=%h${SEP}%H${SEP}%s`, range],
    { encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 },
  );
  return out
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const [shortSha, fullSha, subject] = line.split(SEP);
      return { shortSha, fullSha, subject };
    });
}

function classify(commit) {
  const sprintMatch = commit.subject.match(/sprint\s+(\d+)/i);
  const prMatch = commit.subject.match(/\(#(\d+)\)\s*$/);
  return {
    ...commit,
    sprint: sprintMatch ? Number(sprintMatch[1]) : null,
    pr: prMatch ? Number(prMatch[1]) : null,
  };
}

function groupBySprint(commits) {
  const groups = new Map();
  const untagged = [];
  for (const c of commits) {
    if (c.sprint == null) {
      untagged.push(c);
      continue;
    }
    if (!groups.has(c.sprint)) groups.set(c.sprint, []);
    groups.get(c.sprint).push(c);
  }
  const sorted = [...groups.entries()].sort((a, b) => a[0] - b[0]);
  return { sorted, untagged };
}

function withinRange(sprintNum, from, to) {
  if (from != null && sprintNum < from) return false;
  if (to != null && sprintNum > to) return false;
  return true;
}

function escapeTableCell(s) {
  return s.replace(/\|/g, '\\|');
}

function renderTable(sorted, from, to) {
  const lines = [
    '| Sprint | SHA | PR | Subject |',
    '|---:|:---|:---:|:---|',
  ];
  for (const [sprintNum, commits] of sorted) {
    if (!withinRange(sprintNum, from, to)) continue;
    for (const c of commits) {
      const pr = c.pr ? `#${c.pr}` : '—';
      lines.push(
        `| S${sprintNum} | \`${c.shortSha}\` | ${pr} | ${escapeTableCell(c.subject)} |`,
      );
    }
  }
  return lines.join('\n');
}

function renderJson(sorted, untagged, from, to) {
  const filtered = sorted
    .filter(([n]) => withinRange(n, from, to))
    .map(([n, commits]) => [
      `S${n}`,
      commits.map((c) => ({
        sha: c.shortSha,
        full_sha: c.fullSha,
        pr: c.pr,
        subject: c.subject,
      })),
    ]);
  return JSON.stringify(
    { sprints: Object.fromEntries(filtered), untagged },
    null,
    2,
  );
}

function main() {
  const args = parseArgs(process.argv);
  const commits = gitLog(args.base).map(classify);
  const { sorted, untagged } = groupBySprint(commits);

  if (args.json) {
    process.stdout.write(renderJson(sorted, untagged, args.from, args.to) + '\n');
  } else {
    process.stdout.write(renderTable(sorted, args.from, args.to) + '\n');
  }

  if (untagged.length > 0) {
    process.stderr.write(
      `\n[warn] ${untagged.length} commit(s) without sprint tag:\n`,
    );
    for (const c of untagged) {
      process.stderr.write(`  ${c.shortSha}  ${c.subject}\n`);
    }
  }
}

main();
