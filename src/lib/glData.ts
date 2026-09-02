import { supabase } from '@/integrations/supabase/client';
import { Database, Json } from '@/integrations/supabase/types';

export type GlBalanceItem = Database['public']['Functions']['get_gl_balances']['Returns'][number];
export type GlCategorizedItem = Database['public']['Functions']['get_gl_categorized_items']['Returns'][number] & {
  is_excluded?: boolean;
};
export type GlAccountRow = Database['public']['Tables']['gl_accounts']['Row'];
export type GlDateBasis = 'kibocsatas' | 'teljesites';

const PAGE_SIZE = 1000;

/**
 * Fetch all GL balances by preset and company, automatically paginating
 * across PostgREST's default 1000-row limit.
 */
export async function fetchAllGlBalances(params: {
  companyId: string;
  presetId: string;
  dateFrom?: string | null;
  dateTo?: string | null;
  dateBasis?: GlDateBasis;
  exchangeRates?: Record<string, any> | Json;
}): Promise<GlBalanceItem[]> {
  let allBalances: GlBalanceItem[] = [];
  let page = 0;
  let hasMore = true;

  while (hasMore) {
    const from = page * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    const { data, error } = await supabase
      .rpc('get_gl_balances', {
        p_company_id: params.companyId,
        p_preset_id: params.presetId,
        p_date_from: params.dateFrom || null,
        p_date_to: params.dateTo || null,
        p_exchange_rates: (params.exchangeRates as Json) || {},
        p_date_basis: params.dateBasis || 'kibocsatas',
      })
      .range(from, to);

    if (error) throw error;

    if (data && data.length > 0) {
      allBalances = allBalances.concat(data);
      hasMore = data.length === PAGE_SIZE;
    } else {
      hasMore = false;
    }
    page++;
  }

  return allBalances;
}

/**
 * Fetch all categorized GL items by preset and company with pagination.
 */
export async function fetchAllGlCategorizedItems(params: {
  companyId: string;
  presetId: string;
  dateFrom?: string | null;
  dateTo?: string | null;
  dateBasis?: GlDateBasis;
  exchangeRates?: Record<string, any> | Json;
}): Promise<GlCategorizedItem[]> {
  let allItems: GlCategorizedItem[] = [];
  let page = 0;
  let hasMore = true;

  while (hasMore) {
    const from = page * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    const { data, error } = await supabase
      .rpc('get_gl_categorized_items', {
        p_company_id: params.companyId,
        p_preset_id: params.presetId,
        p_date_from: params.dateFrom || null,
        p_date_to: params.dateTo || null,
        p_exchange_rates: (params.exchangeRates as Json) || {},
        p_date_basis: params.dateBasis || 'kibocsatas',
      })
      .range(from, to);

    if (error) throw error;

    if (data && data.length > 0) {
      allItems = allItems.concat(data);
      hasMore = data.length === PAGE_SIZE;
    } else {
      hasMore = false;
    }
    page++;
  }

  return allItems;
}

/**
 * Fetch all GL accounts for a given preset with pagination (handles >1000 accounts).
 */
export async function fetchAllGlAccountsByPreset(presetId: string): Promise<GlAccountRow[]> {
  let allAccounts: GlAccountRow[] = [];
  let page = 0;
  let hasMore = true;

  while (hasMore) {
    const from = page * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    const { data, error } = await supabase
      .from('gl_accounts')
      .select('*')
      .eq('preset_id', presetId)
      .order('gl_number')
      .range(from, to);

    if (error) throw error;

    if (data && data.length > 0) {
      allAccounts = allAccounts.concat(data);
      hasMore = data.length === PAGE_SIZE;
    } else {
      hasMore = false;
    }
    page++;
  }

  return allAccounts;
}
