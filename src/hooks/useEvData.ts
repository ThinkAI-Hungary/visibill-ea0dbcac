// =============================================================================
// EV Modul – React Query hook-ok
// =============================================================================
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

// ─── Types ──────────────────────────────────────────────────────────────────

export type EvTaxpayerForm = 'atalany' | 'vszja' | 'kata';
export type EvEmploymentStatus = 'foallasu' | 'mellekallasu' | 'kiegeszito';
export type EvVatStatus = 'alanyi_mentes' | 'afas' | 'penzforgalmi';
export type EvCostRatioCategory = 'general' | 'high_80' | 'retail_90';
export type EvOrgType = 'egyesulet' | 'alapitvany' | 'egyhaz' | 'tarsashaz' | 'lakasszov' | 'mrp' | 'egyeb';
export type EvBookkeepingMode = 'egyszeres' | 'kettos';
export type PenztarkonyvDirection = 'bevetel' | 'kiadas';
export type PenztarkonyvCategory =
  | 'bevetel_adokoteles' | 'bevetel_fizetendo_afa' | 'bevetel_be_nem_szamito'
  | 'kiadas_anyag_arubeszerzes' | 'kiadas_kozvetitett_szolgaltatas'
  | 'kiadas_alkalmazott_ber_kozteher' | 'kiadas_vallalkozoi_kivet'
  | 'kiadas_egyeb_koltseg' | 'kiadas_beruhazasi_koltseg'
  | 'kiadas_levonhato_afa' | 'kiadas_egyeb_nem_koltseg';

export interface EvClientSettings {
  id: string;
  company_id: string;
  tax_year: number;
  taxpayer_form: EvTaxpayerForm;
  employment_status: EvEmploymentStatus;
  vat_status: EvVatStatus;
  cost_ratio_category: EvCostRatioCategory | null;
  registration_number: string | null;
  activity_codes: string[];
  main_activity_code: string | null;
  skilled_main_activity: boolean;
  bookkeeping_mode: EvBookkeepingMode;
  org_type: EvOrgType | null;
  is_public_benefit: boolean;
  created_at: string;
  updated_at: string;
}

export interface PenztarkonyvTetel {
  id: string;
  company_id: string;
  tax_year: number;
  serial_number: number;
  entry_date: string;
  document_number: string | null;
  description: string;
  entry_direction: PenztarkonyvDirection;
  main_category: PenztarkonyvCategory;
  amount: number;
  vat_amount: number;
  document_url: string | null;
  period_closed: boolean;
  storno_of_id: string | null;
  is_storno: boolean;
  linked_record_type: string | null;
  linked_record_id: string | null;
  created_at: string;
  created_by: string | null;
}

export interface EvLifecycleEvent {
  id: string;
  company_id: string;
  event_type: 'start' | 'pause' | 'restart' | 'end' | 'form_change';
  event_date: string;
  from_form: EvTaxpayerForm | null;
  to_form: EvTaxpayerForm | null;
  notes: string | null;
  created_at: string;
}

// ─── Hooks ──────────────────────────────────────────────────────────────────

/**
 * Fetch EV settings for a company/tax year
 */
export function useEvClientSettings(companyId: string | undefined, taxYear: number = 2026) {
  return useQuery({
    queryKey: ['ev-client-settings', companyId, taxYear],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('accounty_ev_client_settings')
        .select('*')
        .eq('company_id', companyId!)
        .eq('tax_year', taxYear)
        .maybeSingle();
      if (error) throw error;
      return data as EvClientSettings | null;
    },
    enabled: !!companyId,
  });
}

/**
 * Upsert EV settings
 */
export function useUpdateEvSettings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ['update-ev-settings'],
    mutationFn: async (settings: Partial<EvClientSettings> & { company_id: string; tax_year: number }) => {
      const { data, error } = await supabase
        .from('accounty_ev_client_settings')
        .upsert(settings, { onConflict: 'company_id,tax_year' })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['ev-client-settings', variables.company_id] });
    },
  });
}

/**
 * Fetch lifecycle events for a company
 */
