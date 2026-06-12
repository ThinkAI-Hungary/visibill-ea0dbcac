/**
 * Anomália-észlelő motor — szabályalapú bérszámfejtési ellenőrzések
 *
 * Determinisztikus szabályok, amelyek a valós Supabase-adatokra épülnek.
 * Minden szabály: (input) => Anomaly[]
 */

// ═══════════════════════════════════════════════════════════════
// TÍPUSOK
// ═══════════════════════════════════════════════════════════════

export type AnomalySeverity = 'critical' | 'warning' | 'info';

export interface Anomaly {
  id: string;
  title: string;
  description: string;
  severity: AnomalySeverity;
  category: string;
  affectedEmployees: string[];
  potentialImpact: string;
  recommendation: string;
  detectedAt: string;
  resolved: boolean;
  /** Source rule that generated this anomaly */
  ruleId: string;
}

export interface EmploymentWithEmployee {
  employmentId: string;
  employeeId: string;
  employeeName: string;
  baseSalary: number | null;
  weeklyHours: number;
  feorCode: string | null;
  jobTitle: string | null;
  status: string;
  isInsured: boolean;
  startDate: string;
  endDate: string | null;
}

export interface CalculationData {
  employmentId: string;
  employeeName: string;
  grossSalary: number;
  szjaBase: number;
  szjaAmount: number;
  tbAmount: number;
  szochoAmount: number;
  netSalary: number;
  totalDeductions: number;
  taxCredits: Record<string, unknown>;
  szochoCredits: Record<string, unknown>;
}

export interface AnomalyInput {
  employments: EmploymentWithEmployee[];
  calculations: CalculationData[];
  taxParams: {
    minimumWage: number;
    guaranteedMinimum: number;
    szjaRate: number;
    tbRate: number;
    szochoRate: number;
  };
  companyName?: string;
}

// ═══════════════════════════════════════════════════════════════
// SZABÁLYOK
// ═══════════════════════════════════════════════════════════════

type AnomalyRule = (input: AnomalyInput) => Anomaly[];

const today = () => new Date().toISOString().split('T')[0];

/**
 * 1. Minimálbér alatti alapbér (teljes munkaidő, heti 40 óra)
 */
const ruleMinimumWage: AnomalyRule = ({ employments, taxParams }) => {
  const anomalies: Anomaly[] = [];
  for (const emp of employments) {
    if (emp.status !== 'active' || emp.endDate) continue;
    if (!emp.baseSalary || !emp.isInsured) continue;
    // Teljes munkaidő = heti 36+ óra (általánosan 40)
    if (emp.weeklyHours < 36) continue;

    if (emp.baseSalary < taxParams.minimumWage) {
      anomalies.push({
        id: `min-wage-${emp.employmentId}`,
        ruleId: 'minimum_wage',
        title: 'Minimálbér alatti alapbér',
        description: `${emp.employeeName} alapbére (${emp.baseSalary.toLocaleString('hu-HU')} Ft) a ${new Date().getFullYear()}-os minimálbér (${taxParams.minimumWage.toLocaleString('hu-HU')} Ft) alatt van. Heti ${emp.weeklyHours} órás, teljes munkaidős jogviszony.`,
        severity: 'critical',
        category: 'Bér',
        affectedEmployees: [emp.employeeName],
        potentialImpact: 'Munkaügyi bírság, járulék utólagos megállapítás',
        recommendation: `Azonnali béremelés ${taxParams.minimumWage.toLocaleString('hu-HU')} Ft-ra vagy magasabbra. Járulékokat a minimálbér alapján kell fizetni.`,
        detectedAt: today(),
        resolved: false,
      });
    }
  }
  return anomalies;
};

/**
 * 2. Garantált bérminimum alatti (szakmunkás, FEOR 2-8)
 */
const ruleGuaranteedMinimum: AnomalyRule = ({ employments, taxParams }) => {
  const anomalies: Anomaly[] = [];
  for (const emp of employments) {
    if (emp.status !== 'active' || emp.endDate) continue;
    if (!emp.baseSalary || !emp.isInsured) continue;
    if (emp.weeklyHours < 36) continue;

    // FEOR 2-8 → szakképzettséget igénylő → garantált bérminimum
    const feorFirstDigit = emp.feorCode ? parseInt(emp.feorCode[0]) : 0;
    if (feorFirstDigit < 2 || feorFirstDigit > 8) continue;

    // Már minimálbér alatti → az a kritikusabb, ne duplikáljuk
    if (emp.baseSalary < taxParams.minimumWage) continue;

    if (emp.baseSalary < taxParams.guaranteedMinimum) {
      anomalies.push({
        id: `guar-min-${emp.employmentId}`,
        ruleId: 'guaranteed_minimum',
        title: 'Garantált bérminimum alatti alapbér',
        description: `${emp.employeeName} alapbére (${emp.baseSalary.toLocaleString('hu-HU')} Ft) a garantált bérminimum (${taxParams.guaranteedMinimum.toLocaleString('hu-HU')} Ft) alatt van. FEOR kód: ${emp.feorCode || 'nincs'}, szakképzettséget igénylő munkakör.`,
        severity: 'critical',
        category: 'Bér',
        affectedEmployees: [emp.employeeName],
        potentialImpact: 'Munkaügyi bírság, járulék utólagos megállapítás, munkáltató kötelezettségszegés',
        recommendation: `Alapbér emelése ${taxParams.guaranteedMinimum.toLocaleString('hu-HU')} Ft-ra vagy magasabbra.`,
        detectedAt: today(),
        resolved: false,
      });
    }
  }
  return anomalies;
};

