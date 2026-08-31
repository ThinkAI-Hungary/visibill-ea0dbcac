import React from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Trash2 } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { useInvoiceContext } from '../../context/useInvoiceContext';

export function InvoiceBulkActionsBar() {
  const {
    activeSelection,
    isSubmittedTab,
    categories,
    projects,
    exportableInvoices,
    handleBulkCategoryChange,
    handleBulkProjectChange,
    setBulkDeleteDialogOpen,
    clearSelection,
  } = useInvoiceContext();

  if (activeSelection.size === 0) return null;

  const selectedItems = exportableInvoices.filter(inv => activeSelection.has(inv.id));
  const sums: Record<string, number> = {};
  selectedItems.forEach(inv => {
    const currency = inv.currency || 'HUF';
    sums[currency] = (sums[currency] || 0) + (inv.gross_amount || 0);
  });
  const sumStrings = Object.entries(sums).map(([ccy, amt]) => formatCurrency(amt, ccy));

  return createPortal(
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[calc(100%-3rem)] max-w-4xl bg-card border border-primary/30 shadow-2xl rounded-2xl px-6 py-4 flex items-center justify-between z-[9999] animate-in fade-in slide-in-from-bottom-4 duration-300">
      <div className="flex items-center gap-3">
        <div className="h-2.5 w-2.5 rounded-full bg-primary animate-pulse" />
        <p className="text-sm font-semibold text-foreground">
          Kijelölt számlák: <span className="font-extrabold text-primary">{activeSelection.size} db</span>
        </p>

        {sumStrings.length > 0 && (
          <>
            <span className="text-muted-foreground/30 text-xs">|</span>
            <p className="text-xs text-muted-foreground font-medium">
              Összesen: <span className="font-bold text-foreground">{sumStrings.join(', ')}</span>
            </p>
          </>
        )}
      </div>

      <div className="flex items-center gap-2">
        <Select onValueChange={(val) => handleBulkCategoryChange(val)}>
          <SelectTrigger className="h-9 text-xs min-w-[130px] bg-background/50 border-border/60 rounded-xl">
            <SelectValue placeholder="Kategória..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Nincs kategória</SelectItem>
            {categories.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select onValueChange={(val) => handleBulkProjectChange(val)}>
          <SelectTrigger className="h-9 text-xs min-w-[130px] bg-background/50 border-border/60 rounded-xl">
            <SelectValue placeholder="Projekt..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Nincs projekt</SelectItem>
            {projects.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {isSubmittedTab && (
          <Button
            variant="destructive"
            size="sm"
            className="h-9 text-xs gap-1.5 rounded-xl font-semibold"
            onClick={() => setBulkDeleteDialogOpen(true)}
          >
            <Trash2 className="w-3.5 h-3.5" />
            Törlés
          </Button>
        )}

        <div className="w-px h-6 bg-border/60 mx-1" />
        <Button
          variant="ghost"
          size="sm"
          className="h-9 text-xs text-muted-foreground hover:text-foreground rounded-xl"
          onClick={clearSelection}
        >
          Mégse
        </Button>
      </div>
    </div>,
    document.body
  );
}
