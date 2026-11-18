import { InjectQueue } from '@nestjs/bullmq';
import { HttpStatus, Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';
import * as path from 'path';
import * as Sentry from '@sentry/node';
import { AppException } from '../../common/exceptions/app-exception';
import {
  CreateReceiptItemDto,
  UpdateReceiptItemDto,
  UpdateReceiptMetaDto,
} from './dtos/update-receipt-item.dto';
import { ReceiptResponseDto } from './dtos/receipt-response.dto';
import { ReceiptsRepository } from './receipts.repository';
import { RECEIPTS_QUEUE, ReceiptJob } from './receipts.queue';

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
    if (!file)
      throw new AppException(
        'RECEIPTS.FILE_REQUIRED',
        'Imagem é obrigatória',
        HttpStatus.BAD_REQUEST,
      );

    // Path relativo pra servir estático; filename já foi gerado pelo multer
    const imageUrl = `/uploads/${path.basename(file.path)}`;
    const receipt = await this.repo.create(userId, imageUrl, notes);

    const job = await Sentry.startSpan(
      { name: 'ocr.enqueue', op: 'queue.publish' },
      () =>
        this.queue.add('process', {
          receiptId: receipt.id,
          imagePath: file.path,
        }),
    );

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
    if (!receipt)
      throw new AppException(
        'RECEIPTS.NOT_FOUND',
        `Nota "${id}" não encontrada`,
        HttpStatus.NOT_FOUND,
        { receiptId: id },
      );
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
    await this.assertItemOwner(userId, receiptId, itemId);
    await this.repo.updateItemAndRecalc(receiptId, itemId, dto);
    return this.findOne(userId, receiptId);
  }

  async addItem(
    userId: string,
    receiptId: string,
    dto: CreateReceiptItemDto,
  ): Promise<ReceiptResponseDto> {
    await this.assertOwner(userId, receiptId);
    await this.repo.addItemAndRecalc(receiptId, dto);
    return this.findOne(userId, receiptId);
  }

  async removeItem(
    userId: string,
    receiptId: string,
    itemId: string,
  ): Promise<void> {
    await this.assertOwner(userId, receiptId);
    await this.repo.removeItemAndRecalc(receiptId, itemId);
  }

  async remove(userId: string, id: string): Promise<void> {
    await this.assertOwner(userId, id);
    await this.repo.softDelete(id);
  }

  private async assertItemOwner(
    userId: string,
    receiptId: string,
    itemId: string,
  ): Promise<void> {
    const item = await this.repo.findItemForUser(itemId, userId);
    if (!item || item.receiptId !== receiptId)
      throw new AppException(
        'RECEIPTS.ITEM_FORBIDDEN',
        'Item não acessível',
        HttpStatus.FORBIDDEN,
        { itemId },
      );
  }

  private async assertOwner(userId: string, id: string): Promise<void> {
    const receipt = await this.repo.findByIdForUser(id, userId);
    if (!receipt)
      throw new AppException(
        'RECEIPTS.FORBIDDEN',
        'Nota não acessível',
        HttpStatus.FORBIDDEN,
        { receiptId: id },
      );
  }
}
