import { supabase } from '@/integrations/supabase/client';
import { Database, Json } from '@/integrations/supabase/types';

export interface GlBalanceItem {
  gl_account_id: string | null;
  gl_number: string;
  short_name: string;
  total_balance: number;
  final_balance: number;
  temp_balance: number;
  item_count: number;
}

export interface GlCategorizedItem {
  item_id: string;
  gl_account_id: string | null;
  source_table: string;
  item_type: string;
  partner: string | null;
  description: string | null;
  amount: number;
  original_amount: number;
  original_currency: string;
  item_date: string;
  is_temporary: boolean;
  is_excluded?: boolean;
}

export type GlAccountRow = Database['public']['Tables']['gl_accounts']['Row'];
export type GlDateBasis = 'kibocsatas' | 'teljesites';
export type GlPostingStatus = 'all' | 'posted_only';

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
  postingStatus?: GlPostingStatus;
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
        p_posting_status: params.postingStatus === 'posted_only' ? 'POSTED_ONLY' : 'ALL',
      })
      .range(from, to);

    if (error) throw error;

    if (data && data.length > 0) {
      allBalances = allBalances.concat(data as unknown as GlBalanceItem[]);
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
  postingStatus?: GlPostingStatus;
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
        p_posting_status: params.postingStatus === 'posted_only' ? 'POSTED_ONLY' : 'ALL',
      })
      .range(from, to);

    if (error) throw error;

    if (data && data.length > 0) {
      allItems = allItems.concat(data as unknown as GlCategorizedItem[]);
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

export interface FetchGlItemsForAccountParams {
  companyId: string;
  presetId: string;
  glAccountId: string | null;
  dateFrom?: string | null;
  dateTo?: string | null;
  dateBasis?: GlDateBasis;
  postingStatus?: GlPostingStatus;
  exchangeRates?: Record<string, any> | Json;
  limit?: number | null;
  offset?: number;
}

/**
 * Fetch GL categorized items for a single account (on-demand drilldown).
 * Runs in ~30-50ms instead of loading all items across the company.
 * Supports optional limit and offset for chunked / infinite-scroll loading.
 */
export async function fetchGlItemsForAccount(params: FetchGlItemsForAccountParams): Promise<GlCategorizedItem[]> {
  // If an explicit limit is given, perform a single direct SQL query with p_limit and p_offset
  if (params.limit !== undefined && params.limit !== null) {
    const { data, error } = await (supabase.rpc as any)('get_gl_categorized_items', {
      p_company_id: params.companyId,
      p_preset_id: params.presetId,
      p_date_from: params.dateFrom || null,
      p_date_to: params.dateTo || null,
      p_exchange_rates: (params.exchangeRates as Json) || {},
      p_date_basis: params.dateBasis || 'kibocsatas',
      p_posting_status: params.postingStatus === 'posted_only' ? 'POSTED_ONLY' : 'ALL',
      p_gl_account_id: params.glAccountId || '00000000-0000-0000-0000-000000000000',
      p_limit: params.limit,
      p_offset: params.offset ?? 0,
    });

    if (error) throw error;
    return (data || []) as unknown as GlCategorizedItem[];
  }

  // Otherwise, fetch all pages
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
        p_posting_status: params.postingStatus === 'posted_only' ? 'POSTED_ONLY' : 'ALL',
        p_gl_account_id: params.glAccountId || '00000000-0000-0000-0000-000000000000',
      })
      .range(from, to);

    if (error) throw error;

    if (data && data.length > 0) {
      allItems = allItems.concat(data as unknown as GlCategorizedItem[]);
      hasMore = data.length === PAGE_SIZE;
    } else {
      hasMore = false;
    }
    page++;
  }

  return allItems;
}

export interface GlSearchResult {
  entity_type: 'account' | 'item';
  entity_id: string;
  gl_number: string;
  title: string;
  subtitle: string;
  account_id: string | null;
  target_gl_number: string;
  amount: number | null;
  item_type?: string | null;
  item_date?: string | null;
  source_table?: string | null;
  currency?: string | null;
}

export interface SearchGlEntitiesParams {
  companyId: string;
  presetId: string;
  query: string;
  limit?: number;
}

/**
 * Direct database search for GL accounts and journal/invoice items.
 * Debounced backend search for the GL search autocomplete bar.
 */
export async function searchGlEntities(params: SearchGlEntitiesParams): Promise<GlSearchResult[]> {
  const cleanQuery = params.query.trim();
  if (cleanQuery.length < 2) return [];

  const { data, error } = await (supabase.rpc as any)('search_gl_entities', {
    p_company_id: params.companyId,
    p_preset_id: params.presetId,
    p_query: cleanQuery,
    p_limit: params.limit ?? 12,
  });

  if (error) {
    console.error('search_gl_entities error:', error);
    throw error;
  }

  return (data || []) as GlSearchResult[];
}

