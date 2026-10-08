/**
 * EB-0258: Exchange Rate Banking Institutions and Rate Types Catalog.
 * Based on Hungarian statutory accounting standards and Lendvai Ádám (Ván Iroda / Kolos Transport Kft.) brief (258.pdf).
 */

export type FxRateType = 'mid' | 'buy' | 'sell';

export interface FxRateTypeDef {
  value: FxRateType;
  label: string;
  shortLabel: string;
  description: string;
  isDefault?: boolean;
}

export const FX_RATE_TYPES: FxRateTypeDef[] = [
  {
    value: 'mid',
    label: 'Középárfolyam (KKV standard)',
    shortLabel: 'Közép',
    description: 'A devizák hivatalos napi középárfolyama (magyar számvitelben leggyakoribb).',
    isDefault: true,
  },
  {
    value: 'buy',
    label: 'Vételi árfolyam',
    shortLabel: 'Vétel',
    description: 'A bank devizavételi árfolyama.',
  },
  {
    value: 'sell',
    label: 'Eladási árfolyam',
    shortLabel: 'Eladás',
    description: 'A bank devizaeladási árfolyama.',
  },
];

export const EXCHANGE_RATE_TYPES = FX_RATE_TYPES;
export const DEFAULT_FX_BANK_CODE = 'MNB';
export const DEFAULT_FX_RATE_TYPE: FxRateType = 'mid';

export interface ExchangeRateBank {
  code: string;
  aliases?: string[];
  country: string;
  countryFlag?: string;
  name: string;
  flag: string;
  isPopular?: boolean;
  recommendedForRevaluation?: boolean;
}

