import { Test } from '@nestjs/testing';
import { AdminController } from './admin.controller';
import { UsersService } from '../users/users.service';
import { ListUsersQueryDto } from './dtos/list-users-query.dto';

describe('AdminController.listUsers (Sprint 95)', () => {
  let controller: AdminController;
  let usersMock: { adminListSoftDeleted: jest.Mock; adminCancelDelete: jest.Mock };

  beforeEach(async () => {
    usersMock = {
      adminListSoftDeleted: jest.fn(),
      adminCancelDelete: jest.fn(),
    };
    const module = await Test.createTestingModule({
      controllers: [AdminController],
      providers: [{ provide: UsersService, useValue: usersMock }],
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
