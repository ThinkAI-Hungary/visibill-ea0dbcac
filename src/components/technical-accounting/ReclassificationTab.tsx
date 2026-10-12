import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCompany } from '@/contexts/CompanyContext';
import { useDateRange } from '@/contexts/DateRangeContext';
import { useSimulateReclassification, useExecuteReclassification } from '@/hooks/useTechnicalAccounting';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { formatCurrencyLocale, formatNumberLocale } from '@/lib/locale/formatters';
import {
  ArrowRight,
  ArrowRightLeft,
  CheckCircle2,
  AlertTriangle,
  Play,
  RotateCcw,
  Sparkles,
  Layers,
  FileSpreadsheet,
  AlertCircle
} from 'lucide-react';
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

interface ReclassificationTabProps {
  companyId?: string;
  onSuccess?: () => void;
  onOpenPartnerDossier?: (partnerId: string) => void;
}

export const ReclassificationTab: React.FC<ReclassificationTabProps> = ({
  companyId: propCompanyId,
  onSuccess,
  onOpenPartnerDossier: _onOpenPartnerDossier,
}) => {
  const { selectedCompany } = useCompany();
  const { dateFromFormatted, dateToFormatted } = useDateRange();
  const companyId = propCompanyId || selectedCompany?.id;

  const [sourceGlId, setSourceGlId] = useState<string>('');
  const [targetGlId, setTargetGlId] = useState<string>('');
  const [clearingGlId, setClearingGlId] = useState<string>('');
  const [reclassDate, setReclassDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [reason, setReason] = useState<string>('');
  const [selectedLineIds, setSelectedLineIds] = useState<string[]>([]);
  const [lineSearch, setLineSearch] = useState<string>('');

  // Főkönyvi számlák listája
  const { data: glAccounts } = useQuery({
    queryKey: ['company-gl-accounts', companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('gl_accounts')
        .select('id, gl_number, short_name')
        .order('gl_number');
      if (error) throw error;
      return data || [];
    },
    enabled: !!companyId,
  });

  // Forrás számla tételeinek lekérése a kijelöléshez
  const { data: sourceLines, isLoading: isLoadingLines } = useQuery({
    queryKey: ['source-gl-lines', companyId, sourceGlId, dateFromFormatted, dateToFormatted],
    queryFn: async () => {
      if (!sourceGlId) return [];
      let query = supabase
        .from('acc_journal_lines')
        .select(`
          id,
          amount,
          dc_type,
          description,
          vat_code,
          header:acc_journal_headers!inner (
            id,
            posting_date,
            document_id,
            status,
            partner:partners (id, name, tax_number)
          )
        `)
        .eq('gl_account_id', sourceGlId)
        .eq('header.company_id', companyId!)
        .in('header.status', ['KONYVELT', 'LEKONYVELT']);

      if (dateFromFormatted) {
        query = query.gte('header.posting_date', dateFromFormatted);
      }
      if (dateToFormatted) {
        query = query.lte('header.posting_date', dateToFormatted);
      }

      const { data, error } = await query.order('id', { ascending: false });
      if (error) throw error;
      return (data || []).map((row: any) => ({
        id: row.id,
        amount: Number(row.amount),
        dc_type: row.dc_type,
        description: row.description,
        vat_code: row.vat_code,
        posting_date: row.header?.posting_date,
        document_id: row.header?.document_id,
        partner_name: row.header?.partner?.name || '—',
      }));
    },
    enabled: !!companyId && !!sourceGlId,
  });

  const filteredLines = useMemo(() => {
    if (!sourceLines) return [];
    if (!lineSearch.trim()) return sourceLines;
    const term = lineSearch.toLowerCase();
    return sourceLines.filter(
      (l) =>
        (l.description && l.description.toLowerCase().includes(term)) ||
        (l.document_id && l.document_id.toLowerCase().includes(term)) ||
        (l.partner_name && l.partner_name.toLowerCase().includes(term))
    );
  }, [sourceLines, lineSearch]);

  // Mindent kijelöl / Kijelölés törlése
  const handleToggleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedLineIds(filteredLines.map((l) => l.id));
    } else {
      setSelectedLineIds([]);
    }
  };

  const handleToggleLine = (id: string) => {
    setSelectedLineIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  // Szimuláció hívás
  const simulateMutation = useSimulateReclassification();
  const executeMutation = useExecuteReclassification();

  const handleRunSimulation = () => {
    if (!companyId || !sourceGlId || !targetGlId || selectedLineIds.length === 0) return;
    simulateMutation.mutate({
      companyId,
      sourceGlAccountId: sourceGlId,
      targetGlAccountId: targetGlId,
      journalLineIds: selectedLineIds,
      reclassificationDate: reclassDate,
      reason,
    });
  };

  const handleConfirmExecution = () => {
    if (!companyId || !sourceGlId || !targetGlId || selectedLineIds.length === 0) return;
    executeMutation.mutate(
      {
        companyId,
        sourceGlAccountId: sourceGlId,
        targetGlAccountId: targetGlId,
        journalLineIds: selectedLineIds,
        reclassificationDate: reclassDate,
        reason: reason || 'Tömeges főkönyvi átvezetés',
        clearingGlAccountId: clearingGlId || undefined,
      },
      {
        onSuccess: () => {
          setSelectedLineIds([]);
          simulateMutation.reset();
          if (onSuccess) onSuccess();
        },
      }
    );
  };

  const sourceAccount = glAccounts?.find((g) => g.id === sourceGlId);
  const targetAccount = glAccounts?.find((g) => g.id === targetGlId);

  const selectedTotalAmount = useMemo(() => {
    if (!sourceLines) return 0;
    return sourceLines
      .filter((l) => selectedLineIds.includes(l.id))
      .reduce((sum, l) => sum + l.amount, 0);
  }, [sourceLines, selectedLineIds]);

  return (
    <div className="space-y-6">
      {/* 1. Konfigurációs Panel: Forrás és Cél Főkönyvi Számlák */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <ArrowRightLeft className="h-5 w-5 text-primary" />
            Tömeges Főkönyvi Átvezetés & Átkontírozás
          </CardTitle>
          <CardDescription>
            Sztv. szerinti bizonylatolással generálható technikai vegyes bizonylat (V-ATV), zéró destruktív adatbázis-módosítással.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">
                1. Forrás Főkönyvi Számla (ahonnan áthelyezünk)
              </label>
              <select
                aria-label="Forrás főkönyvi számla kiválasztása"
                className="w-full h-10 px-3 py-2 text-sm bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
                value={sourceGlId}
                onChange={(e) => {
                  setSourceGlId(e.target.value);
                  setSelectedLineIds([]);
                  simulateMutation.reset();
                }}
              >
                <option value="">-- Válassz forrás számlát --</option>
                {(glAccounts || []).map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.gl_number} — {g.short_name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">
                2. Cél Főkönyvi Számla (ahová áthelyezünk)
              </label>
              <select
                aria-label="Cél főkönyvi számla kiválasztása"
                className="w-full h-10 px-3 py-2 text-sm bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
                value={targetGlId}
                onChange={(e) => {
                  setTargetGlId(e.target.value);
                  simulateMutation.reset();
                }}
              >
                <option value="">-- Válassz cél számlát --</option>
                {(glAccounts || [])
                  .filter((g) => g.id !== sourceGlId)
                  .map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.gl_number} — {g.short_name}
                    </option>
                  ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">
                3. Technikai Elszámoló Számla (Opcionális pl. 3899)
              </label>
              <select
                aria-label="Technikai elszámoló számla kiválasztása"
                className="w-full h-10 px-3 py-2 text-sm bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
                value={clearingGlId}
                onChange={(e) => setClearingGlId(e.target.value)}
              >
                <option value="">Közvetlen átvezetés (nincs közbenső számla)</option>
                {(glAccounts || [])
                  .filter((g) => g.gl_number.startsWith('389'))
                  .map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.gl_number} — {g.short_name}
                    </option>
                  ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">
                Átvezetési Bizonylat Dátuma
              </label>
              <Input
                type="date"
                value={reclassDate}
                onChange={(e) => setReclassDate(e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">
                Átvezetés Számviteli Indoklása / Megjegyzés
              </label>
              <Input
                placeholder="Pl. Évközi bérleti díjak átsorolása járműbérletre..."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 2. Tételek Kijelölése & Szűrése */}
      {sourceGlId && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <FileSpreadsheet className="h-4 w-4 text-primary" />
                  Áthelyezendő Tételek Kiválasztása
                  <Badge variant="outline" className="font-mono text-xs ml-2">
                    {sourceAccount?.gl_number}
                  </Badge>
                </CardTitle>
                <CardDescription>
                  Jelöld be azokat a forgalmi sorokat, amelyeket át szeretnél vezetni a cél számlára
                </CardDescription>
              </div>

              <div className="flex items-center gap-3">
                <Input
                  placeholder="Keresés partnerre, leírásra..."
                  value={lineSearch}
                  onChange={(e) => setLineSearch(e.target.value)}
                  className="h-8 text-xs w-56"
                />
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 text-xs"
                  onClick={() => handleToggleSelectAll(selectedLineIds.length < filteredLines.length)}
                >
                  {selectedLineIds.length === filteredLines.length ? 'Kijelölés Törlése' : 'Mind Kijelölése'}
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {isLoadingLines ? (
              <div className="py-12 text-center">
                <LoadingSpinner message="Forrás számla tételeinek betöltése..." />
              </div>
            ) : filteredLines.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground text-sm">
                A forrás számlán nincs elérhető lekönyvelt tétel a megadott időszakban.
              </div>
            ) : (
              <div className="overflow-x-auto max-h-96">
                <Table>
                  <TableHeader className="sticky top-0 bg-background z-10 shadow-sm">
                    <TableRow>
                      <TableHead className="w-12 text-center">
                        <Checkbox
                          checked={filteredLines.length > 0 && selectedLineIds.length === filteredLines.length}
                          onCheckedChange={(checked) => handleToggleSelectAll(!!checked)}
                        />
                      </TableHead>
                      <TableHead>Dátum</TableHead>
                      <TableHead>Bizonylatszám</TableHead>
                      <TableHead>Partner</TableHead>
                      <TableHead>Leírás</TableHead>
                      <TableHead className="text-center">T/K</TableHead>
                      <TableHead className="text-right">Összeg</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredLines.map((line) => {
                      const isSelected = selectedLineIds.includes(line.id);
                      return (
                        <TableRow
                          key={line.id}
                          className={`cursor-pointer ${isSelected ? 'bg-primary/5' : 'hover:bg-muted/50'}`}
                          onClick={() => handleToggleLine(line.id)}
                        >
                          <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                            <Checkbox
                              checked={isSelected}
                              onCheckedChange={() => handleToggleLine(line.id)}
                            />
                          </TableCell>
                          <TableCell className="text-xs font-mono">{line.posting_date}</TableCell>
                          <TableCell className="text-xs font-mono font-medium text-foreground">
                            {line.document_id}
                          </TableCell>
                          <TableCell className="text-xs font-medium">{line.partner_name}</TableCell>
                          <TableCell className="text-xs text-muted-foreground max-w-xs truncate">
                            {line.description || '—'}
                          </TableCell>
                          <TableCell className="text-center text-xs">
                            <Badge variant={line.dc_type === 'T' ? 'default' : 'secondary'} className="text-[10px]">
                              {line.dc_type}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right font-mono text-xs font-bold text-foreground">
                            {formatCurrencyLocale(line.amount, 'HUF')}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
          <CardFooter className="py-3 px-4 border-t flex items-center justify-between bg-muted/20">
            <div className="text-xs text-muted-foreground font-mono">
              Kijelölve: <strong>{selectedLineIds.length}</strong> / {filteredLines.length} tétel |
              Összeg: <strong className="text-primary">{formatCurrencyLocale(selectedTotalAmount, 'HUF')}</strong>
            </div>

            <Button
              size="sm"
              variant="outline"
              disabled={!targetGlId || selectedLineIds.length === 0 || simulateMutation.isPending}
              onClick={handleRunSimulation}
              className="gap-1.5"
            >
              <Sparkles className="h-4 w-4 text-purple-500" />
              <span>Egyenleg Szimuláció Futtatása</span>
            </Button>
          </CardFooter>
        </Card>
      )}

      {/* 3. Szimulációs Eredmény & Végrehajtás Kártyák */}
      {simulateMutation.data && (
        <Card className="border-purple-500/40 bg-purple-500/5">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2 text-purple-700 dark:text-purple-300">
                <Sparkles className="h-5 w-5" />
                Számlaegyenleg Hatásvizsgálat & Szimuláció (Dry-Run)
              </CardTitle>
              {simulateMutation.data.has_cross_class_impact && (
                <Badge variant="outline" className="border-amber-500 text-amber-600 bg-amber-500/10 gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  Mérleg ↔ Eredmény számlaosztályok közötti mozgás!
                </Badge>
              )}
            </div>
            <CardDescription>
              Ellenőrizd az érintett számlák egyenlegváltozását a végleges könyvelés előtt
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Forrás Számla Kártya */}
              <div className="p-4 rounded-xl border bg-card space-y-2">
                <div className="flex justify-between items-center text-xs text-muted-foreground">
                  <span>Forrás Főkönyvi Számla</span>
                  <Badge variant="outline" className="font-mono text-[10px]">
                    {simulateMutation.data.source_account.gl_number}
                  </Badge>
                </div>
                <div className="font-semibold text-sm">{simulateMutation.data.source_account.short_name}</div>
                <div className="pt-2 border-t space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Jelenlegi egyenleg:</span>
                    <span className="font-mono">{formatCurrencyLocale(simulateMutation.data.source_account.current_balance, 'HUF')}</span>
                  </div>
                  <div className="flex justify-between text-red-600 dark:text-red-400 font-medium">
                    <span>Átvezetendő (kivezetés):</span>
                    <span className="font-mono">-{formatCurrencyLocale(simulateMutation.data.total_amount, 'HUF')}</span>
                  </div>
                  <div className="flex justify-between font-bold text-foreground pt-1 border-t">
                    <span>Új egyenleg:</span>
                    <span className="font-mono">{formatCurrencyLocale(simulateMutation.data.source_account.simulated_balance, 'HUF')}</span>
                  </div>
                </div>
              </div>

              {/* Cél Számla Kártya */}
              <div className="p-4 rounded-xl border bg-card space-y-2">
                <div className="flex justify-between items-center text-xs text-muted-foreground">
                  <span>Cél Főkönyvi Számla</span>
                  <Badge variant="outline" className="font-mono text-[10px]">
                    {simulateMutation.data.target_account.gl_number}
                  </Badge>
                </div>
                <div className="font-semibold text-sm">{simulateMutation.data.target_account.short_name}</div>
                <div className="pt-2 border-t space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Jelenlegi egyenleg:</span>
                    <span className="font-mono">{formatCurrencyLocale(simulateMutation.data.target_account.current_balance, 'HUF')}</span>
                  </div>
                  <div className="flex justify-between text-emerald-600 dark:text-emerald-400 font-medium">
                    <span>Átvezetendő (bevezetés):</span>
                    <span className="font-mono">+{formatCurrencyLocale(simulateMutation.data.total_amount, 'HUF')}</span>
                  </div>
                  <div className="flex justify-between font-bold text-foreground pt-1 border-t">
                    <span>Új egyenleg:</span>
                    <span className="font-mono">{formatCurrencyLocale(simulateMutation.data.target_account.simulated_balance, 'HUF')}</span>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
          <CardFooter className="flex justify-between items-center bg-purple-500/10 py-3 px-6">
            <span className="text-xs text-purple-700 dark:text-purple-300 font-medium">
              Készen áll az átvezetésre: {simulateMutation.data.affected_lines_count} tétel | {formatCurrencyLocale(simulateMutation.data.total_amount, 'HUF')}
            </span>

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold">
                  <Play className="h-4 w-4" />
                  <span>Átvezetés Végrehajtása (V-ATV Bizonylat)</span>
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Biztosan végrehajtod a tömeges átvezetést?</AlertDialogTitle>
                  <AlertDialogDescription className="space-y-2">
                    <p>
                      A rendszer kiállítja a hivatalos technikai vegyes bizonylatot (V-ATV), amely a 
                      <strong> {simulateMutation.data.source_account.gl_number}</strong> számláról 
                      <strong> {simulateMutation.data.target_account.gl_number}</strong> számlára helyez át 
                      <strong> {formatCurrencyLocale(simulateMutation.data.total_amount, 'HUF')}</strong> összeget.
                    </p>
                    <p className="text-xs text-muted-foreground">
                      A művelet az Sztv. szabályai szerint teljes körűen visszagörgethető (Rollback) a történet fülön.
                    </p>
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Mégse</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleConfirmExecution}
                    disabled={executeMutation.isPending}
                    className="bg-primary"
                  >
                    {executeMutation.isPending ? 'Könyvelés folyamatban...' : 'Jóváhagyás & Lekönyvelés'}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </CardFooter>
        </Card>
      )}
    </div>
  );
};
