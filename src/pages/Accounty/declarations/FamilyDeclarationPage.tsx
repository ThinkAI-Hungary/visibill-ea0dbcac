import React, { useState } from 'react';
import { useParams, Link, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft, Users, Save, Calculator, Plus, Trash2, Info, CheckCircle, AlertTriangle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface Child {
  id: string;
  name: string;
  birthDate: string;
  taxId: string;
  disabled: boolean;
}

const TAX_PARAMS_2026 = {
  child1: { base: 133340, saving: 20000 },
  child2: { base: 266660, saving: 40000 },
  child3plus: { base: 440000, saving: 66000 },
};

export default function FamilyDeclarationPage() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const empId = searchParams.get('empId');
  const [children, setChildren] = useState<Child[]>([
    { id: '1', name: '', birthDate: '', taxId: '', disabled: false },
  ]);
  const [declarantName, setDeclarantName] = useState('');
  const [declarantTaxId, setDeclarantTaxId] = useState('');
  const [spouseShares, setSpouseShares] = useState(false);
  const [spouseSharePercent, setSpouseSharePercent] = useState('50');
  const [effectiveFrom, setEffectiveFrom] = useState(new Date().toISOString().split('T')[0]);
  const [saved, setSaved] = useState(false);

  const addChild = () => setChildren(prev => [...prev, { id: String(Date.now()), name: '', birthDate: '', taxId: '', disabled: false }]);
  const removeChild = (childId: string) => setChildren(prev => prev.filter(c => c.id !== childId));
  const updateChild = (childId: string, patch: Partial<Child>) => setChildren(prev => prev.map(c => c.id === childId ? { ...c, ...patch } : c));

  const validChildren = children.filter(c => c.name && c.birthDate);
  const childCount = validChildren.length;

  // Calculate savings
  const perChildBase = childCount === 1 ? TAX_PARAMS_2026.child1.base :
                       childCount === 2 ? TAX_PARAMS_2026.child2.base :
                       childCount >= 3 ? TAX_PARAMS_2026.child3plus.base : 0;
  const perChildSaving = childCount === 1 ? TAX_PARAMS_2026.child1.saving :
                         childCount === 2 ? TAX_PARAMS_2026.child2.saving :
                         childCount >= 3 ? TAX_PARAMS_2026.child3plus.saving : 0;
  const totalBase = perChildBase * childCount;
  const totalSaving = perChildSaving * childCount;
  const effectiveShare = spouseShares ? Number(spouseSharePercent) / 100 : 1;
  const actualSaving = Math.round(totalSaving * effectiveShare);

  const handleSave = () => { setSaved(true); setTimeout(() => setSaved(false), 3000); };

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link to={`/accounty/payroll/${id}/declarations`} className="p-2 rounded-lg hover:bg-muted transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="p-2.5 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl shadow-lg shadow-blue-500/25">
          <Users className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Családi kedvezmény nyilatkozat</h1>
          <p className="text-sm text-slate-500">Szja tv. 29/A-29/B. § — 2026-os értékek (megduplázva)</p>
        </div>
      </div>

      {/* Info banner */}
      <div className="bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 rounded-xl p-4 text-sm text-blue-800 dark:text-blue-300 flex items-start gap-2">
        <Info className="w-4 h-4 mt-0.5 shrink-0" />
        <div>
          <strong>2026-os változás:</strong> A családi kedvezmény összege megduplázódott az előző évhez képest.
          1 gyermek: 133 340 Ft, 2 gyermek: 266 660 Ft/gyermek, 3+ gyermek: 440 000 Ft/gyermek adóalap-csökkentés.
        </div>
      </div>

      {/* Declarant data */}
      <div className="bg-card rounded-xl border border-border p-6 space-y-4">
        <h2 className="text-sm font-bold text-slate-700 dark:text-slate-300">Nyilatkozó adatai</h2>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="text-xs text-slate-500 mb-1 block">Nyilatkozó neve</label>
            <input type="text" value={declarantName} onChange={e => setDeclarantName(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:ring-2 focus:ring-blue-500 outline-none" placeholder="Kovács Péter" />
          </div>
          <div>
            <label className="text-xs text-slate-500 mb-1 block">Adóazonosító jel</label>
            <input type="text" value={declarantTaxId} onChange={e => setDeclarantTaxId(e.target.value)} maxLength={10} className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm font-mono focus:ring-2 focus:ring-blue-500 outline-none" placeholder="1234567890" />
          </div>
          <div>
            <label className="text-xs text-slate-500 mb-1 block">Érvényesség kezdete</label>
            <input type="date" value={effectiveFrom} onChange={e => setEffectiveFrom(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
          </div>
        </div>
      </div>

      {/* Children */}
      <div className="bg-card rounded-xl border border-border p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-700 dark:text-slate-300">Eltartottak adatai</h2>
          <Button variant="outline" size="sm" onClick={addChild} className="gap-1 text-xs">
            <Plus className="w-3 h-3" /> Gyermek hozzáadása
          </Button>
        </div>
        <div className="space-y-3">
          {children.map((child, i) => (
            <div key={child.id} className="grid grid-cols-[auto,1fr,1fr,1fr,auto,auto] gap-3 items-end p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
              <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-500/20 flex items-center justify-center text-xs font-bold text-blue-700 dark:text-blue-400">{i + 1}</div>
              <div>
                <label className="text-[10px] text-slate-400 mb-1 block">Gyermek neve</label>
                <input type="text" value={child.name} onChange={e => updateChild(child.id, { name: e.target.value })} className="w-full px-2 py-1.5 rounded border border-border bg-background text-sm focus:ring-2 focus:ring-blue-500 outline-none" placeholder="Kis Anna" />
              </div>
              <div>
                <label className="text-[10px] text-slate-400 mb-1 block">Születési dátum</label>
                <input type="date" value={child.birthDate} onChange={e => updateChild(child.id, { birthDate: e.target.value })} className="w-full px-2 py-1.5 rounded border border-border bg-background text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
              </div>
              <div>
                <label className="text-[10px] text-slate-400 mb-1 block">Adóazonosító (ha van)</label>
                <input type="text" value={child.taxId} onChange={e => updateChild(child.id, { taxId: e.target.value })} className="w-full px-2 py-1.5 rounded border border-border bg-background text-sm font-mono focus:ring-2 focus:ring-blue-500 outline-none" placeholder="opcionális" />
              </div>
              <label className="flex items-center gap-1 text-xs cursor-pointer pb-1">
                <input type="checkbox" checked={child.disabled} onChange={e => updateChild(child.id, { disabled: e.target.checked })} className="rounded" />
                Fogy.
              </label>
              {children.length > 1 && (
                <Button variant="ghost" size="sm" onClick={() => removeChild(child.id)} className="h-7 w-7 p-0 text-red-400"><Trash2 className="w-3 h-3" /></Button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Spouse sharing */}
      <div className="bg-card rounded-xl border border-border p-6 space-y-4">
        <h2 className="text-sm font-bold text-slate-700 dark:text-slate-300">Megosztás házastárssal</h2>
        <div className="flex items-center gap-4">
          <button
            onClick={() => setSpouseShares(!spouseShares)}
            className={cn(
              'relative w-12 h-6 rounded-full transition-colors',
              spouseShares ? 'bg-blue-500' : 'bg-slate-300 dark:bg-slate-600'
            )}
          >
            <div className={cn('absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform', spouseShares ? 'translate-x-6' : 'translate-x-0.5')} />
          </button>
          <span className="text-sm">Kedvezmény megosztása a házastárssal</span>
        </div>
        {spouseShares && (
          <div className="flex items-center gap-4 pl-16">
            <label className="text-xs text-slate-500">Saját rész aránya:</label>
            <select value={spouseSharePercent} onChange={e => setSpouseSharePercent(e.target.value)} className="px-3 py-1.5 rounded border border-border bg-background text-sm">
              <option value="100">100% (teljes)</option>
              <option value="50">50% (fele-fele)</option>
              <option value="0">0% (teljes átadás)</option>
            </select>
          </div>
        )}
      </div>

      {/* Calculation preview */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-500/10 dark:to-indigo-500/10 rounded-xl border border-blue-200 dark:border-blue-500/20 p-6 space-y-3">
        <h3 className="text-sm font-bold text-blue-800 dark:text-blue-300 flex items-center gap-2">
          <Calculator className="w-4 h-4" /> Kedvezmény kalkuláció
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-white dark:bg-slate-900 rounded-lg p-3 text-center">
            <p className="text-2xl font-bold text-blue-600">{childCount}</p>
            <p className="text-[10px] text-slate-500 uppercase font-bold">Eltartott</p>
          </div>
          <div className="bg-white dark:bg-slate-900 rounded-lg p-3 text-center">
            <p className="text-lg font-bold font-mono">{perChildBase.toLocaleString('hu-HU')}</p>
            <p className="text-[10px] text-slate-500 uppercase font-bold">Ft/gyermek/hó alap</p>
          </div>
          <div className="bg-white dark:bg-slate-900 rounded-lg p-3 text-center">
            <p className="text-lg font-bold font-mono text-emerald-600">{actualSaving.toLocaleString('hu-HU')}</p>
            <p className="text-[10px] text-slate-500 uppercase font-bold">Ft/hó megtakarítás</p>
          </div>
          <div className="bg-white dark:bg-slate-900 rounded-lg p-3 text-center">
            <p className="text-lg font-bold font-mono text-indigo-600">{(actualSaving * 12).toLocaleString('hu-HU')}</p>
            <p className="text-[10px] text-slate-500 uppercase font-bold">Ft/év megtakarítás</p>
          </div>
        </div>
        {childCount === 0 && (
          <p className="text-xs text-yellow-600 flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> Legalább 1 eltartott adatainak kitöltése szükséges</p>
        )}
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-3">
        <Button variant="outline" asChild><Link to={`/accounty/payroll/${id}/declarations`}>Mégse</Link></Button>
        <Button onClick={handleSave} className="gap-1.5 bg-blue-600 hover:bg-blue-700" disabled={childCount === 0}>
          <Save className="w-4 h-4" /> {saved ? 'Mentve ✓' : 'Nyilatkozat mentése'}
        </Button>
      </div>
    </div>
  );
}
