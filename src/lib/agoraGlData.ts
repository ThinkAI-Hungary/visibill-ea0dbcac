/**
 * AGORA (Novitax) Főkönyvi Kivonat — Adatmodell, Aggregáció és Mérlegegyezőség
 * 
 * A tests/docs/eb0148/FokonyviKivonat.pdf mintája alapján előállítja
 * a kétszintes táblázatfejlécű, 6-oszlopos (Szla, Megnevezés, Forgalom T/K, Egyenleg T/K)
 * hierarchikus kimutatást és a hivatalos 3-soros záró egyezőség-számítást
 * (1-4 számlaosztályok, 5-9 számlaosztályok, 1-9 számlaosztályok összesen).
 */

import {
  HUNGARIAN_GL_CLASSES,
  HUNGARIAN_GL_GROUPS,
  cleanAccountNumber,
  compareGlAccountNumbers,
  type ProcontAccountInput,
} from './procontGlData';

export type AgoraRowLevel = 'class' | 'group' | 'subgroup' | 'leaf';

export interface AgoraGlRow {
  accountNumber: string;
  accountName: string;
  level: AgoraRowLevel;
  depth: number;
  turnoverDebit: number;
  turnoverCredit: number;
  balanceDebit: number;
  balanceCredit: number;
}

export interface AgoraSummaryRow {
  label: string;
  turnoverDebit: number;
  turnoverCredit: number;
  balanceDebit: number;
  balanceCredit: number;
}

export interface AgoraReconciliation {
  classes1to4: AgoraSummaryRow;
  classes5to9: AgoraSummaryRow;
  grandTotal: AgoraSummaryRow;
  isBalanced: boolean;
}

export interface AgoraGlData {
  companyName: string;
  taxNumber?: string;
  listId: string;
  year: string;
  currency: string;
  periodText: string;
  exportDate: string;
  rows: AgoraGlRow[];
  totals: {
    turnoverDebit: number;
    turnoverCredit: number;
    balanceDebit: number;
    balanceCredit: number;
  };
  reconciliation: AgoraReconciliation;
  branding: string;
}

export interface AgoraBuildOptions {
  companyName?: string;
  taxNumber?: string;
  listId?: string;
  year?: string;
  currency?: string;
  dateFrom?: string;
  dateTo?: string;
  excludeZeroRows?: boolean;
  branding?: string;
}

/**
 * Formats period for Agora / Novitax header (e.g. "Hónap: 0 - 09 (Időszaki)")
 */
export function formatAgoraPeriod(dateFrom?: string, dateTo?: string): string {
  if (!dateFrom && !dateTo) {
    return 'Hónap: 0 - 12 (Időszaki)';
  }

  let startMonth = '0';
  let endMonth = '12';

  if (dateFrom) {
    const parts = dateFrom.substring(0, 10).split('-');
    if (parts.length >= 2) {
      const m = parseInt(parts[1], 10);
      startMonth = m <= 1 ? '0' : String(m).padStart(2, '0');
    }
  }

  if (dateTo) {
    const parts = dateTo.substring(0, 10).split('-');
    if (parts.length >= 2) {
      endMonth = parts[1].padStart(2, '0');
    }
  }

  return `Hónap: ${startMonth} - ${endMonth} (Időszaki)`;
}

/**
 * Determines hierarchy level
 */
export function getAgoraAccountLevel(accNum: string): AgoraRowLevel {
  const len = accNum.length;
  if (len <= 1) return 'class';
  if (len === 2) return 'group';
  if (len === 3) return 'subgroup';
  return 'leaf';
}

/**
 * Generates a deterministic list ID if none provided
 */
export function generateAgoraListId(dateTo?: string, companyName?: string): string {
  let hash = 4629547600;
  const str = `${companyName || ''}_${dateTo || ''}`;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 31 + str.charCodeAt(i)) % 9000000000 + 1000000000;
  }
  return String(Math.abs(hash));
}

/**
 * Builds the complete AGORA (Novitax) General Ledger report structure from accounts input.
 */
