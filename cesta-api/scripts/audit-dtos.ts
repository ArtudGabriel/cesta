import { readFileSync } from 'fs';
import { globSync } from 'glob';

// Flags *input* DTOs that accept productId/supermarketId/userId without @IsCuid validation.
// Response DTOs (*-response.dto.ts) are output shapes — fields come from DB, no validation needed.
const files = globSync('src/modules/**/dtos/*.dto.ts').filter(
  (f) => !/-response\.dto\.ts$/.test(f),
);
const offenders: Array<{ file: string; field: string }> = [];

for (const file of files) {
  const src = readFileSync(file, 'utf8');
  const lines = src.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const m = /^\s*(productId|supermarketId|userId)\??:\s*string;?/.exec(line);
    if (!m) continue;
    let hasCuid = false;
    for (let j = Math.max(0, i - 6); j < i; j++) {
      if (/@IsCuid\s*\(/.test(lines[j])) {
        hasCuid = true;
        break;
      }
    }
    if (!hasCuid) offenders.push({ file, field: m[1] });
  }
}

if (offenders.length === 0) {
  console.log('audit:dtos OK — all productId/supermarketId/userId fields use @IsCuid');
  process.exit(0);
}

console.error('audit:dtos FAIL — fields missing @IsCuid:');
for (const o of offenders) console.error(`  ${o.file}:  ${o.field}`);
process.exit(1);
