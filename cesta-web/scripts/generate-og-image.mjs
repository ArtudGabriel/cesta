// Sprint 69: gera /public/og-image.png 1200x630 pra OG + Twitter cards.
// Fundo verde Cesta #1b6b48 + "C" grande + tagline — placeholder visual MVP.
// Rodar: node scripts/generate-og-image.mjs
import sharp from "sharp";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, "..", "public", "og-image.png");

const WIDTH = 1200;
const HEIGHT = 630;
const BG = "#1b6b48";
const FG = "#ffffff";

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
  <rect width="${WIDTH}" height="${HEIGHT}" fill="${BG}"/>
  <text x="140" y="340" text-anchor="start" dominant-baseline="middle"
        font-family="Arial Black, Helvetica, sans-serif"
        font-weight="900"
        font-size="320"
        fill="${FG}">C</text>
  <text x="420" y="300" text-anchor="start" dominant-baseline="middle"
        font-family="Arial Black, Helvetica, sans-serif"
        font-weight="900"
        font-size="76"
        fill="${FG}">Cesta</text>
  <text x="420" y="380" text-anchor="start" dominant-baseline="middle"
        font-family="Helvetica, Arial, sans-serif"
        font-weight="400"
        font-size="30"
        fill="${FG}"
        opacity="0.85">Comparador de precios</text>
  <text x="420" y="420" text-anchor="start" dominant-baseline="middle"
        font-family="Helvetica, Arial, sans-serif"
        font-weight="400"
        font-size="30"
        fill="${FG}"
        opacity="0.85">Comunidad de Madrid</text>
</svg>`;

await sharp(Buffer.from(svg)).png().toFile(OUT);
console.log(`[og] wrote ${OUT}`);
