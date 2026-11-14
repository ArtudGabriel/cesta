import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import {
  USER_CLEANUP_QUEUE,
  UserCleanupProcessor,
} from './user-cleanup.processor';
import { UsersController } from './users.controller';
import { UsersRepository } from './users.repository';
import { UsersService } from './users.service';

@Module({
  imports: [BullModule.registerQueue({ name: USER_CLEANUP_QUEUE })],
  controllers: [UsersController],
  providers: [UsersService, UsersRepository, UserCleanupProcessor],
  exports: [UsersService],
})
export class UsersModule {}