export function useEvLifecycleEvents(companyId: string | undefined) {
  return useQuery({
    queryKey: ['ev-lifecycle-events', companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('accounty_ev_lifecycle_events')
        .select('*')
        .eq('company_id', companyId!)
        .order('event_date', { ascending: true });
      if (error) throw error;
      return (data || []) as EvLifecycleEvent[];
    },
    enabled: !!companyId,
  });
}

/**
 * Fetch pénztárkönyv entries for a company/year
 */
export function useCashbookEntries(
  companyId: string | undefined,
  taxYear: number,
  period?: { from?: string; to?: string },
) {
  return useQuery({
    queryKey: ['cashbook-entries', companyId, taxYear, period],
    queryFn: async () => {
      let query = supabase
        .from('accounty_penztarkonyv_tetel')
        .select('*')
        .eq('company_id', companyId!)
        .eq('tax_year', taxYear)
        .order('serial_number', { ascending: true });

      if (period?.from) query = query.gte('entry_date', period.from);
      if (period?.to) query = query.lte('entry_date', period.to);

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as PenztarkonyvTetel[];
    },
    enabled: !!companyId,
  });
}

/**
 * Fetch cashbook column totals (aggregated)
 */
export function useCashbookTotals(companyId: string | undefined, taxYear: number) {
  return useQuery({
    queryKey: ['cashbook-totals', companyId, taxYear],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('accounty_penztarkonyv_tetel')
        .select('main_category, entry_direction, amount, vat_amount, is_storno')
        .eq('company_id', companyId!)
        .eq('tax_year', taxYear);

      if (error) throw error;

      // Aggregate by category
      const totals: Record<string, number> = {};
      let totalBevetel = 0;
      let totalKiadas = 0;

      (data || []).forEach((row: any) => {
        const multiplier = row.is_storno ? -1 : 1;
        const amount = (row.amount || 0) * multiplier;
        totals[row.main_category] = (totals[row.main_category] || 0) + amount;

        if (row.entry_direction === 'bevetel') totalBevetel += amount;
        else totalKiadas += amount;
      });

      return { totals, totalBevetel, totalKiadas, balance: totalBevetel - totalKiadas };
    },
    enabled: !!companyId,
  });
}

/**
 * Create a new cashbook entry
 */
export function useCreateCashbookEntry() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ['create-cashbook-entry'],
    mutationFn: async (entry: Omit<PenztarkonyvTetel, 'id' | 'created_at' | 'period_closed'>) => {
      const { data, error } = await supabase
        .from('accounty_penztarkonyv_tetel')
        .insert(entry)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['cashbook-entries', variables.company_id] });
      queryClient.invalidateQueries({ queryKey: ['cashbook-totals', variables.company_id] });
    },
  });
}

/**
 * Storno a cashbook entry (for closed periods)
 */
export function useStornoCashbookEntry() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ['storno-cashbook-entry'],
    mutationFn: async ({ originalEntry, correctedEntry }: {
      originalEntry: PenztarkonyvTetel;
      correctedEntry: Omit<PenztarkonyvTetel, 'id' | 'created_at' | 'period_closed'>;
    }) => {
      // 1. Create storno entry (negative of original)
      const stornoEntry = {
        company_id: originalEntry.company_id,
        tax_year: originalEntry.tax_year,
        serial_number: correctedEntry.serial_number,
        entry_date: new Date().toISOString().split('T')[0],
        document_number: `STORNO-${originalEntry.document_number || originalEntry.serial_number}`,
        description: `[STORNO] ${originalEntry.description}`,
        entry_direction: originalEntry.entry_direction,
        main_category: originalEntry.main_category,
        amount: -originalEntry.amount,
        vat_amount: -(originalEntry.vat_amount || 0),
        is_storno: true,
        storno_of_id: originalEntry.id,
        created_by: correctedEntry.created_by,
      };

      const { error: stornoError } = await supabase
        .from('accounty_penztarkonyv_tetel')
        .insert(stornoEntry);
      if (stornoError) throw stornoError;

      // 2. Create corrected entry
      const { data, error: correctedError } = await supabase
        .from('accounty_penztarkonyv_tetel')
        .insert(correctedEntry)
        .select()
        .single();
      if (correctedError) throw correctedError;

      return data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['cashbook-entries', variables.originalEntry.company_id] });
      queryClient.invalidateQueries({ queryKey: ['cashbook-totals', variables.originalEntry.company_id] });
    },
  });
}

