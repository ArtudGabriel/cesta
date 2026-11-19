// Sprint 112: Upstash Redis free tier exige TLS (rediss://). ioredis não
// habilita TLS automaticamente só pelo protocolo da URL; é preciso passar
// `tls: {}` explícito. Sem isso, `queue.waitUntilReady()` fica pending
// silencioso → S108-S111 populate autostart todos broke downstream.
export function buildRedisConnection(redisUrl: string): {
  host: string;
  port: number;
  password?: string;
  tls?: Record<string, never>;
} {
  const url = new URL(redisUrl);
  return {
    host: url.hostname,
    port: Number(url.port || 6379),
    password: url.password || undefined,
    tls: url.protocol === 'rediss:' ? {} : undefined,
  };
}
