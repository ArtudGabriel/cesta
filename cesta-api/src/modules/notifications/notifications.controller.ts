import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { SubscribeDto } from './dtos/subscribe.dto';
import { NotificationsService } from './notifications.service';

@ApiTags('Notifications')
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly service: NotificationsService) {}

  @Public()
  @Get('vapid-public-key')
  @ApiOperation({ summary: 'Chave pública VAPID para push' })
  publicKey() {
    return this.service.getPublicKey();
  }

  @Post('subscribe')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Registra push subscription do usuário' })
  async subscribe(
    @CurrentUser('id') userId: string,
    @Body() dto: SubscribeDto,
  ): Promise<void> {
    await this.service.subscribe(userId, dto);
  }

  @Delete('subscribe')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove push subscription por endpoint' })
  async unsubscribe(@Query('endpoint') endpoint: string): Promise<void> {
    await this.service.unsubscribe(endpoint);
  }
}