/**
 * Close a period
 */
export function useClosePeriod() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ['close-period'],
    mutationFn: async (params: {
      company_id: string;
      tax_year: number;
      period_type: 'monthly' | 'quarterly' | 'annual';
      period_key: string;
      column_totals: Record<string, number>;
      opening_balance: number;
      closing_balance: number;
      closed_by: string;
    }) => {
      // 1. Insert period close record
      const { error: closeError } = await supabase
        .from('accounty_penztarkonyv_period_close')
        .insert({
          company_id: params.company_id,
          tax_year: params.tax_year,
          period_type: params.period_type,
          period_key: params.period_key,
          column_totals: params.column_totals,
          opening_balance: params.opening_balance,
          closing_balance: params.closing_balance,
          closed_by: params.closed_by,
        });
      if (closeError) throw closeError;

      // 2. Mark all entries in the period as closed
      let dateFilter: { from: string; to: string };
      if (params.period_type === 'monthly') {
        dateFilter = {
          from: `${params.period_key}-01`,
          to: `${params.period_key}-31`,
        };
      } else if (params.period_type === 'quarterly') {
        const [year, q] = params.period_key.split('-Q');
        const qNum = parseInt(q);
        const startMonth = (qNum - 1) * 3 + 1;
        const endMonth = qNum * 3;
        dateFilter = {
          from: `${year}-${String(startMonth).padStart(2, '0')}-01`,
          to: `${year}-${String(endMonth).padStart(2, '0')}-31`,
        };
      } else {
        dateFilter = {
          from: `${params.tax_year}-01-01`,
          to: `${params.tax_year}-12-31`,
        };
      }

      const { error: updateError } = await supabase
        .from('accounty_penztarkonyv_tetel')
        .update({ period_closed: true })
        .eq('company_id', params.company_id)
        .eq('tax_year', params.tax_year)
        .gte('entry_date', dateFilter.from)
        .lte('entry_date', dateFilter.to);
      if (updateError) throw updateError;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['cashbook-entries', variables.company_id] });
      queryClient.invalidateQueries({ queryKey: ['cashbook-totals', variables.company_id] });
    },
  });
}

/**
 * Fetch contribution calculations for a company/year
 */
