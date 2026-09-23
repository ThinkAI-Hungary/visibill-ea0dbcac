import { useMemo } from 'react';
import { useOptionalCompany, Company } from '@/contexts/CompanyContext';
import { formatCurrencyLocale } from '@/lib/locale/formatters';

export type CountryCode = 'HU' | 'HR';

export interface JurisdictionRules {
  countryCode: CountryCode;
  isHungary: boolean;
  isCroatia: boolean;
  hasNavIntegration: boolean;
  taxNumberLabel: string;
  taxNumberPlaceholder: string;
  defaultCurrency: 'HUF' | 'EUR';
  vatLabel: string; // 'ÁFA' vs 'PDV'
  countryName: string;
  flag: string;
  formatCurrency: (amount: number, currency?: string | null, compact?: boolean) => string;
}

/**
 * Returns jurisdiction rules for a given country code ('HU' | 'HR').
 * Defaults to 'HU' if not specified.
 */
export function getJurisdictionRules(countryCode?: string | null): JurisdictionRules {
  const upper = (countryCode || '').trim().toUpperCase();
  const code: CountryCode = upper === 'HR' ? 'HR' : 'HU';
  const isHungary = code === 'HU';
  const isCroatia = code === 'HR';
  const defaultCurrency = isHungary ? 'HUF' : 'EUR';

  return {
    countryCode: code,
    isHungary,
    isCroatia,
    hasNavIntegration: isHungary,
    taxNumberLabel: isHungary ? 'Adószám' : 'OIB / Porezni broj',
    taxNumberPlaceholder: isHungary ? '12345678-1-23 vagy 12345678' : '11 számjegyű OIB (pl. 95114485977)',
    defaultCurrency,
    vatLabel: isHungary ? 'ÁFA' : 'PDV',
    countryName: isHungary ? 'Magyarország' : 'Horvátország (Hrvatska)',
    flag: isHungary ? '🇭🇺' : '🇭🇷',
    formatCurrency: (amount: number, currency?: string | null, compact?: boolean) =>
      formatCurrencyLocale(amount, currency || defaultCurrency, compact),
  };
}

/**
 * Hook to access jurisdiction rules for the active company (or an overridden company).
 * Safely falls back to default Hungarian rules if rendered outside CompanyProvider.
 */
export function useCompanyJurisdiction(overrideCompany?: Company | null): JurisdictionRules {
  const companyContext = useOptionalCompany();
  const company = overrideCompany !== undefined ? overrideCompany : companyContext?.selectedCompany;
  return useMemo(() => getJurisdictionRules(company?.country_code), [company?.country_code]);
}
