/**
 * Cash receipt (Készpénz átvételi elismervény) template for DocumentEngine.
 */

import { DocumentDescriptor } from '../core/types';
import { formatHungarianCurrency, formatHungarianDate } from '../encoding/hungarianEncoding';
import { DocumentEngine } from '../core/DocumentEngine';
import { PdfDocumentAdapter } from '../adapters/PdfDocumentAdapter';

export interface CashReceiptData {
  receiptNumber: string;
  companyName: string;
  companyAddress?: string;
  companyTaxNumber?: string;
  partnerName: string;
  partnerAddress?: string;
  partnerTaxNumber?: string;
  amount: number;
  currency?: string;
  amountInWords?: string;
  paymentReason: string;
  receiptDate: string;
  issuerName?: string;
  payeeName?: string;
}

/**
 * Hungarian number-to-words helper for cash vouchers.
 */
export function numberToWordsHu(num: number): string {
  if (num === 0) return 'nulla';
  const val = Math.abs(Math.round(num));

  const ones = ['', 'egy', 'kettő', 'három', 'négy', 'öt', 'hat', 'hét', 'nyolc', 'kilenc'];
  const tens = ['', 'tíz', 'húsz', 'harminc', 'negyven', 'ötven', 'hatvan', 'hetven', 'nyolcvan', 'kilencven'];

  const getUnder1000 = (n: number): string => {
    let text = '';
    const h = Math.floor(n / 100);
    const remainder = n % 100;

    if (h > 0) {
      if (h === 1) text += 'száz';
      else text += ones[h] + 'száz';
    }

    if (remainder > 0) {
      if (remainder < 10) {
        text += ones[remainder];
      } else if (remainder % 10 === 0) {
        text += tens[remainder / 10];
      } else {
        const t = Math.floor(remainder / 10);
        const o = remainder % 10;
        if (t === 1) text += 'tizen' + ones[o];
        else if (t === 2) text += 'huszon' + ones[o];
        else text += tens[t] + ones[o];
      }
    }
    return text;
  };

  const getWords = (n: number): string => {
    if (n === 0) return '';
    const millions = Math.floor(n / 1000000);
    const thousands = Math.floor((n % 1000000) / 1000);
    const remainder = n % 1000;

    const parts: string[] = [];
    if (millions > 0) {
      parts.push(getUnder1000(millions) + 'millió');
    }
    if (thousands > 0) {
      if (thousands === 1 && millions === 0) {
        parts.push('ezer');
      } else {
        parts.push(getUnder1000(thousands) + 'ezer');
      }
    }
    if (remainder > 0) {
      parts.push(getUnder1000(remainder));
    }

    if (n <= 2000) {
      return parts.join('');
    }
    return parts.join('-');
  };

  const result = getWords(val);
  return result + ' forint';
}

export function buildCashReceiptDescriptor(data: CashReceiptData): DocumentDescriptor {
  const currency = data.currency || 'HUF';
  const inWords = data.amountInWords || (currency === 'HUF' ? numberToWordsHu(data.amount) : '');

  const descriptor: DocumentDescriptor = {
    type: 'cash_receipt',
    metadata: {
      title: 'KÉSZPÉNZ ÁTVÉTELI ELISMERVÉNY',
      subtitle: `Bizonylatszám: ${data.receiptNumber}`,
      companyName: data.companyName,
      companyTaxNumber: data.companyTaxNumber,
      companyAddress: data.companyAddress,
      generatedAt: data.receiptDate,
      filename: `atveteli_${data.receiptNumber}`,
      themeColor: [15, 116, 103],
    },
    sections: [
      {
        type: 'key-value',
        title: 'Befizető / Átadó adatai',
        items: [
          { label: 'Név / Partner', value: data.partnerName, highlight: true },
          { label: 'Cím', value: data.partnerAddress || '-' },
          { label: 'Adószám', value: data.partnerTaxNumber || '-' },
          { label: 'Kelt', value: formatHungarianDate(data.receiptDate) },
        ],
      },
      {
        type: 'key-value',
        title: 'Fizetési részletek',
        items: [
          { label: 'Átvett összeg', value: formatHungarianCurrency(data.amount, currency), highlight: true },
          { label: 'Összeg betűvel', value: inWords || '-' },
          { label: 'Jogcím / Megjegyzés', value: data.paymentReason },
        ],
        columnsCount: 2,
      },
      {
        type: 'text',
        title: 'Aláírások',
        style: 'signature',
        content: `Átadó (Befizető): ____________________          Átvevő (Pénztáros): ____________________\n(${data.payeeName || data.partnerName})                              (${data.issuerName || data.companyName})`,
      },
    ],
  };

  return descriptor;
}

export async function generateCashReceiptPdf(data: CashReceiptData): Promise<void> {
  const descriptor = buildCashReceiptDescriptor(data);
  await DocumentEngine.export(descriptor, 'pdf');
}

export async function generateCashReceiptBlob(data: CashReceiptData): Promise<Blob> {
  const descriptor = buildCashReceiptDescriptor(data);
  return PdfDocumentAdapter.renderToBlob(descriptor);
}
