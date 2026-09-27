import React, { useState, useMemo, useEffect } from 'react';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  FileText,
  Printer,
  RotateCw,
  ZoomIn,
  ZoomOut,
  Layers,
  CheckCircle2,
  AlertCircle,
  Download,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { Nav2665PageFrame } from './Nav2665PageFrame';
import { Nav2665SheetFolap } from './Nav2665SheetFolap';
import { Nav2665Sheet0101 } from './Nav2665Sheet0101';
import { Nav2665Sheet0102 } from './Nav2665Sheet0102';
import { Nav2665Sheet0103 } from './Nav2665Sheet0103';
import { Nav2665Sheet0105 } from './Nav2665Sheet0105';
import { Nav2665Sheet07, type ReverseChargeSteelItem } from './Nav2665Sheet07';
import { Nav2665Sheet08 } from './Nav2665Sheet08';
import { useSteelProductsData } from '../../hooks/useSteelProductsData';
import type { VatFrequency } from '../../types';

export interface Nav2665ReplicaContainerProps {
  selectedCompany: any;
  year: number;
  month: number;
  frequency: string;
  getVal: (row: string, col: 'base' | 'tax') => number;
  onRecalculate?: () => Promise<void> | void;
  isRecalculating?: boolean;
  mLines?: any[];
}

export type SheetType =
  | 'folap'
  | '0101'
  | '0102'
  | '0103'
  | '0105'
  | '07'
  | '08'
  | 'all';

