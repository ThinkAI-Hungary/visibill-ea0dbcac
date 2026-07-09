import React, { useState, useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft, ChevronRight, Shield, Calculator, AlertTriangle,
  Info, TrendingUp, Wallet, Send
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { useAccountyClient } from '@/hooks/accounty';
import {
  calculateKata, formatHuf, formatPercent, formatMillionHuf,
  DEFAULT_2026_PARAMS, DEFAULT_2025_PARAMS
} from '@/lib/evCalculations';
import { useUpdateEvTaxReturn } from '@/hooks/useEvData';
import { toast } from '@/hooks/use-toast';

function escapeXml(str: string): string {
  return (str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export default function EvKataPage() {
  const { id } = useParams<{ id: string }>();
  const { data: client } = useAccountyClient(id);
  const [taxYear, setTaxYear] = useState(2026);
  const updateReturn = useUpdateEvTaxReturn();
  const [saving, setSaving] = useState(false);

  const params = taxYear === 2026 ? DEFAULT_2026_PARAMS : DEFAULT_2025_PARAMS;

  const [revenue, setRevenue] = useState(14_500_000);
  const [activeMonths, setActiveMonths] = useState(12);

  const result = useMemo(
    () => calculateKata(revenue, activeMonths, params),
    [revenue, activeMonths, params]
  );

  const usagePercent = params.kataEvesKeret > 0 ? (revenue / params.kataEvesKeret) * 100 : 0;

  const handleGenerateReturn = async () => {
    if (!id) return;
    setSaving(true);
    try {
      // 1. Generate the XML content
      const periodFrom = `${taxYear}-01-01`;
      const periodTo = `${taxYear}-12-31`;
      const currentDate = new Date().toISOString().slice(0, 10);

      const taxNum = client?.taxNumber || client?.tax_number || '';
      const taxParts = taxNum.split('-');
      const taxNum8 = taxParts[0] || '';
      const taxNumVat = taxParts[1] || '';
      const taxNumCounty = taxParts[2] || '';

      const taxId = client?.taxId || client?.tax_id || '8329900747';
      const clientName = client?.name || 'Egyéni Vállalkozó';
      const clientAddress = client?.address || '1054 Budapest, Alkotmány utca 4.';
      const clientEmail = client?.email || `${clientName.toLowerCase().replace(/[^a-z0-9]/g, '')}@gmail.com`;
      const clientPhone = client?.phone || '+36 30 123 4567';

      let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
      xml += `<!-- Nemzeti Adó- és Vámhivatal ÁNYK XML Export -->\n`;
      xml += `<nyomtatvanyok xmlns="http://www.nav.gov.hu/nyomtatvanyok" verzio="1.0">\n`;
      xml += `  <nyomtatvany>\n`;
      xml += `    <nyomtatvanyinformacio>\n`;
      xml += `      <nyomtatvanyazonosito>${taxYear}KATA</nyomtatvanyazonosito>\n`;
      xml += `      <verzio>1.0</verzio>\n`;
      xml += `    </nyomtatvanyinformacio>\n`;
      xml += `    <mezok>\n`;
      xml += `      <!-- ========================================== -->\n`;
      xml += `      <!-- A) FŐLAP - AZONOSÍTÓ ÉS KAPCSOLATTARTÁSI ADATOK -->\n`;
      xml += `      <!-- ========================================== -->\n`;
      xml += `      <mezo eazon="01_0001_adoszam_torzs">${taxNum8}</mezo>\n`;
      xml += `      <mezo eazon="01_0002_adoszam_afa">${taxNumVat}</mezo>\n`;
      xml += `      <mezo eazon="01_0003_adoszam_megye">${taxNumCounty}</mezo>\n`;
      xml += `      <mezo eazon="01_0004_adoszam_teljes">${taxNum}</mezo>\n`;
      xml += `      <mezo eazon="01_0005_adoazonosito">${taxId}</mezo>\n`;
      xml += `      <mezo eazon="01_0006_adozo_nev">${escapeXml(clientName)}</mezo>\n`;
      xml += `      <mezo eazon="01_0007_szekhely_cim">${escapeXml(clientAddress)}</mezo>\n`;
      xml += `      <mezo eazon="01_0008_email">${escapeXml(clientEmail)}</mezo>\n`;
      xml += `      <mezo eazon="01_0009_telefon">${escapeXml(clientPhone)}</mezo>\n`;
      xml += `\n`;
      xml += `      <!-- ========================================== -->\n`;
      xml += `      <!-- B) IDŐSZAK ÉS NYILATKOZAT TÍPUSA -->\n`;
      xml += `      <!-- ========================================== -->\n`;
      xml += `      <mezo eazon="01_0010_adoev">${taxYear}</mezo>\n`;
      xml += `      <mezo eazon="01_0011_idoszak_tol">${periodFrom}</mezo>\n`;
      xml += `      <mezo eazon="01_0012_idoszak_ig">${periodTo}</mezo>\n`;
      xml += `      <mezo eazon="01_0013_bevallastipus">M</mezo>\n`;
      xml += `      <mezo eazon="01_0014_idoszak_megnevezes">${taxYear} Éves</mezo>\n`;
      xml += `\n`;
      xml += `      <!-- ========================================== -->\n`;
      xml += `      <!-- C) ADÓKÖTELEZETTSÉG RÉSZLETEZÉSE (BEVÉTEL ÉS ADÓ) -->\n`;
      xml += `      <!-- ========================================== -->\n`;
      xml += `      <mezo eazon="02_0001_bevetel_osszesen">${result.annualRevenue}</mezo>\n`;
      xml += `      <mezo eazon="02_0002_aktiv_honapok_szama">${result.activeMonths}</mezo>\n`;
      xml += `      <mezo eazon="02_0003_teteles_ado_osszeg">${result.annualFee}</mezo>\n`;
      xml += `      <mezo eazon="02_0004_beveteli_keret">${result.revenueLimit}</mezo>\n`;
      xml += `      <mezo eazon="02_0005_kereten_feluli_bevetel">${result.excessRevenue}</mezo>\n`;
      xml += `      <mezo eazon="02_0006_kulonado_kulcs">${result.surchargeRate}</mezo>\n`;
      xml += `      <mezo eazon="02_0007_kulonado_osszeg">${result.surchargeAmount}</mezo>\n`;
      xml += `      <mezo eazon="02_0008_fizetendo_osszesen">${result.totalTax}</mezo>\n`;
      xml += `\n`;
      xml += `      <!-- ========================================== -->\n`;
      xml += `      <!-- D) NYILATKOZAT ÉS KELTEZÉS -->\n`;
      xml += `      <!-- ========================================== -->\n`;
      xml += `      <mezo eazon="03_0001_nyilatkozat_adat_valos">1</mezo>\n`;
      xml += `      <mezo eazon="03_0002_kelt_hely">Budapest</mezo>\n`;
      xml += `      <mezo eazon="03_0003_kelt_datum">${currentDate}</mezo>\n`;
      xml += `    </mezok>\n`;
      xml += `  </nyomtatvany>\n`;
      xml += `</nyomtatvanyok>\n`;

      // 2. Save to database
      await updateReturn.mutateAsync({
        company_id: id,
        tax_year: taxYear,
        return_type: 'kata',
        form_code: 'KATA',
        period_key: `${taxYear} Éves`,
        status: 'submitted',
        calculated_tax: result.totalTax,
        paid_amount: 0,
        deadline: `${taxYear + 1}-02-25`,
        submitted_at: new Date().toISOString(),
        xml_data: xml,
        data: {
          revenue: result.annualRevenue,
          active_months: result.activeMonths,
          monthly_fee: result.monthlyFee,
          annual_fee: result.annualFee,
          excess_revenue: result.excessRevenue,
          surcharge_amount: result.surchargeAmount,
          total_tax: result.totalTax,
        }
      });

      // 3. Download the XML
      const blob = new Blob([xml], { type: 'application/xml;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `NAV_KATA_${taxYear}_Eves.xml`;
      a.click();
      URL.revokeObjectURL(url);

      toast({
        title: 'Siker',
        description: `KATA nyilatkozat (${taxYear}) sikeresen elkészítve és beküldöttként mentve, az XML letöltése elindult.`,
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
        <span className="text-slate-900 dark:text-slate-100 font-medium">KATA kisadózó</span>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl shadow-lg shadow-amber-500/25">
            <Shield className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">KATA kisadózó</h1>
            <p className="text-sm text-slate-500">KATA tv. 7–8. § — {client?.name || 'Ügyfél'}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={taxYear}
            onChange={e => setTaxYear(Number(e.target.value))}
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
            Bevallás elkészítése (KATA)
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Inputs */}
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-card rounded-xl border border-border shadow-soft p-5 space-y-4">
            <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">Bemeneti adatok</h2>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-600 dark:text-slate-400">Éves bevétel (Ft)</label>
              <Input type="number" value={revenue} onChange={e => setRevenue(Number(e.target.value))} className="bg-card font-mono" />
              <input type="range" min={0} max={30_000_000} step={100_000} value={revenue} onChange={e => setRevenue(Number(e.target.value))} className="w-full accent-amber-600" />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-600 dark:text-slate-400">Aktív hónapok</label>
              <Input type="number" min={1} max={12} value={activeMonths} onChange={e => setActiveMonths(Number(e.target.value))} className="bg-card" />
            </div>

            {/* Keret kihasználtság */}
            <div className="pt-2 border-t border-border/50 space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-slate-500">Bevételi keret</span>
                <span className={cn('font-semibold', usagePercent >= 100 ? 'text-red-600' : usagePercent >= 80 ? 'text-amber-600' : 'text-green-600')}>
                  {usagePercent.toFixed(0)}%
                </span>
              </div>
              <div className="w-full h-2.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                <div
                  className={cn(
                    'h-full rounded-full transition-all duration-500',
                    usagePercent >= 100 ? 'bg-red-500' : usagePercent >= 80 ? 'bg-amber-500' : 'bg-green-500'
                  )}
                  style={{ width: `${Math.min(100, usagePercent)}%` }}
                />
              </div>
              <div className="flex justify-between text-[10px] text-slate-400">
                <span>{formatHuf(revenue)}</span>
                <span>{formatHuf(params.kataEvesKeret)}</span>
              </div>
            </div>

            {result.excessRevenue > 0 && (
              <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-semibold text-red-700 dark:text-red-400">Bevételi keret túllépés!</p>
                    <p className="text-[10px] text-red-600">
                      Keret feletti: {formatHuf(result.excessRevenue)} — {formatPercent(result.surchargeRate)} különadó: {formatHuf(result.surchargeAmount)}
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="pt-2 border-t border-border/50 space-y-1.5">
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">KATA paraméterek</p>
              <div className="text-[11px] text-slate-500 space-y-0.5">
                <p>Havi tételes adó: {formatHuf(params.kataHaviTetel)}</p>
                <p>Éves bevételi keret: {formatHuf(params.kataEvesKeret)}</p>
                <p>Keret feletti különadó: {formatPercent(params.kataKulonadoKulcs)}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Results */}
        <div className="lg:col-span-2 space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-card rounded-xl border border-border p-4 shadow-soft">
              <p className="text-xs text-slate-500 mb-1">Havi tételes adó</p>
              <p className="text-lg font-bold text-amber-600">{formatHuf(result.monthlyFee)}</p>
            </div>
            <div className="bg-card rounded-xl border border-border p-4 shadow-soft">
              <p className="text-xs text-slate-500 mb-1">Éves tételes adó</p>
              <p className="text-lg font-bold text-amber-600">{formatHuf(result.annualFee)}</p>
              <p className="text-[10px] text-slate-400">{result.activeMonths} hónap</p>
            </div>
            <div className="bg-card rounded-xl border border-border p-4 shadow-soft">
              <p className="text-xs text-slate-500 mb-1">Különadó</p>
              <p className={cn('text-lg font-bold', result.surchargeAmount > 0 ? 'text-red-600' : 'text-slate-400')}>
                {result.surchargeAmount > 0 ? formatHuf(result.surchargeAmount) : '—'}
              </p>
            </div>
            <div className="bg-card rounded-xl border border-border p-4 shadow-soft">
              <p className="text-xs text-slate-500 mb-1">Összes adóteher</p>
              <p className="text-lg font-bold text-slate-900 dark:text-slate-100">{formatHuf(result.totalTax)}</p>
              <p className="text-[10px] text-slate-400">Eff: {formatPercent(result.effectiveRate)}</p>
            </div>
          </div>

          {/* Calculation breakdown */}
          <div className="bg-card rounded-xl border border-border shadow-soft overflow-hidden">
            <div className="px-5 py-3 border-b border-border flex items-center gap-2">
              <Calculator className="w-4 h-4 text-amber-600" />
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Számítási levezetés</h3>
            </div>
            <div className="divide-y divide-border/50">
              {[
                { label: 'Éves bevétel', value: result.annualRevenue },
                { label: `Havi tételes adó × ${result.activeMonths} hó`, value: result.annualFee, highlight: false },
                { label: `Bevételi keret (${formatHuf(result.revenueLimit)})`, value: null, info: true },
                ...(result.excessRevenue > 0 ? [
                  { label: 'Keret feletti bevétel', value: result.excessRevenue, negative: true },
                  { label: `Különadó (${formatPercent(result.surchargeRate)})`, value: result.surchargeAmount, negative: true },
                ] : []),
                { label: 'Összes adóteher', value: result.totalTax, highlight: true },
              ].filter(r => r.info !== true || result.excessRevenue === 0).map((row, i) => (
                <div
                  key={i}
                  className={cn(
                    'flex items-center justify-between px-5 py-3',
                    row.highlight && 'bg-amber-50/50 dark:bg-amber-900/10'
                  )}
                >
                  <span className={cn(
                    'text-sm',
                    row.highlight ? 'font-bold text-slate-900 dark:text-slate-100' : 'text-slate-600 dark:text-slate-400'
                  )}>
                    {row.label}
                  </span>
                  <span className={cn(
                    'text-sm font-mono tabular-nums',
                    row.highlight ? 'font-bold text-amber-600' :
                    (row as any).negative ? 'text-red-500' :
                    'text-slate-700 dark:text-slate-300'
                  )}>
                    {row.value !== null && row.value !== undefined ? formatHuf(row.value) : '—'}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Monthly breakdown */}
          <div className="bg-card rounded-xl border border-border shadow-soft overflow-hidden">
            <div className="px-5 py-3 border-b border-border">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Havi bontás</h3>
            </div>
            <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-12 gap-0">
              {Array.from({ length: 12 }, (_, i) => {
                const active = i < activeMonths;
                return (
                  <div
                    key={i}
                    className={cn(
                      'p-3 text-center border-r border-b border-border/30 last:border-r-0',
                      active ? 'bg-amber-50/50 dark:bg-amber-900/10' : 'bg-slate-50 dark:bg-slate-800/50'
                    )}
                  >
                    <p className="text-[10px] text-slate-400">{['Jan', 'Feb', 'Már', 'Ápr', 'Máj', 'Jún', 'Júl', 'Aug', 'Sze', 'Okt', 'Nov', 'Dec'][i]}</p>
                    <p className={cn(
                      'text-xs font-bold mt-0.5',
                      active ? 'text-amber-600' : 'text-slate-300'
                    )}>
                      {active ? formatHuf(params.kataHaviTetel).replace(' Ft', '') : '—'}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Info */}
          <div className="bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-800 rounded-xl p-4 flex gap-3">
            <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
            <div className="text-xs text-blue-700 dark:text-blue-400 space-y-1">
              <p className="font-semibold">KATA tudnivalók ({taxYear})</p>
              <ul className="list-disc list-inside space-y-0.5 text-blue-600">
                <li>Havi tételes adó: {formatHuf(params.kataHaviTetel)} — TB-járulékot és szochót is kiváltja</li>
                <li>Bevételi keret: {formatHuf(params.kataEvesKeret)}/év</li>
                <li>Keret feletti különadó: {formatPercent(params.kataKulonadoKulcs)}</li>
                <li>Csak magánszemély ügyfeleknek számlázhat (B2C)</li>
                <li>Felső bevételi határ: nincs, de a különadó miatt érdemes figyelni</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
