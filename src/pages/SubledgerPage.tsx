import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCompany } from '@/contexts/CompanyContext';
import { useDateRange } from '@/contexts/DateRangeContext';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Layers,
  Search,
  CheckCircle2,
  AlertCircle,
  FileSpreadsheet,
  Link2,
  Sparkles,
  ArrowRightLeft,
  Calendar,
  Loader2,
  Clock,
  Coins,
  Zap,
  HelpCircle,
  FileCheck,
  RotateCcw,
  Check,
  ChevronDown,
  ChevronRight,
  Edit3,
} from 'lucide-react';
import {
  useSubledgerItems,
  useSubledgerAccounts,
  useSettleOpenItems,
  useAutoSettleSubledgerItems,
  useBatchPostSubledgerItems,
  useUnpostSubledgerEntry,
} from '@/hooks/useSubledger';
import type { SubledgerItem, SubledgerMode, SubledgerStatusFilter, GroupedSubledgerInvoice } from '@/types/subledger';
import { formatCurrency } from '@/lib/utils';
import { SubledgerItemMatchesModal } from '@/components/subledger/SubledgerItemMatchesModal';
import { WriteOffSettlementModal } from '@/components/subledger/WriteOffSettlementModal';
import { BulkRoundingWriteOffModal } from '@/components/subledger/BulkRoundingWriteOffModal';
import { SubledgerExportDialog } from '@/components/subledger/SubledgerExportDialog';
import { SubledgerPostingModal } from '@/components/subledger/SubledgerPostingModal';
import AddManualJournalEntryModal from '@/components/journals/AddManualJournalEntryModal';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

