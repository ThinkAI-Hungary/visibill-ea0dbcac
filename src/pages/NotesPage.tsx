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

export default function NotesPage() {
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
          <h2 className="text-base font-semibold text-foreground">Jegyzetek & Feljegyzések</h2>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative w-64">
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Keresés a jegyzetekben..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-9 text-xs bg-background/50 focus:bg-background transition-colors"
            />
          </div>
          <Button onClick={handleCreateNote} size="sm" className="h-9 gap-1">
            <Plus className="h-4 w-4" />
            Új jegyzet
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
              Összes
            </button>
            <button
              onClick={() => { setActiveTab('private'); setSelectedNoteId(null); }}
              className={`px-2.5 py-1 text-xs font-medium rounded-full transition-all ${
                activeTab === 'private'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground'
              }`}
            >
              Privát
            </button>
            <button
              onClick={() => { setActiveTab('shared'); setSelectedNoteId(null); }}
              className={`px-2.5 py-1 text-xs font-medium rounded-full transition-all ${
                activeTab === 'shared'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground'
              }`}
            >
              Közös
            </button>
            <button
              onClick={() => { setActiveTab('invoice'); setSelectedNoteId(null); }}
              className={`px-2.5 py-1 text-xs font-medium rounded-full transition-all ${
                activeTab === 'invoice'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground'
              }`}
            >
              Számla
            </button>
          </div>

          {/* Scrollable list */}
          <div className="flex-1 overflow-y-auto divide-y divide-border/30">
            {isLoading ? (
              <div className="p-8 text-center text-muted-foreground text-sm">
                Jegyzetek betöltése...
              </div>
            ) : filteredNotes.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground text-sm flex flex-col items-center gap-2">
                <AlertCircle className="h-6 w-6 text-muted-foreground/60" />
                <span>Nincs találat</span>
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
                        {note.is_private ? 'Privát' : 'Közös'}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        {new Date(note.created_at).toLocaleDateString('hu-HU', {
                          month: 'short',
                          day: 'numeric',
                        })}
                      </span>
                    </div>

                    <h4 className="font-medium text-sm text-foreground truncate mb-1">
                      {note.title || 'Cím nélküli'}
                    </h4>
                    
                    <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                      {note.content}
                    </p>

                    {note.invoices && note.invoices.length > 0 && (
                      <div className="mt-2 flex items-center gap-1 text-[10px] text-primary/80 font-medium">
                        <FileText className="h-3 w-3" />
                        <span>
                          {note.invoices.length === 1
                            ? `Számla: ${note.invoices[0].invoice_number || 'Nincs sorszám'}`
                            : `${note.invoices.length} db számla csatolva`}
                        </span>
                      </div>
                    )}

                    {note.transactions && note.transactions.length > 0 && (
                      <div className="mt-1 flex items-center gap-1 text-[10px] text-teal-600/80 dark:text-teal-400/80 font-medium">
                        <Wallet className="h-3 w-3" />
                        <span>
                          {note.transactions.length === 1
                            ? `Tranzakció: ${note.transactions[0].description || 'Nincs leírás'}`
                            : `${note.transactions.length} db tranzakció csatolva`}
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
                      {selectedNote.is_private ? 'Privát jegyzet' : 'Közös cégjegyzet'}
                    </span>
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Calendar className="h-3.5 w-3.5" />
                      Frissítve: {new Date(selectedNote.updated_at).toLocaleString('hu-HU')}
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
                      Szerkesztés
                    </Button>
                    <Button
                      onClick={() => handleDeleteNote(selectedNote.id)}
                      variant="outline"
                      size="sm"
                      className="h-8 gap-1 text-xs text-destructive hover:text-destructive hover:bg-destructive/5"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Törlés
                    </Button>
                  </div>
                )}
              </div>

              {/* Note Content */}
              <div className="py-2">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Tartalom</h4>
                <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap bg-card/30 p-4 rounded-lg border border-border/30">
                  {selectedNote.content}
                </p>
              </div>

              {/* Attached Invoices Details */}
              {selectedNote.invoices && selectedNote.invoices.length > 0 && (
                <div className="space-y-3">
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Kapcsolódó számlák ({selectedNote.invoices.length})
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
                            <span className="text-muted-foreground block text-[10px]">Számlaszám</span>
                            <span className="font-semibold text-foreground font-mono">
                              {inv.invoice_number || '—'}
                            </span>
                          </div>
                          <div>
                            <span className="text-muted-foreground block text-[10px]">Partner</span>
                            <span className="font-semibold text-foreground">
                              {inv.supplier_name || '—'}
                            </span>
                          </div>
                          <div>
                            <span className="text-muted-foreground block text-[10px]">Összeg</span>
                            <span className="font-semibold text-foreground font-mono">
                              {inv.net_amount?.toLocaleString('hu-HU') || '—'}{' '}
                              {inv.currency || 'HUF'}
                            </span>
                          </div>
                          <div>
                            <span className="text-muted-foreground block text-[10px]">Számla kelte</span>
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
                          title="Számla megnyitása"
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
                    Kapcsolódó tranzakciók ({selectedNote.transactions.length})
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
                            <span className="text-muted-foreground block text-[10px]">Leírás / Partner</span>
                            <span className="font-semibold text-foreground truncate block">
                              {tx.description || '—'}
                            </span>
                          </div>
                          <div>
                            <span className="text-muted-foreground block text-[10px]">Összeg</span>
                            <span className="font-semibold text-foreground font-mono">
                              {tx.amount?.toLocaleString('hu-HU') || '—'}{' '}
                              {tx.currency || 'HUF'}
                            </span>
                          </div>
                          <div>
                            <span className="text-muted-foreground block text-[10px]">Dátum</span>
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
                          title="Tranzakció megnyitása"
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
                    <span>Típus: Számlatétel jegyzet (a számla részleteinél módosítható)</span>
                  ) : (
                    <span>Rögzítette: {selectedNote.profiles?.full_name || 'Ismeretlen'}</span>
                  )}
                </span>
              </div>
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-muted-foreground gap-2">
              <ClipboardCheck className="h-12 w-12 text-muted-foreground/30" />
              <p className="text-sm">Nincs kiválasztott jegyzet</p>
              <Button onClick={handleCreateNote} variant="outline" size="sm" className="mt-2">
                Hozz létre egyet most
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
