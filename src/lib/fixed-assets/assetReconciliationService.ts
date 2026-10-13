import { supabase } from '@/integrations/supabase/client';
import { calculateAssetPeriodDepreciation } from '@/lib/fixed-assets/depreciationPostingService';
import { postAssetActivationToLedger } from '@/lib/fixed-assets/assetActivationAutoPoster';
import type { FixedAsset } from '@/types/fixed-assets';

/**
 * TENY M1.2 — Főkönyv ↔ Tárgyi eszköz nyilvántartó rekonciliáció.
 *
 * A főkönyvi oldalt (1-es számlaosztály, eszközönkénti `fixed_asset_id` jelölés) a
 * `reconcile_fixed_assets_with_gl` RPC aggregálja szerveroldalon. A várható halmozott
 * ÉCS-t (analitika) itt számoljuk a meglévő ÉCS-motorral, hogy a degresszív / teljesítmény /
 * egyedi leírási módok számítása egyetlen helyen éljen (nincs SQL-oldali duplikáció).
 */

/** Forintos egyezőségi tűrés (a meglévő rekonciliációs nézettel azonos: < 1 Ft). */
export const RECONCILIATION_TOLERANCE = 1;

export type GrossIssue = 'ok' | 'unposted' | 'period_mismatch' | 'value_mismatch';
export type AccumIssue = 'ok' | 'unposted_depreciation' | 'under_posted' | 'over_posted';

export interface ReconAssetGlRow {
  asset_id: string;
  inventory_number: string;
  name: string;
  status: string;
  activation_date: string | null;
  disposal_date: string | null;
  acquisition_value: number;
  expected_gross: number;
  gl_gross: number;
  gl_accum: number;
  gl_cip: number;
  gross_line_count: number;
  first_gross_posting_date: string | null;
  issue: GrossIssue;
}

export interface ReconOrphanLine {
  line_id: string;
  header_id: string;
  posting_date: string;
  document_id: string | null;
  gl_number: string;
  cls: 'gross' | 'accum' | 'cip';
  dc_type: 'T' | 'K';
  amount: number;
  signed_amount: number;
  description: string | null;
}

export interface ReconRpcResult {
  company_id: string;
  as_of: string;
  totals: {
    gross: { gl: number; gl_tagged: number; gl_untagged: number; analytic: number; difference: number };
    accum: { gl: number; gl_tagged: number; gl_untagged: number };
    cip: { gl: number; gl_tagged: number; gl_untagged: number };
  };
  root_causes: {
    unposted_assets: { count: number; amount: number };
    orphan_gl_lines: { count: number; amount: number };
    period_mismatches: { count: number; amount: number };
    value_mismatches: { count: number; amount: number };
  };
  counts: { assets_total: number; assets_ok: number };
  assets: ReconAssetGlRow[];
  orphans: ReconOrphanLine[];
}

export interface ReconAssetRow extends ReconAssetGlRow {
  expected_accum: number;
  accum_difference: number;
  accum_issue: AccumIssue;
}

export type ReconStatus = 'OK' | 'DISCREPANCY';

