import { supabase } from '@/integrations/supabase/client';
import { calculateSelfRevisionPenalty } from '../utils/penaltyCalculator';

export interface VatSnapshotRecord {
  id: string;
  company_id: string;
  period_year: number;
  period_month: number;
  frequency: 'H' | 'N' | 'E';
  version_number: number;
  version_type: 'ORIGINAL' | 'SELF_REVISION';
  version_label: string;
  status: 'DRAFT' | 'SUBMITTED' | 'REVISION_PENDING';
  tax_base_payable: number;
  tax_payable: number;
  tax_base_deductible: number;
  tax_deductible: number;
  net_vat_position: number;
  snapshot_hash_sha256: string;
  snapshot_data: any;
  submitted_at: string | null;
  submitted_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface VatRevisionItem {
  id?: string;
  invoiceId: string;
  invoiceNumber: string;
  partnerName: string;
  partnerTaxNumber: string;
  changeType: 'LATE_ENTRY' | 'MODIFIED' | 'DELETED' | 'STORNO' | 'late_entry' | 'modified' | 'deleted';
  originalNet: number;
  currentNet: number;
  originalVat: number;
  currentVat: number;
  snapshotTaxBase?: number;
  currentTaxBase?: number;
  snapshotTaxAmount?: number;
  currentTaxAmount?: number;
  direction?: 'INBOUND' | 'OUTBOUND' | string;
  taxBaseDiff: number;
  taxAmountDiff: number;
  penaltyAmount: number;
  reason?: string;
}

export interface VatRevisionDiffSummary {
  hasRevisions: boolean;
  hasDifferences: boolean;
  totalItemsCount: number;
  totalTaxBaseDiff: number;
  totalTaxAmountDiff: number;
  totalPenaltyHuf: number;
  items: VatRevisionItem[];
  diffs: VatRevisionItem[];
}

export type AccountyVatSnapshot = VatSnapshotRecord;
export type InvoiceDiffResult = VatRevisionItem;

/**
 * Számítógépes SHA-256 lenyomat képzése a Web Crypto API segítségével
 */
export async function computeVatSnapshotSha256(payload: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(payload);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Lekéri egy adott időszak összes ÁFA pillanatképét / revízióját
 */
export async function fetchVatSnapshots(
  companyId: string,
  year: number,
  month: number,
  frequency: 'H' | 'N' | 'E'
): Promise<VatSnapshotRecord[]> {
  const { data, error } = await supabase
    .from('accounty_vat_snapshots' as any)
    .select('*')
    .eq('company_id', companyId)
    .eq('period_year', year)
    .eq('period_month', month)
    .eq('frequency', frequency)
    .order('version_number', { ascending: true });

  if (error) {
    console.error('Failed to fetch VAT snapshots:', error);
    return [];
  }

  return (data || []) as unknown as VatSnapshotRecord[];
}

/**
 * Új ÁFA pillanatkép / zárolt beadás rögzítése
 */
export async function createVatSnapshot(args: {
  companyId: string;
  year?: number;
  periodYear?: number;
  month?: number;
  periodMonth?: number;
  frequency?: 'H' | 'N' | 'E';
  versionNumber?: number;
  versionType?: 'ORIGINAL' | 'SELF_REVISION' | string;
  versionLabel?: string;
  taxBasePayable?: number;
  taxPayable?: number;
  taxBaseDeductible?: number;
  taxDeductible?: number;
  snapshotPayload?: any;
  vatCalculationResult?: any;
  activeInvoices?: any[];
  userId?: string | null;
}): Promise<VatSnapshotRecord> {
  const companyId = args.companyId;
  const year = args.year ?? args.periodYear;
  const month = args.month ?? args.periodMonth;
  const frequency = args.frequency || 'H';

  if (!companyId) throw new Error('Cég azonosító (companyId) kötelező a pillanatkép mentéséhez');
  if (!year || isNaN(year)) throw new Error('Év (year / periodYear) kötelező és érvényes szám kell legyen');
  if (!month || isNaN(month)) throw new Error('Hónap/Időszak (month / periodMonth) kötelező és érvényes szám kell legyen');

  const versionNumber = args.versionNumber ?? 1;
  const versionType = (args.versionType?.toUpperCase() === 'SELF_REVISION' ? 'SELF_REVISION' : 'ORIGINAL') as 'ORIGINAL' | 'SELF_REVISION';
  const versionLabel = args.versionLabel?.trim() || (versionNumber === 1 ? 'v1.0 (Eredeti beadás)' : `v1.${versionNumber - 1} (${versionNumber - 1}. Önellenőrzés)`);

  const taxBasePayable = Number(args.taxBasePayable) || 0;
  const taxPayable = Number(args.taxPayable) || 0;
  const taxBaseDeductible = Number(args.taxBaseDeductible) || 0;
  const taxDeductible = Number(args.taxDeductible) || 0;
  const snapshotPayload = args.snapshotPayload ?? args.vatCalculationResult ?? {};

  // Auto-capture underlying invoice ledger (invoicesMap) for diff comparison if not supplied
  let invoicesMap = snapshotPayload.invoicesMap || {};
  if (Object.keys(invoicesMap).length === 0) {
    try {
      let dateFrom = `${year}-${String(month).padStart(2, '0')}-01`;
      const lastDay = new Date(year, month, 0).getDate();
      let dateTo = `${year}-${String(month).padStart(2, '0')}-${lastDay}`;
      if (frequency === 'N') {
        const startMonth = (month - 1) * 3 + 1;
        dateFrom = `${year}-${String(startMonth).padStart(2, '0')}-01`;
        const endMonth = startMonth + 2;
        const lastDayQ = new Date(year, endMonth, 0).getDate();
        dateTo = `${year}-${String(endMonth).padStart(2, '0')}-${lastDayQ}`;
      } else if (frequency === 'E') {
        dateFrom = `${year}-01-01`;
        dateTo = `${year}-12-31`;
      }

      const { data: dbInvoices } = await supabase
        .from('nav_invoices')
        .select('id, invoice_number, supplier_name, customer_name, supplier_tax_number, customer_tax_number, invoice_net_amount, invoice_vat_amount, invoice_direction, invoice_delivery_date')
        .eq('company_id', companyId)
        .gte('invoice_delivery_date', dateFrom)
        .lte('invoice_delivery_date', dateTo);

      if (dbInvoices && dbInvoices.length > 0) {
        invoicesMap = {};
        for (const inv of dbInvoices) {
          const key = (inv.invoice_number || '').trim().toLowerCase();
          if (key) {
            invoicesMap[key] = {
              id: inv.id,
              invoice_number: inv.invoice_number,
              partner_name: inv.invoice_direction === 'OUTBOUND' ? (inv.customer_name || '') : (inv.supplier_name || ''),
              partner_tax_number: inv.invoice_direction === 'OUTBOUND' ? (inv.customer_tax_number || '') : (inv.supplier_tax_number || ''),
              net_amount: Number(inv.invoice_net_amount) || 0,
              vat_amount: Number(inv.invoice_vat_amount) || 0,
              direction: inv.invoice_direction || 'INBOUND',
            };
          }
        }
      }
    } catch (e) {
      console.warn('Could not auto-populate invoicesMap for VAT snapshot:', e);
    }
  }

  const finalSnapshotPayload = {
    ...snapshotPayload,
    invoicesMap,
  };

  // Auto-resolve current user if not provided
  let submittedBy = args.userId;
  if (!submittedBy) {
    try {
      const { data: authData } = await supabase.auth.getUser();
      submittedBy = authData?.user?.id || null;
    } catch {
      submittedBy = null;
    }
  }

  const rawString = JSON.stringify({
    companyId,
    year,
    month,
    frequency,
    versionNumber,
    taxBasePayable,
    taxPayable,
    taxBaseDeductible,
    taxDeductible,
    timestamp: new Date().toISOString(),
    payload: finalSnapshotPayload,
  });

  const hash = await computeVatSnapshotSha256(rawString);
  const netPosition = taxPayable - taxDeductible;

  const { data, error } = await supabase
    .from('accounty_vat_snapshots' as any)
    .insert({
      company_id: companyId,
      period_year: year,
      period_month: month,
      frequency,
      version_number: versionNumber,
      version_type: versionType,
      version_label: versionLabel,
      status: 'SUBMITTED',
      tax_base_payable: taxBasePayable,
      tax_payable: taxPayable,
      tax_base_deductible: taxBaseDeductible,
      tax_deductible: taxDeductible,
      net_vat_position: netPosition,
      snapshot_hash_sha256: hash,
      snapshot_data: finalSnapshotPayload,
      submitted_at: new Date().toISOString(),
      submitted_by: submittedBy || null,
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create VAT snapshot: ${error.message}`);
  }

  return data as unknown as VatSnapshotRecord;
}

/**
 * Tiszta in-memory diff kalkuláció egy meglévő számlalista és snapshot között
 */
export function computeSnapshotDiff(
  currentInvoices: Array<{
    id: string;
    invoice_number: string;
    partner_name: string;
    partner_tax_number?: string;
    net_amount: number;
    vat_amount: number;
    direction?: string;
    created_at?: string;
  }>,
  latestSnapshot: VatSnapshotRecord | null,
  year: number,
  month: number,
  frequency: 'H' | 'N' | 'E'
): VatRevisionDiffSummary {
  if (!latestSnapshot || !latestSnapshot.snapshot_data) {
    return {
      hasRevisions: false,
      hasDifferences: false,
      totalItemsCount: 0,
      totalTaxBaseDiff: 0,
      totalTaxAmountDiff: 0,
      totalPenaltyHuf: 0,
      items: [],
      diffs: [],
    };
  }

  const snapshotInvoices: Record<string, {
    net_amount: number;
    vat_amount: number;
    invoice_number: string;
    partner_name: string;
    partner_tax_number?: string;
    direction?: string;
  }> = latestSnapshot.snapshot_data.invoicesMap || {};

  const items: VatRevisionItem[] = [];
  const visitedInvoiceNumbers = new Set<string>();

  // 1. Vizsgáljuk a jelenlegi számlákat a snapshothoz képest
  for (const inv of currentInvoices) {
    const key = (inv.invoice_number || '').trim().toLowerCase();
    visitedInvoiceNumbers.add(key);

    const snapItem = snapshotInvoices[key];

    if (!snapItem) {
      // Késedelmesen bekerült számla (LATE_ENTRY)
      const diffTaxBase = inv.net_amount;
      const diffTaxAmount = inv.vat_amount;
      items.push({
        invoiceId: inv.id,
        invoiceNumber: inv.invoice_number,
        partnerName: inv.partner_name,
        partnerTaxNumber: inv.partner_tax_number || '',
        changeType: 'late_entry',
        originalNet: 0,
        currentNet: inv.net_amount,
        originalVat: 0,
        currentVat: inv.vat_amount,
        snapshotTaxBase: 0,
        currentTaxBase: inv.net_amount,
        snapshotTaxAmount: 0,
        currentTaxAmount: inv.vat_amount,
        direction: inv.direction || 'INBOUND',
        taxBaseDiff: diffTaxBase,
        taxAmountDiff: diffTaxAmount,
        penaltyAmount: 0,
        reason: 'Lezárás után utólag rögzített új számla',
      });
    } else {
      const netDiff = inv.net_amount - snapItem.net_amount;
      const vatDiff = inv.vat_amount - snapItem.vat_amount;

      if (Math.abs(netDiff) > 1 || Math.abs(vatDiff) > 1) {
        items.push({
          invoiceId: inv.id,
          invoiceNumber: inv.invoice_number,
          partnerName: inv.partner_name,
          partnerTaxNumber: inv.partner_tax_number || '',
          changeType: 'modified',
          originalNet: snapItem.net_amount,
          currentNet: inv.net_amount,
          originalVat: snapItem.vat_amount,
          currentVat: inv.vat_amount,
          snapshotTaxBase: snapItem.net_amount,
          currentTaxBase: inv.net_amount,
          snapshotTaxAmount: snapItem.vat_amount,
          currentTaxAmount: inv.vat_amount,
          direction: inv.direction || snapItem.direction || 'INBOUND',
          taxBaseDiff: netDiff,
          taxAmountDiff: vatDiff,
          penaltyAmount: 0,
          reason: 'Összeg vagy ÁFA-kulcs utólagos módosulása',
        });
      }
    }
  }

  // 2. Vizsgáljuk a snapshotban szereplő, de azóta törölt vagy stornózott számlákat
  for (const [snapKey, snapItem] of Object.entries(snapshotInvoices)) {
    if (!visitedInvoiceNumbers.has(snapKey)) {
      items.push({
        invoiceId: snapKey,
        invoiceNumber: snapItem.invoice_number,
        partnerName: snapItem.partner_name,
        partnerTaxNumber: snapItem.partner_tax_number || '',
        changeType: 'deleted',
        originalNet: snapItem.net_amount,
        currentNet: 0,
        originalVat: snapItem.vat_amount,
        currentVat: 0,
        snapshotTaxBase: snapItem.net_amount,
        currentTaxBase: 0,
        snapshotTaxAmount: snapItem.vat_amount,
        currentTaxAmount: 0,
        direction: snapItem.direction || 'INBOUND',
        taxBaseDiff: -snapItem.net_amount,
        taxAmountDiff: -snapItem.vat_amount,
        penaltyAmount: 0,
        reason: 'Lezárás után törölt vagy stornózott számla',
      });
    }
  }

  const totalTaxBaseDiff = items.reduce((sum, item) => sum + item.taxBaseDiff, 0);
  const totalTaxAmountDiff = items.reduce((sum, item) => sum + item.taxAmountDiff, 0);

  // Art. szerinti pótlék számítása a nettó fizetendő ÁFA növekményre
  const penaltyResult = calculateSelfRevisionPenalty({
    taxDifferenceHuf: totalTaxAmountDiff,
    year,
    periodMonth: month,
    frequency,
    revisionOrder: (latestSnapshot.version_number || 1),
  });

  return {
    hasRevisions: items.length > 0,
    hasDifferences: items.length > 0,
    totalItemsCount: items.length,
    totalTaxBaseDiff,
    totalTaxAmountDiff,
    totalPenaltyHuf: penaltyResult.penaltyAmountHuf,
    items,
    diffs: items,
  };
}

/**
 * On-demand diff kalkuláció: összeveti a legutolsó lezárt pillanatképet a jelenlegi számlákkal
 */
export function compareCurrentInvoicesWithSnapshot(
  companyId: string,
  year?: number,
  month?: number,
  frequency?: 'H' | 'N' | 'E'
): Promise<VatRevisionDiffSummary>;
export function compareCurrentInvoicesWithSnapshot(options: {
  currentInvoices?: Array<{
    id: string;
    invoice_number: string;
    partner_name: string;
    partner_tax_number?: string;
    net_amount: number;
    vat_amount: number;
    direction?: string;
    created_at?: string;
  }>;
  latestSnapshot?: VatSnapshotRecord | null;
  companyId?: string;
  year?: number;
  month?: number;
  frequency?: 'H' | 'N' | 'E';
}): VatRevisionDiffSummary;
export function compareCurrentInvoicesWithSnapshot(
  arg1: any,
  yearArg?: number,
  monthArg?: number,
  frequencyArg?: 'H' | 'N' | 'E'
): any {
  if (typeof arg1 === 'string') {
    // Async DB query mode for React queries
    return (async () => {
      const companyId = arg1;
      const year = yearArg || new Date().getFullYear();
      const month = monthArg || new Date().getMonth() + 1;
      const frequency: 'H' | 'N' | 'E' = frequencyArg || 'H';

      const snapshots = await fetchVatSnapshots(companyId, year, month, frequency);
      const latestSnapshot = snapshots[0] || null;

      if (!latestSnapshot) {
        return {
          hasRevisions: false,
          hasDifferences: false,
          totalItemsCount: 0,
          totalTaxBaseDiff: 0,
          totalTaxAmountDiff: 0,
          totalPenaltyHuf: 0,
          items: [],
          diffs: [],
        };
      }

      let currentInvoices: Array<{
        id: string;
        invoice_number: string;
        partner_name: string;
        partner_tax_number?: string;
        net_amount: number;
        vat_amount: number;
        direction?: string;
      }> = [];

      try {
        let dateFrom = `${year}-${String(month).padStart(2, '0')}-01`;
        const lastDay = new Date(year, month, 0).getDate();
        let dateTo = `${year}-${String(month).padStart(2, '0')}-${lastDay}`;
        if (frequency === 'N') {
          const startMonth = (month - 1) * 3 + 1;
          dateFrom = `${year}-${String(startMonth).padStart(2, '0')}-01`;
          const endMonth = startMonth + 2;
          const lastDayQ = new Date(year, endMonth, 0).getDate();
          dateTo = `${year}-${String(endMonth).padStart(2, '0')}-${lastDayQ}`;
        } else if (frequency === 'E') {
          dateFrom = `${year}-01-01`;
          dateTo = `${year}-12-31`;
        }

        const { data: dbInvoices } = await supabase
          .from('nav_invoices')
          .select('id, invoice_number, supplier_name, customer_name, supplier_tax_number, customer_tax_number, invoice_net_amount, invoice_vat_amount, invoice_direction, invoice_delivery_date')
          .eq('company_id', companyId)
          .gte('invoice_delivery_date', dateFrom)
          .lte('invoice_delivery_date', dateTo);

        if (dbInvoices) {
          currentInvoices = dbInvoices.map((inv: any) => ({
            id: inv.id,
            invoice_number: inv.invoice_number,
            partner_name: inv.invoice_direction === 'OUTBOUND' ? (inv.customer_name || '') : (inv.supplier_name || ''),
            partner_tax_number: inv.invoice_direction === 'OUTBOUND' ? (inv.customer_tax_number || '') : (inv.supplier_tax_number || ''),
            net_amount: Number(inv.invoice_net_amount) || 0,
            vat_amount: Number(inv.invoice_vat_amount) || 0,
            direction: inv.invoice_direction || 'INBOUND',
          }));
        }
      } catch (e) {
        console.warn('Could not fetch active invoices for diff comparison:', e);
      }

      return computeSnapshotDiff(currentInvoices, latestSnapshot, year, month, frequency);
    })();
  }

  // In-memory mode (used by unit tests and direct callers)
  const currentInvoices = arg1?.currentInvoices || [];
  const latestSnapshot = arg1?.latestSnapshot || null;
  const year = arg1?.year || yearArg || new Date().getFullYear();
  const month = arg1?.month || monthArg || new Date().getMonth() + 1;
  const frequency = arg1?.frequency || frequencyArg || 'H';

  return computeSnapshotDiff(currentInvoices, latestSnapshot, year, month, frequency);
}
