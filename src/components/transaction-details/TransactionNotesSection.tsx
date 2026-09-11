import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { ClipboardCheck, Lock, Users, Plus, Loader2 } from 'lucide-react';
import { formatDate } from '@/lib/locale/formatters';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';

export interface NoteItem {
  id: string;
  title: string | null;
  content: string;
  is_private: boolean;
  created_at: string;
  user_id: string;
  profile_name?: string;
}

export interface TransactionNotesSectionProps {
  transactionId: string;
  companyId: string;
  isOpen: boolean;
}

export const TransactionNotesSection: React.FC<TransactionNotesSectionProps> = ({
  transactionId,
  companyId,
  isOpen,
}) => {
  const { t } = useTranslation(['transactions']);
  const queryClient = useQueryClient();
  const [notes, setNotes] = useState<NoteItem[]>([]);
  const [loadingNotes, setLoadingNotes] = useState(false);
  const [newNoteTitle, setNewNoteTitle] = useState('');
  const [newNoteText, setNewNoteText] = useState('');
  const [newNotePrivate, setNewNotePrivate] = useState(true);
  const [addingNote, setAddingNote] = useState(false);

  const fetchNotes = useCallback(async () => {
    if (!transactionId) return;
    setLoadingNotes(true);
    try {
      const { data, error } = await supabase
        .from('notes')
        .select('*')
        .or(`transaction_id.eq.${transactionId},transaction_ids.ov.{${transactionId}}`)
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (data && data.length > 0) {
        const userIds = Array.from(new Set(data.map((n: any) => n.user_id)));
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, name')
          .in('user_id', userIds);

        const profileMap = new Map<string, string>();
        if (profiles) {
          profiles.forEach(p => profileMap.set(p.user_id, p.name || t('transactions:dialogs.details.notes.anonymous')));
        }

        const enriched = data.map(n => ({
          ...n,
          profile_name: profileMap.get(n.user_id) || t('transactions:dialogs.details.notes.unknown'),
        }));
        setNotes(enriched);
      } else {
        setNotes([]);
      }
    } catch (err) {
      console.error('Error fetching transaction notes:', err);
    } finally {
      setLoadingNotes(false);
    }
  }, [transactionId, t]);

  useEffect(() => {
    if (isOpen && transactionId) {
      fetchNotes();
    }
  }, [isOpen, transactionId, fetchNotes]);

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNoteText.trim() || !transactionId) return;
    setAddingNote(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData.session?.user?.id;
      if (!userId) throw new Error('Unauthenticated');

      const { error } = await supabase.from('notes').insert({
        company_id: companyId,
        user_id: userId,
        title: newNoteTitle.trim() || t('transactions:dialogs.details.notes.default_title'),
        content: newNoteText.trim(),
        is_private: newNotePrivate,
        transaction_id: transactionId,
      });

      if (error) throw error;
      setNewNoteText('');
      setNewNoteTitle('');
      setNewNotePrivate(true);
      fetchNotes();
      queryClient.invalidateQueries({ queryKey: ['notes'] });
    } catch (err) {
      console.error('Error adding note:', err);
    } finally {
      setAddingNote(false);
    }
  };

  return (
    <>
      <Separator className="my-2" />
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          <ClipboardCheck className="h-3.5 w-3.5 text-primary" />
          {t('transactions:dialogs.details.notes.title')}
        </div>

        {loadingNotes ? (
          <div className="flex items-center justify-center py-2">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          </div>
        ) : notes.length > 0 ? (
          <div className="space-y-2">
            {notes.map(note => (
              <Card key={note.id} className="bg-primary/[0.01] border-primary/10">
                <CardHeader className="py-2 px-3 border-b border-border/10">
                  <CardTitle className="text-xs font-semibold flex items-center justify-between text-foreground">
                    <span className="truncate max-w-[200px]">
                      {note.title || t('transactions:dialogs.details.notes.no_title')}
                    </span>
                    <div className="flex items-center gap-2 shrink-0">
                      {note.is_private ? (
                        <Badge
                          variant="outline"
                          className="text-[9px] h-4.5 px-1.5 gap-1 bg-amber-500/10 text-amber-600 border-amber-500/20 dark:text-amber-400"
                        >
                          <Lock className="h-2.5 w-2.5" />
                          {t('transactions:dialogs.details.notes.badge_private')}
                        </Badge>
                      ) : (
                        <Badge
                          variant="outline"
                          className="text-[9px] h-4.5 px-1.5 gap-1 bg-primary/10 text-primary border-primary/20"
                        >
                          <Users className="h-2.5 w-2.5" />
                          {t('transactions:dialogs.details.notes.badge_shared')}
                        </Badge>
                      )}
                      <span className="text-[9px] text-muted-foreground font-mono">
                        {formatDate(note.created_at)}
                      </span>
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-3 space-y-1">
                  <p className="text-muted-foreground text-xs whitespace-pre-wrap leading-normal font-sans">
                    {note.content}
                  </p>
                  <div className="text-[9px] text-muted-foreground/80 pt-1">
                    {t('transactions:dialogs.details.notes.recorded_by', { name: note.profile_name })}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground italic pl-1">
            {t('transactions:dialogs.details.notes.empty')}
          </p>
        )}

        {/* Add Note Form */}
        <form onSubmit={handleAddNote} className="space-y-3 pt-3 border-t border-border/10">
          <div className="space-y-1">
            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
              {t('transactions:dialogs.details.notes.field_title')}
            </span>
            <Input
              placeholder={t('transactions:dialogs.details.notes.field_title_placeholder')}
              value={newNoteTitle}
              onChange={e => setNewNoteTitle(e.target.value)}
              className="h-8 text-xs bg-background/30 border-border/50"
            />
          </div>

          <div className="space-y-1">
            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
              {t('transactions:dialogs.details.notes.field_content')}
            </span>
            <Textarea
              placeholder={t('transactions:dialogs.details.notes.field_content_placeholder')}
              value={newNoteText}
              onChange={e => setNewNoteText(e.target.value)}
              required
              rows={2}
              className="text-xs bg-background/30 border-border/50 resize-none min-h-[56px]"
            />
          </div>

          <div className="space-y-1.5">
            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
              {t('transactions:dialogs.details.notes.field_visibility')}
            </span>
            <div className="grid grid-cols-2 gap-2.5">
              {/* Private Card Button */}
              <button
                type="button"
                onClick={() => setNewNotePrivate(true)}
                className={cn(
                  'flex items-start gap-2.5 p-2 rounded-lg border text-left transition-all',
                  newNotePrivate
                    ? 'border-primary/60 bg-primary/5 dark:bg-primary/10 shadow-sm'
                    : 'border-border bg-transparent hover:bg-muted/30'
                )}
              >
                <Lock
                  className={cn(
                    'h-4 w-4 mt-0.5 shrink-0',
                    newNotePrivate ? 'text-primary' : 'text-muted-foreground'
                  )}
                />
                <div>
                  <p className="text-[11px] font-semibold">
                    {t('transactions:dialogs.details.notes.visibility_private')}
                  </p>
                  <p className="text-[9px] text-muted-foreground">
                    {t('transactions:dialogs.details.notes.visibility_private_desc')}
                  </p>
                </div>
              </button>

              {/* Public Card Button */}
              <button
                type="button"
                onClick={() => setNewNotePrivate(false)}
                className={cn(
                  'flex items-start gap-2.5 p-2 rounded-lg border text-left transition-all',
                  !newNotePrivate
                    ? 'border-primary/60 bg-primary/5 dark:bg-primary/10 shadow-sm'
                    : 'border-border bg-transparent hover:bg-muted/30'
                )}
              >
                <Users
                  className={cn(
                    'h-4 w-4 mt-0.5 shrink-0',
                    !newNotePrivate ? 'text-primary' : 'text-muted-foreground'
                  )}
                />
                <div>
                  <p className="text-[11px] font-semibold">
                    {t('transactions:dialogs.details.notes.visibility_shared')}
                  </p>
                  <p className="text-[9px] text-muted-foreground">
                    {t('transactions:dialogs.details.notes.visibility_shared_desc')}
                  </p>
                </div>
              </button>
            </div>
          </div>

          <div className="flex justify-end pt-1">
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
              {t('transactions:dialogs.details.notes.save_btn')}
            </Button>
          </div>
        </form>
      </div>
    </>
  );
};