export function useEvContributions(companyId: string | undefined, taxYear: number) {
  return useQuery({
    queryKey: ['ev-contributions', companyId, taxYear],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('accounty_ev_contribution_calc')
        .select('*')
        .eq('company_id', companyId!)
        .eq('tax_year', taxYear)
        .order('quarter', { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: !!companyId,
  });
}

/**
 * Fetch tax returns for a company/year
 */
export function useEvTaxReturns(companyId: string | undefined, taxYear: number) {
  return useQuery({
    queryKey: ['ev-tax-returns', companyId, taxYear],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('accounty_ev_tax_returns')
        .select('*')
        .eq('company_id', companyId!)
        .eq('tax_year', taxYear)
        .order('deadline', { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: !!companyId,
  });
}

// ─── Additional Types ───────────────────────────────────────────────────────

export interface EvFixedAsset {
  id: string;
  company_id: string;
  tax_year: number;
  asset_name: string;
  acquisition_date: string;
  acquisition_cost: number;
  depreciation_rate: number | null;
  accumulated_depreciation: number;
  net_value: number | null;
  disposal_date: string | null;
  disposal_type: string | null;
  is_below_threshold: boolean;
  notes: string | null;
  created_at: string;
}

export interface EvHipaCalc {
  id: string;
  company_id: string;
  tax_year: number;
  assessment_mode: string;
  revenue: number;
  tax_base: number;
  municipality_rate: number;
  tax_amount: number;
  advance_paid: number;
  created_at: string;
  updated_at: string;
}

export interface EvPeriodClose {
  id: string;
  company_id: string;
  tax_year: number;
  period_type: 'monthly' | 'quarterly' | 'annual';
  period_key: string;
  column_totals: Record<string, number>;
  opening_balance: number;
  closing_balance: number;
  closed_at: string;
  closed_by: string | null;
  notes: string | null;
}

export interface EvWageRecord {
  id: string;
  company_id: string;
  tax_year: number;
  record_type: string;
  period_month: number | null;
  gross_amount: number;
  net_amount: number | null;
  tax_amount: number;
  contribution_amount: number;
  cashbook_entry_id: string | null;
  notes: string | null;
  created_at: string;
}

export interface EvVehicleLogEntry {
  id: string;
  company_id: string;
  tax_year: number;
  entry_date: string;
  departure_location: string | null;
  arrival_location: string | null;
  distance_km: number;
  purpose: string;
  is_business: boolean;
  fuel_cost: number;
  vehicle_plate: string | null;
  odometer_start: number | null;
  odometer_end: number | null;
  notes: string | null;
  created_at: string;
}

export interface EvTaxReturn {
  id: string;
  company_id: string;
  tax_year: number;
  return_type: string;
  form_code: string | null;
  period_key: string | null;
  status: string;
  data: Record<string, any>;
  calculated_tax: number;
  paid_amount: number;
  deadline: string | null;
  submitted_at: string | null;
  accepted_at: string | null;
  nav_submission_id: string | null;
  nav_status: string | null;
  created_at: string;
  updated_at: string;
}

export interface EvContributionCalc {
  id: string;
  company_id: string;
  tax_year: number;
  quarter: number;
  ytd_income: number;
  prev_quarters_base: number;
  current_quarter_base: number;
  insurance_months: number;
  monthly_breakdown: any[];
  tb_amount: number;
  szocho_amount: number;
  total_amount: number;
  minimum_base_applied: boolean;
  minimum_base_amount: number;
  created_at: string;
  updated_at: string;
}

export interface EvGlobalTaxParam {
  id: string;
  param_key: string;
  tax_year: number;
  param_value: number;
  description: string | null;
  legal_reference: string | null;
}

export interface EvReceivable {
  id: string;
  company_id: string;
  tax_year: number;
  customer_name: string;
  invoice_number: string | null;
  completion_date: string | null;
  amount: number;
  settlement_date: string | null;
  cashbook_entry_id: string | null;
  notes: string | null;
  created_at: string;
}

export interface EvPayable {
  id: string;
  company_id: string;
  tax_year: number;
  supplier_name: string;
  invoice_number: string | null;
  receipt_date: string | null;
  amount: number;
  payment_date: string | null;
  cashbook_entry_id: string | null;
  notes: string | null;
  created_at: string;
}

// ─── Additional Hooks ───────────────────────────────────────────────────────

/**
 * Fetch fixed assets for a company/year
 */
export function useEvFixedAssets(companyId: string | undefined, taxYear: number) {
  return useQuery({
    queryKey: ['ev-fixed-assets', companyId, taxYear],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('accounty_ev_records_fixed_assets')
        .select('*')
        .eq('company_id', companyId!)
        .eq('tax_year', taxYear)
        .order('acquisition_date', { ascending: true });
      if (error) throw error;
      return (data || []) as EvFixedAsset[];
    },
    enabled: !!companyId,
  });
}

/**
 * Fetch HIPA calculation for a company/year
 */
export function useEvHipaCalc(companyId: string | undefined, taxYear: number) {
  return useQuery({
    queryKey: ['ev-hipa-calc', companyId, taxYear],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('accounty_ev_hipa_calc')
        .select('*')
        .eq('company_id', companyId!)
        .eq('tax_year', taxYear)
        .maybeSingle();
      if (error) throw error;
      return data as EvHipaCalc | null;
    },
    enabled: !!companyId,
  });
}

/**
 * Fetch period closes for a company/year
 */
export function useEvPeriodCloses(companyId: string | undefined, taxYear: number) {
  return useQuery({
    queryKey: ['ev-period-closes', companyId, taxYear],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('accounty_penztarkonyv_period_close')
        .select('*')
        .eq('company_id', companyId!)
        .eq('tax_year', taxYear)
        .order('closed_at', { ascending: true });
      if (error) throw error;
      return (data || []) as EvPeriodClose[];
    },
    enabled: !!companyId,
  });
}

/**
 * Fetch wage records for a company/year
 */
export function useEvWages(companyId: string | undefined, taxYear: number) {
  return useQuery({
    queryKey: ['ev-wages', companyId, taxYear],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('accounty_ev_records_wages')
        .select('*')
        .eq('company_id', companyId!)
        .eq('tax_year', taxYear)
        .order('period_month', { ascending: true });
      if (error) throw error;
      return (data || []) as EvWageRecord[];
    },
    enabled: !!companyId,
  });
}

