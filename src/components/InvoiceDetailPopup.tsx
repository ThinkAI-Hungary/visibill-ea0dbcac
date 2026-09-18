import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { formatCurrency, cn } from '@/lib/utils';
import { getDateFnsLocale } from '@/lib/locale/formatters';
import { getPaymentStatusBadge } from '@/hooks/useComputedStatus';
import { format } from 'date-fns';
import { 
  FileText, 
  ExternalLink, 
  Lock, 
  Users, 
  Plus, 
  Loader2, 
  Pencil, 
  Check, 
  X, 
  AlertOctagon,
  Maximize2,
  Minimize2,
  Building2,
  Calendar,
  CreditCard,
  MessageSquare,
  Info
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { INVOICE_TYPE_LABELS } from '@/types/invoices';
import { reportError } from '@/lib/errorReporter';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useCompany } from '@/contexts/CompanyContext';
import { checkBuyerTaxMismatch } from '@/lib/invoiceMatchingUtils';

interface InvoiceDetailPopupProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoiceId: string | null;
}

interface FullInvoice {
  id: string;
  company_id: string;
  bizonylatsorszam: string;
  invoice_type: string;
  kibocsatas_datuma: string;
  teljesites_datuma: string | null;
  fizetesi_hatarido: string | null;
  fizetesi_mod: string | null;
  statusz: string | null;
  transaction_id: string | null;
  penznem: string | null;
  elado_nev: string;
  elado_cim: string | null;
  elado_vat_id: string | null;
  vevo_nev: string;
  vevo_cim: string | null;
  vevo_vat_id: string | null;
  adoalap_osszesen: number;
  afa_osszeg_osszesen: number;
  brutto_vegosszeg: number;
  fizetendo_osszeg: number | null;
  afa_kulcsok_bontasban: string | null;
  forditott_adozas: boolean | null;
  onszamlazas: boolean | null;
  penzforgalmi_elszamolas: boolean | null;
  adomentesseg_hivatkozas: string | null;
  adojogi_megjegyzes: string | null;
  bankszamlaszam_iban: string | null;
  dokumentum_azonosito: string | null;
  elolegszamla_hivatkozas: string | null;
  elszamolt_eloleg_osszeg: number | null;
  termek_szolgaltatas_tipusa: string | null;
  image_url: string | null;
  melleklet_url: string | null;
  letrehozva: string;
  frissitve: string;
  feldolgozva: string | null;
}

const invoiceTypeLabels = INVOICE_TYPE_LABELS;

const statusLabels: Record<string, string> = {
  feldolgozas_alatt: 'Feldolgozás alatt',
  feldolgozva: 'Feldolgozva',
  feldolgozott: 'Feldolgozva',
  jovahagyasra_var: 'Jóváhagyásra vár',
  jovahagyva: 'Jóváhagyva',
  elutasitva: 'Elutasítva',
  fizetesre_var: 'Fizetésre vár',
  fizetve: 'Fizetve',
  kifizetve: 'Kifizetve',
  nyitott: 'Nyitott',
  keses: 'Késedelmes',
  stornozva: 'Sztornózva',
  kontirozasra_var: 'Kontírozásra vár',
  hiba: 'Hiba',
};

const getStatusBadgeProps = (statusz: string | null): { variant?: 'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'warning'; className?: string } => {
  switch (statusz) {
    case 'feldolgozott':
    case 'feldolgozva':
    case 'jovahagyva':
    case 'fizetve':
    case 'kifizetve':
      return { variant: 'success' };
    case 'jovahagyasra_var':
      return { variant: 'warning', className: 'border-amber-500/30 text-amber-500 bg-amber-500/10' };
    case 'elutasitva':
    case 'hiba':
    case 'stornozva':
      return { variant: 'destructive' };
    case 'feldolgozas_alatt':
    case 'kontirozasra_var':
    case 'fizetesre_var':
      return { variant: 'outline', className: 'border-sky-500/30 text-sky-400 bg-sky-500/10' };
    default:
      return { variant: 'secondary' };
  }
};

