/**
 * RLB-60 Főkönyvi Kivonat — Adatmodell, Partner-analitika és Mérlegegyezőség-számítás
 * 
 * A tests/docs/eb0148/Főkönyvi kivonat-alap. bankoknak is jó..pdf és
 * a tests/docs/eb0148/Főkönyvi kivonat-bővített-vevő-szállító- pl. könyvvizsgálónak.pdf
 * alapján készített hivatalos adatmodell és aggregációs motor.
 * 
 * Támogatott módok:
 *  - 'basic': Alap kivonat (szintetikus és analitikus főkönyvi számok, partnerek nélkül, bankoknak)
 *  - 'extended': Bővített kivonat (a 311, 312, 317 vevők és a 4541, 4542 szállítók alatt
 *               tételes partner-analitikával, könyvvizsgálóknak)
 */

export interface RlbAccountInput {
  id: string; // Főkönyvi szám (pl. "1", "13", "131", "1311", "311", "4541")
  name: string; // Megnevezés
  balance?: number;
  debitTurnover?: number;
  creditTurnover?: number;
  hasAccountChildren?: boolean;
  hasChildren?: boolean;
  isItem?: boolean;
  depth?: number;
}

export interface RlbPartnerItemInput {
  glAccountNumber: string; // pl. "311", "312", "317", "4541", "4542" vagy "454"
  partnerName: string;
  partnerTaxNumber?: string | null;
  partnerCode?: string | null;
  debitAmount: number;
  creditAmount: number;
}

export type RlbRowLevel = 'class' | 'group' | 'subgroup' | 'leaf' | 'partner';

export interface RlbGlRow {
  accountNumber: string; // pl. "1", "13", "131", "1311" vagy partner esetén "3110000014"
  accountName: string;   // pl. "BEFEKTETETT ESZKÖZÖK" vagy "PMEX KFT"
  level: RlbRowLevel;
  depth: number;
  turnoverDebit: number;
  turnoverCredit: number;
  balanceDebit: number;
  balanceCredit: number;
  isPartner?: boolean;
}

export interface RlbTotals {
  turnoverDebit: number;
  turnoverCredit: number;
  balanceDebit: number;
  balanceCredit: number;
}

export interface RlbClassSummary {
  classes1to4: RlbTotals;
  classes5to9: RlbTotals;
  grandTotal: {
    turnoverDebit: number;
    turnoverCredit: number;
    isBalanced: boolean;
    difference: number;
  };
}

export interface RlbGlData {
  companyName: string;
  taxNumber?: string;
  year?: string;
  dateFrom?: string;
  dateTo?: string;
  formattedPeriod: string;
  mode: 'basic' | 'extended';
  rows: RlbGlRow[];
  totals: RlbTotals;
  classSummary: RlbClassSummary;
}

export interface RlbBuildOptions {
  companyName?: string;
  taxNumber?: string;
  dateFrom?: string;
  dateTo?: string;
  excludeZeroRows?: boolean;
  mode?: 'basic' | 'extended';
  partnerItems?: RlbPartnerItemInput[];
}

// Standard Hungarian Chart of Accounts class names fallback
export const HUNGARIAN_GL_CLASSES: Record<string, string> = {
  '1': 'BEFEKTETETT ESZKÖZÖK',
  '2': 'KÉSZLETEK',
  '3': 'KÖVETELÉSEK, PÉNZÜGYI ESZKÖZÖK ÉS AKTÍV IDŐBELI',
  '4': 'FORRÁSOK',
  '5': 'KÖLTSÉGNEMEK',
  '6': 'ÉRTÉKESÍTÉS KÖZVETLEN KÖLTSÉGEI',
  '7': 'ÉRTÉKESÍTÉS KÖZVETETT KÖLTSÉGEI',
  '8': 'ÉRTÉKESÍTÉS ELSZÁMOLT ÖNKÖLTSÉGE ÉS RÁFORDÍTÁSOK',
  '9': 'ÉRTÉKESÍTÉS ÁRBEVÉTELE ÉS BEVÉTELEK',
};

