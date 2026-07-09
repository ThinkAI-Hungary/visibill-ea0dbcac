import React, { useState, useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft, ChevronRight, PiggyBank, TrendingUp,
  Calculator, Info, BarChart3, AlertTriangle, Send
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { useAccountyClient } from '@/hooks/accounty';
import {
  calculateFlatRateIncome, formatHuf, formatPercent, formatMillionHuf,
  DEFAULT_2026_PARAMS, DEFAULT_2025_PARAMS, type EvTaxParams
} from '@/lib/evCalculations';
import { useUpdateEvTaxReturn } from '@/hooks/useEvData';
import { toast } from '@/hooks/use-toast';

export default function EvFlatRatePage() {
  const { id } = useParams<{ id: string }>();
  const { data: client } = useAccountyClient(id);
  const [taxYear, setTaxYear] = useState(2026);
  const updateReturn = useUpdateEvTaxReturn();
  const [saving, setSaving] = useState(false);

  const params: EvTaxParams = taxYear === 2026 ? DEFAULT_2026_PARAMS : DEFAULT_2025_PARAMS;

  const [revenue, setRevenue] = useState(24_200_000);
  const [costCategory, setCostCategory] = useState<'general' | 'high_80' | 'retail_90'>('general');

  const result = useMemo(
    () => calculateFlatRateIncome(revenue, costCategory, params),
    [revenue, costCategory, params]
  );

  const isOverLimit = costCategory === 'retail_90'
    ? revenue > params.atalanyKiskerHatar
    : revenue > params.atalanyBevetelHatar;

  const limit = costCategory === 'retail_90' ? params.atalanyKiskerHatar : params.atalanyBevetelHatar;
  const usagePercent = limit > 0 ? (revenue / limit) * 100 : 0;

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
      xml += `    <bevetel>${result.revenue}</bevetel>\n`;
      xml += `    <koltseghanyad>${result.costRatio * 100}</koltseghanyad>\n`;
      xml += `    <szamitott_koltseg>${result.calculatedCosts}</szamitott_koltseg>\n`;
      xml += `    <jovedelem>${result.income}</jovedelem>\n`;
      xml += `    <adomentes_resz>${result.taxFreeAmount}</adomentes_resz>\n`;
      xml += `    <adokoteles_jovedelem>${result.taxableIncome}</adokoteles_jovedelem>\n`;
      xml += `    <szja>${result.szja}</szja>\n`;
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
        calculated_tax: result.szja,
        paid_amount: 0,
        deadline: `${taxYear + 1}-05-20`,
        submitted_at: new Date().toISOString(),
        xml_data: xml,
        data: {
          revenue: result.revenue,
          cost_ratio: result.costRatio,
          calculated_costs: result.calculatedCosts,
          income: result.income,
          tax_free_amount: result.taxFreeAmount,
          taxable_income: result.taxableIncome,
          szja: result.szja,
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
        <Link to={`/accounty/client/${id}/ev`} className="hover:text-indigo-600 transition-colors flex items-center gap-1">
          <ArrowLeft className="w-3.5 h-3.5" /> EV Főoldal
        </Link>
        <ChevronRight className="w-3 h-3" />
        <span className="text-slate-900 dark:text-slate-100 font-medium">Átalányadó kalkulátor</span>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl shadow-lg shadow-indigo-500/25">
            <PiggyBank className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Átalányadó kalkulátor</h1>
            <p className="text-sm text-slate-500">Szja tv. 50–56. § — {client?.name || 'Ügyfél'}</p>
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
        {/* Input panel */}
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-card rounded-xl border border-border shadow-soft p-5 space-y-4">
            <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">Bemeneti adatok</h2>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-600 dark:text-slate-400">Éves bevétel (Ft)</label>
              <Input
                type="number"
                value={revenue}
                onChange={e => setRevenue(Number(e.target.value))}
                className="bg-card font-mono"
              />
              <input
                type="range"
                min={0}
                max={50_000_000}
                step={100_000}
                value={revenue}
                onChange={e => setRevenue(Number(e.target.value))}
                className="w-full mt-1 accent-indigo-600"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-600 dark:text-slate-400">Költséghányad kategória</label>
              <div className="grid grid-cols-3 gap-1.5">
                {([
                  { value: 'general' as const, label: `${params.atalanyKoltseghanyadGeneral * 100}%`, desc: 'Általános' },
                  { value: 'high_80' as const, label: '80%', desc: 'Kiemelt' },
                  { value: 'retail_90' as const, label: '90%', desc: 'Kisker.' },
                ]).map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => setCostCategory(opt.value)}
                    className={cn(
                      'p-2.5 rounded-lg border text-center transition-all',
                      costCategory === opt.value
                        ? 'border-indigo-400 bg-indigo-50 dark:bg-indigo-900/20'
                        : 'border-border hover:border-slate-300'
                    )}
                  >
                    <p className="text-sm font-bold text-slate-900 dark:text-slate-100">{opt.label}</p>
                    <p className="text-[9px] text-slate-500">{opt.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Threshold warning */}
            {isOverLimit && (
              <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-semibold text-red-700 dark:text-red-400">Bevételi határ túllépve!</p>
                    <p className="text-[10px] text-red-600">
                      Határ: {formatHuf(limit)} — átalányadó nem választható.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {!isOverLimit && usagePercent >= 80 && (
              <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-semibold text-amber-700 dark:text-amber-400">
                      Bevételi határ {usagePercent.toFixed(0)}% kihasználva
                    </p>
                    <p className="text-[10px] text-amber-600">
                      Hátralévő keret: {formatHuf(limit - revenue)}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Adóév paraméterek */}
            <div className="pt-2 border-t border-border/50 space-y-1.5">
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Adóévi paraméterek</p>
              <div className="text-[11px] text-slate-500 space-y-0.5">
                <p>SZJA kulcs: {formatPercent(params.szjaRate)}</p>
                <p>Bevételi határ: {formatHuf(params.atalanyBevetelHatar)}</p>
                <p>Kisker. határ: {formatHuf(params.atalanyKiskerHatar)}</p>
                <p>Adómentes rész: {formatHuf(params.atalanyAdomentesResz)}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Results panel */}
        <div className="lg:col-span-2 space-y-4">
          {/* Summary cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-card rounded-xl border border-border p-4 shadow-soft">
              <p className="text-xs text-slate-500 mb-1">Bevétel</p>
              <p className="text-lg font-bold text-slate-900 dark:text-slate-100">{formatMillionHuf(result.revenue)}</p>
            </div>
            <div className="bg-card rounded-xl border border-border p-4 shadow-soft">
              <p className="text-xs text-slate-500 mb-1">Számított költség</p>
              <p className="text-lg font-bold text-red-500">{formatMillionHuf(result.calculatedCosts)}</p>
              <p className="text-[10px] text-slate-400">{formatPercent(result.costRatio)} hányad</p>
            </div>
            <div className="bg-card rounded-xl border border-border p-4 shadow-soft">
              <p className="text-xs text-slate-500 mb-1">Jövedelem</p>
              <p className="text-lg font-bold text-green-600">{formatMillionHuf(result.income)}</p>
            </div>
            <div className="bg-card rounded-xl border border-border p-4 shadow-soft">
              <p className="text-xs text-slate-500 mb-1">Fizetendő SZJA</p>
              <p className="text-lg font-bold text-indigo-600">{formatHuf(result.szja)}</p>
              <p className="text-[10px] text-slate-400">Eff. ráta: {formatPercent(result.effectiveRate)}</p>
            </div>
          </div>

          {/* Calculation breakdown */}
          <div className="bg-card rounded-xl border border-border shadow-soft overflow-hidden">
            <div className="px-5 py-3 border-b border-border flex items-center gap-2">
              <Calculator className="w-4 h-4 text-indigo-600" />
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Számítási levezetés</h3>
            </div>
            <div className="divide-y divide-border/50">
              {[
                { label: 'Éves bevétel', value: result.revenue, bold: false },
                { label: `Átalány költséghányad (${formatPercent(result.costRatio)})`, value: -result.calculatedCosts, negative: true },
                { label: 'Jövedelem (bevétel – költség)', value: result.income, bold: true },
                { label: 'Adómentes jövedelemrész', value: -result.taxFreeAmount, negative: true },
                { label: 'Adóköteles jövedelem', value: result.taxableIncome, bold: true },
                { label: `SZJA (${formatPercent(params.szjaRate)})`, value: result.szja, bold: true, highlight: true },
              ].map((row, i) => (
                <div
                  key={i}
                  className={cn(
                    'flex items-center justify-between px-5 py-3',
                    row.highlight && 'bg-indigo-50/50 dark:bg-indigo-900/10'
                  )}
                >
                  <span className={cn(
                    'text-sm',
                    row.bold ? 'font-semibold text-slate-900 dark:text-slate-100' : 'text-slate-600 dark:text-slate-400'
                  )}>
                    {row.label}
                  </span>
                  <span className={cn(
                    'text-sm font-mono tabular-nums',
                    row.highlight ? 'font-bold text-indigo-600' :
                    row.negative ? 'text-red-500' :
                    row.bold ? 'font-bold text-slate-900 dark:text-slate-100' :
                    'text-slate-700 dark:text-slate-300'
                  )}>
                    {row.negative ? `– ${formatHuf(Math.abs(row.value))}` : formatHuf(row.value)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Info box */}
          <div className="bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-800 rounded-xl p-4 flex gap-3">
            <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
            <div className="text-xs text-blue-700 dark:text-blue-400 space-y-1">
              <p className="font-semibold">Átalányadó tudnivalók ({taxYear})</p>
              <ul className="list-disc list-inside space-y-0.5 text-blue-600">
                <li>Költséghányad: {formatPercent(params.atalanyKoltseghanyadGeneral)} általános ({taxYear}. évi mérték)</li>
                <li>Adómentes rész: havi minimálbér 50%-a × 12 hó = {formatHuf(params.atalanyAdomentesResz)}</li>
                <li>Bevételi határ: {formatHuf(params.atalanyBevetelHatar)} (kisker: {formatHuf(params.atalanyKiskerHatar)})</li>
                <li>SZJA mérték: {formatPercent(params.szjaRate)}</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
