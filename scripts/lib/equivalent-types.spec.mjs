/**
 * Sprint 245b (ADR 0047) — specs equivalent-types REFINED.
 *
 * Cobre os 7 erros concretos do dry-run S245 (Boss 2026-11-28):
 *   1. Atum/sardinhas "EN aceite de oliva" NÃO deve ser aceite-oliva.
 *   2. Nivea gel / cosméticos NÃO deve virar aceite.
 *   3. Perrier / Vichy / "con gas" / "vitaminada" NÃO deve virar agua-mineral-plana.
 *   4. Leche de cabra / oveja / soja / vegetais NÃO deve virar leche-*.
 *   5. Ovos XL vs M vs camperos vs suelo → variantKey DISTINTO.
 *   6. Aceite trufa / ajo / limón / aromatizado NÃO deve virar aceite-*.
 *   7. Pan tostadas / rallado / sem variante OBRIGATÓRIA NÃO deve virar pan-molde.
 *
 * Plus: enriquecidos (calcio/omega-3/fibra) variantKey distinto do regular.
 * Plus: Aceite suave vs intenso = variant key distinto dentro de aceite-oliva-refinado.
 */
import assert from 'node:assert/strict';
import {
  classifyTypeKey,
  sizeCanon,
  variantCanon,
  equivalentGroupKey,
  canonicalSize,
} from './equivalent-types.mjs';
import { parseSize } from './brand-normalize.mjs';

let pass = 0;
let fail = 0;
function test(name, fn) {
  try {
    fn();
    pass += 1;
    console.log(`  ✓ ${name}`);
  } catch (e) {
    fail += 1;
    console.log(`  ✗ ${name}`);
    console.log(`    ${e.message}`);
  }
}

// ────────────────────────────────────────────────────────────
// classifyTypeKey — happy paths (manter funcionalidade S245)
// ────────────────────────────────────────────────────────────

console.log('classifyTypeKey — leche (head-noun check)');
test('leche entera cross-brand', () => {
  assert.equal(classifyTypeKey('Leche entera Hacendado brik 1L', 'Hacendado'), 'leche-entera');
  assert.equal(classifyTypeKey('Leche entera Dia Láctea pack 6', 'Dia Láctea'), 'leche-entera');
  assert.equal(classifyTypeKey('Leche entera Pascual botella 1L', 'Pascual'), 'leche-entera');
});
test('leche semi/desnatada separadas', () => {
  assert.equal(classifyTypeKey('Leche semidesnatada Hacendado 1L', 'Hacendado'), 'leche-semi');
  assert.equal(classifyTypeKey('Leche semi 1L'), 'leche-semi');
  assert.equal(classifyTypeKey('Leche desnatada 1L'), 'leche-desnatada');
  assert.equal(classifyTypeKey('Leche sin lactosa 1L'), 'leche-desnatada');
});

console.log('\nclassifyTypeKey — leche EXCLUSIONS Boss rule 3');
test('leche cabra/oveja FORA', () => {
  assert.equal(classifyTypeKey('Leche de cabra Covap 1L', 'Covap'), null);
  assert.equal(classifyTypeKey('Leche de oveja Pascual 1L', 'Pascual'), null);
});
test('leche vegetais (soja/arroz/avena/coco/almendra) FORA', () => {
  assert.equal(classifyTypeKey('Leche de soja Hacendado 1L', 'Hacendado'), null);
  assert.equal(classifyTypeKey('Leche de arroz Vivesoy 1L', null), null);
  assert.equal(classifyTypeKey('Leche de avena Oatly 1L', null), null);
  assert.equal(classifyTypeKey('Leche de coco Alpro 1L', null), null);
  assert.equal(classifyTypeKey('Leche de almendra Puleva 1L', 'Puleva'), null);
});
test('bebida-láctea / batido FORA', () => {
  assert.equal(classifyTypeKey('Bebida láctea con chocolate Puleva 1L', 'Puleva'), null);
  assert.equal(classifyTypeKey('Batido de fresa Pascual 1L', 'Pascual'), null);
});
test('leche saborizada (chocolate/vainilla/fresa/cafe) FORA', () => {
  assert.equal(classifyTypeKey('Leche con chocolate Puleva Max 1L', 'Puleva'), null);
  assert.equal(classifyTypeKey('Leche con vainilla Hacendado 1L', 'Hacendado'), null);
  assert.equal(classifyTypeKey('Leche con café Pascual 1L', 'Pascual'), null);
});

