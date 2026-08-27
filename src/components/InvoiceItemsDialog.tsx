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
import { Package, Package2, CheckCircle2, Info, Loader2, Check, Pencil, FileSpreadsheet, X, ArrowUpDown, ChevronUp, ChevronDown, MessageSquare, Sparkles, Wallet } from 'lucide-react';
import { useCompany } from '@/contexts/CompanyContext';
import { useAuth } from '@/contexts/AuthContext';
import { useActivePreset } from '@/hooks/useActivePreset';
import { useToast } from '@/hooks/use-toast';
import { AssetActivationDialog } from '@/components/AssetActivationDialog';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useProjectList } from '@/hooks/useProjectList';
import { Label } from '@/components/ui/label';

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
  project_id?: string | null;
  notes?: string | null;
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
  /** Project id of the invoice (for asset activation) */
  projectId?: string | null;
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
  projectId,
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

  // Petty cash write-off dialog state
  const [pettyCashWriteOffOpen, setPettyCashWriteOffOpen] = useState(false);
  const [pendingOmitItem, setPendingOmitItem] = useState<InvoiceLineItem | null>(null);
  const [pettyCashRegisters, setPettyCashRegisters] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedRegisterId, setSelectedRegisterId] = useState<string>('');

  // Sorting state
  const [sortField, setSortField] = useState<keyof InvoiceLineItem | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc' | null>(null);

  // Fetch projects list
  const { projects: projectList } = useProjectList();

  // Fetch parent invoice project_id and other details for petty cash
  const { data: parentInvoice } = useQuery({
    queryKey: ['parentInvoice', source, invoiceId],
    queryFn: async () => {
      const table = source === 'submitted' ? 'invoices' : 'nav_invoices';
      const selectFields = source === 'submitted'
        ? 'project_id, invoice_direction, kibocsatas_datuma, penznem'
        : 'project_id, invoice_direction, invoice_issue_date, currency';

      const { data, error } = await supabase
        .from(table as any)
        .select(selectFields)
        .eq('id', invoiceId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: open && !!invoiceId,
  });

  // Sort toggle handler
  const handleSort = (field: keyof InvoiceLineItem) => {
    if (sortField !== field) {
      setSortField(field);
      setSortDirection('asc');
    } else if (sortDirection === 'asc') {
      setSortDirection('desc');
    } else {
      setSortField(null);
      setSortDirection(null);
    }
  };

  // Update item project handler
  const handleUpdateItemProject = async (item: InvoiceLineItem, projectId: string | null) => {
    const table = source === 'submitted' ? 'invoice_items' : 'nav_invoice_items';
    const { error } = await supabase
      .from(table as any)
      .update({ project_id: projectId })
      .eq('id', item.id);

    if (error) {
      toast({
        title: 'Hiba a projekt frissítésekor',
        description: error.message,
        variant: 'destructive',
      });
      return;
    }

    try {
      const twins = await findTwinItems(item);
      for (const twin of twins) {
        await supabase
          .from(twin.sourceTable as any)
          .update({ project_id: projectId })
          .eq('id', twin.id);
      }
    } catch (e) {
      console.error("Failed to update twin item projects:", e);
    }

    queryClient.invalidateQueries({ queryKey: ['invoiceItems', source, invoiceId] });
    toast({
      title: 'Projekt frissítve',
      description: 'A tétel projekt-hozzárendelése sikeresen módosult.',
    });
  };

  // Save project auto-linkage rule handler
  const handleSaveProjectRule = async (lineDescription: string, glNumber: string, projectId: string, projectName: string) => {
    if (!selectedCompany?.id || !session?.user.id) return;

    try {
      const { data, error } = await supabase.rpc('save_item_project_rule_and_retroactive', {
        p_company_id: selectedCompany.id,
        p_line_description: lineDescription,
        p_gl_number: glNumber,
        p_project_id: projectId,
        p_user_id: session.user.id,
      });

      if (error) {
        toast({
          title: 'Hiba a szabály mentésekor',
          description: error.message,
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Szabály sikeresen elmentve',
          description: `A(z) "${projectName}" projektszabály rögzítve lett és alkalmazva az azonos tételekre.`,
        });
        queryClient.invalidateQueries({ queryKey: ['invoiceItems', source, invoiceId] });
      }
    } catch (e: any) {
      toast({
        title: 'Hiba a szabály mentésekor',
        description: e.message,
        variant: 'destructive',
      });
    }
  };

  // Update item note handler
  const handleUpdateItemNotes = async (item: InvoiceLineItem, notesText: string) => {
    const table = source === 'submitted' ? 'invoice_items' : 'nav_invoice_items';
    const notesValue = notesText.trim() === '' ? null : notesText;
    const { error } = await supabase
      .from(table as any)
      .update({ notes: notesValue })
      .eq('id', item.id);

    if (error) {
      toast({
        title: 'Hiba a jegyzet mentésekor',
        description: error.message,
        variant: 'destructive',
      });
      return;
    }

    try {
      const twins = await findTwinItems(item);
      for (const twin of twins) {
        await supabase
          .from(twin.sourceTable as any)
          .update({ notes: notesValue })
          .eq('id', twin.id);
      }
    } catch (e) {
      console.error("Failed to update twin item notes:", e);
    }

    queryClient.invalidateQueries({ queryKey: ['invoiceItems', source, invoiceId] });
    toast({
      title: 'Jegyzet mentve',
      description: 'A tétel jegyzete sikeresen frissült.',
    });
  };

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
      toast({ title: 'Sikeres módosítás', description: `Főkönyvi besorolás frissítve.${twinMsg}` });
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
      const baseCols = 'id, line_number, line_description, product_code, quantity, unit_of_measure, unit_price, net_amount, vat_rate, vat_amount, gross_amount, gl_classifications, project_id, notes';
      const fullCols = baseCols + ', exclude_from_accounting';
      const fkCol = source === 'submitted' ? 'invoice_id' : 'nav_invoice_id';
      const fromTable = source === 'submitted' ? 'invoice_items' : 'nav_invoice_items';

      // Try with exclude_from_accounting first; fallback to without if column doesn't exist
      const { data, error } = await supabase
        .from(fromTable as any)
        .select(fullCols)
        .eq(fkCol, invoiceId)
        .order('line_number', { ascending: true });

      if (error) {
        // Column doesn't exist yet (42703) — retry without it
        if (error.code === '42703' || error.message?.includes('does not exist')) {
          const { data: fallbackData, error: fallbackError } = await supabase
            .from(fromTable as any)
            .select(baseCols)
            .eq(fkCol, invoiceId)
            .order('line_number', { ascending: true });
          if (fallbackError) throw fallbackError;
          return (fallbackData || []) as unknown as InvoiceLineItem[];
        }
        throw error;
      }
      return (data || []) as unknown as InvoiceLineItem[];
    },
    enabled: open && !!invoiceId,
    placeholderData: keepPreviousData,
  });

  // Sort items client-side if a sort field is active
  const sortedItems = useMemo(() => {
    if (!sortField || !sortDirection) return items;

    return [...items].sort((a, b) => {
      let aVal: any = a[sortField];
      let bVal: any = b[sortField];

      if (sortField === 'gross_amount') {
        aVal = getGrossAmount(a);
        bVal = getGrossAmount(b);
      }

      if (sortField === 'gl_classifications') {
        const aClass = (activePresetId && a.gl_classifications?.[activePresetId])
          ? a.gl_classifications[activePresetId]
          : null;
        const bClass = (activePresetId && b.gl_classifications?.[activePresetId])
          ? b.gl_classifications[activePresetId]
          : null;
        aVal = aClass?.gl_number || '';
        bVal = bClass?.gl_number || '';
      }

      if (aVal === null || aVal === undefined) return sortDirection === 'asc' ? 1 : -1;
      if (bVal === null || bVal === undefined) return sortDirection === 'asc' ? -1 : 1;

      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
      }

      const aStr = String(aVal).localeCompare(String(bVal), 'hu');
      return sortDirection === 'asc' ? aStr : -aStr;
    });
  }, [items, sortField, sortDirection, activePresetId]);

  // Render a sortable header cell helper
  const renderSortableHeader = (field: keyof InvoiceLineItem, label: string, align: 'left' | 'center' | 'right' = 'left', className?: string) => {
    const isSorted = sortField === field;
    return (
      <TableHead 
        className={cn("cursor-pointer select-none hover:bg-muted/40 transition-colors py-3 font-semibold", className)}
        onClick={() => handleSort(field)}
      >
        <div className={cn(
          "flex items-center gap-1",
          align === 'right' && "justify-end",
          align === 'center' && "justify-center"
        )}>
          <span>{label}</span>
          {isSorted ? (
            sortDirection === 'asc' ? <ChevronUp className="h-3 w-3 text-primary shrink-0" /> : <ChevronDown className="h-3 w-3 text-primary shrink-0" />
          ) : (
            <ArrowUpDown className="h-3 w-3 text-muted-foreground/30 hover:text-muted-foreground/60 shrink-0" />
          )}
        </div>
      </TableHead>
    );
  };

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
    
    if (error) {
      toast({
        title: 'Hiba a könyvelési státusz módosításakor',
        description: error.message,
        variant: 'destructive',
      });
      return;
    }

    queryClient.invalidateQueries({ queryKey: ['invoiceItems', source, invoiceId] });

    // If it is being excluded, check petty cash registers and ask if they want to write it off
    if (newValue === true) {
      try {
        const { data: registers, error: regError } = await supabase
          .from('petty_cash_registers')
          .select('id, name')
          .eq('company_id', selectedCompany!.id);

        if (regError) throw regError;

        if (registers && registers.length > 0) {
          setPettyCashRegisters(registers);
          setPendingOmitItem(item);
          if (registers.length === 1) {
            setSelectedRegisterId(registers[0].id);
          } else {
            setSelectedRegisterId('');
          }
          setPettyCashWriteOffOpen(true);
        }
      } catch (err: any) {
        console.error('Failed to fetch petty cash registers:', err);
      }
    } else {
      // If it is being restored, delete any linked petty cash entry
      try {
        const { error: deleteError } = await supabase
          .from('petty_cash_entries')
          .delete()
          .eq('source_table', table)
          .eq('source_id', item.id);
        
        if (!deleteError) {
          toast({
            title: 'Házipénztár bejegyzés törölve',
            description: 'A tétel visszakerült a könyvelésbe, a hozzá kapcsolódó pénztári bejegyzés törlésre került.',
          });
        }
      } catch (err) {
        console.error('Failed to delete linked petty cash entry:', err);
      }
    }
  }, [source, invoiceId, queryClient, selectedCompany, toast]);

  // Confirm petty cash write-off
  const handleConfirmPettyCashWriteOff = async () => {
    if (!pendingOmitItem || !selectedRegisterId) return;

    const table = source === 'submitted' ? 'invoice_items' : 'nav_invoice_items';
    const amount = getGrossAmount(pendingOmitItem) || 0;
    const direction = parentInvoice?.invoice_direction || 'INBOUND';
    
    // Inbound invoice means cash spent (expense) -> negative amount
    // Outbound invoice means cash received (sale) -> positive amount
    const entryAmount = direction === 'INBOUND' ? -amount : amount;

    let entryDate = new Date().toISOString().split('T')[0];
    if (source === 'submitted' && parentInvoice?.kibocsatas_datuma) {
      entryDate = parentInvoice.kibocsatas_datuma;
    } else if (source === 'nav' && parentInvoice?.invoice_issue_date) {
      entryDate = parentInvoice.invoice_issue_date;
    }

    const description = `Készpénzes kiírás (könyvelésből kizárt tétel: ${pendingOmitItem.line_description || 'Névtelen tétel'}) - Bizonylatszám: ${invoiceNumber}`;
    const invoiceCurrency = currency || parentInvoice?.currency || parentInvoice?.penznem || 'HUF';

    try {
      const { error } = await supabase
        .from('petty_cash_entries')
        .insert({
          company_id: selectedCompany!.id,
          register_id: selectedRegisterId,
          entry_date: entryDate,
          description: description,
          amount: entryAmount,
          currency: invoiceCurrency,
          source_type: direction === 'INBOUND' ? 'cash_expense' : 'cash_sale',
          source_id: pendingOmitItem.id,
          source_table: table,
          routed_by: 'manual'
        });

      if (error) throw error;

      toast({
        title: 'Sikeres kiírás házipénztárra',
        description: `A tétel kiírása megtörtént a(z) "${pettyCashRegisters.find(r => r.id === selectedRegisterId)?.name || 'Pénztár'}" kasszába.`,
      });
    } catch (err: any) {
      toast({
        title: 'Hiba a házipénztári kiíráskor',
        description: err.message,
        variant: 'destructive',
      });
    } finally {
      setPettyCashWriteOffOpen(false);
      setPendingOmitItem(null);
      setSelectedRegisterId('');
    }
  };

  // Bulk toggle exclude_from_accounting for selected items
  const handleBulkToggleExclude = useCallback(async (exclude: boolean) => {
    if (selectedIds.size === 0) return;

    const table = source === 'submitted' ? 'invoice_items' : 'nav_invoice_items';
    const idsArray = Array.from(selectedIds);

    const { error } = await supabase
      .from(table)
      .update({ exclude_from_accounting: exclude })
      .in('id', idsArray);

    if (error) {
      toast({
        title: 'Hiba a tömeges módosítás során',
        description: error.message,
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Sikeres tömeges módosítás',
        description: exclude
          ? `${selectedIds.size} tétel kizárva a könyvelésből.`
          : `${selectedIds.size} tétel beemelve a könyvelésbe.`,
      });
      setSelectedIds(new Set());
      queryClient.invalidateQueries({ queryKey: ['invoiceItems', source, invoiceId] });
    }
  }, [selectedIds, source, invoiceId, queryClient, toast]);

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
                      {renderSortableHeader('line_number', '#', 'left', 'w-16')}
                      {renderSortableHeader('line_description', 'Megnevezés', 'left')}
                      {renderSortableHeader('quantity', 'Mennyiség', 'right', 'text-right')}
                      {renderSortableHeader('unit_price', 'Egységár', 'right', 'text-right')}
                      {renderSortableHeader('net_amount', 'Nettó', 'right', 'text-right')}
                      {renderSortableHeader('vat_rate', 'ÁFA', 'center', 'text-center w-[90px]')}
                      {renderSortableHeader('vat_amount', 'ÁFA összeg', 'right', 'text-right')}
                      {renderSortableHeader('gross_amount', 'Bruttó', 'right', 'text-right')}
                      {renderSortableHeader('gl_classifications', 'Főkönyv', 'center', 'text-center')}
                      <TableHead className="font-semibold w-[200px]">Projekt</TableHead>
                      <TableHead className="font-semibold text-center w-12">Jegyzet</TableHead>
                      <TableHead className="text-center font-semibold w-[75px]">
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
                    {sortedItems.map((item, index) => {
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
                        <TableCell className="min-w-[160px]">
                          <div className="flex items-center gap-1.5">
                            <Select
                              value={item.project_id || 'INHERITED'}
                              onValueChange={(val) => {
                                handleUpdateItemProject(item, val === 'INHERITED' ? null : val);
                              }}
                            >
                              <SelectTrigger className="h-8 text-xs bg-background border-border/60 hover:bg-muted/30 transition-colors w-full">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent className="max-w-[200px]">
                                <SelectItem value="INHERITED" className="text-xs text-muted-foreground italic">
                                  {parentInvoice?.project_id ? (
                                    <span>Örökölt ({projectList.find(p => p.id === parentInvoice.project_id)?.name || 'Projekt'})</span>
                                  ) : (
                                    '-'
                                  )}
                                </SelectItem>
                                {projectList.map((p) => (
                                  <SelectItem key={p.id} value={p.id} className="text-xs">
                                    {p.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>

                            {(() => {
                              const classification = (activePresetId && item.gl_classifications?.[activePresetId])
                                ? item.gl_classifications[activePresetId]
                                : null;
                              
                              if (!item.project_id || !classification?.gl_number) return null;

                              const projName = projectList.find(p => p.id === item.project_id)?.name || 'Projekt';

                              return (
                                <Popover>
                                  <PopoverTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-7 w-7 text-primary hover:text-primary hover:bg-primary/10 rounded-md shrink-0"
                                      title="Automata szabály beállítása"
                                    >
                                      <Sparkles className="h-3.5 w-3.5" />
                                    </Button>
                                  </PopoverTrigger>
                                  <PopoverContent className="w-80 p-4 z-[110]" align="end">
                                    <div className="space-y-3">
                                      <div className="flex items-center gap-2">
                                        <Sparkles className="h-4 w-4 text-primary" />
                                        <h4 className="font-semibold text-sm">Automatikus szabály beállítása</h4>
                                      </div>
                                      <p className="text-xs text-muted-foreground leading-relaxed">
                                        Szeretné beállítani, hogy a jövőben minden <strong>"{item.line_description}"</strong> megnevezésű és <strong>"{classification.gl_number}"</strong> kontírszámú tétel automatikusan a(z) <strong>"{projName}"</strong> projekthez sorolódjon?
                                      </p>
                                      <p className="text-[10px] text-primary/80 italic leading-snug bg-primary/5 p-2 rounded border border-primary/10">
                                        Ez a szabály visszamenőleg is érvényesül a még projekt nélküli azonos tételekre!
                                      </p>
                                      <div className="flex justify-end gap-2 pt-2">
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          className="h-8 text-xs"
                                          onClick={() => {
                                            document.body.click();
                                          }}
                                        >
                                          Mégse
                                        </Button>
                                        <Button
                                          size="sm"
                                          className="h-8 text-xs gap-1.5"
                                          onClick={async () => {
                                            document.body.click();
                                            await handleSaveProjectRule(
                                              item.line_description || '',
                                              classification.gl_number,
                                              item.project_id!,
                                              projName
                                            );
                                          }}
                                        >
                                          Szabály mentése
                                        </Button>
                                      </div>
                                    </div>
                                  </PopoverContent>
                                </Popover>
                              );
                            })()}
                          </div>
                        </TableCell>
                        <TableCell className="text-center w-12">
                          <TooltipProvider delayDuration={300}>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div>
                                  <Popover>
                                    <PopoverTrigger asChild>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className={cn(
                                          "h-8 w-8 rounded-md hover:bg-muted/50 transition-colors shrink-0",
                                          item.notes ? "text-emerald-500 hover:text-emerald-600" : "text-muted-foreground/45 hover:text-muted-foreground/80"
                                        )}
                                      >
                                        <MessageSquare className="h-4 w-4" />
                                      </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-80 p-4 z-[110]" align="end">
                                      <ItemNoteEditor 
                                        item={item} 
                                        onSave={async (newNotes) => {
                                          await handleUpdateItemNotes(item, newNotes);
                                        }} 
                                      />
                                    </PopoverContent>
                                  </Popover>
                                </div>
                              </TooltipTrigger>
                              <TooltipContent side="top" className="max-w-[240px] z-[120]">
                                <p className="text-xs leading-normal">
                                  {item.notes ? (
                                    <span className="font-medium">{item.notes}</span>
                                  ) : (
                                    <span>Jegyzet hozzáadása</span>
                                  )}
                                </p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
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
                <div className="flex items-center gap-2">
                  <Button
                    className={cn("gap-2", !someSelected && "invisible pointer-events-none")}
                    onClick={() => setActivationDialogOpen(true)}
                  >
                    <Package2 className="h-4 w-4" />
                    Aktiválás ({selectedIds.size || 0} tétel)
                  </Button>
                  <div className={cn(!someSelected && "invisible pointer-events-none")}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" className="gap-2">
                          <FileSpreadsheet className="h-4 w-4" />
                          Könyvelés Ki/Be ({selectedIds.size || 0} tétel)
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start">
                        <DropdownMenuItem onClick={() => handleBulkToggleExclude(false)} className="cursor-pointer">
                          <CheckCircle2 className="h-4 w-4 text-green-500 mr-2" />
                          Beemelés a könyvelésbe
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleBulkToggleExclude(true)} className="cursor-pointer">
                          <X className="h-4 w-4 text-red-500 mr-2" />
                          Kizárás a könyvelésből
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
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
          projectId,
        }}
        onSuccess={() => {
          setSelectedIds(new Set());
          // Refetch to update the "already activated" badges
          queryClient.invalidateQueries({ queryKey: ['fixedAssetsForInvoice', invoiceId, source] });
        }}
      />

      {/* Petty Cash Write-off Dialog */}
      <Dialog open={pettyCashWriteOffOpen} onOpenChange={(open) => {
        if (!open) {
          setPettyCashWriteOffOpen(false);
          setPendingOmitItem(null);
          setSelectedRegisterId('');
        }
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader className="space-y-2">
            <DialogTitle className="flex items-center gap-2 text-lg">
              <Wallet className="h-5 w-5 text-primary" />
              Kiírás házipénztárra
            </DialogTitle>
            <DialogDescription className="text-sm">
              Könyvelésből kizárt tétel: <strong className="text-foreground">"{pendingOmitItem?.line_description}"</strong>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-3">
            <p className="text-sm text-muted-foreground leading-relaxed">
              Szeretné kiírni az adott tételt ({pendingOmitItem ? formatAmount(getGrossAmount(pendingOmitItem)) : ''}) házipénztárra?
            </p>

            {pettyCashRegisters.length > 1 && (
              <div className="space-y-2 bg-muted/30 p-3 rounded-lg border border-border/50">
                <Label htmlFor="petty-cash-select" className="text-xs font-bold text-muted-foreground uppercase tracking-wider block mb-1">
                  Válassz házipénztárt:
                </Label>
                <Select
                  value={selectedRegisterId}
                  onValueChange={setSelectedRegisterId}
                >
                  <SelectTrigger id="petty-cash-select" className="w-full bg-background border-border/80 h-10">
                    <SelectValue placeholder="Pénztár kiválasztása..." />
                  </SelectTrigger>
                  <SelectContent>
                    {pettyCashRegisters.map((reg) => (
                      <SelectItem key={reg.id} value={reg.id}>
                        {reg.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <DialogFooter className="flex justify-end gap-2 pt-4 border-t border-border/50">
            <Button
              variant="outline"
              onClick={() => {
                setPettyCashWriteOffOpen(false);
                setPendingOmitItem(null);
                setSelectedRegisterId('');
              }}
            >
              Nem
            </Button>
            <Button
              onClick={handleConfirmPettyCashWriteOff}
              disabled={!selectedRegisterId}
            >
              Igen, kiírás
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// Lightweight component to edit line item note inside popover
interface ItemNoteEditorProps {
  item: InvoiceLineItem;
  onSave: (notes: string) => Promise<void>;
}

function ItemNoteEditor({ item, onSave }: ItemNoteEditorProps) {
  const [text, setText] = useState(item.notes || '');
  const [saving, setSaving] = useState(false);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <MessageSquare className="h-4 w-4 text-emerald-500" />
        <h4 className="font-semibold text-sm">Tétel jegyzet</h4>
      </div>
      <textarea
        className="w-full min-h-[80px] p-2 text-xs bg-background border border-border/80 rounded-md focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary resize-y text-foreground"
        placeholder="Jegyzet írása..."
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <div className="flex justify-end gap-2">
        <Button
          size="sm"
          variant="outline"
          className="h-8 text-xs"
          onClick={() => {
            document.body.click();
          }}
        >
          Mégse
        </Button>
        <Button
          size="sm"
          className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5"
          onClick={async () => {
            setSaving(true);
            await onSave(text);
            setSaving(false);
            document.body.click();
          }}
          disabled={saving}
        >
          Mentés
        </Button>
      </div>
    </div>
  );
}
