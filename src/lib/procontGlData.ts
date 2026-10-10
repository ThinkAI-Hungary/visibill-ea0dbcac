/**
 * PROCONT Főkönyvi Kivonat — Adatmodell, Aggregáció és Egyezőség-számítás
 * 
 * A tests/docs/eb0148/PRCNT FŐKÖNYV.pdf mintája alapján előállítja
 * a hierarchikus számlatükör sorokat (számlaosztály, csoport, szintetikus, analitikus),
 * a 4-oszlopos forgalom (T/K) és egyenleg (T/K) értékeket, valamint a kötelező
 * "EGYEZŐSÉG SZÁMÍTÁS" (1-4 vs 5-9 számlaosztályok) blokkot.
 */

export interface ProcontAccountInput {
  id: string; // Főkönyvi szám (pl. "1", "16", "1610")
  name: string; // Megnevezés
  balance?: number;
  debitTurnover?: number;
  creditTurnover?: number;
  hasAccountChildren?: boolean;
  hasChildren?: boolean;
  isItem?: boolean;
  depth?: number;
}

export type ProcontRowLevel = 'class' | 'group' | 'subgroup' | 'leaf';

export interface ProcontGlRow {
  accountNumber: string;
  accountName: string;
  level: ProcontRowLevel;
  depth: number;
  turnoverDebit: number;
  turnoverCredit: number;
  balanceDebit: number;
  balanceCredit: number;
}

export interface ProcontReconciliationSide {
  turnoverDebit: number;
  turnoverCredit: number;
  balanceDebit: number;
  balanceCredit: number;
}

export interface ProcontReconciliation {
  classes1to4: ProcontReconciliationSide;
  classes5to9: ProcontReconciliationSide;
  netDiff: number; // |Net(1-4) + Net(5-9)|
  isBalanced: boolean;
}

export interface ProcontGlData {
  companyName: string;
  dateFrom?: string;
  dateTo?: string;
  formattedPeriod: string;
  rows: ProcontGlRow[];
  totals: {
    turnoverDebit: number;
    turnoverCredit: number;
    balanceDebit: number;
    balanceCredit: number;
  };
  reconciliation: ProcontReconciliation;
}

export interface ProcontBuildOptions {
  companyName?: string;
  dateFrom?: string;
  dateTo?: string;
  excludeZeroRows?: boolean;
}

// Standard Hungarian Chart of Accounts class names fallback
export const HUNGARIAN_GL_CLASSES: Record<string, string> = {
  '1': 'Befektetett eszközök',
  '2': 'Készletek',
  '3': 'Követelések, pénzügyi eszközök',
  '4': 'Források',
  '5': 'Költségnemek',
  '6': 'Értékesítés közvetlen költségei',
  '7': 'Értékesítés közvetett költségei',
  '8': 'Értékesítés elszámolt önkölts. és ráf.',
  '9': 'Értékesítés árbevétele és bevételek',
};

// Standard Hungarian Chart of Accounts 2-digit groups fallback
export const HUNGARIAN_GL_GROUPS: Record<string, string> = {
  '11': 'Immateriális javak',
  '12': 'Ingatlanok és kapcsolódó vagyoni értékű jogok',
  '13': 'Műszaki berendezések, gépek, járművek',
  '14': 'Egyéb berendezések, felszerelések, járművek',
  '16': 'Beruházások, felújítások',
  '21': 'Anyagok',
  '26': 'Áruk',
  '31': 'Követelések áruszállításból és szolg.',
  '35': 'Adott előlegek',
  '36': 'Egyéb követelések',
  '38': 'Pénzeszközök',
  '41': 'Saját tőke',
  '43': 'Céltartalékok',
  '44': 'Hátrasorolt kötelezettségek',
  '45': 'HITELEK',
  '46': 'ADÓK',
  '47': 'EGYÉB KÖTELEZETTSÉGEK',
  '49': 'Évi mérlegszámlák',
  '51': 'Anyagköltség',
  '52': 'Igénybe vett szolgáltatások költségei',
  '53': 'Egyéb szolgáltatások költségei',
  '54': 'Bérköltség',
  '55': 'Személyi jellegű egyéb kifizetések',
  '56': 'Bérjárulékok',
  '81': 'Anyagjellegű ráfordítások',
  '86': 'Egyéb ráfordítások',
  '87': 'Pénzügyi műveletek ráfordításai',
  '91': 'Értékesítés nettó árbevétele',
  '96': 'Egyéb bevételek',
  '97': 'Pénzügyi műveletek bevételei',
};

/**
 * Normalizes account numbers (strips dots, trims whitespace)
 */