export interface AssetReconciliationReport {
  asOf: string;
  /** Az ÉCS-analitika számításának vágási dátuma (az utolsó lezárt hónap vége). */
  depreciationCutoff: string;
  gross: { gl: number; analytic: number; difference: number; status: ReconStatus };
  accum: {
    gl: number;
    analytic: number;
    difference: number;
    status: ReconStatus;
    glUntagged: number;
  };
  /** Befejezetlen beruházás (161): nincs analitikus alap, ezért csak tájékoztató adat. */
  cip: { gl: number; glTagged: number; glUntagged: number };
  rootCauses: ReconRpcResult['root_causes'] & {
    unposted_depreciation: { count: number; amount: number };
    accum_mismatches: { count: number; amount: number };
  };
  assets: ReconAssetRow[];
  orphans: ReconOrphanLine[];
  /** Hiányzó tételek pótlásra jelölt (aktiválás nincs lekönyvelve) eszközök. */
  repostableAssetIds: string[];
  isFullyReconciled: boolean;
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function toIso(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * Az ÉCS-analitika vágási dátuma: ha az időpont hónap utolsó napja, akkor maga az időpont,
 * különben az előző hónap utolsó napja (az időszaki ÉCS-futtatás teljes hónapokra könyvel).
 */
export function getDepreciationCutoff(asOf: string): string {
  const [y, m, d] = asOf.split('-').map(Number);
  const lastDayOfMonth = new Date(y, m, 0).getDate();
  if (d === lastDayOfMonth) return asOf;
  return toIso(new Date(y, m - 1, 0));
}

/**
 * Egy eszköz várható halmozott számviteli ÉCS-e a vágási dátumig — ugyanazzal a motorral, amely a
 * főkönyvi ÉCS-feladást készíti (`calculateAssetPeriodDepreciation`), így a két oldal azonos
 * számítási alapon áll.
 */
export function computeExpectedAccumulated(asset: FixedAsset, cutoff: string): number {
  if (!asset.activation_date || asset.activation_date > cutoff) return 0;
  const [ay, am] = asset.activation_date.split('-').map(Number);
  const periodStart = `${ay}-${pad(am)}-01`;
  const result = calculateAssetPeriodDepreciation(asset, periodStart, cutoff);
  return Math.max(0, Math.round(result.amount));
}

function classifyAccum(expected: number, gl: number): AccumIssue {
  if (expected < RECONCILIATION_TOLERANCE && Math.abs(gl) < RECONCILIATION_TOLERANCE) return 'ok';
  if (expected >= RECONCILIATION_TOLERANCE && Math.abs(gl) < RECONCILIATION_TOLERANCE) return 'unposted_depreciation';
  const diff = gl - expected;
  if (Math.abs(diff) < RECONCILIATION_TOLERANCE) return 'ok';
  return diff < 0 ? 'under_posted' : 'over_posted';
}

/**
 * Összeállítja a rekonciliációs jelentést az RPC-eredményből és az eszközanalitikából.
 * Tiszta (side-effect mentes) függvény, ezért egységtesztelhető.
 */
export function buildAssetReconciliationReport(
  rpc: ReconRpcResult,
  assets: FixedAsset[],
  asOf: string,
): AssetReconciliationReport {
  const cutoff = getDepreciationCutoff(asOf);
  const assetById = new Map(assets.map((a) => [a.id, a]));

  const rows: ReconAssetRow[] = (rpc.assets ?? []).map((r) => {
    const asset = assetById.get(r.asset_id);
    const expectedAccum = asset ? computeExpectedAccumulated(asset, cutoff) : 0;
    const glAccum = Number(r.gl_accum) || 0;
    return {
      ...r,
      acquisition_value: Number(r.acquisition_value) || 0,
      expected_gross: Number(r.expected_gross) || 0,
      gl_gross: Number(r.gl_gross) || 0,
      gl_accum: glAccum,
      gl_cip: Number(r.gl_cip) || 0,
      expected_accum: expectedAccum,
      accum_difference: glAccum - expectedAccum,
      accum_issue: classifyAccum(expectedAccum, glAccum),
    };
  });

  const analyticAccum = rows.reduce((s, r) => s + r.expected_accum, 0);
  const glAccum = Number(rpc.totals.accum.gl) || 0;
  const accumDiff = glAccum - analyticAccum;
  const grossDiff = Number(rpc.totals.gross.difference) || 0;

  const unpostedDep = rows.filter((r) => r.accum_issue === 'unposted_depreciation');
  const accumMismatch = rows.filter((r) => r.accum_issue === 'under_posted' || r.accum_issue === 'over_posted');

  const grossOk = Math.abs(grossDiff) < RECONCILIATION_TOLERANCE;
  const accumOk = Math.abs(accumDiff) < RECONCILIATION_TOLERANCE;

  return {
    asOf,
    depreciationCutoff: cutoff,
    gross: {
      gl: Number(rpc.totals.gross.gl) || 0,
      analytic: Number(rpc.totals.gross.analytic) || 0,
      difference: grossDiff,
      status: grossOk ? 'OK' : 'DISCREPANCY',
    },
    accum: {
      gl: glAccum,
      analytic: analyticAccum,
      difference: accumDiff,
      status: accumOk ? 'OK' : 'DISCREPANCY',
      glUntagged: Number(rpc.totals.accum.gl_untagged) || 0,
    },
    cip: {
      gl: Number(rpc.totals.cip.gl) || 0,
      glTagged: Number(rpc.totals.cip.gl_tagged) || 0,
      glUntagged: Number(rpc.totals.cip.gl_untagged) || 0,
    },
    rootCauses: {
      ...rpc.root_causes,
      // Az RPC az orphan összeget csak a bruttó osztályra adja; a munkalapon mindhárom osztály (bruttó, ÉCS, 161)
      // jelöletlen egyenlegének abszolút összegét mutatjuk, hogy a halmozott ÉCS-oldali orphan sorok se tűnjenek 0 Ft-nak.
      orphan_gl_lines: {
        count: rpc.root_causes.orphan_gl_lines.count,
        amount:
          Math.abs(Number(rpc.totals.gross.gl_untagged) || 0) +
          Math.abs(Number(rpc.totals.accum.gl_untagged) || 0) +
          Math.abs(Number(rpc.totals.cip.gl_untagged) || 0),
      },
      unposted_depreciation: {
        count: unpostedDep.length,
        amount: unpostedDep.reduce((s, r) => s + r.expected_accum, 0),
      },
      accum_mismatches: {
        count: accumMismatch.length,
        amount: accumMismatch.reduce((s, r) => s + r.accum_difference, 0),
      },
    },
    assets: rows,
    orphans: rpc.orphans ?? [],
    repostableAssetIds: rows.filter((r) => r.issue === 'unposted').map((r) => r.asset_id),
    isFullyReconciled: grossOk && accumOk,
  };
}

/** Lekéri a főkönyvi oldali rekonciliációs adatot a szerverről (D-5). */
export async function fetchAssetReconciliationRpc(companyId: string, asOf: string): Promise<ReconRpcResult> {
  const { data, error } = await supabase.rpc('reconcile_fixed_assets_with_gl', {
    p_company_id: companyId,
    p_date: asOf,
  });
  if (error) throw error;
  return data as unknown as ReconRpcResult;
}

export interface RepostResult {
  assetId: string;
  inventoryNumber: string;
  success: boolean;
  message?: string;
}

/**
 * Hiányzó tételek pótlása: a le nem könyvelt aktiválású eszközök aktiválási tételét feladja a Vegyes
 * naplóba (T eszközszámla / K 161), a meglévő post_asset_activation_to_gl RPC-n keresztül. Az RPC
 * idempotens (azonos bizonylatszámra nem könyvel duplán), így a kötegelt újrafuttatás biztonságos.
 * Sorosan fut, hogy egy hiba ne állítsa le a többi eszköz feladását.
 */
export async function repostUnpostedAssets(
  companyId: string,
  assets: FixedAsset[],
  assetIds: string[],
  onProgress?: (done: number, total: number) => void,
): Promise<RepostResult[]> {
  const byId = new Map(assets.map((a) => [a.id, a]));
  const results: RepostResult[] = [];
  let done = 0;

  for (const assetId of assetIds) {
    const asset = byId.get(assetId);
    if (!asset) {
      results.push({ assetId, inventoryNumber: '-', success: false, message: 'Az eszköz nem található.' });
    } else if (!asset.activation_date) {
      results.push({ assetId, inventoryNumber: asset.inventory_number, success: false, message: 'Hiányzó aktiválási dátum.' });
    } else {
      const res = await postAssetActivationToLedger({
        companyId,
        assetId: asset.id,
        assetName: asset.name,
        inventoryNumber: asset.inventory_number,
        acquisitionValue: Number(asset.acquisition_value) || 0,
        activationDate: asset.activation_date,
        currency: asset.currency,
        glAccountId: asset.gl_account_id,
      });
      results.push({ assetId, inventoryNumber: asset.inventory_number, success: res.success, message: res.message });
    }
    done += 1;
    onProgress?.(done, assetIds.length);
  }

  return results;
}
