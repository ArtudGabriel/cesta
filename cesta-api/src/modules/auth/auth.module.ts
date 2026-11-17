import { forwardRef, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { EmailModule } from '../email/email.module';
import { UsersModule } from '../users/users.module';
import { AuthController } from './auth.controller';
import { AuthRepository } from './auth.repository';
import { AuthService } from './auth.service';
import { JwtRotationService } from './jwt-rotation.service';
import { TwoFactorModule } from './two-factor/two-factor.module';

@Module({
  imports: [
    UsersModule,
    EmailModule,
    ConfigModule,
    JwtModule.register({}),
    forwardRef(() => TwoFactorModule),
  ],
  controllers: [AuthController],
  providers: [AuthService, AuthRepository, JwtRotationService],
  exports: [AuthService, AuthRepository, JwtRotationService],
})
export class AuthModule {}
