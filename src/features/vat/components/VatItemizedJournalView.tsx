import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
  FileText,
  Search,
  Download,
  Filter,
  Loader2,
  X,
  RefreshCw,
  BookOpen,
} from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { cn, formatCurrency, isReverseChargeVatRate } from '@/lib/utils';
import { VatFrequency, VatScope } from '../types';

interface VatItemizedJournalViewProps {
  companyId: string;
  year: number;
  month: number;
  frequency: VatFrequency;
  selectedCompany?: any;
  vatScope?: VatScope;
}

interface JournalItem {
  id: string;
  entryNumber: string;
  journalType: 'szállító' | 'vevő' | 'pénztár' | 'vegyes';
  vatDueDate: string;
  invoiceNumber: string;
  partnerCode: string;
  partnerName: string;
  description: string;
  projectCode: string;
  vatRateLabel: string;
  netAmount: number;
  netGlAccount: string;
  vatAmount: number;
  vatGlAccount: string;
  grossAmount: number;
  grossGlAccount: string;
  taxReturnRow: string;
  countryCode: string;
  euTaxNumber: string;
}

export function VatItemizedJournalView({
  companyId,
  year,
  month,
  frequency,
  selectedCompany,
  vatScope,
}: VatItemizedJournalViewProps) {
  const [negativeExpenses, setNegativeExpenses] = useState(true);
  const [journalFilter, setJournalFilter] = useState<'ALL' | 'szállító' | 'vevő' | 'pénztár' | 'vegyes'>('ALL');
  const [search, setSearch] = useState('');
  const [searchParams] = useSearchParams();
  const effectiveScope: VatScope = vatScope || (searchParams.get('vat_scope') as VatScope) || 'all';

  // Compute period dates
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

  // Query itemized journal invoices for the period
  const { data: journalItems = [], isLoading, refetch, isFetching } = useQuery({
    queryKey: ['vat_itemized_journal', companyId, dateFrom, dateTo, effectiveScope],
    queryFn: async () => {
      if (!companyId) return [];

      const [navRes, subRes] = await Promise.all([
        supabase
          .from('nav_invoices')
          .select('id, invoice_number, supplier_name, customer_name, supplier_tax_number, customer_tax_number, invoice_delivery_date, invoice_issue_date, payment_method, invoice_net_amount, invoice_vat_amount, invoice_gross_amount, invoice_direction, vat_row_override, is_reverse_charge, vat_rate')
          .eq('company_id', companyId)
          .or(`invoice_delivery_date.gte.${dateFrom},and(invoice_delivery_date.is.null,invoice_issue_date.gte.${dateFrom})`)
          .or(`invoice_delivery_date.lte.${dateTo},and(invoice_delivery_date.is.null,invoice_issue_date.lte.${dateTo})`)
          .limit(5000),
        supabase
          .from('invoices')
          .select('id, bizonylatsorszam, elado_nev, vevo_nev, elado_vat_id, vevo_vat_id, teljesites_datuma, kibocsatas_datuma, fizetesi_hatarido, fizetesi_mod, adoalap_osszesen, afa_osszeg_osszesen, brutto_vegosszeg, invoice_direction, partner_gl_number, vat_gl_number, vat_row_override, is_reverse_charge, forditott_adozas, image_url, melleklet_url, invoice_uploads_id, attachments')
          .eq('company_id', companyId)
          .or(`teljesites_datuma.gte.${dateFrom},and(teljesites_datuma.is.null,kibocsatas_datuma.gte.${dateFrom})`)
          .or(`teljesites_datuma.lte.${dateTo},and(teljesites_datuma.is.null,kibocsatas_datuma.lte.${dateTo})`)
          .limit(5000),
      ]);

      if (navRes.error) console.warn('Error fetching nav_invoices for VAT journal:', navRes.error);
      if (subRes.error) console.warn('Error fetching invoices for VAT journal:', subRes.error);

      const navInvs = navRes.data || [];
      const subInvs = subRes.data || [];

      // Check whether submitted invoice has an uploaded image/document
      const hasImg = (s: any) => Boolean(
        s.image_url ||
        s.melleklet_url ||
        s.invoice_uploads_id ||
        (Array.isArray(s.attachments) && s.attachments.length > 0)
      );

      const normalizeInvNum = (s?: string | null) => (s || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase();

      // Build map of submitted invoices with actual images
      const subWithImageByNum = new Map<string, boolean>();
      subInvs.forEach((s) => {
        if (s.bizonylatsorszam && hasImg(s)) {
          subWithImageByNum.set(normalizeInvNum(s.bizonylatsorszam), true);
        }
      });

      const existingNavNumbers = new Set(navInvs.map((i) => normalizeInvNum(i.invoice_number)).filter(Boolean));
      const standaloneSubInvs = subInvs.filter((i) => !existingNavNumbers.has(normalizeInvNum(i.bizonylatsorszam)));

      let seqSzallito = 1;
      let seqVevo = 1;
      let seqPenztar = 1;
      let seqVegyes = 1;

      const items: any[] = [];

      // Process NAV invoices
      navInvs.forEach((inv) => {
        const isOutbound = inv.invoice_direction === 'OUTBOUND';
        if (!isOutbound && effectiveScope === 'with_image') {
          const invNum = normalizeInvNum(inv.invoice_number);
          if (!subWithImageByNum.has(invNum)) {
            return; // Inbound invoice without image skipped in with_image scope
          }
        }
        const isCash = inv.payment_method === 'CASH' || inv.payment_method === 'Készpénz';
        const isFad =
          inv.vat_row_override === '29' ||
          inv.vat_row_override === '04' ||
          Boolean(inv.is_reverse_charge) ||
          isReverseChargeVatRate((inv as any).vat_rate);

        let jType: 'szállító' | 'vevő' | 'pénztár' | 'vegyes';
        let entryNum = '';

        if (isCash) {
          jType = 'pénztár';
          entryNum = `P${year % 100}/${String(seqPenztar++).padStart(6, '0')}`;
        } else if (isOutbound) {
          jType = 'vevő';
          entryNum = `K${year % 100}/${String(seqVevo++).padStart(6, '0')}`;
        } else if (isFad || inv.vat_row_override === '29' || inv.vat_row_override === '66') {
          jType = 'vegyes';
          entryNum = `V/${String(seqVegyes++).padStart(6, '0')}`;
        } else {
          jType = 'szállító';
          entryNum = `SZ${year % 100}/${String(seqSzallito++).padStart(6, '0')}`;
        }

        const net = Math.round(Number(inv.invoice_net_amount) || 0);
        let vat = Math.round(Number(inv.invoice_vat_amount) || 0);
        if (isFad) {
          if (!isOutbound) {
            if (vat === 0 && net !== 0) {
              vat = Math.round(net * 0.27);
            }
          } else {
            vat = 0;
          }
        }
        const gross = Math.round(Number(inv.invoice_gross_amount) || (isFad && !isOutbound ? net : net + vat));

        const partnerName = isOutbound
          ? inv.customer_name || 'Vevő partner'
          : inv.supplier_name || 'Szállító partner';

        const partnerTax = isOutbound
          ? inv.customer_tax_number || ''
          : inv.supplier_tax_number || '';

        const rateNum = net > 0 && vat > 0 ? Math.round((vat / net) * 100) : 0;
        let rateLabel = 'mentes';
        if (isFad) {
          rateLabel = isOutbound ? 'FAD kimenő (0%)' : 'FAD (27%)';
        } else if (rateNum >= 24) rateLabel = '27%-os';
        else if (rateNum >= 14) rateLabel = '18%-os';
        else if (rateNum >= 4) rateLabel = '5%-os';

        const netAccount = isOutbound ? '911K' : '529T';
        const vatAccount = isFad
          ? (isOutbound ? '—' : '4666T / 4676K')
          : (isOutbound ? '467K' : '466T');
        let grossAccount = isOutbound ? '311T' : '4541K';
        if (isCash) grossAccount = '3811T';

        let rowCode = inv.vat_row_override || '';
        if (!rowCode) {
          if (isFad) {
            rowCode = isOutbound ? '04' : '29 / 66';
          } else if (isOutbound) {
            rowCode = rateLabel === '27%-os' ? '01' : rateLabel === '18%-os' ? '03' : rateLabel === '5%-os' ? '05' : '07';
          } else {
            rowCode = rateLabel === '27%-os' ? '64' : rateLabel === '18%-os' ? '65' : rateLabel === '5%-os' ? '66' : '68';
          }
        }

        items.push({
          id: inv.id,
          entryNumber: entryNum,
          journalType: jType,
          vatDueDate: inv.invoice_delivery_date ? String(inv.invoice_delivery_date).substring(0, 10) : '-',
          invoiceNumber: inv.invoice_number || '-',
          partnerCode: partnerTax.replace(/\D/g, '').substring(0, 8) || '-',
          partnerName,
          description: isFad
            ? (isOutbound ? 'Fordított adózású értékesítés (04. sor)' : 'Fordított adózású beszerzés (29/66. sor)')
            : (isOutbound ? 'Értékesítés termék/szolgáltatás' : 'Beszerzés számla'),
          projectCode: '',
          vatRateLabel: rateLabel,
          netAmount: net,
          netGlAccount: netAccount,
          vatAmount: vat,
          vatGlAccount: vatAccount,
          grossAmount: gross,
          grossGlAccount: grossAccount,
          returnRowCode: rowCode,
        });
      });

      // Process standalone submitted invoices
      standaloneSubInvs.forEach((inv) => {
        const isOutbound = inv.invoice_direction === 'OUTBOUND';
        if (!isOutbound && effectiveScope === 'with_image') {
          if (!hasImg(inv)) {
            return; // Standalone inbound invoice without image skipped in with_image scope
          }
        }
        const isCash = inv.fizetesi_mod === 'CASH' || inv.fizetesi_mod === 'Készpénz';
        const isFad =
          inv.vat_row_override === '29' ||
          inv.vat_row_override === '04' ||
          Boolean(inv.is_reverse_charge) ||
          Boolean((inv as any).forditott_adozas) ||
          isReverseChargeVatRate((inv as any).vat_rate);

        let jType: 'szállító' | 'vevő' | 'pénztár' | 'vegyes';
        let entryNum = '';

        if (isCash) {
          jType = 'pénztár';
          entryNum = `P${year % 100}/${String(seqPenztar++).padStart(6, '0')}`;
        } else if (isOutbound) {
          jType = 'vevő';
          entryNum = `K${year % 100}/${String(seqVevo++).padStart(6, '0')}`;
        } else if (isFad || inv.vat_row_override === '29' || inv.vat_row_override === '66') {
          jType = 'vegyes';
          entryNum = `V/${String(seqVegyes++).padStart(6, '0')}`;
        } else {
          jType = 'szállító';
          entryNum = `SZ${year % 100}/${String(seqSzallito++).padStart(6, '0')}`;
        }

        const net = Math.round(Number(inv.adoalap_osszesen) || 0);
        let vat = Math.round(Number(inv.afa_osszeg_osszesen) || 0);
        if (isFad) {
          if (!isOutbound) {
            if (vat === 0 && net !== 0) {
              vat = Math.round(net * 0.27);
            }
          } else {
            vat = 0;
          }
        }
        const gross = Math.round(Number(inv.brutto_vegosszeg) || (isFad && !isOutbound ? net : net + vat));

        const partnerName = isOutbound
          ? inv.vevo_nev || 'Vevő partner'
          : inv.elado_nev || 'Szállító partner';

        const partnerTax = isOutbound
          ? inv.vevo_vat_id || ''
          : inv.elado_vat_id || '';

        const rateNum = net > 0 && vat > 0 ? Math.round((vat / net) * 100) : 0;
        let rateLabel = 'mentes';
        if (isFad) {
          rateLabel = isOutbound ? 'FAD kimenő (0%)' : 'FAD (27%)';
        } else if (rateNum >= 24) rateLabel = '27%-os';
        else if (rateNum >= 14) rateLabel = '18%-os';
        else if (rateNum >= 4) rateLabel = '5%-os';

        const netAccount = isOutbound ? '911K' : '529T';
        const vatAccount = isFad
          ? (isOutbound ? '—' : '4666T / 4676K')
          : inv.vat_gl_number ? `${inv.vat_gl_number}${isOutbound ? 'K' : 'T'}` : (isOutbound ? '467K' : '466T');
        let grossAccount = inv.partner_gl_number ? `${inv.partner_gl_number}${isOutbound ? 'T' : 'K'}` : (isOutbound ? '311T' : '4541K');
        if (isCash) grossAccount = '3811T';

        let rowCode = inv.vat_row_override || '';
        if (!rowCode) {
          if (isFad) {
            rowCode = isOutbound ? '04' : '29 / 66';
          } else if (isOutbound) {
            rowCode = rateLabel === '27%-os' ? '01' : rateLabel === '18%-os' ? '03' : rateLabel === '5%-os' ? '05' : '07';
          } else {
            rowCode = rateLabel === '27%-os' ? '64' : rateLabel === '18%-os' ? '65' : rateLabel === '5%-os' ? '66' : '68';
          }
        }

        items.push({
          id: inv.id,
          entryNumber: entryNum,
          journalType: jType,
          vatDueDate: inv.teljesites_datuma ? String(inv.teljesites_datuma).substring(0, 10) : '-',
          invoiceNumber: inv.bizonylatsorszam || '-',
          partnerCode: partnerTax.replace(/\D/g, '').substring(0, 8) || '-',
          partnerName,
          description: isFad
            ? (isOutbound ? 'Fordított adózású értékesítés (04. sor)' : 'Fordított adózású beszerzés (29/66. sor)')
            : (isOutbound ? 'Értékesítés termék/szolgáltatás' : 'Beszerzés számla'),
          projectCode: '',
          vatRateLabel: rateLabel,
          netAmount: net,
          netGlAccount: netAccount,
          vatAmount: vat,
          vatGlAccount: vatAccount,
          grossAmount: gross,
          grossGlAccount: grossAccount,
          returnRowCode: rowCode,
        });
      });

      return items;
    },
    enabled: !!companyId,
    staleTime: 1000 * 60 * 3,
  });

  // Filtered Items
  const filteredItems = useMemo(() => {
    return journalItems.filter((item) => {
      if (journalFilter !== 'ALL' && item.journalType !== journalFilter) {
        return false;
      }

      if (search.trim()) {
        const q = search.toLowerCase().trim();
        const matchesName = item.partnerName.toLowerCase().includes(q);
        const matchesInv = item.invoiceNumber.toLowerCase().includes(q);
        const matchesEntry = item.entryNumber.toLowerCase().includes(q);
        const matchesDesc = item.description.toLowerCase().includes(q);
        if (!matchesName && !matchesInv && !matchesEntry && !matchesDesc) return false;
      }

      return true;
    });
  }, [journalItems, journalFilter, search]);

  // CSV Export
  const handleExportCsv = () => {
    if (filteredItems.length === 0) return;

    const headers = [
      'Sorszám',
      'Napló',
      'ÁFA esedékesség',
      'Bizonylatszám',
      'Part.kód',
      'Partner neve',
      'Megjegyzés',
      'ÁFA%',
      'Nettó',
      'Nettó fsz.',
      'ÁFA',
      'ÁFA fsz.',
      'Bruttó',
      'Bruttó fsz.',
      'Bev.sor',
    ];

    const rows = filteredItems.map((it) => {
      const isExpense = it.journalType === 'szállító' || it.journalType === 'pénztár';
      const sign = negativeExpenses && isExpense ? -1 : 1;

      return [
        it.entryNumber,
        it.journalType,
        it.vatDueDate,
        `"${it.invoiceNumber}"`,
        `"${it.partnerCode}"`,
        `"${it.partnerName.replace(/"/g, '""')}"`,
        `"${it.description}"`,
        it.vatRateLabel,
        it.netAmount * sign,
        it.netGlAccount,
        it.vatAmount * sign,
        it.vatGlAccount,
        it.grossAmount * sign,
        it.grossGlAccount,
        it.taxReturnRow,
      ];
    });

    const csvContent = '\uFEFF' + [headers.join(';'), ...rows.map((r) => r.join(';'))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `afa_analitikus_naplo_${year}_${month}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getJournalBadge = (type: JournalItem['journalType']) => {
    switch (type) {
      case 'szállító':
        return <Badge variant="outline" className="bg-blue-500/10 text-blue-600 border-blue-500/30 text-[10px] px-1.5 py-0">szállító</Badge>;
      case 'vevő':
        return <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30 text-[10px] px-1.5 py-0">vevő</Badge>;
      case 'pénztár':
        return <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/30 text-[10px] px-1.5 py-0">pénztár</Badge>;
      case 'vegyes':
        return <Badge variant="outline" className="bg-purple-500/10 text-purple-600 border-purple-500/30 text-[10px] px-1.5 py-0">vegyes</Badge>;
    }
  };

  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      {/* Top Toolbar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-4 rounded-xl border border-border/70 bg-card shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-primary" />
            <h2 className="text-base font-bold tracking-tight text-foreground">ÁFA analitika (Tételes ÁFA napló)</h2>
            <Badge variant="outline" className="text-xs bg-muted ml-1">
              {periodLabel}
            </Badge>
            <Badge
              variant="outline"
              className={cn(
                'text-[11px] font-medium px-2 py-0.5 whitespace-nowrap ml-1',
                effectiveScope === 'with_image'
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300'
                  : 'bg-blue-50 text-blue-700 border-blue-300 dark:bg-blue-950/40 dark:text-blue-300'
              )}
            >
              {effectiveScope === 'with_image' ? 'Csak számlaképpel' : 'Minden számla'}
            </Badge>
          </div>

          {/* Negative Expenses Toggle */}
          <div className="flex items-center space-x-2 pl-3 border-l border-border/60">
            <Checkbox
              id="neg_expenses"
              checked={negativeExpenses}
              onCheckedChange={(c) => setNegativeExpenses(Boolean(c))}
            />
            <Label htmlFor="neg_expenses" className="text-xs cursor-pointer select-none">
              A kiadások negatív előjellel jelenjenek meg
            </Label>
          </div>
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
            <Download className="w-3.5 h-3.5" />
            Excel / CSV
          </Button>
        </div>
      </div>

      {/* Filter bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-1 max-w-md">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Keresés: partner, bizonylatszám, sorszám..."
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

          <Select value={journalFilter} onValueChange={(v) => setJournalFilter(v as any)}>
            <SelectTrigger className="w-40 h-9 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Összes napló</SelectItem>
              <SelectItem value="szállító">Csak Szállító</SelectItem>
              <SelectItem value="vevő">Csak Vevő</SelectItem>
              <SelectItem value="pénztár">Csak Pénztár</SelectItem>
              <SelectItem value="vegyes">Csak Vegyes</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="text-xs text-muted-foreground self-center">
          {filteredItems.length} db analitikus tétel listázva
        </div>
      </div>

      {/* Master Journal Table */}
      <Card className="border border-border/80 shadow-sm overflow-hidden">
        <CardContent className="p-0">
          <div className="overflow-auto max-h-[65vh]">
            {isLoading ? (
              <div className="flex items-center justify-center py-16 gap-2 text-muted-foreground text-xs">
                <Loader2 className="w-5 h-5 animate-spin text-primary" />
                <span>Analitikus ÁFA napló tételeinek betöltése...</span>
              </div>
            ) : filteredItems.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground text-xs">
                Nincs rögzített analitikus tétel a megadott szűrési feltételekre.
              </div>
            ) : (
              <Table className="text-xs border-collapse min-w-[1250px]">
                <TableHeader className="bg-muted/70 sticky top-0 z-10 border-b border-border/80">
                  <TableRow>
                    <TableHead className="w-28 font-mono whitespace-nowrap">Sorszám</TableHead>
                    <TableHead className="w-20 whitespace-nowrap">Napló</TableHead>
                    <TableHead className="w-24 text-center font-mono whitespace-nowrap">ÁFA esed.</TableHead>
                    <TableHead className="w-32 font-mono whitespace-nowrap">Bizonylatszám</TableHead>
                    <TableHead className="w-20 font-mono whitespace-nowrap">Part.kód</TableHead>
                    <TableHead className="min-w-[160px] whitespace-nowrap">Partner neve</TableHead>
                    <TableHead className="min-w-[160px] whitespace-nowrap">Megjegyzés</TableHead>
                    <TableHead className="w-20 whitespace-nowrap">ÁFA%</TableHead>
                    <TableHead className="w-28 text-right whitespace-nowrap">Nettó</TableHead>
                    <TableHead className="w-16 font-mono text-center whitespace-nowrap">Nettó fsz</TableHead>
                    <TableHead className="w-24 text-right font-medium whitespace-nowrap">ÁFA</TableHead>
                    <TableHead className="w-16 font-mono text-center whitespace-nowrap">ÁFA fsz</TableHead>
                    <TableHead className="w-28 text-right whitespace-nowrap">Bruttó</TableHead>
                    <TableHead className="w-16 font-mono text-center whitespace-nowrap">Bruttó fsz</TableHead>
                    <TableHead className="w-16 text-center font-bold text-primary whitespace-nowrap">Bev.sor</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="divide-y divide-border/30">
                  {filteredItems.map((item) => {
                    const isExpense = item.journalType === 'szállító' || item.journalType === 'pénztár';
                    const sign = negativeExpenses && isExpense ? -1 : 1;

                    return (
                      <TableRow key={item.id} className="hover:bg-muted/30 font-normal">
                        <TableCell className="font-mono font-medium whitespace-nowrap">{item.entryNumber}</TableCell>
                        <TableCell className="whitespace-nowrap">{getJournalBadge(item.journalType)}</TableCell>
                        <TableCell className="text-center font-mono text-muted-foreground whitespace-nowrap">{item.vatDueDate}</TableCell>
                        <TableCell className="font-mono font-medium whitespace-nowrap">{item.invoiceNumber}</TableCell>
                        <TableCell className="font-mono text-muted-foreground whitespace-nowrap">{item.partnerCode}</TableCell>
                        <TableCell className="font-medium truncate max-w-[180px] whitespace-nowrap" title={item.partnerName}>
                          {item.partnerName}
                        </TableCell>
                        <TableCell className="text-muted-foreground truncate max-w-[180px] whitespace-nowrap" title={item.description}>
                          {item.description}
                        </TableCell>
                        <TableCell className="text-muted-foreground whitespace-nowrap">{item.vatRateLabel}</TableCell>
                        <TableCell className="text-right font-mono tabular-nums whitespace-nowrap">
                          {formatCurrency(item.netAmount * sign)}
                        </TableCell>
                        <TableCell className="text-center font-mono text-[11px] text-muted-foreground whitespace-nowrap">
                          {item.netGlAccount}
                        </TableCell>
                        <TableCell className="text-right font-mono tabular-nums font-semibold text-foreground whitespace-nowrap">
                          {formatCurrency(item.vatAmount * sign)}
                        </TableCell>
                        <TableCell className="text-center font-mono text-[11px] text-muted-foreground whitespace-nowrap">
                          {item.vatGlAccount}
                        </TableCell>
                        <TableCell className="text-right font-mono tabular-nums text-muted-foreground whitespace-nowrap">
                          {formatCurrency(item.grossAmount * sign)}
                        </TableCell>
                        <TableCell className="text-center font-mono text-[11px] text-muted-foreground whitespace-nowrap">
                          {item.grossGlAccount}
                        </TableCell>
                        <TableCell className="text-center font-mono font-bold text-primary whitespace-nowrap">
                          <Badge variant="outline" className="px-1.5 py-0 text-[10px] font-mono">
                            {item.returnRowCode || item.taxReturnRow || '-'}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
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