console.log('\nclassifyTypeKey — agua (Boss rule 2)');
test('agua mineral plana cross-brand', () => {
  assert.equal(classifyTypeKey('Agua mineral Bezoya 1,5L', 'Bezoya'), 'agua-mineral-plana');
  assert.equal(classifyTypeKey('Agua mineral Font Vella 1,5L'), 'agua-mineral-plana');
  assert.equal(classifyTypeKey('Agua mineral Solán de Cabras 1,5L'), 'agua-mineral-plana');
});
test('agua con gas / gasificada / Perrier / Vichy / San Pellegrino FORA', () => {
  assert.equal(classifyTypeKey('Agua mineral con gas Perrier 500ml', 'Perrier'), null);
  assert.equal(classifyTypeKey('Agua mineral con gas San Pellegrino 1L'), null);
  assert.equal(classifyTypeKey('Agua mineral con gas Vichy Catalán 1L', 'Vichy Catalán'), null);
  assert.equal(classifyTypeKey('Agua gasificada Cabreiroá 1,5L'), null);
});
test('agua vitaminada / sabor / alcalina FORA', () => {
  assert.equal(classifyTypeKey('Agua vitaminada Puro Exorcismo 500ml', null), null);
  assert.equal(classifyTypeKey('Agua con sabor limón Font Vella 50cl', null), null);
  assert.equal(classifyTypeKey('Agua alcalina Ursu9 1,5L', null), null);
});

console.log('\nclassifyTypeKey — huevos (rule 4)');
test('huevos happy path', () => {
  assert.equal(classifyTypeKey('Huevos grandes L docena 12 un'), 'huevos');
  assert.equal(classifyTypeKey('Huevos ecologicos M pack 6', null), 'huevos');
  assert.equal(classifyTypeKey('Huevos super grandes XL', null), 'huevos');
});
test('huevos codorniz/pato/chocolate FORA', () => {
  assert.equal(classifyTypeKey('Huevos de codorniz pack 24'), null);
  assert.equal(classifyTypeKey('Huevos de pato pack 6'), null);
  assert.equal(classifyTypeKey('Huevos de chocolate Hacendado 100g', 'Hacendado'), null);
});

console.log('\nclassifyTypeKey — aceite (Boss rule 1 head-noun)');
test('aceite oliva VE / virgen / refinado SEPARADOS', () => {
  assert.equal(classifyTypeKey('Aceite de oliva virgen extra Carbonell 1L', 'Carbonell'), 'aceite-oliva-ve');
  assert.equal(classifyTypeKey('Aceite de oliva virgen Coosur 1L', 'Coosur'), 'aceite-oliva-virgen');
  assert.equal(classifyTypeKey('Aceite de oliva suave Carbonell 1L', 'Carbonell'), 'aceite-oliva-refinado');
  assert.equal(classifyTypeKey('Aceite de oliva intenso La Masía 1L', 'La masía'), 'aceite-oliva-refinado');
  assert.equal(classifyTypeKey('Aceite de oliva refinado Hacendado 1L', 'Hacendado'), 'aceite-oliva-refinado');
});
test('atum/sardinha "EN aceite de oliva" FORA (não começa com "aceite")', () => {
  assert.equal(classifyTypeKey('Melva en aceite de oliva Dia Mari Marinera 85g', 'Dia Mari Marinera'), null);
  assert.equal(classifyTypeKey('Sardinas en aceite de oliva Albo 85g', 'Albo'), null);
  assert.equal(classifyTypeKey('Atún en aceite de oliva Hacendado 80g', 'Hacendado'), null);
  assert.equal(classifyTypeKey('Filetes de caballa en aceite de oliva Ubago 85g', 'Ubago'), null);
});
test('aceite aromatizado (trufa/ajo/guindilla/limón/romero) FORA', () => {
  assert.equal(classifyTypeKey('Aceite de oliva virgen extra trufa Carbonell 250ml', 'Carbonell'), null);
  assert.equal(classifyTypeKey('Aceite de oliva ajo Hacendado 250ml', 'Hacendado'), null);
  assert.equal(classifyTypeKey('Aceite de oliva guindilla La Masía 250ml'), null);
  assert.equal(classifyTypeKey('Aceite de oliva limón Carbonell 250ml'), null);
  assert.equal(classifyTypeKey('Aceite de oliva romero Dia 250ml', 'Dia'), null);
});
test('aceite sem oliva (girasol/semilla/soja) FORA', () => {
  assert.equal(classifyTypeKey('Aceite de girasol Koipesol 1L'), null);
  assert.equal(classifyTypeKey('Aceite de semillas Hacendado 1L', 'Hacendado'), null);
});
test('Nivea gel / cosméticos NÃO viram aceite', () => {
  assert.equal(classifyTypeKey('Gel de ducha Nivea 500ml', 'Nivea'), null);
  assert.equal(classifyTypeKey('Aceite corporal Nivea 200ml', 'Nivea'), null); // não tem "oliva"
});

