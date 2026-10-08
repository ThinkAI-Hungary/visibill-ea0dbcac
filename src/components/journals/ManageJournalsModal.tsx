import React, { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { BookOpen, Plus, Edit2, Lock, Trash2, AlertTriangle, Loader2 } from 'lucide-react';
import { CreateJournalModal, JOURNAL_TYPES } from './CreateJournalModal';
import { useTranslation } from 'react-i18next';
import {
  JOURNAL_CATEGORIES,
  getJournalCategory,
  isJournalSystemLocked,
  isJournalCoreSystem,
  JournalCategoryKey,
} from '@/lib/journalUtils';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';

export interface JournalItem {
  id: string;
  company_id: string;
  code: string;
  name: string;
  type: string;
  currency: string;
  connected_gl_account: string | null;
  bank_account_number?: string | null;
  is_active: boolean;
  is_system_locked?: boolean;
  created_at?: string;
}

interface ManageJournalsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId: string;
  journals: JournalItem[];
  glAccounts?: Array<{ id: string; gl_number: string; short_name: string; currency?: string | null }>;
  onJournalDeleted?: (journalId: string) => void;
}

export const ManageJournalsModal: React.FC<ManageJournalsModalProps> = ({
  open,
  onOpenChange,
  companyId,
  journals,
  glAccounts = [],
  onJournalDeleted,
}) => {
  const { t } = useTranslation(['accounting', 'common']);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editingJournal, setEditingJournal] = useState<JournalItem | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<JournalCategoryKey>('ALL');

  // Deletion state
  const [deletingJournal, setDeletingJournal] = useState<JournalItem | null>(null);
  const [blockedDeleteJournal, setBlockedDeleteJournal] = useState<{ journal: JournalItem; count: number } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isInactivating, setIsInactivating] = useState(false);

  // Fetch entry counts for all journals of this company
  const {
    data: journalHeaderCounts = {},
    isLoading: loadingCounts,
    refetch: refetchHeaderCounts,
  } = useQuery({
    queryKey: ['acc-journal-header-counts', companyId],
    queryFn: async () => {
      if (!companyId) return {};
      const { data, error } = await supabase
        .from('acc_journal_headers')
        .select('journal_id')
        .eq('company_id', companyId);

      if (error) {
        console.error('Error fetching journal header counts:', error);
        return {};
      }

      const counts: Record<string, number> = {};
      (data || []).forEach((row: { journal_id?: string | null }) => {
        if (row.journal_id) {
          counts[row.journal_id] = (counts[row.journal_id] || 0) + 1;
        }
      });
      return counts;
    },
    enabled: open && !!companyId,
    staleTime: 1000 * 30,
  });

  // Categorize and filter journals
  const filteredJournals = useMemo(() => {
    if (selectedCategory === 'ALL') return journals;
    return journals.filter(j => getJournalCategory(j) === selectedCategory);
  }, [journals, selectedCategory]);

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { ALL: journals.length };
    JOURNAL_CATEGORIES.forEach(cat => {
      if (cat.key !== 'ALL') {
        counts[cat.key] = journals.filter(j => getJournalCategory(j) === cat.key).length;
      }
    });
    return counts;
  }, [journals]);

  const getTypeLabel = (type: string) => {
    return t(`accounting:journals.create_modal.types.${type}`, {
      defaultValue: (() => {
        const match = JOURNAL_TYPES.find(t => t.value === type);
        return match ? match.label.split(' ')[0] : type;
      })(),
    });
  };

  const startEdit = (j: JournalItem) => {
    setEditingJournal(j);
  };

  const handleDeleteClick = (j: JournalItem) => {
    const isCore = isJournalCoreSystem(j);
    if (isCore) {
      toast({
        title: 'Védett rendszer-napló',
        description: `A(z) ${j.code} (${j.name}) a rendszer működéséhez szükséges alapnapló, ezért nem törölhető. Szükség esetén inaktiválhatja a naplót.`,
        variant: 'destructive',
      });
      return;
    }

    const count = journalHeaderCounts[j.id] || 0;
    if (count > 0) {
      setBlockedDeleteJournal({ journal: j, count });
      return;
    }

    setDeletingJournal(j);
  };

  const handleConfirmDelete = async () => {
    if (!deletingJournal) return;
    setIsDeleting(true);
    try {
      // 1. Re-verify in DB if any headers exist for foreign key protection
      const { count, error: countErr } = await supabase
        .from('acc_journal_headers')
        .select('id', { count: 'exact', head: true })
        .eq('journal_id', deletingJournal.id);

      if (countErr) throw countErr;
      if (count && count > 0) {
        toast({
          title: 'Nem törölhető',
          description: `A(z) ${deletingJournal.code} naplóhoz időközben ${count} db tétel lett rögzítve, így nem törölhető.`,
          variant: 'destructive',
        });
        setBlockedDeleteJournal({ journal: deletingJournal, count });
        setDeletingJournal(null);
        refetchHeaderCounts();
        return;
      }

      // 2. Perform delete in acc_journals
      const { error: delErr } = await supabase
        .from('acc_journals')
        .delete()
        .eq('id', deletingJournal.id)
        .eq('company_id', companyId);

      if (delErr) throw delErr;

      toast({
        title: 'Napló sikeresen törölve',
        description: `A(z) ${deletingJournal.code} - ${deletingJournal.name} napló törölve lett.`,
      });

      queryClient.invalidateQueries({ queryKey: ['acc-journals', companyId] });
      queryClient.invalidateQueries({ queryKey: ['acc-bank-journals', companyId] });
      queryClient.invalidateQueries({ queryKey: ['company_bank_accounts', companyId] });
      queryClient.invalidateQueries({ queryKey: ['acc-journal-header-counts', companyId] });

      if (onJournalDeleted) {
        onJournalDeleted(deletingJournal.id);
      }

      setDeletingJournal(null);
    } catch (err: any) {
      console.error('Failed to delete journal:', err);
      toast({
        title: 'Hiba a törlés során',
        description: err?.message || 'A napló törlése nem sikerült.',
        variant: 'destructive',
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleInactivateBlocked = async () => {
    if (!blockedDeleteJournal) return;
    setIsInactivating(true);
    try {
      const { error } = await supabase
        .from('acc_journals')
        .update({ is_active: false })
        .eq('id', blockedDeleteJournal.journal.id)
        .eq('company_id', companyId);

      if (error) throw error;

      toast({
        title: 'Napló inaktiválva',
        description: `A(z) ${blockedDeleteJournal.journal.code} - ${blockedDeleteJournal.journal.name} napló sikeresen inaktívvá lett téve.`,
      });

      queryClient.invalidateQueries({ queryKey: ['acc-journals', companyId] });
      queryClient.invalidateQueries({ queryKey: ['acc-bank-journals', companyId] });
      queryClient.invalidateQueries({ queryKey: ['company_bank_accounts', companyId] });

      setBlockedDeleteJournal(null);
    } catch (err: any) {
      console.error('Failed to inactivate journal:', err);
      toast({
        title: 'Hiba az inaktiválás során',
        description: err?.message || 'A napló inaktiválása sikertelen.',
        variant: 'destructive',
      });
    } finally {
      setIsInactivating(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-[96vw] sm:max-w-5xl md:max-w-6xl xl:max-w-7xl w-full max-h-[88vh] flex flex-col p-6">
          <DialogHeader className="flex flex-row items-center justify-between pb-3 border-b">
            <div>
              <DialogTitle className="flex items-center gap-2 text-lg">
                <BookOpen className="w-5 h-5 text-primary" />
                <span>{t('accounting:journals.manage_modal.title', 'Könyvelési Naplótörzs Kezelése')}</span>
              </DialogTitle>
              <DialogDescription className="text-xs mt-1">
                {t(
                  'accounting:journals.manage_modal.description',
                  'Tekintse át, nevezze át, szabja testre vagy törölje a cég könyvelési naplóit (bankok, pénztárak, vegyes és forgalmi naplók).'
                )}
              </DialogDescription>
            </div>
            <Button
              size="sm"
              onClick={() => {
                setEditingJournal(null);
                setCreateModalOpen(true);
              }}
              className="gap-1.5 shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>{t('accounting:journals.manage_modal.btn_new', 'Új Napló')}</span>
            </Button>
          </DialogHeader>

          {/* Category Filter Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto py-2 border-b scrollbar-thin shrink-0">
            {JOURNAL_CATEGORIES.map(cat => {
              const isSelected = selectedCategory === cat.key;
              const count = categoryCounts[cat.key] || 0;
              return (
                <button
                  key={cat.key}
                  type="button"
                  onClick={() => setSelectedCategory(cat.key)}
                  className={cn(
                    'flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all shrink-0 border',
                    isSelected
                      ? 'bg-primary text-primary-foreground border-primary shadow-xs font-semibold'
                      : 'bg-muted/40 hover:bg-muted text-muted-foreground hover:text-foreground border-transparent'
                  )}
                >
                  <span>{cat.label}</span>
                  {cat.codeRange && (
                    <span
                      className={cn(
                        'text-[10px] font-mono',
                        isSelected ? 'text-primary-foreground/80' : 'text-muted-foreground/70'
                      )}
                    >
                      ({cat.codeRange})
                    </span>
                  )}
                  <Badge variant={isSelected ? 'secondary' : 'outline'} className="px-1 py-0 text-[10px] ml-0.5">
                    {count}
                  </Badge>
                </button>
              );
            })}
          </div>

          <div className="flex-1 overflow-y-auto overflow-x-auto py-2 scrollbar-thin">
            <Table className="min-w-[940px]">
              <TableHeader>
                <TableRow className="text-xs">
                  <TableHead className="w-[70px]">{t('accounting:journals.manage_modal.col_code', 'Kód')}</TableHead>
                  <TableHead className="min-w-[180px]">{t('accounting:journals.manage_modal.col_name', 'Megnevezés')}</TableHead>
                  <TableHead className="w-[140px]">{t('accounting:journals.manage_modal.col_type', 'Típus')}</TableHead>
                  <TableHead className="w-[70px] text-center">{t('accounting:journals.manage_modal.col_currency', 'Deviza')}</TableHead>
                  <TableHead className="w-[130px] text-center">{t('accounting:journals.manage_modal.col_gl', 'Kapcsolt Főkönyv')}</TableHead>
                  <TableHead className="min-w-[170px]">Bankszámla</TableHead>
                  <TableHead className="w-[85px] text-center">Tételek</TableHead>
                  <TableHead className="w-[90px] text-center">{t('accounting:journals.manage_modal.col_status', 'Státusz')}</TableHead>
                  <TableHead className="w-[90px] text-right">{t('accounting:journals.manage_modal.col_actions', 'Művelet')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="text-xs">
                {filteredJournals.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-6 text-muted-foreground">
                      Nincsenek naplók a kiválasztott kategóriában.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredJournals.map(j => {
                    const isLocked = isJournalSystemLocked(j);
                    const isCore = isJournalCoreSystem(j);
                    const headerCount = journalHeaderCounts[j.id] || 0;

                    return (
                      <TableRow key={j.id} className="hover:bg-muted/40 transition-colors">
                        <TableCell className="font-mono font-bold text-foreground">
                          {j.code}
                        </TableCell>
                        <TableCell>
                          <div className="font-medium text-foreground">{j.name}</div>
                          {isLocked && (
                            <span className="inline-flex items-center gap-1 text-[10px] text-amber-600 dark:text-amber-400 mt-0.5 font-medium">
                              <Lock className="w-3 h-3" /> Zárt gépi napló
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-[10px] font-normal">
                            {getTypeLabel(j.type)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant="secondary" className="text-[10px] font-mono">
                            {j.currency}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          {j.connected_gl_account ? (
                            <span className="font-mono text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded border border-border/50 text-[11px]">
                              {j.connected_gl_account}
                            </span>
                          ) : (
                            <span className="text-muted-foreground/60 text-[11px]">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {j.bank_account_number ? (
                            <span className="font-mono text-[11px] text-foreground whitespace-nowrap block" title={j.bank_account_number}>
                              {j.bank_account_number}
                            </span>
                          ) : (
                            <span className="text-muted-foreground/60 text-[11px]">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-center font-mono">
                          {loadingCounts ? (
                            <span className="text-muted-foreground text-[10px]">...</span>
                          ) : (
                            <Badge
                              variant="outline"
                              className={cn(
                                'text-[10px] px-1.5 py-0',
                                headerCount > 0
                                  ? 'border-primary/30 text-primary bg-primary/5 font-semibold'
                                  : 'text-muted-foreground/60 border-border/40 font-normal'
                              )}
                            >
                              {headerCount} db
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge
                            variant={j.is_active ? 'outline' : 'secondary'}
                            className={cn(
                              'text-[10px]',
                              j.is_active ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30' : 'text-muted-foreground'
                            )}
                          >
                            {j.is_active ? 'Aktív' : 'Inaktív'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <TooltipProvider>
                              <Tooltip delayDuration={200}>
                                <TooltipTrigger asChild>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-7 w-7 p-0 hover:bg-muted text-muted-foreground hover:text-foreground"
                                    onClick={() => startEdit(j)}
                                    title="Szerkesztés"
                                    aria-label="Szerkesztés"
                                  >
                                    <Edit2 className="w-3.5 h-3.5" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent side="top" className="text-xs">
                                  Napló szerkesztése
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>

                            <TooltipProvider>
                              <Tooltip delayDuration={200}>
                                <TooltipTrigger asChild>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className={cn(
                                      'h-7 w-7 p-0 transition-colors',
                                      isCore
                                        ? 'text-muted-foreground/30 cursor-not-allowed hover:bg-transparent'
                                        : 'text-muted-foreground hover:text-destructive hover:bg-destructive/10'
                                    )}
                                    onClick={() => handleDeleteClick(j)}
                                    title={isCore ? 'Védett rendszer-napló nem törölhető' : 'Napló törlése'}
                                    aria-label="Törlés"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent side="top" className="text-xs">
                                  {isCore
                                    ? 'Alapértelmezett rendszer-napló nem törölhető'
                                    : headerCount > 0
                                    ? `${headerCount} db tétel miatt nem törölhető (inaktiválható)`
                                    : 'Napló törlése'}
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>

          <DialogFooter className="border-t pt-3 flex justify-between items-center">
            <span className="text-xs text-muted-foreground">
              Összesen {journals.length} könyvelési napló
            </span>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              {t('common:actions.close', 'Bezárás')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmation Dialog: Delete journal with 0 entries */}
      <AlertDialog open={!!deletingJournal} onOpenChange={isOpen => !isOpen && !isDeleting && setDeletingJournal(null)}>
        <AlertDialogContent className="sm:max-w-md">
          <AlertDialogHeader>
            <div className="w-10 h-10 rounded-full bg-destructive/10 text-destructive flex items-center justify-center mb-2">
              <Trash2 className="w-5 h-5" />
            </div>
            <AlertDialogTitle className="text-base">
              Napló törlése
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="text-xs space-y-2 text-foreground/80">
                <p>
                  Biztosan törölni szeretné a(z){' '}
                  <span className="font-semibold text-foreground font-mono">{deletingJournal?.code}</span> (
                  <span className="font-semibold text-foreground">{deletingJournal?.name}</span>) könyvelési naplót?
                </p>
                <p className="text-muted-foreground text-[11px] leading-relaxed">
                  Mivel a naplóhoz nem tartoznak könyvelési tételek, a törlés biztonságosan elvégezhető. 
                  A napló és annak sorszámlálója véglegesen törlődik. Ez a művelet nem vonható vissza.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:gap-0 mt-2">
            <AlertDialogCancel disabled={isDeleting}>
              {t('common:actions.cancel', 'Mégse')}
            </AlertDialogCancel>
            <Button
              variant="destructive"
              onClick={handleConfirmDelete}
              disabled={isDeleting}
              className="text-xs"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                  Törlés folyamatban...
                </>
              ) : (
                'Napló végleges törlése'
              )}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Blocked Delete Dialog: Journal has existing entries */}
      <AlertDialog open={!!blockedDeleteJournal} onOpenChange={isOpen => !isOpen && !isInactivating && setBlockedDeleteJournal(null)}>
        <AlertDialogContent className="sm:max-w-md">
          <AlertDialogHeader>
            <div className="w-10 h-10 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center mb-2">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <AlertDialogTitle className="text-base">
              A napló nem törölhető
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="text-xs space-y-2 text-foreground/80">
                <p>
                  A(z) <span className="font-semibold text-foreground font-mono">{blockedDeleteJournal?.journal.code}</span> (
                  <span className="font-semibold text-foreground">{blockedDeleteJournal?.journal.name}</span>) napló nem törölhető, 
                  mert már{' '}
                  <span className="font-semibold text-amber-600 dark:text-amber-400 font-mono">
                    {blockedDeleteJournal?.count} db
                  </span>{' '}
                  könyvelési tétel van rögzítve benne.
                </p>
                <p className="text-muted-foreground text-[11px] leading-relaxed">
                  A Számviteli törvény és az adatbázis integritása szerint a könyvelt tételeket tartalmazó naplók nem törölhetők. 
                  Ha a naplót a továbbiakban nem kívánja használni, inaktiválhatja, így új tételekhez már nem lesz kiválasztható.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2 mt-2">
            <AlertDialogCancel disabled={isInactivating}>
              Bezárás
            </AlertDialogCancel>
            {blockedDeleteJournal?.journal.is_active && (
              <Button
                variant="secondary"
                onClick={handleInactivateBlocked}
                disabled={isInactivating}
                className="text-xs"
              >
                {isInactivating ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                    Inaktiválás...
                  </>
                ) : (
                  'Napló inaktiválása most'
                )}
              </Button>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Full Edit / Create Journal Modal */}
      {(createModalOpen || !!editingJournal) && (
        <CreateJournalModal
          open={createModalOpen || !!editingJournal}
          onOpenChange={isOpen => {
            if (!isOpen) {
              setCreateModalOpen(false);
              setEditingJournal(null);
            }
          }}
          companyId={companyId}
          isEditMode={!!editingJournal}
          editJournalId={editingJournal?.id || null}
          initialCode={editingJournal?.code || ''}
          initialType={editingJournal?.type || 'BANK'}
          initialName={editingJournal?.name || ''}
          initialCurrency={editingJournal?.currency || 'HUF'}
          initialGlAccount={editingJournal?.connected_gl_account || ''}
          initialBankAccountNumber={editingJournal?.bank_account_number || ''}
          initialIsActive={editingJournal ? editingJournal.is_active : true}
          existingJournals={journals}
          glAccounts={glAccounts}
          onDeleteRequested={journalId => {
            const target = journals.find(j => j.id === journalId);
            if (target) {
              setEditingJournal(null);
              setCreateModalOpen(false);
              handleDeleteClick(target);
            }
          }}
        />
      )}
    </>
  );
};