export function Nav2665ReplicaContainer({
  selectedCompany,
  year,
  month,
  frequency,
  getVal,
  onRecalculate,
  isRecalculating = false,
  mLines = [],
}: Nav2665ReplicaContainerProps) {
  const { toast } = useToast();
  const [activeSheet, setActiveSheet] = useState<SheetType>('folap');
  const [zoomLevel, setZoomLevel] = useState<number>(100);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Fetch steel / reverse charge items for sheets 07 & 08
  const { steelItems = [] } = useSteelProductsData(
    selectedCompany,
    year,
    month,
    frequency as VatFrequency
  );

  const outboundSteelItems: ReverseChargeSteelItem[] = useMemo(() => {
    return steelItems
      .filter((s) => s.direction === 'OUTBOUND')
      .map((s) => ({
        id: s.id,
        partnerTaxNumber: s.partnerTaxNumber,
        deliveryDate: s.deliveryDate || '',
        productName: s.productName,
        vtsz: s.vtsz || '7215',
        quantityKg: s.netWeightKg || 0,
        netAmountHuf: s.netAmount || 0,
      }));
  }, [steelItems]);

  const inboundSteelItems: ReverseChargeSteelItem[] = useMemo(() => {
    return steelItems
      .filter((s) => s.direction === 'INBOUND')
      .map((s) => ({
        id: s.id,
        partnerTaxNumber: s.partnerTaxNumber,
        deliveryDate: s.deliveryDate || '',
        productName: s.productName,
        vtsz: s.vtsz || '7214',
        quantityKg: s.netWeightKg || 0,
        netAmountHuf: s.netAmount || 0,
      }));
  }, [steelItems]);

  const hasOutboundSteel = outboundSteelItems.length > 0 || getVal('100', 'base') > 0;
  const hasInboundSteel = inboundSteelItems.length > 0 || getVal('101', 'base') > 0 || getVal('29', 'tax') > 0;
  const hasAnySteel = hasOutboundSteel || hasInboundSteel;

  const partnerCount = mLines.length > 0 ? mLines.length : 5;
  const invoiceCount = mLines.reduce((acc, m) => acc + (m.invoice_count || 1), 0) || 5;

  const mLineTotalBase = mLines.reduce((acc, m) => acc + (m.base_amount_rounded || 0), 0);
  const mLineTotalTax = mLines.reduce((acc, m) => acc + (m.tax_amount_rounded || 0), 0);

  // Quick KPI numbers for toolbar
  const payableTax = getVal('36', 'tax');
  const deductibleTax = getVal('76', 'tax');
  const netResult = getVal('83', 'tax');

  // Trigger recalculation from DB
  const handleRecalculate = async () => {
    if (onRecalculate) {
      try {
        setIsRefreshing(true);
        await onRecalculate();
        toast({
          title: 'ÁFA bevallás frissítve',
          description: 'A 2665A nyomtatvány számai sikeresen újraszámítva a számlákból!',
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
    }
  };

  useEffect(() => {
    document.body.classList.add('printing-nav65');
    return () => {
      document.body.classList.remove('printing-nav65');
    };
  }, []);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-4 print:space-y-0">
      {/* Print isolation style for A4 portrait tax return pages */}
      <style>{`
        @media print {
          @page {
            size: A4 portrait !important;
            margin: 8mm 6mm !important;
          }
          html, body, #root {
            height: auto !important;
            min-height: auto !important;
            overflow: visible !important;
            background: white !important;
          }
          body * {
            visibility: hidden !important;
          }
          .nav2665-printable-root,
          .nav2665-printable-root * {
            visibility: visible !important;
          }
          .nav2665-printable-root {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            background: white !important;
            transform: none !important;
          }
          .nav2665-page-frame {
            break-after: page !important;
            page-break-after: always !important;
            break-inside: avoid !important;
            page-break-inside: avoid !important;
            box-shadow: none !important;
            margin: 0 auto !important;
            max-width: 100% !important;
            width: 100% !important;
            transform: none !important;
            border: 1.5px solid #000000 !important;
          }
          .nav2665-page-frame:last-child {
            break-after: auto !important;
            page-break-after: auto !important;
          }
          .print\\:hidden,
          header,
          nav,
          aside,
          [data-sidebar],
          .support-mode-banner {
            display: none !important;
            visibility: hidden !important;
          }
        }
      `}</style>

      {/* 1. TOP TOOLBAR: Sheet Selector | Zoom | Actions */}
      <Card className="border border-stone-300 shadow-sm bg-neutral-50/90 print:hidden">
        <CardHeader className="p-3 border-b border-stone-200">
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-3">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded bg-neutral-900 text-white flex items-center justify-center font-bold text-xs font-mono select-none">
                2665
              </div>
              <div>
                <h3 className="font-serif font-black text-base tracking-tight text-neutral-900">
                  NAV 2665A Hivatalos Nyomtatvány Hiteles Replika
                </h3>
                <p className="text-[11px] text-neutral-500 font-mono">
                  {selectedCompany?.name} ({selectedCompany?.tax_number}) · {year}. {frequency === 'H' ? `${month}. hó` : frequency === 'N' ? `Q${month}` : 'év'}
                </p>
              </div>
            </div>

            {/* Quick KPI stats banner */}
            <div className="flex flex-wrap items-center gap-3 text-xs font-mono">
              <div className="bg-white border border-neutral-200 px-2.5 py-1 rounded shadow-2xs">
                <span className="text-[10px] text-neutral-500 block">Fizetendő (36. sor):</span>
                <span className="font-bold text-neutral-900 tabular-nums">
                  {payableTax ? Math.round(payableTax).toLocaleString('hu-HU') : '0'} eFt
                </span>
              </div>
              <div className="bg-white border border-neutral-200 px-2.5 py-1 rounded shadow-2xs">
                <span className="text-[10px] text-neutral-500 block">Levonható (76. sor):</span>
                <span className="font-bold text-neutral-900 tabular-nums">
                  {deductibleTax ? Math.round(deductibleTax).toLocaleString('hu-HU') : '0'} eFt
                </span>
              </div>
              <div className={cn(
                'px-2.5 py-1 rounded border shadow-2xs font-bold tabular-nums',
                netResult > 0
                  ? 'bg-red-50 border-red-200 text-red-700'
                  : netResult < 0
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                  : 'bg-neutral-100 border-neutral-200 text-neutral-700'
              )}>
                <span className="text-[10px] block opacity-80">
                  {netResult > 0 ? 'Befizetendő (84.):' : netResult < 0 ? 'Visszaigényelhető (85.):' : 'Egyenleg (83.):'}
                </span>
                <span>
                  {netResult ? Math.abs(Math.round(netResult)).toLocaleString('hu-HU') : '0'} eFt
                </span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleRecalculate}
                disabled={isRecalculating || isRefreshing}
                className="gap-1.5 font-sans text-xs bg-white hover:bg-neutral-100 text-neutral-800"
                title="Számlák alapján a bevallási sorok újraszámítása az adatbázisban"
              >
                <RotateCw className={cn('w-3.5 h-3.5', (isRecalculating || isRefreshing) && 'animate-spin text-primary')} />
                <span>Adatok frissítése DB-ből</span>
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={handlePrint}
                className="gap-1.5 font-sans text-xs bg-white hover:bg-neutral-100 text-neutral-800"
                title="Böngészős nyomtatás vagy PDF mentés formátumhű A4 oldalakkal"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Nyomtatás / PDF</span>
              </Button>
            </div>
          </div>
        </CardHeader>

        {/* Navigation Sheet Pills & Zoom Controls */}
        <CardContent className="p-2 sm:p-3 flex flex-col md:flex-row justify-between items-center gap-3">
          {/* Sheet Selector Pills */}
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <Button
              variant={activeSheet === 'folap' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setActiveSheet('folap')}
              className={cn(
                'h-7 px-2.5 text-xs font-mono font-medium',
                activeSheet === 'folap' ? 'bg-neutral-900 text-white' : 'bg-white text-neutral-700'
              )}
            >
              📄 2665A Főlap
            </Button>
            <Button
              variant={activeSheet === '0101' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setActiveSheet('0101')}
              className={cn(
                'h-7 px-2.5 text-xs font-mono font-medium',
                activeSheet === '0101' ? 'bg-neutral-900 text-white' : 'bg-white text-neutral-700'
              )}
            >
              01-01 (Fizetendő)
            </Button>
            <Button
              variant={activeSheet === '0102' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setActiveSheet('0102')}
              className={cn(
                'h-7 px-2.5 text-xs font-mono font-medium',
                activeSheet === '0102' ? 'bg-neutral-900 text-white' : 'bg-white text-neutral-700'
              )}
            >
              01-02 (Levonható)
            </Button>
            <Button
              variant={activeSheet === '0103' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setActiveSheet('0103')}
              className={cn(
                'h-7 px-2.5 text-xs font-mono font-medium',
                activeSheet === '0103' ? 'bg-neutral-900 text-white' : 'bg-white text-neutral-700'
              )}
            >
              01-03 (Elszámolás)
            </Button>
            <Button
              variant={activeSheet === '0105' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setActiveSheet('0105')}
              className={cn(
                'h-7 px-2.5 text-xs font-mono font-medium',
                activeSheet === '0105' ? 'bg-neutral-900 text-white' : 'bg-white text-neutral-700'
              )}
            >
              01-05 (6/B & 2665M)
            </Button>

            {hasOutboundSteel && (
              <Button
                variant={activeSheet === '07' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setActiveSheet('07')}
                className={cn(
                  'h-7 px-2.5 text-xs font-mono font-medium',
                  activeSheet === '07' ? 'bg-purple-900 text-white' : 'bg-purple-50 text-purple-900 border-purple-200'
                )}
              >
                07 Lap (FAD Értékesítés)
              </Button>
            )}

            {hasInboundSteel && (
              <Button
                variant={activeSheet === '08' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setActiveSheet('08')}
                className={cn(
                  'h-7 px-2.5 text-xs font-mono font-medium',
                  activeSheet === '08' ? 'bg-purple-900 text-white' : 'bg-purple-50 text-purple-900 border-purple-200'
                )}
              >
                08 Lap (FAD Beszerzés)
              </Button>
            )}

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
        className="nav2665-printable-root w-full overflow-x-auto py-2 bg-neutral-200/50 print:bg-white rounded-lg print:p-0 flex flex-col items-center"
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
          {/* SHEET 1: Főlap */}
          {(activeSheet === 'folap' || activeSheet === 'all') && (
            <Nav2665PageFrame
              sheetCode="2665A"
              taxNumber={selectedCompany?.tax_number}
              pageNumber={1}
            >
              <Nav2665SheetFolap
                selectedCompany={selectedCompany}
                year={year}
                month={month}
                frequency={frequency}
                hasSteelItems={hasAnySteel}
                mLineCount={mLines.length || 5}
                partnerCount={partnerCount}
              />
            </Nav2665PageFrame>
          )}

          {/* SHEET 2: 2665A-01-01 */}
          {(activeSheet === '0101' || activeSheet === 'all') && (
            <Nav2665PageFrame
              sheetCode="2665A-01-01"
              sheetTitle="Fizetendő általános forgalmi adó"
              sheetSubTitle="A belföldi és közösségi értékesítések fizetendő adója (01-36. sorok)"
              taxNumber={selectedCompany?.tax_number}
              pageNumber={2}
            >
              <Nav2665Sheet0101 getVal={getVal} />
            </Nav2665PageFrame>
          )}

          {/* SHEET 3: 2665A-01-02 */}
          {(activeSheet === '0102' || activeSheet === 'all') && (
            <Nav2665PageFrame
              sheetCode="2665A-01-02"
              sheetTitle="Tájékoztató adatok és Levonható ÁFA"
              sheetSubTitle="A belföldi beszerzéseket terhelő levonható általános forgalmi adó (37-71. sorok)"
              taxNumber={selectedCompany?.tax_number}
              pageNumber={3}
            >
              <Nav2665Sheet0102 getVal={getVal} />
            </Nav2665PageFrame>
          )}

          {/* SHEET 4: 2665A-01-03 */}
          {(activeSheet === '0103' || activeSheet === 'all') && (
            <Nav2665PageFrame
              sheetCode="2665A-01-03"
              sheetTitle="Általános forgalmi adó elszámolása és részletező adatok"
              sheetSubTitle="Levonható göngyölés, időszaki különbözet (83.), befizetendő / visszaigényelhető egyenleg"
              taxNumber={selectedCompany?.tax_number}
              pageNumber={4}
            >
              <Nav2665Sheet0103 getVal={getVal} />
            </Nav2665PageFrame>
          )}

          {/* SHEET 5: 2665A-01-05 */}
          {(activeSheet === '0105' || activeSheet === 'all') && (
            <Nav2665PageFrame
              sheetCode="2665A-01-05"
              sheetTitle="Fordított adózás és 2665M összesítő jelentés göngyölés"
              sheetSubTitle="6/A és 6/B melléklet termékértékesítés/beszerzés és csatolt 2665M kimutatás"
              taxNumber={selectedCompany?.tax_number}
              pageNumber={5}
            >
              <Nav2665Sheet0105
                getVal={getVal}
                partnerCount={partnerCount}
                invoiceCount={invoiceCount}
                mLineTotalBase={mLineTotalBase}
                mLineTotalTax={mLineTotalTax}
              />
            </Nav2665PageFrame>
          )}

          {/* SHEET 6: 2665A-07 (Értékesítés FAD) */}
          {(activeSheet === '07' || (activeSheet === 'all' && hasOutboundSteel)) && (
            <Nav2665PageFrame
              sheetCode="2665A-07"
              sheetTitle="Fordított adózású értékesítés nyilatkozat"
              sheetSubTitle="Áfa tv. 6/A., 6/B. és 6/C. szerinti vas- és acéltermékek értékesítése"
              taxNumber={selectedCompany?.tax_number}
              pageNumber={6}
            >
              <Nav2665Sheet07 items={outboundSteelItems} />
            </Nav2665PageFrame>
          )}

          {/* SHEET 7: 2665A-08 (Beszerzés FAD) */}
          {(activeSheet === '08' || (activeSheet === 'all' && hasInboundSteel)) && (
            <Nav2665PageFrame
              sheetCode="2665A-08"
              sheetTitle="Fordított adózású beszerzés nyilatkozat"
              sheetSubTitle="Áfa tv. 6/A., 6/B. és 6/C. szerinti vas- és acéltermékek beszerzése"
              taxNumber={selectedCompany?.tax_number}
              pageNumber={7}
            >
              <Nav2665Sheet08 items={inboundSteelItems} pageNumber={1} />
            </Nav2665PageFrame>
          )}
        </div>
      </div>
    </div>
  );
}
