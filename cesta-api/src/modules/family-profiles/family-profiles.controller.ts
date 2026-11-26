import { Body, Controller, Get, Post, Put } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { DietaryQuestionDto } from './dtos/dietary-question.dto';
import {
  FamilyProfileResponseDto,
  UpsertFamilyProfileDto,
} from './dtos/family-profile.dto';
import { FamilyProfilesService } from './family-profiles.service';

/**
 * Sprint 207 — @ApiResponse coverage expand family-profiles (ADR 0021 10→13).
 */
@ApiTags('Family Profiles')
@Controller('family-profiles')
export class FamilyProfilesController {
  constructor(private readonly service: FamilyProfilesService) {}

  @Public()
  @Get('questions')
  @ApiOperation({ summary: 'Perguntas do questionário (PT+ES)' })
  @ApiOkResponse({ type: [DietaryQuestionDto] })
  listQuestions() {
    return this.service.listQuestions();
  }

  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Meu perfil familiar' })
  @ApiOkResponse({ type: FamilyProfileResponseDto, description: 'Perfil ou null se nunca criado' })
  @ApiUnauthorizedResponse({ description: 'JWT inválido ou ausente' })
  findMine(@CurrentUser('id') userId: string) {
    return this.service.findMine(userId);
  }

  @Put('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Criar ou atualizar perfil familiar' })
  @ApiOkResponse({ type: FamilyProfileResponseDto })
  @ApiBadRequestResponse({ description: 'DTO inválido (members/answers)' })
  @ApiUnauthorizedResponse({ description: 'JWT inválido ou ausente' })
  upsertMine(
    @CurrentUser('id') userId: string,
    @Body() dto: UpsertFamilyProfileDto,
  ) {
    return this.service.upsertMine(userId, dto);
  }

  @Post('sync-dietary')
  @Throttle({ write: { limit: 30, ttl: 60_000 } })
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      'Aplica prefers* do User como restrictions do FamilyProfile (merge union)',
  })
  @ApiOkResponse({ type: FamilyProfileResponseDto })
  @ApiUnauthorizedResponse({ description: 'JWT inválido ou ausente' })
  syncDietary(@CurrentUser('id') userId: string) {
    return this.service.syncDietaryFromUser(userId);
  }
}
