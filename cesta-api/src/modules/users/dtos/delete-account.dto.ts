import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';

export class DeleteAccountDto {
  @ApiProperty({
    enum: ['ELIMINAR'],
    description:
      'Palavra literal de confirmação. Contrato backend fixo em ELIMINAR (i18n frontend não altera — símbolo universal GDPR Art. 17).',
  })
  @IsIn(['ELIMINAR'])
  confirmation: 'ELIMINAR';
}
