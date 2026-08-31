import React, { useState } from 'react';
import {
  ClipboardCheck,
  Lock,
  Users,
  Plus,
  Loader2,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { hu } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import type { InvoiceNote, MatchedSubmittedInvoice, MatchedNavInvoice } from './types';

interface InvoiceNotesSectionProps {
  invoiceId?: string;
  companyId?: string;
  transactionId?: string;
  invoiceSource?: 'submitted' | 'nav';
  matchedSubmittedInvoices: MatchedSubmittedInvoice[];
  matchedNavInvoices: MatchedNavInvoice[];
}

export function InvoiceNotesSection({
  invoiceId,
  companyId,
  transactionId,
  invoiceSource,
  matchedSubmittedInvoices,
  matchedNavInvoices,
}: InvoiceNotesSectionProps) {
  const queryClient = useQueryClient();
  const [showAddNote, setShowAddNote] = useState(false);
  const [newNoteTitle, setNewNoteTitle] = useState('');
  const [newNoteText, setNewNoteText] = useState('');
  const [newNotePrivate, setNewNotePrivate] = useState(true);
  const [addingNote, setAddingNote] = useState(false);

  // Fetch linked notes
  const { data: notes = [] } = useQuery<InvoiceNote[]>({
    queryKey: ['invoice-notes', invoiceId, matchedSubmittedInvoices, matchedNavInvoices],
    queryFn: async () => {
      if (!invoiceId) return [];

      const allRelatedInvoiceIds = [
        invoiceId,
        ...matchedSubmittedInvoices.map((inv) => inv.id),
        ...matchedNavInvoices.map((inv) => inv.id),
      ].filter(Boolean);

      if (allRelatedInvoiceIds.length === 0) return [];

      const { data, error } = await supabase
        .from('notes')
        .select('*')
        .or(
          `invoice_id.in.(${allRelatedInvoiceIds.join(',')}),invoice_ids.ov.{${allRelatedInvoiceIds.join(',')}}`
        )
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

        return data.map((n) => ({
          ...n,
          profile_name: nameMap[n.user_id] || 'Ismeretlen',
        }));
      }
      return [];
    },
    enabled: !!invoiceId,
  });

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNoteText.trim() || !invoiceId || !companyId) return;
    setAddingNote(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData.session?.user?.id;
      if (!userId) throw new Error('Unauthenticated');

      let finalInvoiceId: string | null = null;
      let finalInvoiceIds: string[] | null = null;

      if (matchedSubmittedInvoices && matchedSubmittedInvoices.length > 0) {
        finalInvoiceId = matchedSubmittedInvoices[0].id;
      } else if (invoiceSource === 'submitted') {
        finalInvoiceId = invoiceId;
      } else {
        finalInvoiceIds = [invoiceId];
      }

      const { error } = await supabase.from('notes').insert({
        company_id: companyId,
        user_id: userId,
        title: newNoteTitle.trim() || 'Számla feljegyzés',
        content: newNoteText.trim(),
        is_private: newNotePrivate,
        invoice_id: finalInvoiceId,
        invoice_ids: finalInvoiceIds,
        transaction_id: transactionId || undefined,
      });

      if (error) throw error;
      setNewNoteText('');
      setNewNoteTitle('');
      setNewNotePrivate(true);
      toast({
        title: 'Sikeres mentés',
        description: 'Új jegyzet sikeresen rögzítve.',
        duration: 3000,
      });
      queryClient.invalidateQueries({ queryKey: ['invoice-notes', invoiceId] });
      queryClient.invalidateQueries({ queryKey: ['invoice-notes'] });
      queryClient.invalidateQueries({ queryKey: ['notes'] });
      if (transactionId) {
        queryClient.invalidateQueries({ queryKey: ['transaction-notes', transactionId] });
      }
    } catch (err: any) {
      toast({
        title: 'Hiba',
        description: err.message || 'Nem sikerült elmenteni a jegyzetet.',
        variant: 'destructive',
      });
    } finally {
      setAddingNote(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-4 expand-animate">
        <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          <ClipboardCheck className="h-3.5 w-3.5" />
          Kapcsolódó feljegyzések
        </div>
      </div>

      {notes && notes.length > 0 && (
        <div className="space-y-3">
          {notes.map((note) => (
            <Card key={note.id} className="bg-primary/[0.02] border-primary/20 expand-animate">
              <CardHeader className="py-2.5 px-3 border-b border-border/10">
                <CardTitle className="text-xs font-semibold flex items-center justify-between text-foreground">
                  <span className="font-semibold text-foreground truncate max-w-[200px]">
                    {note.title || 'Névtelen jegyzet'}
                  </span>
                  <div className="flex items-center gap-2 shrink-0">
                    {note.is_private ? (
                      <Badge
                        variant="outline"
                        className="text-[9px] h-4.5 px-1.5 gap-1 bg-amber-500/10 text-amber-600 border-amber-500/20 dark:text-amber-400"
                      >
                        <Lock className="h-2.5 w-2.5" />
                        Privát
                      </Badge>
                    ) : (
                      <Badge
                        variant="outline"
                        className="text-[9px] h-4.5 px-1.5 gap-1 bg-primary/10 text-primary border-primary/20"
                      >
                        <Users className="h-2.5 w-2.5" />
                        Közös cégjegyzet
                      </Badge>
                    )}
                    <span className="text-[9px] text-muted-foreground font-mono">
                      {format(new Date(note.created_at), 'yyyy.MM.dd', { locale: hu })}
                    </span>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-3 space-y-1">
                <p className="text-muted-foreground text-xs whitespace-pre-wrap leading-normal font-sans pl-0.5">
                  {note.content}
                </p>
                <div className="text-[9px] text-muted-foreground/80 pl-0.5 pt-1">
                  Rögzítette: {note.profile_name}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Notes empty state with Create button */}
      {(!notes || notes.length === 0) && (
        <div className="flex flex-col items-center justify-center gap-3 py-6 rounded-lg border border-dashed border-border/50">
          <ClipboardCheck className="h-5 w-5 text-muted-foreground/50" />
          <p className="text-xs text-muted-foreground">
            Nincs feljegyezve megjegyzés ehhez a számlához.
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowAddNote(true)}
            className="h-7 text-[11px] gap-1.5 border-dashed"
          >
            <Plus className="h-3 w-3" />
            Feljegyzés létrehozása
          </Button>
        </div>
      )}

      {/* Notes with Add button */}
      {notes && notes.length > 0 && (
        <div className="flex justify-end">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowAddNote(true)}
            className="h-7 text-[11px] gap-1.5 border-dashed"
          >
            <Plus className="h-3 w-3" />
            Új feljegyzés
          </Button>
        </div>
      )}

      {/* Add Note Dialog */}
      <Dialog
        open={showAddNote}
        onOpenChange={(open) => {
          if (!open) {
            setNewNoteTitle('');
            setNewNoteText('');
            setNewNotePrivate(true);
          }
          setShowAddNote(open);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <ClipboardCheck className="h-4 w-4 text-primary" />
              Új feljegyzés
            </DialogTitle>
          </DialogHeader>
          <form
            onSubmit={async (e) => {
              await handleAddNote(e);
              setShowAddNote(false);
            }}
            className="space-y-3 pt-1"
          >
            <div className="space-y-1">
              <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                Jegyzet címe
              </span>
              <Input
                placeholder="pl. Határidő, Hiányzó papír..."
                value={newNoteTitle}
                onChange={(e) => setNewNoteTitle(e.target.value)}
                className="h-9 text-xs bg-background/30 border-border/50"
              />
            </div>
            <div className="space-y-1">
              <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                Tartalom
              </span>
              <Textarea
                placeholder="Írd ide a jegyzet szöveges tartalmát..."
                value={newNoteText}
                onChange={(e) => setNewNoteText(e.target.value)}
                required
                rows={3}
                className="text-xs bg-background/30 border-border/50 resize-none min-h-[72px]"
              />
            </div>
            <div className="space-y-1.5">
              <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                Láthatóság
              </span>
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => setNewNotePrivate(true)}
                  className={cn(
                    "flex items-start gap-2.5 p-2 rounded-lg border text-left transition-all",
                    newNotePrivate
                      ? "border-primary/60 bg-primary/5 dark:bg-primary/10 shadow-sm"
                      : "border-border bg-transparent hover:bg-muted/30"
                  )}
                >
                  <Lock
                    className={cn(
                      "h-4 w-4 mt-0.5 shrink-0",
                      newNotePrivate ? "text-primary" : "text-muted-foreground"
                    )}
                  />
                  <div>
                    <p className="text-[11px] font-semibold">Privát</p>
                    <p className="text-[9px] text-muted-foreground">Csak te látod</p>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setNewNotePrivate(false)}
                  className={cn(
                    "flex items-start gap-2.5 p-2 rounded-lg border text-left transition-all",
                    !newNotePrivate
                      ? "border-primary/60 bg-primary/5 dark:bg-primary/10 shadow-sm"
                      : "border-border bg-transparent hover:bg-muted/30"
                  )}
                >
                  <Users
                    className={cn(
                      "h-4 w-4 mt-0.5 shrink-0",
                      !newNotePrivate ? "text-primary" : "text-muted-foreground"
                    )}
                  />
                  <div>
                    <p className="text-[11px] font-semibold">Közös</p>
                    <p className="text-[9px] text-muted-foreground">Cégtagok látják</p>
                  </div>
                </button>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setShowAddNote(false)}
              >
                Mégse
              </Button>
              <Button
                type="submit"
                size="sm"
                className="h-8 px-4 gap-1.5"
                disabled={addingNote || !newNoteText.trim()}
              >
                {addingNote ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Plus className="h-3.5 w-3.5" />
                )}
                Mentés
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
