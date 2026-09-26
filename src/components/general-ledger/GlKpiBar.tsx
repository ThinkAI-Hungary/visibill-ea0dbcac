import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Database, FileText, Download, ChevronDown, ChevronUp, CheckCircle2 } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { CustomTooltip } from '@/components/ui/custom-tooltip';

interface GlKpiBarProps {
  glStats: {
    accountCount: number;
    leafCount: number;
    totalDebit: number;
    totalCredit: number;
    classifiedItems: number;
    totalItems: number;
  } | null;
  isTableLoading: boolean;
  currencyLabel: string;
  isCroatia: boolean;
  companyId?: string;
}

export function GlKpiBar({
  glStats,
  isTableLoading,
  currencyLabel,
  isCroatia,
  companyId,
}: GlKpiBarProps) {
  const { t } = useTranslation(['accounting', 'common']);

  // Persist expanded/collapsed state per company in localStorage
  const storageKey = companyId ? `visibill_gl_kpi_expanded_${companyId}` : 'visibill_gl_kpi_expanded';
  const [isExpanded, setIsExpanded] = useState<boolean>(() => {
    try {
      return localStorage.getItem(storageKey) === 'true';
    } catch {
      return false;
    }
  });

  const handleToggleExpand = (expanded: boolean) => {
    setIsExpanded(expanded);
    try {
      localStorage.setItem(storageKey, String(expanded));
    } catch {}
  };

  const fmtCurrency = (v: number) => 
    new Intl.NumberFormat(isCroatia ? 'hr-HR' : 'hu-HU').format(Math.round(v));

  // Skeleton loading state
  if (isTableLoading || !glStats || glStats.accountCount === 0) {
    return (
      <div className="bg-card border border-border/60 rounded-xl p-2.5 print:hidden animate-pulse">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <Skeleton className="h-5 w-24 bg-muted/60" />
            <Skeleton className="h-5 w-28 bg-muted/60" />
            <Skeleton className="h-5 w-32 bg-muted/60" />
            <Skeleton className="h-5 w-32 bg-muted/60" />
          </div>
          <Skeleton className="h-5 w-40 bg-muted/50" />
        </div>
      </div>
    );
  }

  const pct = glStats.totalItems > 0 
    ? Math.round((glStats.classifiedItems / glStats.totalItems) * 100) 
    : 100;

  // ── 1. Kompakt nézet (1-soros, helytakarékos, áttekinthető) ──
  if (!isExpanded) {
    return (
      <div className="bg-card border border-border/60 rounded-xl px-4 py-2.5 shadow-2xs print:hidden flex items-center justify-between gap-3 flex-wrap">
        {/* Bal oldali összesítő mérőszámok */}
        <div className="flex items-center gap-2 sm:gap-4 flex-wrap text-xs">
          <div className="flex items-center gap-1.5 font-medium">
            <Database className="w-3.5 h-3.5 text-primary shrink-0" />
            <span className="text-muted-foreground">{t('accounting:general_ledger.kpi.accounts', 'Főkönyvi számok')}:</span>
            <span className="font-bold tabular-nums text-foreground">{glStats.accountCount}</span>
          </div>

          <div className="h-3.5 w-px bg-border/60 hidden sm:block" />

          <div className="flex items-center gap-1.5 font-medium">
            <FileText className="w-3.5 h-3.5 text-blue-500 shrink-0" />
            <span className="text-muted-foreground">{t('accounting:general_ledger.kpi.leaf_accounts', 'Analitikák')}:</span>
            <span className="font-bold tabular-nums text-foreground">{glStats.leafCount}</span>
          </div>

          <div className="h-3.5 w-px bg-border/60 hidden sm:block" />

          {/* Tartozik egyenleg */}
          <div className="flex items-center gap-1.5 font-medium bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 rounded-md border border-emerald-500/20">
            <span className="text-[11px] font-semibold opacity-90">T:</span>
            <span className="font-bold tabular-nums font-mono">{fmtCurrency(glStats.totalDebit)} {currencyLabel}</span>
          </div>

          {/* Követel egyenleg */}
          <div className="flex items-center gap-1.5 font-medium bg-sky-500/10 text-sky-700 dark:text-sky-300 px-2 py-0.5 rounded-md border border-sky-500/20">
            <span className="text-[11px] font-semibold opacity-90">K:</span>
            <span className="font-bold tabular-nums font-mono">{fmtCurrency(glStats.totalCredit)} {currencyLabel}</span>
          </div>
        </div>

        {/* Jobb oldal: AI Besorolási haladás és Kinyitás gomb */}
        <div className="flex items-center gap-3 ml-auto text-xs">
          {glStats.totalItems > 0 && (
            <CustomTooltip 
              content={t('accounting:general_ledger.kpi.classification_progress', {
                classified: glStats.classifiedItems,
                total: glStats.totalItems,
                defaultValue: `Besorolva: ${glStats.classifiedItems}/${glStats.totalItems} tétel (${pct}%)`
              })}
              side="bottom"
            >
              <div className="flex items-center gap-2 cursor-default select-none">
                <span className="text-[11px] text-muted-foreground hidden lg:inline">
                  {t('accounting:general_ledger.toolbar.ai_classification', 'Besorolás')}:
                </span>
                <span className={`text-xs font-semibold tabular-nums ${pct === 100 ? 'text-emerald-600 dark:text-emerald-400 font-bold' : 'text-foreground'}`}>
                  {pct}%
                </span>
                <div className="w-16 sm:w-20 h-1.5 bg-muted rounded-full overflow-hidden shrink-0">
                  <div 
                    className={`h-full rounded-full transition-all duration-500 ${pct === 100 ? 'bg-emerald-500' : 'bg-gradient-to-r from-primary to-blue-500'}`} 
                    style={{ width: `${pct}%` }} 
                  />
                </div>
              </div>
            </CustomTooltip>
          )}

          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => handleToggleExpand(true)}
            className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground gap-1"
          >
            <ChevronDown className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{t('accounting:general_ledger.kpi.details', 'Részletek')}</span>
          </Button>
        </div>
      </div>
    );
  }

  // ── 2. Részletes kártyás nézet (Kinyitott 4-kártyás blokk) ──
  return (
    <div className="space-y-3 print:hidden animate-in fade-in-50 duration-200">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          {t('accounting:general_ledger.kpi.overview_title', 'Főkönyvi Összesítés')}
        </span>
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={() => handleToggleExpand(false)}
          className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground gap-1"
        >
          <ChevronUp className="w-3.5 h-3.5" />
          <span>{t('accounting:general_ledger.kpi.compact', 'Kompakt nézet')}</span>
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-card border border-border/60 rounded-xl p-3 flex items-center gap-3 shadow-2xs">
          <div className="bg-primary/10 text-primary p-2 rounded-lg shrink-0"><Database className="w-4 h-4" /></div>
          <div>
            <div className="text-base sm:text-lg font-bold tabular-nums">{glStats.accountCount}</div>
            <div className="text-[11px] text-muted-foreground">{t('accounting:general_ledger.kpi.accounts', 'Főkönyvi számok')}</div>
          </div>
        </div>

        <div className="bg-card border border-border/60 rounded-xl p-3 flex items-center gap-3 shadow-2xs">
          <div className="bg-blue-500/10 text-blue-600 p-2 rounded-lg shrink-0"><FileText className="w-4 h-4" /></div>
          <div>
            <div className="text-base sm:text-lg font-bold tabular-nums">{glStats.leafCount}</div>
            <div className="text-[11px] text-muted-foreground">{t('accounting:general_ledger.kpi.leaf_accounts', 'Analitikus számlák')}</div>
          </div>
        </div>

        <div className="bg-card border border-border/60 rounded-xl p-3 flex items-center gap-3 shadow-2xs">
          <div className="bg-emerald-500/10 text-emerald-600 p-2 rounded-lg shrink-0"><Download className="w-4 h-4 rotate-180" /></div>
          <div>
            <div className="text-base sm:text-lg font-bold tabular-nums font-mono">{fmtCurrency(glStats.totalDebit)} {currencyLabel}</div>
            <div className="text-[11px] text-muted-foreground">
              {t('accounting:general_ledger.kpi.debit', { currency: currencyLabel, defaultValue: `Tartozik (${currencyLabel})` })}
            </div>
          </div>
        </div>

        <div className="bg-card border border-border/60 rounded-xl p-3 flex items-center gap-3 shadow-2xs">
          <div className="bg-sky-500/10 text-sky-600 p-2 rounded-lg shrink-0"><Download className="w-4 h-4" /></div>
          <div>
            <div className="text-base sm:text-lg font-bold tabular-nums font-mono">{fmtCurrency(glStats.totalCredit)} {currencyLabel}</div>
            <div className="text-[11px] text-muted-foreground">
              {t('accounting:general_ledger.kpi.credit', { currency: currencyLabel, defaultValue: `Követel (${currencyLabel})` })}
            </div>
          </div>
        </div>
      </div>

      {/* AI Besorolási haladási csík részletes nézetben */}
      {glStats.totalItems > 0 && (
        <div className="bg-card border border-border/60 rounded-xl p-2.5 shadow-2xs">
          <div className="flex justify-between text-xs text-muted-foreground mb-1 leading-none">
            <span className="font-medium">
              {t('accounting:general_ledger.kpi.classification_progress', {
                classified: glStats.classifiedItems,
                total: glStats.totalItems,
                defaultValue: `AI Besorolás: ${glStats.classifiedItems} / ${glStats.totalItems} tétel feldolgozva`
              })}
            </span>
            <span className={pct === 100 ? 'text-emerald-600 dark:text-emerald-400 font-bold' : 'font-semibold'}>
              {pct === 100 ? (
                <span className="inline-flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> Kész (100%)</span>
              ) : `${pct}%`}
            </span>
          </div>
          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
            <div 
              className={`h-full rounded-full transition-all duration-500 ${pct === 100 ? 'bg-emerald-500' : 'bg-gradient-to-r from-primary to-blue-500'}`} 
              style={{ width: `${pct}%` }} 
            />
          </div>
        </div>
      )}
    </div>
  );
}
