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
import { formatCurrency, cn } from '@/lib/utils';
import { exportVatCollectorAnalyticsExcel, VatCollectorGroup } from '@/lib/glExport';
import { useToast } from '@/hooks/use-toast';
import { useTranslation } from 'react-i18next';
import { useDateRange } from '@/contexts/DateRangeContext';
import { useActivePreset } from '@/hooks/useActivePreset';
import { fetchAllGlAccountsByPreset } from '@/lib/glData';

interface VatCollectorAnalyticsViewProps {
  year?: number;
  periodMonth?: number;
}

export function VatCollectorAnalyticsView({ year, periodMonth }: VatCollectorAnalyticsViewProps) {
  const { t } = useTranslation(['accounting', 'common']);
  const { selectedCompany } = useCompany();
  const { toast } = useToast();
  const { dateFromFormatted, dateToFormatted } = useDateRange();
  const { activePresetId } = useActivePreset(selectedCompany?.id);

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
    glAccounts.forEach((acc) => {
      const label = acc.name || acc.short_name || '';
      map.set(acc.gl_number, label);
    });
    return map;
  }, [glAccounts]);

  // Query invoice items with VAT codes, direction & GL classifications filtered by interval
  const { data: rawItems = [], isLoading } = useQuery({
    queryKey: ['vatCollectorItems', selectedCompany?.id, effectiveDateFrom, effectiveDateTo, activePresetId],
    queryFn: async () => {
      if (!selectedCompany?.id) return [];

      const [navInvsRes, subInvsRes] = await Promise.all([
        supabase
          .from('nav_invoices')
          .select('id, invoice_number, supplier_name, customer_name, invoice_delivery_date, invoice_issue_date, invoice_net_amount, invoice_vat_amount, partner_gl_number, vat_gl_number, invoice_direction')
          .eq('company_id', selectedCompany.id)
          .or(`invoice_delivery_date.gte.${effectiveDateFrom},and(invoice_delivery_date.is.null,invoice_issue_date.gte.${effectiveDateFrom})`)
          .or(`invoice_delivery_date.lte.${effectiveDateTo},and(invoice_delivery_date.is.null,invoice_issue_date.lte.${effectiveDateTo})`)
          .limit(10000),
        supabase
          .from('invoices')
          .select('id, bizonylatsorszam, elado_nev, vevo_nev, teljesites_datuma, kibocsatas_datuma, adoalap_osszesen, afa_osszeg_osszesen, partner_gl_number, vat_gl_number, invoice_direction')
          .eq('company_id', selectedCompany.id)
          .or(`teljesites_datuma.gte.${effectiveDateFrom},and(teljesites_datuma.is.null,kibocsatas_datuma.gte.${effectiveDateFrom})`)
          .or(`teljesites_datuma.lte.${effectiveDateTo},and(teljesites_datuma.is.null,kibocsatas_datuma.lte.${effectiveDateTo})`)
          .limit(10000),
      ]);

      const navInvs = navInvsRes.data || [];
      const subInvs = subInvsRes.data || [];

      const normalizeInvNum = (s?: string | null) => (s || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase();
      const existingNavNumbers = new Set(navInvs.map((i) => normalizeInvNum(i.invoice_number)).filter(Boolean));
      // Only keep standalone manual invoices to avoid double-counting invoices already present in NAV
      const standaloneSubInvs = subInvs.filter((i) => !existingNavNumbers.has(normalizeInvNum(i.bizonylatsorszam)));

      const navMap = new Map(navInvs.map((i) => [i.id, i]));
      const subMap = new Map(standaloneSubInvs.map((i) => [i.id, i]));
      const subByNumMap = new Map<string, any>();
      subInvs.forEach((s) => {
        if (s.bizonylatsorszam) {
          subByNumMap.set(normalizeInvNum(s.bizonylatsorszam), s);
        }
      });

      const navIds = navInvs.map((i) => i.id);
      const subIds = standaloneSubInvs.map((i) => i.id);

      // Safe chunked fetching in batches of 50 IDs to avoid HTTP 400 Bad Request (URI Too Long)
      const navItemPromises: Promise<any>[] = [];
      for (let i = 0; i < navIds.length; i += 50) {
        const chunk = navIds.slice(i, i + 50);
        navItemPromises.push(
          supabase
            .from('nav_invoice_items')
            .select('id, nav_invoice_id, net_amount, vat_amount, vat_rate, vat_code, gl_classifications, line_description')
            .in('nav_invoice_id', chunk)
            .limit(10000)
        );
      }

      const subItemPromises: Promise<any>[] = [];
      for (let i = 0; i < subIds.length; i += 50) {
        const chunk = subIds.slice(i, i + 50);
        subItemPromises.push(
          supabase
            .from('invoice_items')
            .select('id, invoice_id, net_amount, vat_amount, vat_rate, vat_code, gl_classifications, line_description')
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

      const getCode = (rate: string | null, overrideCode?: string | null, desc?: string | null, vatAmount?: number | null) => {
        if (isDrsItem(desc, vatAmount, rate)) {
          return 'ÁHK';
        }

        if (overrideCode && overrideCode.trim()) {
          const oc = overrideCode.trim().toUpperCase();
          if (['25', '05', '18', 'FAD', 'TAM', 'AAM', 'EXP', 'ÁHK', 'AHK'].includes(oc)) {
            return oc === 'AHK' ? 'ÁHK' : oc;
          }
          if (oc.includes('FORD') || oc.includes('FAD')) return 'FAD';
          if (oc.includes('27')) return '25';
          if (oc.includes('05') || oc.includes('_5_') || oc.endsWith('_5')) return '05';
          if (oc.includes('18')) return '18';
          if (oc.includes('TAM') || oc.includes('0_LEV') || oc.includes('MENTES')) return 'TAM';
          if (oc.includes('AAM')) return 'AAM';
          if (oc.includes('EXP') || oc.includes('EXPORT')) return 'EXP';
          if (oc.includes('AHK') || oc.includes('ÁHK') || oc.includes('DRS') || oc.includes('KIVUL')) return 'ÁHK';
          return overrideCode.trim();
        }

        if (!rate) {
          if (vatAmount === 0 || !vatAmount) return 'TAM';
          return '25';
        }
        const u = rate.toUpperCase();
        if (u.includes('FAD') || u.includes('FORD') || u.includes('F.AFA') || u.includes('F_AFA') || u.includes('FAFA') || u.includes('REVERSE_CHARGE')) return 'FAD';
        if (rate === '0.27' || rate === '27' || rate === '27.0' || rate === '27.00' || rate === '27%') return '25';
        if (rate === '0.05' || rate === '5' || rate === '5.0' || rate === '5.00' || rate === '5%') return '05';
        if (rate === '0.18' || rate === '18' || rate === '18.0' || rate === '18.00' || rate === '18%') return '18';
        if (u.includes('AAM')) return 'AAM';
        if (u.includes('TAM')) return 'TAM';
        if (u.includes('EXP')) return 'EXP';
        if (u.includes('AHK') || u.includes('ÁHK') || u.includes('ATK') || u.includes('KIVUL')) return 'ÁHK';
        if (u === '0' || u === '0%' || u === '0.00' || u === 'MENTES') return 'TAM';
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

      // Process nav items - aggregated by (nav_invoice_id + code + gl_number + vat_code)
      // so each invoice appears cleanly as a document entry per VAT code & GL classification
      const processedNavIds = new Set<string>();
      const navItemAggMap = new Map<string, any>();

      navItems.forEach((i: any) => {
        processedNavIds.add(i.nav_invoice_id);
        const inv = navMap.get(i.nav_invoice_id);
        const code = getCode(i.vat_rate, i.vat_code, i.line_description, i.vat_amount);
        const glNum = resolveItemGl(i.gl_classifications);
        const vatCode = i.vat_code || null;
        const aggKey = `${i.nav_invoice_id}_${code}_${glNum || 'none'}_${vatCode || 'none'}`;

        const net = Number(i.net_amount) || 0;
        const vat = Number(i.vat_amount) || 0;

        if (navItemAggMap.has(aggKey)) {
          const existing = navItemAggMap.get(aggKey);
          existing.net_amount += net;
          existing.vat_amount += vat;
          existing.gross_amount += (net + vat);
        } else {
          const dateStr = inv?.invoice_delivery_date || inv?.invoice_issue_date || '';
          const direction = ((inv as any)?.invoice_direction || 'INBOUND').toUpperCase() as 'INBOUND' | 'OUTBOUND';
          const isOutbound = direction === 'OUTBOUND';
          const matchedSub = subByNumMap.get(normalizeInvNum(inv?.invoice_number));
          const resolvedCustomer = inv?.customer_name || matchedSub?.vevo_nev;
          const isCustomerFromSubmitted = isOutbound && !inv?.customer_name && !!matchedSub?.vevo_nev;
          const partnerName = isOutbound
            ? (resolvedCustomer || 'Ismeretlen vevő')
            : (inv?.supplier_name || matchedSub?.elado_nev || 'Ismeretlen szállító');

          navItemAggMap.set(aggKey, {
            id: `nav_${i.nav_invoice_id}_${code}_${glNum || 'none'}`,
            invoice_id: i.nav_invoice_id,
            code,
            vat_code: vatCode,
            gl_number: glNum,
            direction,
            partner_gl_number: (inv as any)?.partner_gl_number || null,
            vat_gl_number: (inv as any)?.vat_gl_number || null,
            invoice_number: inv?.invoice_number || 'Névtelen',
            partner_name: partnerName,
            is_customer_from_submitted: isCustomerFromSubmitted,
            fulfillment_date: dateStr,
            net_amount: net,
            vat_amount: vat,
            gross_amount: net + vat,
          });
        }
      });

      items.push(...Array.from(navItemAggMap.values()));

      // Fallback for nav_invoices without item records yet
      navInvs.forEach((inv: any) => {
        if (!processedNavIds.has(inv.id)) {
          const net = Number(inv.invoice_net_amount || 0);
          const vat = Number(inv.invoice_vat_amount || 0);
          const direction = ((inv as any)?.invoice_direction || 'INBOUND').toUpperCase() as 'INBOUND' | 'OUTBOUND';
          const isOutbound = direction === 'OUTBOUND';
          if (net !== 0 || vat !== 0) {
            const rate = net > 0 ? vat / net : 0;
            const code = Math.round(rate * 100) === 27 ? '25' : Math.round(rate * 100) === 18 ? '18' : Math.round(rate * 100) === 5 ? '05' : vat === 0 ? 'TAM' : '25';
            const dateStr = inv.invoice_delivery_date || inv.invoice_issue_date || '';
            const matchedSub = subByNumMap.get(normalizeInvNum(inv.invoice_number));
            const resolvedCustomer = inv.customer_name || matchedSub?.vevo_nev;
            const isCustomerFromSubmitted = isOutbound && !inv.customer_name && !!matchedSub?.vevo_nev;
            const partnerName = isOutbound
              ? (resolvedCustomer || 'Ismeretlen vevő')
              : (inv.supplier_name || matchedSub?.elado_nev || 'Ismeretlen szállító');

            items.push({
              id: `nav_inv_${inv.id}`,
              invoice_id: inv.id,
              code,
              vat_code: null,
              gl_number: null,
              direction,
              partner_gl_number: (inv as any)?.partner_gl_number || null,
              vat_gl_number: (inv as any)?.vat_gl_number || null,
              invoice_number: inv.invoice_number || 'Névtelen',
              partner_name: partnerName,
              is_customer_from_submitted: isCustomerFromSubmitted,
              fulfillment_date: dateStr,
              net_amount: net,
              vat_amount: vat,
              gross_amount: net + vat,
            });
          }
        }
      });

      const processedSubIds = new Set<string>();
      const subItemAggMap = new Map<string, any>();

      subItems.forEach((i: any) => {
        processedSubIds.add(i.invoice_id);
        const inv = subMap.get(i.invoice_id);
        const code = getCode(i.vat_rate, i.vat_code, i.line_description, i.vat_amount);
        const glNum = resolveItemGl(i.gl_classifications);
        const vatCode = i.vat_code || null;
        const aggKey = `${i.invoice_id}_${code}_${glNum || 'none'}_${vatCode || 'none'}`;

        const net = Number(i.net_amount) || 0;
        const vat = Number(i.vat_amount) || 0;

        if (subItemAggMap.has(aggKey)) {
          const existing = subItemAggMap.get(aggKey);
          existing.net_amount += net;
          existing.vat_amount += vat;
          existing.gross_amount += (net + vat);
        } else {
          const dateStr = inv?.teljesites_datuma || inv?.kibocsatas_datuma || '';
          const direction = ((inv as any)?.invoice_direction || 'INBOUND').toUpperCase() as 'INBOUND' | 'OUTBOUND';
          const isOutbound = direction === 'OUTBOUND';
          const partnerName = isOutbound
            ? (inv?.vevo_nev || 'Ismeretlen vevő')
            : (inv?.elado_nev || 'Ismeretlen szállító');

          subItemAggMap.set(aggKey, {
            id: `sub_${i.invoice_id}_${code}_${glNum || 'none'}`,
            invoice_id: i.invoice_id,
            code,
            vat_code: vatCode,
            gl_number: glNum,
            direction,
            partner_gl_number: (inv as any)?.partner_gl_number || null,
            vat_gl_number: (inv as any)?.vat_gl_number || null,
            invoice_number: inv?.bizonylatsorszam || 'Névtelen',
            partner_name: partnerName,
            is_customer_from_submitted: isOutbound && !!inv?.vevo_nev,
            fulfillment_date: dateStr,
            net_amount: net,
            vat_amount: vat,
            gross_amount: net + vat,
          });
        }
      });

      items.push(...Array.from(subItemAggMap.values()));

      // Fallback for manual invoices without item records yet
      standaloneSubInvs.forEach((inv: any) => {
        if (!processedSubIds.has(inv.id)) {
          const net = Number(inv.adoalap_osszesen || 0);
          const vat = Number(inv.afa_osszeg_osszesen || 0);
          const direction = ((inv as any)?.invoice_direction || 'INBOUND').toUpperCase() as 'INBOUND' | 'OUTBOUND';
          const isOutbound = direction === 'OUTBOUND';
          if (net !== 0 || vat !== 0) {
            const rate = net > 0 ? vat / net : 0;
            const code = Math.round(rate * 100) === 27 ? '25' : Math.round(rate * 100) === 18 ? '18' : Math.round(rate * 100) === 5 ? '05' : vat === 0 ? 'TAM' : '25';
            const dateStr = inv.teljesites_datuma || inv.kibocsatas_datuma || '';
            const partnerName = isOutbound
              ? (inv.vevo_nev || 'Ismeretlen vevő')
              : (inv.elado_nev || 'Ismeretlen szállító');

            items.push({
              id: `sub_inv_${inv.id}`,
              invoice_id: inv.id,
              code,
              vat_code: null,
              gl_number: null,
              direction,
              partner_gl_number: (inv as any)?.partner_gl_number || null,
              vat_gl_number: (inv as any)?.vat_gl_number || null,
              invoice_number: inv.bizonylatsorszam || 'Névtelen',
              partner_name: partnerName,
              is_customer_from_submitted: isOutbound && !!inv?.vevo_nev,
              fulfillment_date: dateStr,
              net_amount: net,
              vat_amount: vat,
              gross_amount: net + vat,
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
      case '25': return t('accounting:vat_return.analytics_view.codes.25', 'Normál belföldi 27% (Gyűjtőkód 25)');
      case '05': return t('accounting:vat_return.analytics_view.codes.05', 'Kedvezményes belföldi 5% (Gyűjtőkód 05)');
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

  // Group filtered items into VAT collector groups
  const groups = useMemo<VatCollectorGroup[]>(() => {
    const map = new Map<string, VatCollectorGroup>();

    filteredItems.forEach((item) => {
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
      grp.items.push(item);
      grp.total_net += item.net_amount;
      grp.total_vat += item.vat_amount;
      grp.total_gross += item.gross_amount;
    });

    return Array.from(map.values()).sort((a, b) => a.code.localeCompare(b.code));
  }, [filteredItems, t]);

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
      await exportVatCollectorAnalyticsExcel(groups, selectedCompany?.name || 'Cég');
      toast({
        title: t('accounting:vat_return.analytics_view.toast_export_success_title', 'Sikeres exportálás'),
        description: t('accounting:vat_return.analytics_view.toast_export_success_desc', 'Az ÁFA Gyűjtőkódos Analitika Excel fájl elkészült.'),
      });
    } catch (e: any) {
      toast({ title: t('common:status.error', 'Export hiba'), description: e.message, variant: 'destructive' });
    } finally {
      setIsExporting(false);
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
            {t('accounting:vat_return.analytics_view.card_title', 'ÁFA Gyűjtőkód Szerinti Analitikus Kimutatás')}
          </CardTitle>
          <CardDescription>
            {t('accounting:vat_return.analytics_view.card_description', 'NAV adóhatósági ellenőrzéseknek megfelelő bizonylat-analitika ÁFA gyűjtőkódonként csoportosítva.')}
          </CardDescription>
          <div className="flex items-center gap-2 mt-2">
            <Badge variant="secondary" className="font-mono text-xs bg-muted/60 text-foreground border border-border">
              {t('accounting:vat_return.analytics_view.active_period', 'Szűrt időszak:')} {effectiveDateFrom} – {effectiveDateTo}
            </Badge>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
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
                  Mindent becsuk
                </>
              ) : (
                <>
                  <ChevronsUpDown className="h-3.5 w-3.5" />
                  Mindent kinyit
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
              <span className="whitespace-nowrap">Összes bizonylat</span>
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
              <span className="whitespace-nowrap">Vevői számlák (Kimenő)</span>
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
              <span className="whitespace-nowrap">Szállítói számlák (Bejövő)</span>
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
              <span className="text-muted-foreground">Nettó:</span>
              <span className="font-mono font-semibold tabular-nums text-foreground">
                {formatCurrency(totals.net, 'HUF')}
              </span>
            </div>
            <div className="h-8.5 flex items-center gap-1.5 px-3 rounded-lg bg-primary/10 border border-primary/25 text-xs whitespace-nowrap shrink-0">
              <span className="text-primary font-medium">ÁFA:</span>
              <span className="font-mono font-bold tabular-nums text-primary">
                {formatCurrency(totals.vat, 'HUF')}
              </span>
            </div>
            <div className="h-8.5 flex items-center gap-1.5 px-3 rounded-lg bg-muted/40 border border-border/40 text-xs whitespace-nowrap shrink-0">
              <span className="text-muted-foreground">Bruttó:</span>
              <span className="font-mono font-semibold tabular-nums text-foreground">
                {formatCurrency(totals.gross, 'HUF')}
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
                placeholder="Keresés (partner, bizonylat, kontír)..."
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
                    <SelectValue placeholder="Összes ÁFA kód" />
                  </div>
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  <SelectItem value="ALL" className="text-xs font-medium">
                    Összes ÁFA kód
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
                    <SelectValue placeholder="Összes kontírszám" />
                  </div>
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  <SelectItem value="ALL" className="text-xs font-medium">
                    Összes kontírszám
                  </SelectItem>
                  {availableGlAccounts.hasUnclassified && (
                    <SelectItem value="UNCLASSIFIED" className="text-xs text-amber-600 dark:text-amber-400 font-medium">
                      ⚠️ Nem kontírozott tételek
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
                    Szűrt: <strong className="text-foreground">{filteredItems.length}</strong> / {currentScopeTotal} tétel
                  </span>
                ) : (
                  <span>
                    Összesen: <strong className="text-foreground">{currentScopeTotal}</strong> bizonylat
                  </span>
                )}
              </div>

              {hasActiveSubFilters && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleResetSubFilters}
                  className="h-8.5 px-2.5 text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10 gap-1.5 cursor-pointer transition-colors shrink-0"
                  title="Kereső és szűrők visszaállítása"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  Szűrők törlése
                </Button>
              )}
            </div>
          </div>

          {/* Aktív szűrőcímkék (Chips) - CSAK ha van tényleges al-szűrő (kereső, áfa kód, kontír) */}
          {hasActiveSubFilters && (
            <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-border/40 text-xs">
              <span className="text-[11px] font-semibold text-muted-foreground mr-1">Aktív szűrők:</span>

              {selectedVatCodeFilter !== 'ALL' && (
                <Badge variant="secondary" className="gap-1 pl-2 pr-1 py-0.5 text-[11px] font-normal border border-border/60">
                  <span className="text-muted-foreground">ÁFA kód:</span>
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
                  <span className="text-muted-foreground">Kontír:</span>
                  <span className="font-semibold text-foreground">
                    {selectedGlFilter === 'UNCLASSIFIED' ? 'Nem kontírozott' : selectedGlFilter}
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
                  <span className="text-muted-foreground">Keresés:</span>
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
            <p className="font-medium text-foreground">Nincs a megadott szűrési feltételeknek megfelelő tétel.</p>
            <p className="text-xs text-muted-foreground mt-1">Próbáld meg módosítani az Irány, ÁFA kód vagy Kontír szűrőt.</p>
            <Button variant="outline" size="sm" onClick={handleResetSubFilters} className="mt-3 gap-1.5 cursor-pointer text-xs">
              <RotateCcw className="h-3.5 w-3.5" /> Szűrők visszaállítása
            </Button>
          </div>
        ) : (
          <div key={selectedDirectionFilter} className="rounded-lg border border-border/50 overflow-hidden animate-in fade-in-50 duration-150">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40">
                  <TableHead className="w-12 text-center">{t('accounting:vat_return.analytics_view.col_breakdown', 'Bontás')}</TableHead>
                  <TableHead className="font-semibold">{t('accounting:vat_return.analytics_view.col_code_doc', 'ÁFA Gyűjtőkód / Bizonylatszám')}</TableHead>
                  <TableHead className="font-semibold">{t('accounting:vat_return.analytics_view.col_partner_name', 'Partner neve')}</TableHead>
                  <TableHead className="text-center font-semibold">{t('accounting:vat_return.analytics_view.col_fulfillment_date', 'Teljesítés dátuma')}</TableHead>
                  <TableHead className="text-center font-semibold w-24">ÁFA kód</TableHead>
                  <TableHead className="text-center font-semibold w-28">Kontír</TableHead>
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
                                group.code === 'ÁHK'
                                  ? "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30"
                                  : "bg-primary/10 text-primary border-primary/30"
                              )}
                            >
                              {group.code === 'ÁHK'
                                ? 'ÁHK'
                                : t('accounting:vat_return.analytics_view.code_badge', { code: group.code, defaultValue: `Gyűjtőkód ${group.code}` })}
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
                          {formatCurrency(group.total_net, 'HUF')}
                        </TableCell>
                        <TableCell className="text-right font-mono text-primary font-bold py-3">
                          {formatCurrency(group.total_vat, 'HUF')}
                        </TableCell>
                        <TableCell className="text-right font-mono text-foreground font-bold py-3">
                          {formatCurrency(group.total_gross, 'HUF')}
                        </TableCell>
                      </TableRow>

                      {/* Detail Item Rows */}
                      {isExpanded &&
                        pagedItems.map((item, index) => (
                          <TableRow key={item.id || `${item.invoice_number}_${index}`} className="hover:bg-muted/30 text-xs">
                            <TableCell className="text-center text-muted-foreground/50">•</TableCell>
                            <TableCell className="font-mono font-medium pl-6">
                              <div className="flex items-center gap-2">
                                <span>{item.invoice_number}</span>
                                {item.direction === 'OUTBOUND' ? (
                                  <Badge variant="outline" className="px-1.5 py-0 text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30">
                                    Vevő
                                  </Badge>
                                ) : (
                                  <Badge variant="outline" className="px-1.5 py-0 text-[10px] font-semibold bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30">
                                    Szállító
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
                                    title="A vevő neve a beküldött saját számláról származik"
                                  >
                                    <FileText className="w-2.5 h-2.5" />
                                    Számláról
                                  </span>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-center font-mono text-muted-foreground">
                              {item.fulfillment_date ? item.fulfillment_date.substring(0, 10).replace(/-/g, '.') : '-'}
                            </TableCell>
                            <TableCell className="text-center">
                              <span className="inline-flex items-center px-2 py-0.5 rounded font-mono text-[11px] font-semibold bg-primary/10 text-primary border border-primary/20">
                                {item.vat_code || item.code}
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
                                <span className="text-[11px] text-muted-foreground/60 italic">Nincs</span>
                              )}
                            </TableCell>
                            <TableCell className="text-right font-mono tabular-nums">
                              {formatCurrency(item.net_amount, 'HUF')}
                            </TableCell>
                            <TableCell className="text-right font-mono tabular-nums text-primary font-medium">
                              {formatCurrency(item.vat_amount, 'HUF')}
                            </TableCell>
                            <TableCell className="text-right font-mono tabular-nums font-medium">
                              {formatCurrency(item.gross_amount, 'HUF')}
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
                    {t('accounting:vat_return.analytics_view.grand_total', 'ÖSSZESEN (NAV ÁFA Analitika):')}
                  </TableCell>
                  <TableCell className="text-right font-mono tabular-nums py-3 text-base">
                    {formatCurrency(totals.net, 'HUF')}
                  </TableCell>
                  <TableCell className="text-right font-mono tabular-nums py-3 text-base text-primary">
                    {formatCurrency(totals.vat, 'HUF')}
                  </TableCell>
                  <TableCell className="text-right font-mono tabular-nums py-3 text-base">
                    {formatCurrency(totals.gross, 'HUF')}
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
