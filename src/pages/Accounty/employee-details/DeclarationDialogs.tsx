import React, { useState } from 'react';
import { Check, X, Edit3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  useAddDeclaration, useUpdateDeclaration,
  type PayrollDeclaration
} from '@/hooks/usePayrollData';

export const DECLARATION_TYPES = [
  { value: 'family', label: 'Családi kedvezmény' },
  { value: 'first_marriage', label: 'Első házasok kedvezménye' },
  { value: 'young_25', label: '25 év alattiak SZJA mentessége' },
  { value: 'young_mother_30', label: '30 év alatti anyák kedvezménye' },
  { value: 'netak', label: 'Négy vagy több gyermekes anyák (NÉTAK)' },
  { value: 'anyak_3', label: '3 gyermekes anyák kedvezménye' },
  { value: 'anyak_2', label: '2 gyermekes anyák kedvezménye (40 év alatt)' },
  { value: 'anyacska', label: 'Összevont anyák + családi (2026)' },
  { value: 'personal', label: 'Személyi kedvezmény (fogyatékosság)' },
  { value: 'ekho', label: 'EKHO nyilatkozat' },
] as const;

const selectClassName = "w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none transition-all appearance-none bg-[length:16px_16px] bg-[right_10px_center] bg-no-repeat";
const selectStyle = { backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")` };

// ── New Declaration Dialog ──

export function NewDeclarationDialog({ employeeId, onClose }: { employeeId: string; onClose: () => void }) {
  const addDeclaration = useAddDeclaration();
  const [type, setType] = useState('family');
  const [validFrom, setValidFrom] = useState(new Date().toISOString().split('T')[0]);
  const [validUntil, setValidUntil] = useState('');
  const [childrenCount, setChildrenCount] = useState(1);

  const handleSubmit = () => {
    const params: Record<string, unknown> = {};
    if (type === 'family') {
      params.children_count = childrenCount;
    }

    addDeclaration.mutate({
      employee_id: employeeId,
      declaration_type: type,
      valid_from: validFrom,
      valid_until: validUntil || undefined,
      parameters: params,
    }, {
      onSuccess: () => onClose(),
    });
  };

  return (
    <div className="mb-6 p-5 rounded-xl border-2 border-primary/30 bg-primary/5 dark:bg-primary/10 space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">Új adóelőleg-nyilatkozat</h4>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
          <X className="w-4 h-4" />
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="md:col-span-2">
          <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">Nyilatkozat típusa</label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            className={selectClassName}
            style={selectStyle}
          >
            {DECLARATION_TYPES.map((dt) => (
              <option key={dt.value} value={dt.value}>{dt.label}</option>
            ))}
          </select>
        </div>

        {type === 'family' && (
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">Eltartottak száma</label>
            <select
              value={childrenCount}
              onChange={(e) => setChildrenCount(Number(e.target.value))}
              className={selectClassName}
              style={selectStyle}
            >
              {[1, 2, 3, 4, 5, 6, 7, 8].map(n => (
                <option key={n} value={n}>{n} gyermek</option>
              ))}
            </select>
          </div>
        )}

        <div>
          <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">Érvényes ettől</label>
          <input
            type="date"
            value={validFrom}
            onChange={(e) => setValidFrom(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none transition-all"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">Érvényes eddig (opcionális)</label>
          <input
            type="date"
            value={validUntil}
            onChange={(e) => setValidUntil(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none transition-all"
          />
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button variant="ghost" size="sm" onClick={onClose}>
          Mégse
        </Button>
        <Button
          size="sm"
          onClick={handleSubmit}
          disabled={addDeclaration.isPending || !validFrom}
          className="flex items-center gap-1"
        >
          <Check className="w-3 h-3" />
          {addDeclaration.isPending ? 'Mentés...' : 'Mentés'}
        </Button>
      </div>
    </div>
  );
}

// ── Edit Declaration Dialog ──

export function EditDeclarationDialog({
  declaration,
  employeeId,
  onClose,
}: {
  declaration: PayrollDeclaration;
  employeeId: string;
  onClose: () => void;
}) {
  const updateDeclaration = useUpdateDeclaration();
  const [type] = useState(declaration.declaration_type);
  const [validFrom, setValidFrom] = useState(declaration.valid_from);
  const [validUntil, setValidUntil] = useState(declaration.valid_until || '');
  const [childrenCount, setChildrenCount] = useState(
    (declaration.parameters as any)?.children_count || 1
  );

  const handleSubmit = () => {
    const params: Record<string, unknown> = { ...(declaration.parameters as Record<string, unknown>) };
    if (type === 'family') {
      params.children_count = childrenCount;
    }

    updateDeclaration.mutate({
      id: declaration.id,
      employee_id: employeeId,
      declaration_type: type,
      valid_from: validFrom,
      valid_until: validUntil || null,
      parameters: params,
    }, {
      onSuccess: () => onClose(),
    });
  };

  return (
    <div className="mb-6 p-5 rounded-xl border-2 border-amber-500/30 bg-amber-500/5 dark:bg-amber-500/10 space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
          <Edit3 className="w-4 h-4 text-amber-500" />
          Nyilatkozat szerkesztése
        </h4>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
          <X className="w-4 h-4" />
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="md:col-span-2">
          <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">Nyilatkozat típusa</label>
          <div className="w-full px-3 py-2 rounded-lg border border-border bg-slate-100 dark:bg-slate-800 text-sm text-slate-600 dark:text-slate-300 cursor-not-allowed">
            {DECLARATION_TYPES.find(t => t.value === type)?.label || type}
          </div>
        </div>

        {type === 'family' && (
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">Eltartottak száma</label>
            <select value={childrenCount} onChange={(e) => setChildrenCount(Number(e.target.value))} className={selectClassName} style={selectStyle}>
              {[1, 2, 3, 4, 5, 6, 7, 8].map(n => (
                <option key={n} value={n}>{n} gyermek</option>
              ))}
            </select>
          </div>
        )}

        <div>
          <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">Érvényes ettől</label>
          <input
            type="date"
            value={validFrom}
            onChange={(e) => setValidFrom(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none transition-all"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">Érvényes eddig (opcionális)</label>
          <input
            type="date"
            value={validUntil}
            onChange={(e) => setValidUntil(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none transition-all"
          />
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button variant="ghost" size="sm" onClick={onClose}>
          Mégse
        </Button>
        <Button
          size="sm"
          onClick={handleSubmit}
          disabled={updateDeclaration.isPending || !validFrom}
          className="flex items-center gap-1 bg-amber-600 hover:bg-amber-700"
        >
          <Check className="w-3 h-3" />
          {updateDeclaration.isPending ? 'Mentés...' : 'Módosítás mentése'}
        </Button>
      </div>
    </div>
  );
}
