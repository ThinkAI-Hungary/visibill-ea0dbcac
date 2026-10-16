import { supabase } from '@/integrations/supabase/client';

export type UnplannedDepreciationType = 'unplanned_depreciation' | 'unplanned_depreciation_reversal';

export interface UnplannedDepreciationParams {
  companyId: string;
  assetId: string;
  eventType: UnplannedDepreciationType;
  amount: number;
  postingDate: string;
  documentId: string;
  reason: string;
  currency?: string;
}

export interface UnplannedDepreciationResult {
  success: boolean;
  headerId?: string;
  journalNumber?: number | null;
  amount?: number;
  message?: string;
  error?: string;
}

/**
 * Szabályos bizonylatszám formázás terven felüli értékcsökkenéshez:
 * Pl. TF-ÉCS-2026-0001
 */
export function formatUnplannedDepreciationDocId(year: number, seq: number): string {
  return `TF-ÉCS-${year}-${String(seq).padStart(4, '0')}`;
}

/**
 * Lekéri a következő szabad bizonylatszámot a cég vegyes naplójából
 */
export async function getNextUnplannedDepreciationDocId(
  companyId: string,
  year: number = new Date().getFullYear()
): Promise<string> {
  const prefix = `TF-ÉCS-${year}-`;
  
  try {
    const { data, error } = await supabase
      .from('acc_journal_headers')
      .select('document_id')
      .eq('company_id', companyId)
      .ilike('document_id', `${prefix}%`)
      .order('document_id', { ascending: false })
      .limit(20);

    if (error || !data || data.length === 0) {
      return formatUnplannedDepreciationDocId(year, 1);
    }

    let maxSeq = 0;
    for (const row of data) {
      if (row.document_id && row.document_id.startsWith(prefix)) {
        const numPart = row.document_id.substring(prefix.length).replace(/[^0-9]/g, '');
        const parsed = parseInt(numPart, 10);
        if (!isNaN(parsed) && parsed > maxSeq) {
          maxSeq = parsed;
        }
      }
    }

    return formatUnplannedDepreciationDocId(year, maxSeq + 1);
  } catch {
    return formatUnplannedDepreciationDocId(year, 1);
  }
}

/**
 * Validálja a terven felüli ÉCS vagy visszaírás összegét és feltételeit.
 */
export function validateUnplannedDepreciation(params: {
  eventType: UnplannedDepreciationType;
  amount: number;
  currentBookValue: number;
  residualValue?: number;
  previouslyRecognizedUnplanned?: number;
}): { valid: boolean; error?: string } {
  const { eventType, amount, currentBookValue, residualValue = 0, previouslyRecognizedUnplanned = 0 } = params;

  if (!amount || isNaN(amount) || amount <= 0) {
    return { valid: false, error: 'Az összegnek 0-nál nagyobbnak kell lennie!' };
  }

  if (eventType === 'unplanned_depreciation') {
    const maxWriteDown = Math.max(0, currentBookValue - residualValue);
    if (amount > maxWriteDown) {
      return {
        valid: false,
        error: `A terven felüli értékcsökkenés összege (${amount.toLocaleString('hu-HU')} Ft) nem haladhatja meg a könyv szerinti érték maradványérték feletti részét (${maxWriteDown.toLocaleString('hu-HU')} Ft)!`,
      };
    }
  } else if (eventType === 'unplanned_depreciation_reversal') {
    if (previouslyRecognizedUnplanned > 0 && amount > previouslyRecognizedUnplanned) {
      return {
        valid: false,
        error: `A visszaírás összege (${amount.toLocaleString('hu-HU')} Ft) nem haladhatja meg a korábban elszámolt terven felüli értékcsökkenést (${previouslyRecognizedUnplanned.toLocaleString('hu-HU')} Ft)!`,
      };
    }
  }

  return { valid: true };
}

/**
 * Meghívja a post_unplanned_depreciation_to_gl RPC-t, elvégzi a könyvelést és az analitikai eseményrögzítést.
 */
export async function postUnplannedDepreciationToLedger(
  params: UnplannedDepreciationParams
): Promise<UnplannedDepreciationResult> {
  const {
    companyId,
    assetId,
    eventType,
    amount,
    postingDate,
    documentId,
    reason,
    currency = 'HUF',
  } = params;

  if (!companyId || !assetId) {
    return { success: false, error: 'Hiányzó cég vagy eszköz azonosító!' };
  }

  if (!amount || amount <= 0) {
    return { success: false, error: 'Az összegnek 0-nál nagyobbnak kell lennie!' };
  }

  if (!documentId.trim()) {
    return { success: false, error: 'A bizonylatszám megadása kötelező!' };
  }

  if (!reason.trim()) {
    return { success: false, error: 'Az indoklás és szakmai leírás megadása kötelező!' };
  }

  try {
    const { data, error } = await supabase.rpc('post_unplanned_depreciation_to_gl', {
      p_company_id: companyId,
      p_asset_id: assetId,
      p_event_type: eventType,
      p_amount: amount,
      p_posting_date: postingDate,
      p_document_id: documentId.trim(),
      p_reason: reason.trim(),
      p_currency: currency,
    });

    if (error) {
      return {
        success: false,
        error: error.message || 'Hiba történt a könyvelés során.',
      };
    }

    const res = data as any;
    if (res && res.success) {
      return {
        success: true,
        headerId: res.header_id,
        journalNumber: res.journal_number,
        amount: res.amount,
        message: res.message,
      };
    }

    return {
      success: false,
      error: res?.message || 'Ismeretlen hiba a könyvelés feladása során.',
    };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || 'Nem sikerült kommunikálni a főkönyvi modullal.',
    };
  }
}
