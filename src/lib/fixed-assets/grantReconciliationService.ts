import { supabase } from '@/integrations/supabase/client';
import type { FixedAsset, FixedAssetComponent, GrantProject } from '@/types/fixed-assets';

export interface GrantReconciliationPillars {
  /** 1. Pillér: Pályázati keretadatok */
  grantContract: {
    totalEligibleCost: number;
    totalGrantAmount: number;
    totalDisbursedAmount: number;
    totalAdvanceAmount: number;
    unallocatedGrantAmount: number;
  };
  /** 2. Pillér: Tárgyi Eszköz Analitika (kapcsolt eszközök és komponensek) */
  assetAnalytics: {
    connectedAssetCount: number;
    connectedComponentCount: number;
    totalAssetGrossValue: number;
    totalAllocatedGrantAmount: number;
    totalAllocatedOwnAmount: number;
    effectiveGrantRatioPercent: number;
  };
  /** 3. Pillér: Főkönyvi Egyenlegek (161, 1x, 483, 964) */
  generalLedger: {
    gl483Balance: number; // Támogatások passzív időbeli elhatárolása (K - T)
    gl964Turnover: number; // Feloldott egyéb bevétel (K - T)
    gl161Balance: number; // Beruházások egyenlege
  };
  /** 4. Pillér: Időbeli Elhatárolások Analitikája */
  deferralAnalytics: {
    calculatedReleasedPie: number; // Kalkulált feloldott összeg
    expectedRemainingPie: number; // Várható 483-as záró egyenleg
    pieDiscrepancy: number; // Főkönyvi 483 és elvárt analitika különbsége
  };
}

export interface GrantDiscrepancyAlert {
  id: string;
  severity: 'error' | 'warning' | 'info';
  title: string;
  description: string;
  projectId?: string;
  assetId?: string;
}

export interface GrantReconciliationResult {
  pillars: GrantReconciliationPillars;
  isBalanced: boolean;
  alerts: GrantDiscrepancyAlert[];
}

/**
 * Számítja a 4-oldalú rekonciliációt egy adott céghez és pályázataihoz.
 */
export function calculateGrantReconciliation(
  projects: GrantProject[],
  assets: FixedAsset[],
  components: FixedAssetComponent[],
  gl483Balance: number = 0,
  gl964Turnover: number = 0
): GrantReconciliationResult {
  // 1. Pillér: Pályázati szerződéses keretek
  let totalEligible = 0;
  let totalGrant = 0;
  let totalDisbursed = 0;
  let totalAdvance = 0;

  projects.forEach(p => {
    totalEligible += Number(p.eligible_cost) || 0;
    totalGrant += Number(p.grant_amount) || 0;
    totalDisbursed += Number(p.disbursed_amount) || 0;
    totalAdvance += Number(p.advance_amount) || 0;
  });

  // 2. Pillér: Tárgyi eszköz analitika
  // Kapcsolt komponensek
  let connectedCompCount = 0;
  let compAllocatedGrant = 0;
  let compAllocatedOwn = 0;
  let compGross = 0;

  const handledAssetIds = new Set<string>();

  components.forEach(c => {
    if (c.grant_project_id) {
      connectedCompCount++;
      compAllocatedGrant += Number(c.grant_funding_amount) || 0;
      compAllocatedOwn += Number(c.own_funding_amount) || 0;
      compGross += Number(c.gross_value) || 0;
      handledAssetIds.add(c.fixed_asset_id);
    }
  });

  // Közvetlenül a főkartonon pályázathoz kapcsolt eszközök (amelyeknek nincsenek külön komponenseik)
  let directAssetGrant = 0;
  let directAssetOwn = 0;
  let directAssetGross = 0;
  let connectedAssetCount = 0;

  assets.forEach(a => {
    if (a.grant_project_id || handledAssetIds.has(a.id)) {
      connectedAssetCount++;
      if (a.grant_project_id && !handledAssetIds.has(a.id)) {
        const gross = Number(a.acquisition_value) || 0;
        const proj = projects.find(p => p.id === a.grant_project_id);
        const intensity = proj?.intensity_rate || 0;
        const grant = Math.round((gross * intensity) / 100);
        directAssetGrant += grant;
        directAssetOwn += Math.max(0, gross - grant);
        directAssetGross += gross;
      }
    }
  });

  const totalAllocatedGrant = compAllocatedGrant + directAssetGrant;
  const totalAllocatedOwn = compAllocatedOwn + directAssetOwn;
  const totalAssetGross = compGross + directAssetGross;
  const effectiveRatio = totalAssetGross > 0 ? Math.round((totalAllocatedGrant / totalAssetGross) * 10000) / 100 : 0;
  const unallocatedGrant = Math.max(0, totalGrant - totalAllocatedGrant);

  // 3. és 4. Pillér: Időbeli elhatárolás és rekonciliáció
  const calculatedReleasedPie = gl964Turnover;
  const expectedRemainingPie = Math.max(0, totalAllocatedGrant - calculatedReleasedPie);
  const pieDiscrepancy = Math.abs(gl483Balance - expectedRemainingPie);

  const alerts: GrantDiscrepancyAlert[] = [];

  // Ellenőrzés 1: Kerettúllépés
  if (totalAllocatedGrant > totalGrant && totalGrant > 0) {
    alerts.push({
      id: 'grant-overallocated',
      severity: 'error',
      title: 'Támogatási keret túllépés',
      description: `Az eszközökhöz rendelt támogatási összeg (${totalAllocatedGrant.toLocaleString('hu-HU')} Ft) meghaladja a megítélt pályázati keretet (${totalGrant.toLocaleString('hu-HU')} Ft)!`,
    });
  }

  // Ellenőrzés 2: Elhatárolási egyezőség
  if (gl483Balance > 0 && pieDiscrepancy > 100) {
    alerts.push({
      id: 'pie-mismatch',
      severity: 'warning',
      title: 'Passzív Időbeli Elhatárolási Eltérés',
      description: `A főkönyvi 483-as egyenleg (${gl483Balance.toLocaleString('hu-HU')} Ft) és a számított analitikus záró elhatárolás (${expectedRemainingPie.toLocaleString('hu-HU')} Ft) között ${pieDiscrepancy.toLocaleString('hu-HU')} Ft eltérés mutatkozik.`,
    });
  }

  // Ellenőrzés 3: Fenntartási időszak alatti elidegenítés riasztás
  const todayStr = new Date().toISOString().slice(0, 10);
  projects.forEach(proj => {
    if (proj.maintenance_end_date && proj.maintenance_end_date > todayStr) {
      // Megnézzük, van-e a projekthez rendelt olyan eszköz, amely kivezetés / értékesítés alatt áll
      const projectAssets = assets.filter(a => a.grant_project_id === proj.id || handledAssetIds.has(a.id));
      const violatedAssets = projectAssets.filter(a => a.status === 'sold' || a.status === 'disposed' || a.disposal_status === 'pending_approval');
      if (violatedAssets.length > 0) {
        alerts.push({
          id: `maintenance-violation-${proj.id}`,
          severity: 'error',
          title: `Fenntartási Időszak Korlátozás: ${proj.code}`,
          description: `A(z) ${proj.code} projekt fenntartási időszaka még nem járt le (${proj.maintenance_end_date}), de ${violatedAssets.length} db eszköz kivezetése vagy értékesítése van folyamatban! Ez támogatás-visszafizetési kockázatot jelenthet.`,
          projectId: proj.id,
        });
      }
    }
  });

  const isBalanced = alerts.filter(a => a.severity === 'error').length === 0 && pieDiscrepancy <= 100;

  return {
    pillars: {
      grantContract: {
        totalEligibleCost: totalEligible,
        totalGrantAmount: totalGrant,
        totalDisbursedAmount: totalDisbursed,
        totalAdvanceAmount: totalAdvance,
        unallocatedGrantAmount: unallocatedGrant,
      },
      assetAnalytics: {
        connectedAssetCount,
        connectedComponentCount: connectedCompCount,
        totalAssetGrossValue: totalAssetGross,
        totalAllocatedGrantAmount: totalAllocatedGrant,
        totalAllocatedOwnAmount: totalAllocatedOwn,
        effectiveGrantRatioPercent: effectiveRatio,
      },
      generalLedger: {
        gl483Balance,
        gl964Turnover,
        gl161Balance: 0,
      },
      deferralAnalytics: {
        calculatedReleasedPie,
        expectedRemainingPie,
        pieDiscrepancy,
      },
    },
    isBalanced,
    alerts,
  };
}

