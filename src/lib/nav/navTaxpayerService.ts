import { supabase } from '@/integrations/supabase/client';
import { extractNavSyncError } from './navErrorUtils';

export interface TaxpayerAddress {
  postalCode?: string;
  city?: string;
  streetName?: string;
  publicPlaceCategory?: string;
  number?: string;
  building?: string;
  staircase?: string;
  floor?: string;
  door?: string;
  countryCode?: string;
  formattedAddress: string;
}

export interface TaxpayerDetails {
  taxpayerValidity: boolean;
  taxNumber: string;
  taxpayerId: string;
  vatCode?: string;
  countyCode?: string;
  taxpayerName?: string;
  taxpayerShortName?: string;
  incorporation?: 'ORGANIZATION' | 'SELF_EMPLOYED' | 'TAXABLE_PERSON';
  address?: TaxpayerAddress;
  vatGroupMembership?: {
    groupTaxNumber: string;
    groupMemberTaxNumber?: string;
  };
}

export interface TaxpayerQueryResult {
  success: boolean;
  taxpayer?: TaxpayerDetails;
  error?: string;
}

/**
 * Adóalanyi törzsadatok lekérdezése a NAV Online Számla v3 rendszeréből
 * 8 vagy 11 jegyű magyar adószám alapján.
 *
 * @param taxNumber Magyar adószám (kötőjeles vagy egybefüggő)
 * @param companyId Opcionális hívó cég azonosító (ha van aktív cég)
 */
export async function queryTaxpayerFromNav(
  taxNumber: string,
  companyId?: string
): Promise<TaxpayerQueryResult> {
  const cleanTax = taxNumber.replace(/[^0-9]/g, '').slice(0, 8);
  if (!cleanTax || cleanTax.length !== 8) {
    return {
      success: false,
      error: 'Kérjük, adj meg legalább egy 8-jegyű érvényes magyar adószámot!'
    };
  }

  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData?.session?.access_token;
    if (!token) {
      return {
        success: false,
        error: 'A lekérdezéshez aktív bejelentkezés szükséges.'
      };
    }

    const { data, error } = await supabase.functions.invoke('nav-query-taxpayer', {
      body: {
        taxNumber: cleanTax,
        companyId: companyId || undefined
      },
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    if (error || data?.error) {
      const errMessage = await extractNavSyncError(error, data);
      return {
        success: false,
        error: errMessage
      };
    }

    if (!data?.success || !data?.data) {
      return {
        success: false,
        error: data?.error || 'Nem sikerült az adóalanyi adatok kinyerése.'
      };
    }

    const taxpayer: TaxpayerDetails = data.data;

    if (!taxpayer.taxpayerValidity) {
      return {
        success: false,
        error: 'A megadott adószám nem érvényes vagy nem szerepel a NAV nyilvántartásában.'
      };
    }

    return {
      success: true,
      taxpayer
    };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || 'Váratlan hiba történt a NAV lekérdezés során.'
    };
  }
}
