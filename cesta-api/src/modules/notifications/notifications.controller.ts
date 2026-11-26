import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { VapidPublicKeyResponseDto } from './dtos/vapid-public-key.response.dto';
import { NotificationsService } from './notifications.service';

/**
 * Sprint 208 — @ApiResponse coverage expand notifications (ADR 0021 13→17).
 */
@ApiTags('Notifications')
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly service: NotificationsService) {}

  @Public()
  @Get('vapid-public-key')
  @ApiOperation({ summary: 'Chave pública VAPID para push subscribe' })
  @ApiOkResponse({ type: VapidPublicKeyResponseDto })
  publicKey() {
    return this.service.getPublicKey();
  }
}