export default function SubledgerPage() {
  const { selectedCompany } = useCompany();
  const companyId = selectedCompany?.id;
  const companyName = selectedCompany?.name || 'Cég';

  const { dateFromFormatted: dateFrom, dateToFormatted: dateTo } = useDateRange();

  // Filters & State
  const [selectedGlAccountId, setSelectedGlAccountId] = useState<string>('all');
  const [selectedPartnerId, setSelectedPartnerId] = useState<string>('all');
  const [mode, setMode] = useState<SubledgerMode>('OPEN');
  const [statusFilter, setStatusFilter] = useState<SubledgerStatusFilter>('ALL_ACTIVE');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [showHelpGuide, setShowHelpGuide] = useState<boolean>(false);

  // Selected Group Keys for Multi-pairing / Batch Actions (group keys of invoices)
  const [selectedGroupKeys, setSelectedGroupKeys] = useState<Set<string>>(new Set());

  // Accordion expanded rows state (set of group_keys)
  const [expandedGroupKeys, setExpandedGroupKeys] = useState<Set<string>>(new Set());

  // Modals state
  const [activeItemForMatches, setActiveItemForMatches] = useState<SubledgerItem | null>(null);
  const [activeItemForWriteOff, setActiveItemForWriteOff] = useState<SubledgerItem | null>(null);
  const [bulkRoundingOpen, setBulkRoundingOpen] = useState<boolean>(false);
  const [exportDialogOpen, setExportDialogOpen] = useState<boolean>(false);

  // Posting & Editing Modals
  const [postingModalOpen, setPostingModalOpen] = useState<boolean>(false);
  const [invoicesToPost, setInvoicesToPost] = useState<GroupedSubledgerInvoice[]>([]);
  const [isEditModeForModal, setIsEditModeForModal] = useState<boolean>(false);
  const [unpostConfirmInvoice, setUnpostConfirmInvoice] = useState<GroupedSubledgerInvoice | null>(null);
  const [manualEntryOpen, setManualEntryOpen] = useState<boolean>(false);
  const [editingHeaderId, setEditingHeaderId] = useState<string | null>(null);

  const unpostMutation = useUnpostSubledgerEntry();

  // Queries
  const { data: accounts = [], isLoading: isLoadingAccounts } = useSubledgerAccounts(companyId);

  const { data: partners = [] } = useQuery({
    queryKey: ['subledgerPartners', companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const { data, error } = await supabase
        .from('partners')
        .select('id, name, tax_number')
        .eq('company_id', companyId)
        .order('name', { ascending: true });
      if (error) return [];
      return data || [];
    },
    enabled: !!companyId,
  });

  const {
    data: items = [],
    isLoading: isLoadingItems,
    refetch: refetchItems,
  } = useSubledgerItems(
    companyId,
    selectedGlAccountId,
    selectedPartnerId,
    mode,
    dateFrom,
    dateTo,
    statusFilter
  );

  const settleMutation = useSettleOpenItems();
  const autoSettleMutation = useAutoSettleSubledgerItems();
  const batchPostMutation = useBatchPostSubledgerItems();

  // Filtered Items by search term
  const filteredItems = useMemo(() => {
    if (!searchTerm.trim()) return items;
    const term = searchTerm.toLowerCase();
    return items.filter(
      (item) =>
        item.document_id.toLowerCase().includes(term) ||
        (item.settlement_number && item.settlement_number.toLowerCase().includes(term)) ||
        (item.partner_name && item.partner_name.toLowerCase().includes(term)) ||
        (item.description && item.description.toLowerCase().includes(term)) ||
        item.gl_number.includes(term)
    );
  }, [items, searchTerm]);

  // Group filtered items into single rows per invoice
  const groupedInvoices = useMemo<GroupedSubledgerInvoice[]>(() => {
    const map = new Map<string, GroupedSubledgerInvoice>();

    filteredItems.forEach((item) => {
      const docId =
        (item.document_id && item.document_id.trim()) ||
        (item.settlement_number && item.settlement_number.trim()) ||
        item.header_id;
      const partnerKey = item.partner_id || item.partner_name || 'no-partner';
      const key = `${partnerKey}___${docId}`;

      const existing = map.get(key);
      if (!existing) {
        map.set(key, {
          group_key: key,
          document_id: docId,
          partner_id: item.partner_id,
          partner_name: item.partner_name,
          posting_date: item.posting_date,
          document_date: item.document_date || item.posting_date,
          due_date: item.due_date,
          journal_code: item.journal_code,
          journal_number: item.journal_number,
          currency: item.currency || 'HUF',
          description: item.description,
          status: item.status,
          is_settled: item.is_settled,
          net_amount: Number(item.net_amount || 0),
          vat_amount: Number(item.vat_amount || 0),
          amount: Number(item.amount || 0),
          settled_amount: Number(item.settled_amount || 0),
          remaining_amount: Number(item.remaining_amount || 0),
          match_count: item.match_count || 0,
          items: [item],
          header_ids: [item.header_id],
          line_ids: [item.line_id],
          all_lines: item.all_lines ? [...item.all_lines] : [],
        });
      } else {
        existing.items.push(item);
        if (!existing.header_ids.includes(item.header_id)) {
          existing.header_ids.push(item.header_id);
        }
        existing.line_ids.push(item.line_id);
        if (item.all_lines) {
          existing.all_lines.push(...item.all_lines);
        }
        existing.net_amount += Number(item.net_amount || 0);
        existing.vat_amount += Number(item.vat_amount || 0);
        existing.amount += Number(item.amount || 0);
        existing.settled_amount += Number(item.settled_amount || 0);
        existing.remaining_amount += Number(item.remaining_amount || 0);
        existing.match_count += item.match_count || 0;

        if (item.status === 'GEPI_JAVASLAT') {
          existing.status = 'GEPI_JAVASLAT';
        } else if (item.status === 'KEZI_PISZKOZAT' && existing.status !== 'GEPI_JAVASLAT') {
          existing.status = 'KEZI_PISZKOZAT';
        }

        existing.is_settled = existing.remaining_amount <= 0.01;

        if (item.due_date && (!existing.due_date || item.due_date > existing.due_date)) {
          existing.due_date = item.due_date;
        }
      }
    });

    return Array.from(map.values());
  }, [filteredItems]);

  // Overall stats based on grouped invoices
  const stats = useMemo(() => {
    let openCount = 0;
    let openSumHuf = 0;
    let settledSumHuf = 0;
    let overdueCount = 0;
    let overdueSumHuf = 0;
    let smallRoundingCount = 0;
    let draftCount = 0;
    let totalNetHuf = 0;
    let totalVatHuf = 0;
    let totalGrossHuf = 0;
    const now = new Date();

    groupedInvoices.forEach((inv) => {
      totalNetHuf += inv.net_amount || 0;
      totalVatHuf += inv.vat_amount || 0;
      totalGrossHuf += inv.amount || 0;

      if (!inv.is_settled && inv.remaining_amount > 0) {
        openCount++;
        openSumHuf += inv.remaining_amount;
        if (inv.due_date && new Date(inv.due_date) < now) {
          overdueCount++;
          overdueSumHuf += inv.remaining_amount;
        }
        if (inv.remaining_amount <= 10) {
          smallRoundingCount++;
        }
      }
      if (inv.status === 'GEPI_JAVASLAT') {
        draftCount++;
      }
      settledSumHuf += inv.settled_amount;
    });

    return {
      draftHeaders,
      openCount,
      openSumHuf,
      settledSumHuf,
      overdueCount,
      overdueSumHuf,
      smallRoundingCount,
      draftCount,
      totalNetHuf,
      totalVatHuf,
      totalGrossHuf,
    };
  }, [groupedInvoices]);

  // Selected invoices and items calculations
  const selectedInvoices = useMemo(() => {
    return groupedInvoices.filter((inv) => selectedGroupKeys.has(inv.group_key));
  }, [groupedInvoices, selectedGroupKeys]);

  const selectedItems = useMemo(() => {
    return selectedInvoices.flatMap((inv) => inv.items);
  }, [selectedInvoices]);

  const selectionTotals = useMemo(() => {
    let sumT = 0;
    let sumK = 0;
    let foreignSum = 0;
    let currencies = new Set<string>();
    let draftInvoices: GroupedSubledgerInvoice[] = [];
    let draftHeaders: any[] = [];

    selectedInvoices.forEach((inv) => {
      inv.items.forEach((i) => {
        const val = !i.is_settled && i.remaining_amount > 0 ? i.remaining_amount : i.amount;
        if (i.dc_type === 'T') {
          sumT += val;
        } else {
          sumK += val;
        }
        if (i.currency !== 'HUF' && i.foreign_amount) {
          foreignSum += i.foreign_amount;
          currencies.add(i.currency);
        }
      });
      if (inv.status === 'GEPI_JAVASLAT') {
        draftInvoices.push(inv);
      }
    });

    const diff = Math.abs(sumT - sumK);
    const balance = sumT - sumK;
    const isBalanced = diff < 0.01 && selectedInvoices.length >= 2;
    const isSmallDiff = diff > 0.01 && diff <= 10;

    return {
      draftHeaders,
      count: selectedInvoices.length,
      itemCount: selectedItems.length,
      sumT,
      sumK,
      balance,
      diff,
      isBalanced,
      isSmallDiff,
      foreignSum,
      currencies: Array.from(currencies).join(', '),
      draftInvoices,
    };
  }, [selectedInvoices, selectedItems]);

  // Toggle accordion expand for an invoice
  const handleToggleExpand = (groupKey: string) => {
    setExpandedGroupKeys((prev) => {
      const next = new Set(prev);
      if (next.has(groupKey)) {
        next.delete(groupKey);
      } else {
        next.add(groupKey);
      }
      return next;
    });
  };

  const handleToggleAllExpand = () => {
    if (expandedGroupKeys.size === groupedInvoices.length && groupedInvoices.length > 0) {
      setExpandedGroupKeys(new Set());
    } else {
      setExpandedGroupKeys(new Set(groupedInvoices.map((i) => i.group_key)));
    }
  };

  // Open posting modal for single invoice
  const handleOpenPostSingle = (invoice: GroupedSubledgerInvoice) => {
    setInvoicesToPost([invoice]);
    setIsEditModeForModal(false);
    setPostingModalOpen(true);
  };

  // Open batch posting modal from selection bar
  const handleOpenBatchPost = () => {
    const drafts = selectionTotals.draftInvoices;
    setInvoicesToPost(drafts.length > 0 ? drafts : selectedInvoices);
    setIsEditModeForModal(false);
    setPostingModalOpen(true);
  };

  // Open edit modal (draft edits immediately, posted prompts for unpost)
  const handleOpenEdit = (invoice: GroupedSubledgerInvoice) => {
    if (invoice.status === 'GEPI_JAVASLAT') {
      setInvoicesToPost([invoice]);
      setIsEditModeForModal(true);
      setPostingModalOpen(true);
    } else {
      setUnpostConfirmInvoice(invoice);
    }
  };

  // Confirm unpost of already posted invoice
  const handleConfirmUnpost = async () => {
    if (!unpostConfirmInvoice) return;
    try {
      await Promise.all(
        unpostConfirmInvoice.header_ids.map((headerId) =>
          unpostMutation.mutateAsync({
            headerId,
            reason: 'Folyószámláról módosításra visszanyitva',
          })
        )
      );
      const unpostedInvoice: GroupedSubledgerInvoice = {
        ...unpostConfirmInvoice,
        status: 'KEZI_PISZKOZAT',
        items: unpostConfirmInvoice.items.map((it) => ({
          ...it,
          status: 'KEZI_PISZKOZAT',
        })),
      };
      setInvoicesToPost([unpostedInvoice]);
      setIsEditModeForModal(true);
      setPostingModalOpen(true);
      setUnpostConfirmInvoice(null);
    } catch {
      // Handled in onError
    }
  };

  // Toggle selection
  const handleToggleRow = (groupKey: string) => {
    setSelectedGroupKeys((prev) => {
      const next = new Set(prev);
      if (next.has(groupKey)) {
        next.delete(groupKey);
      } else {
        next.add(groupKey);
      }
      return next;
    });
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedGroupKeys(new Set(groupedInvoices.map((i) => i.group_key)));
    } else {
      setSelectedGroupKeys(new Set());
    }
  };

  // Perform multi-item or pairwise settlement
  const handlePairSelected = async () => {
    if (!companyId || selectedItems.length < 2) return;

    const tItems = [...selectedItems.filter((i) => i.dc_type === 'T')];
    const kItems = [...selectedItems.filter((i) => i.dc_type === 'K')];

    if (tItems.length === 0 || kItems.length === 0) {
      alert('Párosításhoz legalább 1 Tartozik (T) és 1 Követel (K) tétel kijelölése szükséges!');
      return;
    }

    try {
      let tIdx = 0;
      let kIdx = 0;
      let remT = !tItems[0].is_settled && tItems[0].remaining_amount > 0 ? tItems[0].remaining_amount : tItems[0].amount;
      let remK = !kItems[0].is_settled && kItems[0].remaining_amount > 0 ? kItems[0].remaining_amount : kItems[0].amount;

      while (tIdx < tItems.length && kIdx < kItems.length) {
        const pairAmount = Math.min(remT, remK);
        if (pairAmount > 0.009) {
          await settleMutation.mutateAsync({
            companyId,
            invoiceLineId: tItems[tIdx].line_id,
            settlingLineId: kItems[kIdx].line_id,
            amountHuf: Number(pairAmount.toFixed(2)),
            matchType: 'MANUAL',
            notes: `Folyószámla rendezés (${tItems[tIdx].document_id} <-> ${kItems[kIdx].document_id})`,
          });
        }

        remT -= pairAmount;
        remK -= pairAmount;

        if (remT <= 0.01) {
          tIdx++;
          if (tIdx < tItems.length) {
            remT = !tItems[tIdx].is_settled && tItems[tIdx].remaining_amount > 0 ? tItems[tIdx].remaining_amount : tItems[tIdx].amount;
          }
        }

        if (remK <= 0.01) {
          kIdx++;
          if (kIdx < kItems.length) {
            remK = !kItems[kIdx].is_settled && kItems[kIdx].remaining_amount > 0 ? kItems[kIdx].remaining_amount : kItems[kIdx].amount;
          }
        }
      }

      setSelectedGroupKeys(new Set());
      refetchItems();
    } catch (err: any) {
      console.error('Error during pairwise settlement:', err);
    }
  };

  // Run Auto-settle
  const handleRunAutoSettle = () => {
    if (!companyId) return;
    autoSettleMutation.mutate({
      companyId,
      glAccountId: selectedGlAccountId !== 'all' ? selectedGlAccountId : undefined,
    });
  };

  // Batch post selected drafts
  const handleBatchPostDrafts = () => {
    if (!companyId || selectionTotals.draftHeaders.length === 0) return;
    handleOpenBatchPost();
  };

  return (
    <div className="space-y-6 pb-20">
      {/* Page Header */}
      <PageHeader
        title="Folyószámla és Analitika"
        description="Vevő, szállító és egyéb analitikus számlák nyitott tételeinek kezelése, automatikus és kézi párosítása és leírása."
        actions={<div className="flex flex-wrap items-center gap-2">
          {/* 1-Click Auto Settle Button */}
          <Button
            onClick={handleRunAutoSettle}
            disabled={autoSettleMutation.isPending}
            className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm flex items-center gap-1.5 font-medium"
          >
            {autoSettleMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Zap className="w-4 h-4 text-amber-300" />
            )}
            <span>Automatikus Párosítás</span>
          </Button>

          {/* Bulk Rounding Button */}
          <Button
            variant="outline"
            onClick={() => setBulkRoundingOpen(true)}
            className="flex items-center gap-1.5 shadow-sm border-slate-300 dark:border-slate-700 text-foreground"
          >
            <Sparkles className="w-4 h-4 text-amber-500" />
            <span>Kerekítések leírása ({stats.smallRoundingCount})</span>
          </Button>

          {/* Export Dialog Trigger */}
          <Button
            variant="outline"
            onClick={() => setExportDialogOpen(true)}
            className="flex items-center gap-1.5 shadow-sm border-slate-300 dark:border-slate-700 text-foreground"
          >
            <FileSpreadsheet className="w-4 h-4 text-indigo-600" />
            <span>Kimutatás Export</span>
          </Button>

          {/* Help Toggle */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowHelpGuide(!showHelpGuide)}
            title="Útmutató megjelenítése"
            className="text-muted-foreground hover:text-foreground"
          >
            <HelpCircle className="w-4 h-4" />
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => refetchItems()}
            title="Frissítés"
            className="p-2 text-muted-foreground hover:text-foreground"
          >
            <RotateCcw className="w-4 h-4" />
          </Button>
        </div>
      }
      />

      {/* Guide Banner */}
      {showHelpGuide && (
        <Card className="border border-indigo-200 dark:border-indigo-900 bg-indigo-50/50 dark:bg-indigo-950/20 shadow-xs">
          <CardContent className="p-4 text-xs space-y-2 text-slate-700 dark:text-slate-300">
            <div className="font-semibold text-sm text-indigo-900 dark:text-indigo-300 flex items-center gap-1.5">
              <HelpCircle className="w-4 h-4 text-indigo-600" />
              <span>Hogyan működik a Folyószámla és Analitika rendszer?</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
              <div className="p-2.5 rounded-lg bg-card/60 border border-indigo-100 dark:border-indigo-900/50">
                <div className="font-semibold text-foreground mb-1">1. Automatikus számlaszám-egyezés</div>
                <div>
                  A rendszer automatikusan észleli, ha a számla és a banki kiegyenlítés bizonylatszáma megegyezik. Az <strong>„Automatikus Párosítás”</strong> gombbal ezek 1 kattintással rendezhetők (ZÁRT státusz).
                </div>
              </div>
              <div className="p-2.5 rounded-lg bg-card/60 border border-indigo-100 dark:border-indigo-900/50">
                <div className="font-semibold text-foreground mb-1">2. Kézi pipálós párosítás</div>
                <div>
                  Jelölj ki a táblázatban egy vagy több Tartozik (T) és Követel (K) sort. A lebegő mérlegsáv azonnal mutatja az egyenleget. Ha ∑T = ∑K (vagy részösszeg), a <strong>„Párosítás / Rendezés”</strong> azonnal végrehajtja a kapcsolatot.
                </div>
              </div>
              <div className="p-2.5 rounded-lg bg-card/60 border border-indigo-100 dark:border-indigo-900/50">
                <div className="font-semibold text-foreground mb-1">3. Kerekítés & Árfolyam leírás</div>
                <div>
                  Ha legfeljebb 10 Ft eltérés marad a tételeken, a <strong>„Kerekítések leírása”</strong> gombbal vagy a sorvégi varázslóval automatikusan lekönyvelhető a Vegyes naplóba (8755/9779).
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border shadow-xs">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="space-y-1">
              <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Nyitott Tételek
              </div>
              <div className="text-2xl font-bold text-foreground">
                {stats.openCount} <span className="text-xs font-normal text-muted-foreground">db</span>
              </div>
              {stats.draftCount > 0 && (
                <div className="text-[11px] text-muted-foreground">
                  Ebből {stats.draftCount} javaslat / piszkozat
                </div>
              )}
            </div>
            <div className="p-3 bg-amber-50 dark:bg-amber-950/40 rounded-xl text-amber-600">
              <Clock className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border shadow-xs">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="space-y-1">
              <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Nyitott Egyenleg
              </div>
              <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                {formatCurrency(stats.openSumHuf)}
              </div>
              <div className="text-[11px] text-muted-foreground">
                Nettó: {formatCurrency(stats.totalNetHuf)} | ÁFA: {formatCurrency(stats.totalVatHuf)}
              </div>
            </div>
            <div className="p-3 bg-amber-50 dark:bg-amber-950/40 rounded-xl text-amber-600">
              <Coins className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border shadow-xs">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="space-y-1">
              <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Lejárt Követelések
              </div>
              <div className={`text-2xl font-bold ${stats.overdueCount > 0 ? 'text-rose-600' : 'text-foreground'}`}>
                {formatCurrency(stats.overdueSumHuf)}
              </div>
              {stats.overdueCount > 0 ? (
                <div className="text-[11px] text-rose-500 font-medium">
                  {stats.overdueCount} tétel határidőn túl
                </div>
              ) : (
                <div className="text-[11px] text-emerald-600 font-medium">
                  Nincs határidőn túli tétel
                </div>
              )}
            </div>
            <div className="p-3 bg-rose-50 dark:bg-rose-950/40 rounded-xl text-rose-600">
              <AlertCircle className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border shadow-xs">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="space-y-1">
              <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Rendezett Forgalom
              </div>
              <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                {formatCurrency(stats.settledSumHuf)}
              </div>
              <div className="text-[11px] text-muted-foreground">
                Kiegyenlített párosítások összege
              </div>
            </div>
            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl text-emerald-600">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter and Mode Bar */}
      <Card className="border shadow-xs">
        <CardContent className="p-4 space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            {/* Mode Tabs */}
            <Tabs value={mode} onValueChange={(val) => setMode(val as SubledgerMode)}>
              <TabsList className="grid grid-cols-3 w-full sm:w-[380px]">
                <TabsTrigger value="OPEN" className="flex items-center gap-1.5 text-xs">
                  <Clock className="w-3.5 h-3.5 text-amber-500" />
                  Nyitott ({stats.openCount})
                </TabsTrigger>
                <TabsTrigger value="CLOSED" className="flex items-center gap-1.5 text-xs">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                  Zárt tételek
                </TabsTrigger>
                <TabsTrigger value="ALL" className="flex items-center gap-1.5 text-xs">
                  <Layers className="w-3.5 h-3.5 text-indigo-500" />
                  Teljes analitika
                </TabsTrigger>
              </TabsList>
            </Tabs>

            {/* Account, Partner & Status Selectors */}
            <div className="flex flex-wrap items-center gap-3">
              {/* Status Filter (Könyvelt / Javaslat / Összes) */}
              <div className="w-full sm:w-[200px]">
                <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as SubledgerStatusFilter)}>
                  <SelectTrigger className="text-xs">
                    <SelectValue placeholder="Könyvelési státusz..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL_ACTIVE">Összes (Könyvelt + Javaslat)</SelectItem>
                    <SelectItem value="POSTED_ONLY">Csak véglegesen könyvelt</SelectItem>
                    <SelectItem value="DRAFT_ONLY">Csak javaslatok / piszkozatok</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* GL Account Selector */}
              <div className="w-full sm:w-[210px]">
                <Select value={selectedGlAccountId} onValueChange={setSelectedGlAccountId}>
                  <SelectTrigger className="text-xs">
                    <SelectValue placeholder="Főkönyvi számla..." />
                  </SelectTrigger>
                  <SelectContent className="max-h-[300px]">
                    <SelectItem value="all">Összes analitikus számla</SelectItem>
                    {accounts.map((acc: any) => (
                      <SelectItem key={acc.id} value={acc.id}>
                        {acc.gl_number} - {acc.short_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Partner Selector */}
              <div className="w-full sm:w-[210px]">
                <Select value={selectedPartnerId} onValueChange={setSelectedPartnerId}>
                  <SelectTrigger className="text-xs">
                    <SelectValue placeholder="Partner..." />
                  </SelectTrigger>
                  <SelectContent className="max-h-[300px]">
                    <SelectItem value="all">Minden partner</SelectItem>
                    {partners.map((p: any) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Search input */}
              <div className="relative w-full sm:w-[200px]">
                <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Keresés bizonylat, név..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8 text-xs h-9"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Sticky Selection & Action Bar */}
      {selectedGroupKeys.size > 0 && (
        <div className="sticky top-4 z-20 bg-indigo-950 text-white rounded-xl p-4 shadow-xl border border-indigo-700/60 flex flex-col md:flex-row items-center justify-between gap-4 animate-in fade-in slide-in-from-top-2">
          <div className="flex flex-wrap items-center gap-6 text-sm">
            <div className="flex items-center gap-2">
              <Badge className="bg-indigo-500/30 text-white border border-indigo-400/40 font-semibold px-2.5 py-1">
                {selectionTotals.count} számla ({selectionTotals.itemCount} tétel) kijelölve
              </Badge>
            </div>

            <div className="flex items-center gap-4 text-xs font-mono">
              <div>
                <span className="text-indigo-300">∑ Tartozik (T): </span>
                <span className="font-bold text-white">{formatCurrency(selectionTotals.sumT)}</span>
              </div>
              <div className="text-indigo-500">|</div>
              <div>
                <span className="text-indigo-300">∑ Követel (K): </span>
                <span className="font-bold text-white">{formatCurrency(selectionTotals.sumK)}</span>
              </div>
              <div className="text-indigo-500">|</div>
              <div>
                <span className="text-indigo-300">Egyenleg (∑T-∑K): </span>
                <span
                  className={`font-bold ${
                    selectionTotals.isBalanced
                      ? 'text-emerald-400'
                      : selectionTotals.isSmallDiff
                      ? 'text-amber-400'
                      : 'text-rose-400'
                  }`}
                >
                  {formatCurrency(selectionTotals.balance)}
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Batch post drafts button if drafts are selected */}
            {selectionTotals.draftInvoices.length > 0 && (
              <Button
                size="sm"
                variant="outline"
                onClick={handleOpenBatchPost}
                className="bg-white/10 hover:bg-white/20 text-white border-white/20 text-xs flex items-center gap-1.5"
              >
                <FileCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>Könyvelés ({selectionTotals.draftInvoices.length} számla)</span>
              </Button>
            )}

            {/* Settle button */}
            <Button
              size="sm"
              onClick={handlePairSelected}
              disabled={settleMutation.isPending || (!selectionTotals.isBalanced && !selectionTotals.isSmallDiff)}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-medium shadow-sm flex items-center gap-1.5 text-xs"
            >
              {settleMutation.isPending ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Link2 className="w-3.5 h-3.5" />
              )}
              <span>Párosítás / Rendezés</span>
            </Button>

            {/* Rounding write-off trigger if difference <= 10 Ft */}
            {selectionTotals.isSmallDiff && selectedItems.length === 1 && (
              <Button
                size="sm"
                variant="secondary"
                onClick={() => setActiveItemForWriteOff(selectedItems[0])}
                className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-medium flex items-center gap-1.5 text-xs"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Kerekítés leírása</span>
              </Button>
            )}

            {/* Clear selection */}
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setSelectedGroupKeys(new Set())}
              className="text-indigo-300 hover:text-white hover:bg-white/10 text-xs"
            >
              Mégse
            </Button>
          </div>
        </div>
      )}

      {/* Main Data Table */}
      <Card className="border shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse">
            <thead>
              <tr className="bg-muted/50 border-b text-muted-foreground font-semibold">
                <th className="p-3 w-16 text-center">
                  <div className="flex items-center justify-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleToggleAllExpand}
                      className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
                      title={
                        expandedGroupKeys.size === groupedInvoices.length && groupedInvoices.length > 0
                          ? 'Összes becsukása'
                          : 'Összes lenyitása'
                      }
                    >
                      {expandedGroupKeys.size === groupedInvoices.length && groupedInvoices.length > 0 ? (
                        <ChevronDown className="w-3.5 h-3.5" />
                      ) : (
                        <ChevronRight className="w-3.5 h-3.5" />
                      )}
                    </Button>
                    <Checkbox
                      checked={
                        groupedInvoices.length > 0 &&
                        groupedInvoices.every((i) => selectedGroupKeys.has(i.group_key))
                      }
                      onCheckedChange={(checked) => handleSelectAll(!!checked)}
                    />
                  </div>
                </th>
                <th className="p-3">Státusz</th>
                <th className="p-3">Számlasorszám</th>
                <th className="p-3">Napló</th>
                <th className="p-3">Könyvelés</th>
                <th className="p-3">Esedékesség</th>
                <th className="p-3">Partner</th>
                <th className="p-3 text-right">Nettó</th>
                <th className="p-3 text-right">ÁFA</th>
                <th className="p-3 text-right">Bruttó összeg</th>
                <th className="p-3 text-right">Rendezve</th>
                <th className="p-3 text-right">Nyitott összeg</th>
                <th className="p-3 text-center">Műveletek</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoadingItems ? (
                <tr>
                  <td colSpan={13} className="py-12 text-center text-muted-foreground">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-600" />
                    Folyószámla adatok betöltése...
                  </td>
                </tr>
              ) : groupedInvoices.length === 0 ? (
                <tr>
                  <td colSpan={13} className="py-12 text-center text-muted-foreground space-y-2">
                    <div className="text-sm font-medium">Nincs a megadott szűrési feltételeknek megfelelő folyószámla számla.</div>
                    <div className="text-xs text-muted-foreground max-w-md mx-auto">
                      Próbáld meg módosítani a dátumtartományt, a partner szűrőt, vagy váltsd át a könyvelési státuszt az <strong>„Összes (Könyvelt + Javaslat)”</strong> opcióra.
                    </div>
                  </td>
                </tr>
              ) : (
                groupedInvoices.map((inv) => {
                  const isSelected = selectedGroupKeys.has(inv.group_key);
                  const isExpanded = expandedGroupKeys.has(inv.group_key);
                  const isOverdue =
                    !inv.is_settled &&
                    inv.due_date &&
                    new Date(inv.due_date) < new Date();

                  return (
                    <React.Fragment key={inv.group_key}>
                      <tr
                        className={`hover:bg-muted/30 transition-colors ${
                          isSelected ? 'bg-indigo-50/50 dark:bg-indigo-950/20' : ''
                        } ${isExpanded ? 'bg-muted/20 border-b-0' : ''}`}
                      >
                        {/* Expand button & Checkbox */}
                        <td className="p-3 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleToggleExpand(inv.group_key)}
                              className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
                              title={isExpanded ? 'Tételek becsukása' : 'Tételek lenyitása'}
                            >
                              {isExpanded ? (
                                <ChevronDown className="w-3.5 h-3.5 text-indigo-600" />
                              ) : (
                                <ChevronRight className="w-3.5 h-3.5" />
                              )}
                            </Button>
                            <Checkbox
                              checked={isSelected}
                              onCheckedChange={() => handleToggleRow(inv.group_key)}
                            />
                          </div>
                        </td>

                        {/* Státusz Badge */}
                        <td className="p-3 whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            {inv.is_settled ? (
                              <Badge variant="outline" className="bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 text-[10px]">
                                Zárt
                              </Badge>
                            ) : inv.settled_amount > 0 ? (
                              <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-300 dark:bg-amber-950/40 dark:text-amber-300 text-[10px]">
                                Részben
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300 text-[10px]">
                                Nyitott
                              </Badge>
                            )}

                            {inv.status === 'GEPI_JAVASLAT' && (
                              <Badge variant="secondary" className="text-[9px] px-1 py-0 bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300">
                                Javaslat
                              </Badge>
                            )}
                          </div>
                        </td>

                        {/* Számlasorszám (Bizonylatszám) */}
                        <td className="p-3 font-semibold text-foreground whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => handleToggleExpand(inv.group_key)}
                              className="hover:text-indigo-600 transition-colors text-left font-mono font-bold"
                            >
                              {inv.document_id}
                            </button>
                            {inv.items.length > 1 && (
                              <Badge
                                variant="secondary"
                                className="bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300 text-[10px] font-semibold px-1.5 py-0"
                              >
                                {inv.items.length} tétel
                              </Badge>
                            )}
                          </div>
                          {inv.items.length === 1 && inv.description ? (
                            <div className="text-[10px] text-muted-foreground truncate max-w-[200px] font-normal font-sans">
                              {inv.description}
                            </div>
                          ) : inv.items.length > 1 ? (
                            <div className="text-[10px] text-muted-foreground truncate max-w-[200px] font-normal font-sans">
                              {inv.items.map((it) => it.description).filter(Boolean).slice(0, 2).join(', ')}
                              {inv.items.length > 2 ? '...' : ''}
                            </div>
                          ) : null}
                        </td>

                        {/* Napló */}
                        <td className="p-3 text-muted-foreground whitespace-nowrap">
                          <span className="font-mono bg-muted/60 px-1.5 py-0.5 rounded text-[11px]">
                            {inv.journal_code}-{inv.journal_number || 0}
                          </span>
                        </td>

                        {/* Könyvelés dátuma */}
                        <td className="p-3 whitespace-nowrap font-mono text-[11px]">{inv.posting_date}</td>

                        {/* Esedékesség */}
                        <td className="p-3 whitespace-nowrap">
                          {inv.due_date ? (
                            <div className="flex items-center gap-1 font-mono text-[11px]">
                              <span>{inv.due_date}</span>
                              {isOverdue && (
                                <Badge variant="destructive" className="text-[9px] px-1 py-0 font-sans">
                                  Lejárt
                                </Badge>
                              )}
                            </div>
                          ) : (
                            '-'
                          )}
                        </td>

                        {/* Partner */}
                        <td className="p-3 whitespace-nowrap font-medium text-foreground max-w-[180px] truncate">
                          {inv.partner_name || '-'}
                        </td>

                        {/* Nettó összeg */}
                        <td className="p-3 text-right font-mono whitespace-nowrap text-muted-foreground">
                          {formatCurrency(inv.net_amount, inv.currency)}
                        </td>

                        {/* ÁFA összeg */}
                        <td className="p-3 text-right font-mono whitespace-nowrap text-indigo-600 dark:text-indigo-400">
                          {formatCurrency(inv.vat_amount, inv.currency)}
                        </td>

                        {/* Bruttó összeg */}
                        <td className="p-3 text-right font-mono font-bold whitespace-nowrap text-foreground">
                          <div>{formatCurrency(inv.amount, inv.currency)}</div>
                        </td>

                        {/* Rendezett összeg */}
                        <td className="p-3 text-right font-mono text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                          {inv.settled_amount > 0 ? formatCurrency(inv.settled_amount, inv.currency) : '-'}
                        </td>

                        {/* Nyitott összeg */}
                        <td className="p-3 text-right font-mono font-bold whitespace-nowrap">
                          <span
                            className={
                              inv.remaining_amount > 0
                                ? isOverdue
                                  ? 'text-rose-600 dark:text-rose-400'
                                  : 'text-amber-600 dark:text-amber-400'
                                : 'text-muted-foreground font-normal'
                            }
                          >
                            {formatCurrency(inv.remaining_amount, inv.currency)}
                          </span>
                        </td>

                        {/* Műveletek */}
                        <td className="p-3 text-center whitespace-nowrap">
                          <div className="flex items-center justify-center gap-1">
                            {/* Könyvelés gomb (ha javaslat) */}
                            {inv.status === 'GEPI_JAVASLAT' && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleOpenPostSingle(inv)}
                                title="Kontírozás ellenőrzése és könyvelése"
                                className="h-7 px-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800 text-[11px] font-medium flex items-center gap-1"
                              >
                                <FileCheck className="w-3.5 h-3.5 text-indigo-600" />
                                <span>Könyvelés</span>
                              </Button>
                            )}

                            {/* Módosítás gomb (minden számlánál: piszkozat azonnal, könyvelt unpost után) */}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleOpenEdit(inv)}
                              title={
                                inv.status === 'GEPI_JAVASLAT'
                                  ? 'Számla tételeinek és kontírjainak szerkesztése'
                                  : 'Lekönyvelt számla visszanyitása és módosítása'
                              }
                              className="h-7 px-2 text-slate-700 hover:text-slate-900 dark:text-slate-300 hover:bg-muted"
                            >
                              <Edit3 className="w-3.5 h-3.5 mr-1 text-slate-500" />
                              <span className="text-[11px]">Módosítás</span>
                            </Button>

                            {/* Matches inspection */}
                            {inv.match_count > 0 && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setActiveItemForMatches(inv.items[0])}
                                title={`Párosítások megtekintése (${inv.match_count})`}
                                className="h-7 px-2 text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 dark:hover:bg-indigo-950/40"
                              >
                                <ArrowRightLeft className="w-3.5 h-3.5 mr-1" />
                                <span className="text-[11px]">{inv.match_count}</span>
                              </Button>
                            )}

                            {/* Write-off modal */}
                            {!inv.is_settled && inv.remaining_amount > 0 && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setActiveItemForWriteOff(inv.items[0])}
                                title="Különbözet leírása (Kerekítés vagy Árfolyam)"
                                className="h-7 px-2 text-amber-600 hover:text-amber-700 hover:bg-amber-50 dark:hover:bg-amber-950/40"
                              >
                                <Sparkles className="w-3.5 h-3.5" />
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>

                      {/* Accordion Expanded Sub-Row with Detailed Invoice Items & Kontírok */}
                      {isExpanded && (
                        <tr className="bg-muted/20 border-b">
                          <td colSpan={13} className="p-4 pl-12 pr-6">
                            <div className="rounded-xl border bg-card p-4 space-y-4 shadow-sm">
                              {/* Header bar of expanded row */}
                              <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b">
                                <div className="flex items-center gap-2.5">
                                  <div className="p-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
                                    <Layers className="w-4 h-4" />
                                  </div>
                                  <div>
                                    <div className="font-bold text-foreground text-sm flex items-center gap-2">
                                      <span>Számla tételei ({inv.items.length} tétel)</span>
                                      <span className="font-mono text-xs text-muted-foreground font-normal">
                                        — {inv.document_id}
                                      </span>
                                    </div>
                                    <div className="text-xs text-muted-foreground">
                                      A teljes számlához tartozó számlatételek és azok főkönyvi kontírozása
                                    </div>
                                  </div>
                                </div>

                                <div className="flex items-center gap-4 text-xs font-mono bg-muted/50 px-3 py-1.5 rounded-lg border">
                                  <span>
                                    Nettó: <strong className="text-foreground">{formatCurrency(inv.net_amount, inv.currency)}</strong>
                                  </span>
                                  <span className="text-muted-foreground">|</span>
                                  <span>
                                    ÁFA: <strong className="text-indigo-600 dark:text-indigo-400">{formatCurrency(inv.vat_amount, inv.currency)}</strong>
                                  </span>
                                  <span className="text-muted-foreground">|</span>
                                  <span>
                                    Bruttó: <strong className="text-foreground">{formatCurrency(inv.amount, inv.currency)}</strong>
                                  </span>
                                </div>
                              </div>

                              {/* Detailed Item List: Számlatételek felsorolása */}
                              <div className="space-y-3">
                                {inv.items.map((item, itemIdx) => {
                                  const itemLines = item.all_lines && item.all_lines.length > 0 ? item.all_lines : [
                                    {
                                      id: item.line_id,
                                      sequence_number: 1,
                                      gl_number: item.gl_number,
                                      gl_short_name: item.gl_short_name,
                                      dc_type: item.dc_type,
                                      amount: item.amount,
                                      vat_role: null,
                                      vat_code: null,
                                      description: item.description,
                                    },
                                  ];

                                  return (
                                    <div
                                      key={item.line_id || item.header_id || itemIdx}
                                      className="rounded-lg border bg-background overflow-hidden"
                                    >
                                      {/* Item header line */}
                                      <div className="bg-muted/40 px-3 py-2 border-b flex flex-wrap items-center justify-between gap-2 text-xs">
                                        <div className="flex items-center gap-2">
                                          <span className="font-mono font-bold text-muted-foreground bg-muted px-1.5 py-0.5 rounded text-[11px]">
                                            #{itemIdx + 1}
                                          </span>
                                          <span className="font-semibold text-foreground">
                                            {item.description || `Tétel #${itemIdx + 1}`}
                                          </span>
                                        </div>

                                        <div className="flex items-center gap-3 font-mono text-[11px]">
                                          <span className="text-muted-foreground">
                                            Nettó: <strong className="text-foreground">{formatCurrency(item.net_amount, item.currency)}</strong>
                                          </span>
                                          <span className="text-muted-foreground">|</span>
                                          <span className="text-muted-foreground">
                                            ÁFA: <strong className="text-indigo-600 dark:text-indigo-400">{formatCurrency(item.vat_amount, item.currency)}</strong>
                                          </span>
                                          <span className="text-muted-foreground">|</span>
                                          <span className="text-muted-foreground">
                                            Bruttó: <strong className="text-foreground">{formatCurrency(item.amount, item.currency)}</strong>
                                          </span>
                                        </div>
                                      </div>

                                      {/* Kontírozási sorok az adott tételhez */}
                                      <div className="p-2.5">
                                        <div className="text-[11px] text-muted-foreground mb-1.5 font-medium px-1 flex items-center justify-between">
                                          <span>Kontírozás (Főkönyvi könyvelési sorok: T / K):</span>
                                          <span className="font-mono text-[10px]">{itemLines.length} sor</span>
                                        </div>
                                        <table className="w-full text-xs text-left border-collapse">
                                          <thead>
                                            <tr className="bg-muted/30 border-b text-muted-foreground font-semibold text-[10px]">
                                              <th className="p-1.5 w-8 text-center">#</th>
                                              <th className="p-1.5 w-12 text-center">T/K</th>
                                              <th className="p-1.5 min-w-[200px]">Főkönyvi számla</th>
                                              <th className="p-1.5 w-24">ÁFA szerep</th>
                                              <th className="p-1.5 text-right w-28">Összeg</th>
                                              <th className="p-1.5">Sor leírása</th>
                                            </tr>
                                          </thead>
                                          <tbody className="divide-y divide-border/40 text-[11px]">
                                            {itemLines.map((l: any, lIdx: number) => (
                                              <tr key={l.id || lIdx} className="hover:bg-muted/10 transition-colors">
                                                <td className="p-1.5 text-center text-muted-foreground font-mono">
                                                  {l.sequence_number || lIdx + 1}
                                                </td>
                                                <td className="p-1.5 text-center">
                                                  <Badge
                                                    variant="secondary"
                                                    className={`text-[9px] font-bold px-1 py-0 font-mono ${
                                                      l.dc_type === 'T'
                                                        ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
                                                        : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                                    }`}
                                                  >
                                                    {l.dc_type}
                                                  </Badge>
                                                </td>
                                                <td className="p-1.5">
                                                  <span className="font-mono font-bold text-foreground">
                                                    {l.gl_number}
                                                  </span>
                                                  <span className="text-muted-foreground ml-1.5 font-sans text-[11px]">
                                                    {l.gl_short_name}
                                                  </span>
                                                </td>
                                                <td className="p-1.5 text-[10px]">
                                                  {l.vat_role ? (
                                                    <Badge variant="outline" className="text-[9px] font-mono uppercase">
                                                      {l.vat_role} {l.vat_code ? `(${l.vat_code})` : ''}
                                                    </Badge>
                                                  ) : (
                                                    <span className="text-muted-foreground">-</span>
                                                  )}
                                                </td>
                                                <td className="p-1.5 text-right font-mono font-bold text-foreground">
                                                  {formatCurrency(l.amount, item.currency)}
                                                </td>
                                                <td className="p-1.5 text-muted-foreground truncate max-w-[260px] text-[11px]">
                                                  {l.description || '-'}
                                                </td>
                                              </tr>
                                            ))}
                                          </tbody>
                                        </table>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Two-Sided Posting & Editing Modal */}
      <SubledgerPostingModal
        isOpen={postingModalOpen}
        onClose={() => {
          setPostingModalOpen(false);
          setInvoicesToPost([]);
        }}
        invoices={invoicesToPost}
        companyId={companyId || ''}
        isEditMode={isEditModeForModal}
        onOpenFullManualEditor={(headerId) => {
          setEditingHeaderId(headerId);
          setManualEntryOpen(true);
        }}
      />

      {/* Full Manual Journal Entry Modal (for advanced edits) */}
      <AddManualJournalEntryModal
        open={manualEntryOpen}
        onOpenChange={(isOpen) => {
          setManualEntryOpen(isOpen);
          if (!isOpen) {
            setEditingHeaderId(null);
            refetchItems();
          }
        }}
        entryId={editingHeaderId}
      />

      {/* Confirmation Dialog before Unposting a posted invoice */}
      <AlertDialog
        open={!!unpostConfirmInvoice}
        onOpenChange={(open) => !open && setUnpostConfirmInvoice(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-amber-500" />
              <span>Számla visszanyitása módosításra</span>
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2 text-xs text-muted-foreground pt-1">
              <div>
                A(z) <strong className="text-foreground">{unpostConfirmInvoice?.document_id}</strong> számlasorszámú bizonylat ({unpostConfirmInvoice?.items.length || 1} tétel) már le van könyvelve ({unpostConfirmInvoice?.journal_code}-{unpostConfirmInvoice?.journal_number}).
              </div>
              <div>
                A módosításhoz a rendszer visszanyitja a számla tételeit szerkeszthető piszkozat státuszba (nyitott pénzügyi időszakban). A bizonylat naplósorszáma megmarad, a javítások után a számla újból lekönyvelhető.
              </div>
              <div className="font-semibold text-foreground pt-1">
                Biztosan vissza szeretnéd nyitni a számlát módosításra?
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={unpostMutation.isPending}>Mégse</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmUnpost}
              disabled={unpostMutation.isPending}
              className="bg-indigo-600 hover:bg-indigo-700 text-white"
            >
              {unpostMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin mr-1.5" />
              ) : (
                <Edit3 className="w-4 h-4 mr-1.5" />
              )}
              <span>Visszanyitás és Módosítás</span>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Existing Modals */}
      <SubledgerItemMatchesModal
        isOpen={!!activeItemForMatches}
        onClose={() => setActiveItemForMatches(null)}
        item={activeItemForMatches}
        companyId={companyId || ''}
      />

      <WriteOffSettlementModal
        isOpen={!!activeItemForWriteOff}
        onClose={() => setActiveItemForWriteOff(null)}
        item={activeItemForWriteOff}
        companyId={companyId || ''}
      />

      <BulkRoundingWriteOffModal
        isOpen={bulkRoundingOpen}
        onClose={() => setBulkRoundingOpen(false)}
        items={items}
        companyId={companyId || ''}
      />

      <SubledgerExportDialog
        isOpen={exportDialogOpen}
        onClose={() => setExportDialogOpen(false)}
        items={filteredItems}
        companyName={companyName}
        partnerName={
          selectedPartnerId !== 'all'
            ? partners.find((p: any) => p.id === selectedPartnerId)?.name
            : undefined
        }
        accountNumber={
          selectedGlAccountId !== 'all'
            ? accounts.find((a: any) => a.id === selectedGlAccountId)?.gl_number
            : undefined
        }
      />
    </div>
  );
}