export function cleanAccountNumber(raw: string | number): string {
  if (raw === null || raw === undefined) return '';
  return String(raw).trim().replace(/\./g, '');
}

/**
 * Determines the hierarchy level of a Hungarian account code
 */
export function getAccountLevel(accNum: string): ProcontRowLevel {
  const len = accNum.length;
  if (len <= 1) return 'class';
  if (len === 2) return 'group';
  if (len === 3) return 'subgroup';
  return 'leaf';
}

/**
 * Formats dates for the Procont PDF/Excel header (e.g. "2026.01.01. - 2026.09.30.")
 */
export function formatProcontPeriod(dateFrom?: string, dateTo?: string): string {
  if (!dateFrom && !dateTo) return '';
  const fmt = (d?: string) => (d ? d.substring(0, 10).replace(/-/g, '.') + '.' : '');
  if (dateFrom && dateTo) {
    return `${fmt(dateFrom)} - ${fmt(dateTo)}`;
  }
  return fmt(dateFrom || dateTo);
}

/**
 * Builds the complete PROCONT General Ledger report structure from accounts input.
 */
export function buildProcontGlData(
  inputAccounts: ProcontAccountInput[],
  options: ProcontBuildOptions = {}
): ProcontGlData {
  const excludeZero = options.excludeZeroRows ?? false;
  const companyName = (options.companyName || 'Vállalkozás').trim();
  const formattedPeriod = formatProcontPeriod(options.dateFrom, options.dateTo);

  // 1. Filter out individual transactions (isItem), keeping only GL accounts
  const rawAccounts = (inputAccounts || []).filter(a => !a.isItem && a.id !== 'UNCLASSIFIED');

  // 2. Identify known accounts and their leaf vs parent status
  const accountMap = new Map<string, ProcontAccountInput>();
  rawAccounts.forEach(acc => {
    const cleanNum = cleanAccountNumber(acc.id);
    if (cleanNum) {
      accountMap.set(cleanNum, acc);
    }
  });

  // Auto-register missing 1-digit classes and 2-digit groups from leaf account numbers
  Array.from(accountMap.keys()).forEach(accNum => {
    if (accNum.length >= 2) {
      const groupNum = accNum.substring(0, 2);
      if (!accountMap.has(groupNum)) {
        accountMap.set(groupNum, {
          id: groupNum,
          name: HUNGARIAN_GL_GROUPS[groupNum] || `${groupNum}. számlacsoport`,
          hasAccountChildren: true,
        });
      }
    }
    if (accNum.length >= 1) {
      const classNum = accNum[0];
      if (!accountMap.has(classNum)) {
        accountMap.set(classNum, {
          id: classNum,
          name: HUNGARIAN_GL_CLASSES[classNum] || `${classNum}. számlaosztály`,
          hasAccountChildren: true,
        });
      }
    }
  });

  // Collect leaf accounts (accounts that have no children in the account map)
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

  // 3. Roll-up values from leaves to parent levels (groups and classes)
  // To ensure 100% mathematical integrity (as in Procont), a parent's turnover
  // is the exact sum of all its leaf descendants' turnovers.
  const rolledUpDebit = new Map<string, number>();
  const rolledUpCredit = new Map<string, number>();

  // Ensure all 1-digit classes present in data are initialized
  const detectedClasses = new Set<string>();
  allNumbers.forEach(num => {
    const firstDigit = num[0];
    if (firstDigit >= '1' && firstDigit <= '9') {
      detectedClasses.add(firstDigit);
    }
  });

  // Also include parents that might not be in input
  detectedClasses.forEach(cls => {
    if (!accountMap.has(cls)) {
      accountMap.set(cls, {
        id: cls,
        name: HUNGARIAN_GL_CLASSES[cls] || `${cls}. számlaosztály`,
        hasAccountChildren: true,
      });
      statsMap.set(cls, {
        accountNumber: cls,
        accountName: HUNGARIAN_GL_CLASSES[cls] || `${cls}. számlaosztály`,
        turnoverDebit: 0,
        turnoverCredit: 0,
        isLeaf: false,
      });
    }
  });

  const finalNumbers = Array.from(accountMap.keys());

  // Aggregate leaf values to all matching prefixes
  finalNumbers.forEach(parentNum => {
    let sumDebit = 0;
    let sumCredit = 0;

    finalNumbers.forEach(childNum => {
      const childStat = statsMap.get(childNum);
      if (childStat && childStat.isLeaf && childNum.startsWith(parentNum)) {
        sumDebit += childStat.turnoverDebit;
        sumCredit += childStat.turnoverCredit;
      }
    });

    rolledUpDebit.set(parentNum, sumDebit);
    rolledUpCredit.set(parentNum, sumCredit);
  });

  // 4. Build ProcontGlRows with Net balances
  const allRows: ProcontGlRow[] = [];

  finalNumbers.forEach(num => {
    const stat = statsMap.get(num)!;
    const tDebit = stat.isLeaf ? stat.turnoverDebit : (rolledUpDebit.get(num) || 0);
    const tCredit = stat.isLeaf ? stat.turnoverCredit : (rolledUpCredit.get(num) || 0);

    const net = tDebit - tCredit;
    const bDebit = net >= 0 ? net : 0;
    const bCredit = net < 0 ? Math.abs(net) : 0;

    const level = getAccountLevel(num);
    const depth = num.length <= 1 ? 0 : num.length === 2 ? 1 : num.length === 3 ? 2 : 3;

    allRows.push({
      accountNumber: num,
      accountName: stat.accountName,
      level,
      depth,
      turnoverDebit: tDebit,
      turnoverCredit: tCredit,
      balanceDebit: bDebit,
      balanceCredit: bCredit,
    });
  });

  // 5. Filter zero rows if requested
  let filteredRows = allRows;
  if (excludeZero) {
    filteredRows = allRows.filter(r => {
      return (
        r.turnoverDebit > 0 ||
        r.turnoverCredit > 0 ||
        r.balanceDebit > 0 ||
        r.balanceCredit > 0
      );
    });
  }

  // 6. Natural account sorting (1, 16, 161, 1610, 3, 31, 3110, ...)
  filteredRows.sort((a, b) => {
    return a.accountNumber.localeCompare(b.accountNumber, undefined, { numeric: true });
  });

  // 7. Calculate Grand Totals (Sum of 1-digit classes)
  const classRows = allRows.filter(r => r.level === 'class');
  
  const totalTurnoverDebit = classRows.reduce((sum, r) => sum + r.turnoverDebit, 0);
  const totalTurnoverCredit = classRows.reduce((sum, r) => sum + r.turnoverCredit, 0);
  const totalBalanceDebit = classRows.reduce((sum, r) => sum + r.balanceDebit, 0);
  const totalBalanceCredit = classRows.reduce((sum, r) => sum + r.balanceCredit, 0);

  // 8. Calculate EGYEZŐSÉG SZÁMÍTÁS (Classes 1-4 vs Classes 5-9)
  const classes1to4Rows = classRows.filter(r => r.accountNumber >= '1' && r.accountNumber <= '4');
  const classes5to9Rows = classRows.filter(r => r.accountNumber >= '5' && r.accountNumber <= '9');

  const c14Debit = classes1to4Rows.reduce((sum, r) => sum + r.turnoverDebit, 0);
  const c14Credit = classes1to4Rows.reduce((sum, r) => sum + r.turnoverCredit, 0);
  const c14Net = c14Debit - c14Credit;
  const c14BalanceDebit = c14Net >= 0 ? c14Net : 0;
  const c14BalanceCredit = c14Net < 0 ? Math.abs(c14Net) : 0;

  const c59Debit = classes5to9Rows.reduce((sum, r) => sum + r.turnoverDebit, 0);
  const c59Credit = classes5to9Rows.reduce((sum, r) => sum + r.turnoverCredit, 0);
  const c59Net = c59Debit - c59Credit;
  const c59BalanceDebit = c59Net >= 0 ? c59Net : 0;
  const c59BalanceCredit = c59Net < 0 ? Math.abs(c59Net) : 0;

  // In balanced double-entry bookkeeping: Net(1-4) + Net(5-9) = 0
  const netDiff = Math.abs(c14Net + c59Net);
  const isBalanced = netDiff === 0;

  return {
    companyName,
    dateFrom: options.dateFrom,
    dateTo: options.dateTo,
    formattedPeriod,
    rows: filteredRows,
    totals: {
      turnoverDebit: totalTurnoverDebit,
      turnoverCredit: totalTurnoverCredit,
      balanceDebit: totalBalanceDebit,
      balanceCredit: totalBalanceCredit,
    },
    reconciliation: {
      classes1to4: {
        turnoverDebit: c14Debit,
        turnoverCredit: c14Credit,
        balanceDebit: c14BalanceDebit,
        balanceCredit: c14BalanceCredit,
      },
      classes5to9: {
        turnoverDebit: c59Debit,
        turnoverCredit: c59Credit,
        balanceDebit: c59BalanceDebit,
        balanceCredit: c59BalanceCredit,
      },
      netDiff,
      isBalanced,
    },
  };
}
