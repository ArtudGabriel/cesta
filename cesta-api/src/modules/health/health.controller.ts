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
    return this.runDeep(res);
  }

  // Sprint 193 (S71 nit close): `/ready` como readiness probe padrão
  // K8s/Render. Semantically idêntico a /health/deep — alias documenta
  // convenção pra orquestradores (liveness=/health, readiness=/ready).
  // /health/deep mantido pra backward compat com monitors externos
  // (UptimeRobot, Better Uptime) configurados antes do rename.
  @Public()
  @Get('ready')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({
    summary:
      'Readiness probe (K8s/Render). Prisma SELECT 1 + Redis PING. Alias de /health/deep.',
  })
  @HttpCode(HttpStatus.OK)
  async ready(@Res({ passthrough: true }) res: Response) {
    return this.runDeep(res);
  }

  private async runDeep(res: Response) {
    const report = await this.health.report();
    if (report.status !== 'ok') {
      res.status(HttpStatus.SERVICE_UNAVAILABLE);
    }
    return report;
  }
}
