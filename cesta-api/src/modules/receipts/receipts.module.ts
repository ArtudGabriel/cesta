import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import {
  PRICE_CORRECTION_QUEUE,
  PriceCorrectionProcessor,
} from './price-correction.processor';
import { ReceiptsController } from './receipts.controller';
import { ReceiptsProcessor, RECEIPTS_QUEUE } from './receipts.processor';
import { ReceiptsRepository } from './receipts.repository';
import { ReceiptsService } from './receipts.service';

@Module({
  imports: [
    BullModule.registerQueue(
      { name: RECEIPTS_QUEUE },
      { name: PRICE_CORRECTION_QUEUE },
    ),
  ],
  controllers: [ReceiptsController],
  providers: [
    ReceiptsService,
    ReceiptsRepository,
    ReceiptsProcessor,
    PriceCorrectionProcessor,
  ],
  exports: [ReceiptsService],
})
export class ReceiptsModule {}
