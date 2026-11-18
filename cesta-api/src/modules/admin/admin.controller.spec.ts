import { BadRequestException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AdminController } from './admin.controller';
import { AuditService } from '../audit/audit.service';
import { UsersService } from '../users/users.service';
import { ListAuditLogsQueryDto } from './dtos/list-audit-logs-query.dto';
import { ListUsersQueryDto } from './dtos/list-users-query.dto';

describe('AdminController.listUsers (Sprint 95)', () => {
  let controller: AdminController;
  let usersMock: {
    adminListSoftDeleted: jest.Mock;
    adminCancelDelete: jest.Mock;
  };
  let auditMock: { list: jest.Mock; record: jest.Mock };

  beforeEach(async () => {
    usersMock = {
      adminListSoftDeleted: jest.fn(),
      adminCancelDelete: jest.fn(),
    };
    auditMock = { list: jest.fn(), record: jest.fn() };
    const module = await Test.createTestingModule({
      controllers: [AdminController],
      providers: [
        { provide: UsersService, useValue: usersMock },
        { provide: AuditService, useValue: auditMock },
      ],
    }).compile();
    controller = module.get(AdminController);
  });

  it('defaults aplicados: limit=50, offset=0 quando query vazia', async () => {
    usersMock.adminListSoftDeleted.mockResolvedValue({ items: [], total: 0 });
    const query = new ListUsersQueryDto();
    await controller.listUsers(query);
    expect(usersMock.adminListSoftDeleted).toHaveBeenCalledWith(50, 0);
  });

  it('respeita limit/offset do query DTO', async () => {
    usersMock.adminListSoftDeleted.mockResolvedValue({ items: [], total: 0 });
    const query = new ListUsersQueryDto();
    query.deleted = 'true';
    query.limit = 25;
    query.offset = 100;
    await controller.listUsers(query);
    expect(usersMock.adminListSoftDeleted).toHaveBeenCalledWith(25, 100);
  });
});

describe('AdminController.listAuditLogs (Sprint 104)', () => {
  let controller: AdminController;
  let usersMock: {
    adminListSoftDeleted: jest.Mock;
    adminCancelDelete: jest.Mock;
  };
  let auditMock: { list: jest.Mock; record: jest.Mock };

  beforeEach(async () => {
    usersMock = {
      adminListSoftDeleted: jest.fn(),
      adminCancelDelete: jest.fn(),
    };
    auditMock = { list: jest.fn(), record: jest.fn() };
    const module = await Test.createTestingModule({
      controllers: [AdminController],
      providers: [
        { provide: UsersService, useValue: usersMock },
        { provide: AuditService, useValue: auditMock },
      ],
    }).compile();
    controller = module.get(AdminController);
  });

  it('defaults aplicados: limit=50, offset=0, type=undefined', async () => {
    auditMock.list.mockResolvedValue({ items: [], total: 0 });
    const query = new ListAuditLogsQueryDto();
    await controller.listAuditLogs(query);
    expect(auditMock.list).toHaveBeenCalledWith(50, 0, undefined);
  });

  it('repassa limit/offset/type do query DTO', async () => {
    auditMock.list.mockResolvedValue({ items: [], total: 0 });
    const query = new ListAuditLogsQueryDto();
    query.limit = 10;
    query.offset = 20;
    query.type = 'UserReactivated,SecretRotated';
    await controller.listAuditLogs(query);
    expect(auditMock.list).toHaveBeenCalledWith(
      10,
      20,
      'UserReactivated,SecretRotated',
    );
  });

  it('converte invalid audit types em BadRequestException (400)', async () => {
    auditMock.list.mockRejectedValue(
      new Error('invalid audit types: FooBar'),
    );
    const query = new ListAuditLogsQueryDto();
    query.type = 'FooBar';
    await expect(controller.listAuditLogs(query)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('propaga outros erros sem converter (ex: DB down)', async () => {
    const dbErr = new Error('connection refused');
    auditMock.list.mockRejectedValue(dbErr);
    const query = new ListAuditLogsQueryDto();
    await expect(controller.listAuditLogs(query)).rejects.toBe(dbErr);
  });
});