/**
 * Fetch vehicle log entries for a company/year
 */
export function useEvVehicleLog(companyId: string | undefined, taxYear: number) {
  return useQuery({
    queryKey: ['ev-vehicle-log', companyId, taxYear],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('accounty_ev_records_vehicle_log')
        .select('*')
        .eq('company_id', companyId!)
        .eq('tax_year', taxYear)
        .order('entry_date', { ascending: true });
      if (error) throw error;
      return (data || []) as EvVehicleLogEntry[];
    },
    enabled: !!companyId,
  });
}

/**
 * Fetch global tax params for a year
 */
export function useEvGlobalTaxParams(taxYear: number) {
  return useQuery({
    queryKey: ['ev-global-tax-params', taxYear],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('accounty_global_tax_params')
        .select('*')
        .eq('tax_year', taxYear);
      if (error) throw error;
      // Convert to a map for easy access
      const params: Record<string, number> = {};
      (data || []).forEach((p: any) => {
        params[p.param_key] = p.param_value;
      });
      return params;
    },
  });
}

/**
 * Fetch receivables for a company/year
 */
export function useEvReceivables(companyId: string | undefined, taxYear: number) {
  return useQuery({
    queryKey: ['ev-receivables', companyId, taxYear],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('accounty_ev_records_receivables')
        .select('*')
        .eq('company_id', companyId!)
        .eq('tax_year', taxYear)
        .order('completion_date', { ascending: false });
      if (error) throw error;
      return (data || []) as EvReceivable[];
    },
    enabled: !!companyId,
  });
}

/**
 * Fetch payables for a company/year
 */
export function useEvPayables(companyId: string | undefined, taxYear: number) {
  return useQuery({
    queryKey: ['ev-payables', companyId, taxYear],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('accounty_ev_records_payables')
        .select('*')
        .eq('company_id', companyId!)
        .eq('tax_year', taxYear)
        .order('receipt_date', { ascending: false });
      if (error) throw error;
      return (data || []) as EvPayable[];
    },
    enabled: !!companyId,
  });
}

/**
 * Fetch all EV client settings (portfolio-wide, for the threshold monitor)
 */
export function useAllEvClientSettings(taxYear: number) {
  return useQuery({
    queryKey: ['all-ev-client-settings', taxYear],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('accounty_ev_client_settings')
        .select('*, companies(id, name, tax_number)')
        .eq('tax_year', taxYear);
      if (error) throw error;
      return data || [];
    },
  });
}

/**
 * Fetch YTD revenue per company (for the threshold monitor)
 * Returns a Map<company_id, ytd_revenue> for easy lookup.
 */
export function useEvYtdRevenue(taxYear: number) {
  return useQuery({
    queryKey: ['ev-ytd-revenue', taxYear],
    queryFn: async () => {
      const { data, error } = await supabase
        .rpc('get_ev_ytd_revenue_by_company', { p_tax_year: taxYear });
      if (error) throw error;
      const map = new Map<string, number>();
      (data || []).forEach((row: { company_id: string; ytd_revenue: number }) => {
        map.set(row.company_id, Number(row.ytd_revenue) || 0);
      });
      return map;
    },
  });
}

