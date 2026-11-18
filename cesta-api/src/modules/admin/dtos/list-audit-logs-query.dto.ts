import { Transform } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export { AUDIT_LOG_TYPES, type AuditLogType } from '../../audit/audit.service';

/**
 * Sprint 104: GET /admin/audit-logs filter. `type` aceita CSV; valores fora
 * da whitelist caem em 400 via validação manual no controller (class-validator
 * não valida array-em-string nativamente aqui — mantemos simples).
 */
export class ListAuditLogsQueryDto {
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? parseInt(value, 10) : value))
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? parseInt(value, 10) : value))
  @IsInt()
  @Min(0)
  offset?: number;

  @IsOptional()
  @IsString()
  type?: string;
}
