/**
 * Cash receipt PDF generator (Facade).
 * Re-exports and delegates to the unified DocumentEngine under src/lib/documents/.
 */

export {
  type CashReceiptData,
  numberToWordsHu,
  generateCashReceiptPdf,
  generateCashReceiptBlob,
  buildCashReceiptDescriptor,
} from './documents/templates/cashReceiptTemplate';