/**
 * Fetch all tax returns (portfolio-wide)
 */
export function useAllEvTaxReturns(taxYear: number) {
  return useQuery({
    queryKey: ['all-ev-tax-returns', taxYear],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('accounty_ev_tax_returns')
        .select('*, companies(id, name)')
        .eq('tax_year', taxYear)
        .order('deadline', { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });
}

// ─── Record Type → DB Table mapping ────────────────────────────────────────

export const RECORD_TABLE_MAP: Record<string, string> = {
  'vevo-szallito': 'accounty_ev_records_receivables',
  'tao-kesz': 'accounty_ev_records_fixed_assets',
  'keszlet': 'accounty_ev_records_inventory',
  'utnyilv': 'accounty_ev_records_vehicle_log',
  'berbeadas': 'accounty_ev_records_other_claims', // Bérbeadás → egyéb követelések
  'valuta': 'accounty_ev_records_other_claims',    // Valutapénztár → egyéb követelések
  'munkaber': 'accounty_ev_records_wages',
  'selejtezes': 'accounty_ev_records_scrapping',
  'lekerdezes': 'accounty_ev_audit_log',           // Lekérdezés napló → audit log
  'jog-bizt': 'accounty_ev_records_wages',         // Bizt. jogviszony → wages (record_type filter)
};

/**
 * Generic hook: fetch records from any EV record table by record type key.
 * Returns the raw rows from the DB.
 */
export function useEvRecords(companyId: string | undefined, recordType: string, taxYear: number = 2026) {
  const tableName = RECORD_TABLE_MAP[recordType];
  return useQuery({
    queryKey: ['ev-records', companyId, recordType, taxYear],
    queryFn: async () => {
      if (!tableName) return [];
      const { data, error } = await supabase
        .from(tableName as any)
        .select('*')
        .eq('company_id', companyId!)
        .eq('tax_year', taxYear)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as Record<string, any>[];
    },
    enabled: !!companyId && !!tableName,
  });
}

/**
 * Generic mutation: insert a record into any EV record table.
 */
export function useCreateEvRecord() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ['create-ev-record'],
    mutationFn: async ({ recordType, data }: { recordType: string; data: Record<string, any> }) => {
      const tableName = RECORD_TABLE_MAP[recordType];
      if (!tableName) throw new Error(`Unknown record type: ${recordType}`);
      const { data: result, error } = await supabase
        .from(tableName as any)
        .insert(data)
        .select()
        .single();
      if (error) throw error;
      return result;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['ev-records'] });
      queryClient.invalidateQueries({ queryKey: ['ev-record-counts'] });
    },
  });
}

/**
 * Generic mutation: update a record in any EV record table.
 */
export function useUpdateEvRecord() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ['update-ev-record'],
    mutationFn: async ({ recordType, id, data }: { recordType: string; id: string; data: Record<string, any> }) => {
      const tableName = RECORD_TABLE_MAP[recordType];
      if (!tableName) throw new Error(`Unknown record type: ${recordType}`);
      const { data: result, error } = await supabase
        .from(tableName as any)
        .update(data)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ev-records'] });
    },
  });
}

/**
 * Generic mutation: delete a record from any EV record table.
 */
export function useDeleteEvRecord() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ['delete-ev-record'],
    mutationFn: async ({ recordType, id }: { recordType: string; id: string }) => {
      const tableName = RECORD_TABLE_MAP[recordType];
      if (!tableName) throw new Error(`Unknown record type: ${recordType}`);
      const { error } = await supabase
        .from(tableName as any)
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ev-records'] });
      queryClient.invalidateQueries({ queryKey: ['ev-record-counts'] });
    },
  });
}

/**
 * Fetch ÁFA bevallás records for a company/tax year.
 */
