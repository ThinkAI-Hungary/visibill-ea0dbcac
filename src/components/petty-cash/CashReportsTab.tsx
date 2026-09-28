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
import { 
  useCashReports, 
  useReopenCashReport,
  useValidateCashReportForPosting,
  usePostCashReportToGl,
  useUnpostCashReportFromGl
} from '@/hooks/useCashReports';
import { CashClosingWizardDialog } from './closing-wizard/CashClosingWizardDialog';
import { CashReportDetailDialog } from './CashReportDetailDialog';

interface CashReportsTabProps {
  registers: PettyCashRegister[];
  companyId: string;
}

export default function CashReportsTab({ registers, companyId }: CashReportsTabProps) {
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
        title: 'Pénztárjelentés újranyitva',
        description: `${reopenTargetReport.report_number || 'Jelentés'} sikeresen újranyitva helyesbítés céljából.`,
      });
      setReopenModalOpen(false);
      refetch();
    } catch (err: any) {
      toast({
        title: 'Hiba az újranyitás során',
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
        title: 'Hiba az ellenőrzés során',
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
        title: 'Pénztárjelentés feladva a főkönyvbe',
        description: `${glTargetReport.report_number || 'Jelentés'} sikeresen lekönyvelve a 381-es számlára.`,
      });
      setGlPostModalOpen(false);
      refetch();
    } catch (err: any) {
      toast({
        title: 'Hiba a főkönyvi feladás során',
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
        title: 'Főkönyvi feladás visszavonva',
        description: `${unpostTargetReport.report_number || 'Jelentés'} könyvelése sikeresen visszavonva.`,
      });
      setUnpostModalOpen(false);
      refetch();
    } catch (err: any) {
      toast({
        title: 'Hiba a visszavonás során',
        description: err.message,
        variant: 'destructive',
      });
    }
  };

  // Find register name by ID
  const getRegisterName = (regId: string) => {
    return registers.find(r => r.id === regId)?.name || 'Központi pénztár';
  };

  return (
    <div className="space-y-4">
      {/* Fejléc és Szűrők */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-card p-3 rounded-xl border border-border/80">
        <div className="flex flex-wrap items-center gap-2 flex-1">
          {/* Pénztár választó */}
          <Select value={selectedRegisterId} onValueChange={setSelectedRegisterId}>
            <SelectTrigger className="w-48 h-9 text-xs">
              <SelectValue placeholder="Minden pénztár" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Minden pénztár</SelectItem>
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
              <SelectItem value="ALL">Minden státusz</SelectItem>
              <SelectItem value="open">Nyitott</SelectItem>
              <SelectItem value="closed">Lezárt</SelectItem>
              <SelectItem value="posted">Feladva (381)</SelectItem>
              <SelectItem value="reopened">Újranyitott</SelectItem>
            </SelectContent>
          </Select>

          {/* Keresőmező */}
          <div className="relative flex-1 min-w-[180px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Keresés bizonylatszám, dátum..."
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
          Új időszaki zárás indítása
        </Button>
      </div>

      {/* Jelentések Táblázata */}
      <div className="border border-border/80 rounded-xl overflow-hidden bg-card">
        {isLoading ? (
          <div className="flex items-center justify-center h-48 gap-2 text-muted-foreground text-xs">
            <Loader2 className="w-5 h-5 animate-spin text-primary" />
            <span>Pénztárjelentések betöltése...</span>
          </div>
        ) : filteredReports.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-muted-foreground text-xs gap-2">
            <FileText className="w-8 h-8 opacity-40" />
            <span>Nem található időszaki pénztárjelentés a megadott szűrésre.</span>
            <Button variant="outline" size="sm" onClick={() => setClosingWizardOpen(true)} className="text-xs mt-1">
              Első zárás indítása most
            </Button>
          </div>
        ) : (
          <Table className="text-xs">
            <TableHeader className="bg-muted/40 border-b">
              <TableRow>
                <TableHead className="w-36">Sorszám</TableHead>
                <TableHead>Pénztár</TableHead>
                <TableHead className="w-44 text-center">Időszak</TableHead>
                <TableHead className="w-28 text-right">Nyitó</TableHead>
                <TableHead className="w-28 text-right">Bevétel (+)</TableHead>
                <TableHead className="w-28 text-right">Kiadás (-)</TableHead>
                <TableHead className="w-32 text-right">Záró készlet</TableHead>
                <TableHead className="w-28 text-center">Státusz</TableHead>
                <TableHead className="w-28 text-right">Műveletek</TableHead>
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
                      {report.report_number || `Piszkozat #${report.version}`}
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
                          Eltérés: {fmtBalance(report.difference, cur)}
                        </div>
                      )}
                    </TableCell>

                    {/* Státusz */}
                    <TableCell className="text-center">
                      {isOpen && (
                        <Badge variant="outline" className="border-blue-500/40 text-blue-600 bg-blue-500/10 text-[10px]">
                          Nyitott
                        </Badge>
                      )}
                      {isClosed && (
                        <Badge variant="outline" className="border-emerald-500/40 text-emerald-600 bg-emerald-500/10 text-[10px]">
                          <ShieldCheck className="w-3 h-3 mr-0.5" /> Lezárt
                        </Badge>
                      )}
                      {isPosted && (
                        <Badge variant="outline" className="border-violet-500/40 text-violet-600 bg-violet-500/10 text-[10px]">
                          Könyvelve
                        </Badge>
                      )}
                      {isReopened && (
                        <Badge variant="outline" className="border-amber-500/40 text-amber-600 bg-amber-500/10 text-[10px]">
                          Újranyitott (v{report.version})
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
                          title="Megtekintés és nyomtatás"
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
                              title="Főkönyvi feladás (381)"
                              onClick={() => handleOpenGlPost(report)}
                            >
                              <BookOpen className="w-3.5 h-3.5" />
                            </Button>

                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-amber-600 hover:text-amber-700 hover:bg-amber-50 dark:hover:bg-amber-950/20"
                              title="Újranyitás jegyzőkönyvvel"
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
                            title="Főkönyvi feladás visszavonása"
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
              Pénztárjelentés újranyitása
            </DialogTitle>
            <DialogDescription className="text-xs">
              Sztv. 167. § szerinti eljárás: a lezárt bizonylat újranyitása új verziót (v{((reopenTargetReport?.version || 1) + 1)}) nyit, az előző verzió megmarad.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2 text-xs">
            <div className="p-2.5 bg-muted/40 rounded-lg font-mono">
              <div>Sorszám: <strong>{reopenTargetReport?.report_number}</strong></div>
              <div>Időszak: {reopenTargetReport?.period_start} – {reopenTargetReport?.period_end}</div>
            </div>

            <div>
              <Label className="text-xs font-medium">Újranyitás indoklása (kötelező) *</Label>
              <Textarea
                value={reopenReason}
                onChange={(e) => setReopenReason(e.target.value)}
                placeholder="Miért szükséges a lezárt jelentés feloldása? pl. Késve átadott készpénzes számla utólagos felvitele..."
                className="mt-1 text-xs min-h-[70px]"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setReopenModalOpen(false)}>
              Mégse
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={handleConfirmReopen}
              disabled={reopenReason.trim().length < 5 || reopenMutation.isPending}
              className="gap-1.5"
            >
              {reopenMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
              Újranyitás jóváhagyása
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
              Főkönyvi feladás (381-es számla)
            </DialogTitle>
            <DialogDescription className="text-xs">
              Időszaki pénztárjelentés tételeinek automatikus kontírozása és feladása a főkönyvbe.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2 text-xs">
            <div className="p-2.5 bg-muted/40 rounded-lg font-mono">
              <div>Bizonylatszám: <strong>{glTargetReport?.report_number}</strong></div>
              <div>Időszak: {glTargetReport?.period_start} – {glTargetReport?.period_end}</div>
              <div>Záró egyenleg: {fmtBalance(glTargetReport?.closing_balance_actual ?? glTargetReport?.closing_balance_book ?? 0, glTargetReport?.currency || 'HUF')}</div>
            </div>

            {isValidatingGl ? (
              <div className="flex items-center justify-center p-6 gap-2 text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin text-primary" />
                <span>Sztv. és kontírozási szabályok ellenőrzése...</span>
              </div>
            ) : glValidation ? (
              <div className="space-y-2">
                {glValidation.valid ? (
                  <div className="p-3 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-500/30 rounded-lg flex items-start gap-2.5 text-emerald-700 dark:text-emerald-400">
                    <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                    <div className="text-xs">
                      <div className="font-semibold">Feladásra kész!</div>
                      <div>A jelentés {glValidation.items_count} db tétele maradéktalanul érvényes ellenszámlával rendelkezik.</div>
                    </div>
                  </div>
                ) : (
                  <div className="p-3 bg-destructive/10 border border-destructive/30 rounded-lg space-y-1.5 text-destructive">
                    <div className="flex items-center gap-2 font-semibold">
                      <AlertTriangle className="w-4 h-4 shrink-0" />
                      <span>A feladás nem hajtható végre a következő okok miatt:</span>
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
              Mégse
            </Button>
            <Button
              size="sm"
              disabled={isValidatingGl || !glValidation?.valid || postGlMutation.isPending}
              onClick={handleConfirmGlPost}
              className="gap-1.5 bg-violet-600 hover:bg-violet-700 text-white font-medium"
            >
              {postGlMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
              Könyvelés végrehajtása (381)
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
              Főkönyvi feladás visszavonása
            </DialogTitle>
            <DialogDescription className="text-xs">
              Biztosan visszavonod a pénztárjelentés főkönyvi feladását? A kapcsolódó 381-es vegyes naplóbejegyzés törlésre kerül, és a jelentés státusza visszakerül 'lezárt' állapotba.
            </DialogDescription>
          </DialogHeader>

          <div className="p-2.5 bg-muted/40 rounded-lg font-mono text-xs">
            <div>Bizonylatszám: <strong>{unpostTargetReport?.report_number}</strong></div>
            <div>Időszak: {unpostTargetReport?.period_start} – {unpostTargetReport?.period_end}</div>
          </div>

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setUnpostModalOpen(false)}>
              Mégse
            </Button>
            <Button
              size="sm"
              variant="destructive"
              disabled={unpostGlMutation.isPending}
              onClick={handleConfirmUnpost}
              className="gap-1.5"
            >
              {unpostGlMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Undo2 className="w-3.5 h-3.5" />}
              Feladás visszavonása
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
