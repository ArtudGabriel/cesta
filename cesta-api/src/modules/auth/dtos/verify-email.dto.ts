import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length } from 'class-validator';

export class VerifyEmailDto {
  @ApiProperty({ example: 'a9f4...hex', minLength: 32, maxLength: 128 })
  @IsString()
  @Length(32, 128)
  token: string;
}
