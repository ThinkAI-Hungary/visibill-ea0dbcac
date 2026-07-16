import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { formatCurrency } from '@/lib/utils';
import { format } from 'date-fns';
import { FileText, ExternalLink, Lock, Users, Plus, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { INVOICE_TYPE_LABELS } from '@/types/invoices';
import { reportError } from '@/lib/errorReporter';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';

interface InvoiceDetailPopupProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoiceId: string | null;
}

interface FullInvoice {
  id: string;
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
  hiba: 'Hiba',
};

const formatDate = (dateStr: string | null) => {
  if (!dateStr) return '-';
  try {
    return format(new Date(dateStr), 'yyyy.MM.dd');
  } catch {
    return dateStr;
  }
};

const formatDateTime = (dateStr: string | null) => {
  if (!dateStr) return '-';
  try {
    return format(new Date(dateStr), 'yyyy.MM.dd HH:mm');
  } catch {
    return dateStr;
  }
};

const DetailRow = ({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) => (
  <div className="flex justify-between items-start py-1.5 border-b border-border/20 last:border-0">
    <span className="text-muted-foreground text-xs shrink-0 mr-3">{label}</span>
    <span className={`text-xs text-right ${mono ? 'font-mono' : ''}`}>{value || '-'}</span>
  </div>
);

export const InvoiceDetailPopup = ({ open, onOpenChange, invoiceId }: InvoiceDetailPopupProps) => {
  const queryClient = useQueryClient();
  const [invoice, setInvoice] = useState<FullInvoice | null>(null);
  const [loading, setLoading] = useState(false);

  // Notes state
  const [notes, setNotes] = useState<any[]>([]);
  const [newNoteTitle, setNewNoteTitle] = useState('');
  const [newNoteText, setNewNoteText] = useState('');
  const [newNotePrivate, setNewNotePrivate] = useState(true);
  const [addingNote, setAddingNote] = useState(false);

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
          title: newNoteTitle.trim() || 'Számla feljegyzés',
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
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader className="pb-2">
          <DialogTitle className="flex items-center gap-2 text-base">
            <FileText className="h-4 w-4" />
            Számla részletei
          </DialogTitle>
          <DialogDescription className="text-xs">
            Az invoices táblában tárolt összes adat
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <LoadingSpinner />
          </div>
        ) : !invoice ? (
          <p className="text-muted-foreground text-sm text-center py-8">Számla nem található</p>
        ) : (
          <div className="space-y-4">
            {/* Header badges */}
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline">{invoiceTypeLabels[invoice.invoice_type] || invoice.invoice_type}</Badge>
              <Badge variant={invoice.statusz === 'feldolgozott' ? 'success' : 'secondary'}>
                {statusLabels[invoice.statusz || ''] || invoice.statusz || 'Ismeretlen'}
              </Badge>
              {!!invoice.transaction_id && <Badge variant="success">Fizetve</Badge>}
              {invoice.forditott_adozas && <Badge variant="outline">Fordított adózás</Badge>}
              {invoice.onszamlazas && <Badge variant="outline">Önszámlázás</Badge>}
              {invoice.penzforgalmi_elszamolas && <Badge variant="outline">Pénzforgalmi</Badge>}
            </div>

            {/* Alapadatok */}
            <div>
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Alapadatok</h4>
              <div className="bg-muted/30 rounded-md p-3 border border-border/30">
                <DetailRow label="Bizonylatsorszám" value={invoice.bizonylatsorszam} mono />
                <DetailRow label="Dokumentum azonosító" value={invoice.dokumentum_azonosito} mono />
                <DetailRow label="Kibocsátás dátuma" value={formatDate(invoice.kibocsatas_datuma)} />
                <DetailRow label="Teljesítés dátuma" value={formatDate(invoice.teljesites_datuma)} />
                <DetailRow label="Fizetési határidő" value={formatDate(invoice.fizetesi_hatarido)} />
                <DetailRow label="Fizetési mód" value={invoice.fizetesi_mod} />
                <DetailRow label="Termék/szolgáltatás típusa" value={invoice.termek_szolgaltatas_tipusa} />
              </div>
            </div>

            <Separator />

            {/* Eladó */}
            <div>
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Eladó</h4>
              <div className="bg-muted/30 rounded-md p-3 border border-border/30">
                <DetailRow label="Név" value={invoice.elado_nev} />
                <DetailRow label="Cím" value={invoice.elado_cim} />
                <DetailRow label="Adószám" value={invoice.elado_vat_id} mono />
              </div>
            </div>

            {/* Vevő */}
            <div>
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Vevő</h4>
              <div className="bg-muted/30 rounded-md p-3 border border-border/30">
                <DetailRow label="Név" value={invoice.vevo_nev} />
                <DetailRow label="Cím" value={invoice.vevo_cim} />
                <DetailRow label="Adószám" value={invoice.vevo_vat_id} mono />
              </div>
            </div>

            <Separator />

            {/* Összegek */}
            <div>
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Összegek</h4>
              <div className="bg-muted/30 rounded-md p-3 border border-border/30">
                <DetailRow label="Pénznem" value={invoice.penznem || 'HUF'} />
                <DetailRow label="Adóalap (nettó)" value={formatCurrency(invoice.adoalap_osszesen, invoice.penznem || 'HUF')} mono />
                <DetailRow label="ÁFA összeg" value={formatCurrency(invoice.afa_osszeg_osszesen, invoice.penznem || 'HUF')} mono />
                <DetailRow label="Bruttó végösszeg" value={
                  <span className="font-semibold">{formatCurrency(invoice.brutto_vegosszeg, invoice.penznem || 'HUF')}</span>
                } mono />
                {invoice.fizetendo_osszeg != null && (
                  <DetailRow label="Fizetendő összeg" value={formatCurrency(invoice.fizetendo_osszeg, invoice.penznem || 'HUF')} mono />
                )}
                {invoice.elszamolt_eloleg_osszeg != null && (
                  <DetailRow label="Elszámolt előleg" value={formatCurrency(invoice.elszamolt_eloleg_osszeg, invoice.penznem || 'HUF')} mono />
                )}
                {invoice.afa_kulcsok_bontasban && (
                  <DetailRow label="ÁFA kulcsok bontásban" value={invoice.afa_kulcsok_bontasban} />
                )}
              </div>
            </div>

            {/* Egyéb adatok */}
            {(invoice.bankszamlaszam_iban || invoice.elolegszamla_hivatkozas || invoice.adomentesseg_hivatkozas || invoice.adojogi_megjegyzes) && (
              <>
                <Separator />
                <div>
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Egyéb</h4>
                  <div className="bg-muted/30 rounded-md p-3 border border-border/30">
                    {invoice.bankszamlaszam_iban && <DetailRow label="Bankszámlaszám / IBAN" value={invoice.bankszamlaszam_iban} mono />}
                    {invoice.elolegszamla_hivatkozas && <DetailRow label="Előlegszámla hivatkozás" value={invoice.elolegszamla_hivatkozas} />}
                    {invoice.adomentesseg_hivatkozas && <DetailRow label="Adómentesség hivatkozás" value={invoice.adomentesseg_hivatkozas} />}
                    {invoice.adojogi_megjegyzes && <DetailRow label="Adójogi megjegyzés" value={invoice.adojogi_megjegyzes} />}
                  </div>
                </div>
              </>
            )}

            {/* Rendszer adatok */}
            <Separator />
            <div>
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Rendszer</h4>
              <div className="bg-muted/30 rounded-md p-3 border border-border/30">
                <DetailRow label="Létrehozva" value={formatDateTime(invoice.letrehozva)} />
                <DetailRow label="Frissítve" value={formatDateTime(invoice.frissitve)} />
                <DetailRow label="Feldolgozva" value={formatDateTime(invoice.feldolgozva)} />
                <DetailRow label="ID" value={invoice.id} mono />
              </div>
            </div>

            {/* Image/attachment links */}
            {(invoice.image_url || invoice.melleklet_url) && (
              <div className="flex gap-2 pt-1">
                {invoice.image_url && (
                  <Button variant="outline" size="sm" className="text-xs h-7" asChild>
                    <a href={invoice.image_url} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-3 w-3 mr-1" />
                      Számla kép
                    </a>
                  </Button>
                )}
                {invoice.melleklet_url && (
                  <Button variant="outline" size="sm" className="text-xs h-7" asChild>
                    <a href={invoice.melleklet_url} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-3 w-3 mr-1" />
                      Melléklet
                    </a>
                  </Button>
                )}
              </div>
            )}

            {/* Jegyzetek (Notes) Section */}
            <Separator />
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Jegyzetek / Megjegyzések ({notes.length})
                </h4>
              </div>

              {/* Notes List */}
              {notes.length > 0 ? (
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {notes.map((note) => (
                    <div
                      key={note.id}
                      className="bg-muted/40 border border-border/30 rounded-lg p-3 space-y-1.5 text-xs"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-foreground">{note.title}</span>
                        <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                          <span className="flex items-center gap-0.5">
                            {note.is_private ? (
                              <Lock className="h-2.5 w-2.5" />
                            ) : (
                              <Users className="h-2.5 w-2.5 text-primary" />
                            )}
                            {note.is_private ? 'Privát' : 'Közös'}
                          </span>
                          <span>•</span>
                          <span>{formatDateTime(note.created_at)}</span>
                        </div>
                      </div>
                      <p className="text-muted-foreground leading-relaxed whitespace-pre-wrap">
                        {note.content}
                      </p>
                      <div className="text-[10px] text-muted-foreground/80 flex items-center gap-1 pt-1 border-t border-border/10">
                        <span>Szerző: {note.profile_name}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground italic">Nincs még feljegyzés ehhez a számlához.</p>
              )}

              {/* Add Note Form */}
              <form onSubmit={handleAddNote} className="space-y-2 pt-2 border-t border-border/20">
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    placeholder="Jegyzet címe (opcionális)..."
                    value={newNoteTitle}
                    onChange={(e) => setNewNoteTitle(e.target.value)}
                    className="h-8 text-xs bg-background/50"
                  />
                  <div className="flex items-center gap-2 px-1">
                    <input
                      type="checkbox"
                      id="popup-note-private"
                      checked={!newNotePrivate}
                      onChange={(e) => setNewNotePrivate(!e.target.checked)}
                      className="rounded border-border bg-background text-primary focus:ring-primary w-3.5 h-3.5 cursor-pointer"
                    />
                    <label
                      htmlFor="popup-note-private"
                      className="text-xs text-muted-foreground select-none cursor-pointer"
                    >
                      Közös jegyzet (cégtagok látják)
                    </label>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Textarea
                    placeholder="Írd ide a megjegyzésedet..."
                    value={newNoteText}
                    onChange={(e) => setNewNoteText(e.target.value)}
                    required
                    rows={2}
                    className="text-xs bg-background/50 resize-none flex-1 min-h-[48px]"
                  />
                  <Button
                    type="submit"
                    size="sm"
                    className="self-end h-9 px-3 gap-1 shrink-0"
                    disabled={addingNote || !newNoteText.trim()}
                  >
                    {addingNote ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Plus className="h-3.5 w-3.5" />
                    )}
                    Hozzáadás
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
