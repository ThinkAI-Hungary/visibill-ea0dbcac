import React, { useState, useMemo } from 'react';
import {
  Shield,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  RefreshCw,
  ExternalLink,
  ArrowUpRight,
  ArrowDownLeft,
  Filter,
  Download,
  FileSpreadsheet,
  FileText,
  Pencil,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import { validateEuVatNumber, EU_VAT_RULES } from '@/lib/vat/euVatValidator';
import { type A60CalculationsResult, type A60Line, type A60InvoiceItem, fmtEft, formatThousands } from '../types';
import { VatXmlExportModal } from './VatXmlExportModal';

interface VatA60TableProps {
  a60Calculations: A60CalculationsResult;
  viesStatuses: Record<string, 'valid' | 'invalid' | 'loading' | null>;
  isValidatingVies: boolean;
  handleViesCheck: (singleTaxNumber?: string) => Promise<void>;
  setEuTypeOverrides: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  selectedCompany?: any;
  year?: number;
  month?: number;
  frequency?: string;
  a60Lines?: A60Line[];
  onExportClick?: () => void;
  onUpdateTaxNumber?: (params: {
    invoiceId: string;
    sourceTable: 'nav_invoices' | 'invoices';
    direction: 'OUTBOUND' | 'INBOUND';
    newTaxNumber: string;
    partnerName?: string;
    updatePartnerRecord?: boolean;
  }) => Promise<any>;
  isUpdatingTaxNumber?: boolean;
}

export function VatA60Table({
  a60Calculations,
  viesStatuses,
  isValidatingVies,
  handleViesCheck,
  setEuTypeOverrides,
  selectedCompany,
  year,
  month,
  frequency,
  a60Lines = [],
  onExportClick,
  onUpdateTaxNumber,
  isUpdatingTaxNumber = false,
}: VatA60TableProps) {
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [directionFilter, setDirectionFilter] = useState<'ALL' | 'OUTBOUND' | 'INBOUND'>('ALL');

  // Közösségi adószám szerkesztés és partner törzs mentés állapotok
  const [editingItem, setEditingItem] = useState<A60InvoiceItem | null>(null);
  const [editTaxInput, setEditTaxInput] = useState('');
  const [updatePartnerMaster, setUpdatePartnerMaster] = useState(true);
  const [isSavingTaxLocal, setIsSavingTaxLocal] = useState(false);

  const editValidation = useMemo(() => {
    if (!editingItem) return null;
    return validateEuVatNumber(editTaxInput);
  }, [editingItem, editTaxInput]);

  const openEditModal = (item: A60InvoiceItem) => {
    setEditingItem(item);
    setEditTaxInput(item.partner_tax_number || '');
    setUpdatePartnerMaster(true);
  };

  const closeEditModal = () => {
    setEditingItem(null);
    setEditTaxInput('');
  };

  const handleSaveTaxNumber = async () => {
    if (!editingItem || !editValidation?.isValid || !onUpdateTaxNumber) return;
    setIsSavingTaxLocal(true);
    try {
      await onUpdateTaxNumber({
        invoiceId: editingItem.id,
        sourceTable: editingItem.source_table || 'nav_invoices',
        direction: editingItem.invoice_direction,
        newTaxNumber: editValidation.cleanVatNumber,
        partnerName: editingItem.partner_name,
        updatePartnerRecord: updatePartnerMaster,
      });
      closeEditModal();
    } finally {
      setIsSavingTaxLocal(false);
    }
  };

  const filteredItems = useMemo(() => {
    if (directionFilter === 'ALL') return a60Calculations.itemsList;
    return a60Calculations.itemsList.filter(
      (item) => item.invoice_direction === directionFilter
    );
  }, [a60Calculations.itemsList, directionFilter]);

  const outboundCount = useMemo(
    () => a60Calculations.itemsList.filter((i) => i.invoice_direction === 'OUTBOUND').length,
    [a60Calculations.itemsList]
  );
  const inboundCount = useMemo(
    () => a60Calculations.itemsList.filter((i) => i.invoice_direction === 'INBOUND').length,
    [a60Calculations.itemsList]
  );

  return (
    <Card className="border border-border/80 shadow-md">
      <CardHeader className="pb-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="space-y-1">
          <CardTitle className="text-sm font-bold flex items-center gap-2">
            <Shield
              className={cn(
                'w-4 h-4',
                a60Calculations.isValid ? 'text-emerald-500' : 'text-amber-500'
              )}
            />
            Közösségi Ügyletek (A60) Keresztellenőrzése
          </CardTitle>
          <CardDescription className="text-xs">
            A60-as összesítő nyilatkozat számláinak összevetése a 65-ös bevallás soraival (02., 11–16., 91–92. és 18. sorok)
          </CardDescription>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleViesCheck()}
            disabled={isValidatingVies}
            title={
              a60Calculations.itemsList.length === 0
                ? 'Nincs közösségi adószámmal rendelkező partner ebben az időszakban'
                : 'Összes közösségi adószám lekérdezése az EU VIES adatbázisból'
            }
            className="h-8 text-xs font-semibold gap-1 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-600 border-indigo-500/20 dark:text-indigo-400 shrink-0"
          >
            {isValidatingVies ? (
              <>
                <Loader2 className="w-3 h-3 animate-spin" />
                VIES Lekérdezés...
              </>
            ) : (
              <>
                <CheckCircle2 className="w-3.5 h-3.5 text-indigo-500" />
                VIES Adószám Ellenőrzés
              </>
            )}
          </Button>

          <Button
            size="sm"
            onClick={() => {
              if (onExportClick) {
                onExportClick();
              } else {
                setIsExportModalOpen(true);
              }
            }}
            className="h-8 text-xs font-semibold gap-1.5 shrink-0 bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm"
          >
            <Download className="w-3.5 h-3.5" />
            <span>ÁNYK A60 Export</span>
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Status Info Banner */}
        {a60Calculations.isValid ? (
          <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400 p-3 rounded-lg text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
            <span>
              Minden közösségi tranzakció (02., 11–16., 91–92., 18. sor) helyes, az összesített összegek egyeznek a 65-ös bevallással és minden adószám érvényes.
            </span>
          </div>
        ) : (
          <div className="bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400 p-3 rounded-lg text-xs space-y-1">
            <div className="flex items-center gap-2 font-semibold">
              <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
              <span>Eltérés vagy hiányzó közösségi adószám észlelhető a 65-ös bevallás soraihoz képest!</span>
            </div>
            {a60Calculations.taxErrors.length > 0 && (
              <ul className="list-disc pl-5 mt-1 space-y-0.5 text-[11px] text-amber-600 dark:text-amber-300">
                {a60Calculations.taxErrors.map((err, idx) => (
                  <li key={idx}>{err}</li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* 4 Statutory Comparison Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* 1. Közösségi Termékértékesítés -> 02. sor */}
          <div
            className={cn(
              'p-3 rounded-lg border text-xs space-y-2 transition-all',
              a60Calculations.goodsOutMismatch
                ? 'border-amber-500/20 bg-amber-500/5'
                : 'border-border/60 bg-muted/30'
            )}
          >
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-1 font-semibold text-foreground">
                <ArrowUpRight className="w-3.5 h-3.5 text-emerald-500" />
                <span>Termékértékesítés</span>
              </div>
              <Badge
                className={cn(
                  'text-[10px]',
                  a60Calculations.goodsOutMismatch
                    ? 'bg-amber-500/10 text-amber-600 border-amber-500/20'
                    : 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
                )}
              >
                {a60Calculations.goodsOutMismatch ? 'Eltérés!' : 'Egyezik'}
              </Badge>
            </div>
            <div className="grid grid-cols-2 gap-2 text-[11px] pt-1">
              <div>
                <span className="text-muted-foreground">Számlák (Kimenő):</span>
                <p className="font-bold font-mono text-sm mt-0.5">
                  {fmtEft(a60Calculations.goodsOutSum)}
                </p>
              </div>
              <div>
                <span className="text-muted-foreground">Bevallás (02. sor):</span>
                <p className="font-bold font-mono text-sm mt-0.5">
                  {fmtEft(a60Calculations.expectedGoodsOut)}
                </p>
              </div>
            </div>
            {a60Calculations.goodsOutMismatch && (
              <p className="text-[10px] text-amber-600 dark:text-amber-300 pt-1 border-t border-amber-500/10">
                Eltérés:{' '}
                {fmtEft(Math.abs(a60Calculations.goodsOutSum - a60Calculations.expectedGoodsOut))}
              </p>
            )}
          </div>

          {/* 2. Közösségi Termékbeszerzés -> 11-16. sorok */}
          <div
            className={cn(
              'p-3 rounded-lg border text-xs space-y-2 transition-all',
              a60Calculations.goodsInMismatch
                ? 'border-amber-500/20 bg-amber-500/5'
                : 'border-border/60 bg-muted/30'
            )}
          >
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-1 font-semibold text-foreground">
                <ArrowDownLeft className="w-3.5 h-3.5 text-blue-500" />
                <span>Termékbeszerzés</span>
              </div>
              <Badge
                className={cn(
                  'text-[10px]',
                  a60Calculations.goodsInMismatch
                    ? 'bg-amber-500/10 text-amber-600 border-amber-500/20'
                    : 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
                )}
              >
                {a60Calculations.goodsInMismatch ? 'Eltérés!' : 'Egyezik'}
              </Badge>
            </div>
            <div className="grid grid-cols-2 gap-2 text-[11px] pt-1">
              <div>
                <span className="text-muted-foreground">Számlák (Bejövő):</span>
                <p className="font-bold font-mono text-sm mt-0.5">
                  {fmtEft(a60Calculations.goodsInSum)}
                </p>
              </div>
              <div>
                <span className="text-muted-foreground">Bevallás (11-16. sor):</span>
                <p className="font-bold font-mono text-sm mt-0.5">
                  {fmtEft(a60Calculations.expectedGoodsIn)}
                </p>
              </div>
            </div>
            {a60Calculations.goodsInMismatch && (
              <p className="text-[10px] text-amber-600 dark:text-amber-300 pt-1 border-t border-amber-500/10">
                Eltérés:{' '}
                {fmtEft(Math.abs(a60Calculations.goodsInSum - a60Calculations.expectedGoodsIn))}
              </p>
            )}
          </div>

          {/* 3. Közösségi Szolgáltatásnyújtás -> 91-92. sorok */}
          <div
            className={cn(
              'p-3 rounded-lg border text-xs space-y-2 transition-all',
              a60Calculations.servicesOutMismatch
                ? 'border-amber-500/20 bg-amber-500/5'
                : 'border-border/60 bg-muted/30'
            )}
          >
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-1 font-semibold text-foreground">
                <ArrowUpRight className="w-3.5 h-3.5 text-emerald-500" />
                <span>Szolgáltatásnyújtás</span>
              </div>
              <Badge
                className={cn(
                  'text-[10px]',
                  a60Calculations.servicesOutMismatch
                    ? 'bg-amber-500/10 text-amber-600 border-amber-500/20'
                    : 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
                )}
              >
                {a60Calculations.servicesOutMismatch ? 'Eltérés!' : 'Egyezik'}
              </Badge>
            </div>
            <div className="grid grid-cols-2 gap-2 text-[11px] pt-1">
              <div>
                <span className="text-muted-foreground">Számlák (Kimenő):</span>
                <p className="font-bold font-mono text-sm mt-0.5">
                  {fmtEft(a60Calculations.servicesOutSum)}
                </p>
              </div>
              <div>
                <span className="text-muted-foreground">Bevallás (91-92. sor):</span>
                <p className="font-bold font-mono text-sm mt-0.5">
                  {fmtEft(a60Calculations.expectedServicesOut)}
                </p>
              </div>
            </div>
            {a60Calculations.servicesOutMismatch && (
              <p className="text-[10px] text-amber-600 dark:text-amber-300 pt-1 border-t border-amber-500/10">
                Eltérés:{' '}
                {fmtEft(Math.abs(a60Calculations.servicesOutSum - a60Calculations.expectedServicesOut))}
              </p>
            )}
          </div>

          {/* 4. Közösségi Szolgáltatás igénybevétele -> 18. sor */}
          <div
            className={cn(
              'p-3 rounded-lg border text-xs space-y-2 transition-all',
              a60Calculations.servicesInMismatch
                ? 'border-amber-500/20 bg-amber-500/5'
                : 'border-border/60 bg-muted/30'
            )}
          >
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-1 font-semibold text-foreground">
                <ArrowDownLeft className="w-3.5 h-3.5 text-blue-500" />
                <span>Szolgáltatás igénybevétel</span>
              </div>
              <Badge
                className={cn(
                  'text-[10px]',
                  a60Calculations.servicesInMismatch
                    ? 'bg-amber-500/10 text-amber-600 border-amber-500/20'
                    : 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
                )}
              >
                {a60Calculations.servicesInMismatch ? 'Eltérés!' : 'Egyezik'}
              </Badge>
            </div>
            <div className="grid grid-cols-2 gap-2 text-[11px] pt-1">
              <div>
                <span className="text-muted-foreground">Számlák (Bejövő/Google):</span>
                <p className="font-bold font-mono text-sm mt-0.5">
                  {fmtEft(a60Calculations.servicesInSum)}
                </p>
              </div>
              <div>
                <span className="text-muted-foreground">Bevallás (18. sor):</span>
                <p className="font-bold font-mono text-sm mt-0.5">
                  {fmtEft(a60Calculations.expectedServicesIn)}
                </p>
              </div>
            </div>
            {a60Calculations.servicesInMismatch && (
              <p className="text-[10px] text-amber-600 dark:text-amber-300 pt-1 border-t border-amber-500/10">
                Eltérés:{' '}
                {fmtEft(Math.abs(a60Calculations.servicesInSum - a60Calculations.expectedServicesIn))}
              </p>
            )}
          </div>
        </div>

        {/* A60 Official Sheets Aggregation (0B, 0C, 0D, 0E lapok) */}
        {a60Lines && a60Lines.length > 0 && (
          <div className="border border-border/70 rounded-lg overflow-hidden space-y-0">
            <div className="bg-muted/50 p-2.5 text-xs font-semibold border-b border-border/60 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4 text-primary" />
                <span>Hivatalos 26A60 Nyilatkozat Lapjai ({a60Lines.length} partner tétel)</span>
                <span className="text-[10px] text-muted-foreground font-normal">
                  (ÁNYK 26A60-ba importálásra kerülő adatok)
                </span>
              </div>
              <Badge variant="outline" className="text-[10px] font-mono">
                Összesen:{' '}
                {fmtEft(
                  a60Lines.reduce((sum, l) => sum + (l.base_amount_rounded || 0) * 1000, 0)
                )}
              </Badge>
            </div>

            <div className="divide-y divide-border/50">
              {[
                { key: 'goods_out', sheet: '0B lap', name: 'Termékértékesítés más tagállamba', refRow: '65-ös bevallás: 02. sor' },
                { key: 'goods_in', sheet: '0C lap', name: 'Termékbeszerzés más tagállamból', refRow: '65-ös bevallás: 11–16. sorok' },
                { key: 'services_out', sheet: '0D lap', name: 'Szolgáltatásnyújtás tagállami partnernek', refRow: '65-ös bevallás: 91–92. sorok' },
                { key: 'services_in', sheet: '0E lap', name: 'Szolgáltatás igénybevétele tagállami partnertől', refRow: '65-ös bevallás: 18. sor' },
              ].map((sheetDef) => {
                const sheetLines = a60Lines.filter((l) => l.category === sheetDef.key);
                if (sheetLines.length === 0) return null;

                const sheetTotalEft = sheetLines.reduce((sum, l) => sum + (l.base_amount_rounded || 0), 0);

                return (
                  <div key={sheetDef.key} className="p-3 bg-card space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <Badge className="text-[10px] font-bold bg-primary/10 text-primary border-primary/20">
                          {sheetDef.sheet}
                        </Badge>
                        <span className="font-semibold text-foreground">{sheetDef.name}</span>
                        <span className="text-[10px] text-muted-foreground">({sheetDef.refRow})</span>
                      </div>
                      <span className="text-xs font-mono font-bold text-foreground">
                        {sheetTotalEft.toLocaleString('hu-HU')} eFt
                      </span>
                    </div>

                    <Table className="text-xs">
                      <TableHeader>
                        <TableRow className="text-[11px] text-muted-foreground border-b border-border/40">
                          <TableHead className="w-16">Ország</TableHead>
                          <TableHead className="w-36">Közösségi adószám</TableHead>
                          <TableHead>Partner neve</TableHead>
                          <TableHead className="text-center w-24">Számlák</TableHead>
                          <TableHead className="text-right w-28">Adóalap (eFt)</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {sheetLines.map((line) => (
                          <TableRow key={line.id} className="hover:bg-muted/20">
                            <TableCell className="font-mono font-bold text-foreground">
                              {line.country_code || '—'}
                            </TableCell>
                            <TableCell className="font-mono font-semibold">
                              {line.partner_vat_number}
                            </TableCell>
                            <TableCell className="font-medium text-foreground">
                              {line.partner_name || 'Ismeretlen partner'}
                            </TableCell>
                            <TableCell className="text-center font-mono">
                              {line.invoice_count} db
                            </TableCell>
                            <TableCell className="text-right font-mono font-bold">
                              {(line.base_amount_rounded || 0).toLocaleString('hu-HU')} eFt
                            </TableCell>
                          </TableRow>
                        ))}
                        <TableRow className="bg-muted/20 font-bold border-t border-border/60">
                          <TableCell colSpan={4} className="text-right text-[11px] text-muted-foreground">
                            {sheetDef.sheet} összesen (25. sor):
                          </TableCell>
                          <TableCell className="text-right font-mono text-primary">
                            {sheetTotalEft.toLocaleString('hu-HU')} eFt
                          </TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Invoices list filter bar and table */}
        <div className="border border-border/60 rounded-lg overflow-hidden">
          <div className="bg-muted/40 p-2.5 text-xs font-semibold border-b border-border/60 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div className="flex items-center gap-2">
              <span>Közösségi (EU) számlák listája ({filteredItems.length})</span>
              <span className="text-[10px] text-muted-foreground font-normal">
                (Átváltva a 65-ös bevallási soraiba)
              </span>
            </div>
            <div className="flex items-center gap-1">
              <Button
                size="sm"
                variant={directionFilter === 'ALL' ? 'secondary' : 'ghost'}
                onClick={() => setDirectionFilter('ALL')}
                className="h-6 text-[10px] px-2"
              >
                Mind ({a60Calculations.itemsList.length})
              </Button>
              <Button
                size="sm"
                variant={directionFilter === 'OUTBOUND' ? 'secondary' : 'ghost'}
                onClick={() => setDirectionFilter('OUTBOUND')}
                className="h-6 text-[10px] px-2 text-emerald-600 dark:text-emerald-400"
              >
                Kimenő ({outboundCount})
              </Button>
              <Button
                size="sm"
                variant={directionFilter === 'INBOUND' ? 'secondary' : 'ghost'}
                onClick={() => setDirectionFilter('INBOUND')}
                className="h-6 text-[10px] px-2 text-blue-600 dark:text-blue-400"
              >
                Bejövő ({inboundCount})
              </Button>
            </div>
          </div>
          <ScrollArea className="max-h-72 overflow-y-auto">
            <Table className="text-xs">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-24">Irány</TableHead>
                  <TableHead>Számlaszám</TableHead>
                  <TableHead>Partner neve</TableHead>
                  <TableHead>Közösségi adószám & VIES</TableHead>
                  <TableHead className="text-right">Nettó összeg</TableHead>
                  <TableHead className="text-center w-36">Besorolás</TableHead>
                  <TableHead className="text-right w-24">65-ös sor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredItems.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-6 text-muted-foreground">
                      Nem található közösségi (EU) számla a kiválasztott szűrésben.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredItems.map((item) => {
                    const isOut = item.invoice_direction === 'OUTBOUND';
                    const targetRow =
                      item.category === 'goods_out'
                        ? '02'
                        : item.category === 'goods_in'
                        ? '11-16'
                        : item.category === 'services_out'
                        ? '91-92'
                        : '18';

                    return (
                      <TableRow key={item.id} className="hover:bg-muted/20">
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={cn(
                              'text-[10px] px-1.5 py-0 font-medium flex items-center gap-1 w-max',
                              isOut
                                ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30 dark:text-emerald-400'
                                : 'bg-blue-500/10 text-blue-600 border-blue-500/30 dark:text-blue-400'
                            )}
                          >
                            {isOut ? (
                              <>
                                <ArrowUpRight className="w-2.5 h-2.5" />
                                Kimenő
                              </>
                            ) : (
                              <>
                                <ArrowDownLeft className="w-2.5 h-2.5" />
                                Bejövő
                              </>
                            )}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-mono font-medium">
                          {item.invoice_number}
                          <span className="block text-[10px] text-muted-foreground font-normal">
                            {item.invoice_delivery_date}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="font-medium text-foreground">{item.partner_name}</div>
                          {item.country_code && (
                            <span className="text-[10px] text-muted-foreground font-mono uppercase">
                              [{item.country_code}]
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="font-mono">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span
                              className={cn(
                                'px-1.5 py-0.5 rounded text-[10px] font-bold flex items-center gap-1 w-max',
                                item.isValidFormat
                                  ? 'bg-emerald-500/10 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400'
                                  : 'bg-red-500/10 text-red-600 dark:bg-red-950/40 dark:text-red-400 border border-red-500/30'
                              )}
                              title={item.formatError}
                            >
                              {item.isValidFormat ? (
                                <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0" />
                              ) : (
                                <AlertTriangle className="w-3 h-3 text-red-500 shrink-0" />
                              )}
                              {item.partner_tax_number || 'HIÁNYZIK!'}
                            </span>

                            {/* VIES státusz CSAK akkor jelenik meg, ha a szintaxis formátum érvényes */}
                            {item.isValidFormat && item.partner_tax_number &&
                              (() => {
                                const status = viesStatuses[item.partner_tax_number];
                                if (status === 'loading') {
                                  return (
                                    <Loader2 className="w-3 h-3 animate-spin text-indigo-500" />
                                  );
                                }
                                if (status === 'valid') {
                                  return (
                                    <Badge
                                      variant="outline"
                                      className="bg-emerald-500/20 border-emerald-500/40 text-emerald-600 dark:text-emerald-400 text-[9px] px-1 py-0 select-none"
                                    >
                                      ✓ VIES Érvényes
                                    </Badge>
                                  );
                                }
                                if (status === 'invalid') {
                                  return (
                                    <Badge
                                      variant="outline"
                                      className="bg-red-500/20 border-red-500/40 text-red-600 dark:text-red-400 text-[9px] px-1 py-0 select-none"
                                    >
                                      ⚠️ VIES Inaktív
                                    </Badge>
                                  );
                                }
                                return null;
                              })()}

                            {/* Hibás formátum jelvény */}
                            {!item.isValidFormat && (
                              <Badge
                                variant="outline"
                                className="bg-red-500/10 border-red-500/30 text-red-600 dark:text-red-400 text-[9px] px-1 py-0 select-none font-sans"
                              >
                                Hibás formátum
                              </Badge>
                            )}

                            {/* Ceruza gomb az azonnali szerkesztéshez */}
                            <button
                              type="button"
                              title="Közösségi adószám javítása és partner törzsbe mentése"
                              onClick={() => openEditModal(item)}
                              className="text-muted-foreground hover:text-primary hover:bg-muted p-1 rounded transition-colors inline-flex items-center"
                            >
                              <Pencil className="w-3 h-3" />
                            </button>

                            {item.isValidFormat && item.partner_tax_number && (
                              <button
                                type="button"
                                title="VIES újraellenőrzése ennél a számlánál"
                                onClick={() => handleViesCheck(item.partner_tax_number)}
                                className="text-muted-foreground hover:text-indigo-600 p-0.5 rounded transition-colors"
                              >
                                <RefreshCw className="w-2.5 h-2.5" />
                              </button>
                            )}
                          </div>
                          {item.formatError && (
                            <div className="text-[10px] text-red-600 dark:text-red-400 font-sans mt-1 leading-tight font-normal">
                              {item.formatError}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-right font-mono font-semibold">
                          {formatThousands(item.invoice_net_amount, { decimals: 2 })}{' '}
                          {item.currency}
                          <span className="block text-[10px] text-muted-foreground font-normal">
                            ({fmtEft(item.amountEft)})
                          </span>
                        </TableCell>
                        <TableCell className="text-center">
                          {isOut ? (
                            <div className="inline-flex bg-muted/60 border border-border/80 rounded-md p-0.5">
                              <button
                                type="button"
                                onClick={() => {
                                  setEuTypeOverrides((prev) => ({
                                    ...prev,
                                    [item.id]: 'goods_out',
                                  }));
                                }}
                                className={cn(
                                  'px-2 py-0.5 text-[10px] font-bold rounded transition-all',
                                  item.category === 'goods_out'
                                    ? 'bg-background shadow-sm text-foreground font-semibold'
                                    : 'text-muted-foreground hover:text-foreground'
                                )}
                              >
                                Termék (02)
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setEuTypeOverrides((prev) => ({
                                    ...prev,
                                    [item.id]: 'services_out',
                                  }));
                                }}
                                className={cn(
                                  'px-2 py-0.5 text-[10px] font-bold rounded transition-all',
                                  item.category === 'services_out'
                                    ? 'bg-background shadow-sm text-foreground font-semibold'
                                    : 'text-muted-foreground hover:text-foreground'
                                )}
                              >
                                Szolg. (91-92)
                              </button>
                            </div>
                          ) : (
                            <div className="inline-flex bg-muted/60 border border-border/80 rounded-md p-0.5">
                              <button
                                type="button"
                                onClick={() => {
                                  setEuTypeOverrides((prev) => ({
                                    ...prev,
                                    [item.id]: 'goods_in',
                                  }));
                                }}
                                className={cn(
                                  'px-2 py-0.5 text-[10px] font-bold rounded transition-all',
                                  item.category === 'goods_in'
                                    ? 'bg-background shadow-sm text-foreground font-semibold'
                                    : 'text-muted-foreground hover:text-foreground'
                                )}
                              >
                                Termék (11-16)
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setEuTypeOverrides((prev) => ({
                                    ...prev,
                                    [item.id]: 'services_in',
                                  }));
                                }}
                                className={cn(
                                  'px-2 py-0.5 text-[10px] font-bold rounded transition-all',
                                  item.category === 'services_in'
                                    ? 'bg-background shadow-sm text-foreground font-semibold'
                                    : 'text-muted-foreground hover:text-foreground'
                                )}
                              >
                                Szolg. (18)
                              </button>
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge variant="outline" className="font-mono text-[10px]">
                            {targetRow}. sor
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </ScrollArea>
        </div>
      </CardContent>

      {/* Internal A60 XML Export Modal if triggered locally */}
      {isExportModalOpen && selectedCompany && year && month && frequency && (
        <VatXmlExportModal
          open={isExportModalOpen}
          onOpenChange={setIsExportModalOpen}
          selectedCompany={selectedCompany}
          year={year}
          month={month}
          frequency={frequency}
          formKind="A60"
          a60Lines={a60Lines || []}
        />
      )}

      {/* Közösségi adószám szerkesztő Dialog */}
      <Dialog open={!!editingItem} onOpenChange={(open) => !open && closeEditModal()}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Pencil className="w-4 h-4 text-primary" />
              Közösségi Adószám Javítása
            </DialogTitle>
            <DialogDescription className="text-xs">
              Módosítsd a számlán szereplő közösségi (EU) adószámot. Mentés után a rendszer azonnal leellenőrzi az EU VIES adatbázisában.
            </DialogDescription>
          </DialogHeader>

          {editingItem && (
            <div className="space-y-4 py-2 text-xs">
              {/* Számla és Partner kontextus doboz */}
              <div className="p-3 bg-muted/40 border border-border/80 rounded-lg space-y-1.5">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Partner neve:</span>
                  <span className="font-semibold text-foreground">{editingItem.partner_name}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Számlaszám:</span>
                  <span className="font-mono font-medium">{editingItem.invoice_number}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Irány / Összeg:</span>
                  <span className="font-medium">
                    {editingItem.invoice_direction === 'OUTBOUND' ? 'Kimenő' : 'Bejövő'} •{' '}
                    {formatThousands(editingItem.invoice_net_amount, { decimals: 2 })} {editingItem.currency}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Jelenlegi adószám:</span>
                  <span className="font-mono font-semibold text-muted-foreground">
                    {editingItem.partner_tax_number || 'Nincs rögzítve'}
                  </span>
                </div>
              </div>

              {/* Új adószám beviteli mező */}
              <div className="space-y-1.5">
                <Label htmlFor="eu-tax-input" className="text-xs font-semibold">
                  Új Közösségi Adószám:
                </Label>
                <Input
                  id="eu-tax-input"
                  value={editTaxInput}
                  onChange={(e) => setEditTaxInput(e.target.value.toUpperCase())}
                  placeholder="pl. SK2020123456, DE123456789, ATU12345678..."
                  className="font-mono uppercase text-sm tracking-wider"
                  autoFocus
                />
              </div>

              {/* Valós idejű formátum ellenőrző doboz */}
              {editValidation && (
                <div
                  className={cn(
                    'p-2.5 rounded-lg border text-xs space-y-1 transition-all',
                    editValidation.isValid
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-400'
                      : 'bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-400'
                  )}
                >
                  <div className="flex items-center gap-1.5 font-semibold">
                    {editValidation.isValid ? (
                      <>
                        <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                        <span>Formátum szintaktikailag helyes ({editValidation.countryCode})</span>
                      </>
                    ) : (
                      <>
                        <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
                        <span>Formátum még nem érvényes</span>
                      </>
                    )}
                  </div>
                  {editValidation.errorMessage && (
                    <p className="text-[11px] opacity-90 pl-5">{editValidation.errorMessage}</p>
                  )}
                  {editValidation.countryCode && EU_VAT_RULES[editValidation.countryCode] && (
                    <p className="text-[11px] opacity-80 pl-5">
                      Ország: {EU_VAT_RULES[editValidation.countryCode].countryName} • Elvárt minta:{' '}
                      {EU_VAT_RULES[editValidation.countryCode].example}
                    </p>
                  )}
                </div>
              )}

              {/* Partner törzsadat szinkronizálási checkbox */}
              <div className="flex items-center space-x-2 pt-1">
                <Checkbox
                  id="update-partner-master"
                  checked={updatePartnerMaster}
                  onCheckedChange={(checked) => setUpdatePartnerMaster(!!checked)}
                />
                <Label
                  htmlFor="update-partner-master"
                  className="text-xs text-muted-foreground font-normal cursor-pointer leading-tight"
                >
                  A partner ({editingItem.partner_name}) törzsadatát is frissítse ezzel a közösségi adószámmal
                </Label>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              size="sm"
              onClick={closeEditModal}
              disabled={isSavingTaxLocal || isUpdatingTaxNumber}
            >
              Mégse
            </Button>
            <Button
              size="sm"
              onClick={handleSaveTaxNumber}
              disabled={!editValidation?.isValid || isSavingTaxLocal || isUpdatingTaxNumber}
              className="gap-1.5 bg-primary hover:bg-primary/90"
            >
              {isSavingTaxLocal || isUpdatingTaxNumber ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Mentés és ellenőrzés...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Mentés és VIES ellenőrzés
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

