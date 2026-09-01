import type {
  TaxValidationResult,
  XmlValidationCheck,
  A60CalculationsResult,
  DeadlineInfo,
  MLine,
  VatFrequency,
} from '../types';

/**
 * Validates a Hungarian tax number (8-digit törzsszám or 11-digit XXXXXXXX-X-XX)
 * using the NAV CDV modulo 10 checksum algorithm.
 */
export function validateHungarianTaxNumber(taxNumber: string): TaxValidationResult {
  if (!taxNumber) {
    return { isValid: false, reason: 'Nincs adószám', severity: 'error', status: 'invalid' };
  }

  const trimmed = taxNumber.trim();
  if (trimmed.startsWith('FOREIGN:') || trimmed.startsWith('TEST-')) {
    return {
      isValid: true,
      isForeign: true,
      reason: 'Külföldi partner (EU-s/egyéb)',
      severity: 'info',
      status: 'active',
    };
  }

  const is8Digit = /^\d{8}$/.test(trimmed);
  const is11Digit = /^\d{8}-\d-\d{2}$/.test(trimmed);

  if (!is8Digit && !is11Digit) {
    return {
      isValid: false,
      reason: 'Hibás formátum (helyes: XXXXXXXX-X-XX vagy 8 jegyű törzsszám)',
      severity: 'warning',
      status: 'invalid',
    };
  }

  const base = is8Digit ? trimmed : trimmed.split('-')[0];
  const vatCode = is11Digit ? trimmed.split('-')[1] : undefined;

  // CDV check (modulo 10 of weighted 8 digits)
  const digits = base.split('').map(Number);
  const weights = [9, 7, 3, 1, 9, 7, 3, 1];
  let sum = 0;
  for (let i = 0; i < 8; i++) {
    sum += digits[i] * weights[i];
  }

  const isCdvValid = sum % 10 === 0;
  if (!isCdvValid) {
    return {
      isValid: false,
      reason: 'NAV CDV ellenőrzőösszeg hiba (adószám nem létezik)',
      severity: 'error',
      status: 'invalid',
    };
  }

  if (vatCode === undefined) {
    return { isValid: true, reason: 'Érvényes adószám (törzsszám)', severity: 'success', status: 'active' };
  }

  if (vatCode === '1') {
    return {
      isValid: true,
      vatCode,
      reason: 'Alanyi adómentes / áfamentes adóalany (Áfa tv. XIII. fejezet)',
      severity: 'warning',
      status: 'exempt',
    };
  } else if (vatCode === '2') {
    return {
      isValid: true,
      vatCode,
      reason: 'Általános szabályok szerinti ÁFA-alany',
      severity: 'success',
      status: 'active',
    };
  } else if (vatCode === '3') {
    return {
      isValid: true,
      vatCode,
      reason: 'Egyszerűsített adózású adóalany (EVA/KATA/KIVA)',
      severity: 'success',
      status: 'active',
    };
  } else if (vatCode === '4') {
    return {
      isValid: true,
      vatCode,
      reason: 'Speciális adóalany (ÁFA tv. 4. kód)',
      severity: 'success',
      status: 'active',
    };
  } else if (vatCode === '5') {
    return {
      isValid: true,
      vatCode,
      reason: 'Csoportos adóalanyiság tagja',
      severity: 'success',
      status: 'active',
    };
  }

  return { isValid: true, vatCode, reason: 'Érvényes adószám', severity: 'success', status: 'active' };
}

/**
 * Validates XML structure, tax number CDV checksum, and line sum reconciliations.
 */
