import {
  BANDWIDTH_FRIENDLY_WORKER_OPTIONS,
  withBandwidthOptions,
} from './worker-options';

describe('worker-options (Sprint 213 bandwidth)', () => {
  it('BANDWIDTH_FRIENDLY_WORKER_OPTIONS matches ADR 0025 budget', () => {
    expect(BANDWIDTH_FRIENDLY_WORKER_OPTIONS).toEqual({
      drainDelay: 30,
      stalledInterval: 120_000,
    });
  });

  it('withBandwidthOptions preserva opts extras', () => {
    const merged = withBandwidthOptions({ concurrency: 3 });
    expect(merged.concurrency).toBe(3);
    expect(merged.drainDelay).toBe(30);
    expect(merged.stalledInterval).toBe(120_000);
  });

  it('withBandwidthOptions permite override via extra', () => {
    const merged = withBandwidthOptions({ drainDelay: 60 });
    expect(merged.drainDelay).toBe(60);
    expect(merged.stalledInterval).toBe(120_000);
  });

  it('withBandwidthOptions sem extra retorna só defaults bandwidth', () => {
    const merged = withBandwidthOptions();
    expect(merged).toEqual(BANDWIDTH_FRIENDLY_WORKER_OPTIONS);
  });
});