export function buildAgoraGlData(
  inputAccounts: ProcontAccountInput[],
  options: AgoraBuildOptions = {}
): AgoraGlData {
  const excludeZero = options.excludeZeroRows ?? false;
  const companyName = (options.companyName || 'Vállalkozás').trim();
  const taxNumber = options.taxNumber ? options.taxNumber.trim() : undefined;
  const periodText = formatAgoraPeriod(options.dateFrom, options.dateTo);

  const currentYear = options.year || (options.dateTo ? options.dateTo.substring(0, 4) : String(new Date().getFullYear()));
  const currency = options.currency || 'HUF';
  const listId = options.listId || generateAgoraListId(options.dateTo, companyName);
  const branding = options.branding || 'EaisyBill';

  const today = new Date();
  const exportDate = options.dateTo
    ? options.dateTo.substring(0, 10).replace(/-/g, '.')
    : `${today.getFullYear()}.${String(today.getMonth() + 1).padStart(2, '0')}.${String(today.getDate()).padStart(2, '0')}`;

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

  const isHuf = currency.toUpperCase() === 'HUF';
  const roundAmount = (val: number) => (isHuf ? Math.round(val) : Math.round(val * 100) / 100);

  const allNumbers = Array.from(accountMap.keys());
  const statsMap = new Map<string, AccountStats>();

  allNumbers.forEach(accNum => {
    const acc = accountMap.get(accNum)!;
    const hasChild = allNumbers.some(other => other !== accNum && other.startsWith(accNum));
    const isLeaf = !hasChild;

    let tDebit = 0;
    let tCredit = 0;

    if (acc.debitTurnover !== undefined && acc.creditTurnover !== undefined) {
      tDebit = roundAmount(acc.debitTurnover || 0);
      tCredit = roundAmount(acc.creditTurnover || 0);
    } else {
      const bal = roundAmount(acc.balance || 0);
      if (bal > 0) tDebit = bal;
      if (bal < 0) tCredit = roundAmount(Math.abs(bal));
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

    const stat = statsMap.get(parentNum)!;
    if (!stat.isLeaf) {
      stat.turnoverDebit = roundAmount(sumDebit);
      stat.turnoverCredit = roundAmount(sumCredit);
    }
  });

  // Sort account numbers hierarchically (1, 11, 113, ..., 2, 3, ...)
  finalNumbers.sort(compareGlAccountNumbers);

  // 4. Build AgoraGlRows with Net balances
  const allRows: AgoraGlRow[] = [];

  finalNumbers.forEach(num => {
    const stat = statsMap.get(num)!;
    const level = getAgoraAccountLevel(num);

    const net = roundAmount(stat.turnoverDebit - stat.turnoverCredit);
    const balanceDebit = net > 0 ? net : 0;
    const balanceCredit = net < 0 ? roundAmount(Math.abs(net)) : 0;

    if (excludeZero && stat.turnoverDebit === 0 && stat.turnoverCredit === 0 && net === 0) {
      return;
    }

    allRows.push({
      accountNumber: num,
      accountName: stat.accountName,
      level,
      depth: num.length - 1,
      turnoverDebit: stat.turnoverDebit,
      turnoverCredit: stat.turnoverCredit,
      balanceDebit,
      balanceCredit,
    });
  });

  // 5. Calculate class sums for classes 1-4 and 5-9
  let c1to4Debit = 0;
  let c1to4Credit = 0;
  let c5to9Debit = 0;
  let c5to9Credit = 0;

  detectedClasses.forEach(cls => {
    const stat = statsMap.get(cls);
    if (!stat) return;
    const cNum = parseInt(cls, 10);
    if (cNum >= 1 && cNum <= 4) {
      c1to4Debit += stat.turnoverDebit;
      c1to4Credit += stat.turnoverCredit;
    } else if (cNum >= 5 && cNum <= 9) {
      c5to9Debit += stat.turnoverDebit;
      c5to9Credit += stat.turnoverCredit;
    }
  });

  c1to4Debit = roundAmount(c1to4Debit);
  c1to4Credit = roundAmount(c1to4Credit);
  c5to9Debit = roundAmount(c5to9Debit);
  c5to9Credit = roundAmount(c5to9Credit);

  const net1to4 = roundAmount(c1to4Debit - c1to4Credit);
  const net5to9 = roundAmount(c5to9Debit - c5to9Credit);

  const classes1to4: AgoraSummaryRow = {
    label: '1 - 4 számlaosztályok összesen',
    turnoverDebit: c1to4Debit,
    turnoverCredit: c1to4Credit,
    balanceDebit: net1to4 > 0 ? net1to4 : 0,
    balanceCredit: net1to4 < 0 ? roundAmount(Math.abs(net1to4)) : 0,
  };

  const classes5to9: AgoraSummaryRow = {
    label: '5 - 9 számlaosztályok összesen',
    turnoverDebit: c5to9Debit,
    turnoverCredit: c5to9Credit,
    balanceDebit: net5to9 > 0 ? net5to9 : 0,
    balanceCredit: net5to9 < 0 ? roundAmount(Math.abs(net5to9)) : 0,
  };

  const grandTotalDebit = roundAmount(c1to4Debit + c5to9Debit);
  const grandTotalCredit = roundAmount(c1to4Credit + c5to9Credit);

  const grandTotal: AgoraSummaryRow = {
    label: '1 - 9 számlaosztályok összesen',
    turnoverDebit: grandTotalDebit,
    turnoverCredit: grandTotalCredit,
    balanceDebit: 0,
    balanceCredit: 0,
  };

  const isBalanced = grandTotalDebit === grandTotalCredit;

  return {
    companyName,
    taxNumber,
    listId,
    year: currentYear,
    currency,
    periodText,
    exportDate,
    rows: allRows,
    totals: {
      turnoverDebit: grandTotalDebit,
      turnoverCredit: grandTotalCredit,
      balanceDebit: classes1to4.balanceDebit + classes5to9.balanceDebit,
      balanceCredit: classes1to4.balanceCredit + classes5to9.balanceCredit,
    },
    reconciliation: {
      classes1to4,
      classes5to9,
      grandTotal,
      isBalanced,
    },
    branding,
  };
}
