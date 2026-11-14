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

/**
 * Retorno interno do AuthService (contém refreshToken pro controller usar
 * no Set-Cookie httpOnly). O corpo HTTP retornado ao cliente é derivado em
 * AuthController — refreshToken nunca sai no body.
 */
export class AuthResponseDto {
  @ApiProperty()
  user: UserResponseDto;

  @ApiProperty()
  tokens: AuthTokensDto;
}

/** Shape efetivo do corpo HTTP (sem refreshToken — cookie-only). */
export interface AuthWireResponse {
  user: UserResponseDto;
  tokens: {
    accessToken: string;
    expiresIn: number;
  };
}
