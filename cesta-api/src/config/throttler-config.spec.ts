import {
  STRICT_GLOBAL_NO_OP_THRESHOLD,
  THROTTLER_CONFIG,
} from './throttler-config';

/**
 * Anti-regression guard — bug throttler strict global bateu 3× sem spec:
 *   - S98 (2026-09-xx): strict:5 global cortava autocomplete. Fix inline.
 *   - S227 bundle 1 (2026-11-27): strict:5 voltou + cortava browsing
 *     publico (PDP crash #10/#11, busca lista #14, bottom nav #15).
 *   - Retro Reviewer 2026-11-27 14:04: spec obrigatorio pra fechar loop.
 *
 * Regras:
 *   a) `default` throttler livre (limite de UX humano, nao-abusivo).
 *   b) `strict` e `write` em forRoot sao "no-op globais" (limit >=
 *      STRICT_GLOBAL_NO_OP_THRESHOLD = 1000/60s) OU removidos de forRoot.
 *      Rotas sensiveis declaram @Throttle({strict:{limit:N,...}}) inline
 *      que ganha pela rota especifica. Se qualquer limite global cair
 *      abaixo do threshold, este test FALHA e Reviewer tem que justificar.
 *   c) Memory [[feedback-throttler-named-global]] documenta pattern; este
 *      spec e a trava mecanica.
 */
describe('THROTTLER_CONFIG (anti-regression S98 + S227 bundle 1)', () => {
  it('default throttler existe e tem limite razoavel', () => {
    const def = THROTTLER_CONFIG.find((e) => e.name === 'default');
    expect(def).toBeDefined();
    expect(def!.limit).toBeGreaterThanOrEqual(60);
    expect(def!.ttl).toBeGreaterThanOrEqual(10_000);
  });

  it.each(['strict', 'write'] as const)(
    '`%s` throttler em forRoot e no-op global (>= threshold) OU ausente',
    (name) => {
      const entry = THROTTLER_CONFIG.find((e) => e.name === name);
      if (!entry) {
        // Removido de forRoot e aceitavel — nao aplica globalmente.
        return;
      }
      expect(entry.limit).toBeGreaterThanOrEqual(STRICT_GLOBAL_NO_OP_THRESHOLD);
    },
  );

  it('threshold documentado e atende ambos limites atuais', () => {
    expect(STRICT_GLOBAL_NO_OP_THRESHOLD).toBeGreaterThanOrEqual(1_000);
  });
});
