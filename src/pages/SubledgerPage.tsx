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
  ChevronDown
} from 'lucide-react';
import {
  useSubledgerItems,
  useSubledgerAccounts,
  useSettleOpenItems,
  useAutoSettleSubledgerItems,
  useBatchPostSubledgerItems,
} from '@/hooks/useSubledger';
import type { SubledgerItem, SubledgerMode, SubledgerStatusFilter } from '@/types/subledger';
import { formatCurrency } from '@/lib/utils';
import { SubledgerItemMatchesModal } from '@/components/subledger/SubledgerItemMatchesModal';
import { WriteOffSettlementModal } from '@/components/subledger/WriteOffSettlementModal';
import { BulkRoundingWriteOffModal } from '@/components/subledger/BulkRoundingWriteOffModal';
import { SubledgerExportDialog } from '@/components/subledger/SubledgerExportDialog';

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

  // Selected Row IDs for Multi-pairing / Batch Actions
  const [selectedLineIds, setSelectedLineIds] = useState<Set<string>>(new Set());

  // Modals state
  const [activeItemForMatches, setActiveItemForMatches] = useState<SubledgerItem | null>(null);
  const [activeItemForWriteOff, setActiveItemForWriteOff] = useState<SubledgerItem | null>(null);
  const [bulkRoundingOpen, setBulkRoundingOpen] = useState<boolean>(false);
  const [exportDialogOpen, setExportDialogOpen] = useState<boolean>(false);

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

  // Overall stats
  const stats = useMemo(() => {
    let openCount = 0;
    let openSumHuf = 0;
    let settledSumHuf = 0;
    let overdueCount = 0;
    let overdueSumHuf = 0;
    let smallRoundingCount = 0;
    let draftCount = 0;
    const now = new Date();

    items.forEach((item) => {
      if (!item.is_settled && item.remaining_amount > 0) {
        openCount++;
        openSumHuf += item.remaining_amount;
        if (item.due_date && new Date(item.due_date) < now) {
          overdueCount++;
          overdueSumHuf += item.remaining_amount;
        }
        if (item.remaining_amount <= 10) {
          smallRoundingCount++;
        }
      }
      if (item.status === 'GEPI_JAVASLAT') {
        draftCount++;
      }
      settledSumHuf += item.settled_amount;
    });

    return { openCount, openSumHuf, settledSumHuf, overdueCount, overdueSumHuf, smallRoundingCount, draftCount };
  }, [items]);

  // Selected items calculations
  const selectedItems = useMemo(() => {
    return items.filter((i) => selectedLineIds.has(i.line_id));
  }, [items, selectedLineIds]);

  const selectionTotals = useMemo(() => {
    let sumT = 0;
    let sumK = 0;
    let foreignSum = 0;
    let currencies = new Set<string>();
    let draftHeaders: string[] = [];

    selectedItems.forEach((i) => {
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
      if (i.status === 'GEPI_JAVASLAT') {
        draftHeaders.push(i.header_id);
      }
    });

    const diff = Math.abs(sumT - sumK);
    const balance = sumT - sumK;
    const isBalanced = diff < 0.01 && selectedItems.length >= 2;
    const isSmallDiff = diff > 0.01 && diff <= 10;

    return {
      count: selectedItems.length,
      sumT,
      sumK,
      balance,
      diff,
      isBalanced,
      isSmallDiff,
      foreignSum,
      currencies: Array.from(currencies).join(', '),
      draftHeaders: Array.from(new Set(draftHeaders)),
    };
  }, [selectedItems]);

  // Toggle selection
  const handleToggleRow = (lineId: string) => {
    setSelectedLineIds((prev) => {
      const next = new Set(prev);
      if (next.has(lineId)) {
        next.delete(lineId);
      } else {
        next.add(lineId);
      }
      return next;
    });
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedLineIds(new Set(filteredItems.map((i) => i.line_id)));
    } else {
      setSelectedLineIds(new Set());
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

      setSelectedLineIds(new Set());
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
    batchPostMutation.mutate({
      companyId,
      headerIds: selectionTotals.draftHeaders,
    });
  };

  return (
    <div className="space-y-6 pb-20">
      {/* Page Header */}
      <PageHeader
        title="Folyószámla és Analitika"
        description="Vevő, szállító és egyéb analitikus számlák nyitott tételeinek kezelése, automatikus és kézi párosítása és leírása."
      >
        <div className="flex flex-wrap items-center gap-2">
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
      </PageHeader>

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
                {formatCurrency(stats.openSumHuf)} <span className="text-xs font-normal text-muted-foreground">Ft</span>
              </div>
              <div className="text-[11px] text-muted-foreground">
                Fennmaradó tartozások / követelések
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
                {formatCurrency(stats.overdueSumHuf)} <span className="text-xs font-normal text-muted-foreground">Ft</span>
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
                {formatCurrency(stats.settledSumHuf)} <span className="text-xs font-normal text-muted-foreground">Ft</span>
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
      {selectedLineIds.size > 0 && (
        <div className="sticky top-4 z-20 bg-indigo-950 text-white rounded-xl p-4 shadow-xl border border-indigo-700/60 flex flex-col md:flex-row items-center justify-between gap-4 animate-in fade-in slide-in-from-top-2">
          <div className="flex flex-wrap items-center gap-6 text-sm">
            <div className="flex items-center gap-2">
              <Badge className="bg-indigo-500/30 text-white border border-indigo-400/40 font-semibold px-2.5 py-1">
                {selectionTotals.count} tétel kijelölve
              </Badge>
            </div>

            <div className="flex items-center gap-4 text-xs font-mono">
              <div>
                <span className="text-indigo-300">∑ Tartozik (T): </span>
                <span className="font-bold text-white">{formatCurrency(selectionTotals.sumT)} Ft</span>
              </div>
              <div className="text-indigo-500">|</div>
              <div>
                <span className="text-indigo-300">∑ Követel (K): </span>
                <span className="font-bold text-white">{formatCurrency(selectionTotals.sumK)} Ft</span>
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
                  {formatCurrency(selectionTotals.balance)} Ft
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Batch post drafts button if drafts are selected */}
            {selectionTotals.draftHeaders.length > 0 && (
              <Button
                size="sm"
                variant="outline"
                onClick={handleBatchPostDrafts}
                disabled={batchPostMutation.isPending}
                className="bg-white/10 hover:bg-white/20 text-white border-white/20 text-xs flex items-center gap-1.5"
              >
                {batchPostMutation.isPending ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <FileCheck className="w-3.5 h-3.5 text-emerald-400" />
                )}
                <span>Könyvelés ({selectionTotals.draftHeaders.length} db)</span>
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
              onClick={() => setSelectedLineIds(new Set())}
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
                <th className="p-3 w-10 text-center">
                  <Checkbox
                    checked={
                      filteredItems.length > 0 &&
                      filteredItems.every((i) => selectedLineIds.has(i.line_id))
                    }
                    onCheckedChange={(checked) => handleSelectAll(!!checked)}
                  />
                </th>
                <th className="p-3">Státusz</th>
                <th className="p-3">Bizonylatszám</th>
                <th className="p-3">Napló</th>
                <th className="p-3">Könyvelés</th>
                <th className="p-3">Esedékesség</th>
                <th className="p-3">Partner</th>
                <th className="p-3">Főkönyvi szám</th>
                <th className="p-3 text-center">T/K</th>
                <th className="p-3 text-right">Eredeti összeg</th>
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
              ) : filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={13} className="py-12 text-center text-muted-foreground space-y-2">
                    <div className="text-sm font-medium">Nincs a megadott szűrési feltételeknek megfelelő folyószámla tétel.</div>
                    <div className="text-xs text-muted-foreground max-w-md mx-auto">
                      Próbáld meg módosítani a dátumtartományt, a partner szűrőt, vagy váltsd át a könyvelési státuszt az <strong>„Összes (Könyvelt + Javaslat)”</strong> opcióra.
                    </div>
                  </td>
                </tr>
              ) : (
                filteredItems.map((item) => {
                  const isSelected = selectedLineIds.has(item.line_id);
                  const isOverdue =
                    !item.is_settled &&
                    item.due_date &&
                    new Date(item.due_date) < new Date();

                  return (
                    <tr
                      key={item.line_id}
                      className={`hover:bg-muted/30 transition-colors ${
                        isSelected ? 'bg-indigo-50/50 dark:bg-indigo-950/20' : ''
                      }`}
                    >
                      {/* Checkbox */}
                      <td className="p-3 text-center">
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => handleToggleRow(item.line_id)}
                        />
                      </td>

                      {/* Státusz Badge */}
                      <td className="p-3 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          {item.is_settled ? (
                            <Badge variant="outline" className="bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 text-[10px]">
                              Zárt
                            </Badge>
                          ) : item.settled_amount > 0 ? (
                            <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-300 dark:bg-amber-950/40 dark:text-amber-300 text-[10px]">
                              Részben
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300 text-[10px]">
                              Nyitott
                            </Badge>
                          )}

                          {item.status === 'GEPI_JAVASLAT' && (
                            <Badge variant="secondary" className="text-[9px] px-1 py-0 bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300">
                              Javaslat
                            </Badge>
                          )}
                        </div>
                      </td>

                      {/* Bizonylatszám & Rendezési szám */}
                      <td className="p-3 font-semibold text-foreground whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <span>{item.document_id}</span>
                        </div>
                        {item.description && (
                          <div className="text-[10px] text-muted-foreground truncate max-w-[180px] font-normal">
                            {item.description}
                          </div>
                        )}
                      </td>

                      {/* Napló */}
                      <td className="p-3 text-muted-foreground whitespace-nowrap">
                        <span className="font-mono bg-muted/60 px-1.5 py-0.5 rounded text-[11px]">
                          {item.journal_code}-{item.journal_number || 0}
                        </span>
                      </td>

                      {/* Könyvelés dátuma */}
                      <td className="p-3 whitespace-nowrap">{item.posting_date}</td>

                      {/* Esedékesség */}
                      <td className="p-3 whitespace-nowrap">
                        {item.due_date ? (
                          <div className="flex items-center gap-1">
                            <span>{item.due_date}</span>
                            {isOverdue && (
                              <Badge variant="destructive" className="text-[9px] px-1 py-0">
                                Lejárt
                              </Badge>
                            )}
                          </div>
                        ) : (
                          '-'
                        )}
                      </td>

                      {/* Partner */}
                      <td className="p-3 whitespace-nowrap font-medium text-foreground max-w-[200px] truncate">
                        {item.partner_name || '-'}
                      </td>

                      {/* Főkönyvi szám */}
                      <td className="p-3 whitespace-nowrap">
                        <span className="font-mono font-medium">{item.gl_number}</span>
                        <div className="text-[10px] text-muted-foreground truncate max-w-[140px]">
                          {item.gl_short_name}
                        </div>
                      </td>

                      {/* T/K */}
                      <td className="p-3 text-center">
                        <Badge
                          variant="secondary"
                          className={
                            item.dc_type === 'T'
                              ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 font-mono font-bold'
                              : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 font-mono font-bold'
                          }
                        >
                          {item.dc_type}
                        </Badge>
                      </td>

                      {/* Eredeti összeg */}
                      <td className="p-3 text-right font-mono whitespace-nowrap">
                        <div>{formatCurrency(item.amount)} Ft</div>
                        {item.currency !== 'HUF' && item.foreign_amount && (
                          <div className="text-[10px] text-muted-foreground">
                            {formatCurrency(item.foreign_amount)} {item.currency}
                          </div>
                        )}
                      </td>

                      {/* Rendezett összeg */}
                      <td className="p-3 text-right font-mono text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                        {item.settled_amount > 0 ? `${formatCurrency(item.settled_amount)} Ft` : '-'}
                      </td>

                      {/* Nyitott összeg */}
                      <td className="p-3 text-right font-mono font-bold whitespace-nowrap">
                        <span
                          className={
                            item.remaining_amount > 0
                              ? isOverdue
                                ? 'text-rose-600 dark:text-rose-400'
                                : 'text-amber-600 dark:text-amber-400'
                              : 'text-muted-foreground font-normal'
                          }
                        >
                          {formatCurrency(item.remaining_amount)} Ft
                        </span>
                      </td>

                      {/* Műveletek */}
                      <td className="p-3 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1">
                          {/* Matches inspection */}
                          {item.match_count > 0 && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setActiveItemForMatches(item)}
                              title={`Párosítások megtekintése (${item.match_count})`}
                              className="h-7 px-2 text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 dark:hover:bg-indigo-950/40"
                            >
                              <ArrowRightLeft className="w-3.5 h-3.5 mr-1" />
                              <span className="text-[11px]">{item.match_count}</span>
                            </Button>
                          )}

                          {/* Write-off modal */}
                          {!item.is_settled && item.remaining_amount > 0 && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setActiveItemForWriteOff(item)}
                              title="Különbözet leírása (Kerekítés vagy Árfolyam)"
                              className="h-7 px-2 text-amber-600 hover:text-amber-700 hover:bg-amber-50 dark:hover:bg-amber-950/40"
                            >
                              <Sparkles className="w-3.5 h-3.5" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Modals */}
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
