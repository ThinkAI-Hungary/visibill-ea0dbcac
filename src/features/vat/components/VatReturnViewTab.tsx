import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  Calculator,
  FileSpreadsheet,
  Download,
  Loader2,
  ChevronDown,
  Clock,
  ShieldCheck,
  AlertTriangle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { generateVatReturnPdf } from '@/lib/vatReturnPdf';
import { generateVatReturnXml } from '@/lib/vatReturnXml';
import { MONTHS } from '../types';
import { useVatReturnData } from '../hooks/useVatReturnData';
import { useToast } from '@/hooks/use-toast';
import { VatCalculatorView } from './VatCalculatorView';
import { VatNav65Replica } from './VatNav65Replica';

export function VatReturnViewTab() {
  const { t, i18n } = useTranslation(['accounting', 'common']);
  const { toast } = useToast();
  const vatData = useVatReturnData();
  const {
    selectedCompany,
    year,
    setYear,
    month,
    setMonth,
    frequency,
    setFrequency,
    viewMode,
    setViewMode,
    vatReturn,
    isFinalized,
    lines,
    mLines,
    formRows,
    deadlineCountdown,
    postingAudit,
    calculate,
    getVal,
  } = vatData;

  useKeyboardShortcuts([
    { combo: { key: 'p', ctrl: true }, handler: () => window.print(), description: 'Nyomtatás' },
  ]);

  return (
    <div className="space-y-5 page-animate">
      {/* Period Selector + Actions */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 bg-card p-3 rounded-xl border border-border shadow-sm animate-in slide-in-from-top-2 duration-300">
        <div className="flex items-center gap-3">
          {/* Frequency toggle */}
          <div className="flex bg-muted/50 border rounded-lg p-0.5">
            <button
              className={cn(
                'px-3 py-1.5 text-xs font-medium rounded-md transition-all',
                frequency === 'H'
                  ? 'bg-background shadow-sm text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              )}
              onClick={() => {
                if (frequency === 'N') {
                  setMonth((month - 1) * 3 + 1);
                } else if (frequency === 'E') {
                  setMonth(1);
                }
                setFrequency('H');
              }}
            >
              {t('accounting:vat_return.period.monthly', 'Havi')}
            </button>
            <button
              className={cn(
                'px-3 py-1.5 text-xs font-medium rounded-md transition-all',
                frequency === 'N'
                  ? 'bg-background shadow-sm text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              )}
              onClick={() => {
                if (frequency === 'H') {
                  setMonth(Math.ceil(month / 3));
                } else if (frequency === 'E') {
                  setMonth(1);
                }
                setFrequency('N');
              }}
            >
              {t('accounting:vat_return.period.quarterly', 'Negyedéves')}
            </button>
            <button
              className={cn(
                'px-3 py-1.5 text-xs font-medium rounded-md transition-all',
                frequency === 'E'
                  ? 'bg-background shadow-sm text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              )}
              onClick={() => {
                setFrequency('E');
                setMonth(12);
              }}
            >
              {t('accounting:vat_return.period.yearly', 'Éves')}
            </button>
          </div>

          <div className="border-l pl-3 border-border/60 flex items-center gap-2">
            <Select value={String(year)} onValueChange={(v) => setYear(+v)}>
              <SelectTrigger className="w-24 h-9 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[2024, 2025, 2026].map((y) => (
                  <SelectItem key={y} value={String(y)}>
                    {y}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {frequency === 'H' && (
              <Select value={String(month)} onValueChange={(v) => setMonth(+v)}>
                <SelectTrigger className="w-40 h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 12 }, (_, i) => {
                    const rawName = new Intl.DateTimeFormat(i18n.language === 'hr' ? 'hr-HR' : 'hu-HU', { month: 'long' }).format(new Date(year, i, 1));
                    const monthName = rawName ? rawName.charAt(0).toUpperCase() + rawName.slice(1) : MONTHS[i];
                    return (
                      <SelectItem key={i} value={String(i + 1)}>
                        {String(i + 1).padStart(2, '0')} — {monthName}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            )}

            {frequency === 'N' && (
              <Select value={String(month)} onValueChange={(v) => setMonth(+v)}>
                <SelectTrigger className="w-40 h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">{t('accounting:vat_return.period.q1', 'Q1 (jan–márc)')}</SelectItem>
                  <SelectItem value="2">{t('accounting:vat_return.period.q2', 'Q2 (ápr–jún)')}</SelectItem>
                  <SelectItem value="3">{t('accounting:vat_return.period.q3', 'Q3 (júl–szept)')}</SelectItem>
                  <SelectItem value="4">{t('accounting:vat_return.period.q4', 'Q4 (okt–dec)')}</SelectItem>
                </SelectContent>
              </Select>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            onClick={() => calculate.mutate()}
            disabled={calculate.isPending || isFinalized}
            size="sm"
            className="h-9 gap-2"
          >
            {calculate.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Calculator className="w-4 h-4" />
            )}
            {isFinalized
              ? t('accounting:vat_return.period.finalized', 'Véglegesítve')
              : calculate.isPending
              ? t('accounting:vat_return.period.calculating', 'Számítás...')
              : t('accounting:vat_return.period.calculate', 'Számítás')}
          </Button>

          <div className="border-l pl-2 border-border/60">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" disabled={!vatReturn} size="sm" className="h-9 gap-2">
                  <Download className="w-4 h-4" /> {t('accounting:vat_return.period.export', 'Export')}{' '}
                  <ChevronDown className="w-3 h-3 ml-1" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={() => {
                    if (!vatReturn || !selectedCompany) return;
                    generateVatReturnPdf({
                      companyName: selectedCompany.name || '',
                      companyTaxNumber: (selectedCompany as any).tax_number || '',
                      companyAddress: (selectedCompany as any).address || '',
                      periodYear: year,
                      periodMonth: month,
                      frequency,
                      formRows: formRows as any[],
                      lines: lines as any[],
                      mLines: mLines as any[],
                    });
                    toast({
                      title: t('accounting:vat_return.toasts.pdf_started_title', 'PDF nyomtatás elindítva'),
                      description: t('accounting:vat_return.toasts.pdf_started_desc', 'Az ÁFA bevallás nyomtatási nézete megnyílt.'),
                    });
                  }}
                >
                  <FileSpreadsheet className="w-4 h-4 mr-2" /> {t('accounting:vat_return.period.pdf_print', 'PDF nyomtatás')}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => {
                    if (!vatReturn || !selectedCompany) return;
                    const taxNum = (selectedCompany as any).tax_number || '';
                    if (!taxNum) {
                      toast({
                        title: t('accounting:vat_return.toasts.missing_tax_num_title', 'Hiányzó adószám'),
                        description: t('accounting:vat_return.toasts.missing_tax_num_desc', 'A cég adószáma hiányzik a beállításokból, kérlek ellenőrizd!'),
                        variant: 'destructive',
                      });
                    }
                    generateVatReturnXml({
                      companyName: selectedCompany.name || '',
                      companyTaxNumber: taxNum,
                      companyAddress: (selectedCompany as any).address || '',
                      periodYear: year,
                      periodMonth: month,
                      frequency,
                      lines: lines as any[],
                      mLines: mLines as any[],
                    });
                    toast({
                      title: t('accounting:vat_return.toasts.xml_downloaded_title', 'ÁNYK XML letöltve'),
                      description: t('accounting:vat_return.toasts.xml_downloaded_desc', {
                        formCode: `${year % 100}65`,
                        defaultValue: `A ${year % 100}65 ÁNYK-kompatibilis XML fájl elkészült és letöltésre került.`,
                      }),
                    });
                  }}
                >
                  <Download className="w-4 h-4 mr-2" /> {t('accounting:vat_return.period.xml_download', 'ÁNYK XML letöltés')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      {/* VAT Filing Countdown Timer Banner */}
      {vatReturn && (
        (() => {
          const days = deadlineCountdown.daysLeft;
          const isRed = days < 5;
          const isOrange = days < 10 && days >= 5;

          const colorClass =
            days < 0 || isRed
              ? 'bg-red-500/10 border-red-500/20 text-red-700 dark:text-red-400'
              : isOrange
              ? 'bg-amber-500/10 border-amber-500/20 text-amber-700 dark:text-amber-400'
              : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-700 dark:text-emerald-400';

          const iconColor =
            days < 0 || isRed
              ? 'text-red-500'
              : isOrange
              ? 'text-amber-500'
              : 'text-emerald-500';

          return (
            <div
              className={cn(
                'border p-3.5 rounded-xl flex items-center justify-between text-xs animate-in fade-in duration-200 print:hidden',
                colorClass
              )}
            >
              <span className="flex items-center gap-1.5 font-medium">
                <Clock
                  className={cn(
                    'w-4 h-4 shrink-0',
                    iconColor,
                    (days < 0 || isRed) && 'animate-pulse'
                  )}
                />
                {t('accounting:vat_return.deadlines.label', 'Beadási határidő:')} <strong>{deadlineCountdown.dateFormatted}</strong>
                {days < 0 ? (
                  <span className="ml-1 font-bold text-red-600 dark:text-red-400">
                    {t('accounting:vat_return.deadlines.expired', '(LEJÁRT!)')}
                  </span>
                ) : (
                  <span className="ml-1">
                    {t('accounting:vat_return.deadlines.days_left', {
                      days,
                      defaultValue: `(még ${days} nap van hátra)`,
                    })}
                  </span>
                )}
              </span>
              <span
                className={cn(
                  'font-bold px-2 py-0.5 rounded text-[10px]',
                  days < 0 || isRed
                    ? 'bg-red-500/20 text-red-700 dark:text-red-300'
                    : isOrange
                    ? 'bg-amber-500/20 text-amber-700 dark:text-amber-300'
                    : 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300'
                )}
              >
                {days < 0
                  ? t('accounting:vat_return.deadlines.badge_expired', {
                      days: Math.abs(days),
                      defaultValue: `${Math.abs(days)} napja lejárt`,
                    })
                  : t('accounting:vat_return.deadlines.badge_days_left', {
                      days,
                      defaultValue: `${days} nap hátra`,
                    })}
              </span>
            </div>
          );
        })()
      )}

      {/* Accounting Journal Posting Audit Indicator */}
      {vatReturn && postingAudit && (
        <div
          className={cn(
            'border p-3.5 rounded-xl flex items-center justify-between text-xs animate-in fade-in duration-200 print:hidden',
            postingAudit.isFullyPosted
              ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-800 dark:text-emerald-300'
              : 'bg-amber-500/10 border-amber-500/20 text-amber-800 dark:text-amber-300'
          )}
        >
          <div className="flex items-center gap-2">
            {postingAudit.isFullyPosted ? (
              <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
            )}
            <span>
              {postingAudit.isFullyPosted ? (
                <>
                  <strong>{t('accounting:vat_return.posting_status.closed_audited_title', 'Könyvelési állapot: Zárt & Ellenőrzött.')}</strong>{' '}
                  {t('accounting:vat_return.posting_status.closed_audited_desc', {
                    count: postingAudit.postedCount,
                    defaultValue: `Az időszak összes (${postingAudit.postedCount} db) bizonylata le van könyvelve a naplókban.`,
                  })}
                </>
              ) : postingAudit.totalCount > 0 ? (
                <>
                  <strong>{t('accounting:vat_return.posting_status.in_progress_title', 'Könyvelési állapot: Folyamatban.')}</strong>{' '}
                  {t('accounting:vat_return.posting_status.in_progress_desc', {
                    posted: postingAudit.postedCount,
                    total: postingAudit.totalCount,
                    pending: postingAudit.pendingCount,
                    defaultValue: `Az időszakban ${postingAudit.postedCount} / ${postingAudit.totalCount} bizonylat van lekönyvelve (${postingAudit.pendingCount} db függő rendszerjavaslat van a naplókban).`,
                  })}
                </>
              ) : (
                <>
                  <strong>{t('accounting:vat_return.posting_status.no_entries_title', 'Könyvelési állapot: Nincsenek naplótételek.')}</strong>{' '}
                  {t('accounting:vat_return.posting_status.no_entries_desc', 'Az időszakra még nem találhatók lekönyvelt tételek a naplókban.')}
                </>
              )}
            </span>
          </div>
          <span
            className={cn(
              'font-bold px-2 py-0.5 rounded text-[10px] shrink-0 ml-2',
              postingAudit.isFullyPosted
                ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300'
                : 'bg-amber-500/20 text-amber-700 dark:text-amber-300'
            )}
          >
            {t('accounting:vat_return.posting_status.badge_posted', {
              percent: postingAudit.isFullyPosted
                ? 100
                : postingAudit.totalCount > 0
                ? Math.round((postingAudit.postedCount / postingAudit.totalCount) * 100)
                : 0,
              defaultValue: `${
                postingAudit.isFullyPosted
                  ? 100
                  : postingAudit.totalCount > 0
                  ? Math.round((postingAudit.postedCount / postingAudit.totalCount) * 100)
                  : 0
              }% Lekönyvelve`,
            })}
          </span>
        </div>
      )}

      {/* Sub-Tab View Toggle Selector */}
      {vatReturn && (
        <div className="flex bg-muted/50 border rounded-lg p-0.5 w-max print:hidden">
          <button
            type="button"
            onClick={() => setViewMode('calculator')}
            className={cn(
              'px-4 py-1.5 text-xs font-semibold rounded-md transition-all flex items-center gap-1.5',
              viewMode === 'calculator'
                ? 'bg-background shadow-sm text-foreground font-bold'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <Calculator className="w-3.5 h-3.5" />
            {t('accounting:vat_return.subtabs.calculator', 'Kalkulátor & M-lapok')}
          </button>
          <button
            type="button"
            onClick={() => setViewMode('nav65')}
            className={cn(
              'px-4 py-1.5 text-xs font-semibold rounded-md transition-all flex items-center gap-1.5',
              viewMode === 'nav65'
                ? 'bg-background shadow-sm text-foreground font-bold'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            {t('accounting:vat_return.subtabs.replica', 'NAV 65 Nyomtatvány replika')}
          </button>
        </div>
      )}

      {viewMode === 'nav65' ? (
        <VatNav65Replica
          selectedCompany={selectedCompany}
          year={year}
          month={month}
          frequency={frequency}
          getVal={getVal}
        />
      ) : (
        <VatCalculatorView vatData={vatData} />
      )}
    </div>
  );
}
