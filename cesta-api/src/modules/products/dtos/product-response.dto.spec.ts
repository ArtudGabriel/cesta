import {
  computeIsStale,
  parseStaleThresholdHours,
  ProductResponseDto,
  resolveIsStale,
} from './product-response.dto';

const HOUR_MS = 60 * 60 * 1000;

function makeProduct(
  prices: Array<{
    price: number;
    isAvailable: boolean;
    lastSyncedAt: Date;
    slug?: string;
  }>,
) {
  return {
    id: 'p1',
    name: 'Test',
    brand: null,
    imageUrl: null,
    categoryId: null,
    packageSize: 1 as unknown as any,
    packageUnit: 'un' as any,
    comparisonUnit: 'un' as any,
    calories: null,
    protein: null,
    fat: null,
    saturatedFat: null,
    carbs: null,
    sugar: null,
    salt: null,
    fiber: null,
    nutritionPer: null,
    isVegan: false,
    isVegetarian: false,
    isGlutenFree: false,
    isLactoseFree: false,
    category: null,
    prices: prices.map((p, i) => ({
      supermarketId: `sm${i}`,
      productId: 'p1',
      currentPrice: p.price as unknown as any,
      previousPrice: null,
      onPromotion: false,
      isAvailable: p.isAvailable,
      isStale: false,
      lastSyncedAt: p.lastSyncedAt,
      confidenceScore: 1 as unknown as any,
      supermarket: {
        id: `sm${i}`,
        slug: p.slug ?? `s${i}`,
        name: `Super ${i}`,
        color: null,
      },
    })) as any,
  };
}

describe('computeIsStale', () => {
  const now = new Date('2026-11-27T12:00:00Z').getTime();
  const threshold48hMs = 48 * HOUR_MS;

  it('retorna false quando sync recente (<48h)', () => {
    const recent = new Date(now - 10 * HOUR_MS);
    expect(computeIsStale(recent, now, threshold48hMs)).toBe(false);
  });

  it('retorna true quando sync antigo (>48h)', () => {
    const old = new Date(now - 72 * HOUR_MS);
    expect(computeIsStale(old, now, threshold48hMs)).toBe(true);
  });

  it('retorna false no boundary exato 48h', () => {
    const boundary = new Date(now - 48 * HOUR_MS);
    expect(computeIsStale(boundary, now, threshold48hMs)).toBe(false);
  });

  it('retorna true quando lastSyncedAt null', () => {
    expect(computeIsStale(null, now, threshold48hMs)).toBe(true);
  });

  it('retorna true quando Date invalid', () => {
    expect(computeIsStale('not-a-date', now, threshold48hMs)).toBe(true);
  });
});

describe('resolveIsStale (Sprint 226 AJUSTE P1)', () => {
  const now = new Date('2026-11-27T12:00:00Z').getTime();
  const fresh = new Date(now - 10 * HOUR_MS);
  const old = new Date(now - 12 * 24 * HOUR_MS); // 12d, Froiz empírico

  it('OR DB column: dbIsStale=true + timestamp fresco -> true', () => {
    // Adapter rodou last sync, markStaleForSupermarket flipou coluna
    // (produto delistado). Idade do timestamp irrelevante.
    expect(resolveIsStale(true, fresh)).toBe(true);
  });

  it('OR age-based: dbIsStale=false + timestamp 12d -> true (Froiz bug)', () => {
    // Cron falhou entre ciclos. Coluna fica false pela last successful
    // upsert, mas idade excede threshold. Badge precisa firar.
    // Nao podemos chamar computeIsStale sem threshold override, mas o
    // STALE_THRESHOLD_MS de modulo load (48h) cobre 12d > 48h.
    expect(resolveIsStale(false, old)).toBe(true);
  });

  it('ambos false -> false', () => {
    expect(resolveIsStale(false, fresh)).toBe(false);
  });

  it('dbIsStale=true vence mesmo com timestamp null', () => {
    expect(resolveIsStale(true, null)).toBe(true);
  });

  it('timestamp null fallback -> true', () => {
    expect(resolveIsStale(false, null)).toBe(true);
  });
});

describe('parseStaleThresholdHours', () => {
  it('default 48 quando undefined', () => {
    expect(parseStaleThresholdHours(undefined)).toBe(48);
  });
  it('default 48 quando vazio', () => {
    expect(parseStaleThresholdHours('')).toBe(48);
  });
  it('parse valor numérico válido', () => {
    expect(parseStaleThresholdHours('24')).toBe(24);
    expect(parseStaleThresholdHours(72)).toBe(72);
  });
  it('default 48 quando valor inválido', () => {
    expect(parseStaleThresholdHours('abc')).toBe(48);
    expect(parseStaleThresholdHours('-5')).toBe(48);
    expect(parseStaleThresholdHours('0')).toBe(48);
  });
});

describe('ProductResponseDto.isStale top-level', () => {
  const now = Date.now();

  it('false quando cheapest price fresco', () => {
    const product = makeProduct([
      { price: 2.0, isAvailable: true, lastSyncedAt: new Date(now) },
      { price: 3.0, isAvailable: true, lastSyncedAt: new Date(now) },
    ]);
    const dto = ProductResponseDto.fromEntity(product as any);
    expect(dto.isStale).toBe(false);
    expect(dto.prices.every((p) => !p.isStale)).toBe(true);
  });

  it('true quando cheapest price stale', () => {
    const stale = new Date(now - 100 * HOUR_MS);
    const product = makeProduct([
      { price: 2.0, isAvailable: true, lastSyncedAt: stale }, // cheapest
      { price: 3.0, isAvailable: true, lastSyncedAt: new Date(now) },
    ]);
    const dto = ProductResponseDto.fromEntity(product as any);
    expect(dto.isStale).toBe(true);
    const cheapest = dto.prices.find((p) => p.price === 2.0);
    expect(cheapest?.isStale).toBe(true);
  });

  it('false quando cheapest fresco mesmo com outro stale', () => {
    const stale = new Date(now - 100 * HOUR_MS);
    const product = makeProduct([
      { price: 2.0, isAvailable: true, lastSyncedAt: new Date(now) }, // cheapest fresco
      { price: 3.0, isAvailable: true, lastSyncedAt: stale },
    ]);
    const dto = ProductResponseDto.fromEntity(product as any);
    expect(dto.isStale).toBe(false);
  });

  it('false quando sem preços available', () => {
    const product = makeProduct([
      { price: 2.0, isAvailable: false, lastSyncedAt: new Date(now) },
    ]);
    const dto = ProductResponseDto.fromEntity(product as any);
    expect(dto.isStale).toBe(false);
    expect(dto.cheapestPrice).toBeNull();
  });
});