/**
 * 3. TB járulék eltérés (>2%)
 */
const ruleTbDeviation: AnomalyRule = ({ calculations, taxParams }) => {
  const anomalies: Anomaly[] = [];
  for (const calc of calculations) {
    if (!calc.grossSalary || calc.grossSalary === 0) continue;

    const expectedTb = calc.grossSalary * taxParams.tbRate;
    const actualTb = calc.tbAmount || 0;
    const deviation = Math.abs(actualTb - expectedTb);
    const deviationPct = (deviation / expectedTb) * 100;

    if (deviationPct > 2 && deviation > 500) {
      const direction = actualTb > expectedTb ? 'több' : 'kevesebb';
      anomalies.push({
        id: `tb-dev-${calc.employmentId}`,
        ruleId: 'tb_deviation',
        title: 'TB járulék eltérés',
        description: `${calc.employeeName} TB járuléka ${Math.round(deviation).toLocaleString('hu-HU')} Ft-tal ${direction} mint a bruttó ${(taxParams.tbRate * 100).toFixed(1)}%-a. Eltérés: ${deviationPct.toFixed(1)}%.`,
        severity: 'warning',
        category: 'Járulék',
        affectedEmployees: [calc.employeeName],
        potentialImpact: actualTb > expectedTb
          ? 'Munkavállaló túlfizetése, nettó bér csökkenés'
          : 'Járulékbevallás alulfizetés, NAV utólagos megállapítás',
        recommendation: 'A számfejtés TB sorának manuális ellenőrzése és szükség esetén korrekció.',
        detectedAt: today(),
        resolved: false,
      });
    }
  }
  return anomalies;
};

/**
 * 4. SZJA eltérés (>2%)
 */
const ruleSzjaDeviation: AnomalyRule = ({ calculations, taxParams }) => {
  const anomalies: Anomaly[] = [];
  for (const calc of calculations) {
    if (!calc.szjaBase || calc.szjaBase === 0) continue;

    const expectedSzja = calc.szjaBase * taxParams.szjaRate;
    const actualSzja = calc.szjaAmount || 0;
    const deviation = Math.abs(actualSzja - expectedSzja);
    const deviationPct = (deviation / Math.max(expectedSzja, 1)) * 100;

    // SZJA eltérés jogos lehet kedvezmény miatt — csak akkor jelezzük, ha nincs tax_credits
    const hasCredits = calc.taxCredits && Object.keys(calc.taxCredits).length > 0;
    if (hasCredits) continue; // Kedvezmény alkalmazva, várható az eltérés

    if (deviationPct > 2 && deviation > 500) {
      anomalies.push({
        id: `szja-dev-${calc.employmentId}`,
        ruleId: 'szja_deviation',
        title: 'SZJA előleg eltérés',
        description: `${calc.employeeName} SZJA előlege ${Math.round(deviation).toLocaleString('hu-HU')} Ft-tal eltér az adóalap ${(taxParams.szjaRate * 100)}%-ától. Kedvezmény nem látható.`,
        severity: 'warning',
        category: 'Adó',
        affectedEmployees: [calc.employeeName],
        potentialImpact: 'SZJA különbözet az éves bevallásban',
        recommendation: 'Adóelőleg-nyilatkozat és kedvezmény-érvényesítés ellenőrzése.',
        detectedAt: today(),
        resolved: false,
      });
    }
  }
  return anomalies;
};

/**
 * 5. SZOCHO eltérés (>2%)
 */
