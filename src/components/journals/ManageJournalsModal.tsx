import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { BookOpen, Plus, Edit2, Check, X, Loader2 } from 'lucide-react';
import { CreateJournalModal, JOURNAL_TYPES } from './CreateJournalModal';

export interface JournalItem {
  id: string;
  company_id: string;
  code: string;
  name: string;
  type: string;
  currency: string;
  connected_gl_account: string | null;
  is_active: boolean;
  created_at?: string;
}

interface ManageJournalsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId: string;
  journals: JournalItem[];
  glAccounts?: Array<{ id: string; gl_number: string; short_name: string; currency?: string | null }>;
}

export const ManageJournalsModal: React.FC<ManageJournalsModalProps> = ({
  open,
  onOpenChange,
  companyId,
  journals,
  glAccounts = [],
}) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editingJournalId, setEditingJournalId] = useState<string | null>(null);
  const [editName, setEditName] = useState<string>('');
  const [editGlAccount, setEditGlAccount] = useState<string>('');
  const [editActive, setEditActive] = useState<boolean>(true);
  const [savingId, setSavingId] = useState<string | null>(null);

  const startEdit = (j: JournalItem) => {
    setEditingJournalId(j.id);
    setEditName(j.name);
    setEditGlAccount(j.connected_gl_account || '');
    setEditActive(j.is_active);
  };

  const cancelEdit = () => {
    setEditingJournalId(null);
    setEditName('');
    setEditGlAccount('');
  };

  const handleSaveEdit = async (journalId: string) => {
    if (!editName.trim()) {
      toast({ title: 'A megnevezés kötelező', variant: 'destructive' });
      return;
    }

    setSavingId(journalId);
    try {
      const { error } = await supabase
        .from('acc_journals')
        .update({
          name: editName.trim(),
          connected_gl_account: editGlAccount.trim() || null,
          is_active: editActive,
        })
        .eq('id', journalId)
        .eq('company_id', companyId);

      if (error) throw error;

      toast({ title: 'Napló sikeresen frissítve' });
      queryClient.invalidateQueries({ queryKey: ['acc-journals', companyId] });
      queryClient.invalidateQueries({ queryKey: ['acc-bank-journals', companyId] });
      cancelEdit();
    } catch (err: any) {
      toast({
        title: 'Hiba a mentés során',
        description: err.message || 'Nem sikerült frissíteni a naplót.',
        variant: 'destructive',
      });
    } finally {
      setSavingId(null);
    }
  };

  const getTypeLabel = (type: string) => {
    const match = JOURNAL_TYPES.find(t => t.value === type);
    return match ? match.label.split(' ')[0] : type;
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-4xl max-h-[85vh] flex flex-col p-6">
          <DialogHeader className="flex flex-row items-center justify-between pb-2 border-b">
            <div>
              <DialogTitle className="flex items-center gap-2 text-lg">
                <BookOpen className="w-5 h-5 text-primary" />
                <span>Könyvelési Naplótörzs Kezelése</span>
              </DialogTitle>
              <DialogDescription className="text-xs mt-1">
                Tekintse át, nevezze át és szabja testre a cég könyvelési naplóit (bankok, pénztárak, vegyes és forgalmi naplók).
              </DialogDescription>
            </div>
            <Button
              size="sm"
              onClick={() => setCreateModalOpen(true)}
              className="gap-1.5 shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>Új Napló</span>
            </Button>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto py-3">
            <Table>
              <TableHeader>
                <TableRow className="text-xs">
                  <TableHead className="w-[80px]">Kód</TableHead>
                  <TableHead className="min-w-[180px]">Megnevezés</TableHead>
                  <TableHead className="w-[110px]">Típus</TableHead>
                  <TableHead className="w-[70px]">Deviza</TableHead>
                  <TableHead className="min-w-[140px]">Kapcsolt Főkönyv</TableHead>
                  <TableHead className="w-[90px] text-center">Státusz</TableHead>
                  <TableHead className="w-[90px] text-right">Művelet</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="text-xs">
                {journals.map(j => {
                  const isEditing = editingJournalId === j.id;

                  return (
                    <TableRow key={j.id} className={!j.is_active ? 'opacity-50 bg-muted/20' : ''}>
                      <TableCell className="font-mono font-bold text-foreground">
                        {j.code}
                      </TableCell>

                      <TableCell>
                        {isEditing ? (
                          <Input
                            value={editName}
                            onChange={e => setEditName(e.target.value)}
                            className="h-8 text-xs font-medium"
                            placeholder="Napló neve"
                            autoFocus
                          />
                        ) : (
                          <span className="font-medium text-foreground">{j.name}</span>
                        )}
                      </TableCell>

                      <TableCell>
                        <Badge variant="outline" className="text-[10px] font-normal">
                          {getTypeLabel(j.type)}
                        </Badge>
                      </TableCell>

                      <TableCell>
                        <Badge variant="secondary" className="text-[10px] font-mono font-semibold">
                          {j.currency}
                        </Badge>
                      </TableCell>

                      <TableCell>
                        {isEditing ? (
                          <Input
                            value={editGlAccount}
                            onChange={e => setEditGlAccount(e.target.value)}
                            className="h-8 text-xs font-mono"
                            placeholder="pl. 3842"
                          />
                        ) : (
                          <span className="font-mono text-muted-foreground">
                            {j.connected_gl_account ? (
                              (() => {
                                const match = glAccounts.find(g => g.gl_number === j.connected_gl_account);
                                return match ? `${match.gl_number} - ${match.short_name}` : j.connected_gl_account;
                              })()
                            ) : (
                              '—'
                            )}
                          </span>
                        )}
                      </TableCell>

                      <TableCell className="text-center">
                        {isEditing ? (
                          <div className="flex items-center justify-center">
                            <Switch
                              checked={editActive}
                              onCheckedChange={setEditActive}
                              aria-label="Aktív napló"
                            />
                          </div>
                        ) : j.is_active ? (
                          <Badge variant="default" className="text-[10px] bg-emerald-600 hover:bg-emerald-600">
                            Aktív
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px] text-muted-foreground">
                            Inaktív
                          </Badge>
                        )}
                      </TableCell>

                      <TableCell className="text-right">
                        {isEditing ? (
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7 text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700"
                              onClick={() => handleSaveEdit(j.id)}
                              disabled={savingId === j.id}
                              title="Mentés"
                            >
                              {savingId === j.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7 text-muted-foreground hover:bg-muted"
                              onClick={cancelEdit}
                              disabled={savingId === j.id}
                              title="Mégse"
                            >
                              <X className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        ) : (
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 text-muted-foreground hover:text-foreground"
                            onClick={() => startEdit(j)}
                            title="Szerkesztés"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          <DialogFooter className="pt-2 border-t flex justify-between items-center sm:justify-between">
            <span className="text-[11px] text-muted-foreground">
              Összesen {journals.length} db napló rögzítve ennél a cégnél.
            </span>
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              Bezárás
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Child CreateJournalModal for adding new journals */}
      <CreateJournalModal
        open={createModalOpen}
        onOpenChange={setCreateModalOpen}
        companyId={companyId}
        existingJournals={journals}
        glAccounts={glAccounts}
      />
    </>
  );
};