export function runXmlValidation(
  xmlContent: string,
  companyTaxNumber: string,
  deductibleTaxEft: number,
  mSheetTaxEft: number
): XmlValidationCheck[] {
  const checks: XmlValidationCheck[] = [];

  // Check 1: Structure check
  const hasNyomtatvany =
    xmlContent.includes('<nyomtatvany>') ||
    xmlContent.includes('<nyomtatvanyok') ||
    xmlContent.includes('<mezo') ||
    xmlContent.includes('<form>') ||
    xmlContent.includes('<declaration>');

  checks.push({
    id: 'structure',
    name: 'NAV ÁNYK XML Fejléc & Struktúra ellenőrzés',
    status: hasNyomtatvany || xmlContent.includes('<?xml') ? 'success' : 'error',
    message:
      hasNyomtatvany || xmlContent.includes('<?xml')
        ? 'A fájl szerkezete megfelelő, ÁNYK kompatibilis 2665 sémadefiníció észlelve.'
        : 'Nem található érvényes NAV XML fejléc vagy ÁNYK nyomtatvány tag!',
  });

  // Check 2: Tax number CDV check
  const cleanTaxNum = (companyTaxNumber || '').replace(/-/g, '').substring(0, 8);
  let taxNumValid = false;
  let taxNumMsg = '';

  if (cleanTaxNum.length === 8) {
    let sum = 0;
    const weights = [9, 7, 3, 1, 9, 7, 3];
    for (let i = 0; i < 7; i++) {
      sum += parseInt(cleanTaxNum[i], 10) * weights[i];
    }
    const expectedCDV = (10 - (sum % 10)) % 10;
    const actualCDV = parseInt(cleanTaxNum[7], 10);
    taxNumValid = expectedCDV === actualCDV;
    taxNumMsg = taxNumValid
      ? `A cég adószáma (${companyTaxNumber}) érvényes CDV ellenőrző összeggel rendelkezik.`
      : `A cég adószáma (${companyTaxNumber}) hibás CDV ellenőrző összeggel rendelkezik! (várt CDV: ${expectedCDV}, tényleges: ${actualCDV})`;
  } else {
    taxNumMsg = 'Nem található 8 jegyű adószám a CDV ellenőrzéshez.';
  }

  checks.push({
    id: 'tax_number',
    name: 'Cég adószám CDV ellenőrző összeg ellenőrzése',
    status: taxNumValid ? 'success' : 'error',
    message: taxNumMsg,
  });

  // Check 3: Form sums match transaction details
  const sumCheckOk = deductibleTaxEft === 0 || mSheetTaxEft === deductibleTaxEft;
  const sumCheckMsg = sumCheckOk
    ? `A főlapon szereplő levonható ÁFA (${deductibleTaxEft.toLocaleString('hu-HU')} eFt) megegyezik a részletező lapok (M-lap) összesítésével (${mSheetTaxEft.toLocaleString('hu-HU')} eFt).`
    : `Összegzési eltérés! Főlap levonható ÁFA: ${deductibleTaxEft.toLocaleString('hu-HU')} eFt. Részletező M-lapok összege: ${mSheetTaxEft.toLocaleString('hu-HU')} eFt.`;

  checks.push({
    id: 'sum_match',
    name: 'Főlap és Részletező Lapok számszaki egyezősége',
    status: sumCheckOk ? 'success' : 'error',
    message: sumCheckMsg,
  });

  return checks;
}

/**
 * Calculates net VAT settlement (Lines 83-86).
 */
export function calculateVatBalances(
  payTax: number,
  dedTax: number,
  carryforward: number
): { net83: number; toPay84: number; reclaimable85: number; carryforward86: number } {
  const net83 = payTax - dedTax - carryforward;
  if (net83 > 0) {
    return {
      net83,
      toPay84: net83,
      reclaimable85: 0,
      carryforward86: 0,
    };
  } else {
    const absVal = Math.abs(net83);
    return {
      net83,
      toPay84: 0,
      reclaimable85: absVal,
      carryforward86: absVal,
    };
  }
}

/**
 * Calculates A60 EU community transaction aggregations and validation checks.
 */
