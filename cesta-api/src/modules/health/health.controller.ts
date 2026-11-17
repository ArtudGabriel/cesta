import { Controller, Get, HttpCode, HttpStatus, Res } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { Public } from '../../common/decorators/public.decorator';
import { HealthService } from './health.service';

@ApiTags('Health')
@Controller()
export class HealthController {
  constructor(private readonly health: HealthService) {}

  @Public()
  @Get('health')
  @ApiOperation({
    summary: 'Shallow liveness (no I/O). Render polling + keep-alive cron.',
  })
  @HttpCode(HttpStatus.OK)
  shallow() {
    return this.health.shallow();
  }

  // Sprint 87: readiness probe com I/O (DB + Redis). Rate limit 10/min
  // evita que monitoring externo (UptimeRobot, etc) batenha repo + redis
  // em alta frequência — degrada performance real do app.
  @Public()
  @Get('health/deep')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({
    summary:
      'Deep health check (Prisma SELECT 1 + Redis PING). 200 ok | 503 degraded. Rate limit 10/min.',
  })
  @HttpCode(HttpStatus.OK)
  async deep(@Res({ passthrough: true }) res: Response) {
    const report = await this.health.report();
    if (report.status !== 'ok') {
      res.status(HttpStatus.SERVICE_UNAVAILABLE);
    }
    return report;
  }
}
