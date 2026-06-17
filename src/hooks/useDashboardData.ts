import { useMemo, useCallback, useRef } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryKeys';
import { useAuth } from '@/contexts/AuthContext';
import { useCompany } from '@/contexts/CompanyContext';
import { useDateRange } from '@/contexts/DateRangeContext';
import { supabase } from '@/integrations/supabase/client';
import { startOfYear, endOfYear, parseISO } from 'date-fns';

// Paginated fetch helper for tables that may exceed the Supabase default 1000 row limit.
// Keep the query type intentionally loose: Supabase's generated table union can become
// excessively deep when threaded through a reusable generic helper.
async function fetchAllRows<T>(query: () => any): Promise<T[]> {
  const PAGE_SIZE = 1000;
  const all: T[] = [];
  let from = 0;

  while (true) {
    const { data, error } = await (query() as any).range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    const page = (data || []) as T[];
    all.push(...page);
    if (page.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  return all;
}

// ── Types ──

export interface Profile {
  name: string;
  position: string;
  company: string;
  avatar_url: string;
}

export interface DashboardMetrics {
  totalInvoices: number;
  totalAmountByCurrency: { [currency: string]: number };
  thisMonthAmountByCurrency: { [currency: string]: number };
  averageInvoiceAmount: number;
  processingCount: number;
  completedCount: number;
}

export interface NavVatData {
  inboundVat: { [currency: string]: number };
  outboundVat: { [currency: string]: number };
  revenueNet: { [currency: string]: number };
  revenueGross: { [currency: string]: number };
  expensesNet: { [currency: string]: number };
  expensesGross: { [currency: string]: number };
  unpaidInboundNet: { [currency: string]: number };
  unpaidInboundGross: { [currency: string]: number };
  unpaidOutboundNet: { [currency: string]: number };
  unpaidOutboundGross: { [currency: string]: number };
}

export interface VatCategoryData {
  rate: string;
  vatAmount: number;
  netAmount: number;
}

export interface VatBreakdownResult {
  outboundVatCategories: VatCategoryData[];
  inboundVatCategories: VatCategoryData[];
  totalOutboundVat: number;
  totalInboundVat: number;
}

export interface MonthlyData {
  month: string;
  monthIndex: number;
  revenuePaid: number;
  revenueUnpaid: number;
  expensesPaid: number;
  expensesUnpaid: number;
  salaries: number;
  cashFlow: number;
}

interface Category {
  id: string;
  name: string;
  description: string;
  created_at: string;
}

export interface Invoice {
  id: string;
  bizonylatsorszam: string;
  elado_nev: string;
  vevo_nev: string;
  brutto_vegosszeg: number;
  kibocsatas_datuma: string;
  statusz: string;
  penznem?: string;
  category_id?: string;
  image_url?: string;
}

interface RawInvoice {
  invoice_issue_date: string | null;
  invoice_direction: string | null;
  invoice_gross_amount: number | null;
  invoice_net_amount: number | null;
  transaction_id: string | null;
  currency: string | null;
}

interface RawSalary {
  dátum: string | null;
  összeg: number;
  statusz: string | null;
}

const MONTH_NAMES = ["január", "február", "március", "április", "május", "június", "július", "augusztus", "szeptember", "október", "november", "december"];

export function useDashboardData() {
  const { user } = useAuth();
  const { selectedCompany, companies, loading: companyLoading } = useCompany();
  const { dateFrom, dateTo, dateFromFormatted, dateToFormatted } = useDateRange();

  const companyId = selectedCompany?.id || '';

  // Chart always shows full current year
  const chartYearFromStr = useMemo(() => `${new Date().getFullYear()}-01-01`, []);
  const chartYearToStr = useMemo(() => `${new Date().getFullYear()}-12-31`, []);

  // ── Exchange rates ──
  const { data: exchangeRates = {} } = useQuery({
    queryKey: queryKeys.exchangeRates(),
    queryFn: async () => {
      const response = await fetch('https://api.exchangerate-api.com/v4/latest/HUF');
      const data = await response.json();
      return data.rates as { [key: string]: number };
    },
    staleTime: 60 * 60 * 1000,
    placeholderData: keepPreviousData,
  });

  // ── Profile ──
  const { data: profile } = useQuery({
    queryKey: queryKeys.profile(user?.id || ''),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('name, position, company, avatar_url')
        .eq('user_id', user!.id)
        .single();
      if (error) throw error;
      return data as Profile;
    },
    enabled: !!user,
    placeholderData: keepPreviousData,
  });

  // ── Tour status ──
  const { data: tourCompleted } = useQuery({
    queryKey: queryKeys.tourStatus(user?.id || '', companyId),
    queryFn: async () => {
      const { data } = await supabase
        .from('profiles')
        .select('has_completed_tour')
        .eq('user_id', user!.id)
        .single();
      return data?.has_completed_tour ?? true;
    },
    enabled: !!user && !!selectedCompany,
    staleTime: Infinity,
    placeholderData: keepPreviousData,
  });

  // ── Categories ──
  const { data: categories = [] } = useQuery({
    queryKey: queryKeys.categories(companyId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('categories')
        .select('id, name, description')
        .eq('company_id', companyId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as Category[];
    },
    enabled: !!user && !!companyId,
    placeholderData: keepPreviousData,
  });

  // ── Recent invoices ──
  const { data: invoices = [] } = useQuery({
    queryKey: queryKeys.recentInvoices(companyId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('invoices')
        .select('id, bizonylatsorszam, elado_nev, vevo_nev, brutto_vegosszeg, kibocsatas_datuma, statusz, penznem, category_id, image_url, reference_number, categories(name)')
        .eq('company_id', companyId)
        .order('kibocsatas_datuma', { ascending: false })
        .limit(10);
      if (error) throw error;
      return (data || []).map(invoice => ({
        ...invoice,
        category_name: (invoice as any).categories?.name
      })) as Invoice[];
    },
    enabled: !!user && !!companyId,
    placeholderData: keepPreviousData,
  });

  // ── Metrics ──
  const { data: metrics, isLoading: metricsLoading } = useQuery({
    queryKey: queryKeys.dashboardData(companyId, dateFromFormatted, dateToFormatted),
    queryFn: async () => {
      const { data: invoiceAggregates, error } = await supabase
        .rpc('get_invoice_aggregates', {
          p_company_id: companyId,
          p_date_from: dateFromFormatted,
          p_date_to: dateToFormatted
        });
      if (error) throw error;

      const selectedPeriodAmountByCurrency: { [key: string]: number } = {};
      let totalInvoices = 0;
      let processingCount = 0;
      let completedCount = 0;

      (invoiceAggregates || []).forEach((agg: any) => {
        const currency = agg.currency || 'HUF';
        selectedPeriodAmountByCurrency[currency] = (selectedPeriodAmountByCurrency[currency] || 0) + Number(agg.total_gross || 0);
        totalInvoices += Number(agg.total_count || 0);
        processingCount += Number(agg.processing_count || 0);
        completedCount += Number(agg.completed_count || 0);
      });

      return {
        totalInvoices,
        totalAmountByCurrency: selectedPeriodAmountByCurrency,
        thisMonthAmountByCurrency: selectedPeriodAmountByCurrency,
        averageInvoiceAmount: 0,
        processingCount,
        completedCount
      } as DashboardMetrics;
    },
    enabled: !!user && !!companyId,
    placeholderData: keepPreviousData,
  });

  // ── NAV aggregates ──
  const { data: navVatData } = useQuery({
    queryKey: queryKeys.dashboardAnalytics(companyId, dateFromFormatted, dateToFormatted),
    queryFn: async () => {
      const { data: navAggregates, error } = await supabase
        .rpc('get_nav_invoice_aggregates', {
          p_company_id: companyId,
          p_date_from: dateFromFormatted,
          p_date_to: dateToFormatted
        });
      if (error) throw error;

      const inboundVat: { [currency: string]: number } = {};
      const outboundVat: { [currency: string]: number } = {};
      const revenueNet: { [currency: string]: number } = {};
      const revenueGross: { [currency: string]: number } = {};
      const expensesNet: { [currency: string]: number } = {};
      const expensesGross: { [currency: string]: number } = {};
      const unpaidInboundNet: { [currency: string]: number } = {};
      const unpaidInboundGross: { [currency: string]: number } = {};
      const unpaidOutboundNet: { [currency: string]: number } = {};
      const unpaidOutboundGross: { [currency: string]: number } = {};

      (navAggregates || []).forEach((agg: any) => {
        const currency = agg.currency || 'HUF';
        const vatAmount = Number(agg.total_vat || 0);
        const netAmount = Number(agg.total_net || 0);
        const grossAmount = Number(agg.total_gross || 0);
        const unpaidNet = Number(agg.unpaid_net || 0);
        const unpaidGross = Number(agg.unpaid_gross || 0);

        if (agg.invoice_direction === 'INBOUND') {
          inboundVat[currency] = (inboundVat[currency] || 0) + vatAmount;
          expensesNet[currency] = (expensesNet[currency] || 0) + netAmount;
          expensesGross[currency] = (expensesGross[currency] || 0) + grossAmount;
          unpaidInboundNet[currency] = (unpaidInboundNet[currency] || 0) + unpaidNet;
          unpaidInboundGross[currency] = (unpaidInboundGross[currency] || 0) + unpaidGross;
        } else if (agg.invoice_direction === 'OUTBOUND') {
          outboundVat[currency] = (outboundVat[currency] || 0) + vatAmount;
          revenueNet[currency] = (revenueNet[currency] || 0) + netAmount;
          revenueGross[currency] = (revenueGross[currency] || 0) + grossAmount;
          unpaidOutboundNet[currency] = (unpaidOutboundNet[currency] || 0) + unpaidNet;
          unpaidOutboundGross[currency] = (unpaidOutboundGross[currency] || 0) + unpaidGross;
        }
      });

      return { inboundVat, outboundVat, revenueNet, revenueGross, expensesNet, expensesGross, unpaidInboundNet, unpaidInboundGross, unpaidOutboundNet, unpaidOutboundGross } as NavVatData;
    },
    enabled: !!user && !!companyId,
    placeholderData: keepPreviousData,
  });

  // ── Petty cash (computed from raw tables, no RPC) ──
  const { data: pettyCashBalances = [] } = useQuery<{ currency: string; balance: number }[]>({
    queryKey: queryKeys.dashboardPettyCash(companyId),
    queryFn: async () => {
      console.log('[Dashboard] Computing petty cash from raw tables for company:', companyId);

      const [regRes, obRes, entRes] = await Promise.all([
        supabase.from('petty_cash_registers' as any).select('id').eq('company_id', companyId),
        supabase.from('petty_cash_opening_balances' as any).select('register_id, currency, amount'),
        supabase.from('petty_cash_entries' as any).select('register_id, currency, amount').eq('company_id', companyId),
      ]);

      console.log('[Dashboard] Registers:', regRes.data?.length, 'error:', regRes.error?.message);
      console.log('[Dashboard] Opening balances:', obRes.data?.length, 'error:', obRes.error?.message);
      console.log('[Dashboard] Entries:', entRes.data?.length, 'error:', entRes.error?.message);

      const regIds = new Set((regRes.data || []).map((r: any) => r.id));
      if (regIds.size === 0) {
        console.warn('[Dashboard] No registers found — petty cash will be empty');
        return [];
      }

      const byCurrency: Record<string, number> = {};

      (obRes.data || []).forEach((ob: any) => {
        if (!regIds.has(ob.register_id)) return;
        const cur = ob.currency || 'HUF';
        byCurrency[cur] = (byCurrency[cur] || 0) + Number(ob.amount || 0);
      });

      (entRes.data || []).forEach((e: any) => {
        if (!regIds.has(e.register_id)) return;
        const cur = e.currency || 'HUF';
        byCurrency[cur] = (byCurrency[cur] || 0) + Number(e.amount || 0);
      });

      // Round HUF to nearest 5
      Object.keys(byCurrency).forEach(cur => {
        if (cur === 'HUF') byCurrency[cur] = Math.round(byCurrency[cur] / 5) * 5;
      });

      const result = Object.entries(byCurrency)
        .map(([currency, balance]) => ({ currency, balance }))
        .sort((a, b) => a.currency === 'HUF' ? -1 : b.currency === 'HUF' ? 1 : a.currency.localeCompare(b.currency));
      console.log('[Dashboard] Petty cash result:', result);
      return result;
    },
    enabled: !!user && !!companyId,
    staleTime: 0,
  });

  // ── FX Differences (devizás árfolyam-különbözet) ──
  // Auto-fetches MNB rates if the daily_exchange_rates table is empty.
  const fxRatesFetchedRef = useRef(false);

  const { data: fxDifferences = [], refetch: refetchFx } = useQuery<any[]>({
    queryKey: queryKeys.fxDifferences(companyId, dateFromFormatted, dateToFormatted),
    queryFn: async () => {
      // 1. Check if daily_exchange_rates has any data
      const { count } = await supabase
        .from('daily_exchange_rates' as any)
        .select('id', { count: 'exact', head: true })
        .limit(1);

      // 2. If no rates exist and we haven't tried fetching yet, auto-fetch from MNB
      if ((count === null || count === 0) && !fxRatesFetchedRef.current) {
        fxRatesFetchedRef.current = true;
        console.log('[FX] No MNB rates found, auto-fetching...');
        try {
          const { data: session } = await supabase.auth.getSession();
          const token = session?.session?.access_token;
          if (token) {
            await supabase.functions.invoke('fetch-mnb-rates', {
              headers: { Authorization: `Bearer ${token}` },
              body: {
                date_from: `${new Date().getFullYear() - 1}-01-01`,
                date_to: new Date().toISOString().split('T')[0],
              },
            });
            console.log('[FX] MNB rates fetched successfully');
          }
        } catch (e) {
          console.warn('[FX] Failed to auto-fetch MNB rates:', e);
        }
      }

      // 3. Now query the actual FX differences
      const { data, error } = await supabase.rpc('get_fx_differences', {
        p_company_id: companyId,
        p_date_from: dateFromFormatted,
        p_date_to: dateToFormatted,
      });
      if (error) throw error;
      return (data || []) as any[];
    },
    enabled: !!user && !!companyId,
    placeholderData: keepPreviousData,
  });

  // ── FX Monthly Summary (havi összesítés) ──
  const fxMonthlySummary = useMemo(() => {
    const months: Record<string, { month: string; gain: number; loss: number; net: number; count: number }> = {};
    (fxDifferences || []).forEach((row: any) => {
      const m = row.settlement_month || 'unknown';
      if (!months[m]) months[m] = { month: m, gain: 0, loss: 0, net: 0, count: 0 };
      const diff = Number(row.fx_difference || 0);
      if (diff > 0) months[m].gain += diff;
      else months[m].loss += diff;
      months[m].net += diff;
      months[m].count += 1;
    });
    return Object.values(months).sort((a, b) => a.month.localeCompare(b.month));
  }, [fxDifferences]);

  // ── Analytics raw data (always full current year) ──
  const { data: analyticsRaw, isLoading: analyticsLoading } = useQuery({
    queryKey: queryKeys.analyticsRaw(companyId, chartYearFromStr, chartYearToStr),
    queryFn: async () => {
      const [navInvoices, salRes, invRes] = await Promise.all([
        // Paginated fetch for nav_invoices (may exceed 1000 rows for larger companies)
        fetchAllRows<RawInvoice & { invoice_number?: string | null }>(
          () => supabase.from("nav_invoices")
            .select("invoice_issue_date, invoice_direction, invoice_gross_amount, invoice_net_amount, transaction_id, currency, invoice_number")
            .eq("company_id", companyId)
            .gte("invoice_issue_date", chartYearFromStr)
            .lte("invoice_issue_date", chartYearToStr)
        ),
        supabase.from("salary")
          .select("dátum, összeg, statusz, transaction_id, fizetesi_mod")
          .eq("company_id", companyId)
          .or("transaction_id.not.is.null,fizetesi_mod.eq.készpénz")
          .gte("dátum", chartYearFromStr)
          .lte("dátum", chartYearToStr),
        supabase.from("invoices")
          .select("kibocsatas_datuma, invoice_direction, brutto_vegosszeg, adoalap_osszesen, fizetve, transaction_id, penznem, bizonylatsorszam")
          .eq("company_id", companyId)
          .eq("invoice_direction", "INBOUND")
          .neq("invoice_type", "garanciajegy")
          .gte("kibocsatas_datuma", chartYearFromStr)
          .lte("kibocsatas_datuma", chartYearToStr)
      ]);

      const rawInvoices: RawInvoice[] = [...navInvoices];

      const navInvoiceNumbers = new Set(
        navInvoices.map(n => n.invoice_number?.replace(/\s+/g, '')).filter(Boolean)
      );

      const invoices = invRes.data || [];
      invoices.forEach((inv) => {
        const cleanBizonylatsorszam = inv.bizonylatsorszam?.replace(/\s+/g, '');
        if (cleanBizonylatsorszam && !navInvoiceNumbers.has(cleanBizonylatsorszam)) {
          const isPaid = inv.fizetve === true || !!inv.transaction_id;
          rawInvoices.push({
            invoice_issue_date: inv.kibocsatas_datuma,
            invoice_direction: inv.invoice_direction,
            invoice_gross_amount: inv.brutto_vegosszeg,
            invoice_net_amount: inv.adoalap_osszesen,
            transaction_id: isPaid ? "dummy_paid_id" : null,
            currency: inv.penznem,
          });
        }
      });

      return {
        rawInvoices,
        rawSalaries: (salRes.data || []).map((s: any) => ({ dátum: s.dátum, összeg: s.összeg, statusz: s.statusz })) as RawSalary[],
      };
    },
    enabled: !!user && !!companyId,
    staleTime: 30_000,
  });

  // ── VAT breakdown ──
  const { data: vatBreakdown } = useQuery({
    queryKey: queryKeys.analyticsVat(companyId, dateFromFormatted, dateToFormatted),
    queryFn: async () => {
      const [itemsRes, headersRes, unmatchedInvRes] = await Promise.all([
        supabase
          .from("nav_invoice_items")
          .select(`vat_rate, net_amount, vat_amount, nav_invoices!inner (id, invoice_direction, invoice_issue_date, company_id)`)
          .eq("nav_invoices.company_id", companyId)
          .gte("nav_invoices.invoice_issue_date", dateFromFormatted)
          .lte("nav_invoices.invoice_issue_date", dateToFormatted),
        supabase
          .from("nav_invoices")
          .select("id, invoice_direction, invoice_vat_amount, invoice_net_amount, invoice_number")
          .eq("company_id", companyId)
          .gte("invoice_issue_date", dateFromFormatted)
          .lte("invoice_issue_date", dateToFormatted),
        // Also fetch submitted INBOUND invoices to find unmatched ones
        supabase
          .from("invoices")
          .select("bizonylatsorszam, afa_osszeg_osszesen, adoalap_osszesen, invoice_direction")
          .eq("company_id", companyId)
          .eq("invoice_direction", "INBOUND")
          .neq("invoice_type", "garanciajegy")
          .gte("kibocsatas_datuma", dateFromFormatted)
          .lte("kibocsatas_datuma", dateToFormatted),
      ]);

      const vatItems = itemsRes.data || [];
      const allNavInvoices = headersRes.data || [];

      // Build set of NAV invoice numbers for matching
      const navInvoiceNumbers = new Set(
        allNavInvoices.map(n => (n as any).invoice_number?.replace(/\s+/g, '')).filter(Boolean)
      );

      // Find unmatched INBOUND invoices (foreign invoices not in NAV)
      const unmatchedInvoices = (unmatchedInvRes.data || []).filter((inv: any) => {
        const clean = inv.bizonylatsorszam?.replace(/\s+/g, '');
        return clean && !navInvoiceNumbers.has(clean);
      });

      // Sum unmatched invoices VAT and net for the inbound side
      let unmatchedInVat = 0, unmatchedInNet = 0;
      unmatchedInvoices.forEach((inv: any) => {
        unmatchedInVat += inv.afa_osszeg_osszesen || 0;
        unmatchedInNet += inv.adoalap_osszesen || 0;
      });

      let headerOutVat = 0, headerInVat = 0, headerOutNet = 0, headerInNet = 0;
      allNavInvoices.forEach(inv => {
        if (inv.invoice_direction === 'OUTBOUND') {
          headerOutVat += inv.invoice_vat_amount || 0;
          headerOutNet += inv.invoice_net_amount || 0;
        } else {
          headerInVat += inv.invoice_vat_amount || 0;
          headerInNet += inv.invoice_net_amount || 0;
        }
      });

      // Add unmatched invoices to inbound totals
      headerInVat += unmatchedInVat;
      headerInNet += unmatchedInNet;

      if (vatItems.length > 0 || unmatchedInvoices.length > 0) {
        const outboundByRate: Record<string, { netAmount: number; vatAmount: number }> = {};
        const inboundByRate: Record<string, { netAmount: number; vatAmount: number }> = {};
        const itemsVatByInvoice: Record<string, { vatSum: number; netSum: number; direction: string }> = {};

        vatItems.forEach(item => {
          const navInvoice = item.nav_invoices as unknown as { id: string; invoice_direction: string };
          const direction = navInvoice?.invoice_direction;
          const invoiceId = navInvoice?.id;

          if (invoiceId) {
            if (!itemsVatByInvoice[invoiceId]) {
              itemsVatByInvoice[invoiceId] = { vatSum: 0, netSum: 0, direction: direction || 'INBOUND' };
            }
            itemsVatByInvoice[invoiceId].vatSum += item.vat_amount || 0;
            itemsVatByInvoice[invoiceId].netSum += item.net_amount || 0;
          }

          let rateLabel: string;
          if (item.vat_rate === null || item.vat_rate === undefined) {
            rateLabel = 'ÁFA mentes';
          } else {
            const ratePercent = Math.round(Number(item.vat_rate) * 100);
            rateLabel = `${ratePercent}%`;
          }

          const target = direction === 'OUTBOUND' ? outboundByRate : inboundByRate;
          if (!target[rateLabel]) target[rateLabel] = { netAmount: 0, vatAmount: 0 };
          target[rateLabel].netAmount += item.net_amount || 0;
          target[rateLabel].vatAmount += item.vat_amount || 0;
        });

        let gapOutVat = 0, gapOutNet = 0, gapInVat = 0, gapInNet = 0;
        allNavInvoices.forEach(inv => {
          const headerVat = inv.invoice_vat_amount || 0;
          const headerNet = inv.invoice_net_amount || 0;
          const itemData = itemsVatByInvoice[inv.id];
          const itemVat = itemData ? itemData.vatSum : 0;
          const itemNet = itemData ? itemData.netSum : 0;
          const vatGap = headerVat - itemVat;
          const netGap = headerNet - itemNet;
          if (Math.abs(vatGap) > 0.01 || Math.abs(netGap) > 0.01) {
            if (inv.invoice_direction === 'OUTBOUND') {
              gapOutVat += vatGap;
              gapOutNet += netGap;
            } else {
              gapInVat += vatGap;
              gapInNet += netGap;
            }
          }
        });

        // Add unmatched invoices VAT as a gap (they have no nav_invoice_items)
        gapInVat += unmatchedInVat;
        gapInNet += unmatchedInNet;

        if (Math.abs(gapOutVat) > 0.01 || Math.abs(gapOutNet) > 0.01) {
          if (!outboundByRate['Nem részletezett']) outboundByRate['Nem részletezett'] = { netAmount: 0, vatAmount: 0 };
          outboundByRate['Nem részletezett'].netAmount += gapOutNet;
          outboundByRate['Nem részletezett'].vatAmount += gapOutVat;
        }
        if (Math.abs(gapInVat) > 0.01 || Math.abs(gapInNet) > 0.01) {
          if (!inboundByRate['Nem részletezett']) inboundByRate['Nem részletezett'] = { netAmount: 0, vatAmount: 0 };
          inboundByRate['Nem részletezett'].netAmount += gapInNet;
          inboundByRate['Nem részletezett'].vatAmount += gapInVat;
        }

        const sortOrder = ['ÁFA mentes', '5%', '18%', '27%', 'Nem részletezett'];
        const sortCategories = (cats: VatCategoryData[]) => cats.sort((a, b) => {
          const iA = sortOrder.indexOf(a.rate), iB = sortOrder.indexOf(b.rate);
          if (iA === -1 && iB === -1) return a.rate.localeCompare(b.rate);
          if (iA === -1) return 1;
          if (iB === -1) return -1;
          return iA - iB;
        });

        const outCats = sortCategories(Object.entries(outboundByRate).map(([rate, d]) => ({ rate, netAmount: d.netAmount, vatAmount: d.vatAmount })));
        const inCats = sortCategories(Object.entries(inboundByRate).map(([rate, d]) => ({ rate, netAmount: d.netAmount, vatAmount: d.vatAmount })));

        return {
          outboundVatCategories: outCats,
          inboundVatCategories: inCats,
          totalOutboundVat: headerOutVat,
          totalInboundVat: headerInVat,
        };
      } else {
        return {
          outboundVatCategories: [{ rate: 'Összesített', vatAmount: headerOutVat, netAmount: headerOutNet }] as VatCategoryData[],
          inboundVatCategories: [{ rate: 'Összesített', vatAmount: headerInVat, netAmount: headerInNet }] as VatCategoryData[],
          totalOutboundVat: headerOutVat,
          totalInboundVat: headerInVat,
        };
      }
    },
    enabled: !!user && !!companyId,
    staleTime: 30_000,
  });

  // ── Currency conversion (memoized) ──
  const convertToSelectedCurrency = useCallback((amount: number, fromCurrency: string, selectedCurrency: string): number => {
    if (fromCurrency === selectedCurrency) return amount;
    let amountInHUF = amount;
    if (fromCurrency !== 'HUF') {
      const rateFromHUF = exchangeRates[fromCurrency] || 1;
      amountInHUF = amount / rateFromHUF;
    }
    if (selectedCurrency === 'HUF') return amountInHUF;
    const rateToSelected = exchangeRates[selectedCurrency] || 1;
    return amountInHUF * rateToSelected;
  }, [exchangeRates]);

  // ── Monthly chart data ──
  const rawInvoices = analyticsRaw?.rawInvoices || [];
  const rawSalaries = analyticsRaw?.rawSalaries || [];

  const buildMonthlyData = useCallback((showBrutto: boolean): MonthlyData[] => {
    const convertToHUF = (amount: number, fromCurrency: string | null): number => {
      const currency = fromCurrency || 'HUF';
      if (currency === 'HUF') return amount;
      const rate = exchangeRates[currency];
      if (!rate || rate === 0) return amount;
      return amount / rate;
    };

    const currentYear = new Date().getFullYear();
    const monthlyMap: { [key: string]: MonthlyData } = {};
    const monthKeys: string[] = [];
    for (let m = 0; m <= 11; m++) {
      const key = `${currentYear}-${m}`;
      monthKeys.push(key);
      monthlyMap[key] = {
        month: MONTH_NAMES[m],
        monthIndex: m,
        revenuePaid: 0, revenueUnpaid: 0,
        expensesPaid: 0, expensesUnpaid: 0,
        salaries: 0, cashFlow: 0,
      };
    }

    rawInvoices.forEach(inv => {
      if (inv.invoice_issue_date) {
        const date = parseISO(inv.invoice_issue_date);
        const key = `${date.getFullYear()}-${date.getMonth()}`;
        if (!monthlyMap[key]) return;
        const originalAmount = showBrutto
          ? (inv.invoice_gross_amount || 0)
          : (inv.invoice_net_amount || 0);
        const amount = convertToHUF(originalAmount, inv.currency);
        const isPaid = !!inv.transaction_id;
        if (inv.invoice_direction === "OUTBOUND") {
          if (isPaid) monthlyMap[key].revenuePaid += amount;
          else monthlyMap[key].revenueUnpaid += amount;
        } else {
          if (isPaid) monthlyMap[key].expensesPaid -= amount;
          else monthlyMap[key].expensesUnpaid -= amount;
        }
      }
    });

    rawSalaries.forEach(sal => {
      if (sal.dátum) {
        const date = parseISO(sal.dátum);
        const key = `${date.getFullYear()}-${date.getMonth()}`;
        if (!monthlyMap[key]) return;
        monthlyMap[key].salaries -= (sal.összeg || 0);
      }
    });

    const result = monthKeys.map(key => monthlyMap[key]);
    let cumulative = 0;
    result.forEach(data => {
      cumulative += data.revenuePaid + data.revenueUnpaid + data.expensesPaid + data.expensesUnpaid + data.salaries;
      data.cashFlow = cumulative;
    });

    return result;
  }, [rawInvoices, rawSalaries, exchangeRates]);

  // ── Project breakdown (server-side) ──
  const { data: categoryBreakdownData = [] } = useQuery({
    queryKey: ['projectBreakdown', companyId, dateFromFormatted, dateToFormatted],
    queryFn: async () => {
      // Fetch projects for this company
      const { data: projectRows, error: projErr } = await supabase
        .from('projects')
        .select('id, name, description')
        .eq('company_id', companyId);
      if (projErr) throw projErr;
      if (!projectRows?.length) return [];

      // Fetch nav_invoices with project_id in the date range
      const { data: navRows, error: navErr } = await supabase
        .from('nav_invoices')
        .select('project_id, invoice_gross_amount')
        .eq('company_id', companyId)
        .gte('invoice_issue_date', dateFromFormatted)
        .lte('invoice_issue_date', dateToFormatted)
        .not('project_id', 'is', null);
      if (navErr) throw navErr;

      // Aggregate by project
      const projectMap = new Map<string, { count: number; total: number }>();
      (navRows || []).forEach((row: any) => {
        const existing = projectMap.get(row.project_id) || { count: 0, total: 0 };
        existing.count += 1;
        existing.total += Number(row.invoice_gross_amount || 0);
        projectMap.set(row.project_id, existing);
      });

      const allTotal = Array.from(projectMap.values()).reduce((s, v) => s + v.total, 0);

      return projectRows
        .filter(p => projectMap.has(p.id))
        .map(p => {
          const agg = projectMap.get(p.id)!;
          return {
            id: p.id,
            name: p.name,
            description: p.description || '',
            invoice_count: agg.count,
            total_amount: agg.total,
            avg_amount: agg.count > 0 ? agg.total / agg.count : 0,
            percentage: allTotal > 0 ? (agg.total / allTotal) * 100 : 0,
          };
        })
        .sort((a, b) => b.total_amount - a.total_amount);
    },
    enabled: !!user && !!companyId,
    placeholderData: keepPreviousData,
  });

  return {
    // Auth & company
    user,
    selectedCompany,
    companies,
    companyLoading,
    companyId,
    dateFrom,
    dateTo,
    dateFromFormatted,
    dateToFormatted,

    // Data
    profile,
    tourCompleted,
    metrics,
    metricsLoading,
    navVatData,
    pettyCashBalances,
    fxDifferences,
    fxMonthlySummary,
    invoices,
    analyticsLoading,
    vatBreakdown,
    exchangeRates,
    categoryBreakdownData,

    // Helpers
    convertToSelectedCurrency,
    buildMonthlyData,
  };
}
