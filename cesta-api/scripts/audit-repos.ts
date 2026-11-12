import { readFileSync } from 'fs';
import { globSync } from 'glob';

// Services must NOT call this.prisma.X directly — all persistence goes via Repository.
// Regra #6 do CLAUDE.md. Exceções documentadas aqui ficam explícitas.
const files = globSync('src/modules/**/*.service.ts');
const offenders: Array<{ file: string; line: number; text: string }> = [];

for (const file of files) {
  const src = readFileSync(file, 'utf8');
  const lines = src.split(/\r?\n/);
  lines.forEach((line, i) => {
    if (/this\.prisma\./.test(line)) {
      offenders.push({ file, line: i + 1, text: line.trim() });
    }
  });
}

if (offenders.length === 0) {
  console.log('audit:repos OK — zero services usam this.prisma.* diretamente');
  process.exit(0);
}

console.error('audit:repos FAIL — services violando regra #6:');
for (const o of offenders) {
  console.error(`  ${o.file}:${o.line}  ${o.text}`);
}
process.exit(1);
