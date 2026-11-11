import { ApiProperty } from '@nestjs/swagger';
import { Supermarket } from '@prisma/client';

export class SupermarketResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ example: 'mercadona' })
  slug: string;

  @ApiProperty({ example: 'Mercadona' })
  name: string;

  @ApiProperty({ nullable: true, example: '#009D58' })
  color: string | null;

  @ApiProperty({ nullable: true })
  logoUrl: string | null;

  @ApiProperty({ nullable: true })
  website: string | null;

  @ApiProperty()
  isActive: boolean;

  static fromEntity(entity: Supermarket): SupermarketResponseDto {
    const dto = new SupermarketResponseDto();
    dto.id = entity.id;
    dto.slug = entity.slug;
    dto.name = entity.name;
    dto.color = entity.color;
    dto.logoUrl = entity.logoUrl;
    dto.website = entity.website;
    dto.isActive = entity.isActive;
    return dto;
  }
}
