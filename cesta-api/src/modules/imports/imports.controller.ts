import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { diskStorage } from 'multer';
import { randomBytes } from 'crypto';
import { AppException } from '../../common/exceptions/app-exception';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CreateImportDto } from './dtos/create-import.dto';
import { ImportsService } from './imports.service';

const MAX_ZIP_MB = 5;
const ALLOWED_MIMES = [
  'application/zip',
  'application/x-zip-compressed',
  'application/octet-stream',
];

const storage = diskStorage({
  destination: './uploads',
  filename: (_req, _file, cb) => {
    const token = randomBytes(12).toString('hex');
    cb(null, `import-${Date.now()}-${token}.zip`);
  },
});

@ApiTags('User CSV Import')
@ApiBearerAuth()
@Controller('users/me/import')
export class ImportsController {
  constructor(private readonly service: ImportsService) {}

  @Post()
  @HttpCode(HttpStatus.ACCEPTED)
  @Throttle({ strict: { limit: 1, ttl: 3_600_000 } })
  @ApiOperation({
    summary:
      'Sprint 102 — upload ZIP (5 CSVs export Sprint 91 shape) → dry-run parse 202 + jobId. Rate limit 1/hora.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: {
        file: { type: 'string', format: 'binary' },
        dryRun: { type: 'boolean', default: true },
      },
    },
  })
  @UseInterceptors(
    FileInterceptor('file', {
      storage,
      limits: { fileSize: MAX_ZIP_MB * 1024 * 1024 },
      fileFilter: (_req, file, cb) => {
        if (ALLOWED_MIMES.includes(file.mimetype)) cb(null, true);
        else cb(new Error('ZIP esperado'), false);
      },
    }),
  )
  async create(
    @CurrentUser('id') userId: string,
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: CreateImportDto,
  ) {
    if (!file) {
      throw new AppException(
        'IMPORT.MISSING_FILE',
        'Campo "file" obrigatório (multipart ZIP)',
        HttpStatus.BAD_REQUEST,
      );
    }
    const dryRun = dto.dryRun ?? true;
    return this.service.create(userId, file.path, dryRun);
  }

  @Get(':jobId')
  @ApiOperation({ summary: 'Status + summary do import' })
  getStatus(
    @CurrentUser('id') userId: string,
    @Param('jobId') jobId: string,
  ) {
    return this.service.getStatus(userId, jobId);
  }

  @Post(':jobId/apply')
  @HttpCode(HttpStatus.ACCEPTED)
  @Throttle({ write: { limit: 10, ttl: 60_000 } })
  @ApiOperation({
    summary:
      'Confirma dry-run → enfileira worker em modo apply. 409 se status != ready_to_apply.',
  })
  apply(
    @CurrentUser('id') userId: string,
    @Param('jobId') jobId: string,
  ) {
    return this.service.apply(userId, jobId);
  }
}
