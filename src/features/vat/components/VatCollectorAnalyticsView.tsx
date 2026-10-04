import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCompany } from '@/contexts/CompanyContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { 
  FileSpreadsheet, 
  ChevronDown, 
  ChevronRight, 
  ChevronLeft, 
  Layers, 
  FileText, 
  Loader2, 
  Filter, 
  X, 
  Search, 
  RotateCcw,
  Percent,
  BookOpen,
  ArrowUpRight,
  ArrowDownLeft,
  ChevronsUpDown,
  ChevronsDownUp
} from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { formatCurrency, cn } from '@/lib/utils';
import { exportVatCollectorAnalyticsExcel, VatCollectorGroup } from '@/lib/glExport';
import { downloadVatAnalyticsPdf } from '@/lib/vatAnalyticsPdf';
import { useToast } from '@/hooks/use-toast';
import { useTranslation } from 'react-i18next';
import { useDateRange } from '@/contexts/DateRangeContext';
import { useActivePreset } from '@/hooks/useActivePreset';
import { fetchAllGlAccountsByPreset } from '@/lib/glData';
import { VatScope, isProformaInvoice } from '../types';

interface VatCollectorAnalyticsViewProps {
  year?: number;
  periodMonth?: number;
  vatScope?: VatScope;
}