// Standard Hungarian Chart of Accounts 2-digit groups fallback
export const HUNGARIAN_GL_GROUPS: Record<string, string> = {
  '11': 'IMMATERIÁLIS JAVAK',
  '12': 'INGATLANOK ÉS KAPCSOLÓDÓ VAGYONI ÉRTÉKŰ JOGOK',
  '13': 'MŰSZAKI GÉPEK, BERENDEZÉSEK, JÁRMŰVEK',
  '14': 'EGYÉB BERENDEZÉSEK, FELSZERELÉSEK, GÉPEK, JÁRMŰVEK',
  '16': 'BERUHÁZÁSOK, FELÚJÍTÁSOK',
  '21': 'ANYAGOK',
  '26': 'KERESKEDELMI ÁRUK',
  '31': 'KÖVETELÉSEK ÁRUSZÁLLÍTÁSBÓL ÉS SZOLGÁLTATÁSBÓL',
  '35': 'ADOTT ELŐLEGEK',
  '36': 'EGYÉB KÖVETELÉSEK',
  '38': 'PÉNZESZKÖZÖK',
  '41': 'SAJÁT TŐKE',
  '43': 'CÉLTARTALÉKOK',
  '44': 'HOSSZÚ LEJÁRATÚ KÖTELEZETTSÉGEK',
  '45': 'RÖVID LEJÁRATÚ KÖTELEZETTSÉGEK',
  '46': 'ADÓK ÉS ELSZÁMOLÁSOK',
  '47': 'EGYÉB KÖTELEZETTSÉGEK',
  '48': 'PASSZÍV IDŐBELI ELHATÁROLÁSOK',
  '49': 'ÉVI MÉRLEGSZÁMLÁK',
  '51': 'ANYAGKÖLTSÉGEK',
  '52': 'IGÉNYBE VETT SZOLGÁLTATÁSOK KÖLTSÉGEI',
  '53': 'EGYÉB SZOLGÁLTATÁSOK KÖLTSÉGEI',
  '54': 'BÉRKÖLTSÉG',
  '55': 'SZEMÉLYI JELLEGŰ EGYÉB KIFIZETÉSEK',
  '56': 'BÉRJÁRULÉKOK',
  '57': 'ÉRTÉKCSÖKKENÉSI LEÍRÁS',
  '81': 'ANYAGJELLEGŰ RÁFORDÍTÁSOK',
  '86': 'EGYÉB RÁFORDÍTÁSOK',
  '87': 'PÉNZÜGYI MŰVELETEK RÁFORDÍTÁSAI',
  '89': 'NYERESÉGET TERHELŐ ADÓK',
  '91': 'BELFÖLDI ÉRTÉKESÍTÉS ÁRBEVÉTELE',
  '93': 'EXPORTÉRTÉKESÍTÉS ÁRBEVÉTELE',
  '96': 'EGYÉB BEVÉTELEK',
  '97': 'PÉNZÜGYI MŰVELETEK BEVÉTELEI',
};

/**
 * Normalizes account numbers (strips dots, spaces, special chars)
 */
export function cleanAccountNumber(raw: string | number): string {
  if (raw === null || raw === undefined) return '';
  return String(raw).trim().replace(/[\.\s\-\\/]/g, '');
}

/**
 * Determines the hierarchy level of a Hungarian account code
 */
export function getAccountLevel(accNum: string): RlbRowLevel {
  const len = accNum.length;
  if (len <= 1) return 'class';
  if (len === 2) return 'group';
  if (len === 3) return 'subgroup';
  return 'leaf';
}

/**
 * Formats dates for the RLB PDF/Excel header (e.g. "Időszak: 2025.01.01-2025.12.31")
 */
export function formatRlbPeriod(dateFrom?: string, dateTo?: string): string {
  if (!dateFrom && !dateTo) return '';
  const fmt = (d?: string) => (d ? d.substring(0, 10).replace(/-/g, '.') : '');
  if (dateFrom && dateTo) {
    return `Időszak: ${fmt(dateFrom)}-${fmt(dateTo)}`;
  }
  return `Időszak: ${fmt(dateFrom || dateTo)}`;
}

/**
 * Natural hierarchical sort for GL accounts
 */
export function compareRlbAccounts(a: string, b: string): number {
  if (a === b) return 0;
  if (b.startsWith(a)) return -1;
  if (a.startsWith(b)) return 1;

  return a.localeCompare(b);
}

/**
 * Calculates net balance (Debit or Credit) based on Hungarian accounting conventions:
 * - Assets (1, 2, 3) and Costs (5, 8): Debit = TurnoverDebit - TurnoverCredit
 * - Liabilities/Equity (4) and Revenues (9): Credit = TurnoverCredit - TurnoverDebit
 */