export const EXCHANGE_RATE_BANKS: ExchangeRateBank[] = [
  // ── Kiemelt / Leggyakoribb bankok ──
  { code: 'MNB', aliases: ['MNB', '190', 'JEGYBANK'], country: 'HU', countryFlag: '🇭🇺', name: 'Magyar Nemzeti Bank (MNB)', flag: '🇭🇺', isPopular: true, recommendedForRevaluation: true },
  { code: '190', aliases: ['MNB'], country: 'HU', countryFlag: '🇭🇺', name: 'Magyar Nemzeti Bank (190)', flag: '🇭🇺', isPopular: true },
  { code: '146', aliases: ['MFB'], country: 'HU', countryFlag: '🇭🇺', name: 'Magyar Fejlesztési Bank Zrt. (MFB)', flag: '🇭🇺', isPopular: true, recommendedForRevaluation: true },
  { code: '117', aliases: ['OTP'], country: 'HU', countryFlag: '🇭🇺', name: 'OTP Bank Nyrt.', flag: '🇭🇺', isPopular: true },
  { code: '104', aliases: ['KH', 'K&H'], country: 'HU', countryFlag: '🇭🇺', name: 'Kereskedelmi és Hitelbank Zrt. (K&H)', flag: '🇭🇺', isPopular: true },
  { code: '116', aliases: ['ERSTE'], country: 'HU', countryFlag: '🇭🇺', name: 'Erste Bank Hungary Zrt.', flag: '🇭🇺', isPopular: true },
  { code: '120', aliases: ['RAIFFEISEN'], country: 'HU', countryFlag: '🇭🇺', name: 'Raiffeisen Bank Zrt.', flag: '🇭🇺', isPopular: true },
  { code: '107', aliases: ['CIB'], country: 'HU', countryFlag: '🇭🇺', name: 'CIB Bank Zrt.', flag: '🇭🇺', isPopular: true },
  { code: '511', aliases: ['MBH'], country: 'HU', countryFlag: '🇭🇺', name: 'MBH Bank Nyrt.', flag: '🇭🇺', isPopular: true },
  { code: '109', aliases: ['UNICREDIT'], country: 'HU', countryFlag: '🇭🇺', name: 'UniCredit Bank Hungary Zrt.', flag: '🇭🇺', isPopular: true },
  { code: '122', aliases: ['GRANIT', 'GRÁNIT'], country: 'HU', countryFlag: '🇭🇺', name: 'Gránit Bank Zrt.', flag: '🇭🇺', isPopular: true },
  { code: '162', aliases: ['MAGNET'], country: 'HU', countryFlag: '🇭🇺', name: 'MagNet Magyar Közösségi Bank Zrt.', flag: '🇭🇺', isPopular: true },
  { code: 'BE1', aliases: ['WISE'], country: 'BE', countryFlag: '🇧🇪', name: 'Wise Europe SA', flag: '🇧🇪', isPopular: true },
  { code: '302', aliases: ['REVOLUT'], country: 'HU', countryFlag: '🇭🇺', name: 'Revolut Bank UAB Magyarországi Fióktelep', flag: '🇭🇺', isPopular: true },
  { code: 'LT1', aliases: ['REVOLUT'], country: 'LT', countryFlag: '🇱🇹', name: 'Revolut Business', flag: '🇱🇹', isPopular: true },

  // ── Teljes Hivatalos Banklista (258.pdf alapján) ──
  { code: '576', country: 'HU', countryFlag: '🇭🇺', name: '3A Takarékszövetkezet', flag: '🇭🇺' },
  { code: 'AKC', country: 'SK', countryFlag: '🇸🇰', name: 'Akcenta Bank', flag: '🇸🇰' },
  { code: '181', country: 'HU', name: 'Allianz Bank Zrt.', flag: '🇭🇺' },
  { code: '175', country: 'HU', name: 'Bank of China Zrt.', flag: '🇭🇺' },
  { code: '179', country: 'HU', name: 'Bank Plus Bank Zrt.', flag: '🇭🇺' },
  { code: '304', country: 'HU', name: 'BinX Business Integrated NetworX Zrt.', flag: '🇭🇺' },
  { code: '131', country: 'HU', name: 'BNP Paribas Hungária Bank Zrt.', flag: '🇭🇺' },
  { code: '183', country: 'HU', name: 'BNP Paribas Magyarországi Fióktelepe', flag: '🇭🇺' },
  { code: '136', country: 'HU', name: 'CaLyon Bank Magyarország Zrt.', flag: '🇭🇺' },
  { code: '185', country: 'HU', name: 'Calyon S.A. Magyarország Bankfióktelep', flag: '🇭🇺' },
  { code: '108', country: 'HU', name: 'Citibank Budapest Zrt.', flag: '🇭🇺' },
  { code: '180', country: 'HU', name: 'Cofidis Magyarországi Fióktelep', flag: '🇭🇺' },
  { code: '142', country: 'HU', name: 'Commerzbank Budapest Zrt.', flag: '🇭🇺' },
  { code: '172', country: 'HU', name: 'Credigen Bank Zrt.', flag: '🇭🇺' },
  { code: 'SK9', country: 'CZ', name: 'CSOB', flag: '🇨🇿' },
  { code: '163', country: 'HU', name: 'Deutsche Bank Zrt.', flag: '🇭🇺' },
  { code: '177', country: 'HU', name: 'Dresdner Bank AG Magyarországi Fiókt.', flag: '🇭🇺' },
  { code: '176', country: 'HU', name: 'EB und HYPO Bank Burgenland-Sopron Zrt.', flag: '🇭🇺' },
  { code: '170', country: 'HU', name: 'Ella Első Lakáshitel Ker. Bank Zrt.', flag: '🇭🇺' },
  { code: '119', country: 'HU', name: 'Erste Bank Hungary Zrt. (119)', flag: '🇭🇺' },
  { code: 'EKB', country: 'EU', name: 'Európai Központi Bank (EKB)', flag: '🇪🇺' },
  { code: '178', country: 'HU', name: 'Fortis Bank SA/NV Magyarországi Fiókt.', flag: '🇭🇺' },
  { code: '880', country: 'HU', name: 'Fundamenta Lakáskassza LTP Zrt.', flag: '🇭🇺' },
  { code: '114', country: 'HU', name: 'Hanwha Bank Magyarország Zrt.', flag: '🇭🇺' },
  { code: '162', country: 'HU', name: 'HBW Express Takarékszövetkezet', flag: '🇭🇺' },
  { code: 'FXB', country: 'BE', name: 'IBanFirst SA', flag: '🇧🇪' },
  { code: '147', country: 'HU', name: 'IC Bank Zrt.', flag: '🇭🇺' },
  { code: '137', country: 'HU', name: 'ING Bank (Magyarország) Zrt.', flag: '🇭🇺' },
  { code: '111', country: 'HU', name: 'Inter-Európa Bank Zrt.', flag: '🇭🇺' },
  { code: '135', country: 'HU', name: 'KDB Bank (Magyarország) Zrt.', flag: '🇭🇺' },
  { code: '144', country: 'HU', name: 'KELER Zrt.', flag: '🇭🇺' },
  { code: '100', country: 'HU', name: 'Magyar Államkincstár (MÁK)', flag: '🇭🇺' },
  { code: '167', country: 'HU', name: 'Magyar Cetelem Bank Zrt.', flag: '🇭🇺' },
  { code: '148', country: 'HU', name: 'Magyar Export-Import Bank Zrt (Eximbank)', flag: '🇭🇺' },
  { code: '101', country: 'HU', name: 'MBH (ex-Budapest Bank Zrt)', flag: '🇭🇺' },
  { code: '182', country: 'HU', name: 'MBH (ex-FHB Kereskedelmi Bank Zrt.)', flag: '🇭🇺' },
  { code: '103', country: 'HU', name: 'MBH (ex-Magyar Külker Bank)', flag: '🇭🇺' },
  { code: '115', country: 'HU', name: 'MBH (ex-Magyar Takarékszöv. Bank Zrt.)', flag: '🇭🇺' },
  { code: '504', country: 'HU', name: 'MBH (ex-Takarék bank)', flag: '🇭🇺' },
  { code: '574', country: 'HU', name: 'MBH Bank Nyrt. (574)', flag: '🇭🇺' },
  { code: '517', country: 'HU', name: 'MBH Bank Nyrt. (517)', flag: '🇭🇺' },
  { code: '531', country: 'HU', name: 'MBH Bank Nyrt. (531)', flag: '🇭🇺' },
  { code: '168', country: 'HU', name: 'MBH Jelzálogbank Nyrt.', flag: '🇭🇺' },
  { code: '128', country: 'HU', name: 'Merkantil Bank Zrt.', flag: '🇭🇺' },
  { code: '222', country: 'HU', name: 'O.F.SZ Zrt.', flag: '🇭🇺' },
  { code: '184', country: 'HU', name: 'Oberbank AG Magyarországi Fióktelepe', flag: '🇭🇺' },
  { code: '655', country: 'HU', name: 'Örkényi Takarékszövetkezet', flag: '🇭🇺' },
  { code: '884', country: 'HU', name: 'OTP Jelzálogbank Zrt.', flag: '🇭🇺' },
  { code: '881', country: 'HU', name: 'OTP Lakástakarékpénztár Zrt.', flag: '🇭🇺' },
  { code: 'EVP', country: 'LT', name: 'Paysera', flag: '🇱🇹' },
  { code: '160', country: 'HU', name: 'Porsche Bank Hungária Zrt.', flag: '🇭🇺' },
  { code: '200', country: 'HU', name: 'Sberbank Magyarország Zrt. (200)', flag: '🇭🇺' },
  { code: '141', country: 'HU', name: 'Sberbank Magyarország Zrt. (141)', flag: '🇭🇺' },
  { code: '171', country: 'HU', name: 'UniCredit Jelzálogbank Zrt.', flag: '🇭🇺' },
  { code: 'SK3', country: 'SK', name: 'VÚB Banka a.s', flag: '🇸🇰' },
  { code: '121', country: 'HU', name: 'Westdeutsche Landesbank (Hungária) Zrt.', flag: '🇭🇺' },
  { code: 'BE2', country: 'BE', name: 'Wise Europe SA (BE2)', flag: '🇧🇪' },
];