/**
 * Lekérdezi a cég főkönyvi 483-as és 964-es egyenlegét a rekonciliációhoz.
 */
export async function fetchGrantGlBalances(companyId: string): Promise<{ gl483Balance: number; gl964Turnover: number }> {
  try {
    const { data: accounts } = await supabase
      .from('gl_accounts')
      .select('id, gl_number')
      .or(`company_id.eq.${companyId},company_id.is.null`);

    if (!accounts || accounts.length === 0) {
      return { gl483Balance: 0, gl964Turnover: 0 };
    }

    const acc483Ids = accounts.filter(a => a.gl_number.startsWith('483')).map(a => a.id);
    const acc964Ids = accounts.filter(a => a.gl_number.startsWith('964') || a.gl_number.startsWith('9634')).map(a => a.id);

    let gl483Balance = 0;
    let gl964Turnover = 0;

    if (acc483Ids.length > 0) {
      const { data: lines483 } = await (supabase as any)
        .from('acc_journal_lines')
        .select('dc_type, amount')
        .in('gl_account_id', acc483Ids);

      if (lines483) {
        lines483.forEach((l: any) => {
          const amt = Number(l.amount) || 0;
          if (l.dc_type === 'K') gl483Balance += amt;
          else if (l.dc_type === 'T') gl483Balance -= amt;
        });
      }
    }

    if (acc964Ids.length > 0) {
      const { data: lines964 } = await (supabase as any)
        .from('acc_journal_lines')
        .select('dc_type, amount')
        .in('gl_account_id', acc964Ids);

      if (lines964) {
        lines964.forEach((l: any) => {
          const amt = Number(l.amount) || 0;
          if (l.dc_type === 'K') gl964Turnover += amt;
          else if (l.dc_type === 'T') gl964Turnover -= amt;
        });
      }
    }

    return {
      gl483Balance: Math.max(0, gl483Balance),
      gl964Turnover: Math.max(0, gl964Turnover),
    };
  } catch (err) {
    console.error('fetchGrantGlBalances error:', err);
    return { gl483Balance: 0, gl964Turnover: 0 };
  }
}
