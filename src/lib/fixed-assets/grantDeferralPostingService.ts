import { supabase } from '@/integrations/supabase/client';

export interface GrantDeferralAccounts {
  gl483Id: string | null;
  gl483Number: string | null;
  gl964Id: string | null;
  gl964Number: string | null;
}

export interface PostGrantDeferralInput {
  companyId: string;
  assetId: string;
  grantProjectId?: string | null;
  periodDate: string; // YYYY-MM-DD
  depreciationAmount: number;
  grantRatioPercent: number;
  customReleaseAmount?: number;
  gl483Id?: string;
  gl964Id?: string;
  notes?: string;
}

export interface PostGrantDeferralResult {
  success: boolean;
  headerId?: string;
  journalNumber?: number;
  documentId?: string;
  releaseAmount?: number;
  message?: string;
}

/**
 * Kiszámítja az elszámolt ÉCS támogatási aránynak megfelelő feloldandó passzív elhatárolási összeget.
 * Formula (Sztv. 45. § (2)): Feloldás = ÉCS * (Támogatási arány % / 100)
 *
 * Multi-year rounding catch-up (Option A):
 * Ha meg van adva a fennmaradó el nem határolt támogatási összeg, és az utolsó periódusban vagyunk,
 * vagy a számított összeg ±10 Ft-on belül van a maradékhoz képest, pontosan a fennmaradó keretre zár.
 */
export function calculateGrantDeferralReleaseAmount(
  depreciationAmount: number,
  grantRatioPercent: number,
  remainingUnreleasedGrant?: number,
  isFinalPeriod?: boolean
): number {
  if (depreciationAmount <= 0 || grantRatioPercent <= 0) return 0;
  const standard = Math.round((depreciationAmount * grantRatioPercent) / 100);

  if (remainingUnreleasedGrant !== undefined && remainingUnreleasedGrant > 0) {
    if (isFinalPeriod || Math.abs(standard - remainingUnreleasedGrant) <= 10 || standard > remainingUnreleasedGrant) {
      return remainingUnreleasedGrant;
    }
  }

  return standard;
}

export interface AvailableGrantAccounts {
  accounts483: Array<{ id: string; gl_number: string; short_name: string }>;
  accounts964: Array<{ id: string; gl_number: string; short_name: string }>;
  default483Id: string | null;
  default964Id: string | null;
}

/**
 * Lekérdezi a cég összes elérhető 483-as és 964-es számláját a kiválasztó dialógushoz.
 */
export async function fetchAvailableGrantAccounts(companyId: string): Promise<AvailableGrantAccounts> {
  const { data, error } = await supabase
    .from('gl_accounts')
    .select('id, gl_number, short_name, company_id')
    .or(`company_id.eq.${companyId},company_id.is.null`)
    .order('gl_number', { ascending: true });

  if (error || !data) {
    return { accounts483: [], accounts964: [], default483Id: null, default964Id: null };
  }

  const accounts483 = data.filter(
    a => a.gl_number.startsWith('483') || a.gl_number.startsWith('4812') || a.gl_number.startsWith('482')
  );
  const accounts964 = data.filter(
    a => a.gl_number.startsWith('964') || a.gl_number.startsWith('9634') || a.gl_number.startsWith('967')
  );

  const default483 = accounts483.find(a => a.gl_number.startsWith('483')) || accounts483[0] || null;
  const default964 = accounts964.find(a => a.gl_number.startsWith('964')) || accounts964[0] || null;

  return {
    accounts483,
    accounts964,
    default483Id: default483?.id || null,
    default964Id: default964?.id || null,
  };
}

/**
 * Feloldja a 483 (Passzív időbeli elhatárolás) és 964 (Egyéb támogatási bevétel) főkönyvi számlákat a cégnél.
 */