/**
 * Find bank by code (e.g. 'MNB', '117', 'BE1') or alias/name. Fallbacks gracefully to MNB.
 */
export function getExchangeRateBank(code?: string | null): ExchangeRateBank {
  if (!code) return EXCHANGE_RATE_BANKS[0];
  const upper = code.trim().toUpperCase();
  // 1. Direct code match
  const found = EXCHANGE_RATE_BANKS.find(b => b.code.toUpperCase() === upper);
  if (found) return found;
  // 2. Alias match (e.g. 'OTP', 'ERSTE', 'RAIFFEISEN', 'WISE', 'REVOLUT', 'MFB')
  const aliasMatch = EXCHANGE_RATE_BANKS.find(b => b.aliases && b.aliases.some(a => a.toUpperCase() === upper));
  if (aliasMatch) return aliasMatch;
  // 3. Name substring match
  const nameMatch = EXCHANGE_RATE_BANKS.find(b => b.name.toUpperCase().includes(upper));
  if (nameMatch) return nameMatch;
  // 4. Numeric code provided without padding
  const numericMatch = EXCHANGE_RATE_BANKS.find(b => b.code.padStart(3, '0') === upper.padStart(3, '0'));
  return numericMatch || EXCHANGE_RATE_BANKS[0];
}

/**
 * Returns human-readable label for exchange rate type.
 */
export function getFxRateTypeLabel(type?: string | null): string {
  const match = FX_RATE_TYPES.find(t => t.value === type);
  return match ? match.label : 'Középárfolyam (KKV standard)';
}

export const getExchangeRateTypeLabel = getFxRateTypeLabel;
