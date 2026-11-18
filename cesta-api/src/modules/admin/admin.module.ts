import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { UsersModule } from '../users/users.module';
import { AdminController } from './admin.controller';
import { AdminMetricsRepository } from './admin-metrics.repository';
import { AdminMetricsService } from './admin-metrics.service';

@Module({
  imports: [UsersModule, AuditModule],
  controllers: [AdminController],
  providers: [AdminMetricsRepository, AdminMetricsService],
})
export class AdminModule {}