const formatDate = (dateStr: string | null) => {
  if (!dateStr) return '-';
  try {
    return format(new Date(dateStr), 'yyyy.MM.dd', { locale: getDateFnsLocale() });
  } catch {
    return dateStr;
  }
};

const formatDateTime = (dateStr: string | null) => {
  if (!dateStr) return '-';
  try {
    return format(new Date(dateStr), 'yyyy.MM.dd HH:mm', { locale: getDateFnsLocale() });
  } catch {
    return dateStr;
  }
};

const DetailRow = ({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) => (
  <div className="flex justify-between items-start py-1 border-b border-border/15 last:border-0 gap-2">
    <span className="text-muted-foreground text-xs shrink-0">{label}</span>
    <span className={`text-xs text-right break-words ${mono ? 'font-mono' : ''}`}>
      {value !== null && value !== undefined && value !== '' ? value : '-'}
    </span>
  </div>
);

export const InvoiceDetailPopup = ({ open, onOpenChange, invoiceId }: InvoiceDetailPopupProps) => {
  const { t } = useTranslation(['invoices', 'common']);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { selectedCompany } = useCompany();
  const [invoice, setInvoice] = useState<FullInvoice | null>(null);
  const [loading, setLoading] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);

  const buyerMismatch = checkBuyerTaxMismatch(invoice, selectedCompany);

  // Bizonylatsorszám inline editing
  const [editingBizonylat, setEditingBizonylat] = useState(false);
  const [newBizonylatValue, setNewBizonylatValue] = useState('');
  const [savingBizonylat, setSavingBizonylat] = useState(false);

  // Notes state
  const [notes, setNotes] = useState<any[]>([]);
  const [newNoteTitle, setNewNoteTitle] = useState('');
  const [newNoteText, setNewNoteText] = useState('');
  const [newNotePrivate, setNewNotePrivate] = useState(true);
  const [addingNote, setAddingNote] = useState(false);

  const handleSaveBizonylatsorszam = async () => {
    if (!invoiceId || !newBizonylatValue.trim() || !invoice) return;
    setSavingBizonylat(true);
    try {
      const trimmed = newBizonylatValue.trim();
      const { error } = await supabase
        .from('invoices')
        .update({
          bizonylatsorszam: trimmed,
          frissitve: new Date().toISOString(),
        })
        .eq('id', invoiceId);

      if (error) {
        if (error.code === '23505') {
          throw new Error(t('invoices:dialogs.detail.toast_number_exists'));
        }
        throw error;
      }

      setEditingBizonylat(false);
      await fetchInvoice();
      queryClient.invalidateQueries({ queryKey: ['company-invoices'] });
      queryClient.invalidateQueries({ queryKey: ['submittedInvoices'] });
      queryClient.invalidateQueries({ queryKey: ['nav-invoices'] });
      queryClient.invalidateQueries({ queryKey: ['recentInvoices'] });
      queryClient.invalidateQueries({ queryKey: ['audit_logs'] });
      queryClient.invalidateQueries({ queryKey: ['audit_logs_enrichment'] });
      toast({
        title: t('invoices:dialogs.detail.toast_number_updated'),
        description: t('invoices:dialogs.detail.toast_number_updated_desc', { number: trimmed }),
      });
    } catch (err: any) {
      toast({
        title: t('invoices:dialogs.detail.toast_number_error'),
        description: err.message || t('invoices:dialogs.detail.toast_number_error'),
        variant: 'destructive',
      });
    } finally {
      setSavingBizonylat(false);
    }
  };

  useEffect(() => {
    if (open && invoiceId) {
      fetchInvoice();
      fetchNotes();
    }
    if (!open) {
      setInvoice(null);
      setNotes([]);
      setNewNoteTitle('');
      setNewNoteText('');
      setNewNotePrivate(true);
    }
  }, [open, invoiceId]);

  const fetchNotes = async () => {
    if (!invoiceId) return;
    try {
      const { data, error } = await supabase
        .from('notes')
        .select('*')
        .or(`invoice_id.eq.${invoiceId},invoice_ids.cs.{${invoiceId}}`)
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (data && data.length > 0) {
        const userIds = Array.from(new Set(data.map((n) => n.user_id)));
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, name')
          .in('user_id', userIds);

        const nameMap: Record<string, string> = {};
        (profiles || []).forEach((p) => {
          nameMap[p.user_id] = p.name || 'Névtelen';
        });

        setNotes(
          data.map((n) => ({
            ...n,
            profile_name: nameMap[n.user_id] || 'Ismeretlen',
          }))
        );
      } else {
        setNotes([]);
      }
    } catch (err) {
      console.error('Error fetching notes for invoice:', err);
    }
  };

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNoteText.trim() || !invoice) return;
    setAddingNote(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData.session?.user?.id;
      if (!userId) throw new Error('Unauthenticated');

      const { error } = await supabase
        .from('notes')
        .insert({
          company_id: invoice.company_id,
          user_id: userId,
          title: newNoteTitle.trim() || t('invoices:dialogs.detail.default_note_title'),
          content: newNoteText.trim(),
          is_private: newNotePrivate,
          invoice_id: invoiceId,
        });

      if (error) throw error;
      setNewNoteText('');
      setNewNoteTitle('');
      setNewNotePrivate(true);
      fetchNotes();
      queryClient.invalidateQueries({ queryKey: ['notes'] });
      queryClient.invalidateQueries({ queryKey: ['invoice-notes'] });
    } catch (err) {
      console.error('Error adding note:', err);
    } finally {
      setAddingNote(false);
    }
  };

  const fetchInvoice = async () => {
    if (!invoiceId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('invoices')
        .select('id, bizonylatsorszam, kibocsatas_datuma, teljesites_datuma, elado_nev, elado_cim, elado_vat_id, vevo_nev, vevo_cim, vevo_vat_id, adoalap_osszesen, brutto_vegosszeg, afa_osszeg_osszesen, penznem, fizetesi_mod, fizetesi_hatarido, fizetve, statusz, image_url, melleklet_url, invoice_direction, reference_number, category_id, project_id, transaction_id, afa_kulcsok_bontasban, forditott_adozas, onszamlazas, penzforgalmi_elszamolas, bankszamlaszam_iban, fizetendo_osszeg, invoice_type, termek_szolgaltatas_tipusa, adojogi_megjegyzes, adomentesseg_hivatkozas, dokumentum_azonosito, elolegszamla_hivatkozas, elszamolt_eloleg_osszeg, letrehozva, frissitve, company_id, email_uzenet_id, feldolgozva, invoice_uploads_id, user_id')
        .eq('id', invoiceId)
        .maybeSingle();

      if (error) throw error;
      setInvoice(data);
    } catch (error) {
      reportError({ type: 'db_query', component: 'InvoiceDetailPopup', action: 'error', message: 'Error fetching invoice details:', error: error });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        className={cn(
          "transition-all duration-200 flex flex-col p-5 max-h-[92vh] overflow-hidden",
          isMaximized 
            ? "w-[98vw] max-w-[98vw] h-[92vh]" 
            : "w-[95vw] max-w-5xl xl:max-w-6xl"
        )}
      >
        {/* Header Bar */}
        <div className="flex items-start justify-between gap-4 pb-2 border-b border-border/30 pr-8">
          <div className="space-y-1 min-w-0">
            <div className="flex items-center gap-2">
              <FileText className="h-4.5 w-4.5 text-primary shrink-0" />
              <DialogTitle className="text-base font-semibold truncate">
                {t('invoices:dialogs.detail.title')}
              </DialogTitle>
              {invoice?.bizonylatsorszam && (
                <span className="font-mono text-xs px-2 py-0.5 rounded bg-muted/60 text-muted-foreground shrink-0 border border-border/30">
                  {invoice.bizonylatsorszam}
                </span>
              )}
            </div>
            <DialogDescription className="text-xs text-muted-foreground truncate">
              {t('invoices:dialogs.detail.description')}
            </DialogDescription>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {invoice?.image_url && (
              <Button variant="outline" size="sm" className="h-7 text-xs gap-1.5 transition-colors duration-150" asChild>
                <a href={invoice.image_url} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-3 w-3" />
                  <span>{t('invoices:dialogs.detail.invoice_image')}</span>
                </a>
              </Button>
            )}
            {invoice?.melleklet_url && (
              <Button variant="outline" size="sm" className="h-7 text-xs gap-1.5 transition-colors duration-150" asChild>
                <a href={invoice.melleklet_url} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-3 w-3" />
                  <span>{t('invoices:dialogs.detail.attachment')}</span>
                </a>
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground transition-colors duration-150"
              onClick={() => setIsMaximized((prev) => !prev)}
              title={isMaximized ? "Normál szélesség" : "Teljes szélesség (scrollmentes)"}
              type="button"
            >
              {isMaximized ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <LoadingSpinner />
          </div>
        ) : !invoice ? (
          <p className="text-muted-foreground text-sm text-center py-12">{t('invoices:dialogs.detail.not_found')}</p>
        ) : (
          <div className="flex flex-col flex-1 min-h-0 space-y-3">
            {/* Header badges */}
            <div className="flex flex-wrap items-center gap-2 py-1 border-b border-border/20">
              <Badge variant="outline">{t(`invoices:types.${invoice.invoice_type}`, invoiceTypeLabels[invoice.invoice_type] || invoice.invoice_type)}</Badge>
              {(() => {
                const badgeProps = getStatusBadgeProps(invoice.statusz);
                return (
                  <Badge variant={badgeProps.variant} className={badgeProps.className}>
                    {t(`invoices:status.${invoice.statusz}`, statusLabels[invoice.statusz || ''] || invoice.statusz || 'Ismeretlen')}
                  </Badge>
                );
              })()}
              {(() => {
                if (!invoice.transaction_id && !(invoice as any).match_status) return null;
                const badge = getPaymentStatusBadge(invoice.transaction_id, (invoice as any).match_status);
                return (
                  <Badge variant="outline" className={cn(badge.className)}>
                    {badge.label}
                  </Badge>
                );
              })()}
              {invoice.forditott_adozas && <Badge variant="outline">{t('invoices:dialogs.detail.reverse_charge')}</Badge>}
              {invoice.onszamlazas && <Badge variant="outline">{t('invoices:dialogs.detail.self_billing')}</Badge>}
              {invoice.penzforgalmi_elszamolas && <Badge variant="outline">{t('invoices:dialogs.detail.cash_accounting')}</Badge>}
            </div>

            {/* Scrollable multi-column content */}
            <div className="flex-1 overflow-y-auto pr-1">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 items-start">
                
                {/* Oszlop 1: Alapadatok és Rendszeradatok */}
                <div className="space-y-3">
                  {/* Alapadatok kártya */}
                  <div className="rounded-lg border border-border/40 bg-card/60 p-3 space-y-1.5 shadow-sm">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider pb-1 border-b border-border/20">
                      <Calendar className="h-3.5 w-3.5 text-primary" />
                      <span>{t('invoices:dialogs.detail.basic_info')}</span>
                    </div>
                    <div className="space-y-0.5">
                      <DetailRow
                        label={t('invoices:dialogs.detail.invoice_number')}
                        value={
                          editingBizonylat ? (
                            <div className="flex items-center gap-1">
                              <Input
                                value={newBizonylatValue}
                                onChange={(e) => setNewBizonylatValue(e.target.value)}
                                className="h-6 w-36 text-xs font-mono py-0 px-1.5"
                                autoFocus
                                disabled={savingBizonylat}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleSaveBizonylatsorszam();
                                  if (e.key === 'Escape') setEditingBizonylat(false);
                                }}
                              />
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-6 w-6 p-0 text-emerald-600 hover:text-emerald-700 transition-colors duration-150"
                                disabled={savingBizonylat || !newBizonylatValue.trim()}
                                onClick={handleSaveBizonylatsorszam}
                              >
                                {savingBizonylat ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive transition-colors duration-150"
                                disabled={savingBizonylat}
                                onClick={() => setEditingBizonylat(false)}
                              >
                                <X className="h-3 w-3" />
                              </Button>
                            </div>
                          ) : (
                            <div className="flex items-center justify-end gap-1.5">
                              <span className="font-mono">{invoice.bizonylatsorszam || '-'}</span>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-5 w-5 p-0 opacity-60 hover:opacity-100 text-muted-foreground transition-colors duration-150"
                                title={t('invoices:dialogs.detail.edit_invoice_number')}
                                onClick={() => {
                                  setNewBizonylatValue(invoice.bizonylatsorszam || '');
                                  setEditingBizonylat(true);
                                }}
                              >
                                <Pencil className="h-3 w-3" />
                              </Button>
                            </div>
                          )
                        }
                        mono
                      />
                      <DetailRow label={t('invoices:dialogs.detail.document_id')} value={invoice.dokumentum_azonosito} mono />
                      <DetailRow label={t('invoices:dialogs.detail.issue_date')} value={formatDate(invoice.kibocsatas_datuma)} />
                      <DetailRow label={t('invoices:dialogs.detail.fulfillment_date')} value={formatDate(invoice.teljesites_datuma)} />
                      <DetailRow label={t('invoices:dialogs.detail.due_date')} value={formatDate(invoice.fizetesi_hatarido)} />
                      <DetailRow label={t('invoices:dialogs.detail.payment_method')} value={invoice.fizetesi_mod} />
                      <DetailRow label={t('invoices:dialogs.detail.product_service_type')} value={invoice.termek_szolgaltatas_tipusa} />
                    </div>
                  </div>

                  {/* Rendszer adatok kártya */}
                  <div className="rounded-lg border border-border/30 bg-muted/10 p-3 space-y-1.5">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider pb-1 border-b border-border/20">
                      <Info className="h-3.5 w-3.5 text-muted-foreground" />
                      <span>{t('invoices:dialogs.detail.system')}</span>
                    </div>
                    <div className="space-y-0.5 text-xs">
                      <DetailRow label={t('invoices:dialogs.detail.created_at')} value={formatDateTime(invoice.letrehozva)} />
                      <DetailRow label={t('invoices:dialogs.detail.updated_at')} value={formatDateTime(invoice.frissitve)} />
                      <DetailRow label={t('invoices:dialogs.detail.processed_at')} value={formatDateTime(invoice.feldolgozva)} />
                      <DetailRow label={t('invoices:dialogs.detail.id')} value={invoice.id} mono />
                    </div>
                  </div>
                </div>

                {/* Oszlop 2: Szereplők (Eladó & Vevő) és egyéb adatok */}
                <div className="space-y-3">
                  {/* Eladó */}
                  <div className="rounded-lg border border-border/40 bg-card/60 p-3 space-y-1.5 shadow-sm">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider pb-1 border-b border-border/20">
                      <Building2 className="h-3.5 w-3.5 text-primary" />
                      <span>{t('invoices:dialogs.detail.seller')}</span>
                    </div>
                    <div className="space-y-0.5">
                      <DetailRow label={t('invoices:dialogs.detail.name')} value={invoice.elado_nev} />
                      <DetailRow label={t('invoices:dialogs.detail.address')} value={invoice.elado_cim} />
                      <DetailRow label={t('invoices:dialogs.detail.tax_number')} value={invoice.elado_vat_id} mono />
                    </div>
                  </div>

                  {/* Vevő */}
                  <div className={cn(
                    "rounded-lg border p-3 space-y-1.5 shadow-sm transition-colors",
                    buyerMismatch.isMismatch
                      ? "bg-rose-50/40 dark:bg-rose-950/20 border-rose-300/70 dark:border-rose-800/70"
                      : "bg-card/60 border-border/40"
                  )}>
                    <div className="flex items-center justify-between pb-1 border-b border-border/20">
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        <Building2 className="h-3.5 w-3.5 text-primary" />
                        <span>{t('invoices:dialogs.detail.buyer')}</span>
                      </div>
                      {buyerMismatch.isMismatch && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-sans font-semibold bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-300/60 dark:border-rose-700/60">
                          <AlertOctagon className="h-3 w-3" />
                          Eltérő vevő
                        </span>
                      )}
                    </div>
                    {buyerMismatch.isMismatch && (
                      <div className="p-2 rounded bg-rose-100/70 dark:bg-rose-900/30 text-[11px] text-rose-800 dark:text-rose-200 border border-rose-200 dark:border-rose-800/50 flex items-start gap-1.5">
                        <AlertOctagon className="h-3.5 w-3.5 shrink-0 text-rose-600 mt-0.5" />
                        <div>
                          <strong>Figyelem:</strong> A vevő nem egyezik az aktív céggel ({selectedCompany?.name || '-'}, {selectedCompany?.tax_number || '-'})!
                        </div>
                      </div>
                    )}
                    <div className="space-y-0.5">
                      <DetailRow label={t('invoices:dialogs.detail.name')} value={invoice.vevo_nev} />
                      <DetailRow label={t('invoices:dialogs.detail.address')} value={invoice.vevo_cim} />
                      <DetailRow label={t('invoices:dialogs.detail.tax_number')} value={invoice.vevo_vat_id} mono />
                    </div>
                  </div>

                  {/* Egyéb adatok (ha van) */}
                  {(invoice.bankszamlaszam_iban || invoice.elolegszamla_hivatkozas || invoice.adomentesseg_hivatkozas || invoice.adojogi_megjegyzes) && (
                    <div className="rounded-lg border border-border/40 bg-card/60 p-3 space-y-1.5 shadow-sm">
                      <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider pb-1 border-b border-border/20">
                        {t('invoices:dialogs.detail.other')}
                      </div>
                      <div className="space-y-0.5">
                        {invoice.bankszamlaszam_iban && <DetailRow label={t('invoices:dialogs.detail.iban')} value={invoice.bankszamlaszam_iban} mono />}
                        {invoice.elolegszamla_hivatkozas && <DetailRow label={t('invoices:dialogs.detail.advance_invoice_ref')} value={invoice.elolegszamla_hivatkozas} />}
                        {invoice.adomentesseg_hivatkozas && <DetailRow label={t('invoices:dialogs.detail.tax_exemption_ref')} value={invoice.adomentesseg_hivatkozas} />}
                        {invoice.adojogi_megjegyzes && <DetailRow label={t('invoices:dialogs.detail.tax_legal_note')} value={invoice.adojogi_megjegyzes} />}
                      </div>
                    </div>
                  )}
                </div>

                {/* Oszlop 3: Összegek & Jegyzetek */}
                <div className="space-y-3">
                  {/* Összegek */}
                  <div className="rounded-lg border border-border/40 bg-card/60 p-3 space-y-1.5 shadow-sm">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider pb-1 border-b border-border/20">
                      <CreditCard className="h-3.5 w-3.5 text-primary" />
                      <span>{t('invoices:dialogs.detail.amounts')}</span>
                    </div>
                    <div className="space-y-0.5">
                      <DetailRow label={t('invoices:dialogs.detail.currency')} value={invoice.penznem || 'HUF'} />
                      <DetailRow label={t('invoices:dialogs.detail.tax_base_net')} value={formatCurrency(invoice.adoalap_osszesen, invoice.penznem || 'HUF')} mono />
                      <DetailRow label={t('invoices:dialogs.detail.vat_amount')} value={formatCurrency(invoice.afa_osszeg_osszesen, invoice.penznem || 'HUF')} mono />
                      
                      {/* Kiemelt Bruttó Végösszeg */}
                      <div className="rounded-md border border-primary/20 bg-primary/5 px-3 py-2 flex items-center justify-between my-1.5">
                        <span className="text-xs font-semibold text-foreground">{t('invoices:dialogs.detail.gross_amount')}</span>
                        <span className="text-sm font-bold font-mono text-primary">
                          {formatCurrency(invoice.brutto_vegosszeg, invoice.penznem || 'HUF')}
                        </span>
                      </div>

                      {invoice.fizetendo_osszeg != null && (
                        <DetailRow label={t('invoices:dialogs.detail.payable_amount')} value={formatCurrency(invoice.fizetendo_osszeg, invoice.penznem || 'HUF')} mono />
                      )}
                      {invoice.elszamolt_eloleg_osszeg != null && (
                        <DetailRow label={t('invoices:dialogs.detail.advance_settled')} value={formatCurrency(invoice.elszamolt_eloleg_osszeg, invoice.penznem || 'HUF')} mono />
                      )}
                      {invoice.afa_kulcsok_bontasban && (
                        <DetailRow label={t('invoices:dialogs.detail.vat_rates_breakdown')} value={invoice.afa_kulcsok_bontasban} />
                      )}
                    </div>
                  </div>

                  {/* Jegyzetek (Notes) */}
                  <div className="rounded-lg border border-border/40 bg-card/60 p-3 space-y-2 shadow-sm">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider pb-1 border-b border-border/20">
                      <MessageSquare className="h-3.5 w-3.5 text-primary" />
                      <span>{t('invoices:dialogs.detail.notes_count', { count: notes.length })}</span>
                    </div>

                    {/* Notes List */}
                    {notes.length > 0 ? (
                      <div className="space-y-1.5 max-h-32 overflow-y-auto pr-1">
                        {notes.map((note) => (
                          <div
                            key={note.id}
                            className="bg-muted/30 border border-border/30 rounded-md p-2 space-y-1 text-xs"
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-semibold text-foreground text-xs">{note.title}</span>
                              <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                                <span className="flex items-center gap-0.5">
                                  {note.is_private ? (
                                    <Lock className="h-2.5 w-2.5" />
                                  ) : (
                                    <Users className="h-2.5 w-2.5 text-primary" />
                                  )}
                                  {note.is_private ? t('invoices:dialogs.detail.private') : t('invoices:dialogs.detail.shared')}
                                </span>
                                <span>•</span>
                                <span>{formatDateTime(note.created_at)}</span>
                              </div>
                            </div>
                            <p className="text-muted-foreground text-xs leading-relaxed whitespace-pre-wrap">
                              {note.content}
                            </p>
                            <div className="text-[10px] text-muted-foreground/80 pt-0.5 border-t border-border/10">
                              {t('invoices:dialogs.detail.author', { name: note.profile_name })}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground italic py-0.5">{t('invoices:dialogs.detail.no_notes')}</p>
                    )}

                    {/* Add Note Form */}
                    <form onSubmit={handleAddNote} className="space-y-1.5 pt-1.5 border-t border-border/20">
                      <div className="grid grid-cols-2 gap-1.5">
                        <Input
                          placeholder={t('invoices:dialogs.detail.note_title_placeholder')}
                          value={newNoteTitle}
                          onChange={(e) => setNewNoteTitle(e.target.value)}
                          className="h-7 text-xs bg-background/50"
                        />
                        <div className="flex items-center gap-1.5 px-1">
                          <input
                            type="checkbox"
                            id="popup-note-private"
                            checked={!newNotePrivate}
                            onChange={(e) => setNewNotePrivate(!e.target.checked)}
                            className="rounded border-border bg-background text-primary focus:ring-primary w-3.5 h-3.5 cursor-pointer"
                          />
                          <label
                            htmlFor="popup-note-private"
                            className="text-[11px] text-muted-foreground select-none cursor-pointer truncate"
                          >
                            {t('invoices:dialogs.detail.shared_note_checkbox')}
                          </label>
                        </div>
                      </div>
                      <div className="flex gap-1.5">
                        <Textarea
                          placeholder={t('invoices:dialogs.detail.note_content_placeholder')}
                          value={newNoteText}
                          onChange={(e) => setNewNoteText(e.target.value)}
                          required
                          rows={2}
                          className="text-xs bg-background/50 resize-none flex-1 min-h-[38px] py-1"
                        />
                        <Button
                          type="submit"
                          size="sm"
                          className="self-end h-7 px-2.5 gap-1 shrink-0 text-xs transition-colors duration-150"
                          disabled={addingNote || !newNoteText.trim()}
                        >
                          {addingNote ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <Plus className="h-3 w-3" />
                          )}
                          {t('common:actions.add')}
                        </Button>
                      </div>
                    </form>
                  </div>
                </div>

              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
