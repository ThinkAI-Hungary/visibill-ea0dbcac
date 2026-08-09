import React, { useState, useMemo } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import {
  TrendingUp, ArrowLeft, ChevronRight, Calculator,
  FileText, AlertTriangle, Info, ChevronDown, ArrowRight, Send
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAccountyClient, useEvTaxParams } from '@/hooks/accounty';
import {
  calculateEntrepreneurialTax, formatHuf, formatPercent,
  DEFAULT_2026_PARAMS, DEFAULT_2025_PARAMS
} from '@/lib/evCalculations';
import { useUpdateEvTaxReturn } from '@/hooks/useEvData';
import { toast } from '@/hooks/use-toast';

// ─── Component ──────────────────────────────────────────────────────────────

export default function EvEntrepreneurialBasePage() {
  const { companyId, dateRange } = useParams<{ companyId: string; dateRange: string }>();
  const id = companyId;
  const { data: client } = useAccountyClient(id);
  const updateReturn = useUpdateEvTaxReturn();
  const [saving, setSaving] = useState(false);
  const [searchParams] = useSearchParams();
  const yearParam = Number(searchParams.get('year') || '2026');
  const [taxYear, setTaxYear] = useState(yearParam);

  const { data: dbParams } = useEvTaxParams(taxYear);
  const params = dbParams || (taxYear === 2026 ? DEFAULT_2026_PARAMS : DEFAULT_2025_PARAMS);

  const [revenue, setRevenue] = useState(32_000_000);
  const [costs, setCosts] = useState(14_400_000);
  const [otherIncome, setOtherIncome] = useState(0);
  const [employerCosts, setEmployerCosts] = useState(2_880_000);
  const [depreciationTotal, setDepreciationTotal] = useState(800_000);
  const [kivet, setKivet] = useState(4_000_000);

  // Total deductible = costs + depreciation + employer costs
  const totalDeductible = costs + depreciationTotal + employerCosts;

  const result = useMemo(() => calculateEntrepreneurialTax(
    revenue + otherIncome,
    totalDeductible,
    kivet,
    0,
    params,
  ), [revenue, otherIncome, totalDeductible, kivet, params]);

  const netIncome = revenue - costs;
  const taxableBase = result.taxBase;
  const totalTax = result.totalTax;
  const effectiveTaxRate = revenue > 0 ? (totalTax / revenue) * 100 : 0;

  const handleGenerateReturn = async () => {
    if (!id) return;
    setSaving(true);
    try {
      // 1. Generate the XML content
      let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
      xml += `<nav_bevallassablon xmlns="http://www.nav.gov.hu/bevallas" verzio="1.0">\n`;
      xml += `  <fejlec>\n`;
      xml += `    <nyomtatvany>2553</nyomtatvany>\n`;
      xml += `    <adoszam>${client?.taxNumber || client?.tax_number || ''}</adoszam>\n`;
      xml += `    <nev>${client?.name || 'Egyéni Vállalkozó'}</nev>\n`;
      xml += `    <idoszak>${taxYear} Éves</idoszak>\n`;
      xml += `  </fejlec>\n`;
      xml += `  <tartalom>\n`;
      xml += `    <bevetel>${revenue + otherIncome}</bevetel>\n`;
      xml += `    <koltsegek>${totalDeductible}</koltsegek>\n`;
      xml += `    <kivet>${kivet}</kivet>\n`;
      xml += `    <szamitott_adoalap>${result.taxBase}</szamitott_adoalap>\n`;
      xml += `    <vallalkozoi_szja>${result.entrepreneurialTax}</vallalkozoi_szja>\n`;
      xml += `    <osztalekalap>${result.dividendBase}</osztalekalap>\n`;
      xml += `    <osztalek_szja>${result.dividendSzja}</osztalek_szja>\n`;
      xml += `    <szocho>${result.dividendSzocho}</szocho>\n`;
      xml += `    <osszes_szja_teher>${result.totalTax}</osszes_szja_teher>\n`;
      xml += `  </tartalom>\n`;
      xml += `</nav_bevallassablon>\n`;

      // 2. Save to database
      await updateReturn.mutateAsync({
        company_id: id,
        tax_year: taxYear,
        return_type: 'szja',
        form_code: '2553',
        period_key: `${taxYear} Éves`,
        status: 'submitted',
        calculated_tax: result.totalTax,
        paid_amount: 0,
        deadline: `${taxYear + 1}-05-20`,
        submitted_at: new Date().toISOString(),
        xml_data: xml,
        data: {
          revenue: revenue + otherIncome,
          deductible: totalDeductible,
          kivet,
          tax_base: result.taxBase,
          entrepreneurial_tax: result.entrepreneurialTax,
          dividend_base: result.dividendBase,
          dividend_szja: result.dividendSzja,
          dividend_szocho: result.dividendSzocho,
          total_tax: result.totalTax,
        }
      });

      // 3. Download the XML
      const blob = new Blob([xml], { type: 'application/xml;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `NAV_2553_${taxYear}_Eves.xml`;
      a.click();
      URL.revokeObjectURL(url);

      toast({
        title: 'Siker',
        description: 'SZJA bevallás (2553) sikeresen elkészítve és beküldöttként mentve a rendszerbe, az XML letöltése elindult.',
      });
    } catch (err: any) {
      toast({
        title: 'Hiba történt',
        description: err.message || 'Nem sikerült menteni a bevallást.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="w-full space-y-6 animate-in fade-in duration-500">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <Link to="/accounty/ev" className="hover:text-indigo-600 transition-colors flex items-center gap-1">
          <ArrowLeft className="w-3.5 h-3.5" /> EV Portfólió
        </Link>
        <ChevronRight className="w-3 h-3" />
        <Link to={`/accounty/${id}/${dateRange}/ev?year=${taxYear}`} className="hover:text-indigo-600 transition-colors">
          {client?.name || 'Ügyfél'}
        </Link>
        <ChevronRight className="w-3 h-3" />
        <span className="text-slate-900 dark:text-slate-100 font-medium">Vállalkozói SZJA – Adóalap</span>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl shadow-lg shadow-violet-500/25">
            <TrendingUp className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Vállalkozói SZJA – Adóalap számítás</h1>
            <p className="text-sm text-slate-500">Szja tv. 49/B.§ szerinti adóalap-megállapítás – {client?.name || 'Ügyfél'}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={taxYear}
            onChange={(e) => setTaxYear(Number(e.target.value))}
            className="text-sm border border-border rounded-lg px-3 py-1.5 bg-card text-foreground"
          >
            <option value={2026}>2026</option>
            <option value={2025}>2025</option>
          </select>
          <button
            onClick={handleGenerateReturn}
            disabled={saving}
            className="flex items-center gap-1.5 px-4 py-1.5 text-sm font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors disabled:opacity-50"
          >
            <Send className="w-3.5 h-3.5" />
            Bevallás elkészítése (2553)
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Inputs */}
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-card rounded-xl border border-border shadow-soft p-5 space-y-4">
            <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Calculator className="w-4 h-4 text-violet-600" />
              Bemeneti adatok
            </h2>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-slate-500 block mb-1">Vállalkozói bevétel (Ft)</label>
                <input
                  type="number"
                  value={revenue}
                  onChange={e => setRevenue(Number(e.target.value) || 0)}
                  className="w-full text-sm border border-border rounded-lg px-3 py-2 bg-card text-foreground font-mono tabular-nums text-right"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500 block mb-1">Elismert költségek (Ft)</label>
                <input
                  type="number"
                  value={costs}
                  onChange={e => setCosts(Number(e.target.value) || 0)}
                  className="w-full text-sm border border-border rounded-lg px-3 py-2 bg-card text-foreground font-mono tabular-nums text-right"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500 block mb-1">Egyéb bevételek (Ft)</label>
                <input
                  type="number"
                  value={otherIncome}
                  onChange={e => setOtherIncome(Number(e.target.value) || 0)}
                  className="w-full text-sm border border-border rounded-lg px-3 py-2 bg-card text-foreground font-mono tabular-nums text-right"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500 block mb-1">Foglalkoztatói költségek (Ft)</label>
                <input
                  type="number"
                  value={employerCosts}
                  onChange={e => setEmployerCosts(Number(e.target.value) || 0)}
                  className="w-full text-sm border border-border rounded-lg px-3 py-2 bg-card text-foreground font-mono tabular-nums text-right"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500 block mb-1">Értékcsökkenési leírás (Ft)</label>
                <input
                  type="number"
                  value={depreciationTotal}
                  onChange={e => setDepreciationTotal(Number(e.target.value) || 0)}
                  className="w-full text-sm border border-border rounded-lg px-3 py-2 bg-card text-foreground font-mono tabular-nums text-right"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500 block mb-1">Vállalkozói kivét (Ft)</label>
                <input
                  type="number"
                  value={kivet}
                  onChange={e => setKivet(Number(e.target.value) || 0)}
                  className="w-full text-sm border border-border rounded-lg px-3 py-2 bg-card text-foreground font-mono tabular-nums text-right"
                />
                <p className="text-[10px] text-slate-400 mt-0.5">A vállalkozó személyes felhasználásra kivett összeg (SZJA-köteles jövedelem)</p>
              </div>
            </div>
          </div>

          {/* Info */}
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded-xl p-4">
            <div className="flex items-start gap-2">
              <Info className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
              <div className="text-xs text-blue-600 dark:text-blue-400 space-y-1">
                <p className="font-semibold">Vállalkozói SZJA szabályok ({taxYear})</p>
                <ul className="list-disc list-inside space-y-0.5">
                  <li>Vállalkozói SZJA mértéke: {formatPercent(params.vszjaRate)}</li>
                  <li>Osztalékalap SZJA: {formatPercent(params.szjaRate)}</li>
                  <li>Szocho mértéke: {formatPercent(params.szochoKulcs)}</li>
                  <li>Költségarány tételesen igazolva</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* Results */}
        <div className="lg:col-span-2 space-y-4">
          {/* Summary cards */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <div className="bg-card rounded-xl border border-border p-4 shadow-soft">
              <p className="text-xs text-slate-500 mb-1">Vállalkozói bevétel</p>
              <p className="text-lg font-bold text-slate-900 dark:text-slate-100 tabular-nums">{formatHuf(revenue)}</p>
            </div>
            <div className="bg-card rounded-xl border border-border p-4 shadow-soft">
              <p className="text-xs text-slate-500 mb-1">Nettó jövedelem</p>
              <p className="text-lg font-bold text-green-600 tabular-nums">{formatHuf(netIncome)}</p>
            </div>
            <div className="bg-card rounded-xl border border-border p-4 shadow-soft">
              <p className="text-xs text-slate-500 mb-1">Adóalap</p>
              <p className="text-lg font-bold text-violet-600 tabular-nums">{formatHuf(taxableBase)}</p>
            </div>
            <div className="bg-card rounded-xl border border-border p-4 shadow-soft">
              <p className="text-xs text-slate-500 mb-1">Összes adóteher</p>
              <p className="text-lg font-bold text-red-500 tabular-nums">{formatHuf(totalTax)}</p>
            </div>
            <div className="bg-card rounded-xl border border-border p-4 shadow-soft">
              <p className="text-xs text-slate-500 mb-1">Effektív adóráta</p>
              <p className="text-lg font-bold text-indigo-600 tabular-nums">{effectiveTaxRate.toFixed(1)}%</p>
            </div>
          </div>

          {/* Calculation breakdown */}
          <div className="bg-card rounded-xl border border-border shadow-soft overflow-hidden">
            <div className="px-5 py-3 border-b border-border/50">
              <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">Adóalap részletezése</h2>
            </div>
            <div className="divide-y divide-border">
              <Row label="1. Vállalkozói bevétel" value={formatHuf(revenue)} />
              <Row label="2. (-) Elismert költségek" value={formatHuf(costs)} negative />
              <Row label="3. (=) Nyers jövedelem" value={formatHuf(netIncome)} bold />
              <Row label="4. (-) Értékcsökkenési leírás (ÉCS)" value={formatHuf(depreciationTotal)} negative />
              <Row label="5. (-) Foglalkoztatói költségek" value={formatHuf(employerCosts)} negative />
              <Row label="6. (+) Egyéb bevételek" value={formatHuf(otherIncome)} />
              <Row label="7. (=) Vállalkozói adóalap" value={formatHuf(taxableBase)} bold highlight />
            </div>
          </div>

          {/* Tax calculation */}
          <div className="bg-card rounded-xl border border-border shadow-soft overflow-hidden">
            <div className="px-5 py-3 border-b border-border/50">
              <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">Adószámítás</h2>
            </div>
            <div className="divide-y divide-border">
              <Row label={`Vállalkozói SZJA (${formatPercent(params.vszjaRate)})`} value={formatHuf(result.entrepreneurialTax)} />
              <Row label="(-) Vállalkozói kivét" value={formatHuf(kivet)} negative />
              <Row label="(=) Osztalékalap" value={formatHuf(result.dividendBase)} bold />
              <Row label={`Osztalék-SZJA (${formatPercent(params.szjaRate)})`} value={formatHuf(result.dividendSzja)} />
              <Row label={`Szocho (${formatPercent(params.szochoKulcs)})`} value={formatHuf(result.dividendSzocho)} />
              <Row label="Összes adóteher" value={formatHuf(totalTax)} bold highlight />
            </div>
          </div>


          {/* Dividend base hint */}
          <div className="bg-violet-50 dark:bg-violet-900/20 border border-violet-200 dark:border-violet-800 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <ArrowRight className="w-4 h-4 text-violet-600 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-violet-700 dark:text-violet-400">Folytatás: Osztalékalap számítás</p>
                <p className="text-xs text-violet-600 dark:text-violet-400 mt-0.5">
                  Az adóalap-megállapítás után a vállalkozói jövedelemből osztalékalap kerül megállapításra (15% SZJA + 13% szocho).
                </p>
                <Link
                  to={`/accounty/${id}/${dateRange}/ev/entrepreneurial/dividend?year=${taxYear}`}
                  className="inline-flex items-center gap-1 mt-2 text-xs font-semibold text-violet-600 hover:text-violet-800 transition-colors"
                >
                  Osztalékalap számítás <ChevronRight className="w-3 h-3" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, bold, negative, highlight }: {
  label: string;
  value: string;
  bold?: boolean;
  negative?: boolean;
  highlight?: boolean;
}) {
  return (
    <div className={cn(
      'flex items-center justify-between px-5 py-3',
      highlight && 'bg-violet-50/50 dark:bg-violet-900/10'
    )}>
      <span className={cn(
        'text-sm',
        bold ? 'font-bold text-slate-900 dark:text-slate-100' : 'text-slate-600 dark:text-slate-400'
      )}>
        {label}
      </span>
      <span className={cn(
        'text-sm font-mono tabular-nums',
        bold ? 'font-bold text-slate-900 dark:text-slate-100' : '',
        negative ? 'text-red-600' : 'text-slate-700 dark:text-slate-300',
        highlight && 'text-violet-600 font-bold'
      )}>
        {negative ? `- ${value}` : value}
      </span>
    </div>
  );
}
