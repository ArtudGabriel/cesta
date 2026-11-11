import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { randomBytes } from 'crypto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import {
  UpdateReceiptItemDto,
  UpdateReceiptMetaDto,
} from './dtos/update-receipt-item.dto';
import { ReceiptsService } from './receipts.service';

const MAX_IMAGE_MB = 10;
const ALLOWED_MIMES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic'];

const storage = diskStorage({
  destination: './uploads',
  filename: (_req, file, cb) => {
    const ext = extname(file.originalname).toLowerCase() || '.jpg';
    const token = randomBytes(12).toString('hex');
    cb(null, `${Date.now()}-${token}${ext}`);
  },
});

@ApiTags('Receipts')
@ApiBearerAuth()
@Controller('receipts')
export class ReceiptsController {
  constructor(private readonly service: ReceiptsService) {}

  @Post()
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Upload de nota fiscal → OCR async' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        image: { type: 'string', format: 'binary' },
        notes: { type: 'string' },
      },
    },
  })
  @UseInterceptors(
    FileInterceptor('image', {
      storage,
      limits: { fileSize: MAX_IMAGE_MB * 1024 * 1024 },
      fileFilter: (_req, file, cb) => {
        if (ALLOWED_MIMES.includes(file.mimetype)) cb(null, true);
        else cb(new Error('Formato de imagem não suportado'), false);
      },
    }),
  )
  upload(
    @CurrentUser('id') userId: string,
    @UploadedFile() file: Express.Multer.File,
    @Body('notes') notes?: string,
  ) {
    return this.service.upload(userId, file, notes);
  }

  @Get()
  @ApiOperation({ summary: 'Minhas notas' })
  findAll(@CurrentUser('id') userId: string) {
    return this.service.findAll(userId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalhe da nota (com items)' })
  findOne(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.service.findOne(userId, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Atualizar metadados da nota (mercado/notes)' })
  updateMeta(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
    @Body() dto: UpdateReceiptMetaDto,
  ) {
    return this.service.updateMeta(userId, id, dto);
  }

  @Patch(':id/items/:itemId')
  @ApiOperation({ summary: 'Editar item da nota (qty/preço/produto)' })
  updateItem(
    @CurrentUser('id') userId: string,
    @Param('id') receiptId: string,
    @Param('itemId') itemId: string,
    @Body() dto: UpdateReceiptItemDto,
  ) {
    return this.service.updateItem(userId, receiptId, itemId, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Excluir nota' })
  async remove(@CurrentUser('id') userId: string, @Param('id') id: string) {
    await this.service.remove(userId, id);
  }
}
