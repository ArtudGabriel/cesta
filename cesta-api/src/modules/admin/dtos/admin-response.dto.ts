import { ApiProperty } from '@nestjs/swagger';
import { UserResponseDto } from '../../users/dtos/user-response.dto';

export class AlertsActiveByTypeDto {
  @ApiProperty({ description: 'Alertas simples (price_below)' })
  simple!: number;
  @ApiProperty() combo!: number;
  @ApiProperty() trend!: number;
  @ApiProperty() bundle!: number;
}

export class ReceiptsLast30dDto {
  @ApiProperty({ description: 'OCR concluído (status=ready)' })
  parsed!: number;
  @ApiProperty() failed!: number;
}

export class AdminMetricsResponseDto {
  @ApiProperty() usersTotal!: number;
  @ApiProperty({ description: 'Distinct users ativos (login/receipt) últimos 7d' })
  usersActive7d!: number;
  @ApiProperty({ type: AlertsActiveByTypeDto })
  alertsActiveByType!: AlertsActiveByTypeDto;
  @ApiProperty({ type: ReceiptsLast30dDto })
  receipts30d!: ReceiptsLast30dDto;
  @ApiProperty({ description: 'Push notifications (alerts+rules) últimos 7d' })
  pushNotifications7d!: number;
  @ApiProperty({ description: 'Cestas familiares status=ready últimos 7d' })
  familyBasketsGenerated7d!: number;
  @ApiProperty({ example: '2026-11-26T20:30:00.000Z' })
  generatedAt!: string;
  @ApiProperty({ description: 'true = resposta do cache in-memory 5min (observabilidade)' })
  cached!: boolean;
}

export class SoftDeletedUserRowDto {
  @ApiProperty() id!: string;
  @ApiProperty({ type: String, nullable: true }) email!: string | null;
  @ApiProperty() deletedAt!: Date;
  @ApiProperty({ type: Date, nullable: true, description: 'Hard delete scheduled (deletedAt + 30d grace)' })
  graceEndsAt!: Date | null;
}

export class SoftDeletedUsersListDto {
  @ApiProperty({ type: [SoftDeletedUserRowDto] })
  items!: SoftDeletedUserRowDto[];
  @ApiProperty() total!: number;
}

export class CancelDeleteResponseDto {
  @ApiProperty({
    enum: ['reactivated', 'already_active'],
    description: 'reactivated = flipou deletedAt→null; already_active = idempotent no-op',
  })
  status!: 'reactivated' | 'already_active';
  @ApiProperty({ type: UserResponseDto })
  user!: UserResponseDto;
}

export class AuditLogRowDto {
  @ApiProperty() id!: string;
  @ApiProperty({ type: String, nullable: true }) userId!: string | null;
  @ApiProperty({ type: String, nullable: true, description: 'Admin que executou (null = system/worker)' })
  actorId!: string | null;
  @ApiProperty({
    example: 'AdminCancelledDelete',
    description:
      'Enum AUDIT_LOG_TYPES: UserReactivated | UserDataExported | SecretRotated | AdminCancelledDelete | TwoFactorEnabled | TwoFactorDisabled | UserDataImported | UserReminderSent',
  })
  type!: string;
  @ApiProperty({ type: Object, nullable: true, description: 'JSON arbitrário por tipo (adminId, jobId, etc)' })
  metadata!: unknown;
  @ApiProperty() createdAt!: Date;
}

export class AuditLogsListDto {
  @ApiProperty({ type: [AuditLogRowDto] })
  items!: AuditLogRowDto[];
  @ApiProperty() total!: number;
}
