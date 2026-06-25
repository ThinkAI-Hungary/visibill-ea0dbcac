/**
 * Accounty Reports hooks — report data, monthly trend, colleague stats.
 * Split from useAccountyData.ts for maintainability.
 */
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { queryKeys } from '@/lib/queryKeys';
import { useAccountyClients } from './useAccountyClients';
import { useMyAssignedCompanyIds } from './useAccountyHelpers';

// ── Types ──

export interface ReportRow {
  clientName: string;
  taxNumber: string;
  status: string;
  missingCount: number;
  unprocessedCount: number;
  nextDeadline: string;
}

export interface InvoiceReportRow {
  invoiceNumber: string;
  partnerName: string;
  date: string;
  direction: string;
  netAmount: number;
  vatAmount: number;
  grossAmount: number;
  currency: string;
  clientName: string;
}

export interface FullReportData {
  clients: ReportRow[];
  invoices: InvoiceReportRow[];
}

export interface MonthlyTrendPoint {
  month: string;
  szamlak: number;
  hianyzok: number;
  zaras: number;
}

export interface ColleagueStat {
  name: string;
  initial: string;
  assigned: number;
  closed: number;
  inProgress: number;
  missing: number;
  closingPct: number;
  avgDays: number;
  efficiency: 'Kiváló' | 'Jó' | 'Fejlesztendő';
}

// ── Hooks ──

export function useAccountyReportData(): ReportRow[] {
  const { data: clients } = useAccountyClients();
  return (clients || []).map((c) => ({
    clientName: c.name,
    taxNumber: c.taxNumber || '',
    status: c.status,
    missingCount: c.missingCount,
    unprocessedCount: c.unprocessedCount,
    nextDeadline: c.deadlineDate
      ? new Date(c.deadlineDate).toLocaleDateString('hu-HU')
      : '–',
  }));
}

export function useAccountyFullReportData() {
  const { user } = useAuth();
  const clientRows = useAccountyReportData();
  const { data: myAssignsData } = useMyAssignedCompanyIds();
  const companyIds = myAssignsData?.companyIds || [];

  const invoiceQuery = useQuery({
    queryKey: queryKeys.accountyReportInvoices(),
    queryFn: async (): Promise<InvoiceReportRow[]> => {
      if (companyIds.length === 0) return [];

      const { data: companies } = await supabase
        .from('companies')
        .select('id, name')
        .in('id', companyIds);
      const companyMap: Record<string, string> = {};
      for (const c of (companies || [])) {
        if (c.name === 'SANDBOX') continue;
        companyMap[c.id] = c.name;
      }

      const results: InvoiceReportRow[] = [];

      for (const cid of companyIds) {
        if (!companyMap[cid]) continue;
        const { data: uploaded } = await supabase
          .from('invoices')
          .select('bizonylatsorszam, elado_nev, vevo_nev, kibocsatas_datuma, afa_osszeg_osszesen, adoalap_osszesen, brutto_vegosszeg, invoice_direction, company_id, penznem')
          .eq('company_id', cid)
          .order('kibocsatas_datuma', { ascending: false })
          .limit(100);

        for (const inv of (uploaded || [])) {
          const isInbound = inv.invoice_direction === 'INBOUND';
          const gross = Number(inv.brutto_vegosszeg) || 0;
          const vat = Number(inv.afa_osszeg_osszesen) || 0;
          const net = Number(inv.adoalap_osszesen) || (gross - vat);
          results.push({
            invoiceNumber: inv.bizonylatsorszam || '-',
            partnerName: isInbound ? (inv.elado_nev || '-') : (inv.vevo_nev || '-'),
            date: inv.kibocsatas_datuma ? new Date(inv.kibocsatas_datuma).toLocaleDateString('hu-HU') : '-',
            direction: isInbound ? 'Bejövő' : 'Kimenő',
            netAmount: net,
            vatAmount: vat,
            grossAmount: gross,
            currency: (inv.penznem === 'HUF' || !inv.penznem) ? 'Ft' : inv.penznem,
            clientName: companyMap[inv.company_id!] || '-',
          });
        }

        const { data: navBatch } = await supabase
          .from('nav_invoices')
          .select('invoice_number, supplier_name, customer_name, invoice_issue_date, invoice_net_amount, invoice_vat_amount, invoice_gross_amount, invoice_direction, company_id, currency')
          .eq('company_id', cid)
          .order('invoice_issue_date', { ascending: false })
          .limit(100);

        for (const nav of (navBatch || [])) {
          const isInbound = nav.invoice_direction === 'INBOUND';
          const gross = Number(nav.invoice_gross_amount) || 0;
          const vat = Number(nav.invoice_vat_amount) || 0;
          const net = Number(nav.invoice_net_amount) || (gross - vat);
          results.push({
            invoiceNumber: nav.invoice_number || '-',
            partnerName: isInbound ? (nav.supplier_name || '-') : (nav.customer_name || '-'),
            date: nav.invoice_issue_date ? new Date(nav.invoice_issue_date).toLocaleDateString('hu-HU') : '-',
            direction: isInbound ? 'Bejövő' : 'Kimenő',
            netAmount: net,
            vatAmount: vat,
            grossAmount: gross,
            currency: (nav.currency === 'HUF' || !nav.currency) ? 'Ft' : nav.currency,
            clientName: companyMap[nav.company_id!] || '-',
          });
        }
      }

      return results;
    },
    enabled: !!user && !!myAssignsData,
  });

  return {
    clients: clientRows,
    invoices: invoiceQuery.data || [],
  } as FullReportData;
}

