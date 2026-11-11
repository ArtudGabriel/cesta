import { Body, Controller, Get, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { UpsertFamilyProfileDto } from './dtos/family-profile.dto';
import { FamilyProfilesService } from './family-profiles.service';

@ApiTags('Family Profiles')
@Controller('family-profiles')
export class FamilyProfilesController {
  constructor(private readonly service: FamilyProfilesService) {}

  @Public()
  @Get('questions')
  @ApiOperation({ summary: 'Perguntas do questionário (PT+ES)' })
  listQuestions() {
    return this.service.listQuestions();
  }

  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Meu perfil familiar' })
  findMine(@CurrentUser('id') userId: string) {
    return this.service.findMine(userId);
  }

  @Put('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Criar ou atualizar perfil familiar' })
  upsertMine(
    @CurrentUser('id') userId: string,
    @Body() dto: UpsertFamilyProfileDto,
  ) {
    return this.service.upsertMine(userId, dto);
  }
}
