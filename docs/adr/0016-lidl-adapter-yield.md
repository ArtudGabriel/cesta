# ADR 0016 — LIDL adapter yield recovery

**Status:** Accepted
**Date:** 2026-11-26
**Sprint:** S186

## Context

Production state 2026-11-26 12:16Z showed LIDL at only **41 products**
across the 40 seed queries the adapter has been shipping since S126.
Every other active supermarket had grown (Mercadona ~4000, DIA ~2945,
Eroski 746, Froiz 366, Aldi ~145) — LIDL alone had flatlined and
blocked the MVP catalog-breadth metric.

A live probe of `https://www.lidl.es/q/search?q=<query>&type=json`
confirmed the endpoint still returns a 1.5 MB HTML page with the
product grid inlined as HTML-encoded JSON. The anchor regex still
finds **48 `erpNumber` strings per query** — the same density the
S126 commit assumed. The breakage lives downstream in `parseSegment`.

Each product's inline JSON shape has drifted since S126:

```jsonc
"price":{
  "currencyCode":"EUR",
  "currencySymbol":"€",
  "discount":{"deletedPrice":49.99,"showDiscount":true,...},
  "displayedCurrency":"€",
  "hasStar":false,
  "hasVat":true,
  "packaging":{},                 // ← new empty sub-object
  "price":37.99,                  // ← the field we want
  ...
}
```

The S126 price regex was:

```
/"price":\{[^}]*?"price":(\d+(?:\.\d+)?)/
```

`[^}]*?` forbids the character `}`. When the lazy quantifier walks
forward from `"price":{`, it accepts the chars that make up
`"packaging":{` — up to and including `{` — but then hits `}` at
position 1 inside `packaging:{}` and the whole match fails. The inner
`"price":37.99` is **never reached** on the current payload, so every
product fails the price gate in `parseSegment` and is dropped.

A standalone `/tmp` probe across 4 live queries (leche / huevos /
pan / cafe) measured:

| regex        | leche | huevos | pan   | cafe  |
| ------------ | ----- | ------ | ----- | ----- |
| `[^}]*?`     | 0/48  | 0/46   | 0/48  | 0/48  |
| `[\s\S]{0,2000}?` | 48/48 | 46/46  | 48/48 | 48/48 |

4 queries alone produced **160 unique products** post-fix. Extrapolated
to 40 queries at a conservative 30–50% unique rate, the adapter should
land in the ~600–1000 range on next sync — well past the S186 G5
target of ≥200.

The 41 products currently live in prod look like leftovers from the
S126 initial run against the previous shape; nothing has made it in
since, matching when LIDL rolled the `packaging:{}` sub-object onto
the response.

## Decision

**Relax the price regex to tolerate nested sub-objects inside the
`price` block.** `[\s\S]{0,2000}?` allows any character (newlines
and braces included) across a bounded 2 kB window — enough to walk
past `discount`, `packaging`, `specialTaxes` etc. while still being
tight enough that a runaway match can't accidentally absorb a sibling
product's price.

Three other shapes were weighed:

- **(a) expand `SEED_QUERIES`** — doesn't fix the breakage; even 100
  queries at 0/48 still yield 0 new products.
- **(b) rate-limit relaxation** — probe showed LIDL has no anti-bot
  pushback at the current 2–5 s jitter from a datacenter IP; the
  adapter completes all 40 queries without a single 403/429/503. Not
  the bottleneck.
- **(c) full JSON parse** — scan for matching braces, slice the
  product object, feed it to `JSON.parse`. Correct but overkill for a
  one-field drift and introduces an HTML-entity decode path that's
  easy to get wrong on partial segments (the inline JSON is nested
  inside HTML attributes and the escape rules collide).

Opt (b) is logged separately — if LIDL yield still underruns target
after the regex fix, the next investigation is `SEED_QUERIES` coverage
(the current list is heavy on electrodomésticos-adjacent terms; a
category-first probe through `tienda.lidl.es` categories could add
breadth).

## Consequences

**Positive:**

- LIDL adapter recovers end-to-end without changing the fetch layer,
  the HTML-encoding decode, or the dedupe strategy. The only surface
  area touched is `parseSegment`'s price extraction.
- Fix is bounded: `{0,2000}` stops the lazy walk well before it could
  reach a sibling product's price (the next `erpNumber` anchor is
  ~13 kB downstream in the HTML-encoded payload, ~10 kB decoded).
- A regression spec locks the shape: the new test case feeds a
  realistic price block (`packaging:{}`, nested `discount`,
  `specialTaxes:[]`, mirrored `zones.BAL.currentPrice`) through the
  adapter and asserts the top-level price wins.

**Negative / trade-offs:**

- The regex is still a regex. If LIDL adds a key *outside* the price
  block named `"price"` within 2 kB of `"price":{`, lazy matching could
  catch the wrong number. The current shape doesn't do this (the
  fields between `"price":{` and the inner `"price":` are all inside
  the price block), but a JSON-parse rewrite is the long-term escape.
- No change to `SEED_QUERIES`; if the regex fix alone doesn't clear
  200, a follow-up sprint expands query coverage.

## Rollback

Revert the single-line regex change in
`cesta-api/src/modules/catalog-sync/adapters/lidl.adapter.ts`
(`parseSegment`, `priceMatch`). The corresponding regression test
(`"S186: extrai price com sub-objetos..."` in
`lidl.adapter.spec.ts`) will fail — expected. Prod LIDL yield returns
to the pre-S186 41-product floor.

## Boss guard (S186)

- Zero change to fetch layer, rate limits, headers, or user-agent pool.
- Zero change to Render/CI/deploy chain (ADR 0013/0014 unchanged).
- No new SEED_QUERIES. If post-deploy yield still underruns the G5
  target, the follow-up is a measurement on actual unique counts per
  query, not a blind list expansion.

## Verification

- Jest regression: `lidl.adapter.spec.ts` — 6/6 pass including the new
  realistic-shape case.
- Full catalog-sync suite: 196/196 pass (no cross-adapter regression).
- Nest build clean.
- Post-deploy G3: trigger manual LIDL sync via `POST /catalog-sync/run`
  with `supermarket=lidl`, read `/products?supermarket=lidl` total.
  G5 target ≥ 200.

## References

- Live LIDL probe: `scratchpad/lidl-{leche,huevos,pan,cafe}.html`
  (2026-11-26, HTTP 200, ~1.5 MB each, 46–48 products per query).
- S126 initial LIDL commit (adapter scaffold).
- `cesta-api/src/modules/catalog-sync/adapters/lidl.adapter.ts`.
