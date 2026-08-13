import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { exportToFile } from '@/lib/exportUtils';
import type { NavInvoice, SubmittedInvoice } from './useInvoiceData';
import { reportError } from '@/lib/errorReporter';
import type { SyncProgress } from '@/components/nav/NavSyncDialog';

interface UseInvoiceMutationsParams {
  companyId: string;
  selectedCompany: { id: string; name: string; tax_number?: string | null } | null;
  invalidateInvoiceData: () => void;
  selectedInvoiceIds: Set<string>;
  setSelectedInvoiceIds: React.Dispatch<React.SetStateAction<Set<string>>>;
  filteredAndSortedNavInvoices: NavInvoice[];
  filteredAndSortedSubmittedInvoices: SubmittedInvoice[];
  getInvoicePartnerName: (invoice: NavInvoice) => string;
  getPartnerTaxNumber: (invoice: NavInvoice) => string | null;
  getCategoryName: (categoryId: string | null) => string;
  getProjectName: (projectId: string | null) => string;
  isSubmittedTab: boolean;
}

export function useInvoiceMutations({
  companyId,
  selectedCompany,
  invalidateInvoiceData,
  selectedInvoiceIds,
  setSelectedInvoiceIds,
  filteredAndSortedNavInvoices,
  filteredAndSortedSubmittedInvoices,
  getInvoicePartnerName,
  getPartnerTaxNumber,
  getCategoryName,
  getProjectName,
  isSubmittedTab,
}: UseInvoiceMutationsParams) {
  const [syncing, setSyncing] = useState(false);
  const SYNC_COOLDOWN_SECONDS = 60;

  // Server-side cooldown state
  const [serverLastSyncTime, setServerLastSyncTime] = useState<Date | null>(null);
  const [cooldownCheckLoading, setCooldownCheckLoading] = useState(true);
  const [cooldownSeconds, setCooldownSeconds] = useState<number>(0);

  const checkServerCooldown = async () => {
    if (!selectedCompany?.id) {
      setServerLastSyncTime(null);
      setCooldownCheckLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('nav_sync_logs')
        .select('started_at')
        .eq('company_id', selectedCompany.id)
        .in('status', ['completed', 'running'])
        .order('started_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!error && data?.started_at) {
        setServerLastSyncTime(new Date(data.started_at));
      } else {
        setServerLastSyncTime(null);
      }
    } catch (err) {
      reportError({ type: 'db_query', component: 'useInvoiceMutations', action: 'error', message: 'Failed to check cooldown:', error: err });
    } finally {
      setCooldownCheckLoading(false);
    }
  };

  useEffect(() => {
    checkServerCooldown();
    const interval = setInterval(checkServerCooldown, 30000);
    return () => clearInterval(interval);
  }, [selectedCompany?.id]);

  useEffect(() => {
    if (!serverLastSyncTime) {
      setCooldownSeconds(0);
      return;
    }

    const calculateRemaining = () => {
      const diffMs = Date.now() - serverLastSyncTime.getTime();
      const cooldownMs = SYNC_COOLDOWN_SECONDS * 1000;
      const remaining = Math.max(0, Math.ceil((cooldownMs - diffMs) / 1000));
      setCooldownSeconds(remaining);
    };

    calculateRemaining();
    const interval = setInterval(calculateRemaining, 1000);
    return () => clearInterval(interval);
  }, [serverLastSyncTime]);

  const canSync = useMemo(() => cooldownSeconds === 0, [cooldownSeconds]);

  const formatCooldown = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleSync = async (syncDateFrom?: string, syncDateTo?: string, onProgress?: (progress: SyncProgress) => void) => {
    if (!selectedCompany) {
      toast({ title: 'Nincs kiválasztott cég', variant: 'destructive' });
      return;
    }

    if (!canSync) {
      toast({ title: `Kérlek várj még ${formatCooldown(cooldownSeconds)} a következő szinkronizálásig`, variant: 'destructive' });
      return;
    }

    setSyncing(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        toast({ title: 'Nincs érvényes munkamenet', variant: 'destructive' });
        return;
      }

      const splitDateRange = (start: Date, end: Date) => {
        const chunks: { from: string; to: string }[] = [];
        const currentStart = new Date(start);
        while (currentStart < end) {
          const chunkEnd = new Date(currentStart);
          chunkEnd.setDate(chunkEnd.getDate() + 34);
          const actualEnd = chunkEnd > end ? end : chunkEnd;
          chunks.push({
            from: currentStart.toISOString().split('T')[0],
            to: actualEnd.toISOString().split('T')[0]
          });
          currentStart.setTime(actualEnd.getTime());
          currentStart.setDate(currentStart.getDate() + 1);
        }
        return chunks;
      };

      const endDate = syncDateTo ? new Date(syncDateTo) : new Date();
      const startDate = syncDateFrom ? new Date(syncDateFrom) : new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
      const dateChunks = splitDateRange(startDate, endDate);

      // Report initial progress
      onProgress?.({ currentChunk: 0, totalChunks: dateChunks.length, totalInvoices: 0 });

      let totalOutbound = 0;
      let totalInbound = 0;
      const errors: string[] = [];

      for (let i = 0; i < dateChunks.length; i++) {
        const chunk = dateChunks[i];

        const [outboundResult, inboundResult] = await Promise.allSettled([
          supabase.functions.invoke('nav-query-outbound-invoices', {
            body: { invoiceDirection: 'OUTBOUND', dateFrom: chunk.from, dateTo: chunk.to, companyId: selectedCompany.id },
            headers: { Authorization: `Bearer ${session.access_token}` }
          }),
          supabase.functions.invoke('nav-query-outbound-invoices', {
            body: { invoiceDirection: 'INBOUND', dateFrom: chunk.from, dateTo: chunk.to, companyId: selectedCompany.id },
            headers: { Authorization: `Bearer ${session.access_token}` }
          })
        ]);

        if (outboundResult.status === 'fulfilled') {
          const { data, error } = outboundResult.value;
          if (error || data?.error) {
            errors.push(`Kimenő (${chunk.from}): ${error?.message || data?.error}`);
          } else if (data?.success) {
            totalOutbound += data.totalInvoices || 0;
          }
        }

        if (inboundResult.status === 'fulfilled') {
          const { data, error } = inboundResult.value;
          if (error || data?.error) {
            errors.push(`Bejövő (${chunk.from}): ${error?.message || data?.error}`);
          } else if (data?.success) {
            totalInbound += data.totalInvoices || 0;
          }
        }

        // Report chunk progress
        onProgress?.({ currentChunk: i + 1, totalChunks: dateChunks.length, totalInvoices: totalOutbound + totalInbound });
      }

      const totalInvoices = totalOutbound + totalInbound;
      setServerLastSyncTime(new Date());

      if (errors.length === 2) {
        throw new Error(errors.join('; '));
      } else if (errors.length === 1) {
        toast({ title: `Szinkronizálás részben sikeres`,
          description: `${totalInvoices} számla letöltve (${totalOutbound} kimenő, ${totalInbound} bejövő). Hibák: ${errors.join('; ')}`
        });
      } else {
        toast({ title: `Sikeres szinkronizálás!`,
          description: `Összesen ${totalInvoices} számla: ${totalOutbound} kimenő, ${totalInbound} bejövő`
        });
      }

      const forceRecategorizeIds = Array.from(selectedInvoiceIds);

      if (totalInvoices > 0 || forceRecategorizeIds.length > 0) {
        try {
          await supabase.functions.invoke('trigger-nav-categorization', {
            body: { companyId: selectedCompany.id, syncType: 'manual', forceRecategorizeIds },
            headers: { Authorization: `Bearer ${session.access_token}` }
          });
        } catch (categorizationError) {
          reportError({ type: 'db_query', component: 'useInvoiceMutations', action: 'error', message: 'Categorization webhook failed:', error: categorizationError });
        }
      }

      setSelectedInvoiceIds(new Set());
      invalidateInvoiceData();
    } catch (error: any) {
      reportError({ type: 'db_query', component: 'useInvoiceMutations', action: 'error', message: 'Sync error:', error: error });
      toast({ title: error.message || 'Nem sikerült szinkronizálni a számlákat', variant: 'destructive' });
    } finally {
      setSyncing(false);
    }
  };

  const handleProjectChange = async (invoiceId: string, projectId: string | null, invoiceNumber?: string | null) => {
    const value = projectId === 'none' ? null : projectId;
    try {
      // Always update nav_invoices by ID
      const navPromise = supabase.from('nav_invoices').update({ project_id: value }).eq('id', invoiceId);
      // Update linked invoices row by bizonylatsorszam if we know the invoice number
      const subPromise = invoiceNumber
        ? supabase.from('invoices').update({ project_id: value }).eq('bizonylatsorszam', invoiceNumber)
        : Promise.resolve({ error: null });
      const [navRes, subRes] = await Promise.all([navPromise, subPromise]);
      if (navRes.error) throw navRes.error;
      if (subRes.error) throw subRes.error;
      invalidateInvoiceData();
      toast({ title: 'Projekt hozzárendelve' });
    } catch (error) {
      reportError({ type: 'db_query', component: 'useInvoiceMutations', action: 'error', message: 'Error updating project:', error });
      toast({ title: 'Hiba a projekt hozzárendelésekor', variant: 'destructive' });
    }
  };

  const handleCategoryChange = async (invoiceId: string, categoryId: string | null, invoiceNumber?: string | null) => {
    const value = categoryId === 'none' ? null : categoryId;
    try {
      const navPromise = supabase.from('nav_invoices').update({ category_id: value }).eq('id', invoiceId);
      const subPromise = invoiceNumber
        ? supabase.from('invoices').update({ category_id: value }).eq('bizonylatsorszam', invoiceNumber)
        : Promise.resolve({ error: null });
      const [navRes, subRes] = await Promise.all([navPromise, subPromise]);
      if (navRes.error) throw navRes.error;
      if (subRes.error) throw subRes.error;
      invalidateInvoiceData();
      toast({ title: 'Kategória hozzárendelve' });
    } catch (error) {
      reportError({ type: 'db_query', component: 'useInvoiceMutations', action: 'error', message: 'Error updating category:', error });
      toast({ title: 'Hiba a kategória hozzárendelésekor', variant: 'destructive' });
    }
  };

  const handleToggleSubmitted = async (invoice: NavInvoice) => {
    try {
      const newValue = !invoice.submitted;
      const { error } = await supabase
        .from('nav_invoices')
        .update({ submitted: newValue })
        .eq('id', invoice.id);
      if (error) throw error;
      invalidateInvoiceData();
      toast({ title: newValue ? 'Beküldve megjelölve' : 'Beküldve visszavonva' });
    } catch (error) {
      reportError({ type: 'db_query', component: 'useInvoiceMutations', action: 'error', message: 'Error updating submitted status:', error: error });
      toast({ title: 'Hiba a státusz frissítésekor', variant: 'destructive' });
    }
  };

  // ── Export ──

  const handleExportNav = async (exportFormat: 'csv' | 'xlsx') => {
    const getExportData = (invoice: NavInvoice) => {
      const partnerTaxNumber = getPartnerTaxNumber(invoice);
      return [
        invoice.invoice_direction || '',
        invoice.invoice_number || '',
        invoice.invoice_issue_date || '',
        invoice.invoice_delivery_date || '',
        getInvoicePartnerName(invoice),
        partnerTaxNumber || '',
        invoice.invoice_net_amount?.toString() || '0',
        invoice.invoice_gross_amount?.toString() || '0',
        invoice.invoice_vat_amount?.toString() || '0',
        invoice.currency || 'HUF',
        invoice.transaction_id ? 'Igen' : 'Nem',
        invoice.submitted ? 'Igen' : 'Nem'
      ];
    };

    const headers = [
      'Irány', 'Bizonylatsorszám', 'Kibocsátás dátuma', 'Teljesítés dátuma',
      'Partner név', 'Partner adószám', 'Nettó összeg', 'Bruttó összeg',
      'ÁFA összeg', 'Pénznem', 'Fizetve', 'Beküldve'
    ];

    const exportData = filteredAndSortedNavInvoices.map(invoice => getExportData(invoice));
    await exportToFile(headers, exportData, exportFormat, 'nav_szamlak');
  };

  const handleExportSubmitted = async (exportFormat: 'csv' | 'xlsx') => {
    const getExportData = (invoice: SubmittedInvoice) => {
      return [
        invoice.kibocsatas_datuma || '',
        invoice.teljesites_datuma || '',
        invoice.elado_nev || '',
        invoice.vevo_nev || '',
        invoice.adoalap_osszesen?.toString() || '0',
        invoice.brutto_vegosszeg?.toString() || '0',
        invoice.afa_osszeg_osszesen?.toString() || '0',
        invoice.penznem || 'HUF',
        getCategoryName(invoice.category_id),
        getProjectName(invoice.project_id)
      ];
    };

    const headers = [
      'Kibocsátás dátuma', 'Teljesítés dátuma', 'Eladó', 'Vevő',
      'Nettó összeg', 'Bruttó összeg', 'ÁFA összeg', 'Pénznem',
      'Kategória', 'Projekt'
    ];

    const exportData = filteredAndSortedSubmittedInvoices.map(invoice => getExportData(invoice));
    await exportToFile(headers, exportData, exportFormat, 'bekuldott_szamlak');
  };

  const handleExport = (exportFormat: 'csv' | 'xlsx') => {
    if (isSubmittedTab) {
      handleExportSubmitted(exportFormat);
    } else {
      handleExportNav(exportFormat);
    }
  };

  const handleBulkCategoryChange = async (categoryId: string | null) => {
    if (selectedInvoiceIds.size === 0) {
      toast({ title: 'Nincs kijelölt számla', variant: 'destructive' });
      return;
    }
    const ids = Array.from(selectedInvoiceIds);
    const value = categoryId === 'none' ? null : categoryId;
    try {
      if (isSubmittedTab) {
        const { error } = await supabase
          .from('invoices')
          .update({ category_id: value })
          .in('id', ids);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('nav_invoices')
          .update({ category_id: value })
          .in('id', ids);
        if (error) throw error;

        // Also update twin invoices in `invoices` table
        const selectedInvoices = filteredAndSortedNavInvoices.filter(inv => selectedInvoiceIds.has(inv.id));
        const invoiceNumbers = selectedInvoices.map(inv => inv.invoice_number).filter(Boolean);
        if (invoiceNumbers.length > 0) {
          await supabase
            .from('invoices')
            .update({ category_id: value })
            .in('bizonylatsorszam', invoiceNumbers);
        }
      }
      setSelectedInvoiceIds(new Set());
      invalidateInvoiceData();
      toast({ title: `${ids.length} db számla kategóriája frissítve` });
    } catch (error) {
      reportError({ type: 'db_query', component: 'useInvoiceMutations', action: 'error', message: 'Error bulk updating category:', error });
      toast({ title: 'Hiba a csoportos kategória hozzárendelésnél', variant: 'destructive' });
    }
  };

  const handleBulkProjectChange = async (projectId: string | null) => {
    if (selectedInvoiceIds.size === 0) {
      toast({ title: 'Nincs kijelölt számla', variant: 'destructive' });
      return;
    }
    const ids = Array.from(selectedInvoiceIds);
    const value = projectId === 'none' ? null : projectId;
    try {
      if (isSubmittedTab) {
        const { error } = await supabase
          .from('invoices')
          .update({ project_id: value })
          .in('id', ids);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('nav_invoices')
          .update({ project_id: value })
          .in('id', ids);
        if (error) throw error;

        // Also update twin invoices in `invoices` table
        const selectedInvoices = filteredAndSortedNavInvoices.filter(inv => selectedInvoiceIds.has(inv.id));
        const invoiceNumbers = selectedInvoices.map(inv => inv.invoice_number).filter(Boolean);
        if (invoiceNumbers.length > 0) {
          await supabase
            .from('invoices')
            .update({ project_id: value })
            .in('bizonylatsorszam', invoiceNumbers);
        }
      }
      setSelectedInvoiceIds(new Set());
      invalidateInvoiceData();
      toast({ title: `${ids.length} db számla projektje frissítve` });
    } catch (error) {
      reportError({ type: 'db_query', component: 'useInvoiceMutations', action: 'error', message: 'Error bulk updating project:', error });
      toast({ title: 'Hiba a csoportos projekt hozzárendelésnél', variant: 'destructive' });
    }
  };

  const handleBulkDeleteSubmitted = async () => {
    if (selectedInvoiceIds.size === 0) {
      toast({ title: 'Nincs kijelölt számla', variant: 'destructive' });
      return;
    }
    const ids = Array.from(selectedInvoiceIds);
    try {
      const { error } = await supabase
        .from('invoices')
        .delete()
        .in('id', ids);
      if (error) throw error;
      setSelectedInvoiceIds(new Set());
      invalidateInvoiceData();
      toast({ title: `${ids.length} db számla sikeresen törölve` });
    } catch (error) {
      reportError({ type: 'db_query', component: 'useInvoiceMutations', action: 'error', message: 'Error bulk deleting invoices:', error });
      toast({ title: 'Hiba a csoportos törléskor', variant: 'destructive' });
    }
  };

  return {
    syncing,
    canSync,
    cooldownSeconds,
    formatCooldown,
    handleSync,
    handleProjectChange,
    handleCategoryChange,
    handleToggleSubmitted,
    handleExport,
    handleBulkCategoryChange,
    handleBulkProjectChange,
    handleBulkDeleteSubmitted,
  };
}
