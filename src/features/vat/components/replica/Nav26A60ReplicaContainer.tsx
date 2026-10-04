import React, { useState, useMemo } from 'react';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  FileText,
  Printer,
  RotateCw,
  ZoomIn,
  ZoomOut,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { Nav2665PageFrame } from './Nav2665PageFrame';
import { Nav26A60SheetFolap } from './Nav26A60SheetFolap';
import {
  Nav26A60SheetTable,
  type A60AggregatedPartnerItem,
  type A60SubSheetType,
} from './Nav26A60SheetTable';
import { type A60CalculationsResult, type A60InvoiceItem, type A60ItemCategory } from '../../types';

export type A60SheetType =
  | 'folap'
  | '01'
  | '02'
  | '03'
  | '04'
  | '05'
  | 'all';

export interface Nav26A60ReplicaContainerProps {
  selectedCompany: any;
  year: number;
  month: number;
  frequency: string;
  a60Calculations: A60CalculationsResult;
  defaultSheet?: A60SheetType;
  onRecalculate?: () => Promise<void> | void;
  isRecalculating?: boolean;
}

/**
 * Helper to aggregate items by partner EU tax number for official A60 filings
 */
function aggregateA60CategoryItems(
  items: A60InvoiceItem[],
  category: A60ItemCategory
): A60AggregatedPartnerItem[] {
  const filtered = items.filter((item) => item.category === category);
  const map = new Map<string, A60AggregatedPartnerItem>();

  filtered.forEach((inv) => {
    const rawTax = (inv.partner_tax_number || '').trim().toUpperCase();
    const cleanTax = rawTax.replace(/[\s.-]/g, '');
    const countryCode =
      (inv as any).country_code || (cleanTax.length >= 2 ? cleanTax.slice(0, 2) : 'EU');
    const vatNumber = cleanTax.startsWith(countryCode)
      ? cleanTax.slice(countryCode.length)
      : cleanTax;
    const key = `${countryCode}_${vatNumber}`;

    if (!map.has(key)) {
      map.set(key, {
        countryCode,
        vatNumber,
        fullTaxNumber: cleanTax,
        partnerName: inv.partner_name || '',
        amountEft: 0,
        invoiceCount: 0,
      });
    }

    const entry = map.get(key)!;
    entry.amountEft += inv.amountEft || 0;
    entry.invoiceCount = (entry.invoiceCount || 0) + 1;
  });

  return Array.from(map.values()).sort((a, b) => b.amountEft - a.amountEft);
}

/**
 * Splits items into pages of 24
 */
