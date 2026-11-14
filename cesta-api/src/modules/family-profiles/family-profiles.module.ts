import { forwardRef, Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module';
import { FamilyProfilesController } from './family-profiles.controller';
import { FamilyProfilesRepository } from './family-profiles.repository';
import { FamilyProfilesService } from './family-profiles.service';

// Sprint 65: forwardRef — UsersService precisa de FamilyProfilesRepository
// pra sync bidirecional, mas FamilyProfilesModule depende de UsersModule.
// Cycle quebrado via forwardRef nos dois lados + export do repo.
@Module({
  imports: [forwardRef(() => UsersModule)],
  controllers: [FamilyProfilesController],
  providers: [FamilyProfilesService, FamilyProfilesRepository],
  exports: [FamilyProfilesService, FamilyProfilesRepository],
})
export class FamilyProfilesModule {}
