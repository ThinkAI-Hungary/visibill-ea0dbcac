import React, { useState } from 'react';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  FileText,
  Building2,
  Calendar,
  CreditCard,
  ArrowDownLeft,
  ArrowUpRight,
  Search,
  Filter,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { fmtEur, type FormRow } from '../types';

interface VatObrazacPdvReplicaProps {
  selectedCompany: any;
  year: number;
  month: number;
  frequency: string;
  getVal: (row: string, col: 'base' | 'tax') => number;
}

interface PdvRowDef {
  num: string;
  section: 'I' | 'II' | 'III' | 'IV' | 'V' | 'VI';
  title: string;
  lawRef?: string;
  rate?: string;
  hasBase: boolean;
  hasTax: boolean;
  isSummary?: boolean;
}

const PDV_ROW_DEFINITIONS: PdvRowDef[] = [
  // SECTION I: Neoporezive i oslobođene transakcije
  { num: 'I.1', section: 'I', title: 'Tuzemni prijenos porezne obveze', lawRef: 'čl. 75. st. 2. i čl. 75.a Zakona', hasBase: true, hasTax: false },
  { num: 'I.2', section: 'I', title: 'Isporuke dobara unutar EU', lawRef: 'čl. 41. st. 1. Zakona', hasBase: true, hasTax: false },
  { num: 'I.3', section: 'I', title: 'Novo prijevozno sredstvo unutar EU', lawRef: 'čl. 41. st. 2. Zakona', hasBase: true, hasTax: false },
  { num: 'I.4', section: 'I', title: 'Obavljene usluge unutar EU', lawRef: 'čl. 13. Zakona', hasBase: true, hasTax: false },
  { num: 'I.5', section: 'I', title: 'Usluge osobama bez sjedišta u RH', lawRef: 'čl. 17. st. 1. Zakona', hasBase: true, hasTax: false },
  { num: 'I.6', section: 'I', title: 'Izvoz dobara u treće zemlje', lawRef: 'čl. 45. Zakona', hasBase: true, hasTax: false },
  { num: 'I.7', section: 'I', title: 'Isporuke dobara u slobodnu zonu / skladište', lawRef: 'čl. 46. i 47. Zakona', hasBase: true, hasTax: false },
  { num: 'I.8', section: 'I', title: 'Tuzemne oslobođene isporuke s pravom na odbitak', lawRef: 'čl. 48. Zakona', hasBase: true, hasTax: false },
  { num: 'I.9', section: 'I', title: 'Transakcije posrednika', lawRef: 'čl. 49. Zakona', hasBase: true, hasTax: false },
  { num: 'I.10', section: 'I', title: 'Transakcije koje ne podliježu oporezivanju', lawRef: 'čl. 15. st. 1. Zakona', hasBase: true, hasTax: false },
  { num: 'I.11', section: 'I', title: 'Oslobođene isporuke bez prava na odbitak', lawRef: 'čl. 39. i 40. Zakona', hasBase: true, hasTax: false },
  { num: 'I', section: 'I', title: 'I. UKUPNO — Oslobođene i neoporezive transakcije', hasBase: true, hasTax: false, isSummary: true },

  // SECTION II: Oporezive transakcije
  { num: 'II.1', section: 'II', title: 'Isporuke dobara i usluga po stopi 5%', rate: '5%', hasBase: true, hasTax: true },
  { num: 'II.2', section: 'II', title: 'Isporuke dobara i usluga po stopi 13%', rate: '13%', hasBase: true, hasTax: true },
  { num: 'II.3', section: 'II', title: 'Isporuke dobara i usluga po stopi 25%', rate: '25%', hasBase: true, hasTax: true },
  { num: 'II.4', section: 'II', title: 'Tuzemni prijenos porezne obveze (primatelj)', rate: '25%', hasBase: true, hasTax: true },
  { num: 'II.5', section: 'II', title: 'Uvoz dobara (obračunska kategorija)', hasBase: true, hasTax: true },
  { num: 'II.6', section: 'II', title: 'Uvoz dobara – odgođeno plaćanje', hasBase: true, hasTax: true },
  { num: 'II.7', section: 'II', title: 'Stjecanje dobara iz EU po stopi 5%', rate: '5%', hasBase: true, hasTax: true },
  { num: 'II.8', section: 'II', title: 'Stjecanje dobara iz EU po stopi 13%', rate: '13%', hasBase: true, hasTax: true },
  { num: 'II.9', section: 'II', title: 'Stjecanje dobara iz EU po stopi 25%', rate: '25%', hasBase: true, hasTax: true },
  { num: 'II.10', section: 'II', title: 'Primljene usluge od poreznih obveznika iz EU', rate: '25%', hasBase: true, hasTax: true },
  { num: 'II.11', section: 'II', title: 'Primljene usluge iz trećih zemalja', rate: '25%', hasBase: true, hasTax: true },
  { num: 'II.12', section: 'II', title: 'Primljena dobra od stranih obveznika', hasBase: true, hasTax: true },
  { num: 'II.13', section: 'II', title: 'Trošarine i posebni porezi', hasBase: true, hasTax: true },
  { num: 'II.14', section: 'II', title: 'Naknadno zaračunani PDV', hasBase: false, hasTax: true },
  { num: 'II.15', section: 'II', title: 'Ispravci porezne obveze', hasBase: true, hasTax: true },
  { num: 'II', section: 'II', title: 'II. UKUPNO — Obračunani PDV na izlazne transakcije', hasBase: true, hasTax: true, isSummary: true },

  // SECTION III: Pretporez
  { num: 'III.1', section: 'III', title: 'Pretporez po stopi 5%', rate: '5%', hasBase: true, hasTax: true },
  { num: 'III.2', section: 'III', title: 'Pretporez po stopi 13%', rate: '13%', hasBase: true, hasTax: true },
  { num: 'III.3', section: 'III', title: 'Pretporez po stopi 25%', rate: '25%', hasBase: true, hasTax: true },
  { num: 'III.4', section: 'III', title: 'Pretporez iz tuzemnog prijenosa porezne obveze', rate: '25%', hasBase: true, hasTax: true },
  { num: 'III.5', section: 'III', title: 'Pretporez pri uvozu dobara (obračunski)', hasBase: true, hasTax: true },
  { num: 'III.6', section: 'III', title: 'Pretporez pri uvozu dobara (plaćen na carini)', hasBase: true, hasTax: true },
  { num: 'III.7', section: 'III', title: 'Pretporez pri stjecanju dobara iz EU 5%', rate: '5%', hasBase: true, hasTax: true },
  { num: 'III.8', section: 'III', title: 'Pretporez pri stjecanju dobara iz EU 13%', rate: '13%', hasBase: true, hasTax: true },
  { num: 'III.9', section: 'III', title: 'Pretporez pri stjecanju dobara iz EU 25%', rate: '25%', hasBase: true, hasTax: true },
  { num: 'III.10', section: 'III', title: 'Pretporez za primljene usluge iz EU', rate: '25%', hasBase: true, hasTax: true },
  { num: 'III.11', section: 'III', title: 'Pretporez za primljene usluge iz trećih zemalja', rate: '25%', hasBase: true, hasTax: true },
  { num: 'III.12', section: 'III', title: 'Pretporez bez prava na odbitak', hasBase: true, hasTax: false },
  { num: 'III.13', section: 'III', title: 'Pretporez od poljoprivrednika (paušalna naknada)', hasBase: true, hasTax: true },
  { num: 'III.14', section: 'III', title: 'Ispravak pretporeza', hasBase: true, hasTax: true },
  { num: 'III.15', section: 'III', title: 'Neoporezive nabave', hasBase: true, hasTax: false },
  { num: 'III', section: 'III', title: 'III. UKUPNO — Ukupan pretporez za odbitak', hasBase: true, hasTax: true, isSummary: true },
];

