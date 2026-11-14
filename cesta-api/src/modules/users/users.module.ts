import { BullModule } from '@nestjs/bullmq';
import { forwardRef, Module } from '@nestjs/common';
import { FamilyProfilesModule } from '../family-profiles/family-profiles.module';
import {
  USER_CLEANUP_QUEUE,
  UserCleanupProcessor,
} from './user-cleanup.processor';
import { UsersController } from './users.controller';
import { UsersRepository } from './users.repository';
import { UsersService } from './users.service';

@Module({
  imports: [
    BullModule.registerQueue({ name: USER_CLEANUP_QUEUE }),
    // Sprint 65 bidirectional sync: forwardRef quebra cycle com FamilyProfilesModule.
    forwardRef(() => FamilyProfilesModule),
  ],
  controllers: [UsersController],
  providers: [UsersService, UsersRepository, UserCleanupProcessor],
  exports: [UsersService],
})
export class UsersModule {}
