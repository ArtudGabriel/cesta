import { ApiProperty } from '@nestjs/swagger';
import { User } from '@prisma/client';

export class UserResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ nullable: true })
  email: string | null;

  @ApiProperty({ nullable: true })
  phone: string | null;

  @ApiProperty({ nullable: true })
  name: string | null;

  @ApiProperty({ example: 'es' })
  locale: string;

  @ApiProperty({ type: [String] })
  roles: string[];

  @ApiProperty()
  prefersVegan: boolean;

  @ApiProperty()
  prefersVegetarian: boolean;

  @ApiProperty()
  prefersGlutenFree: boolean;

  @ApiProperty()
  prefersLactoseFree: boolean;

  @ApiProperty({ enum: ['absolute', 'unit'] })
  sortUnitPreference: 'absolute' | 'unit';

  @ApiProperty()
  nutriSortEnabled: boolean;

  @ApiProperty()
  nutriHealthyOnly: boolean;

  @ApiProperty({
    nullable: true,
    enum: ['all', 'essential'],
    description: 'GDPR cookie consent level (Sprint 62). null = banner ainda não respondido.',
  })
  cookieConsentLevel: 'all' | 'essential' | null;

  @ApiProperty({ nullable: true })
  cookiesAcceptedAt: Date | null;

  @ApiProperty()
  createdAt: Date;

  static fromEntity(user: User): UserResponseDto {
    const dto = new UserResponseDto();
    dto.id = user.id;
    dto.email = user.email;
    dto.phone = user.phone;
    dto.name = user.name;
    dto.locale = user.locale;
    dto.roles = user.roles;
    dto.prefersVegan = user.prefersVegan;
    dto.prefersVegetarian = user.prefersVegetarian;
    dto.prefersGlutenFree = user.prefersGlutenFree;
    dto.prefersLactoseFree = user.prefersLactoseFree;
    dto.sortUnitPreference = user.sortUnitPreference as 'absolute' | 'unit';
    dto.nutriSortEnabled = user.nutriSortEnabled;
    dto.nutriHealthyOnly = user.nutriHealthyOnly;
    dto.cookieConsentLevel = user.cookieConsentLevel as
      | 'all'
      | 'essential'
      | null;
    dto.cookiesAcceptedAt = user.cookiesAcceptedAt;
    dto.createdAt = user.createdAt;
    return dto;
  }
}
