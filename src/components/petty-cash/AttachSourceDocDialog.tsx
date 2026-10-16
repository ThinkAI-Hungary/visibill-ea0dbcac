import React, { useState, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  FileText,
  Search,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Sparkles,
  Calendar,
  Building2,
  UploadCloud,
  FileCheck,
  FileSpreadsheet,
  Banknote,
  Receipt,
  UserCheck,
  Fuel,
  Landmark,
  HandCoins,
  Paperclip,
  Trash2,
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { PettyCashEntry, fmtAmount, roundHuf } from './types';
import { formatDateLocale } from '@/lib/locale/formatters';
import { cn } from '@/lib/utils';
import { queryKeys } from '@/lib/queryKeys';

interface OpenInvoiceItem {
  id: string;
  bizonylatsorszam: string;
  invoice_direction: string;
  partner_name: string;
  elado_nev?: string;
  vevo_nev?: string;
  elado_vat_id?: string;
  vevo_vat_id?: string;
  brutto_vegosszeg: number;
  kibocsatas_datuma?: string;
  fizetesi_hatarido?: string;
  penznem?: string;
}

interface AttachSourceDocDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entry: PettyCashEntry;
  companyId: string;
  onSuccess?: () => void;
}

export function AttachSourceDocDialog({
  open,
  onOpenChange,
  entry,
  companyId,
  onSuccess,
}: AttachSourceDocDialogProps) {
  const { t } = useTranslation(['pettyCash', 'common']);
  const qc = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isExpense = entry.amount < 0;
  const absEntryAmount = Math.abs(entry.amount);

  // Tab: 'upload' (direct file upload) vs 'link_invoice' (select existing invoice)
  const [activeTab, setActiveTab] = useState<'upload' | 'link_invoice'>('upload');

  // Direct Upload State
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [docType, setDocType] = useState<string>(
    entry.source_doc_type || (isExpense ? 'invoice' : 'bank_withdrawal')
  );
  const [docId, setDocId] = useState<string>(entry.source_doc_id || '');
  const [isUploading, setIsUploading] = useState<boolean>(false);

  // Invoice Link State
  const [filterDirection, setFilterDirection] = useState<'all' | 'INBOUND' | 'OUTBOUND'>(
    isExpense ? 'INBOUND' : 'OUTBOUND'
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null);

  // Fetch open unpaid invoices for this company
  const { data: openInvoices = [], isLoading: isLoadingInvoices } = useQuery({
    queryKey: ['open-settlement-invoices', companyId],
    queryFn: async () => {
      const [invRes, pceRes] = await Promise.all([
        (supabase as any)
          .from('invoices')
          .select(
            'id, bizonylatsorszam, invoice_direction, vevo_nev, elado_nev, vevo_vat_id, elado_vat_id, brutto_vegosszeg, kibocsatas_datuma, fizetesi_hatarido, penznem'
          )
          .eq('company_id', companyId)
          .eq('fizetve', false)
          .is('transaction_id', null)
          .not('exclude_from_accounting', 'is', true)
          .order('fizetesi_hatarido', { ascending: true }),
        (supabase as any)
          .from('petty_cash_entries')
          .select('source_id')
          .eq('company_id', companyId)
          .eq('source_table', 'invoices')
          .not('source_id', 'is', null)
          .neq('id', entry.id)
          .neq('status', 'cancelled'),
      ]);

      if (invRes.error) throw invRes.error;

      const attachedInvoiceIds = new Set(
        (pceRes.data || []).map((row: any) => row.source_id).filter(Boolean)
      );

      const items: OpenInvoiceItem[] = (invRes.data || [])
        .filter((inv: any) => !attachedInvoiceIds.has(inv.id))
        .map((inv: any) => ({
          id: inv.id,
          bizonylatsorszam: inv.bizonylatsorszam || 'N/A',
          invoice_direction: inv.invoice_direction || 'INBOUND',
          partner_name: inv.invoice_direction === 'OUTBOUND' ? inv.vevo_nev || 'Vevő' : inv.elado_nev || 'Beszállító',
          elado_nev: inv.elado_nev,
          vevo_nev: inv.vevo_nev,
          elado_vat_id: inv.elado_vat_id,
          vevo_vat_id: inv.vevo_vat_id,
          brutto_vegosszeg: Number(inv.brutto_vegosszeg) || 0,
          kibocsatas_datuma: inv.kibocsatas_datuma,
          fizetesi_hatarido: inv.fizetesi_hatarido,
          penznem: inv.penznem || 'HUF',
        }));

      return items;
    },
    enabled: open && !!companyId && activeTab === 'link_invoice',
  });

  // Filtered invoices
  const filteredInvoices = useMemo(() => {
    return openInvoices.filter((inv) => {
      if (filterDirection !== 'all' && inv.invoice_direction !== filterDirection) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesNumber = inv.bizonylatsorszam.toLowerCase().includes(q);
        const matchesPartner = inv.partner_name.toLowerCase().includes(q);
        const matchesAmount = String(inv.brutto_vegosszeg).includes(q);
        return matchesNumber || matchesPartner || matchesAmount;
      }
      return true;
    });
  }, [openInvoices, filterDirection, searchQuery]);

  // Handle direct file upload
  const handleFileUpload = async () => {
    if (!selectedFile) {
      toast({
        title: 'Nincs fájl kiválasztva',
        description: 'Kérjük, válassz ki vagy húzz be egy fotót / PDF dokumentumot!',
        variant: 'destructive',
      });
      return;
    }

    if (!docId.trim()) {
      toast({
        title: 'Hiányzó bizonylatszám',
        description: 'Kérjük, add meg a forrásdokumentum azonosítóját vagy iktatószámát!',
        variant: 'destructive',
      });
      return;
    }

    setIsUploading(true);
    try {
      const sanitizedName = selectedFile.name.replace(/[^a-zA-Z0-9.-]/g, '_');
      const storagePath = `${companyId}/${entry.id}_${Date.now()}_${sanitizedName}`;

      const { data: uploadData, error: uploadErr } = await supabase.storage
        .from('petty-cash-attachments')
        .upload(storagePath, selectedFile, {
          cacheControl: '3600',
          upsert: true,
        });

      if (uploadErr) throw uploadErr;

      // Update petty_cash_entries
      const { error: updateErr } = await supabase
        .from('petty_cash_entries')
        .update({
          attachment_path: storagePath,
          source_doc_type: docType,
          source_doc_id: docId.trim(),
        })
        .eq('id', entry.id)
        .eq('company_id', companyId);

      if (updateErr) throw updateErr;

      // If receipt exists, sync to receipt as well
      if (entry.receipt_id) {
        await supabase
          .from('cash_receipts')
          .update({
            attachment_path: storagePath,
            source_doc_type: docType,
            source_doc_id: docId.trim(),
          })
          .eq('id', entry.receipt_id)
          .eq('company_id', companyId);
      }

      toast({
        title: 'Forrásdokumentum sikeresen csatolva!',
        description: `${selectedFile.name} feltöltve és hozzárendelve a bizonylathoz.`,
      });

      qc.invalidateQueries({ queryKey: queryKeys.pettyCashEntries(companyId) });
      onSuccess?.();
      onOpenChange(false);
    } catch (err: any) {
      console.error('File upload error:', err);
      toast({
        title: 'Hiba a feltöltés során',
        description: err.message || 'Nem sikerült feltölteni a dokumentumot.',
        variant: 'destructive',
      });
    } finally {
      setIsUploading(false);
    }
  };

  // Handle invoice link
  const linkInvoiceMutation = useMutation({
    mutationFn: async (invoice: OpenInvoiceItem) => {
      // 1. Link to petty_cash_entries
      const { error: pceErr } = await supabase
        .from('petty_cash_entries')
        .update({
          source_table: 'invoices',
          source_id: invoice.id,
          source_doc_type: 'invoice',
          source_doc_id: invoice.bizonylatsorszam,
        })
        .eq('id', entry.id)
        .eq('company_id', companyId);

      if (pceErr) throw pceErr;

      // 2. Mark invoice as paid
      const { error: invErr } = await supabase
        .from('invoices')
        .update({
          fizetve: true,
          fizetesi_mod: 'Készpénz',
          kifizetes_datuma: entry.entry_date,
        })
        .eq('id', invoice.id)
        .eq('company_id', companyId);

      if (invErr) throw invErr;

      // 3. If receipt exists, update receipt reference
      if (entry.receipt_id) {
        await supabase
          .from('cash_receipts')
          .update({
            source_doc_type: 'invoice',
            source_doc_id: invoice.bizonylatsorszam,
          })
          .eq('id', entry.receipt_id)
          .eq('company_id', companyId);
      }
    },
    onSuccess: () => {
      toast({
        title: 'Számla sikeresen csatolva!',
        description: 'A házipénztári tétel és a számla összerendelése megtörtént.',
      });
      qc.invalidateQueries({ queryKey: queryKeys.pettyCashEntries(companyId) });
      qc.invalidateQueries({ queryKey: ['open-settlement-invoices', companyId] });
      onSuccess?.();
      onOpenChange(false);
    },
    onError: (err: any) => {
      toast({
        title: 'Hiba a számla összerendelésekor',
        description: err.message,
        variant: 'destructive',
      });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[94vw] max-w-2xl max-h-[92vh] flex flex-col p-4 sm:p-6 gap-4">
        <DialogHeader className="pb-2 border-b border-border/60">
          <div className="flex items-center gap-2">
            <Paperclip className="w-5 h-5 text-primary" />
            <DialogTitle className="text-base sm:text-lg font-bold">
              {t('pettyCash:attach_doc.title', 'Forrásdokumentum Csatolása & Archiválása')}
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs text-muted-foreground mt-0.5">
            Mögöttes bizonylati fedezet (készpénzes számla, bérjegyzék, kiküldetés, banki elismervény) közvetlen rögzítése.
          </DialogDescription>
        </DialogHeader>

        {/* Selected Entry Overview Strip */}
        <div className="p-3 bg-muted/40 rounded-xl border border-border/70 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="space-y-0.5">
            <span className="text-muted-foreground font-medium block">
              {entry.entry_date} • {entry.receipt_number || 'Bizonylatszám függőben'}
            </span>
            <span className="font-semibold text-foreground text-sm">
              {entry.legal_title || entry.description || 'Pénztári tétel'}
            </span>
          </div>
          <div className="text-right">
            <Badge
              variant="outline"
              className={cn(
                'text-xs font-mono font-bold px-2 py-0.5',
                isExpense
                  ? 'border-destructive/40 text-destructive bg-destructive/10'
                  : 'border-emerald-500/40 text-emerald-600 bg-emerald-500/10'
              )}
            >
              {isExpense ? '-' : '+'}
              {fmtAmount(absEntryAmount, entry.currency)}
            </Badge>
          </div>
        </div>

        {/* Tab Switcher: Direct Upload vs Link Invoice */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-full flex-1 flex flex-col">
          <TabsList className="grid grid-cols-2 w-full h-9 p-1 bg-muted/60">
            <TabsTrigger value="upload" className="text-xs flex items-center gap-1.5">
              <UploadCloud className="w-3.5 h-3.5" />
              <span>Fotó / PDF Feltöltés</span>
            </TabsTrigger>
            <TabsTrigger value="link_invoice" className="text-xs flex items-center gap-1.5">
              <Receipt className="w-3.5 h-3.5" />
              <span>Meglévő Számla Csatolás</span>
            </TabsTrigger>
          </TabsList>

          {/* TAB 1: Direct File Upload */}
          <TabsContent value="upload" className="space-y-4 pt-3 flex-1">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-medium">Bizonylat Típusa *</Label>
                <Select value={docType} onValueChange={setDocType}>
                  <SelectTrigger className="h-9 mt-1 text-xs">
                    <SelectValue placeholder="Válassz bizonylattípust" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="invoice">Készpénzes számla / egyszerűsített számla</SelectItem>
                    <SelectItem value="payroll">Készpénzkifizetési jegyzék (munkabér/előleg)</SelectItem>
                    <SelectItem value="travel_order">Kiküldetési rendelvény / üzemanyag</SelectItem>
                    <SelectItem value="bank_withdrawal">Banki készpénzfelvételi bizonylat</SelectItem>
                    <SelectItem value="owner_loan">Tagi kölcsön szerződés / elismervény</SelectItem>
                    <SelectItem value="other">Egyéb számviteli bizonylat</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs font-medium">Forrásbizonylat Sorszáma / Iktatószáma *</Label>
                <Input
                  value={docId}
                  onChange={(e) => setDocId(e.target.value)}
                  placeholder="pl. SZ-2026-0042, BER-10, KIK-09"
                  className="h-9 mt-1 text-xs font-mono"
                />
              </div>
            </div>

            {/* Dropzone */}
            <div
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                  setSelectedFile(e.dataTransfer.files[0]);
                }
              }}
              className={cn(
                'border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-2',
                selectedFile
                  ? 'border-primary/60 bg-primary/5'
                  : 'border-border/80 hover:border-primary/50 hover:bg-muted/30'
              )}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/heic,application/pdf"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    setSelectedFile(e.target.files[0]);
                  }
                }}
              />
              {selectedFile ? (
                <div className="space-y-1">
                  <FileCheck className="w-8 h-8 text-primary mx-auto" />
                  <p className="text-xs font-semibold text-foreground">{selectedFile.name}</p>
                  <p className="text-[11px] text-muted-foreground font-mono">
                    {(selectedFile.size / 1024 / 1024).toFixed(2)} MB • Kattints a cseréhez
                  </p>
                </div>
              ) : (
                <div className="space-y-1">
                  <UploadCloud className="w-8 h-8 text-muted-foreground mx-auto" />
                  <p className="text-xs font-semibold text-foreground">
                    Húzd ide a fotót vagy PDF-et, vagy kattints a tallózáshoz
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    Támogatott formátumok: JPG, PNG, WEBP, PDF (max. 15 MB)
                  </p>
                </div>
              )}
            </div>

            {selectedFile && (
              <div className="flex justify-end">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedFile(null)}
                  className="text-xs text-destructive hover:text-destructive h-8"
                >
                  <Trash2 className="w-3.5 h-3.5 mr-1" />
                  Fájl eltávolítása
                </Button>
              </div>
            )}
          </TabsContent>

          {/* TAB 2: Link Existing Open Invoice */}
          <TabsContent value="link_invoice" className="space-y-3 pt-3 flex-1 flex flex-col min-h-0">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-muted-foreground" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Keresés bizonylatszám, partner vagy összeg szerint..."
                  className="h-8 pl-8 text-xs"
                />
              </div>
              <Select value={filterDirection} onValueChange={(v) => setFilterDirection(v as any)}>
                <SelectTrigger className="h-8 w-32 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Mindkét irány</SelectItem>
                  <SelectItem value="INBOUND">Bejövő (Kiadás)</SelectItem>
                  <SelectItem value="OUTBOUND">Kimenő (Bevétel)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Invoices List */}
            <div className="border border-border/80 rounded-xl overflow-y-auto max-h-64 flex-1 divide-y divide-border/50">
              {isLoadingInvoices ? (
                <div className="p-8 text-center text-xs text-muted-foreground flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-primary" />
                  Nyitott számlák betöltése...
                </div>
              ) : filteredInvoices.length === 0 ? (
                <div className="p-8 text-center text-xs text-muted-foreground">
                  Nincs a feltételeknek megfelelő nyitott számla.
                </div>
              ) : (
                filteredInvoices.map((inv) => {
                  const isSelected = selectedInvoiceId === inv.id;
                  const isExactAmount = Math.abs(inv.brutto_vegosszeg - absEntryAmount) < 0.01;

                  return (
                    <div
                      key={inv.id}
                      onClick={() => setSelectedInvoiceId(inv.id)}
                      className={cn(
                        'p-2.5 flex items-center justify-between gap-3 cursor-pointer transition-colors text-xs',
                        isSelected ? 'bg-primary/10' : 'hover:bg-muted/40'
                      )}
                    >
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono font-bold text-foreground">{inv.bizonylatsorszam}</span>
                          <Badge variant="outline" className="text-[9px] px-1 py-0">
                            {inv.invoice_direction === 'OUTBOUND' ? 'Kimenő' : 'Bejövő'}
                          </Badge>
                          {isExactAmount && (
                            <Badge variant="outline" className="text-[9px] border-emerald-500/40 text-emerald-600 bg-emerald-500/10 flex items-center gap-0.5">
                              <Sparkles className="w-2.5 h-2.5" />
                              Pontos egyezőség
                            </Badge>
                          )}
                        </div>
                        <div className="text-muted-foreground text-[11px]">{inv.partner_name}</div>
                      </div>

                      <div className="text-right">
                        <div className="font-mono font-bold text-foreground">
                          {fmtAmount(inv.brutto_vegosszeg, inv.penznem)}
                        </div>
                        {inv.fizetesi_hatarido && (
                          <div className="text-[10px] text-muted-foreground">
                            Esedékesség: {inv.fizetesi_hatarido}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </TabsContent>
        </Tabs>

        {/* Footer Actions */}
        <DialogFooter className="pt-2 border-t border-border/60 flex items-center justify-between sm:justify-between w-full">
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)} className="text-xs">
            {t('common:cancel', 'Mégse')}
          </Button>

          {activeTab === 'upload' ? (
            <Button
              size="sm"
              onClick={handleFileUpload}
              disabled={isUploading || !selectedFile || !docId.trim()}
              className="text-xs shadow-sm"
            >
              {isUploading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                  Feltöltés folyamatban...
                </>
              ) : (
                <>
                  <UploadCloud className="w-3.5 h-3.5 mr-1.5" />
                  Bizonylat feltöltése & Mentés
                </>
              )}
            </Button>
          ) : (
            <Button
              size="sm"
              onClick={() => {
                const target = openInvoices.find((i) => i.id === selectedInvoiceId);
                if (target) linkInvoiceMutation.mutate(target);
              }}
              disabled={linkInvoiceMutation.isPending || !selectedInvoiceId}
              className="text-xs shadow-sm"
            >
              {linkInvoiceMutation.isPending ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                  Összerendelés...
                </>
              ) : (
                <>
                  <FileCheck className="w-3.5 h-3.5 mr-1.5" />
                  Kiválasztott számla összerendelése
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
export default AttachSourceDocDialog;
