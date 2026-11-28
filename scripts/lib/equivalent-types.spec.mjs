/**
 * Sprint 245 (ADR 0046) — specs equivalent-types.
 * Standalone node test (zero deps).
 */
import assert from 'node:assert/strict';
import { classifyTypeKey, sizeCanon, variantCanon, equivalentGroupKey } from './equivalent-types.mjs';
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

console.log('classifyTypeKey (5 categorias piloto)');
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
test('agua mineral cross-brand', () => {
  assert.equal(classifyTypeKey('Agua mineral Bezoya 1,5L', 'Bezoya'), 'agua-mineral');
  assert.equal(classifyTypeKey('Agua mineral Font Vella 1,5L'), 'agua-mineral');
  assert.equal(classifyTypeKey('Agua sin gas Lanjarón 1,5L'), 'agua-mineral');
});
test('huevos', () => {
  assert.equal(classifyTypeKey('Huevos frescos L docena 12 un'), 'huevos');
  assert.equal(classifyTypeKey('Huevos ecologicos M pack 6'), 'huevos');
});
test('aceite oliva virgen extra prioridade sobre oliva', () => {
  assert.equal(classifyTypeKey('Aceite de oliva virgen extra Carbonell 1L', 'Carbonell'), 'aceite-oliva-ve');
  assert.equal(classifyTypeKey('Aceite oliva Hacendado 1L', 'Hacendado'), 'aceite-oliva');
});
test('pan molde variantes', () => {
  assert.equal(classifyTypeKey('Pan molde integral Bimbo 460g', 'Bimbo'), 'pan-molde');
  assert.equal(classifyTypeKey('Pan de molde blanco Hacendado 460g', 'Hacendado'), 'pan-molde');
});
test('fora do piloto → null', () => {
  assert.equal(classifyTypeKey('Coca-Cola Zero 2L', 'Coca-Cola'), null);
  assert.equal(classifyTypeKey('Yogur natural pack 6', 'Danone'), null);
  assert.equal(classifyTypeKey('Chocolate Milka 125g', 'Milka'), null);
});

console.log('\nsizeCanon');
test('canonical string com pack', () => {
  assert.equal(sizeCanon({ value: 1000, unit: 'ml', pack: 1 }), '1000ml');
  assert.equal(sizeCanon({ value: 1000, unit: 'ml', pack: 6 }), '1000ml×6');
  assert.equal(sizeCanon({ value: 500, unit: 'g', pack: 1 }), '500g');
});
test('null → string vazia', () => {
  assert.equal(sizeCanon(null), '');
});

console.log('\nvariantCanon');
test('ordena deterministico', () => {
  // extractVariants pode retornar em ordem interna; variantCanon normaliza.
  const a = variantCanon('Leche entera sin lactosa 1L');
  const b = variantCanon('Leche sin lactosa entera 1L');
  assert.equal(a, b);
});
test('sem variants → vazio', () => {
  assert.equal(variantCanon('Leche 1L'), '');
});

console.log('\nequivalentGroupKey');
test('mesmo tipo+tamanho+variante = mesma key independente de marca', () => {
  const k1 = equivalentGroupKey('leche-entera', parseSize('1L'), 'Leche entera Hacendado 1L');
  const k2 = equivalentGroupKey('leche-entera', parseSize('1L'), 'Leche entera Dia Láctea 1L');
  const k3 = equivalentGroupKey('leche-entera', parseSize('1L'), 'Leche entera Pascual botella 1L');
  assert.equal(k1, k2);
  assert.equal(k2, k3);
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
