import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  ShieldCheck,
  AlertTriangle,
  Search,
  Filter,
  CheckCircle2,
  AlertCircle,
  Clock,
  Layers,
  FileSpreadsheet,
  ArrowDownLeft,
  ArrowUpRight,
  ExternalLink,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn, formatCurrency } from '@/lib/utils';
import type { VatFrequency } from '../types';

export interface ThreeWayReconciliationRow {
  id: string;
  invoice_number: string;
  direction: 'INBOUND' | 'OUTBOUND';
  partner_name: string;
  partner_tax_number: string;
  delivery_date_nav: string | null;
  delivery_date_local: string | null;
  net_amount_nav: number;
  vat_amount_nav: number;
  gross_amount_nav: number;
  net_amount_local: number;
  vat_amount_local: number;
  gross_amount_local: number;
  gl_debit_amount: number;
  gl_credit_amount: number;
  gl_account_numbers: string[];
  status: 'MATCH' | 'DIFF' | 'MISSING_FROM_LOCAL' | 'MISSING_FROM_NAV';
  anomaly_types: string[];
  anomaly_count: number;
  diff_summary: string;
}

interface VatOsaThreeWayReconciliationProps {
  companyId?: string;
  selectedCompany?: any;
  year: number;
  month: number;
  frequency: VatFrequency;
  className?: string;
}

