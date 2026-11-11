import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';

export class RegisterDto {
  @ApiPropertyOptional({ example: 'maria@example.com' })
  @ValidateIf((o) => !o.phone)
  @IsEmail({}, { message: 'Email inválido' })
  email?: string;

  @ApiPropertyOptional({ example: '+34600111222' })
  @ValidateIf((o) => !o.email)
  @IsString()
  @Matches(/^\+?[1-9]\d{7,14}$/, { message: 'Telefone inválido (E.164)' })
  phone?: string;

  @ApiProperty({ example: 'senha_forte_123', minLength: 8 })
  @IsString()
  @MinLength(8, { message: 'Senha deve ter no mínimo 8 caracteres' })
  @MaxLength(128)
  password: string;

  @ApiPropertyOptional({ example: 'María García' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @ApiPropertyOptional({ enum: ['es', 'pt-BR'], default: 'es' })
  @IsOptional()
  @IsIn(['es', 'pt-BR'])
  locale?: 'es' | 'pt-BR';
}