const ruleSzochoDeviation: AnomalyRule = ({ calculations, taxParams }) => {
  const anomalies: Anomaly[] = [];
  for (const calc of calculations) {
    if (!calc.grossSalary || calc.grossSalary === 0) continue;

    const expectedSzocho = calc.grossSalary * taxParams.szochoRate;
    const actualSzocho = calc.szochoAmount || 0;
    const deviation = Math.abs(actualSzocho - expectedSzocho);
    const deviationPct = (deviation / Math.max(expectedSzocho, 1)) * 100;

    // SZOCHO kedvezmény jogos lehet — ha nincs szocho_credits, jelezzük
    const hasCredits = calc.szochoCredits && Object.keys(calc.szochoCredits).length > 0;
    if (hasCredits) continue;

    if (deviationPct > 2 && deviation > 500) {
      const direction = actualSzocho > expectedSzocho ? 'több' : 'kevesebb';
      anomalies.push({
        id: `szocho-dev-${calc.employmentId}`,
        ruleId: 'szocho_deviation',
        title: 'SZOCHO eltérés',
        description: `${calc.employeeName} SZOCHO-ja ${Math.round(deviation).toLocaleString('hu-HU')} Ft-tal ${direction} mint a bruttó ${(taxParams.szochoRate * 100)}%-a. Kedvezmény nem alkalmazva.`,
        severity: 'warning',
        category: 'Járulék',
        affectedEmployees: [calc.employeeName],
        potentialImpact: actualSzocho < expectedSzocho
          ? 'SZOCHO kedvezmény nem érvényesítve — többlet közteherkiadás'
          : 'SZOCHO túlfizetés',
        recommendation: 'SZOCHO kedvezmény-jogosultság és érvényesítés ellenőrzése a bérszámfejtő rendszerben.',
        detectedAt: today(),
        resolved: false,
      });
    }
  }
  return anomalies;
};

/**
 * 6. Negatív nettó bér
 */
const ruleNegativeNetSalary: AnomalyRule = ({ calculations }) => {
  const anomalies: Anomaly[] = [];
  for (const calc of calculations) {
    if (calc.netSalary < 0) {
      anomalies.push({
        id: `neg-net-${calc.employmentId}`,
        ruleId: 'negative_net',
        title: 'Negatív nettó bér',
        description: `${calc.employeeName} nettó bére negatív (${calc.netSalary.toLocaleString('hu-HU')} Ft). Ez jellemzően túl nagy levonás vagy téves számfejtés eredménye.`,
        severity: 'critical',
        category: 'Bér',
        affectedEmployees: [calc.employeeName],
        potentialImpact: 'Munkavállaló nem kaphat negatív fizetést — jogi és munkaügyi probléma',
        recommendation: 'Levonások és bérelemek azonnali felülvizsgálata. Letiltás/garnishment összeg ellenőrzése.',
        detectedAt: today(),
        resolved: false,
      });
    }
  }
  return anomalies;
};

/**
 * 7. Hiányzó számfejtés — aktív jogviszony, de nincs calculation
 */
const ruleMissingCalculation: AnomalyRule = ({ employments, calculations }) => {
  const anomalies: Anomaly[] = [];
  const calculatedEmploymentIds = new Set(calculations.map(c => c.employmentId));

  for (const emp of employments) {
    if (emp.status !== 'active' || emp.endDate) continue;
    if (!emp.isInsured) continue;

    if (!calculatedEmploymentIds.has(emp.employmentId)) {
      anomalies.push({
        id: `missing-calc-${emp.employmentId}`,
        ruleId: 'missing_calculation',
        title: 'Hiányzó számfejtés',
        description: `${emp.employeeName} aktív, biztosított jogviszonya van, de az aktuális ciklusban nem készült számfejtés.`,
        severity: 'info',
        category: 'Számfejtés',
        affectedEmployees: [emp.employeeName],
        potentialImpact: 'Késedelmes bérfizetés, járulékbevallás hiánya',
        recommendation: 'Számfejtés elindítása vagy jogviszony állapotának felülvizsgálata.',
        detectedAt: today(),
        resolved: false,
      });
    }
  }
  return anomalies;
};

// ═══════════════════════════════════════════════════════════════
// MOTOR
// ═══════════════════════════════════════════════════════════════

const ALL_RULES: AnomalyRule[] = [
  ruleMinimumWage,
  ruleGuaranteedMinimum,
  ruleTbDeviation,
  ruleSzjaDeviation,
  ruleSzochoDeviation,
  ruleNegativeNetSalary,
  ruleMissingCalculation,
];

/**
 * Run all anomaly rules against the provided data.
 * Returns a sorted list: critical first, then warning, then info.
 */
export function runAnomalyRules(input: AnomalyInput): Anomaly[] {
  const results: Anomaly[] = [];
  for (const rule of ALL_RULES) {
    try {
      results.push(...rule(input));
    } catch (e) {
      console.warn('[AnomalyEngine] Rule failed:', e);
    }
  }

  // Sort: critical → warning → info
  const severityOrder: Record<AnomalySeverity, number> = { critical: 0, warning: 1, info: 2 };
  results.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

  return results;
}
