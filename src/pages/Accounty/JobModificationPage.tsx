import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft, RefreshCw, Calendar, Clock, CheckCircle, ArrowRight, ArrowDown,
  FileText, Save, AlertTriangle, User, Briefcase
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type ChangeType = 'worktime' | 'feor' | 'salary' | 'position' | 'site' | 'costcenter';

interface ModificationData {
  changeType: ChangeType;
  effectiveDate: string;
  oldWorkHours: string;
  newWorkHours: string;
  oldFeor: string;
  newFeor: string;
  oldSalary: string;
  newSalary: string;
  oldPosition: string;
  newPosition: string;
  reason: string;
  generate08E: boolean;
}

const CHANGE_TYPES: { value: ChangeType; label: string; deadline: string; icon: React.ElementType }[] = [
  { value: 'worktime', label: 'Munkaidő módosítás', deadline: '15 napon belül be kell jelenteni (08E)', icon: Clock },
  { value: 'feor', label: 'FEOR-kód változás', deadline: '15 napon belül be kell jelenteni (08E)', icon: Briefcase },
  { value: 'salary', label: 'Bérváltozás', deadline: 'Nem kell bejelenteni a NAV felé', icon: ArrowDown },
  { value: 'position', label: 'Munkakör változás', deadline: 'Nem kell bejelenteni a NAV felé', icon: User },
  { value: 'site', label: 'Telephely változás', deadline: 'Nem kell bejelenteni a NAV felé', icon: ArrowRight },
  { value: 'costcenter', label: 'Költséghely változás', deadline: 'Nem kell bejelenteni a NAV felé', icon: ArrowRight },
];

// Mock employee
const MOCK_EMP = {
  name: 'Nagy Anna',
  tajNumber: '123 456 789',
  jobCode: '1101',
  feor: '2411',
  position: 'Pénzügyi elemző',
  weeklyHours: 40,
  baseSalary: 450000,
  startDate: '2024-01-02',
  site: 'Központi iroda',
  costCenter: 'CC-200 Könyvelés',
};

