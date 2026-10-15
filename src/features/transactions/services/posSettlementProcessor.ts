import { supabase } from '@/integrations/supabase/client';
import {
  isOtpPosSettlementText,
  extractLinesByYFromPdf,
  parseOtpPosLines,
  generateVirtualBankTransactions,
  type ParsedPosSettlementSummary,
} from './posSettlementParser';

/** Universal PDF loader that works in both browser (window.pdfjsLib) and Node/Vite environments */
export async function getPdfJsLib(): Promise<any> {
  if (typeof window !== 'undefined' && (window as any).pdfjsLib) {
    return (window as any).pdfjsLib;
  }
  try {
    const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
    return pdfjs;
  } catch {
    if (typeof window !== 'undefined') {
      return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.min.js';
        script.onload = () => {
          const pdfjsLib = (window as any).pdfjsLib;
          pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js';
          resolve(pdfjsLib);
        };
        script.onerror = () => reject(new Error('Nem sikerült betölteni a PDF könyvtárat.'));
        document.head.appendChild(script);
      });
    }
    throw new Error('PDF.js library is not available in current environment.');
  }
}

export interface ProcessPosUploadResult {
  success: boolean;
  isPosSettlement: boolean;
  summary?: ParsedPosSettlementSummary;
  insertedCount: number;
  virtualAccount: string;
  error?: string;
}

/**
 * Process a POS or AMEX settlement statement from raw ArrayBuffer
 */
