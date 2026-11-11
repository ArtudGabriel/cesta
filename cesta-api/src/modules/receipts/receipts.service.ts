import { InjectQueue } from '@nestjs/bullmq';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Queue } from 'bullmq';
import * as path from 'path';
import {
  UpdateReceiptItemDto,
  UpdateReceiptMetaDto,
} from './dtos/update-receipt-item.dto';
import { ReceiptResponseDto } from './dtos/receipt-response.dto';
import { ReceiptsRepository } from './receipts.repository';
import { RECEIPTS_QUEUE, ReceiptJob } from './receipts.processor';

@Injectable()
export class ReceiptsService {
  constructor(
    private readonly repo: ReceiptsRepository,
    @InjectQueue(RECEIPTS_QUEUE)
    private readonly queue: Queue<ReceiptJob>,
  ) {}

  async upload(
    userId: string,
    file: Express.Multer.File | undefined,
    notes?: string,
  ): Promise<{ jobId: string; receiptId: string; status: string }> {
    if (!file) throw new BadRequestException('Imagem é obrigatória');

    // Path relativo pra servir estático; filename já foi gerado pelo multer
    const imageUrl = `/uploads/${path.basename(file.path)}`;
    const receipt = await this.repo.create(userId, imageUrl, notes);

    const job = await this.queue.add('process', {
      receiptId: receipt.id,
      imagePath: file.path,
    });

    return {
      jobId: job.id ?? receipt.id,
      receiptId: receipt.id,
      status: 'queued',
    };
  }

  async findAll(userId: string): Promise<ReceiptResponseDto[]> {
    const items = await this.repo.findAllByUser(userId);
    return items.map(ReceiptResponseDto.fromEntity);
  }

  async findOne(userId: string, id: string): Promise<ReceiptResponseDto> {
    const receipt = await this.repo.findByIdForUser(id, userId);
    if (!receipt) throw new NotFoundException(`Nota "${id}" não encontrada`);
    return ReceiptResponseDto.fromEntity(receipt);
  }

  async updateMeta(
    userId: string,
    id: string,
    dto: UpdateReceiptMetaDto,
  ): Promise<ReceiptResponseDto> {
    await this.assertOwner(userId, id);
    await this.repo.updateMeta(id, dto);
    return this.findOne(userId, id);
  }

  async updateItem(
    userId: string,
    receiptId: string,
    itemId: string,
    dto: UpdateReceiptItemDto,
  ): Promise<ReceiptResponseDto> {
    const item = await this.repo.findItemForUser(itemId, userId);
    if (!item) throw new ForbiddenException('Item não acessível');
    await this.repo.updateItem(itemId, dto);
    return this.findOne(userId, receiptId);
  }

  async remove(userId: string, id: string): Promise<void> {
    await this.assertOwner(userId, id);
    await this.repo.softDelete(id);
  }

  private async assertOwner(userId: string, id: string): Promise<void> {
    const receipt = await this.repo.findByIdForUser(id, userId);
    if (!receipt) throw new ForbiddenException('Nota não acessível');
  }
}