export function calculateAccountBalance(
  accNumber: string,
  turnoverDebit: number,
  turnoverCredit: number
): { balanceDebit: number; balanceCredit: number } {
  const firstDigit = accNumber[0] || '1';
  const isCreditNormal = firstDigit === '4' || firstDigit === '9';

  if (isCreditNormal) {
    const net = turnoverCredit - turnoverDebit;
    if (net >= 0) {
      return { balanceDebit: 0, balanceCredit: net };
    } else {
      return { balanceDebit: Math.abs(net), balanceCredit: 0 };
    }
  } else {
    const net = turnoverDebit - turnoverCredit;
    if (net >= 0) {
      return { balanceDebit: net, balanceCredit: 0 };
    } else {
      return { balanceDebit: 0, balanceCredit: Math.abs(net) };
    }
  }
}

/**
 * Builds the complete RLB General Ledger report structure from accounts input.
 * Supports 'basic' (without partner lines) and 'extended' (with partner breakdown).
 */
export function buildRlbGlData(
  inputAccounts: RlbAccountInput[],
  options: RlbBuildOptions = {}
): RlbGlData {
  const excludeZero = options.excludeZeroRows ?? false;
  const mode = options.mode || 'basic';
  const companyName = (options.companyName || 'Vállalkozás').trim();
  const taxNumber = options.taxNumber?.trim();
  const dateFrom = options.dateFrom;
  const dateTo = options.dateTo;
  const year = dateFrom ? dateFrom.substring(0, 4) : new Date().getFullYear().toString();
  const formattedPeriod = formatRlbPeriod(dateFrom, dateTo);

  // 1. Filter out individual transaction items, keeping only GL accounts
  const rawAccounts = (inputAccounts || []).filter(a => !a.isItem && a.id !== 'UNCLASSIFIED');

  // 2. Identify known accounts and their leaf vs parent status
  const accountMap = new Map<string, RlbAccountInput>();
  rawAccounts.forEach(acc => {
    const cleanNum = cleanAccountNumber(acc.id);
    if (cleanNum) {
      accountMap.set(cleanNum, acc);
    }
  });

  // Auto-register missing 1-digit classes and 2-digit groups from account numbers
  Array.from(accountMap.keys()).forEach(accNum => {
    if (accNum.length >= 2) {
      const groupNum = accNum.substring(0, 2);
      if (!accountMap.has(groupNum)) {
        accountMap.set(groupNum, {
          id: groupNum,
          name: HUNGARIAN_GL_GROUPS[groupNum] || `${groupNum}. SZÁMLACSOPORT`,
          hasAccountChildren: true,
        });
      }
    }
    if (accNum.length >= 1) {
      const classNum = accNum[0];
      if (!accountMap.has(classNum)) {
        accountMap.set(classNum, {
          id: classNum,
          name: HUNGARIAN_GL_CLASSES[classNum] || `${classNum}. SZÁMLAOSZTÁLY`,
          hasAccountChildren: true,
        });
      }
    }
  });

  interface AccountStats {
    accountNumber: string;
    accountName: string;
    turnoverDebit: number;
    turnoverCredit: number;
    isLeaf: boolean;
  }

  const allNumbers = Array.from(accountMap.keys());
  const statsMap = new Map<string, AccountStats>();

  allNumbers.forEach(accNum => {
    const acc = accountMap.get(accNum)!;
    const hasChild = allNumbers.some(other => other !== accNum && other.startsWith(accNum));
    const isLeaf = !hasChild;

    let tDebit = 0;
    let tCredit = 0;

    if (acc.debitTurnover !== undefined && acc.creditTurnover !== undefined) {
      tDebit = Math.round(acc.debitTurnover || 0);
      tCredit = Math.round(acc.creditTurnover || 0);
    } else {
      const bal = Math.round(acc.balance || 0);
      if (bal > 0) tDebit = bal;
      if (bal < 0) tCredit = Math.abs(bal);
    }

    statsMap.set(accNum, {
      accountNumber: accNum,
      accountName: acc.name,
      turnoverDebit: tDebit,
      turnoverCredit: tCredit,
      isLeaf,
    });
  });

  // Roll-up values from leaves to parent levels (groups and classes)
  const rolledUpDebit = new Map<string, number>();
  const rolledUpCredit = new Map<string, number>();

  // Ensure all 1-digit classes are initialized
  const detectedClasses = new Set<string>();
  allNumbers.forEach(num => {
    const firstDigit = num[0];
    if (firstDigit >= '1' && firstDigit <= '9') {
      detectedClasses.add(firstDigit);
    }
  });

  detectedClasses.forEach(cls => {
    if (!accountMap.has(cls)) {
      accountMap.set(cls, {
        id: cls,
        name: HUNGARIAN_GL_CLASSES[cls] || `${cls}. SZÁMLAOSZTÁLY`,
        hasAccountChildren: true,
      });
      statsMap.set(cls, {
        accountNumber: cls,
        accountName: HUNGARIAN_GL_CLASSES[cls] || `${cls}. SZÁMLAOSZTÁLY`,
        turnoverDebit: 0,
        turnoverCredit: 0,
        isLeaf: false,
      });
    }
  });

  const finalNumbers = Array.from(accountMap.keys());

  // Aggregate leaf values to all matching prefixes
  finalNumbers.forEach(prefix => {
    let sumD = 0;
    let sumC = 0;

    statsMap.forEach((stats, accNum) => {
      if (stats.isLeaf && accNum.startsWith(prefix)) {
        sumD += stats.turnoverDebit;
        sumC += stats.turnoverCredit;
      }
    });

    // If no leaves are found under this prefix, check direct turnovers
    const directStats = statsMap.get(prefix);
    if (sumD === 0 && sumC === 0 && directStats && !directStats.isLeaf) {
      sumD = directStats.turnoverDebit;
      sumC = directStats.turnoverCredit;
    }

    rolledUpDebit.set(prefix, sumD);
    rolledUpCredit.set(prefix, sumC);
  });

  // 4. Partner-level aggregation for extended mode
  // Maps target GL account (e.g. "311", "312", "317", "4541", "4542") to list of aggregated partners
  interface PartnerAggregation {
    partnerName: string;
    partnerTaxNumber?: string | null;
    debitTurnover: number;
    creditTurnover: number;
    balanceDebit: number;
    balanceCredit: number;
    partnerAccountNumber: string;
  }

  const partnerMapByGl = new Map<string, PartnerAggregation[]>();

  if (mode === 'extended' && options.partnerItems && options.partnerItems.length > 0) {
    // Group partner items by GL account and partner name
    const tempGroup = new Map<string, Map<string, { debit: number; credit: number; taxNumber?: string | null }>>();

    options.partnerItems.forEach(item => {
      const gl = cleanAccountNumber(item.glAccountNumber);
      const partner = (item.partnerName || 'Ismeretlen partner').trim();
      if (!gl || !partner) return;

      if (!tempGroup.has(gl)) {
        tempGroup.set(gl, new Map());
      }
      const pMap = tempGroup.get(gl)!;
      const existing = pMap.get(partner) || { debit: 0, credit: 0, taxNumber: item.partnerTaxNumber };
      existing.debit += Number(item.debitAmount) || 0;
      existing.credit += Number(item.creditAmount) || 0;
      if (!existing.taxNumber && item.partnerTaxNumber) {
        existing.taxNumber = item.partnerTaxNumber;
      }
      pMap.set(partner, existing);
    });

    // Assign sequential 7-digit RLB partner numbers (e.g. 3110000014, 45410000011)
    tempGroup.forEach((pMap, gl) => {
      const sortedPartners = Array.from(pMap.entries()).sort((a, b) => a[0].localeCompare(b[0], 'hu'));
      const list: PartnerAggregation[] = [];

      sortedPartners.forEach(([name, data], idx) => {
        const seq = String(idx + 1).padStart(7, '0');
        const partnerAccNum = `${gl}${seq}`;
        const roundD = Math.round(data.debit);
        const roundC = Math.round(data.credit);
        const bal = calculateAccountBalance(gl, roundD, roundC);

        list.push({
          partnerName: name,
          partnerTaxNumber: data.taxNumber,
          debitTurnover: roundD,
          creditTurnover: roundC,
          balanceDebit: bal.balanceDebit,
          balanceCredit: bal.balanceCredit,
          partnerAccountNumber: partnerAccNum,
        });
      });

      partnerMapByGl.set(gl, list);
    });
  }

  // 5. Build structured rows in hierarchical order
  const sortedNumbers = finalNumbers.sort(compareRlbAccounts);
  const rows: RlbGlRow[] = [];

  sortedNumbers.forEach(accNum => {
    const isLeaf = statsMap.get(accNum)?.isLeaf ?? false;
    const level = getAccountLevel(accNum);

    const tD = isLeaf ? (statsMap.get(accNum)?.turnoverDebit || 0) : (rolledUpDebit.get(accNum) || 0);
    const tC = isLeaf ? (statsMap.get(accNum)?.turnoverCredit || 0) : (rolledUpCredit.get(accNum) || 0);

    const bal = calculateAccountBalance(accNum, tD, tC);

    // If excludeZeroRows is active, skip accounts with 0 turnover and 0 balance
    if (excludeZero && tD === 0 && tC === 0 && bal.balanceDebit === 0 && bal.balanceCredit === 0) {
      return;
    }

    const accName = statsMap.get(accNum)?.accountName || accountMap.get(accNum)?.name || `${accNum}. számla`;

    rows.push({
      accountNumber: accNum,
      accountName: accName,
      level,
      depth: accNum.length,
      turnoverDebit: tD,
      turnoverCredit: tC,
      balanceDebit: bal.balanceDebit,
      balanceCredit: bal.balanceCredit,
      isPartner: false,
    });

    // In extended mode, if this account has partner-level breakdown, inject partner rows directly under it
    if (mode === 'extended') {
      const partners = partnerMapByGl.get(accNum);
      if (partners && partners.length > 0) {
        partners.forEach(p => {
          if (excludeZero && p.debitTurnover === 0 && p.creditTurnover === 0 && p.balanceDebit === 0 && p.balanceCredit === 0) {
            return;
          }
          rows.push({
            accountNumber: p.partnerAccountNumber,
            accountName: p.partnerName,
            level: 'partner',
            depth: p.partnerAccountNumber.length,
            turnoverDebit: p.debitTurnover,
            turnoverCredit: p.creditTurnover,
            balanceDebit: p.balanceDebit,
            balanceCredit: p.balanceCredit,
            isPartner: true,
          });
        });
      }
    }
  });

  // 6. Calculate statutory totals and 1-4 vs 5-9 class reconciliation
  let t1to4_D = 0;
  let t1to4_C = 0;
  let t5to9_D = 0;
  let t5to9_C = 0;

  detectedClasses.forEach(cls => {
    const num = parseInt(cls, 10);
    const d = rolledUpDebit.get(cls) || 0;
    const c = rolledUpCredit.get(cls) || 0;

    if (num >= 1 && num <= 4) {
      t1to4_D += d;
      t1to4_C += c;
    } else if (num >= 5 && num <= 9) {
      t5to9_D += d;
      t5to9_C += c;
    }
  });

  // Net balances for 1-4 (Balance Sheet) and 5-9 (P&L)
  // 1-4: Balance = t1to4_D - t1to4_C (Assets - Liabilities/Equity)
  const net1to4 = t1to4_D - t1to4_C;
  const bal1to4_D = net1to4 > 0 ? net1to4 : 0;
  const bal1to4_C = net1to4 < 0 ? Math.abs(net1to4) : 0;

  // 5-9: Balance = t5to9_C - t5to9_D (Revenues - Expenses)
  const net5to9 = t5to9_D - t5to9_C;
  const bal5to9_D = net5to9 > 0 ? net5to9 : 0;
  const bal5to9_C = net5to9 < 0 ? Math.abs(net5to9) : 0;

  const grandTurnoverDebit = t1to4_D + t5to9_D;
  const grandTurnoverCredit = t1to4_C + t5to9_C;
  const diff = Math.abs(grandTurnoverDebit - grandTurnoverCredit);
  const isBalanced = diff < 1; // within 1 Ft rounding tolerance

  const classSummary: RlbClassSummary = {
    classes1to4: {
      turnoverDebit: t1to4_D,
      turnoverCredit: t1to4_C,
      balanceDebit: bal1to4_D,
      balanceCredit: bal1to4_C,
    },
    classes5to9: {
      turnoverDebit: t5to9_D,
      turnoverCredit: t5to9_C,
      balanceDebit: bal5to9_D,
      balanceCredit: bal5to9_C,
    },
    grandTotal: {
      turnoverDebit: grandTurnoverDebit,
      turnoverCredit: grandTurnoverCredit,
      isBalanced,
      difference: diff,
    },
  };

  const totals: RlbTotals = {
    turnoverDebit: grandTurnoverDebit,
    turnoverCredit: grandTurnoverCredit,
    balanceDebit: bal1to4_D + bal5to9_D,
    balanceCredit: bal1to4_C + bal5to9_C,
  };

  return {
    companyName,
    taxNumber,
    year,
    dateFrom,
    dateTo,
    formattedPeriod,
    mode,
    rows,
    totals,
    classSummary,
  };
}
