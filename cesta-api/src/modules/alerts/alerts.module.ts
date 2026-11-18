import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { ProductsRepository } from '../products/products.repository';
import {
  ALERT_PRICE_CHECK_QUEUE,
  AlertPriceCheckProcessor,
} from './alert-price-check.processor';
import {
  ALERT_RULE_EVAL_QUEUE,
  AlertRuleEvaluatorProcessor,
} from './alert-rule-evaluator.processor';
import { AlertsController } from './alerts.controller';
import {
  PRICE_ALERTS_QUEUE,
  PriceAlertsProcessor,
} from './alerts.processor';
import { AlertsRepository } from './alerts.repository';
import { AlertsService } from './alerts.service';

@Module({
  imports: [
    BullModule.registerQueue(
      { name: PRICE_ALERTS_QUEUE },
      { name: ALERT_PRICE_CHECK_QUEUE },
      { name: ALERT_RULE_EVAL_QUEUE },
    ),
    NotificationsModule,
  ],
  controllers: [AlertsController],
  providers: [
    AlertsService,
    AlertsRepository,
    PriceAlertsProcessor,
    AlertPriceCheckProcessor,
    AlertRuleEvaluatorProcessor,
    ProductsRepository,
  ],
  exports: [AlertsRepository],
})
export class AlertsModule {}
