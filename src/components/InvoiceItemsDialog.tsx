import { useMemo, useState, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { fetchAllGlAccountsByPreset } from '@/lib/glData';
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
import { formatCurrency, cn, formatVatRate, is27PercentVatRate, normalizeVatRatePercent } from '@/lib/utils';
import { Package, Package2, CheckCircle2, Info, Loader2, Check, Pencil, FileSpreadsheet, X, ArrowUpDown, ChevronUp, ChevronDown, MessageSquare, Sparkles, Wallet, Lock } from 'lucide-react';
import { useCompany } from '@/contexts/CompanyContext';
import { useAuth } from '@/contexts/AuthContext';
import { useActivePreset } from '@/hooks/useActivePreset';
import { useCompanySettings } from '@/hooks/useCompanySettings';
import { useToast } from '@/hooks/use-toast';
import {
  matchItemToVatCode,
  resolveVatCodeWithLearning,
  getVatCodeBadgeData,
  type VatCodeItem,
  type VatCodeOverrideLogEntry,
} from '@/utils/vatCodeMatching';
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
import { NavInvoiceVatSummaryCard } from '@/components/nav/NavInvoiceVatSummaryCard';

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
  deductible_percentage?: number | null;
  net_weight_kg?: number | null;
  vat_code_id?: string | null;
  vat_code?: string | null;
  is_vat_code_manual?: boolean | null;
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
  /** Direction of the invoice: 'INBOUND' (purchase) or 'OUTBOUND' (sales) */
  invoiceDirection?: string;
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
  invoiceDirection,
}: InvoiceItemsDialogProps) {
  const { t } = useTranslation(['invoices', 'common']);
  const { selectedCompany } = useCompany();
  const { session } = useAuth();
  const { activePresetId } = useActivePreset(selectedCompany?.id);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { effectiveSettings } = useCompanySettings();

  // Fetch company configured VAT codes for dual tracking & accurate badge/tooltip resolution
  const { data: vatCodes = [] } = useQuery({
    queryKey: ['vat_codes', selectedCompany?.id],
    queryFn: async () => {
      if (!selectedCompany?.id) return [];
      const { data, error } = await supabase
        .from('vat_codes')
        .select('*')
        .eq('company_id', selectedCompany.id)
        .order('sort_order');
      if (error) throw error;
      return (data || []) as unknown as VatCodeItem[];
    },
    enabled: open && !!selectedCompany?.id,
  });

  // Fetch learned VAT code rules for this company (few-shot ML learning)
  const { data: learnedVatRules = [] } = useQuery({
    queryKey: ['vat_code_overrides_log', selectedCompany?.id],
    queryFn: async () => {
      if (!selectedCompany?.id) return [];
      const { data, error } = await supabase
        .from('vat_code_overrides_log')
        .select('*')
        .eq('company_id', selectedCompany.id)
        .order('created_at', { ascending: false });
      if (error) {
        console.warn('Failed to load learned vat code overrides:', error);
        return [];
      }
      return (data || []) as unknown as VatCodeOverrideLogEntry[];
    },
    enabled: open && !!selectedCompany?.id,
  });

  // Selection state for activation
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [activationDialogOpen, setActivationDialogOpen] = useState(false);

  // VAT code editing state
  const [updatingVatCodeItemId, setUpdatingVatCodeItemId] = useState<string | null>(null);
  const [bulkVatDialogOpen, setBulkVatDialogOpen] = useState(false);
  const [bulkVatCodeId, setBulkVatCodeId] = useState<string>('');
  const [isSubmittingVatCode, setIsSubmittingVatCode] = useState(false);

  // GL editing state
  const [glEditItem, setGlEditItem] = useState<InvoiceLineItem | null>(null);
  const [isBulkGlEdit, setIsBulkGlEdit] = useState(false);
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

  // Fetch parent invoice project_id and other details for petty cash & learning context
  const { data: parentInvoice } = useQuery({
    queryKey: ['parentInvoice', source, invoiceId],
    queryFn: async () => {
      const table = source === 'submitted' ? 'invoices' : 'nav_invoices';
      const selectFields = source === 'submitted'
        ? 'project_id, invoice_direction, kibocsatas_datuma, penznem, bizonylatsorszam, elado_vat_id, elado_nev, vevo_vat_id, vevo_nev, forditott_adozas'
        : 'project_id, invoice_direction, invoice_issue_date, currency, vat_summary, is_reverse_charge, supplier_tax_number, supplier_name, customer_tax_number, customer_name';

      const { data, error } = await supabase
        .from(table as any)
        .select(selectFields)
        .eq('id', invoiceId)
        .single();
      if (error) throw error;

      let vatSummary = (data as any)?.vat_summary || null;
      let isRc = (data as any)?.is_reverse_charge || false;

      if (source === 'submitted') {
        if ((data as any)?.forditott_adozas != null) {
          isRc = Boolean((data as any).forditott_adozas);
        }
        if ((data as any)?.bizonylatsorszam) {
          const num = ((data as any).bizonylatsorszam as string).replace(/\s+/g, '');
          const { data: twinNav } = await (supabase
            .from('nav_invoices') as any)
            .select('vat_summary, is_reverse_charge')
            .ilike('invoice_number', `%${num}%`)
            .limit(1)
            .maybeSingle();
          if (twinNav) {
            vatSummary = (twinNav as any).vat_summary;
            if ((twinNav as any).is_reverse_charge != null) {
              isRc = (twinNav as any).is_reverse_charge;
            }
          }
        }
      }

      const isOutbound = ((data as any)?.invoice_direction || '').toUpperCase() === 'OUTBOUND';
      const partnerAdoszam = source === 'submitted'
        ? (isOutbound ? (data as any)?.vevo_vat_id : (data as any)?.elado_vat_id)
        : (isOutbound ? (data as any)?.customer_tax_number : (data as any)?.supplier_tax_number);
      const partnerNev = source === 'submitted'
        ? (isOutbound ? (data as any)?.vevo_nev : (data as any)?.elado_nev)
        : (isOutbound ? (data as any)?.customer_name : (data as any)?.supplier_name);

      return {
        ...(data as any),
        partner_adoszam: partnerAdoszam || null,
        partner_nev: partnerNev || null,
        supplier_tax_number: (data as any)?.supplier_tax_number || (data as any)?.elado_vat_id || null,
        supplier_name: (data as any)?.supplier_name || (data as any)?.elado_nev || null,
        customer_tax_number: (data as any)?.customer_tax_number || (data as any)?.vevo_vat_id || null,
        customer_name: (data as any)?.customer_name || (data as any)?.vevo_nev || null,
        vat_summary: vatSummary,
        is_reverse_charge: isRc,
      } as {
        project_id?: string | null;
        invoice_direction?: string;
        kibocsatas_datuma?: string;
        invoice_issue_date?: string;
        currency?: string;
        penznem?: string;
        vat_summary?: any;
        is_reverse_charge?: boolean;
        partner_adoszam?: string | null;
        partner_nev?: string | null;
        supplier_tax_number?: string | null;
        supplier_name?: string | null;
        customer_tax_number?: string | null;
        customer_name?: string | null;
      } | null;
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
        title: t('invoices:dialogs.items.toast_project_error'),
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
      title: t('invoices:dialogs.items.toast_project_updated'),
      description: t('invoices:dialogs.items.toast_project_updated_desc'),
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
          title: t('invoices:dialogs.items.toast_rule_error'),
          description: error.message,
          variant: 'destructive',
        });
      } else {
        toast({
          title: t('invoices:dialogs.items.toast_rule_saved'),
          description: t('invoices:dialogs.items.toast_rule_saved_desc', { name: projectName }),
        });
        queryClient.invalidateQueries({ queryKey: ['invoiceItems', source, invoiceId] });
      }
    } catch (e: any) {
      toast({
        title: t('invoices:dialogs.items.toast_rule_error'),
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
        title: t('invoices:dialogs.items.toast_note_error'),
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
      title: t('invoices:dialogs.items.toast_note_saved'),
      description: t('invoices:dialogs.items.toast_note_saved_desc'),
    });
  };

  // Fetch invoice items from DB
  const { data: items = [], isLoading: loading } = useQuery({
    queryKey: ['invoiceItems', source, invoiceId],
    queryFn: async () => {
      const baseCols = 'id, line_number, line_description, product_code, quantity, unit_of_measure, unit_price, net_amount, vat_rate, vat_amount, gross_amount, gl_classifications, project_id, notes, deductible_percentage, net_weight_kg, vat_code_id, vat_code, is_vat_code_manual';
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

  const isOutbound = invoiceDirection === 'OUTBOUND';

  // Check if any items belong to already posted/finalized journals ('KONYVELT')
  const itemIds = useMemo(() => items.map(it => it.id), [items]);
  const { data: postedItemIds = new Set<string>() } = useQuery({
    queryKey: ['postedJournalItems', selectedCompany?.id, itemIds],
    queryFn: async () => {
      if (!selectedCompany?.id || itemIds.length === 0) return new Set<string>();
      const { data } = await supabase
        .from('acc_journal_headers')
        .select('import_key')
        .eq('company_id', selectedCompany.id)
        .eq('status', 'KONYVELT')
        .in('import_key', itemIds);
      return new Set<string>((data || []).map(r => r.import_key).filter(Boolean) as string[]);
    },
    enabled: open && !!selectedCompany?.id && itemIds.length > 0,
  });

  // State & Handlers for Deductible Percentage
  const [updatingDeductibleId, setUpdatingDeductibleId] = useState<string | null>(null);
  const [isApplying7030, setIsApplying7030] = useState(false);

  // Find the "twin" line item in the opposite table (nav ↔ submitted)
  // so that GL / metadata changes on one side are automatically mirrored to the other.
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
          .eq('company_id', selectedCompany.id)
          .ilike('bizonylatsorszam', `%${normalizedNum}%`)
          .limit(10);

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
          .eq('company_id', selectedCompany.id)
          .ilike('invoice_number', `%${normalizedNum}%`)
          .limit(10);

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

  // Telecom invoice smart detection
  const isTelecomInvoice = useMemo(() => {
    const name = (supplierName || '').toLowerCase().trim();
    const hasTelecomName = 
      name.includes('telekom') || 
      name.includes('yettel') || 
      name.includes('vodafone') || 
      name.includes('one magyar') || 
      name.includes('one zrt') || 
      name.includes('one kft') || 
      name.includes('one telecom') || 
      name.startsWith('one ') || 
      name === 'one' || 
      name.includes('digi') || 
      name.includes('opennetworks') || 
      name.includes('invitel') || 
      name.includes('cetin') || 
      name.includes('upc') || 
      name.includes('t-mobile') || 
      name.includes('t-systems');
    const hasPhoneItems = items.some(it => {
      const desc = (it.line_description || '').toLowerCase();
      return desc.includes('mobil') || desc.includes('telefon') || desc.includes('hanghívás') || desc.includes('sms') || desc.includes('havidíj') || desc.includes('hívásdíj') || desc.includes('adatforgalom') || desc.includes('készülékrészlet');
    });
    return hasTelecomName || hasPhoneItems;
  }, [supplierName, items]);

  // Update a single item's deductible percentage
  const handleUpdateItemDeductible = useCallback(async (item: InvoiceLineItem, percentage: number) => {
    const table = source === 'submitted' ? 'invoice_items' : 'nav_invoice_items';
    setUpdatingDeductibleId(item.id);
    try {
      const { error } = await supabase
        .from(table as any)
        .update({ deductible_percentage: percentage })
        .eq('id', item.id);

      if (error) {
        toast({
          title: t('invoices:dialogs.items.toast_deductible_error'),
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
            .update({ deductible_percentage: percentage })
            .eq('id', twin.id);
        }
      } catch (e) {
        console.error('Failed to update twin item deductible:', e);
      }

      queryClient.invalidateQueries({ queryKey: ['invoiceItems', source, invoiceId] });
      queryClient.invalidateQueries({ queryKey: ['vat_return'] });
      queryClient.invalidateQueries({ queryKey: ['vat_return_lines'] });
      queryClient.invalidateQueries({ queryKey: ['nav_invoice_items_drill'] });
      queryClient.invalidateQueries({ queryKey: ['acc-journal-entries'] });
      queryClient.invalidateQueries({ queryKey: ['glBalances'] });
      queryClient.invalidateQueries({ queryKey: ['glItems'] });
      queryClient.invalidateQueries({ queryKey: ['glJournalEntries'] });
      queryClient.invalidateQueries({ queryKey: ['subledger-reconciliation'] });
      queryClient.invalidateQueries({ queryKey: ['page-invoice-deductibility-map'] });
      queryClient.invalidateQueries({ queryKey: ['expanded-row-deductibility'] });

      const isPosted = postedItemIds.has(item.id);
      if (isPosted) {
        toast({
          title: t('invoices:dialogs.items.toast_deductible_posted_warn'),
          description: t('invoices:dialogs.items.toast_deductible_posted_warn_desc', { percentage }),
        });
      } else {
        toast({
          title: t('invoices:dialogs.items.toast_deductible_success'),
          description: t('invoices:dialogs.items.toast_deductible_success_desc', { percentage }),
        });
      }
    } finally {
      setUpdatingDeductibleId(null);
    }
  }, [source, invoiceId, queryClient, toast, findTwinItems, postedItemIds, t]);

  // Update item VTSZ (product_code) and net weight in kg (6/B melléklet)
  const handleUpdateItemProductCodeAndWeight = useCallback(async (
    item: InvoiceLineItem,
    productCode: string | null,
    netWeightKg: number | null
  ) => {
    const table = source === 'submitted' ? 'invoice_items' : 'nav_invoice_items';
    try {
      const { error } = await supabase
        .from(table as any)
        .update({
          product_code: productCode || null,
          net_weight_kg: netWeightKg != null && !isNaN(netWeightKg) ? netWeightKg : null,
        })
        .eq('id', item.id);

      if (error) throw error;

      try {
        const twins = await findTwinItems(item);
        for (const twin of twins) {
          await supabase
            .from(twin.sourceTable as any)
            .update({
              product_code: productCode || null,
              net_weight_kg: netWeightKg != null && !isNaN(netWeightKg) ? netWeightKg : null,
            })
            .eq('id', twin.id);
        }
      } catch (e) {
        console.error('Failed to update twin item weight/vtsz:', e);
      }

      queryClient.invalidateQueries({ queryKey: ['invoiceItems', source, invoiceId] });
      queryClient.invalidateQueries({ queryKey: ['vat_return'] });
      queryClient.invalidateQueries({ queryKey: ['vat_return_lines'] });
      queryClient.invalidateQueries({ queryKey: ['vat_steel_items'] });
      queryClient.invalidateQueries({ queryKey: ['nav_invoice_items_drill'] });
      toast({
        title: 'VTSZ és súly mentve',
        description: 'A tétel VTSZ száma és nettó tömege sikeresen mentésre került.',
      });
    } catch (err: any) {
      toast({
        title: 'Mentési hiba',
        description: err.message,
        variant: 'destructive',
      });
    }
  }, [source, invoiceId, findTwinItems, queryClient, toast]);

  // Apply 70/30 telephone rule to 27% items
  const handleApply7030TelephoneRule = useCallback(async () => {
    const table = source === 'submitted' ? 'invoice_items' : 'nav_invoice_items';
    const targetItems = items.filter(it => is27PercentVatRate(it.vat_rate));
    if (targetItems.length === 0) {
      toast({
        title: t('invoices:dialogs.items.toast_7030_no_items'),
        description: t('invoices:dialogs.items.toast_7030_no_items_desc'),
      });
      return;
    }

    setIsApplying7030(true);
    try {
      const ids = targetItems.map(it => it.id);
      const { error } = await supabase
        .from(table as any)
        .update({ deductible_percentage: 70.00 })
        .in('id', ids);

      if (error) {
        toast({
          title: t('invoices:dialogs.items.toast_7030_error'),
          description: error.message,
          variant: 'destructive',
        });
        return;
      }

      // Sync twin items if any
      try {
        for (const it of targetItems) {
          const twins = await findTwinItems(it);
          for (const twin of twins) {
            await supabase
              .from(twin.sourceTable as any)
              .update({ deductible_percentage: 70.00 })
              .eq('id', twin.id);
          }
        }
      } catch (e) {
        console.error('Failed to update twin items 70/30 deductible:', e);
      }

      queryClient.invalidateQueries({ queryKey: ['invoiceItems', source, invoiceId] });
      queryClient.invalidateQueries({ queryKey: ['vat_return'] });
      queryClient.invalidateQueries({ queryKey: ['vat_return_lines'] });
      queryClient.invalidateQueries({ queryKey: ['nav_invoice_items_drill'] });
      queryClient.invalidateQueries({ queryKey: ['acc-journal-entries'] });
      queryClient.invalidateQueries({ queryKey: ['glBalances'] });
      queryClient.invalidateQueries({ queryKey: ['glItems'] });
      queryClient.invalidateQueries({ queryKey: ['glJournalEntries'] });
      queryClient.invalidateQueries({ queryKey: ['subledger-reconciliation'] });
      queryClient.invalidateQueries({ queryKey: ['page-invoice-deductibility-map'] });
      queryClient.invalidateQueries({ queryKey: ['expanded-row-deductibility'] });

      const hasPosted = targetItems.some(it => postedItemIds.has(it.id));
      if (hasPosted) {
        toast({
          title: t('invoices:dialogs.items.toast_7030_posted_warn'),
          description: t('invoices:dialogs.items.toast_7030_posted_warn_desc', { count: ids.length }),
        });
      } else {
        toast({
          title: t('invoices:dialogs.items.toast_7030_success'),
          description: t('invoices:dialogs.items.toast_7030_success_desc', { count: ids.length }),
        });
      }
    } finally {
      setIsApplying7030(false);
    }
  }, [items, source, invoiceId, queryClient, toast, postedItemIds, t, findTwinItems]);

  // Bulk update deductible percentage
  const handleBulkUpdateDeductible = useCallback(async (percentage: number) => {
    if (selectedIds.size === 0) return;
    const table = source === 'submitted' ? 'invoice_items' : 'nav_invoice_items';
    const ids = Array.from(selectedIds);
    const { error } = await supabase
      .from(table as any)
      .update({ deductible_percentage: percentage })
      .in('id', ids);

    if (error) {
      toast({
        title: t('invoices:dialogs.items.toast_bulk_deductible_error'),
        description: error.message,
        variant: 'destructive',
      });
      return;
    }

    setSelectedIds(new Set());
    queryClient.invalidateQueries({ queryKey: ['invoiceItems', source, invoiceId] });
    queryClient.invalidateQueries({ queryKey: ['vat_return'] });
    queryClient.invalidateQueries({ queryKey: ['vat_return_lines'] });
    queryClient.invalidateQueries({ queryKey: ['nav_invoice_items_drill'] });
    queryClient.invalidateQueries({ queryKey: ['acc-journal-entries'] });
    queryClient.invalidateQueries({ queryKey: ['glBalances'] });
    queryClient.invalidateQueries({ queryKey: ['glItems'] });
    queryClient.invalidateQueries({ queryKey: ['glJournalEntries'] });
    queryClient.invalidateQueries({ queryKey: ['subledger-reconciliation'] });
    queryClient.invalidateQueries({ queryKey: ['page-invoice-deductibility-map'] });
    queryClient.invalidateQueries({ queryKey: ['expanded-row-deductibility'] });

    const hasPosted = ids.some(id => postedItemIds.has(id));
    if (hasPosted) {
      toast({
        title: t('invoices:dialogs.items.toast_bulk_deductible_posted_warn'),
        description: t('invoices:dialogs.items.toast_bulk_deductible_posted_warn_desc', { count: ids.length }),
      });
    } else {
      toast({
        title: t('invoices:dialogs.items.toast_bulk_deductible_success'),
        description: t('invoices:dialogs.items.toast_bulk_deductible_success_desc', { count: ids.length, percentage }),
      });
    }
  }, [selectedIds, source, invoiceId, queryClient, toast, postedItemIds, t]);

  // Fetch GL accounts for the picker combobox (paginated)
  const { data: glAccounts = [] } = useQuery({
    queryKey: ['glAccounts', activePresetId],
    queryFn: async () => {
      if (!activePresetId) return [];
      return await fetchAllGlAccountsByPreset(activePresetId);
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
    setIsBulkGlEdit(false);
    setSelectedNewGL(classification?.gl_account_id || '');
    setGlSearchQuery('');
    setGlEditOpen(true);
  }, [activePresetId]);

  // Open GL edit dialog in bulk mode for all selected items
  const openBulkGlEdit = useCallback(() => {
    if (selectedIds.size === 0) return;
    setGlEditItem(null);
    setIsBulkGlEdit(true);
    setSelectedNewGL('');
    setGlSearchQuery('');
    setGlEditOpen(true);
  }, [selectedIds]);

  // Save GL override (+ sync twin item in the linked table)
  const handleSaveGlOverride = useCallback(async () => {
    if (!selectedNewGL || !selectedCompany?.id || !session?.user.id || !activePresetId) return;
    if (!isBulkGlEdit && !glEditItem) return;

    setIsGlSubmitting(true);

    const sourceTable = source === 'submitted' ? 'invoice_items' : 'nav_invoice_items';
    const newGlItem = selectedNewGL === 'UNCLASSIFIED' ? null : glAccounts.find(gl => gl.id === selectedNewGL);
    const newGlNumber = newGlItem?.gl_number || '';

    // Build payload: target item(s) + any twin items from the linked table
    const payloadItems: { item_id: string; source_table: string; original_gl_account_id: string | null }[] = [];

    if (isBulkGlEdit) {
      // Bulk mode: process all checked line items
      const selectedLineItems = items.filter(i => selectedIds.has(i.id));
      for (const item of selectedLineItems) {
        const classification = item.gl_classifications?.[activePresetId];
        const originalGlAccountId = classification?.gl_account_id || null;

        payloadItems.push({
          item_id: item.id,
          source_table: sourceTable,
          original_gl_account_id: originalGlAccountId,
        });

        const twins = await findTwinItems(item);
        for (const twin of twins) {
          payloadItems.push({
            item_id: twin.id,
            source_table: twin.sourceTable,
            original_gl_account_id: twin.originalGlAccountId,
          });
        }
      }
    } else if (glEditItem) {
      // Single item mode
      const classification = glEditItem.gl_classifications?.[activePresetId];
      const originalGlAccountId = classification?.gl_account_id || null;

      payloadItems.push({
        item_id: glEditItem.id,
        source_table: sourceTable,
        original_gl_account_id: originalGlAccountId,
      });

      const twins = await findTwinItems(glEditItem);
      for (const twin of twins) {
        payloadItems.push({
          item_id: twin.id,
          source_table: twin.sourceTable,
          original_gl_account_id: twin.originalGlAccountId,
        });
      }
    }

    if (payloadItems.length === 0) {
      setIsGlSubmitting(false);
      return;
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
      toast({ title: t('invoices:dialogs.items.toast_gl_error'), description: error?.message || '', variant: 'destructive' });
    } else {
      const count = isBulkGlEdit ? selectedIds.size : 1;
      toast({ title: t('invoices:dialogs.items.toast_bulk_gl_success'), description: t('invoices:dialogs.items.toast_bulk_gl_success_desc', { count }) });
      setGlEditOpen(false);
      setGlEditItem(null);
      setIsBulkGlEdit(false);
      if (isBulkGlEdit) {
        setSelectedIds(new Set());
      }
      // Invalidate all relevant caches so every view refreshes
      queryClient.invalidateQueries({ queryKey: ['invoiceItems'] });
      queryClient.invalidateQueries({ queryKey: ['glBalances'] });
      queryClient.invalidateQueries({ queryKey: ['glItems'] });
      queryClient.invalidateQueries({ queryKey: ['filteredNavInvoices'] });
      queryClient.invalidateQueries({ queryKey: ['filteredSubmittedInvoices'] });
    }
  }, [glEditItem, isBulkGlEdit, selectedIds, items, selectedNewGL, selectedCompany?.id, session?.user.id, activePresetId, source, glAccounts, queryClient, toast, findTwinItems]);

  // Single or Bulk VAT Code Override Handler with Few-Shot ML Learning
  const handleSaveVatCodeOverride = useCallback(async (targetItems: InvoiceLineItem[], newVatCodeId: string | null) => {
    if (!selectedCompany?.id || !session?.user.id) return;
    if (targetItems.length === 0 || isSubmittingVatCode) return;

    setIsSubmittingVatCode(true);

    const sourceTable = source === 'submitted' ? 'invoice_items' : 'nav_invoice_items';
    const direction = isOutbound ? 'OUTBOUND' : 'INBOUND';
    const partnerTax = isOutbound
      ? (parentInvoice?.customer_tax_number || (parentInvoice as any)?.partner_adoszam || '')
      : (parentInvoice?.supplier_tax_number || (parentInvoice as any)?.partner_adoszam || '');
    const partnerName = isOutbound
      ? (parentInvoice?.customer_name || (parentInvoice as any)?.partner_nev || supplierName || '')
      : (parentInvoice?.supplier_name || (parentInvoice as any)?.partner_nev || supplierName || '');

    const payloadItems: any[] = [];

    for (const item of targetItems) {
      payloadItems.push({
        item_id: item.id,
        source_table: sourceTable,
        partner_tax_number: partnerTax,
        partner_name: partnerName,
        item_description: item.line_description || '',
        original_vat_rate: item.vat_rate || '',
        original_vat_code: item.vat_code || '',
        direction,
      });

      // Synchronize twin items in the other table
      const twins = await findTwinItems(item);
      for (const twin of twins) {
        payloadItems.push({
          item_id: twin.id,
          source_table: twin.sourceTable,
          partner_tax_number: partnerTax,
          partner_name: partnerName,
          item_description: item.line_description || '',
          original_vat_rate: item.vat_rate || '',
          original_vat_code: item.vat_code || '',
          direction,
        });
      }
    }

    const { error } = await supabase.rpc('override_vat_code_batch', {
      p_items: payloadItems,
      p_new_vat_code_id: newVatCodeId,
      p_company_id: selectedCompany.id,
      p_user_id: session.user.id,
    });

    setIsSubmittingVatCode(false);
    setUpdatingVatCodeItemId(null);
    setBulkVatDialogOpen(false);

    if (error) {
      toast({
        title: 'Áfakód módosítási hiba',
        description: error.message,
        variant: 'destructive',
      });
    } else {
      const selectedCodeObj = vatCodes.find(c => c.id === newVatCodeId);
      const codeName = selectedCodeObj?.legacy_code || selectedCodeObj?.code || 'alapértelmezett';
      toast({
        title: 'Áfakód sikeresen elmentve',
        description: targetItems.length > 1
          ? `${targetItems.length} tétel áfakódja frissítve (${codeName}). A rendszer megjegyezte a szabályt a jövőbeli tételekhez.`
          : `Tétel áfakódja frissítve (${codeName}). A rendszer megtanulta a hozzárendelést.`,
      });

      queryClient.invalidateQueries({ queryKey: ['invoiceItems'] });
      queryClient.invalidateQueries({ queryKey: ['vat_code_overrides_log'] });
      queryClient.invalidateQueries({ queryKey: ['vat_codes'] });
      queryClient.invalidateQueries({ queryKey: ['vatCollectorItems'] });
      queryClient.invalidateQueries({ queryKey: ['filteredNavInvoices'] });
      queryClient.invalidateQueries({ queryKey: ['filteredSubmittedInvoices'] });
    }
  }, [selectedCompany?.id, session?.user.id, isSubmittingVatCode, source, isOutbound, parentInvoice, supplierName, vatCodes, findTwinItems, queryClient, toast]);

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

      if (sortField === 'deductible_percentage') {
        aVal = a.deductible_percentage ?? 100;
        bVal = b.deductible_percentage ?? 100;
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
        title: t('invoices:dialogs.items.toast_exclude_error'),
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
            title: t('invoices:dialogs.items.toast_petty_cash_deleted'),
            description: t('invoices:dialogs.items.toast_petty_cash_deleted_desc'),
          });
        }
      } catch (err) {
        console.error('Failed to delete linked petty cash entry:', err);
      }
    }
  }, [source, invoiceId, queryClient, selectedCompany, toast, t]);

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
        title: t('invoices:dialogs.items.toast_petty_cash_success'),
        description: t('invoices:dialogs.items.toast_petty_cash_success_desc', { name: pettyCashRegisters.find(r => r.id === selectedRegisterId)?.name || '' }),
      });
    } catch (err: any) {
      toast({
        title: t('invoices:dialogs.items.toast_petty_cash_error'),
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
        title: t('invoices:dialogs.items.toast_bulk_exclude_error'),
        description: error.message,
        variant: 'destructive',
      });
    } else {
      toast({
        title: t('invoices:dialogs.items.toast_bulk_exclude_success'),
        description: exclude
          ? t('invoices:dialogs.items.toast_bulk_excluded_desc', { count: selectedIds.size })
          : t('invoices:dialogs.items.toast_bulk_included_desc', { count: selectedIds.size }),
      });
      setSelectedIds(new Set());
      queryClient.invalidateQueries({ queryKey: ['invoiceItems', source, invoiceId] });
    }
  }, [selectedIds, source, invoiceId, queryClient, toast, t]);

  const formatAmount = (amount: number | null) => {
    if (amount === null || amount === undefined) return '-';
    return formatCurrency(amount, currency);
  };

  const formatQuantity = (qty: number | null, unit: string | null) => {
    if (qty === null || qty === undefined) return '-';
    const formatted = qty.toLocaleString('hu-HU', { maximumFractionDigits: 2 });
    return unit ? `${formatted} ${unit}` : formatted;
  };

  const getVatAmount = (item: InvoiceLineItem): number | null => {
    if (item.vat_amount !== null && item.vat_amount !== undefined && item.vat_amount !== 0) {
      return item.vat_amount;
    }
    // Fallback if missing or 0 but net_amount > 0 and numeric vat_rate > 0 (e.g. NAV utility invoices like MVM)
    if ((item.vat_amount === null || item.vat_amount === 0 || item.vat_amount === undefined) &&
        (item.gross_amount === null || item.gross_amount === 0 || item.gross_amount === undefined) &&
        item.net_amount && item.net_amount > 0 && item.vat_rate) {
      const num = parseFloat(item.vat_rate);
      if (!isNaN(num) && num > 0) {
        const rate = num >= 1 ? num / 100 : num;
        return Math.round(item.net_amount * rate);
      }
    }
    return item.vat_amount ?? null;
  };

  const getGrossAmount = (item: InvoiceLineItem): number | null => {
    if (item.gross_amount !== null && item.gross_amount !== undefined && item.gross_amount !== 0) {
      return item.gross_amount;
    }
    const computedVat = getVatAmount(item);
    if (item.net_amount !== null && computedVat !== null) {
      return item.net_amount + computedVat;
    }
    if (item.gross_amount !== null && item.gross_amount !== undefined) {
      return item.gross_amount;
    }
    if (item.net_amount !== null) return item.net_amount;
    return null;
  };

  const totals = useMemo(() => {
    let net = 0;
    let vat = 0;
    let gross = 0;
    let deductibleVat = 0;
    let nonDeductibleVat = 0;
    let hasNonDeductible = false;

    for (const item of items) {
      const itemNet = item.net_amount || 0;
      const itemVat = getVatAmount(item) || 0;
      const itemGross = getGrossAmount(item) || 0;
      net += itemNet;
      vat += itemVat;
      gross += itemGross;

      const pct = item.deductible_percentage != null ? Number(item.deductible_percentage) : 100;
      if (pct < 100) {
        hasNonDeductible = true;
      }
      const itemDeductible = Math.round(itemVat * (pct / 100));
      deductibleVat += itemDeductible;
      nonDeductibleVat += (itemVat - itemDeductible);
    }

    return {
      net,
      vat,
      gross,
      deductibleVat,
      nonDeductibleVat,
      hasNonDeductible: hasNonDeductible && nonDeductibleVat > 0,
    };
  }, [items]);

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
        <TooltipProvider delayDuration={150}>
          <DialogContent className="max-w-7xl max-h-[85vh] overflow-hidden flex flex-col">
            <DialogHeader className="pb-4 border-b border-border/50">
              <DialogTitle className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Package className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <span className="text-muted-foreground text-sm font-normal">{t('invoices:dialogs.items.title')}</span>
                  <p className="font-mono text-xl font-bold tracking-tight">{invoiceNumber}</p>
                </div>
              </DialogTitle>
            </DialogHeader>

            <div className="flex-1 overflow-auto mt-4">
              {!isOutbound && isTelecomInvoice && items.length > 0 && (
                <div className="flex items-center justify-between bg-amber-500/10 border border-amber-500/25 rounded-lg px-4 py-2.5 mb-3 text-xs">
                  <div className="flex items-center gap-2 text-amber-800 dark:text-amber-200">
                    <Sparkles className="h-4 w-4 text-amber-500 shrink-0" />
                    <span>
                      <strong>{t('invoices:dialogs.items.telecom_banner_title')}</strong> {t('invoices:dialogs.items.telecom_banner_desc')}
                    </span>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={handleApply7030TelephoneRule}
                    disabled={isApplying7030}
                    className="h-7 text-xs bg-amber-500/20 hover:bg-amber-500/30 text-amber-900 dark:text-amber-100 border-amber-500/40 shrink-0 ml-3 font-medium cursor-pointer"
                  >
                    {isApplying7030 ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : <Sparkles className="w-3.5 h-3.5 text-amber-500 mr-1.5" />}
                    {t('invoices:dialogs.items.apply_70_30_btn')}
                  </Button>
                </div>
              )}

              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <LoadingSpinner />
                </div>
              ) : items.length === 0 && open ? (
                <div className="text-center py-12 text-muted-foreground">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted/50 flex items-center justify-center">
                    <Package className="h-8 w-8 opacity-50" />
                  </div>
                  <p className="font-medium">{t('invoices:dialogs.items.no_items')}</p>
                  <p className="text-sm mt-1 opacity-75">
                    {t('invoices:dialogs.items.no_items_desc')}
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
                            aria-label={t('invoices:dialogs.items.select_all')}
                          />
                        </TableHead>
                        {renderSortableHeader('line_number', t('invoices:dialogs.items.table.line_number'), 'left', 'w-16')}
                        {renderSortableHeader('line_description', t('invoices:dialogs.items.table.description'), 'left')}
                        {renderSortableHeader('quantity', t('invoices:dialogs.items.table.quantity'), 'right', 'text-right')}
                        {renderSortableHeader('unit_price', t('invoices:dialogs.items.table.unit_price'), 'right', 'text-right')}
                        {renderSortableHeader('net_amount', t('invoices:dialogs.items.table.net'), 'right', 'text-right')}
                        {renderSortableHeader('vat_rate', t('invoices:dialogs.items.table.vat'), 'center', 'text-center w-[90px]')}
                        {renderSortableHeader('vat_amount', t('invoices:dialogs.items.table.vat_amount'), 'right', 'text-right')}
                        {!isOutbound && renderSortableHeader('deductible_percentage', t('invoices:dialogs.items.table.deductibility'), 'center', 'text-center w-[140px]')}
                        {renderSortableHeader('gross_amount', t('invoices:dialogs.items.table.gross'), 'right', 'text-right')}
                        {renderSortableHeader('gl_classifications', t('invoices:dialogs.items.table.gl'), 'center', 'text-center')}
                        <TableHead className="font-semibold w-[200px]">{t('invoices:dialogs.items.table.project')}</TableHead>
                        <TableHead className="font-semibold text-center w-12">{t('invoices:dialogs.items.table.note')}</TableHead>
                        <TableHead className="text-center font-semibold w-[75px]">
                          <div className="flex items-center justify-center gap-1">
                            {t('invoices:dialogs.items.table.accounting')}
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Info className="h-3 w-3 text-muted-foreground/60 cursor-help" />
                              </TooltipTrigger>
                              <TooltipContent side="top" align="end" sideOffset={8} className="max-w-[240px] z-[100]">
                                <p className="text-xs font-normal normal-case tracking-normal leading-relaxed">{t('invoices:dialogs.items.table.accounting_tooltip')}</p>
                              </TooltipContent>
                            </Tooltip>
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
                                <p>{t('invoices:dialogs.items.already_activated')}</p>
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
                              <div className="flex items-center gap-2 mt-1">
                                <ItemVtszWeightPopover
                                  item={item}
                                  onSave={handleUpdateItemProductCodeAndWeight}
                                />
                              </div>
                            </div>
                            {alreadyActivated && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-success/10 text-success whitespace-nowrap">
                                <CheckCircle2 className="h-3 w-3" />
                                {t('invoices:dialogs.items.already_activated')}
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
                          {(() => {
                            const direction = isOutbound ? 'OUTBOUND' : 'INBOUND';
                            const isReverseCharge = parentInvoice?.is_reverse_charge ?? false;
                            const partnerTax = isOutbound
                              ? (parentInvoice?.customer_tax_number || (parentInvoice as any)?.partner_adoszam || '')
                              : (parentInvoice?.supplier_tax_number || (parentInvoice as any)?.partner_adoszam || '');
                            const partnerName = isOutbound
                              ? (parentInvoice?.customer_name || (parentInvoice as any)?.partner_nev || supplierName || '')
                              : (parentInvoice?.supplier_name || (parentInvoice as any)?.partner_nev || supplierName || '');

                            const resolved = resolveVatCodeWithLearning({
                              itemVatCodeId: item.vat_code_id,
                              itemVatCode: item.vat_code,
                              isItemManual: item.is_vat_code_manual,
                              vatRate: item.vat_rate,
                              direction,
                              lineDescription: item.line_description,
                              partnerTaxNumber: partnerTax,
                              partnerName,
                              vatCodes,
                              learnedRules: learnedVatRules as any,
                              isReverseCharge,
                            });

                            const displayMode = effectiveSettings?.vat_code_display_mode || 'legacy';
                            const badgeData = getVatCodeBadgeData(
                              resolved.matchedCode,
                              displayMode,
                              item.vat_rate,
                              resolved.source,
                              resolved.ruleExplanation
                            );

                            const relevantVatCodes = vatCodes.filter(c => c.direction === direction);

                            return (
                              <DropdownMenu>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <DropdownMenuTrigger asChild>
                                      <button
                                        type="button"
                                        disabled={updatingVatCodeItemId === item.id}
                                        className={cn(
                                          "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border shadow-xs transition-all cursor-pointer group",
                                          badgeData.isManual
                                            ? "bg-primary/15 text-primary border-primary/30 hover:bg-primary/25"
                                            : badgeData.isLearned
                                            ? "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30 hover:bg-amber-500/25"
                                            : "bg-primary/10 text-primary border-primary/20 hover:bg-primary/20"
                                        )}
                                      >
                                        {updatingVatCodeItemId === item.id ? (
                                          <Loader2 className="w-3 h-3 animate-spin" />
                                        ) : badgeData.isLearned ? (
                                          <Sparkles className="w-3 h-3 text-amber-600 dark:text-amber-400 shrink-0" />
                                        ) : badgeData.isManual ? (
                                          <Pencil className="w-2.5 h-2.5 text-primary shrink-0 opacity-70 group-hover:opacity-100" />
                                        ) : null}
                                        <span className="font-mono font-bold">{badgeData.displayCode}</span>
                                        <span className="text-[11px] opacity-80">({badgeData.rateLabel})</span>
                                      </button>
                                    </DropdownMenuTrigger>
                                  </TooltipTrigger>
                                  <TooltipContent side="top" className="text-xs z-[120] max-w-xs text-center whitespace-pre-line">
                                    {badgeData.tooltipText}
                                  </TooltipContent>
                                </Tooltip>

                                <DropdownMenuContent align="center" className="w-72 max-h-72 overflow-y-auto z-[120]">
                                  <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground border-b mb-1">
                                    Áfakód választás ({direction === 'OUTBOUND' ? 'Kimenő' : 'Bejövő'})
                                  </div>
                                  {relevantVatCodes.map(vc => {
                                    const isSelected = item.vat_code_id === vc.id || (!item.vat_code_id && resolved.matchedCode.code === vc.code);
                                    return (
                                      <DropdownMenuItem
                                        key={vc.id || vc.code}
                                        onClick={() => {
                                          setUpdatingVatCodeItemId(item.id);
                                          handleSaveVatCodeOverride([item], vc.id || null);
                                        }}
                                        className={cn(
                                          "flex items-center justify-between text-xs cursor-pointer py-1.5",
                                          isSelected && "bg-primary/10 font-medium"
                                        )}
                                      >
                                        <div className="flex flex-col truncate pr-2">
                                          <div className="flex items-center gap-1.5 font-mono">
                                            <span className="font-bold">{displayMode === 'nav' ? vc.code : (vc.legacy_code || vc.code)}</span>
                                            <span className="text-[11px] text-muted-foreground">({vc.vat_percent}%)</span>
                                          </div>
                                          <span className="text-[11px] text-muted-foreground truncate">{vc.label}</span>
                                        </div>
                                        {isSelected && <Check className="w-3.5 h-3.5 text-primary shrink-0" />}
                                      </DropdownMenuItem>
                                    );
                                  })}
                                  {item.vat_code_id && (
                                    <DropdownMenuItem
                                      onClick={() => {
                                        setUpdatingVatCodeItemId(item.id);
                                        handleSaveVatCodeOverride([item], null);
                                      }}
                                      className="text-xs text-destructive focus:text-destructive border-t mt-1 cursor-pointer"
                                    >
                                      Visszaállítás törvényi alapértelmezettre
                                    </DropdownMenuItem>
                                  )}
                                </DropdownMenuContent>
                              </DropdownMenu>
                            );
                          })()}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {formatAmount(getVatAmount(item))}
                        </TableCell>
                        {!isOutbound && (
                          <TableCell className="text-center">
                            <div className="inline-flex items-center justify-center gap-1.5">
                              <Tooltip>
                                <DropdownMenu>
                                  <TooltipTrigger asChild>
                                    <DropdownMenuTrigger asChild>
                                      <button
                                        type="button"
                                        disabled={updatingDeductibleId === item.id}
                                        className={cn(
                                          "inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition-all cursor-pointer border shadow-sm",
                                          (item.deductible_percentage === 70)
                                            ? "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30 hover:bg-amber-500/25"
                                            : (item.deductible_percentage === 0)
                                            ? "bg-destructive/15 text-destructive border-destructive/30 hover:bg-destructive/25"
                                            : (item.deductible_percentage != null && item.deductible_percentage < 100)
                                            ? "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30 hover:bg-blue-500/25"
                                            : "bg-muted text-muted-foreground border-border/40 hover:bg-muted/80"
                                        )}
                                      >
                                        {updatingDeductibleId === item.id ? (
                                          <Loader2 className="h-3 w-3 animate-spin" />
                                        ) : (
                                          <>
                                            <span>{item.deductible_percentage != null ? `${item.deductible_percentage}%` : '100%'}</span>
                                            {item.deductible_percentage === 70 && <span className="text-[10px] opacity-75 font-normal">(70/30)</span>}
                                            <ChevronDown className="h-3 w-3 opacity-60 ml-0.5" />
                                          </>
                                        )}
                                      </button>
                                    </DropdownMenuTrigger>
                                  </TooltipTrigger>
                                  <TooltipContent side="top" className="text-xs z-[120]">
                                    {t('invoices:dialogs.items.change_deductible_tooltip')}
                                  </TooltipContent>
                                  <DropdownMenuContent align="center" className="w-56 z-[110]">
                                    <DropdownMenuItem onClick={() => handleUpdateItemDeductible(item, 100)} className="cursor-pointer">
                                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 mr-2" />
                                      <span className="font-medium">{t('invoices:dialogs.items.deductible_100')}</span>
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => handleUpdateItemDeductible(item, 70)} className="cursor-pointer">
                                      <Sparkles className="h-3.5 w-3.5 text-amber-500 mr-2" />
                                      <span className="font-medium text-amber-600 dark:text-amber-400">{t('invoices:dialogs.items.deductible_70')}</span>
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => handleUpdateItemDeductible(item, 50)} className="cursor-pointer">
                                      <Info className="h-3.5 w-3.5 text-blue-500 mr-2" />
                                      <span>{t('invoices:dialogs.items.deductible_50')}</span>
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => handleUpdateItemDeductible(item, 0)} className="cursor-pointer">
                                      <X className="h-3.5 w-3.5 text-red-500 mr-2" />
                                      <span className="text-destructive font-medium">{t('invoices:dialogs.items.deductible_0')}</span>
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </Tooltip>
                              {postedItemIds.has(item.id) && (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span className="inline-flex items-center text-amber-500 hover:text-amber-600 cursor-help p-0.5">
                                      <Lock className="h-3.5 w-3.5" />
                                    </span>
                                  </TooltipTrigger>
                                  <TooltipContent side="top" className="text-xs max-w-[240px] z-[130]">
                                    {t('invoices:dialogs.items.locked_item_tooltip')}
                                  </TooltipContent>
                                </Tooltip>
                              )}
                            </div>
                          </TableCell>
                        )}
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
                            
                            return (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <button
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); openGlEdit(item); }}
                                    className={cn(
                                      "group/gl inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium transition-colors cursor-pointer",
                                      classification?.gl_number
                                        ? "bg-primary/10 text-primary hover:bg-primary/20"
                                        : "bg-muted text-muted-foreground hover:bg-muted/80"
                                    )}
                                  >
                                    {classification?.gl_number || '-'}
                                    <Pencil className="h-3 w-3 opacity-0 group-hover/gl:opacity-70 transition-opacity" />
                                  </button>
                                </TooltipTrigger>
                                <TooltipContent side="top" className="text-xs z-[120]">
                                  {classification?.gl_number ? t('invoices:dialogs.items.click_to_modify_gl') : t('invoices:dialogs.items.click_to_classify_gl')}
                                </TooltipContent>
                              </Tooltip>
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
                                    <span>{t('invoices:dialogs.items.inherited_project', { name: projectList.find(p => p.id === parentInvoice.project_id)?.name || t('invoices:dialogs.items.table.project') })}</span>
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
                                <ItemProjectRuleButton
                                  item={item}
                                  classificationGlNumber={classification.gl_number}
                                  projectName={projName}
                                  onSaveRule={handleSaveProjectRule}
                                />
                              );
                            })()}
                          </div>
                        </TableCell>
                        <ItemNoteCell
                          item={item}
                          onSaveNotes={handleUpdateItemNotes}
                        />
                        <TableCell className="text-center">
                          {item.exclude_from_accounting !== undefined ? (
                            <Checkbox
                              checked={!item.exclude_from_accounting}
                              onCheckedChange={() => handleToggleItemExclude(item)}
                              onClick={(e) => e.stopPropagation()}
                              aria-label={item.exclude_from_accounting ? t('invoices:dialogs.items.include_in_accounting') : t('invoices:dialogs.items.exclude_from_accounting')}
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

            {/* Official NAV VAT Summary at bottom of items table, collapsed by default */}
            {parentInvoice?.vat_summary && (
              <div className="mt-4">
                <NavInvoiceVatSummaryCard
                  vatSummary={parentInvoice.vat_summary}
                  currency={currency || parentInvoice.currency || parentInvoice.penznem || 'HUF'}
                  isReverseCharge={parentInvoice.is_reverse_charge}
                  defaultExpanded={false}
                  className="mb-0"
                />
              </div>
            )}
          </div>

          {items.length > 0 && (
            <div className="border-t border-border/50 pt-5 mt-4">
              <div className="flex justify-between items-end">
                {/* Activation & Bulk actions button — always rendered to prevent layout shift */}
                <div className="flex items-center gap-2">
                  <Button
                    className={cn("gap-2", !someSelected && "invisible pointer-events-none")}
                    onClick={() => setActivationDialogOpen(true)}
                  >
                    <Package2 className="h-4 w-4" />
                    {t('invoices:dialogs.items.action_activate', { count: selectedIds.size || 0 })}
                  </Button>
                  <Button
                    variant="outline"
                    className={cn("gap-2", !someSelected && "invisible pointer-events-none")}
                    onClick={openBulkGlEdit}
                  >
                    <Pencil className="h-4 w-4 text-primary" />
                    {t('invoices:dialogs.items.action_change_gl', { count: selectedIds.size || 0 })}
                  </Button>
                  <Button
                    variant="outline"
                    className={cn("gap-2", !someSelected && "invisible pointer-events-none")}
                    onClick={() => {
                      setBulkVatCodeId('');
                      setBulkVatDialogOpen(true);
                    }}
                  >
                    <Sparkles className="h-4 w-4 text-amber-500" />
                    Áfakód módosítása ({selectedIds.size || 0})
                  </Button>
                  {!isOutbound && (
                    <div className={cn(!someSelected && "invisible pointer-events-none")}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="outline" className="gap-2">
                            <Sparkles className="h-4 w-4 text-amber-500" />
                            {t('invoices:dialogs.items.action_deductibility', { count: selectedIds.size || 0 })}
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="w-56">
                          <DropdownMenuItem onClick={() => handleBulkUpdateDeductible(100)} className="cursor-pointer">
                            <CheckCircle2 className="h-4 w-4 text-emerald-500 mr-2" />
                            {t('invoices:dialogs.items.deductible_100')}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleBulkUpdateDeductible(70)} className="cursor-pointer">
                            <Sparkles className="h-4 w-4 text-amber-500 mr-2" />
                            {t('invoices:dialogs.items.deductible_70_long')}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleBulkUpdateDeductible(50)} className="cursor-pointer">
                            <Info className="h-4 w-4 text-blue-500 mr-2" />
                            {t('invoices:dialogs.items.deductible_50')}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleBulkUpdateDeductible(0)} className="cursor-pointer">
                            <X className="h-4 w-4 text-red-500 mr-2" />
                            {t('invoices:dialogs.items.deductible_0')}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  )}
                  <div className={cn(!someSelected && "invisible pointer-events-none")}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" className="gap-2">
                          <FileSpreadsheet className="h-4 w-4" />
                          {t('invoices:dialogs.items.action_accounting_toggle', { count: selectedIds.size || 0 })}
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start">
                        <DropdownMenuItem onClick={() => handleBulkToggleExclude(false)} className="cursor-pointer">
                          <CheckCircle2 className="h-4 w-4 text-green-500 mr-2" />
                          {t('invoices:dialogs.items.include_in_accounting')}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleBulkToggleExclude(true)} className="cursor-pointer">
                          <X className="h-4 w-4 text-red-500 mr-2" />
                          {t('invoices:dialogs.items.exclude_from_accounting')}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>

                {/* Totals */}
                <div className="bg-muted/30 rounded-lg p-4 min-w-[320px]">
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">{t('invoices:dialogs.items.totals_net')}</span>
                      <span className="font-mono font-medium">{formatAmount(totals.net)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">{t('invoices:dialogs.items.totals_vat')}</span>
                      <span className="font-mono font-medium">{formatAmount(totals.vat)}</span>
                    </div>
                    {totals.hasNonDeductible && !isOutbound && (
                      <div className="pl-3 py-1.5 my-1.5 border-l-2 border-amber-500/60 bg-amber-500/5 rounded-r space-y-1">
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1.5">
                            <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                            Levonható ÁFA:
                          </span>
                          <span className="font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                            {formatAmount(totals.deductibleVat)}
                          </span>
                        </div>
                        <div className="flex justify-between items-center text-xs">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="text-amber-600 dark:text-amber-400 font-medium flex items-center gap-1.5 cursor-help">
                                <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                                Nem levonható ÁFA:
                              </span>
                            </TooltipTrigger>
                            <TooltipContent side="left" className="text-xs max-w-xs">
                              Áfa tv. szerinti levonási tiltás / hányad (pl. 70/30 telefon, szgk., reprezentáció)
                            </TooltipContent>
                          </Tooltip>
                          <span className="font-mono font-semibold text-amber-600 dark:text-amber-400">
                            {formatAmount(totals.nonDeductibleVat)}
                          </span>
                        </div>
                      </div>
                    )}
                    <div className="h-px bg-border/50 my-3" />
                    <div className="flex justify-between items-center">
                      <span className="text-foreground font-medium">{t('invoices:dialogs.items.totals_gross')}</span>
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
        </TooltipProvider>
      </Dialog>

      {/* GL Edit Dialog */}
      <Dialog open={glEditOpen} onOpenChange={(open) => { setGlEditOpen(open); if (!open) { setGlEditItem(null); setIsBulkGlEdit(false); setGlSearchQuery(''); } }}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>
              {isBulkGlEdit ? t('invoices:dialogs.items.gl_dialog_title_bulk', { count: selectedIds.size }) : t('invoices:dialogs.items.gl_dialog_title_single')}
            </DialogTitle>
            <DialogDescription>
              {isBulkGlEdit
                ? t('invoices:dialogs.items.gl_dialog_desc_bulk', { count: selectedIds.size })
                : t('invoices:dialogs.items.gl_dialog_desc_single', { name: glEditItem?.line_description || t('invoices:columns.item', 'Számlatétel') })
              }
            </DialogDescription>
          </DialogHeader>
          <div className="py-2 flex flex-col gap-4 w-full overflow-hidden">
            <div className="bg-muted p-3 rounded-md border text-sm flex items-center justify-between w-full overflow-hidden gap-2">
              <span className="font-medium text-muted-foreground whitespace-nowrap">{t('invoices:dialogs.items.gl_new_category')}</span>
              <span className="font-bold text-foreground bg-background px-3 py-1.5 rounded border border-border shadow-sm truncate max-w-full">
                {selectedNewGL === 'UNCLASSIFIED' ? <span className="text-muted-foreground italic">{t('invoices:dialogs.items.gl_unclassified_item')}</span> :
                  (selectedNewGL && glAccounts.length > 0
                  ? (() => {
                      const gl = glAccounts.find(g => g.id === selectedNewGL);
                      return gl ? `${gl.gl_number} ${gl.short_name}` : t('invoices:dialogs.items.gl_select_placeholder');
                    })()
                  : t('invoices:dialogs.items.gl_select_placeholder'))}
              </span>
            </div>

            <Command className="rounded-lg border shadow-sm w-full overflow-hidden h-[350px]" shouldFilter={false}>
              <CommandInput 
                placeholder={t('invoices:dialogs.items.gl_search_placeholder')} 
                value={glSearchQuery}
                onValueChange={setGlSearchQuery}
                className="w-full"
              />
              <CommandList className="h-[300px] max-h-[300px] overflow-y-auto w-full overflow-x-hidden">
                <CommandEmpty>{t('invoices:dialogs.items.gl_no_results')}</CommandEmpty>
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
                      {t('invoices:dialogs.items.gl_unclassified_option')}
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
            <Button variant="outline" onClick={() => setGlEditOpen(false)} disabled={isGlSubmitting}>{t('common:actions.cancel')}</Button>
            <Button onClick={handleSaveGlOverride} disabled={!selectedNewGL || isGlSubmitting || (!isBulkGlEdit && glEditItem && selectedNewGL === (glEditItem.gl_classifications?.[activePresetId || '']?.gl_account_id || 'UNCLASSIFIED'))}>
              {isGlSubmitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              {t('common:actions.save')}
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
              {t('invoices:dialogs.items.petty_cash_dialog_title')}
            </DialogTitle>
            <DialogDescription className="text-sm">
              {t('invoices:dialogs.items.petty_cash_dialog_desc', { name: pendingOmitItem?.line_description || '' })}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-3">
            <p className="text-sm text-muted-foreground leading-relaxed">
              {t('invoices:dialogs.items.petty_cash_dialog_question', { amount: pendingOmitItem ? formatAmount(getGrossAmount(pendingOmitItem)) : '' })}
            </p>

            {pettyCashRegisters.length > 1 && (
              <div className="space-y-2 bg-muted/30 p-3 rounded-lg border border-border/50">
                <Label htmlFor="petty-cash-select" className="text-xs font-bold text-muted-foreground uppercase tracking-wider block mb-1">
                  {t('invoices:dialogs.items.petty_cash_select_label')}
                </Label>
                <Select
                  value={selectedRegisterId}
                  onValueChange={setSelectedRegisterId}
                >
                  <SelectTrigger id="petty-cash-select" className="w-full bg-background border-border/80 h-10">
                    <SelectValue placeholder={t('invoices:dialogs.items.petty_cash_select_placeholder')} />
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
              {t('invoices:dialogs.items.petty_cash_btn_no')}
            </Button>
            <Button
              onClick={handleConfirmPettyCashWriteOff}
              disabled={!selectedRegisterId}
            >
              {t('invoices:dialogs.items.petty_cash_btn_yes')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk VAT Code Assignment Dialog */}
      <Dialog open={bulkVatDialogOpen} onOpenChange={setBulkVatDialogOpen}>
        <DialogContent className="w-[calc(100vw-2rem)] sm:max-w-md p-6">
          <DialogHeader>
            <DialogTitle>Tömeges Áfakód Módosítás</DialogTitle>
            <DialogDescription>
              Válassz új áfakódot a kijelölt {selectedIds.size} tételhez. A rendszer automatikusan megjegyzi a választást a gépi tanulási szabályok közé.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Áfakód</Label>
              <Select value={bulkVatCodeId} onValueChange={setBulkVatCodeId}>
                <SelectTrigger>
                  <SelectValue placeholder="Válassz áfakódot..." />
                </SelectTrigger>
                <SelectContent className="max-h-60 z-[130]">
                  {vatCodes
                    .filter(c => c.direction === (isOutbound ? 'OUTBOUND' : 'INBOUND'))
                    .map(vc => (
                      <SelectItem key={vc.id || vc.code} value={vc.id || ''}>
                        <div className="flex items-center gap-2 font-mono">
                          <span className="font-bold">{vc.legacy_code || vc.code}</span>
                          <span className="text-xs text-muted-foreground">({vc.code} - {vc.vat_percent}%)</span>
                          <span className="text-xs text-muted-foreground truncate max-w-[180px]">{vc.label}</span>
                        </div>
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkVatDialogOpen(false)}>Mégse</Button>
            <Button
              disabled={!bulkVatCodeId || isSubmittingVatCode}
              onClick={() => {
                const selectedLineItems = items.filter(i => selectedIds.has(i.id));
                handleSaveVatCodeOverride(selectedLineItems, bulkVatCodeId);
                setSelectedIds(new Set());
              }}
            >
              {isSubmittingVatCode ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Sparkles className="w-4 h-4 mr-2 text-amber-400" />}
              Alkalmazás ({selectedIds.size} tétel)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ── Item Project Rule Button Component ──
interface ItemProjectRuleButtonProps {
  item: InvoiceLineItem;
  classificationGlNumber: string;
  projectName: string;
  onSaveRule: (lineDescription: string, glNumber: string, projectId: string, projectName: string) => Promise<void>;
}

function ItemProjectRuleButton({
  item,
  classificationGlNumber,
  projectName,
  onSaveRule,
}: ItemProjectRuleButtonProps) {
  const { t } = useTranslation(['invoices', 'common']);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-primary hover:text-primary hover:bg-primary/10 rounded-md shrink-0"
              onClick={(e) => {
                e.stopPropagation();
                setOpen(prev => !prev);
              }}
            >
              <Sparkles className="h-3.5 w-3.5" />
            </Button>
          </PopoverTrigger>
        </TooltipTrigger>
        {!open && (
          <TooltipContent side="top" className="text-xs z-[120]">
            {t('invoices:dialogs.items.auto_rule_tooltip')}
          </TooltipContent>
        )}
      </Tooltip>
      <PopoverContent className="w-80 p-4 z-[110]" align="end" onClick={(e) => e.stopPropagation()}>
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <h4 className="font-semibold text-sm">{t('invoices:dialogs.items.auto_rule_title')}</h4>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            {t('invoices:dialogs.items.auto_rule_question', { desc: item.line_description, gl: classificationGlNumber, project: projectName })}
          </p>
          <p className="text-[10px] text-primary/80 italic leading-snug bg-primary/5 p-2 rounded border border-primary/10">
            {t('invoices:dialogs.items.auto_rule_retroactive')}
          </p>
          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8 text-xs"
              onClick={() => setOpen(false)}
              disabled={saving}
            >
              {t('common:actions.cancel')}
            </Button>
            <Button
              type="button"
              size="sm"
              className="h-8 text-xs gap-1.5"
              disabled={saving}
              onClick={async () => {
                setSaving(true);
                try {
                  await onSaveRule(
                    item.line_description || '',
                    classificationGlNumber,
                    item.project_id!,
                    projectName
                  );
                  setOpen(false);
                } finally {
                  setSaving(false);
                }
              }}
            >
              {saving ? t('common:actions.saving') : t('invoices:dialogs.items.auto_rule_save_btn')}
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ── Line Item Note Cell Component ──
interface ItemNoteCellProps {
  item: InvoiceLineItem;
  onSaveNotes: (item: InvoiceLineItem, notes: string) => Promise<void>;
}

function ItemNoteCell({ item, onSaveNotes }: ItemNoteCellProps) {
  const { t } = useTranslation(['invoices', 'common']);
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(item.notes || '');
  const [saving, setSaving] = useState(false);

  // Sync text whenever item.notes changes (e.g. after refetch)
  useEffect(() => {
    setText(item.notes || '');
  }, [item.notes]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSaveNotes(item, text);
      setOpen(false);
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setText(item.notes || '');
    setOpen(false);
  };

  const hasNote = Boolean(item.notes && item.notes.trim().length > 0);

  return (
    <TableCell className="text-center w-12" onClick={(e) => e.stopPropagation()}>
      <Popover open={open} onOpenChange={setOpen}>
        <Tooltip>
          <TooltipTrigger asChild>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={(e) => {
                  e.stopPropagation();
                  setOpen(prev => !prev);
                }}
                className={cn(
                  "h-8 w-8 rounded-md transition-all relative shrink-0",
                  hasNote
                    ? "text-emerald-400 bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/40 shadow-sm"
                    : "text-muted-foreground/45 hover:text-muted-foreground hover:bg-muted/50"
                )}
              >
                <MessageSquare className={cn("h-4 w-4", hasNote && "fill-emerald-500/30 text-emerald-400")} />
                {hasNote && (
                  <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                  </span>
                )}
              </Button>
            </PopoverTrigger>
          </TooltipTrigger>
          {!open && (
            <TooltipContent side="top" className="max-w-[280px] z-[120] bg-popover border border-border shadow-md">
              {hasNote ? (
                <div className="space-y-1">
                  <p className="font-semibold text-emerald-400 text-xs flex items-center gap-1.5">
                    <MessageSquare className="h-3.5 w-3.5" /> {t('invoices:dialogs.items.item_note_tooltip')}
                  </p>
                  <p className="text-xs text-foreground/90 whitespace-pre-wrap leading-relaxed font-normal">
                    {item.notes}
                  </p>
                </div>
              ) : (
                <p className="text-xs leading-normal">{t('invoices:dialogs.items.item_note_add_tooltip')}</p>
              )}
            </TooltipContent>
          )}
        </Tooltip>

        <PopoverContent
          className="w-80 p-4 z-[110] shadow-xl border-border bg-popover"
          align="end"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-emerald-500" />
                <h4 className="font-semibold text-sm">{t('invoices:dialogs.items.item_note_title')}</h4>
              </div>
              {hasNote && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-medium">
                  {t('invoices:dialogs.items.item_note_saved_badge')}
                </span>
              )}
            </div>
            <textarea
              className="w-full min-h-[90px] p-2.5 text-xs bg-background border border-border/80 rounded-md focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary resize-y text-foreground placeholder:text-muted-foreground/60 leading-relaxed"
              placeholder={t('invoices:dialogs.items.item_note_placeholder')}
              value={text}
              onChange={(e) => setText(e.target.value)}
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-8 text-xs"
                onClick={handleCancel}
                disabled={saving}
              >
                {t('common:actions.cancel')}
              </Button>
              <Button
                type="button"
                size="sm"
                className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5"
                onClick={handleSave}
                disabled={saving}
              >
                {saving ? t('common:actions.saving') : t('common:actions.save')}
              </Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </TableCell>
  );
}

// ── VTSZ & Net Weight (kg) Popover Component (6/B melléklet) ──
interface ItemVtszWeightPopoverProps {
  item: InvoiceLineItem;
  onSave: (item: InvoiceLineItem, productCode: string | null, netWeightKg: number | null) => Promise<void>;
}

function ItemVtszWeightPopover({ item, onSave }: ItemVtszWeightPopoverProps) {
  const [open, setOpen] = useState(false);
  const [productCode, setProductCode] = useState(item.product_code || '');
  const [netWeightKg, setNetWeightKg] = useState(item.net_weight_kg != null ? String(item.net_weight_kg) : '');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setProductCode(item.product_code || '');
    setNetWeightKg(item.net_weight_kg != null ? String(item.net_weight_kg) : '');
  }, [item.product_code, item.net_weight_kg]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const parsedWeight = netWeightKg.trim() !== '' ? parseFloat(netWeightKg.replace(',', '.')) : null;
      await onSave(
        item,
        productCode.trim() !== '' ? productCode.trim() : null,
        parsedWeight != null && !isNaN(parsedWeight) ? parsedWeight : null
      );
      setOpen(false);
    } finally {
      setSaving(false);
    }
  };

  const hasData = Boolean(item.product_code || item.net_weight_kg != null);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setOpen(prev => !prev);
          }}
          className={cn(
            "group/vtsz inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-mono transition-all border cursor-pointer",
            hasData
              ? "bg-amber-500/10 text-amber-800 dark:text-amber-300 border-amber-500/30 hover:bg-amber-500/20"
              : "bg-muted/40 text-muted-foreground/60 border-border/40 hover:bg-muted hover:text-foreground opacity-70 hover:opacity-100"
          )}
        >
          <span>{item.product_code ? `VTSZ: ${item.product_code}` : '+ VTSZ / Súly'}</span>
          {item.net_weight_kg != null && (
            <span className="font-semibold text-amber-600 dark:text-amber-400">({item.net_weight_kg} kg)</span>
          )}
          <Pencil className="h-2.5 w-2.5 opacity-50 group-hover/vtsz:opacity-100" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-72 p-3.5 z-[110] shadow-xl border-border bg-popover space-y-3"
        align="start"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b pb-2">
          <h4 className="font-semibold text-xs text-foreground">VTSZ & Nettó tömeg (kg)</h4>
          <span className="text-[10px] text-muted-foreground font-mono bg-muted px-1.5 py-0.5 rounded">6/B melléklet</span>
        </div>
        <div className="space-y-2 text-xs">
          <div className="space-y-1">
            <Label className="text-[11px] font-medium text-muted-foreground">VTSZ / KN kód</Label>
            <input
              className="w-full px-2.5 py-1.5 text-xs bg-background border border-border/80 rounded focus:outline-none focus:ring-1 focus:ring-primary font-mono text-foreground"
              placeholder="pl. 7214 20 00"
              value={productCode}
              onChange={(e) => setProductCode(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-[11px] font-medium text-muted-foreground">Nettó tömeg (kg)</Label>
            <input
              type="number"
              step="any"
              className="w-full px-2.5 py-1.5 text-xs bg-background border border-border/80 rounded focus:outline-none focus:ring-1 focus:ring-primary font-mono text-foreground"
              placeholder="pl. 1250"
              value={netWeightKg}
              onChange={(e) => setNetWeightKg(e.target.value)}
            />
            <p className="text-[10px] text-muted-foreground">
              A NAV 2665-07/08 nyilatkozat egész kg-ban kéri az adatot (a rendszer exportkor kerekíti).
            </p>
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-1 border-t">
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-7 text-xs px-2.5"
            onClick={() => setOpen(false)}
            disabled={saving}
          >
            Mégse
          </Button>
          <Button
            type="button"
            size="sm"
            className="h-7 text-xs px-2.5 gap-1"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
            Mentés
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
