import React, { useState, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Clock, ArrowRight, CheckCircle2 } from 'lucide-react';
import { formatCurrency, cn } from '@/lib/utils';
import { useQuestionableInvoices } from '@/features/invoices/hooks/useQuestionableInvoices';
import { useCompany } from '@/contexts/CompanyContext';

interface DeferredVatPromptDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentYear: number;
  currentMonth: number;
  onIncluded?: () => Promise<void> | void;
}

function DeferredVatPromptDialogContent({
  onOpenChange,
  currentYear,
  currentMonth,
  onIncluded,
}: Omit<DeferredVatPromptDialogProps, 'open'>) {
  const { selectedCompany } = useCompany();
  const {
    invoices,
    isLoading,
    includeMultipleInPeriod,
    isIncludingMultiple,
  } = useQuestionableInvoices(selectedCompany?.id);

  const initialPeriod = `${currentYear}-${String(currentMonth).padStart(2, '0')}`;
  const [targetPeriod, setTargetPeriod] = useState<string>(initialPeriod);
  // Default is all invoices selected; track deselected items to avoid effect setState
  const [deselectedIds, setDeselectedIds] = useState<Set<string>>(() => new Set());

  const selectedInvoices = useMemo(
    () => invoices.filter((inv) => !deselectedIds.has(inv.id)),
    [invoices, deselectedIds]
  );

  const selectedTotalVat = useMemo(
    () => selectedInvoices.reduce((sum, inv) => sum + inv.invoice_vat_amount, 0),
    [selectedInvoices]
  );

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setDeselectedIds(new Set());
    } else {
      setDeselectedIds(new Set(invoices.map((inv) => inv.id)));
    }
  };

  const handleToggleRow = (id: string) => {
    setDeselectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleConfirm = async () => {
    if (selectedInvoices.length === 0) return;
    const items = selectedInvoices.map((inv) => ({
      id: inv.id,
      isSubmitted: inv.is_submitted,
    }));

    try {
      await includeMultipleInPeriod({
        items,
        targetPeriod,
      });
      if (onIncluded) {
        await onIncluded();
      }
      onOpenChange(false);
    } catch {
      // Error handled by mutation toast
    }
  };

  return (
    <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-6 gap-5">
      <DialogHeader className="gap-1.5 border-b pb-4">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <DialogTitle className="text-lg font-semibold flex items-center gap-2">
              Kérdéses számlák beemelése az ÁFA bevallásba
              <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-300 dark:bg-amber-950 dark:text-amber-300">
                Áfa tv. 153/A. §
              </Badge>
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground mt-0.5">
              Válaszd ki azokat az elhalasztott számlákat, amelyeket a(z) <span className="font-semibold text-foreground">{targetPeriod}</span> időszaki bevallásban levonásba kívánsz helyezni és elszámolni a költségek között.
            </DialogDescription>
          </div>
        </div>
      </DialogHeader>

      {/* Target period and summary KPI box */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 bg-muted/40 p-3.5 rounded-xl border border-border/60">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="target-period-input" className="text-xs font-medium text-muted-foreground">
            Cél időszak (ÉÉÉÉ-HH):
          </Label>
          <Input
            id="target-period-input"
            value={targetPeriod}
            onChange={(e) => setTargetPeriod(e.target.value)}
            placeholder="ÉÉÉÉ-HH (pl. 2026-03)"
            className="h-8 text-xs font-semibold max-w-[160px]"
          />
        </div>

        <div className="flex flex-col justify-center">
          <span className="text-[11px] text-muted-foreground uppercase font-medium">Kijelölt számlák</span>
          <span className="text-base font-bold text-foreground">
            {selectedInvoices.length} / {invoices.length} db
          </span>
        </div>

        <div className="flex flex-col justify-center">
          <span className="text-[11px] text-muted-foreground uppercase font-medium">Levonható plusz ÁFA tartalom</span>
          <span className="text-base font-bold text-emerald-600 dark:text-emerald-400">
            +{formatCurrency(selectedTotalVat, 'HUF')}
          </span>
        </div>
      </div>

      {/* Invoice list table */}
      <div className="flex-1 overflow-auto rounded-lg border border-border min-h-[220px]">
        {isLoading ? (
          <div className="flex items-center justify-center p-8 text-sm text-muted-foreground">
            Számlák betöltése...
          </div>
        ) : invoices.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-8 text-center gap-2">
            <CheckCircle2 className="w-8 h-8 text-emerald-500" />
            <p className="text-sm font-medium">Nincs függőben lévő kérdéses számla.</p>
            <p className="text-xs text-muted-foreground">Minden számla elszámolásra került vagy véglegesen ki van zárva.</p>
          </div>
        ) : (
          <Table>
            <TableHeader className="bg-muted/50 sticky top-0 z-10">
              <TableRow className="text-xs">
                <TableHead className="w-10 text-center">
                  <Checkbox
                    checked={selectedInvoices.length === invoices.length && invoices.length > 0}
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
                <TableHead className="text-center">Hátralévő idő (2 év)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="text-xs">
              {invoices.map((inv) => {
                const isSelected = !deselectedIds.has(inv.id);
                const isCritical = inv.days_remaining_statutory < 180;
                const isWarning = inv.days_remaining_statutory >= 180 && inv.days_remaining_statutory <= 365;

                return (
                  <TableRow
                    key={inv.id}
                    className={cn(
                      'cursor-pointer transition-colors',
                      isSelected ? 'bg-primary/5 hover:bg-primary/10' : 'hover:bg-muted/40'
                    )}
                    onClick={() => handleToggleRow(inv.id)}
                  >
                    <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => handleToggleRow(inv.id)}
                      />
                    </TableCell>
                    <TableCell className="font-medium">
                      <div>{inv.supplier_name}</div>
                      {inv.supplier_tax_number && (
                        <div className="text-[10px] text-muted-foreground">{inv.supplier_tax_number}</div>
                      )}
                    </TableCell>
                    <TableCell className="font-mono text-[11px]">
                      {inv.invoice_number}
                    </TableCell>
                    <TableCell>{inv.invoice_delivery_date || inv.invoice_issue_date}</TableCell>
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
                          'text-[10px] whitespace-nowrap',
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
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>

      <DialogFooter className="flex items-center justify-between sm:justify-between border-t pt-4">
        <div className="text-xs text-muted-foreground">
          {selectedInvoices.length > 0 ? (
            <span>
              {selectedInvoices.length} számla kerül beemelésre a(z) <span className="font-semibold text-foreground">{targetPeriod}</span> havi bevallásba.
            </span>
          ) : (
            <span>Nincs kijelölt számla.</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={isIncludingMultiple}
          >
            Mégse
          </Button>
          <Button
            size="sm"
            onClick={handleConfirm}
            disabled={selectedInvoices.length === 0 || isIncludingMultiple || !targetPeriod.match(/^\d{4}-\d{2}$/)}
            className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            <ArrowRight className="w-4 h-4" />
            <span>
              {isIncludingMultiple ? 'Beemelés folyamatban...' : `Kijelöltek beemelése (${selectedInvoices.length})`}
            </span>
          </Button>
        </div>
      </DialogFooter>
    </DialogContent>
  );
}

export function DeferredVatPromptDialog(props: DeferredVatPromptDialogProps) {
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      {props.open && (
        <DeferredVatPromptDialogContent
          key={`${props.currentYear}-${props.currentMonth}`}
          {...props}
        />
      )}
    </Dialog>
  );
}
