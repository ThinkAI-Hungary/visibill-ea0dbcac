import React from 'react';
import { Check, Download, ExternalLink, BarChart2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { exportReceiptPdf } from '@/lib/exportPdf';

interface IntegrationStepProps {
  integrationType: 'rlb' | 'novitax' | 'other' | null;
  setIntegrationType: (v: 'rlb' | 'novitax' | 'other' | null) => void;
  handleNext: () => void;
}

export default function IntegrationStep({ integrationType, setIntegrationType, handleNext }: IntegrationStepProps) {
  return (
    <div className="animate-in fade-in slide-in-from-right-8 duration-500">
      <div className="text-center mb-8">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Könyvelőprogram integráció</h1>
        <p className="text-slate-500 dark:text-slate-400 mt-1">Automatizáld az adatátvitelt a könyvelőprogramod és a Visibill között</p>
      </div>

      <div className="bg-card rounded-xl p-6 border border-border shadow-soft mb-6">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">Milyen könyvelőprogramot használsz?</h2>
        
        <div className="grid grid-cols-3 gap-4">
          {/* RLB Option */}
          <button 
            onClick={() => setIntegrationType('rlb')}
            className={cn("p-4 rounded-xl border-2 text-left transition-all", integrationType === 'rlb' ? "border-slate-900 dark:border-primary bg-slate-50 dark:bg-accent" : "border-border hover:border-slate-200")}
          >
            <div className="w-10 h-10 mb-3 bg-card border border-border rounded flex items-center justify-center shadow-soft">
              <BarChart2 className="w-6 h-6 text-primary" />
            </div>
            <h3 className="font-semibold text-slate-900 dark:text-slate-100">RLB</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-tight">RLB könyvelőprogram integráció RPA-val</p>
            {integrationType === 'rlb' && <div className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-slate-900 dark:text-slate-100"><Check className="w-3.5 h-3.5" /> Kiválasztva</div>}
          </button>

          {/* Novitax Option */}
          <button 
            onClick={() => setIntegrationType('novitax')}
            className={cn("p-4 rounded-xl border-2 text-left transition-all", integrationType === 'novitax' ? "border-slate-900 dark:border-primary bg-slate-50 dark:bg-accent" : "border-border hover:border-slate-200")}
          >
            <div className="w-10 h-10 mb-3 bg-card border border-border rounded flex items-center justify-center shadow-soft">
              <div className="text-red-500 font-bold text-lg"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/></svg></div>
            </div>
            <h3 className="font-semibold text-slate-900 dark:text-slate-100">Novitax</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-tight">Novitax könyvelőprogram integráció</p>
            {integrationType === 'novitax' && <div className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-slate-900 dark:text-slate-100"><Check className="w-3.5 h-3.5" /> Kiválasztva</div>}
          </button>

          {/* Other Option */}
          <button 
            onClick={() => setIntegrationType('other')}
            className={cn("p-4 rounded-xl border-2 text-left transition-all", integrationType === 'other' ? "border-slate-900 dark:border-primary bg-slate-50 dark:bg-accent" : "border-border hover:border-slate-200")}
          >
            <div className="w-10 h-10 mb-3 bg-card border border-border rounded flex items-center justify-center shadow-soft">
              <div className="w-6 h-5 bg-amber-400 rounded-sm relative"><div className="absolute top-0 right-0 w-2 h-2 bg-amber-300 rounded-bl-sm"></div></div>
            </div>
            <h3 className="font-semibold text-slate-900 dark:text-slate-100">Egyéb / Nincs</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-tight">Manuális exportálás CSV/Excel formátumban</p>
            {integrationType === 'other' && <div className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-slate-900 dark:text-slate-100"><Check className="w-3.5 h-3.5" /> Kiválasztva</div>}
          </button>
        </div>
      </div>

      {/* Dynamic Content based on selection */}
      {integrationType === 'rlb' && (
        <div className="bg-card rounded-xl p-6 border border-border shadow-soft animate-in fade-in slide-in-from-top-4 duration-300">
          <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">RLB integráció beállítása</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 mb-6">Kövesd az alábbi lépéseket az integráció beállításához</p>
          
          <div className="space-y-4 mb-8">
            {[
              'Telepítsd a Visibill RPA ügynököt a gépedre',
              'Indítsd el az ügynököt és jelentkezz be a Visibill fiókoddal',
              'Válaszd ki a RLB programot és add meg a bejelentkezési adatokat',
              'Teszteld a kapcsolatot és mentsd el a beállításokat',
            ].map((text, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 flex items-center justify-center text-xs font-semibold">{i + 1}</div>
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{text}</span>
              </div>
            ))}
          </div>

          <div className="flex gap-3">
            <Button variant="outline" className="gap-2 text-slate-600 dark:text-slate-400" onClick={() => {
              exportReceiptPdf('rlb_integracis_utmutato', {
                title: 'RLB Integrációs Útmutató',
                fields: [
                  { label: '1. lépés', value: 'Telepítsd a Visibill RPA ügynököt' },
                  { label: '2. lépés', value: 'Indítsd el és jelentkezz be' },
                  { label: '3. lépés', value: 'Válaszd ki az RLB programot' },
                  { label: '4. lépés', value: 'Teszteld a kapcsolatot' },
                ],
              });
            }}>
              <Download className="w-4 h-4" /> Részletes útmutató letöltése
            </Button>
            <Button variant="outline" className="gap-2 text-slate-600 dark:text-slate-400">
              <ExternalLink className="w-4 h-4" /> RPA Agent letöltése
            </Button>
          </div>
        </div>
      )}

      {integrationType === 'novitax' && (
        <div className="bg-card rounded-xl p-6 border border-border shadow-soft animate-in fade-in slide-in-from-top-4 duration-300">
          <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Novitax integráció</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 mb-6">A Novitax integráció hamarosan elérhető. Értesítünk, amint kész!</p>
          
          <div className="bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 rounded-lg p-4 text-sm text-amber-800 dark:text-amber-300">
            A Novitax integrációhoz szükséges API kapcsolat fejlesztés alatt áll. Addig is használhatod a manuális CSV/Excel exportot.
          </div>
        </div>
      )}

      {integrationType === 'other' && (
        <div className="bg-card rounded-xl p-6 border border-border shadow-soft animate-in fade-in slide-in-from-top-4 duration-300">
          <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Manuális exportálás</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 mb-6">Az adatokat CSV vagy Excel formátumban exportálhatod bármikor a portfólió nézetből</p>
          
          <div className="bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 rounded-lg p-4 text-sm text-blue-800 dark:text-blue-300">
            Bármikor hozzáadhatsz könyvelőprogram integrációt a Beállításokban.
          </div>
        </div>
      )}

      <div className="flex justify-end pt-6">
        <Button onClick={handleNext} disabled={!integrationType} className="bg-primary hover:bg-primary/90 text-primary-foreground px-8">
          Befejezés
        </Button>
      </div>
    </div>
  );
}