export function VatOsaThreeWayReconciliation({
  companyId: companyIdProp,
  selectedCompany,
  year,
  month,
  frequency,
  className,
}: VatOsaThreeWayReconciliationProps) {
  const companyId = companyIdProp || selectedCompany?.id;
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'DIFF_ONLY' | 'MATCH' | 'MISSING' | 'STORNO'>('ALL');
  const [directionFilter, setDirectionFilter] = useState<'ALL' | 'INBOUND' | 'OUTBOUND'>('ALL');

  // Compute date range
  const { dateFrom, dateTo, periodLabel } = useMemo(() => {
    if (frequency === 'H') {
      const from = `${year}-${String(month).padStart(2, '0')}-01`;
      const lastDay = new Date(year, month, 0).getDate();
      const to = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
      return { dateFrom: from, dateTo: to, periodLabel: `${year}. ${String(month).padStart(2, '0')}. hónap` };
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

  // Fetch 3-way reconciliation data via RPC
  const { data: rows = [], isLoading, isFetching, refetch } = useQuery({
    queryKey: ['vat_osa_three_way_reconciliation', companyId, dateFrom, dateTo],
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as any)('get_vat_osa_three_way_reconciliation', {
        p_company_id: companyId,
        p_date_from: dateFrom,
        p_date_to: dateTo,
      });

      if (error) {
        console.error('Error fetching 3-way reconciliation:', error);
        throw error;
      }
      return (data || []) as ThreeWayReconciliationRow[];
    },
    enabled: Boolean(companyId),
    staleTime: 60_000,
  });

  // Filtered rows
  const filteredRows = useMemo(() => {
    return rows.filter(r => {
      if (directionFilter !== 'ALL' && r.direction !== directionFilter) return false;

      if (statusFilter === 'MATCH' && r.status !== 'MATCH') return false;
      if (statusFilter === 'DIFF_ONLY' && r.status === 'MATCH') return false;
      if (statusFilter === 'MISSING' && !r.status.startsWith('MISSING_')) return false;
      if (statusFilter === 'STORNO' && !r.anomaly_types.includes('STORNO_ASYNC')) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matches =
          (r.partner_name || '').toLowerCase().includes(q) ||
          (r.partner_tax_number || '').toLowerCase().includes(q) ||
          (r.invoice_number || '').toLowerCase().includes(q) ||
          (r.diff_summary || '').toLowerCase().includes(q);
        if (!matches) return false;
      }
      return true;
    });
  }, [rows, directionFilter, statusFilter, searchQuery]);

  // Aggregated KPI Metrics
  const metrics = useMemo(() => {
    let totalCount = rows.length;
    let matchCount = 0;
    let missingCount = 0;
    let amountDiffCount = 0;
    let dateShiftCount = 0;
    let stornoCount = 0;

    rows.forEach(r => {
      if (r.status === 'MATCH') matchCount += 1;
      if (r.status.startsWith('MISSING_') || r.anomaly_types.includes('MISSING_INVOICE')) missingCount += 1;
      if (r.anomaly_types.includes('AMOUNT_MISMATCH') || r.anomaly_types.includes('TAX_RATE_MISMATCH')) amountDiffCount += 1;
      if (r.anomaly_types.includes('DATE_SHIFT')) dateShiftCount += 1;
      if (r.anomaly_types.includes('STORNO_ASYNC')) stornoCount += 1;
    });

    return {
      totalCount,
      matchCount,
      missingCount,
      amountDiffCount,
      dateShiftCount,
      stornoCount,
      diffCount: totalCount - matchCount,
    };
  }, [rows]);

  return (
    <div className={cn('space-y-4', className)}>
      {/* 1. Header & KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <Card className="p-3 shadow-2xs border-border/70">
          <div className="text-[11px] font-medium text-muted-foreground">Összes tétel</div>
          <div className="text-xl font-bold mt-0.5">{metrics.totalCount} db</div>
          <div className="text-[10px] text-muted-foreground mt-0.5">{periodLabel}</div>
        </Card>

        <Card className="p-3 shadow-2xs border-emerald-200 dark:border-emerald-900 bg-emerald-500/5">
          <div className="text-[11px] font-medium text-emerald-700 dark:text-emerald-300 flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            <span>3-oldalú egyezés</span>
          </div>
          <div className="text-xl font-bold text-emerald-700 dark:text-emerald-300 mt-0.5">
            {metrics.matchCount} db
          </div>
          <div className="text-[10px] text-emerald-600/80 mt-0.5">
            {metrics.totalCount > 0 ? `${Math.round((metrics.matchCount / metrics.totalCount) * 100)}%` : '0%'}
          </div>
        </Card>

        <Card className={cn('p-3 shadow-2xs', metrics.missingCount > 0 && 'border-rose-300 dark:border-rose-900 bg-rose-500/5')}>
          <div className="text-[11px] font-medium text-rose-700 dark:text-rose-300 flex items-center gap-1">
            <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
            <span>Hiányzó számla</span>
          </div>
          <div className="text-xl font-bold text-rose-700 dark:text-rose-300 mt-0.5">
            {metrics.missingCount} db
          </div>
          <div className="text-[10px] text-muted-foreground mt-0.5">NAV vagy Helyi</div>
        </Card>

        <Card className={cn('p-3 shadow-2xs', metrics.amountDiffCount > 0 && 'border-amber-300 dark:border-amber-900 bg-amber-500/5')}>
          <div className="text-[11px] font-medium text-amber-700 dark:text-amber-300 flex items-center gap-1">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
            <span>Összeg / Kulcs eltérés</span>
          </div>
          <div className="text-xl font-bold text-amber-700 dark:text-amber-300 mt-0.5">
            {metrics.amountDiffCount} db
          </div>
          <div className="text-[10px] text-muted-foreground mt-0.5">Kerekítés / Áfakód</div>
        </Card>

        <Card className="p-3 shadow-2xs">
          <div className="text-[11px] font-medium text-blue-700 dark:text-blue-300 flex items-center gap-1">
            <Clock className="w-3.5 h-3.5 text-blue-600" />
            <span>Dátumcsúszás</span>
          </div>
          <div className="text-xl font-bold text-blue-700 dark:text-blue-300 mt-0.5">
            {metrics.dateShiftCount} db
          </div>
          <div className="text-[10px] text-muted-foreground mt-0.5">Teljesítés vs Iktatás</div>
        </Card>

        <Card className={cn('p-3 shadow-2xs', metrics.stornoCount > 0 && 'border-orange-300 dark:border-orange-900 bg-orange-500/5')}>
          <div className="text-[11px] font-medium text-orange-700 dark:text-orange-300 flex items-center gap-1">
            <Layers className="w-3.5 h-3.5 text-orange-600" />
            <span>Stornó aszinkronitás</span>
          </div>
          <div className="text-xl font-bold text-orange-700 dark:text-orange-300 mt-0.5">
            {metrics.stornoCount} db
          </div>
          <div className="text-[10px] text-muted-foreground mt-0.5">NAV vs Főkönyv</div>
        </Card>
      </div>

      {/* 2. Filter & Toolbar Bar */}
      <Card className="shadow-2xs border-border/80">
        <CardContent className="p-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[300px]">
              <div className="relative flex-1 max-w-sm">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Keresés partnerre, adószámra, számlaszámra..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="h-8 pl-8 text-xs bg-background"
                />
              </div>

              {/* Status Filter */}
              <Select value={statusFilter} onValueChange={(val: any) => setStatusFilter(val)}>
                <SelectTrigger className="h-8 text-xs w-[170px] bg-background">
                  <SelectValue placeholder="Szűrés státuszra" />
                </SelectTrigger>
                <SelectContent className="text-xs">
                  <SelectItem value="ALL">Minden tétel ({rows.length})</SelectItem>
                  <SelectItem value="DIFF_ONLY">Csak eltérések ({metrics.diffCount})</SelectItem>
                  <SelectItem value="MATCH">Csak egyezők ({metrics.matchCount})</SelectItem>
                  <SelectItem value="MISSING">Hiányzó számlák ({metrics.missingCount})</SelectItem>
                  <SelectItem value="STORNO">Stornó aszinkronitások ({metrics.stornoCount})</SelectItem>
                </SelectContent>
              </Select>

              {/* Direction Filter */}
              <Select value={directionFilter} onValueChange={(val: any) => setDirectionFilter(val)}>
                <SelectTrigger className="h-8 text-xs w-[140px] bg-background">
                  <SelectValue placeholder="Irány" />
                </SelectTrigger>
                <SelectContent className="text-xs">
                  <SelectItem value="ALL">Bejövő & Kimenő</SelectItem>
                  <SelectItem value="INBOUND">Csak Bejövő (Szállítói)</SelectItem>
                  <SelectItem value="OUTBOUND">Csak Kimenő (Vevői)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              disabled={isFetching}
              className="h-8 text-xs gap-1.5"
            >
              <RefreshCw className={cn('w-3.5 h-3.5', isFetching && 'animate-spin')} />
              <span>Frissítés</span>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 3. Three-Way Reconciliation Table */}
      <Card className="shadow-2xs border-border/80 overflow-hidden">
        <CardHeader className="py-3 px-4 bg-muted/30 border-b border-border/60">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span>NAV OSA ↔ Tételes ÁFA-analitika ↔ Főkönyvi Karton (466/467)</span>
              </CardTitle>
              <CardDescription className="text-xs">
                Háromoldalú számlaszintű keresztellenőrzés a könyvvizsgálati és NAV adóellenőrzési kockázatok kizárására.
              </CardDescription>
            </div>
            <span className="text-xs text-muted-foreground font-mono">
              {filteredRows.length} / {rows.length} tétel
            </span>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center p-12 text-muted-foreground text-xs gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-primary" />
              <span>3-oldalú adatok egyeztetése és differencia-számítás folyamatban...</span>
            </div>
          ) : filteredRows.length === 0 ? (
            <div className="text-center p-12 text-muted-foreground text-xs">
              Nincs a szűrésnek megfelelő tétel a kiválasztott időszakban.
            </div>
          ) : (
            <div className="overflow-x-auto max-h-[600px] scrollbar-thin">
              <Table className="text-xs">
                <TableHeader className="bg-muted/50 sticky top-0 z-10 text-[11px]">
                  <TableRow>
                    <TableHead className="w-[180px]">Bizonylat & Partner</TableHead>
                    <TableHead className="w-[90px]">Irány</TableHead>
                    <TableHead className="text-right w-[150px]">1. NAV OSA Adat</TableHead>
                    <TableHead className="text-right w-[150px]">2. Számlatár (Helyi)</TableHead>
                    <TableHead className="text-right w-[150px]">3. Főkönyv (466/467)</TableHead>
                    <TableHead className="w-[180px]">Eltérés & Státusz</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRows.map(r => {
                    const isMatch = r.status === 'MATCH';
                    const isMissing = r.status.startsWith('MISSING_');
                    const isDiff = r.status === 'DIFF';

                    return (
                      <TableRow
                        key={r.id}
                        className={cn(
                          'hover:bg-muted/40 transition-colors',
                          isMissing && 'bg-rose-500/5',
                          isDiff && 'bg-amber-500/5'
                        )}
                      >
                        {/* Bizonylat & Partner */}
                        <TableCell className="font-medium py-2">
                          <div className="flex flex-col">
                            <span className="font-mono font-semibold text-foreground">
                              {r.invoice_number}
                            </span>
                            <span className="text-[11px] text-muted-foreground truncate max-w-[170px]" title={r.partner_name}>
                              {r.partner_name}
                            </span>
                            <span className="text-[10px] text-muted-foreground/80 font-mono">
                              {r.partner_tax_number || 'Nincs adószám'}
                            </span>
                          </div>
                        </TableCell>

                        {/* Irány */}
                        <TableCell className="py-2">
                          {r.direction === 'OUTBOUND' ? (
                            <Badge variant="outline" className="bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-200 text-[10px] py-0 px-1.5 gap-1">
                              <ArrowUpRight className="w-3 h-3 text-blue-600" />
                              <span>Kimenő</span>
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-200 text-[10px] py-0 px-1.5 gap-1">
                              <ArrowDownLeft className="w-3 h-3 text-emerald-600" />
                              <span>Bejövő</span>
                            </Badge>
                          )}
                        </TableCell>

                        {/* 1. NAV OSA Adat */}
                        <TableCell className="text-right py-2 font-mono">
                          {r.delivery_date_nav ? (
                            <div className="flex flex-col">
                              <span className="text-foreground font-semibold">
                                {formatCurrency(r.net_amount_nav)}
                              </span>
                              <span className="text-[11px] text-muted-foreground">
                                ÁFA: {formatCurrency(r.vat_amount_nav)}
                              </span>
                              <span className="text-[10px] text-muted-foreground/70">
                                {r.delivery_date_nav}
                              </span>
                            </div>
                          ) : (
                            <span className="text-rose-600 font-semibold italic text-[11px]">
                              Hiányzik a NAV-ból
                            </span>
                          )}
                        </TableCell>

                        {/* 2. Számlatár (Helyi) */}
                        <TableCell className="text-right py-2 font-mono">
                          {r.delivery_date_local ? (
                            <div className="flex flex-col">
                              <span className="text-foreground font-semibold">
                                {formatCurrency(r.net_amount_local)}
                              </span>
                              <span className="text-[11px] text-muted-foreground">
                                ÁFA: {formatCurrency(r.vat_amount_local)}
                              </span>
                              <span className="text-[10px] text-muted-foreground/70">
                                {r.delivery_date_local}
                              </span>
                            </div>
                          ) : (
                            <span className="text-rose-600 font-semibold italic text-[11px]">
                              Nincs iktatva helyben
                            </span>
                          )}
                        </TableCell>

                        {/* 3. Főkönyv (466/467) */}
                        <TableCell className="text-right py-2 font-mono">
                          {r.gl_debit_amount > 0 || r.gl_credit_amount > 0 ? (
                            <div className="flex flex-col">
                              <span className="text-foreground font-semibold">
                                T: {formatCurrency(r.gl_debit_amount)}
                              </span>
                              <span className="text-[11px] text-muted-foreground">
                                K: {formatCurrency(r.gl_credit_amount)}
                              </span>
                              <span className="text-[10px] text-primary truncate max-w-[140px]" title={r.gl_account_numbers?.join(', ')}>
                                {r.gl_account_numbers?.join(', ') || '466/467'}
                              </span>
                            </div>
                          ) : (
                            <span className="text-muted-foreground italic text-[11px]">
                              0 Ft (Nincs FK tétel)
                            </span>
                          )}
                        </TableCell>

                        {/* Státusz & Anomáliák */}
                        <TableCell className="py-2">
                          <div className="flex flex-col gap-1 items-start">
                            {isMatch ? (
                              <Badge variant="outline" className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-300 text-[10px] py-0 px-1.5 gap-1">
                                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                <span>Egyező</span>
                              </Badge>
                            ) : isMissing ? (
                              <Badge variant="outline" className="bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-300 text-[10px] py-0 px-1.5 gap-1">
                                <AlertCircle className="w-3 h-3 text-rose-600" />
                                <span>{r.status === 'MISSING_FROM_LOCAL' ? 'Számlatárban hiányzik' : 'NAV-ban hiányzik'}</span>
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-300 text-[10px] py-0 px-1.5 gap-1">
                                <AlertTriangle className="w-3 h-3 text-amber-600" />
                                <span>Eltérés</span>
                              </Badge>
                            )}

                            <span className="text-[11px] text-muted-foreground leading-tight">
                              {r.diff_summary}
                            </span>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
