import React, { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, BookOpen, Info, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export default function TaoAccountingRegimePage() {
  const { id } = useParams<{ id: string }>();
  const [regime, setRegime] = useState<'szt' | 'ifrs'>('szt');

  return (
    <div className="w-full space-y-6 animate-in fade-in duration-500 max-w-3xl">
      <div className="flex items-center gap-3">
        <Link to={`/accounty/client/${id}/tao`} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
          <ArrowLeft className="w-4 h-4 text-slate-400" />
        </Link>
        <div className="p-2.5 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl shadow-lg shadow-indigo-500/25">
          <BookOpen className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Beszámolási Rezsim</h1>
          <p className="text-sm text-slate-500">Szt. vs. IFRS (spec 2.6)</p>
        </div>
      </div>

      <div className="bg-card rounded-xl border border-border p-6 shadow-soft space-y-5">
        <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">Rezsim választó</h2>
        <div className="flex gap-4">
          {([
            { value: 'szt' as const, label: 'Magyar Számviteli tv. (Szt.)', desc: 'Alapértelmezett — magyar számviteli standardok' },
            { value: 'ifrs' as const, label: 'IFRS', desc: 'Nemzetközi pénzügyi beszámolási standardok' },
          ]).map(opt => (
            <label key={opt.value} className={cn(
              'flex-1 p-5 rounded-xl border-2 cursor-pointer transition-all',
              regime === opt.value ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/30'
            )}>
              <input type="radio" checked={regime === opt.value} onChange={() => setRegime(opt.value)} className="sr-only" />
              <p className="text-sm font-bold text-slate-900 dark:text-slate-100">{opt.label}</p>
              <p className="text-xs text-slate-500 mt-1">{opt.desc}</p>
            </label>
          ))}
        </div>
      </div>

      {regime === 'ifrs' && (
        <div className="bg-card rounded-xl border border-border p-6 shadow-soft space-y-4">
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">IFRS-specifikus tételek</h2>
          <div className="space-y-3">
            {[
              { label: 'Tao tv. 18/A.§ és V/A fejezet hatálya', checked: true },
              { label: 'Halasztott adó (2023-tól választható az Szt.-ben is)', checked: false },
              { label: 'IFRS-átállási korrekciók', checked: false },
            ].map(item => (
              <label key={item.label} className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" defaultChecked={item.checked} className="rounded border-border" />
                <span className="text-sm text-slate-700 dark:text-slate-300">{item.label}</span>
              </label>
            ))}
          </div>
          <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
            <Info className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
            <p className="text-xs text-amber-700 dark:text-amber-300">
              Az IFRS-rezsim növeli a Pillar Two szempontjából a halasztott adó relevanciáját — a felhasznált halasztott adó növeli a lefedett adókat.
            </p>
          </div>
        </div>
      )}

      <div className="flex justify-end gap-3">
        <Button variant="outline">Mégse</Button>
        <Button className="bg-emerald-600 hover:bg-emerald-700 text-white">
          <Save className="w-4 h-4 mr-2" /> Mentés
        </Button>
      </div>
    </div>
  );
}
