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
  TableProperties,
} from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { cn, formatCurrency, isReverseChargeVatRate } from '@/lib/utils';
import { useVatViewTemplates } from '@/hooks/useVatViewTemplates';
import { VatViewSelectorModal } from './templates/VatViewSelectorModal';
import { exportVatJournalExcel, exportVatJournalCsv } from '@/lib/vatExport';
import { VatFrequency, VatScope, isProformaInvoice } from '../types';

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
  returnRowCode?: string;
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
  const [viewSelectorOpen, setViewSelectorOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [searchParams] = useSearchParams();
  const effectiveScope: VatScope = vatScope || (searchParams.get('vat_scope') as VatScope) || 'all';

  const { activeTemplate } = useVatViewTemplates();

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
          .select('id, invoice_number, supplier_name, customer_name, supplier_tax_number, customer_tax_number, invoice_delivery_date, invoice_issue_date, payment_method, invoice_net_amount, invoice_vat_amount, invoice_gross_amount, invoice_direction, vat_row_override, is_reverse_charge')
          .eq('company_id', companyId)
          .or(`invoice_delivery_date.gte.${dateFrom},and(invoice_delivery_date.is.null,invoice_issue_date.gte.${dateFrom})`)
          .or(`invoice_delivery_date.lte.${dateTo},and(invoice_delivery_date.is.null,invoice_issue_date.lte.${dateTo})`)
          .limit(5000),
        supabase
          .from('invoices')
          .select('id, bizonylatsorszam, elado_nev, vevo_nev, elado_vat_id, vevo_vat_id, teljesites_datuma, kibocsatas_datuma, fizetesi_hatarido, fizetesi_mod, adoalap_osszesen, afa_osszeg_osszesen, brutto_vegosszeg, invoice_direction, partner_gl_number, vat_gl_number, vat_row_override, forditott_adozas, image_url, melleklet_url, invoice_uploads_id, attachments, invoice_type')
          .eq('company_id', companyId)
          .not('invoice_type', 'in', '("dijbekero_proforma","dijbekero","proforma","garanciajegy")')
          .or(`teljesites_datuma.gte.${dateFrom},and(teljesites_datuma.is.null,kibocsatas_datuma.gte.${dateFrom})`)
          .or(`teljesites_datuma.lte.${dateTo},and(teljesites_datuma.is.null,kibocsatas_datuma.lte.${dateTo})`)
          .limit(5000),
      ]);

      if (navRes.error) console.warn('Error fetching nav_invoices for VAT journal:', navRes.error);
      if (subRes.error) console.warn('Error fetching invoices for VAT journal:', subRes.error);

      const navInvs = navRes.data || [];
      const subInvs = (subRes.data || []).filter((s) => !isProformaInvoice(s));

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
      const standaloneSubInvs = subInvs.filter((i) => !isProformaInvoice(i) && !existingNavNumbers.has(normalizeInvNum(i.bizonylatsorszam)));

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
          Boolean(inv.forditott_adozas) ||
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

  // Export handler supporting active template
  const handleExport = async () => {
    if (filteredItems.length === 0) return;
    setIsExporting(true);
    try {
      await exportVatJournalExcel(
        filteredItems,
        selectedCompany?.name || 'Vállalkozás',
        activeTemplate,
        periodLabel,
        negativeExpenses
      );
    } catch (e) {
      console.warn('Excel export error, falling back to CSV:', e);
      exportVatJournalCsv(
        filteredItems,
        selectedCompany?.name || 'Vállalkozás',
        activeTemplate,
        periodLabel,
        negativeExpenses
      );
    } finally {
      setIsExporting(false);
    }
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

  const renderDynamicCell = (item: JournalItem, colField: string, sign: number) => {
    switch (colField) {
      case 'entryNumber':
        return <span className="font-mono font-medium whitespace-nowrap">{item.entryNumber}</span>;
      case 'journalType':
        return <span className="whitespace-nowrap">{getJournalBadge(item.journalType)}</span>;
      case 'vatDueDate':
        return <span className="text-center font-mono text-muted-foreground whitespace-nowrap">{item.vatDueDate}</span>;
      case 'invoiceNumber':
        return <span className="font-mono font-medium whitespace-nowrap">{item.invoiceNumber}</span>;
      case 'partnerCode':
        return <span className="font-mono text-muted-foreground whitespace-nowrap">{item.partnerCode}</span>;
      case 'partnerName':
        return (
          <span className="font-medium truncate max-w-[200px] whitespace-nowrap block" title={item.partnerName}>
            {item.partnerName}
          </span>
        );
      case 'description':
        return (
          <span className="text-muted-foreground truncate max-w-[200px] whitespace-nowrap block" title={item.description}>
            {item.description}
          </span>
        );
      case 'vatRateLabel':
        return <span className="text-muted-foreground whitespace-nowrap font-mono text-xs">{item.vatRateLabel}</span>;
      case 'netAmount':
        return (
          <span className="font-mono tabular-nums whitespace-nowrap">
            {formatCurrency(item.netAmount * sign)}
          </span>
        );
      case 'netGlAccount':
        return (
          <span className="font-mono text-[11px] text-muted-foreground whitespace-nowrap text-center block">
            {item.netGlAccount || '—'}
          </span>
        );
      case 'vatAmount':
        return (
          <span className="font-mono tabular-nums font-semibold text-foreground whitespace-nowrap">
            {formatCurrency(item.vatAmount * sign)}
          </span>
        );
      case 'vatGlAccount':
        return (
          <span className="font-mono text-[11px] text-muted-foreground whitespace-nowrap text-center block">
            {item.vatGlAccount || '—'}
          </span>
        );
      case 'grossAmount':
        return (
          <span className="font-mono tabular-nums text-muted-foreground whitespace-nowrap">
            {formatCurrency(item.grossAmount * sign)}
          </span>
        );
      case 'grossGlAccount':
        return (
          <span className="font-mono text-[11px] text-muted-foreground whitespace-nowrap text-center block">
            {item.grossGlAccount || '—'}
          </span>
        );
      case 'returnRowCode':
        return (
          <Badge variant="outline" className="px-1.5 py-0 text-[10px] font-mono text-primary border-primary/30">
            {item.returnRowCode || item.taxReturnRow || '-'}
          </Badge>
        );
      case 'payableNetAmount': {
        const isOutbound = item.journalType === 'vevő';
        if (!isOutbound) return <span className="text-muted-foreground">—</span>;
        return <span className="font-mono tabular-nums whitespace-nowrap">{formatCurrency(item.netAmount)}</span>;
      }
      case 'payableVatAmount': {
        const isOutbound = item.journalType === 'vevő';
        if (!isOutbound) return <span className="text-muted-foreground">—</span>;
        return (
          <span className={cn(
            "font-mono tabular-nums whitespace-nowrap",
            item.vatAmount > 0 ? "text-rose-600 dark:text-rose-400 font-semibold" : "text-muted-foreground"
          )}>
            {formatCurrency(item.vatAmount)}
          </span>
        );
      }
      case 'deductibleNetAmount': {
        const isInbound = item.journalType === 'szállító' || item.journalType === 'pénztár';
        if (!isInbound) return <span className="text-muted-foreground">—</span>;
        return <span className="font-mono tabular-nums whitespace-nowrap">{formatCurrency(item.netAmount)}</span>;
      }
      case 'deductibleVatAmount': {
        const isInbound = item.journalType === 'szállító' || item.journalType === 'pénztár';
        if (!isInbound) return <span className="text-muted-foreground">—</span>;
        return (
          <span className={cn(
            "font-mono tabular-nums whitespace-nowrap",
            item.vatAmount > 0 ? "text-emerald-600 dark:text-emerald-400 font-semibold" : "text-muted-foreground"
          )}>
            {formatCurrency(item.vatAmount)}
          </span>
        );
      }
      case 'netVatPosition': {
        const isOutbound = item.journalType === 'vevő';
        const isInbound = item.journalType === 'szállító' || item.journalType === 'pénztár';
        const val = isOutbound ? item.vatAmount : isInbound ? -item.vatAmount : 0;
        return (
          <span className={cn(
            "font-mono tabular-nums font-semibold whitespace-nowrap",
            val > 0 ? "text-rose-600 dark:text-rose-400" : val < 0 ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"
          )}>
            {formatCurrency(val)}
          </span>
        );
      }
      default:
        return <span className="text-muted-foreground">—</span>;
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
          {/* ÁFA Nézetválasztó gomb */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setViewSelectorOpen(true)}
            className="h-9 text-xs gap-1.5 border-primary/30 hover:border-primary/60 hover:bg-primary/5 text-foreground shadow-2xs font-medium max-w-[280px] sm:max-w-none"
            title={activeTemplate ? `Aktív sablon: ${activeTemplate.name}` : undefined}
          >
            <TableProperties className="w-3.5 h-3.5 text-primary shrink-0" />
            <span className="hidden sm:inline">Nézet:</span>
            {activeTemplate && (
              <Badge variant="secondary" className="text-[11px] px-2 py-0.5 h-auto font-normal ml-0.5 max-w-[170px] sm:max-w-[260px] truncate inline-block">
                {activeTemplate.name}
              </Badge>
            )}
          </Button>

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
            onClick={handleExport}
            disabled={filteredItems.length === 0 || isExporting}
            className="h-9 text-xs gap-1.5"
          >
            {isExporting ? <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" /> : <Download className="w-3.5 h-3.5" />}
            <span>{isExporting ? 'Exportálás...' : 'Excel / CSV'}</span>
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

      {/* Master Journal Table — Driven dynamically by activeTemplate.columns */}
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
              <Table className="text-xs border-collapse min-w-[1100px]">
                <TableHeader className="bg-muted/70 sticky top-0 z-10 border-b border-border/80">
                  <TableRow>
                    {activeTemplate.columns.map((col) => (
                      <TableHead
                        key={col.id || col.key}
                        className={cn(
                          "whitespace-nowrap font-semibold text-xs py-2.5 px-3 border-r border-border/40 last:border-r-0",
                          col.align === 'center' ? 'text-center' : col.align === 'right' ? 'text-right' : 'text-left'
                        )}
                        style={{ width: col.width || 'auto' }}
                      >
                        {col.label}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody className="divide-y divide-border/30">
                  {filteredItems.map((item) => {
                    const isExpense = item.journalType === 'szállító' || item.journalType === 'pénztár';
                    const sign = negativeExpenses && isExpense ? -1 : 1;

                    return (
                      <TableRow key={item.id} className="hover:bg-muted/30 font-normal">
                        {activeTemplate.columns.map((col) => (
                          <TableCell
                            key={col.id || col.key}
                            className={cn(
                              "py-2 px-3 border-r border-border/30 last:border-r-0 whitespace-nowrap",
                              col.align === 'center' ? 'text-center' : col.align === 'right' ? 'text-right' : 'text-left'
                            )}
                          >
                            {renderDynamicCell(item, col.field, sign)}
                          </TableCell>
                        ))}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ÁFA Nézetválasztó Modális */}
      <VatViewSelectorModal
        open={viewSelectorOpen}
        onOpenChange={setViewSelectorOpen}
      />
    </div>
  );
}
