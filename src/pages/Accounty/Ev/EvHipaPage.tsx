import React, { useState, useMemo } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft, ChevronRight, Landmark, Calculator, Info, MapPin, Send
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { useAccountyClient } from '@/hooks/accounty';
import {
  calculateHipaSimplified, calculateHipaGeneral, formatHuf, formatPercent
} from '@/lib/evCalculations';
import { useUpdateEvTaxReturn } from '@/hooks/useEvData';
import { toast } from '@/hooks/use-toast';

export default function EvHipaPage() {
  const { id } = useParams<{ id: string }>();
  const { data: client } = useAccountyClient(id);
  const [searchParams] = useSearchParams();
  const yearParam = Number(searchParams.get('year') || '2026');
  const [taxYear, setTaxYear] = useState(yearParam);
  const updateReturn = useUpdateEvTaxReturn();
  const [saving, setSaving] = useState(false);

  const [mode, setMode] = useState<'simplified' | 'general'>('simplified');
  const [revenue, setRevenue] = useState(24_200_000);
  const [municipalityRate, setMunicipalityRate] = useState(2.0);

  // General mode inputs
  const [elab, setElab] = useState(0);
  const [intermediary, setIntermediary] = useState(0);
  const [material, setMaterial] = useState(0);
  const [subcontractor, setSubcontractor] = useState(0);

  const result = useMemo(() => {
    if (mode === 'simplified') {
      return calculateHipaSimplified(revenue, municipalityRate / 100);
    }
    return calculateHipaGeneral(revenue, elab, intermediary, material, subcontractor, municipalityRate / 100);
  }, [mode, revenue, municipalityRate, elab, intermediary, material, subcontractor]);

  const handleGenerateReturn = async () => {
    if (!id) return;
    setSaving(true);
    try {
      const period = `${taxYear}. adóévi HIPA bevallás`;
      // 1. Generate XML
      let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
      xml += `<nav_bevallassablon xmlns="http://www.nav.gov.hu/bevallas" verzio="1.0">\n`;
      xml += `  <fejlec>\n`;
      xml += `    <nyomtatvany>HIPAK</nyomtatvany>\n`;
      xml += `    <adoszam>${client?.taxNumber || client?.tax_number || ''}</adoszam>\n`;
      xml += `    <nev>${client?.name || 'Egyéni Vállalkozó'}</nev>\n`;
      xml += `    <idoszak>${period}</idoszak>\n`;
      xml += `  </fejlec>\n`;
      xml += `  <tartalom>\n`;
      xml += `    <adoalap>${result.taxBase}</adoalap>\n`;
      xml += `    <adomertek>${result.municipalityRate * 100}%</adomertek>\n`;
      xml += `    <hipa_osszeg>${result.taxAmount}</hipa_osszeg>\n`;
      xml += '  </tartalom>\n';
      xml += '</nav_bevallassablon>\n';

      // 2. Save/upsert return to db
      await updateReturn.mutateAsync({
        company_id: id,
        tax_year: taxYear,
        return_type: 'hipa',
        form_code: 'HIPAK',
        period_key: period,
        status: 'submitted',
        calculated_tax: result.taxAmount,
        paid_amount: 0,
        deadline: `${taxYear + 1}-05-31`,
        submitted_at: new Date().toISOString(),
        xml_data: xml,
        data: {
          period: period,
          amount: result.taxAmount,
          tax_base: result.taxBase,
          rate: result.municipalityRate * 100,
        }
      });

      // 3. Download the file
      const blob = new Blob([xml], { type: 'application/xml;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `NAV_HIPA_${taxYear}_Eves_Bevallas.xml`;
      a.click();
      URL.revokeObjectURL(url);

      toast({
        title: 'Siker',
        description: `HIPA bevallás (${taxYear}) sikeresen elkészítve és beküldöttként mentve, az XML letöltése elindult.`,
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
        <Link to={`/accounty/client/${id}/ev?year=${taxYear}`} className="hover:text-indigo-600 transition-colors flex items-center gap-1">
          <ArrowLeft className="w-3.5 h-3.5" /> EV Főoldal
        </Link>
        <ChevronRight className="w-3 h-3" />
        <span className="text-slate-900 dark:text-slate-100 font-medium">Helyi iparűzési adó</span>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-gradient-to-br from-rose-500 to-pink-600 rounded-xl shadow-lg shadow-rose-500/25">
            <Landmark className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Helyi iparűzési adó (HIPA)</h1>
            <p className="text-sm text-slate-500">Htv. 39. § — {client?.name || 'Ügyfél'} — {taxYear}. adóév</p>
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
            Bevallás elkészítése (HIPA)
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Inputs */}
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-card rounded-xl border border-border shadow-soft p-5 space-y-4">
            <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">Adatmegadás</h2>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-600 dark:text-slate-400">Megállapítási mód</label>
              <div className="grid grid-cols-2 gap-1.5">
                {([
                  { value: 'simplified' as const, label: 'Egyszerűsített' },
                  { value: 'general' as const, label: 'Általános' },
                ]).map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => setMode(opt.value)}
                    className={cn(
                      'p-2.5 rounded-lg border text-sm font-medium transition-all',
                      mode === opt.value
                        ? 'border-rose-400 bg-rose-50 dark:bg-rose-900/20 text-rose-700'
                        : 'border-border text-slate-500'
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-600 dark:text-slate-400">
                Nettó árbevétel (Ft)
              </label>
              <Input type="number" value={revenue} onChange={e => setRevenue(Number(e.target.value))} className="bg-card font-mono" />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-600 dark:text-slate-400 flex items-center gap-1">
                <MapPin className="w-3 h-3" /> Önkormányzati adókulcs (%)
              </label>
              <Input type="number" step={0.1} min={0} max={2} value={municipalityRate} onChange={e => setMunicipalityRate(Number(e.target.value))} className="bg-card" />
              <p className="text-[10px] text-slate-400">Maximum 2% (alapértelmezett: 2%)</p>
            </div>

            {mode === 'general' && (
              <>
                <div className="pt-2 border-t border-border/50 space-y-3">
                  <p className="text-xs font-semibold text-slate-600">Levonható tételek</p>
                  <div className="space-y-1.5">
                    <label className="text-[10px] text-slate-500">ELAB (anyagköltség)</label>
                    <Input type="number" value={elab} onChange={e => setElab(Number(e.target.value))} className="bg-card font-mono text-sm" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] text-slate-500">Közvetített szolgáltatások</label>
                    <Input type="number" value={intermediary} onChange={e => setIntermediary(Number(e.target.value))} className="bg-card font-mono text-sm" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] text-slate-500">Anyagköltség</label>
                    <Input type="number" value={material} onChange={e => setMaterial(Number(e.target.value))} className="bg-card font-mono text-sm" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] text-slate-500">Alvállalkozói teljesítmény</label>
                    <Input type="number" value={subcontractor} onChange={e => setSubcontractor(Number(e.target.value))} className="bg-card font-mono text-sm" />
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Results */}
        <div className="lg:col-span-2 space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-card rounded-xl border border-border p-4 shadow-soft">
              <p className="text-xs text-slate-500 mb-1">Adóalap</p>
              <p className="text-lg font-bold text-slate-900 dark:text-slate-100">{formatHuf(result.taxBase)}</p>
              <p className="text-[10px] text-slate-400">{mode === 'simplified' ? 'Egyszerűsített sáv' : 'Levonás utáni'}</p>
            </div>
            <div className="bg-card rounded-xl border border-border p-4 shadow-soft">
              <p className="text-xs text-slate-500 mb-1">Alkalmazott kulcs</p>
              <p className="text-lg font-bold text-rose-600">{formatPercent(result.municipalityRate)}</p>
            </div>
            <div className="bg-card rounded-xl border border-border p-4 shadow-soft">
              <p className="text-xs text-slate-500 mb-1">Fizetendő HIPA</p>
              <p className="text-lg font-bold text-rose-600">{formatHuf(result.taxAmount)}</p>
            </div>
          </div>

          {/* Breakdown */}
          <div className="bg-card rounded-xl border border-border shadow-soft overflow-hidden">
            <div className="px-5 py-3 border-b border-border flex items-center gap-2">
              <Calculator className="w-4 h-4 text-rose-600" />
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Levezetés</h3>
            </div>
            <div className="divide-y divide-border/50">
              <div className="flex justify-between px-5 py-3">
                <span className="text-sm text-slate-600">Nettó árbevétel</span>
                <span className="text-sm font-mono tabular-nums text-slate-700 dark:text-slate-300">{formatHuf(result.revenue)}</span>
              </div>
              {mode === 'simplified' && (
                <div className="flex justify-between px-5 py-3">
                  <span className="text-sm text-slate-600">Egyszerűsített adóalap-sáv</span>
                  <span className="text-sm font-mono tabular-nums font-semibold text-slate-900 dark:text-slate-100">{formatHuf(result.taxBase)}</span>
                </div>
              )}
              {mode === 'general' && (
                <>
                  {elab > 0 && <div className="flex justify-between px-5 py-3"><span className="text-sm text-slate-600">– ELAB</span><span className="text-sm font-mono text-red-500">– {formatHuf(elab)}</span></div>}
                  {intermediary > 0 && <div className="flex justify-between px-5 py-3"><span className="text-sm text-slate-600">– Közvetített szolg.</span><span className="text-sm font-mono text-red-500">– {formatHuf(intermediary)}</span></div>}
                  {material > 0 && <div className="flex justify-between px-5 py-3"><span className="text-sm text-slate-600">– Anyagköltség</span><span className="text-sm font-mono text-red-500">– {formatHuf(material)}</span></div>}
                  {subcontractor > 0 && <div className="flex justify-between px-5 py-3"><span className="text-sm text-slate-600">– Alvállalkozó</span><span className="text-sm font-mono text-red-500">– {formatHuf(subcontractor)}</span></div>}
                  <div className="flex justify-between px-5 py-3"><span className="text-sm font-semibold text-slate-900 dark:text-slate-100">Adóalap</span><span className="text-sm font-mono font-bold text-slate-900 dark:text-slate-100">{formatHuf(result.taxBase)}</span></div>
                </>
              )}
              <div className="flex justify-between px-5 py-3 bg-rose-50/50 dark:bg-rose-900/10">
                <span className="text-sm font-bold text-slate-900 dark:text-slate-100">Fizetendő HIPA ({formatPercent(result.municipalityRate)})</span>
                <span className="text-sm font-mono font-bold text-rose-600">{formatHuf(result.taxAmount)}</span>
              </div>
            </div>
          </div>

          {mode === 'simplified' && (
            <div className="bg-card rounded-xl border border-border shadow-soft p-5">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-3">Egyszerűsített adóalap-sávok</h3>
              <div className="space-y-2">
                {[
                  { min: 0, max: 12_000_000, base: 2_500_000, label: '0 – 12 M Ft' },
                  { min: 12_000_001, max: 18_000_000, base: 6_000_000, label: '12 – 18 M Ft' },
                  { min: 18_000_001, max: Infinity, base: 8_500_000, label: '18 M Ft felett' },
                ].map((sav, i) => {
                  const active = revenue >= sav.min && revenue <= sav.max;
                  return (
                    <div
                      key={i}
                      className={cn(
                        'flex items-center justify-between px-4 py-2.5 rounded-lg border transition-all',
                        active ? 'border-rose-300 bg-rose-50 dark:bg-rose-900/20' : 'border-border'
                      )}
                    >
                      <div>
                        <p className={cn('text-sm font-medium', active ? 'text-rose-700 dark:text-rose-400' : 'text-slate-600 dark:text-slate-400')}>{sav.label}</p>
                      </div>
                      <div className="text-right">
                        <p className={cn('text-sm font-bold font-mono', active ? 'text-rose-700' : 'text-slate-700 dark:text-slate-300')}>
                          {formatHuf(sav.base)}
                        </p>
                        {active && <p className="text-[10px] text-rose-500">← aktuális sáv</p>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-800 rounded-xl p-4 flex gap-3">
            <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
            <div className="text-xs text-blue-700 dark:text-blue-400 space-y-1">
              <p className="font-semibold">HIPA tudnivalók</p>
              <ul className="list-disc list-inside space-y-0.5 text-blue-600">
                <li>EV-k és szervezetek HIPA-köteles tevékenységet végeznek</li>
                <li>Egyszerűsített mód: sávos adóalap a nettó árbevétel alapján</li>
                <li>Általános mód: nettó árbevétel – ELAB – közvetített szolg. – anyag – alvállalkozó</li>
                <li>Önkormányzatonként eltérő kulcs (max. 2%)</li>
                <li>Bevallás: május 31. (adóévet követő) + előlegbevallás</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
