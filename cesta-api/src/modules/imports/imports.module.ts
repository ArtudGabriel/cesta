import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ImportsController } from './imports.controller';
import { ImportsProcessor } from './imports.processor';
import { IMPORTS_QUEUE } from './imports.queue';
import { ImportsRepository } from './imports.repository';
import { ImportsService } from './imports.service';

@Module({
  imports: [BullModule.registerQueue({ name: IMPORTS_QUEUE })],
  controllers: [ImportsController],
  providers: [ImportsService, ImportsRepository, ImportsProcessor],
  exports: [ImportsService],
})
export class ImportsModule {}
