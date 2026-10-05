import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useCompany } from '@/contexts/CompanyContext';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { 
  FileText, 
  Plus, 
  ShieldCheck, 
  RotateCcw, 
  Eye, 
  Printer, 
  Loader2, 
  CalendarClock, 
  Search, 
  CheckCircle2, 
  AlertTriangle, 
  Lock,
  BookOpen,
  Send,
  Undo2
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import type { PettyCashRegister, CashReport } from './types';
import { fmtBalance } from './types';
import { useCashReports, 
  useReopenCashReport,
  useValidateCashReportForPosting,
  usePostCashReportToGl,
  useUnpostCashReportFromGl
} from '@/hooks/useCashReports';
import { CashClosingWizardDialog } from './closing-wizard/CashClosingWizardDialog';
import { CashReportDetailDialog } from './CashReportDetailDialog';
import { useTranslation } from 'react-i18next';

interface CashReportsTabProps {
  registers: PettyCashRegister[];
  companyId: string;
}

export default function CashReportsTab({ registers, companyId }: CashReportsTabProps) {
  const { t } = useTranslation(['pettyCash', 'common']);
  const { user } = useAuth();
  const [selectedRegisterId, setSelectedRegisterId] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [search, setSearch] = useState<string>('');

  // Modals state
  const [closingWizardOpen, setClosingWizardOpen] = useState<boolean>(false);
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState<boolean>(false);

  // Reopen report modal state
  const [reopenModalOpen, setReopenModalOpen] = useState<boolean>(false);
  const [reopenTargetReport, setReopenTargetReport] = useState<CashReport | null>(null);
  const [reopenReason, setReopenReason] = useState<string>('');

  // Fetch reports
  const { data: reports = [], isLoading, refetch } = useCashReports(
    companyId,
    selectedRegisterId === 'all' ? undefined : selectedRegisterId
  );

  const reopenMutation = useReopenCashReport();
  const validateGlMutation = useValidateCashReportForPosting();
  const postGlMutation = usePostCashReportToGl();
  const unpostGlMutation = useUnpostCashReportFromGl();

  // GL Posting modal states
  const [glPostModalOpen, setGlPostModalOpen] = useState<boolean>(false);
  const [glTargetReport, setGlTargetReport] = useState<CashReport | null>(null);
  const [glValidation, setGlValidation] = useState<{
    valid: boolean;
    errors: string[];
    report_number?: string;
    items_count: number;
    missing_contra_count: number;
    closing_balance: number;
  } | null>(null);
  const [isValidatingGl, setIsValidatingGl] = useState<boolean>(false);

  // GL Unposting modal states
  const [unpostModalOpen, setUnpostModalOpen] = useState<boolean>(false);
  const [unpostTargetReport, setUnpostTargetReport] = useState<CashReport | null>(null);

  // Filtered reports
  const filteredReports = useMemo(() => {
    return reports.filter(r => {
      if (statusFilter !== 'ALL' && r.status !== statusFilter) return false;
      if (search) {
        const s = search.toLowerCase();
        const matchesNum = r.report_number?.toLowerCase().includes(s);
        const matchesDate = r.period_start.includes(s) || r.period_end.includes(s);
        if (!matchesNum && !matchesDate) return false;
      }
      return true;
    });
  }, [reports, statusFilter, search]);

  const handleOpenDetail = (reportId: string) => {
    setSelectedReportId(reportId);
    setDetailOpen(true);
  };

  const handleOpenReopenModal = (report: CashReport) => {
    setReopenTargetReport(report);
    setReopenReason('');
    setReopenModalOpen(true);
  };

  const handleConfirmReopen = async () => {
    if (!reopenTargetReport) return;
    try {
      await reopenMutation.mutateAsync({
        companyId,
        cashReportId: reopenTargetReport.id,
        reason: reopenReason,
      });
      toast({
        title: t('pettyCash:reports.toasts.reopened_title', 'Pénztárjelentés újranyitva'),
        description: t('pettyCash:reports.toasts.reopened_desc', { defaultValue: '{{report}} sikeresen újranyitva helyesbítés céljából.', report: reopenTargetReport.report_number || t('pettyCash:reports.table.col_register', 'Jelentés') }),
      });
      setReopenModalOpen(false);
      refetch();
    } catch (err: any) {
      toast({
        title: t('pettyCash:reports.toasts.reopen_error', 'Hiba az újranyitás során'),
        description: err.message,
        variant: 'destructive',
      });
    }
  };

  // Open GL post dialog and run validation RPC
  const handleOpenGlPost = async (report: CashReport) => {
    setGlTargetReport(report);
    setGlPostModalOpen(true);
    setIsValidatingGl(true);
    setGlValidation(null);
    try {
      const res = await validateGlMutation.mutateAsync({
        companyId,
        cashReportId: report.id,
      });
      setGlValidation(res);
    } catch (err: any) {
      toast({
        title: t('pettyCash:reports.toasts.validate_error', 'Hiba az ellenőrzés során'),
        description: err.message,
        variant: 'destructive',
      });
    } finally {
      setIsValidatingGl(false);
    }
  };

  // Confirm GL posting
  const handleConfirmGlPost = async () => {
    if (!glTargetReport) return;
    try {
      await postGlMutation.mutateAsync({
        companyId,
        cashReportId: glTargetReport.id,
      });
      toast({
        title: t('pettyCash:reports.toasts.posted_title', 'Pénztárjelentés feladva a főkönyvbe'),
        description: t('pettyCash:reports.toasts.posted_desc', { defaultValue: '{{report}} sikeresen lekönyvelve a 381-es számlára.', report: glTargetReport.report_number || t('pettyCash:reports.table.col_register', 'Jelentés') }),
      });
      setGlPostModalOpen(false);
      refetch();
    } catch (err: any) {
      toast({
        title: t('pettyCash:reports.toasts.post_error', 'Hiba a főkönyvi feladás során'),
        description: err.message,
        variant: 'destructive',
      });
    }
  };

  // Open GL unpost dialog
  const handleOpenUnpost = (report: CashReport) => {
    setUnpostTargetReport(report);
    setUnpostModalOpen(true);
  };

  // Confirm GL unposting
  const handleConfirmUnpost = async () => {
    if (!unpostTargetReport) return;
    try {
      await unpostGlMutation.mutateAsync({
        companyId,
        cashReportId: unpostTargetReport.id,
      });
      toast({
        title: t('pettyCash:reports.toasts.unposted_title', 'Főkönyvi feladás visszavonva'),
        description: t('pettyCash:reports.toasts.unposted_desc', { defaultValue: '{{report}} könyvelése sikeresen visszavonva.', report: unpostTargetReport.report_number || t('pettyCash:reports.table.col_register', 'Jelentés') }),
      });
      setUnpostModalOpen(false);
      refetch();
    } catch (err: any) {
      toast({
        title: t('pettyCash:reports.toasts.unpost_error', 'Hiba a visszavonás során'),
        description: err.message,
        variant: 'destructive',
      });
    }
  };

  // Find register name by ID
  const getRegisterName = (regId: string) => {
    return registers.find(r => r.id === regId)?.name || t('pettyCash:registers.default_name', 'Központi pénztár');
  };

  return (
    <div className="space-y-4">
      {/* Fejléc és Szűrők */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-card p-3 rounded-xl border border-border/80">
        <div className="flex flex-wrap items-center gap-2 flex-1">
          {/* Pénztár választó */}
          <Select value={selectedRegisterId} onValueChange={setSelectedRegisterId}>
            <SelectTrigger className="w-48 h-9 text-xs">
              <SelectValue placeholder={t('pettyCash:reports.filters.all_registers', 'Minden pénztár')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('pettyCash:reports.filters.all_registers', 'Minden pénztár')}</SelectItem>
              {registers.map(r => (
                <SelectItem key={r.id} value={r.id}>
                  {r.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Státusz szűrő */}
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-36 h-9 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">{t('pettyCash:reports.filters.all_status', 'Minden státusz')}</SelectItem>
              <SelectItem value="open">{t('pettyCash:reports.filters.status_open', 'Nyitott')}</SelectItem>
              <SelectItem value="closed">{t('pettyCash:reports.filters.status_closed', 'Lezárt')}</SelectItem>
              <SelectItem value="posted">{t('pettyCash:reports.filters.status_posted', 'Feladva (381)')}</SelectItem>
              <SelectItem value="reopened">{t('pettyCash:reports.filters.status_reopened', 'Újranyitott')}</SelectItem>
            </SelectContent>
          </Select>

          {/* Keresőmező */}
          <div className="relative flex-1 min-w-[180px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder={t('pettyCash:reports.filters.search_placeholder', 'Keresés bizonylatszám, dátum...')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-9 text-xs"
            />
          </div>
        </div>

        {/* Új zárás indítása gomb */}
        <Button 
          onClick={() => setClosingWizardOpen(true)}
          className="h-9 text-xs gap-1.5 bg-primary font-medium"
        >
          <CalendarClock className="w-4 h-4" />
          {t('pettyCash:reports.actions.new_closing', 'Új időszaki zárás indítása')}
        </Button>
      </div>

      {/* Jelentések Táblázata */}
      <div className="border border-border/80 rounded-xl overflow-hidden bg-card">
        {isLoading ? (
          <div className="flex items-center justify-center h-48 gap-2 text-muted-foreground text-xs">
            <Loader2 className="w-5 h-5 animate-spin text-primary" />
            <span>{t('pettyCash:reports.empty.loading', 'Pénztárjelentések betöltése...')}</span>
          </div>
        ) : filteredReports.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-muted-foreground text-xs gap-2">
            <FileText className="w-8 h-8 opacity-40" />
            <span>{t('pettyCash:reports.empty.no_reports', 'Nem található időszaki pénztárjelentés a megadott szűrésre.')}</span>
            <Button variant="outline" size="sm" onClick={() => setClosingWizardOpen(true)} className="text-xs mt-1">
              {t('pettyCash:reports.empty.first_closing_btn', 'Első zárás indítása most')}
            </Button>
          </div>
        ) : (
          <Table className="text-xs">
            <TableHeader className="bg-muted/40 border-b">
              <TableRow>
                <TableHead className="w-36">{t('pettyCash:reports.table.col_number', 'Sorszám')}</TableHead>
                <TableHead>{t('pettyCash:reports.table.col_register', 'Pénztár')}</TableHead>
                <TableHead className="w-44 text-center">{t('pettyCash:reports.table.col_period', 'Időszak')}</TableHead>
                <TableHead className="w-28 text-right">{t('pettyCash:reports.table.col_opening', 'Nyitó')}</TableHead>
                <TableHead className="w-28 text-right">{t('pettyCash:reports.table.col_income', 'Bevétel (+)')}</TableHead>
                <TableHead className="w-28 text-right">{t('pettyCash:reports.table.col_expense', 'Kiadás (-)')}</TableHead>
                <TableHead className="w-32 text-right">{t('pettyCash:reports.table.col_closing', 'Záró készlet')}</TableHead>
                <TableHead className="w-28 text-center">{t('pettyCash:reports.table.col_status', 'Státusz')}</TableHead>
                <TableHead className="w-28 text-right">{t('pettyCash:reports.table.col_actions', 'Műveletek')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredReports.map((report) => {
                const regName = getRegisterName(report.cash_register_id);
                const isOpen = report.status === 'open' || report.status === 'closing';
                const isClosed = report.status === 'closed';
                const isPosted = report.status === 'posted';
                const isReopened = report.status === 'reopened';
                const cur = report.currency || 'HUF';

                return (
                  <TableRow key={report.id} className="hover:bg-muted/30">
                    {/* Sorszám */}
                    <TableCell className="font-mono font-semibold text-foreground">
                      {report.report_number || `${t('pettyCash:reports.table.draft_prefix', 'Piszkozat #')}${report.version}`}
                    </TableCell>

                    {/* Pénztár */}
                    <TableCell className="font-medium text-foreground">
                      {regName}
                    </TableCell>

                    {/* Időszak */}
                    <TableCell className="text-center font-mono text-muted-foreground">
                      {report.period_start} – {report.period_end}
                    </TableCell>

                    {/* Nyitó */}
                    <TableCell className="text-right font-mono tabular-nums">
                      {fmtBalance(report.opening_balance, cur)}
                    </TableCell>

                    {/* Bevétel */}
                    <TableCell className="text-right font-mono tabular-nums text-emerald-600 dark:text-emerald-400 font-medium">
                      +{fmtBalance(report.total_in, cur)}
                    </TableCell>

                    {/* Kiadás */}
                    <TableCell className="text-right font-mono tabular-nums text-destructive font-medium">
                      -{fmtBalance(report.total_out, cur)}
                    </TableCell>

                    {/* Záró készpénzállomány */}
                    <TableCell className="text-right font-mono tabular-nums font-bold text-foreground">
                      {fmtBalance(report.closing_balance_actual ?? report.closing_balance_book, cur)}
                      {report.difference && report.difference !== 0 && (
                        <div className="text-[10px] font-normal text-destructive">
                          {t('pettyCash:reports.table.diff_prefix', 'Eltérés:')} {fmtBalance(report.difference, cur)}
                        </div>
                      )}
                    </TableCell>

                    {/* Státusz */}
                    <TableCell className="text-center">
                      {isOpen && (
                        <Badge variant="outline" className="border-blue-500/40 text-blue-600 bg-blue-500/10 text-[10px]">
                          {t('pettyCash:reports.badges.open', 'Nyitott')}
                        </Badge>
                      )}
                      {isClosed && (
                        <Badge variant="outline" className="border-emerald-500/40 text-emerald-600 bg-emerald-500/10 text-[10px]">
                          <ShieldCheck className="w-3 h-3 mr-0.5" /> {t('pettyCash:reports.badges.closed', 'Lezárt')}
                        </Badge>
                      )}
                      {isPosted && (
                        <Badge variant="outline" className="border-violet-500/40 text-violet-600 bg-violet-500/10 text-[10px]">
                          {t('pettyCash:reports.badges.posted', 'Könyvelve')}
                        </Badge>
                      )}
                      {isReopened && (
                        <Badge variant="outline" className="border-amber-500/40 text-amber-600 bg-amber-500/10 text-[10px]">
                          {t('pettyCash:reports.badges.reopened', { defaultValue: 'Újranyitott (v{{version}})', version: report.version })}
                        </Badge>
                      )}
                    </TableCell>

                    {/* Műveletek */}
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-foreground"
                          title={t('pettyCash:reports.actions.view_print', 'Megtekintés és nyomtatás')}
                          onClick={() => handleOpenDetail(report.id)}
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </Button>

                        {isClosed && (
                          <>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-violet-600 hover:text-violet-700 hover:bg-violet-50 dark:hover:bg-violet-950/20"
                              title={t('pettyCash:reports.actions.post_gl', 'Főkönyvi feladás (381)')}
                              onClick={() => handleOpenGlPost(report)}
                            >
                              <BookOpen className="w-3.5 h-3.5" />
                            </Button>

                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-amber-600 hover:text-amber-700 hover:bg-amber-50 dark:hover:bg-amber-950/20"
                              title={t('pettyCash:reports.actions.reopen', 'Újranyitás jegyzőkönyvvel')}
                              onClick={() => handleOpenReopenModal(report)}
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                            </Button>
                          </>
                        )}

                        {isPosted && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                            title={t('pettyCash:reports.actions.unpost_gl', 'Főkönyvi feladás visszavonása')}
                            onClick={() => handleOpenUnpost(report)}
                          >
                            <Undo2 className="w-3.5 h-3.5" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>

      {/* 3-lépéses Zárás Varázsló Dialógus */}
      <CashClosingWizardDialog
        open={closingWizardOpen}
        onOpenChange={(v) => {
          setClosingWizardOpen(v);
          if (!v) refetch();
        }}
        companyId={companyId}
        registers={registers}
        defaultRegisterId={selectedRegisterId !== 'all' ? selectedRegisterId : undefined}
      />

      {/* Jelentés Részletnézet Dialógus */}
      <CashReportDetailDialog
        open={detailOpen}
        onOpenChange={setDetailOpen}
        reportId={selectedReportId}
        registerName={selectedRegisterId !== 'all' ? getRegisterName(selectedRegisterId) : 'Pénztár'}
      />

      {/* Újranyitási Megerősítő Dialógus */}
      <Dialog open={reopenModalOpen} onOpenChange={setReopenModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <RotateCcw className="w-5 h-5" />
              {t('pettyCash:reports.reopen_modal.title', 'Pénztárjelentés újranyitása')}
            </DialogTitle>
            <DialogDescription className="text-xs">
              {t('pettyCash:reports.reopen_modal.desc', 'Sztv. 167. § szerinti eljárás: a lezárt bizonylat újranyitása új verziót nyit, az előző verzió megmarad.')}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2 text-xs">
            <div className="p-2.5 bg-muted/40 rounded-lg font-mono">
              <div>{t('pettyCash:reports.reopen_modal.number', 'Sorszám:')} <strong>{reopenTargetReport?.report_number}</strong></div>
              <div>{t('pettyCash:reports.reopen_modal.period', 'Időszak:')} {reopenTargetReport?.period_start} – {reopenTargetReport?.period_end}</div>
            </div>

            <div>
              <Label className="text-xs font-medium">{t('pettyCash:reports.reopen_modal.reason_label', 'Újranyitás indoklása (kötelező) *')}</Label>
              <Textarea
                value={reopenReason}
                onChange={(e) => setReopenReason(e.target.value)}
                placeholder={t('pettyCash:reports.reopen_modal.reason_placeholder', 'Miért szükséges a lezárt jelentés feloldása? pl. Késve átadott készpénzes számla utólagos felvitele...')}
                className="mt-1 text-xs min-h-[70px]"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setReopenModalOpen(false)}>
              {t('common:cancel', 'Mégse')}
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={handleConfirmReopen}
              disabled={reopenReason.trim().length < 5 || reopenMutation.isPending}
              className="gap-1.5"
            >
              {reopenMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
              {t('pettyCash:reports.reopen_modal.confirm', 'Újranyitás jóváhagyása')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Főkönyvi Feladás Ellenőrző és Megerősítő Dialógus */}
      <Dialog open={glPostModalOpen} onOpenChange={setGlPostModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-violet-600">
              <BookOpen className="w-5 h-5" />
              {t('pettyCash:reports.gl_modal.title', 'Főkönyvi feladás (381-es számla)')}
            </DialogTitle>
            <DialogDescription className="text-xs">
              {t('pettyCash:reports.gl_modal.desc', 'Időszaki pénztárjelentés tételeinek automatikus kontírozása és feladása a főkönyvbe.')}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2 text-xs">
            <div className="p-2.5 bg-muted/40 rounded-lg font-mono">
              <div>{t('pettyCash:reports.gl_modal.number', 'Bizonylatszám:')} <strong>{glTargetReport?.report_number}</strong></div>
              <div>{t('pettyCash:reports.gl_modal.period', 'Időszak:')} {glTargetReport?.period_start} – {glTargetReport?.period_end}</div>
              <div>{t('pettyCash:reports.gl_modal.closing_balance', 'Záró egyenleg:')} {fmtBalance(glTargetReport?.closing_balance_actual ?? glTargetReport?.closing_balance_book ?? 0, glTargetReport?.currency || 'HUF')}</div>
            </div>

            {isValidatingGl ? (
              <div className="flex items-center justify-center p-6 gap-2 text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin text-primary" />
                <span>{t('pettyCash:reports.gl_modal.validating', 'Sztv. és kontírozási szabályok ellenőrzése...')}</span>
              </div>
            ) : glValidation ? (
              <div className="space-y-2">
                {glValidation.valid ? (
                  <div className="p-3 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-500/30 rounded-lg flex items-start gap-2.5 text-emerald-700 dark:text-emerald-400">
                    <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                    <div className="text-xs">
                      <div className="font-semibold">{t('pettyCash:reports.gl_modal.ready_title', 'Feladásra kész!')}</div>
                      <div>{t('pettyCash:reports.gl_modal.ready_desc', { defaultValue: 'A jelentés {{count}} db tétele maradéktalanul érvényes ellenszámlával rendelkezik.', count: glValidation.items_count })}</div>
                    </div>
                  </div>
                ) : (
                  <div className="p-3 bg-destructive/10 border border-destructive/30 rounded-lg space-y-1.5 text-destructive">
                    <div className="flex items-center gap-2 font-semibold">
                      <AlertTriangle className="w-4 h-4 shrink-0" />
                      <span>{t('pettyCash:reports.gl_modal.error_header', 'A feladás nem hajtható végre a következő okok miatt:')}</span>
                    </div>
                    <ul className="list-disc pl-5 space-y-1 text-[11px]">
                      {glValidation.errors.map((err, i) => (
                        <li key={i}>{err}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ) : null}
          </div>

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setGlPostModalOpen(false)}>
              {t('common:cancel', 'Mégse')}
            </Button>
            <Button
              size="sm"
              disabled={isValidatingGl || !glValidation?.valid || postGlMutation.isPending}
              onClick={handleConfirmGlPost}
              className="gap-1.5 bg-violet-600 hover:bg-violet-700 text-white font-medium"
            >
              {postGlMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
              {t('pettyCash:reports.gl_modal.confirm', 'Könyvelés végrehajtása (381)')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Főkönyvi Feladás Visszavonása Dialógus */}
      <Dialog open={unpostModalOpen} onOpenChange={setUnpostModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <Undo2 className="w-5 h-5" />
              {t('pettyCash:reports.unpost_modal.title', 'Főkönyvi feladás visszavonása')}
            </DialogTitle>
            <DialogDescription className="text-xs">
              {t('pettyCash:reports.unpost_modal.desc', 'Biztosan visszavonod a pénztárjelentés főkönyvi feladását? A kapcsolódó 381-es vegyes naplóbejegyzés törlésre kerül, és a jelentés státusza visszakerül \'lezárt\' állapotba.')}
            </DialogDescription>
          </DialogHeader>

          <div className="p-2.5 bg-muted/40 rounded-lg font-mono text-xs">
            <div>{t('pettyCash:reports.gl_modal.number', 'Bizonylatszám:')} <strong>{unpostTargetReport?.report_number}</strong></div>
            <div>{t('pettyCash:reports.gl_modal.period', 'Időszak:')} {unpostTargetReport?.period_start} – {unpostTargetReport?.period_end}</div>
          </div>

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setUnpostModalOpen(false)}>
              {t('common:cancel', 'Mégse')}
            </Button>
            <Button
              size="sm"
              variant="destructive"
              disabled={unpostGlMutation.isPending}
              onClick={handleConfirmUnpost}
              className="gap-1.5"
            >
              {unpostGlMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Undo2 className="w-3.5 h-3.5" />}
              {t('pettyCash:reports.unpost_modal.confirm', 'Feladás visszavonása')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
