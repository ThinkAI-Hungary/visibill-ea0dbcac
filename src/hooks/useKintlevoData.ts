import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { useCompany } from '@/contexts/CompanyContext';

import { supabase } from '@/integrations/supabase/client';
import { queryKeys } from '@/lib/queryKeys';
import { differenceInDays, parseISO, format } from 'date-fns';
import { getCategory, worstOf } from '@/lib/kintlevo-helpers';
import type { AgingCategory, UnifiedInvoice, CompanyGroup } from '@/lib/kintlevo-helpers';

export function useKintlevoData() {
  const { user } = useAuth();
  const { selectedCompany } = useCompany();
  const queryClient = useQueryClient();
  

  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const { data: navInvoices = [], isLoading: loadingNav } = useQuery({
    queryKey: queryKeys.kintlevoNav(selectedCompany?.id || ''),
    queryFn: async () => {
      if (!selectedCompany?.id) return [];
      const { data, error } = await supabase
        .from('nav_invoices')
        .select('id,invoice_number,invoice_issue_date,payment_date,customer_name,customer_tax_number,invoice_gross_amount,currency,transaction_id')
        .eq('company_id', selectedCompany.id)
        .eq('invoice_direction', 'OUTBOUND')
        .is('transaction_id', null);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!user?.id && !!selectedCompany?.id,
  });

  const { data: manualInvoices = [], isLoading: loadingManual } = useQuery({
    queryKey: queryKeys.kintlevoManual(selectedCompany?.id || ''),
    queryFn: async () => {
      if (!selectedCompany?.id) return [];
      const { data, error } = await supabase
        .from('invoices')
        .select('id,bizonylatsorszam,kibocsatas_datuma,fizetesi_hatarido,vevo_nev,vevo_vat_id,brutto_vegosszeg,penznem,transaction_id,melleklet_url')
        .eq('company_id', selectedCompany.id)
        .eq('invoice_direction', 'OUTBOUND')
        .is('transaction_id', null);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!user?.id && !!selectedCompany?.id,
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

  const allInvoices = useMemo((): UnifiedInvoice[] => {
    const result: UnifiedInvoice[] = [];

    for (const inv of navInvoices) {
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
        currency: inv.currency ?? 'HUF', companyName: inv.customer_name ?? 'Ismeretlen partner',
        taxNumber: inv.customer_tax_number, source: 'nav', attachmentUrl: null, daysOverdue,
        category: getCategory(daysOverdue),
      });
    }

    for (const inv of manualInvoices) {
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
        currency: inv.penznem ?? 'HUF', companyName: inv.vevo_nev ?? 'Ismeretlen partner',
        taxNumber: inv.vevo_vat_id, source: 'manual', attachmentUrl: inv.melleklet_url ?? null,
        daysOverdue, category: getCategory(daysOverdue),
      });
    }

    return result;
  }, [navInvoices, manualInvoices, today]);

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

  return {
    user, selectedCompany, queryClient,
    search, setSearch, expanded, setExpanded,
    loadingNav, loadingManual, isLoading: loadingNav || loadingManual,
    allInvoices, companyGroups, filteredGroups, totals, grandTotal,
    partners, updatePartnerEmail,
  };
}
