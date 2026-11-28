/**
 * Sprint 234 G3 recall fix — spec test FIXO cases Boss directive.
 *
 * Fixtures representam os casos canônicos: Coca-Cola Zero 2L /
 * Original 2L / 330ml, Milka 125g, leche entera 1L. Cada caso valida
 * extractBrand + parseSize + normalizeNameForMatch + sizeMatch.
 *
 * Rodar standalone com node (zero deps): node scripts/lib/brand-normalize.spec.mjs
 */
import assert from 'node:assert/strict';
import {
  extractBrand,
  parseSize,
  sizeMatch,
  normalizeNameForMatch,
  extractVariants,
  variantMatch,
} from './brand-normalize.mjs';

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

console.log('extractBrand');
test('Coca-Cola variants', () => {
  assert.equal(extractBrand('Coca-Cola Zero Azucar 2L'), 'Coca-Cola');
  assert.equal(extractBrand('Coca Cola Original 2L'), 'Coca-Cola');
  assert.equal(extractBrand('refresco coca cola zero lata 330ml'), 'Coca-Cola');
});
test('Milka', () => {
  assert.equal(extractBrand('Chocolate Milka con leche 125g'), 'Milka');
  assert.equal(extractBrand('MILKA Oreo 100g'), 'Milka');
});
test('marca própria Mercadona Hacendado', () => {
  assert.equal(extractBrand('Leche entera Hacendado brik 1 L'), 'Hacendado');
});
test('marca Dia vs Dia Láctea desambiguation (longa primeiro)', () => {
  assert.equal(extractBrand('Leche semidesnatada Dia Láctea pack 6'), 'Dia Láctea');
  assert.equal(extractBrand('Galletas Dia 300g'), 'Dia');
});
test('zero match (produto sem marca conhecida)', () => {
  assert.equal(extractBrand('Naranja a granel'), null);
});

console.log('\nparseSize');
test('2L', () => {
  assert.deepEqual(parseSize('Coca-Cola Zero 2L'), { value: 2000, unit: 'ml', pack: 1 });
});
test('1,25 L (vírgula decimal europeia)', () => {
  assert.deepEqual(parseSize('Bezoya agua mineral 1,25 L'), { value: 1250, unit: 'ml', pack: 1 });
});
test('330 ml lata', () => {
  assert.deepEqual(parseSize('Coca-Cola Zero lata 330 ml'), { value: 330, unit: 'ml', pack: 1 });
});
test('12 x 330 ml multi-pack latas', () => {
  assert.deepEqual(parseSize('Coca-Cola Zero 12 x 330 ml'), { value: 330, unit: 'ml', pack: 12 });
});
test('pack 6 x 1 L multi-pack briks', () => {
  assert.deepEqual(parseSize('Leche pack 6 x 1 L'), { value: 1000, unit: 'ml', pack: 6 });
});
test('500 g / 500gr equivalentes', () => {
  assert.deepEqual(parseSize('Milka tableta 125g'), { value: 125, unit: 'g', pack: 1 });
  assert.deepEqual(parseSize('Queso curado 500 gr'), { value: 500, unit: 'g', pack: 1 });
});
test('1kg', () => {
  assert.deepEqual(parseSize('Azúcar blanco 1kg'), { value: 1000, unit: 'g', pack: 1 });
});
test('pack 6 (sem unit size)', () => {
  assert.deepEqual(parseSize('Yogur natural pack 6'), { value: 1, unit: 'un', pack: 6 });
});
test('nome sem size → null', () => {
  assert.equal(parseSize('Leche entera brick'), null);
});

console.log('\nsizeMatch');
test('2L == 2 L (exato)', () => {
  assert.equal(sizeMatch('Coca-Cola Zero 2L', 'Coca-Cola Original 2 L'), true);
});
test('2L != 1.5L', () => {
  assert.equal(sizeMatch('Coca-Cola Zero 2L', 'Coca-Cola Zero 1,5 L'), false);
});
test('330ml != 500ml', () => {
  assert.equal(sizeMatch('lata 330 ml', 'lata 500 ml'), false);
});
test('pack 6 x 1L == pack 6 x 1L', () => {
  assert.equal(sizeMatch('Leche pack 6 x 1 L', 'Leche 6 x 1 L'), true);
});
test('pack 6 x 1L != 1L single', () => {
  assert.equal(sizeMatch('Leche pack 6 x 1 L', 'Leche brik 1 L'), false);
});
test('12 x 330ml == 12 x 330ml', () => {
  assert.equal(sizeMatch('Coca Cola 12 x 330 ml', 'Coca-Cola pack 12 x 330 ml'), true);
});
test('sem size em alguma → false', () => {
  assert.equal(sizeMatch('Leche entera brik', 'Leche brik 1 L'), false);
});

