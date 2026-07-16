import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Note } from '../../types/notes';
import { Loader2, Lock, Users, Search, FileText, X, Link, Plus, Trash2, Calendar as CalendarIcon, Wallet } from 'lucide-react';
import { format } from 'date-fns';
import { hu } from 'date-fns/locale';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface NoteModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  note: Note | null;
  companyId: string | undefined;
  onSave: (params: {
    title: string;
    content: string;
    is_private: boolean;
    invoice_id: string | null;
    invoice_ids: string[];
    transaction_id: string | null;
    transaction_ids: string[];
  }) => void;
  isSaving: boolean;
}

export function NoteModal({
  open,
  onOpenChange,
  note,
  companyId,
  onSave,
  isSaving,
}: NoteModalProps) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [isPrivate, setIsPrivate] = useState(true); // Default to private
  const [invoiceIds, setInvoiceIds] = useState<string[]>([]);
  const [selectedInvoices, setSelectedInvoices] = useState<any[]>([]);

  // Transactions linkage states
  const [transactionIds, setTransactionIds] = useState<string[]>([]);
  const [selectedTransactions, setSelectedTransactions] = useState<any[]>([]);

  // Search Modal States for Invoices
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);
  const [startDateOpen, setStartDateOpen] = useState(false);
  const [endDateOpen, setEndDateOpen] = useState(false);
  const [tempSelectedInvoices, setTempSelectedInvoices] = useState<any[]>([]);

  // Search Modal States for Transactions
  const [txSearchOpen, setTxSearchOpen] = useState(false);
  const [txSearchTerm, setTxSearchTerm] = useState('');
  const [tempSelectedTransactions, setTempSelectedTransactions] = useState<any[]>([]);

  // Discard Confirmation Dialog State
  const [showConfirmClose, setShowConfirmClose] = useState(false);

  // Reset state when opening/changing note
  useEffect(() => {
    if (open) {
      if (note) {
        setTitle(note.title);
        setContent(note.content);
        setIsPrivate(note.is_private);
        
        // Populate invoice IDs
        const initialIds = [...(note.invoice_ids || [])];
        if (note.invoice_id && !initialIds.includes(note.invoice_id)) {
          initialIds.push(note.invoice_id);
        }
        setInvoiceIds(initialIds);
        setSelectedInvoices(note.invoices || []);

        // Populate transaction IDs
        const initialTxIds = [...(note.transaction_ids || [])];
        if (note.transaction_id && !initialTxIds.includes(note.transaction_id)) {
          initialTxIds.push(note.transaction_id);
        }
        setTransactionIds(initialTxIds);
        setSelectedTransactions(note.transactions || []);
      } else {
        setTitle('');
        setContent('');
        setIsPrivate(true);
        setInvoiceIds([]);
        setSelectedInvoices([]);
        setTransactionIds([]);
        setSelectedTransactions([]);
      }
    }
  }, [open, note]);

  // Synchronize temp selection when search modal opens
  useEffect(() => {
    if (searchOpen) {
      setTempSelectedInvoices(selectedInvoices);
    }
  }, [searchOpen, selectedInvoices]);

  useEffect(() => {
    if (txSearchOpen) {
      setTempSelectedTransactions(selectedTransactions);
    }
  }, [txSearchOpen, selectedTransactions]);

  const hasChanges = () => {
    if (note) {
      const originalInvoiceIds = [...(note.invoice_ids || [])];
      if (note.invoice_id && !originalInvoiceIds.includes(note.invoice_id)) {
        originalInvoiceIds.push(note.invoice_id);
      }
      
      const hasInvoiceChanges = 
        invoiceIds.length !== originalInvoiceIds.length ||
        !invoiceIds.every(id => originalInvoiceIds.includes(id));

      const originalTxIds = [...(note.transaction_ids || [])];
      if (note.transaction_id && !originalTxIds.includes(note.transaction_id)) {
        originalTxIds.push(note.transaction_id);
      }

      const hasTxChanges =
        transactionIds.length !== originalTxIds.length ||
        !transactionIds.every(id => originalTxIds.includes(id));

      return (
        title !== note.title ||
        content !== note.content ||
        isPrivate !== note.is_private ||
        hasInvoiceChanges ||
        hasTxChanges
      );
    } else {
      return title.trim() !== '' || content.trim() !== '' || invoiceIds.length > 0 || transactionIds.length > 0;
    }
  };

  const handleCloseAttempt = (nextOpen: boolean) => {
    if (!nextOpen) {
      if (hasChanges()) {
        setShowConfirmClose(true);
        return;
      }
    }
    onOpenChange(nextOpen);
  };

  // Query invoices based on user search in the sub-modal
  const { data: searchInvoices = [], isLoading: searchInvoicesLoading } = useQuery({
    queryKey: ['notes-invoices-search', companyId, searchTerm, startDate, endDate],
    queryFn: async () => {
      if (!companyId) return [];
      let queryBuilder = supabase
        .from('invoices')
        .select('id, invoice_number:bizonylatsorszam, supplier_name:elado_nev, net_amount:adoalap_osszesen, currency:penznem, invoice_date:kibocsatas_datuma')
        .eq('company_id', companyId);

      if (searchTerm.trim()) {
        queryBuilder = queryBuilder.or(`bizonylatsorszam.ilike.%${searchTerm}%,elado_nev.ilike.%${searchTerm}%`);
      }
      if (startDate) {
        queryBuilder = queryBuilder.gte('kibocsatas_datuma', format(startDate, 'yyyy-MM-dd'));
      }
      if (endDate) {
        queryBuilder = queryBuilder.lte('kibocsatas_datuma', format(endDate, 'yyyy-MM-dd'));
      }

      const { data, error } = await queryBuilder
        .order('kibocsatas_datuma', { ascending: false })
        .limit(20);

      if (error) throw error;
      return data || [];
    },
    enabled: searchOpen && !!companyId,
  });

  // Query transactions based on user search in the sub-modal
  const { data: searchTransactions = [], isLoading: searchTransactionsLoading } = useQuery({
    queryKey: ['notes-transactions-search', companyId, txSearchTerm],
    queryFn: async () => {
      if (!companyId) return [];
      let queryBuilder = supabase
        .from('transactions')
        .select('id, transaction_date, description, amount, currency')
        .eq('company_id', companyId);

      if (txSearchTerm.trim()) {
        queryBuilder = queryBuilder.or(`description.ilike.%${txSearchTerm}%`);
      }

      const { data, error } = await queryBuilder
        .order('transaction_date', { ascending: false })
        .limit(20);

      if (error) throw error;
      return data || [];
    },
    enabled: txSearchOpen && !!companyId,
  });

  const handleToggleTempInvoice = (inv: any) => {
    const exists = tempSelectedInvoices.some((item) => item.id === inv.id);
    if (exists) {
      setTempSelectedInvoices((prev) => prev.filter((item) => item.id !== inv.id));
    } else {
      setTempSelectedInvoices((prev) => [
        ...prev,
        {
          id: inv.id,
          invoice_number: inv.invoice_number,
          supplier_name: inv.supplier_name,
          net_amount: inv.net_amount,
          currency: inv.currency,
          invoice_date: inv.invoice_date,
        },
      ]);
    }
  };

  const handleToggleTempTransaction = (tx: any) => {
    const exists = tempSelectedTransactions.some((item) => item.id === tx.id);
    if (exists) {
      setTempSelectedTransactions((prev) => prev.filter((item) => item.id !== tx.id));
    } else {
      setTempSelectedTransactions((prev) => [
        ...prev,
        {
          id: tx.id,
          transaction_date: tx.transaction_date,
          description: tx.description,
          amount: tx.amount,
          currency: tx.currency,
        },
      ]);
    }
  };

  const handleSelectAllVisible = () => {
    const allVisibleSelected = searchInvoices.every((inv) =>
      tempSelectedInvoices.some((temp) => temp.id === inv.id)
    );

    if (allVisibleSelected) {
      const visibleIds = searchInvoices.map((inv) => inv.id);
      setTempSelectedInvoices((prev) => prev.filter((item) => !visibleIds.includes(item.id)));
    } else {
      setTempSelectedInvoices((prev) => {
        const next = [...prev];
        searchInvoices.forEach((inv) => {
          if (!next.some((item) => item.id === inv.id)) {
            next.push({
              id: inv.id,
              invoice_number: inv.invoice_number,
              supplier_name: inv.supplier_name,
              net_amount: inv.net_amount,
              currency: inv.currency,
              invoice_date: inv.invoice_date,
            });
          }
        });
        return next;
      });
    }
  };

  const handleSelectAllVisibleTx = () => {
    const allVisibleSelected = searchTransactions.every((tx) =>
      tempSelectedTransactions.some((temp) => temp.id === tx.id)
    );

    if (allVisibleSelected) {
      const visibleIds = searchTransactions.map((tx) => tx.id);
      setTempSelectedTransactions((prev) => prev.filter((item) => !visibleIds.includes(item.id)));
    } else {
      setTempSelectedTransactions((prev) => {
        const next = [...prev];
        searchTransactions.forEach((tx) => {
          if (!next.some((item) => item.id === tx.id)) {
            next.push({
              id: tx.id,
              transaction_date: tx.transaction_date,
              description: tx.description,
              amount: tx.amount,
              currency: tx.currency,
            });
          }
        });
        return next;
      });
    }
  };

  const handleRemoveInvoice = (id: string) => {
    setInvoiceIds((prev) => prev.filter((item) => item !== id));
    setSelectedInvoices((prev) => prev.filter((item) => item.id !== id));
  };

  const handleRemoveTransaction = (id: string) => {
    setTransactionIds((prev) => prev.filter((item) => item !== id));
    setSelectedTransactions((prev) => prev.filter((item) => item.id !== id));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) return;

    onSave({
      title: title.trim(),
      content: content.trim(),
      is_private: isPrivate,
      invoice_id: invoiceIds[0] || null,
      invoice_ids: invoiceIds,
      transaction_id: transactionIds[0] || null,
      transaction_ids: transactionIds,
    });
  };

  return (
    <>
      <Dialog open={open} onOpenChange={handleCloseAttempt}>
        <DialogContent className="sm:max-w-md bg-card/95 backdrop-blur-md border-border/50 max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{note ? 'Jegyzet szerkesztése' : 'Új jegyzet rögzítése'}</DialogTitle>
            <DialogDescription>
              Rögzíts személyes emlékeztetőt vagy a cég többi tagjával megosztható feljegyzést.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4 py-2">
            {/* Title */}
            <div className="space-y-1.5">
              <Label htmlFor="note-title">Jegyzet címe</Label>
              <Input
                id="note-title"
                placeholder="pl. NAV adóellenőrzés határideje, Hiányzó papír..."
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                className="bg-background/50 text-xs"
              />
            </div>

            {/* Content */}
            <div className="space-y-1.5">
              <Label htmlFor="note-content">Tartalom</Label>
              <Textarea
                id="note-content"
                placeholder="Írd ide a jegyzet szöveges tartalmát..."
                value={content}
                onChange={(e) => setContent(e.target.value)}
                required
                rows={4}
                className="bg-background/50 resize-none text-xs"
              />
            </div>

            {/* Privacy Selector Toggle (Light/Dark mode compliant) */}
            <div className="space-y-1.5">
              <Label>Láthatóság</Label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setIsPrivate(true)}
                  className={`flex items-center gap-3 p-3 rounded-lg border text-left transition-all ${
                    isPrivate
                      ? 'border-primary bg-primary/5 text-primary'
                      : 'border-border/60 hover:bg-muted/40 text-muted-foreground hover:text-foreground bg-background/50'
                  }`}
                >
                  <Lock className="h-4 w-4 shrink-0" />
                  <div>
                    <div className="font-semibold text-xs text-foreground">Privát</div>
                    <div className="text-[10px] text-muted-foreground">Csak te látod</div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setIsPrivate(false)}
                  className={`flex items-center gap-3 p-3 rounded-lg border text-left transition-all ${
                    !isPrivate
                      ? 'border-primary bg-primary/5 text-primary'
                      : 'border-border/60 hover:bg-muted/40 text-muted-foreground hover:text-foreground bg-background/50'
                  }`}
                >
                  <Users className="h-4 w-4 shrink-0" />
                  <div>
                    <div className="font-semibold text-xs text-foreground">Közös</div>
                    <div className="text-[10px] text-muted-foreground">Cégtagok látják</div>
                  </div>
                </button>
              </div>
            </div>

            {/* Linked Invoices Selector */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label>Kapcsolódó számlák ({selectedInvoices.length})</Label>
                {selectedInvoices.length > 0 && (
                  <Button
                    type="button"
                    variant="ghost"
                    className="h-6 text-[10px] px-2 text-primary hover:bg-primary/10 gap-1 font-semibold"
                    onClick={() => setSearchOpen(true)}
                  >
                    <Plus className="h-3 w-3" />
                    Számla hozzáadása
                  </Button>
                )}
              </div>

              {selectedInvoices.length > 0 ? (
                <div className="space-y-2">
                  <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                    {selectedInvoices.map((inv) => (
                      <div
                        key={inv.id}
                        className="flex items-center justify-between p-2 rounded-lg border border-primary/30 bg-primary/5"
                      >
                        <div className="flex items-center gap-2.5 text-xs min-w-0 flex-1">
                          <FileText className="h-3.5 w-3.5 text-primary shrink-0" />
                          <div className="min-w-0 flex-1">
                            <div className="font-semibold text-foreground font-mono leading-tight truncate">
                              {inv.invoice_number || 'Nincs sorszám'}
                            </div>
                            <div className="text-[10px] text-muted-foreground leading-none">
                              {inv.supplier_name} • {inv.invoice_date}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0 ml-2">
                          <span className="text-[11px] font-semibold text-foreground font-mono pr-2">
                            {inv.net_amount?.toLocaleString('hu-HU')} {inv.currency || 'HUF'}
                          </span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                            onClick={() => handleRemoveInvoice(inv.id)}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="flex justify-start">
                    <Button
                      type="button"
                      variant="ghost"
                      className="h-6 text-[10px] px-2 text-destructive hover:bg-destructive/10 gap-1 font-semibold"
                      onClick={() => {
                        setInvoiceIds([]);
                        setSelectedInvoices([]);
                      }}
                    >
                      <Trash2 className="h-3 w-3" />
                      Összes csatolás megszüntetése
                    </Button>
                  </div>
                </div>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  className="w-full justify-start text-xs text-muted-foreground font-normal bg-background/50 h-10 border-dashed hover:bg-muted/30"
                  onClick={() => setSearchOpen(true)}
                >
                  <Link className="h-3.5 w-3.5 mr-2" />
                  Számla összekapcsolása...
                </Button>
              )}
            </div>

            {/* Linked Transactions Selector */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label>Kapcsolódó tranzakciók ({selectedTransactions.length})</Label>
                {selectedTransactions.length > 0 && (
                  <Button
                    type="button"
                    variant="ghost"
                    className="h-6 text-[10px] px-2 text-primary hover:bg-primary/10 gap-1 font-semibold"
                    onClick={() => setTxSearchOpen(true)}
                  >
                    <Plus className="h-3 w-3" />
                    Tranzakció hozzáadása
                  </Button>
                )}
              </div>

              {selectedTransactions.length > 0 ? (
                <div className="space-y-2">
                  <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                    {selectedTransactions.map((tx) => (
                      <div
                        key={tx.id}
                        className="flex items-center justify-between p-2 rounded-lg border border-primary/30 bg-primary/5"
                      >
                        <div className="flex items-center gap-2.5 text-xs min-w-0 flex-1">
                          <Wallet className="h-3.5 w-3.5 text-primary shrink-0" />
                          <div className="min-w-0 flex-1">
                            <div className="font-semibold text-foreground truncate leading-tight">
                              {tx.description || 'Nincs leírás'}
                            </div>
                            <div className="text-[10px] text-muted-foreground leading-none">
                              {tx.transaction_date}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0 ml-2">
                          <span className="text-[11px] font-semibold text-foreground font-mono pr-2">
                            {tx.amount?.toLocaleString('hu-HU')} {tx.currency || 'HUF'}
                          </span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                            onClick={() => handleRemoveTransaction(tx.id)}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="flex justify-start">
                    <Button
                      type="button"
                      variant="ghost"
                      className="h-6 text-[10px] px-2 text-destructive hover:bg-destructive/10 gap-1 font-semibold"
                      onClick={() => {
                        setTransactionIds([]);
                        setSelectedTransactions([]);
                      }}
                    >
                      <Trash2 className="h-3 w-3" />
                      Összes csatolás megszüntetése
                    </Button>
                  </div>
                </div>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  className="w-full justify-start text-xs text-muted-foreground font-normal bg-background/50 h-10 border-dashed hover:bg-muted/30"
                  onClick={() => setTxSearchOpen(true)}
                >
                  <Link className="h-3.5 w-3.5 mr-2" />
                  Tranzakció összekapcsolása...
                </Button>
              )}
            </div>

            <DialogFooter className="pt-4 border-t border-border/30">
              <Button
                type="button"
                variant="outline"
                onClick={() => handleCloseAttempt(false)}
                disabled={isSaving}
              >
                Mégse
              </Button>
              <Button type="submit" disabled={isSaving || !title.trim() || !content.trim()}>
                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Mentés
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Invoice Search Dialog */}
      <Dialog open={searchOpen} onOpenChange={setSearchOpen}>
        <DialogContent className="sm:max-w-lg bg-card/95 backdrop-blur-md border-border/50 max-h-[85vh] flex flex-col p-6">
          <DialogHeader className="pb-4 border-b border-border/20">
            <DialogTitle className="flex items-center gap-2 text-sm font-semibold">
              <Search className="h-4 w-4" />
              Számlák keresése és tömeges csatolása
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Jelölj ki egy vagy több számlát a listából a csatoláshoz.
            </DialogDescription>
          </DialogHeader>

          {/* Search Inputs */}
          <div className="space-y-3 py-4">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Számlaszám vagy partner neve..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 bg-background/50 text-xs h-9"
              />
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1 flex flex-col">
                <Label className="text-[10px] text-muted-foreground">Kibocsátás kezdete</Label>
                <div className="relative">
                  <Popover open={startDateOpen} onOpenChange={setStartDateOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-8 text-xs justify-start font-normal bg-background/50 border-border/60 hover:bg-muted/40 w-full pr-8 text-left text-muted-foreground"
                      >
                        <CalendarIcon className="mr-1.5 h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <span className="truncate">
                          {startDate ? format(startDate, "yyyy. MMM dd.", { locale: hu }) : "éééé. hh. nn."}
                        </span>
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0 z-[9999]" align="start">
                      <Calendar
                        mode="single"
                        selected={startDate}
                        onSelect={(date) => {
                          setStartDate(date);
                          setStartDateOpen(false);
                        }}
                        disabled={(date) => !!endDate && date > endDate}
                        initialFocus
                        className="p-3 pointer-events-auto"
                      />
                    </PopoverContent>
                  </Popover>
                  {startDate && (
                    <button
                      type="button"
                      onClick={() => setStartDate(undefined)}
                      className="absolute right-2 top-2.5 h-3 w-3 text-muted-foreground hover:text-foreground flex items-center justify-center rounded-full hover:bg-muted z-10"
                    >
                      <X className="h-2.5 w-2.5" />
                    </button>
                  )}
                </div>
              </div>

              <div className="space-y-1 flex flex-col">
                <Label className="text-[10px] text-muted-foreground">Kibocsátás vége</Label>
                <div className="relative">
                  <Popover open={endDateOpen} onOpenChange={setEndDateOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-8 text-xs justify-start font-normal bg-background/50 border-border/60 hover:bg-muted/40 w-full pr-8 text-left text-muted-foreground"
                      >
                        <CalendarIcon className="mr-1.5 h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <span className="truncate">
                          {endDate ? format(endDate, "yyyy. MMM dd.", { locale: hu }) : "éééé. hh. nn."}
                        </span>
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0 z-[9999]" align="end">
                      <Calendar
                        mode="single"
                        selected={endDate}
                        onSelect={(date) => {
                          setEndDate(date);
                          setEndDateOpen(false);
                        }}
                        disabled={(date) => !!startDate && date < startDate}
                        initialFocus
                        className="p-3 pointer-events-auto"
                      />
                    </PopoverContent>
                  </Popover>
                  {endDate && (
                    <button
                      type="button"
                      onClick={() => setEndDate(undefined)}
                      className="absolute right-2 top-2 h-4 w-4 text-muted-foreground hover:text-foreground flex items-center justify-center rounded-full hover:bg-muted z-10"
                    >
                      <X className="h-2.5 w-2.5" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Bulk select / deselect action bar */}
          {searchInvoices.length > 0 && (
            <div className="flex items-center justify-between px-1 pb-2">
              <span className="text-[10px] text-muted-foreground">
                Keresési találatok ({searchInvoices.length} db)
              </span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-6 text-[10px] text-primary hover:bg-primary/10 px-2"
                onClick={handleSelectAllVisible}
              >
                {searchInvoices.every((inv) => tempSelectedInvoices.some((temp) => temp.id === inv.id))
                  ? 'Kijelölések megszüntetése'
                  : 'Összes kijelölése ezen az oldalon'}
              </Button>
            </div>
          )}

          {/* Results List */}
          <div className="flex-1 overflow-y-auto h-[320px] pr-1 space-y-2 flex flex-col">
            {searchInvoicesLoading ? (
              <div className="flex flex-col items-center justify-center my-auto text-muted-foreground text-xs gap-2 py-12">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
                <span>Számlák betöltése...</span>
              </div>
            ) : searchInvoices.length === 0 ? (
              <div className="text-center my-auto text-muted-foreground text-xs py-12">
                Nem található számla a megadott szűrők alapján.
              </div>
            ) : (
              <div className="space-y-1.5">
                {searchInvoices.map((inv: any) => {
                  const isChecked = tempSelectedInvoices.some((temp) => temp.id === inv.id);
                  return (
                    <button
                      key={inv.id}
                      type="button"
                      onClick={() => handleToggleTempInvoice(inv)}
                      className={`w-full flex items-center justify-between p-3 rounded-lg border transition-all text-left text-xs ${
                        isChecked
                          ? 'border-primary bg-primary/5'
                          : 'border-border/45 hover:border-primary/50 hover:bg-primary/5 bg-background/30'
                      }`}
                    >
                      <div className="flex items-start gap-3 min-w-0 flex-1 mr-4">
                        <div className="mt-1" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => handleToggleTempInvoice(inv)}
                            className="rounded border-border bg-background text-primary focus:ring-primary w-3.5 h-3.5 cursor-pointer"
                          />
                        </div>
                        <div className="min-w-0 flex-1">
                          <span className="font-mono font-semibold text-foreground block truncate">
                            {inv.invoice_number || 'Nincs sorszám'}
                          </span>
                          <span className="text-[10px] text-muted-foreground block truncate">
                            {inv.supplier_name || 'Ismeretlen partner'}
                          </span>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="font-semibold text-foreground block font-mono">
                          {inv.net_amount?.toLocaleString('hu-HU')} {inv.currency || 'HUF'}
                        </span>
                        <span className="text-[10px] text-muted-foreground block">
                          {inv.invoice_date || '—'}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <DialogFooter className="pt-4 border-t border-border/20 mt-auto flex items-center justify-between gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setSearchOpen(false)}
            >
              Mégse
            </Button>
            <Button
              type="button"
              size="sm"
              className="w-[220px] justify-center shrink-0"
              onClick={() => {
                setInvoiceIds(tempSelectedInvoices.map((item) => item.id));
                setSelectedInvoices(tempSelectedInvoices);
                setSearchOpen(false);
              }}
            >
              Kijelöltek hozzáadása ({tempSelectedInvoices.length} db)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Transaction Search Dialog */}
      <Dialog open={txSearchOpen} onOpenChange={setTxSearchOpen}>
        <DialogContent className="sm:max-w-lg bg-card/95 backdrop-blur-md border-border/50 max-h-[85vh] flex flex-col p-6">
          <DialogHeader className="pb-4 border-b border-border/20">
            <DialogTitle className="flex items-center gap-2 text-sm font-semibold">
              <Search className="h-4 w-4" />
              Tranzakciók keresése és tömeges csatolása
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Jelölj ki egy vagy több tranzakciót a listából a csatoláshoz.
            </DialogDescription>
          </DialogHeader>

          {/* Search Inputs */}
          <div className="space-y-3 py-4">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Leírás vagy típus alapján..."
                value={txSearchTerm}
                onChange={(e) => setTxSearchTerm(e.target.value)}
                className="pl-9 bg-background/50 text-xs h-9"
              />
            </div>
          </div>

          {/* Bulk select / deselect action bar */}
          {searchTransactions.length > 0 && (
            <div className="flex items-center justify-between px-1 pb-2">
              <span className="text-[10px] text-muted-foreground">
                Keresési találatok ({searchTransactions.length} db)
              </span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-6 text-[10px] text-primary hover:bg-primary/10 px-2"
                onClick={handleSelectAllVisibleTx}
              >
                {searchTransactions.every((tx) => tempSelectedTransactions.some((temp) => temp.id === tx.id))
                  ? 'Kijelölések megszüntetése'
                  : 'Összes kijelölése ezen az oldalon'}
              </Button>
            </div>
          )}

          {/* Results List */}
          <div className="flex-1 overflow-y-auto h-[320px] pr-1 space-y-2 flex flex-col">
            {searchTransactionsLoading ? (
              <div className="flex flex-col items-center justify-center my-auto text-muted-foreground text-xs gap-2 py-12">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
                <span>Tranzakciók betöltése...</span>
              </div>
            ) : searchTransactions.length === 0 ? (
              <div className="text-center my-auto text-muted-foreground text-xs py-12">
                Nem található tranzakció a megadott szűrő alapján.
              </div>
            ) : (
              <div className="space-y-1.5">
                {searchTransactions.map((tx: any) => {
                  const isChecked = tempSelectedTransactions.some((temp) => temp.id === tx.id);
                  return (
                    <button
                      key={tx.id}
                      type="button"
                      onClick={() => handleToggleTempTransaction(tx)}
                      className={`w-full flex items-center justify-between p-3 rounded-lg border transition-all text-left text-xs ${
                        isChecked
                          ? 'border-primary bg-primary/5'
                          : 'border-border/45 hover:border-primary/50 hover:bg-primary/5 bg-background/30'
                      }`}
                    >
                      <div className="flex items-start gap-3 min-w-0 flex-1 mr-4 text-left">
                        <div className="mt-1" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => handleToggleTempTransaction(tx)}
                            className="rounded border-border bg-background text-primary focus:ring-primary w-3.5 h-3.5 cursor-pointer"
                          />
                        </div>
                        <div className="min-w-0 flex-1">
                          <span className="font-semibold text-foreground block truncate">
                            {tx.description || 'Nincs leírás'}
                          </span>
                          <span className="text-[10px] text-muted-foreground block font-mono">
                            {tx.transaction_date}
                          </span>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="font-semibold text-foreground block font-mono">
                          {tx.amount?.toLocaleString('hu-HU')} {tx.currency || 'HUF'}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <DialogFooter className="pt-4 border-t border-border/20 mt-auto flex items-center justify-between gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setTxSearchOpen(false)}
            >
              Mégse
            </Button>
            <Button
              type="button"
              size="sm"
              className="w-[220px] justify-center shrink-0"
              onClick={() => {
                setTransactionIds(tempSelectedTransactions.map((item) => item.id));
                setSelectedTransactions(tempSelectedTransactions);
                setTxSearchOpen(false);
              }}
            >
              Kijelöltek hozzáadása ({tempSelectedTransactions.length} db)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={showConfirmClose} onOpenChange={setShowConfirmClose}>
        <AlertDialogContent className="bg-card/95 backdrop-blur-md border-border/50 z-[10000]">
          <AlertDialogHeader>
            <AlertDialogTitle>Nem mentett változtatások</AlertDialogTitle>
            <AlertDialogDescription>
              Biztosan bezárod a jegyzetet? A nem mentett változtatások elvészek.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel type="button">Mégse</AlertDialogCancel>
            <AlertDialogAction
              type="button"
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
              onClick={() => {
                setShowConfirmClose(false);
                onOpenChange(false);
              }}
            >
              Bezárás
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
