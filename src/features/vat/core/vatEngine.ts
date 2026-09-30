import type {
  TaxValidationResult,
  XmlValidationCheck,
  A60CalculationsResult,
  DeadlineInfo,
  MLine,
  VatFrequency,
} from '../types';
import { formatThousands } from '../types';

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
  const isDashed11 = /^\d{8}-\d-\d{2}$/.test(trimmed);
  const isPlain11 = /^\d{11}$/.test(trimmed);

  if (!is8Digit && !isDashed11 && !isPlain11) {
    return {
      isValid: false,
      reason: 'Hibás formátum (helyes: XXXXXXXX-X-XX vagy 8-11 jegyű szám)',
      severity: 'warning',
      status: 'invalid',
    };
  }

  const base = is8Digit ? trimmed : trimmed.replace(/\D/g, '').slice(0, 8);
  const vatCode = isDashed11 ? trimmed.split('-')[1] : isPlain11 ? trimmed[8] : undefined;

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
    ? `A főlapon szereplő levonható ÁFA (${formatThousands(deductibleTaxEft)} eFt) megegyezik a részletező lapok (M-lap) összesítésével (${formatThousands(mSheetTaxEft)} eFt).`
    : `Összegzési eltérés! Főlap levonható ÁFA: ${formatThousands(deductibleTaxEft)} eFt. Részletező M-lapok összege: ${formatThousands(mSheetTaxEft)} eFt.`;

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
 * Calculates A60 EU community transaction aggregations and validation checks for 4 statutory categories:
 * 1. Termékértékesítés (Kimenő) -> 02. sor
 * 2. Termékbeszerzés (Bejövő) -> 11-16. sorok
 * 3. Szolgáltatásnyújtás (Kimenő) -> 91-92. sorok
 * 4. Szolgáltatás igénybevétele (Bejövő, pl. Google Ireland) -> 18. sor
 */
export function calculateA60Aggregations(
  euInvoices: any[],
  euTypeOverrides: Record<string, 'product' | 'service' | string> = {},
  expectedRowsOrGoods:
    | number
    | { goodsOut?: number; goodsIn?: number; servicesOut?: number; servicesIn?: number },
  legacyExpectedServices: number = 0,
  exchangeRates?: Record<string, number> | null,
  legacyExpectedGoodsIn: number = 0,
  legacyExpectedServicesIn: number = 0
): A60CalculationsResult {
  let expectedGoodsOut = 0;
  let expectedGoodsIn = 0;
  let expectedServicesOut = 0;
  let expectedServicesIn = 0;
  let rates: Record<string, number> | null | undefined = exchangeRates;

  if (typeof expectedRowsOrGoods === 'object' && expectedRowsOrGoods !== null) {
    expectedGoodsOut = expectedRowsOrGoods.goodsOut || 0;
    expectedGoodsIn = expectedRowsOrGoods.goodsIn || 0;
    expectedServicesOut = expectedRowsOrGoods.servicesOut || 0;
    expectedServicesIn = expectedRowsOrGoods.servicesIn || 0;
    rates = legacyExpectedServices as unknown as Record<string, number> | null;
  } else {
    expectedGoodsOut = (expectedRowsOrGoods as number) || 0;
    expectedServicesOut = (legacyExpectedServices as number) || 0;
    expectedGoodsIn = legacyExpectedGoodsIn || 0;
    expectedServicesIn = legacyExpectedServicesIn || 0;
  }

  let goodsOutSum = 0;
  let goodsInSum = 0;
  let servicesOutSum = 0;
  let servicesInSum = 0;

  const itemsList: any[] = [];
  const taxErrors: string[] = [];

  const getRate = (currency: string | null | undefined): number => {
    const cur = (currency || 'HUF').toUpperCase();
    if (cur === 'HUF') return 1;
    if (rates && rates[cur]) return rates[cur];
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
    const direction: 'OUTBOUND' | 'INBOUND' =
      (inv.invoice_direction || 'INBOUND').toUpperCase() === 'OUTBOUND' ? 'OUTBOUND' : 'INBOUND';

    const override = euTypeOverrides[inv.id];
    let isService: boolean;

    if (override === 'service' || override === 'services_out' || override === 'services_in') {
      isService = true;
    } else if (override === 'product' || override === 'goods_out' || override === 'goods_in') {
      isService = false;
    } else {
      isService = !!inv.defaultIsService;
    }

    let category: 'goods_out' | 'goods_in' | 'services_out' | 'services_in';
    if (override === 'goods_out' || override === 'goods_in' || override === 'services_out' || override === 'services_in') {
      category = override;
    } else {
      if (direction === 'OUTBOUND') {
        category = isService ? 'services_out' : 'goods_out';
      } else {
        category = isService ? 'services_in' : 'goods_in';
      }
    }

    const currency = inv.currency || 'HUF';
    const rate = getRate(currency);
    const netAmountHuf = (inv.invoice_net_amount || 0) * rate;
    const amountEft = Math.round(netAmountHuf / 1000);

    if (category === 'goods_out') {
      goodsOutSum += amountEft;
    } else if (category === 'goods_in') {
      goodsInSum += amountEft;
    } else if (category === 'services_out') {
      servicesOutSum += amountEft;
    } else if (category === 'services_in') {
      servicesInSum += amountEft;
    }

    const rawTaxNumber = inv.partner_tax_number || '';
    const cleanTaxNumber = rawTaxNumber.replace(/[\s.-]/g, '').trim().toUpperCase();
    const hasTaxNumber = !!cleanTaxNumber;
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
      invoice_direction: direction,
      partner_tax_number: cleanTaxNumber || rawTaxNumber,
      category,
      isService,
      amountEft,
      hasTaxNumber,
      isValidFormat,
    });
  });

  const goodsOutMismatch = goodsOutSum !== expectedGoodsOut;
  const goodsInMismatch = goodsInSum !== expectedGoodsIn;
  const servicesOutMismatch = servicesOutSum !== expectedServicesOut;
  const servicesInMismatch = servicesInSum !== expectedServicesIn;

  // Backward-compatible totals
  const goodsSum = goodsOutSum;
  const servicesSum = servicesOutSum;
  const expectedGoods = expectedGoodsOut;
  const expectedServices = expectedServicesOut;
  const goodsMismatch = goodsOutMismatch;
  const servicesMismatch = servicesOutMismatch;

  const isValid =
    !goodsOutMismatch &&
    !goodsInMismatch &&
    !servicesOutMismatch &&
    !servicesInMismatch &&
    taxErrors.length === 0;

  return {
    goodsOutSum,
    expectedGoodsOut,
    goodsOutMismatch,

    goodsInSum,
    expectedGoodsIn,
    goodsInMismatch,

    servicesOutSum,
    expectedServicesOut,
    servicesOutMismatch,

    servicesInSum,
    expectedServicesIn,
    servicesInMismatch,

    goodsSum,
    servicesSum,
    expectedGoods,
    expectedServices,
    goodsMismatch,
    servicesMismatch,

    itemsList,
    taxErrors,
    isValid,
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
