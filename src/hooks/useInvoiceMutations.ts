import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { exportToFile } from '@/lib/exportUtils';
import type { NavInvoice, SubmittedInvoice } from './useInvoiceData';
import type { ItemProjectAllocation } from '@/types/invoices';
import { reportError } from '@/lib/errorReporter';
import { extractNavSyncError, isNavTransientError } from '@/lib/nav/navErrorUtils';
import type { SyncProgress } from '@/components/nav/NavSyncDialog';
import { useQueryClient } from '@tanstack/react-query';
import { extractStoragePath } from '@/lib/utils';
import { useTranslation } from 'react-i18next';

interface UseInvoiceMutationsParams {
  companyId: string;
  selectedCompany: { id: string; name: string; tax_number?: string | null; country_code?: string | null } | null;
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
  const { t } = useTranslation(['invoices', 'common']);
  const queryClient = useQueryClient();
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
      const isHr = selectedCompany?.country_code === 'HR';
      if (isHr) {
        const { data, error } = await (supabase.from as any)('minimax_sync_logs')
          .select('created_at')
          .eq('company_id', selectedCompany.id)
          .in('status', ['completed', 'running'])
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!error && (data as any)?.created_at) {
          setServerLastSyncTime(new Date((data as any).created_at));
        } else {
          setServerLastSyncTime(null);
        }
      } else {
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
      toast({ title: t('invoices:mutations.no_company', 'Nincs kiválasztott cég'), variant: 'destructive' });
      return;
    }

    if (!canSync) {
      toast({
        title: t('invoices:mutations.wait_cooldown', {
          cooldown: formatCooldown(cooldownSeconds),
          defaultValue: `Kérlek várj még ${formatCooldown(cooldownSeconds)} a következő szinkronizálásig`,
        }),
        variant: 'destructive',
      });
      return;
    }

    setSyncing(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        toast({ title: t('invoices:mutations.no_session', 'Nincs érvényes munkamenet'), variant: 'destructive' });
        return;
      }

      // Croatian company: Minimax API sync
      if (selectedCompany.country_code === 'HR') {
        onProgress?.({ currentChunk: 1, totalChunks: 1, totalInvoices: 0 });
        const { data, error } = await supabase.functions.invoke('minimax-sync', {
          body: {
            action: 'sync',
            companyId: selectedCompany.id,
            dateFrom: syncDateFrom,
            dateTo: syncDateTo,
            direction: 'BOTH',
          },
          headers: { Authorization: `Bearer ${session.access_token}` },
        });

        if (error || data?.error) {
          throw new Error(error?.message || data?.error || t('invoices:minimax_sync.toast_error_title', 'Minimax szinkronizálási hiba történt'));
        }

        const totalSaved = data?.totalSaved ?? data?.totalFetched ?? 0;
        toast({
          title: t('invoices:minimax_sync.toast_success_title', 'Minimax szinkronizálás kész'),
          description: t('invoices:minimax_sync.toast_success_desc', {
            count: totalSaved,
            defaultValue: `${totalSaved} horvát számla sikeresen letöltve és mentve.`,
          }),
        });

        setServerLastSyncTime(new Date());
        invalidateInvoiceData();
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
            const errText = await extractNavSyncError(error, data);
            errors.push(`${t('invoices:mutations.direction_outbound', 'Kimenő')} (${chunk.from}): ${errText}`);
          } else if (data?.success) {
            totalOutbound += data.totalInvoices || 0;
          }
        } else if (outboundResult.status === 'rejected') {
          const errText = await extractNavSyncError(outboundResult.reason);
          errors.push(`${t('invoices:mutations.direction_outbound', 'Kimenő')} (${chunk.from}): ${errText}`);
        }

        if (inboundResult.status === 'fulfilled') {
          const { data, error } = inboundResult.value;
          if (error || data?.error) {
            const errText = await extractNavSyncError(error, data);
            errors.push(`${t('invoices:mutations.direction_inbound', 'Bejövő')} (${chunk.from}): ${errText}`);
          } else if (data?.success) {
            totalInbound += data.totalInvoices || 0;
          }
        } else if (inboundResult.status === 'rejected') {
          const errText = await extractNavSyncError(inboundResult.reason);
          errors.push(`${t('invoices:mutations.direction_inbound', 'Bejövő')} (${chunk.from}): ${errText}`);
        }

        // Report chunk progress
        onProgress?.({ currentChunk: i + 1, totalChunks: dateChunks.length, totalInvoices: totalOutbound + totalInbound });
      }

      const totalInvoices = totalOutbound + totalInbound;
      setServerLastSyncTime(new Date());

      if (errors.length > 0) {
        if (totalInvoices === 0) {
          throw new Error(errors.join('; '));
        } else {
          toast({
            title: t('invoices:mutations.sync_partial_title', 'Szinkronizálás részben sikeres'),
            description: t('invoices:mutations.sync_partial_desc', {
              count: totalInvoices,
              outbound: totalOutbound,
              inbound: totalInbound,
              errors: errors.join('; '),
              defaultValue: `${totalInvoices} számla letöltve (${totalOutbound} kimenő, ${totalInbound} bejövő). Hibák: ${errors.join('; ')}`,
            }),
          });
        }
      } else {
        toast({
          title: t('invoices:mutations.sync_success_title', 'Sikeres szinkronizálás!'),
          description: t('invoices:mutations.sync_success_desc', {
            count: totalInvoices,
            outbound: totalOutbound,
            inbound: totalInbound,
            defaultValue: `Összesen ${totalInvoices} számla: ${totalOutbound} kimenő, ${totalInbound} bejövő`,
          }),
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
          reportError({ type: 'api_call', severity: 'warning', component: 'useInvoiceMutations', action: 'warning', message: 'Categorization webhook failed:', error: categorizationError });
        }
      }

      setSelectedInvoiceIds(new Set());
      invalidateInvoiceData();
    } catch (error: any) {
      const isTransient = isNavTransientError(error?.message || '');
      reportError({
        type: 'api_call',
        severity: isTransient ? 'warning' : 'error',
        component: 'useInvoiceMutations',
        action: 'nav_sync',
        message: 'NAV Sync error:',
        error: error
      });
      toast({ title: error.message || t('invoices:mutations.sync_error', 'Nem sikerült szinkronizálni a számlákat'), variant: 'destructive' });
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
      toast({ title: t('invoices:mutations.project_assigned', 'Projekt hozzárendelve') });
    } catch (error) {
      reportError({ type: 'db_query', component: 'useInvoiceMutations', action: 'error', message: 'Error updating project:', error });
      toast({ title: t('invoices:mutations.project_error', 'Hiba a projekt hozzárendelésekor'), variant: 'destructive' });
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
      toast({ title: t('invoices:mutations.category_assigned', 'Kategória hozzárendelve') });
    } catch (error) {
      reportError({ type: 'db_query', component: 'useInvoiceMutations', action: 'error', message: 'Error updating category:', error });
      toast({ title: t('invoices:mutations.category_error', 'Hiba a kategória hozzárendelésekor'), variant: 'destructive' });
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
      toast({
        title: newValue
          ? t('invoices:mutations.submitted_marked', 'Beküldve megjelölve')
          : t('invoices:mutations.submitted_unmarked', 'Beküldve visszavonva'),
      });
    } catch (error) {
      reportError({ type: 'db_query', component: 'useInvoiceMutations', action: 'error', message: 'Error updating submitted status:', error: error });
      toast({ title: t('invoices:mutations.status_error', 'Hiba a státusz frissítésekor'), variant: 'destructive' });
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
        invoice.currency || 'HUF',
        invoice.invoice_net_amount?.toString() || '0',
        invoice.invoice_vat_amount?.toString() || '0',
        invoice.invoice_gross_amount?.toString() || '0',
        invoice.match_status === 'partially_paid'
          ? t('invoices:status.partial', 'Részben fizetve')
          : (invoice.paid || invoice.transaction_id ? t('invoices:export.yes', 'Igen') : t('invoices:export.no', 'Nem')),
        invoice.submitted ? t('invoices:export.yes', 'Igen') : t('invoices:export.no', 'Nem'),
      ];
    };

    const headers = [
      t('invoices:export.direction', 'Irány'),
      t('invoices:export.invoice_number', 'Bizonylatsorszám'),
      t('invoices:export.issue_date', 'Kibocsátás dátuma'),
      t('invoices:export.fulfillment_date', 'Teljesítés dátuma'),
      t('invoices:export.partner_name', 'Partner név'),
      t('invoices:export.partner_tax', 'Partner adószám'),
      t('invoices:export.currency', 'Pénznem'),
      t('invoices:export.net_amount', 'Nettó összeg (deviza)'),
      t('invoices:export.vat_amount', 'ÁFA összeg (deviza)'),
      t('invoices:export.gross_amount', 'Bruttó összeg (deviza)'),
      t('invoices:export.paid', 'Fizetve'),
      t('invoices:export.submitted', 'Beküldve'),
    ];

    const exportData = filteredAndSortedNavInvoices.map(invoice => getExportData(invoice));
    await exportToFile(headers, exportData, exportFormat, t('invoices:export.nav_filename', 'nav_szamlak'));
  };

  const handleExportSubmitted = async (exportFormat: 'csv' | 'xlsx') => {
    const getExportData = (invoice: SubmittedInvoice) => {
      return [
        invoice.bizonylatsorszam || '',
        invoice.kibocsatas_datuma || '',
        invoice.teljesites_datuma || '',
        invoice.elado_nev || '',
        invoice.vevo_nev || '',
        invoice.penznem || 'HUF',
        invoice.adoalap_osszesen?.toString() || '0',
        invoice.afa_osszeg_osszesen?.toString() || '0',
        invoice.brutto_vegosszeg?.toString() || '0',
        getCategoryName(invoice.category_id),
        getProjectName(invoice.project_id)
      ];
    };

    const headers = [
      t('invoices:export.invoice_number', 'Bizonylatszám'),
      t('invoices:export.issue_date', 'Kibocsátás dátuma'),
      t('invoices:export.fulfillment_date', 'Teljesítés dátuma'),
      t('invoices:export.seller', 'Eladó'),
      t('invoices:export.buyer', 'Vevő'),
      t('invoices:export.currency', 'Pénznem'),
      t('invoices:export.net_amount', 'Nettó összeg (deviza)'),
      t('invoices:export.vat_amount', 'ÁFA összeg (deviza)'),
      t('invoices:export.gross_amount', 'Bruttó összeg (deviza)'),
      t('invoices:export.category', 'Kategória'),
      t('invoices:export.project', 'Projekt'),
    ];

    const exportData = filteredAndSortedSubmittedInvoices.map(invoice => getExportData(invoice));
    await exportToFile(headers, exportData, exportFormat, t('invoices:export.submitted_filename', 'bekuldott_szamlak'));
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
      toast({ title: t('invoices:mutations.no_selection', 'Nincs kijelölt számla'), variant: 'destructive' });
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
      toast({
        title: t('invoices:mutations.bulk_category_success', {
          count: ids.length,
          defaultValue: `${ids.length} db számla kategóriája frissítve`,
        }),
      });
    } catch (error) {
      reportError({ type: 'db_query', component: 'useInvoiceMutations', action: 'error', message: 'Error bulk updating category:', error });
      toast({ title: t('invoices:mutations.bulk_category_error', 'Hiba a csoportos kategória hozzárendelésnél'), variant: 'destructive' });
    }
  };

  const handleBulkExcludeFromAccounting = async (
    exclusionType: 'PERMANENT' | 'DEFERRED_VAT' | null,
    reason?: string | null
  ) => {
    if (selectedInvoiceIds.size === 0) {
      toast({ title: t('invoices:mutations.no_selection', 'Nincs kijelölt számla'), variant: 'destructive' });
      return;
    }
    const ids = Array.from(selectedInvoiceIds);

    // Optimistically update React Query caches so the UI updates instantly with zero flicker
    const updateList = (old: any) => {
      if (!Array.isArray(old)) return old;
      return old.map((inv: any) =>
        selectedInvoiceIds.has(inv.id)
          ? {
              ...inv,
              exclude_from_accounting: exclusionType !== null,
              accounting_exclusion_type: exclusionType,
              deferred_vat_reason: exclusionType ? (reason?.trim() || null) : null,
            }
          : inv
      );
    };

    if (companyId) {
      queryClient.setQueriesData({ queryKey: ['filteredNavInvoices', companyId] }, updateList);
      queryClient.setQueriesData({ queryKey: ['filteredSubmittedInvoices', companyId] }, updateList);
      queryClient.setQueriesData({ queryKey: ['submittedInvoices', companyId] }, updateList);
      queryClient.setQueriesData({ queryKey: ['page-matched-nav-invoices', companyId] }, updateList);
    }

    try {
      const { error } = await supabase.rpc('bulk_set_invoice_accounting_exclusion', {
        p_company_id: companyId,
        p_invoice_ids: ids,
        p_is_submitted: isSubmittedTab,
        p_exclusion_type: exclusionType,
        p_reason: exclusionType ? (reason?.trim() || null) : null,
      });

      if (error) throw error;

      setSelectedInvoiceIds(new Set());
      invalidateInvoiceData();
      queryClient.invalidateQueries({ queryKey: ['questionable_invoices'] });
      queryClient.invalidateQueries({ queryKey: ['vat_return'] });
      queryClient.invalidateQueries({ queryKey: ['vat_return_lines'] });
      queryClient.invalidateQueries({ queryKey: ['vat_return_m_lines'] });
      queryClient.invalidateQueries({ queryKey: ['gl_balances'] });
      queryClient.invalidateQueries({ queryKey: ['gl_categorized_items'] });
      queryClient.invalidateQueries({ queryKey: ['acc_journal_headers'] });

      toast({
        title: exclusionType === null
          ? t('invoices:exclusion.restored_title', 'Visszaállítva a könyvelésbe')
          : exclusionType === 'DEFERRED_VAT'
            ? t('invoices:exclusion.deferred_success_title', 'ÁFA levonás elhalasztva')
            : t('invoices:exclusion.permanent_success_title', 'Kizárva a könyvelésből'),
        description: exclusionType === null
          ? t('invoices:mutations.bulk_restored_desc', {
              count: ids.length,
              defaultValue: `${ids.length} db számla sikeresen visszaállítva a könyvelésbe és az ÁFA levonásba.`,
            })
          : exclusionType === 'DEFERRED_VAT'
            ? t('invoices:mutations.bulk_deferred_desc', {
                count: ids.length,
                defaultValue: `${ids.length} db számla sikeresen kérdésesként rögzítve (halasztott ÁFA levonással).`,
              })
            : t('invoices:mutations.bulk_permanent_desc', {
                count: ids.length,
                defaultValue: `${ids.length} db számla véglegesen kizárva a könyvelésből és az ÁFA levonásból.`,
              }),
      });
    } catch (error: any) {
      reportError({ type: 'db_query', component: 'useInvoiceMutations', action: 'error', message: 'Error bulk updating accounting exclusion:', error });
      toast({
        title: t('invoices:mutations.bulk_exclusion_error', 'Hiba a könyvelési státusz csoportos módosításakor'),
        description: error?.message,
        variant: 'destructive',
      });
      invalidateInvoiceData();
    }
  };

  const handleBulkProjectChange = async (
    projectIdOrAllocations: string | ItemProjectAllocation[] | null
  ) => {
    if (selectedInvoiceIds.size === 0) {
      toast({ title: t('invoices:mutations.no_selection', 'Nincs kijelölt számla'), variant: 'destructive' });
      return;
    }
    const ids = Array.from(selectedInvoiceIds);

    let singleProjectId: string | null = null;
    let allocations: ItemProjectAllocation[] | null = null;

    if (Array.isArray(projectIdOrAllocations)) {
      allocations = projectIdOrAllocations.length > 0 ? projectIdOrAllocations : null;
      singleProjectId = (allocations && allocations.length === 1 && Math.abs(allocations[0].percentage - 100) < 0.01)
        ? allocations[0].project_id
        : null;
    } else if (projectIdOrAllocations === 'none' || projectIdOrAllocations === null) {
      singleProjectId = null;
      allocations = null;
    } else {
      singleProjectId = projectIdOrAllocations;
      allocations = [{ project_id: projectIdOrAllocations, percentage: 100 }];
    }

    try {
      if (isSubmittedTab) {
        // 1. Update invoices table
        const { error: invErr } = await supabase
          .from('invoices')
          .update({ project_id: singleProjectId })
          .in('id', ids);
        if (invErr) throw invErr;

        // 2. Update invoice_items table
        const { error: itemsErr } = await supabase
          .from('invoice_items')
          .update({
            project_id: singleProjectId,
            project_allocations: allocations,
          })
          .in('invoice_id', ids);
        if (itemsErr) console.warn('Warning updating invoice_items in bulk:', itemsErr);
      } else {
        // 1. Update nav_invoices table
        const { error: navErr } = await supabase
          .from('nav_invoices')
          .update({ project_id: singleProjectId })
          .in('id', ids);
        if (navErr) throw navErr;

        // 2. Update nav_invoice_items table
        const { error: navItemsErr } = await supabase
          .from('nav_invoice_items')
          .update({
            project_id: singleProjectId,
            project_allocations: allocations,
          })
          .in('nav_invoice_id', ids);
        if (navItemsErr) console.warn('Warning updating nav_invoice_items in bulk:', navItemsErr);

        // 3. Also update twin invoices in `invoices` and `invoice_items`
        const selectedInvoices = filteredAndSortedNavInvoices.filter(inv => selectedInvoiceIds.has(inv.id));
        const invoiceNumbers = selectedInvoices.map(inv => inv.invoice_number).filter(Boolean);
        if (invoiceNumbers.length > 0) {
          const { data: twinInvoices } = await supabase
            .from('invoices')
            .update({ project_id: singleProjectId })
            .in('bizonylatsorszam', invoiceNumbers)
            .select('id');

          const twinIds = (twinInvoices || []).map(t => t.id);
          if (twinIds.length > 0) {
            await supabase
              .from('invoice_items')
              .update({
                project_id: singleProjectId,
                project_allocations: allocations,
              })
              .in('invoice_id', twinIds);
          }
        }
      }

      setSelectedInvoiceIds(new Set());
      queryClient.invalidateQueries({ queryKey: ['invoice-item-projects'] });
      queryClient.invalidateQueries({ queryKey: ['invoiceItems'] });
      invalidateInvoiceData();

      const successMessage = allocations && allocations.length > 1
        ? `${ids.length} db számla felosztva ${allocations.length} projekt között (100%)`
        : singleProjectId
          ? `${ids.length} db számla projektje frissítve`
          : `${ids.length} db számla projektje törölve`;

      toast({ title: successMessage });
    } catch (error) {
      reportError({ type: 'db_query', component: 'useInvoiceMutations', action: 'error', message: 'Error bulk updating project:', error });
      toast({ title: t('invoices:mutations.bulk_project_error', 'Hiba a csoportos projekt hozzárendelésnél'), variant: 'destructive' });
    }
  };

  const handleBulkDeleteSubmitted = async (mode: 'row_only' | 'row_and_file' = 'row_only') => {
    if (selectedInvoiceIds.size === 0) {
      toast({ title: t('invoices:mutations.no_selection', 'Nincs kijelölt számla'), variant: 'destructive' });
      return;
    }
    const ids = Array.from(selectedInvoiceIds);
    try {
      if (mode === 'row_and_file') {
        // Fetch invoice rows first to get their storage urls and invoice_uploads_id
        const { data: invRows, error: fetchErr } = await supabase
          .from('invoices')
          .select('id, image_url, melleklet_url, invoice_uploads_id')
          .in('id', ids);

        if (fetchErr) throw fetchErr;

        // 1. Delete invoice records (invoice_items cascades automatically)
        const { error: deleteError } = await supabase
          .from('invoices')
          .delete()
          .in('id', ids);

        if (deleteError) throw deleteError;

        // 2. Identify unique invoice_uploads_id
        const uploadIds = Array.from(
          new Set(
            (invRows || [])
              .map((r) => r.invoice_uploads_id)
              .filter((id): id is string => Boolean(id))
          )
        );

        for (const uploadId of uploadIds) {
          // Check if any remaining invoices still reference this upload record
          const { data: remainingInvoices } = await supabase
            .from('invoices')
            .select('id')
            .eq('invoice_uploads_id', uploadId);

          if (!remainingInvoices || remainingInvoices.length === 0) {
            const { data: uploadData } = await supabase
              .from('invoice_uploads')
              .select('file_url')
              .eq('id', uploadId)
              .maybeSingle();

            const { error: delUploadError } = await supabase
              .from('invoice_uploads')
              .delete()
              .eq('id', uploadId);

            if (delUploadError) {
              console.error('Error deleting invoice_uploads:', delUploadError);
            }

            if (uploadData?.file_url) {
              const storagePath = extractStoragePath(uploadData.file_url, 'invoice-uploads');
              if (storagePath) {
                await supabase.storage.from('invoice-uploads').remove([storagePath]);
              }
            }
          }
        }

        // 3. Clean up direct storage paths
        const directUrls = new Set<string>();
        for (const row of invRows || []) {
          if (row.image_url) directUrls.add(row.image_url);
          if (row.melleklet_url) directUrls.add(row.melleklet_url);
        }
        for (const url of directUrls) {
          for (const bucket of ['invoice-uploads', 'szla_image']) {
            const storagePath = extractStoragePath(url, bucket);
            if (storagePath) {
              await supabase.storage.from(bucket).remove([storagePath]);
            }
          }
        }

        setSelectedInvoiceIds(new Set());
        invalidateInvoiceData();
        queryClient.invalidateQueries({ queryKey: ['invoice_uploads_with_invoices'] });
        queryClient.invalidateQueries({ queryKey: ['uploadHistory'] });

        toast({
          title: t('invoices:mutations.delete_success_title', 'Sikeres törlés'),
          description: t('invoices:mutations.delete_success_files', {
            count: ids.length,
            defaultValue: `${ids.length} db számla és a hozzájuk tartozó feltöltött fájlok véglegesen törölve lettek.`,
          }),
        });
      } else {
        // mode === 'row_only': Only delete the invoice rows
        const { error } = await supabase
          .from('invoices')
          .delete()
          .in('id', ids);

        if (error) throw error;
        setSelectedInvoiceIds(new Set());
        invalidateInvoiceData();
        toast({
          title: t('invoices:mutations.delete_success_title', 'Sikeres törlés'),
          description: t('invoices:mutations.delete_success_rows', {
            count: ids.length,
            defaultValue: `${ids.length} db számlasor sikeresen törölve (az eredeti dokumentumok megmaradtak).`,
          }),
        });
      }
    } catch (error: any) {
      reportError({ type: 'db_query', component: 'useInvoiceMutations', action: 'error', message: 'Error bulk deleting invoices:', error });
      toast({
        title: t('invoices:mutations.delete_error', 'Hiba a csoportos törléskor'),
        description: error?.message,
        variant: 'destructive',
      });
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
    handleBulkExcludeFromAccounting,
    handleBulkDeleteSubmitted,
  };
}
