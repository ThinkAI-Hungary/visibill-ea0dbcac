import { supabase } from '@/integrations/supabase/client';
import type { Json } from '@/integrations/supabase/types';
import type {
  DisposalCommittee,
  DisposalDetails,
  DisposalReasonType,
  DisposalWasteInfo,
  FixedAsset,
} from '@/types/fixed-assets';
import { computeExpectedAccumulated } from './assetReconciliationService';
import { resolveActivePresetId } from './depreciationPostingService';

/**
 * TENY M1.4 – kivezetési (értékesítés / selejtezés / leltárhiány / térítés nélküli átadás)
 * könyvelő motor. A jóváhagyáskor könyvelendő sorokat a kliens számolja ki az eszköz
 * főkönyvi pozíciójából (jelölt `fixed_asset_id` sorok), az `approve_asset_disposal` RPC pedig
 * validálja (kiegyensúlyozott, pozitív összegek, a cég számlatükréhez tartozó számlák) és
 * egy tranzakcióban könyveli + zárja le az eszközt.
 */

export interface DisposalGlRef {
  id: string;
  glNumber: string;
  name: string;
}

export interface DisposalGlBalance {
  glAccountId: string;
  glNumber: string;
  /** Az eszköz saját számlaoldalán (bruttó: T-K, halmozott ÉCS: K-T) számított pozitív egyenleg. */
  amount: number;
}

export interface AssetGlPosition {
  gross: DisposalGlBalance[];
  accumulated: DisposalGlBalance[];
}

export interface DisposalAccountSet {
  depreciationExpense: DisposalGlRef | null; // 5711
  netBookValueSale: DisposalGlRef | null; // 861
  otherExpense: DisposalGlRef | null; // 869
  saleRevenue: DisposalGlRef | null; // 961
  otherRevenue: DisposalGlRef | null; // 969
  employeeReceivable: DisposalGlRef | null; // 361
  customerReceivable: DisposalGlRef | null; // 311
  bank: DisposalGlRef | null; // 384
  /** Tartalék halmozott ÉCS számla, ha az eszköznek még nincs jelölt ÉCS könyvelése. */
  fallbackAccumulated: DisposalGlRef | null;
}

export type SaleCounterAccount = 'customer' | 'bank';

export interface DisposalJournalLine {
  glAccountId: string;
  glNumber: string;
  dcType: 'T' | 'K';
  amount: number;
  description: string;
}

export interface DisposalJournalBreakdown {
  gross: number;
  accumulatedPosted: number;
  topUp: number;
  accumulatedTotal: number;
  netBookValue: number;
}

export interface DisposalJournalResult {
  lines: DisposalJournalLine[];
  breakdown: DisposalJournalBreakdown;
  totalDebit: number;
  totalCredit: number;
  errors: string[];
  warnings: string[];
}

export interface BuildDisposalJournalInput {
  reasonType: DisposalReasonType;
  assetName: string;
  position: AssetGlPosition;
  /** A kivezetés napjáig tervezett halmozott számviteli ÉCS. */
  expectedAccumulated: number;
  accounts: DisposalAccountSet;
  /** Értékesítés: nettó eladási ár. */
  saleNetAmount?: number;
  saleCounter?: SaleCounterAccount;
  /** Értékesítés: az eladási bevétel (T 311/384 → K 961) itt könyvelődjön-e. */
  bookSaleRevenue?: boolean;
  /** Leltárhiány: dolgozótól követelt kártérítés (T 361 → K 969). */
  compensationAmount?: number;
}

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const cleanGl = (gl: string | null | undefined) => (gl ?? '').replace(/[^0-9]/g, '');

export const DISPOSAL_ACCUMULATED_PREFIXES = ['119', '129', '139', '149'];
export const DISPOSAL_GROSS_PREFIXES = ['11', '12', '13', '14'];

export function classifyAssetGlNumber(glNumber: string): 'accumulated' | 'gross' | 'other' {
  const n = cleanGl(glNumber);
  if (DISPOSAL_ACCUMULATED_PREFIXES.some((p) => n.startsWith(p))) return 'accumulated';
  if (DISPOSAL_GROSS_PREFIXES.some((p) => n.startsWith(p))) return 'gross';
  return 'other';
}

