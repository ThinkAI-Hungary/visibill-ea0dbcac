import React from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Trash2, Tag, Folder, X } from 'lucide-react';
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
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[calc(100%-3rem)] max-w-4xl bg-card/95 backdrop-blur-md border border-border/80 shadow-2xl rounded-xl px-5 py-3.5 flex items-center justify-between z-[9999] animate-in fade-in slide-in-from-bottom-4 duration-300">
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
        {/* Category Select */}
        <Select onValueChange={(val) => handleBulkCategoryChange(val)}>
          <SelectTrigger className="h-9 text-xs min-w-[150px] bg-background border border-border/80 hover:border-primary/50 hover:bg-accent/40 text-foreground font-medium shadow-sm rounded-lg focus:ring-1 focus:ring-primary transition-all">
            <div className="flex items-center gap-1.5 truncate">
              <Tag className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
              <SelectValue placeholder="Kategória..." />
            </div>
          </SelectTrigger>
          <SelectContent className="z-[10001] bg-popover border border-border shadow-2xl min-w-[170px] rounded-lg" sideOffset={8}>
            <SelectItem value="none" className="text-xs text-muted-foreground">Nincs kategória</SelectItem>
            {categories.map((c) => (
              <SelectItem key={c.id} value={c.id} className="text-xs">
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Project Select */}
        <Select onValueChange={(val) => handleBulkProjectChange(val)}>
          <SelectTrigger className="h-9 text-xs min-w-[150px] bg-background border border-border/80 hover:border-primary/50 hover:bg-accent/40 text-foreground font-medium shadow-sm rounded-lg focus:ring-1 focus:ring-primary transition-all">
            <div className="flex items-center gap-1.5 truncate">
              <Folder className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
              <SelectValue placeholder="Projekt..." />
            </div>
          </SelectTrigger>
          <SelectContent className="z-[10001] bg-popover border border-border shadow-2xl min-w-[170px] rounded-lg" sideOffset={8}>
            <SelectItem value="none" className="text-xs text-muted-foreground">Nincs projekt</SelectItem>
            {projects.map((p) => (
              <SelectItem key={p.id} value={p.id} className="text-xs">
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {isSubmittedTab && (
          <Button
            variant="destructive"
            size="sm"
            className="h-9 text-xs gap-1.5 rounded-lg font-semibold shadow-sm hover:shadow transition-all"
            onClick={() => setBulkDeleteDialogOpen(true)}
          >
            <Trash2 className="w-3.5 h-3.5" />
            Törlés
          </Button>
        )}

        <div className="w-px h-5 bg-border/80 mx-1" />
        <Button
          variant="outline"
          size="sm"
          className="h-9 text-xs px-3 text-muted-foreground hover:text-foreground bg-background/80 hover:bg-accent/60 border-border/80 rounded-lg transition-colors font-medium gap-1"
          onClick={clearSelection}
        >
          <X className="w-3.5 h-3.5" />
          Mégse
        </Button>
      </div>
    </div>,
    document.body
  );
}
