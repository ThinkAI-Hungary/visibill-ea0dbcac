import React, { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Calendar, Info, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

export default function TaoBusinessYearPage() {
  const { companyId, dateRange } = useParams<{ companyId: string; dateRange: string }>();
  const id = companyId;
  const [yearType, setYearType] = useState<'calendar' | 'custom'>('calendar');
  const [closingMonth, setClosingMonth] = useState(12);
  const [closingDay, setClosingDay] = useState(31);

  // Derived deadlines
  const filingDeadline = yearType === 'calendar'
    ? 'Tárgyévet követő május 31.'
    : `Fordulónap + 5 hónap`;
  const formCode = yearType === 'calendar' ? '2529 / 2629' : '2529EUD';

  return (
    <div className="w-full space-y-6 animate-in fade-in duration-500 max-w-3xl">
      <div className="flex items-center gap-3">
        <Link to={`/eaisybooks/${id}/${dateRange}/tao`} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
          <ArrowLeft className="w-4 h-4 text-slate-400" />
        </Link>
        <div className="p-2.5 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-xl shadow-lg shadow-cyan-500/25">
          <Calendar className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Üzleti Év Beállítások</h1>
          <p className="text-sm text-slate-500">Fordulónap és bevallási határidők (spec 2.5)</p>
        </div>
      </div>

      <div className="bg-card rounded-xl border border-border p-6 shadow-soft space-y-5">
        <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">Üzleti év típusa</h2>
        <div className="flex gap-4">
          {(['calendar', 'custom'] as const).map(type => (
            <label key={type} className={cn(
              'flex-1 p-4 rounded-xl border-2 cursor-pointer transition-all',
              yearType === type ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/30'
            )}>
              <input type="radio" checked={yearType === type} onChange={() => setYearType(type)} className="sr-only" />
              <p className="text-sm font-bold text-slate-900 dark:text-slate-100">
                {type === 'calendar' ? 'Naptári év' : 'Eltérő üzleti év'}
              </p>
              <p className="text-xs text-slate-500 mt-1">
                {type === 'calendar' ? 'Jan. 1. – Dec. 31.' : 'Egyedi fordulónap'}
              </p>
            </label>
          ))}
        </div>

        {yearType === 'custom' && (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1 block">Fordulónap — hónap</label>
              <select value={closingMonth} onChange={e => setClosingMonth(Number(e.target.value))} className="w-full text-sm border border-border rounded-lg px-3 py-2 bg-background text-foreground">
                {Array.from({ length: 12 }, (_, i) => (
                  <option key={i + 1} value={i + 1}>{new Date(2026, i, 1).toLocaleDateString('hu-HU', { month: 'long' })}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1 block">Fordulónap — nap</label>
              <Input type="number" min={1} max={31} value={closingDay} onChange={e => setClosingDay(Number(e.target.value))} className="bg-background" />
            </div>
          </div>
        )}
      </div>

      {/* Derived values */}
      <div className="bg-card rounded-xl border border-border p-6 shadow-soft space-y-3">
        <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">Származtatott határidők</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
            <p className="text-xs text-slate-500">Bevallási határidő</p>
            <p className="text-sm font-bold text-slate-900 dark:text-slate-100 mt-1">{filingDeadline}</p>
          </div>
          <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
            <p className="text-xs text-slate-500">Bevallás formakód</p>
            <p className="text-sm font-bold font-mono text-slate-900 dark:text-slate-100 mt-1">{formCode}</p>
          </div>
          <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
            <p className="text-xs text-slate-500">Beszámoló közzététel</p>
            <p className="text-sm font-bold text-slate-900 dark:text-slate-100 mt-1">Fordulónap + 5 hó</p>
          </div>
        </div>
        <div className="flex items-start gap-2 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
          <Info className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
          <p className="text-xs text-blue-700 dark:text-blue-300">
            Munkaszüneti napra eső határidő → következő munkanap (Air. 52.§)
          </p>
        </div>
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