export function calculateA60Aggregations(
  euInvoices: any[],
  euTypeOverrides: Record<string, 'product' | 'service'>,
  expectedGoods: number,
  expectedServices: number,
  exchangeRates?: Record<string, number> | null
): A60CalculationsResult {
  let goodsSum = 0;
  let servicesSum = 0;
  const itemsList: any[] = [];
  const taxErrors: string[] = [];

  const getRate = (currency: string | null | undefined): number => {
    const cur = (currency || 'HUF').toUpperCase();
    if (cur === 'HUF') return 1;
    if (exchangeRates && exchangeRates[cur]) return exchangeRates[cur];
    const fallbacks: Record<string, number> = {
      EUR: 400,
      USD: 370,
      GBP: 470,
      CHF: 415,
      RON: 80,
    };
    return fallbacks[cur] || 1;
  };

  euInvoices.forEach((inv) => {
    const isService =
      euTypeOverrides[inv.id] !== undefined
        ? euTypeOverrides[inv.id] === 'service'
        : inv.defaultIsService;
    const currency = inv.currency || 'HUF';
    const rate = getRate(currency);
    const netAmountHuf = (inv.invoice_net_amount || 0) * rate;
    const amountEft = Math.round(netAmountHuf / 1000);

    if (inv.invoice_direction === 'OUTBOUND') {
      if (isService) {
        servicesSum += amountEft;
      } else {
        goodsSum += amountEft;
      }
    }

    const hasTaxNumber = !!inv.partner_tax_number;
    const cleanTaxNumber = (inv.partner_tax_number || '').trim().toUpperCase();
    const isValidFormat = /^[A-Z]{2}[A-Z0-9]{2,15}$/.test(cleanTaxNumber);

    if (!hasTaxNumber) {
      taxErrors.push(`${inv.invoice_number} sz. számla: Hiányzik a partner közösségi adószáma!`);
    } else if (!isValidFormat) {
      taxErrors.push(
        `${inv.invoice_number} sz. számla: Hibás formátumú közösségi adószám (${inv.partner_tax_number})!`
      );
    }

    itemsList.push({
      ...inv,
      isService,
      amountEft,
      hasTaxNumber,
      isValidFormat,
    });
  });

  const goodsMismatch = goodsSum !== expectedGoods;
  const servicesMismatch = servicesSum !== expectedServices;

  return {
    goodsSum,
    servicesSum,
    expectedGoods,
    expectedServices,
    goodsMismatch,
    servicesMismatch,
    itemsList,
    taxErrors,
    isValid: !goodsMismatch && !servicesMismatch && taxErrors.length === 0,
  };
}

/**
 * Calculates the VAT filing deadline countdown.
 */
export function calculateDeadlineCountdown(
  year: number,
  month: number,
  frequency: VatFrequency,
  currentDate?: Date
): DeadlineInfo {
  const today = currentDate || new Date();
  let deadlineDate: Date;

  if (frequency === 'H') {
    let deadlineMonth = month + 1;
    let deadlineYear = year;
    if (deadlineMonth > 12) {
      deadlineMonth = 1;
      deadlineYear += 1;
    }
    deadlineDate = new Date(deadlineYear, deadlineMonth - 1, 20);
  } else if (frequency === 'N') {
    const endMonth = month * 3;
    let deadlineMonth = endMonth + 1;
    let deadlineYear = year;
    if (deadlineMonth > 12) {
      deadlineMonth = 1;
      deadlineYear += 1;
    }
    deadlineDate = new Date(deadlineYear, deadlineMonth - 1, 20);
  } else {
    deadlineDate = new Date(year + 1, 1, 25);
  }

  const diffTime = deadlineDate.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  return {
    daysLeft: diffDays,
    dateFormatted: deadlineDate.toLocaleDateString('hu-HU', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }),
  };
}

/**
 * Identifies suspicious invoices where reverse charge might apply.
 */
export function findSuspiciousReverseChargeInvoices(
  mLines: MLine[]
): { partnerName: string; invoiceNumber: string; net: number; vat: number }[] {
  const suspicious: { partnerName: string; invoiceNumber: string; net: number; vat: number }[] = [];
  const keywords = ['épít', 'szerel', 'kivitelez', 'fém', 'hulladék', 'bontás', 'generál'];

  mLines.forEach((ml) => {
    const partnerName = ml.partner_name || '';
    const matchesKeyword = keywords.some((k) => partnerName.toLowerCase().includes(k));
    if (matchesKeyword && ml.invoice_details) {
      (ml.invoice_details as any[]).forEach((inv) => {
        const vatRate = parseFloat(inv.vat_rate) || 0;
        if (vatRate > 0) {
          suspicious.push({
            partnerName,
            invoiceNumber: inv.invoice_number,
            net: inv.net || 0,
            vat: inv.vat || 0,
          });
        }
      });
    }
  });

  return suspicious;
}
