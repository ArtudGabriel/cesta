import { Module } from '@nestjs/common';
import { SupermarketsController } from './supermarkets.controller';
import { SupermarketsRepository } from './supermarkets.repository';
import { SupermarketsService } from './supermarkets.service';

@Module({
  controllers: [SupermarketsController],
  providers: [SupermarketsService, SupermarketsRepository],
  exports: [SupermarketsService],
})
export class SupermarketsModule {}
