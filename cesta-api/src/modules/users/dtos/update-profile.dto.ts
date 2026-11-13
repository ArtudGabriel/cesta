import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsIn, IsOptional, IsString, Length, Matches } from 'class-validator';

export const USER_LOCALES = ['es', 'pt-BR'] as const;
export type UserLocale = (typeof USER_LOCALES)[number];

export class UpdateProfileDto {
  @ApiPropertyOptional({ minLength: 1, maxLength: 80 })
  @IsOptional()
  @IsString()
  @Length(1, 80)
  @Matches(/^[\p{L}\p{M}\s'.\-]+$/u, {
    message: 'name contém caracteres inválidos',
  })
  name?: string;

  @ApiPropertyOptional({ enum: USER_LOCALES })
  @IsOptional()
  @IsIn(USER_LOCALES as unknown as string[])
  locale?: UserLocale;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  prefersVegan?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  prefersVegetarian?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  prefersGlutenFree?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  prefersLactoseFree?: boolean;

  @ApiPropertyOptional({ enum: ['absolute', 'unit'] })
  @IsOptional()
  @IsIn(['absolute', 'unit'])
  sortUnitPreference?: 'absolute' | 'unit';

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  nutriSortEnabled?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  nutriHealthyOnly?: boolean;
}
