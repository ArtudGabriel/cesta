import { ApiProperty } from '@nestjs/swagger';

export class VapidPublicKeyResponseDto {
  @ApiProperty({
    nullable: true,
    description:
      'Chave VAPID base64url (null quando VAPID_PUBLIC_KEY ausente → push desativado)',
  })
  publicKey!: string | null;
}
