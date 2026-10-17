import React, { useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Receipt,
  Landmark,
  Wallet,
  Settings2,
  Plus,
  AlertCircle,
  Lock,
  ChevronDown,
  Check,
  BookOpen,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { getLocalizedJournalName, isJournalSystemLocked } from '@/lib/journalUtils';

export interface GroupedJournalEntity {
  id: string;
  code: string;
  name: string;
  type: string;
  sub_type?: string | null;
  currency: string;
  connected_gl_account?: string | null;
  default_contra_gl_number?: string | null;
  bank_account_number?: string | null;
  is_system_locked?: boolean | null;
}

export interface GroupedJournalSelectorProps {
  journals: GroupedJournalEntity[];
  selectedJournalId: string;
  onSelectJournalId?: (id: string) => void;
  onSelectJournal?: (id: string) => void;
  munkalistaCount: number;
  loadingJournals?: boolean;
  onOpenCreateModal?: () => void;
  onOpenCreateJournal?: () => void;
  onOpenManageModal?: () => void;
  onOpenManageJournals?: () => void;
  canWriteLedger?: boolean;
  t?: (key: string, defaultValue?: any) => string;
}

export const GroupedJournalSelector: React.FC<GroupedJournalSelectorProps> = ({
  journals,
  selectedJournalId,
  onSelectJournalId,
  onSelectJournal,
  munkalistaCount,
  loadingJournals = false,
  onOpenCreateModal,
  onOpenCreateJournal,
  onOpenManageModal,
  onOpenManageJournals,
  canWriteLedger = true,
  t,
}) => {
  const selectJournal = onSelectJournal || onSelectJournalId || (() => {});
  const openCreateModal = onOpenCreateJournal || onOpenCreateModal || (() => {});
  const openManageModal = onOpenManageJournals || onOpenManageModal || (() => {});

  // Categorize journals into the 4 main groups
  const groups = useMemo(() => {
    const invoices: GroupedJournalEntity[] = [];
    const banks: GroupedJournalEntity[] = [];
    const cash: GroupedJournalEntity[] = [];
    const generalSystem: GroupedJournalEntity[] = [];

    journals.forEach((j) => {
      const code = (j.code || '').trim().toUpperCase();
      const type = (j.type || '').trim().toUpperCase();

      if (
        type === 'CUSTOMER' ||
        type === 'SUPPLIER' ||
        code === 'VF' ||
        code === 'VD' ||
        code === 'SZF' ||
        code === 'SZD' ||
        (code.startsWith('V') && !code.startsWith('VE')) ||
        code.startsWith('SZ') ||
        (code.length === 3 && (code.startsWith('4') || code.startsWith('5')))
      ) {
        invoices.push(j);
      } else if (
        type === 'BANK' ||
        code.startsWith('B') ||
        (code.length === 3 && code.startsWith('2'))
      ) {
        banks.push(j);
      } else if (
        type === 'PETTY_CASH' ||
        code.startsWith('P') ||
        code === 'PV' ||
        (code.length === 3 && code.startsWith('3'))
      ) {
        cash.push(j);
      } else {
        generalSystem.push(j);
      }
    });

    // Sort logically
    const codeSort = (a: GroupedJournalEntity, b: GroupedJournalEntity) => a.code.localeCompare(b.code, 'hu', { numeric: true });
    invoices.sort(codeSort);
    banks.sort(codeSort);
    cash.sort(codeSort);
    generalSystem.sort(codeSort);

    return { invoices, banks, cash, generalSystem };
  }, [journals]);

  // Find currently selected journal entity
  const selectedJournal = useMemo(() => {
    if (selectedJournalId === 'munkalista') return null;
    return journals.find((j) => j.id === selectedJournalId) || null;
  }, [journals, selectedJournalId]);

  // Determine active category
  const activeCategory = useMemo(() => {
    if (!selectedJournal) return null;
    if (groups.invoices.some((j) => j.id === selectedJournal.id)) return 'INVOICE';
    if (groups.banks.some((j) => j.id === selectedJournal.id)) return 'BANK';
    if (groups.cash.some((j) => j.id === selectedJournal.id)) return 'PETTY_CASH';
    return 'SYSTEM';
  }, [selectedJournal, groups]);

  const isMunkalistaActive = selectedJournalId === 'munkalista';

  return (
    <div className="w-full flex flex-wrap items-center justify-between gap-2.5 py-1.5 border-b border-border/50 bg-card/40 px-3 rounded-lg backdrop-blur-xs">
      {/* Left side: Munkalista & 4 Group Dropdowns */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {/* 1. Kiemelt Fix Fül: Munkalista (Drafts / Staging) */}
        <Button
          type="button"
          size="sm"
          variant={isMunkalistaActive ? 'default' : 'outline'}
          className={cn(
            'h-9 px-3 gap-2 text-xs font-semibold rounded-md transition-all shadow-xs shrink-0',
            isMunkalistaActive
              ? 'bg-amber-600 hover:bg-amber-500 text-white border-amber-600 shadow-amber-950/20'
              : 'border-amber-500/30 text-amber-600 hover:bg-amber-500/10 hover:text-amber-700 dark:text-amber-400 dark:hover:bg-amber-950/30'
          )}
          onClick={() => selectJournal('munkalista')}
        >
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          <span>Munkalista</span>
          {munkalistaCount > 0 ? (
            <Badge
              variant="secondary"
              className={cn(
                'ml-1 px-1.5 py-0 text-[10px] font-mono h-4 min-w-[18px] justify-center',
                isMunkalistaActive
                  ? 'bg-white/20 text-white'
                  : 'bg-amber-500/20 text-amber-700 dark:text-amber-300'
              )}
            >
              {munkalistaCount}
            </Badge>
          ) : (
            <span className="text-[10px] opacity-70">✓</span>
          )}
        </Button>

        <div className="h-5 w-[1px] bg-border/60 mx-1 hidden sm:block" />

        {/* 2. Számlák (Invoices) Lenyíló: VF, VD, SZF, SZD */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              size="sm"
              variant={activeCategory === 'INVOICE' ? 'default' : 'outline'}
              className={cn(
                'h-9 px-2.5 gap-1.5 text-xs font-medium rounded-md transition-all shrink-0',
                activeCategory === 'INVOICE'
                  ? 'bg-sky-600 hover:bg-sky-500 text-white border-sky-600 shadow-xs'
                  : 'border-sky-500/30 text-sky-700 hover:bg-sky-500/10 dark:text-sky-300'
              )}
            >
              <Receipt className="w-3.5 h-3.5 shrink-0 text-sky-400" />
              <span>
                Számlák ({groups.invoices.length})
                {activeCategory === 'INVOICE' && selectedJournal && (
                  <span className="ml-1.5 font-bold font-mono">[{selectedJournal.code}]</span>
                )}
              </span>
              <ChevronDown className="w-3 h-3 opacity-60 ml-0.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-64 max-h-[360px] overflow-y-auto z-[1200]">
            <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold flex items-center justify-between">
              <span>Vevő & Szállító Naplók</span>
              <span className="font-mono">{groups.invoices.length} db</span>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {groups.invoices.length === 0 ? (
              <div className="px-3 py-2 text-xs text-muted-foreground italic">Nincs rögzített számlanapló</div>
            ) : (
              groups.invoices.map((j) => {
                const isSelected = selectedJournalId === j.id;
                return (
                  <DropdownMenuItem
                    key={j.id}
                    onClick={() => selectJournal(j.id)}
                    className={cn(
                      'flex items-center justify-between py-2 cursor-pointer text-xs',
                      isSelected && 'bg-accent font-semibold'
                    )}
                  >
                    <div className="flex items-center gap-2 min-w-0 pr-2">
                      <span className="font-mono font-bold w-9 shrink-0 text-foreground">{j.code}</span>
                      <span className="truncate">{getLocalizedJournalName(j, j.name, t)}</span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 font-mono font-normal">
                        {j.currency}
                      </Badge>
                      {isSelected && <Check className="w-3.5 h-3.5 text-primary" />}
                    </div>
                  </DropdownMenuItem>
                );
              })
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* 3. Bankok (Banks) Lenyíló: B1, B2.. */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              size="sm"
              variant={activeCategory === 'BANK' ? 'default' : 'outline'}
              className={cn(
                'h-9 px-2.5 gap-1.5 text-xs font-medium rounded-md transition-all shrink-0',
                activeCategory === 'BANK'
                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-600 shadow-xs'
                  : 'border-emerald-500/30 text-emerald-700 hover:bg-emerald-500/10 dark:text-emerald-300'
              )}
            >
              <Landmark className="w-3.5 h-3.5 shrink-0 text-emerald-400" />
              <span>
                Bankok ({groups.banks.length})
                {activeCategory === 'BANK' && selectedJournal && (
                  <span className="ml-1.5 font-bold font-mono">[{selectedJournal.code}]</span>
                )}
              </span>
              <ChevronDown className="w-3 h-3 opacity-60 ml-0.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-72 max-h-[360px] overflow-y-auto z-[1200]">
            <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold flex items-center justify-between">
              <span>Céges Bankszámlák & Naplók</span>
              <span className="font-mono">{groups.banks.length} db</span>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {groups.banks.length === 0 ? (
              <div className="px-3 py-2 text-xs text-muted-foreground italic">Nincs rögzített banknapló</div>
            ) : (
              groups.banks.map((j) => {
                const isSelected = selectedJournalId === j.id;
                return (
                  <DropdownMenuItem
                    key={j.id}
                    onClick={() => selectJournal(j.id)}
                    className={cn(
                      'flex items-center justify-between py-2 cursor-pointer text-xs',
                      isSelected && 'bg-accent font-semibold'
                    )}
                  >
                    <div className="flex flex-col min-w-0 pr-2 leading-tight">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono font-bold text-foreground">{j.code}</span>
                        <span className="truncate">{getLocalizedJournalName(j, j.name, t)}</span>
                      </div>
                      {j.bank_account_number && (
                        <span className="font-mono text-[10px] text-muted-foreground truncate">
                          {j.bank_account_number}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 font-mono font-normal">
                        {j.currency}
                      </Badge>
                      {isSelected && <Check className="w-3.5 h-3.5 text-primary" />}
                    </div>
                  </DropdownMenuItem>
                );
              })
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* 4. Pénztárak (Petty Cash) Lenyíló: P1, P2, PV */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              size="sm"
              variant={activeCategory === 'PETTY_CASH' ? 'default' : 'outline'}
              className={cn(
                'h-9 px-2.5 gap-1.5 text-xs font-medium rounded-md transition-all shrink-0',
                activeCategory === 'PETTY_CASH'
                  ? 'bg-amber-600 hover:bg-amber-500 text-white border-amber-600 shadow-xs'
                  : 'border-amber-500/30 text-amber-700 hover:bg-amber-500/10 dark:text-amber-300'
              )}
            >
              <Wallet className="w-3.5 h-3.5 shrink-0 text-amber-400" />
              <span>
                Pénztárak ({groups.cash.length})
                {activeCategory === 'PETTY_CASH' && selectedJournal && (
                  <span className="ml-1.5 font-bold font-mono">[{selectedJournal.code}]</span>
                )}
              </span>
              <ChevronDown className="w-3 h-3 opacity-60 ml-0.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-64 max-h-[360px] overflow-y-auto z-[1200]">
            <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold flex items-center justify-between">
              <span>Házipénztárak & Kasszák</span>
              <span className="font-mono">{groups.cash.length} db</span>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {groups.cash.length === 0 ? (
              <div className="px-3 py-2 text-xs text-muted-foreground italic">Nincs rögzített pénztárnapló</div>
            ) : (
              groups.cash.map((j) => {
                const isSelected = selectedJournalId === j.id;
                return (
                  <DropdownMenuItem
                    key={j.id}
                    onClick={() => selectJournal(j.id)}
                    className={cn(
                      'flex items-center justify-between py-2 cursor-pointer text-xs',
                      isSelected && 'bg-accent font-semibold'
                    )}
                  >
                    <div className="flex items-center gap-2 min-w-0 pr-2">
                      <span className="font-mono font-bold w-8 shrink-0 text-foreground">{j.code}</span>
                      <span className="truncate">{getLocalizedJournalName(j, j.name, t)}</span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 font-mono font-normal">
                        {j.currency}
                      </Badge>
                      {isSelected && <Check className="w-3.5 h-3.5 text-primary" />}
                    </div>
                  </DropdownMenuItem>
                );
              })
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* 5. Vegyes & Rendszer (General & System) Lenyíló: VE, TE, ARF, ELH, BER, NY, Z */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              size="sm"
              variant={activeCategory === 'SYSTEM' ? 'default' : 'outline'}
              className={cn(
                'h-9 px-2.5 gap-1.5 text-xs font-medium rounded-md transition-all shrink-0',
                activeCategory === 'SYSTEM'
                  ? 'bg-indigo-600 hover:bg-indigo-500 text-white border-indigo-600 shadow-xs'
                  : 'border-indigo-500/30 text-indigo-700 hover:bg-indigo-500/10 dark:text-indigo-300'
              )}
            >
              <Settings2 className="w-3.5 h-3.5 shrink-0 text-indigo-400" />
              <span>
                Vegyes & Rendszer ({groups.generalSystem.length})
                {activeCategory === 'SYSTEM' && selectedJournal && (
                  <span className="ml-1.5 font-bold font-mono">[{selectedJournal.code}]</span>
                )}
              </span>
              <ChevronDown className="w-3 h-3 opacity-60 ml-0.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-72 max-h-[360px] overflow-y-auto z-[1200]">
            <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold flex items-center justify-between">
              <span>Vegyes, Nyitó, Záró & Rendszer</span>
              <span className="font-mono">{groups.generalSystem.length} db</span>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {groups.generalSystem.map((j) => {
              const isSelected = selectedJournalId === j.id;
              const locked = isJournalSystemLocked(j);
              return (
                <DropdownMenuItem
                  key={j.id}
                  onClick={() => selectJournal(j.id)}
                  className={cn(
                    'flex items-center justify-between py-2 cursor-pointer text-xs',
                    isSelected && 'bg-accent font-semibold'
                  )}
                >
                  <div className="flex items-center gap-1.5 min-w-0 pr-2">
                    <span className="font-mono font-bold w-10 shrink-0 text-foreground">{j.code}</span>
                    <span className="truncate">{getLocalizedJournalName(j, j.name, t)}</span>
                    {locked && (
                      <span title="Zárt gépi napló" className="shrink-0 flex items-center">
                        <Lock className="w-3 h-3 text-amber-500" />
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 font-mono font-normal">
                      {j.currency}
                    </Badge>
                    {isSelected && <Check className="w-3.5 h-3.5 text-primary" />}
                  </div>
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Right side: ➕ Új Napló Létrehozása & Naplók kezelése */}
      <div className="flex items-center gap-2 shrink-0">
        {(onOpenManageJournals || onOpenManageModal) && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={openManageModal}
            className="h-8 px-2.5 text-xs text-muted-foreground hover:text-foreground gap-1.5"
            title="Naplótörzs részletes kezelése és átnevezése"
          >
            <Settings2 className="w-3.5 h-3.5 text-primary" />
            <span className="hidden md:inline">Naplótörzs</span>
          </Button>
        )}

        <Button
          type="button"
          size="sm"
          onClick={openCreateModal}
          disabled={!canWriteLedger}
          className="h-8 px-3 gap-1.5 text-xs font-semibold bg-gradient-to-r from-primary to-primary/90 text-primary-foreground shadow-xs hover:scale-[1.02] active:scale-[0.98] transition-all"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Új Napló</span>
        </Button>
      </div>
    </div>
  );
};