export async function processPosSettlementBuffer(
  buffer: ArrayBuffer,
  companyId: string,
  uploadId?: string,
  customSupabaseClient?: any
): Promise<ProcessPosUploadResult> {
  const db = customSupabaseClient || supabase;

  try {
    const pdfjsLib = await getPdfJsLib();
    const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(buffer) }).promise;
    const lines = await extractLinesByYFromPdf(pdf);
    const fullText = lines.map(l => l.join(' ')).join('\n');

    if (!isOtpPosSettlementText(fullText)) {
      return {
        success: false,
        isPosSettlement: false,
        insertedCount: 0,
        virtualAccount: '',
        error: 'A dokumentum nem OTP POS vagy AMEX elfogadói elszámoló lista.',
      };
    }

    const summary = parseOtpPosLines(lines);
    if (summary.items.length === 0) {
      return {
        success: false,
        isPosSettlement: true,
        summary,
        insertedCount: 0,
        virtualAccount: '',
        error: 'Nem található érvényes tranzakciós tétel az elszámoló listában.',
      };
    }

    const virtualAccount = `POS-${summary.posTerminalId || summary.merchantCode || 'GENERAL'}`;
    const bankName = summary.isAmex ? 'OTP AMEX' : 'OTP POS';

    // 1. Ensure Virtual Bank Account in company_bank_accounts
    const { data: existingAccounts } = await db
      .from('company_bank_accounts')
      .select('id, account_number, gl_account_id, journal_id')
      .eq('company_id', companyId)
      .eq('account_number', virtualAccount);

    let virtualBankId = existingAccounts?.[0]?.id;

    if (!virtualBankId) {
      const { data: newBankAcc, error: bankErr } = await db
        .from('company_bank_accounts')
        .insert({
          company_id: companyId,
          bank_name: bankName,
          account_number: virtualAccount,
          currency: summary.currency || 'HUF',
        })
        .select('id')
        .single();

      if (!bankErr && newBankAcc) {
        virtualBankId = newBankAcc.id;
      }
    }

    // 2. Ensure Journal in acc_journals (connected to GL 3851)
    const { data: existingJournals } = await db
      .from('acc_journals')
      .select('id, code')
      .eq('company_id', companyId)
      .or(`code.eq.B-POS,code.eq.POS,code.eq.B-AMEX,connected_gl_account.eq.3851`);

    if (!existingJournals || existingJournals.length === 0) {
      const journalCode = summary.isAmex ? 'B-AMEX' : 'B-POS';
      const journalName = summary.isAmex ? 'OTP AMEX Kártyaelfogadó' : 'OTP POS Kártyaelfogadó';
      await db.from('acc_journals').insert({
        company_id: companyId,
        code: journalCode,
        name: journalName,
        type: 'BANK',
        connected_gl_account: '3851',
        currency: 'HUF',
        is_active: true,
      });
    }

    // 3. Generate Virtual Bank Transactions
    const virtualTxs = generateVirtualBankTransactions(summary, {
      customVirtualAccount: virtualAccount,
    });

    // Check if transactions for this upload already exist to avoid duplicate inserts
    let existingTxRefs = new Set<string>();
    if (uploadId) {
      const { data: existingByUpload } = await db
        .from('transactions')
        .select('description')
        .eq('company_id', companyId)
        .eq('upload_id', uploadId);

      if (existingByUpload && existingByUpload.length > 0) {
        existingTxRefs = new Set(existingByUpload.map((t: any) => t.description));
      }
    }

    const rowsToInsert = virtualTxs
      .filter(tx => !existingTxRefs.has(tx.description))
      .map(tx => ({
        company_id: companyId,
        upload_id: uploadId || null,
        transaction_date: tx.transaction_date,
        amount: tx.amount,
        currency: tx.currency,
        type: tx.type,
        description: tx.description,
        reason: tx.reason || null,
        fee_amount: tx.fee_amount || null,
        is_verified: false,
      }));

    let insertedCount = 0;
    if (rowsToInsert.length > 0) {
      const { error: insertErr } = await db
        .from('transactions')
        .upsert(rowsToInsert, {
          onConflict: 'company_id,transaction_date,description,amount',
          ignoreDuplicates: true,
        });

      if (insertErr) {
        throw new Error(`Nem sikerült menteni a tranzakciókat: ${insertErr.message}`);
      }
      insertedCount = rowsToInsert.length;
    }

    // 4. Update transaction_uploads status if uploadId provided
    if (uploadId) {
      const bankKey = summary.isAmex ? 'amex_pos' : 'otp_pos';
      await db
        .from('transaction_uploads')
        .update({
          detected_bank: bankKey,
          processing_status: 'completed',
          error_message: null,
          metadata: {
            is_pos_settlement: true,
            is_amex: summary.isAmex,
            merchant_code: summary.merchantCode,
            pos_terminal_id: summary.posTerminalId,
            period_from: summary.periodFrom,
            period_to: summary.periodTo,
            item_count: summary.itemCount,
            total_gross: summary.totalGross,
            total_fee: summary.totalFee,
            total_net: summary.totalNet,
            virtual_account: virtualAccount,
            bank_name: bankName,
          },
        })
        .eq('id', uploadId);
    }

    return {
      success: true,
      isPosSettlement: true,
      summary,
      insertedCount,
      virtualAccount,
    };
  } catch (err: any) {
    const errorMsg = err?.message || String(err);
    if (uploadId) {
      await db
        .from('transaction_uploads')
        .update({
          processing_status: 'error',
          error_message: `POS feldolgozási hiba: ${errorMsg}`,
        })
        .eq('id', uploadId);
    }

    return {
      success: false,
      isPosSettlement: false,
      insertedCount: 0,
      virtualAccount: '',
      error: errorMsg,
    };
  }
}

/**
 * Reprocess an existing transaction upload by ID
 */
export async function reprocessPosUploadById(
  uploadId: string,
  companyId: string,
  customSupabaseClient?: any
): Promise<ProcessPosUploadResult> {
  const db = customSupabaseClient || supabase;

  const { data: upload, error: fetchErr } = await db
    .from('transaction_uploads')
    .select('id, file_name, file_url')
    .eq('id', uploadId)
    .single();

  if (fetchErr || !upload?.file_url) {
    return {
      success: false,
      isPosSettlement: false,
      insertedCount: 0,
      virtualAccount: '',
      error: fetchErr?.message || 'Fájl nem található.',
    };
  }

  const response = await fetch(upload.file_url);
  if (!response.ok) {
    return {
      success: false,
      isPosSettlement: false,
      insertedCount: 0,
      virtualAccount: '',
      error: `Nem sikerült letölteni a fájlt: HTTP ${response.status}`,
    };
  }

  const buffer = await response.arrayBuffer();
  return processPosSettlementBuffer(buffer, companyId, uploadId, db);
}
