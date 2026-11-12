import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, User } from '@prisma/client';
import { UpdateProfileDto } from './dtos/update-profile.dto';
import { UserResponseDto } from './dtos/user-response.dto';
import { UsersRepository } from './users.repository';

export interface CreateUserInput {
  email?: string;
  phone?: string;
  passwordHash: string;
  name?: string;
  locale?: string;
}

@Injectable()
export class UsersService {
  constructor(private readonly usersRepository: UsersRepository) {}

  async findById(id: string): Promise<User> {
    const user = await this.usersRepository.findById(id);
    if (!user) throw new NotFoundException(`User "${id}" not found`);
    return user;
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.usersRepository.findByEmail(email);
  }

  async findByPhone(phone: string): Promise<User | null> {
    return this.usersRepository.findByPhone(phone);
  }

  async createUser(input: CreateUserInput): Promise<User> {
    if (!input.email && !input.phone) {
      throw new BadRequestException('Email ou telefone é obrigatório');
    }

    if (input.email) {
      const existing = await this.usersRepository.findByEmail(input.email);
      if (existing) throw new ConflictException('Email já cadastrado');
    }
    if (input.phone) {
      const existing = await this.usersRepository.findByPhone(input.phone);
      if (existing) throw new ConflictException('Telefone já cadastrado');
    }

    return this.usersRepository.create({
      email: input.email ?? null,
      phone: input.phone ?? null,
      passwordHash: input.passwordHash,
      name: input.name ?? null,
      locale: input.locale ?? 'es',
    });
  }

  async updateProfile(
    userId: string,
    dto: UpdateProfileDto,
  ): Promise<UserResponseDto> {
    const data: Prisma.UserUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.locale !== undefined) data.locale = dto.locale;

    if (Object.keys(data).length === 0) {
      const current = await this.findById(userId);
      return UserResponseDto.fromEntity(current);
    }

    const updated = await this.usersRepository.update(userId, data);
    return UserResponseDto.fromEntity(updated);
  }

  async getProfile(userId: string): Promise<UserResponseDto> {
    const user = await this.findById(userId);
    return UserResponseDto.fromEntity(user);
  }
}
