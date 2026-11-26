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
import {
  ApiAcceptedResponse,
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiPayloadTooLargeResponse,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiUnsupportedMediaTypeResponse,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { randomBytes } from 'crypto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import {
  ReceiptItemDto,
  ReceiptResponseDto,
} from './dtos/receipt-response.dto';
import {
  CreateReceiptItemDto,
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

/**
 * Sprint 206 — @ApiResponse coverage expand receipts (ADR 0021 7→10).
 * Upload endpoint retorna 202 (job OCR async) com {jobId, receiptId}.
 */
@ApiTags('Receipts')
@ApiBearerAuth()
@Controller('receipts')
export class ReceiptsController {
  constructor(private readonly service: ReceiptsService) {}

  @Post()
  @HttpCode(HttpStatus.ACCEPTED)
  @Throttle({ default: { limit: 5, ttl: 3_600_000 } })
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
  @ApiAcceptedResponse({
    description: 'Upload aceito; OCR processa em background. Poll GET /receipts/:id.',
    schema: {
      type: 'object',
      properties: {
        jobId: { type: 'string' },
        receiptId: { type: 'string' },
        status: { type: 'string', example: 'queued' },
      },
    },
  })
  @ApiBadRequestResponse({ description: 'Arquivo ausente ou campo inválido' })
  @ApiPayloadTooLargeResponse({ description: `Imagem > ${MAX_IMAGE_MB}MB` })
  @ApiUnsupportedMediaTypeResponse({ description: 'MIME fora de jpeg/png/webp/heic' })
  @ApiUnauthorizedResponse({ description: 'JWT inválido ou ausente' })
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
  @ApiOkResponse({ type: [ReceiptResponseDto] })
  @ApiUnauthorizedResponse({ description: 'JWT inválido ou ausente' })
  findAll(@CurrentUser('id') userId: string) {
    return this.service.findAll(userId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalhe da nota (com items)' })
  @ApiOkResponse({ type: ReceiptResponseDto })
  @ApiNotFoundResponse({ description: 'Nota não encontrada' })
  @ApiForbiddenResponse({ description: 'Nota pertence a outro usuário' })
  @ApiUnauthorizedResponse({ description: 'JWT inválido ou ausente' })
  findOne(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.service.findOne(userId, id);
  }

  @Patch(':id')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiOperation({ summary: 'Atualizar metadados da nota (mercado/data/total/notes)' })
  @ApiOkResponse({ type: ReceiptResponseDto })
  @ApiBadRequestResponse({ description: 'DTO inválido' })
  @ApiNotFoundResponse({ description: 'Nota não encontrada' })
  @ApiForbiddenResponse({ description: 'Nota pertence a outro usuário' })
  @ApiUnauthorizedResponse({ description: 'JWT inválido ou ausente' })
  updateMeta(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
    @Body() dto: UpdateReceiptMetaDto,
  ) {
    return this.service.updateMeta(userId, id, dto);
  }

  @Post(':id/items')
  @HttpCode(HttpStatus.CREATED)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiOperation({ summary: 'Adiciona item manual na nota' })
  @ApiCreatedResponse({ type: ReceiptItemDto })
  @ApiBadRequestResponse({ description: 'DTO inválido' })
  @ApiNotFoundResponse({ description: 'Nota não encontrada' })
  @ApiForbiddenResponse({ description: 'Nota pertence a outro usuário' })
  @ApiUnauthorizedResponse({ description: 'JWT inválido ou ausente' })
  addItem(
    @CurrentUser('id') userId: string,
    @Param('id') receiptId: string,
    @Body() dto: CreateReceiptItemDto,
  ) {
    return this.service.addItem(userId, receiptId, dto);
  }

  @Patch(':id/items/:itemId')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiOperation({ summary: 'Editar item da nota (qty/preço/produto)' })
  @ApiOkResponse({ type: ReceiptItemDto })
  @ApiBadRequestResponse({ description: 'DTO inválido' })
  @ApiNotFoundResponse({ description: 'Nota ou item não encontrado' })
  @ApiForbiddenResponse({ description: 'Nota pertence a outro usuário' })
  @ApiUnauthorizedResponse({ description: 'JWT inválido ou ausente' })
  updateItem(
    @CurrentUser('id') userId: string,
    @Param('id') receiptId: string,
    @Param('itemId') itemId: string,
    @Body() dto: UpdateReceiptItemDto,
  ) {
    return this.service.updateItem(userId, receiptId, itemId, dto);
  }

  @Delete(':id/items/:itemId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiOperation({ summary: 'Remove item da nota' })
  @ApiNoContentResponse({ description: 'Item removido' })
  @ApiNotFoundResponse({ description: 'Nota ou item não encontrado' })
  @ApiForbiddenResponse({ description: 'Nota pertence a outro usuário' })
  @ApiUnauthorizedResponse({ description: 'JWT inválido ou ausente' })
  async removeItem(
    @CurrentUser('id') userId: string,
    @Param('id') receiptId: string,
    @Param('itemId') itemId: string,
  ) {
    await this.service.removeItem(userId, receiptId, itemId);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Excluir nota' })
  @ApiNoContentResponse({ description: 'Nota removida' })
  @ApiNotFoundResponse({ description: 'Nota não encontrada' })
  @ApiForbiddenResponse({ description: 'Nota pertence a outro usuário' })
  @ApiUnauthorizedResponse({ description: 'JWT inválido ou ausente' })
  async remove(@CurrentUser('id') userId: string, @Param('id') id: string) {
    await this.service.remove(userId, id);
  }
}
