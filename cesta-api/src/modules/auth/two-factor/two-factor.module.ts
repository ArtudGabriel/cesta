import { forwardRef, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { UsersModule } from '../../users/users.module';
import { AuthModule } from '../auth.module';
import { AuthRepository } from '../auth.repository';
import { JwtRotationService } from '../jwt-rotation.service';
import { TwoFactorEncryptionService } from './encryption.service';
import { TwoFactorController } from './two-factor.controller';
import { TwoFactorRepository } from './two-factor.repository';
import { TwoFactorService } from './two-factor.service';

@Module({
  imports: [
    forwardRef(() => AuthModule),
    UsersModule,
    ConfigModule,
    JwtModule.register({}),
  ],
  controllers: [TwoFactorController],
  providers: [
    TwoFactorService,
    TwoFactorRepository,
    TwoFactorEncryptionService,
    AuthRepository,
    JwtRotationService,
  ],
  exports: [TwoFactorService],
})
export class TwoFactorModule {}
