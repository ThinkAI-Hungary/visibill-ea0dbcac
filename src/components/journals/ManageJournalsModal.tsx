import React, { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { BookOpen, Plus, Edit2, Lock, Landmark, Wallet, Receipt, FileSpreadsheet, Layers } from 'lucide-react';
import { CreateJournalModal, JOURNAL_TYPES } from './CreateJournalModal';
import { useTranslation } from 'react-i18next';
import { JOURNAL_CATEGORIES, getJournalCategory, isJournalSystemLocked, JournalCategoryKey } from '@/lib/journalUtils';
import { cn } from '@/lib/utils';

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
}

export const ManageJournalsModal: React.FC<ManageJournalsModalProps> = ({
  open,
  onOpenChange,
  companyId,
  journals,
  glAccounts = [],
}) => {
  const { t } = useTranslation(['accounting', 'common']);

  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editingJournal, setEditingJournal] = useState<JournalItem | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<JournalCategoryKey>('ALL');

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

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-4xl max-h-[85vh] flex flex-col p-6">
          <DialogHeader className="flex flex-row items-center justify-between pb-3 border-b">
            <div>
              <DialogTitle className="flex items-center gap-2 text-lg">
                <BookOpen className="w-5 h-5 text-primary" />
                <span>{t('accounting:journals.manage_modal.title', 'Könyvelési Naplótörzs Kezelése')}</span>
              </DialogTitle>
              <DialogDescription className="text-xs mt-1">
                {t('accounting:journals.manage_modal.description', 'Tekintse át, nevezze át és szabja testre a cég könyvelési naplóit (bankok, pénztárak, vegyes és forgalmi naplók).')}
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
          <div className="flex items-center gap-1.5 overflow-x-auto py-2 border-b scrollbar-none shrink-0">
            {JOURNAL_CATEGORIES.map(cat => {
              const isSelected = selectedCategory === cat.key;
              const count = categoryCounts[cat.key] || 0;
              return (
                <button
                  key={cat.key}
                  type="button"
                  onClick={() => setSelectedCategory(cat.key)}
                  className={cn(
                    "flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all shrink-0 border",
                    isSelected
                      ? "bg-primary text-primary-foreground border-primary shadow-xs font-semibold"
                      : "bg-muted/40 hover:bg-muted text-muted-foreground hover:text-foreground border-transparent"
                  )}
                >
                  <span>{cat.label}</span>
                  {cat.codeRange && (
                    <span className={cn("text-[10px] font-mono", isSelected ? "text-primary-foreground/80" : "text-muted-foreground/70")}>
                      ({cat.codeRange})
                    </span>
                  )}
                  <Badge variant={isSelected ? "secondary" : "outline"} className="px-1 py-0 text-[10px] ml-0.5">
                    {count}
                  </Badge>
                </button>
              );
            })}
          </div>

          <div className="flex-1 overflow-y-auto py-2">
            <Table>
              <TableHeader>
                <TableRow className="text-xs">
                  <TableHead className="w-[80px]">{t('accounting:journals.manage_modal.col_code', 'Kód')}</TableHead>
                  <TableHead className="min-w-[180px]">{t('accounting:journals.manage_modal.col_name', 'Megnevezés')}</TableHead>
                  <TableHead className="w-[110px]">{t('accounting:journals.manage_modal.col_type', 'Típus')}</TableHead>
                  <TableHead className="w-[70px]">{t('accounting:journals.manage_modal.col_currency', 'Deviza')}</TableHead>
                  <TableHead className="min-w-[140px]">{t('accounting:journals.manage_modal.col_gl', 'Kapcsolt Főkönyv')}</TableHead>
                  <TableHead className="w-[160px]">Bankszámla</TableHead>
                  <TableHead className="w-[90px] text-center">{t('accounting:journals.manage_modal.col_status', 'Státusz')}</TableHead>
                  <TableHead className="w-[80px] text-right">{t('accounting:journals.manage_modal.col_actions', 'Művelet')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="text-xs">
                {filteredJournals.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-6 text-muted-foreground">
                      Nincsenek naplók a kiválasztott kategóriában.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredJournals.map(j => {
                    const isLocked = isJournalSystemLocked(j);
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
                        <TableCell>
                          <Badge variant="secondary" className="text-[10px] font-mono">
                            {j.currency}
                          </Badge>
                        </TableCell>
                        <TableCell>
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
                            <span className="font-mono text-[11px] text-foreground truncate block max-w-[150px]" title={j.bank_account_number}>
                              {j.bank_account_number}
                            </span>
                          ) : (
                            <span className="text-muted-foreground/60 text-[11px]">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge
                            variant={j.is_active ? "outline" : "secondary"}
                            className={cn(
                              "text-[10px]",
                              j.is_active ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/30" : "text-muted-foreground"
                            )}
                          >
                            {j.is_active ? 'Aktív' : 'Inaktív'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
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

      {/* Full Edit / Create Journal Modal */}
      {(createModalOpen || !!editingJournal) && (
        <CreateJournalModal
          open={createModalOpen || !!editingJournal}
          onOpenChange={(isOpen) => {
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
        />
      )}
    </>
  );
};
