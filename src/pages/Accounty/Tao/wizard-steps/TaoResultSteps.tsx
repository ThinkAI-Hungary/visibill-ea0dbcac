import { CheckCircle, Send, Download, FileCheck, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { NumberInput, fmt } from '../taoWizardData';
import { toast } from '@/hooks/use-toast';
import type { TaoStepProps, TaoFormData, TaoComputed } from '../taoWizardTypes';

// ── Step 7: Módosított adóalap kiszámítása ──
export function RenderStep7({ computed }: TaoStepProps) {
  return (
    <div className="space-y-5">
      <div className="bg-gradient-to-r from-indigo-50 to-blue-50 dark:from-indigo-900/20 dark:to-blue-900/20 rounded-xl p-6 border border-indigo-200 dark:border-indigo-800">
        <p className="text-xs text-slate-500 mb-1">Módosított adóalap</p>
        <p className={cn('text-4xl font-black', computed.taxBase > 0 ? 'text-indigo-600' : 'text-slate-400')}>
          {fmt(computed.taxBase)} Ft
        </p>
      </div>
      <div className="space-y-2">
        {[
          { label: 'AEE', value: computed.aee, color: computed.aee >= 0 ? 'text-emerald-600' : 'text-rose-600' },
          { label: '+ 8.§ növelő tételek', value: computed.increasingTotal, color: 'text-rose-500' },
          { label: '− 7.§ csökkentő tételek', value: -computed.decreasingTotal, color: 'text-emerald-500' },
          { label: '+ Kamatkorlát korrekció', value: computed.interestAdjustment, color: 'text-amber-500' },
        ].map((row, i) => (
          <div key={i} className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50">
            <span className="text-sm text-slate-600 dark:text-slate-400">{row.label}</span>
            <span className={cn('text-sm font-bold font-mono', row.color)}>{fmt(row.value)} Ft</span>
          </div>
        ))}
        <div className="border-t border-border pt-2 mt-2">
          <div className="flex items-center justify-between py-2 px-3">
            <span className="text-sm font-bold text-slate-900 dark:text-slate-100">= Módosított adóalap</span>
            <span className="text-lg font-black text-indigo-600">{fmt(computed.modifiedTaxBase)} Ft</span>
          </div>
          {computed.modifiedTaxBase < 0 && (
            <div className="flex items-center justify-between py-2 px-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg">
              <span className="text-sm text-emerald-600">= Adóalap (min. 0)</span>
              <span className="text-lg font-black text-emerald-600">0 Ft</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Step 10: Fizetendő TAO összeg ──
export function RenderStep10({ data, computed, upd }: TaoStepProps) {
  return (
    <div className="space-y-5">
      <NumberInput label="Befizetett adóelőlegek" value={data.advance_payments} onChange={v => upd('advance_payments', v)} />
      <div className="space-y-3 bg-card rounded-xl border border-border p-5">
        {[
          { label: 'Adóalap', value: computed.taxBase },
          { label: '× 9% TAO kulcs', value: computed.calculatedTax },
          { label: '− Adókedvezmények', value: -computed.creditsTotal },
          { label: '− Felajánlások', value: -computed.effectiveDonations },
          { label: '− Adóelőlegek', value: -data.advance_payments },
        ].map((row, i) => (
          <div key={i} className="flex items-center justify-between py-1.5">
            <span className="text-sm text-slate-600 dark:text-slate-400">{row.label}</span>
            <span className="text-sm font-mono font-bold text-slate-700 dark:text-slate-300">{fmt(row.value)} Ft</span>
          </div>
        ))}
        <div className="border-t-2 border-emerald-300 pt-3 mt-3">
          <div className="flex items-center justify-between">
            <span className="text-base font-bold text-slate-900 dark:text-slate-100">= Fizetendő TAO</span>
            <span className={cn('text-2xl font-black', computed.payableTax > 0 ? 'text-emerald-600' : 'text-slate-400')}>
              {fmt(computed.payableTax)} Ft
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Step 11: Beküldés & Export ──
export function RenderStep11({
  data, computed, taxYear, clientName, filingGenerated, onGenerateFiling,
}: {
  data: TaoFormData;
  computed: TaoComputed;
  taxYear: number;
  clientName: string;
  filingGenerated: boolean;
  onGenerateFiling: () => void;
}) {
  const handlePdfExport = () => {
    const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>2929 TAO Bevallás - ${taxYear}</title>
<style>
  body{font-family:'Segoe UI',Arial,sans-serif;padding:40px;color:#1e293b;max-width:800px;margin:0 auto}
  h1{font-size:22px;border-bottom:3px solid #059669;padding-bottom:8px;color:#059669}
  h2{font-size:16px;margin-top:24px;color:#334155;border-bottom:1px solid #e2e8f0;padding-bottom:4px}
  .meta{background:#f8fafc;padding:12px;border-radius:8px;margin:12px 0;font-size:13px;border:1px solid #e2e8f0}
  table{width:100%;border-collapse:collapse;margin:8px 0}
  td,th{text-align:left;padding:6px 8px;font-size:13px}
  td:last-child{text-align:right;font-family:monospace;font-weight:bold}
  tr:nth-child(even){background:#f8fafc}
  .total{border-top:2px solid #059669;font-weight:bold;font-size:15px}
  .total td{padding-top:10px;color:#059669}
  .footer{margin-top:40px;font-size:11px;color:#94a3b8;border-top:1px solid #e2e8f0;padding-top:8px}
</style></head><body>
<h1>Társasági adó bevallás (2929) — ${taxYear}. adóév</h1>
<div class="meta">
  <strong>Adózó:</strong> ${clientName}<br>
  <strong>Adóév:</strong> ${taxYear}<br>
  <strong>Generálva:</strong> ${new Date().toLocaleDateString('hu-HU')} ${new Date().toLocaleTimeString('hu-HU')}
</div>
<h2>1. Eredménykimutatás</h2>
<table>
  <tr><td>Értékesítés nettó árbevétele</td><td>${fmt(data.revenue)} Ft</td></tr>
  <tr><td>Egyéb bevételek</td><td>${fmt(data.other_revenue)} Ft</td></tr>
  <tr><td>Anyagjellegű ráfordítások</td><td>${fmt(data.material_costs)} Ft</td></tr>
  <tr><td>Személyi jellegű ráfordítások</td><td>${fmt(data.personnel_costs)} Ft</td></tr>
  <tr><td>Értékcsökkenési leírás</td><td>${fmt(data.depreciation)} Ft</td></tr>
  <tr><td>Egyéb ráfordítások</td><td>${fmt(data.other_costs)} Ft</td></tr>
  <tr><td>Pénzügyi eredmény</td><td>${fmt(data.financial_result)} Ft</td></tr>
</table>
<h2>2. Adózás Előtti Eredmény (AEE)</h2>
<table><tr class="total"><td>AEE</td><td>${fmt(computed.aee)} Ft</td></tr></table>
<h2>3. Adóalap-korrekciók</h2>
<table>
  <tr><td>7.§ csökkentő tételek összesen</td><td>-${fmt(computed.decreasingTotal)} Ft</td></tr>
  <tr><td>8.§ növelő tételek összesen</td><td>+${fmt(computed.increasingTotal)} Ft</td></tr>
  <tr><td>Kamatkorlát korrekció</td><td>+${fmt(computed.interestAdjustment)} Ft</td></tr>
  <tr class="total"><td>Módosított adóalap</td><td>${fmt(computed.taxBase)} Ft</td></tr>
</table>
<h2>4. Adószámítás</h2>
<table>
  <tr><td>Adóalap</td><td>${fmt(computed.taxBase)} Ft</td></tr>
  <tr><td>TAO kulcs</td><td>9%</td></tr>
  <tr><td>Számított adó</td><td>${fmt(computed.calculatedTax)} Ft</td></tr>
  <tr><td>Adókedvezmények</td><td>-${fmt(computed.creditsTotal)} Ft</td></tr>
  <tr><td>Felajánlás</td><td>-${fmt(computed.effectiveDonations)} Ft</td></tr>
  <tr><td>Befizetett előlegek</td><td>-${fmt(data.advance_payments)} Ft</td></tr>
  <tr class="total"><td>Fizetendő TAO</td><td>${fmt(computed.payableTax)} Ft</td></tr>
</table>
<div class="footer">
  Generálva: eaisybooks TAO modul — ${new Date().toISOString()}<br>
  Ez a dokumentum nem helyettesíti a NAV felé benyújtandó hivatalos 29-es bevallást.
</div>
</body></html>`;
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const printWin = window.open(url, '_blank');
    if (printWin) {
      printWin.addEventListener('load', () => {
        setTimeout(() => printWin.print(), 300);
      });
    }
    toast({ title: 'PDF generálva', description: 'A nyomtatási ablakban válaszd a "Mentés PDF-ként" opciót.' });
  };

  const handleXmlExport = () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<bevallas xmlns="http://www.nav.gov.hu/2929" adoev="${taxYear}">
  <adozo>
    <nev>${clientName}</nev>
  </adozo>
  <eredmenykimutatas>
    <arbev>${data.revenue}</arbev>
    <egyeb_bev>${data.other_revenue}</egyeb_bev>
    <anyag_kts>${data.material_costs}</anyag_kts>
    <szemelyi_kts>${data.personnel_costs}</szemelyi_kts>
    <ecs>${data.depreciation}</ecs>
    <egyeb_kts>${data.other_costs}</egyeb_kts>
    <penzugyi>${data.financial_result}</penzugyi>
  </eredmenykimutatas>
  <adoalap>
    <aee>${computed.aee}</aee>
    <csokkentok>${computed.decreasingTotal}</csokkentok>
    <novelok>${computed.increasingTotal}</novelok>
    <kamatkorlat>${computed.interestAdjustment}</kamatkorlat>
    <modositott>${computed.modifiedTaxBase}</modositott>
    <adoalap>${computed.taxBase}</adoalap>
  </adoalap>
  <adoszamitas>
    <szamitott_ado>${computed.calculatedTax}</szamitott_ado>
    <kedvezmenyek>${computed.creditsTotal}</kedvezmenyek>
    <felajanlas>${computed.effectiveDonations}</felajanlas>
    <elolegek>${data.advance_payments}</elolegek>
    <fizetendo>${computed.payableTax}</fizetendo>
  </adoszamitas>
</bevallas>`;
    const blob = new Blob([xml], { type: 'application/xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `2929_TAO_${taxYear}_${clientName.replace(/\s+/g, '_')}.xml`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: 'XML letöltve', description: `2929_TAO_${taxYear}.xml — importálható az ÁNYK keretprogramba` });
  };

  return (
    <div className="space-y-5">
      <div className="bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 rounded-xl p-6 border border-emerald-200 dark:border-emerald-800 text-center">
        <CheckCircle className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
        <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-1">TAO Kalkuláció Kész</h3>
        <p className="text-sm text-slate-500">A {taxYear}. adóévi társasági adó kiszámítása befejeződött.</p>
        <p className="text-3xl font-black text-emerald-600 mt-4">{fmt(computed.payableTax)} Ft</p>
        <p className="text-xs text-slate-400 mt-1">fizetendő társasági adó</p>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-card rounded-lg border border-border p-3">
          <p className="text-[10px] text-slate-500">AEE</p>
          <p className="text-sm font-bold">{fmt(computed.aee)} Ft</p>
        </div>
        <div className="bg-card rounded-lg border border-border p-3">
          <p className="text-[10px] text-slate-500">Adóalap</p>
          <p className="text-sm font-bold">{fmt(computed.taxBase)} Ft</p>
        </div>
        <div className="bg-card rounded-lg border border-border p-3">
          <p className="text-[10px] text-slate-500">Számított adó</p>
          <p className="text-sm font-bold">{fmt(computed.calculatedTax)} Ft</p>
        </div>
        <div className="bg-card rounded-lg border border-border p-3">
          <p className="text-[10px] text-slate-500">Kedvezmények</p>
          <p className="text-sm font-bold text-blue-600">{fmt(computed.creditsTotal + computed.effectiveDonations)} Ft</p>
        </div>
      </div>

      {/* 29-es bevallás generálás */}
      {!filingGenerated ? (
        <Button onClick={onGenerateFiling} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white gap-2" size="lg">
          <Send className="w-4 h-4" /> 29-es bevallás generálása
        </Button>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center gap-2 p-4 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg border border-emerald-200 dark:border-emerald-800">
            <FileCheck className="w-5 h-5 text-emerald-600" />
            <div>
              <p className="text-sm font-bold text-emerald-700 dark:text-emerald-300">Bevallás generálva</p>
              <p className="text-xs text-slate-500">2929 TAO bevallás — {taxYear}. adóév</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Button variant="outline" className="gap-2" onClick={handlePdfExport}>
              <Download className="w-4 h-4" /> PDF letöltés
            </Button>
            <Button variant="outline" className="gap-2" onClick={handleXmlExport}>
              <FileText className="w-4 h-4" /> ÁNYK XML export
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
