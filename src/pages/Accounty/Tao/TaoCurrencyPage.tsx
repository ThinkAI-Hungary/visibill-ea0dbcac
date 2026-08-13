import React, { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Banknote, Info, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

export default function TaoCurrencyPage() {
  const { companyId, dateRange } = useParams<{ companyId: string; dateRange: string }>();
  const id = companyId;
  const [currency, setCurrency] = useState<'HUF' | 'USD' | 'EUR'>('HUF');
  const [accountNumber, setAccountNumber] = useState('');

  return (
    <div className="w-full space-y-6 animate-in fade-in duration-500 max-w-3xl">
      <div className="flex items-center gap-3">
        <Link to={`/eaisybooks/${id}/${dateRange}/tao`} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
          <ArrowLeft className="w-4 h-4 text-slate-400" />
        </Link>
        <div className="p-2.5 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl shadow-lg shadow-green-500/25">
          <Banknote className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Devizában Fizetés</h1>
          <p className="text-sm text-slate-500">TAO USD/EUR-ben fizetésének választása (spec 2.7)</p>
        </div>
      </div>

      <div className="bg-card rounded-xl border border-border p-6 shadow-soft space-y-5">
        <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">Pénznem választó</h2>
        <div className="flex gap-4">
          {(['HUF', 'USD', 'EUR'] as const).map(c => (
            <label key={c} className={cn(
              'flex-1 p-5 rounded-xl border-2 cursor-pointer transition-all text-center',
              currency === c ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/30'
            )}>
              <input type="radio" checked={currency === c} onChange={() => setCurrency(c)} className="sr-only" />
              <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{c}</p>
              <p className="text-xs text-slate-500 mt-1">
                {c === 'HUF' ? 'Alapértelmezett' : 'Deviza fizetés'}
              </p>
            </label>
          ))}
        </div>

        {currency !== 'HUF' && (
          <div className="space-y-4 mt-4">
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1 block">Kincstári deviza-számlaszám</label>
              <Input value={accountNumber} onChange={e => setAccountNumber(e.target.value)} className="bg-background font-mono" placeholder="Bankszámlaszám" />
            </div>
            <div className="flex items-start gap-2 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
              <Info className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
              <p className="text-xs text-blue-700 dark:text-blue-300">
                A választás bejelentése: T201T nyomtatványon. A deviza-fizetés az Art. szabályai szerint történik.
              </p>
            </div>
          </div>
        )}
      </div>

      <div className="flex justify-end gap-3">
        <Button variant="outline">Mégse</Button>
        <Button className="bg-emerald-600 hover:bg-emerald-700 text-white">
          <Save className="w-4 h-4 mr-2" /> Mentés
        </Button>
      </div>
    </div>
  );
}