export function VatCollectorAnalyticsView({ year, periodMonth, vatScope }: VatCollectorAnalyticsViewProps) {
  const { t } = useTranslation(['accounting', 'common']);
  const { selectedCompany } = useCompany();
  const { toast } = useToast();
  const { dateFromFormatted, dateToFormatted } = useDateRange();
  const { activePresetId } = useActivePreset(selectedCompany?.id);

  const isCroatia = selectedCompany?.country_code === 'HR';
  const targetCurrency = isCroatia ? 'EUR' : 'HUF';

  const [searchParams] = useSearchParams();
  const effectiveScope: VatScope = vatScope || (searchParams.get('vat_scope') as VatScope) || 'all';

  // Compute effective date interval from props or DateRangeContext
  const effectiveDateFrom = useMemo(() => {
    if (year && periodMonth) {
      return `${year}-${String(periodMonth).padStart(2, '0')}-01`;
    }
    return dateFromFormatted;
  }, [year, periodMonth, dateFromFormatted]);

  const effectiveDateTo = useMemo(() => {
    if (year && periodMonth) {
      const lastDay = new Date(year, periodMonth, 0).getDate();
      return `${year}-${String(periodMonth).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    }
    return dateToFormatted;
  }, [year, periodMonth, dateToFormatted]);

  const [collapsedCodes, setCollapsedCodes] = useState<Set<string>>(new Set());
  const [isExporting, setIsExporting] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [viewMode, setViewMode] = useState<'collector' | 'row'>('collector');

  // Helper for friendly declaration row labels in Row View mode
  const getDeclarationRowLabel = (row: string) => {
    if (isCroatia) {
      switch (row) {
        case 'I.1': return 'I.1 Tuzemni prijenos porezne obveze';
        case 'I.2': return 'I.2 Isporuke dobara unutar EU';
        case 'I.4': return 'I.4 Obavljene usluge unutar EU';
        case 'I.6': return 'I.6 Izvoz dobara';
        case 'I.8': return 'I.8 Ostale oslobođene isporuke';
        case 'II.1': return 'II.1 Isporuke po stopi 5%';
        case 'II.2': return 'II.2 Isporuke po stopi 13%';
        case 'II.3': return 'II.3 Isporuke po stopi 25%';
        case 'II.4': return 'II.4 Tuzemni prijenos porezne obveze (građevina)';
        case 'II.7': return 'II.7 Stjecanje dobara unutar EU';
        case 'II.10': return 'II.10 Primljene usluge unutar EU';
        case 'III.1': return 'III.1 Pretporez po stopi 5%';
        case 'III.2': return 'III.2 Pretporez po stopi 13%';
        case 'III.3': return 'III.3 Pretporez po stopi 25%';
        case 'III.12': return 'III.12 Pretporez bez prava na odbitak';
        case 'III.14': return 'III.14 Uvoz dobara';
        default: return `Redak ${row}`;
      }
    }

    switch (row) {
      case '01': return '01. sor — Közösségen kívüli termékértékesítés / Alanyi mentes (AAM, Export)';
      case '02': return '02. sor — Közösségen belüli adómentes termékértékesítés';
      case '03': return '03. sor — Belföldi 5%-os értékesítés fizetendő adója';
      case '04': return '04. sor — Belföldi fordított adózású értékesítés (FAD)';
      case '05': return '05. sor — Belföldi 18%-os értékesítés fizetendő adója';
      case '07': return '07. sor — Belföldi 27%-os értékesítés fizetendő adója';
      case '08': return '08. sor — Közérdekű vagy speciális adómentes értékesítés (TAM)';
      case '18': return '18. sor — Közösségi szolgáltatás igénybevétel fizetendő adója';
      case '27': return '27. sor — 3. országbeli szolgáltatás fizetendő adója';
      case '29': return '29. sor — Belföldi fordított adózás fizetendő adója (FAD)';
      case '43': return '43. sor — Tájékoztató adat: Tárgyi eszköz értékesítés adóalapja';
      case '45': return '45. sor — Tájékoztató adat: Értékesítéshez kapott előleg adóalapja';
      case '63': return '63. sor — Adólevonásra nem jogosító belföldi beszerzés (mentes)';
      case '64': return '64. sor — Belföldi 5%-os beszerzés levonható adója';
      case '65': return '65. sor — Belföldi 18%-os beszerzés levonható adója';
      case '66': return '66. sor — Belföldi 27%-os beszerzés levonható adója';
      case '67': return '67. sor — Import és fordított beszerzés levonható adója';
      case '77': return '77. sor — Tárgyi eszköz beszerzés, beruházás levonható adója';
      case '91': return '91. sor — ÁFA területi hatályán kívüli 3. országbeli szolgáltatások';
      case '92': return '92. sor — ÁFA területi hatályán kívüli EU szolgáltatások (Áfa tv. 37. §)';
      default: return `${row}. sor`;
    }
  };

  const getItemDeclarationRows = (item: any): Array<{ row: string; base: number; vat: number; gross: number }> => {
    const direction = item.direction || 'INBOUND';
    const isOutbound = direction === 'OUTBOUND';
    const net = Number(item.net_amount) || 0;
    const vat = Number(item.vat_amount) || 0;
    const gross = Number(item.gross_amount) || (net + vat);
    const code = item.code || '';
    const override = item.vat_row_override || null;
    const isAdvance = item.is_advance || code === 'ELOLEG' || override === '45';
    const isTangibleAsset = item.is_tangible_asset || code === 'TARGYESZKOZ' || code === 'KIM_TE_ERT' || override === '77' || override === '43';
    const isFad = code === 'FAD' || override === '29' || override === '04';

    // Inbound deductible percentage handling (e.g. 70/30 telephone, 50/50 leasing)
    const dedPct = item.deductible_percentage != null ? Number(item.deductible_percentage) : 100;
    const effNet = (!isOutbound && dedPct < 100) ? Math.round(net * (dedPct / 100)) : net;
    const effVat = (!isOutbound && dedPct < 100) ? Math.round(vat * (dedPct / 100)) : vat;

    const rows: Array<{ row: string; base: number; vat: number; gross: number }> = [];

    if (override) {
      if (override === '43') {
        rows.push({ row: '07', base: net, vat: vat, gross: gross });
        rows.push({ row: '43', base: net, vat: 0, gross: net });
        return rows;
      }
      if (override === '45') {
        rows.push({ row: '07', base: net, vat: vat, gross: gross });
        rows.push({ row: '45', base: net, vat: 0, gross: net });
        return rows;
      }
      if (override === '77') {
        rows.push({ row: '66', base: effNet, vat: effVat, gross: gross });
        rows.push({ row: '77', base: 0, vat: effVat, gross: effVat });
        return rows;
      }
      if (override === '29') {
        rows.push({ row: '29', base: effNet, vat: effVat, gross: gross });
        rows.push({ row: '66', base: effNet, vat: effVat, gross: gross });
        return rows;
      }
      rows.push({ row: override, base: effNet, vat: effVat, gross: gross });
      return rows;
    }

    if (isCroatia) {
      if (isOutbound) {
        if (code === '25') rows.push({ row: 'II.3', base: net, vat: vat, gross: gross });
        else if (code === '13') rows.push({ row: 'II.2', base: net, vat: vat, gross: gross });
        else if (code === '05') rows.push({ row: 'II.1', base: net, vat: vat, gross: gross });
        else if (code === 'FAD') rows.push({ row: 'I.1', base: net, vat: 0, gross: net });
        else if (code === 'EXP') rows.push({ row: 'I.6', base: net, vat: 0, gross: net });
        else rows.push({ row: 'II.3', base: net, vat: vat, gross: gross });
      } else {
        if (code === '25') {
          rows.push({ row: 'III.3', base: effNet, vat: effVat, gross: gross });
        } else if (code === '13') {
          rows.push({ row: 'III.2', base: effNet, vat: effVat, gross: gross });
        } else if (code === '05') {
          rows.push({ row: 'III.1', base: effNet, vat: effVat, gross: gross });
        } else if (code === 'TAM' || code === 'AAM') {
          rows.push({ row: 'III.12', base: effNet, vat: 0, gross: effNet });
        } else {
          rows.push({ row: 'III.3', base: effNet, vat: effVat, gross: gross });
        }
      }
      return rows;
    }

    if (isOutbound) {
      if (isFad) {
        rows.push({ row: '04', base: net, vat: 0, gross: net });
      } else if (code === '25') {
        rows.push({ row: '07', base: net, vat: vat, gross: gross });
        if (isAdvance) {
          rows.push({ row: '45', base: net, vat: 0, gross: net });
        }
        if (isTangibleAsset) {
          rows.push({ row: '43', base: net, vat: 0, gross: net });
        }
      } else if (code === '18') {
        rows.push({ row: '05', base: net, vat: vat, gross: gross });
      } else if (code === '05') {
        rows.push({ row: '03', base: net, vat: vat, gross: gross });
      } else if (code === 'AAM' || code === 'EXP') {
        rows.push({ row: '01', base: net, vat: 0, gross: net });
      } else if (code === 'TAM') {
        rows.push({ row: '08', base: net, vat: 0, gross: net });
      } else if (code === 'ÁHK' || code === 'AHK') {
        rows.push({ row: '91', base: net, vat: 0, gross: net });
      } else {
        rows.push({ row: '07', base: net, vat: vat, gross: gross });
        if (isAdvance) rows.push({ row: '45', base: net, vat: 0, gross: net });
        if (isTangibleAsset) rows.push({ row: '43', base: net, vat: 0, gross: net });
      }
    } else {
      // Inbound
      if (isFad) {
        const fadTax = effVat > 0 ? effVat : Math.round(effNet * 0.27);
        rows.push({ row: '29', base: effNet, vat: fadTax, gross: effNet + fadTax });
        rows.push({ row: '66', base: effNet, vat: fadTax, gross: effNet + fadTax });
      } else if (code === '25') {
        rows.push({ row: '66', base: effNet, vat: effVat, gross: gross });
        if (isTangibleAsset) {
          rows.push({ row: '77', base: 0, vat: effVat, gross: effVat });
        }
      } else if (code === '18') {
        rows.push({ row: '65', base: effNet, vat: effVat, gross: gross });
      } else if (code === '05') {
        rows.push({ row: '64', base: effNet, vat: effVat, gross: gross });
      } else if (code === 'TAM' || code === 'AAM') {
        rows.push({ row: '63', base: effNet, vat: 0, gross: effNet });
      } else if (code === 'EUK_SZOLG') {
        rows.push({ row: '18', base: effNet, vat: effVat, gross: gross });
        rows.push({ row: '67', base: effNet, vat: effVat, gross: gross });
      } else if (code === 'ATHK_SZOLG') {
        rows.push({ row: '27', base: effNet, vat: effVat, gross: gross });
        rows.push({ row: '67', base: effNet, vat: effVat, gross: gross });
      } else {
        rows.push({ row: '66', base: effNet, vat: effVat, gross: gross });
        if (isTangibleAsset) rows.push({ row: '77', base: 0, vat: effVat, gross: effVat });
      }
    }

    return rows;
  };

  // Filter states: Irány (Vevő/Szállító), ÁFA kód & Kontír
  const [selectedDirectionFilter, setSelectedDirectionFilter] = useState<'ALL' | 'OUTBOUND' | 'INBOUND'>('ALL');
  const [selectedVatCodeFilter, setSelectedVatCodeFilter] = useState<string>('ALL');
  const [selectedGlFilter, setSelectedGlFilter] = useState<string>('ALL');
  const [glSearchTerm, setGlSearchTerm] = useState<string>('');

  // Pagination states
  const [pageSize, setPageSize] = useState<number>(20);
  const [groupPages, setGroupPages] = useState<Record<string, number>>({});

  // Fetch all GL accounts for preset to get names / descriptions
  const { data: glAccounts = [] } = useQuery({
    queryKey: ['glAccountsForVatAnalytics', activePresetId],
    queryFn: async () => {
      if (!activePresetId) return [];
      return await fetchAllGlAccountsByPreset(activePresetId);
    },
    enabled: !!activePresetId,
    staleTime: 60_000,
  });

  const glAccountMap = useMemo(() => {
    const map = new Map<string, string>();
    glAccounts.forEach((acc: any) => {
      const label = acc.short_name || acc.description || acc.name || '';
      map.set(acc.gl_number, label);
    });
    return map;
  }, [glAccounts]);

  // Fetch posted journal headers for company to map invoice_number -> formatted journal reference (e.g. S26/000127)
  const { data: journalMap = new Map<string, string>() } = useQuery({
    queryKey: ['accJournalHeadersByDocId', selectedCompany?.id],
    queryFn: async () => {
      if (!selectedCompany?.id) return new Map<string, string>();
      const { data, error } = await supabase
        .from('acc_journal_headers')
        .select('document_id, journal_number, accounting_year, acc_journals(code)')
        .eq('company_id', selectedCompany.id)
        .not('journal_number', 'is', null);

      if (error || !data) return new Map<string, string>();

      const map = new Map<string, string>();
      data.forEach((row: any) => {
        const code = (row.acc_journals?.code || 'SZ').toUpperCase();
        const yearShort = String(row.accounting_year || new Date().getFullYear()).slice(-2);
        const numPadded = String(row.journal_number).padStart(6, '0');
        let prefix = code;
        if (code === 'SZ') prefix = `S${yearShort}`;
        else if (code === 'V') prefix = `K${yearShort}`;
        else if (code === 'VE') prefix = 'V';
        else if (code === 'B') prefix = 'B';
        else if (code === 'P') prefix = 'P1';

        const formatted = `${prefix}/${numPadded}`;
        if (row.document_id) {
          map.set(row.document_id.trim().toUpperCase(), formatted);
        }
      });
      return map;
    },
    enabled: !!selectedCompany?.id,
    staleTime: 60_000,
  });

  // Query invoice items with VAT codes, direction & GL classifications filtered by interval
  const { data: rawItems = [], isLoading } = useQuery({
    queryKey: ['vatCollectorItems', selectedCompany?.id, effectiveDateFrom, effectiveDateTo, activePresetId, effectiveScope],
    queryFn: async () => {
      if (!selectedCompany?.id) return [];

      const [navInvsRes, subInvsRes] = await Promise.all([
        supabase
          .from('nav_invoices')
          .select('id, invoice_number, supplier_name, customer_name, invoice_delivery_date, invoice_issue_date, invoice_net_amount, invoice_vat_amount, invoice_direction, vat_row_override, vat_code_id, is_reverse_charge')
          .eq('company_id', selectedCompany.id)
          .or(`invoice_delivery_date.gte.${effectiveDateFrom},and(invoice_delivery_date.is.null,invoice_issue_date.gte.${effectiveDateFrom})`)
          .or(`invoice_delivery_date.lte.${effectiveDateTo},and(invoice_delivery_date.is.null,invoice_issue_date.lte.${effectiveDateTo})`)
          .limit(10000),
        supabase
          .from('invoices')
          .select('id, bizonylatsorszam, elado_nev, vevo_nev, teljesites_datuma, kibocsatas_datuma, adoalap_osszesen, afa_osszeg_osszesen, partner_gl_number, vat_gl_number, invoice_direction, image_url, melleklet_url, invoice_uploads_id, attachments, vat_row_override, vat_code_id, invoice_type, adomentesseg_hivatkozas')
          .eq('company_id', selectedCompany.id)
          .not('invoice_type', 'in', '("dijbekero_proforma","dijbekero","proforma","garanciajegy")')
          .or(`teljesites_datuma.gte.${effectiveDateFrom},and(teljesites_datuma.is.null,kibocsatas_datuma.gte.${effectiveDateFrom})`)
          .or(`teljesites_datuma.lte.${effectiveDateTo},and(teljesites_datuma.is.null,kibocsatas_datuma.lte.${effectiveDateTo})`)
          .limit(10000),
      ]);

      const navInvs = navInvsRes.data || [];
      const subInvs = (subInvsRes.data || []).filter((s) => !isProformaInvoice(s));

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
      // Only keep standalone manual invoices to avoid double-counting invoices already present in NAV
      const standaloneSubInvs = subInvs.filter((i) => !isProformaInvoice(i) && !existingNavNumbers.has(normalizeInvNum(i.bizonylatsorszam)));

      const navMap = new Map(navInvs.map((i) => [i.id, i]));
      const subMap = new Map(standaloneSubInvs.map((i) => [i.id, i]));
      const subByNumMap = new Map<string, any>();
      subInvs.forEach((s) => {
        if (s.bizonylatsorszam) {
          subByNumMap.set(normalizeInvNum(s.bizonylatsorszam), s);
        }
      });

      const navIds = navInvs.map((i) => i.id);
      // Fetch subItems for all submitted invoices so that if any nav_invoice lacks item details,
      // its matched submitted invoice items can be used as fallback!
      const subIds = subInvs.map((i) => i.id);

      // Safe chunked fetching in batches of 50 IDs to avoid HTTP 400 Bad Request (URI Too Long)
      const navItemPromises: any[] = [];
      for (let i = 0; i < navIds.length; i += 50) {
        const chunk = navIds.slice(i, i + 50);
        navItemPromises.push(
          supabase
            .from('nav_invoice_items')
            .select('id, nav_invoice_id, net_amount, vat_amount, vat_rate, vat_code, gl_classifications, line_description, deductible_percentage')
            .in('nav_invoice_id', chunk)
            .limit(10000)
        );
      }

      const subItemPromises: any[] = [];
      for (let i = 0; i < subIds.length; i += 50) {
        const chunk = subIds.slice(i, i + 50);
        subItemPromises.push(
          supabase
            .from('invoice_items')
            .select('id, invoice_id, net_amount, vat_amount, vat_rate, vat_code, gl_classifications, line_description, deductible_percentage')
            .in('invoice_id', chunk)
            .limit(10000)
        );
      }

      const [navChunkResults, subChunkResults] = await Promise.all([
        Promise.all(navItemPromises),
        Promise.all(subItemPromises),
      ]);

      const navItems = navChunkResults.flatMap((r) => r.data || []);
      const subItems = subChunkResults.flatMap((r) => r.data || []);

      const items: any[] = [];

      const isDrsItem = (desc?: string | null, vatAmount?: number | null, rate?: string | null) => {
        if (!desc) return false;
        const d = desc.toLowerCase();
        const isVatZero = !vatAmount || Number(vatAmount) === 0;
        const isRateNonTaxable = !rate || rate === '0' || rate === '0%' || rate.toLowerCase().includes('mentes') || rate.toLowerCase().includes('tam') || rate.toLowerCase().includes('aam') || rate.toLowerCase().includes('atk') || rate.toLowerCase().includes('ahk');
        if (isVatZero || isRateNonTaxable) {
          if (
            d.includes('visszavált') ||
            d.includes('visszavalt') ||
            d.includes('drs') ||
            d.includes('betétdíj') ||
            d.includes('betetdij') ||
            d.includes('kupakdíj') ||
            d.includes('kupakdij') ||
            d.includes('palackdíj') ||
            d.includes('palackdij')
          ) {
            return true;
          }
        }
        return false;
      };

      const getCode = (
        rate: string | null,
        overrideCode?: string | null,
        desc?: string | null,
        vatAmount?: number | null,
        isOutbound?: boolean,
        adomentessegHivatkozas?: string | null
      ) => {
        if (isDrsItem(desc, vatAmount, rate)) {
          return isCroatia ? 'AHK' : 'ÁHK';
        }

        if (overrideCode && overrideCode.trim()) {
          const oc = overrideCode.trim().toUpperCase();
          if (['25', '13', '05', '18', 'FAD', 'TAM', 'AAM', 'EXP', 'ÁHK', 'AHK'].includes(oc)) {
            return oc === 'AHK' ? (isCroatia ? 'AHK' : 'ÁHK') : oc;
          }
          if (oc.includes('FORD') || oc.includes('FAD')) return 'FAD';
          if (oc.includes('27') || oc.includes('25')) return '25';
          if (oc.includes('13')) return '13';
          if (oc.includes('05') || oc.includes('_5_') || oc.endsWith('_5')) return '05';
          if (oc.includes('18')) return '18';
          if (oc.includes('TAM') || oc.includes('0_LEV') || oc.includes('MENTES')) return 'TAM';
          if (oc.includes('AAM') || oc.includes('ALANYI')) return 'AAM';
          if (oc.includes('EXP') || oc.includes('EXPORT')) return 'EXP';
          if (oc.includes('AHK') || oc.includes('ÁHK') || oc.includes('DRS') || oc.includes('KIVUL')) return isCroatia ? 'AHK' : 'ÁHK';
          return overrideCode.trim();
        }

        const isVatZero = vatAmount === 0 || !vatAmount || Number(vatAmount) === 0;

        if (!rate) {
          if (isVatZero) {
            const hivatkozas = (adomentessegHivatkozas || '').toLowerCase();
            if (hivatkozas.includes('alanyi') || hivatkozas.includes('aam') || isOutbound) {
              return 'AAM';
            }
            return 'TAM';
          }
          return '25';
        }

        const u = rate.toUpperCase();
        if (u.includes('FAD') || u.includes('FORD') || u.includes('F.AFA') || u.includes('F_AFA') || u.includes('FAFA') || u.includes('REVERSE_CHARGE')) return 'FAD';
        if (rate === '0.27' || rate === '27' || rate === '27.0' || rate === '27.00' || rate === '27%' || rate === '0.25' || rate === '25' || rate === '25.0' || rate === '25.00' || rate === '25%') return '25';
        if (rate === '0.13' || rate === '13' || rate === '13.0' || rate === '13.00' || rate === '13%') return '13';
        if (rate === '0.05' || rate === '5' || rate === '5.0' || rate === '5.00' || rate === '5%') return '05';
        if (rate === '0.18' || rate === '18' || rate === '18.0' || rate === '18.00' || rate === '18%') return '18';
        if (u.includes('AAM') || u.includes('ALANYI')) return 'AAM';
        if (u.includes('TAM') || u.includes('TARGYI')) return 'TAM';
        if (u.includes('EXP')) return 'EXP';
        if (u.includes('AHK') || u.includes('ÁHK') || u.includes('ATK') || u.includes('KIVUL')) return isCroatia ? 'AHK' : 'ÁHK';
        if (u === '0' || u === '0%' || u === '0.00' || u === 'MENTES') {
          const hivatkozas = (adomentessegHivatkozas || '').toLowerCase();
          if (hivatkozas.includes('alanyi') || hivatkozas.includes('aam') || isOutbound) {
            return 'AAM';
          }
          return 'TAM';
        }

        if (isVatZero) {
          return isOutbound ? 'AAM' : 'TAM';
        }

        return '25';
      };

      const resolveItemGl = (glClassifications: any) => {
        if (!glClassifications) return null;
        if (activePresetId && glClassifications[activePresetId]?.gl_number) {
          return String(glClassifications[activePresetId].gl_number);
        }
        const firstVal = Object.values(glClassifications)[0] as any;
        return firstVal?.gl_number ? String(firstVal.gl_number) : null;
      };

      // Build map of subItems by invoice_id so nav_invoices without items can fall back to their matched uploaded invoice items
      const subItemsByInvId = new Map<string, any[]>();
      subItems.forEach((item: any) => {
        if (!subItemsByInvId.has(item.invoice_id)) {
          subItemsByInvId.set(item.invoice_id, []);
        }
        subItemsByInvId.get(item.invoice_id)!.push(item);
      });

      // Process nav items - aggregated by (nav_invoice_id + code + gl_number + vat_code + dedPct)
      // so each invoice appears cleanly as a document entry per VAT code & GL classification
      const processedNavIds = new Set<string>();
      const navItemAggMap = new Map<string, any>();

      navItems.forEach((i: any) => {
        processedNavIds.add(i.nav_invoice_id);
        const inv = navMap.get(i.nav_invoice_id);
        const direction = ((inv as any)?.invoice_direction || 'INBOUND').toUpperCase() as 'INBOUND' | 'OUTBOUND';
        const isOutbound = direction === 'OUTBOUND';
        if (!isOutbound && effectiveScope === 'with_image') {
          const invNum = normalizeInvNum(inv?.invoice_number);
          if (!subWithImageByNum.has(invNum)) {
            return; // Inbound item without invoice scan skipped in with_image scope
          }
        }

        const matchedSub = subByNumMap.get(normalizeInvNum(inv?.invoice_number));
        const code = getCode(
          i.vat_rate,
          i.vat_code,
          i.line_description,
          i.vat_amount,
          isOutbound,
          matchedSub?.adomentesseg_hivatkozas
        );
        const glNum = resolveItemGl(i.gl_classifications) || resolveItemGl((inv as any)?.gl_classifications);
        const vatCode = i.vat_code || null;
        const override = (inv as any)?.vat_row_override || null;
        const isAdvance =
          (inv as any)?.invoice_type === 'ADVANCE' ||
          (inv as any)?.invoice_type === 'elolegszamla' ||
          override === '45' ||
          i.vat_code === 'KIM_27_ELOLEG' ||
          (i.vat_code && i.vat_code.includes('ELOLEG')) ||
          (i.line_description && (i.line_description.toLowerCase().includes('előleg') || i.line_description.toLowerCase().includes('eloleg')));
        const isTangibleAsset =
          override === '77' ||
          i.vat_code === 'BE_27_TARGYESZKOZ' ||
          i.vat_code === 'BEJ_27_TARGYESZKOZ' ||
          (i.vat_code && i.vat_code.includes('TARGYESZKOZ')) ||
          (glNum && (glNum.startsWith('16') || glNum.startsWith('12') || glNum.startsWith('13') || glNum.startsWith('14')));

        const dedPct = i.deductible_percentage != null ? Number(i.deductible_percentage) : 100;
        const aggKey = `${i.nav_invoice_id}_${code}_${glNum || 'none'}_${vatCode || 'none'}_${dedPct}`;
        const dateStr = inv?.invoice_delivery_date || inv?.invoice_issue_date || '';

        const net = Number(i.net_amount) || 0;
        let vat = Number(i.vat_amount) || 0;
        if (code === 'FAD' && !isOutbound && vat === 0 && net !== 0) {
          vat = Math.round(net * 0.27);
        }

        if (navItemAggMap.has(aggKey)) {
          const existing = navItemAggMap.get(aggKey);
          existing.net_amount += net;
          existing.vat_amount += vat;
          existing.gross_amount += (net + vat);
          existing.is_advance = existing.is_advance || isAdvance;
          existing.is_tangible_asset = existing.is_tangible_asset || isTangibleAsset;
          existing.line_description = existing.line_description || i.line_description || null;
        } else {
          const resolvedCustomer = inv?.customer_name || matchedSub?.vevo_nev;
          const isCustomerFromSubmitted = isOutbound && !inv?.customer_name && !!matchedSub?.vevo_nev;
          const partnerName = isOutbound
            ? (resolvedCustomer || t('accounting:vat_return.analytics_view.unknown_customer', 'Ismeretlen vevő'))
            : (inv?.supplier_name || matchedSub?.elado_nev || t('accounting:vat_return.analytics_view.unknown_supplier', 'Ismeretlen szállító'));

          navItemAggMap.set(aggKey, {
            id: `nav_${i.nav_invoice_id}_${code}_${glNum || 'none'}_${dedPct}`,
            invoice_id: i.nav_invoice_id,
            code,
            vat_code: vatCode,
            gl_number: glNum,
            direction,
            partner_gl_number: (inv as any)?.partner_gl_number || null,
            vat_gl_number: (inv as any)?.vat_gl_number || null,
            invoice_number: inv?.invoice_number || t('accounting:vat_return.analytics_view.unnamed_invoice', 'Névtelen'),
            partner_name: partnerName,
            is_customer_from_submitted: isCustomerFromSubmitted,
            fulfillment_date: dateStr,
            net_amount: net,
            vat_amount: vat,
            gross_amount: net + vat,
            is_advance: isAdvance,
            is_tangible_asset: isTangibleAsset,
            vat_row_override: override,
            line_description: i.line_description || null,
            deductible_percentage: dedPct,
          });
        }
      });

      // Fallback for nav_invoices without item records yet
      navInvs.forEach((inv: any) => {
        if (!processedNavIds.has(inv.id)) {
          const direction = ((inv as any)?.invoice_direction || 'INBOUND').toUpperCase() as 'INBOUND' | 'OUTBOUND';
          const isOutbound = direction === 'OUTBOUND';
          if (!isOutbound && effectiveScope === 'with_image') {
            const invNum = normalizeInvNum(inv?.invoice_number);
            if (!subWithImageByNum.has(invNum)) {
              return;
            }
          }

          const matchedSub = subByNumMap.get(normalizeInvNum(inv?.invoice_number));
          const fallbackItems = matchedSub ? subItemsByInvId.get(matchedSub.id) : null;

          if (fallbackItems && fallbackItems.length > 0) {
            fallbackItems.forEach((i: any) => {
              const code = getCode(
                i.vat_rate,
                i.vat_code,
                i.line_description,
                i.vat_amount,
                isOutbound,
                matchedSub?.adomentesseg_hivatkozas
              );
              const glNum = resolveItemGl(i.gl_classifications) || resolveItemGl((inv as any)?.gl_classifications) || resolveItemGl(matchedSub?.gl_classifications);
              const vatCode = i.vat_code || null;
              const override = (inv as any)?.vat_row_override || matchedSub?.vat_row_override || null;
              const isAdvance =
                (inv as any)?.invoice_type === 'ADVANCE' ||
                (inv as any)?.invoice_type === 'elolegszamla' ||
                matchedSub?.invoice_type === 'ADVANCE' ||
                matchedSub?.invoice_type === 'elolegszamla' ||
                override === '45' ||
                i.vat_code === 'KIM_27_ELOLEG' ||
                (i.vat_code && i.vat_code.includes('ELOLEG')) ||
                (i.line_description && (i.line_description.toLowerCase().includes('előleg') || i.line_description.toLowerCase().includes('eloleg')));
              const isTangibleAsset =
                override === '77' ||
                i.vat_code === 'BE_27_TARGYESZKOZ' ||
                i.vat_code === 'BEJ_27_TARGYESZKOZ' ||
                (i.vat_code && i.vat_code.includes('TARGYESZKOZ')) ||
                (glNum && (glNum.startsWith('16') || glNum.startsWith('12') || glNum.startsWith('13') || glNum.startsWith('14')));

              const dedPct = i.deductible_percentage != null ? Number(i.deductible_percentage) : 100;
              const aggKey = `${inv.id}_${code}_${glNum || 'none'}_${vatCode || 'none'}_${dedPct}`;
              const dateStr = inv?.invoice_delivery_date || inv?.invoice_issue_date || matchedSub?.teljesites_datuma || '';

              const net = Number(i.net_amount) || 0;
              let vat = Number(i.vat_amount) || 0;
              if (code === 'FAD' && !isOutbound && vat === 0 && net !== 0) {
                vat = Math.round(net * 0.27);
              }

              if (navItemAggMap.has(aggKey)) {
                const existing = navItemAggMap.get(aggKey);
                existing.net_amount += net;
                existing.vat_amount += vat;
                existing.gross_amount += (net + vat);
                existing.is_advance = existing.is_advance || isAdvance;
                existing.is_tangible_asset = existing.is_tangible_asset || isTangibleAsset;
                existing.line_description = existing.line_description || i.line_description || null;
              } else {
                const resolvedCustomer = inv?.customer_name || matchedSub?.vevo_nev;
                const isCustomerFromSubmitted = isOutbound && !inv?.customer_name && !!matchedSub?.vevo_nev;
                const partnerName = isOutbound
                  ? (resolvedCustomer || t('accounting:vat_return.analytics_view.unknown_customer', 'Ismeretlen vevő'))
                  : (inv?.supplier_name || matchedSub?.elado_nev || t('accounting:vat_return.analytics_view.unknown_supplier', 'Ismeretlen szállító'));

                navItemAggMap.set(aggKey, {
                  id: `nav_fallback_${inv.id}_${i.id}`,
                  invoice_id: inv.id,
                  code,
                  vat_code: vatCode,
                  gl_number: glNum,
                  direction,
                  partner_gl_number: (inv as any)?.partner_gl_number || matchedSub?.partner_gl_number || null,
                  vat_gl_number: (inv as any)?.vat_gl_number || matchedSub?.vat_gl_number || null,
                  invoice_number: inv?.invoice_number || matchedSub?.bizonylatsorszam || t('accounting:vat_return.analytics_view.unnamed_invoice', 'Névtelen'),
                  partner_name: partnerName,
                  is_customer_from_submitted: isCustomerFromSubmitted,
                  fulfillment_date: dateStr,
                  net_amount: net,
                  vat_amount: vat,
                  gross_amount: net + vat,
                  is_advance: isAdvance,
                  is_tangible_asset: isTangibleAsset,
                  vat_row_override: override,
                  line_description: i.line_description || null,
                  deductible_percentage: dedPct,
                });
              }
            });
            processedNavIds.add(inv.id);
            return;
          }

          const net = Number(inv.invoice_net_amount || 0);
          const vat = Number(inv.invoice_vat_amount || 0);
          if (net !== 0 || vat !== 0) {
            const isFad = (inv as any).is_reverse_charge || (inv as any).vat_row_override === '29' || (inv as any).vat_row_override === '04';
            const rate = net > 0 ? vat / net : 0;
            const code = isFad ? 'FAD' : (Math.round(rate * 100) === 27 || Math.round(rate * 100) === 25 ? '25' : Math.round(rate * 100) === 18 ? '18' : Math.round(rate * 100) === 13 ? '13' : Math.round(rate * 100) === 5 ? '05' : vat === 0 ? (isOutbound || matchedSub?.adomentesseg_hivatkozas?.includes('AAM') ? 'AAM' : 'TAM') : '25');
            let effectiveVat = vat;
            if (code === 'FAD' && !isOutbound && vat === 0 && net !== 0) {
              effectiveVat = Math.round(net * 0.27);
            }
            const dateStr = inv.invoice_delivery_date || inv.invoice_issue_date || '';
            const resolvedCustomer = inv?.customer_name || matchedSub?.vevo_nev;
            const isCustomerFromSubmitted = isOutbound && !inv?.customer_name && !!matchedSub?.vevo_nev;
            const partnerName = isOutbound
              ? (resolvedCustomer || t('accounting:vat_return.analytics_view.unknown_customer', 'Ismeretlen vevő'))
              : (inv?.supplier_name || matchedSub?.elado_nev || t('accounting:vat_return.analytics_view.unknown_supplier', 'Ismeretlen szállító'));
            const override = (inv as any)?.vat_row_override || null;
            const glNum = resolveItemGl((inv as any)?.gl_classifications);
            const isAdvance = (inv as any)?.invoice_type === 'ADVANCE' || override === '45';
            const isTangibleAsset = override === '77' || (glNum && (glNum.startsWith('16') || glNum.startsWith('12') || glNum.startsWith('13') || glNum.startsWith('14')));

            items.push({
              id: `nav_inv_${inv.id}`,
              invoice_id: inv.id,
              code,
              vat_code: null,
              gl_number: glNum,
              direction,
              partner_gl_number: (inv as any)?.partner_gl_number || null,
              vat_gl_number: (inv as any)?.vat_gl_number || null,
              invoice_number: inv.invoice_number || t('accounting:vat_return.analytics_view.unnamed_invoice', 'Névtelen'),
              partner_name: partnerName,
              is_customer_from_submitted: isCustomerFromSubmitted,
              fulfillment_date: dateStr,
              net_amount: net,
              vat_amount: effectiveVat,
              gross_amount: net + effectiveVat,
              is_advance: isAdvance,
              is_tangible_asset: isTangibleAsset,
              vat_row_override: override,
              deductible_percentage: 100,
            });
          }
        }
      });

      items.push(...Array.from(navItemAggMap.values()));

      const processedSubIds = new Set<string>();
      const subItemAggMap = new Map<string, any>();

      subItems.forEach((i: any) => {
        const inv = subMap.get(i.invoice_id);
        if (!inv) return;
        processedSubIds.add(i.invoice_id);
        const direction = ((inv as any)?.invoice_direction || 'INBOUND').toUpperCase() as 'INBOUND' | 'OUTBOUND';
        const isOutbound = direction === 'OUTBOUND';
        if (!isOutbound && effectiveScope === 'with_image') {
          if (!hasImg(inv)) {
            return;
          }
        }

        const code = getCode(
          i.vat_rate,
          i.vat_code,
          i.line_description,
          i.vat_amount,
          isOutbound,
          (inv as any)?.adomentesseg_hivatkozas
        );
        const glNum = resolveItemGl(i.gl_classifications) || resolveItemGl((inv as any)?.gl_classifications);
        const vatCode = i.vat_code || null;
        const override = (inv as any)?.vat_row_override || null;
        const isAdvance =
          (inv as any)?.invoice_type === 'ADVANCE' ||
          (inv as any)?.invoice_type === 'elolegszamla' ||
          override === '45' ||
          i.vat_code === 'KIM_27_ELOLEG' ||
          (i.vat_code && i.vat_code.includes('ELOLEG')) ||
          (i.line_description && (i.line_description.toLowerCase().includes('előleg') || i.line_description.toLowerCase().includes('eloleg')));
        const isTangibleAsset =
          override === '77' ||
          i.vat_code === 'BE_27_TARGYESZKOZ' ||
          i.vat_code === 'BEJ_27_TARGYESZKOZ' ||
          (i.vat_code && i.vat_code.includes('TARGYESZKOZ')) ||
          (glNum && (glNum.startsWith('16') || glNum.startsWith('12') || glNum.startsWith('13') || glNum.startsWith('14')));

        const dedPct = i.deductible_percentage != null ? Number(i.deductible_percentage) : 100;
        const aggKey = `${i.invoice_id}_${code}_${glNum || 'none'}_${vatCode || 'none'}_${dedPct}`;
        const dateStr = inv?.teljesites_datuma || inv?.kibocsatas_datuma || '';

        const net = Number(i.net_amount) || 0;
        let vat = Number(i.vat_amount) || 0;
        if (code === 'FAD' && !isOutbound && vat === 0 && net !== 0) {
          vat = Math.round(net * 0.27);
        }

        if (subItemAggMap.has(aggKey)) {
          const existing = subItemAggMap.get(aggKey);
          existing.net_amount += net;
          existing.vat_amount += vat;
          existing.gross_amount += (net + vat);
          existing.is_advance = existing.is_advance || isAdvance;
          existing.is_tangible_asset = existing.is_tangible_asset || isTangibleAsset;
          existing.line_description = existing.line_description || i.line_description || null;
        } else {
          const partnerName = isOutbound
            ? (inv?.vevo_nev || t('accounting:vat_return.analytics_view.unknown_customer', 'Ismeretlen vevő'))
            : (inv?.elado_nev || t('accounting:vat_return.analytics_view.unknown_supplier', 'Ismeretlen szállító'));

          subItemAggMap.set(aggKey, {
            id: `sub_${i.invoice_id}_${code}_${glNum || 'none'}_${dedPct}`,
            invoice_id: i.invoice_id,
            code,
            vat_code: vatCode,
            gl_number: glNum,
            direction,
            partner_gl_number: (inv as any)?.partner_gl_number || null,
            vat_gl_number: (inv as any)?.vat_gl_number || null,
            invoice_number: inv?.bizonylatsorszam || t('accounting:vat_return.analytics_view.unnamed_invoice', 'Névtelen'),
            partner_name: partnerName,
            is_customer_from_submitted: isOutbound && !!inv?.vevo_nev,
            fulfillment_date: dateStr,
            net_amount: net,
            vat_amount: vat,
            gross_amount: net + vat,
            is_advance: isAdvance,
            is_tangible_asset: isTangibleAsset,
            vat_row_override: override,
            line_description: i.line_description || null,
            deductible_percentage: dedPct,
          });
        }
      });

      items.push(...Array.from(subItemAggMap.values()));

      // Fallback for manual invoices without item records yet
      standaloneSubInvs.forEach((inv: any) => {
        if (!processedSubIds.has(inv.id)) {
          const direction = ((inv as any)?.invoice_direction || 'INBOUND').toUpperCase() as 'INBOUND' | 'OUTBOUND';
          const isOutbound = direction === 'OUTBOUND';
          if (!isOutbound && effectiveScope === 'with_image') {
            if (!hasImg(inv)) {
              return;
            }
          }
          const net = Number(inv.adoalap_osszesen || 0);
          const vat = Number(inv.afa_osszeg_osszesen || 0);
          if (net !== 0 || vat !== 0) {
            const isFad = (inv as any).is_reverse_charge || (inv as any).forditott_adozas || (inv as any).vat_row_override === '29' || (inv as any).vat_row_override === '04';
            const rate = net > 0 ? vat / net : 0;
            const code = isFad ? 'FAD' : (Math.round(rate * 100) === 27 || Math.round(rate * 100) === 25 ? '25' : Math.round(rate * 100) === 18 ? '18' : Math.round(rate * 100) === 13 ? '13' : Math.round(rate * 100) === 5 ? '05' : vat === 0 ? (isOutbound || inv.adomentesseg_hivatkozas?.includes('AAM') ? 'AAM' : 'TAM') : '25');
            let effectiveVat = vat;
            if (code === 'FAD' && !isOutbound && vat === 0 && net !== 0) {
              effectiveVat = Math.round(net * 0.27);
            }
            const dateStr = inv.teljesites_datuma || inv.kibocsatas_datuma || '';
            const partnerName = isOutbound
              ? (inv.vevo_nev || t('accounting:vat_return.analytics_view.unknown_customer', 'Ismeretlen vevő'))
              : (inv.elado_nev || t('accounting:vat_return.analytics_view.unknown_supplier', 'Ismeretlen szállító'));
            const override = (inv as any)?.vat_row_override || null;
            const glNum = resolveItemGl((inv as any)?.gl_classifications);
            const isAdvance = (inv as any)?.invoice_type === 'ADVANCE' || (inv as any)?.invoice_type === 'elolegszamla' || override === '45';
            const isTangibleAsset = override === '77' || (glNum && (glNum.startsWith('16') || glNum.startsWith('12') || glNum.startsWith('13') || glNum.startsWith('14')));

            items.push({
              id: `sub_inv_${inv.id}`,
              invoice_id: inv.id,
              code,
              vat_code: null,
              gl_number: glNum,
              direction,
              partner_gl_number: (inv as any)?.partner_gl_number || null,
              vat_gl_number: (inv as any)?.vat_gl_number || null,
              invoice_number: inv.bizonylatsorszam || t('accounting:vat_return.analytics_view.unnamed_invoice', 'Névtelen'),
              partner_name: partnerName,
              is_customer_from_submitted: isOutbound && !!inv?.vevo_nev,
              fulfillment_date: dateStr,
              net_amount: net,
              vat_amount: effectiveVat,
              gross_amount: net + effectiveVat,
              is_advance: isAdvance,
              is_tangible_asset: isTangibleAsset,
              vat_row_override: override,
              deductible_percentage: 100,
            });
          }
        }
      });

      return items;
    },
    enabled: !!selectedCompany?.id,
  });

  // Calculate direction counts for tabs based on unique invoices
  const directionCounts = useMemo(() => {
    const seenOutbound = new Set<string>();
    const seenInbound = new Set<string>();
    rawItems.forEach((i) => {
      if (i.direction === 'OUTBOUND') {
        seenOutbound.add(i.invoice_number);
      } else {
        seenInbound.add(i.invoice_number);
      }
    });
    return { all: seenOutbound.size + seenInbound.size, outbound: seenOutbound.size, inbound: seenInbound.size };
  }, [rawItems]);

  // Calculate distinct available ÁFA codes present in rawItems
  const availableVatCodes = useMemo(() => {
    const set = new Set<string>();
    rawItems.forEach((item) => {
      if (item.code) set.add(item.code);
      if (item.vat_code) set.add(item.vat_code);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'hu'));
  }, [rawItems]);

  // Calculate distinct available GL accounts present in rawItems
  const availableGlAccounts = useMemo(() => {
    const set = new Set<string>();
    let hasUnclassified = false;
    rawItems.forEach((item) => {
      if (item.gl_number) {
        set.add(item.gl_number);
      } else {
        hasUnclassified = true;
      }
      if (item.partner_gl_number) {
        set.add(item.partner_gl_number);
      }
      if (item.vat_gl_number) {
        set.add(item.vat_gl_number);
      }
    });

    const accounts = Array.from(set).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    return { accounts, hasUnclassified };
  }, [rawItems]);

  // Helper for friendly VAT code descriptions in filter dropdown
  const getVatCodeLabel = (code: string) => {
    switch (code) {
      case '25': return isCroatia
        ? t('accounting:vat_return.analytics_view.codes.25_hr', 'Standardna stopa 25% (Zbirni kod 25)')
        : t('accounting:vat_return.analytics_view.codes.25', 'Normál belföldi 27% (Gyűjtőkód 25)');
      case '13': return t('accounting:vat_return.analytics_view.codes.13', isCroatia ? 'Snižena stopa 13%' : 'Kedvezményes 13%');
      case '05': return t('accounting:vat_return.analytics_view.codes.05', isCroatia ? 'Sniženi tuzemni 5%' : 'Kedvezményes belföldi 5% (Gyűjtőkód 05)');
      case '18': return t('accounting:vat_return.analytics_view.codes.18', 'Kedvezményes belföldi 18% (Gyűjtőkód 18)');
      case 'FAD': return t('accounting:vat_return.analytics_view.codes.FAD', 'Fordított adózás (FAD)');
      case 'AAM': return t('accounting:vat_return.analytics_view.codes.AAM', 'Alanyi adómentes (AAM)');
      case 'TAM': return t('accounting:vat_return.analytics_view.codes.TAM', 'Tárgyi adómentes (TAM)');
      case 'EXP': return t('accounting:vat_return.analytics_view.codes.EXP', 'Termékexport (EXP)');
      case 'AHK':
      case 'ÁHK': return t('accounting:vat_return.analytics_view.codes.AHK', 'Áfa hatályán kívüli (ÁHK)');
      default: return code;
    }
  };

  // Filter raw items based on active filters (Direction, ÁFA kód & Kontír)
  const filteredItems = useMemo(() => {
    return rawItems.filter((item) => {
      // 1. Irány (Vevő / Szállító) filter
      if (selectedDirectionFilter !== 'ALL') {
        if (item.direction !== selectedDirectionFilter) return false;
      }

      // 2. ÁFA kód filter
      if (selectedVatCodeFilter !== 'ALL') {
        const matchCollector = item.code === selectedVatCodeFilter;
        const matchVatCode = item.vat_code === selectedVatCodeFilter;
        if (!matchCollector && !matchVatCode) return false;
      }

      // 3. Kontír dropdown filter
      if (selectedGlFilter !== 'ALL') {
        if (selectedGlFilter === 'UNCLASSIFIED') {
          if (item.gl_number) return false;
        } else {
          const matchNetGl = item.gl_number === selectedGlFilter;
          const matchPartnerGl = item.partner_gl_number === selectedGlFilter;
          const matchVatGl = item.vat_gl_number === selectedGlFilter;
          if (!matchNetGl && !matchPartnerGl && !matchVatGl) return false;
        }
      }

      // 4. Quick search term (invoice, partner, GL number, GL name, VAT code)
      if (glSearchTerm.trim()) {
        const term = glSearchTerm.trim().toLowerCase();
        const matchInvoice = item.invoice_number ? item.invoice_number.toLowerCase().includes(term) : false;
        const matchPartner = item.partner_name ? item.partner_name.toLowerCase().includes(term) : false;
        const matchNet = item.gl_number ? item.gl_number.toLowerCase().includes(term) : false;
        const matchPartnerGl = item.partner_gl_number ? item.partner_gl_number.toLowerCase().includes(term) : false;
        const matchVatGl = item.vat_gl_number ? item.vat_gl_number.toLowerCase().includes(term) : false;
        const matchGlName = item.gl_number && glAccountMap.get(item.gl_number)?.toLowerCase().includes(term);
        const matchVatCode = (item.vat_code || item.code)?.toLowerCase().includes(term);
        if (!matchInvoice && !matchPartner && !matchNet && !matchPartnerGl && !matchVatGl && !matchGlName && !matchVatCode) return false;
      }

      return true;
    });
  }, [rawItems, selectedDirectionFilter, selectedVatCodeFilter, selectedGlFilter, glSearchTerm, glAccountMap]);

  // Active sub-filters (Search, ÁFA kód, Kontír - excluding Direction, which is the main view tab)
  const hasActiveSubFilters =
    selectedVatCodeFilter !== 'ALL' ||
    selectedGlFilter !== 'ALL' ||
    glSearchTerm.trim() !== '';

  const handleResetSubFilters = () => {
    setSelectedVatCodeFilter('ALL');
    setSelectedGlFilter('ALL');
    setGlSearchTerm('');
  };

  // Scope total for the active direction tab (before sub-filters)
  const currentScopeTotal =
    selectedDirectionFilter === 'OUTBOUND'
      ? directionCounts.outbound
      : selectedDirectionFilter === 'INBOUND'
      ? directionCounts.inbound
      : directionCounts.all;

  // Group filtered items into VAT collector groups or NAV declaration row groups
  const groups = useMemo<VatCollectorGroup[]>(() => {
    const map = new Map<string, VatCollectorGroup>();

    filteredItems.forEach((item) => {
      if (viewMode === 'row') {
        const declRows = getItemDeclarationRows(item);
        declRows.forEach((dr) => {
          const rowKey = dr.row;
          if (!map.has(rowKey)) {
            map.set(rowKey, {
              code: rowKey,
              label: getDeclarationRowLabel(rowKey),
              items: [],
              total_net: 0,
              total_vat: 0,
              total_gross: 0,
            });
          }
          const grp = map.get(rowKey)!;
          grp.items.push({
            ...item,
            declaration_row: dr.row,
            net_amount: dr.base,
            vat_amount: dr.vat,
            gross_amount: dr.gross,
          });
          grp.total_net += dr.base;
          grp.total_vat += dr.vat;
          grp.total_gross += dr.gross;
        });
      } else {
        if (!map.has(item.code)) {
          map.set(item.code, {
            code: item.code,
            label: getVatCodeLabel(item.code),
            items: [],
            total_net: 0,
            total_vat: 0,
            total_gross: 0,
          });
        }

        const grp = map.get(item.code)!;
        const isOutbound = item.direction === 'OUTBOUND';
        const dedPct = item.deductible_percentage != null ? Number(item.deductible_percentage) : 100;
        const effNet = (!isOutbound && dedPct < 100) ? Math.round(item.net_amount * (dedPct / 100)) : item.net_amount;
        const effVat = (!isOutbound && dedPct < 100) ? Math.round(item.vat_amount * (dedPct / 100)) : item.vat_amount;
        const effGross = (!isOutbound && dedPct < 100) ? (effNet + effVat) : item.gross_amount;

        grp.items.push({
          ...item,
          effective_net: effNet,
          effective_vat: effVat,
          effective_gross: effGross,
        });
        grp.total_net += effNet;
        grp.total_vat += effVat;
        grp.total_gross += effGross;
      }
    });

    if (viewMode === 'row') {
      return Array.from(map.values()).sort((a, b) => {
        const numA = parseInt(a.code.replace(/\D/g, ''), 10);
        const numB = parseInt(b.code.replace(/\D/g, ''), 10);
        if (!isNaN(numA) && !isNaN(numB) && numA !== numB) {
          return numA - numB;
        }
        return a.code.localeCompare(b.code, 'hu', { numeric: true });
      });
    }

    return Array.from(map.values()).sort((a, b) => a.code.localeCompare(b.code));
  }, [filteredItems, viewMode, t, isCroatia]);

  const handleDirectionChange = (newDir: 'ALL' | 'OUTBOUND' | 'INBOUND') => {
    if (selectedDirectionFilter === newDir) return;
    setSelectedDirectionFilter(newDir);
    setCollapsedCodes(new Set());
    setGroupPages({});
  };

  const toggleExpand = (code: string) => {
    setCollapsedCodes((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  };

  const areAnyExpanded = groups.length > 0 && groups.some((g) => !collapsedCodes.has(g.code));
  const toggleExpandAll = () => {
    if (areAnyExpanded) {
      setCollapsedCodes(new Set(groups.map((g) => g.code)));
    } else {
      setCollapsedCodes(new Set());
    }
  };

  const handleExport = async () => {
    if (groups.length === 0) return;
    setIsExporting(true);
    try {
      await exportVatCollectorAnalyticsExcel(
        groups,
        selectedCompany?.name || (isCroatia ? 'Tvrtka' : 'Cég'),
        `${effectiveDateFrom} – ${effectiveDateTo}`,
        targetCurrency,
        viewMode
      );
      toast({
        title: t('accounting:vat_return.analytics_view.toast_export_success_title', 'Sikeres exportálás'),
        description: viewMode === 'row'
          ? (isCroatia ? 'Izvoz analitike po retcima PDV obrasca je dovršen.' : 'A 2665 Bevallási Sor Analitika Excel fájl elkészült.')
          : t('accounting:vat_return.analytics_view.toast_export_success_desc', 'Az ÁFA Gyűjtőkódos Analitika Excel fájl elkészült.'),
      });
    } catch (e: any) {
      toast({ title: t('common:status.error', 'Export hiba'), description: e.message, variant: 'destructive' });
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportPdf = async () => {
    if (groups.length === 0) return;
    setIsExportingPdf(true);
    try {
      const activeYear = year || (effectiveDateFrom ? parseInt(effectiveDateFrom.substring(0, 4), 10) : new Date().getFullYear());
      downloadVatAnalyticsPdf({
        groups,
        companyName: selectedCompany?.name || (isCroatia ? 'Tvrtka' : 'Cég'),
        companyTaxNumber: (selectedCompany as any)?.tax_number || (selectedCompany as any)?.adoszam || undefined,
        year: activeYear,
        dateFrom: effectiveDateFrom,
        dateTo: effectiveDateTo,
        targetCurrency,
        viewMode,
        journalMap,
      });
      toast({
        title: t('accounting:vat_return.analytics_view.toast_export_success_title', 'Sikeres exportálás'),
        description: viewMode === 'row'
          ? (isCroatia ? 'Izvoz analitike PDV obrasca u PDF je dovršen.' : 'A 2665 Bevallási Sor Analitika PDF riport elkészült.')
          : t('accounting:vat_return.analytics_view.toast_export_pdf_success_desc', 'Az ÁFA Gyűjtőkódos Analitika PDF riport elkészült.'),
      });
    } catch (e: any) {
      toast({ title: t('common:status.error', 'Export hiba'), description: e.message, variant: 'destructive' });
    } finally {
      setIsExportingPdf(false);
    }
  };

  const totals = useMemo(() => {
    return groups.reduce(
      (acc, g) => ({
        net: acc.net + g.total_net,
        vat: acc.vat + g.total_vat,
        gross: acc.gross + g.total_gross,
      }),
      { net: 0, vat: 0, gross: 0 }
    );
  }, [groups]);

  return (
    <Card className="border-border/50 shadow-sm">
      <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4">
        <div>
          <CardTitle className="text-lg font-bold flex items-center gap-2">
            <Layers className="h-5 w-5 text-primary" />
            {viewMode === 'row'
              ? (isCroatia ? 'Analitički Pregled po Retcima PDV Obrasca' : 'NAV 2665 Bevallási Sor Szerinti Analitikus Kimutatás')
              : t('accounting:vat_return.analytics_view.card_title', 'ÁFA Gyűjtőkód Szerinti Analitikus Kimutatás')}
          </CardTitle>
          <CardDescription>
            {viewMode === 'row'
              ? (isCroatia ? 'Dokumenti grupirani prema službenim retcima obrasca PDV-a.' : 'A 2665-ös ÁFA bevallás hivatalos adóhatósági sorai (07, 45, 63, 66, 77 stb.) szerint rendezett bizonylat-analitika.')
              : t('accounting:vat_return.analytics_view.card_description', 'NAV adóhatósági ellenőrzéseknek megfelelő bizonylat-analitika ÁFA gyűjtőkódonként csoportosítva.')}
          </CardDescription>
          <div className="flex flex-wrap items-center gap-2 mt-2">
            <Badge variant="secondary" className="font-mono text-xs bg-muted/60 text-foreground border border-border">
              {t('accounting:vat_return.analytics_view.active_period', 'Szűrt időszak:')} {effectiveDateFrom} – {effectiveDateTo}
            </Badge>
            <Badge
              variant="outline"
              className={cn(
                'text-[11px] font-medium px-2 py-0.5 whitespace-nowrap',
                effectiveScope === 'with_image'
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300'
                  : 'bg-blue-50 text-blue-700 border-blue-300 dark:bg-blue-950/40 dark:text-blue-300'
              )}
            >
              {effectiveScope === 'with_image' ? 'Csak számlaképpel' : 'Minden számla'}
            </Badge>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0 self-end sm:self-auto">
          {/* Nézetmód választó: Gyűjtőkód vs Bevallási sor */}
          <div className="inline-flex items-center p-0.5 bg-muted/60 rounded-lg border border-border/60 shrink-0">
            <button
              type="button"
              onClick={() => {
                setViewMode('collector');
                setCollapsedCodes(new Set());
                setGroupPages({});
              }}
              className={cn(
                "h-8 px-2.5 text-xs font-medium rounded-md transition-all cursor-pointer flex items-center gap-1.5",
                viewMode === 'collector'
                  ? "bg-background text-foreground shadow-xs font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Layers className="h-3.5 w-3.5" />
              <span>Gyűjtőkód szerint</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setViewMode('row');
                setCollapsedCodes(new Set());
                setGroupPages({});
              }}
              className={cn(
                "h-8 px-2.5 text-xs font-medium rounded-md transition-all cursor-pointer flex items-center gap-1.5",
                viewMode === 'row'
                  ? "bg-background text-primary shadow-xs font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <FileText className="h-3.5 w-3.5" />
              <span>Bevallási sor szerint</span>
              <span className="text-[10px] font-bold px-1 py-0 rounded bg-primary/10 text-primary border border-primary/20">
                {isCroatia ? 'PDV' : '2665'}
              </span>
            </button>
          </div>

          {/* Mindent kinyit / Mindent becsuk gomb */}
          {groups.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={toggleExpandAll}
              className="h-8 text-xs gap-1.5 cursor-pointer text-muted-foreground hover:text-foreground shrink-0 whitespace-nowrap"
            >
              {areAnyExpanded ? (
                <>
                  <ChevronsDownUp className="h-3.5 w-3.5" />
                  {t('accounting:vat_return.analytics_view.collapse_all', 'Mindent becsuk')}
                </>
              ) : (
                <>
                  <ChevronsUpDown className="h-3.5 w-3.5" />
                  {t('accounting:vat_return.analytics_view.expand_all', 'Mindent kinyit')}
                </>
              )}
            </Button>
          )}

          {/* Tétel / oldal választó */}
          <div className="flex items-center gap-1.5 text-xs shrink-0">
            <span className="text-muted-foreground font-medium whitespace-nowrap">{t('accounting:vat_return.analytics_view.items_per_page', 'Tétel / oldal:')}</span>
            <Select value={String(pageSize)} onValueChange={(val) => setPageSize(Number(val))}>
              <SelectTrigger className="w-[105px] h-8 text-xs bg-background shrink-0 whitespace-nowrap">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="10">{t('accounting:vat_return.analytics_view.items_count', { count: 10, defaultValue: '10 tétel' })}</SelectItem>
                <SelectItem value="20">{t('accounting:vat_return.analytics_view.items_count', { count: 20, defaultValue: '20 tétel' })}</SelectItem>
                <SelectItem value="50">{t('accounting:vat_return.analytics_view.items_count', { count: 50, defaultValue: '50 tétel' })}</SelectItem>
                <SelectItem value="100">{t('accounting:vat_return.analytics_view.items_count', { count: 100, defaultValue: '100 tétel' })}</SelectItem>
                <SelectItem value="-1">{t('accounting:vat_return.analytics_view.all_items', 'Összes tétel')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button
            onClick={handleExportPdf}
            disabled={isExportingPdf || groups.length === 0}
            variant="outline"
            className="gap-2 border-red-500/30 text-red-600 dark:text-red-400 hover:bg-red-500/10 cursor-pointer h-8 text-xs shadow-2xs shrink-0 whitespace-nowrap"
          >
            {isExportingPdf ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4 text-red-600 dark:text-red-400" />}
            {t('accounting:vat_return.analytics_view.export_pdf', 'Export (PDF)')}
          </Button>

          <Button
            onClick={handleExport}
            disabled={isExporting || groups.length === 0}
            variant="outline"
            className="gap-2 border-primary/30 text-primary hover:bg-primary/10 cursor-pointer h-8 text-xs shadow-2xs shrink-0 whitespace-nowrap"
          >
            {isExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSpreadsheet className="h-4 w-4 text-emerald-600" />}
            {t('accounting:vat_return.analytics_view.export_excel', 'Export (Excel)')}
          </Button>
        </div>
      </CardHeader>

      <CardContent>
        {/* Vevő / Szállító irány választó + Élő Mini-KPI Összesítő sáv */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 mb-3.5 pb-3.5 border-b border-border/40">
          {/* Szegmentált Irány választó */}
          <div className="inline-flex items-center p-1 bg-muted/50 rounded-xl border border-border/60 shadow-2xs shrink-0">
            <button
              type="button"
              onClick={() => handleDirectionChange('ALL')}
              className={cn(
                "h-8.5 px-3 text-xs font-medium rounded-lg transition-all cursor-pointer flex items-center gap-2 whitespace-nowrap shrink-0 border",
                selectedDirectionFilter === 'ALL'
                  ? "bg-background text-foreground shadow-xs border-border/50 font-semibold"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/60"
              )}
            >
              <span className="whitespace-nowrap">
                {t('accounting:vat_return.analytics_view.filter_all_docs', 'Összes bizonylat')}
              </span>
              <span className={cn(
                "text-[11px] font-mono px-1.5 py-0.5 rounded-full font-normal transition-colors leading-none shrink-0",
                selectedDirectionFilter === 'ALL' ? "bg-muted text-foreground font-semibold" : "bg-muted/80 text-muted-foreground"
              )}>
                {directionCounts.all}
              </span>
            </button>

            <button
              type="button"
              onClick={() => handleDirectionChange('OUTBOUND')}
              className={cn(
                "h-8.5 px-3 text-xs font-medium rounded-lg transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap shrink-0 border",
                selectedDirectionFilter === 'OUTBOUND'
                  ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/40 shadow-xs font-semibold"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/60"
              )}
            >
              <ArrowUpRight className={cn("h-3.5 w-3.5 shrink-0", selectedDirectionFilter === 'OUTBOUND' ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground")} />
              <span className="whitespace-nowrap">
                {t('accounting:vat_return.analytics_view.filter_outbound', 'Vevői számlák (Kimenő)')}
              </span>
              <span className={cn(
                "text-[11px] font-mono px-1.5 py-0.5 rounded-full font-normal transition-colors leading-none shrink-0",
                selectedDirectionFilter === 'OUTBOUND' ? "bg-emerald-500/20 text-emerald-800 dark:text-emerald-200 font-semibold" : "bg-muted/80 text-muted-foreground"
              )}>
                {directionCounts.outbound}
              </span>
            </button>

            <button
              type="button"
              onClick={() => handleDirectionChange('INBOUND')}
              className={cn(
                "h-8.5 px-3 text-xs font-medium rounded-lg transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap shrink-0 border",
                selectedDirectionFilter === 'INBOUND'
                  ? "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/40 shadow-xs font-semibold"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/60"
              )}
            >
              <ArrowDownLeft className={cn("h-3.5 w-3.5 shrink-0", selectedDirectionFilter === 'INBOUND' ? "text-blue-600 dark:text-blue-400" : "text-muted-foreground")} />
              <span className="whitespace-nowrap">
                {t('accounting:vat_return.analytics_view.filter_inbound', 'Szállítói számlák (Bejövő)')}
              </span>
              <span className={cn(
                "text-[11px] font-mono px-1.5 py-0.5 rounded-full font-normal transition-colors leading-none shrink-0",
                selectedDirectionFilter === 'INBOUND' ? "bg-blue-500/20 text-blue-800 dark:text-blue-200 font-semibold" : "bg-muted/80 text-muted-foreground"
              )}>
                {directionCounts.inbound}
              </span>
            </button>
          </div>

          {/* Élő Mini-KPI Összesítők a szűrt adatokra */}
          <div className="flex items-center gap-2 shrink-0">
            <div className="h-8.5 flex items-center gap-1.5 px-3 rounded-lg bg-muted/40 border border-border/40 text-xs whitespace-nowrap shrink-0">
              <span className="text-muted-foreground">{t('accounting:vat_return.analytics_view.net_label', 'Nettó:')}</span>
              <span className="font-mono font-semibold tabular-nums text-foreground">
                {formatCurrency(totals.net, targetCurrency)}
              </span>
            </div>
            <div className="h-8.5 flex items-center gap-1.5 px-3 rounded-lg bg-primary/10 border border-primary/25 text-xs whitespace-nowrap shrink-0">
              <span className="text-primary font-medium">{t('accounting:vat_return.analytics_view.vat_label', 'ÁFA:')}</span>
              <span className="font-mono font-bold tabular-nums text-primary">
                {formatCurrency(totals.vat, targetCurrency)}
              </span>
            </div>
            <div className="h-8.5 flex items-center gap-1.5 px-3 rounded-lg bg-muted/40 border border-border/40 text-xs whitespace-nowrap shrink-0">
              <span className="text-muted-foreground">{t('accounting:vat_return.analytics_view.gross_label', 'Bruttó:')}</span>
              <span className="font-mono font-semibold tabular-nums text-foreground">
                {formatCurrency(totals.gross, targetCurrency)}
              </span>
            </div>
          </div>
        </div>

        {/* Részletes szűrőpanel: Gyorskereső, ÁFA kód és Kontír választó */}
        <div className="bg-muted/20 border border-border/60 rounded-xl p-3 mb-4 shadow-2xs space-y-2.5">
          <div className="flex flex-wrap items-center gap-3">
            {/* Keresőmező */}
            <div className="relative flex-1 min-w-[220px] max-w-[340px]">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder={t('accounting:vat_return.analytics_view.search_placeholder', 'Keresés (partner, bizonylat, kontír)...')}
                value={glSearchTerm}
                onChange={(e) => setGlSearchTerm(e.target.value)}
                className={cn(
                  "h-8.5 pl-8 pr-7 text-xs bg-background border-border/60 transition-all focus:border-primary",
                  glSearchTerm && "border-primary/50 bg-primary/5"
                )}
              />
              {glSearchTerm && (
                <button
                  type="button"
                  onClick={() => setGlSearchTerm('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer p-0.5 rounded-full"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>

            {/* ÁFA kód szűrő */}
            <div className="flex items-center gap-1.5 shrink-0">
              <Select value={selectedVatCodeFilter} onValueChange={setSelectedVatCodeFilter}>
                <SelectTrigger className={cn(
                  "w-[210px] h-8.5 text-xs bg-background border-border/60 transition-all shrink-0",
                  selectedVatCodeFilter !== 'ALL' && "border-primary/60 bg-primary/5 text-primary font-medium"
                )}>
                  <div className="flex items-center gap-1.5 truncate">
                    <Percent className="h-3 w-3 text-muted-foreground shrink-0" />
                    <SelectValue placeholder={t('accounting:vat_return.analytics_view.all_vat_codes', 'Összes ÁFA kód')} />
                  </div>
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  <SelectItem value="ALL" className="text-xs font-medium">
                    {t('accounting:vat_return.analytics_view.all_vat_codes', 'Összes ÁFA kód')}
                  </SelectItem>
                  {availableVatCodes.map((code) => {
                    const label = getVatCodeLabel(code);
                    return (
                      <SelectItem key={code} value={code} className="text-xs font-mono">
                        {label !== code ? `${code} — ${label}` : code}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            {/* Kontírszám szűrő */}
            <div className="flex items-center gap-1.5 shrink-0">
              <Select value={selectedGlFilter} onValueChange={setSelectedGlFilter}>
                <SelectTrigger className={cn(
                  "w-[240px] h-8.5 text-xs bg-background border-border/60 transition-all shrink-0",
                  selectedGlFilter !== 'ALL' && "border-primary/60 bg-primary/5 text-primary font-medium"
                )}>
                  <div className="flex items-center gap-1.5 truncate">
                    <BookOpen className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <SelectValue placeholder={t('accounting:vat_return.analytics_view.all_gl_numbers', 'Összes kontírszám')} />
                  </div>
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  <SelectItem value="ALL" className="text-xs font-medium">
                    {t('accounting:vat_return.analytics_view.all_gl_numbers', 'Összes kontírszám')}
                  </SelectItem>
                  {availableGlAccounts.hasUnclassified && (
                    <SelectItem value="UNCLASSIFIED" className="text-xs text-amber-600 dark:text-amber-400 font-medium">
                      {t('accounting:vat_return.analytics_view.unclassified_gl_items', '⚠️ Nem kontírozott tételek')}
                    </SelectItem>
                  )}
                  {availableGlAccounts.accounts.map((acc) => {
                    const name = glAccountMap.get(acc);
                    return (
                      <SelectItem key={acc} value={acc} className="text-xs font-mono">
                        {acc}{name ? ` — ${name}` : ''}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            {/* Tétel számláló és gyors reset ha van aktív szűrő */}
            <div className="flex items-center gap-2 ml-auto shrink-0">
              <div className="h-8.5 flex items-center text-xs font-mono text-muted-foreground bg-background px-2.5 rounded-lg border border-border/60 shadow-2xs whitespace-nowrap shrink-0">
                {hasActiveSubFilters ? (
                  <span>
                    {t('accounting:vat_return.analytics_view.filtered_count_prefix', 'Szűrt:')} <strong className="text-foreground">{filteredItems.length}</strong> / {currentScopeTotal} {t('accounting:vat_return.analytics_view.items_suffix', 'tétel')}
                  </span>
                ) : (
                  <span>
                    {t('accounting:vat_return.analytics_view.total_docs_prefix', 'Összesen:')} <strong className="text-foreground">{currentScopeTotal}</strong> {t('accounting:vat_return.analytics_view.docs_suffix', 'bizonylat')}
                  </span>
                )}
              </div>

              {hasActiveSubFilters && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleResetSubFilters}
                  className="h-8.5 px-2.5 text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10 gap-1.5 cursor-pointer transition-colors shrink-0"
                  title={t('accounting:vat_return.analytics_view.reset_filters_tooltip', 'Kereső és szűrők visszaállítása')}
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  {t('accounting:vat_return.analytics_view.clear_filters', 'Szűrők törlése')}
                </Button>
              )}
            </div>
          </div>

          {/* Aktív szűrőcímkék (Chips) - CSAK ha van tényleges al-szűrő (kereső, áfa kód, kontír) */}
          {hasActiveSubFilters && (
            <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-border/40 text-xs">
              <span className="text-[11px] font-semibold text-muted-foreground mr-1">
                {t('accounting:vat_return.analytics_view.active_filters', 'Aktív szűrők:')}
              </span>

              {selectedVatCodeFilter !== 'ALL' && (
                <Badge variant="secondary" className="gap-1 pl-2 pr-1 py-0.5 text-[11px] font-normal border border-border/60">
                  <span className="text-muted-foreground">{t('accounting:vat_return.analytics_view.vat_code_label', 'ÁFA kód:')}</span>
                  <span className="font-semibold text-foreground">{selectedVatCodeFilter}</span>
                  <button
                    type="button"
                    onClick={() => setSelectedVatCodeFilter('ALL')}
                    className="hover:bg-muted p-0.5 rounded-full cursor-pointer ml-0.5 text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              )}

              {selectedGlFilter !== 'ALL' && (
                <Badge variant="secondary" className="gap-1 pl-2 pr-1 py-0.5 text-[11px] font-normal border border-border/60">
                  <span className="text-muted-foreground">{t('accounting:vat_return.analytics_view.gl_label', 'Kontír:')}</span>
                  <span className="font-semibold text-foreground">
                    {selectedGlFilter === 'UNCLASSIFIED' ? t('accounting:vat_return.analytics_view.unclassified', 'Nem kontírozott') : selectedGlFilter}
                  </span>
                  <button
                    type="button"
                    onClick={() => setSelectedGlFilter('ALL')}
                    className="hover:bg-muted p-0.5 rounded-full cursor-pointer ml-0.5 text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              )}

              {glSearchTerm.trim() !== '' && (
                <Badge variant="secondary" className="gap-1 pl-2 pr-1 py-0.5 text-[11px] font-normal border border-border/60">
                  <span className="text-muted-foreground">{t('accounting:vat_return.analytics_view.search_label', 'Keresés:')}</span>
                  <span className="font-semibold text-foreground max-w-[130px] truncate">"{glSearchTerm.trim()}"</span>
                  <button
                    type="button"
                    onClick={() => setGlSearchTerm('')}
                    className="hover:bg-muted p-0.5 rounded-full cursor-pointer ml-0.5 text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              )}
            </div>
          )}
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : rawItems.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <FileText className="h-10 w-10 mx-auto mb-2 opacity-40" />
            <p className="font-medium">{t('accounting:vat_return.analytics_view.empty', 'Nincsenek ÁFA gyűjtőkódos bizonylatok az adott időszakban.')}</p>
          </div>
        ) : groups.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground border border-dashed rounded-lg">
            <Filter className="h-10 w-10 mx-auto mb-2 opacity-40 text-primary" />
            <p className="font-medium text-foreground">{t('accounting:vat_return.analytics_view.empty_filtered_title', 'Nincs a megadott szűrési feltételeknek megfelelő tétel.')}</p>
            <p className="text-xs text-muted-foreground mt-1">{t('accounting:vat_return.analytics_view.empty_filtered_desc', 'Próbáld meg módosítani az Irány, ÁFA kód vagy Kontír szűrőt.')}</p>
            <Button variant="outline" size="sm" onClick={handleResetSubFilters} className="mt-3 gap-1.5 cursor-pointer text-xs">
              <RotateCcw className="h-3.5 w-3.5" /> {t('accounting:vat_return.analytics_view.reset_filters_btn', 'Szűrők visszaállítása')}
            </Button>
          </div>
        ) : (
          <div key={selectedDirectionFilter} className="rounded-lg border border-border/50 overflow-hidden animate-in fade-in-50 duration-150">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40">
                  <TableHead className="w-12 text-center">{t('accounting:vat_return.analytics_view.col_breakdown', 'Bontás')}</TableHead>
                  <TableHead className="font-semibold">
                    {viewMode === 'row'
                      ? (isCroatia ? 'Redak obrasca PDV / Broj dokumenta' : 'NAV 2665 Bevallási Sor / Bizonylatszám')
                      : t('accounting:vat_return.analytics_view.col_code_doc', 'ÁFA Gyűjtőkód / Bizonylatszám')}
                  </TableHead>
                  <TableHead className="font-semibold">{t('accounting:vat_return.analytics_view.col_partner_name', 'Partner neve')}</TableHead>
                  <TableHead className="text-center font-semibold">{t('accounting:vat_return.analytics_view.col_fulfillment_date', 'Teljesítés dátuma')}</TableHead>
                  <TableHead className="text-center font-semibold w-24">
                    {viewMode === 'row' ? (isCroatia ? 'Redak' : 'Sor') : t('accounting:vat_return.analytics_view.col_vat_code', 'ÁFA kód')}
                  </TableHead>
                  <TableHead className="text-center font-semibold w-28">{t('accounting:vat_return.analytics_view.col_gl_account', 'Kontír')}</TableHead>
                  <TableHead className="text-right font-semibold">{t('accounting:vat_return.analytics_view.col_net_amount', 'Nettó alap')}</TableHead>
                  <TableHead className="text-right font-semibold">{t('accounting:vat_return.analytics_view.col_vat_amount', 'ÁFA összeg')}</TableHead>
                  <TableHead className="text-right font-semibold">{t('accounting:vat_return.analytics_view.col_gross_amount', 'Bruttó érték')}</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {groups.map((group) => {
                  const isExpanded = !collapsedCodes.has(group.code);
                  const page = groupPages[group.code] || 1;
                  const totalGroupItems = group.items.length;
                  const totalPages = pageSize === -1 ? 1 : Math.ceil(totalGroupItems / pageSize);
                  const pagedItems = pageSize === -1 ? group.items : group.items.slice((page - 1) * pageSize, page * pageSize);

                  return (
                    <React.Fragment key={group.code}>
                      {/* Group Header Row */}
                      <TableRow
                        onClick={() => toggleExpand(group.code)}
                        className="bg-primary/5 hover:bg-primary/10 cursor-pointer border-b border-border/30 font-semibold"
                      >
                        <TableCell className="text-center py-3">
                          {isExpanded ? <ChevronDown className="h-4 w-4 text-primary mx-auto" /> : <ChevronRight className="h-4 w-4 text-primary mx-auto" />}
                        </TableCell>
                        <TableCell colSpan={3} className="py-3">
                          <div className="flex items-center gap-2">
                            <Badge
                              variant="outline"
                              className={cn(
                                "font-mono",
                                viewMode === 'row'
                                  ? "bg-primary/10 text-primary border-primary/30 font-semibold"
                                  : (group.code === 'ÁHK' || group.code === 'AHK'
                                      ? "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30"
                                      : "bg-primary/10 text-primary border-primary/30")
                              )}
                            >
                              {viewMode === 'row'
                                ? (isCroatia ? `Redak ${group.code}` : `${group.code}. sor`)
                                : (group.code === 'ÁHK' || group.code === 'AHK'
                                    ? (isCroatia ? 'AHK' : 'ÁHK')
                                    : t('accounting:vat_return.analytics_view.code_badge', { code: group.code, defaultValue: `Gyűjtőkód ${group.code}` }))}
                            </Badge>
                            <span>{group.label}</span>
                            <span className="text-xs text-muted-foreground font-normal">
                              {t('accounting:vat_return.analytics_view.doc_count', { count: totalGroupItems, defaultValue: `(${totalGroupItems} bizonylat)` })}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-center text-xs text-muted-foreground">-</TableCell>
                        <TableCell className="text-center text-xs text-muted-foreground">-</TableCell>
                        <TableCell className="text-right font-mono text-foreground font-bold py-3">
                          {formatCurrency(group.total_net, targetCurrency)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-primary font-bold py-3">
                          {formatCurrency(group.total_vat, targetCurrency)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-foreground font-bold py-3">
                          {formatCurrency(group.total_gross, targetCurrency)}
                        </TableCell>
                      </TableRow>

                      {/* Detail Item Rows */}
                      {isExpanded &&
                        pagedItems.map((item, index) => (
                          <TableRow key={item.id || `${item.invoice_number}_${index}`} className="hover:bg-muted/30 text-xs">
                            <TableCell className="text-center text-muted-foreground/50">•</TableCell>
                            <TableCell className="font-mono font-medium pl-6">
                              <div className="flex items-center gap-2">
                                <a
                                  href={`/invoices?search=${encodeURIComponent(item.invoice_number)}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="hover:underline hover:text-primary transition-colors flex items-center gap-1 cursor-pointer font-semibold"
                                  onClick={(e) => e.stopPropagation()}
                                  title="Ugrás a számlára"
                                >
                                  <span>{item.invoice_number}</span>
                                  <ArrowUpRight className="h-3 w-3 opacity-60 text-muted-foreground hover:text-primary" />
                                </a>
                                {item.direction === 'OUTBOUND' ? (
                                  <Badge variant="outline" className="px-1.5 py-0 text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30">
                                    {t('accounting:vat_return.analytics_view.customer_badge', 'Vevő')}
                                  </Badge>
                                ) : (
                                  <Badge variant="outline" className="px-1.5 py-0 text-[10px] font-semibold bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30">
                                    {t('accounting:vat_return.analytics_view.supplier_badge', 'Szállító')}
                                  </Badge>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="font-medium text-muted-foreground">
                              <div className="flex items-center gap-1.5">
                                <span className="truncate max-w-[200px]" title={item.partner_name}>{item.partner_name}</span>
                                {item.is_customer_from_submitted && (
                                  <span
                                    className="shrink-0 inline-flex items-center gap-0.5 px-1 py-0.2 rounded text-[9px] font-medium bg-primary/10 text-primary border border-primary/20 cursor-help"
                                    title={t('accounting:vat_return.analytics_view.customer_from_submitted_tooltip', 'A vevő neve a beküldött saját számláról származik')}
                                  >
                                    <FileText className="w-2.5 h-2.5" />
                                    {t('accounting:vat_return.analytics_view.from_invoice_badge', 'Számláról')}
                                  </span>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-center font-mono text-muted-foreground">
                              {item.fulfillment_date ? item.fulfillment_date.substring(0, 10).replace(/-/g, '.') : '-'}
                            </TableCell>
                            <TableCell className="text-center">
                              <span className="inline-flex items-center px-2 py-0.5 rounded font-mono text-[11px] font-semibold bg-primary/10 text-primary border border-primary/20">
                                {viewMode === 'row' && item.declaration_row
                                  ? (isCroatia ? `Redak ${item.declaration_row}` : `${item.declaration_row}. sor`)
                                  : (item.vat_code || item.code)}
                              </span>
                            </TableCell>
                            <TableCell className="text-center">
                              {item.gl_number ? (
                                <span
                                  className="inline-flex items-center gap-1 font-mono text-xs font-semibold px-2 py-0.5 rounded bg-muted text-foreground border border-border/40"
                                  title={glAccountMap.get(item.gl_number) || ''}
                                >
                                  {item.partner_gl_number ? (
                                    <>
                                      <span className="opacity-70 font-normal text-[10px]">{item.partner_gl_number} →</span>
                                      <span>{item.gl_number}</span>
                                    </>
                                  ) : (
                                    <span>{item.gl_number}</span>
                                  )}
                                </span>
                              ) : (
                                <span className="text-[11px] text-muted-foreground/60 italic">
                                  {t('accounting:vat_return.analytics_view.no_gl', 'Nincs')}
                                </span>
                              )}
                            </TableCell>
                            <TableCell className="text-right font-mono tabular-nums">
                              {formatCurrency(viewMode === 'row' ? item.net_amount : (item.effective_net ?? item.net_amount), targetCurrency)}
                            </TableCell>
                            <TableCell className="text-right font-mono tabular-nums text-primary font-medium">
                              <div className="flex items-center justify-end gap-1.5">
                                {item.deductible_percentage != null && item.deductible_percentage < 100 && item.direction !== 'OUTBOUND' && (
                                  <span className="text-[10px] px-1 py-0.2 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 font-semibold border border-amber-500/20" title={`Levonható ÁFA hányad: ${item.deductible_percentage}%`}>
                                    {item.deductible_percentage}%
                                  </span>
                                )}
                                <span>{formatCurrency(viewMode === 'row' ? item.vat_amount : (item.effective_vat ?? item.vat_amount), targetCurrency)}</span>
                              </div>
                            </TableCell>
                            <TableCell className="text-right font-mono tabular-nums font-medium">
                              {formatCurrency(viewMode === 'row' ? item.gross_amount : (item.effective_gross ?? item.gross_amount), targetCurrency)}
                            </TableCell>
                          </TableRow>
                        ))}

                      {/* Group Pagination Bar */}
                      {isExpanded && totalGroupItems > (pageSize > 0 ? pageSize : totalGroupItems) && pageSize !== -1 && (
                        <TableRow className="bg-muted/20 hover:bg-muted/20 border-b border-border/30">
                          <TableCell colSpan={9} className="py-2 px-6">
                            <div className="flex items-center justify-between text-xs text-muted-foreground">
                              <div>
                                {t('accounting:vat_return.analytics_view.pagination_info', {
                                  from: (page - 1) * pageSize + 1,
                                  to: Math.min(page * pageSize, totalGroupItems),
                                  total: totalGroupItems,
                                  defaultValue: `Megjelenítve: ${(page - 1) * pageSize + 1} - ${Math.min(page * pageSize, totalGroupItems)} / ${totalGroupItems} tétel`,
                                })}
                              </div>
                              <div className="flex items-center gap-1.5">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  disabled={page === 1}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setGroupPages((prev) => ({ ...prev, [group.code]: page - 1 }));
                                  }}
                                  className="h-7 px-2 text-xs bg-background"
                                >
                                  <ChevronLeft className="h-3.5 w-3.5 mr-1" /> {t('common:actions.previous', 'Előző')}
                                </Button>
                                <span className="px-2 font-mono text-foreground">
                                  {t('accounting:vat_return.analytics_view.page_info', { page, total: totalPages, defaultValue: `${page} / ${totalPages} oldal` })}
                                </span>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  disabled={page >= totalPages}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setGroupPages((prev) => ({ ...prev, [group.code]: page + 1 }));
                                  }}
                                  className="h-7 px-2 text-xs bg-background"
                                >
                                  {t('common:actions.next', 'Következő')} <ChevronRight className="h-3.5 w-3.5 ml-1" />
                                </Button>
                              </div>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </React.Fragment>
                  );
                })}

                {/* Grand Total Row */}
                <TableRow className="bg-muted/80 font-bold border-t-2 border-border">
                  <TableCell colSpan={6} className="py-3 text-right">
                    {isCroatia
                      ? t('accounting:vat_return.analytics_view.grand_total_hr', 'UKUPNO (PDV analitika):')
                      : t('accounting:vat_return.analytics_view.grand_total', 'ÖSSZESEN (NAV ÁFA Analitika):')}
                  </TableCell>
                  <TableCell className="text-right font-mono tabular-nums py-3 text-base">
                    {formatCurrency(totals.net, targetCurrency)}
                  </TableCell>
                  <TableCell className="text-right font-mono tabular-nums py-3 text-base text-primary">
                    {formatCurrency(totals.vat, targetCurrency)}
                  </TableCell>
                  <TableCell className="text-right font-mono tabular-nums py-3 text-base">
                    {formatCurrency(totals.gross, targetCurrency)}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
