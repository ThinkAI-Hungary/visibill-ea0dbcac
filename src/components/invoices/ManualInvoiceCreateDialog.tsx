import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { format, parseISO } from 'date-fns';
import { getDateFnsLocale, getActiveLocale, formatCurrency } from '@/lib/locale/formatters';
import { useTranslation } from 'react-i18next';
import { toast } from '@/hooks/use-toast';
import { Plus, Trash2, FileText, ListOrdered, Loader2, Calculator, CalendarIcon, ArrowDownLeft, ArrowUpRight } from 'lucide-react';
import { reportError } from '@/lib/errorReporter';
import { cn } from '@/lib/utils';
import { NavInvoicePicker } from './manual-create/NavInvoicePicker';
import { TransactionMultiPicker, type SelectedTransactionItem } from './manual-create/TransactionMultiPicker';
import { InvoiceDocumentDropzone } from './manual-create/InvoiceDocumentDropzone';
import type { NavInvoice, Category, Project } from '@/features/invoices/types';

interface LineItemDraft {
  id: string;
  line_number: number;
  line_description: string;
  quantity: number | string;
  unit_of_measure: string;
  unit_price: number | string;
  net_amount: number;
  vat_rate: string;
  vat_amount: number;
  gross_amount: number;
  product_code?: string;
}

const parseNumericValue = (val: string | number | undefined | null): number => {
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  if (!val) return 0;
  const cleaned = String(val).replace(/\s/g, '').replace(',', '.');
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? 0 : parsed;
};

interface ManualInvoiceCreateDialogProps {
  open: boolean;
  onClose: () => void;
  companyId: string;
  companyName?: string;
  categories: Category[];
  projects: Project[];
  initialDirection?: 'INBOUND' | 'OUTBOUND';
  onSuccess?: () => void;
}

