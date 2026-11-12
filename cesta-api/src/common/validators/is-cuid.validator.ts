import { applyDecorators } from '@nestjs/common';
import { Matches } from 'class-validator';

// CUID v1 (Prisma @default(cuid())): c + 24 chars base36 — in practice 25 chars.
// Accept 24+ to be slightly forward-safe (CUID2 lengths vary).
export const CUID_PATTERN = /^c[a-z0-9]{24,}$/;

export function IsCuid(): PropertyDecorator {
  return applyDecorators(
    Matches(CUID_PATTERN, { message: '$property must be a valid CUID' }),
  );
}
