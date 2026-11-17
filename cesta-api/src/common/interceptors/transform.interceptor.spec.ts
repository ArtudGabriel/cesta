import { StreamableFile } from '@nestjs/common';
import { of } from 'rxjs';
import { TransformInterceptor } from './transform.interceptor';

function mockContext() {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ headers: {} }),
    }),
  } as unknown as Parameters<TransformInterceptor<unknown>['intercept']>[0];
}

describe('TransformInterceptor', () => {
  it('envelopa valor plano em { data, meta }', (done) => {
    const i = new TransformInterceptor();
    i.intercept(mockContext(), { handle: () => of({ foo: 1 }) }).subscribe(
      (res) => {
        expect(res).toMatchObject({ data: { foo: 1 } });
        expect(res.meta.timestamp).toBeDefined();
        done();
      },
    );
  });

  it('Sprint 91: StreamableFile passa direto sem envelope (ZIP export)', (done) => {
    const i = new TransformInterceptor();
    const buf = Buffer.from([0x50, 0x4b, 0x03, 0x04]);
    const stream = new StreamableFile(buf);
    i.intercept(mockContext(), { handle: () => of(stream) }).subscribe(
      (res) => {
        expect(res).toBe(stream as unknown);
        expect(res).toBeInstanceOf(StreamableFile);
        done();
      },
    );
  });

  it('envelopa resultado paginado com pagination meta', (done) => {
    const i = new TransformInterceptor();
    i.intercept(mockContext(), {
      handle: () => of({ items: [1, 2], total: 2, page: 1, limit: 10 }),
    }).subscribe((res) => {
      expect(res.data).toEqual([1, 2]);
      expect(res.meta.pagination).toEqual({
        page: 1,
        limit: 10,
        total: 2,
        totalPages: 1,
      });
      done();
    });
  });
});
