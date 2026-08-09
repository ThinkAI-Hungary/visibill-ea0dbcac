import React, { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Clock, Calendar, Info, Save, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

export default function TaoLifecyclePage() {
  const { companyId, dateRange } = useParams<{ companyId: string; dateRange: string }>();
  const id = companyId;
  const [registrationDate, setRegistrationDate] = useState('2020-03-15');
  const [incorporationDate, setIncorporationDate] = useState('2020-05-01');
  const [terminationType, setTerminationType] = useState('');

  return (
    <div className="w-full space-y-6 animate-in fade-in duration-500 max-w-4xl">
      <div className="flex items-center gap-3">
        <Link to={`/accounty/${id}/${dateRange}/tao`} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
          <ArrowLeft className="w-4 h-4 text-slate-400" />
        </Link>
        <div className="p-2.5 bg-gradient-to-br from-purple-500 to-violet-600 rounded-xl shadow-lg shadow-purple-500/25">
          <Clock className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Adóalanyiság Életciklusa</h1>
          <p className="text-sm text-slate-500">Keletkezés, megszűnés, áttéréskori korrekciók</p>
        </div>
      </div>

      {/* Keletkezés */}
      <div className="bg-card rounded-xl border border-border p-6 shadow-soft space-y-4">
        <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">Keletkezés</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-medium text-slate-500 mb-1 block">Bejegyzési kérelem napja</label>
            <Input type="date" value={registrationDate} onChange={e => setRegistrationDate(e.target.value)} className="bg-background" />
            <p className="text-[10px] text-slate-400 mt-1">Előtársaság-időszak kezdete</p>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500 mb-1 block">Cégbejegyzés napja</label>
            <Input type="date" value={incorporationDate} onChange={e => setIncorporationDate(e.target.value)} className="bg-background" />
          </div>
        </div>
        <div className="flex items-start gap-2 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
          <Info className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
          <p className="text-xs text-blue-700 dark:text-blue-300">
            Előtársaság bevallási határidő: cégbejegyzést követő 3. hó utolsó napja
          </p>
        </div>
      </div>

      {/* Megszűnés */}
      <div className="bg-card rounded-xl border border-border p-6 shadow-soft space-y-4">
        <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">Megszűnés</h2>
        <div>
          <label className="text-xs font-medium text-slate-500 mb-1 block">Megszűnés típusa</label>
          <select
            value={terminationType}
            onChange={e => setTerminationType(e.target.value)}
            className="w-full text-sm border border-border rounded-lg px-3 py-2 bg-background text-foreground max-w-md"
          >
            <option value="">— Nincs megszűnés —</option>
            <option value="without_successor">Jogutód nélkül</option>
            <option value="with_successor">Jogutód mellett</option>
            <option value="kiva">KIVA-választás (Katv. 16.§)</option>
          </select>
        </div>
        {terminationType && (
          <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
            <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
            <p className="text-xs text-amber-700 dark:text-amber-300">
              Záró bevallási kötelezettség az Art. szerint. {terminationType === 'kiva' && 'KIVA  TAO áttéréskori korrekciók szükségesek.'}
            </p>
          </div>
        )}
      </div>

      {/* Áttéréskori korrekciók */}
      <div className="bg-card rounded-xl border border-border p-6 shadow-soft space-y-4">
        <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">Áttéréskori korrekciók</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {[
            { label: 'KIVA  TAO', desc: 'Áttérési különbözet', link: '#' },
            { label: 'IFRS áttérés', desc: 'Tao tv. 18/A.§', link: '#' },
            { label: 'Pénznem-váltás', desc: 'Könyvvezetés pénzneme', link: '#' },
          ].map(item => (
            <div key={item.label} className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700">
              <p className="text-sm font-bold text-slate-900 dark:text-slate-100">{item.label}</p>
              <p className="text-xs text-slate-500 mt-1">{item.desc}</p>
            </div>
          ))}
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
