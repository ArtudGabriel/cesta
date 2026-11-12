// Gera ícones PWA do Cesta a partir de SVG inline.
// "C" branca em fundo verde Cesta #1b6b48.
// Rodar: node scripts/generate-icons.mjs
import sharp from "sharp";
import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, "..", "public", "icons");

function svg(size, safeFactor = 1) {
  const bg = "#1b6b48";
  const fontSize = Math.round(size * 0.58 * safeFactor);
  const cy = Math.round(size * 0.52);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" fill="${bg}"/>
  <text x="50%" y="${cy}" text-anchor="middle" dominant-baseline="middle"
        font-family="Arial Black, Helvetica, sans-serif"
        font-weight="900"
        font-size="${fontSize}"
        fill="#ffffff">C</text>
</svg>`;
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });

  const jobs = [
    { name: "icon-192.png", size: 192, safe: 1 },
    { name: "icon-512.png", size: 512, safe: 1 },
    // maskable: conteúdo dentro da safe zone (80% central)
    { name: "icon-maskable-512.png", size: 512, safe: 0.8 },
  ];

  for (const job of jobs) {
    const buffer = Buffer.from(svg(job.size, job.safe));
    const outPath = join(OUT_DIR, job.name);
    await sharp(buffer).png().toFile(outPath);
    console.log(`✓ ${job.name}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
