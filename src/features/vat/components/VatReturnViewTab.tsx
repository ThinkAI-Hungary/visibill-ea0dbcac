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
  Scale,
  CheckCircle2,
  User,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
import { generateVatReturnXml, formatAnykPhoneNumber } from '@/lib/vatReturnXml';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { MONTHS } from '../types';
import { useVatReturnData } from '../hooks/useVatReturnData';
import { useSteelProductsData } from '../hooks/useSteelProductsData';
import { useToast } from '@/hooks/use-toast';
import { useCompanyJurisdiction } from '@/hooks/useCompanyJurisdiction';
import { VatCalculatorView } from './VatCalculatorView';
import { VatNav65Replica } from './VatNav65Replica';
import { VatObrazacPdvReplica } from './VatObrazacPdvReplica';
import { VatSteelProductsSection } from './VatSteelProductsSection';
import { VatProRataCalculatorModal } from './VatProRataCalculatorModal';
import { VatPoreznaExportDialog } from './VatPoreznaExportDialog';
import { VatXmlExportModal } from './VatXmlExportModal';

export function VatReturnViewTab() {
  const { t, i18n } = useTranslation(['accounting', 'common']);
  const { toast } = useToast();
  const vatData = useVatReturnData();
  const {
    selectedCompany,
    vatScope,
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
    validateReturn,
    finalizeReturn,
    reopenReturn,
    getVal,
  } = vatData;

  const { isCroatia } = useCompanyJurisdiction(selectedCompany);

  const [showSteelWarningModal, setShowSteelWarningModal] = React.useState(false);
  const [proRataCalculatorOpen, setProRataCalculatorOpen] = React.useState(false);
  const [poreznaExportOpen, setPoreznaExportOpen] = React.useState(false);

  const { incompleteSteelItems, hasIncompleteSteelItems } = useSteelProductsData(
    selectedCompany,
    year,
    month,
    frequency
  );

  const [isXmlExportModalOpen, setIsXmlExportModalOpen] = React.useState(false);

  const executeXmlDownload = () => {
    if (!vatReturn || !selectedCompany) return;
    if (isCroatia) {
      setPoreznaExportOpen(true);
      return;
    }
    const taxNum = (selectedCompany as any).tax_number || '';
    if (!taxNum) {
      toast({
        title: t('accounting:vat_return.toasts.missing_tax_num_title', 'Hiányzó adószám'),
        description: t('accounting:vat_return.toasts.missing_tax_num_desc', 'A cég adószáma hiányzik a beállításokból, kérlek ellenőrizd!'),
        variant: 'destructive',
      });
      return;
    }

    const repName = (selectedCompany as any).representative_name?.trim();
    const phone = formatAnykPhoneNumber((selectedCompany as any).phone);

    generateVatReturnXml({
      companyName: selectedCompany.name || '',
      companyTaxNumber: taxNum,
      companyAddress: (selectedCompany as any).address || '',
      periodYear: year,
      periodMonth: month,
      frequency,
      representativeName: repName,
      phone: phone,
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
  };

  const handleXmlDownloadClick = () => {
    if (!vatReturn || !selectedCompany) return;
    if (hasIncompleteSteelItems) {
      setShowSteelWarningModal(true);
      return;
    }

    // Mindig nyissa meg az export modált az ügyintéző kiválasztásához/ellenőrzéséhez
    setIsXmlExportModalOpen(true);
  };

  useKeyboardShortcuts([
    { combo: { key: 'p', ctrl: true }, handler: () => window.print(), description: 'Nyomtatás' },
  ]);

  return (
    <div className="space-y-4 pb-12 print:pb-0 page-animate">
      {/* Unified Command & Control Header */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 bg-card p-3 rounded-xl border border-border shadow-sm animate-in slide-in-from-top-2 duration-300 print:hidden">
        {/* Left: Period Controls */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Frequency toggle */}
          <div className="flex bg-muted/60 border border-border/60 rounded-lg p-0.5">
            <button
              type="button"
              className={cn(
                'px-3 py-1.5 text-xs font-semibold rounded-md transition-all',
                frequency === 'H'
                  ? 'bg-background shadow-sm text-foreground font-bold'
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
              type="button"
              className={cn(
                'px-3 py-1.5 text-xs font-semibold rounded-md transition-all',
                frequency === 'N'
                  ? 'bg-background shadow-sm text-foreground font-bold'
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
              type="button"
              className={cn(
                'px-3 py-1.5 text-xs font-semibold rounded-md transition-all',
                frequency === 'E'
                  ? 'bg-background shadow-sm text-foreground font-bold'
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

          <div className="border-l pl-2.5 border-border/60 flex items-center gap-2">
            <Select value={String(year)} onValueChange={(v) => setYear(+v)}>
              <SelectTrigger className="w-24 h-9 text-xs font-medium">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[2024, 2025, 2026].map((y) => (
                  <SelectItem key={y} value={String(y)} className="text-xs">
                    {y}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {frequency === 'H' && (
              <Select value={String(month)} onValueChange={(v) => setMonth(+v)}>
                <SelectTrigger className="w-40 h-9 text-xs font-medium">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 12 }, (_, i) => {
                    const rawName = new Intl.DateTimeFormat(i18n.language === 'hr' ? 'hr-HR' : 'hu-HU', { month: 'long' }).format(new Date(year, i, 1));
                    const monthName = rawName ? rawName.charAt(0).toUpperCase() + rawName.slice(1) : MONTHS[i];
                    return (
                      <SelectItem key={i} value={String(i + 1)} className="text-xs">
                        {String(i + 1).padStart(2, '0')} — {monthName}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            )}

            {frequency === 'N' && (
              <Select value={String(month)} onValueChange={(v) => setMonth(+v)}>
                <SelectTrigger className="w-40 h-9 text-xs font-medium">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1" className="text-xs">{t('accounting:vat_return.period.q1', 'Q1 (jan–márc)')}</SelectItem>
                  <SelectItem value="2" className="text-xs">{t('accounting:vat_return.period.q2', 'Q2 (ápr–jún)')}</SelectItem>
                  <SelectItem value="3" className="text-xs">{t('accounting:vat_return.period.q3', 'Q3 (júl–szept)')}</SelectItem>
                  <SelectItem value="4" className="text-xs">{t('accounting:vat_return.period.q4', 'Q4 (okt–dec)')}</SelectItem>
                </SelectContent>
              </Select>
            )}
          </div>
        </div>

        {/* Center: View Switcher (Kalkulátor & Elemzés vs. NAV 65 Nyomtatvány replika) */}
        <div className="flex bg-muted/60 border border-border/70 rounded-lg p-0.5 shadow-inner">
          <button
            type="button"
            onClick={() => setViewMode('calculator')}
            className={cn(
              'px-3.5 py-1.5 text-xs font-semibold rounded-md transition-all flex items-center gap-1.5',
              viewMode === 'calculator'
                ? 'bg-background shadow-sm text-foreground font-bold'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <Calculator className="w-3.5 h-3.5 text-primary" />
            <span>{t('accounting:vat_return.subtabs.calculator', 'Kalkulátor & Elemzés')}</span>
          </button>

          <button
            type="button"
            onClick={() => setViewMode('nav65')}
            className={cn(
              'px-3.5 py-1.5 text-xs font-semibold rounded-md transition-all flex items-center gap-1.5',
              viewMode === 'nav65'
                ? 'bg-background shadow-sm text-blue-600 dark:text-blue-400 font-bold'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-blue-500" />
            <span>{isCroatia ? 'Obrazac PDV replika' : 'NAV 65 nyomtatvány replika'}</span>
          </button>
        </div>

        {/* Right: Status & Actions */}
        <div className="flex flex-wrap items-center gap-2 justify-end">
          {vatReturn && (
            <Badge
              className={cn('text-xs font-semibold py-1 px-2.5 border', {
                'bg-amber-500/10 text-amber-600 border-amber-500/20':
                  (vatReturn as any).status === 'draft',
                'bg-blue-500/10 text-blue-600 border-blue-500/20':
                  (vatReturn as any).status === 'validated',
                'bg-emerald-500/10 text-emerald-600 border-emerald-500/20':
                  (vatReturn as any).status === 'finalized',
              })}
            >
              {(vatReturn as any).status === 'draft'
                ? t('accounting:vat_return.status.draft', 'Piszkozat')
                : (vatReturn as any).status === 'validated'
                ? t('accounting:vat_return.status.validated', 'Ellenőrzött')
                : t('accounting:vat_return.status.finalized', 'Véglegesítve')}
            </Badge>
          )}

          {vatReturn && (
            <Badge
              variant="outline"
              className={cn(
                'text-xs font-medium py-1 px-2 border transition-colors',
                vatScope === 'with_image'
                  ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30'
                  : 'bg-blue-500/10 text-blue-600 border-blue-500/30'
              )}
            >
              {vatScope === 'with_image' ? 'Csak számlaképpel' : 'Minden számla'}
            </Badge>
          )}

          {/* ÁFA Arányosítás Modal Trigger */}
          {vatReturn && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setProRataCalculatorOpen(true)}
              className="h-9 gap-1.5 text-xs hidden sm:inline-flex"
            >
              <Scale className="w-3.5 h-3.5" />
              <span>{t('accounting:vat_return.status.pro_rata_button', 'ÁFA Arányosítás')}</span>
            </Button>
          )}

          {/* Workflow Actions */}
          {isFinalized ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => reopenReturn.mutate()}
              disabled={reopenReturn.isPending}
              className="h-9 gap-1.5 text-xs"
            >
              {reopenReturn.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>{t('accounting:vat_return.status.reopen_button', 'Visszanyitás')}</span>
            </Button>
          ) : (vatReturn as any)?.status === 'validated' ? (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button size="sm" disabled={finalizeReturn.isPending} className="h-9 gap-1.5 text-xs">
                  {finalizeReturn.isPending ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <ShieldCheck className="w-3.5 h-3.5" />
                  )}
                  <span>{t('accounting:vat_return.status.finalize_button', 'Véglegesítés')}</span>
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>
                    {t('accounting:vat_return.status.finalize_dialog_title', 'Bevallás véglegesítése')}
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    {t(
                      'accounting:vat_return.status.finalize_dialog_desc',
                      'A véglegesítés után a bevallás sorai nem módosíthatók. Visszanyitás csak a „Visszanyitás" gombbal lehetséges.'
                    )}
                    <br />
                    <br />
                    {t('accounting:vat_return.status.finalize_dialog_confirm', {
                      period: `${year}/${String(month).padStart(2, '0')}`,
                      defaultValue: `Biztosan véglegesíted a ${year}/${String(month).padStart(2, '0')} időszak bevallását?`,
                    })}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>
                    {t('accounting:vat_return.status.cancel', 'Mégse')}
                  </AlertDialogCancel>
                  <AlertDialogAction onClick={() => finalizeReturn.mutate()}>
                    {t('accounting:vat_return.status.finalize_button', 'Véglegesítés')}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          ) : (
            <div className="flex items-center gap-1.5">
              <Button
                onClick={() => calculate.mutate()}
                disabled={calculate.isPending}
                size="sm"
                className="h-9 gap-1.5 text-xs"
              >
                {calculate.isPending ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Calculator className="w-3.5 h-3.5" />
                )}
                <span>
                  {calculate.isPending
                    ? t('accounting:vat_return.period.calculating', 'Számítás...')
                    : t('accounting:vat_return.period.calculate', 'Számítás')}
                </span>
              </Button>
              {vatReturn && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => validateReturn.mutate()}
                  disabled={validateReturn.isPending}
                  className="h-9 gap-1.5 text-xs"
                >
                  {validateReturn.isPending ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  )}
                  <span>{t('accounting:vat_return.status.check_done', 'Ellenőrzés kész')}</span>
                </Button>
              )}
            </div>
          )}

          {/* Export Dropdown */}
          <div className="border-l pl-2 border-border/60">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" disabled={!vatReturn} size="sm" className="h-9 gap-1.5 text-xs">
                  <Download className="w-3.5 h-3.5" />
                  <span>{t('accounting:vat_return.period.export', 'Export')}</span>
                  <ChevronDown className="w-3 h-3 ml-0.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setViewMode('nav65')}>
                  <FileSpreadsheet className="w-4 h-4 mr-2 text-blue-500" />
                  <span>{isCroatia ? 'Obrazac PDV replika megnyitása' : 'NAV 65 nyomtatvány replika megnyitása'}</span>
                </DropdownMenuItem>
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
                {isCroatia ? (
                  <DropdownMenuItem onClick={() => setPoreznaExportOpen(true)}>
                    <Download className="w-4 h-4 mr-2 text-blue-500" />
                    <span>ePorezna XML export (PDV-S / ZP)</span>
                  </DropdownMenuItem>
                ) : (
                  <>
                    <DropdownMenuItem onClick={handleXmlDownloadClick}>
                      <Download className="w-4 h-4 mr-2" />
                      {t('accounting:vat_return.period.xml_download', 'ÁNYK XML letöltés')}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setIsXmlExportModalOpen(true)}>
                      <User className="w-4 h-4 mr-2 text-muted-foreground" />
                      <span>{t('accounting:vat_return.period.edit_representative', 'Ügyintéző adatai (ÁNYK)')}</span>
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      {/* VAT Filing Countdown & Journal Posting Audit Strip (Compact 2-Column Grid) */}
      {vatReturn && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 print:hidden">
          {/* Left: Deadline Countdown */}
          {(() => {
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
                  'border py-2 px-3.5 rounded-xl flex items-center justify-between text-xs animate-in fade-in duration-200',
                  colorClass
                )}
              >
                <span className="flex items-center gap-1.5 font-medium truncate">
                  <Clock
                    className={cn(
                      'w-4 h-4 shrink-0',
                      iconColor,
                      (days < 0 || isRed) && 'animate-pulse'
                    )}
                  />
                  <span>
                    {t('accounting:vat_return.deadlines.label', 'Beadási határidő:')}{' '}
                    <strong>{deadlineCountdown.dateFormatted}</strong>
                  </span>
                  {days < 0 ? (
                    <span className="ml-1 font-bold text-red-600 dark:text-red-400">
                      {t('accounting:vat_return.deadlines.expired', '(LEJÁRT!)')}
                    </span>
                  ) : (
                    <span className="ml-1 text-[11px] opacity-80">
                      {t('accounting:vat_return.deadlines.days_left', {
                        days,
                        defaultValue: `(még ${days} nap)`,
                      })}
                    </span>
                  )}
                </span>
                <span
                  className={cn(
                    'font-bold px-2 py-0.5 rounded text-[10px] shrink-0 ml-2',
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
          })()}

          {/* Right: Journal Posting Audit */}
          {postingAudit && (
            <div
              className={cn(
                'border py-2 px-3.5 rounded-xl flex items-center justify-between text-xs animate-in fade-in duration-200',
                postingAudit.isFullyPosted
                  ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-800 dark:text-emerald-300'
                  : 'bg-amber-500/10 border-amber-500/20 text-amber-800 dark:text-amber-300'
              )}
            >
              <div className="flex items-center gap-2 truncate">
                {postingAudit.isFullyPosted ? (
                  <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                )}
                <span className="truncate">
                  {postingAudit.isFullyPosted ? (
                    <>
                      <strong>{t('accounting:vat_return.posting_status.closed_audited_title', 'Könyvelés: Zárt & Ellenőrzött.')}</strong>{' '}
                      <span className="text-[11px] opacity-80">({postingAudit.postedCount} db bizonylat)</span>
                    </>
                  ) : postingAudit.totalCount > 0 ? (
                    <>
                      <strong>{t('accounting:vat_return.posting_status.in_progress_title', 'Könyvelés: Folyamatban.')}</strong>{' '}
                      <span className="text-[11px] opacity-80">{postingAudit.postedCount}/{postingAudit.totalCount} lekönyvelve ({postingAudit.pendingCount} függő)</span>
                    </>
                  ) : (
                    <strong>{t('accounting:vat_return.posting_status.no_entries_title', 'Könyvelés: Nincsenek naplótételek.')}</strong>
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
        </div>
      )}

      {/* Main View Mode Content */}
      {viewMode === 'nav65' ? (
        isCroatia ? (
          <VatObrazacPdvReplica
            selectedCompany={selectedCompany}
            year={year}
            month={month}
            frequency={frequency}
            getVal={getVal}
          />
        ) : (
          <VatNav65Replica
            selectedCompany={selectedCompany}
            year={year}
            month={month}
            frequency={frequency}
            getVal={getVal}
            onRecalculate={async () => {
              await calculate.mutateAsync();
            }}
            isRecalculating={calculate.isPending}
            mLines={mLines}
          />
        )
      ) : viewMode === 'steel' && !isCroatia ? (
        <VatSteelProductsSection
          selectedCompany={selectedCompany}
          year={year}
          month={month}
          frequency={frequency}
        />
      ) : (
        <VatCalculatorView vatData={vatData} />
      )}

      {/* Pro Rata Calculator Modal */}
      <VatProRataCalculatorModal
        open={proRataCalculatorOpen}
        onOpenChange={setProRataCalculatorOpen}
        year={year}
      />

      {/* Pre-export steel items completeness warning dialog (Blind Spot 1 Guard) */}
      <AlertDialog open={showSteelWarningModal} onOpenChange={setShowSteelWarningModal}>
        <AlertDialogContent className="max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
              <AlertTriangle className="h-5 w-5 shrink-0" />
              {t('accounting:vat_return.steel_warning.title', 'Hiányos 6/B Acélipari adatok!')}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 pt-2 text-sm text-muted-foreground">
                <p>
                  Az adott bevallási időszakban{' '}
                  <strong className="text-foreground">{incompleteSteelItems.length} db</strong>{' '}
                  olyan fordított adózású vas- és acélipari tétel található, amelynél hiányzik a{' '}
                  <strong className="text-foreground">VTSZ szám</strong> vagy a{' '}
                  <strong className="text-foreground">nettó tömeg (kg)</strong>.
                </p>
                <p className="text-xs">
                  A NAV 2665-07 (értékesítő) és 2665-08 (beszerző) nyilatkozati lapok a 6/B. melléklet szerinti
                  termékeknél kötelezően megkövetelik a pontos VTSZ/KN kódot és az egész kg-ban kifejezett nettó tömeget.
                </p>
                <div className="bg-muted/50 rounded-lg p-2.5 border border-border text-xs space-y-1.5 max-h-36 overflow-y-auto">
                  <span className="font-semibold text-foreground block">Érintett bizonylatok (első tételek):</span>
                  {incompleteSteelItems.slice(0, 5).map((it) => (
                    <div key={it.id} className="flex items-center justify-between text-muted-foreground font-mono">
                      <span className="truncate max-w-[200px]" title={it.partnerName}>
                        {it.partnerName} ({it.invoiceNumber})
                      </span>
                      <span className="text-amber-600 dark:text-amber-400 font-sans text-[11px] font-medium shrink-0 ml-2">
                        {!it.productCode ? 'Hiányzó VTSZ' : 'Hiányzó tömeg'}
                      </span>
                    </div>
                  ))}
                  {incompleteSteelItems.length > 5 && (
                    <div className="text-[11px] text-muted-foreground italic text-center pt-1">
                      ...és további {incompleteSteelItems.length - 5} tétel
                    </div>
                  )}
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2 mt-4">
            <AlertDialogCancel onClick={() => setShowSteelWarningModal(false)}>
              Mégse
            </AlertDialogCancel>
            <Button
              variant="outline"
              className="text-xs text-muted-foreground hover:text-foreground"
              onClick={() => {
                setShowSteelWarningModal(false);
                executeXmlDownload();
              }}
            >
              Letöltés hiányosan is
            </Button>
            <AlertDialogAction
              className="bg-primary text-primary-foreground text-xs font-semibold"
              onClick={() => {
                setShowSteelWarningModal(false);
                setViewMode('steel');
              }}
            >
              Tételek kiegészítése (6/B lap)
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Croatian ePorezna XML Export Dialog (PDV-S & ZP) */}
      {isCroatia && (
        <VatPoreznaExportDialog
          open={poreznaExportOpen}
          onOpenChange={setPoreznaExportOpen}
          selectedCompany={selectedCompany}
          year={year}
          month={month}
          frequency={frequency}
        />
      )}

      {/* NAV ÁNYK XML Export & Representative Modal */}
      {!isCroatia && (
        <VatXmlExportModal
          open={isXmlExportModalOpen}
          onOpenChange={setIsXmlExportModalOpen}
          selectedCompany={selectedCompany}
          year={year}
          month={month}
          frequency={frequency}
          lines={lines as any[]}
          mLines={mLines as any[]}
        />
      )}
    </div>
  );
}
