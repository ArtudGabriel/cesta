import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';

export class LoginDto {
  @ApiPropertyOptional({ example: 'maria@example.com' })
  @ValidateIf((o) => !o.phone)
  @IsEmail({}, { message: 'Email inválido' })
  email?: string;

  @ApiPropertyOptional({ example: '+34600111222' })
  @ValidateIf((o) => !o.email)
  @IsString()
  @Matches(/^\+?[1-9]\d{7,14}$/, { message: 'Telefone inválido (E.164)' })
  phone?: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  password: string;
}