/** A kivezetési könyvelés sorai (tiszta függvény – DB nélkül tesztelhető). */
export function buildDisposalJournal(input: BuildDisposalJournalInput): DisposalJournalResult {
  const { reasonType, assetName, position, accounts } = input;
  const errors: string[] = [];
  const warnings: string[] = [];
  const lines: DisposalJournalLine[] = [];

  const gross = round2(position.gross.reduce((s, b) => s + b.amount, 0));
  const accumulatedPosted = round2(position.accumulated.reduce((s, b) => s + b.amount, 0));

  const emptyBreakdown: DisposalJournalBreakdown = {
    gross,
    accumulatedPosted,
    topUp: 0,
    accumulatedTotal: accumulatedPosted,
    netBookValue: round2(gross - accumulatedPosted),
  };

  if (gross <= 0) {
    errors.push(
      'Az eszköz bruttó értéke nincs a főkönyvben (nincs jelölt aktiválási tétel). Előbb könyveld az eszközt a Rekonciliáció fülön.',
    );
    return { lines, breakdown: emptyBreakdown, totalDebit: 0, totalCredit: 0, errors, warnings };
  }

  if (accumulatedPosted > gross + 0.005) {
    errors.push('A főkönyvi halmozott értékcsökkenés meghaladja a bruttó értéket – a kivezetés nem könyvelhető.');
    return { lines, breakdown: emptyBreakdown, totalDebit: 0, totalCredit: 0, errors, warnings };
  }

  // 1. Pótlólagos ÉCS a kivezetés napjáig (csak ha a terv szerinti több a főkönyvinél)
  const expected = Math.min(gross, Math.max(0, Math.round(input.expectedAccumulated)));
  const topUp = round2(Math.max(0, expected - accumulatedPosted));
  const accumulatedTotal = round2(accumulatedPosted + topUp);
  const netBookValue = round2(gross - accumulatedTotal);

  const sortedAccum = [...position.accumulated].sort((a, b) => b.amount - a.amount);
  const primaryAccum: { glAccountId: string; glNumber: string } | null = sortedAccum[0]
    ? { glAccountId: sortedAccum[0].glAccountId, glNumber: sortedAccum[0].glNumber }
    : accounts.fallbackAccumulated
      ? { glAccountId: accounts.fallbackAccumulated.id, glNumber: accounts.fallbackAccumulated.glNumber }
      : null;

  if (topUp > 0) {
    if (!accounts.depreciationExpense) {
      errors.push('Hiányzik az értékcsökkenési leírás költségszámla (5711) a számlatükörből.');
    } else if (!primaryAccum) {
      errors.push('Nem található halmozott értékcsökkenés számla (119/129/139/149) a pótlólagos ÉCS-hez.');
    } else {
      lines.push({
        glAccountId: accounts.depreciationExpense.id,
        glNumber: accounts.depreciationExpense.glNumber,
        dcType: 'T',
        amount: topUp,
        description: `Terv szerinti ÉCS a kivezetés napjáig — ${assetName}`,
      });
      lines.push({
        glAccountId: primaryAccum.glAccountId,
        glNumber: primaryAccum.glNumber,
        dcType: 'K',
        amount: topUp,
        description: `Terv szerinti ÉCS a kivezetés napjáig — ${assetName}`,
      });
    }
  }

  // 2. Halmozott ÉCS kivezetése (T 1x9)
  if (accumulatedTotal > 0) {
    if (sortedAccum.length > 0) {
      sortedAccum.forEach((b, idx) => {
        const amount = round2(b.amount + (idx === 0 ? topUp : 0));
        if (amount > 0) {
          lines.push({
            glAccountId: b.glAccountId,
            glNumber: b.glNumber,
            dcType: 'T',
            amount,
            description: `Halmozott ÉCS kivezetése — ${assetName}`,
          });
        }
      });
    } else if (primaryAccum) {
      lines.push({
        glAccountId: primaryAccum.glAccountId,
        glNumber: primaryAccum.glNumber,
        dcType: 'T',
        amount: accumulatedTotal,
        description: `Halmozott ÉCS kivezetése — ${assetName}`,
      });
    }
  }

  // 3. Könyv szerinti nettó érték elszámolása
  if (netBookValue > 0) {
    const lossAccount = reasonType === 'sale' ? accounts.netBookValueSale : accounts.otherExpense;
    if (!lossAccount) {
      errors.push(
        reasonType === 'sale'
          ? 'Hiányzik az értékesítés könyv szerinti értékének számlája (861) a számlatükörből.'
          : 'Hiányzik az egyéb ráfordítás számla (869) a számlatükörből.',
      );
    } else {
      lines.push({
        glAccountId: lossAccount.id,
        glNumber: lossAccount.glNumber,
        dcType: 'T',
        amount: netBookValue,
        description: `Könyv szerinti nettó érték kivezetése — ${assetName}`,
      });
    }
  }

  // 4. Bruttó érték kivezetése (K 1x)
  position.gross.forEach((b) => {
    if (b.amount > 0) {
      lines.push({
        glAccountId: b.glAccountId,
        glNumber: b.glNumber,
        dcType: 'K',
        amount: round2(b.amount),
        description: `Eszköz bruttó értékének kivezetése — ${assetName}`,
      });
    }
  });

  // 5. Jogcím-specifikus kiegészítő tételek
  if (reasonType === 'sale') {
    const saleNet = round2(input.saleNetAmount ?? 0);
    if (input.bookSaleRevenue && saleNet > 0) {
      const counter = input.saleCounter === 'bank' ? accounts.bank : accounts.customerReceivable;
      if (!counter) {
        errors.push(
          input.saleCounter === 'bank'
            ? 'Hiányzik a bankszámla (384) a számlatükörből.'
            : 'Hiányzik a vevők számla (311) a számlatükörből.',
        );
      } else if (!accounts.saleRevenue) {
        errors.push('Hiányzik az egyéb bevétel számla (961) a számlatükörből.');
      } else {
        lines.push({
          glAccountId: counter.id,
          glNumber: counter.glNumber,
          dcType: 'T',
          amount: saleNet,
          description: `Értékesítési bevétel — ${assetName}`,
        });
        lines.push({
          glAccountId: accounts.saleRevenue.id,
          glNumber: accounts.saleRevenue.glNumber,
          dcType: 'K',
          amount: saleNet,
          description: `Értékesítési bevétel — ${assetName}`,
        });
      }
    } else if (!input.bookSaleRevenue) {
      warnings.push(
        'Az értékesítési bevétel nem kerül könyvelésre ebben a tételben – a kimenő számla külön könyvelésével kell rögzíteni.',
      );
    }
    warnings.push('Az ÁFA-t ez a tétel nem kezeli: az eladási árat nettó összegként kell megadni.');
  }

  if (reasonType === 'inventory_shortage') {
    const compensation = round2(input.compensationAmount ?? 0);
    if (compensation > 0) {
      if (!accounts.employeeReceivable || !accounts.otherRevenue) {
        errors.push('Hiányzik a munkavállalókkal szembeni követelés (361) vagy az egyéb bevétel (969) számla.');
      } else {
        lines.push({
          glAccountId: accounts.employeeReceivable.id,
          glNumber: accounts.employeeReceivable.glNumber,
          dcType: 'T',
          amount: compensation,
          description: `Megtérítendő leltárhiány-kár — ${assetName}`,
        });
        lines.push({
          glAccountId: accounts.otherRevenue.id,
          glNumber: accounts.otherRevenue.glNumber,
          dcType: 'K',
          amount: compensation,
          description: `Megtérítendő leltárhiány-kár — ${assetName}`,
        });
      }
      if (compensation > netBookValue) {
        warnings.push('A követelt kártérítés meghaladja az eszköz könyv szerinti nettó értékét.');
      }
    }
  }

  if (reasonType === 'donation') {
    warnings.push('Térítés nélküli átadásnál az ÁFA-vonzat (ingyenes termékátadás) külön vizsgálandó.');
  }

  const totalDebit = round2(lines.filter((l) => l.dcType === 'T').reduce((s, l) => s + l.amount, 0));
  const totalCredit = round2(lines.filter((l) => l.dcType === 'K').reduce((s, l) => s + l.amount, 0));

  if (errors.length === 0 && Math.abs(totalDebit - totalCredit) > 0.005) {
    errors.push(`A kivezetési könyvelés nem egyensúlyban van (T: ${totalDebit}, K: ${totalCredit}).`);
  }

  return {
    lines,
    breakdown: { gross, accumulatedPosted, topUp, accumulatedTotal, netBookValue },
    totalDebit,
    totalCredit,
    errors,
    warnings,
  };
}

