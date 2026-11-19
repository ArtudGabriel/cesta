import { buildRedisConnection } from './redis-connection';

describe('buildRedisConnection', () => {
  it('adds tls={} when protocol is rediss://', () => {
    const conn = buildRedisConnection(
      'rediss://default:pwd@fly-example.upstash.io:6379',
    );
    expect(conn).toEqual({
      host: 'fly-example.upstash.io',
      port: 6379,
      password: 'pwd',
      tls: {},
    });
  });

  it('leaves tls undefined when protocol is redis:// (plain)', () => {
    const conn = buildRedisConnection('redis://localhost:6379');
    expect(conn.tls).toBeUndefined();
    expect(conn.host).toBe('localhost');
    expect(conn.port).toBe(6379);
  });

  it('defaults port to 6379 when URL omits it', () => {
    const conn = buildRedisConnection('rediss://default:pwd@host');
    expect(conn.port).toBe(6379);
    expect(conn.tls).toEqual({});
  });
});
