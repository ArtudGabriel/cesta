import { BullModule } from '@nestjs/bullmq';
import { forwardRef, Module } from '@nestjs/common';
import { EmailModule } from '../email/email.module';
import { FamilyProfilesModule } from '../family-profiles/family-profiles.module';
import { GRACE_REMINDER_QUEUE } from './grace-reminder.constants';
import { GraceReminderProcessor } from './grace-reminder.processor';
import {
  USER_CLEANUP_QUEUE,
  UserCleanupProcessor,
} from './user-cleanup.processor';
import { UsersController } from './users.controller';
import { UsersRepository } from './users.repository';
import { UsersService } from './users.service';

@Module({
  imports: [
    BullModule.registerQueue(
      { name: USER_CLEANUP_QUEUE },
      { name: GRACE_REMINDER_QUEUE },
    ),
    EmailModule,
    // Sprint 65 bidirectional sync: forwardRef quebra cycle com FamilyProfilesModule.
    forwardRef(() => FamilyProfilesModule),
  ],
  controllers: [UsersController],
  providers: [
    UsersService,
    UsersRepository,
    UserCleanupProcessor,
    GraceReminderProcessor,
  ],
  exports: [UsersService, UsersRepository],
})
export class UsersModule {}
