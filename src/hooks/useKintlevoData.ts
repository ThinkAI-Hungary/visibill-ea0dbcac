import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { useCompany } from '@/contexts/CompanyContext';
import { useDateRange } from '@/contexts/DateRangeContext';

import { supabase } from '@/integrations/supabase/client';
import { queryKeys } from '@/lib/queryKeys';
import { differenceInDays, parseISO, format } from 'date-fns';
import { getCategory, worstOf, filterInvoicesByDate } from '@/lib/kintlevo-helpers';
import type { AgingCategory, UnifiedInvoice, CompanyGroup, DateFilterBasis } from '@/lib/kintlevo-helpers';

export type { DateFilterBasis };

export function useKintlevoData() {
  const { user } = useAuth();
  const { selectedCompany } = useCompany();
  const queryClient = useQueryClient();
  const { dateFromFormatted, dateToFormatted } = useDateRange();

  const [dateFilterBasis, setDateFilterBasis] = useState<DateFilterBasis>('due_date');
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const { data: navInvoices = [], isLoading: loadingNav } = useQuery({
    queryKey: queryKeys.kintlevoNav(selectedCompany?.id || ''),
    queryFn: async () => {
      if (!selectedCompany?.id) return [];
      // Paginated fetch — bypasses Supabase 1000-row default limit
      const PAGE_SIZE = 1000;
      let allData: any[] = [];
      let page = 0;
      let hasMore = true;
      while (hasMore) {
        const from = page * PAGE_SIZE;
        const to = from + PAGE_SIZE - 1;
        const { data, error } = await supabase
          .from('nav_invoices')
          .select('id,invoice_number,invoice_issue_date,payment_date,customer_name,customer_tax_number,invoice_gross_amount,invoice_net_amount,currency,transaction_id,paid,payment_method,is_manual_payment')
          .eq('company_id', selectedCompany.id)
          .eq('invoice_direction', 'OUTBOUND')
          .is('transaction_id', null)
          .or('paid.is.null,paid.eq.false')
          .range(from, to);
        if (error) throw error;
        if (data && data.length > 0) {
          allData = allData.concat(data);
          hasMore = data.length === PAGE_SIZE;
        } else {
          hasMore = false;
        }
        page++;
      }
      return allData;
    },
    enabled: !!user?.id && !!selectedCompany?.id,
    placeholderData: keepPreviousData,
  });

  const { data: manualInvoices = [], isLoading: loadingManual } = useQuery({
    queryKey: queryKeys.kintlevoManual(selectedCompany?.id || ''),
    queryFn: async () => {
      if (!selectedCompany?.id) return [];
      const PAGE_SIZE = 1000;
      let allData: any[] = [];
      let page = 0;
      let hasMore = true;
      while (hasMore) {
        const from = page * PAGE_SIZE;
        const to = from + PAGE_SIZE - 1;
        const { data, error } = await supabase
          .from('invoices')
          .select('id,bizonylatsorszam,kibocsatas_datuma,fizetesi_hatarido,vevo_nev,vevo_vat_id,brutto_vegosszeg,adoalap_osszesen,penznem,transaction_id,melleklet_url,fizetve,fizetesi_mod,is_manual_payment')
          .eq('company_id', selectedCompany.id)
          .eq('invoice_direction', 'OUTBOUND')
          .is('transaction_id', null)
          .or('fizetve.is.null,fizetve.eq.false')
          .range(from, to);
        if (error) throw error;
        if (data && data.length > 0) {
          allData = allData.concat(data);
          hasMore = data.length === PAGE_SIZE;
        } else {
          hasMore = false;
        }
        page++;
      }
      return allData;
    },
    enabled: !!user?.id && !!selectedCompany?.id,
    placeholderData: keepPreviousData,
  });

  const { data: settledInvoiceIds = new Set<string>(), isLoading: loadingSettled } = useQuery({
    queryKey: queryKeys.kintlevoSettled(selectedCompany?.id || ''),
    queryFn: async () => {
      if (!selectedCompany?.id) return new Set<string>();
      const ids = new Set<string>();
      const [{ data: courierReports }, { data: multiMatches }] = await Promise.all([
        supabase
          .from('courier_reports')
          .select('matched_nav_invoice_id')
          .eq('company_id', selectedCompany.id)
          .not('matched_nav_invoice_id', 'is', null)
          .not('matched_transaction_id', 'is', null),
        supabase
          .from('transaction_invoice_matches')
          .select('invoice_id, transactions!inner(company_id)')
          .eq('transactions.company_id', selectedCompany.id),
      ]);
      (courierReports || []).forEach(r => {
        if (r.matched_nav_invoice_id) ids.add(r.matched_nav_invoice_id);
      });
      (multiMatches || []).forEach((m: any) => {
        if (m.invoice_id) ids.add(m.invoice_id);
      });
      return ids;
    },
    enabled: !!user?.id && !!selectedCompany?.id,
    placeholderData: keepPreviousData,
  });

  const { data: partners = [] } = useQuery({
    queryKey: queryKeys.partners(selectedCompany?.id || ''),
    queryFn: async () => {
      if (!selectedCompany?.id) return [];
      const { data, error } = await supabase
        .from('partners')
        .select('id,name,tax_number,email')
        .eq('company_id', selectedCompany.id);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!user?.id && !!selectedCompany?.id,
    placeholderData: keepPreviousData,
  });

  const { data: dunningSends = [] } = useQuery({
    queryKey: queryKeys.dunningSends(selectedCompany?.id || ''),
    queryFn: async () => {
      if (!selectedCompany?.id) return [];
      const { data, error } = await supabase
        .from('dunning_sends')
        .select('id,debtor_company_name,sent_at')
        .eq('company_id', selectedCompany.id)
        .order('sent_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!user?.id && !!selectedCompany?.id,
    placeholderData: keepPreviousData,
  });

  const updatePartnerEmail = useMutation({
    mutationFn: async ({ partnerId, email }: { partnerId: string; email: string }) => {
      const { error } = await supabase.from('partners').update({ email }).eq('id', partnerId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['partners'] });
    },
  });

  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const rawInvoices = useMemo((): UnifiedInvoice[] => {
    const result: UnifiedInvoice[] = [];

    for (const inv of navInvoices) {
      if (inv.paid === true) continue;
      if (inv.payment_method === 'CASH') continue;
      if (inv.is_manual_payment === true) continue;
      if (settledInvoiceIds.has(inv.id)) continue;

      let dueDate: Date;
      if (inv.payment_date) {
        dueDate = parseISO(inv.payment_date);
      } else if (inv.invoice_issue_date) {
        dueDate = parseISO(inv.invoice_issue_date);
        dueDate.setDate(dueDate.getDate() + 30);
      } else {
        dueDate = new Date(today);
      }
      dueDate.setHours(0, 0, 0, 0);
      const daysOverdue = differenceInDays(today, dueDate);
      result.push({
        id: inv.id, invoiceNumber: inv.invoice_number, issueDate: inv.invoice_issue_date,
        dueDate: format(dueDate, 'yyyy-MM-dd'), amount: inv.invoice_gross_amount ?? 0,
        netAmount: inv.invoice_net_amount ?? 0,
        currency: inv.currency ?? 'HUF', companyName: inv.customer_name ?? 'Ismeretlen partner',
        taxNumber: inv.customer_tax_number, source: 'nav', attachmentUrl: null, daysOverdue,
        category: getCategory(daysOverdue),
      });
    }

    for (const inv of manualInvoices) {
      if (inv.fizetve === true) continue;
      const isCash = inv.fizetesi_mod && (
        inv.fizetesi_mod.toLowerCase().includes('készpénz') ||
        inv.fizetesi_mod.toLowerCase() === 'cash'
      );
      if (isCash) continue;
      if (inv.is_manual_payment === true) continue;
      if (settledInvoiceIds.has(inv.id)) continue;

      let dueDate: Date;
      if (inv.fizetesi_hatarido) {
        dueDate = parseISO(inv.fizetesi_hatarido);
      } else if (inv.kibocsatas_datuma) {
        dueDate = parseISO(inv.kibocsatas_datuma);
        dueDate.setDate(dueDate.getDate() + 30);
      } else {
        dueDate = new Date(today);
      }
      dueDate.setHours(0, 0, 0, 0);
      const daysOverdue = differenceInDays(today, dueDate);
      result.push({
        id: inv.id, invoiceNumber: inv.bizonylatsorszam, issueDate: inv.kibocsatas_datuma,
        dueDate: format(dueDate, 'yyyy-MM-dd'), amount: inv.brutto_vegosszeg ?? 0,
        netAmount: inv.adoalap_osszesen ?? 0,
        currency: inv.penznem ?? 'HUF', companyName: inv.vevo_nev ?? 'Ismeretlen partner',
        taxNumber: inv.vevo_vat_id, source: 'manual', attachmentUrl: inv.melleklet_url ?? null,
        daysOverdue, category: getCategory(daysOverdue),
      });
    }

    return result;
  }, [navInvoices, manualInvoices, today, settledInvoiceIds]);

  const allInvoices = useMemo((): UnifiedInvoice[] => {
    return filterInvoicesByDate(rawInvoices, dateFilterBasis, dateFromFormatted, dateToFormatted);
  }, [rawInvoices, dateFilterBasis, dateFromFormatted, dateToFormatted]);

  const companyGroups = useMemo((): CompanyGroup[] => {
    const map = new Map<string, UnifiedInvoice[]>();
    for (const inv of allInvoices) {
      if (!map.has(inv.companyName)) map.set(inv.companyName, []);
      map.get(inv.companyName)!.push(inv);
    }

    const groups: CompanyGroup[] = [];
    map.forEach((invs, companyName) => {
      const sorted = [...invs].sort((a, b) => a.dueDate.localeCompare(b.dueDate));
      const taxNumber = invs[0]?.taxNumber ?? null;
      const partner = partners.find(p =>
        (taxNumber && p.tax_number === taxNumber) ||
        p.name.toLowerCase() === companyName.toLowerCase()
      ) ?? null;
      const lastSendRecord = dunningSends.find(d => d.debtor_company_name === companyName);
      groups.push({
        companyName, taxNumber, partnerId: partner?.id ?? null,
        partnerEmail: partner?.email ?? null, invoices: sorted,
        totalAmount: invs.reduce((s, i) => s + i.amount, 0),
        totalNetAmount: invs.reduce((s, i) => s + i.netAmount, 0),
        worstCategory: worstOf(sorted), lastSent: lastSendRecord?.sent_at ?? null,
      });
    });

    return groups.sort((a, b) => a.companyName.localeCompare(b.companyName, 'hu'));
  }, [allInvoices, partners, dunningSends]);

  const filteredGroups = useMemo(() =>
    search.trim()
      ? companyGroups.filter(g => g.companyName.toLowerCase().includes(search.toLowerCase()))
      : companyGroups,
    [companyGroups, search]
  );

  const totals = useMemo(() => {
    const t: Record<AgingCategory, number> = { green: 0, yellow: 0, red: 0, purple: 0 };
    for (const inv of allInvoices) t[inv.category] += inv.amount;
    return t;
  }, [allInvoices]);

  const grandTotal = useMemo(() => Object.values(totals).reduce((a, b) => a + b, 0), [totals]);

  const netTotals = useMemo(() => {
    const t: Record<AgingCategory, number> = { green: 0, yellow: 0, red: 0, purple: 0 };
    for (const inv of allInvoices) t[inv.category] += inv.netAmount;
    return t;
  }, [allInvoices]);

  const netGrandTotal = useMemo(() => Object.values(netTotals).reduce((a, b) => a + b, 0), [netTotals]);

  return {
    user, selectedCompany, queryClient,
    search, setSearch, expanded, setExpanded,
    loadingNav, loadingManual, loadingSettled, isLoading: loadingNav || loadingManual || loadingSettled,
    allInvoices, companyGroups, filteredGroups, totals, grandTotal,
    netTotals, netGrandTotal,
    partners, updatePartnerEmail,
    dateFilterBasis, setDateFilterBasis,
    dateFromFormatted, dateToFormatted,
    rawInvoicesCount: rawInvoices.length,
  };
}