export function useAccountyMonthlyTrend() {
  const { user } = useAuth();
  const userId = user?.id || '';
  const { data: myAssignsData } = useMyAssignedCompanyIds();
  const companyIds = myAssignsData?.companyIds || [];

  return useQuery({
    queryKey: queryKeys.accountyMonthlyTrend(userId),
    queryFn: async (): Promise<MonthlyTrendPoint[]> => {
      if (companyIds.length === 0) return [];

      const now = new Date();
      const months: MonthlyTrendPoint[] = [];
      const monthNames = ['Jan', 'Feb', 'Már', 'Ápr', 'Máj', 'Jún', 'Júl', 'Aug', 'Szep', 'Okt', 'Nov', 'Dec'];

      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const monthStart = d.toISOString().split('T')[0];
        const nextMonth = new Date(d.getFullYear(), d.getMonth() + 1, 1);
        const monthEnd = nextMonth.toISOString().split('T')[0];
        const label = monthNames[d.getMonth()];

        const { count: invCount } = await supabase
          .from('invoices')
          .select('id', { count: 'exact', head: true })
          .in('company_id', companyIds)
          .gte('kibocsatas_datuma', monthStart)
          .lt('kibocsatas_datuma', monthEnd);

        const { count: navCount } = await supabase
          .from('nav_invoices')
          .select('id', { count: 'exact', head: true })
          .in('company_id', companyIds)
          .gte('invoice_issue_date', monthStart)
          .lt('invoice_issue_date', monthEnd);

        const { count: missingCount } = await supabase
          .from('accounty_missing_items')
          .select('id', { count: 'exact', head: true })
          .in('company_id', companyIds)
          .gte('created_at', monthStart)
          .lt('created_at', monthEnd);

        const totalInv = (invCount || 0) + (navCount || 0);
        const totalMissing = missingCount || 0;
        const zaras = totalInv + totalMissing > 0
          ? Math.round((totalInv / (totalInv + totalMissing)) * 100)
          : 0;

        months.push({ month: label, szamlak: totalInv, hianyzok: totalMissing, zaras });
      }

      return months;
    },
    enabled: !!userId && !!myAssignsData,
    staleTime: 5 * 60_000,
  });
}

export function useAccountyColleagueStats() {
  const { user } = useAuth();

  return useQuery({
    queryKey: queryKeys.accountyColleagueStats(),
    queryFn: async (): Promise<ColleagueStat[]> => {
      const { data: myAssignment } = await supabase
        .from('accounty_assignments')
        .select('accounting_firm_id')
        .eq('accountant_user_id', user!.id)
        .limit(1)
        .single();

      const firmId = myAssignment?.accounting_firm_id;
      if (!firmId) return [];

      const { data: assignments } = await supabase
        .from('accounty_assignments')
        .select('accountant_user_id, company_id')
        .eq('accounting_firm_id', firmId);
      if (!assignments || assignments.length === 0) return [];

      const allCompanyIds = [...new Set(assignments.map(a => a.company_id))];
      const { data: companies } = await supabase
        .from('companies')
        .select('id, name')
        .in('id', allCompanyIds);
      const sandboxIds = new Set((companies || []).filter(c => c.name === 'SANDBOX').map(c => c.id));

      const accountantCompanies: Record<string, string[]> = {};
      for (const a of assignments) {
        if (sandboxIds.has(a.company_id)) continue;
        if (!accountantCompanies[a.accountant_user_id]) accountantCompanies[a.accountant_user_id] = [];
        accountantCompanies[a.accountant_user_id].push(a.company_id);
      }

      const accountantIds = Object.keys(accountantCompanies);

      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, name')
        .in('user_id', accountantIds);
      const nameMap: Record<string, string> = {};
      (profiles || []).forEach(p => { nameMap[p.user_id] = p.name || 'Névtelen'; });

      const results: ColleagueStat[] = [];

      for (const uid of accountantIds) {
        const coIds = accountantCompanies[uid];
        const name = nameMap[uid] || 'Névtelen';

        const { count: missingOpen } = await supabase
          .from('accounty_missing_items')
          .select('id', { count: 'exact', head: true })
          .in('company_id', coIds)
          .in('status', ['open', 'notified']);

        const { count: resolved } = await supabase
          .from('accounty_missing_items')
          .select('id', { count: 'exact', head: true })
          .in('company_id', coIds)
          .eq('status', 'resolved');

        const { count: completedDeadlines } = await supabase
          .from('accounty_deadlines')
          .select('id', { count: 'exact', head: true })
          .in('company_id', coIds)
          .eq('status', 'completed');

        const { count: inProgressDeadlines } = await supabase
          .from('accounty_deadlines')
          .select('id', { count: 'exact', head: true })
          .in('company_id', coIds)
          .eq('status', 'in_progress');

        const assigned = coIds.length;
        const closed = completedDeadlines || 0;
        const inProgress = inProgressDeadlines || 0;
        const missing = missingOpen || 0;
        const totalHandled = (resolved || 0) + missing;
        const closingPct = totalHandled > 0 ? Math.round(((resolved || 0) / totalHandled) * 100) : 0;

        let efficiency: ColleagueStat['efficiency'] = 'Fejlesztendő';
        if (closingPct >= 80) efficiency = 'Kiváló';
        else if (closingPct >= 50) efficiency = 'Jó';

        results.push({
          name,
          initial: name.charAt(0).toUpperCase(),
          assigned,
          closed,
          inProgress,
          missing,
          closingPct,
          avgDays: 0,
          efficiency,
        });
      }

      return results
        .filter(r => r.name !== 'Sandbox' && r.name !== 'Névtelen')
        .sort((a, b) => b.closingPct - a.closingPct);
    },
    enabled: !!user,
    staleTime: 5 * 60_000,
  });
}
