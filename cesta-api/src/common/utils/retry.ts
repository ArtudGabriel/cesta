/**
 * Shared retry utility — Sprint 189 G2.
 *
 * Generaliza o padrão de retry usado em 3 lugares distintos hoje:
 *   - `render-build.sh` (ADR 0013) — prisma migrate deploy, backoff 10/20/40s.
 *   - `polite-fetch.ts` — HTTP status retry com Retry-After + anti-bot wait.
 *   - adapters futuros (ScrapingBee ADR 0009, Puppeteer S138) que vão querer
 *     retry isolado do fetch HTTP (ex: parse falhas transientes de payload).
 *
 * Contract:
 *   - Pure async function; retries até `attempts` vezes (`attempts=3` default
 *     significa 1 try inicial + 2 retries = 3 execuções).
 *   - Backoff: array de ms por attempt-gap. `[1000, 2000, 4000]` significa
 *     dormir 1s pré-retry 2º, 2s pré-retry 3º, 4s pré-retry 4º se houvesse.
 *     Se array menor que attempts-1, o último valor é reusado.
 *   - Abort via AbortSignal: termina imediato com `AbortError`. Sleep em
 *     progresso é interrompido (não precisa esperar backoff).
 *   - onAttempt callback: observabilidade (log, breadcrumb, metric). Recebe
 *     `{attempt, error, backoffMs}` ANTES do sleep do backoff.
 *   - isRetryable: predicate opcional. Erro que NÃO é retryable propaga
 *     imediato sem backoff. Default: toda exceção é retryable.
 *   - Final attempt falha → erro propaga (último catch).
 *
 * Não é um replacement de polite-fetch retry (HTTP status + Retry-After
 * header + anti-bot min wait). Follow-up: migrar polite-fetch pra usar
 * withRetry internamente após empirical restore (requer regression prod).
 */

export type OnAttemptInfo = {
  attempt: number;
  error: unknown;
  backoffMs: number;
};

export type WithRetryOptions = {
  /** Número total de execuções permitidas (1 try inicial + retries). Default 3. */
  attempts?: number;
  /** Array de delays em ms entre attempts; último valor reusa se array curto. Default [1000, 2000, 4000]. */
  backoffMs?: number[];
  /** Callback antes do sleep de backoff pre-retry. */
  onAttempt?: (info: OnAttemptInfo) => void | Promise<void>;
  /** Predicate decidindo se erro deve ser retried. Default: sempre true. */
  isRetryable?: (error: unknown) => boolean;
  /** Abort signal; termina em curso e propaga AbortError. */
  signal?: AbortSignal;
};

export class AbortError extends Error {
  constructor(message = 'aborted') {
    super(message);
    this.name = 'AbortError';
  }
}

const DEFAULTS = {
  attempts: 3,
  backoffMs: [1_000, 2_000, 4_000],
} as const;

function pickBackoff(backoff: number[], attemptIndex: number): number {
  if (backoff.length === 0) return 0;
  return backoff[Math.min(attemptIndex, backoff.length - 1)];
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  if (ms <= 0) return Promise.resolve();
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new AbortError());
      return;
    }
    const timeout = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timeout);
      signal?.removeEventListener('abort', onAbort);
      reject(new AbortError());
    };
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

export async function withRetry<T>(
  fn: (attempt: number) => Promise<T>,
  options: WithRetryOptions = {},
): Promise<T> {
  const attempts = options.attempts ?? DEFAULTS.attempts;
  const backoffMs = options.backoffMs ?? [...DEFAULTS.backoffMs];
  const isRetryable = options.isRetryable ?? (() => true);
  const signal = options.signal;

  if (attempts < 1) {
    throw new RangeError('withRetry: attempts must be >= 1');
  }

  let lastError: unknown;
  for (let i = 0; i < attempts; i += 1) {
    if (signal?.aborted) {
      throw new AbortError();
    }
    try {
      return await fn(i + 1);
    } catch (err) {
      lastError = err;
      // Caller-initiated abort via signal takes precedence: stop immediately
      // regardless of what fn threw. In-fn AbortError (e.g. fetch internal
      // timeout controller) is treated as a regular error — caller can mark
      // it non-retryable via isRetryable if they want short-circuit.
      if (signal?.aborted) {
        throw new AbortError();
      }
      // Our own AbortError sentinel still propagates (caller signals abort by
      // throwing it explicitly from fn as an alternative to signal).
      if (err instanceof AbortError) {
        throw err;
      }
      const isLast = i === attempts - 1;
      const retryable = isRetryable(err);
      if (isLast || !retryable) {
        throw err;
      }
      const backoff = pickBackoff(backoffMs, i);
      try {
        await options.onAttempt?.({
          attempt: i + 1,
          error: err,
          backoffMs: backoff,
        });
      } catch {
        // Observability callback failure never derruba retry.
      }
      try {
        await sleep(backoff, signal);
      } catch (sleepErr) {
        if (sleepErr instanceof AbortError) {
          throw sleepErr;
        }
        throw sleepErr;
      }
    }
  }
  // Unreachable: last attempt throws. Guard for type checker.
  throw lastError;
}