function chunkArray<T>(arr: T[], size: number): T[][] {
  if (arr.length === 0) return [[]];
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

/**
 * Authentic NAV 26A60 Official Tax Return Digital Replica Container.
 * Pixel-accurate, read-only simulation of the Hungarian state ÁNYK 26A60 declaration.
 */
export function Nav26A60ReplicaContainer({
  selectedCompany,
  year,
  month,
  frequency,
  a60Calculations,
  defaultSheet = 'all',
  onRecalculate,
  isRecalculating = false,
}: Nav26A60ReplicaContainerProps) {
  const { toast } = useToast();
  const [activeSheet, setActiveSheet] = useState<A60SheetType>(defaultSheet);
  const [zoomLevel, setZoomLevel] = useState<number>(100);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Form code prefix based on year (e.g. 2026 -> 26A60)
  const formCode = `${String(year).slice(-2)}A60`;

  // Aggregated data per statutory sheet
  const goodsOutItems = useMemo(
    () => aggregateA60CategoryItems(a60Calculations.itemsList || [], 'goods_out'),
    [a60Calculations.itemsList]
  );

  const goodsInItems = useMemo(
    () => aggregateA60CategoryItems(a60Calculations.itemsList || [], 'goods_in'),
    [a60Calculations.itemsList]
  );

  const servicesOutItems = useMemo(
    () => aggregateA60CategoryItems(a60Calculations.itemsList || [], 'services_out'),
    [a60Calculations.itemsList]
  );

  const servicesInItems = useMemo(
    () => aggregateA60CategoryItems(a60Calculations.itemsList || [], 'services_in'),
    [a60Calculations.itemsList]
  );

  // Paginated chunks (24 items per page)
  const goodsOutPages = useMemo(() => chunkArray(goodsOutItems, 24), [goodsOutItems]);
  const goodsInPages = useMemo(() => chunkArray(goodsInItems, 24), [goodsInItems]);
  const servicesOutPages = useMemo(() => chunkArray(servicesOutItems, 24), [servicesOutItems]);
  const servicesInPages = useMemo(() => chunkArray(servicesInItems, 24), [servicesInItems]);

  const handlePrint = () => {
    window.print();
  };

  const handleRefresh = async () => {
    if (!onRecalculate) return;
    try {
      setIsRefreshing(true);
      await onRecalculate();
      toast({
        title: 'Sikeres frissítés',
        description: 'Az A60 nyilatkozat adatai újraszámolva az adatbázisból.',
      });
    } catch (err: any) {
      toast({
        title: 'Hiba a frissítéskor',
        description: err.message || 'Nem sikerült az adatok újratöltése.',
        variant: 'destructive',
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  const hasAnyData =
    goodsOutItems.length > 0 ||
    goodsInItems.length > 0 ||
    servicesOutItems.length > 0 ||
    servicesInItems.length > 0;

  return (
    <div className="space-y-4">
      {/* 1. TOP TOOLBAR & CONTROLS */}
      <Card className="border border-neutral-200 dark:border-neutral-800 shadow-sm print:hidden">
        <CardHeader className="py-2.5 px-4 border-b border-neutral-100 dark:border-neutral-800">
          <div className="flex flex-wrap items-center justify-between gap-3">
            {/* Left: Title & Badge */}
            <div className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              <div>
                <span className="font-bold text-sm text-neutral-900 dark:text-neutral-100">
                  NAV {formCode} Hivatalos Nyomtatvány Replika
                </span>
                <span className="text-xs text-neutral-500 block">
                  {selectedCompany?.name} • {year} / {String(month).padStart(2, '0')}. hó
                </span>
              </div>
              <Badge
                variant="outline"
                className={cn(
                  'ml-2 text-[11px] font-mono font-medium',
                  a60Calculations.isValid
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400'
                    : 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400'
                )}
              >
                {a60Calculations.isValid ? (
                  <CheckCircle2 className="w-3 h-3 mr-1 inline" />
                ) : (
                  <AlertCircle className="w-3 h-3 mr-1 inline" />
                )}
                {a60Calculations.isValid ? 'Egyezik a 65-ös bevallással' : 'Eltérés az ÁFA bevalláshoz képest'}
              </Badge>
            </div>

            {/* Right: Actions */}
            <div className="flex items-center gap-2">
              {onRecalculate && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRefresh}
                  disabled={isRefreshing || isRecalculating}
                  className="h-8 text-xs gap-1.5"
                >
                  <RotateCw
                    className={cn('w-3.5 h-3.5', (isRefreshing || isRecalculating) && 'animate-spin')}
                  />
                  <span>Adatok frissítése DB-ből</span>
                </Button>
              )}

              <Button
                variant="default"
                size="sm"
                onClick={handlePrint}
                className="h-8 text-xs gap-1.5 bg-neutral-900 hover:bg-neutral-800 text-white dark:bg-neutral-100 dark:text-neutral-900"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Nyomtatás / PDF</span>
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="py-2.5 px-4 flex flex-wrap items-center justify-between gap-3 bg-neutral-50/50 dark:bg-neutral-900/50">
          {/* Sheet Switcher Tabs */}
          <div className="flex flex-wrap items-center gap-1.5">
            <Button
              variant={activeSheet === 'folap' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setActiveSheet('folap')}
              className={cn(
                'h-7 px-2.5 text-xs font-medium',
                activeSheet === 'folap' ? 'bg-indigo-600 text-white' : 'bg-white text-neutral-700'
              )}
            >
              Főlap
            </Button>

            <Button
              variant={activeSheet === '01' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setActiveSheet('01')}
              className={cn(
                'h-7 px-2 text-xs font-medium gap-1',
                activeSheet === '01' ? 'bg-indigo-600 text-white' : 'bg-white text-neutral-700'
              )}
            >
              <span>01 Lap (Értékesítés)</span>
              {goodsOutItems.length > 0 && (
                <span className="bg-emerald-500 text-white text-[10px] font-bold px-1 rounded-full">
                  {goodsOutItems.length}
                </span>
              )}
            </Button>

            <Button
              variant={activeSheet === '02' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setActiveSheet('02')}
              className={cn(
                'h-7 px-2 text-xs font-medium gap-1',
                activeSheet === '02' ? 'bg-indigo-600 text-white' : 'bg-white text-neutral-700'
              )}
            >
              <span>02 Lap (Beszerzés)</span>
              {goodsInItems.length > 0 && (
                <span className="bg-emerald-500 text-white text-[10px] font-bold px-1 rounded-full">
                  {goodsInItems.length}
                </span>
              )}
            </Button>

            <Button
              variant={activeSheet === '03' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setActiveSheet('03')}
              className={cn(
                'h-7 px-2 text-xs font-medium gap-1',
                activeSheet === '03' ? 'bg-indigo-600 text-white' : 'bg-white text-neutral-700'
              )}
            >
              <span>03 Lap (Szolg. nyújtás)</span>
              {servicesOutItems.length > 0 && (
                <span className="bg-emerald-500 text-white text-[10px] font-bold px-1 rounded-full">
                  {servicesOutItems.length}
                </span>
              )}
            </Button>

            <Button
              variant={activeSheet === '04' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setActiveSheet('04')}
              className={cn(
                'h-7 px-2 text-xs font-medium gap-1',
                activeSheet === '04' ? 'bg-indigo-600 text-white' : 'bg-white text-neutral-700'
              )}
            >
              <span>04 Lap (Szolg. igénybevétel)</span>
              {servicesInItems.length > 0 && (
                <span className="bg-emerald-500 text-white text-[10px] font-bold px-1 rounded-full">
                  {servicesInItems.length}
                </span>
              )}
            </Button>

            <Button
              variant={activeSheet === '05' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setActiveSheet('05')}
              className={cn(
                'h-7 px-2 text-xs font-medium',
                activeSheet === '05' ? 'bg-indigo-600 text-white' : 'bg-white text-neutral-700'
              )}
            >
              05 Lap (Készlet)
            </Button>

            <div className="w-[1px] h-5 bg-neutral-300 mx-1 hidden sm:block" />

            <Button
              variant={activeSheet === 'all' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setActiveSheet('all')}
              className={cn(
                'h-7 px-2.5 text-xs font-medium',
                activeSheet === 'all' ? 'bg-neutral-800 text-white' : 'bg-white text-neutral-700'
              )}
            >
              📑 Összes lap egyben
            </Button>
          </div>

          {/* Zoom Controls */}
          <div className="flex items-center gap-1.5 text-xs font-mono">
            <span className="text-neutral-500 text-[10px] mr-1 hidden sm:inline">Méret:</span>
            <Button
              variant="outline"
              size="icon"
              className="h-7 w-7 bg-white text-neutral-700"
              onClick={() => setZoomLevel((z) => Math.max(65, z - 10))}
              disabled={zoomLevel <= 65}
              title="Kicsinyítés"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </Button>
            <span className="w-10 text-center font-bold text-xs">{zoomLevel}%</span>
            <Button
              variant="outline"
              size="icon"
              className="h-7 w-7 bg-white text-neutral-700"
              onClick={() => setZoomLevel((z) => Math.min(130, z + 10))}
              disabled={zoomLevel >= 130}
              title="Nagyítás"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 2. RENDERED PAGES IN A4 SHEETS */}
      <div
        className="nav26a60-printable-root w-full overflow-x-auto py-2 bg-neutral-200/50 print:bg-white rounded-lg print:p-0 flex flex-col items-center"
        style={{
          transformOrigin: 'top center',
        }}
      >
        <div
          className="print:!transform-none"
          style={{
            transform: zoomLevel !== 100 ? `scale(${zoomLevel / 100})` : undefined,
            transformOrigin: 'top center',
            transition: 'transform 0.15s ease-out',
            width: '100%',
          }}
        >
          {/* SHEET 1: FŐLAP */}
          {(activeSheet === 'folap' || activeSheet === 'all') && (
            <Nav2665PageFrame
              sheetCode={formCode}
              taxNumber={selectedCompany?.tax_number}
              pageNumber={1}
            >
              <Nav26A60SheetFolap
                selectedCompany={selectedCompany}
                year={year}
                month={month}
                frequency={frequency}
              />
            </Nav2665PageFrame>
          )}

          {/* SHEET 2: 26A60-01 (Közösségi termékértékesítések) */}
          {(activeSheet === '01' || (activeSheet === 'all' && goodsOutItems.length > 0) || (activeSheet === 'all' && !hasAnyData)) && (
            goodsOutPages.map((pageItems, pageIdx) => (
              <Nav2665PageFrame
                key={`01-${pageIdx}`}
                sheetCode={`${formCode}-01`}
                sheetTitle="Közösségi termékértékesítések részletezése"
                sheetSubTitle="Az Európai Közösség területén belül történt termékértékesítések adatai (02. sor analitikája)"
                taxNumber={selectedCompany?.tax_number}
                pageNumber={pageIdx + 1}
                totalPages={goodsOutPages.length}
              >
                <div className="text-right text-[9px] text-neutral-600 font-bold mb-1">
                  Az adatokat ezer forintban kell feltüntetni!
                </div>
                <Nav26A60SheetTable
                  sheetType="01"
                  items={pageItems}
                  pageNumber={pageIdx + 1}
                />
              </Nav2665PageFrame>
            ))
          )}

          {/* SHEET 3: 26A60-02 (Közösségi termékbeszerzések) */}
          {(activeSheet === '02' || (activeSheet === 'all' && goodsInItems.length > 0) || (activeSheet === 'all' && !hasAnyData)) && (
            goodsInPages.map((pageItems, pageIdx) => (
              <Nav2665PageFrame
                key={`02-${pageIdx}`}
                sheetCode={`${formCode}-02`}
                sheetTitle="Közösségi termékbeszerzések részletezése"
                sheetSubTitle="Az Európai Közösség területéről történt termékbeszerzések adatai (11-16. sorok analitikája)"
                taxNumber={selectedCompany?.tax_number}
                pageNumber={pageIdx + 1}
                totalPages={goodsInPages.length}
              >
                <div className="text-right text-[9px] text-neutral-600 font-bold mb-1">
                  Az adatokat ezer forintban kell feltüntetni!
                </div>
                <Nav26A60SheetTable
                  sheetType="02"
                  items={pageItems}
                  pageNumber={pageIdx + 1}
                />
              </Nav2665PageFrame>
            ))
          )}

          {/* SHEET 4: 26A60-03 (Közösségi szolgáltatásnyújtások) */}
          {(activeSheet === '03' || (activeSheet === 'all' && servicesOutItems.length > 0)) && (
            servicesOutPages.map((pageItems, pageIdx) => (
              <Nav2665PageFrame
                key={`03-${pageIdx}`}
                sheetCode={`${formCode}-03`}
                sheetTitle="Közösségi szolgáltatásnyújtások részletezése"
                sheetSubTitle="Az Európai Közösség területén belül nyújtott szolgáltatások adatai (91-92. sorok analitikája)"
                taxNumber={selectedCompany?.tax_number}
                pageNumber={pageIdx + 1}
                totalPages={servicesOutPages.length}
              >
                <div className="text-right text-[9px] text-neutral-600 font-bold mb-1">
                  Az adatokat ezer forintban kell feltüntetni!
                </div>
                <Nav26A60SheetTable
                  sheetType="03"
                  items={pageItems}
                  pageNumber={pageIdx + 1}
                />
              </Nav2665PageFrame>
            ))
          )}

          {/* SHEET 5: 26A60-04 (Közösségi szolgáltatás igénybevételek) */}
          {(activeSheet === '04' || (activeSheet === 'all' && servicesInItems.length > 0)) && (
            servicesInPages.map((pageItems, pageIdx) => (
              <Nav2665PageFrame
                key={`04-${pageIdx}`}
                sheetCode={`${formCode}-04`}
                sheetTitle="Közösségi szolgáltatás igénybevételek részletezése"
                sheetSubTitle="Az Európai Közösség területéről igénybevett szolgáltatások adatai (18. sor analitikája)"
                taxNumber={selectedCompany?.tax_number}
                pageNumber={pageIdx + 1}
                totalPages={servicesInPages.length}
              >
                <div className="text-right text-[9px] text-neutral-600 font-bold mb-1">
                  Az adatokat ezer forintban kell feltüntetni!
                </div>
                <Nav26A60SheetTable
                  sheetType="04"
                  items={pageItems}
                  pageNumber={pageIdx + 1}
                />
              </Nav2665PageFrame>
            ))
          )}

          {/* SHEET 6: 26A60-05 (Közösségi vevői készlet átmozgatás) */}
          {activeSheet === '05' && (
            <Nav2665PageFrame
              sheetCode={`${formCode}-05`}
              sheetTitle="Közösségi vevői készlet átmozgatás"
              sheetSubTitle="Vevői készletre történő kivitel / behozatal nyilatkozati lapja"
              taxNumber={selectedCompany?.tax_number}
              pageNumber={1}
            >
              <Nav26A60SheetTable
                sheetType="05"
                items={[]}
                pageNumber={1}
              />
            </Nav2665PageFrame>
          )}
        </div>
      </div>
    </div>
  );
}
