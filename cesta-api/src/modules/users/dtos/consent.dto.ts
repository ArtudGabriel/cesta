import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';

export type CookieConsentLevel = 'all' | 'essential';

export class ConsentDto {
  @ApiProperty({
    enum: ['all', 'essential'],
    description:
      '`all` autoriza analytics/Sentry replay; `essential` restringe ao estritamente necessário pro app funcionar.',
  })
  @IsIn(['all', 'essential'])
  level: CookieConsentLevel;
}
