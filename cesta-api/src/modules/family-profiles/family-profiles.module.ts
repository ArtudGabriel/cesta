import { Module } from '@nestjs/common';
import { FamilyProfilesController } from './family-profiles.controller';
import { FamilyProfilesRepository } from './family-profiles.repository';
import { FamilyProfilesService } from './family-profiles.service';

@Module({
  controllers: [FamilyProfilesController],
  providers: [FamilyProfilesService, FamilyProfilesRepository],
  exports: [FamilyProfilesService],
})
export class FamilyProfilesModule {}