/** Az eszköz főkönyvi pozíciója a jelölt (`fixed_asset_id`) tételsorokból – bruttó és halmozott ÉCS számlánként. */
export async function fetchAssetGlPosition(assetId: string): Promise<AssetGlPosition> {
  const { data, error } = await supabase
    .from('acc_journal_lines')
    .select('dc_type, amount, gl_account_id, gl_accounts(gl_number), acc_journal_headers!inner(status)')
    .eq('fixed_asset_id', assetId)
    .in('acc_journal_headers.status', ['KONYVELT', 'SZTORNOZOTT']);

  if (error) throw error;

  const gross = new Map<string, DisposalGlBalance>();
  const accumulated = new Map<string, DisposalGlBalance>();

  for (const row of data ?? []) {
    const glNumber = (row.gl_accounts as { gl_number?: string } | null)?.gl_number ?? '';
    const kind = classifyAssetGlNumber(glNumber);
    if (kind === 'other') continue;
    const amount = Number(row.amount) || 0;
    const signed = (row.dc_type === 'T' ? amount : -amount) * (kind === 'gross' ? 1 : -1);
    const target = kind === 'gross' ? gross : accumulated;
    const prev = target.get(row.gl_account_id);
    target.set(row.gl_account_id, {
      glAccountId: row.gl_account_id,
      glNumber,
      amount: round2((prev?.amount ?? 0) + signed),
    });
  }

  const positive = (m: Map<string, DisposalGlBalance>) => [...m.values()].filter((b) => b.amount > 0.005);
  return { gross: positive(gross), accumulated: positive(accumulated) };
}