export default function JobModificationPage() {
  const { id, empId } = useParams<{ id: string; empId: string }>();
  const [data, setData] = useState<ModificationData>({
    changeType: 'worktime',
    effectiveDate: new Date().toISOString().split('T')[0],
    oldWorkHours: String(MOCK_EMP.weeklyHours),
    newWorkHours: '',
    oldFeor: MOCK_EMP.feor,
    newFeor: '',
    oldSalary: String(MOCK_EMP.baseSalary),
    newSalary: '',
    oldPosition: MOCK_EMP.position,
    newPosition: '',
    reason: '',
    generate08E: true,
  });
  const [saved, setSaved] = useState(false);

  const update = (patch: Partial<ModificationData>) => setData(d => ({ ...d, ...patch }));
  const needs08E = data.changeType === 'worktime' || data.changeType === 'feor';
  const selectedType = CHANGE_TYPES.find(t => t.value === data.changeType)!;

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const renderDiffField = (label: string, oldVal: string, newVal: string, formatter?: (v: string) => string) => {
    const fmt = formatter || ((v: string) => v);
    return (
      <div className="space-y-2">
        <label className="text-xs text-slate-500 font-medium">{label}</label>
        <div className="grid grid-cols-[1fr,auto,1fr] gap-3 items-center">
          <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-lg px-3 py-2 text-sm text-red-700 dark:text-red-300 line-through">
            {fmt(oldVal) || '—'}
          </div>
          <ArrowRight className="w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={newVal}
            onChange={e => {
              const key = label.includes('Munkaidő') ? 'newWorkHours' :
                         label.includes('FEOR') ? 'newFeor' :
                         label.includes('Bér') || label.includes('Alapbér') ? 'newSalary' :
                         'newPosition';
              update({ [key]: e.target.value });
            }}
            className="px-3 py-2 rounded-lg border-2 border-emerald-300 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/10 text-sm text-emerald-700 dark:text-emerald-300 font-medium focus:ring-2 focus:ring-emerald-500 outline-none"
            placeholder="Új érték"
          />
        </div>
      </div>
    );
  };

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link to={`/accounty/payroll/${id}/employees/${empId || ''}`} className="p-2 rounded-lg hover:bg-muted transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="p-2.5 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl shadow-lg shadow-violet-500/25">
          <RefreshCw className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Jogviszony módosítás</h1>
          <p className="text-sm text-slate-500">{MOCK_EMP.name} — TAJ: {MOCK_EMP.tajNumber}</p>
        </div>
      </div>

      {/* Change type selector */}
      <div className="bg-card rounded-xl border border-border p-6 space-y-4">
        <h2 className="text-sm font-bold text-slate-700 dark:text-slate-300">Változás típusa</h2>
        <div className="grid grid-cols-3 gap-2">
          {CHANGE_TYPES.map(ct => (
            <button
              key={ct.value}
              onClick={() => update({ changeType: ct.value })}
              className={cn(
                'p-3 rounded-xl border-2 text-left transition-all',
                data.changeType === ct.value
                  ? 'border-violet-500 bg-violet-50 dark:bg-violet-500/10'
                  : 'border-border hover:border-violet-300'
              )}
            >
              <ct.icon className="w-4 h-4 mb-1 text-violet-600" />
              <p className="text-xs font-bold">{ct.label}</p>
              <p className="text-[10px] text-slate-400 mt-0.5">{ct.deadline}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Effective date */}
      <div className="bg-card rounded-xl border border-border p-6 space-y-4">
        <h2 className="text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2">
          <Calendar className="w-4 h-4" /> Hatálybalépés dátuma
        </h2>
        <input
          type="date"
          value={data.effectiveDate}
          onChange={e => update({ effectiveDate: e.target.value })}
          className="px-3 py-2 rounded-lg border border-border bg-background text-sm focus:ring-2 focus:ring-violet-500 outline-none"
        />
        {needs08E && (
          <div className="bg-yellow-50 dark:bg-yellow-500/10 border border-yellow-200 dark:border-yellow-500/20 rounded-lg p-3 text-sm text-yellow-800 dark:text-yellow-300 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
            <div>
              <strong>NAV bejelentési kötelezettség!</strong>
              <p className="text-xs mt-0.5">A {selectedType.label.toLowerCase()} 15 napon belül (legkésőbb {
                new Date(new Date(data.effectiveDate).getTime() + 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
              }-ig) be kell jelenteni a NAV felé 08E biztosítotti bejelentéssel.</p>
            </div>
          </div>
        )}
      </div>

      {/* Diff view */}
      <div className="bg-card rounded-xl border border-border p-6 space-y-5">
        <h2 className="text-sm font-bold text-slate-700 dark:text-slate-300">Változás részletei — két oszlopos összehasonlítás</h2>
        
        {data.changeType === 'worktime' && renderDiffField('Heti munkaidő (óra)', data.oldWorkHours, data.newWorkHours)}
        {data.changeType === 'feor' && renderDiffField('FEOR-kód', data.oldFeor, data.newFeor)}
        {data.changeType === 'salary' && renderDiffField('Alapbér (Ft)', data.oldSalary, data.newSalary, v => Number(v).toLocaleString('hu-HU') + ' Ft')}
        {data.changeType === 'position' && renderDiffField('Munkakör', data.oldPosition, data.newPosition)}
        {(data.changeType === 'site' || data.changeType === 'costcenter') && renderDiffField(
          data.changeType === 'site' ? 'Telephely' : 'Költséghely',
          data.changeType === 'site' ? MOCK_EMP.site : MOCK_EMP.costCenter,
          data.newPosition
        )}

        <div>
          <label className="text-xs text-slate-500 mb-1 block">Megjegyzés / Indoklás</label>
          <textarea
            value={data.reason}
            onChange={e => update({ reason: e.target.value })}
            rows={3}
            className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:ring-2 focus:ring-violet-500 outline-none resize-none"
            placeholder="Pl. Előléptetés, szervezeti változás, stb."
          />
        </div>
      </div>

      {/* 08E toggle */}
      {needs08E && (
        <div className="bg-card rounded-xl border border-border p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <FileText className="w-5 h-5 text-blue-500" />
            <div>
              <p className="text-sm font-bold">08E bejelentés automatikus generálása</p>
              <p className="text-xs text-slate-500">A módosítás mentésekor automatikusan bekerül a bevallási sorba</p>
            </div>
          </div>
          <button
            onClick={() => update({ generate08E: !data.generate08E })}
            className={cn(
              'relative w-12 h-6 rounded-full transition-colors',
              data.generate08E ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'
            )}
          >
            <div className={cn(
              'absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform',
              data.generate08E ? 'translate-x-6' : 'translate-x-0.5'
            )} />
          </button>
        </div>
      )}

      {/* Actions */}
      <div className="flex justify-end gap-3">
        <Button variant="outline" asChild>
          <Link to={`/accounty/payroll/${id}/employees/${empId || ''}`}>Mégse</Link>
        </Button>
        <Button onClick={handleSave} className="gap-1.5 bg-violet-600 hover:bg-violet-700">
          <Save className="w-4 h-4" />
          {saved ? 'Mentve ✓' : 'Módosítás mentése'}
        </Button>
      </div>
    </div>
  );
}
