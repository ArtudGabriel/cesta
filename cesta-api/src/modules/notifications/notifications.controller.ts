import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { NotificationsService } from './notifications.service';

@ApiTags('Notifications')
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly service: NotificationsService) {}

  @Public()
  @Get('vapid-public-key')
  @ApiOperation({ summary: 'Chave pública VAPID para push subscribe' })
  publicKey() {
    return this.service.getPublicKey();
  }
}