console.log('\nclassifyTypeKey — pan molde (Boss rule 5 variante obrigatória)');
test('pan molde blanco/integral/cereales OK', () => {
  assert.equal(classifyTypeKey('Pan de molde blanco Bimbo 460g', 'Bimbo'), 'pan-molde');
  assert.equal(classifyTypeKey('Pan molde integral Hacendado 460g', 'Hacendado'), 'pan-molde');
  assert.equal(classifyTypeKey('Pan molde multicereal Bimbo 500g', 'Bimbo'), 'pan-molde');
});
test('pan molde SEM variante obrigatória FORA', () => {
  assert.equal(classifyTypeKey('Pan de molde Hacendado 460g', 'Hacendado'), null);
  assert.equal(classifyTypeKey('Pan molde Bimbo', 'Bimbo'), null);
});
test('pan tostadas / rallado / hamburguesa / perrito FORA', () => {
  assert.equal(classifyTypeKey('Pan tostadas integral Dia 300g', 'Dia'), null);
  assert.equal(classifyTypeKey('Pan rallado Hacendado 500g', 'Hacendado'), null);
  assert.equal(classifyTypeKey('Pan hamburguesa Bimbo pack 6', 'Bimbo'), null);
  assert.equal(classifyTypeKey('Pan perrito Hacendado pack 6', 'Hacendado'), null);
});

console.log('\nclassifyTypeKey — fora do piloto');
test('produtos outros → null', () => {
  assert.equal(classifyTypeKey('Coca-Cola Zero 2L', 'Coca-Cola'), null);
  assert.equal(classifyTypeKey('Yogur natural Danone pack 6', 'Danone'), null);
  assert.equal(classifyTypeKey('Chocolate Milka 125g', 'Milka'), null);
});

// ────────────────────────────────────────────────────────────
// variantCanon — enriquecidos / grade / cría / grau aceite
// ────────────────────────────────────────────────────────────

console.log('\nvariantCanon — enriquecidos leite (Boss rule 3)');
test('leche regular vs calcio → variants distintos', () => {
  const regular = variantCanon('Leche entera Dia Láctea 1L');
  const calcio = variantCanon('Leche entera calcio Dia Láctea 1L');
  assert.notEqual(regular, calcio);
  assert.ok(calcio.includes('enriq_calcio'));
});
test('leche regular vs omega-3 → variants distintos', () => {
  const regular = variantCanon('Leche desnatada Puleva 1L');
  const omega = variantCanon('Leche desnatada omega 3 Puleva 1L');
  assert.notEqual(regular, omega);
  assert.ok(omega.includes('enriq_omega'));
});
test('leche fibra/proteinas/vitaminas', () => {
  const fibra = variantCanon('Leche semidesnatada fibra Asturiana 1L');
  const prot = variantCanon('Leche semidesnatada proteinas Pascual 1L');
  const vit = variantCanon('Leche semidesnatada vitaminas Dia 1L');
  assert.ok(fibra.includes('enriq_fibra'));
  assert.ok(prot.includes('enriq_proteinas'));
  assert.ok(vit.includes('enriq_vitaminas'));
});

console.log('\nvariantCanon — huevos grade/cría/qtd (Boss rule 4)');
test('huevos XL vs M vs L grade DISTINTOS', () => {
  const xl = variantCanon('Huevos super grandes XL Dia 12 unidades');
  const l = variantCanon('Huevos grandes L Dia 12 unidades');
  const m = variantCanon('Huevos medianos M Dia 12 unidades');
  assert.ok(xl.includes('huevo_xl'));
  assert.ok(l.includes('huevo_l'));
  assert.ok(m.includes('huevo_m'));
  assert.notEqual(xl, l);
  assert.notEqual(l, m);
});
test('huevos camperos vs suelo vs ecologicos cría DISTINTA', () => {
  const camperos = variantCanon('Huevos camperos L Pazo de Vilane 12 un');
  const suelo = variantCanon('Huevos grandes L de gallinas criadas en suelo Dia 12 un');
  const eco = variantCanon('Huevos ecologicos M pack 6');
  assert.ok(camperos.includes('huevo_camperos'));
  assert.ok(suelo.includes('huevo_suelo'));
  assert.ok(eco.includes('huevo_ecologicos'));
  assert.notEqual(camperos, suelo);
  assert.notEqual(suelo, eco);
});
test('huevos 6 vs 12 vs 30 unidades qtd DISTINTA', () => {
  const q6 = variantCanon('Huevos L Dia 6 unidades');
  const q12 = variantCanon('Huevos L Dia 12 unidades');
  const q30 = variantCanon('Huevos L Dia 30 unidades');
  assert.ok(q6.includes('huevo_qty_6'));
  assert.ok(q12.includes('huevo_qty_12'));
  assert.ok(q30.includes('huevo_qty_30'));
  assert.notEqual(q6, q12);
  assert.notEqual(q12, q30);
});