export function useEvVatReturns(companyId: string | undefined, taxYear: number = 2026) {
  return useQuery({
    queryKey: ['ev-vat-returns', companyId, taxYear],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('accounty_ev_vat_returns')
        .select('*')
        .eq('company_id', companyId!)
        .eq('tax_year', taxYear)
        .order('deadline', { ascending: true });
      if (error) throw error;
      return (data || []) as {
        id: string;
        period_key: string;
        status: 'upcoming' | 'draft' | 'submitted' | 'accepted';
        input_vat: number;
        output_vat: number;
        payable: number;
        deadline: string;
      }[];
    },
    enabled: !!companyId,
  });
}

/**
 * Fetch kamarai befizetések for a company.
 */
export function useEvChamberPayments(companyId: string | undefined) {
  return useQuery({
    queryKey: ['ev-chamber-payments', companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('accounty_ev_chamber_payments')
        .select('*')
        .eq('company_id', companyId!)
        .order('tax_year', { ascending: false });
      if (error) throw error;
      return (data || []) as {
        id: string;
        tax_year: number;
        amount: number;
        deadline: string | null;
        paid_date: string | null;
        status: 'pending' | 'paid' | 'overdue';
        chamber_name: string | null;
        membership_number: string | null;
      }[];
    },
    enabled: !!companyId,
  });
}

/**
 * Fetch szervezeti beszámoló sorok (mérleg + eredménykimutatás).
 */
export function useOrgReportLines(companyId: string | undefined, taxYear: number = 2026, reportType?: string) {
  return useQuery({
    queryKey: ['org-report-lines', companyId, taxYear, reportType],
    queryFn: async () => {
      let query = supabase
        .from('accounty_org_report_lines')
        .select('*')
        .eq('company_id', companyId!)
        .eq('tax_year', taxYear)
        .order('sort_order', { ascending: true });

      if (reportType) {
        query = query.eq('report_type', reportType);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as {
        id: string;
        report_type: 'balance_asset' | 'balance_liability' | 'income_statement';
        line_code: string;
        line_name: string;
        indent_level: number;
        is_total_line: boolean;
        is_bold: boolean;
        current_year_amount: number;
        previous_year_amount: number;
      }[];
    },
    enabled: !!companyId,
  });
}

/**
 * Fetch counts of entries for all EV registers.
 */
export function useEvRecordCounts(companyId: string | undefined, taxYear: number = 2026) {
  return useQuery({
    queryKey: ['ev-record-counts', companyId, taxYear],
    queryFn: async () => {
      if (!companyId) return {} as Record<string, number>;

      const getCount = async (table: string, filterField?: string, filterVal?: any) => {
        let q = supabase
          .from(table as any)
          .select('*', { count: 'exact', head: true })
          .eq('company_id', companyId);

        if (table !== 'accounty_ev_audit_log') {
          q = q.eq('tax_year', taxYear);
        }

        if (filterField && filterVal !== undefined) {
          q = q.eq(filterField, filterVal);
        }

        const { count, error } = await q;
        if (error) {
          console.error(`Error fetching count for ${table}:`, error);
          return 0;
        }
        return count || 0;
      };

      const [
        vevo,
        assets,
        inventory,
        log,
        claims,
        wages,
        cashbook,
        scrapping,
        auditLog
      ] = await Promise.all([
        getCount('accounty_ev_records_receivables'),
        getCount('accounty_ev_records_fixed_assets'),
        getCount('accounty_ev_records_inventory'),
        getCount('accounty_ev_records_vehicle_log'),
        getCount('accounty_ev_records_other_claims'),
        getCount('accounty_ev_records_wages'),
        getCount('accounty_penztarkonyv_tetel'),
        getCount('accounty_ev_records_scrapping'),
        getCount('accounty_ev_audit_log'),
      ]);

      return {
        'vevo-szallito': vevo,
        'tao-kesz': assets,
        'keszlet': inventory,
        'utnyilv': log,
        'berbeadas': Math.round(claims / 2),
        'valuta': Math.round(claims / 2),
        'munkaber': Math.round(wages / 2),
        'penztarkonyv': cashbook,
        'selejtezes': scrapping,
        'lekerdezes': auditLog,
        'jog-bizt': Math.round(wages / 2),
      };
    },
    enabled: !!companyId,
  });
}
