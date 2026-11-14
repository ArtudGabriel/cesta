// Sprint 64: constantes do fluxo hard-delete isoladas em arquivo sem imports
// de `@nestjs/bullmq` pra permitir uso em tests Jest sem precisar transformar
// o pacote (ESM via @nestjs/bull-shared).

export const USER_CLEANUP_QUEUE = 'user-cleanup';

export interface HardDeleteJob {
  userId: string;
}
