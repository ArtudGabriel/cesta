import { Transform } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';

/**
 * Sprint 95: contrato do GET /admin/users. Só expõe o filtro `deleted=true`
 * nesta fase — qualquer outro valor é rejeitado via IsIn pra manter a
 * superfície mínima enquanto o UI cresce. Limit teto 50 (hard cap servidor).
 */
export class ListUsersQueryDto {
  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true' || value === true) return 'true';
    if (value === 'false' || value === false) return 'false';
    return value;
  })
  @IsIn(['true'])
  deleted?: 'true';

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  offset?: number;
}