export function VatObrazacPdvReplica({
  selectedCompany,
  year,
  month,
  frequency,
  getVal,
}: VatObrazacPdvReplicaProps) {
  const [activeSection, setActiveSection] = useState<'all' | 'I' | 'II' | 'III' | 'IV'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [onlyNonZero, setOnlyNonZero] = useState(false);

  const periodLabel =
    frequency === 'H'
      ? `${String(month).padStart(2, '0')}/${year}`
      : frequency === 'N'
      ? `Q${month}/${year}`
      : `${year}`;

  // Section totals
  const totalIBase = getVal('I', 'base');
  const totalIIBase = getVal('II', 'base');
  const totalIITax = getVal('II', 'tax');
  const totalIIIBase = getVal('III', 'base');
  const totalIIITax = getVal('III', 'tax');
  const netDifference = totalIITax - totalIIITax;

  const isLiability = netDifference >= 0;
  const absNet = Math.abs(netDifference);

  // Filtered rows
  const filteredRows = PDV_ROW_DEFINITIONS.filter((r) => {
    if (activeSection !== 'all' && r.section !== activeSection) return false;
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      const matchNum = r.num.toLowerCase().includes(term);
      const matchTitle = r.title.toLowerCase().includes(term);
      const matchLaw = r.lawRef?.toLowerCase().includes(term);
      if (!matchNum && !matchTitle && !matchLaw) return false;
    }
    if (onlyNonZero) {
      const b = getVal(r.num, 'base');
      const t = getVal(r.num, 'tax');
      if (b === 0 && t === 0) return false;
    }
    return true;
  });

  return (
    <Card className="border border-sky-300/40 dark:border-sky-800/40 shadow-xl bg-card text-foreground rounded-2xl overflow-hidden">
      {/* Official Croatian Tax Return Header */}
      <CardHeader className="bg-gradient-to-r from-sky-950 via-slate-900 to-indigo-950 text-white p-5 border-b border-sky-800/30">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-[10px] tracking-widest uppercase font-mono text-sky-300 font-semibold">
                Republika Hrvatska • Ministarstvo financija • Porezna uprava
              </span>
            </div>
            <h3 className="font-serif font-black text-2xl tracking-tight text-white flex items-center gap-2.5">
              <span>OBRAZAC PDV</span>
              <Badge className="bg-sky-500/20 text-sky-200 border-sky-400/40 font-mono text-xs">
                Prijava PDV-a
              </Badge>
            </h3>
            <p className="text-xs text-slate-300 font-mono">
              Službena replika prijave poreza na dodanu vrijednost • Iznosi u eurima i centima (€)
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="bg-white/10 backdrop-blur-md border border-white/20 px-3.5 py-1.5 rounded-lg text-right">
              <span className="text-[10px] uppercase font-mono text-slate-300 block">Razdoblje</span>
              <span className="font-mono text-sm font-bold text-white flex items-center gap-1.5 justify-end">
                <Calendar className="w-3.5 h-3.5 text-sky-400" />
                {periodLabel}
              </span>
            </div>
            <div className="bg-white/10 backdrop-blur-md border border-white/20 px-3.5 py-1.5 rounded-lg text-right">
              <span className="text-[10px] uppercase font-mono text-slate-300 block">OIB / Adoszam</span>
              <span className="font-mono text-sm font-bold text-white flex items-center gap-1.5 justify-end">
                <Building2 className="w-3.5 h-3.5 text-sky-400" />
                {(selectedCompany as any)?.tax_number || '—'}
              </span>
            </div>
          </div>
        </div>

        {/* Company info sub-bar */}
        <div className="mt-4 pt-3 border-t border-white/10 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-300 font-mono">
          <div>
            <span className="text-slate-400">Porezni obveznik:</span>{' '}
            <strong className="text-white uppercase">{selectedCompany?.name}</strong>
          </div>
          <div className="flex items-center gap-4">
            <div>
              <span className="text-slate-400">Valuta:</span>{' '}
              <strong className="text-emerald-400">EUR (€)</strong>
            </div>
            <div>
              <span className="text-slate-400">Postupak oporezivanja:</span>{' '}
              <strong className="text-sky-300">
                {(selectedCompany as any)?.vat_regime === 'penzforgalmi' ? 'Prema naplaćenim naknadama (R-2)' : 'Redovni postupak'}
              </strong>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-6 space-y-6">
        {/* Section IV Summary Hero Card */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* I. Total Exempt */}
          <div className="p-4 rounded-xl border border-sky-500/20 bg-sky-500/5 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs font-bold text-sky-600 dark:text-sky-400">I. UKUPNO</span>
              <Badge variant="outline" className="text-[10px] font-mono">Oslobođeno</Badge>
            </div>
            <div className="my-2">
              <span className="text-2xl font-black font-mono tracking-tight text-foreground">
                {fmtEur(totalIBase)}
              </span>
              <p className="text-[11px] text-muted-foreground mt-0.5">Neoporezive i oslobođene isporuke</p>
            </div>
            <span className="text-[10px] font-mono text-muted-foreground">Baza bez poreza</span>
          </div>

          {/* II. Total Payable */}
          <div className="p-4 rounded-xl border border-amber-500/20 bg-amber-500/5 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs font-bold text-amber-600 dark:text-amber-400">II. UKUPNO</span>
              <Badge variant="outline" className="text-[10px] font-mono border-amber-500/30 text-amber-600">Obračunani PDV</Badge>
            </div>
            <div className="my-2">
              <span className="text-2xl font-black font-mono tracking-tight text-foreground">
                {fmtEur(totalIITax)}
              </span>
              <p className="text-[11px] text-muted-foreground mt-0.5">Baza: {fmtEur(totalIIBase)}</p>
            </div>
            <span className="text-[10px] font-mono text-muted-foreground">Fizetendő PDV (Obveza)</span>
          </div>

          {/* III. Total Deductible */}
          <div className="p-4 rounded-xl border border-blue-500/20 bg-blue-500/5 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs font-bold text-blue-600 dark:text-blue-400">III. UKUPNO</span>
              <Badge variant="outline" className="text-[10px] font-mono border-blue-500/30 text-blue-600">Pretporez</Badge>
            </div>
            <div className="my-2">
              <span className="text-2xl font-black font-mono tracking-tight text-foreground">
                {fmtEur(totalIIITax)}
              </span>
              <p className="text-[11px] text-muted-foreground mt-0.5">Baza: {fmtEur(totalIIIBase)}</p>
            </div>
            <span className="text-[10px] font-mono text-muted-foreground">Levonható PDV (Pretporez)</span>
          </div>

          {/* IV. Net Position */}
          <div
            className={cn(
              'p-4 rounded-xl border flex flex-col justify-between shadow-sm transition-all',
              isLiability
                ? 'border-red-500/30 bg-red-500/10 text-red-950 dark:text-red-100'
                : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-950 dark:text-emerald-100'
            )}
          >
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs font-black uppercase">IV. OBVEZA / POVRAT</span>
              <Badge
                className={cn(
                  'text-[10px] font-mono font-bold',
                  isLiability ? 'bg-red-600 text-white' : 'bg-emerald-600 text-white'
                )}
              >
                {isLiability ? 'Za uplatu' : 'Za povrat'}
              </Badge>
            </div>
            <div className="my-2">
              <span className="text-2xl font-black font-mono tracking-tight">
                {fmtEur(absNet)}
              </span>
              <p className="text-[11px] opacity-80 mt-0.5">
                {isLiability ? 'Porezna obveza za uplatu (II. - III.)' : 'Pravo na povrat / prijenos'}
              </p>
            </div>
            <div className="flex items-center gap-1 text-[10px] font-mono opacity-70">
              {isLiability ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownLeft className="w-3 h-3" />}
              <span>{isLiability ? 'Befizetendő költségvetési kötelezettség' : 'Visszaigényelhető / átvihető'}</span>
            </div>
          </div>
        </div>

        {/* Filter Toolbar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-muted/30 p-2.5 rounded-xl border border-border/60">
          {/* Section Selector */}
          <div className="flex bg-muted/60 border rounded-lg p-0.5 w-full sm:w-auto">
            <button
              onClick={() => setActiveSection('all')}
              className={cn(
                'px-3 py-1 text-xs font-medium rounded-md transition-all',
                activeSection === 'all'
                  ? 'bg-background shadow-xs text-foreground font-semibold'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              Sve stavke
            </button>
            <button
              onClick={() => setActiveSection('I')}
              className={cn(
                'px-3 py-1 text-xs font-medium rounded-md transition-all',
                activeSection === 'I'
                  ? 'bg-background shadow-xs text-foreground font-semibold'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              I. Neoporezivo
            </button>
            <button
              onClick={() => setActiveSection('II')}
              className={cn(
                'px-3 py-1 text-xs font-medium rounded-md transition-all',
                activeSection === 'II'
                  ? 'bg-background shadow-xs text-foreground font-semibold'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              II. Obračunani
            </button>
            <button
              onClick={() => setActiveSection('III')}
              className={cn(
                'px-3 py-1 text-xs font-medium rounded-md transition-all',
                activeSection === 'III'
                  ? 'bg-background shadow-xs text-foreground font-semibold'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              III. Pretporez
            </button>
          </div>

          {/* Search & Only Non-Zero toggle */}
          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <div className="relative w-full sm:w-60">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Traži po retku ili nazivu..."
                className="h-8 pl-8 text-xs bg-background"
              />
            </div>
            <Button
              variant={onlyNonZero ? 'secondary' : 'outline'}
              size="sm"
              onClick={() => setOnlyNonZero(!onlyNonZero)}
              className="h-8 text-xs gap-1.5 shrink-0"
              title="Prikaži samo retke s iznosima"
            >
              <Filter className="w-3 h-3" />
              <span className="hidden sm:inline">Samo s iznosom</span>
            </Button>
          </div>
        </div>

        {/* PDV Form Rows Table */}
        <div className="border border-border rounded-xl overflow-hidden bg-card shadow-xs">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-muted/60 border-b border-border text-[11px] text-muted-foreground font-mono uppercase tracking-wider">
                <th className="py-2.5 px-3 w-16 text-center">Redak</th>
                <th className="py-2.5 px-3">Opis transakcije (Naziv polja u Obrascu PDV)</th>
                <th className="py-2.5 px-2 w-20 text-center">Stopa</th>
                <th className="py-2.5 px-4 w-40 text-right">Vrijednost bez PDV-a (Baza)</th>
                <th className="py-2.5 px-4 w-40 text-right">PDV / Pretporez (Porez)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-muted-foreground text-xs">
                    Nema redaka koji odgovaraju odabranim kriterijima pretrage.
                  </td>
                </tr>
              ) : (
                filteredRows.map((r) => {
                  const baseVal = r.hasBase ? getVal(r.num, 'base') : null;
                  const taxVal = r.hasTax ? getVal(r.num, 'tax') : null;
                  const hasValues = (baseVal !== null && baseVal !== 0) || (taxVal !== null && taxVal !== 0);

                  return (
                    <tr
                      key={r.num}
                      className={cn(
                        'transition-colors font-sans',
                        r.isSummary
                          ? 'bg-muted/40 font-bold border-t-2 border-b-2 border-border text-foreground'
                          : hasValues
                          ? 'bg-sky-500/5 hover:bg-sky-500/10'
                          : 'hover:bg-muted/20 text-muted-foreground/90'
                      )}
                    >
                      {/* Row Number */}
                      <td className="py-2.5 px-3 text-center">
                        <Badge
                          variant={r.isSummary ? 'default' : hasValues ? 'secondary' : 'outline'}
                          className={cn(
                            'font-mono font-bold text-[11px] px-2 py-0.5',
                            r.isSummary && 'bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900',
                            hasValues && !r.isSummary && 'border-sky-500/40 bg-sky-500/15 text-sky-700 dark:text-sky-300'
                          )}
                        >
                          {r.num}
                        </Badge>
                      </td>

                      {/* Description & Law Reference */}
                      <td className="py-2.5 px-3">
                        <div className="flex flex-col gap-0.5">
                          <span className={cn('text-xs', r.isSummary ? 'font-bold text-foreground text-sm' : hasValues ? 'font-semibold text-foreground' : 'text-foreground/80')}>
                            {r.title}
                          </span>
                          {r.lawRef && (
                            <span className="text-[10px] text-muted-foreground font-mono">
                              {r.lawRef}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Tax Rate */}
                      <td className="py-2.5 px-2 text-center font-mono text-[11px]">
                        {r.rate ? (
                          <Badge variant="outline" className="font-mono text-[10px] px-1.5 py-0 h-4 border-muted-foreground/30">
                            {r.rate}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground/40">—</span>
                        )}
                      </td>

                      {/* Base Amount */}
                      <td className="py-2.5 px-4 text-right font-mono text-xs tabular-nums">
                        {r.hasBase ? (
                          <span className={cn(baseVal !== 0 && 'font-bold text-foreground')}>
                            {fmtEur(baseVal)}
                          </span>
                        ) : (
                          <span className="text-muted-foreground/30">—</span>
                        )}
                      </td>

                      {/* Tax Amount */}
                      <td className="py-2.5 px-4 text-right font-mono text-xs tabular-nums">
                        {r.hasTax ? (
                          <span className={cn(taxVal !== 0 && 'font-bold text-foreground')}>
                            {fmtEur(taxVal)}
                          </span>
                        ) : (
                          <span className="text-muted-foreground/30">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Section VI: Additional Disclosures & Notes Card */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
          <div className="border border-border/70 rounded-xl p-4 bg-muted/20 space-y-2 text-xs">
            <div className="flex items-center gap-1.5 font-semibold text-foreground">
              <FileText className="w-4 h-4 text-sky-500" />
              <span>VI. Ostali podaci (Dugotrajna imovina i napomene)</span>
            </div>
            <ul className="text-muted-foreground space-y-1 pl-5 list-disc text-[11px]">
              <li>1. Nabava dugotrajne imovine (građevine, oprema, patenti) evidentira se u pretporezu III.1–III.3.</li>
              <li>2. Za stjecanja i isporuke unutar EU podnosi se i rekapitulacijski izvještaj (Obrazac ZP).</li>
              <li>3. Usklađenost s Pravilnikom o porezu na dodanu vrijednost (NN 1/26).</li>
            </ul>
          </div>

          <div className="border border-border/70 rounded-xl p-4 bg-muted/20 space-y-2 text-xs">
            <div className="flex items-center gap-1.5 font-semibold text-foreground">
              <CreditCard className="w-4 h-4 text-emerald-500" />
              <span>Uputa za plaćanje porezne obveze</span>
            </div>
            <div className="space-y-1 text-[11px] font-mono text-muted-foreground">
              <div>
                <span className="text-foreground font-semibold">IBAN državnog proračuna:</span> HR1210010051863000160
              </div>
              <div>
                <span className="text-foreground font-semibold">Model i poziv na broj:</span> HR68 8125-{(selectedCompany as any)?.tax_number || 'OIB'}-PDV
              </div>
              <p className="text-[10px] text-muted-foreground/80 font-sans pt-1">
                Rok za podnošenje prijave i uplatu porezne obveze je zadnji dan u mjesecu za prethodno razdoblje.
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
