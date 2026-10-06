import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  FileText,
  Printer,
  RotateCw,
  ZoomIn,
  ZoomOut,
  ChevronLeft,
  ChevronRight,
  Search,
  Layers,
  ScrollText,
  Building2,
  Calendar,
  Sparkles,
} from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { MLine, VatFrequency, shouldExcludeFromMLine } from '../../types';
import { buildNav65MPartnerSheets, Nav65MPartnerSheetData } from '../../utils/nav65MPaginationHelper';
import { Nav2665MSheetFolap } from './Nav2665MSheetFolap';
import { Nav2665MSheet02 } from './Nav2665MSheet02';
import { Nav2665MSheet02K } from './Nav2665MSheet02K';

export type MReplicaDisplayMode = 'paginated' | 'continuous';

export interface Nav2665MReplicaContainerProps {
  selectedCompany: any;
  year: number;
  month: number;
  frequency: VatFrequency | string;
  mLines: MLine[];
  onRecalculate?: () => Promise<void> | void;
  isRecalculating?: boolean;
  initialPartnerId?: string;
  className?: string;
}

export function Nav2665MReplicaContainer({
  selectedCompany,
  year,
  month,
  frequency,
  mLines = [],
  onRecalculate,
  isRecalculating = false,
  initialPartnerId,
  className,
}: Nav2665MReplicaContainerProps) {
  const { toast } = useToast();
  const [partnerSearch, setPartnerSearch] = useState('');
  const [displayMode, setDisplayMode] = useState<MReplicaDisplayMode>('paginated');
  const [activeSheetIndex, setActiveSheetIndex] = useState(0); // 0 = Folap, 1..N = 02, etc.
  const [zoomLevel, setZoomLevel] = useState<number>(100);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Filter out non-eligible partners (AAM, proforma, insurance, etc.)
  const eligiblePartners = useMemo(() => {
    return (mLines || []).filter((m) => !shouldExcludeFromMLine(m));
  }, [mLines]);

  // Filtered partners by search term
  const searchedPartners = useMemo(() => {
    if (!partnerSearch.trim()) return eligiblePartners;
    const q = partnerSearch.toLowerCase().trim();
    return eligiblePartners.filter(
      (m) =>
        (m.partner_name || '').toLowerCase().includes(q) ||
        (m.partner_tax_number || '').toLowerCase().includes(q)
    );
  }, [eligiblePartners, partnerSearch]);

  const [prevInitialId, setPrevInitialId] = useState(initialPartnerId);
  const [selectedPartnerIndex, setSelectedPartnerIndex] = useState(() => {
    if (initialPartnerId && eligiblePartners.length > 0) {
      const idx = eligiblePartners.findIndex(
        (p) => p.id === initialPartnerId || (p.partner_tax_number && p.partner_tax_number.includes(initialPartnerId))
      );
      return idx !== -1 ? idx : 0;
    }
    return 0;
  });

  // Adjust partner index if initialPartnerId changes
  if (prevInitialId !== initialPartnerId) {
    setPrevInitialId(initialPartnerId);
    if (initialPartnerId && eligiblePartners.length > 0) {
      const idx = eligiblePartners.findIndex(
        (p) => p.id === initialPartnerId || (p.partner_tax_number && p.partner_tax_number.includes(initialPartnerId))
      );
      if (idx !== -1) {
        setSelectedPartnerIndex(idx);
      }
    }
  }

  // Safe active partner
  const activePartner = useMemo(() => {
    if (!searchedPartners.length) return null;
    const safeIdx = Math.min(Math.max(0, selectedPartnerIndex), searchedPartners.length - 1);
    return searchedPartners[safeIdx];
  }, [searchedPartners, selectedPartnerIndex]);

  // Period string boundaries for detail invoice fetching if not pre-populated
  const { dateFrom, dateTo } = useMemo(() => {
    const yStr = String(year);
    if (frequency === 'H') {
      const mStr = String(month).padStart(2, '0');
      const lastDay = new Date(year, month, 0).getDate();
      return {
        dateFrom: `${yStr}-${mStr}-01`,
        dateTo: `${yStr}-${mStr}-${String(lastDay).padStart(2, '0')}`,
      };
    } else if (frequency === 'N') {
      const startM = (month - 1) * 3 + 1;
      const endM = startM + 2;
      const lastDay = new Date(year, endM, 0).getDate();
      return {
        dateFrom: `${yStr}-${String(startM).padStart(2, '0')}-01`,
        dateTo: `${yStr}-${String(endM).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`,
      };
    } else {
      return {
        dateFrom: `${yStr}-01-01`,
        dateTo: `${yStr}-12-31`,
      };
    }
  }, [year, month, frequency]);

  // Fetch invoice details for the active partner if needed
  const activeTax8 = (activePartner?.partner_tax_number || '').replace(/\D/g, '').slice(0, 8);
  const hasPreloadedInvoices =
    activePartner &&
    Array.isArray((activePartner as any).invoice_details) &&
    (activePartner as any).invoice_details.length > 0;

  const { data: fetchedInvoices = [] } = useQuery({
    queryKey: ['replica_partner_invoices', selectedCompany?.id, activeTax8, dateFrom, dateTo],
    queryFn: async () => {
      if (!selectedCompany?.id || !activeTax8) return [];
      const [navRes, subRes] = await Promise.all([
        supabase
          .from('nav_invoices')
          .select('id, invoice_number, invoice_delivery_date, invoice_issue_date, invoice_net_amount, invoice_vat_amount, original_invoice_number, invoice_operation')
          .eq('company_id', selectedCompany.id)
          .eq('invoice_direction', 'INBOUND')
          .ilike('supplier_tax_number', `${activeTax8}%`)
          .or(`invoice_delivery_date.gte.${dateFrom},and(invoice_delivery_date.is.null,invoice_issue_date.gte.${dateFrom})`)
          .or(`invoice_delivery_date.lte.${dateTo},and(invoice_delivery_date.is.null,invoice_issue_date.lte.${dateTo})`)
          .limit(1000),
        supabase
          .from('invoices')
          .select('id, bizonylatsorszam, teljesites_datuma, kibocsatas_datuma, adoalap_osszesen, afa_osszeg_osszesen, elolegszamla_hivatkozas, reference_number, invoice_type')
          .eq('company_id', selectedCompany.id)
          .not('invoice_type', 'in', '("dijbekero_proforma","dijbekero","proforma","garanciajegy")')
          .ilike('elado_vat_id', `${activeTax8}%`)
          .or(`teljesites_datuma.gte.${dateFrom},and(teljesites_datuma.is.null,kibocsatas_datuma.gte.${dateFrom})`)
          .or(`teljesites_datuma.lte.${dateTo},and(teljesites_datuma.is.null,kibocsatas_datuma.lte.${dateTo})`)
          .limit(1000),
      ]);

      const navItems = (navRes.data || []).map((n) => ({
        ...n,
        invoice_number: n.invoice_number,
        invoice_delivery_date: n.invoice_delivery_date,
        invoice_issue_date: n.invoice_issue_date,
        invoice_net_amount: n.invoice_net_amount,
        invoice_vat_amount: n.invoice_vat_amount,
      }));

      const subItems = (subRes.data || []).map((s) => ({
        ...s,
        invoice_number: s.bizonylatsorszam,
        invoice_delivery_date: s.teljesites_datuma,
        invoice_issue_date: s.kibocsatas_datuma,
        invoice_net_amount: s.adoalap_osszesen,
        invoice_vat_amount: s.afa_osszeg_osszesen,
      }));

      return [...navItems, ...subItems];
    },
    enabled: !hasPreloadedInvoices && !!selectedCompany?.id && !!activeTax8,
  });

  const effectiveInvoices = useMemo(() => {
    if (hasPreloadedInvoices) {
      return (activePartner as any).invoice_details;
    }
    return fetchedInvoices;
  }, [hasPreloadedInvoices, activePartner, fetchedInvoices]);

  // Build the complete paginated structure for the active partner
  const sheetData: Nav65MPartnerSheetData | null = useMemo(() => {
    if (!activePartner) return null;
    return buildNav65MPartnerSheets(
      activePartner,
      selectedCompany,
      year,
      month,
      frequency,
      effectiveInvoices
    );
  }, [activePartner, selectedCompany, year, month, frequency, effectiveInvoices]);

  // Reset sheet index when switching partners
  const handleSelectPartner = useCallback((idx: number) => {
    setSelectedPartnerIndex(idx);
    setActiveSheetIndex(0);
  }, []);

  const handlePrevPartner = useCallback(() => {
    setSelectedPartnerIndex((prev) => {
      const next = Math.max(0, prev - 1);
      setActiveSheetIndex(0);
      return next;
    });
  }, []);

  const handleNextPartner = useCallback(() => {
    setSelectedPartnerIndex((prev) => {
      const next = Math.min(searchedPartners.length - 1, prev + 1);
      setActiveSheetIndex(0);
      return next;
    });
  }, [searchedPartners.length]);

  const handlePrint = () => {
    window.print();
  };

  const handleRecalculate = async () => {
    if (!onRecalculate) return;
    try {
      setIsRefreshing(true);
      await onRecalculate();
      toast({
        title: 'ÁFA bevallás frissítve',
        description: 'A 2665M M-lapok számai sikeresen újraszámítva a számlákból!',
      });
    } catch (err: any) {
      toast({
        title: 'Hiba a frissítéskor',
        description: err?.message || 'Nem sikerült az adatok újraszámítása.',
        variant: 'destructive',
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  // Keyboard navigation for power users (Ctrl/Alt + Arrow keys)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }
      if (e.key === 'ArrowLeft' && e.altKey) {
        e.preventDefault();
        handlePrevPartner();
      } else if (e.key === 'ArrowRight' && e.altKey) {
        e.preventDefault();
        handleNextPartner();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handlePrevPartner, handleNextPartner]);

  if (!eligiblePartners.length) {
    return (
      <div className="bg-card border border-border/70 rounded-xl p-8 text-center space-y-3">
        <Building2 className="w-10 h-10 text-muted-foreground mx-auto opacity-40" />
        <h3 className="font-semibold text-base text-foreground">
          Nincsenek belföldi partnerek a kiválasztott időszakban
        </h3>
        <p className="text-xs text-muted-foreground max-w-md mx-auto">
          Az adott időszakra nem található olyan belföldi számla, amely a 2665M nyomtatvány lapjain jelentésre kötelezett lenne.
        </p>
      </div>
    );
  }

  // Flattened sheets array for the active partner:
  // [0] = Főlap
  // [1..N] = 02 sheets
  // [N+1..N+M] = 02-K sheets
  const flattenedSheets = useMemo(() => {
    if (!sheetData) return [];
    const list: {
      id: string;
      label: string;
      sheetType: 'folap' | '02' | '02K';
      pageIndex: number;
      element: React.ReactNode;
    }[] = [
      {
        id: 'folap',
        label: '📄 2665M Főlap',
        sheetType: 'folap',
        pageIndex: 0,
        element: <Nav2665MSheetFolap key="folap" sheetData={sheetData} />,
      },
    ];

    sheetData.normalPages.forEach((p, idx) => {
      list.push({
        id: `02_${p.pageNumber}`,
        label: `02 (${p.pageNumber}. lap)`,
        sheetType: '02',
        pageIndex: idx,
        element: (
          <Nav2665MSheet02
            key={`02_${p.pageNumber}`}
            sheetData={sheetData}
            pageData={p}
          />
        ),
      });
    });

    sheetData.correctionPages.forEach((p, idx) => {
      list.push({
        id: `02K_${p.pageNumber}`,
        label: `02-K (${p.pageNumber}. lap)`,
        sheetType: '02K',
        pageIndex: idx,
        element: (
          <Nav2665MSheet02K
            key={`02K_${p.pageNumber}`}
            sheetData={sheetData}
            pageData={p}
          />
        ),
      });
    });

    return list;
  }, [sheetData]);

  const totalSheets = flattenedSheets.length;
  const currentSheet = flattenedSheets[activeSheetIndex] || flattenedSheets[0];

  return (
    <div className={cn('space-y-4 select-text', className)}>
      {/* Top Command Toolbar */}
      <Card className="print:hidden border-border/80 shadow-xs bg-card/95 backdrop-blur-sm">
        <CardHeader className="p-3 sm:p-4 border-b border-border/60">
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-3">
            {/* Title & Stats */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0">
                <FileText className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-serif font-black text-base tracking-tight text-foreground">
                    NAV 2665M Hivatalos M-lap Replika
                  </h3>
                  <Badge variant="outline" className="text-[10px] py-0 px-2 border-emerald-500/30 text-emerald-600 bg-emerald-500/5">
                    {eligiblePartners.length} partner összesen
                  </Badge>
                </div>
                <p className="text-[11px] text-muted-foreground font-mono">
                  {selectedCompany?.name} ({selectedCompany?.tax_number}) · {year}. {frequency === 'H' ? `${month}. hó` : frequency === 'N' ? `Q${month}` : 'év'}
                </p>
              </div>
            </div>

            {/* Partner Quick Switcher & Counter */}
            <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto justify-end">
              <div className="flex items-center gap-1 bg-muted/60 p-0.5 rounded-lg border border-border/60">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-foreground hover:bg-background"
                  onClick={handlePrevPartner}
                  disabled={selectedPartnerIndex <= 0}
                  title="Előző partner (Alt + Balra nyíl)"
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>

                {/* Partner Select */}
                <Select
                  value={String(selectedPartnerIndex)}
                  onValueChange={(val) => handleSelectPartner(Number(val))}
                >
                  <SelectTrigger className="h-8 w-56 sm:w-72 text-xs bg-background font-medium">
                    <SelectValue placeholder="Válassz partnert..." />
                  </SelectTrigger>
                  <SelectContent className="max-h-72">
                    {searchedPartners.map((p, idx) => (
                      <SelectItem key={p.id || idx} value={String(idx)} className="text-xs">
                        <span className="font-semibold">{idx + 1}. {p.partner_name}</span>{' '}
                        <span className="text-[11px] text-muted-foreground font-mono">({p.partner_tax_number || '—'})</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-foreground hover:bg-background"
                  onClick={handleNextPartner}
                  disabled={selectedPartnerIndex >= searchedPartners.length - 1}
                  title="Következő partner (Alt + Jobbra nyíl)"
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-1.5">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRecalculate}
                  disabled={isRecalculating || isRefreshing}
                  className="h-8 gap-1.5 text-xs shadow-2xs"
                  title="Számlák alapján az M-lapok újraszámítása"
                >
                  <RotateCw className={cn('w-3.5 h-3.5', (isRecalculating || isRefreshing) && 'animate-spin text-primary')} />
                  <span className="hidden sm:inline">Újraszámítás</span>
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={handlePrint}
                  className="h-8 gap-1.5 text-xs shadow-2xs"
                  title="Formátumhű A4 nyomtatás / PDF mentés"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Nyomtatás</span>
                </Button>
              </div>
            </div>
          </div>
        </CardHeader>

        {/* Navigation & Display Mode Bar */}
        <CardContent className="p-2 sm:p-3 flex flex-col md:flex-row justify-between items-center gap-3">
          {/* Mode Switcher: Paginated vs Continuous */}
          <div className="flex items-center gap-2 w-full md:w-auto">
            <div className="flex bg-muted/70 p-0.5 rounded-lg border border-border/60 shadow-inner">
              <Button
                variant={displayMode === 'paginated' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setDisplayMode('paginated')}
                className={cn(
                  'h-7 px-3 text-xs font-semibold gap-1.5 transition-all',
                  displayMode === 'paginated'
                    ? 'bg-background shadow-xs text-foreground font-bold'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <Layers className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>Lapozható mód</span>
              </Button>

              <Button
                variant={displayMode === 'continuous' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setDisplayMode('continuous')}
                className={cn(
                  'h-7 px-3 text-xs font-semibold gap-1.5 transition-all',
                  displayMode === 'continuous'
                    ? 'bg-background shadow-xs text-foreground font-bold'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <ScrollText className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                <span>Egybefűzve görgethető</span>
              </Button>
            </div>

            {/* Partner Sheet Pills in Paginated mode */}
            {displayMode === 'paginated' && (
              <div className="flex flex-wrap items-center gap-1 overflow-x-auto max-w-xl scrollbar-none py-0.5">
                {flattenedSheets.map((sh, idx) => (
                  <Button
                    key={sh.id}
                    variant={activeSheetIndex === idx ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setActiveSheetIndex(idx)}
                    className={cn(
                      'h-7 px-2 text-[11px] font-mono',
                      activeSheetIndex === idx
                        ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-950 font-bold'
                        : 'bg-background text-muted-foreground hover:text-foreground'
                    )}
                  >
                    {sh.label}
                  </Button>
                ))}
              </div>
            )}
          </div>

          {/* Right: Partner Stats & Zoom controls */}
          <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-end">
            {sheetData && (
              <div className="text-[11px] font-mono text-muted-foreground hidden lg:flex items-center gap-2">
                <span>Alap: <strong>{sheetData.folap.row07.baseEft.toLocaleString('hu-HU')} eFt</strong></span>
                <span>·</span>
                <span>Adó: <strong>{sheetData.folap.row07.taxEft.toLocaleString('hu-HU')} eFt</strong></span>
              </div>
            )}

            {/* Zoom controls */}
            <div className="flex items-center gap-1 bg-muted/60 p-0.5 rounded-lg border border-border/60">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground hover:text-foreground"
                onClick={() => setZoomLevel((z) => Math.max(60, z - 10))}
                title="Kicsinyítés"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </Button>
              <span className="text-[11px] font-mono font-medium px-1.5 w-10 text-center text-foreground">
                {zoomLevel}%
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground hover:text-foreground"
                onClick={() => setZoomLevel((z) => Math.min(140, z + 10))}
                title="Nagyítás"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main Replica View Container */}
      <div
        className="w-full transition-transform origin-top flex flex-col items-center print:transform-none print:m-0"
        style={{
          transform: zoomLevel !== 100 ? `scale(${zoomLevel / 100})` : undefined,
        }}
      >
        {displayMode === 'paginated' ? (
          // 1. Paginated Mode: 1 active sheet rendered at a time
          <div className="w-full flex justify-center animate-in fade-in duration-200">
            {currentSheet?.element}
          </div>
        ) : (
          // 2. Continuous Scrollable Mode: All sheets for the active partner stacked vertically
          <div className="w-full space-y-8 print:space-y-0 flex flex-col items-center">
            {flattenedSheets.map((sh, idx) => (
              <div key={sh.id} className="w-full flex flex-col items-center relative">
                {/* Visual page break divider in continuous mode */}
                <div className="print:hidden w-full max-w-[880px] flex items-center justify-between text-[11px] font-mono text-muted-foreground pb-1 px-1">
                  <span>{sh.label}</span>
                  <span>{idx + 1} / {totalSheets}. lap</span>
                </div>
                {sh.element}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Pagination Footer Controls in Paginated Mode */}
      {displayMode === 'paginated' && totalSheets > 1 && (
        <div className="print:hidden flex items-center justify-center gap-3 pt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setActiveSheetIndex((i) => Math.max(0, i - 1))}
            disabled={activeSheetIndex <= 0}
            className="h-8 gap-1 text-xs"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            <span>Előző lap</span>
          </Button>

          <span className="text-xs font-mono text-muted-foreground">
            {activeSheetIndex + 1} / {totalSheets}
          </span>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setActiveSheetIndex((i) => Math.min(totalSheets - 1, i + 1))}
            disabled={activeSheetIndex >= totalSheets - 1}
            className="h-8 gap-1 text-xs"
          >
            <span>Következő lap</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </Button>
        </div>
      )}
    </div>
  );
}
