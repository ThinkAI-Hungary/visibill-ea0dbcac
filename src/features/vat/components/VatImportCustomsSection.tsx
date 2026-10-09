import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';
import {
  PackageCheck,
  Plus,
  Search,
  Filter,
  MoreVertical,
  Edit2,
  Trash2,
  CheckCircle2,
  Clock,
  Building,
  Sparkles,
  BookOpen,
  DollarSign,
  Layers,
  Info,
  Calendar,
  RefreshCw,
  FileCheck,
} from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { VatFrequency } from '../types';
import {
  ImportCustomsDeclaration,
  ImportCustomsFormData,
  ImportProcedureType,
} from '../types/importVat';
import { ImportCustomsDeclarationDialog } from './ImportCustomsDeclarationDialog';
import { postImportDeclarationToGeneralLedger } from '../services/importCustomsAccounting';

interface VatImportCustomsSectionProps {
  companyId: string;
  year: number;
  month: number;
  frequency: VatFrequency;
  onRefreshReturn?: () => void;
}

export function VatImportCustomsSection({
  companyId,
  year,
  month,
  frequency,
  onRefreshReturn,
}: VatImportCustomsSectionProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [searchQuery, setSearchQuery] = useState('');
  const [procedureFilter, setProcedureFilter] = useState<'ALL' | ImportProcedureType>('ALL');
  const [paymentFilter, setPaymentFilter] = useState<'ALL' | 'PAID' | 'PENDING'>('ALL');

  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedDeclaration, setSelectedDeclaration] = useState<ImportCustomsDeclaration | null>(
    null
  );

  // Period Date Range
  const { dateFrom, dateTo, periodLabel } = useMemo(() => {
    if (frequency === 'H') {
      const from = `${year}-${String(month).padStart(2, '0')}-01`;
      const lastDay = new Date(year, month, 0).getDate();
      const to = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
      return { dateFrom: from, dateTo: to, periodLabel: `${year}. ${String(month).padStart(2, '0')}. hó` };
    } else if (frequency === 'N') {
      const startMonth = (month - 1) * 3 + 1;
      const from = `${year}-${String(startMonth).padStart(2, '0')}-01`;
      const endMonth = startMonth + 2;
      const lastDay = new Date(year, endMonth, 0).getDate();
      const to = `${year}-${String(endMonth).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
      return { dateFrom: from, dateTo: to, periodLabel: `${year}. Q${month}` };
    } else {
      return { dateFrom: `${year}-01-01`, dateTo: `${year}-12-31`, periodLabel: `${year}. év` };
    }
  }, [year, month, frequency]);

  // Fetch declarations for this company
  const { data: declarations = [], isLoading, refetch } = useQuery({
    queryKey: ['import_customs_declarations', companyId, year, month, frequency],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('import_customs_declarations')
        .select('*')
        .eq('company_id', companyId)
        .order('decision_date', { ascending: false });

      if (error) throw error;
      return (data || []) as ImportCustomsDeclaration[];
    },
    enabled: !!companyId,
  });

  // KPI Calculations
  const kpis = useMemo(() => {
    let paidLevyVatRow70 = 0;
    let pendingLevyVat = 0;
    let selfAssessmentVat = 0;
    let totalCustomsDuty = 0;

    for (const d of declarations) {
      if (d.status === 'CANCELLED') continue;

      if (d.procedure_type === 'LEVY') {
        totalCustomsDuty += Number(d.customs_duty_huf || 0);
        // Only paid within period counts into row 70
        if (
          d.payment_status === 'PAID' &&
          d.payment_date &&
          d.payment_date >= dateFrom &&
          d.payment_date <= dateTo
        ) {
          if (d.is_deductible) {
            paidLevyVatRow70 += Number(d.vat_amount_huf || 0);
          }
        } else if (d.payment_status === 'PENDING') {
          pendingLevyVat += Number(d.vat_amount_huf || 0);
        }
      } else {
        // Self-assessment within period
        if (d.tax_period_date >= dateFrom && d.tax_period_date <= dateTo) {
          selfAssessmentVat += Number(d.vat_amount_huf || 0);
          totalCustomsDuty += Number(d.customs_duty_huf || 0);
        }
      }
    }

    return {
      paidLevyVatRow70,
      pendingLevyVat,
      selfAssessmentVat,
      totalCustomsDuty,
    };
  }, [declarations, dateFrom, dateTo]);

  // Filtered List
  const filteredDeclarations = useMemo(() => {
    return declarations.filter((d) => {
      if (procedureFilter !== 'ALL' && d.procedure_type !== procedureFilter) return false;
      if (paymentFilter !== 'ALL' && d.payment_status !== paymentFilter) return false;
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const numMatch = d.declaration_number?.toLowerCase().includes(query);
        const nameMatch = d.foreign_supplier_name?.toLowerCase().includes(query);
        const refMatch = d.bank_transaction_ref?.toLowerCase().includes(query);
        if (!numMatch && !nameMatch && !refMatch) return false;
      }
      return true;
    });
  }, [declarations, procedureFilter, paymentFilter, searchQuery]);

  // Save / Update Mutation
  const saveMutation = useMutation({
    mutationFn: async ({
      data,
      postToGl,
      existingId,
    }: {
      data: ImportCustomsFormData;
      postToGl: boolean;
      existingId?: string;
    }) => {
      let savedRecord: ImportCustomsDeclaration;

      if (existingId) {
        const { data: updated, error } = await (supabase as any)
          .from('import_customs_declarations')
          .update({
            ...data,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existingId)
          .select()
          .single();

        if (error) throw error;
        savedRecord = updated;
      } else {
        const { data: inserted, error } = await (supabase as any)
          .from('import_customs_declarations')
          .insert({
            company_id: companyId,
            ...data,
          })
          .select()
          .single();

        if (error) throw error;
        savedRecord = inserted;
      }

      if (postToGl) {
        await postImportDeclarationToGeneralLedger(savedRecord);
      }

      return savedRecord;
    },
    onSuccess: (savedRecord) => {
      queryClient.invalidateQueries({ queryKey: ['import_customs_declarations', companyId] });
      toast({
        title: 'Vámhatározat sikeresen elmentve',
        description: `Határozat: ${savedRecord.declaration_number} (${formatCurrency(
          savedRecord.vat_amount_huf
        )} ÁFA)`,
      });
      if (onRefreshReturn) {
        onRefreshReturn();
      }
    },
    onError: (err: any) => {
      toast({
        title: 'Hiba a mentés során',
        description: err.message || 'Nem sikerült elmenteni a határozatot',
        variant: 'destructive',
      });
    },
  });

  // Delete Mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any)
        .from('import_customs_declarations')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['import_customs_declarations', companyId] });
      toast({ title: 'Vámhatározat törölve' });
      if (onRefreshReturn) onRefreshReturn();
    },
    onError: (err: any) => {
      toast({
        title: 'Hiba a törlés során',
        description: err.message,
        variant: 'destructive',
      });
    },
  });

  // Mark as Paid Mutation
  const markAsPaidMutation = useMutation({
    mutationFn: async (id: string) => {
      const today = new Date().toISOString().split('T')[0];
      const { data, error } = await (supabase as any)
        .from('import_customs_declarations')
        .update({
          payment_status: 'PAID',
          status: 'PAID',
          payment_date: today,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      await postImportDeclarationToGeneralLedger(data);
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['import_customs_declarations', companyId] });
      toast({
        title: 'Megfizetés rögzítve',
        description: `A(z) ${data.declaration_number} határozat bekerült a 70. levonási sorba!`,
      });
      if (onRefreshReturn) onRefreshReturn();
    },
    onError: (err: any) => {
      toast({ title: 'Hiba a rögzítésnél', description: err.message, variant: 'destructive' });
    },
  });

  const handleOpenNew = () => {
    setSelectedDeclaration(null);
    setDialogOpen(true);
  };

  const handleEdit = (declaration: ImportCustomsDeclaration) => {
    setSelectedDeclaration(declaration);
    setDialogOpen(true);
  };

  const handleSave = async (formData: ImportCustomsFormData, postToGl: boolean) => {
    await saveMutation.mutateAsync({
      data: formData,
      postToGl,
      existingId: selectedDeclaration?.id,
    });
  };

  return (
    <div className="space-y-6">
      {/* Fejléc és Gyors Akciók */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-card p-4 rounded-xl border">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
            <PackageCheck className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-base font-semibold flex items-center gap-2">
              Import ÁFA és Vámhatározatok Nyilvántartása
              <Badge variant="outline" className="text-xs font-normal">
                {periodLabel}
              </Badge>
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Harmadik országbeli termékimport elszámolása és NAV 2665 bevallási kapcsolatai (70., 71., 24–26. sorok)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            className="text-xs gap-1.5"
            disabled={isLoading}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            Frissítés
          </Button>

          <Button
            size="sm"
            onClick={handleOpenNew}
            className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs gap-1.5 shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Új Vámhatározat Rögzítése
          </Button>
        </div>
      </div>

      {/* KPI Kártyák */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Kivetett Levonható ÁFA (70. sor) */}
        <Card className="border-emerald-500/20 bg-gradient-to-br from-emerald-500/5 via-transparent to-transparent">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-medium text-emerald-700 dark:text-emerald-300 flex items-center justify-between">
              <span>Kivetett Megfizetett ÁFA</span>
              <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 text-[10px] border-emerald-500/30">
                70. sor
              </Badge>
            </CardDescription>
            <CardTitle className="text-xl font-bold font-mono text-emerald-600 dark:text-emerald-400">
              {formatCurrency(kpis.paidLevyVatRow70)}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-[11px] text-muted-foreground pt-0">
            Megfizetett vámhatósági határozatok levonható része az időszakban
          </CardContent>
        </Card>

        {/* KPI 2: Önadózásos Import ÁFA (26. és 71. sor) */}
        <Card className="border-indigo-500/20 bg-gradient-to-br from-indigo-500/5 via-transparent to-transparent">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-medium text-indigo-700 dark:text-indigo-300 flex items-center justify-between">
              <span>Önadózásos Import ÁFA</span>
              <Badge className="bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 text-[10px] border-indigo-500/30">
                26. & 71. sor
              </Badge>
            </CardDescription>
            <CardTitle className="text-xl font-bold font-mono text-indigo-600 dark:text-indigo-400">
              {formatCurrency(kpis.selfAssessmentVat)}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-[11px] text-muted-foreground pt-0">
            Pénzmozgás nélküli egyszerre fizetendő és levonható import
          </CardContent>
        </Card>

        {/* KPI 3: Fizetésre Váró Kivetett ÁFA */}
        <Card className="border-amber-500/20 bg-gradient-to-br from-amber-500/5 via-transparent to-transparent">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-medium text-amber-700 dark:text-amber-300 flex items-center justify-between">
              <span>Fizetésre Váró Import ÁFA</span>
              <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-500/40">
                Még nem vonható le
              </Badge>
            </CardDescription>
            <CardTitle className="text-xl font-bold font-mono text-amber-600 dark:text-amber-400">
              {formatCurrency(kpis.pendingLevyVat)}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-[11px] text-muted-foreground pt-0">
            Kiszabva, de a NAV felé még nincs megfizetve (Áfa tv. 120. § c))
          </CardContent>
        </Card>

        {/* KPI 4: Kiszabott Vám Összege */}
        <Card className="border-border/60">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-medium flex items-center justify-between">
              <span>Kiszabott Vám Összege</span>
              <Badge variant="secondary" className="text-[10px]">
                Bekerülési érték
              </Badge>
            </CardDescription>
            <CardTitle className="text-xl font-bold font-mono text-foreground">
              {formatCurrency(kpis.totalCustomsDuty)}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-[11px] text-muted-foreground pt-0">
            Termék bekerülési értékébe könyvelt vámterhek (Szt. 47. §)
          </CardContent>
        </Card>
      </div>

      {/* Szűrők és Kereső */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-muted/40 p-3 rounded-xl border">
        <div className="relative flex-1 max-w-sm">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Keresés határozatszámra, partnerre..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-8 text-xs bg-background"
          />
        </div>

        <div className="flex items-center gap-2">
          {/* Eljárás szűrő */}
          <div className="flex items-center rounded-lg border bg-background p-0.5 text-xs">
            <button
              onClick={() => setProcedureFilter('ALL')}
              className={`px-2.5 py-1 rounded-md transition-colors ${
                procedureFilter === 'ALL' ? 'bg-primary text-primary-foreground font-medium' : 'text-muted-foreground'
              }`}
            >
              Összes eljárás
            </button>
            <button
              onClick={() => setProcedureFilter('LEVY')}
              className={`px-2.5 py-1 rounded-md transition-colors ${
                procedureFilter === 'LEVY' ? 'bg-primary text-primary-foreground font-medium' : 'text-muted-foreground'
              }`}
            >
              Kivetés
            </button>
            <button
              onClick={() => setProcedureFilter('SELF_ASSESSMENT')}
              className={`px-2.5 py-1 rounded-md transition-colors ${
                procedureFilter === 'SELF_ASSESSMENT' ? 'bg-primary text-primary-foreground font-medium' : 'text-muted-foreground'
              }`}
            >
              Önadózás
            </button>
          </div>

          {/* Megfizetettség szűrő */}
          <div className="flex items-center rounded-lg border bg-background p-0.5 text-xs">
            <button
              onClick={() => setPaymentFilter('ALL')}
              className={`px-2.5 py-1 rounded-md transition-colors ${
                paymentFilter === 'ALL' ? 'bg-primary text-primary-foreground font-medium' : 'text-muted-foreground'
              }`}
            >
              Összes státusz
            </button>
            <button
              onClick={() => setPaymentFilter('PAID')}
              className={`px-2.5 py-1 rounded-md transition-colors ${
                paymentFilter === 'PAID' ? 'bg-emerald-600 text-white font-medium' : 'text-muted-foreground'
              }`}
            >
              Megfizetve
            </button>
            <button
              onClick={() => setPaymentFilter('PENDING')}
              className={`px-2.5 py-1 rounded-md transition-colors ${
                paymentFilter === 'PENDING' ? 'bg-amber-600 text-white font-medium' : 'text-muted-foreground'
              }`}
            >
              Fizetésre vár
            </button>
          </div>
        </div>
      </div>

      {/* Vámhatározatok Táblázata */}
      <Card className="overflow-hidden border">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50 hover:bg-muted/50">
                <TableHead className="w-[180px] text-xs font-semibold">Határozatszám & Dátum</TableHead>
                <TableHead className="text-xs font-semibold">Eljárás & ÁFA Kód</TableHead>
                <TableHead className="text-xs font-semibold">Külföldi Szállító</TableHead>
                <TableHead className="text-right text-xs font-semibold">Vámérték HUF</TableHead>
                <TableHead className="text-right text-xs font-semibold">Kiszabott Vám</TableHead>
                <TableHead className="text-right text-xs font-semibold">Import ÁFA Alap</TableHead>
                <TableHead className="text-right text-xs font-semibold">ÁFA Összeg</TableHead>
                <TableHead className="text-center text-xs font-semibold">2665 Sor & Megfizetettség</TableHead>
                <TableHead className="w-[80px] text-right text-xs font-semibold">Műveletek</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredDeclarations.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="h-44 text-center">
                    <div className="flex flex-col items-center justify-center text-muted-foreground">
                      <PackageCheck className="w-10 h-10 stroke-[1.2] mb-2 text-muted-foreground/60" />
                      <p className="text-sm font-medium text-foreground">Nem található vámhatározat</p>
                      <p className="text-xs text-muted-foreground mt-0.5 max-w-sm">
                        Még nem rögzítettél harmadik országból származó import vámhatározatot az adott szűrési feltételekkel.
                      </p>
                      <Button
                        size="sm"
                        onClick={handleOpenNew}
                        variant="outline"
                        className="mt-3 text-xs gap-1.5"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Első Vámhatározat Rögzítése
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                filteredDeclarations.map((d) => (
                  <TableRow key={d.id} className="hover:bg-muted/30">
                    {/* Határozatszám & Dátum */}
                    <TableCell>
                      <div className="font-mono font-medium text-xs text-foreground">
                        {d.declaration_number}
                      </div>
                      <div className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5">
                        <Calendar className="w-3 h-3" />
                        {d.decision_date}
                      </div>
                    </TableCell>

                    {/* Eljárás & ÁFA Kód */}
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        {d.procedure_type === 'LEVY' ? (
                          <Badge variant="outline" className="text-[10px] bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-500/30">
                            Kivetés (154. §)
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px] bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/30">
                            Önadózás (155. §)
                          </Badge>
                        )}
                        <Badge variant="secondary" className="font-mono text-[10px]">
                          {d.vat_code}
                        </Badge>
                      </div>
                    </TableCell>

                    {/* Külföldi Szállító */}
                    <TableCell>
                      <div className="text-xs font-medium text-foreground">
                        {d.foreign_supplier_name || 'Ismeretlen partner'}
                      </div>
                      <div className="text-[11px] text-muted-foreground font-mono">
                        {d.foreign_invoice_amount > 0 ? (
                          <>
                            {d.foreign_invoice_amount.toLocaleString('hu-HU')} {d.foreign_currency} @ {d.customs_exchange_rate}
                          </>
                        ) : (
                          '-'
                        )}
                      </div>
                    </TableCell>

                    {/* Vámérték HUF */}
                    <TableCell className="text-right font-mono text-xs">
                      {formatCurrency(d.customs_value_huf)}
                    </TableCell>

                    {/* Kiszabott Vám */}
                    <TableCell className="text-right font-mono text-xs text-muted-foreground">
                      {formatCurrency(d.customs_duty_huf)}
                    </TableCell>

                    {/* Import ÁFA Alap */}
                    <TableCell className="text-right font-mono text-xs font-medium">
                      {formatCurrency(d.vat_base_huf)}
                    </TableCell>

                    {/* ÁFA Összeg */}
                    <TableCell className="text-right font-mono text-xs font-bold text-foreground">
                      {formatCurrency(d.vat_amount_huf)}
                    </TableCell>

                    {/* 2665 Sor & Megfizetettség */}
                    <TableCell className="text-center">
                      {d.procedure_type === 'LEVY' ? (
                        d.payment_status === 'PAID' ? (
                          <div className="flex flex-col items-center gap-0.5">
                            <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 text-[10px]">
                              <CheckCircle2 className="w-3 h-3 mr-1" />
                              Megfizetve (70. sor)
                            </Badge>
                            <span className="text-[10px] text-muted-foreground">
                              {d.payment_date}
                            </span>
                          </div>
                        ) : (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => markAsPaidMutation.mutate(d.id)}
                            className="h-6 text-[10px] text-amber-600 hover:text-amber-700 hover:bg-amber-500/10 px-2 rounded-full border border-amber-500/30"
                          >
                            <Clock className="w-3 h-3 mr-1" />
                            Megfizetés jelölése
                          </Button>
                        )
                      ) : (
                        <Badge className="bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border-indigo-500/30 text-[10px]">
                          26. & 71. sorban önadózva
                        </Badge>
                      )}
                    </TableCell>

                    {/* Műveletek */}
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="text-xs">
                          <DropdownMenuItem onClick={() => handleEdit(d)} className="gap-2">
                            <Edit2 className="w-3.5 h-3.5" />
                            Szerkesztés
                          </DropdownMenuItem>

                          <DropdownMenuItem
                            onClick={async () => {
                              const res = await postImportDeclarationToGeneralLedger(d);
                              if (res.success) {
                                toast({
                                  title: 'Főkönyvi tételek legenerálva',
                                  description: `${res.entriesCount} tétel könyvelve a vegyes naplóba (VAM-${d.declaration_number})`,
                                });
                              } else {
                                toast({
                                  title: 'Könyvelési hiba',
                                  description: res.error,
                                  variant: 'destructive',
                                });
                              }
                            }}
                            className="gap-2 text-indigo-600"
                          >
                            <BookOpen className="w-3.5 h-3.5" />
                            Vegyes naplóba könyvelés
                          </DropdownMenuItem>

                          <DropdownMenuItem
                            onClick={() => {
                              if (confirm(`Biztosan törölni szeretnéd a(z) ${d.declaration_number} számú határozatot?`)) {
                                deleteMutation.mutate(d.id);
                              }
                            }}
                            className="gap-2 text-destructive focus:text-destructive"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            Törlés
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* Jogszabályi Útmutató Doboz */}
      <Card className="border-indigo-500/20 bg-indigo-500/5">
        <CardContent className="p-4 space-y-2">
          <div className="flex items-center gap-2 text-xs font-semibold text-indigo-700 dark:text-indigo-300">
            <Info className="w-4 h-4" />
            <span>Harmadik országbeli termékimport könyvelési és áfa-szabályai:</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-[11px] text-muted-foreground leading-relaxed pt-1">
            <div className="p-2.5 rounded-lg border bg-background/50 space-y-1">
              <span className="font-semibold text-foreground">Bizonylat & M-lap védelem:</span>
              <p>
                Az importáfa hivatalos adóügyi bizonylata KIZÁRÓLAG a vámhatározat. A külföldi számla áfát nem tartalmaz, és <strong>nem kerülhet az M-lapra</strong> (belföldi összesítő jelentés).
              </p>
            </div>
            <div className="p-2.5 rounded-lg border bg-background/50 space-y-1">
              <span className="font-semibold text-foreground">Megfizetéshez kötött levonás:</span>
              <p>
                Kivetés esetén (Áfa tv. 120. § c) & 154. §) az importáfa <strong>csak a vámhatóságnak történő tényleges befizetés havában</strong> vonható le a 70. sorban. Addig átmeneti elszámolásban marad.
              </p>
            </div>
            <div className="p-2.5 rounded-lg border bg-background/50 space-y-1">
              <span className="font-semibold text-foreground">Bekerülési érték & Vám:</span>
              <p>
                A kiszabott vám és a le nem vonható áfa a készlet/eszköz bekerülési értékét növeli (T 261 / K 465). Az importáfaalapba épülő járulékos szolgáltatások (fuvar) mentesek az Áfa tv. 93. § (2) szerint.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Rögzítő & Szerkesztő Dialog */}
      <ImportCustomsDeclarationDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        declarationToEdit={selectedDeclaration}
        companyId={companyId}
        defaultPeriodDate={dateFrom}
        onSave={handleSave}
      />
    </div>
  );
}
