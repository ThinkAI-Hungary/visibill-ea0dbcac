import React from 'react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from '@/components/ui/tooltip';
import {
  Loader2,
  FileSpreadsheet,
  Save,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  CheckCircle2,
  Pencil,
  Shield,
  Search,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { VatTrendChart } from '@/components/vat/VatTrendChart';
import { ReturnHistoryTable } from '@/components/vat/ReturnHistoryTable';
import { VatRowDrillDown, InvoiceItemsDrillDown } from '@/components/vat/VatRowDrillDown';
import { VatA60Table } from './VatA60Table';
import { VatXmlValidationDialog } from './VatXmlValidationDialog';
import { fmtEft } from '../types';
import type { useVatReturnData } from '../hooks/useVatReturnData';

type VatDataReturn = ReturnType<typeof useVatReturnData>;

interface VatCalculatorViewProps {
  vatData: VatDataReturn;
}

export function VatCalculatorView({ vatData }: VatCalculatorViewProps) {
  const {
    selectedCompany,
    year,
    setYear,
    month,
    setMonth,
    frequency,
    setFrequency,
    vatReturn,
    isFinalized,
    lines,
    mLines,
    filteredMLines,
    formRows,
    prevLines,
    lineMap,
    prevLineMap,
    getVal,
    getPrevVal,
    unpaidVatEft,
    euInvoices,
    a60Calculations,
    partnerValidations,
    reverseChargeSuspiciousInvoices,
    validateReturn,
    finalizeReturn,
    reopenReturn,
    saveCarryforward,
    carryforwardValue,
    setCarryforwardValue,
    handleDetailEdit,
    editDrafts,
    isSavingLine,
    viesStatuses,
    isValidatingVies,
    handleViesCheck,
    xmlValidationResults,
    isValidatingXml,
    runXmlValidationLocal,
    setEuTypeOverrides,
    openSections,
    toggleSection,
    showAllRows,
    setShowAllRows,
    partnerSearch,
    setPartnerSearch,
    expandedPartners,
    togglePartner,
    expandedInvoice,
    setExpandedInvoice,
    expandedFormRow,
    setExpandedFormRow,
  } = vatData;

  const hasPrevData = prevLines.length > 0;

  const DeltaBadge = ({ current, prev }: { current: number; prev: number }) => {
    if (!hasPrevData || prev === 0) return null;
    const delta = current - prev;
    const pct = Math.round((delta / Math.abs(prev)) * 100);
    if (delta === 0) return null;
    return (
      <span
        className={cn(
          'text-[10px] ml-1.5 tabular-nums',
          delta > 0 ? 'text-red-400' : 'text-emerald-500'
        )}
      >
        {delta > 0 ? '↑' : '↓'}
        {Math.abs(pct)}%
      </span>
    );
  };

  const sections = [
    { key: 'payable', title: 'Fizetendő általános forgalmi adó (01–36)', page: 'A-01', icon: '📤' },
    { key: 'detail', title: 'Részletező sorok (37–62)', page: 'A-02', icon: '📋' },
    { key: 'deductible', title: 'Levonható ÁFA (63–79)', page: 'A-02/03', icon: '📥' },
    { key: 'settlement', title: 'Elszámolás (82–86)', page: 'A-03', icon: '⚖️' },
    { key: 'm_sheet', title: 'M-lap összesítő (105–109)', page: 'A-05', icon: '📊' },
  ];

  return (
    <>
      {/* Közösségi (A60) Keresztellenőrzés */}
      {vatReturn && euInvoices.length > 0 && (
        <VatA60Table
          a60Calculations={a60Calculations}
          viesStatuses={viesStatuses}
          isValidatingVies={isValidatingVies}
          handleViesCheck={handleViesCheck}
          setEuTypeOverrides={setEuTypeOverrides}
        />
      )}

      {/* Status Bar */}
      {vatReturn && (
        <div className="flex items-center gap-3 bg-card px-4 py-2.5 rounded-xl border border-border shadow-sm animate-in fade-in slide-in-from-top-1 duration-200">
          <span className="text-xs text-muted-foreground">Státusz:</span>
          <Badge
            className={cn('text-xs', {
              'bg-amber-500/10 text-amber-600 border-amber-500/20':
                (vatReturn as any).status === 'draft',
              'bg-blue-500/10 text-blue-600 border-blue-500/20':
                (vatReturn as any).status === 'validated',
              'bg-emerald-500/10 text-emerald-600 border-emerald-500/20':
                (vatReturn as any).status === 'finalized',
            })}
          >
            {(vatReturn as any).status === 'draft'
              ? 'Piszkozat'
              : (vatReturn as any).status === 'validated'
              ? 'Ellenőrzött'
              : 'Véglegesítve'}
          </Badge>
          <div className="ml-auto flex gap-2">
            {(vatReturn as any).status === 'draft' && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => validateReturn.mutate()}
                disabled={validateReturn.isPending}
              >
                {validateReturn.isPending ? (
                  <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                ) : (
                  <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
                )}
                Ellenőrzés kész
              </Button>
            )}
            {(vatReturn as any).status === 'validated' && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button size="sm" disabled={finalizeReturn.isPending}>
                    {finalizeReturn.isPending ? (
                      <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                    ) : (
                      <Shield className="w-3.5 h-3.5 mr-1.5" />
                    )}
                    Véglegesítés
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Bevallás véglegesítése</AlertDialogTitle>
                    <AlertDialogDescription>
                      A véglegesítés után a bevallás sorai nem módosíthatók. Visszanyitás csak a
                      „Visszanyitás" gombbal lehetséges.
                      <br />
                      <br />
                      Biztosan véglegesíted a <strong>{year}/{String(month).padStart(2, '0')}</strong>{' '}
                      időszak bevallását?
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Mégse</AlertDialogCancel>
                    <AlertDialogAction onClick={() => finalizeReturn.mutate()}>
                      Véglegesítés
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
            {(vatReturn as any).status === 'finalized' && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => reopenReturn.mutate()}
                disabled={reopenReturn.isPending}
              >
                {reopenReturn.isPending && (
                  <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                )}
                Visszanyitás
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Pénzforgalmi ÁFA banner */}
      {selectedCompany?.vat_regime === 'penzforgalmi' && (
        <div className="flex items-center gap-2.5 bg-violet-500/10 text-violet-600 dark:text-violet-400 border border-violet-500/20 px-4 py-2.5 rounded-xl animate-in fade-in slide-in-from-top-1 duration-200">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span className="text-sm font-medium">
            Ez a cég pénzforgalmi ÁFA elszámolást alkalmaz (Áfa tv. XIII/A. fejezet) — az ÁFA fizetési
            kötelezettség és levonási jog csak a tényleges kifizetéskor keletkezik.
          </span>
        </div>
      )}

      {/* Alanyi adómentes banner */}
      {selectedCompany?.vat_regime === 'alanyi_mentes' && (
        <div className="flex items-center gap-2.5 bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 px-4 py-2.5 rounded-xl animate-in fade-in slide-in-from-top-1 duration-200">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span className="text-sm font-medium">
            Ez a cég alanyi adómentességet alkalmaz (Áfa tv. XIII. fejezet) — ÁFA felszámítási és
            bevallási kötelezettség nem áll fenn.
          </span>
        </div>
      )}

      {/* Reverse-Charge Auditing Warnings */}
      {reverseChargeSuspiciousInvoices.length > 0 && (
        <Card className="border-amber-500/30 bg-amber-500/5 print:hidden rounded-xl">
          <CardContent className="p-4 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
            <div className="space-y-1 w-full">
              <h4 className="text-sm font-semibold text-amber-800 dark:text-amber-400">
                Fordított adózás (Reverse Charge) ellenőrzés ({reverseChargeSuspiciousInvoices.length})
              </h4>
              <p className="text-xs text-muted-foreground leading-normal">
                Az alábbi partnereknél felszámított ÁFA szerepel, de a cég/partner neve vagy tevékenysége
                alapján építőipari/fémkereskedelmi tevékenység gyanúja merül fel. Ellenőrizd, hogy nem
                fordított adózást (Áfa tv. 142. §) kellene-e alkalmazni:
              </p>
              <div className="pt-2 space-y-1.5 max-h-32 overflow-y-auto w-full">
                {reverseChargeSuspiciousInvoices.map((inv, idx) => (
                  <div
                    key={idx}
                    className="text-xs flex justify-between items-center border-b pb-1 last:border-0 border-amber-500/10 w-full"
                  >
                    <span className="font-semibold text-foreground/80">
                      {inv.partnerName} ({inv.invoiceNumber})
                    </span>
                    <span className="text-muted-foreground font-mono">
                      Nettó: {Math.round(inv.net / 1000).toLocaleString('hu-HU')} eFt — ÁFA:{' '}
                      {Math.round(inv.vat / 1000).toLocaleString('hu-HU')} eFt
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* KPI Cards */}
      <div className="relative">
        <div
          className={cn(
            'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 transition-opacity duration-200',
            isSavingLine && 'opacity-60 pointer-events-none'
          )}
          style={{ animationDelay: '100ms' }}
        >
          {[
            {
              label: 'Fizetendő ÁFA (36.)',
              value: getVal('36', 'tax'),
              prev: getPrevVal('36', 'tax'),
              color: 'text-red-500',
              bg: 'bg-red-500/10',
              borderColor: 'border-red-500/20',
              unpaidHint:
                unpaidVatEft > 0 ? `ebből kintlévőség: ${fmtEft(unpaidVatEft)}` : null,
            },
            {
              label: 'Levonható ÁFA (76.)',
              value: getVal('76', 'tax'),
              prev: getPrevVal('76', 'tax'),
              color: 'text-emerald-600',
              bg: 'bg-emerald-500/10',
              borderColor: 'border-emerald-500/20',
              unpaidHint: null,
            },
            {
              label: 'Egyenleg (83.)',
              value: getVal('83', 'tax'),
              prev: getPrevVal('83', 'tax'),
              color: getVal('83', 'tax') > 0 ? 'text-red-500' : 'text-emerald-600',
              bg: getVal('83', 'tax') > 0 ? 'bg-red-500/10' : 'bg-emerald-500/10',
              borderColor: getVal('83', 'tax') > 0 ? 'border-red-500/20' : 'border-emerald-500/20',
              unpaidHint:
                unpaidVatEft > 0
                  ? `kintlévőség nélkül: ${fmtEft(getVal('83', 'tax') - unpaidVatEft)}`
                  : null,
            },
            {
              label: getVal('84', 'tax') ? 'Befizetendő (84.)' : 'Visszaigénylés (85.)',
              value: getVal('84', 'tax') || getVal('85', 'tax'),
              prev: getPrevVal('84', 'tax') || getPrevVal('85', 'tax'),
              color: getVal('84', 'tax') ? 'text-red-500' : 'text-emerald-600',
              bg: getVal('84', 'tax') ? 'bg-red-500/10' : 'bg-emerald-500/10',
              borderColor: getVal('84', 'tax') ? 'border-red-500/20' : 'border-emerald-500/20',
              unpaidHint: null,
            },
          ].map((kpi, idx) => (
            <Card
              key={kpi.label}
              className={cn(
                'border transition-all hover:shadow-md animate-in fade-in slide-in-from-bottom-2 duration-300 fill-mode-both',
                kpi.borderColor
              )}
              style={{ animationDelay: `${idx * 75 + 50}ms` }}
            >
              <CardContent className="p-4 flex items-center gap-3">
                <div className={cn('p-2.5 rounded-xl', kpi.bg)}>
                  <FileSpreadsheet className={cn('w-5 h-5', kpi.color)} />
                </div>
                <div className="min-w-0">
                  <div className={cn('text-2xl font-bold tabular-nums leading-tight', kpi.color)}>
                    {vatReturn ? fmtEft(kpi.value) : '—'}
                    <DeltaBadge current={kpi.value} prev={kpi.prev} />
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-0.5 truncate">{kpi.label}</div>
                  {vatReturn && kpi.unpaidHint && (
                    <div className="text-[10px] text-amber-500 dark:text-amber-400 mt-0.5 font-medium flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3 shrink-0" />
                      <span>{kpi.unpaidHint}</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
        {isSavingLine && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/10 backdrop-blur-[1px] rounded-xl z-20">
            <div className="flex items-center gap-2 bg-card border px-4 py-2 rounded-lg shadow-md animate-in zoom-in-95 duration-150">
              <Loader2 className="w-4 h-4 animate-spin text-primary" />
              <span className="text-xs font-semibold text-foreground/80">Kalkuláció mentése...</span>
            </div>
          </div>
        )}
      </div>

      {/* ÁFA Trend Chart */}
      {vatReturn && selectedCompany?.id && <VatTrendChart companyId={selectedCompany.id} />}

      {/* Carryforward + Validations + NAV XML Validator */}
      {vatReturn && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Manual Carryforward (82. sor) */}
          <Card className="border-border/60">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="text-sm font-medium">Előző időszak áthozat (82. sor)</div>
                <Badge variant="outline" className="text-[10px]">
                  manuálisan szerkeszthető
                </Badge>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <div className="text-xs text-muted-foreground mb-1">
                    Automatikus (előző hó 86. sor): {fmtEft(prevLineMap['86']?.tax_amount_rounded ?? 0)}
                    {prevLineMap['86']?.tax_amount_rounded != null &&
                      prevLineMap['86']?.tax_amount_rounded !== Number(carryforwardValue || 0) && (
                        <Button
                          variant="link"
                          size="sm"
                          className="h-auto p-0 ml-2 text-[10px] text-primary"
                          onClick={() => {
                            const prevVal = prevLineMap['86']?.tax_amount_rounded ?? 0;
                            setCarryforwardValue(String(prevVal));
                          }}
                        >
                          ← Betöltés
                        </Button>
                      )}
                  </div>
                  <div className="flex gap-2 items-center">
                    <Input
                      type="number"
                      className="w-40 h-8 text-sm tabular-nums"
                      placeholder="eFt"
                      value={carryforwardValue}
                      onChange={(e) => setCarryforwardValue(e.target.value)}
                      disabled={isFinalized}
                    />
                    <span className="text-xs text-muted-foreground">eFt</span>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8"
                      disabled={saveCarryforward.isPending || isFinalized}
                      onClick={() => saveCarryforward.mutate(Number(carryforwardValue) || 0)}
                    >
                      {saveCarryforward.isPending ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Save className="w-3.5 h-3.5" />
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Validation Warnings */}
          <Card className="border-border/60">
            <CardContent className="p-4">
              <div className="text-sm font-medium mb-2">Ellenőrzési pontok</div>
              <div className="space-y-1.5">
                {(() => {
                  const warnings: { msg: string; type: 'ok' | 'warn' | 'error' }[] = [];
                  const payTax = getVal('36', 'tax');
                  const dedTax = getVal('76', 'tax');

                  if (payTax === 0 && dedTax === 0) {
                    warnings.push({
                      msg: 'Nincs fizetendő és levonható ÁFA az időszakban',
                      type: 'warn',
                    });
                  } else {
                    warnings.push({
                      msg: `Fizetendő: ${fmtEft(payTax)}, Levonható: ${fmtEft(dedTax)}`,
                      type: 'ok',
                    });
                  }

                  const mTotal = getVal('105', 'tax');
                  if (dedTax > 0 && mTotal === 0) {
                    warnings.push({
                      msg: 'M-lap üres, de van levonható ÁFA — ellenőrizd a partner adószámokat',
                      type: 'warn',
                    });
                  } else if (mTotal > 0) {
                    warnings.push({
                      msg: `M-lap összesítő: ${fmtEft(mTotal)} (${mLines.length} partner)`,
                      type: 'ok',
                    });
                  }

                  const carry = getVal('86', 'tax');
                  if (carry > 0) {
                    warnings.push({ msg: `Következő hónapra átvihető: ${fmtEft(carry)}`, type: 'ok' });
                  }

                  return warnings.map((w, i) => (
                    <div
                      key={i}
                      className={cn(
                        'flex items-center gap-2 text-xs',
                        w.type === 'ok'
                          ? 'text-emerald-600'
                          : w.type === 'warn'
                          ? 'text-amber-600'
                          : 'text-red-500'
                      )}
                    >
                      {w.type === 'ok' ? (
                        <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                      ) : (
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                      )}
                      {w.msg}
                    </div>
                  ));
                })()}
              </div>
            </CardContent>
          </Card>

          {/* NAV XML Validator */}
          <VatXmlValidationDialog
            selectedCompany={selectedCompany}
            year={year}
            month={month}
            frequency={frequency}
            lines={lines}
            mLines={mLines}
            xmlValidationResults={xmlValidationResults}
            isValidatingXml={isValidatingXml}
            runXmlValidationLocal={runXmlValidationLocal}
          />
        </div>
      )}

      {/* A-Lap Table */}
      {!vatReturn ? (
        <Card className="border-border/60">
          <CardContent className="p-8 text-center text-muted-foreground">
            <FileSpreadsheet className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="text-sm">Nyomd meg a „Számítás" gombot a bevallás generálásához</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="flex items-center justify-end gap-2">
            <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
              <Switch checked={showAllRows} onCheckedChange={setShowAllRows} className="scale-75" />
              Minden sor megjelenítése
            </label>
          </div>

          {sections.map((sec) => {
            const sectionRows = formRows.filter((r) => r.section === sec.key);
            const rowsWithData = sectionRows.filter((r) => lineMap[r.row_number]);
            const hasData = rowsWithData.length > 0;
            const isOpen = openSections.has(sec.key);
            const displayRows =
              sec.key === 'detail' || showAllRows
                ? sectionRows
                : sectionRows.filter((r) => lineMap[r.row_number] || r.is_summary);
            const isEditable = sec.key === 'detail' && !isFinalized;
            const summaryRow = sectionRows.find((r) => r.is_summary);
            const summaryTax = summaryRow ? getVal(summaryRow.row_number, 'tax') : 0;

            return (
              <Card
                key={sec.key}
                className={cn(
                  'overflow-hidden transition-all hover:shadow-sm',
                  hasData
                    ? 'border-l-2 border-l-primary/40 border-border/60'
                    : 'border-border/40'
                )}
              >
                <button
                  className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/40 transition-colors text-left"
                  onClick={() => toggleSection(sec.key)}
                >
                  <div className="flex items-center gap-2.5">
                    <div className={cn('transition-transform duration-200', isOpen && 'rotate-90')}>
                      <ChevronRight className="w-4 h-4 text-muted-foreground" />
                    </div>
                    <span className="text-base">{sec.icon}</span>
                    <span className="font-medium text-sm">{sec.title}</span>
                    <Badge variant="outline" className="text-[10px] font-normal">
                      {sec.page}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    {hasData && summaryTax !== 0 && (
                      <span className="text-sm font-semibold tabular-nums text-primary">
                        {fmtEft(summaryTax)}
                      </span>
                    )}
                    {hasData && (
                      <Badge variant="secondary" className="text-[10px]">
                        {rowsWithData.length} sor
                      </Badge>
                    )}
                  </div>
                </button>
                {isOpen && displayRows.length > 0 && (
                  <div className="divide-y divide-border/30 animate-in fade-in slide-in-from-top-1 duration-200">
                    {isEditable && (
                      <div className="flex items-center gap-2 px-4 py-1.5 bg-primary/5 text-primary text-xs border-b border-primary/10">
                        <Pencil className="w-3 h-3" />
                        <span>
                          Szerkeszthető — kattints a mezőkre az értékek kitöltéséhez (eFt-ban)
                        </span>
                      </div>
                    )}
                    <div className="grid grid-cols-12 gap-2 px-4 py-2 text-xs font-medium text-muted-foreground bg-muted/20">
                      <div className="col-span-1">Sor</div>
                      <div className={hasPrevData ? 'col-span-3' : 'col-span-7'}>Megnevezés</div>
                      <div className="col-span-2 text-right">
                        {isEditable ? 'Adóalap (eFt)' : 'Adóalap'}
                      </div>
                      <div className="col-span-2 text-right">
                        {isEditable ? 'Adó (eFt)' : 'Adó'}
                      </div>
                      {hasPrevData && <div className="col-span-2 text-right">Előző hó</div>}
                      {hasPrevData && <div className="col-span-2 text-right">Δ</div>}
                    </div>
                    {displayRows.map((row) => {
                      const line = lineMap[row.row_number];
                      const prevLine = prevLineMap[row.row_number];
                      const isSummary = row.is_summary;
                      const curTax = line?.tax_amount_rounded ?? 0;
                      const prevTax = prevLine?.tax_amount_rounded ?? 0;
                      const delta = curTax - prevTax;
                      const hasDrillData =
                        !!line &&
                        !isSummary &&
                        !line.is_calculated &&
                        line.source_vat_codes &&
                        line.source_vat_codes.length > 0;
                      const isDrillExpanded = expandedFormRow === row.row_number;

                      return (
                        <React.Fragment key={row.row_number}>
                          <div
                            className={cn(
                              'grid grid-cols-12 gap-2 px-4 py-1.5 text-sm items-center',
                              isSummary
                                ? 'bg-primary/5 font-semibold border-t-2 border-primary/20'
                                : 'hover:bg-muted/20',
                              !line && !isEditable && 'opacity-40',
                              hasDrillData && 'cursor-pointer',
                              isDrillExpanded && 'bg-primary/5 border-l-2 border-l-primary'
                            )}
                            onClick={() => {
                              if (hasDrillData)
                                setExpandedFormRow(isDrillExpanded ? null : row.row_number);
                            }}
                          >
                            <div className="col-span-1 font-mono text-xs text-muted-foreground flex items-center gap-1">
                              {hasDrillData &&
                                (isDrillExpanded ? (
                                  <ChevronDown className="w-3 h-3 text-primary" />
                                ) : (
                                  <ChevronRight className="w-3 h-3 text-muted-foreground/50" />
                                ))}
                              {row.row_number}.
                            </div>
                            <div
                              className={cn(
                                'text-xs leading-snug truncate flex items-center gap-1.5',
                                hasPrevData ? 'col-span-3' : 'col-span-7'
                              )}
                              title={row.label}
                            >
                              {row.label}
                              {isEditable && line && !isSummary && (
                                line.is_calculated ? (
                                  <span className="shrink-0 inline-flex items-center px-1 py-0.5 rounded text-[9px] font-medium bg-muted/50 text-muted-foreground/60">
                                    ⚡ auto
                                  </span>
                                ) : (
                                  <span className="shrink-0 inline-flex items-center px-1 py-0.5 rounded text-[9px] font-medium bg-amber-500/10 text-amber-600">
                                    ✏️ kézi
                                  </span>
                                )
                              )}
                            </div>
                            <div className="col-span-2 text-right tabular-nums text-xs">
                              {isEditable && row.has_base && !isSummary ? (
                                <input
                                  type="number"
                                  className="w-full text-right bg-muted/40 border border-border/80 rounded px-2 py-1 text-xs tabular-nums focus:bg-muted/60 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/30 transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                  placeholder="0"
                                  value={
                                    editDrafts[row.row_number]?.base ??
                                    (line?.base_amount_rounded || '')
                                  }
                                  onChange={(e) =>
                                    handleDetailEdit(row.row_number, 'base', e.target.value)
                                  }
                                  onClick={(e) => e.stopPropagation()}
                                />
                              ) : row.has_base && line ? (
                                fmtEft(line.base_amount_rounded)
                              ) : (
                                ''
                              )}
                            </div>
                            <div className="col-span-2 text-right tabular-nums text-xs font-medium">
                              {isEditable && row.has_tax && !isSummary ? (
                                <input
                                  type="number"
                                  className="w-full text-right bg-muted/40 border border-border/80 rounded px-2 py-1 text-xs tabular-nums font-medium focus:bg-muted/60 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/30 transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                  placeholder="0"
                                  value={
                                    editDrafts[row.row_number]?.tax ??
                                    (line?.tax_amount_rounded || '')
                                  }
                                  onChange={(e) =>
                                    handleDetailEdit(row.row_number, 'tax', e.target.value)
                                  }
                                  onClick={(e) => e.stopPropagation()}
                                />
                              ) : row.has_tax && line ? (
                                fmtEft(line.tax_amount_rounded)
                              ) : (
                                ''
                              )}
                            </div>
                            {hasPrevData && (
                              <div className="col-span-2 text-right tabular-nums text-muted-foreground text-xs">
                                {row.has_tax && prevLine ? fmtEft(prevTax) : ''}
                              </div>
                            )}
                            {hasPrevData && (
                              <div
                                className={cn(
                                  'col-span-2 text-right tabular-nums text-xs font-medium',
                                  delta > 0
                                    ? 'text-red-400'
                                    : delta < 0
                                    ? 'text-emerald-500'
                                    : 'text-muted-foreground'
                                )}
                              >
                                {line && prevLine && delta !== 0
                                  ? `${delta > 0 ? '+' : ''}${delta.toLocaleString('hu-HU')}`
                                  : ''}
                              </div>
                            )}
                          </div>
                          {isDrillExpanded && selectedCompany?.id && (
                            <VatRowDrillDown
                              sourceVatCodes={line!.source_vat_codes!}
                              companyId={selectedCompany.id}
                              year={year}
                              month={month}
                              frequency={frequency}
                            />
                          )}
                        </React.Fragment>
                      );
                    })}
                  </div>
                )}
              </Card>
            );
          })}

          {/* M-Lap Partner Table */}
          <Card className="border-border/60">
            <CardHeader className="pb-3 border-b border-border/40 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <CardTitle className="text-base flex items-center gap-2">
                M-Lap - Belföldi összesítő
                <Badge variant="secondary" className="text-xs">
                  {filteredMLines.length === mLines.length
                    ? `${mLines.length} partner`
                    : `${filteredMLines.length} / ${mLines.length} találat`}
                </Badge>
              </CardTitle>
              {mLines.length > 0 && (
                <div className="relative w-full sm:w-64 print:hidden">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    placeholder="Partner keresése adószám/név..."
                    value={partnerSearch}
                    onChange={(e) => setPartnerSearch(e.target.value)}
                    className="pl-8 h-8 text-xs bg-muted/30 focus:bg-background transition-colors"
                  />
                  {partnerSearch && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6 text-muted-foreground hover:text-foreground"
                      onClick={() => setPartnerSearch('')}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              )}
            </CardHeader>
            <CardContent className="p-0">
              {partnerValidations.hasConflicts && (
                <div className="bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400 p-3 rounded-lg flex items-start gap-2 text-xs mx-4 my-3">
                  <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                  <span>
                    <strong>ÁFA Konfliktus Figyelmeztetés:</strong> A partnerek között olyan
                    vállalkozás szerepel adóalap/adó összeggel, amely az adószáma alapján alanyi
                    adómentes (ÁFA-kód: 1). Ellenőrizd a számlák helyességét!
                  </span>
                </div>
              )}
              {partnerValidations.hasErrors && (
                <div className="bg-red-500/10 border border-red-500/20 text-red-700 dark:text-red-400 p-3 rounded-lg flex items-start gap-2 text-xs mx-4 my-3">
                  <AlertTriangle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                  <span>
                    <strong>Adószám Validációs Hiba:</strong> Érvénytelen formátumú vagy CDV-hibás
                    adószámok találhatók az M-lapon! Kérjük, javítsd a partner törzsadatait.
                  </span>
                </div>
              )}

              {filteredMLines.length === 0 ? (
                <p className="text-sm text-muted-foreground p-4">
                  {mLines.length === 0
                    ? 'Nincs belföldi levonható számla az időszakban'
                    : 'Nincs találat a keresési feltételekre'}
                </p>
              ) : (
                <div className="divide-y divide-border/30">
                  <div className="grid grid-cols-12 gap-2 px-4 py-2 text-xs font-medium text-muted-foreground bg-muted/20">
                    <div className="col-span-3">Partner</div>
                    <div className="col-span-2">Adószám</div>
                    <div className="col-span-1 text-center">Számlák</div>
                    <div className="col-span-2 text-right">Adóalap (eFt)</div>
                    <div className="col-span-2 text-right">Adó (eFt)</div>
                    <div className="col-span-2 text-right">27% / 18% / 5%</div>
                  </div>
                  {filteredMLines.map((ml) => (
                    <React.Fragment key={ml.id}>
                      <div
                        className="grid grid-cols-12 gap-2 px-4 py-2.5 text-sm items-center hover:bg-muted/20 cursor-pointer transition-colors"
                        onClick={() => togglePartner(ml.id)}
                      >
                        <div className="col-span-3 flex items-center gap-1.5 truncate">
                          {expandedPartners.has(ml.id) ? (
                            <ChevronDown className="w-3 h-3 shrink-0" />
                          ) : (
                            <ChevronRight className="w-3 h-3 shrink-0" />
                          )}
                          <span className="truncate">{ml.partner_name}</span>
                        </div>
                        <div className="col-span-2 font-mono text-xs flex items-center gap-1.5">
                          <span>{ml.partner_tax_number}</span>
                          {(() => {
                            const val = partnerValidations.validations[ml.id];
                            if (!val) return null;
                            if (val.status === 'exempt' && ml.tax_amount_rounded > 0) {
                              return (
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Badge
                                        variant="outline"
                                        className="bg-amber-500/10 text-amber-600 border-amber-500/30 px-1 py-0 text-[9px] cursor-help shrink-0"
                                      >
                                        mentes ⚠️
                                      </Badge>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      {val.reason} (ÁFA konfliktus!)
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              );
                            }
                            if (!val.isValid) {
                              return (
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Badge
                                        variant="outline"
                                        className="bg-red-500/10 text-red-600 border-red-500/30 px-1 py-0 text-[9px] cursor-help shrink-0"
                                      >
                                        hibás
                                      </Badge>
                                    </TooltipTrigger>
                                    <TooltipContent>{val.reason}</TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              );
                            }
                            if (val.isForeign) {
                              return (
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Badge
                                        variant="outline"
                                        className="bg-blue-500/10 text-blue-600 border-blue-500/30 px-1 py-0 text-[9px] cursor-help shrink-0"
                                      >
                                        külföldi
                                      </Badge>
                                    </TooltipTrigger>
                                    <TooltipContent>{val.reason}</TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              );
                            }
                            return (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Badge
                                      variant="outline"
                                      className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30 px-1 py-0 text-[9px] cursor-help shrink-0"
                                    >
                                      aktív
                                    </Badge>
                                  </TooltipTrigger>
                                  <TooltipContent>{val.reason}</TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            );
                          })()}
                        </div>
                        <div className="col-span-1 text-center">{ml.invoice_count}</div>
                        <div className="col-span-2 text-right tabular-nums">
                          {fmtEft(ml.base_amount_rounded)}
                        </div>
                        <div className="col-span-2 text-right tabular-nums">
                          {fmtEft(ml.tax_amount_rounded)}
                        </div>
                        <div className="col-span-2 text-right text-xs tabular-nums text-muted-foreground">
                          {Math.round(ml.tax_27_amount / 1000)} /{' '}
                          {Math.round(ml.tax_18_amount / 1000)} /{' '}
                          {Math.round(ml.tax_5_amount / 1000)}
                        </div>
                      </div>
                      {expandedPartners.has(ml.id) && ml.invoice_details?.length > 0 && (
                        <div className="bg-muted/30 px-6 py-2 border-t border-border/20">
                          <div className="text-xs font-medium text-muted-foreground mb-1.5">
                            Számlák:
                          </div>
                          <div className="grid grid-cols-12 gap-2 text-[10px] font-semibold text-muted-foreground/70 uppercase tracking-wider pb-1 mb-1 border-b border-border/20 pl-4">
                            <div className="col-span-3">Számlaszám</div>
                            <div className="col-span-2">Teljesítés</div>
                            <div className="col-span-2 text-right">Nettó (eFt)</div>
                            <div className="col-span-2 text-right">ÁFA (eFt)</div>
                            <div className="col-span-3 text-right">ÁFA kulcs</div>
                          </div>
                          {(ml.invoice_details as any[]).map((inv: any, i: number) => {
                            const invKey = `${ml.id}_${inv.invoice_number}_${i}`;
                            const isInvExpanded = expandedInvoice === invKey;
                            return (
                              <React.Fragment key={i}>
                                <div
                                  className="grid grid-cols-12 gap-2 text-xs py-1.5 pl-4 transition-colors cursor-pointer hover:bg-muted/40 text-muted-foreground hover:text-foreground"
                                  onClick={() =>
                                    setExpandedInvoice(isInvExpanded ? null : invKey)
                                  }
                                >
                                  <div className="col-span-3 font-mono flex items-center gap-1">
                                    {isInvExpanded ? (
                                      <ChevronDown className="w-2.5 h-2.5 shrink-0" />
                                    ) : (
                                      <ChevronRight className="w-2.5 h-2.5 shrink-0" />
                                    )}
                                    {inv.invoice_number}
                                  </div>
                                  <div className="col-span-2">
                                    {inv.delivery_date?.substring(0, 10)}
                                  </div>
                                  <div className="col-span-2 text-right tabular-nums">
                                    {Math.round((inv.net || 0) / 1000).toLocaleString('hu-HU')} eFt
                                  </div>
                                  <div className="col-span-2 text-right tabular-nums">
                                    {Math.round((inv.vat || 0) / 1000).toLocaleString('hu-HU')} eFt
                                  </div>
                                  <div className="col-span-3 text-right font-medium">
                                    {inv.vat_rate === '0.27'
                                      ? '27%'
                                      : inv.vat_rate === '0.18'
                                      ? '18%'
                                      : inv.vat_rate === '0.05'
                                      ? '5%'
                                      : inv.vat_rate}
                                  </div>
                                </div>
                                {isInvExpanded && selectedCompany?.id && (
                                  <InvoiceItemsDrillDown
                                    invoiceNumber={inv.invoice_number}
                                    companyId={selectedCompany.id}
                                  />
                                )}
                              </React.Fragment>
                            );
                          })}
                        </div>
                      )}
                    </React.Fragment>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Previous Returns History */}
          {selectedCompany?.id && (
            <Card className="border-border/60">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Korábbi bevallások</CardTitle>
                <CardDescription className="text-xs">Gyors áttekintés és navigáció</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <ReturnHistoryTable
                  companyId={selectedCompany.id}
                  currentReturnId={(vatReturn as any)?.id}
                  onNavigate={(y, m, f) => {
                    setYear(y);
                    setMonth(m);
                    if (f) setFrequency(f as any);
                  }}
                />
              </CardContent>
            </Card>
          )}
        </>
      )}
    </>
  );
}
