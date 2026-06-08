import { useMemo, useState, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { formatCurrency, cn } from '@/lib/utils';
import { Package, Package2, CheckCircle2 } from 'lucide-react';
import { useCompany } from '@/contexts/CompanyContext';
import { useActivePreset } from '@/hooks/useActivePreset';
import { AssetActivationDialog } from '@/components/AssetActivationDialog';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface InvoiceLineItem {
  id: string;
  line_number: number;
  line_description: string | null;
  quantity: number | null;
  unit_of_measure: string | null;
  unit_price: number | null;
  net_amount: number | null;
  vat_rate: string | null;
  vat_amount: number | null;
  gross_amount: number | null;
  product_code: string | null;
  gl_classifications: any | null;
  exclude_from_accounting?: boolean;
}

interface InvoiceItemsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoiceId: string;
  invoiceNumber: string;
  currency: string;
  /** Which table to query: 'nav' → nav_invoice_items, 'submitted' → invoice_items */
  source?: 'nav' | 'submitted';
  /** Invoice date (for asset activation) */
  invoiceDate?: string;
  /** Supplier / partner name (for asset activation) */
  supplierName?: string;
}

export function InvoiceItemsDialog({
  open,
  onOpenChange,
  invoiceId,
  invoiceNumber,
  currency,
  source = 'nav',
  invoiceDate,
  supplierName,
}: InvoiceItemsDialogProps) {
  const { selectedCompany } = useCompany();
  const { activePresetId } = useActivePreset(selectedCompany?.id);
  const queryClient = useQueryClient();

  // Selection state for activation
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [activationDialogOpen, setActivationDialogOpen] = useState(false);

  const { data: items = [], isLoading: loading } = useQuery({
    queryKey: ['invoiceItems', source, invoiceId],
    queryFn: async () => {
      if (source === 'submitted') {
        const { data, error } = await supabase
          .from('invoice_items')
          .select('id, line_number, line_description, product_code, quantity, unit_of_measure, unit_price, net_amount, vat_rate, vat_amount, gross_amount, gl_classifications, exclude_from_accounting')
          .eq('invoice_id', invoiceId)
          .order('line_number', { ascending: true });
        if (error) throw error;
        return (data || []) as InvoiceLineItem[];
      }
      // Default: NAV source
      const { data, error } = await supabase
        .from('nav_invoice_items')
        .select('id, line_number, line_description, product_code, quantity, unit_of_measure, unit_price, net_amount, vat_rate, vat_amount, gross_amount, gl_classifications, exclude_from_accounting')
        .eq('nav_invoice_id', invoiceId)
        .order('line_number', { ascending: true });
      if (error) throw error;
      return (data || []) as InvoiceLineItem[];
    },
    enabled: open && !!invoiceId,
  });

  // ── Query existing fixed assets linked to this invoice to prevent duplicates ──
  const { data: existingAssets = [] } = useQuery({
    queryKey: ['fixedAssetsForInvoice', invoiceId, source],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('fixed_assets')
        .select('id, name, acquisition_value, source_invoice_id, source_invoice_type')
        .eq('source_invoice_id', invoiceId)
        .eq('source_invoice_type', source === 'submitted' ? 'submitted' : 'nav');
      if (error) throw error;
      return data || [];
    },
    enabled: open && !!invoiceId,
  });

  // Build a Set of already-activated item keys (name + value) for matching
  const activatedItemKeys = useMemo(() => {
    // Track how many times each name+value combo appears in existing assets
    const assetCounts = new Map<string, number>();
    for (const asset of existingAssets) {
      const key = `${(asset.name || '').toLowerCase().trim()}|${asset.acquisition_value}`;
      assetCounts.set(key, (assetCounts.get(key) || 0) + 1);
    }
    return { assetCounts };
  }, [existingAssets]);

  // For each line item, check if it's already activated
  const isItemAlreadyActivated = useCallback((item: InvoiceLineItem): boolean => {
    const itemName = (item.line_description || '').toLowerCase().trim();
    const itemGross = item.gross_amount ?? (item.net_amount != null && item.vat_amount != null ? item.net_amount + item.vat_amount : item.net_amount);
    const key = `${itemName}|${itemGross}`;
    return (activatedItemKeys.assetCounts.get(key) || 0) > 0;
  }, [activatedItemKeys]);

  // Get the list of selectable (non-activated) item IDs
  const selectableItems = useMemo(() => {
    return items.filter(item => !isItemAlreadyActivated(item));
  }, [items, isItemAlreadyActivated]);

  // Reset selection when dialog opens/closes
  const handleOpenChange = useCallback((newOpen: boolean) => {
    if (!newOpen) setSelectedIds(new Set());
    onOpenChange(newOpen);
  }, [onOpenChange]);

  // Toggle exclude_from_accounting on a single line item
  const handleToggleItemExclude = useCallback(async (item: InvoiceLineItem) => {
    const table = source === 'submitted' ? 'invoice_items' : 'nav_invoice_items';
    const newValue = !item.exclude_from_accounting;
    const { error } = await supabase
      .from(table)
      .update({ exclude_from_accounting: newValue })
      .eq('id', item.id);
    if (!error) {
      queryClient.invalidateQueries({ queryKey: ['invoiceItems', source, invoiceId] });
    }
  }, [source, invoiceId, queryClient]);

  const formatAmount = (amount: number | null) => {
    if (amount === null || amount === undefined) return '-';
    return formatCurrency(amount, currency);
  };

  const formatQuantity = (qty: number | null, unit: string | null) => {
    if (qty === null || qty === undefined) return '-';
    const formatted = qty.toLocaleString('hu-HU', { maximumFractionDigits: 2 });
    return unit ? `${formatted} ${unit}` : formatted;
  };

  const formatVatRate = (rate: string | null) => {
    if (!rate) return '-';
    const num = parseFloat(rate);
    // NAV format: 0.27 → 27%
    if (!isNaN(num) && num > 0 && num < 1) return `${Math.round(num * 100)}%`;
    // NAV format: 0 or 0.00 → 0%
    if (!isNaN(num) && num === 0) return '0%';
    // OCR format already has %: "27%", "5%" → keep as-is
    // Special codes: "AAM", "TAM", "KBAET" → keep as-is
    return rate;
  };

  const getGrossAmount = (item: InvoiceLineItem) => {
    if (item.gross_amount !== null) return item.gross_amount;
    if (item.net_amount !== null && item.vat_amount !== null) {
      return item.net_amount + item.vat_amount;
    }
    if (item.net_amount !== null) return item.net_amount;
    return null;
  };

  const totals = useMemo(() => ({
    net: items.reduce((sum, item) => sum + (item.net_amount || 0), 0),
    vat: items.reduce((sum, item) => sum + (item.vat_amount || 0), 0),
    gross: items.reduce((sum, item) => sum + (getGrossAmount(item) || 0), 0),
  }), [items]);

  // Selection helpers — only count selectable (non-activated) items
  const allSelected = selectableItems.length > 0 && selectableItems.every(i => selectedIds.has(i.id));
  const someSelected = selectedIds.size > 0;

  const toggleAll = () => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(selectableItems.map(i => i.id)));
    }
  };

  const toggleItem = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Build selected items for activation dialog
  const selectedItemsForActivation = useMemo(() => {
    return items
      .filter(item => selectedIds.has(item.id))
      .map(item => ({
        id: item.id,
        name: item.line_description || 'Ismeretlen tétel',
        netAmount: item.net_amount || 0,
        grossAmount: getGrossAmount(item) || 0,
        currency: currency || 'HUF',
      }));
  }, [items, selectedIds, currency]);

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="max-w-5xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader className="pb-4 border-b border-border/50">
            <DialogTitle className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Package className="h-5 w-5 text-primary" />
              </div>
              <div>
                <span className="text-muted-foreground text-sm font-normal">Számlatételek</span>
                <p className="font-mono text-xl font-bold tracking-tight">{invoiceNumber}</p>
              </div>
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-auto mt-4">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <LoadingSpinner />
              </div>
            ) : items.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted/50 flex items-center justify-center">
                  <Package className="h-8 w-8 opacity-50" />
                </div>
                <p className="font-medium">Nincsenek elérhető tételek</p>
                <p className="text-sm mt-1 opacity-75">
                  A tételek automatikusan lekérésre kerülnek a következő szinkronizáláskor.
                </p>
              </div>
            ) : (
              <div className="rounded-lg border border-border/50 overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/30 hover:bg-muted/30">
                      <TableHead className="w-10">
                        <Checkbox
                          checked={allSelected}
                          onCheckedChange={toggleAll}
                          disabled={selectableItems.length === 0}
                          aria-label="Összes kijelölése"
                        />
                      </TableHead>
                      <TableHead className="w-12 font-semibold">#</TableHead>
                      <TableHead className="font-semibold">Megnevezés</TableHead>
                      <TableHead className="text-right font-semibold">Mennyiség</TableHead>
                      <TableHead className="text-right font-semibold">Egységár</TableHead>
                      <TableHead className="text-right font-semibold">Nettó</TableHead>
                      <TableHead className="text-center font-semibold">ÁFA</TableHead>
                      <TableHead className="text-right font-semibold">ÁFA összeg</TableHead>
                      <TableHead className="text-right font-semibold">Bruttó</TableHead>
                      <TableHead className="text-center font-semibold">Főkönyv</TableHead>
                      <TableHead className="text-center font-semibold w-[70px]">Könyv.</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((item, index) => {
                      const alreadyActivated = isItemAlreadyActivated(item);
                      return (
                      <TableRow 
                        key={item.id}
                        className={cn(
                          'h-12',
                          alreadyActivated
                            ? 'bg-success/5 opacity-60'
                            : selectedIds.has(item.id)
                            ? 'bg-primary/5'
                            : index % 2 === 0 ? 'bg-transparent' : 'bg-muted/10'
                        )}
                      >
                        <TableCell>
                          {alreadyActivated ? (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className="flex items-center justify-center">
                                  <CheckCircle2 className="h-4 w-4 text-success" />
                                </div>
                              </TooltipTrigger>
                              <TooltipContent side="right">
                                <p>Ez a tétel már aktiválva van a TÉNY-ben</p>
                              </TooltipContent>
                            </Tooltip>
                          ) : (
                            <Checkbox
                              checked={selectedIds.has(item.id)}
                              onCheckedChange={() => toggleItem(item.id)}
                              aria-label={`Kijelölés: ${item.line_description || ''}`}
                            />
                          )}
                        </TableCell>
                        <TableCell className="font-mono text-muted-foreground">
                          {item.line_number}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="flex-1">
                              <p className="font-medium">{item.line_description || '-'}</p>
                              {item.product_code && (
                                <p className="text-xs text-muted-foreground font-mono">
                                  {item.product_code}
                                </p>
                              )}
                            </div>
                            {alreadyActivated && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-success/10 text-success whitespace-nowrap">
                                <CheckCircle2 className="h-3 w-3" />
                                Már aktiválva
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {formatQuantity(item.quantity, item.unit_of_measure)}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {formatAmount(item.unit_price)}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {formatAmount(item.net_amount)}
                        </TableCell>
                        <TableCell className="text-center">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-muted text-muted-foreground">
                            {formatVatRate(item.vat_rate)}
                          </span>
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {formatAmount(item.vat_amount)}
                        </TableCell>
                        <TableCell className="text-right font-mono font-medium">
                          {formatAmount(getGrossAmount(item))}
                        </TableCell>
                        <TableCell className="text-center">
                          {(() => {
                            // Try the active preset first, otherwise fallback to the first available classification key
                            const classification = (activePresetId && item.gl_classifications?.[activePresetId])
                              ? item.gl_classifications[activePresetId]
                              : (item.gl_classifications && Object.keys(item.gl_classifications).length > 0 
                                  ? Object.values(item.gl_classifications)[0] 
                                  : null);
                            
                            return classification?.gl_number ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary">
                                {classification.gl_number}
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-muted text-muted-foreground" title="Nincs besorolva">
                                -
                              </span>
                            );
                          })()}
                        </TableCell>
                        <TableCell className="text-center">
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); handleToggleItemExclude(item); }}
                            className={cn(
                              "inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-semibold transition-all border cursor-pointer whitespace-nowrap",
                              item.exclude_from_accounting
                                ? "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-300/40 hover:bg-amber-500/25"
                                : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-300/30 hover:bg-emerald-500/20"
                            )}
                            title={item.exclude_from_accounting ? 'Nem kerül könyvelésre — kattints a visszaállításhoz' : 'Könyvelésre kerül — kattints a kizáráshoz'}
                          >
                            {item.exclude_from_accounting ? 'Nem' : 'Igen'}
                          </button>
                        </TableCell>
                      </TableRow>
                    );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>

          {items.length > 0 && (
            <div className="border-t border-border/50 pt-5 mt-4">
              <div className="flex justify-between items-end">
                {/* Activation button — always rendered to prevent layout shift */}
                <div>
                  <Button
                    className={cn("gap-2", !someSelected && "invisible pointer-events-none")}
                    onClick={() => setActivationDialogOpen(true)}
                  >
                    <Package2 className="h-4 w-4" />
                    Aktiválás ({selectedIds.size || 0} tétel)
                  </Button>
                </div>

                {/* Totals */}
                <div className="bg-muted/30 rounded-lg p-4 min-w-[320px]">
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Összesen nettó:</span>
                      <span className="font-mono font-medium">{formatAmount(totals.net)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Összesen ÁFA:</span>
                      <span className="font-mono font-medium">{formatAmount(totals.vat)}</span>
                    </div>
                    <div className="h-px bg-border/50 my-3" />
                    <div className="flex justify-between items-center">
                      <span className="text-foreground font-medium">Összesen bruttó:</span>
                      <span className="font-mono text-xl font-bold text-primary">
                        {formatAmount(totals.gross)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Asset Activation Dialog */}
      <AssetActivationDialog
        open={activationDialogOpen}
        onOpenChange={setActivationDialogOpen}
        selectedItems={selectedItemsForActivation}
        invoiceInfo={{
          invoiceId,
          invoiceType: source === 'submitted' ? 'submitted' : 'nav',
          invoiceNumber,
          invoiceDate: invoiceDate || new Date().toISOString().split('T')[0],
          supplierName: supplierName || 'Ismeretlen',
        }}
        onSuccess={() => {
          setSelectedIds(new Set());
          // Refetch to update the "already activated" badges
          queryClient.invalidateQueries({ queryKey: ['fixedAssetsForInvoice', invoiceId, source] });
        }}
      />
    </>
  );
}
