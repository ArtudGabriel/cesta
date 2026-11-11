import { Controller, Get, Module } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { PrismaService } from '../../database/prisma.service';

@ApiTags('Categories')
@Controller('categories')
class CategoriesController {
  constructor(private readonly prisma: PrismaService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Listar categorias com hierarquia' })
  async findAll() {
    return this.prisma.category.findMany({
      orderBy: [{ order: 'asc' }, { nameEs: 'asc' }],
      include: {
        children: {
          orderBy: [{ order: 'asc' }, { nameEs: 'asc' }],
        },
      },
      where: { parentId: null },
    });
  }
}

@Module({
  controllers: [CategoriesController],
})
export class CategoriesModule {}
