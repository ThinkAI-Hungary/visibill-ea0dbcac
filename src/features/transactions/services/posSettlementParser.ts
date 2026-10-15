/**
 * POS & AMEX Settlement Statement Parser
 * 
 * Parses merchant settlement statements ("bankkártyás göngyölegek") issued by OTP Bank Nyrt.
 * Supports:
 * - OTP Bank AMEX Elfogadói Tételes Elszámoló Lista
 * - OTP Bankkártya (Visa/Mastercard) Elfogadói Tételes Elszámoló Lista
 * 
 * Generates 3-legged Virtual Bank transactions:
 * 1. Gross Inflow for each card payment (+Gross)
 * 2. Commission Fee Outflow (-Fee, GL 532)
 * 3. Net Settlement Transfer Outflow (-Net, GL 389)
 */

export interface ParsedPosTransactionItem {
  transactionDate: string; // YYYY-MM-DD
  otpId: string;
  binf?: string;
  authCode: string;
  cardMasked: string;
  grossAmount: number;
  feeAmount: number;
  netAmount: number;
}

export interface ParsedPosSettlementSummary {
  isAmex: boolean;
  merchantCode: string;
  accountNumber: string;
  currency: string;
  periodFrom: string; // YYYY-MM-DD
  periodTo: string;   // YYYY-MM-DD
  processingDate: string; // YYYY-MM-DD
  storeName?: string;
  posTerminalId?: string;
  totalGross: number;
  totalFee: number;
  totalNet: number;
  itemCount: number;
  items: ParsedPosTransactionItem[];
}

export interface GeneratedVirtualBankTransaction {
  transaction_date: string;
  amount: number;
  currency: string;
  type: string;
  description: string;
  reason?: string;
  account_number: string;
  bank_name: string;
  reference_id: string;
  fee_amount?: number;
  pos_terminal_id?: string;
  leg_type: 'GROSS_INFLOW' | 'FEE_OUTFLOW' | 'NET_TRANSFER_OUTFLOW';
}

/** Helper to clean number strings like '273 650' or '4 926' */
export function cleanPosAmount(str: string): number {
  if (!str) return 0;
  const cleaned = str.replace(/[^\d-]/g, '');
  return parseInt(cleaned, 10) || 0;
}

/** Standardize YYYY.MM.DD to YYYY-MM-DD */
export function formatPosDate(dotDate: string): string {
  if (!dotDate) return '';
  return dotDate.replace(/\./g, '-').replace(/-$/, '');
}

/** Check if text corresponds to an OTP POS or AMEX settlement statement */
export function isOtpPosSettlementText(text: string): boolean {
  const hasOtp = /OTP\s*Bank\s*Nyrt/i.test(text);
  const hasSettlement = /ELFOGADÓI\s*TÉTELES\s*ELSZÁMOLÓ\s*LISTA/i.test(text);
  const hasMerchantCode = /Keresked[oõő]\s*k[oó]d/i.test(text);
  return (hasOtp || hasMerchantCode) && hasSettlement;
}

/** Extract text grouped by Y-coordinate lines from a PDFjs document */
export async function extractLinesByYFromPdf(pdf: any): Promise<string[][]> {
  const allLines: string[][] = [];

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const textContent = await page.getTextContent();
    const items = textContent.items as any[];

    // Group items by y coordinate with 3px tolerance
    const lineMap = new Map<number, any[]>();
    for (const item of items) {
      if (!item.str || !item.str.trim()) continue;
      const y = Math.round(item.transform[5]);
      let matchedY: number | null = null;
      for (const existingY of lineMap.keys()) {
        if (Math.abs(existingY - y) <= 3) {
          matchedY = existingY;
          break;
        }
      }
      const targetY = matchedY !== null ? matchedY : y;
      if (!lineMap.has(targetY)) {
        lineMap.set(targetY, []);
      }
      lineMap.get(targetY)!.push(item);
    }

    // Sort lines by y descending (top of page first)
    const sortedYs = Array.from(lineMap.keys()).sort((a, b) => b - a);
    for (const y of sortedYs) {
      const lineItems = lineMap.get(y)!;
      // Sort items within line by x ascending (left to right)
      lineItems.sort((a, b) => a.transform[4] - b.transform[4]);
      allLines.push(lineItems.map(it => it.str.trim()));
    }
  }

  return allLines;
}

