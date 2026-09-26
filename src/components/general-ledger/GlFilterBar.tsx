import React from 'react';
import { useTranslation } from 'react-i18next';
import { 
  Calendar, CalendarCheck, Layers, ShieldCheck, LayoutGrid, 
  Columns, FolderTree, ListTree, Receipt, ListFilter, Filter, 
  Maximize2, Minimize2 
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { CustomTooltip } from '@/components/ui/custom-tooltip';
import { GlSearchAutocomplete } from '@/components/general-ledger/GlSearchAutocomplete';
import { GlDateBasis, GlPostingStatus, GlSearchResult } from '@/lib/glData';
import { GlViewGranularity, GlItemGroupingMode } from '@/components/general-ledger/GeneralLedgerTable';

interface GlFilterBarProps {
  selectedCompanyId?: string;
  activePresetId: string | null;
  dateFrom: string;
  dateTo: string;
  dateBasis: GlDateBasis;
  postingStatus: GlPostingStatus;
  hideZeroBalances: boolean;
  viewLayout: 'summary' | 'classic';
  viewGranularity: GlViewGranularity;
  itemGrouping: GlItemGroupingMode;
  isAllExpanded: boolean;
  onDateBasisChange: (basis: GlDateBasis) => void;
  onPostingStatusChange: (status: GlPostingStatus) => void;
  onHideZeroChange: (hide: boolean) => void;
  onViewLayoutChange: (layout: 'summary' | 'classic') => void;
  onGranularityChange: (granularity: GlViewGranularity) => void;
  onItemGroupingChange: (grouping: GlItemGroupingMode) => void;
  onToggleExpandAll: (expand: boolean) => void;
  onSearchQueryChange: (q: string) => void;
  onSearchResultsChange: (results: GlSearchResult[]) => void;
  onSelectSearchResult: (result: GlSearchResult) => void;
  onClearSearch: () => void;
}

export function GlFilterBar({
  selectedCompanyId,
  activePresetId,
  dateFrom,
  dateTo,
  dateBasis,
  postingStatus,
  hideZeroBalances,
  viewLayout,
  viewGranularity,
  itemGrouping,
  isAllExpanded,
  onDateBasisChange,
  onPostingStatusChange,
  onHideZeroChange,
  onViewLayoutChange,
  onGranularityChange,
  onItemGroupingChange,
  onToggleExpandAll,
  onSearchQueryChange,
  onSearchResultsChange,
  onSelectSearchResult,
  onClearSearch,
}: GlFilterBarProps) {
  const { t } = useTranslation(['accounting', 'common']);

  return (
    <div className="relative z-30 select-none print:hidden">
      {/* ── 1. Sor: Kereső & Fa kinyitás/összecsukás (bal) | Időszak badge (jobb) ── */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 bg-muted/20">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <GlSearchAutocomplete
            companyId={selectedCompanyId}
            presetId={activePresetId}
            placeholder={t('accounting:general_ledger.search_placeholder', 'Keresés a főkönyvben (szám, név, partner)...')}
            onQueryChange={onSearchQueryChange}
            onSearchResultsChange={onSearchResultsChange}
            onSelect={onSelectSearchResult}
            onClear={onClearSearch}
          />
          <div className="h-5 w-px bg-border/60 shrink-0 hidden sm:block" />
          
          {/* Mind kinyitása / becsukása */}
          <div className="inline-flex h-8 items-center rounded-lg border border-border/80 bg-background/80 p-0.5 shadow-2xs text-xs shrink-0">
            <CustomTooltip content={t('accounting:general_ledger.expand_all_tooltip', 'Összes főkönyvi szám és alábontás lenyitása')} side="bottom">
              <button
                type="button"
                onClick={() => onToggleExpandAll(true)}
                className={cn(
                  "inline-flex h-7 items-center justify-center gap-1.5 px-2.5 rounded-md text-xs transition-all cursor-pointer border shrink-0 whitespace-nowrap",
                  isAllExpanded
                    ? "bg-muted text-foreground shadow-xs border-border/60 font-semibold text-primary"
                    : "text-muted-foreground hover:text-foreground border-transparent hover:bg-muted/50 font-medium"
                )}
              >
                <Maximize2 className="w-3.5 h-3.5 shrink-0" />
                <span className="hidden md:inline">{t('accounting:general_ledger.context_menu.expand_all', 'Mind kinyitása')}</span>
              </button>
            </CustomTooltip>
            <CustomTooltip content={t('accounting:general_ledger.collapse_all_tooltip', 'Összes alszámla becsukása a főkategóriák szintjére')} side="bottom">
              <button
                type="button"
                onClick={() => onToggleExpandAll(false)}
                className={cn(
                  "inline-flex h-7 items-center justify-center gap-1.5 px-2.5 rounded-md text-xs transition-all cursor-pointer border shrink-0 whitespace-nowrap",
                  !isAllExpanded
                    ? "bg-muted text-foreground shadow-xs border-border/60 font-semibold"
                    : "text-muted-foreground hover:text-foreground border-transparent hover:bg-muted/50 font-medium"
                )}
              >
                <Minimize2 className="w-3.5 h-3.5 shrink-0" />
                <span className="hidden md:inline">{t('accounting:general_ledger.context_menu.collapse_all', 'Mind összecsukása')}</span>
              </button>
            </CustomTooltip>
          </div>
        </div>

        {/* Időszak jelvény */}
        <div className="flex items-center gap-2.5 shrink-0 ml-auto">
          <span className="text-xs font-semibold text-muted-foreground bg-background px-3 py-1.5 rounded-lg border border-border flex items-center gap-2 shadow-2xs whitespace-nowrap">
            <Calendar className="w-3.5 h-3.5 text-primary shrink-0" />
            <span>{dateFrom.replace(/-/g, '.')} – {dateTo.replace(/-/g, '.')}</span>
          </span>
        </div>
      </div>

      {/* ── 2. Sor: Tisztított Szűrők & Megjelenítési Kapcsolók ── */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2 border-t border-border/30 bg-muted/10 text-xs">
        {/* Bal oldal: Adatszűrők */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1.5 text-muted-foreground font-medium text-xs mr-0.5">
            <Filter className="w-3.5 h-3.5 text-primary" />
            <span className="font-semibold text-foreground/85">
              {t('accounting:general_ledger.filters_label', 'Szűrők:')}
            </span>
          </div>

          {/* Dátum alap kapcsoló (Kibocsátás vs Teljesítés) */}
          <div className="flex items-center gap-1.5">
            <span className="text-muted-foreground/80 text-[11px] font-medium hidden sm:inline">
              {t('accounting:general_ledger.date_label', 'Dátum:')}
            </span>
            <div className="inline-flex h-8 items-center rounded-lg border border-border/80 bg-background/80 p-0.5 shadow-2xs text-xs select-none">
              <CustomTooltip content={t('accounting:general_ledger.date_basis.issue_tooltip', 'Számla kibocsátásának kelte alapján gyűjti az adatokat')} side="bottom">
                <button
                  type="button"
                  onClick={() => onDateBasisChange('kibocsatas')}
                  className={cn(
                    "inline-flex h-7 items-center justify-center gap-1.5 px-2.5 rounded-md text-xs transition-all cursor-pointer border whitespace-nowrap",
                    dateBasis === 'kibocsatas'
                      ? "bg-muted text-foreground shadow-xs border-border/60 font-semibold"
                      : "text-muted-foreground hover:text-foreground border-transparent hover:bg-muted/50 font-medium"
                  )}
                >
                  <Calendar className="w-3.5 h-3.5 shrink-0" />
                  <span>{t('accounting:general_ledger.date_basis.issue', 'Kibocsátás')}</span>
                </button>
              </CustomTooltip>
              <CustomTooltip content={t('accounting:general_ledger.date_basis.fulfillment_tooltip', 'Számla / tétel gazdasági teljesítésének dátuma alapján gyűjti az adatokat')} side="bottom">
                <button
                  type="button"
                  onClick={() => onDateBasisChange('teljesites')}
                  className={cn(
                    "inline-flex h-7 items-center justify-center gap-1.5 px-2.5 rounded-md text-xs transition-all cursor-pointer border whitespace-nowrap",
                    dateBasis === 'teljesites'
                      ? "bg-muted text-foreground shadow-xs border-border/60 font-semibold"
                      : "text-muted-foreground hover:text-foreground border-transparent hover:bg-muted/50 font-medium"
                  )}
                >
                  <CalendarCheck className="w-3.5 h-3.5 shrink-0" />
                  <span>{t('accounting:general_ledger.date_basis.fulfillment', 'Teljesítés')}</span>
                </button>
              </CustomTooltip>
            </div>
          </div>

          {/* Státusz szűrő (Összes vs Csak lekönyvelt) */}
          <div className="flex items-center gap-1.5">
            <span className="text-muted-foreground/80 text-[11px] font-medium hidden sm:inline">
              {t('accounting:general_ledger.documents_label', 'Bizonylatok:')}
            </span>
            <div className="inline-flex h-8 items-center rounded-lg border border-border/80 bg-background/80 p-0.5 shadow-2xs text-xs select-none">
              <CustomTooltip content={t('accounting:general_ledger.posting_status.all_tooltip', 'Minden tétel megjelenítése (operatív számlák és lekönyvelt bizonylatok együtt)')} side="bottom">
                <button
                  type="button"
                  onClick={() => onPostingStatusChange('all')}
                  className={cn(
                    "inline-flex h-7 items-center justify-center gap-1.5 px-2.5 rounded-md text-xs transition-all cursor-pointer border whitespace-nowrap",
                    postingStatus === 'all'
                      ? "bg-muted text-foreground shadow-xs border-border/60 font-semibold"
                      : "text-muted-foreground hover:text-foreground border-transparent hover:bg-muted/50 font-medium"
                  )}
                >
                  <Layers className="w-3.5 h-3.5 shrink-0" />
                  <span>{t('accounting:general_ledger.posting_status.all', 'Összes tétel')}</span>
                </button>
              </CustomTooltip>
              <CustomTooltip content={t('accounting:general_ledger.posting_status.posted_tooltip', 'Kizárólag a lezárt, könyvelt bizonylatok megjelenítése (Sztv. szerinti zárt könyvelés)')} side="bottom">
                <button
                  type="button"
                  onClick={() => onPostingStatusChange('posted_only')}
                  className={cn(
                    "inline-flex h-7 items-center justify-center gap-1.5 px-2.5 rounded-md text-xs transition-all cursor-pointer border whitespace-nowrap",
                    postingStatus === 'posted_only'
                      ? "bg-muted text-foreground shadow-xs border-border/60 font-semibold text-emerald-600 dark:text-emerald-400"
                      : "text-muted-foreground hover:text-foreground border-transparent hover:bg-muted/50 font-medium"
                  )}
                >
                  <ShieldCheck className="w-3.5 h-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                  <span>{t('accounting:general_ledger.posting_status.posted', 'Csak lekönyvelt')}</span>
                </button>
              </CustomTooltip>
            </div>
          </div>

          {/* Nullás egyenlegek elrejtése */}
          <div className="flex items-center gap-1.5">
            <span className="text-muted-foreground/80 text-[11px] font-medium hidden sm:inline">
              {t('accounting:general_ledger.balance_label', 'Egyenleg:')}
            </span>
            <div className="inline-flex h-8 items-center rounded-lg border border-border/80 bg-background/80 p-0.5 shadow-2xs text-xs select-none">
              <CustomTooltip content={t('accounting:general_ledger.hide_zero.all_tooltip', 'A teljes számlatükör megjelenítése forgalomtól függetlenül')} side="bottom">
                <button
                  type="button"
                  onClick={() => onHideZeroChange(false)}
                  className={cn(
                    "inline-flex h-7 items-center justify-center gap-1.5 px-2.5 rounded-md text-xs transition-all cursor-pointer border whitespace-nowrap",
                    !hideZeroBalances
                      ? "bg-muted text-foreground shadow-xs border-border/60 font-semibold"
                      : "text-muted-foreground hover:text-foreground border-transparent hover:bg-muted/50 font-medium"
                  )}
                >
                  <Layers className="w-3.5 h-3.5 shrink-0" />
                  <span>{t('accounting:general_ledger.hide_zero.all', 'Összes')}</span>
                </button>
              </CustomTooltip>
              <CustomTooltip content={t('accounting:general_ledger.hide_zero.active_tooltip', 'Csak azok a számlák jelennek meg, ahol van könyvelési tétel vagy forgalom')} side="bottom">
                <button
                  type="button"
                  onClick={() => onHideZeroChange(true)}
                  className={cn(
                    "inline-flex h-7 items-center justify-center gap-1.5 px-2.5 rounded-md text-xs transition-all cursor-pointer border whitespace-nowrap",
                    hideZeroBalances
                      ? "bg-muted text-foreground shadow-xs border-border/60 font-semibold text-primary"
                      : "text-muted-foreground hover:text-foreground border-transparent hover:bg-muted/50 font-medium"
                  )}
                >
                  <Filter className="w-3.5 h-3.5 shrink-0 text-primary" />
                  <span>{t('accounting:general_ledger.hide_zero.active_only', 'Csak forgalom')}</span>
                </button>
              </CustomTooltip>
            </div>
          </div>
        </div>

        {/* Jobb oldal: Nézetformátum és Bontási mélység */}
        <div className="flex items-center gap-3 flex-wrap ml-auto">
          {/* Nézetmód: Összesítő vs 4 oszlopos klasszikus */}
          <div className="inline-flex h-8 items-center rounded-lg border border-border/80 bg-background/80 p-0.5 shadow-2xs text-xs select-none shrink-0">
            <CustomTooltip content={t('accounting:general_ledger.tooltips.view_summary', 'Összesítő nézet (Egyenleg + Forgalom T/K)')} side="bottom">
              <button
                type="button"
                onClick={() => onViewLayoutChange('summary')}
                className={cn(
                  "inline-flex h-7 items-center justify-center gap-1.5 px-2.5 rounded-md text-xs transition-all cursor-pointer border whitespace-nowrap",
                  viewLayout === 'summary'
                    ? "bg-muted text-foreground shadow-xs border-border/60 font-semibold"
                    : "text-muted-foreground hover:text-foreground border-transparent hover:bg-muted/50 font-medium"
                )}
              >
                <LayoutGrid className="w-3.5 h-3.5 shrink-0" />
                <span>{t('accounting:general_ledger.view_summary', 'Összesítő')}</span>
              </button>
            </CustomTooltip>
            <CustomTooltip content={t('accounting:general_ledger.tooltips.view_classic', 'Klasszikus 4 oszlopos főkönyvi kivonat (Forgalom T/K, Egyenleg T/K)')} side="bottom">
              <button
                type="button"
                onClick={() => onViewLayoutChange('classic')}
                className={cn(
                  "inline-flex h-7 items-center justify-center gap-1.5 px-2.5 rounded-md text-xs transition-all cursor-pointer border whitespace-nowrap",
                  viewLayout === 'classic'
                    ? "bg-muted text-foreground shadow-xs border-border/60 font-semibold"
                    : "text-muted-foreground hover:text-foreground border-transparent hover:bg-muted/50 font-medium"
                )}
              >
                <Columns className="w-3.5 h-3.5 shrink-0" />
                <span>{t('accounting:general_ledger.view_classic', 'Klasszikus')}</span>
              </button>
            </CustomTooltip>
          </div>

          {/* Bontási szint: Kontírok vs Tételes */}
          <div className="inline-flex h-8 items-center rounded-lg border border-border/80 bg-background/80 p-0.5 shadow-2xs text-xs select-none shrink-0">
            <CustomTooltip content={t('accounting:general_ledger.tooltips.granularity_kontirok', 'Kontírok nézet (Összevont számlatükör fastruktúra - alapértelmezett)')} side="bottom">
              <button
                type="button"
                onClick={() => onGranularityChange('kontirok')}
                className={cn(
                  "inline-flex h-7 items-center justify-center gap-1.5 px-2.5 rounded-md text-xs transition-all cursor-pointer border whitespace-nowrap",
                  viewGranularity === 'kontirok'
                    ? "bg-muted text-foreground shadow-xs border-border/60 font-semibold"
                    : "text-muted-foreground hover:text-foreground border-transparent hover:bg-muted/50 font-medium"
                )}
              >
                <FolderTree className="w-3.5 h-3.5 shrink-0" />
                <span>{t('accounting:general_ledger.granularity_kontirok', 'Kontírok')}</span>
              </button>
            </CustomTooltip>
            <CustomTooltip content={t('accounting:general_ledger.tooltips.granularity_teteles', 'Tételes analitikus nézet (Minden számla alatt kibontva a könyvelt tételek)')} side="bottom">
              <button
                type="button"
                onClick={() => onGranularityChange('teteles')}
                className={cn(
                  "inline-flex h-7 items-center justify-center gap-1.5 px-2.5 rounded-md text-xs transition-all cursor-pointer border whitespace-nowrap",
                  viewGranularity === 'teteles'
                    ? "bg-muted text-foreground shadow-xs border-border/60 font-semibold text-primary"
                    : "text-muted-foreground hover:text-foreground border-transparent hover:bg-muted/50 font-medium"
                )}
              >
                <ListTree className="w-3.5 h-3.5 shrink-0 text-primary" />
                <span>{t('accounting:general_ledger.granularity_teteles', 'Tételes')}</span>
              </button>
            </CustomTooltip>
          </div>

          {/* Progressive Disclosure: Csak akkor jelenik meg a Számlánkénti összevonás, ha Tételes nézet aktív! */}
          {viewGranularity === 'teteles' && (
            <div className="inline-flex h-8 items-center rounded-lg border border-primary/30 bg-primary/5 p-0.5 shadow-2xs text-xs select-none shrink-0 animate-in fade-in-50 duration-200">
              <CustomTooltip content={t('accounting:general_ledger.item_grouping.by_invoice_tooltip', 'Számlánkénti összevonás: egy számlán szereplő azonos kontírtételek egy sorként jelennek meg')} side="bottom">
                <button
                  type="button"
                  onClick={() => onItemGroupingChange('by_invoice')}
                  className={cn(
                    "inline-flex h-7 items-center justify-center gap-1.5 px-2 rounded-md text-xs transition-all cursor-pointer border whitespace-nowrap",
                    itemGrouping === 'by_invoice'
                      ? "bg-background text-primary shadow-xs border-border/60 font-semibold"
                      : "text-muted-foreground hover:text-foreground border-transparent hover:bg-background/50 font-medium"
                  )}
                >
                  <Receipt className="w-3.5 h-3.5 shrink-0 text-primary" />
                  <span>{t('accounting:general_ledger.item_grouping.by_invoice', 'Számlánként')}</span>
                </button>
              </CustomTooltip>
              <CustomTooltip content={t('accounting:general_ledger.item_grouping.detailed_tooltip', 'Soronkénti bontás: minden könyvelt számlatétel különálló sorként jelenik meg')} side="bottom">
                <button
                  type="button"
                  onClick={() => onItemGroupingChange('detailed')}
                  className={cn(
                    "inline-flex h-7 items-center justify-center gap-1.5 px-2 rounded-md text-xs transition-all cursor-pointer border whitespace-nowrap",
                    itemGrouping === 'detailed'
                      ? "bg-background text-primary shadow-xs border-border/60 font-semibold"
                      : "text-muted-foreground hover:text-foreground border-transparent hover:bg-background/50 font-medium"
                  )}
                >
                  <ListFilter className="w-3.5 h-3.5 shrink-0" />
                  <span>{t('accounting:general_ledger.item_grouping.detailed', 'Tételenként')}</span>
                </button>
              </CustomTooltip>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
