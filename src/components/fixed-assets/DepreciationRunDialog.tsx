import { useState, useMemo, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { useCompany } from '@/contexts/CompanyContext';
import { useQueryClient } from '@tanstack/react-query';
import {
  Calculator,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  FileText,
  Search,
  BookOpen,
} from 'lucide-react';
import {
  previewDepreciationRun,
  postDepreciationRunToLedger,
  DepreciationPeriodType,
  DepreciationPreviewResult,
} from '@/lib/fixed-assets/depreciationPostingService';

interface DepreciationRunDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const MONTH_NAMES = [
  'Január', 'Február', 'Március', 'Április', 'Május', 'Június',
  'Július', 'Augusztus', 'Szeptember', 'Október', 'November', 'December',
];

export function DepreciationRunDialog({ open, onOpenChange }: DepreciationRunDialogProps) {
  const { t } = useTranslation(['hr', 'common']);
  const { toast } = useToast();
  const { user } = useAuth();
  const { selectedCompany } = useCompany();
  const queryClient = useQueryClient();

  const monthNames = (t('hr:calendar.months', { returnObjects: true }) as string[]) || MONTH_NAMES;

  const now = new Date();
  const currentYear = now.getFullYear();
  // Default to previous month or current month (e.g. 8 for August if currently September)
  const defaultMonth = now.getMonth() === 0 ? 12 : now.getMonth();
  const defaultYear = now.getMonth() === 0 ? currentYear - 1 : currentYear;

  const [periodType, setPeriodType] = useState<DepreciationPeriodType>('monthly');
  const [selectedYear, setSelectedYear] = useState<number>(defaultYear);
  const [selectedMonth, setSelectedMonth] = useState<number>(defaultMonth);
  const [selectedQuarter, setSelectedQuarter] = useState<number>(Math.ceil(defaultMonth / 3));

  const [customDateFrom, setCustomDateFrom] = useState<string>(
    `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-01`
  );
  const [customDateTo, setCustomDateTo] = useState<string>(
    new Date(selectedYear, selectedMonth, 0).toISOString().split('T')[0]
  );

  const [customDocId, setCustomDocId] = useState<string>('');
  const [customPostingDate, setCustomPostingDate] = useState<string>('');

  const [searchFilter, setSearchFilter] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [preview, setPreview] = useState<DepreciationPreviewResult | null>(null);

  // Dátumhatárok kiszámítása a választott periódus alapján
  const { dateFrom, dateTo, defaultDocId } = useMemo(() => {
    let from = '';
    let to = '';
    let docId = '';

    if (periodType === 'monthly') {
      const mStr = String(selectedMonth).padStart(2, '0');
      from = `${selectedYear}-${mStr}-01`;
      const lastDay = new Date(selectedYear, selectedMonth, 0).getDate();
      to = `${selectedYear}-${mStr}-${String(lastDay).padStart(2, '0')}`;
      docId = `ECS-${selectedYear}-${mStr}`;
    } else if (periodType === 'quarterly') {
      const startM = (selectedQuarter - 1) * 3 + 1;
      const endM = selectedQuarter * 3;
      from = `${selectedYear}-${String(startM).padStart(2, '0')}-01`;
      const lastDay = new Date(selectedYear, endM, 0).getDate();
      to = `${selectedYear}-${String(endM).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
      docId = `ECS-${selectedYear}-Q${selectedQuarter}`;
    } else if (periodType === 'annual') {
      from = `${selectedYear}-01-01`;
      to = `${selectedYear}-12-31`;
      docId = `ECS-${selectedYear}-EVES`;
    } else {
      from = customDateFrom;
      to = customDateTo;
      docId = `ECS-${from.replace(/-/g, '')}_${to.replace(/-/g, '')}`;
    }

    return { dateFrom: from, dateTo: to, defaultDocId: docId };
  }, [periodType, selectedYear, selectedMonth, selectedQuarter, customDateFrom, customDateTo]);

  // Tényleges bizonylatszám és könyvelési dátum
  const activeDocId = customDocId || defaultDocId;
  const activePostingDate = customPostingDate || dateTo;

  // Előnézet újratöltése amikor a dátumok vagy a cég megváltoznak
  useEffect(() => {
    if (!open || !selectedCompany?.id || !dateFrom || !dateTo) return;

    let isMounted = true;
    setLoading(true);

    previewDepreciationRun({
      companyId: selectedCompany.id,
      periodType,
      dateFrom,
      dateTo,
      postingDate: activePostingDate,
      documentId: activeDocId,
    })
      .then(res => {
        if (isMounted) {
          setPreview(res);
          setLoading(false);
        }
      })
      .catch(err => {
        console.error('previewDepreciationRun error:', err);
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [open, selectedCompany?.id, periodType, dateFrom, dateTo, activeDocId, activePostingDate]);

  // Szűrt tételek keresés alapján
  const filteredItems = useMemo(() => {
    if (!preview?.items) return [];
    if (!searchFilter.trim()) return preview.items;
    const s = searchFilter.toLowerCase();
    return preview.items.filter(
      item =>
        item.assetName.toLowerCase().includes(s) ||
        item.inventoryNumber.toLowerCase().includes(s) ||
        item.creditGlNumber.toLowerCase().includes(s)
    );
  }, [preview?.items, searchFilter]);

  // Könyvelés indítása
  const handlePostDepreciation = async () => {
    if (!selectedCompany?.id || !preview || preview.totalAmount <= 0) return;
    setSubmitting(true);

    try {
      const result = await postDepreciationRunToLedger({
        companyId: selectedCompany.id,
        userId: user?.id,
        periodType,
        dateFrom,
        dateTo,
        postingDate: activePostingDate,
        documentId: activeDocId,
      });

      if (!result.success) {
        toast({
          title: t('hr:fixed_assets.depreciation_run_dialog.toast_warning_title', 'Könyvelési figyelmeztetés'),
          description: result.message || t('hr:fixed_assets.depreciation_run_dialog.toast_warning_fallback', 'Nem sikerült az ÉCS lekönyvelése.'),
          variant: 'destructive',
        });
        setSubmitting(false);
        return;
      }

      toast({
        title: t('hr:fixed_assets.depreciation_run_dialog.toast_success_title', 'Értékcsökkenés sikeresen lekönyvelve! 🎉'),
        description: result.message,
      });

      // Frissítjük a lekérdezéseket
      queryClient.invalidateQueries({ queryKey: ['fixedAssets'] });
      queryClient.invalidateQueries({ queryKey: ['fixedAssetDetail'] });
      queryClient.invalidateQueries({ queryKey: ['journals'] });
      queryClient.invalidateQueries({ queryKey: ['journalHeaders'] });
      queryClient.invalidateQueries({ queryKey: ['glAccounts'] });
      queryClient.invalidateQueries({ queryKey: ['generalLedger'] });

      onOpenChange(false);
    } catch (err: any) {
      console.error('handlePostDepreciation error:', err);
      toast({
        title: t('hr:fixed_assets.depreciation_run_dialog.toast_error_title', 'Hiba a feladás során'),
        description: err?.message || t('hr:fixed_assets.depreciation_run_dialog.toast_error_fallback', 'Váratlan hiba történt az ÉCS könyvelésekor.'),
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const isDuplicate = !!preview?.existingPosting?.exists;
  const canSubmit =
    !loading &&
    !submitting &&
    !isDuplicate &&
    (preview?.totalAmount || 0) > 0 &&
    (preview?.eligibleCount || 0) > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-6 overflow-hidden">
        {/* Header */}
        <DialogHeader className="flex-shrink-0 border-b pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Calculator className="h-5 w-5 text-primary" />
            </div>
            <div>
              <DialogTitle className="text-xl font-bold">
                {t('hr:fixed_assets.depreciation_run_dialog.title', 'Terv szerinti ÉCS elszámolás és feladás (Vegyes napló)')}
              </DialogTitle>
              <DialogDescription>
                {t('hr:fixed_assets.depreciation_run_dialog.description', 'Időszaki értékcsökkenési leírás kalkulációja az analitika alapján és kettős könyvviteli feladása.')}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Scrollable Container */}
        <div className="flex-1 overflow-y-auto py-4 space-y-4">
          {/* Controls Bar */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 p-4 rounded-lg bg-muted/40 border border-border/60">
            {/* Period Type */}
            <div>
              <Label className="text-xs font-medium text-muted-foreground">
                {t('hr:fixed_assets.depreciation_run_dialog.frequency_label', 'Időszak gyakorisága')}
              </Label>
              <Select
                value={periodType}
                onValueChange={(val: DepreciationPeriodType) => setPeriodType(val)}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly">{t('hr:fixed_assets.depreciation_run_dialog.monthly_opt', 'Havi (Ajánlott)')}</SelectItem>
                  <SelectItem value="quarterly">{t('hr:fixed_assets.depreciation_run_dialog.quarterly_opt', 'Negyedéves')}</SelectItem>
                  <SelectItem value="annual">{t('hr:fixed_assets.depreciation_run_dialog.annual_opt', 'Éves (Zárás)')}</SelectItem>
                  <SelectItem value="custom">{t('hr:fixed_assets.depreciation_run_dialog.custom_opt', 'Egyedi dátumtartomány')}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Monthly / Quarterly / Annual selectors */}
            {periodType === 'monthly' && (
              <>
                <div>
                  <Label className="text-xs font-medium text-muted-foreground">
                    {t('hr:fixed_assets.depreciation_run_dialog.year_label', 'Év')}
                  </Label>
                  <Select
                    value={String(selectedYear)}
                    onValueChange={val => setSelectedYear(parseInt(val, 10))}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[2024, 2025, 2026, 2027].map(y => (
                        <SelectItem key={y} value={String(y)}>
                          {y}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs font-medium text-muted-foreground">
                    {t('hr:fixed_assets.depreciation_run_dialog.month_label', 'Hónap')}
                  </Label>
                  <Select
                    value={String(selectedMonth)}
                    onValueChange={val => setSelectedMonth(parseInt(val, 10))}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {monthNames.map((name, idx) => (
                        <SelectItem key={idx + 1} value={String(idx + 1)}>
                          {String(idx + 1).padStart(2, '0')} — {name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}

            {periodType === 'quarterly' && (
              <>
                <div>
                  <Label className="text-xs font-medium text-muted-foreground">
                    {t('hr:fixed_assets.depreciation_run_dialog.year_label', 'Év')}
                  </Label>
                  <Select
                    value={String(selectedYear)}
                    onValueChange={val => setSelectedYear(parseInt(val, 10))}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[2024, 2025, 2026, 2027].map(y => (
                        <SelectItem key={y} value={String(y)}>
                          {y}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs font-medium text-muted-foreground">
                    {t('hr:fixed_assets.depreciation_run_dialog.quarter_label', 'Negyedév')}
                  </Label>
                  <Select
                    value={String(selectedQuarter)}
                    onValueChange={val => setSelectedQuarter(parseInt(val, 10))}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">{t('hr:fixed_assets.depreciation_run_dialog.q1', 'I. negyedév (Jan - Mác)')}</SelectItem>
                      <SelectItem value="2">{t('hr:fixed_assets.depreciation_run_dialog.q2', 'II. negyedév (Ápr - Jún)')}</SelectItem>
                      <SelectItem value="3">{t('hr:fixed_assets.depreciation_run_dialog.q3', 'III. negyedév (Júl - Szep)')}</SelectItem>
                      <SelectItem value="4">{t('hr:fixed_assets.depreciation_run_dialog.q4', 'IV. negyedév (Okt - Dec)')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}

            {periodType === 'annual' && (
              <div>
                <Label className="text-xs font-medium text-muted-foreground">
                  {t('hr:fixed_assets.depreciation_run_dialog.business_year_label', 'Üzleti Év')}
                </Label>
                <Select
                  value={String(selectedYear)}
                  onValueChange={val => setSelectedYear(parseInt(val, 10))}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[2024, 2025, 2026, 2027].map(y => (
                      <SelectItem key={y} value={String(y)}>
                        {y}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {periodType === 'custom' && (
              <>
                <div>
                  <Label className="text-xs font-medium text-muted-foreground">
                    {t('hr:fixed_assets.depreciation_run_dialog.date_from_label', 'Kezdő dátum')}
                  </Label>
                  <Input
                    type="date"
                    className="mt-1"
                    value={customDateFrom}
                    onChange={e => setCustomDateFrom(e.target.value)}
                  />
                </div>
                <div>
                  <Label className="text-xs font-medium text-muted-foreground">
                    {t('hr:fixed_assets.depreciation_run_dialog.date_to_label', 'Záró dátum')}
                  </Label>
                  <Input
                    type="date"
                    className="mt-1"
                    value={customDateTo}
                    onChange={e => setCustomDateTo(e.target.value)}
                  />
                </div>
              </>
            )}

            {/* Document ID */}
            <div>
              <Label className="text-xs font-medium text-muted-foreground">
                {t('hr:fixed_assets.depreciation_run_dialog.document_number_label', 'Bizonylatszám')}
              </Label>
              <Input
                className="mt-1 font-mono text-xs"
                placeholder={defaultDocId}
                value={customDocId}
                onChange={e => setCustomDocId(e.target.value)}
              />
            </div>
          </div>

          {/* Warning Banner if Duplicate */}
          {isDuplicate && (
            <div className="flex items-start gap-3 p-3.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-900 dark:text-amber-200">
              <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
              <div className="text-sm">
                <span className="font-semibold">{t('hr:fixed_assets.depreciation_run_dialog.duplicate_warning_title', 'Már lekönyvelt időszak!')}</span>
                <p className="mt-0.5 text-xs opacity-90">
                  {t('hr:fixed_assets.depreciation_run_dialog.duplicate_warning_desc', {
                    defaultValue: `Ezzel a bizonylatszámmal (${preview?.documentId}) már található könyvelési tétel a Vegyes naplóban${preview?.existingPosting?.journalNumber ? ` (${preview.existingPosting.journalNumber}. sorszám alatt)` : ''}. A duplikált elszámolás megakadályozása érdekében az újrakönyvelés zárolva van.`,
                    docId: preview?.documentId,
                    journalNo: preview?.existingPosting?.journalNumber ? ` (${preview.existingPosting.journalNumber}. sorszám alatt)` : ''
                  })}
                </p>
              </div>
            </div>
          )}

          {/* KPI Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="p-4 rounded-lg bg-card border shadow-xs">
              <div className="text-xs font-medium text-muted-foreground">
                {t('hr:fixed_assets.depreciation_run_dialog.kpi_total_depr', 'Összes elszámolandó ÉCS')}
              </div>
              <div className="text-2xl font-bold text-primary mt-1">
                {(preview?.totalAmount || 0).toLocaleString('hu-HU')} Ft
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">
                T 5711 — K 139xx / 149xx
              </div>
            </div>

            <div className="p-4 rounded-lg bg-card border shadow-xs">
              <div className="text-xs font-medium text-muted-foreground">
                {t('hr:fixed_assets.depreciation_run_dialog.kpi_active_assets', 'Érintett aktív eszközök')}
              </div>
              <div className="text-2xl font-bold mt-1">
                {preview?.eligibleCount || 0} / {preview?.items?.length || 0} db
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">
                {dateFrom} – {dateTo}
              </div>
            </div>

            <div className="p-4 rounded-lg bg-card border shadow-xs">
              <div className="text-xs font-medium text-muted-foreground">
                {t('hr:fixed_assets.depreciation_run_dialog.kpi_target_journal', 'Könyvelési cél-napló')}
              </div>
              <div className="text-lg font-semibold mt-1 flex items-center gap-1.5">
                <BookOpen className="h-4 w-4 text-primary" />
                {t('hr:fixed_assets.depreciation_run_dialog.kpi_general_journal', 'Vegyes napló (VE)')}
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">
                {t('hr:fixed_assets.depreciation_run_dialog.kpi_posting_date', {
                  defaultValue: `Dátum: ${activePostingDate}`,
                  date: activePostingDate
                })}
              </div>
            </div>
          </div>

          {/* Search & Filter */}
          <div className="flex items-center justify-between gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder={t('hr:fixed_assets.depreciation_run_dialog.search_placeholder', 'Szűrés eszközre vagy leltári számra...')}
                className="pl-9 text-xs"
                value={searchFilter}
                onChange={e => setSearchFilter(e.target.value)}
              />
            </div>
            <div className="text-xs text-muted-foreground">
              {t('hr:fixed_assets.depreciation_run_dialog.assets_displayed', {
                defaultValue: `${filteredItems.length} eszköz megjelenítve`,
                count: filteredItems.length
              })}
            </div>
          </div>

          {/* Assets Table Preview */}
          <div className="rounded-lg border overflow-hidden">
            {loading ? (
              <div className="flex items-center justify-center p-12">
                <LoadingSpinner size="md" fullPage={false} />
                <span className="ml-3 text-sm text-muted-foreground">
                  {t('hr:fixed_assets.depreciation_run_dialog.loading_calc', 'ÉCS kalkuláció betöltése...')}
                </span>
              </div>
            ) : filteredItems.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground text-sm">
                {t('hr:fixed_assets.depreciation_run_dialog.no_assets_period', 'Nincs megjeleníthető eszköz ebben az időszakban.')}
              </div>
            ) : (
              <Table>
                <TableHeader className="bg-muted/50">
                  <TableRow>
                    <TableHead className="w-[140px]">{t('hr:fixed_assets.depreciation_run_dialog.col_inv_number', 'Leltári szám')}</TableHead>
                    <TableHead>{t('hr:fixed_assets.depreciation_run_dialog.col_name', 'Eszköz megnevezése')}</TableHead>
                    <TableHead className="text-right">{t('hr:fixed_assets.depreciation_run_dialog.col_acq_value', 'Bekerülési érték')}</TableHead>
                    <TableHead className="text-center">{t('hr:fixed_assets.depreciation_run_dialog.col_period', 'Időszak')}</TableHead>
                    <TableHead className="text-right font-semibold">{t('hr:fixed_assets.depreciation_run_dialog.col_period_depr', 'Időszaki ÉCS')}</TableHead>
                    <TableHead className="text-right">{t('hr:fixed_assets.depreciation_run_dialog.col_residual', 'Maradványérték')}</TableHead>
                    <TableHead className="text-center">{t('hr:fixed_assets.depreciation_run_dialog.col_gl', 'Főkönyv (T / K)')}</TableHead>
                    <TableHead className="text-center">{t('hr:fixed_assets.depreciation_run_dialog.col_status', 'Státusz')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredItems.map(item => (
                    <TableRow key={item.assetId} className={item.periodAmount > 0 ? '' : 'opacity-60'}>
                      <TableCell className="font-mono text-xs font-medium">
                        {item.inventoryNumber}
                      </TableCell>
                      <TableCell className="font-medium">
                        <div>{item.assetName}</div>
                        {item.reason && (
                          <div className="text-[11px] text-muted-foreground">{item.reason}</div>
                        )}
                      </TableCell>
                      <TableCell className="text-right text-xs">
                        {item.acquisitionValue.toLocaleString('hu-HU')} Ft
                      </TableCell>
                      <TableCell className="text-center text-xs">
                        <Badge variant="outline" className="font-normal text-[11px]">
                          {item.activeMonths} hó
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono font-semibold text-primary">
                        {item.periodAmount > 0 ? `${item.periodAmount.toLocaleString('hu-HU')} Ft` : '0 Ft'}
                      </TableCell>
                      <TableCell className="text-right text-xs text-muted-foreground">
                        {item.remainingBookValue.toLocaleString('hu-HU')} Ft
                      </TableCell>
                      <TableCell className="text-center font-mono text-[11px]">
                        <span className="text-emerald-600 font-semibold">{item.debitGlNumber}</span> /{' '}
                        <span className="text-blue-600 font-semibold">{item.creditGlNumber}</span>
                      </TableCell>
                      <TableCell className="text-center">
                        {item.status === 'ready' && item.periodAmount > 0 ? (
                          <Badge variant="outline" className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20 text-[10px]">
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            {t('hr:fixed_assets.depreciation_run_dialog.status_ready', 'Könyvelhető')}
                          </Badge>
                        ) : item.status === 'fully_depreciated' ? (
                          <Badge variant="outline" className="bg-muted text-muted-foreground text-[10px]">
                            {t('hr:fixed_assets.depreciation_run_dialog.status_fully_depreciated', 'Teljesen leírt')}
                          </Badge>
                        ) : item.status === 'missing_gl' ? (
                          <Badge variant="destructive" className="text-[10px]">
                            {t('hr:fixed_assets.depreciation_run_dialog.status_missing_gl', 'Hiányzó számla')}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px] text-muted-foreground">
                            0 Ft
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </div>

        {/* Footer */}
        <DialogFooter className="flex-shrink-0 border-t pt-4 flex items-center justify-between">
          <div className="text-xs text-muted-foreground flex items-center gap-1.5">
            <FileText className="h-4 w-4" />
            <span>{t('hr:fixed_assets.depreciation_run_dialog.footer_journal_entry', 'Kettős könyvviteli Vegyes napló tétel')}</span>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              {t('common:actions.cancel', 'Mégse')}
            </Button>
            <Button
              onClick={handlePostDepreciation}
              disabled={!canSubmit}
              className="gap-2"
            >
              {submitting ? (
                <>
                  <LoadingSpinner size="sm" fullPage={false} />
                  {t('hr:fixed_assets.depreciation_run_dialog.posting_in_progress', 'Könyvelés folyamatban...')}
                </>
              ) : (
                <>
                  <Calculator className="h-4 w-4" />
                  {t('hr:fixed_assets.depreciation_run_dialog.btn_post', {
                    defaultValue: `Könyvelés a Vegyes naplóba (${preview?.totalAmount?.toLocaleString('hu-HU') || 0} Ft)`,
                    amount: preview?.totalAmount?.toLocaleString('hu-HU') || 0
                  })}
                </>
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