/** Parse structured metadata and lines from extracted text lines */
export function parseOtpPosLines(lines: string[][]): ParsedPosSettlementSummary {
  const fullText = lines.map(l => l.join(' ')).join('\n');
  const isAmex = /AMEX\s*ELFOGADÓI/i.test(fullText);

  // Metadata extraction
  const merchantMatch = fullText.match(/Keresked[oõő]\s*k[oó]d:\s*(\d+)/i);
  const accountMatch = fullText.match(/Sz[aá]mlasz[aá]m:\s*([A-Z0-9-]+)/i);
  const periodMatch = fullText.match(/Elsz[aá]mol[aá]si\s*id[oõő]szak:\s*(\d{4}\.\d{2}\.\d{2})\s*-\s*(\d{4}\.\d{2}\.\d{2})/i);
  const processDateMatch = fullText.match(/Feldolgoz[aá]s\s*d[aá]tuma:\s*(\d{4}\.\d{2}\.\d{2})/i);
  const posTerminalMatch = fullText.match(/POS\s*azonos[ií]t[oó]:\s*(\d+)/i);
  const storeNameMatch = fullText.match(/[UÜ]zlet\s*neve:\s*([^\n\r]+?)(?=\s*POS|\s*202|\n|$)/i);

  const merchantCode = merchantMatch?.[1] || '';
  const accountNumber = accountMatch?.[1] || '';
  const periodFrom = formatPosDate(periodMatch?.[1] || '');
  const periodTo = formatPosDate(periodMatch?.[2] || '');
  const processingDate = formatPosDate(processDateMatch?.[1] || periodTo);
  const posTerminalId = posTerminalMatch?.[1] || '';
  const storeName = storeNameMatch?.[1]?.trim() || '';

  const items: ParsedPosTransactionItem[] = [];

  // Filter transaction lines: line[0] is YYYY.MM.DD and line[1] is OTP ID (14-18 digits)
  for (const line of lines) {
    if (line.length >= 7 && /^\d{4}\.\d{2}\.\d{2}$/.test(line[0]) && /^\d{14,18}$/.test(line[1])) {
      const txDate = formatPosDate(line[0]);
      const otpId = line[1];
      const binf = line[2];
      const authCode = line[3];
      const cardMasked = line[4];

      let gross = 0;
      let fee = 0;
      let net = 0;

      if (isAmex) {
        // AMEX columns: [Date, OtpId, BINF, Auth, Card, Gross, Fee, Net]
        gross = cleanPosAmount(line[5]);
        fee = cleanPosAmount(line[6]);
        net = cleanPosAmount(line[7]) || (gross - fee);
      } else {
        // Standard OTP POS columns:
        // [Date, OtpId, BINF, Auth, Card, Gross, Interbank, System, MerchantFee, TotalFee, Net]
        gross = cleanPosAmount(line[5]);
        net = cleanPosAmount(line[line.length - 1]);
        fee = cleanPosAmount(line[line.length - 2]) || (gross - net);
      }

      items.push({
        transactionDate: txDate,
        otpId,
        binf,
        authCode,
        cardMasked,
        grossAmount: gross,
        feeAmount: fee,
        netAmount: net,
      });
    }
  }

  const totalGross = items.reduce((sum, it) => sum + it.grossAmount, 0);
  const totalFee = items.reduce((sum, it) => sum + it.feeAmount, 0);
  const totalNet = items.reduce((sum, it) => sum + it.netAmount, 0);

  return {
    isAmex,
    merchantCode,
    accountNumber,
    currency: 'HUF',
    periodFrom,
    periodTo,
    processingDate,
    storeName,
    posTerminalId,
    totalGross,
    totalFee,
    totalNet,
    itemCount: items.length,
    items,
  };
}

/**
 * Generate 3-legged Virtual Bank transactions from parsed summary
 */
export function generateVirtualBankTransactions(
  summary: ParsedPosSettlementSummary,
  options?: {
    customVirtualAccount?: string;
  }
): GeneratedVirtualBankTransaction[] {
  const transactions: GeneratedVirtualBankTransaction[] = [];
  const bankName = summary.isAmex ? 'OTP AMEX' : 'OTP POS';
  const virtualAccount = options?.customVirtualAccount || `POS-${summary.posTerminalId || summary.merchantCode || 'GENERAL'}`;

  // 1. Gross Inflows (Each card swipe)
  for (const item of summary.items) {
    transactions.push({
      transaction_date: item.transactionDate,
      amount: item.grossAmount,
      currency: summary.currency,
      type: 'vevői tranzakció',
      description: `POS kártyás fizetés - Eng: ${item.authCode} (${item.cardMasked}) | OTP: ${item.otpId}`,
      reason: `Kártyaelfogadói elszámolás: ${summary.storeName || 'POS'} (Kereskedő: ${summary.merchantCode})`,
      account_number: virtualAccount,
      bank_name: bankName,
      reference_id: item.otpId,
      fee_amount: item.feeAmount,
      pos_terminal_id: summary.posTerminalId,
      leg_type: 'GROSS_INFLOW',
    });
  }

  // 2. Fee Outflow (Bank commission cost)
  if (summary.totalFee > 0) {
    transactions.push({
      transaction_date: summary.processingDate || summary.periodTo,
      amount: -summary.totalFee,
      currency: summary.currency,
      type: 'banki költség',
      description: `Kártyaelfogadói jutalék - ${bankName} (${summary.merchantCode}) [${summary.periodFrom} - ${summary.periodTo}]`,
      reason: `Kártyaelfogadási jutalék levonás az elszámoló lista alapján (${summary.itemCount} tranzakció)`,
      account_number: virtualAccount,
      bank_name: bankName,
      reference_id: `FEE-${summary.merchantCode}-${summary.periodTo}`,
      pos_terminal_id: summary.posTerminalId,
      leg_type: 'FEE_OUTFLOW',
    });
  }

  // 3. Net Settlement Transfer Outflow (Transfer to real bank)
  if (summary.totalNet > 0) {
    transactions.push({
      transaction_date: summary.processingDate || summary.periodTo,
      amount: -summary.totalNet,
      currency: summary.currency,
      type: 'átvezetés',
      description: `Átvezetés bankszámlára (${summary.accountNumber}) - ${bankName} [${summary.periodFrom} - ${summary.periodTo}]`,
      reason: `Nettó kártyaelfogadói elszámolás átutalása a fizikai bankszámlára`,
      account_number: virtualAccount,
      bank_name: bankName,
      reference_id: `TRF-${summary.merchantCode}-${summary.periodTo}`,
      pos_terminal_id: summary.posTerminalId,
      leg_type: 'NET_TRANSFER_OUTFLOW',
    });
  }

  return transactions;
}