console.log('\nnormalizeNameForMatch');
test('Coca-Cola Zero 2L → "zero azucar"', () => {
  const n = normalizeNameForMatch('Coca-Cola Zero Azucar Botella 2 L', 'Coca-Cola');
  assert.match(n, /zero/);
  assert.match(n, /azucar/);
  assert.doesNotMatch(n, /coca/);
  assert.doesNotMatch(n, /cola/);
  assert.doesNotMatch(n, /\b2\b|\bl\b|botella/);
});
test('Leche entera Hacendado brik 1 L → "leche entera"', () => {
  const n = normalizeNameForMatch('Leche entera Hacendado brik 1 L', 'Hacendado');
  assert.equal(n, 'leche entera');
});
test('acentos removidos', () => {
  const n = normalizeNameForMatch('Azúcar blanco Azucarera 1 Kg', 'Azucarera');
  assert.match(n, /azucar blanco/);
  assert.doesNotMatch(n, /úca/);
});
test('multi-pack token removido', () => {
  const n = normalizeNameForMatch('Coca-Cola Zero 12 x 330 ml pack 12', 'Coca-Cola');
  assert.match(n, /zero/);
  assert.doesNotMatch(n, /12|330|pack/);
});

console.log('\nextractVariants / variantMatch (Sprint 235)');
test('Coca-Cola Zero ≠ Coca-Cola Original', () => {
  const vz = extractVariants('Coca-Cola Zero Azucar 2L');
  const vo = extractVariants('Coca-Cola Original 2L');
  assert.equal(vz.has('zero'), true);
  assert.equal(vo.has('original'), true);
  assert.equal(variantMatch(vz, vo), false);
});
test('Coca-Cola Zero == Coca-Cola Zero (ambos sides)', () => {
  const v1 = extractVariants('Coca-Cola Zero Azucar 2L');
  const v2 = extractVariants('Refresco Coca Cola zero sin azucar 2 L');
  assert.equal(variantMatch(v1, v2), true);
});
test('Milka avelã ≠ Milka classic', () => {
  const va = extractVariants('Chocolate Milka con avelana 125g');
  const vc = extractVariants('Chocolate Milka con leche 125g');
  assert.equal(va.has('avelana'), true);
  assert.equal(variantMatch(va, vc), false);
});
test("Lay's Horno ≠ Lay's regular (un lado so)", () => {
  const vh = extractVariants("Lay's Horno al punto de sal 150g");
  const vr = extractVariants("Lay's al punto de sal 150g");
  assert.equal(vh.has('horno'), true);
  assert.equal(vr.has('horno'), false);
  assert.equal(variantMatch(vh, vr), false);
});
test('Oreo golden ≠ Oreo original', () => {
  const vg = extractVariants('Mini galletas Oreo golden 160g');
  const vo = extractVariants('Mini galletas Oreo 160g');
  assert.equal(vg.has('golden'), true);
  assert.equal(variantMatch(vg, vo), false);
});
test('ambos sem variants → match (set vazio vs vazio)', () => {
  const v1 = extractVariants('Pan de molde integral 460g');
  const v2 = extractVariants('Pan molde integral 460 g');
  assert.equal(variantMatch(v1, v2), true);
});
test('Sprint 244: Nivea Black and White Invisible MEN ≠ MUJER', () => {
  const vm = extractVariants('Nivea Black and White Invisible Men 200ml');
  const vw = extractVariants('Nivea Black and White Invisible Mujer 200ml');
  assert.equal(vm.has('men'), true);
  assert.equal(vw.has('mujer'), true);
  assert.equal(variantMatch(vm, vw), false);
});
test('Sprint 244: Roll-on Nivea Men 50ml ≠ Roll-on Nivea 50ml', () => {
  const vm = extractVariants('Desodorante roll-on Nivea Men 50ml');
  const vr = extractVariants('Desodorante roll-on Nivea 50ml');
  assert.equal(vm.has('men'), true);
  assert.equal(vr.has('men'), false);
  assert.equal(variantMatch(vm, vr), false);
});
test('Sprint 244: hombre == men (sinonímia não normalizada, variant tokens distintos ≠ match)', () => {
  // Decisão explícita ADR 0044: os dois tokens ficam SEPARADOS no set
  // (não normalizamos). Match exato exige ambos lados usando mesmo token.
  const v1 = extractVariants('Gel baño Nivea Hombre 500ml');
  const v2 = extractVariants('Gel baño Nivea Men 500ml');
  assert.equal(v1.has('hombre'), true);
  assert.equal(v2.has('men'), true);
  assert.equal(variantMatch(v1, v2), false);
});
test('Sprint 244: kids/infantil/bebe discriminam público-alvo', () => {
  const vk = extractVariants('Pasta dientes Oral-B Kids fresa 75ml');
  const va = extractVariants('Pasta dientes Oral-B Pro Expert 75ml');
  assert.equal(vk.has('kids'), true);
  assert.equal(variantMatch(vk, va), false);
});

console.log(`\n${pass} pass · ${fail} fail`);
process.exit(fail > 0 ? 1 : 0);
