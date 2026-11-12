import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, Length, Matches } from 'class-validator';

export const USER_LOCALES = ['es', 'pt-BR'] as const;
export type UserLocale = (typeof USER_LOCALES)[number];

export class UpdateProfileDto {
  @ApiPropertyOptional({ minLength: 1, maxLength: 80 })
  @IsOptional()
  @IsString()
  @Length(1, 80)
  // Nome livre (incluindo acentos e espaços) sem caracteres perigosos
  @Matches(/^[\p{L}\p{M}\s'.\-]+$/u, {
    message: 'name contém caracteres inválidos',
  })
  name?: string;

  @ApiPropertyOptional({ enum: USER_LOCALES })
  @IsOptional()
  @IsIn(USER_LOCALES as unknown as string[])
  locale?: UserLocale;
}
