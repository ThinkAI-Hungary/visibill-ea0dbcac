import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Clock,
  ChevronUp,
  ChevronDown,
  AlertTriangle,
  ArrowRight,
  Ban,
  Search,
  Eye,
  CheckCircle2,
  Calendar,
  Layers,
  HelpCircle,
} from 'lucide-react';
import { formatCurrency, cn } from '@/lib/utils';
import { useCompany } from '@/contexts/CompanyContext';
import { useQuestionableInvoices, QuestionableInvoice } from '@/features/invoices/hooks/useQuestionableInvoices';
import { InvoiceItemsDialog } from '@/components/InvoiceItemsDialog';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

export function DeferredInvoicesWidget() {
  const { selectedCompany } = useCompany();
  const {
    invoices,
    isLoading,
    totalCount,
    totalNet,
    totalVat,
    totalGross,
    criticalCount,
    warningCount,
    includeInPeriod,
    isIncluding,
    includeMultipleInPeriod,
    isIncludingMultiple,
    setPermanentExclusion,
    isSettingPermanent,
  } = useQuestionableInvoices(selectedCompany?.id);

  // Current year-month as default target period (e.g. 2026-03 or today's month)
  const [targetPeriod, setTargetPeriod] = useState<string>(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  const [isOpen, setIsOpen] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Dialog state for invoice details
  const [detailInvoice, setDetailInvoice] = useState<QuestionableInvoice | null>(null);

  const filteredInvoices = useMemo(() => {
    if (!searchQuery.trim()) return invoices;
    const q = searchQuery.toLowerCase().trim();
    return invoices.filter(
      (inv) =>
        inv.invoice_number?.toLowerCase().includes(q) ||
        inv.supplier_name?.toLowerCase().includes(q) ||
        inv.supplier_tax_number?.toLowerCase().includes(q) ||
        inv.deferred_vat_reason?.toLowerCase().includes(q)
    );
  }, [invoices, searchQuery]);

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(filteredInvoices.map((inv) => inv.id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleToggleRow = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleBatchInclude = async () => {
    const selected = invoices.filter((inv) => selectedIds.has(inv.id));
    if (selected.length === 0) return;

    await includeMultipleInPeriod({
      items: selected.map((inv) => ({ id: inv.id, isSubmitted: inv.is_submitted })),
      targetPeriod,
    });
    setSelectedIds(new Set());
  };

  const handleSingleInclude = async (inv: QuestionableInvoice) => {
    await includeInPeriod({
      invoiceId: inv.id,
      isSubmitted: inv.is_submitted,
      targetPeriod,
    });
  };

  const handlePermanentExclude = async (inv: QuestionableInvoice) => {
    if (
      !window.confirm(
        `Biztosan véglegesen kizárod a(z) ${inv.invoice_number} számlát a könyvelésből és az ÁFA levonásból? Ez a tétel magánhasználatként vagy nem vállalkozási célként nem fog szerepelni a könyvelésben.`
      )
    ) {
      return;
    }
    await setPermanentExclusion({
      invoiceId: inv.id,
      isSubmitted: inv.is_submitted,
    });
  };

  if (!selectedCompany) return null;

  // If loading, show compact skeleton
  if (isLoading) {
    return (
      <Card className="border-border shadow-sm">
        <CardContent className="p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Clock className="w-5 h-5 text-muted-foreground animate-spin" />
            <span className="text-sm font-medium text-muted-foreground">
              Kérdéses számlák betöltése...
            </span>
          </div>
        </CardContent>
      </Card>
    );
  }

  // When empty, show clean subtle status card
  if (totalCount === 0) {
    return (
      <Card className="border-border/60 bg-card/60 shadow-2xs">
        <CardContent className="p-3.5 flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <div>
              <span className="font-semibold text-foreground">Kérdéses számlák (ÁFA levonás halasztása)</span>
              <span className="ml-2 text-muted-foreground hidden sm:inline">
                Nincs függőben lévő vagy elhalasztott ÁFA levonású számla.
              </span>
            </div>
          </div>
          <Badge variant="outline" className="text-[10px] text-muted-foreground border-border/80">
            0 db függőben
          </Badge>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-amber-400/50 bg-card shadow-sm border-l-4 border-l-amber-500 overflow-hidden">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CardHeader className="p-4 bg-amber-50/50 dark:bg-amber-950/20 border-b border-amber-200/40 dark:border-amber-900/40">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-500/20 text-amber-700 dark:text-amber-300">
                <Clock className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm sm:text-base font-semibold text-foreground">
                    Kérdéses számlák és halasztott ÁFA levonások
                  </h3>
                  <Badge
                    variant="outline"
                    className="bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300 border-amber-300 text-xs font-semibold"
                  >
                    {totalCount} db számla
                  </Badge>
                  {criticalCount > 0 && (
                    <Badge variant="destructive" className="text-[10px] gap-1 animate-pulse">
                      <AlertTriangle className="w-3 h-3" />
                      {criticalCount} db &lt; 180 nap
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1.5">
                  <span>Áfa tv. 153/A. § és 137. § (2 éven belüli levonhatósági jog)</span>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <HelpCircle className="w-3.5 h-3.5 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs text-xs">
                        Az ÁFA törvény szerint a teljesítést követő 2 naptári éven belül bármelyik havi bevallásban levonásba helyezhető az ÁFA. Amíg a költség és az ÁFA levonhatósága tisztázatlan, kérdéses számlaként várakozik.
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 self-end sm:self-center">
              <div className="text-right hidden md:block">
                <div className="text-[11px] text-muted-foreground">Függőben lévő ÁFA</div>
                <div className="text-sm font-bold text-amber-700 dark:text-amber-300">
                  {formatCurrency(totalVat, 'HUF')}
                </div>
              </div>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                  {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </Button>
              </CollapsibleTrigger>
            </div>
          </div>
        </CardHeader>

        <CollapsibleContent>
          <CardContent className="p-4 sm:p-5 space-y-4">
            {/* KPI Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="bg-muted/40 p-3 rounded-lg border border-border/60">
                <span className="text-[11px] text-muted-foreground uppercase font-medium">Kérdéses számlák</span>
                <div className="text-lg font-bold text-foreground mt-0.5">{totalCount} db</div>
                <span className="text-[10px] text-muted-foreground">Döntésre váró tétel</span>
              </div>

              <div className="bg-muted/40 p-3 rounded-lg border border-border/60">
                <span className="text-[11px] text-muted-foreground uppercase font-medium">Függőben lévő ÁFA</span>
                <div className="text-lg font-bold text-amber-600 dark:text-amber-400 mt-0.5">
                  {formatCurrency(totalVat, 'HUF')}
                </div>
                <span className="text-[10px] text-muted-foreground">Később levonható ÁFA</span>
              </div>

              <div className="bg-muted/40 p-3 rounded-lg border border-border/60">
                <span className="text-[11px] text-muted-foreground uppercase font-medium">Függőben lévő nettó</span>
                <div className="text-lg font-bold text-foreground mt-0.5">
                  {formatCurrency(totalNet, 'HUF')}
                </div>
                <span className="text-[10px] text-muted-foreground">Halasztott költség</span>
              </div>

              <div className="bg-muted/40 p-3 rounded-lg border border-border/60">
                <span className="text-[11px] text-muted-foreground uppercase font-medium">Közelgő határidő</span>
                <div
                  className={cn(
                    'text-lg font-bold mt-0.5',
                    criticalCount > 0
                      ? 'text-rose-600 dark:text-rose-400'
                      : warningCount > 0
                      ? 'text-amber-600 dark:text-amber-400'
                      : 'text-emerald-600 dark:text-emerald-400'
                  )}
                >
                  {criticalCount > 0 ? `${criticalCount} db kritikus` : warningCount > 0 ? `${warningCount} db figyelmeztetés` : 'Rendben (> 1 év)'}
                </div>
                <span className="text-[10px] text-muted-foreground">2 éves jogvesztő határidő</span>
              </div>
            </div>

            {/* Controls Bar: Search & Target Period & Batch Action */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-1">
              <div className="relative flex-1 max-w-sm">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Keresés partnerre, számlaszámra vagy okra..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 h-8 text-xs"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1.5 bg-muted/60 px-2.5 py-1 rounded-md border border-border/60">
                  <span className="text-[11px] text-muted-foreground font-medium">Cél időszak:</span>
                  <Input
                    value={targetPeriod}
                    onChange={(e) => setTargetPeriod(e.target.value)}
                    placeholder="ÉÉÉÉ-HH"
                    className="h-6 w-20 text-xs font-semibold px-1 py-0 text-center bg-background"
                  />
                </div>

                <Button
                  size="sm"
                  onClick={handleBatchInclude}
                  disabled={selectedIds.size === 0 || isIncludingMultiple || !targetPeriod.match(/^\d{4}-\d{2}$/)}
                  className="h-8 text-xs font-medium gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  <ArrowRight className="w-3.5 h-3.5" />
                  <span>
                    {isIncludingMultiple
                      ? 'Beemelés...'
                      : `Kijelöltek beemelése (${selectedIds.size})`}
                  </span>
                </Button>
              </div>
            </div>

            {/* Invoices Table */}
            <div className="border border-border/70 rounded-lg overflow-x-auto shadow-2xs">
              <Table>
                <TableHeader className="bg-muted/40">
                  <TableRow className="text-xs">
                    <TableHead className="w-10 text-center">
                      <Checkbox
                        checked={selectedIds.size === filteredInvoices.length && filteredInvoices.length > 0}
                        onCheckedChange={(c) => handleSelectAll(!!c)}
                        aria-label="Összes kijelölése"
                      />
                    </TableHead>
                    <TableHead>Partner</TableHead>
                    <TableHead>Bizonylatszám</TableHead>
                    <TableHead>Teljesítés</TableHead>
                    <TableHead className="text-right">Nettó</TableHead>
                    <TableHead className="text-right">ÁFA</TableHead>
                    <TableHead>Halasztás oka</TableHead>
                    <TableHead className="text-center">Jogvesztő határidő (2 év)</TableHead>
                    <TableHead className="text-right">Műveletek</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="text-xs">
                  {filteredInvoices.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-6 text-muted-foreground">
                        {searchQuery ? 'Nem található számla a keresési feltételre.' : 'Nincs kérdéses számla.'}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredInvoices.map((inv) => {
                      const isSelected = selectedIds.has(inv.id);
                      const isCritical = inv.days_remaining_statutory < 180;
                      const isWarning =
                        inv.days_remaining_statutory >= 180 && inv.days_remaining_statutory <= 365;

                      return (
                        <TableRow
                          key={inv.id}
                          className={cn(
                            'hover:bg-muted/40 transition-colors',
                            isSelected && 'bg-primary/5'
                          )}
                        >
                          <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                            <Checkbox
                              checked={isSelected}
                              onCheckedChange={() => handleToggleRow(inv.id)}
                            />
                          </TableCell>
                          <TableCell className="font-medium">
                            <div className="truncate max-w-[180px]">{inv.supplier_name}</div>
                            {inv.supplier_tax_number && (
                              <div className="text-[10px] text-muted-foreground">
                                {inv.supplier_tax_number}
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="font-mono text-[11px]">
                            {inv.invoice_number}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {inv.invoice_delivery_date || inv.invoice_issue_date}
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {formatCurrency(inv.invoice_net_amount, inv.currency)}
                          </TableCell>
                          <TableCell className="text-right font-bold text-emerald-600 dark:text-emerald-400">
                            {formatCurrency(inv.invoice_vat_amount, inv.currency)}
                          </TableCell>
                          <TableCell className="max-w-[180px] truncate text-muted-foreground" title={inv.deferred_vat_reason || ''}>
                            {inv.deferred_vat_reason || 'Későbbre halasztva'}
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge
                              variant="outline"
                              className={cn(
                                'text-[10px] whitespace-nowrap font-medium',
                                isCritical
                                  ? 'bg-rose-50 text-rose-700 border-rose-300 dark:bg-rose-950 dark:text-rose-300'
                                  : isWarning
                                  ? 'bg-amber-50 text-amber-700 border-amber-300 dark:bg-amber-950 dark:text-amber-300'
                                  : 'bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300'
                              )}
                            >
                              {inv.days_remaining_statutory} nap
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="h-7 px-2 text-[11px] gap-1 text-emerald-700 hover:text-emerald-800 border-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950"
                                      onClick={() => handleSingleInclude(inv)}
                                      disabled={isIncluding}
                                    >
                                      <ArrowRight className="w-3 h-3" />
                                      <span className="hidden sm:inline">Beemelés</span>
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    Beemelés a(z) {targetPeriod} időszaki ÁFA bevallásba és a havi költségek közé
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>

                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                                      onClick={() => setDetailInvoice(inv)}
                                    >
                                      <Eye className="w-3.5 h-3.5" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Tételek megtekintése</TooltipContent>
                                </Tooltip>
                              </TooltipProvider>

                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="h-7 w-7 p-0 text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/50"
                                      onClick={() => handlePermanentExclude(inv)}
                                      disabled={isSettingPermanent}
                                    >
                                      <Ban className="w-3.5 h-3.5" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Végleges kizárás (magánhasználat)</TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>

      {/* Invoice items details modal if user clicks eye */}
      {detailInvoice && (
        <InvoiceItemsDialog
          open={!!detailInvoice}
          onOpenChange={(open) => {
            if (!open) setDetailInvoice(null);
          }}
          invoiceId={detailInvoice.id}
          invoiceNumber={detailInvoice.invoice_number || ''}
          currency={detailInvoice.currency || 'HUF'}
          source={detailInvoice.is_submitted ? 'submitted' : 'nav'}
          invoiceDate={detailInvoice.invoice_issue_date}
          supplierName={detailInvoice.supplier_name}
        />
      )}
    </Card>
  );
}
