import React, { useState, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { useNotesData } from '@/hooks/useNotesData';
import { NoteModal } from '@/components/notes/NoteModal';
import { InvoiceDetailPopup } from '@/components/InvoiceDetailPopup';
import { TransactionDetailsDialog } from '@/components/TransactionDetailsDialog';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { Note } from '../types/notes';
import {
  Search,
  Plus,
  Lock,
  Users,
  FileText,
  ExternalLink,
  Edit3,
  Trash2,
  ClipboardCheck,
  ChevronRight,
  User,
  Calendar,
  AlertCircle,
  ClipboardEdit,
  Wallet,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useTranslation } from 'react-i18next';
import { formatCurrency } from '@/lib/utils';

export default function NotesPage() {
  const { t, i18n } = useTranslation(['notes', 'navigation', 'common']);
  const isHr = i18n.language === 'hr';
  const localeCode = isHr ? 'hr-HR' : 'hu-HU';
  const { companyId } = useParams<{ companyId: string }>();
  const { notes, isLoading, addNote, updateNote, deleteNote } = useNotesData(companyId);
  const { toast } = useToast();

  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'all' | 'private' | 'shared' | 'invoice'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingNote, setEditingNote] = useState<Note | null>(null);
  const [viewInvoiceId, setViewInvoiceId] = useState<string | null>(null);
  const [viewTransaction, setViewTransaction] = useState<any | null>(null);

  // Filtered Notes
  const filteredNotes = useMemo(() => {
    return notes.filter((note) => {
      // 1. Tab filter
      if (activeTab === 'private' && !note.is_private) return false;
      if (activeTab === 'shared' && note.is_private) return false;
      if (activeTab === 'invoice' && !note.invoice_id && (!note.invoice_ids || note.invoice_ids.length === 0)) return false;

      // 2. Search query filter
      if (searchQuery.trim() === '') return true;
      const query = searchQuery.toLowerCase();
      const titleMatch = note.title.toLowerCase().includes(query);
      const contentMatch = note.content.toLowerCase().includes(query);
      
      const invoiceNumberMatch = note.invoices?.some((inv: any) => 
        inv.invoice_number?.toLowerCase().includes(query)
      ) ?? false;
      
      const supplierNameMatch = note.invoices?.some((inv: any) => 
        inv.supplier_name?.toLowerCase().includes(query)
      ) ?? false;

      const txDescMatch = note.transactions?.some((tx: any) => 
        tx.description?.toLowerCase().includes(query)
      ) ?? false;

      return titleMatch || contentMatch || invoiceNumberMatch || supplierNameMatch || txDescMatch;
    });
  }, [notes, activeTab, searchQuery]);

  // Selected Note (defaults to the first filtered note if current selection is invalid or null)
  const selectedNote = useMemo(() => {
    if (selectedNoteId) {
      const found = filteredNotes.find((n) => n.id === selectedNoteId);
      if (found) return found;
    }
    return filteredNotes[0] || null;
  }, [filteredNotes, selectedNoteId]);

  // Actions
  const handleCreateNote = () => {
    setEditingNote(null);
    setModalOpen(true);
  };

  const handleEditNote = (note: Note) => {
    setEditingNote(note);
    setModalOpen(true);
  };

  const handleDeleteNote = async (noteId: string) => {
    if (!window.confirm('Biztosan törölni szeretnéd ezt a jegyzetet?')) return;
    try {
      await deleteNote.mutateAsync(noteId);
      toast({
        title: 'Sikeres törlés',
        description: 'Jegyzet sikeresen eltávolítva.',
      });
      if (selectedNoteId === noteId) {
        setSelectedNoteId(null);
      }
    } catch (err: any) {
      toast({
        title: 'Hiba történt',
        description: err.message || 'Nem sikerült törölni a jegyzetet.',
        variant: 'destructive',
      });
    }
  };

  const handleSaveNote = async (params: {
    title: string;
    content: string;
    is_private: boolean;
    invoice_id: string | null;
    invoice_ids: string[];
    transaction_id: string | null;
    transaction_ids: string[];
  }) => {
    try {
      if (editingNote) {
        await updateNote.mutateAsync({
          id: editingNote.id,
          ...params,
        });
        toast({
          title: 'Sikeres módosítás',
          description: 'A jegyzet sikeresen frissítve lett.',
        });
      } else {
        const newNote = await addNote.mutateAsync(params);
        toast({
          title: 'Sikeres rögzítés',
          description: 'Új jegyzet sikeresen rögzítve.',
        });
        if (newNote?.id) {
          setSelectedNoteId(newNote.id);
        }
      }
      setModalOpen(false);
    } catch (err: any) {
      toast({
        title: 'Mentési hiba',
        description: err.message || 'Hiba történt a mentés során.',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-100px)] max-h-[calc(100vh-100px)] border border-border/40 rounded-xl bg-card overflow-hidden">
      {/* Top Header Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-4 border-b border-border/30 gap-4 bg-muted/20">
        <div className="flex items-center gap-2">
          <ClipboardEdit className="h-5 w-5 text-primary" />
          <h2 className="text-base font-semibold text-foreground">{t('navigation:items.notes', { defaultValue: 'Jegyzetek' })}</h2>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative w-64">
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              type="text"
              placeholder={t('common:actions.search', { defaultValue: 'Keresés...' })}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-9 text-xs bg-background/50 focus:bg-background transition-colors"
            />
          </div>
          <Button onClick={handleCreateNote} size="sm" className="h-9 gap-1">
            <Plus className="h-4 w-4" />
            {t('common:actions.new_note', { defaultValue: 'Új jegyzet' })}
          </Button>
        </div>
      </div>

      {/* Main Workspace Split Pane */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Side: Notes List Panel */}
        <div className="w-80 border-r border-border/30 flex flex-col bg-card/50">
          {/* Tab category filters */}
          <div className="p-3 border-b border-border/30 flex flex-wrap gap-1 bg-muted/10">
            <button
              onClick={() => { setActiveTab('all'); setSelectedNoteId(null); }}
              className={`px-2.5 py-1 text-xs font-medium rounded-full transition-all ${
                activeTab === 'all'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground'
              }`}
            >
              {t('notes:tabs.all', { defaultValue: 'Összes' })}
            </button>
            <button
              onClick={() => { setActiveTab('private'); setSelectedNoteId(null); }}
              className={`px-2.5 py-1 text-xs font-medium rounded-full transition-all ${
                activeTab === 'private'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground'
              }`}
            >
              {t('notes:tabs.private', { defaultValue: 'Privát' })}
            </button>
            <button
              onClick={() => { setActiveTab('shared'); setSelectedNoteId(null); }}
              className={`px-2.5 py-1 text-xs font-medium rounded-full transition-all ${
                activeTab === 'shared'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground'
              }`}
            >
              {t('notes:tabs.shared', { defaultValue: 'Közös' })}
            </button>
            <button
              onClick={() => { setActiveTab('invoice'); setSelectedNoteId(null); }}
              className={`px-2.5 py-1 text-xs font-medium rounded-full transition-all ${
                activeTab === 'invoice'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground'
              }`}
            >
              {t('notes:tabs.invoice', { defaultValue: 'Számla' })}
            </button>
          </div>

          {/* Scrollable list */}
          <div className="flex-1 overflow-y-auto divide-y divide-border/30">
            {isLoading ? (
              <div className="p-8 text-center text-muted-foreground text-sm">
                {t('notes:list.loading', { defaultValue: 'Jegyzetek betöltése...' })}
              </div>
            ) : filteredNotes.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground text-sm flex flex-col items-center gap-2">
                <AlertCircle className="h-6 w-6 text-muted-foreground/60" />
                <span>{t('notes:list.no_results', { defaultValue: 'Nincs találat' })}</span>
              </div>
            ) : (
              filteredNotes.map((note) => {
                const isSelected = selectedNote?.id === note.id;
                return (
                  <div
                    key={note.id}
                    onClick={() => setSelectedNoteId(note.id)}
                    className={`p-4 cursor-pointer transition-all border-l-2 relative ${
                      isSelected
                        ? 'bg-primary/5 border-l-primary'
                        : 'border-l-transparent hover:bg-muted/20'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded flex items-center gap-1 ${
                        note.is_private
                          ? 'bg-muted text-muted-foreground'
                          : 'bg-primary/10 text-primary'
                      }`}>
                        {note.is_private ? (
                          <Lock className="h-2.5 w-2.5" />
                        ) : (
                          <Users className="h-2.5 w-2.5" />
                        )}
                        {note.is_private ? t('notes:list.private_badge', { defaultValue: 'Privát' }) : t('notes:list.shared_badge', { defaultValue: 'Közös' })}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        {new Date(note.created_at).toLocaleDateString(localeCode, {
                          month: 'short',
                          day: 'numeric',
                        })}
                      </span>
                    </div>

                    <h4 className="font-medium text-sm text-foreground truncate mb-1">
                      {note.title || t('notes:list.untitled', { defaultValue: 'Cím nélküli' })}
                    </h4>
                    
                    <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                      {note.content}
                    </p>

                    {note.invoices && note.invoices.length > 0 && (
                      <div className="mt-2 flex items-center gap-1 text-[10px] text-primary/80 font-medium">
                        <FileText className="h-3 w-3" />
                        <span>
                          {note.invoices.length === 1
                            ? t('notes:list.invoice_single', { number: note.invoices[0].invoice_number || t('notes:list.no_invoice_number', { defaultValue: 'Nincs sorszám' }), defaultValue: `Számla: ${note.invoices[0].invoice_number || 'Nincs sorszám'}` })
                            : t('notes:list.invoice_multi', { count: note.invoices.length, defaultValue: `${note.invoices.length} db számla csatolva` })}
                        </span>
                      </div>
                    )}

                    {note.transactions && note.transactions.length > 0 && (
                      <div className="mt-1 flex items-center gap-1 text-[10px] text-teal-600/80 dark:text-teal-400/80 font-medium">
                        <Wallet className="h-3 w-3" />
                        <span>
                          {note.transactions.length === 1
                            ? t('notes:list.tx_single', { desc: note.transactions[0].description || t('notes:list.no_tx_description', { defaultValue: 'Nincs leírás' }), defaultValue: `Tranzakció: ${note.transactions[0].description || 'Nincs leírás'}` })
                            : t('notes:list.tx_multi', { count: note.transactions.length, defaultValue: `${note.transactions.length} db tranzakció csatolva` })}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Detail Pane */}
        <div className="flex-1 bg-card/5 overflow-y-auto p-8">
          {selectedNote ? (
            <div className="max-w-2xl mx-auto space-y-6">
              {/* Detail Header */}
              <div className="border-b border-border/50 pb-5 flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded flex items-center gap-1.5 ${
                      selectedNote.is_private
                        ? 'bg-muted text-muted-foreground'
                        : 'bg-primary/10 text-primary'
                    }`}>
                      {selectedNote.is_private ? (
                        <Lock className="h-3 w-3" />
                      ) : (
                        <Users className="h-3 w-3" />
                      )}
                      {selectedNote.is_private ? t('notes:detail.private_note', { defaultValue: 'Privát jegyzet' }) : t('notes:detail.shared_note', { defaultValue: 'Közös cégjegyzet' })}
                    </span>
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Calendar className="h-3.5 w-3.5" />
                      {t('notes:detail.updated', {
                        date: new Date(selectedNote.updated_at).toLocaleString(localeCode),
                        defaultValue: `Frissítve: ${new Date(selectedNote.updated_at).toLocaleString(localeCode)}`
                      })}
                    </span>
                  </div>
                  <h2 className="text-2xl font-semibold text-foreground tracking-tight">
                    {selectedNote.title}
                  </h2>
                </div>

                {/* Edit & Delete Controls */}
                {!selectedNote.is_line_item_note && (
                  <div className="flex items-center gap-1.5">
                    <Button
                      onClick={() => handleEditNote(selectedNote)}
                      variant="outline"
                      size="sm"
                      className="h-8 gap-1 text-xs"
                    >
                      <Edit3 className="h-3.5 w-3.5" />
                      {t('common:actions.edit', { defaultValue: 'Szerkesztés' })}
                    </Button>
                    <Button
                      onClick={() => handleDeleteNote(selectedNote.id)}
                      variant="outline"
                      size="sm"
                      className="h-8 gap-1 text-xs text-destructive hover:text-destructive hover:bg-destructive/5"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      {t('common:actions.delete', { defaultValue: 'Törlés' })}
                    </Button>
                  </div>
                )}
              </div>

              {/* Note Content */}
              <div className="py-2">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                  {t('notes:detail.content', { defaultValue: 'Tartalom' })}
                </h4>
                <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap bg-card/30 p-4 rounded-lg border border-border/30">
                  {selectedNote.content}
                </p>
              </div>

              {/* Attached Invoices Details */}
              {selectedNote.invoices && selectedNote.invoices.length > 0 && (
                <div className="space-y-3">
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    {t('notes:detail.related_invoices', { count: selectedNote.invoices.length, defaultValue: `Kapcsolódó számlák (${selectedNote.invoices.length})` })}
                  </h4>
                  <div className="grid grid-cols-1 gap-2.5">
                    {selectedNote.invoices.map((inv: any) => (
                      <div
                        key={inv.id}
                        className="border border-border/50 rounded-xl bg-card/40 p-4 shadow-sm flex items-start gap-4"
                      >
                        <div className="p-2.5 rounded-lg bg-primary/10 text-primary shrink-0 mt-0.5">
                          <FileText className="h-5 w-5" />
                        </div>
                        <div className="flex-1 grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                          <div>
                            <span className="text-muted-foreground block text-[10px]">{t('notes:detail.invoice_number', { defaultValue: 'Számlaszám' })}</span>
                            <span className="font-semibold text-foreground font-mono">
                              {inv.invoice_number || '—'}
                            </span>
                          </div>
                          <div>
                            <span className="text-muted-foreground block text-[10px]">{t('notes:detail.partner', { defaultValue: 'Partner' })}</span>
                            <span className="font-semibold text-foreground">
                              {inv.supplier_name || '—'}
                            </span>
                          </div>
                          <div>
                            <span className="text-muted-foreground block text-[10px]">{t('notes:detail.amount', { defaultValue: 'Összeg' })}</span>
                            <span className="font-semibold text-foreground font-mono">
                              {inv.net_amount != null ? formatCurrency(inv.net_amount, inv.currency) : '—'}
                            </span>
                          </div>
                          <div>
                            <span className="text-muted-foreground block text-[10px]">{t('notes:detail.invoice_date', { defaultValue: 'Számla kelte' })}</span>
                            <span className="font-semibold text-foreground">
                              {inv.invoice_date || '—'}
                            </span>
                          </div>
                        </div>
                        <Button
                          onClick={() => setViewInvoiceId(inv.id)}
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-primary hover:bg-primary/10 shrink-0 self-center"
                          title={t('notes:detail.open_invoice', { defaultValue: 'Számla megnyitása' })}
                        >
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Attached Transactions Details */}
              {selectedNote.transactions && selectedNote.transactions.length > 0 && (
                <div className="space-y-3">
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    {t('notes:detail.related_transactions', { count: selectedNote.transactions.length, defaultValue: `Kapcsolódó tranzakciók (${selectedNote.transactions.length})` })}
                  </h4>
                  <div className="grid grid-cols-1 gap-2.5">
                    {selectedNote.transactions.map((tx: any) => (
                      <div
                        key={tx.id}
                        className="border border-border/50 rounded-xl bg-card/40 p-4 shadow-sm flex items-start gap-4"
                      >
                        <div className="p-2.5 rounded-lg bg-teal-500/10 text-teal-600 dark:text-teal-400 shrink-0 mt-0.5">
                          <Wallet className="h-5 w-5" />
                        </div>
                        <div className="flex-1 grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                          <div className="col-span-2">
                            <span className="text-muted-foreground block text-[10px]">{t('notes:detail.description_partner', { defaultValue: 'Leírás / Partner' })}</span>
                            <span className="font-semibold text-foreground truncate block">
                              {tx.description || '—'}
                            </span>
                          </div>
                          <div>
                            <span className="text-muted-foreground block text-[10px]">{t('notes:detail.amount', { defaultValue: 'Összeg' })}</span>
                            <span className="font-semibold text-foreground font-mono">
                              {tx.amount != null ? formatCurrency(tx.amount, tx.currency) : '—'}
                            </span>
                          </div>
                          <div>
                            <span className="text-muted-foreground block text-[10px]">{t('notes:detail.date', { defaultValue: 'Dátum' })}</span>
                            <span className="font-semibold text-foreground">
                              {tx.transaction_date || '—'}
                            </span>
                          </div>
                        </div>
                        <Button
                          onClick={() => setViewTransaction({
                            ...tx,
                            company_id: companyId
                          })}
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-primary hover:bg-primary/10 shrink-0 self-center"
                          title={t('notes:detail.open_transaction', { defaultValue: 'Tranzakció megnyitása' })}
                        >
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Metadata / Owner Info */}
              <div className="border-t border-border/30 pt-4 flex items-center justify-between text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <User className="h-3.5 w-3.5" />
                  {selectedNote.is_line_item_note ? (
                    <span>{t('notes:detail.line_item_note_hint', { defaultValue: 'Típus: Számlatétel jegyzet (a számla részleteinél módosítható)' })}</span>
                  ) : (
                    <span>{t('notes:detail.recorded_by', { name: selectedNote.profiles?.full_name || t('notes:detail.unknown', { defaultValue: 'Ismeretlen' }), defaultValue: `Rögzítette: ${selectedNote.profiles?.full_name || 'Ismeretlen'}` })}</span>
                  )}
                </span>
              </div>
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-muted-foreground gap-2">
              <ClipboardCheck className="h-12 w-12 text-muted-foreground/30" />
              <p className="text-sm">{t('notes:detail.no_note_selected', { defaultValue: 'Nincs kiválasztott jegyzet' })}</p>
              <Button onClick={handleCreateNote} variant="outline" size="sm" className="mt-2">
                {t('notes:detail.create_one_now', { defaultValue: 'Hozz létre egyet most' })}
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* New/Edit Note Dialog */}
      <NoteModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        note={editingNote}
        companyId={companyId}
        onSave={handleSaveNote}
        isSaving={addNote.isPending || updateNote.isPending}
      />

      {/* Invoice Detail Viewer */}
      {viewInvoiceId && (
        <InvoiceDetailPopup
          open={!!viewInvoiceId}
          onOpenChange={(open) => !open && setViewInvoiceId(null)}
          invoiceId={viewInvoiceId}
        />
      )}

      {/* Transaction Details Dialog */}
      {viewTransaction && (
        <TransactionDetailsDialog
          open={!!viewTransaction}
          onOpenChange={(open) => !open && setViewTransaction(null)}
          transaction={viewTransaction}
          companyId={companyId!}
          onUpdate={() => {}}
        />
      )}
    </div>
  );
}
