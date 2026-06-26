import { useMemo, useState, useCallback } from 'react';
import { useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { formatCurrency, cn } from '@/lib/utils';
import { Package, Package2, CheckCircle2, Info, Loader2, Check, Pencil } from 'lucide-react';
import { useCompany } from '@/contexts/CompanyContext';
import { useAuth } from '@/contexts/AuthContext';
import { useActivePreset } from '@/hooks/useActivePreset';
import { useToast } from '@/hooks/use-toast';
import { AssetActivationDialog } from '@/components/AssetActivationDialog';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';

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
  const { session } = useAuth();
  const { activePresetId } = useActivePreset(selectedCompany?.id);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Selection state for activation
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [activationDialogOpen, setActivationDialogOpen] = useState(false);

  // GL editing state
  const [glEditItem, setGlEditItem] = useState<InvoiceLineItem | null>(null);
  const [glEditOpen, setGlEditOpen] = useState(false);
  const [glSearchQuery, setGlSearchQuery] = useState('');
  const [selectedNewGL, setSelectedNewGL] = useState<string>('');
  const [isGlSubmitting, setIsGlSubmitting] = useState(false);

  // Fetch GL accounts for the picker combobox
  const { data: glAccounts = [] } = useQuery({
    queryKey: ['glAccounts', activePresetId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('gl_accounts')
        .select('id, gl_number, short_name')
        .eq('preset_id', activePresetId!)
        .order('gl_number');
      if (error) throw error;
      return data || [];
    },
    enabled: !!activePresetId && glEditOpen,
  });

  const cleanGlNum = (num: any) => num ? String(num).replace(/\./g, '') : '';

  // Open GL edit dialog for a specific item
  const openGlEdit = useCallback((item: InvoiceLineItem) => {
    const classification = (activePresetId && item.gl_classifications?.[activePresetId])
      ? item.gl_classifications[activePresetId]
      : null;
    setGlEditItem(item);
    setSelectedNewGL(classification?.gl_account_id || '');
    setGlSearchQuery('');
    setGlEditOpen(true);
  }, [activePresetId]);

  // Find the "twin" line item in the opposite table (nav ↔ submitted)
  // so that GL changes on one side are automatically mirrored to the other.
  const findTwinItems = useCallback(async (item: InvoiceLineItem): Promise<{ id: string; sourceTable: string; originalGlAccountId: string | null }[]> => {
    if (!selectedCompany?.id) return [];

    try {
      if (source === 'nav') {
        // nav → submitted: look up nav_invoices.invoice_number → invoices.bizonylatsorszam → invoice_items
        const { data: navInv } = await supabase
          .from('nav_invoices')
          .select('invoice_number')
          .eq('id', invoiceId)
          .single();
        if (!navInv?.invoice_number) return [];

        // Normalize: strip spaces for matching (e.g., "HP / 2026" → "HP/2026")
        const normalizedNum = navInv.invoice_number.replace(/\s+/g, '');

        const { data: submittedInvs } = await supabase
          .from('invoices')
          .select('id, bizonylatsorszam')
          .eq('company_id', selectedCompany.id);

        const matchingInvIds = (submittedInvs || [])
          .filter(inv => inv.bizonylatsorszam && inv.bizonylatsorszam.replace(/\s+/g, '').toUpperCase() === normalizedNum.toUpperCase())
          .map(inv => inv.id);

        if (matchingInvIds.length === 0) return [];

        const { data: twinItems } = await supabase
          .from('invoice_items')
          .select('id, gl_classifications, line_number')
          .in('invoice_id', matchingInvIds)
          .eq('line_number', item.line_number);

        return (twinItems || []).map(t => ({
          id: t.id,
          sourceTable: 'invoice_items',
          originalGlAccountId: t.gl_classifications?.[activePresetId || '']?.gl_account_id || null,
        }));

      } else {
        // submitted → nav: look up invoices.bizonylatsorszam → nav_invoices.invoice_number → nav_invoice_items
        const { data: submittedInv } = await supabase
          .from('invoices')
          .select('bizonylatsorszam')
          .eq('id', invoiceId)
          .single();
        if (!submittedInv?.bizonylatsorszam) return [];

        const normalizedNum = submittedInv.bizonylatsorszam.replace(/\s+/g, '');

        const { data: navInvs } = await supabase
          .from('nav_invoices')
          .select('id, invoice_number')
          .eq('company_id', selectedCompany.id);

        const matchingNavIds = (navInvs || [])
          .filter(inv => inv.invoice_number && inv.invoice_number.replace(/\s+/g, '').toUpperCase() === normalizedNum.toUpperCase())
          .map(inv => inv.id);

        if (matchingNavIds.length === 0) return [];

        const { data: twinItems } = await supabase
          .from('nav_invoice_items')
          .select('id, gl_classifications, line_number')
          .in('nav_invoice_id', matchingNavIds)
          .eq('line_number', item.line_number);

        return (twinItems || []).map(t => ({
          id: t.id,
          sourceTable: 'nav_invoice_items',
          originalGlAccountId: t.gl_classifications?.[activePresetId || '']?.gl_account_id || null,
        }));
      }
    } catch {
      return [];
    }
  }, [source, invoiceId, selectedCompany?.id, activePresetId]);

  // Save GL override (+ sync twin item in the linked table)
  const handleSaveGlOverride = useCallback(async () => {
    if (!glEditItem || !selectedNewGL || !selectedCompany?.id || !session?.user.id || !activePresetId) return;

    setIsGlSubmitting(true);

    const sourceTable = source === 'submitted' ? 'invoice_items' : 'nav_invoice_items';
    const classification = glEditItem.gl_classifications?.[activePresetId];
    const originalGlAccountId = classification?.gl_account_id || null;

    const newGlItem = selectedNewGL === 'UNCLASSIFIED' ? null : glAccounts.find(gl => gl.id === selectedNewGL);
    const newGlNumber = newGlItem?.gl_number || '';

    // Build payload: primary item + any twin items from the linked table
    const payloadItems: { item_id: string; source_table: string; original_gl_account_id: string | null }[] = [{
      item_id: glEditItem.id,
      source_table: sourceTable,
      original_gl_account_id: originalGlAccountId,
    }];

    // Find twin items (opposite table, same line_number)
    const twins = await findTwinItems(glEditItem);
    for (const twin of twins) {
      payloadItems.push({
        item_id: twin.id,
        source_table: twin.sourceTable,
        original_gl_account_id: twin.originalGlAccountId,
      });
    }

    const { data, error } = await supabase.rpc('override_gl_classifications_batch', {
      p_items: payloadItems,
      p_new_gl_account_id: selectedNewGL === 'UNCLASSIFIED' ? null : selectedNewGL,
      p_company_id: selectedCompany.id,
      p_user_id: session.user.id,
      p_preset_id: activePresetId,
      p_new_gl_number: newGlNumber,
    });

    setIsGlSubmitting(false);

    if (error || data === false) {
      toast({ title: 'Hiba a mentés során', description: error?.message || 'Ismeretlen hiba', variant: 'destructive' });
    } else {
      const twinMsg = twins.length > 0 ? ' (párosított számla is frissítve)' : '';
      toast({ title: 'Sikeres módosítás', description: `Főkönyvi besorolás frissítve.${twinMsg}`, className: 'bg-green-50 text-green-900 border-green-200' });
      setGlEditOpen(false);
      setGlEditItem(null);
      // Invalidate all relevant caches so every view refreshes
      queryClient.invalidateQueries({ queryKey: ['invoiceItems'] });
      queryClient.invalidateQueries({ queryKey: ['glBalances'] });
      queryClient.invalidateQueries({ queryKey: ['glItems'] });
      queryClient.invalidateQueries({ queryKey: ['filteredNavInvoices'] });
      queryClient.invalidateQueries({ queryKey: ['filteredSubmittedInvoices'] });
    }
  }, [glEditItem, selectedNewGL, selectedCompany?.id, session?.user.id, activePresetId, source, invoiceId, glAccounts, queryClient, toast, findTwinItems]);

  const { data: items = [], isLoading: loading } = useQuery({
    queryKey: ['invoiceItems', source, invoiceId],
    queryFn: async () => {
      const baseCols = 'id, line_number, line_description, product_code, quantity, unit_of_measure, unit_price, net_amount, vat_rate, vat_amount, gross_amount, gl_classifications';
      const fullCols = baseCols + ', exclude_from_accounting';
      const table = source === 'submitted' ? 'invoice_items' : 'submitted';
      const fkCol = source === 'submitted' ? 'invoice_id' : 'nav_invoice_id';
      const fromTable = source === 'submitted' ? 'invoice_items' : 'nav_invoice_items';

      // Try with exclude_from_accounting first; fallback to without if column doesn't exist
      const { data, error } = await supabase
        .from(fromTable)
        .select(fullCols)
        .eq(fkCol, invoiceId)
        .order('line_number', { ascending: true });

      if (error) {
        // Column doesn't exist yet (42703) — retry without it
        if (error.code === '42703' || error.message?.includes('does not exist')) {
          const { data: fallbackData, error: fallbackError } = await supabase
            .from(fromTable)
            .select(baseCols)
            .eq(fkCol, invoiceId)
            .order('line_number', { ascending: true });
          if (fallbackError) throw fallbackError;
          return (fallbackData || []) as InvoiceLineItem[];
        }
        throw error;
      }
      return (data || []) as InvoiceLineItem[];
    },
    enabled: open && !!invoiceId,
    placeholderData: keepPreviousData,
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
        <DialogContent className="max-w-7xl max-h-[85vh] overflow-hidden flex flex-col">
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
            ) : items.length === 0 && open ? (
              <div className="text-center py-12 text-muted-foreground">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted/50 flex items-center justify-center">
                  <Package className="h-8 w-8 opacity-50" />
                </div>
                <p className="font-medium">Nincsenek elérhető tételek</p>
                <p className="text-sm mt-1 opacity-75">
                  A tételek automatikusan lekérésre kerülnek a következő szinkronizáláskor.
                </p>
              </div>
            ) : items.length === 0 ? null : (
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
                      <TableHead className="text-center font-semibold w-[70px]">
                        <div className="flex items-center justify-center gap-1">
                          Könyv.
                          <TooltipProvider delayDuration={0}>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Info className="h-3 w-3 text-muted-foreground/60 cursor-help" />
                              </TooltipTrigger>
                              <TooltipContent side="top" align="end" sideOffset={8} className="max-w-[240px] z-[100]">
                                <p className="text-xs font-normal normal-case tracking-normal leading-relaxed">Ha be van jelölve, a tétel bekerül a könyvelésbe. Kattints a jelölőnégyzetre a módosításhoz.</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                      </TableHead>
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
                              <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); openGlEdit(item); }}
                                className="group/gl inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary hover:bg-primary/20 transition-colors cursor-pointer"
                                title="Kattints a módosításhoz"
                              >
                                {classification.gl_number}
                                <Pencil className="h-3 w-3 opacity-0 group-hover/gl:opacity-70 transition-opacity" />
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); openGlEdit(item); }}
                                className="group/gl inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-muted text-muted-foreground hover:bg-muted/80 transition-colors cursor-pointer"
                                title="Kattints a besoroláshoz"
                              >
                                -
                                <Pencil className="h-3 w-3 opacity-0 group-hover/gl:opacity-70 transition-opacity" />
                              </button>
                            );
                          })()}
                        </TableCell>
                        <TableCell className="text-center">
                          {item.exclude_from_accounting !== undefined ? (
                            <Checkbox
                              checked={!item.exclude_from_accounting}
                              onCheckedChange={() => handleToggleItemExclude(item)}
                              onClick={(e) => e.stopPropagation()}
                              aria-label={item.exclude_from_accounting ? 'Könyvelésbe visszaállítás' : 'Könyvelésből kizárás'}
                            />
                          ) : (
                            <span className="text-xs text-muted-foreground">-</span>
                          )}
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

      {/* GL Edit Dialog */}
      <Dialog open={glEditOpen} onOpenChange={(open) => { setGlEditOpen(open); if (!open) { setGlEditItem(null); setGlSearchQuery(''); } }}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Kategória módosítása</DialogTitle>
            <DialogDescription>
              {glEditItem?.line_description || 'Számlatétel'} — főkönyvi besorolás módosítása
            </DialogDescription>
          </DialogHeader>
          <div className="py-2 flex flex-col gap-4 w-full overflow-hidden">
            <div className="bg-muted p-3 rounded-md border text-sm flex items-center justify-between w-full overflow-hidden gap-2">
              <span className="font-medium text-muted-foreground whitespace-nowrap">Új kategória:</span>
              <span className="font-bold text-foreground bg-background px-3 py-1.5 rounded border border-border shadow-sm truncate max-w-full">
                {selectedNewGL === 'UNCLASSIFIED' ? <span className="text-muted-foreground italic">Besorolatlan tétel (Kategória eltávolítva)</span> :
                  (selectedNewGL && glAccounts.length > 0
                  ? (() => {
                      const gl = glAccounts.find(g => g.id === selectedNewGL);
                      return gl ? `${gl.gl_number} ${gl.short_name}` : "Válassz a listából...";
                    })()
                  : "Válassz a listából...")}
              </span>
            </div>

            <Command className="rounded-lg border shadow-sm w-full overflow-hidden h-[350px]" shouldFilter={false}>
              <CommandInput 
                placeholder="Keresés főkönyvi szám vagy név alapján..." 
                value={glSearchQuery}
                onValueChange={setGlSearchQuery}
                className="w-full"
              />
              <CommandList className="h-[300px] max-h-[300px] overflow-y-auto w-full overflow-x-hidden">
                <CommandEmpty>Nincs találat.</CommandEmpty>
                <CommandGroup>
                  <CommandItem
                    key="unclassified"
                    value="besorolatlan uncategorized eltavolitas nincs"
                    onSelect={() => setSelectedNewGL('UNCLASSIFIED')}
                    className="cursor-pointer py-2 w-full overflow-hidden flex items-center mb-1 text-muted-foreground bg-muted/30"
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4 shrink-0",
                        selectedNewGL === 'UNCLASSIFIED' ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <span className={cn("truncate block w-full", selectedNewGL === 'UNCLASSIFIED' ? "font-bold text-foreground" : "font-medium")}>
                      Besorolatlan (Kategória eltávolítása)
                    </span>
                  </CommandItem>
                  {glAccounts
                    ?.filter(gl => !glSearchQuery || `${gl.gl_number} ${gl.short_name}`.toLowerCase().includes(glSearchQuery.toLowerCase()))
                    .slice()
                    .sort((a, b) => cleanGlNum(a.gl_number).localeCompare(cleanGlNum(b.gl_number)))
                    .map(gl => {
                      // Only show leaf nodes (no children with same prefix)
                      const isLeaf = !glAccounts.some(sub => cleanGlNum(sub.gl_number).startsWith(cleanGlNum(gl.gl_number)) && sub.id !== gl.id);
                      if (!isLeaf) return null;
                      
                      return (
                        <CommandItem
                          key={gl.id}
                          value={`${gl.gl_number} ${gl.short_name}`}
                          onSelect={() => setSelectedNewGL(gl.id)}
                          className="cursor-pointer py-2 w-full overflow-hidden flex items-center"
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4 text-primary shrink-0",
                              selectedNewGL === gl.id ? "opacity-100" : "opacity-0"
                            )}
                          />
                          <span className={cn("truncate block w-full", selectedNewGL === gl.id ? "font-bold text-foreground" : "")}>
                            {gl.gl_number} {gl.short_name}
                          </span>
                        </CommandItem>
                      );
                  })}
                </CommandGroup>
              </CommandList>
            </Command>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setGlEditOpen(false)} disabled={isGlSubmitting}>Mégse</Button>
            <Button onClick={handleSaveGlOverride} disabled={!selectedNewGL || isGlSubmitting || (glEditItem && selectedNewGL === (glEditItem.gl_classifications?.[activePresetId || '']?.gl_account_id || 'UNCLASSIFIED'))}>
              {isGlSubmitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Mentés
            </Button>
          </DialogFooter>
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
