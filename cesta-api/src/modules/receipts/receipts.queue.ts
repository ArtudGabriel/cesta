export const RECEIPTS_QUEUE = 'receipts';

export interface ReceiptJob {
  receiptId: string;
  imagePath: string;
}