/** A kivezetési könyveléshez szükséges főkönyvi számlák feloldása a cég számlatükréből. */
export async function resolveDisposalAccounts(companyId: string, assetGlNumber?: string | null): Promise<DisposalAccountSet> {
  const presetId = await resolveActivePresetId(companyId);

  let query = supabase.from('gl_accounts').select('id, gl_number, short_name, description');
  if (presetId) {
    query = query.or(`preset_id.eq.${presetId},company_id.eq.${companyId}`);
  } else {
    query = query.eq('company_id', companyId);
  }
  const { data, error } = await query.limit(3000);
  if (error) throw error;

  const accounts = (data ?? []).map((a) => ({
    id: a.id,
    glNumber: a.gl_number,
    name: a.short_name || a.description || a.gl_number,
    clean: cleanGl(a.gl_number),
  }));

  const pick = (...prefixes: string[]): DisposalGlRef | null => {
    for (const prefix of prefixes) {
      const exact = accounts.find((a) => a.clean === prefix);
      if (exact) return { id: exact.id, glNumber: exact.glNumber, name: exact.name };
    }
    for (const prefix of prefixes) {
      const starts = accounts.filter((a) => a.clean.startsWith(prefix)).sort((a, b) => a.clean.length - b.clean.length || a.clean.localeCompare(b.clean));
      if (starts[0]) return { id: starts[0].id, glNumber: starts[0].glNumber, name: starts[0].name };
    }
    return null;
  };

  const assetClean = cleanGl(assetGlNumber);
  const accumGroup = assetClean.length >= 2 ? `${assetClean[0]}${assetClean[1]}9` : '';
  const fallbackAccumulated = (accumGroup && pick(accumGroup)) || pick('139', '149', '129', '119');

  return {
    depreciationExpense: pick('5711', '571'),
    netBookValueSale: pick('861'),
    otherExpense: pick('869'),
    saleRevenue: pick('961'),
    otherRevenue: pick('969'),
    employeeReceivable: pick('361'),
    customerReceivable: pick('311'),
    bank: pick('384'),
    fallbackAccumulated,
  };
}

/** A kivezetés napjáig várható halmozott ÉCS (ugyanaz a motor, mint a főkönyvi ÉCS-feladásnál). */
export function computeExpectedAccumulatedAtDisposal(asset: FixedAsset, disposalDate: string): number {
  return computeExpectedAccumulated(asset, disposalDate);
}

// ─────────────────────────────────────────────────────────────────────────────
// RPC wrapperek
// ─────────────────────────────────────────────────────────────────────────────

export interface RequestDisposalParams {
  companyId: string;
  assetId: string;
  reasonType: DisposalReasonType;
  disposalDate: string;
  reason?: string;
  committee?: DisposalCommittee | null;
  wasteInfo?: DisposalWasteInfo | null;
  details?: DisposalDetails | null;
}

export async function requestAssetDisposal(params: RequestDisposalParams): Promise<void> {
  const { error } = await supabase.rpc('request_asset_disposal', {
    p_company_id: params.companyId,
    p_asset_id: params.assetId,
    p_reason_type: params.reasonType,
    p_disposal_date: params.disposalDate,
    p_reason: params.reason?.trim() || undefined,
    p_committee: (params.committee ?? undefined) as unknown as Json,
    p_waste_info: (params.wasteInfo ?? undefined) as unknown as Json,
    p_details: (params.details ?? undefined) as unknown as Json,
  });
  if (error) throw error;
}

export async function rejectAssetDisposal(companyId: string, assetId: string, reason?: string): Promise<void> {
  const { error } = await supabase.rpc('reject_asset_disposal', {
    p_company_id: companyId,
    p_asset_id: assetId,
    p_reason: reason?.trim() || undefined,
  });
  if (error) throw error;
}

export interface ApproveDisposalResult {
  success: boolean;
  header_id: string;
  journal_number: number | null;
  document_id: string;
  status: 'sold' | 'disposed';
  message?: string;
}

export async function approveAssetDisposal(
  companyId: string,
  assetId: string,
  lines: DisposalJournalLine[],
  description?: string,
): Promise<ApproveDisposalResult> {
  const { data, error } = await supabase.rpc('approve_asset_disposal', {
    p_company_id: companyId,
    p_asset_id: assetId,
    p_lines: lines.map((l) => ({
      gl_account_id: l.glAccountId,
      dc_type: l.dcType,
      amount: l.amount,
      description: l.description,
    })) as unknown as Json,
    p_description: description,
  });
  if (error) throw error;
  return data as unknown as ApproveDisposalResult;
}