console.log('\nvariantCanon — aceite grau (Boss rule 1)');
test('aceite suave vs intenso dentro de refinado → variant DISTINTO', () => {
  const suave = variantCanon('Aceite de oliva suave Carbonell 1L');
  const intenso = variantCanon('Aceite de oliva intenso Carbonell 1L');
  assert.ok(suave.includes('aceite_suave'));
  assert.ok(intenso.includes('aceite_intenso'));
  assert.notEqual(suave, intenso);
});

console.log('\nvariantCanon — pão molde variantes');
test('pan blanco vs integral vs cereales → variantes distintos', () => {
  const blanco = variantCanon('Pan de molde blanco Bimbo 460g');
  const integral = variantCanon('Pan de molde integral Bimbo 460g');
  const cereales = variantCanon('Pan de molde cereales Bimbo 500g');
  assert.ok(blanco.includes('pan_blanco'));
  assert.ok(integral.includes('pan_integral'));
  assert.ok(cereales.includes('pan_cereales'));
  assert.notEqual(blanco, integral);
  assert.notEqual(integral, cereales);
});

// ────────────────────────────────────────────────────────────
// canonicalSize (DB-first) — Boss rule 6
// ────────────────────────────────────────────────────────────

console.log('\ncanonicalSize — DB first (Boss rule 6)');
test('packageSize + packageUnit DB preferido ao nome', () => {
  const s = canonicalSize('Leche entera brik', 1, 'LITER');
  assert.deepEqual(s, { value: 1000, unit: 'ml', pack: 1 });
});
test('sem DB mas size no nome → fallback', () => {
  const s = canonicalSize('Leche entera 1L', null, null);
  assert.deepEqual(s, { value: 1000, unit: 'ml', pack: 1 });
});
test('sem DB nem nome → null (produto SEM size, caller descarta)', () => {
  assert.equal(canonicalSize('Agua mineral grande', null, null), null);
});
test('DB override nome se discordam', () => {
  // DB diz 1,5L; nome diz "1L" — preferir DB.
  const s = canonicalSize('Agua mineral Dia 1L', 1.5, 'LITER');
  assert.deepEqual(s, { value: 1500, unit: 'ml', pack: 1 });
});

// ────────────────────────────────────────────────────────────
// sizeCanon + equivalentGroupKey
// ────────────────────────────────────────────────────────────

console.log('\nsizeCanon');
test('canonical string com pack', () => {
  assert.equal(sizeCanon({ value: 1000, unit: 'ml', pack: 1 }), '1000ml');
  assert.equal(sizeCanon({ value: 1000, unit: 'ml', pack: 6 }), '1000ml×6');
  assert.equal(sizeCanon({ value: 500, unit: 'g', pack: 1 }), '500g');
});
test('null → string vazia', () => {
  assert.equal(sizeCanon(null), '');
});

console.log('\nequivalentGroupKey');
test('mesmo typeKey+size+variant = mesma key independente marca', () => {
  const k1 = equivalentGroupKey('leche-entera', parseSize('1L'), 'Leche entera Hacendado 1L');
  const k2 = equivalentGroupKey('leche-entera', parseSize('1L'), 'Leche entera Dia Láctea 1L');
  const k3 = equivalentGroupKey('leche-entera', parseSize('1L'), 'Leche entera Pascual botella 1L');
  assert.equal(k1, k2);
  assert.equal(k2, k3);
});
test('leche regular vs calcio → keys distintas (via variantKey)', () => {
  const regular = equivalentGroupKey('leche-entera', parseSize('1L'), 'Leche entera Dia Láctea 1L');
  const calcio = equivalentGroupKey('leche-entera', parseSize('1L'), 'Leche entera calcio Dia Láctea 1L');
  assert.notEqual(regular, calcio);
});
test('tipos diferentes → keys distintas', () => {
  const entera = equivalentGroupKey('leche-entera', parseSize('1L'), 'Leche entera 1L');
  const semi = equivalentGroupKey('leche-semi', parseSize('1L'), 'Leche semidesnatada 1L');
  assert.notEqual(entera, semi);
});
test('tamanhos diferentes → keys distintas', () => {
  const l1 = equivalentGroupKey('leche-entera', parseSize('1L'), 'Leche entera 1L');
  const l2 = equivalentGroupKey('leche-entera', parseSize('1,5L'), 'Leche entera 1,5L');
  assert.notEqual(l1, l2);
});

console.log(`\n${pass} pass · ${fail} fail`);
process.exit(fail > 0 ? 1 : 0);