export function ManualInvoiceCreateDialog({
  open,
  onClose,
  companyId,
  companyName = '',
  categories = [],
  projects = [],
  initialDirection = 'INBOUND',
  onSuccess,
}: ManualInvoiceCreateDialogProps) {
  const { t } = useTranslation(['invoices', 'common']);
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const dateLocale = getDateFnsLocale();
  const isHr = getActiveLocale() === 'hr';

  const [activeTab, setActiveTab] = useState('details');
  const [isSaving, setIsSaving] = useState(false);
  const savingRef = useRef(false);

  // Direction & Type
  const [direction, setDirection] = useState<'INBOUND' | 'OUTBOUND'>(initialDirection);
  const [invoiceType, setInvoiceType] = useState<string>('sima_szla');

  // Form fields
  const [formData, setFormData] = useState(() => ({
    bizonylatsorszam: '',
    kibocsatas_datuma: new Date(),
    teljesites_datuma: new Date(),
    fizetesi_hatarido: undefined as Date | undefined,
    elado_nev: initialDirection === 'OUTBOUND' ? (companyName || '') : '',
    vevo_nev: initialDirection === 'INBOUND' ? (companyName || '') : '',
    adoalap_osszesen: '' as string | number,
    afa_osszeg_osszesen: '' as string | number,
    brutto_vegosszeg: '' as string | number,
    penznem: isHr ? 'EUR' : 'HUF',
    fizetesi_mod: 'Átutalás',
    category_id: 'none',
    project_id: 'none',
  }));

  // Attachments & Pairings
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedNavInvoice, setSelectedNavInvoice] = useState<NavInvoice | null>(null);
  const [selectedTransactions, setSelectedTransactions] = useState<SelectedTransactionItem[]>([]);

  // Line items
  const [lineItems, setLineItems] = useState<LineItemDraft[]>([]);

  // Reset or initialize on open
  useEffect(() => {
    if (open) {
      setDirection(initialDirection);
      setInvoiceType('sima_szla');
      setFormData({
        bizonylatsorszam: '',
        kibocsatas_datuma: new Date(),
        teljesites_datuma: new Date(),
        fizetesi_hatarido: undefined,
        elado_nev: initialDirection === 'OUTBOUND' ? (companyName || '') : '',
        vevo_nev: initialDirection === 'INBOUND' ? (companyName || '') : '',
        adoalap_osszesen: '',
        afa_osszeg_osszesen: '',
        brutto_vegosszeg: '',
        penznem: isHr ? 'EUR' : 'HUF',
        fizetesi_mod: 'Átutalás',
        category_id: 'none',
        project_id: 'none',
      });
      setSelectedFile(null);
      setSelectedNavInvoice(null);
      setSelectedTransactions([]);
      setLineItems([]);
      setActiveTab('details');
    }
  }, [open, initialDirection, companyName, isHr]);

  // Handle direction switch with partner prefilling
  const handleDirectionChange = (newDir: 'INBOUND' | 'OUTBOUND') => {
    setDirection(newDir);
    setFormData(prev => {
      if (newDir === 'INBOUND') {
        return {
          ...prev,
          vevo_nev: prev.vevo_nev || companyName || '',
          elado_nev: prev.elado_nev === companyName ? '' : prev.elado_nev,
        };
      } else {
        return {
          ...prev,
          elado_nev: prev.elado_nev || companyName || '',
          vevo_nev: prev.vevo_nev === companyName ? '' : prev.vevo_nev,
        };
      }
    });
  };

  // Handle NAV Invoice Selection with intelligent autofill
  const handleSelectNavInvoice = (nav: NavInvoice | null) => {
    setSelectedNavInvoice(nav);
    if (!nav) return;

    const parseDateSafe = (dStr: string | null | undefined): Date | undefined => {
      if (!dStr) return undefined;
      try {
        return parseISO(dStr);
      } catch {
        return undefined;
      }
    };

    setFormData(prev => ({
      ...prev,
      bizonylatsorszam: nav.invoice_number || prev.bizonylatsorszam,
      kibocsatas_datuma: parseDateSafe(nav.invoice_issue_date) || prev.kibocsatas_datuma,
      teljesites_datuma: parseDateSafe(nav.invoice_delivery_date) || prev.teljesites_datuma,
      fizetesi_hatarido: parseDateSafe(nav.payment_date) || prev.fizetesi_hatarido,
      elado_nev: nav.supplier_name || prev.elado_nev || (direction === 'OUTBOUND' ? (companyName || '') : ''),
      vevo_nev: nav.customer_name || prev.vevo_nev || (direction === 'INBOUND' ? (companyName || '') : ''),
      adoalap_osszesen: nav.invoice_net_amount ?? prev.adoalap_osszesen,
      afa_osszeg_osszesen: nav.invoice_vat_amount ?? prev.afa_osszeg_osszesen,
      brutto_vegosszeg: nav.invoice_gross_amount ?? prev.brutto_vegosszeg,
      penznem: nav.currency || prev.penznem,
      fizetesi_mod: nav.payment_method || prev.fizetesi_mod,
    }));

    toast({
      title: t('invoices:manual_create.toast_nav_loaded_title'),
      description: t('invoices:manual_create.toast_nav_loaded_desc', { number: nav.invoice_number }),
    });
  };

  // Transaction toggle
  const handleToggleTransaction = (tx: SelectedTransactionItem) => {
    setSelectedTransactions(prev => {
      const exists = prev.some(t => t.id === tx.id);
      if (exists) {
        return prev.filter(t => t.id !== tx.id);
      } else {
        return [...prev, tx];
      }
    });
  };

  const handleRemoveTransaction = (id: string) => {
    setSelectedTransactions(prev => prev.filter(t => t.id !== id));
  };

  // Line items logic
  const handleAddLineItem = () => {
    const nextLineNumber = lineItems.length + 1;
    const newItem: LineItemDraft = {
      id: `new-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      line_number: nextLineNumber,
      line_description: '',
      quantity: 1,
      unit_of_measure: isHr ? 'kom' : 'db',
      unit_price: '',
      net_amount: 0,
      vat_rate: isHr ? '25%' : '27%',
      vat_amount: 0,
      gross_amount: 0,
    };
    setLineItems(prev => [...prev, newItem]);
  };

  const handleRemoveLineItem = (id: string) => {
    setLineItems(prev => {
      const filtered = prev.filter(item => item.id !== id);
      return filtered.map((it, idx) => ({ ...it, line_number: idx + 1 }));
    });
  };

  const handleUpdateLineItem = (id: string, field: keyof LineItemDraft, value: any) => {
    setLineItems(prev => prev.map(item => {
      if (item.id !== id) return item;

      const updated = { ...item, [field]: value };

      // Auto-recalculate amounts if quantity, unit_price, or vat_rate changes
      if (field === 'quantity' || field === 'unit_price' || field === 'vat_rate') {
        const qty = parseNumericValue(field === 'quantity' ? value : item.quantity);
        const price = parseNumericValue(field === 'unit_price' ? value : item.unit_price);
        const rateStr = String(field === 'vat_rate' ? value : item.vat_rate);

        const net = Math.round(qty * price * 100) / 100;
        let ratePercent = isHr ? 0.25 : 0.27;
        if (rateStr === '27%') ratePercent = 0.27;
        else if (rateStr === '25%') ratePercent = 0.25;
        else if (rateStr === '18%') ratePercent = 0.18;
        else if (rateStr === '13%') ratePercent = 0.13;
        else if (rateStr === '5%') ratePercent = 0.05;
        else if (['0%', 'AAM', 'TAM', 'FAD', 'EU', 'EUK', 'PDV'].includes(rateStr)) ratePercent = 0;

        const vat = Math.round(net * ratePercent * 100) / 100;
        const gross = Math.round((net + vat) * 100) / 100;

        updated.net_amount = net;
        updated.vat_amount = vat;
        updated.gross_amount = gross;
      }

      return updated;
    }));
  };

  // Recalculate header amounts from items
  const handleRecalculateFromItems = () => {
    if (lineItems.length === 0) return;
    const totals = lineItems.reduce((acc, it) => ({
      net: acc.net + (Number(it.net_amount) || 0),
      vat: acc.vat + (Number(it.vat_amount) || 0),
      gross: acc.gross + (Number(it.gross_amount) || 0),
    }), { net: 0, vat: 0, gross: 0 });

    setFormData(prev => ({
      ...prev,
      adoalap_osszesen: Math.round(totals.net * 100) / 100,
      afa_osszeg_osszesen: Math.round(totals.vat * 100) / 100,
      brutto_vegosszeg: Math.round(totals.gross * 100) / 100,
    }));

    toast({
      title: t('invoices:manual_create.toast_recalc_title'),
      description: t('invoices:manual_create.toast_recalc_desc'),
    });
  };

  // Main Submit Handler
  const handleSaveInvoice = async () => {
    if (isSaving || savingRef.current) return;

    if (!companyId || !user?.id) {
      toast({ title: t('common:status.error'), description: t('invoices:manual_create.toast_missing_company'), variant: 'destructive' });
      return;
    }

    const invoiceNumber = formData.bizonylatsorszam.trim();
    if (!invoiceNumber) {
      toast({ title: t('invoices:manual_create.toast_missing_data_title', 'Hiányzó adat'), description: t('invoices:manual_create.toast_missing_number'), variant: 'destructive' });
      return;
    }

    const partnerName = direction === 'INBOUND' ? formData.elado_nev.trim() : formData.vevo_nev.trim();
    if (!partnerName) {
      toast({
        title: t('invoices:manual_create.toast_missing_partner_title'),
        description: direction === 'INBOUND' ? t('invoices:manual_create.toast_missing_seller') : t('invoices:manual_create.toast_missing_buyer'),
        variant: 'destructive',
      });
      return;
    }

    savingRef.current = true;
    setIsSaving(true);
    try {
      let uploadedFileUrl: string | null = null;
      let fileAttachmentJson: any[] | null = null;

      // 1. Upload file to Storage if selected
      if (selectedFile) {
        const cleanName = selectedFile.name.replace(/[^a-zA-Z0-9.-]/g, '_');
        const storagePath = `${user.id}/${Date.now()}-${cleanName}`;

        const { error: uploadError } = await supabase.storage
          .from('invoice-uploads')
          .upload(storagePath, selectedFile, {
            cacheControl: '3600',
            upsert: false,
          });

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage
          .from('invoice-uploads')
          .getPublicUrl(storagePath);

        uploadedFileUrl = urlData?.publicUrl || storagePath;
        fileAttachmentJson = [{
          name: selectedFile.name,
          size: selectedFile.size,
          type: selectedFile.type,
          url: uploadedFileUrl,
          path: storagePath,
          uploaded_at: new Date().toISOString(),
        }];
      }

      // Recompute header amounts from line items if present (enforces consistency)
      let invoiceNet = parseNumericValue(formData.adoalap_osszesen);
      let invoiceVat = parseNumericValue(formData.afa_osszeg_osszesen);
      let invoiceGross = parseNumericValue(formData.brutto_vegosszeg);

      if (lineItems.length > 0) {
        const lineTotals = lineItems.reduce((acc, it) => ({
          net: acc.net + (Number(it.net_amount) || 0),
          vat: acc.vat + (Number(it.vat_amount) || 0),
          gross: acc.gross + (Number(it.gross_amount) || 0),
        }), { net: 0, vat: 0, gross: 0 });

        invoiceNet = Math.round(lineTotals.net * 100) / 100;
        invoiceVat = Math.round(lineTotals.vat * 100) / 100;
        invoiceGross = Math.round(lineTotals.gross * 100) / 100;
      }

      // Calculate payment status from selected transactions
      const totalTxAmount = selectedTransactions.reduce((sum, t) => sum + Math.abs(t.amount || 0), 0);
      const isFullyPaid = totalTxAmount > 0 && totalTxAmount >= (invoiceGross - 0.5);
      const isPartiallyPaid = totalTxAmount > 0 && !isFullyPaid;

      // Ensure non-primary partner is NEVER null or empty (satisfies PostgreSQL NOT NULL constraint)
      const eladoName = direction === 'INBOUND'
        ? formData.elado_nev.trim()
        : (formData.elado_nev.trim() || companyName || 'Saját cég');

      const vevoName = direction === 'OUTBOUND'
        ? formData.vevo_nev.trim()
        : (formData.vevo_nev.trim() || companyName || 'Saját cég');

      // 2. Insert into invoices table
      const invoicePayload: Record<string, any> = {
        company_id: companyId,
        user_id: user.id,
        bizonylatsorszam: invoiceNumber,
        kibocsatas_datuma: format(formData.kibocsatas_datuma, 'yyyy-MM-dd'),
        teljesites_datuma: formData.teljesites_datuma ? format(formData.teljesites_datuma, 'yyyy-MM-dd') : null,
        fizetesi_hatarido: formData.fizetesi_hatarido ? format(formData.fizetesi_hatarido, 'yyyy-MM-dd') : null,
        elado_nev: eladoName,
        vevo_nev: vevoName,
        adoalap_osszesen: invoiceNet,
        afa_osszeg_osszesen: invoiceVat,
        brutto_vegosszeg: invoiceGross,
        fizetendo_osszeg: invoiceGross,
        penznem: formData.penznem || (isHr ? 'EUR' : 'HUF'),
        fizetesi_mod: formData.fizetesi_mod || null,
        invoice_direction: direction,
        invoice_type: invoiceType || 'sima_szla',
        category_id: formData.category_id === 'none' ? null : formData.category_id,
        project_id: formData.project_id === 'none' ? null : formData.project_id,
        image_url: uploadedFileUrl,
        melleklet_url: uploadedFileUrl,
        attachments: fileAttachmentJson,
        nav_invoice_id: selectedNavInvoice?.id || null,
        nav_status: selectedNavInvoice ? 'verified' : 'missing_nav',
        statusz: isFullyPaid ? 'feldolgozva' : (isPartiallyPaid ? 'partially_paid' : 'feldolgozva'),
        paid: isFullyPaid,
        paid_amount: totalTxAmount > 0 ? totalTxAmount : null,
        remaining_amount: totalTxAmount > 0 ? Math.max(0, invoiceGross - totalTxAmount) : null,
        letrehozva: new Date().toISOString(),
        frissitve: new Date().toISOString(),
      };

      const { data: insertedInvoice, error: insertError } = await supabase
        .from('invoices')
        .insert(invoicePayload)
        .select('id')
        .single();

      if (insertError) {
        if (insertError.code === '23505') {
          toast({
            title: t('invoices:manual_create.toast_duplicate_number_title'),
            description: t('invoices:manual_create.toast_duplicate_number_desc'),
            variant: 'destructive',
          });
          return;
        }
        throw insertError;
      }

      const newInvoiceId = insertedInvoice.id;

      // 3. Insert line items if present
      if (lineItems.length > 0) {
        const itemsToInsert = lineItems.map((item, idx) => ({
          invoice_id: newInvoiceId,
          line_number: idx + 1,
          line_description: item.line_description.trim() || `Tétel #${idx + 1}`,
          quantity: parseNumericValue(item.quantity) || 1,
          unit_of_measure: item.unit_of_measure || 'db',
          unit_price: parseNumericValue(item.unit_price) || 0,
          net_amount: item.net_amount,
          vat_rate: item.vat_rate,
          vat_amount: item.vat_amount,
          gross_amount: item.gross_amount,
          product_code: item.product_code || null,
        }));

        const { error: itemsError } = await supabase
          .from('invoice_items')
          .insert(itemsToInsert);

        if (itemsError) throw itemsError;
      }

      // 4. Connect selected transactions
      if (selectedTransactions.length > 0) {
        for (let i = 0; i < selectedTransactions.length; i++) {
          const tx = selectedTransactions[i];
          // Primary match on transactions
          await supabase
            .from('transactions')
            .update({
              matched_invoice_id: newInvoiceId,
              match_type: selectedTransactions.length > 1 ? 'multi_manual' : 'manual',
              confidence_score: 1.0,
              is_verified: true,
            })
            .eq('id', tx.id);

          // Extra matches in join table
          if (i > 0) {
            await supabase
              .from('transaction_invoice_matches')
              .insert({
                transaction_id: tx.id,
                invoice_id: newInvoiceId,
                invoice_source: 'submitted',
                created_by: user.id,
              });
          }
        }
      }

      // 5. If NAV invoice selected, update its submitted flag
      if (selectedNavInvoice) {
        await supabase
          .from('nav_invoices')
          .update({ submitted: true })
          .eq('id', selectedNavInvoice.id);
      }

      // 6. Invalidate query caches
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['submittedInvoices'] });
      queryClient.invalidateQueries({ queryKey: ['filteredSubmittedInvoices'] });
      queryClient.invalidateQueries({ queryKey: ['company-invoices'] });
      queryClient.invalidateQueries({ queryKey: ['nav-invoices'] });
      queryClient.invalidateQueries({ queryKey: ['filteredNavInvoices'] });
      queryClient.invalidateQueries({ queryKey: ['invoiceKpis'] });
      queryClient.invalidateQueries({ queryKey: ['invoice-kpis'] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });

      toast({
        title: t('invoices:manual_create.toast_save_success'),
        description: `${invoiceNumber}`,
      });

      onSuccess?.();
      onClose();
    } catch (err: any) {
      reportError({
        type: 'db_query',
        component: 'ManualInvoiceCreateDialog',
        action: 'create_manual_invoice',
        message: 'Hiba a számla manuális rögzítése során',
        error: err,
      });
      toast({
        title: t('common:status.error'),
        description: err.message || t('invoices:manual_create.toast_save_error'),
        variant: 'destructive',
      });
    } finally {
      savingRef.current = false;
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(val) => !isSaving && !val && onClose()}>
      <DialogContent className={cn(
        "max-h-[90vh] overflow-hidden flex flex-col transition-all duration-200",
        activeTab === 'items' ? 'sm:max-w-5xl' : 'sm:max-w-[760px]'
      )}>
        <DialogHeader>
          <div className="flex items-center justify-between pr-6">
            <div>
              <DialogTitle className="text-xl font-bold flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                {t('invoices:manual_create.dialog_title')}
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                {t('invoices:manual_create.dialog_desc')}
              </DialogDescription>
            </div>
            <div className="flex items-center gap-1 bg-muted/40 p-1 rounded-lg border border-border/40">
              <Button
                type="button"
                size="sm"
                variant={direction === 'INBOUND' ? 'default' : 'ghost'}
                onClick={() => handleDirectionChange('INBOUND')}
                className="h-7 text-xs px-2.5 gap-1.5"
              >
                <ArrowDownLeft className="h-3.5 w-3.5 text-blue-400" />
                {t('invoices:manual_create.dir_inbound')}
              </Button>
              <Button
                type="button"
                size="sm"
                variant={direction === 'OUTBOUND' ? 'default' : 'ghost'}
                onClick={() => handleDirectionChange('OUTBOUND')}
                className="h-7 text-xs px-2.5 gap-1.5"
              >
                <ArrowUpRight className="h-3.5 w-3.5 text-emerald-400" />
                {t('invoices:manual_create.dir_outbound')}
              </Button>
            </div>
          </div>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 overflow-hidden flex flex-col mt-2">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="details" className="gap-2 text-xs">
              <FileText className="h-4 w-4" />
              {t('invoices:manual_create.tab_details')}
            </TabsTrigger>
            <TabsTrigger value="items" className="gap-2 text-xs">
              <ListOrdered className="h-4 w-4" />
              {t('invoices:manual_create.tab_items')}
              {lineItems.length > 0 && (
                <span className="ml-1 text-xs bg-primary/20 text-primary font-semibold rounded-full px-1.5 py-0.2 min-w-[18px] text-center">
                  {lineItems.length}
                </span>
              )}
            </TabsTrigger>
          </TabsList>

          {/* ── Tab 1: Számla adatok ── */}
          <TabsContent value="details" className="flex-1 overflow-y-auto overflow-x-hidden mt-3 pr-1 space-y-4">
            {/* NAV számlapár választó szekció */}
            <div className="p-3 rounded-lg bg-muted/20 border border-border/60">
              <NavInvoicePicker
                companyId={companyId}
                direction={direction}
                selectedNavInvoice={selectedNavInvoice}
                onSelect={handleSelectNavInvoice}
                disabled={isSaving}
              />
            </div>

            {/* Fő adatok 2 hasábban */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Bal hasáb: Bizonylatszám, Dátumok, Partnerek */}
              <div className="space-y-3">
                <div className="space-y-1">
                  <Label htmlFor="create-bizonylatsorszam" className="text-xs font-semibold text-foreground">
                    {t('invoices:manual_create.invoice_number')} <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="create-bizonylatsorszam"
                    value={formData.bizonylatsorszam}
                    onChange={(e) => setFormData(prev => ({ ...prev, bizonylatsorszam: e.target.value }))}
                    placeholder={t('invoices:manual_create.invoice_number_placeholder')}
                    className="font-mono text-xs h-8"
                    disabled={isSaving}
                  />
                  <p className="text-[11px] text-muted-foreground">
                    {t('invoices:manual_create.invoice_number_hint')}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs text-foreground">{t('invoices:manual_create.issue_date')} <span className="text-destructive">*</span></Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={isSaving}
                          className="w-full justify-start text-left font-normal text-xs h-8"
                        >
                          <CalendarIcon className="mr-1.5 h-3.5 w-3.5 text-muted-foreground" />
                          {formData.kibocsatas_datuma ? format(formData.kibocsatas_datuma, 'yyyy. MM. dd.', { locale: dateLocale }) : t('invoices:manual_create.select_date')}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={formData.kibocsatas_datuma}
                          onSelect={(d) => d && setFormData(prev => ({ ...prev, kibocsatas_datuma: d }))}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs text-foreground">{t('invoices:manual_create.delivery_date')}</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={isSaving}
                          className="w-full justify-start text-left font-normal text-xs h-8"
                        >
                          <CalendarIcon className="mr-1.5 h-3.5 w-3.5 text-muted-foreground" />
                          {formData.teljesites_datuma ? format(formData.teljesites_datuma, 'yyyy. MM. dd.', { locale: dateLocale }) : t('invoices:manual_create.select_date')}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={formData.teljesites_datuma}
                          onSelect={(d) => d && setFormData(prev => ({ ...prev, teljesites_datuma: d }))}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>

                <div className="space-y-1">
                  <Label htmlFor="create-elado" className="text-xs font-semibold text-foreground">
                    {t('invoices:manual_create.seller_name')} {direction === 'INBOUND' && <span className="text-destructive">*</span>}
                  </Label>
                  <Input
                    id="create-elado"
                    value={formData.elado_nev}
                    onChange={(e) => setFormData(prev => ({ ...prev, elado_nev: e.target.value }))}
                    placeholder={direction === 'OUTBOUND' && companyName ? companyName : t('invoices:manual_create.placeholder_partner_seller')}
                    className="text-xs h-8"
                    disabled={isSaving}
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="create-vevo" className="text-xs font-semibold text-foreground">
                    {t('invoices:manual_create.buyer_name')} {direction === 'OUTBOUND' && <span className="text-destructive">*</span>}
                  </Label>
                  <Input
                    id="create-vevo"
                    value={formData.vevo_nev}
                    onChange={(e) => setFormData(prev => ({ ...prev, vevo_nev: e.target.value }))}
                    placeholder={direction === 'INBOUND' && companyName ? companyName : t('invoices:manual_create.placeholder_partner_buyer')}
                    className="text-xs h-8"
                    disabled={isSaving}
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs text-foreground">{t('invoices:manual_create.invoice_type')}</Label>
                  <Select value={invoiceType} onValueChange={setInvoiceType} disabled={isSaving}>
                    <SelectTrigger className="text-xs h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sima_szla">{t('invoices:manual_create.types.sima_szla')}</SelectItem>
                      <SelectItem value="dijbekero_proforma">{t('invoices:manual_create.types.dijbekero_proforma')}</SelectItem>
                      <SelectItem value="elolegszamla">{t('invoices:manual_create.types.elolegszamla')}</SelectItem>
                      <SelectItem value="vegszamla">{t('invoices:manual_create.types.vegszamla')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Jobb hasáb: Összegek, Deviza, Fizetési mód, Besorolások */}
              <div className="space-y-3">
                <div className="p-3 rounded-lg bg-muted/20 border border-border/60 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold tracking-wider text-muted-foreground uppercase">{t('invoices:manual_create.amounts_title')}</span>
                    {lineItems.length > 0 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={handleRecalculateFromItems}
                        className="h-6 px-1.5 text-[11px] text-primary hover:text-primary gap-1"
                      >
                        <Calculator className="h-3 w-3" />
                        {t('invoices:manual_create.recalculate_from_items')}
                      </Button>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-[11px] text-muted-foreground">{t('invoices:manual_create.net_amount')}</Label>
                      <Input
                        type="text"
                        inputMode="decimal"
                        value={formData.adoalap_osszesen ?? ''}
                        onChange={(e) => setFormData(prev => ({ ...prev, adoalap_osszesen: e.target.value }))}
                        className="font-mono text-xs h-8 text-right [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        placeholder="0.00"
                        disabled={isSaving}
                      />
                    </div>

                    <div className="space-y-1">
                      <Label className="text-[11px] text-muted-foreground">{t('invoices:manual_create.vat_amount')}</Label>
                      <Input
                        type="text"
                        inputMode="decimal"
                        value={formData.afa_osszeg_osszesen ?? ''}
                        onChange={(e) => setFormData(prev => ({ ...prev, afa_osszeg_osszesen: e.target.value }))}
                        className="font-mono text-xs h-8 text-right [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        placeholder="0.00"
                        disabled={isSaving}
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs font-semibold text-foreground">{t('invoices:manual_create.gross_amount')}</Label>
                    <Input
                      type="text"
                      inputMode="decimal"
                      value={formData.brutto_vegosszeg ?? ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, brutto_vegosszeg: e.target.value }))}
                      className="font-mono text-sm font-bold h-8 text-right text-emerald-500 bg-background [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      placeholder="0.00"
                      disabled={isSaving}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs text-foreground">{t('invoices:manual_create.currency')}</Label>
                    <Select
                      value={formData.penznem}
                      onValueChange={(val) => setFormData(prev => ({ ...prev, penznem: val }))}
                      disabled={isSaving}
                    >
                      <SelectTrigger className="text-xs h-8 font-mono">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {isHr ? (
                          <>
                            <SelectItem value="EUR">EUR</SelectItem>
                            <SelectItem value="HUF">HUF</SelectItem>
                            <SelectItem value="USD">USD</SelectItem>
                            <SelectItem value="GBP">GBP</SelectItem>
                            <SelectItem value="CHF">CHF</SelectItem>
                          </>
                        ) : (
                          <>
                            <SelectItem value="HUF">HUF</SelectItem>
                            <SelectItem value="EUR">EUR</SelectItem>
                            <SelectItem value="USD">USD</SelectItem>
                            <SelectItem value="GBP">GBP</SelectItem>
                            <SelectItem value="CHF">CHF</SelectItem>
                          </>
                        )}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs text-foreground">{t('invoices:manual_create.payment_method')}</Label>
                    <Select
                      value={formData.fizetesi_mod}
                      onValueChange={(val) => setFormData(prev => ({ ...prev, fizetesi_mod: val }))}
                      disabled={isSaving}
                    >
                      <SelectTrigger className="text-xs h-8">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Átutalás">{t('invoices:payment_methods.transfer')}</SelectItem>
                        <SelectItem value="Bankkártya">{t('invoices:payment_methods.card')}</SelectItem>
                        <SelectItem value="Készpénz">{t('invoices:payment_methods.cash')}</SelectItem>
                        <SelectItem value="Utánvét">{t('invoices:payment_methods.cod')}</SelectItem>
                        <SelectItem value="Kompenzáció">{t('invoices:expanded.compensation_candidate')}</SelectItem>
                        <SelectItem value="Egyéb">{t('invoices:payment_methods.other')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs text-foreground">{t('invoices:manual_create.category')}</Label>
                    <Select
                      value={formData.category_id}
                      onValueChange={(val) => setFormData(prev => ({ ...prev, category_id: val }))}
                      disabled={isSaving}
                    >
                      <SelectTrigger className="text-xs h-8">
                        <SelectValue placeholder={t('invoices:manual_create.no_category')} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">{t('invoices:manual_create.no_category')}</SelectItem>
                        {categories.map((c) => (
                          <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs text-foreground">{t('invoices:manual_create.project')}</Label>
                    <Select
                      value={formData.project_id}
                      onValueChange={(val) => setFormData(prev => ({ ...prev, project_id: val }))}
                      disabled={isSaving}
                    >
                      <SelectTrigger className="text-xs h-8">
                        <SelectValue placeholder={t('invoices:manual_create.no_project')} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">{t('invoices:manual_create.no_project')}</SelectItem>
                        {projects.map((p) => (
                          <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            </div>

            {/* Számlakép dropzone */}
            <div className="pt-1">
              <InvoiceDocumentDropzone
                file={selectedFile}
                onFileChange={setSelectedFile}
                disabled={isSaving}
              />
            </div>

            {/* Tranzakció(k) csatolása */}
            <div className="p-3 rounded-lg bg-muted/20 border border-border/60">
              <TransactionMultiPicker
                companyId={companyId}
                selectedTransactions={selectedTransactions}
                onToggleTransaction={handleToggleTransaction}
                onRemoveTransaction={handleRemoveTransaction}
                invoiceGrossAmount={parseNumericValue(formData.brutto_vegosszeg)}
                invoiceCurrency={formData.penznem}
                disabled={isSaving}
              />
            </div>
          </TabsContent>

          {/* ── Tab 2: Számlatételek ── */}
          <TabsContent value="items" className="flex-1 overflow-y-auto overflow-x-hidden mt-3 pr-1 space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-xs text-muted-foreground">
                {t('invoices:manual_create.line_items_hint')}
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={handleAddLineItem}
                disabled={isSaving}
                className="h-7 text-xs gap-1.5"
              >
                <Plus className="h-3.5 w-3.5 text-primary" />
                {t('invoices:manual_create.btn_add_line_item')}
              </Button>
            </div>

            {lineItems.length === 0 ? (
              <div className="py-12 border border-dashed rounded-lg text-center space-y-2">
                <ListOrdered className="h-8 w-8 text-muted-foreground mx-auto opacity-50" />
                <div className="text-xs font-medium text-foreground">{t('invoices:manual_create.no_items_title')}</div>
                <div className="text-[11px] text-muted-foreground max-w-sm mx-auto">
                  {t('invoices:manual_create.no_items_desc')}
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={handleAddLineItem}
                  className="mt-2 text-xs h-7"
                >
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  {t('invoices:manual_create.btn_first_item')}
                </Button>
              </div>
            ) : (
              <div className="border rounded-md overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/40 hover:bg-muted/40 text-[11px]">
                      <TableHead className="w-10 text-center">{t('invoices:manual_create.table_line_num')}</TableHead>
                      <TableHead className="min-w-[160px]">{t('invoices:manual_create.table_description')}</TableHead>
                      <TableHead className="w-20 text-right">{t('invoices:manual_create.table_quantity')}</TableHead>
                      <TableHead className="w-16">{t('invoices:manual_create.table_unit')}</TableHead>
                      <TableHead className="w-24 text-right">{t('invoices:manual_create.table_unit_price')}</TableHead>
                      <TableHead className="w-24 text-right">{t('invoices:manual_create.table_net')}</TableHead>
                      <TableHead className="w-20 text-center">{t('invoices:manual_create.table_vat_rate')}</TableHead>
                      <TableHead className="w-24 text-right">{t('invoices:manual_create.table_gross')}</TableHead>
                      <TableHead className="w-10"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {lineItems.map((item) => (
                      <TableRow key={item.id} className="text-xs hover:bg-accent/30">
                        <TableCell className="text-center font-mono text-muted-foreground text-[11px]">
                          {item.line_number}
                        </TableCell>
                        <TableCell>
                          <Input
                            value={item.line_description}
                            onChange={(e) => handleUpdateLineItem(item.id, 'line_description', e.target.value)}
                            placeholder={t('invoices:manual_create.placeholder_item_desc')}
                            className="h-7 text-xs"
                            disabled={isSaving}
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="text"
                            inputMode="decimal"
                            value={item.quantity}
                            onChange={(e) => handleUpdateLineItem(item.id, 'quantity', e.target.value)}
                            className="h-7 text-xs text-right font-mono [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                            disabled={isSaving}
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            value={item.unit_of_measure}
                            onChange={(e) => handleUpdateLineItem(item.id, 'unit_of_measure', e.target.value)}
                            className="h-7 text-xs text-center"
                            disabled={isSaving}
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="text"
                            inputMode="decimal"
                            value={item.unit_price}
                            onChange={(e) => handleUpdateLineItem(item.id, 'unit_price', e.target.value)}
                            className="h-7 text-xs text-right font-mono [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                            placeholder="0.00"
                            disabled={isSaving}
                          />
                        </TableCell>
                        <TableCell className="text-right font-mono tabular-nums text-xs">
                          {formatCurrency(item.net_amount, formData.penznem)}
                        </TableCell>
                        <TableCell>
                          <Select
                            value={item.vat_rate}
                            onValueChange={(val) => handleUpdateLineItem(item.id, 'vat_rate', val)}
                            disabled={isSaving}
                          >
                            <SelectTrigger className="h-7 text-[11px] px-1 font-mono">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {isHr ? (
                                <>
                                  <SelectItem value="25%">25%</SelectItem>
                                  <SelectItem value="13%">13%</SelectItem>
                                  <SelectItem value="5%">5%</SelectItem>
                                  <SelectItem value="0%">0%</SelectItem>
                                  <SelectItem value="PDV">PDV</SelectItem>
                                  <SelectItem value="EU">EU</SelectItem>
                                </>
                              ) : (
                                <>
                                  <SelectItem value="27%">27%</SelectItem>
                                  <SelectItem value="18%">18%</SelectItem>
                                  <SelectItem value="5%">5%</SelectItem>
                                  <SelectItem value="0%">0%</SelectItem>
                                  <SelectItem value="AAM">AAM</SelectItem>
                                  <SelectItem value="TAM">TAM</SelectItem>
                                  <SelectItem value="FAD">FAD</SelectItem>
                                </>
                              )}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell className="text-right font-mono font-semibold tabular-nums text-xs">
                          {formatCurrency(item.gross_amount, formData.penznem)}
                        </TableCell>
                        <TableCell className="text-center p-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemoveLineItem(item.id)}
                            disabled={isSaving}
                            className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsContent>
        </Tabs>

        <DialogFooter className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-border/40">
          <div className="flex items-center gap-3 text-xs tabular-nums">
            <span className="text-muted-foreground">
              {t('invoices:manual_create.footer_net')} <strong className="text-foreground">{formatCurrency(parseNumericValue(formData.adoalap_osszesen), formData.penznem)}</strong>
            </span>
            <span className="text-muted-foreground">•</span>
            <span className="text-muted-foreground">
              {t('invoices:manual_create.footer_vat')} <strong className="text-foreground">{formatCurrency(parseNumericValue(formData.afa_osszeg_osszesen), formData.penznem)}</strong>
            </span>
            <span className="text-muted-foreground">•</span>
            <span className="text-emerald-500 font-bold">
              {t('invoices:manual_create.footer_gross')} {formatCurrency(parseNumericValue(formData.brutto_vegosszeg), formData.penznem)}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              disabled={isSaving}
              className="text-xs h-8"
            >
              {t('common:actions.cancel')}
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleSaveInvoice}
              disabled={isSaving}
              className="text-xs h-8 min-w-[130px]"
            >
              {isSaving ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                  {t('invoices:manual_create.btn_saving')}
                </>
              ) : (
                t('invoices:manual_create.btn_create_invoice')
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
