import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { FamilyProfile } from '@prisma/client';

export class FamilyMembersDto {
  @ApiProperty({ default: 0, minimum: 0 })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  babies: number = 0;

  @ApiProperty({ default: 0, minimum: 0 })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  kids: number = 0;

  @ApiProperty({ default: 0, minimum: 0 })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  children: number = 0;

  @ApiProperty({ default: 0, minimum: 0 })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  teens: number = 0;

  @ApiProperty({ default: 1, minimum: 0 })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  adults: number = 1;

  @ApiProperty({ default: 0, minimum: 0 })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  seniors: number = 0;
}

export class UpsertFamilyProfileDto {
  @ApiProperty({ type: FamilyMembersDto })
  @ValidateNested()
  @Type(() => FamilyMembersDto)
  members: FamilyMembersDto;

  @ApiProperty({
    description: 'Respostas { [key]: boolean | string }',
    example: { eats_meat: true, fruits_veggies_frequency: 'weekly' },
  })
  @IsObject()
  answers: Record<string, boolean | string>;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  restrictions?: string[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  blockedCategories?: string[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  requiredProductIds?: string[];
}

export class FamilyProfileResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() members: Record<string, number>;
  @ApiProperty() answers: Record<string, boolean | string>;
  @ApiProperty({ type: [String] }) restrictions: string[];
  @ApiProperty({ type: [String] }) blockedCategories: string[];
  @ApiProperty({ type: [String] }) requiredProductIds: string[];
  @ApiProperty() createdAt: Date;
  @ApiProperty() updatedAt: Date;

  static fromEntity(profile: FamilyProfile): FamilyProfileResponseDto {
    const dto = new FamilyProfileResponseDto();
    dto.id = profile.id;
    dto.members = profile.members as Record<string, number>;
    dto.answers = profile.answers as Record<string, boolean | string>;
    dto.restrictions = profile.restrictions;
    dto.blockedCategories = profile.blockedCategories;
    dto.requiredProductIds = profile.requiredProductIds;
    dto.createdAt = profile.createdAt;
    dto.updatedAt = profile.updatedAt;
    return dto;
  }
}
