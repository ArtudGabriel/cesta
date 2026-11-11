import { ApiProperty } from '@nestjs/swagger';
import { UserResponseDto } from '../../users/dtos/user-response.dto';

export class AuthTokensDto {
  @ApiProperty()
  accessToken: string;

  @ApiProperty()
  refreshToken: string;

  @ApiProperty({ example: 900, description: 'Expiração do access em segundos' })
  expiresIn: number;
}

export class AuthResponseDto {
  @ApiProperty()
  user: UserResponseDto;

  @ApiProperty()
  tokens: AuthTokensDto;
}
