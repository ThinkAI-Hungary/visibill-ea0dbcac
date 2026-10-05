import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
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
  Search,
  ShieldCheck,
  FileSpreadsheet,
  Layers,
  ChevronRight,
  ChevronDown,
  Building2,
  FileText,
  AlertTriangle,
  Loader2,
  RefreshCw,
  X,
} from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { cn, formatCurrency } from '@/lib/utils';
import {
  MLine,
  VatFrequency,
  formatThousands,
  VatScope,
  isProformaInvoice,
  shouldExcludeFromMLine,
  isAamPartnerOrTaxNumber,
  isInsurancePartnerOrInvoice,
} from '../types';
import { VatOsaCheckDialog } from './VatOsaCheckDialog';
import {
  resolveCorrectionDetails,
  detectCorrectionType,
  RawInvoiceCandidate,
  ResolvedCorrectionDetails,
} from '../utils/vatCorrectionResolver';

interface VatMLineMasterDetailProps {
  mLines: MLine[];
  companyId: string;
  year: number;
  month: number;
  frequency: VatFrequency;
  selectedCompany: any;
  vatScope?: VatScope;
}

export function VatMLineMasterDetail({
  mLines,
  companyId,
  year,
  month,
  frequency,
  selectedCompany,
  vatScope,
}: VatMLineMasterDetailProps) {
  const [search, setSearch] = useState('');
  const [selectedPartnerId, setSelectedPartnerId] = useState<string | null>(null);
  const [isOsaDialogOpen, setIsOsaDialogOpen] = useState(false);
  const [invFilter, setInvFilter] = useState<'all' | 'normal' | 'correction'>('all');
  const [expandedRowIds, setExpandedRowIds] = useState<Set<string>>(new Set());
  const [searchParams] = useSearchParams();
  const effectiveScope: VatScope = vatScope || (searchParams.get('vat_scope') as VatScope) || 'all';

  const toggleExpand = (id: string) => {
    setExpandedRowIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

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

  // Fallback query if mLines is empty: aggregate domestic suppliers from nav_invoices
  const { data: fallbackMLines = [], refetch: refetchFallback, isFetching: isFetchingFallback } = useQuery({
    queryKey: ['fallback_m_lines', companyId, dateFrom, dateTo, effectiveScope],
    queryFn: async () => {
      if (!companyId) return [];

      const [navRes, subRes] = await Promise.all([
        supabase
          .from('nav_invoices')
          .select('id, invoice_number, supplier_name, supplier_tax_number, invoice_delivery_date, invoice_issue_date, invoice_net_amount, invoice_vat_amount')
          .eq('company_id', companyId)
          .eq('invoice_direction', 'INBOUND')
          .or(`invoice_delivery_date.gte.${dateFrom},and(invoice_delivery_date.is.null,invoice_issue_date.gte.${dateFrom})`)
          .or(`invoice_delivery_date.lte.${dateTo},and(invoice_delivery_date.is.null,invoice_issue_date.lte.${dateTo})`)
          .limit(5000),
        effectiveScope === 'with_image'
          ? supabase
              .from('invoices')
              .select('bizonylatsorszam, image_url, melleklet_url, invoice_uploads_id, attachments, invoice_type')
              .eq('company_id', companyId)
              .not('invoice_type', 'in', '("dijbekero_proforma","dijbekero","proforma","garanciajegy")')
              .or('invoice_direction.eq.INBOUND,invoice_direction.is.null')
              .or(`teljesites_datuma.gte.${dateFrom},and(teljesites_datuma.is.null,kibocsatas_datuma.gte.${dateFrom})`)
              .or(`teljesites_datuma.lte.${dateTo},and(teljesites_datuma.is.null,kibocsatas_datuma.lte.${dateTo})`)
              .limit(5000)
          : Promise.resolve({ data: [] }),
      ]);

      const navInvs = navRes.data || [];
      const subInvs = (subRes as any)?.data || [];

      const hasImg = (s: any) => Boolean(
        s.image_url ||
        s.melleklet_url ||
        s.invoice_uploads_id ||
        (Array.isArray(s.attachments) && s.attachments.length > 0)
      );
      const norm = (s?: string | null) => (s || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase();
      const allowedInvoiceNumbers = new Set(
        subInvs.filter((s: any) => !isProformaInvoice(s) && hasImg(s)).map((s: any) => norm(s.bizonylatsorszam)).filter(Boolean)
      );

      const partnerMap = new Map<string, {
        partner_name: string;
        partner_tax_number: string;
        invoice_count: number;
        base_amount_rounded: number;
        tax_amount_rounded: number;
        rate_27_base: number;
        rate_27_tax: number;
        rate_18_base: number;
        rate_18_tax: number;
        rate_5_base: number;
        rate_5_tax: number;
        tax_5_amount: number;
        tax_18_amount: number;
        tax_27_amount: number;
      }>();

      (navInvs || []).forEach((inv) => {
        if (effectiveScope === 'with_image' && !allowedInvoiceNumbers.has(norm(inv.invoice_number))) {
          return;
        }
        // Exclude AAM, proforma, insurance, or 0-VAT non-FAD in 65M sheets
        if (shouldExcludeFromMLine({
          partner_tax_number: inv.supplier_tax_number,
          partner_name: inv.supplier_name,
          invoice_number: inv.invoice_number,
          vat_amount: inv.invoice_vat_amount,
        })) {
          return;
        }

        const tax = inv.supplier_tax_number || '';
        const tax8 = tax.replace(/\D/g, '').substring(0, 8);
        if (!tax8) return;

        const net = Math.round(Number(inv.invoice_net_amount) || 0);
        const vat = Math.round(Number(inv.invoice_vat_amount) || 0);
        const rate = net > 0 && vat > 0 ? Math.round((vat / net) * 100) : 27;

        if (!partnerMap.has(tax8)) {
          partnerMap.set(tax8, {
            partner_name: inv.supplier_name || 'Ismeretlen partner',
            partner_tax_number: tax,
            invoice_count: 0,
            base_amount_rounded: 0,
            tax_amount_rounded: 0,
            rate_27_base: 0,
            rate_27_tax: 0,
            rate_18_base: 0,
            rate_18_tax: 0,
            rate_5_base: 0,
            rate_5_tax: 0,
            tax_5_amount: 0,
            tax_18_amount: 0,
            tax_27_amount: 0,
          });
        }

        const entry = partnerMap.get(tax8)!;
        entry.invoice_count += 1;
        entry.base_amount_rounded += net;
        entry.tax_amount_rounded += vat;

        if (rate >= 24) {
          entry.rate_27_base += net;
          entry.rate_27_tax += vat;
          entry.tax_27_amount += vat;
        } else if (rate >= 14) {
          entry.rate_18_base += net;
          entry.rate_18_tax += vat;
          entry.tax_18_amount += vat;
        } else if (rate >= 4) {
          entry.rate_5_base += net;
          entry.rate_5_tax += vat;
          entry.tax_5_amount += vat;
        }
      });

      return Array.from(partnerMap.entries())
        .map(([tax8, val]) => ({
          id: tax8,
          vat_return_id: '',
          group_tax_number: null,
          ...val,
        }))
        .filter((val) => !shouldExcludeFromMLine(val as any)) as unknown as MLine[];
    },
    enabled: (!mLines || mLines.length === 0) && !!companyId,
  });

  const effectiveMLines = useMemo(() => {
    const list = (mLines && mLines.length > 0) ? mLines : fallbackMLines;
    return list.filter((m) => !shouldExcludeFromMLine(m));
  }, [mLines, fallbackMLines]);

  // Filtered partners
  const filteredPartners = useMemo(() => {
    if (!search.trim()) return effectiveMLines;
    const q = search.toLowerCase().trim();
    return effectiveMLines.filter(
      (m) =>
        m.partner_name.toLowerCase().includes(q) ||
        (m.partner_tax_number && m.partner_tax_number.toLowerCase().includes(q))
    );
  }, [effectiveMLines, search]);

  // Active selected partner (default to first if none selected)
  const activePartner = useMemo(() => {
    if (!filteredPartners.length) return null;
    if (selectedPartnerId) {
      const found = filteredPartners.find((p) => p.id === selectedPartnerId);
      if (found) return found;
    }
    return filteredPartners[0];
  }, [filteredPartners, selectedPartnerId]);

  // Query itemized invoices for the selected partner
  const { data: partnerInvoices = [], isLoading: isLoadingInvoices } = useQuery({
    queryKey: ['m_line_invoices_detail', companyId, activePartner?.partner_tax_number, dateFrom, dateTo],
    queryFn: async () => {
      if (!companyId || !activePartner?.partner_tax_number) return [];
      const tax8 = activePartner.partner_tax_number.replace(/\D/g, '').substring(0, 8);
      if (!tax8) return [];

      // If activePartner has pre-populated invoice_details JSONB, use it directly
      if ((activePartner as any).invoice_details && Array.isArray((activePartner as any).invoice_details) && (activePartner as any).invoice_details.length > 0) {
        const detailsArray = (activePartner as any).invoice_details;
        return detailsArray.map((inv: any, idx: number) => {
          const corrDetails = resolveCorrectionDetails(inv, detailsArray);
          const rawNet = Number(inv.net_amount || inv.base_amount || inv.net || 0);
          const rawVat = Number(inv.vat_amount || inv.tax_amount || inv.vat || 0);
          const net = Math.round(rawNet);
          const vat = Math.round(rawVat);
          const absNet = Math.abs(net);
          const absVat = Math.abs(vat);
          const rate = absNet > 0 && absVat > 0 ? Math.round((absVat / absNet) * 100) : 27;

          const effectiveNet = corrDetails.isCorrection ? corrDetails.correctionNet : net;
          const effectiveVat = corrDetails.isCorrection ? corrDetails.correctionVat : vat;

          return {
            id: inv.id || `inv_detail_${idx}`,
            invoiceNumber: inv.invoice_number || inv.bizonylatsorszam || '-',
            fulfillmentDate: inv.delivery_date || inv.teljesites_datuma || '-',
            issueDate: inv.issue_date || inv.kibocsatas_datuma || '-',
            netOnInvoice: net,
            vatOnInvoice: vat,
            netEffective: effectiveNet,
            vatEffective: effectiveVat,
            vat5: rate === 5 ? effectiveVat : 0,
            vat18: rate === 18 ? effectiveVat : 0,
            vat27: rate === 27 || (rate !== 5 && rate !== 18) ? effectiveVat : 0,
            proRata: 0,
            anykCode: corrDetails.anykCode,
            isCorrection: corrDetails.isCorrection,
            isFinalInvoice: Boolean(inv.is_final_invoice || inv.elolegszamla_hivatkozas),
            refInvoiceNumber: corrDetails.originalInvoiceNumber || inv.ref_invoice_number || inv.elolegszamla_hivatkozas || '-',
            corrType: corrDetails.corrType,
            correctionDetails: corrDetails,
          };
        });
      }

      // Query candidate historical invoices for this partner across all periods to resolve referenced originals
      const [allPartnerNavRes, allPartnerSubRes, navRes, subRes] = await Promise.all([
        supabase
          .from('nav_invoices')
          .select('id, invoice_number, invoice_delivery_date, invoice_issue_date, invoice_net_amount, invoice_vat_amount, original_invoice_number, invoice_operation')
          .eq('company_id', companyId)
          .eq('invoice_direction', 'INBOUND')
          .ilike('supplier_tax_number', `${tax8}%`)
          .limit(1000),
        supabase
          .from('invoices')
          .select('id, bizonylatsorszam, teljesites_datuma, kibocsatas_datuma, adoalap_osszesen, afa_osszeg_osszesen, elolegszamla_hivatkozas, reference_number, invoice_type')
          .eq('company_id', companyId)
          .ilike('elado_vat_id', `${tax8}%`)
          .limit(1000),
        supabase
          .from('nav_invoices')
          .select('id, invoice_number, invoice_delivery_date, invoice_issue_date, invoice_net_amount, invoice_vat_amount, original_invoice_number, invoice_operation')
          .eq('company_id', companyId)
          .eq('invoice_direction', 'INBOUND')
          .ilike('supplier_tax_number', `${tax8}%`)
          .or(`invoice_delivery_date.gte.${dateFrom},and(invoice_delivery_date.is.null,invoice_issue_date.gte.${dateFrom})`)
          .or(`invoice_delivery_date.lte.${dateTo},and(invoice_delivery_date.is.null,invoice_issue_date.lte.${dateTo})`),
        supabase
          .from('invoices')
          .select('id, bizonylatsorszam, teljesites_datuma, kibocsatas_datuma, adoalap_osszesen, afa_osszeg_osszesen, elolegszamla_hivatkozas, reference_number, invoice_type')
          .eq('company_id', companyId)
          .not('invoice_type', 'in', '("dijbekero_proforma","dijbekero","proforma","garanciajegy")')
          .ilike('elado_vat_id', `${tax8}%`)
          .or(`teljesites_datuma.gte.${dateFrom},and(teljesites_datuma.is.null,kibocsatas_datuma.gte.${dateFrom})`)
          .or(`teljesites_datuma.lte.${dateTo},and(teljesites_datuma.is.null,kibocsatas_datuma.lte.${dateTo})`),
      ]);

      const allAvailableCandidates: RawInvoiceCandidate[] = [
        ...(allPartnerNavRes.data || []),
        ...(allPartnerSubRes.data || []),
      ];

      const navInvs = navRes.data || [];
      const subInvs = subRes.data || [];

      const normalizeInvNum = (s?: string | null) => (s || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase();
      const existingNavNumbers = new Set(navInvs.map((i) => normalizeInvNum(i.invoice_number)).filter(Boolean));
      const standaloneSubInvs = subInvs.filter((i) => !isProformaInvoice(i) && !existingNavNumbers.has(normalizeInvNum(i.bizonylatsorszam)));

      const combined: any[] = [];

      navInvs.forEach((inv) => {
        if (shouldExcludeFromMLine({
          partner_tax_number: activePartner.partner_tax_number,
          partner_name: activePartner.partner_name,
          invoice_number: inv.invoice_number,
          vat_amount: inv.invoice_vat_amount,
        })) {
          return;
        }

        const corrDetails = resolveCorrectionDetails(inv, allAvailableCandidates);
        const net = Math.round(Number(inv.invoice_net_amount) || 0);
        const vat = Math.round(Number(inv.invoice_vat_amount) || 0);
        const absNet = Math.abs(net);
        const absVat = Math.abs(vat);
        const rate = absNet > 0 && absVat > 0 ? Math.round((absVat / absNet) * 100) : 27;

        const effectiveNet = corrDetails.isCorrection ? corrDetails.correctionNet : net;
        const effectiveVat = corrDetails.isCorrection ? corrDetails.correctionVat : vat;

        combined.push({
          id: inv.id,
          invoiceNumber: inv.invoice_number || '-',
          fulfillmentDate: inv.invoice_delivery_date ? String(inv.invoice_delivery_date).substring(0, 10) : '-',
          issueDate: inv.invoice_issue_date ? String(inv.invoice_issue_date).substring(0, 10) : '-',
          netOnInvoice: net,
          vatOnInvoice: vat,
          netEffective: effectiveNet,
          vatEffective: effectiveVat,
          vat5: rate === 5 ? effectiveVat : 0,
          vat18: rate === 18 ? effectiveVat : 0,
          vat27: rate === 27 || (rate !== 5 && rate !== 18) ? effectiveVat : 0,
          proRata: 0,
          anykCode: corrDetails.anykCode,
          isCorrection: corrDetails.isCorrection,
          isFinalInvoice: false,
          refInvoiceNumber: corrDetails.originalInvoiceNumber || inv.original_invoice_number || '-',
          corrType: corrDetails.corrType,
          correctionDetails: corrDetails,
        });
      });

      standaloneSubInvs.forEach((inv) => {
        if (shouldExcludeFromMLine({
          partner_tax_number: activePartner.partner_tax_number,
          partner_name: activePartner.partner_name,
          invoice_number: inv.bizonylatsorszam,
          invoice_type: inv.invoice_type,
          vat_amount: inv.afa_osszeg_osszesen,
        })) {
          return;
        }

        const corrDetails = resolveCorrectionDetails(inv, allAvailableCandidates);
        const net = Math.round(Number(inv.adoalap_osszesen) || 0);
        const vat = Math.round(Number(inv.afa_osszeg_osszesen) || 0);
        const absNet = Math.abs(net);
        const absVat = Math.abs(vat);
        const rate = absNet > 0 && absVat > 0 ? Math.round((absVat / absNet) * 100) : 27;

        const effectiveNet = corrDetails.isCorrection ? corrDetails.correctionNet : net;
        const effectiveVat = corrDetails.isCorrection ? corrDetails.correctionVat : vat;

        combined.push({
          id: inv.id,
          invoiceNumber: inv.bizonylatsorszam || '-',
          fulfillmentDate: inv.teljesites_datuma ? String(inv.teljesites_datuma).substring(0, 10) : '-',
          issueDate: inv.kibocsatas_datuma ? String(inv.kibocsatas_datuma).substring(0, 10) : '-',
          netOnInvoice: net,
          vatOnInvoice: vat,
          netEffective: effectiveNet,
          vatEffective: effectiveVat,
          vat5: rate === 5 ? effectiveVat : 0,
          vat18: rate === 18 ? effectiveVat : 0,
          vat27: rate === 27 || (rate !== 5 && rate !== 18) ? effectiveVat : 0,
          proRata: 0,
          anykCode: corrDetails.anykCode,
          isCorrection: corrDetails.isCorrection,
          isFinalInvoice: Boolean(inv.elolegszamla_hivatkozas),
          refInvoiceNumber: corrDetails.originalInvoiceNumber || inv.reference_number || inv.elolegszamla_hivatkozas || '-',
          corrType: corrDetails.corrType,
          correctionDetails: corrDetails,
        });
      });

      return combined;
    },
    enabled: !!companyId && !!activePartner?.partner_tax_number,
  });

  // Filtered partner invoices based on quick filter toggle
  const filteredPartnerInvoices = useMemo(() => {
    if (invFilter === 'normal') {
      return partnerInvoices.filter((i: any) => !i.isCorrection);
    }
    if (invFilter === 'correction') {
      return partnerInvoices.filter((i: any) => i.isCorrection);
    }
    return partnerInvoices;
  }, [partnerInvoices, invFilter]);

  const normalCount = useMemo(() => partnerInvoices.filter((i: any) => !i.isCorrection).length, [partnerInvoices]);
  const corrCount = useMemo(() => partnerInvoices.filter((i: any) => i.isCorrection).length, [partnerInvoices]);

  // Rollup totals
  const totals = useMemo(() => {
    let levCount = 0;
    let netSum = 0;
    let vatSum = 0;
    let vat5Sum = 0;
    let vat18Sum = 0;
    let vat27Sum = 0;

    effectiveMLines.forEach((m) => {
      levCount += m.invoice_count || 1;
      netSum += m.base_amount_rounded || 0;
      vatSum += m.tax_amount_rounded || 0;
      vat5Sum += m.tax_5_amount || 0;
      vat18Sum += m.tax_18_amount || 0;
      vat27Sum += m.tax_27_amount || 0;
    });

    return {
      partnerCount: effectiveMLines.length,
      levCount,
      netSum,
      vatSum,
      vat5Sum,
      vat18Sum,
      vat27Sum,
    };
  }, [effectiveMLines]);

  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      {/* Top Banner / Toolbar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-4 rounded-xl border border-border/70 bg-card shadow-sm">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold tracking-tight text-foreground flex items-center gap-2">
              <Layers className="w-4 h-4 text-primary" />
              Tételes adatszolgáltatás (NAV 65M Belföldi összesítő)
            </h2>
            <Badge variant="outline" className="text-xs bg-muted">
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
          <p className="text-xs text-muted-foreground">
            Belföldi partnerek levonható számláinak összesítése és részletezése a 65M nyomtatvány szerinti adókulcs-bontásban.
          </p>
        </div>

        {/* Action Buttons: [NAV OSA Ellenőrzés] button & Refresh */}
        <div className="flex items-center gap-2.5 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetchFallback()}
            disabled={isFetchingFallback}
            className="h-9 gap-1.5 text-xs font-medium"
          >
            <RefreshCw className={cn("w-3.5 h-3.5", isFetchingFallback && "animate-spin")} />
            Frissítés
          </Button>
          <Button
            onClick={() => setIsOsaDialogOpen(true)}
            className="h-9 gap-2 font-semibold shadow-sm bg-emerald-600 hover:bg-emerald-700 text-white dark:bg-emerald-600 dark:hover:bg-emerald-500"
          >
            <ShieldCheck className="w-4 h-4" />
            ÁFA ellenőrzés OSA alapján
          </Button>
        </div>
      </div>

      {/* KPI Cards row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3 rounded-xl border border-border/60 bg-card/60">
          <p className="text-xs text-muted-foreground">Belföldi partnerek</p>
          <p className="text-lg font-bold text-foreground mt-0.5 font-mono">{totals.partnerCount} cég</p>
        </div>
        <div className="p-3 rounded-xl border border-border/60 bg-card/60">
          <p className="text-xs text-muted-foreground">Levonható számlák</p>
          <p className="text-lg font-bold text-foreground mt-0.5 font-mono">{totals.levCount} db</p>
        </div>
        <div className="p-3 rounded-xl border border-border/60 bg-card/60">
          <p className="text-xs text-muted-foreground">Levonható adóalap</p>
          <p className="text-lg font-bold text-foreground mt-0.5 font-mono">{formatCurrency(totals.netSum)}</p>
        </div>
        <div className="p-3 rounded-xl border border-border/60 bg-emerald-500/5 border-emerald-500/30">
          <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">Levonható ÁFA (Összes)</p>
          <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400 mt-0.5 font-mono">
            {formatCurrency(totals.vatSum)}
          </p>
        </div>
      </div>

      {/* Master Table: Partners */}
      <Card className="border border-border/80 shadow-sm">
        <CardHeader className="py-3 px-4 border-b border-border/60 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-primary" />
            <CardTitle className="text-sm font-semibold">Partnerek belföldi összesítője</CardTitle>
            <Badge variant="secondary" className="text-[11px] font-normal">
              {filteredPartners.length} / {effectiveMLines.length} partner
            </Badge>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Partner keresése (név, adószám)..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-8 text-xs bg-muted/30 focus:bg-background"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-auto max-h-64 border-b border-border/60">
            <Table className="text-xs">
              <TableHeader className="bg-muted/50 sticky top-0 z-10 border-b border-border/70">
                <TableRow>
                  <TableHead className="min-w-[180px]">Név</TableHead>
                  <TableHead className="w-28 font-mono">Adószám</TableHead>
                  <TableHead className="w-24 font-mono">Csop. adószám</TableHead>
                  <TableHead className="w-16 text-center">Lev db</TableHead>
                  <TableHead className="w-28 text-right">Lev adóalap</TableHead>
                  <TableHead className="w-28 text-right font-semibold">LevÁFA</TableHead>
                  <TableHead className="w-20 text-right">5% ÁFA</TableHead>
                  <TableHead className="w-20 text-right">18% ÁFA</TableHead>
                  <TableHead className="w-24 text-right">27% ÁFA</TableHead>
                  <TableHead className="w-20 text-right">Arányosítás</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPartners.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                      Nincs megjeleníthető partner a megadott időszakban.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredPartners.map((p) => {
                    const isSelected = activePartner?.id === p.id;
                    return (
                      <TableRow
                        key={p.id}
                        onClick={() => setSelectedPartnerId(p.id)}
                        className={cn(
                          'cursor-pointer transition-colors',
                          isSelected
                            ? 'bg-primary/10 hover:bg-primary/15 font-semibold text-foreground border-l-4 border-l-primary'
                            : 'hover:bg-muted/40 font-normal'
                        )}
                      >
                        <TableCell className="font-medium truncate max-w-[200px]" title={p.partner_name}>
                          {p.partner_name}
                        </TableCell>
                        <TableCell className="font-mono text-muted-foreground">{p.partner_tax_number || '-'}</TableCell>
                        <TableCell className="font-mono text-muted-foreground">-</TableCell>
                        <TableCell className="text-center font-mono">{p.invoice_count || 1}</TableCell>
                        <TableCell className="text-right font-mono tabular-nums whitespace-nowrap">
                          {formatCurrency(p.base_amount ?? (p.base_amount_rounded * 1000))}
                        </TableCell>
                        <TableCell className="text-right font-mono tabular-nums font-bold text-foreground whitespace-nowrap">
                          {formatCurrency(p.tax_amount ?? (p.tax_amount_rounded * 1000))}
                        </TableCell>
                        <TableCell className="text-right font-mono tabular-nums text-muted-foreground whitespace-nowrap">
                          {p.tax_5_amount ? formatCurrency(p.tax_5_amount) : '0'}
                        </TableCell>
                        <TableCell className="text-right font-mono tabular-nums text-muted-foreground whitespace-nowrap">
                          {p.tax_18_amount ? formatCurrency(p.tax_18_amount) : '0'}
                        </TableCell>
                        <TableCell className="text-right font-mono tabular-nums text-foreground whitespace-nowrap">
                          {p.tax_27_amount ? formatCurrency(p.tax_27_amount) : formatCurrency(p.tax_amount ?? (p.tax_amount_rounded * 1000))}
                        </TableCell>
                        <TableCell className="text-right font-mono tabular-nums text-muted-foreground whitespace-nowrap">0</TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Detail Table: Selected Partner's Invoices */}
      <Card className="border border-border/80 shadow-sm">
        <CardHeader className="py-3 px-4 border-b border-border/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <CardTitle className="text-sm font-semibold">
              Kiválasztott partner számlái tételesen:{' '}
              <span className="text-primary font-bold ml-1">
                {activePartner ? activePartner.partner_name : 'Nincs kiválasztva'}
              </span>
            </CardTitle>
            {activePartner?.partner_tax_number && (
              <Badge variant="outline" className="font-mono text-[10px]">
                {activePartner.partner_tax_number}
              </Badge>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* Quick Filters */}
            <div className="flex items-center bg-muted/60 p-0.5 rounded-lg border border-border/60 text-xs">
              <button
                type="button"
                onClick={() => setInvFilter('all')}
                className={cn(
                  'px-2.5 py-1 rounded-md transition-all font-medium text-[11px]',
                  invFilter === 'all'
                    ? 'bg-background shadow-xs text-foreground font-semibold'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                Összes ({partnerInvoices.length})
              </button>
              <button
                type="button"
                onClick={() => setInvFilter('normal')}
                className={cn(
                  'px-2.5 py-1 rounded-md transition-all font-medium text-[11px]',
                  invFilter === 'normal'
                    ? 'bg-background shadow-xs text-foreground font-semibold'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                Normál 02 ({normalCount})
              </button>
              <button
                type="button"
                onClick={() => setInvFilter('correction')}
                className={cn(
                  'px-2.5 py-1 rounded-md transition-all font-medium text-[11px] flex items-center gap-1',
                  invFilter === 'correction'
                    ? 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200 shadow-xs font-semibold'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                Korrekciós 02-K ({corrCount})
              </button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-auto max-h-80">
            {isLoadingInvoices ? (
              <div className="flex items-center justify-center py-10 gap-2 text-muted-foreground text-xs">
                <Loader2 className="w-5 h-5 animate-spin text-primary" />
                <span>Számlák betöltése...</span>
              </div>
            ) : filteredPartnerInvoices.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-xs">
                {invFilter === 'all'
                  ? 'Ehhez a partnerhez nem található részletező számla a megadott időszakban.'
                  : invFilter === 'normal'
                  ? 'Ehhez a partnerhez nem található normál (02) számla a megadott időszakban.'
                  : 'Ehhez a partnerhez nem található korrekciós / sztornó (02-K) számla a megadott időszakban.'}
              </div>
            ) : (
              <Table className="text-xs">
                <TableHeader className="bg-muted/50 sticky top-0 z-10 border-b border-border/70">
                  <TableRow>
                    <TableHead className="w-40">Számla sorszáma</TableHead>
                    <TableHead className="w-24 text-center font-mono">Teljesítés</TableHead>
                    <TableHead className="w-28 text-right">Adóalap (számlán)</TableHead>
                    <TableHead className="w-24 text-right">Adó (számlán)</TableHead>
                    <TableHead className="w-28 text-right font-medium">Adóalap (figyelembe vett)</TableHead>
                    <TableHead className="w-24 text-right font-medium">Adó (figyelembe vett)</TableHead>
                    <TableHead className="w-16 text-right">5%</TableHead>
                    <TableHead className="w-16 text-right">18%</TableHead>
                    <TableHead className="w-20 text-right">27%</TableHead>
                    <TableHead className="w-16 text-center">ÁNYK</TableHead>
                    <TableHead className="w-20 text-center">Végszámla</TableHead>
                    <TableHead className="w-28">Értbizszám</TableHead>
                    <TableHead className="w-24 text-center">Kelt</TableHead>
                    <TableHead className="w-20">Korr. tip</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPartnerInvoices.map((inv: any) => {
                    const isExpanded = expandedRowIds.has(inv.id);
                    return (
                      <React.Fragment key={inv.id}>
                        <TableRow className={cn('hover:bg-muted/30 transition-colors', isExpanded && 'bg-muted/20')}>
                          <TableCell className="font-mono font-medium whitespace-nowrap">
                            <div className="flex items-center gap-1.5">
                              {inv.isCorrection ? (
                                <button
                                  type="button"
                                  onClick={() => toggleExpand(inv.id)}
                                  className="p-0.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                                  title={isExpanded ? 'Részletek összecsukása' : '65M-02-K részletek megtekintése'}
                                >
                                  {isExpanded ? (
                                    <ChevronDown className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                                  ) : (
                                    <ChevronRight className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                                  )}
                                </button>
                              ) : (
                                <span className="w-4" />
                              )}
                              <span>{inv.invoiceNumber}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-center font-mono whitespace-nowrap">{inv.fulfillmentDate}</TableCell>
                          <TableCell className="text-right font-mono tabular-nums whitespace-nowrap">{formatCurrency(inv.netOnInvoice)}</TableCell>
                          <TableCell className="text-right font-mono tabular-nums whitespace-nowrap">{formatCurrency(inv.vatOnInvoice)}</TableCell>
                          <TableCell className="text-right font-mono tabular-nums font-semibold whitespace-nowrap">{formatCurrency(inv.netEffective)}</TableCell>
                          <TableCell
                            className={cn(
                              'text-right font-mono tabular-nums font-bold whitespace-nowrap',
                              inv.vatEffective < 0
                                ? 'text-rose-600 dark:text-rose-400'
                                : 'text-emerald-600 dark:text-emerald-400'
                            )}
                          >
                            {formatCurrency(inv.vatEffective)}
                          </TableCell>
                          <TableCell className="text-right font-mono tabular-nums text-muted-foreground whitespace-nowrap">{inv.vat5 ? formatCurrency(inv.vat5) : '0'}</TableCell>
                          <TableCell className="text-right font-mono tabular-nums text-muted-foreground whitespace-nowrap">{inv.vat18 ? formatCurrency(inv.vat18) : '0'}</TableCell>
                          <TableCell className="text-right font-mono tabular-nums whitespace-nowrap">{inv.vat27 ? formatCurrency(inv.vat27) : '0'}</TableCell>
                          <TableCell className="text-center font-mono whitespace-nowrap">
                            {inv.isCorrection ? (
                              <Badge
                                variant="outline"
                                className="bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/40 dark:text-amber-300 text-[10px] px-1.5 py-0 font-bold"
                              >
                                02-K
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-[10px] px-1 py-0">
                                02
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-center text-muted-foreground whitespace-nowrap">{inv.isFinalInvoice ? 'Igen' : '-'}</TableCell>
                          <TableCell className="font-mono text-muted-foreground truncate max-w-[120px] whitespace-nowrap" title={inv.refInvoiceNumber}>
                            {inv.refInvoiceNumber}
                          </TableCell>
                          <TableCell className="text-center font-mono text-muted-foreground whitespace-nowrap">{inv.issueDate}</TableCell>
                          <TableCell className="text-[11px] whitespace-nowrap">
                            {inv.corrType === 'Sztornó' ? (
                              <span className="font-semibold text-rose-600 dark:text-rose-400">Sztornó</span>
                            ) : inv.corrType === 'Helyesbítő' ? (
                              <span className="font-semibold text-amber-600 dark:text-amber-400">Helyesbítő</span>
                            ) : (
                              <span className="text-muted-foreground">Normál</span>
                            )}
                          </TableCell>
                        </TableRow>

                        {/* Expandable sub-card for 65M-02-K items */}
                        {inv.isCorrection && isExpanded && (
                          <TableRow className="bg-amber-50/20 dark:bg-amber-950/10 border-b border-border/60">
                            <TableCell colSpan={14} className="py-2.5 px-6">
                              <div className="rounded-lg border border-amber-200/70 dark:border-amber-900/50 bg-background/95 p-3.5 space-y-2.5 shadow-xs">
                                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/50 pb-2">
                                  <div className="flex items-center gap-2">
                                    <Badge
                                      variant="outline"
                                      className="bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-950 dark:text-amber-200 text-[11px] font-bold"
                                    >
                                      NAV 65M-02-K Korrekciós Tétel
                                    </Badge>
                                    <span className="text-xs font-semibold text-foreground">
                                      {inv.corrType} bizonylat kapcsolati adatai
                                    </span>
                                  </div>
                                  <div>
                                    {inv.correctionDetails?.isOriginalFound ? (
                                      <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300 text-[10px]">
                                        ✓ Hivatkozott számla feloldva az adatbázisból
                                      </Badge>
                                    ) : (
                                      <Badge variant="outline" className="bg-amber-50 text-amber-800 border-amber-300 dark:bg-amber-950/40 dark:text-amber-300 text-[10px]">
                                        ⚠ Hivatkozott számla korábbi időszaki / becsült adat
                                      </Badge>
                                    )}
                                  </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-0.5">
                                  {/* E sor: Eredeti számla adatai */}
                                  <div className="p-3 rounded-md border border-blue-200/60 dark:border-blue-900/40 bg-blue-50/20 dark:bg-blue-950/10 space-y-1.5">
                                    <div className="flex items-center justify-between text-xs pb-1.5 border-b border-border/40">
                                      <span className="flex items-center gap-1.5 font-semibold text-blue-900 dark:text-blue-300">
                                        <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200">
                                          E sor
                                        </span>
                                        Eredeti (módosított) számla adatai
                                      </span>
                                      <span className="font-mono text-foreground font-bold">
                                        {inv.correctionDetails?.originalInvoiceNumber || '-'}
                                      </span>
                                    </div>
                                    <div className="grid grid-cols-2 gap-y-1 text-[11px] pt-0.5">
                                      <div>
                                        <span className="text-muted-foreground mr-1">Kelt:</span>
                                        <span className="font-mono font-medium">{inv.correctionDetails?.originalIssueDate || '-'}</span>
                                      </div>
                                      <div>
                                        <span className="text-muted-foreground mr-1">Teljesítés:</span>
                                        <span className="font-mono font-medium">{inv.correctionDetails?.originalFulfillmentDate || '-'}</span>
                                      </div>
                                      <div>
                                        <span className="text-muted-foreground mr-1">Adóalap:</span>
                                        <span className="font-mono font-bold text-foreground">
                                          +{formatCurrency(inv.correctionDetails?.originalNet || 0)}
                                        </span>
                                      </div>
                                      <div>
                                        <span className="text-muted-foreground mr-1">Levonható adó:</span>
                                        <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                                          +{formatCurrency(inv.correctionDetails?.originalVat || 0)}
                                        </span>
                                      </div>
                                    </div>
                                  </div>

                                  {/* KT sor: Korrekció a tárgyidőszakban */}
                                  <div className="p-3 rounded-md border border-amber-200/60 dark:border-amber-900/40 bg-amber-50/20 dark:bg-amber-950/10 space-y-1.5">
                                    <div className="flex items-center justify-between text-xs pb-1.5 border-b border-border/40">
                                      <span className="flex items-center gap-1.5 font-semibold text-amber-900 dark:text-amber-300">
                                        <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200">
                                          KT sor
                                        </span>
                                        Korrekció / sztornó (tárgyidőszak)
                                      </span>
                                      <span className="font-mono text-foreground font-bold">{inv.invoiceNumber}</span>
                                    </div>
                                    <div className="grid grid-cols-2 gap-y-1 text-[11px] pt-0.5">
                                      <div>
                                        <span className="text-muted-foreground mr-1">Kelt:</span>
                                        <span className="font-mono font-medium">{inv.issueDate || '-'}</span>
                                      </div>
                                      <div>
                                        <span className="text-muted-foreground mr-1">Teljesítés:</span>
                                        <span className="font-mono font-medium">{inv.fulfillmentDate || '-'}</span>
                                      </div>
                                      <div>
                                        <span className="text-muted-foreground mr-1">Adóalap:</span>
                                        <span className="font-mono font-bold text-rose-600 dark:text-rose-400">
                                          {formatCurrency(inv.correctionDetails?.correctionNet || 0)}
                                        </span>
                                      </div>
                                      <div>
                                        <span className="text-muted-foreground mr-1">Levonható adó:</span>
                                        <span className="font-mono font-bold text-rose-600 dark:text-rose-400">
                                          {formatCurrency(inv.correctionDetails?.correctionVat || 0)}
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </React.Fragment>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Reconciliation Dialog */}
      <VatOsaCheckDialog
        open={isOsaDialogOpen}
        onOpenChange={setIsOsaDialogOpen}
        companyId={companyId}
        year={year}
        month={month}
        frequency={frequency}
        companyName={selectedCompany?.name}
      />
    </div>
  );
}