export async function resolveGrantDeferralAccounts(companyId: string): Promise<GrantDeferralAccounts> {
  // 1. Cég-specifikus vagy standard számlatükör lekérdezése
  const { data, error } = await supabase
    .from('gl_accounts')
    .select('id, gl_number, short_name, company_id')
    .or(`company_id.eq.${companyId},company_id.is.null`)
    .order('company_id', { ascending: false, nullsFirst: false });

  if (error || !data) {
    return { gl483Id: null, gl483Number: null, gl964Id: null, gl964Number: null };
  }

  // 483 számla keresése: előbb pontos 483-mal kezdődő, ha nincs, 4812 vagy 482
  const acc483 = data.find(a => a.gl_number.startsWith('483')) ||
                 data.find(a => a.gl_number.startsWith('4812')) ||
                 data.find(a => a.gl_number.startsWith('482'));

  // 964 számla keresése: előbb 964 vagy 9634 vagy 967
  const acc964 = data.find(a => a.gl_number.startsWith('964')) ||
                 data.find(a => a.gl_number.startsWith('9634')) ||
                 data.find(a => a.gl_number.startsWith('967'));

  return {
    gl483Id: acc483?.id || null,
    gl483Number: acc483?.gl_number || null,
    gl964Id: acc964?.id || null,
    gl964Number: acc964?.gl_number || null,
  };
}

/**
 * Automatikus könyvelési feladás az RPC-n keresztül: T 483 → K 964.
 */
export async function postGrantDeferralReleaseToLedger(
  input: PostGrantDeferralInput
): Promise<PostGrantDeferralResult> {
  try {
    const releaseAmount = input.customReleaseAmount !== undefined
      ? input.customReleaseAmount
      : calculateGrantDeferralReleaseAmount(input.depreciationAmount, input.grantRatioPercent);

    if (releaseAmount <= 0) {
      return {
        success: false,
        message: 'A feloldandó összeg nem lehet 0 vagy negatív.',
      };
    }

    // Főkönyvi számlák azonosítása
    let gl483 = input.gl483Id;
    let gl964 = input.gl964Id;

    if (!gl483 || !gl964) {
      const resolved = await resolveGrantDeferralAccounts(input.companyId);
      gl483 = gl483 || resolved.gl483Id || undefined;
      gl964 = gl964 || resolved.gl964Id || undefined;
    }

    if (!gl483 || !gl964) {
      return {
        success: false,
        message: 'A számlatükörben nem található megfelelő 483 (Passzív időbeli elhatárolás) vagy 964 (Egyéb támogatási bevétel) számla. Kérjük, rögzítsd a Számlatükörben a Beállítások -> Számlatükör menüpontban!',
      };
    }

    // RPC hívás a kötelező egysoros / többsoros formátumban
    const { data, error } = await supabase.rpc('post_grant_deferral_release_to_gl', {
      p_company_id: input.companyId,
      p_asset_id: input.assetId,
      p_grant_project_id: input.grantProjectId || null,
      p_period_date: input.periodDate,
      p_depreciation_amount: input.depreciationAmount,
      p_release_amount: releaseAmount,
      p_gl_483_id: gl483,
      p_gl_964_id: gl964,
      p_notes: input.notes || null,
    } as any);

    if (error) {
      const isMissingAccount = error.message.includes('Hiányzó 483') ||
                               error.message.includes('964') ||
                               error.message.includes('főkönyvi számla');
      const enhancedMessage = isMissingAccount
        ? 'Hiányzó főkönyvi számla a cégnél (483 vagy 964). Kérjük, ellenőrizd és vedd fel a Számlatükörbe a Beállítások menüben!'
        : `Könyvelési hiba: ${error.message}`;

      return {
        success: false,
        message: enhancedMessage,
      };
    }

    const res = data as any;
    return {
      success: res?.success ?? true,
      headerId: res?.header_id,
      journalNumber: res?.journal_number,
      documentId: res?.document_id,
      releaseAmount: res?.release_amount ?? releaseAmount,
      message: res?.message,
    };
  } catch (err: any) {
    console.error('postGrantDeferralReleaseToLedger hiba:', err);
    return {
      success: false,
      message: err?.message || 'Váratlan hiba a támogatási feloldás könyvelésekor',
    };
  }
}
