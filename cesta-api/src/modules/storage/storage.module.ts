import { Global, Module } from '@nestjs/common';
import { R2StorageService } from './r2-storage.service';
import { STORAGE_SERVICE } from './storage.service.interface';

/**
 * Sprint 135: Storage global. Consumidores injetam via
 * `@Inject(STORAGE_SERVICE)` e dependem apenas da interface
 * `StorageService` — swap R2 ↔ Blob ↔ qualquer S3 fica local ao módulo.
 */
@Global()
@Module({
  providers: [
    R2StorageService,
    { provide: STORAGE_SERVICE, useExisting: R2StorageService },
  ],
  exports: [STORAGE_SERVICE, R2StorageService],
})
export class StorageModule {}
