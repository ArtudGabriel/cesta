import JSZip from 'jszip';
import {
  buildAlertasCsv,
  buildExpensesCsv,
  buildFavoritosCsv,
  buildListasCsv,
  buildReviewsCsv,
} from '../users/users-export.util';
import { parseCsv, parseImportZip } from './imports-parse.util';

const CUID_A = 'ckimportaaaaaaaaaaaaaaaaaa';
const CUID_B = 'ckimportbbbbbbbbbbbbbbbbbb';

describe('imports-parse.util', () => {
  describe('parseCsv', () => {
    it('parse BOM + CRLF + quoted fields with embedded quote', () => {
      const csv = '﻿name,comment\r\nalice,"she said ""hi"""\r\nbob,"has, comma"\r\n';
      const rows = parseCsv(csv);
      expect(rows).toEqual([
        ['name', 'comment'],
        ['alice', 'she said "hi"'],
        ['bob', 'has, comma'],
      ]);
    });

    it('empty CSV returns empty array', () => {
      expect(parseCsv('')).toEqual([]);
    });
  });

  describe('parseImportZip', () => {
    async function buildValidZip(): Promise<Buffer> {
      const zip = new JSZip();
      zip.file(
        'favoritos.csv',
        buildFavoritosCsv([
          { id: 'f1', productId: CUID_A, product: { name: 'Leche', brand: 'X' }, createdAt: new Date() },
        ]),
      );
      zip.file(
        'listas.csv',
        buildListasCsv([
          {
            id: 'l1',
            name: 'Semanal',
            items: [
              { productId: CUID_A, product: { name: 'Leche' }, quantity: 2, position: 0 },
              { productId: CUID_B, product: { name: 'Pan' }, quantity: 1, position: 1 },
            ],
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ]),
      );
      zip.file(
        'alertas.csv',
        buildAlertasCsv([
          {
            id: 'a1',
            productId: CUID_A,
            product: { name: 'Leche' },
            type: 'target_price',
            targetPrice: 1.5,
            isActive: true,
            lastTriggeredAt: null,
            createdAt: new Date(),
          },
        ]),
      );
      zip.file(
        'reviews.csv',
        buildReviewsCsv([
          {
            id: 'r1',
            productId: CUID_A,
            product: { name: 'Leche' },
            rating: 5,
            comment: 'top',
            createdAt: new Date(),
          },
        ]),
      );
      zip.file(
        'expenses.csv',
        buildExpensesCsv([
          {
            id: 'rc1',
            supermarketSlug: 'mercadona',
            purchaseDate: new Date('2026-11-01T10:00:00Z'),
            total: 25.4,
            status: 'ready',
            createdAt: new Date(),
            items: [
              {
                normalizedName: 'leche',
                rawText: 'LECHE DESN 1L',
                quantity: 2,
                unitPrice: 0.9,
                total: 1.8,
              },
            ],
          },
        ]),
      );
      return zip.generateAsync({ type: 'nodebuffer' });
    }

    it('round-trips a valid S91 shape zip into typed rows', async () => {
      const buf = await buildValidZip();
      const parsed = await parseImportZip(buf);
      expect(parsed.favoritos.errors).toEqual([]);
      expect(parsed.favoritos.rows).toHaveLength(1);
      expect(parsed.favoritos.rows[0].productId).toBe(CUID_A);

      expect(parsed.listas.rows).toHaveLength(2);
      expect(parsed.listas.rows.map((r) => r.productId).sort()).toEqual([
        CUID_A,
        CUID_B,
      ]);

      expect(parsed.alertas.rows[0]).toMatchObject({
        productId: CUID_A,
        type: 'target_price',
        isActive: true,
      });
      expect(Number(parsed.alertas.rows[0].targetPrice)).toBeCloseTo(1.5);

      expect(parsed.reviews.rows[0]).toMatchObject({
        productId: CUID_A,
        rating: 5,
        comment: 'top',
      });

      expect(parsed.expenses.rows).toHaveLength(1);
      expect(parsed.expenses.rows[0]).toMatchObject({
        supermarketSlug: 'mercadona',
        itemName: 'leche',
      });
    });

    it('rejects a zip missing favoritos.csv with MISSING_FILE', async () => {
      const zip = new JSZip();
      zip.file('listas.csv', buildListasCsv([]));
      const buf = await zip.generateAsync({ type: 'nodebuffer' });
      await expect(parseImportZip(buf)).rejects.toThrow(/MISSING_FILE/);
    });

    it('rejects bytes that are not a zip with MALFORMED_ZIP', async () => {
      const buf = Buffer.from('this is definitely not a zip file');
      await expect(parseImportZip(buf)).rejects.toThrow(/MALFORMED_ZIP/);
    });

    it('surfaces per-row errors without aborting the file', async () => {
      const zip = new JSZip();
      zip.file('favoritos.csv', '﻿id,productId\r\n1,not-a-cuid\r\n');
      zip.file('listas.csv', buildListasCsv([]));
      zip.file('alertas.csv', '﻿id,productId,type\r\n');
      zip.file('reviews.csv', '﻿id,productId,rating\r\n');
      zip.file('expenses.csv', '﻿receiptId,purchaseDate\r\n');
      const buf = await zip.generateAsync({ type: 'nodebuffer' });
      const parsed = await parseImportZip(buf);
      expect(parsed.favoritos.rows).toEqual([]);
      expect(parsed.favoritos.errors).toHaveLength(1);
      expect(parsed.favoritos.errors[0].message).toMatch(/cuid/);
      expect(parsed.favoritos.errors[0].line).toBe(2);
    });
  });
});
