import { Body, Controller, HttpCode, HttpStatus, Logger, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../../common/decorators/public.decorator';
import { WebVitalDto } from './dtos/web-vital.dto';

@ApiTags('Telemetry')
@Controller('telemetry')
export class TelemetryController {
  private readonly logger = new Logger(TelemetryController.name);

  @Public()
  @Post('vitals')
  @HttpCode(HttpStatus.ACCEPTED)
  @Throttle({ default: { ttl: 60_000, limit: 60 } })
  @ApiOperation({ summary: 'Reporta Core Web Vital do frontend (LCP/INP/CLS/FCP/TTFB).' })
  report(@Body() dto: WebVitalDto) {
    this.logger.log(
      `vital ${dto.metric}=${dto.value.toFixed(2)} rating=${dto.rating ?? 'n/a'} path=${dto.path}`,
    );
    return { accepted: true };
  }
}
