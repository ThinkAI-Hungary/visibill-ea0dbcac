import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
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
  CheckCircle2,
  AlertTriangle,
  FileSpreadsheet,
  Search,
  Filter,
  Loader2,
  ShieldCheck,
  AlertCircle,
  HelpCircle,
  X,
  RefreshCw,
} from 'lucide-react';
import { cn, formatCurrency } from '@/lib/utils';
import { VatFrequency, isProformaInvoice } from '../types';

interface VatOsaCheckDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId: string;
  year: number;
  month: number;
  frequency: VatFrequency;
  companyName?: string;
}

interface ReconciliationItem {
  id: string;
  status: 'MATCH' | 'DIFF' | 'LOCAL_ONLY' | 'NAV_ONLY';
  partnerName: string;
  taxNumber: string;
  invoiceNumber: string;
  deliveryDateLocal: string;
  deliveryDateNav: string;
  dateDiff: boolean;
  netLocal: number;
  netNav: number;
  netDiff: boolean;
  vatLocal: number;
  vatNav: number;
  vatDiff: boolean;
  notes: string;
}

export function VatOsaCheckDialog({
  open,
  onOpenChange,
  companyId,
  year,
  month,
  frequency,
  companyName,
}: VatOsaCheckDialogProps) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'DIFF' | 'MATCH' | 'MISSING'>('ALL');

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

  // Fetch local recorded invoices & nav_invoices for the period
  const { data: reconciliationData = [], isLoading, refetch, isFetching } = useQuery({
    queryKey: ['vat_osa_reconciliation', companyId, dateFrom, dateTo],
    queryFn: async () => {
      if (!companyId) return [];

      // 1. Fetch locally recorded incoming invoices (strictly excluding proforma / díjbekérő)
      const { data: localInvoices = [], error: localErr } = await supabase
        .from('invoices')
        .select('id, bizonylatsorszam, elado_nev, elado_vat_id, teljesites_datuma, kibocsatas_datuma, adoalap_osszesen, afa_osszeg_osszesen, brutto_vegosszeg, invoice_type')
        .eq('company_id', companyId)
        .or('invoice_direction.eq.INBOUND,invoice_direction.is.null')
        .not('invoice_type', 'in', '("dijbekero_proforma","dijbekero","proforma","garanciajegy")')
        .or(`teljesites_datuma.gte.${dateFrom},and(teljesites_datuma.is.null,kibocsatas_datuma.gte.${dateFrom})`)
        .or(`teljesites_datuma.lte.${dateTo},and(teljesites_datuma.is.null,kibocsatas_datuma.lte.${dateTo})`);

      if (localErr) console.warn('Error fetching local invoices for OSA reconciliation:', localErr);

      // 2. Fetch NAV Online Számla inbound invoices
      const { data: navInvoices = [], error: navErr } = await supabase
        .from('nav_invoices')
        .select('id, invoice_number, supplier_name, supplier_tax_number, invoice_delivery_date, invoice_issue_date, invoice_net_amount, invoice_vat_amount, invoice_gross_amount')
        .eq('company_id', companyId)
        .eq('invoice_direction', 'INBOUND')
        .or(`invoice_delivery_date.gte.${dateFrom},and(invoice_delivery_date.is.null,invoice_issue_date.gte.${dateFrom})`)
        .or(`invoice_delivery_date.lte.${dateTo},and(invoice_delivery_date.is.null,invoice_issue_date.lte.${dateTo})`);

      if (navErr) console.warn('Error fetching nav_invoices for OSA reconciliation:', navErr);

      // 3. Match by normalized invoice number & tax number
      const norm = (str?: string | null) => (str || '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
      const tax8 = (tax?: string | null) => (tax || '').replace(/\D/g, '').substring(0, 8);

      const navMap = new Map<string, any>();
      (navInvoices || []).forEach((navInv) => {
        const key = `${tax8(navInv.supplier_tax_number)}_${norm(navInv.invoice_number)}`;
        navMap.set(key, navInv);
      });

      const matchedNavKeys = new Set<string>();
      const result: ReconciliationItem[] = [];

      // Process local invoices (ignoring any proforma / díjbekérő)
      (localInvoices || []).forEach((localInv) => {
        if (isProformaInvoice(localInv)) return;

        const key = `${tax8(localInv.elado_vat_id)}_${norm(localInv.bizonylatsorszam)}`;
        const navInv = navMap.get(key);

        if (navInv) {
          matchedNavKeys.add(key);

          const dateLoc = String(localInv.teljesites_datuma || '').substring(0, 10);
          const dateNav = String(navInv.invoice_delivery_date || '').substring(0, 10);
          const dateDiff = dateLoc !== dateNav;

          const netLoc = Math.round(Number(localInv.adoalap_osszesen) || 0);
          const netNav = Math.round(Number(navInv.invoice_net_amount) || 0);
          const netDiff = Math.abs(netLoc - netNav) > 1; // 1 Ft rounding tolerance

          const vatLoc = Math.round(Number(localInv.afa_osszeg_osszesen) || 0);
          const vatNav = Math.round(Number(navInv.invoice_vat_amount) || 0);
          const vatDiff = Math.abs(vatLoc - vatNav) > 1;

          const hasDiff = dateDiff || netDiff || vatDiff;

          result.push({
            id: localInv.id,
            status: hasDiff ? 'DIFF' : 'MATCH',
            partnerName: localInv.elado_nev || navInv.supplier_name || 'Ismeretlen partner',
            taxNumber: localInv.elado_vat_id || navInv.supplier_tax_number || '-',
            invoiceNumber: localInv.bizonylatsorszam || navInv.invoice_number || '-',
            deliveryDateLocal: dateLoc,
            deliveryDateNav: dateNav,
            dateDiff,
            netLocal: netLoc,
            netNav: netNav,
            netDiff,
            vatLocal: vatLoc,
            vatNav: vatNav,
            vatDiff,
            notes: hasDiff ? 'Eltérő adatok a NAV OSA-hoz képest' : 'Egyezik',
          });
        } else {
          // Exists locally, but not found in NAV OSA
          result.push({
            id: localInv.id,
            status: 'LOCAL_ONLY',
            partnerName: localInv.elado_nev || 'Ismeretlen partner',
            taxNumber: localInv.elado_vat_id || '-',
            invoiceNumber: localInv.bizonylatsorszam || '-',
            deliveryDateLocal: String(localInv.teljesites_datuma || '').substring(0, 10),
            deliveryDateNav: '-',
            dateDiff: false,
            netLocal: Math.round(Number(localInv.adoalap_osszesen) || 0),
            netNav: 0,
            netDiff: true,
            vatLocal: Math.round(Number(localInv.afa_osszeg_osszesen) || 0),
            vatNav: 0,
            vatDiff: true,
            notes: 'Csak a könyvelésben található (NAV OSA-ban nincs)',
          });
        }
      });

      // Process remaining NAV invoices (missing from local accounting)
      (navInvoices || []).forEach((navInv) => {
        const key = `${tax8(navInv.supplier_tax_number)}_${norm(navInv.invoice_number)}`;
        if (!matchedNavKeys.has(key)) {
          result.push({
            id: navInv.id,
            status: 'NAV_ONLY',
            partnerName: navInv.supplier_name || 'Ismeretlen partner',
            taxNumber: navInv.supplier_tax_number || '-',
            invoiceNumber: navInv.invoice_number || '-',
            deliveryDateLocal: '-',
            deliveryDateNav: String(navInv.invoice_delivery_date || '').substring(0, 10),
            dateDiff: false,
            netLocal: 0,
            netNav: Math.round(Number(navInv.invoice_net_amount) || 0),
            netDiff: true,
            vatLocal: 0,
            vatNav: Math.round(Number(navInv.invoice_vat_amount) || 0),
            vatDiff: true,
            notes: 'Hiányzik a könyvelésből (NAV Online Számlában szerepel!)',
          });
        }
      });

      // Sort: DIFF first, then NAV_ONLY, then LOCAL_ONLY, then MATCH
      const priority: Record<string, number> = { DIFF: 0, NAV_ONLY: 1, LOCAL_ONLY: 2, MATCH: 3 };
      result.sort((a, b) => priority[a.status] - priority[b.status]);

      return result;
    },
    enabled: open && !!companyId,
    staleTime: 1000 * 60 * 2,
  });

  // Summary counts
  const counts = useMemo(() => {
    let match = 0;
    let diff = 0;
    let localOnly = 0;
    let navOnly = 0;

    reconciliationData.forEach((item) => {
      if (item.status === 'MATCH') match++;
      else if (item.status === 'DIFF') diff++;
      else if (item.status === 'LOCAL_ONLY') localOnly++;
      else if (item.status === 'NAV_ONLY') navOnly++;
    });

    return {
      total: reconciliationData.length,
      match,
      diff,
      localOnly,
      navOnly,
    };
  }, [reconciliationData]);

  // Filtered items
  const filteredItems = useMemo(() => {
    return reconciliationData.filter((item) => {
      if (statusFilter === 'DIFF' && item.status !== 'DIFF') return false;
      if (statusFilter === 'MATCH' && item.status !== 'MATCH') return false;
      if (statusFilter === 'MISSING' && item.status !== 'NAV_ONLY' && item.status !== 'LOCAL_ONLY') return false;

      if (search.trim()) {
        const q = search.toLowerCase().trim();
        const mPartner = item.partnerName.toLowerCase().includes(q);
        const mTax = item.taxNumber.toLowerCase().includes(q);
        const mInv = item.invoiceNumber.toLowerCase().includes(q);
        if (!mPartner && !mTax && !mInv) return false;
      }

      return true;
    });
  }, [reconciliationData, statusFilter, search]);

  // CSV Export
  const handleExportCsv = () => {
    if (filteredItems.length === 0) return;

    const headers = [
      'Státusz',
      'Partner',
      'Adószám',
      'Bizonylatszám',
      'Könyvelt teljesítés',
      'OSA teljesítés',
      'Könyvelt nettó',
      'OSA nettó',
      'Könyvelt ÁFA',
      'OSA ÁFA',
      'Megjegyzés',
    ];

    const rows = filteredItems.map((it) => [
      it.status === 'MATCH'
        ? 'Egyezik'
        : it.status === 'DIFF'
        ? 'Nem egyeznek az adatok!'
        : it.status === 'NAV_ONLY'
        ? 'Hiányzik a könyvelésből'
        : 'Csak könyvelésben van',
      `"${it.partnerName.replace(/"/g, '""')}"`,
      `"${it.taxNumber}"`,
      `"${it.invoiceNumber}"`,
      it.deliveryDateLocal,
      it.deliveryDateNav,
      it.netLocal,
      it.netNav,
      it.vatLocal,
      it.vatNav,
      `"${it.notes}"`,
    ]);

    const csvContent = '\uFEFF' + [headers.join(';'), ...rows.map((r) => r.join(';'))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `afa_ellenorzes_osa_${year}_${month}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[96vw] max-w-[96vw] sm:max-w-[96vw] xl:max-w-[1600px] 2xl:max-w-[1800px] h-[92vh] max-h-[92vh] flex flex-col p-4 sm:p-6 gap-4">
        {/* Header */}
        <DialogHeader className="pb-2 border-b border-border/60">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <DialogTitle className="text-xl font-bold flex items-center gap-2 text-foreground">
                <ShieldCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                ÁFA ellenőrzés OSA alapján
                <Badge variant="outline" className="text-xs bg-muted font-normal ml-2">
                  {periodLabel}
                </Badge>
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-1">
                A könyvelési bizonylatok és a NAV Online Számla (OSA) adatbázis tételeinek összehasonlítása és eltérés-vizsgálata.
              </DialogDescription>
            </div>

            {/* Quick KPI stats */}
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="bg-muted text-xs px-2.5 py-1">
                Összes: <strong>{counts.total} db</strong>
              </Badge>
              <Badge variant="outline" className="border-emerald-500/30 text-emerald-600 bg-emerald-500/10 text-xs px-2.5 py-1">
                Egyezik: <strong>{counts.match}</strong>
              </Badge>
              {counts.diff > 0 && (
                <Badge variant="outline" className="border-red-500/30 text-red-600 bg-red-500/10 text-xs px-2.5 py-1 font-bold animate-pulse">
                  Eltérés: {counts.diff}
                </Badge>
              )}
              {counts.navOnly > 0 && (
                <Badge variant="outline" className="border-amber-500/30 text-amber-600 bg-amber-500/10 text-xs px-2.5 py-1">
                  Hiányzó: {counts.navOnly}
                </Badge>
              )}
            </div>
          </div>
        </DialogHeader>

        {/* Toolbar: Filters & Actions */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-1 max-w-md">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Szűkítés: partnernév, adószám, számlaszám..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 h-9 text-xs"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
              <SelectTrigger className="w-44 h-9 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Összes ({counts.total})</SelectItem>
                <SelectItem value="DIFF">Csak eltérések ({counts.diff})</SelectItem>
                <SelectItem value="MATCH">Egyező tételek ({counts.match})</SelectItem>
                <SelectItem value="MISSING">Hiányzó / Egyedi ({counts.localOnly + counts.navOnly})</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              disabled={isFetching}
              className="h-9 text-xs gap-1.5"
            >
              <RefreshCw className={cn("w-3.5 h-3.5", isFetching && "animate-spin")} />
              Frissítés
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportCsv}
              disabled={filteredItems.length === 0}
              className="h-9 text-xs gap-1.5"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              Excel / CSV export
            </Button>
          </div>
        </div>

        {/* Diff Table */}
        <div className="flex-1 overflow-auto rounded-xl border border-border/80 min-h-[320px] bg-card">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center h-48 gap-2 text-muted-foreground text-xs">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
              <span>Számlák és NAV Online Számla adatok összevetése...</span>
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 gap-2 text-muted-foreground text-xs">
              <HelpCircle className="w-8 h-8 opacity-40" />
              <span>Nincs megjeleníthető számla a megadott szűrési feltételekre.</span>
            </div>
          ) : (
            <Table className="text-xs">
              <TableHeader className="bg-muted/60 sticky top-0 z-10 border-b border-border/80">
                <TableRow>
                  <TableHead className="w-40">Megjegyzés / Státusz</TableHead>
                  <TableHead>Partner</TableHead>
                  <TableHead className="w-32">Adószám</TableHead>
                  <TableHead className="w-36">Bizonylatszám</TableHead>
                  <TableHead className="w-24 text-center">Telj.</TableHead>
                  <TableHead className="w-24 text-center">OSA telj.</TableHead>
                  <TableHead className="w-28 text-right">Nettó (Ft)</TableHead>
                  <TableHead className="w-28 text-right">OSA nettó (Ft)</TableHead>
                  <TableHead className="w-24 text-right">ÁFA (Ft)</TableHead>
                  <TableHead className="w-24 text-right">OSA ÁFA (Ft)</TableHead>
                  <TableHead className="w-32">Részletek</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredItems.map((item) => {
                  const isMatch = item.status === 'MATCH';
                  const isDiff = item.status === 'DIFF';
                  const isNavOnly = item.status === 'NAV_ONLY';
                  const isLocalOnly = item.status === 'LOCAL_ONLY';

                  return (
                    <TableRow
                      key={item.id}
                      className={cn(
                        'transition-colors hover:bg-muted/40 font-normal',
                        isDiff && 'bg-red-500/5 hover:bg-red-500/10',
                        isNavOnly && 'bg-amber-500/5 hover:bg-amber-500/10'
                      )}
                    >
                      {/* Status / Megjegyzés */}
                      <TableCell className="font-semibold py-2">
                        {isMatch && (
                          <span className="inline-flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-medium">
                            <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                            Egyezik
                          </span>
                        )}
                        {isDiff && (
                          <span className="inline-flex items-center gap-1.5 text-red-600 dark:text-red-400 font-bold">
                            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                            Nem egyeznek!
                          </span>
                        )}
                        {isNavOnly && (
                          <span className="inline-flex items-center gap-1.5 text-amber-600 dark:text-amber-400 font-medium">
                            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                            Csak NAV OSA
                          </span>
                        )}
                        {isLocalOnly && (
                          <span className="inline-flex items-center gap-1.5 text-blue-600 dark:text-blue-400 font-medium">
                            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                            Csak Könyvelt
                          </span>
                        )}
                      </TableCell>

                      {/* Partner Name */}
                      <TableCell className="font-medium truncate max-w-[240px] xl:max-w-[380px] 2xl:max-w-[480px]" title={item.partnerName}>
                        {item.partnerName}
                      </TableCell>

                      {/* Tax ID */}
                      <TableCell className="font-mono text-muted-foreground">{item.taxNumber}</TableCell>

                      {/* Invoice Number */}
                      <TableCell className="font-mono font-medium">{item.invoiceNumber}</TableCell>

                      {/* Local delivery date */}
                      <TableCell
                        className={cn(
                          'text-center font-mono',
                          item.dateDiff ? 'text-red-600 dark:text-red-400 font-bold bg-red-500/10 rounded px-1' : 'text-muted-foreground'
                        )}
                      >
                        {item.deliveryDateLocal}
                      </TableCell>

                      {/* OSA delivery date */}
                      <TableCell
                        className={cn(
                          'text-center font-mono',
                          item.dateDiff ? 'text-red-600 dark:text-red-400 font-bold bg-red-500/10 rounded px-1' : 'text-muted-foreground'
                        )}
                      >
                        {item.deliveryDateNav}
                      </TableCell>

                      {/* Local Net */}
                      <TableCell
                        className={cn(
                          'text-right font-mono tabular-nums',
                          item.netDiff ? 'text-red-600 dark:text-red-400 font-bold bg-red-500/10 rounded px-1' : 'text-foreground'
                        )}
                      >
                        {formatCurrency(item.netLocal)}
                      </TableCell>

                      {/* OSA Net */}
                      <TableCell
                        className={cn(
                          'text-right font-mono tabular-nums',
                          item.netDiff ? 'text-red-600 dark:text-red-400 font-bold bg-red-500/10 rounded px-1' : 'text-muted-foreground'
                        )}
                      >
                        {formatCurrency(item.netNav)}
                      </TableCell>

                      {/* Local VAT */}
                      <TableCell
                        className={cn(
                          'text-right font-mono tabular-nums font-semibold',
                          item.vatDiff ? 'text-red-600 dark:text-red-400 font-bold bg-red-500/10 rounded px-1' : 'text-foreground'
                        )}
                      >
                        {formatCurrency(item.vatLocal)}
                      </TableCell>

                      {/* OSA VAT */}
                      <TableCell
                        className={cn(
                          'text-right font-mono tabular-nums',
                          item.vatDiff ? 'text-red-600 dark:text-red-400 font-bold bg-red-500/10 rounded px-1' : 'text-muted-foreground'
                        )}
                      >
                        {formatCurrency(item.vatNav)}
                      </TableCell>

                      {/* Notes / Details */}
                      <TableCell className="text-[11px] text-muted-foreground truncate max-w-[160px] xl:max-w-[320px]" title={item.notes}>
                        {item.notes}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
