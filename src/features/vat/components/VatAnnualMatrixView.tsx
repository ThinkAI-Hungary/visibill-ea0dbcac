import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  CalendarRange,
  FileSpreadsheet,
  Download,
  Loader2,
  TrendingUp,
  TrendingDown,
  RefreshCw,
} from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { cn, formatCurrency, isReverseChargeVatRate } from '@/lib/utils';
import { MONTHS, formatThousands, VatScope, isProformaInvoice } from '../types';

import { useToast } from '@/hooks/use-toast';

interface VatAnnualMatrixViewProps {
  companyId: string;
  year: number;
  onYearChange: (year: number) => void;
  selectedCompany?: any;
  vatScope?: VatScope;
}

interface MonthData {
  payable27Base: number;
  payable27Tax: number;
  payable18Base: number;
  payable18Tax: number;
  payable5Base: number;
  payable5Tax: number;
  payableFadBase: number;
  payableFadTax: number;
  payableMentesBase: number;

  deductible27Base: number;
  deductible27Tax: number;
  deductible18Base: number;
  deductible18Tax: number;
  deductible5Base: number;
  deductible5Tax: number;
  deductibleFadBase: number;
  deductibleFadTax: number;
  deductibleMentesBase: number;
}

export function VatAnnualMatrixView({
  companyId,
  year,
  onYearChange,
  selectedCompany,
  vatScope,
}: VatAnnualMatrixViewProps) {
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const effectiveScope: VatScope = vatScope || (searchParams.get('vat_scope') as VatScope) || 'all';

  const [showBase, setShowBase] = useState(true);
  const [showTax, setShowTax] = useState(true);
  const [showEmptyRows, setShowEmptyRows] = useState(false);
  const [isRecalculating, setIsRecalculating] = useState(false);

  // Query invoices across the entire year from nav_invoices and invoices
  const { data: rawMatrix, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['vat_annual_matrix', companyId, year, effectiveScope],
    queryFn: async () => {
      if (!companyId) return null;

      const dateFrom = `${year}-01-01`;
      const dateTo = `${year}-12-31`;

      const [navInvsRes, subInvsRes] = await Promise.all([
        supabase
          .from('nav_invoices')
          .select('id, invoice_number, invoice_delivery_date, invoice_issue_date, invoice_net_amount, invoice_vat_amount, invoice_direction, is_reverse_charge, vat_row_override')
          .eq('company_id', companyId)
          .or(`invoice_delivery_date.gte.${dateFrom},and(invoice_delivery_date.is.null,invoice_issue_date.gte.${dateFrom})`)
          .or(`invoice_delivery_date.lte.${dateTo},and(invoice_delivery_date.is.null,invoice_issue_date.lte.${dateTo})`)
          .limit(10000),
        supabase
          .from('invoices')
          .select('id, bizonylatsorszam, teljesites_datuma, kibocsatas_datuma, adoalap_osszesen, afa_osszeg_osszesen, invoice_direction, forditott_adozas, vat_row_override, image_url, melleklet_url, invoice_uploads_id, attachments, invoice_type')
          .eq('company_id', companyId)
          .not('invoice_type', 'in', '("dijbekero_proforma","dijbekero","proforma","garanciajegy")')
          .or(`teljesites_datuma.gte.${dateFrom},and(teljesites_datuma.is.null,kibocsatas_datuma.gte.${dateFrom})`)
          .or(`teljesites_datuma.lte.${dateTo},and(teljesites_datuma.is.null,kibocsatas_datuma.lte.${dateTo})`)
          .limit(10000),
      ]);

      if (navInvsRes.error) {
        console.warn('Error fetching nav_invoices for annual VAT matrix:', navInvsRes.error);
      }
      if (subInvsRes.error) {
        console.warn('Error fetching invoices for annual VAT matrix:', subInvsRes.error);
      }

      const navInvs = navInvsRes.data || [];
      const subInvs = (subInvsRes.data || []).filter((s) => !isProformaInvoice(s));

      // Helper to normalize invoice numbers
      const normalizeInvNum = (s?: string | null) => (s || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase();

      // Check whether submitted invoice has an uploaded image/document
      const hasImg = (s: any) => Boolean(
        s.image_url ||
        s.melleklet_url ||
        s.invoice_uploads_id ||
        (Array.isArray(s.attachments) && s.attachments.length > 0)
      );

      // Build map of submitted invoices with actual images
      const subWithImageByNum = new Map<string, boolean>();
      subInvs.forEach((s) => {
        if (s.bizonylatsorszam && hasImg(s)) {
          subWithImageByNum.set(normalizeInvNum(s.bizonylatsorszam), true);
        }
      });

      // Deduplicate manual invoices already present in nav_invoices
      const existingNavNumbers = new Set(navInvs.map((i) => normalizeInvNum(i.invoice_number)).filter(Boolean));
      const standaloneSubInvs = subInvs.filter((i) => !isProformaInvoice(i) && !existingNavNumbers.has(normalizeInvNum(i.bizonylatsorszam)));

      // 12 months array
      const months: MonthData[] = Array.from({ length: 12 }, () => ({
        payable27Base: 0,
        payable27Tax: 0,
        payable18Base: 0,
        payable18Tax: 0,
        payable5Base: 0,
        payable5Tax: 0,
        payableFadBase: 0,
        payableFadTax: 0,
        payableMentesBase: 0,

        deductible27Base: 0,
        deductible27Tax: 0,
        deductible18Base: 0,
        deductible18Tax: 0,
        deductible5Base: 0,
        deductible5Tax: 0,
        deductibleFadBase: 0,
        deductibleFadTax: 0,
        deductibleMentesBase: 0,
      }));

      // Process NAV invoices
      navInvs.forEach((inv) => {
        const isOutbound = inv.invoice_direction === 'OUTBOUND';
        if (!isOutbound && effectiveScope === 'with_image') {
          const invNum = normalizeInvNum(inv.invoice_number);
          if (!subWithImageByNum.has(invNum)) {
            return; // Inbound invoice without image skipped in with_image scope
          }
        }

        const d = inv.invoice_delivery_date || inv.invoice_issue_date;
        if (!d) return;
        const mIdx = new Date(d).getMonth();
        if (mIdx < 0 || mIdx > 11) return;

        const base = Math.round(Number(inv.invoice_net_amount) || 0);
        const tax = Math.round(Number(inv.invoice_vat_amount) || 0);
        const isFad =
          Boolean(inv.is_reverse_charge) ||
          inv.vat_row_override === '29' ||
          inv.vat_row_override === '04' ||
          isReverseChargeVatRate((inv as any).vat_rate);

        const target = months[mIdx];
        if (isFad) {
          if (isOutbound) {
            target.payableFadBase += base;
            target.payableFadTax += 0;
          } else {
            const fadTax = tax > 0 ? tax : Math.round(base * 0.27);
            target.payableFadBase += base;
            target.payableFadTax += fadTax;
            target.deductibleFadBase += base;
            target.deductibleFadTax += fadTax;
          }
        } else {
          const rate = base > 0 && tax > 0 ? Math.round((tax / base) * 100) : (tax > 0 ? 27 : 0);
          if (isOutbound) {
            if (rate >= 24) {
              target.payable27Base += base;
              target.payable27Tax += tax;
            } else if (rate >= 14) {
              target.payable18Base += base;
              target.payable18Tax += tax;
            } else if (rate >= 4) {
              target.payable5Base += base;
              target.payable5Tax += tax;
            } else {
              target.payableMentesBase += base;
            }
          } else {
            if (rate >= 24) {
              target.deductible27Base += base;
              target.deductible27Tax += tax;
            } else if (rate >= 14) {
              target.deductible18Base += base;
              target.deductible18Tax += tax;
            } else if (rate >= 4) {
              target.deductible5Base += base;
              target.deductible5Tax += tax;
            } else {
              target.deductibleMentesBase += base;
            }
          }
        }
      });

      // Process standalone submitted invoices
      standaloneSubInvs.forEach((inv) => {
        const isOutbound = inv.invoice_direction === 'OUTBOUND';
        if (!isOutbound && effectiveScope === 'with_image') {
          if (!hasImg(inv)) {
            return; // Standalone inbound invoice without image skipped in with_image scope
          }
        }

        const d = inv.teljesites_datuma || inv.kibocsatas_datuma;
        if (!d) return;
        const mIdx = new Date(d).getMonth();
        if (mIdx < 0 || mIdx > 11) return;

        const base = Math.round(Number(inv.adoalap_osszesen) || 0);
        const tax = Math.round(Number(inv.afa_osszeg_osszesen) || 0);
        const isFad =
          Boolean(inv.forditott_adozas) ||
          inv.vat_row_override === '29' ||
          inv.vat_row_override === '04' ||
          isReverseChargeVatRate((inv as any).vat_rate);

        const target = months[mIdx];
        if (isFad) {
          if (isOutbound) {
            target.payableFadBase += base;
            target.payableFadTax += 0;
          } else {
            const fadTax = tax > 0 ? tax : Math.round(base * 0.27);
            target.payableFadBase += base;
            target.payableFadTax += fadTax;
            target.deductibleFadBase += base;
            target.deductibleFadTax += fadTax;
          }
        } else {
          const rate = base > 0 && tax > 0 ? Math.round((tax / base) * 100) : (tax > 0 ? 27 : 0);
          if (isOutbound) {
            if (rate >= 24) {
              target.payable27Base += base;
              target.payable27Tax += tax;
            } else if (rate >= 14) {
              target.payable18Base += base;
              target.payable18Tax += tax;
            } else if (rate >= 4) {
              target.payable5Base += base;
              target.payable5Tax += tax;
            } else {
              target.payableMentesBase += base;
            }
          } else {
            if (rate >= 24) {
              target.deductible27Base += base;
              target.deductible27Tax += tax;
            } else if (rate >= 14) {
              target.deductible18Base += base;
              target.deductible18Tax += tax;
            } else if (rate >= 4) {
              target.deductible5Base += base;
              target.deductible5Tax += tax;
            } else {
              target.deductibleMentesBase += base;
            }
          }
        }
      });

      return months;
    },
    enabled: !!companyId,
    staleTime: 1000 * 60 * 5,
  });

  const handleRecalculate = async () => {
    try {
      setIsRecalculating(true);
      await refetch();
      toast({
        title: 'Éves mátrix újraszámítva',
        description: `${year}. évi számlák és ÁFA adatok sikeresen frissítve.`,
      });
    } catch (err: any) {
      toast({
        title: 'Hiba az újraszámítás során',
        description: err.message,
        variant: 'destructive',
      });
    } finally {
      setIsRecalculating(false);
    }
  };

  const monthsData = useMemo(() => {
    return rawMatrix || Array.from({ length: 12 }, () => ({
      payable27Base: 0,
      payable27Tax: 0,
      payable18Base: 0,
      payable18Tax: 0,
      payable5Base: 0,
      payable5Tax: 0,
      payableFadBase: 0,
      payableFadTax: 0,
      payableMentesBase: 0,

      deductible27Base: 0,
      deductible27Tax: 0,
      deductible18Base: 0,
      deductible18Tax: 0,
      deductible5Base: 0,
      deductible5Tax: 0,
      deductibleFadBase: 0,
      deductibleFadTax: 0,
      deductibleMentesBase: 0,
    }));
  }, [rawMatrix]);

  // Compute total row sums for each metric
  const calculateRowTotal = (getter: (m: MonthData) => number) => {
    return monthsData.reduce((sum, m) => sum + getter(m), 0);
  };

  // Section 1: Payable (Fizetendő)
  const payableTotalBase = (m: MonthData) =>
    m.payable27Base + m.payable18Base + m.payable5Base + m.payableFadBase + m.payableMentesBase;
  const payableTotalTax = (m: MonthData) =>
    m.payable27Tax + m.payable18Tax + m.payable5Tax + m.payableFadTax;

  // Section 2: Deductible (Visszaigényelhető)
  const deductibleTotalBase = (m: MonthData) =>
    m.deductible27Base + m.deductible18Base + m.deductible5Base + m.deductibleFadBase + m.deductibleMentesBase;
  const deductibleTotalTax = (m: MonthData) =>
    m.deductible27Tax + m.deductible18Tax + m.deductible5Tax + m.deductibleFadTax;

  // Section 3: Net Balance (Fizetendő - Visszaigényelhető)
  const balanceTotalTax = (m: MonthData) => payableTotalTax(m) - deductibleTotalTax(m);
  const balanceTotalBase = (m: MonthData) => payableTotalBase(m) - deductibleTotalBase(m);

  // Year overall totals
  const annualTotalPayableTax = calculateRowTotal(payableTotalTax);
  const annualTotalDeductibleTax = calculateRowTotal(deductibleTotalTax);
  const annualNetBalanceTax = annualTotalPayableTax - annualTotalDeductibleTax;

  // CSV Export
  const handleExportCsv = () => {
    const monthNames = [
      'Január', 'Február', 'Március', 'Április', 'Május', 'Június',
      'Július', 'Augusztus', 'Szeptember', 'Október', 'November', 'December',
    ];

    const headers = ['Kategória', ...monthNames, 'ÖSSZESEN'];

    const formatRow = (label: string, getter: (m: MonthData) => number) => {
      const vals = monthsData.map(getter);
      const sum = vals.reduce((a, b) => a + b, 0);
      return [`"${label}"`, ...vals, sum];
    };

    const rows = [
      ['--- FIZETENDŐ ÁFA ---', ...Array(13).fill('')],
      ...(showBase ? [formatRow('27%-os alap', (m) => m.payable27Base)] : []),
      ...(showTax ? [formatRow('27%-os ÁFA', (m) => m.payable27Tax)] : []),
      ...(showBase ? [formatRow('18%-os alap', (m) => m.payable18Base)] : []),
      ...(showTax ? [formatRow('18%-os ÁFA', (m) => m.payable18Tax)] : []),
      ...(showBase ? [formatRow('5%-os alap', (m) => m.payable5Base)] : []),
      ...(showTax ? [formatRow('5%-os ÁFA', (m) => m.payable5Tax)] : []),
      ...(showBase ? [formatRow('Fordított (FAD) alap', (m) => m.payableFadBase)] : []),
      ...(showTax ? [formatRow('Fordított (FAD) ÁFA', (m) => m.payableFadTax)] : []),
      ...(showBase ? [formatRow('Mentes alap', (m) => m.payableMentesBase)] : []),
      ...(showBase ? [formatRow('ÖSSZESEN ALAP (Fizetendő)', payableTotalBase)] : []),
      ...(showTax ? [formatRow('ÖSSZESEN ÁFA (Fizetendő)', payableTotalTax)] : []),

      ['--- VISSZAIGÉNYELHETŐ ÁFA ---', ...Array(13).fill('')],
      ...(showBase ? [formatRow('27%-os alap', (m) => m.deductible27Base)] : []),
      ...(showTax ? [formatRow('27%-os ÁFA', (m) => m.deductible27Tax)] : []),
      ...(showBase ? [formatRow('18%-os alap', (m) => m.deductible18Base)] : []),
      ...(showTax ? [formatRow('18%-os ÁFA', (m) => m.deductible18Tax)] : []),
      ...(showBase ? [formatRow('5%-os alap', (m) => m.deductible5Base)] : []),
      ...(showTax ? [formatRow('5%-os ÁFA', (m) => m.deductible5Tax)] : []),
      ...(showBase ? [formatRow('Fordított (FAD) alap', (m) => m.deductibleFadBase)] : []),
      ...(showTax ? [formatRow('Fordított (FAD) ÁFA', (m) => m.deductibleFadTax)] : []),
      ...(showBase ? [formatRow('Mentes alap', (m) => m.deductibleMentesBase)] : []),
      ...(showBase ? [formatRow('ÖSSZESEN ALAP (Visszaigényelhető)', deductibleTotalBase)] : []),
      ...(showTax ? [formatRow('ÖSSZESEN ÁFA (Visszaigényelhető)', deductibleTotalTax)] : []),

      ['--- ÁFÁK EGYENLEGE (FIZETENDŐ - VISSZAIGÉNYELHETŐ) ---', ...Array(13).fill('')],
      ...(showBase ? [formatRow('ÖSSZESEN ALAP EGYENLEG', balanceTotalBase)] : []),
      ...(showTax ? [formatRow('ÖSSZESEN ÁFA EGYENLEG', balanceTotalTax)] : []),
    ];

    const csvContent = '\uFEFF' + [headers.join(';'), ...rows.map((r) => r.join(';'))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `eves_afa_matrix_${year}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const renderDataRow = (
    label: string,
    getter: (m: MonthData) => number,
    options: {
      isBold?: boolean;
      bgClass?: string;
      textClass?: string;
      emptyCheck?: boolean;
    } = {}
  ) => {
    const total = calculateRowTotal(getter);
    if (!showEmptyRows && total === 0 && options.emptyCheck) {
      return null;
    }

    return (
      <TableRow className={cn('hover:bg-muted/40 transition-colors', options.bgClass)}>
        <TableCell
          className={cn(
            'py-1.5 px-2.5 font-medium text-xs sticky left-0 z-10 min-w-[170px] w-[170px] whitespace-nowrap shadow-[2px_0_4px_-2px_rgba(0,0,0,0.15)]',
            options.bgClass || 'bg-card',
            options.textClass,
            options.isBold && 'font-bold'
          )}
        >
          {label}
        </TableCell>
        {monthsData.map((m, idx) => {
          const val = getter(m);
          return (
            <TableCell
              key={idx}
              className={cn(
                'py-1.5 px-1.5 text-right text-xs tabular-nums whitespace-nowrap min-w-[70px]',
                val === 0 ? 'text-muted-foreground/30' : options.textClass || 'text-foreground',
                options.isBold ? 'font-bold' : 'font-normal'
              )}
            >
              {val !== 0 ? formatThousands(val).replace(/ /g, '\u00A0') : '0'}
            </TableCell>
          );
        })}
        <TableCell
          className={cn(
            'py-1.5 px-2 text-right text-xs font-bold tabular-nums border-l border-border/70 sticky right-0 z-10 whitespace-nowrap min-w-[100px] shadow-[-2px_0_4px_-2px_rgba(0,0,0,0.15)] bg-amber-500/5 dark:bg-amber-400/5',
            options.bgClass && options.bgClass !== 'bg-card' ? options.bgClass : undefined,
            options.textClass
          )}
        >
          {total !== 0 ? formatThousands(total).replace(/ /g, '\u00A0') : '0'}
        </TableCell>
      </TableRow>
    );
  };

  return (
    <div className="space-y-2.5 animate-in fade-in duration-200">
      {/* Top Controls Toolbar with Integrated Annual KPI Summary */}
      <div className="flex flex-col xl:flex-row items-stretch xl:items-center justify-between gap-2.5 px-3 py-2 rounded-xl border border-border/70 bg-card shadow-sm">
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-1.5 font-bold text-xs text-foreground">
            <CalendarRange className="w-4 h-4 text-primary" />
            <span>Éves ÁFA mátrix</span>
          </div>

          <Select value={String(year)} onValueChange={(v) => onYearChange(+v)}>
            <SelectTrigger className="w-24 h-7 text-xs font-semibold">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[2024, 2025, 2026, 2027].map((y) => (
                <SelectItem key={y} value={String(y)}>
                  {y}. év
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Badge
            variant="outline"
            className={cn(
              'text-[11px] font-medium px-2 py-0.5 whitespace-nowrap hidden sm:inline-flex',
              effectiveScope === 'with_image'
                ? 'bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300'
                : 'bg-blue-50 text-blue-700 border-blue-300 dark:bg-blue-950/40 dark:text-blue-300'
            )}
          >
            {effectiveScope === 'with_image' ? 'Csak számlaképpel' : 'Minden számla'}
          </Badge>

          {/* Toggles */}
          <div className="flex items-center gap-3 pl-2 border-l border-border/60">
            <label className="flex items-center space-x-1 cursor-pointer select-none text-xs">
              <Checkbox
                id="show_base"
                checked={showBase}
                onCheckedChange={(c) => setShowBase(Boolean(c))}
                className="h-3.5 w-3.5"
              />
              <span className="text-[11px]">Alap</span>
            </label>

            <label className="flex items-center space-x-1 cursor-pointer select-none text-xs">
              <Checkbox
                id="show_tax"
                checked={showTax}
                onCheckedChange={(c) => setShowTax(Boolean(c))}
                className="h-3.5 w-3.5"
              />
              <span className="text-[11px]">ÁFA</span>
            </label>

            <label className="flex items-center space-x-1 cursor-pointer select-none text-xs">
              <Checkbox
                id="show_empty"
                checked={showEmptyRows}
                onCheckedChange={(c) => setShowEmptyRows(Boolean(c))}
                className="h-3.5 w-3.5"
              />
              <span className="text-[11px]">Üres sorok</span>
            </label>
          </div>
        </div>

        {/* Integrated Annual Summary Metrics & Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 text-xs bg-muted/40 px-2.5 py-1 rounded-lg border border-border/60">
            <span className="text-muted-foreground text-[11px]">
              Fizetendő: <strong className="text-foreground tabular-nums font-semibold">{formatThousands(annualTotalPayableTax).replace(/ /g, '\u00A0')}&nbsp;Ft</strong>
            </span>
            <span className="text-muted-foreground/30">•</span>
            <span className="text-muted-foreground text-[11px]">
              Levonható: <strong className="text-foreground tabular-nums font-semibold">{formatThousands(annualTotalDeductibleTax).replace(/ /g, '\u00A0')}&nbsp;Ft</strong>
            </span>
            <span className="text-muted-foreground/30">•</span>
            <span className={cn(
              "text-[11px] font-bold tabular-nums px-1.5 py-0.5 rounded",
              annualNetBalanceTax < 0
                ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                : annualNetBalanceTax > 0
                ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                : "text-muted-foreground"
            )}>
              Egyenleg: {formatThousands(annualNetBalanceTax).replace(/ /g, '\u00A0')}&nbsp;Ft
              <span className="font-normal text-[10px] ml-1">
                {annualNetBalanceTax < 0 ? '(visszaig.)' : annualNetBalanceTax > 0 ? '(fizetendő)' : ''}
              </span>
            </span>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={handleRecalculate}
            disabled={isFetching || isRecalculating}
            className="h-7 text-xs px-2.5 gap-1"
          >
            <RefreshCw className={cn("w-3 h-3", (isFetching || isRecalculating) && "animate-spin")} />
            <span className="hidden sm:inline">Újraszámítás</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportCsv}
            className="h-7 text-xs px-2.5 gap-1"
          >
            <Download className="w-3 h-3" />
            <span>Excel</span>
          </Button>
        </div>
      </div>

      {/* 12-Month Matrix Table */}
      <Card className="border border-border/80 shadow-sm overflow-hidden">
        <CardContent className="p-0">
          <div className="overflow-x-auto max-h-[calc(100vh-210px)] scrollbar-thin">
            {isLoading ? (
              <div className="flex items-center justify-center py-12 gap-2 text-muted-foreground text-xs">
                <Loader2 className="w-4 h-4 animate-spin text-primary" />
                <span>12 havi ÁFA adatok gyűjtése és feldolgozása...</span>
              </div>
            ) : (
              <Table className="text-xs border-collapse min-w-[1140px] w-full">
                <TableHeader className="border-b border-border/80">
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="min-w-[170px] w-[170px] font-bold text-foreground sticky top-0 left-0 z-40 bg-muted/95 backdrop-blur whitespace-nowrap px-2.5 py-1.5 shadow-[2px_2px_4px_-2px_rgba(0,0,0,0.15)]">
                      ÁFA KULCS / KATEGÓRIA
                    </TableHead>
                    {MONTHS.map((m, idx) => (
                      <TableHead key={idx} className="min-w-[70px] text-right font-semibold text-muted-foreground uppercase text-[11px] whitespace-nowrap px-1.5 py-1.5 sticky top-0 z-20 bg-muted/95 backdrop-blur">
                        {m.substring(0, 3)}
                      </TableHead>
                    ))}
                    <TableHead className="min-w-[100px] text-right font-bold text-foreground border-l border-border/70 sticky top-0 right-0 z-40 bg-amber-500/10 dark:bg-amber-400/10 backdrop-blur whitespace-nowrap px-2 py-1.5 shadow-[-2px_2px_4px_-2px_rgba(0,0,0,0.15)]">
                      ÖSSZESEN
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="divide-y divide-border/20">
                  {/* --- 1. FIZETENDŐ ÁFA SECTION --- */}
                  <TableRow className="bg-teal-500/10 dark:bg-teal-950/40 border-t-2 border-teal-500/40">
                    <TableCell colSpan={14} className="py-1 px-2.5 font-bold text-[11px] text-teal-700 dark:text-teal-300 uppercase tracking-wider">
                      <span className="sticky left-2.5 inline-block font-bold">Fizetendő ÁFA (Kimenő forgalom)</span>
                    </TableCell>
                  </TableRow>
                  {showBase && renderDataRow('27%-os alap', (m) => m.payable27Base, { emptyCheck: true })}
                  {showTax && renderDataRow('27%-os ÁFA', (m) => m.payable27Tax, { emptyCheck: true })}
                  {showBase && renderDataRow('18%-os alap', (m) => m.payable18Base, { emptyCheck: true })}
                  {showTax && renderDataRow('18%-os ÁFA', (m) => m.payable18Tax, { emptyCheck: true })}
                  {showBase && renderDataRow('5%-os alap', (m) => m.payable5Base, { emptyCheck: true })}
                  {showTax && renderDataRow('5%-os ÁFA', (m) => m.payable5Tax, { emptyCheck: true })}
                  {showBase && renderDataRow('Fordított (FAD) alap', (m) => m.payableFadBase, { emptyCheck: true })}
                  {showTax && renderDataRow('Fordított (FAD) ÁFA', (m) => m.payableFadTax, { emptyCheck: true })}
                  {showBase && renderDataRow('Mentes alap', (m) => m.payableMentesBase, { emptyCheck: true })}
                  {showBase && renderDataRow('ÖSSZESEN ALAP', payableTotalBase, { isBold: true, bgClass: 'bg-muted/25 font-semibold' })}
                  {showTax && renderDataRow('ÖSSZESEN ÁFA', payableTotalTax, { isBold: true, bgClass: 'bg-muted/50 font-bold text-primary', textClass: 'text-primary font-bold' })}

                  {/* --- 2. VISSZAIGÉNYELHETŐ ÁFA SECTION --- */}
                  <TableRow className="bg-indigo-500/10 dark:bg-indigo-950/40 border-t-2 border-indigo-500/40">
                    <TableCell colSpan={14} className="py-1 px-2.5 font-bold text-[11px] text-indigo-700 dark:text-indigo-300 uppercase tracking-wider">
                      <span className="sticky left-2.5 inline-block font-bold">Visszaigényelhető / Levonható ÁFA (Bejövő forgalom)</span>
                    </TableCell>
                  </TableRow>
                  {showBase && renderDataRow('27%-os alap', (m) => m.deductible27Base, { emptyCheck: true })}
                  {showTax && renderDataRow('27%-os ÁFA', (m) => m.deductible27Tax, { emptyCheck: true })}
                  {showBase && renderDataRow('18%-os alap', (m) => m.deductible18Base, { emptyCheck: true })}
                  {showTax && renderDataRow('18%-os ÁFA', (m) => m.deductible18Tax, { emptyCheck: true })}
                  {showBase && renderDataRow('5%-os alap', (m) => m.deductible5Base, { emptyCheck: true })}
                  {showTax && renderDataRow('5%-os ÁFA', (m) => m.deductible5Tax, { emptyCheck: true })}
                  {showBase && renderDataRow('Fordított (FAD) alap', (m) => m.deductibleFadBase, { emptyCheck: true })}
                  {showTax && renderDataRow('Fordított (FAD) ÁFA', (m) => m.deductibleFadTax, { emptyCheck: true })}
                  {showBase && renderDataRow('Mentes alap', (m) => m.deductibleMentesBase, { emptyCheck: true })}
                  {showBase && renderDataRow('ÖSSZESEN ALAP', deductibleTotalBase, { isBold: true, bgClass: 'bg-muted/25 font-semibold' })}
                  {showTax && renderDataRow('ÖSSZESEN ÁFA', deductibleTotalTax, { isBold: true, bgClass: 'bg-muted/50 font-bold text-indigo-600 dark:text-indigo-400', textClass: 'text-indigo-600 dark:text-indigo-400 font-bold' })}

                  {/* --- 3. ÁFÁK EGYENLEGE SECTION --- */}
                  <TableRow className="bg-emerald-500/10 dark:bg-emerald-950/40 border-t-2 border-emerald-500/40">
                    <TableCell colSpan={14} className="py-1 px-2.5 font-bold text-[11px] text-emerald-800 dark:text-emerald-300 uppercase tracking-wider">
                      <span className="sticky left-2.5 inline-block font-bold">ÁFÁK Egyenlege (Fizetendő - Visszaigényelhető)</span>
                    </TableCell>
                  </TableRow>
                  {showBase && renderDataRow('ÖSSZESEN ALAP EGYENLEG', balanceTotalBase, { isBold: true, bgClass: 'bg-muted/30 font-semibold' })}
                  {showTax && renderDataRow('ÖSSZESEN ÁFA EGYENLEG', balanceTotalTax, {
                    isBold: true,
                    bgClass: 'bg-emerald-500/15 font-bold text-emerald-600 dark:text-emerald-400',
                    textClass: 'font-bold text-emerald-600 dark:text-emerald-400',
                  })}
                </TableBody>
              </Table>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
