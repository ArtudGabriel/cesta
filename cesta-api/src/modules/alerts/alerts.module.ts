import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { ProductsRepository } from '../products/products.repository';
import { AlertsController } from './alerts.controller';
import {
  PRICE_ALERTS_QUEUE,
  PriceAlertsProcessor,
} from './alerts.processor';
import { AlertsRepository } from './alerts.repository';
import { AlertsService } from './alerts.service';

@Module({
  imports: [
    BullModule.registerQueue({ name: PRICE_ALERTS_QUEUE }),
    NotificationsModule,
  ],
  controllers: [AlertsController],
  providers: [
    AlertsService,
    AlertsRepository,
    PriceAlertsProcessor,
    ProductsRepository,
  ],
  exports: [AlertsRepository],
})
export class AlertsModule {}
