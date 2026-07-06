import React, { useState, useEffect } from 'react';
import { X, Home, Store, Car, Box } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { CondoUnit } from '@/hooks/useEvData';

interface Props {
  open: boolean;
  onClose: () => void;
  onSave: (unit: Partial<CondoUnit>) => void;
  editUnit?: CondoUnit | null;
}

const UNIT_TYPES = [
  { value: 'lakas', label: 'Lakás', icon: Home },
  { value: 'uzlet', label: 'Üzlet', icon: Store },
  { value: 'garazs', label: 'Garázs', icon: Car },
  { value: 'egyeb', label: 'Egyéb', icon: Box },
] as const;

export default function CondoUnitModal({ open, onClose, onSave, editUnit }: Props) {
  const [form, setForm] = useState({
    unit_number: '',
    unit_type: 'lakas' as CondoUnit['unit_type'],
    area_sqm: '',
    ownership_share: '',
    owner_name: '',
    owner_contact: '',
    monthly_common_fee: '',
    notes: '',
  });

  useEffect(() => {
    if (editUnit) {
      setForm({
        unit_number: editUnit.unit_number,
        unit_type: editUnit.unit_type,
        area_sqm: editUnit.area_sqm?.toString() || '',
        ownership_share: editUnit.ownership_share?.toString() || '',
        owner_name: editUnit.owner_name,
        owner_contact: editUnit.owner_contact || '',
        monthly_common_fee: editUnit.monthly_common_fee.toString(),
        notes: editUnit.notes || '',
      });
    } else {
      setForm({
        unit_number: '', unit_type: 'lakas', area_sqm: '', ownership_share: '',
        owner_name: '', owner_contact: '', monthly_common_fee: '', notes: '',
      });
    }
  }, [editUnit, open]);

  if (!open) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      ...(editUnit ? { id: editUnit.id } : {}),
      unit_number: form.unit_number,
      unit_type: form.unit_type,
      area_sqm: form.area_sqm ? parseFloat(form.area_sqm) : null,
      ownership_share: form.ownership_share ? parseFloat(form.ownership_share) : null,
      owner_name: form.owner_name,
      owner_contact: form.owner_contact || null,
      monthly_common_fee: parseInt(form.monthly_common_fee) || 0,
      notes: form.notes || null,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <form
        onSubmit={handleSubmit}
        className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-lg mx-4 animate-in zoom-in-95 duration-200"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
            {editUnit ? 'Albetét szerkesztése' : 'Új albetét'}
          </h2>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4 max-h-[60vh] overflow-y-auto">
          {/* Unit type selector */}
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-2">Típus</label>
            <div className="grid grid-cols-4 gap-2">
              {UNIT_TYPES.map(t => {
                const Icon = t.icon;
                return (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => setForm(p => ({ ...p, unit_type: t.value }))}
                    className={cn(
                      'flex flex-col items-center gap-1 p-3 rounded-xl border text-xs font-medium transition-all',
                      form.unit_type === t.value
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border text-slate-500 hover:border-slate-400'
                    )}
                  >
                    <Icon className="w-4 h-4" />
                    {t.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Albetét szám *</label>
              <input
                required
                value={form.unit_number}
                onChange={e => setForm(p => ({ ...p, unit_number: e.target.value }))}
                placeholder="pl. A/1"
                className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-primary/30 focus:border-primary"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Terület (m²)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={form.area_sqm}
                onChange={e => setForm(p => ({ ...p, area_sqm: e.target.value }))}
                placeholder="pl. 65.5"
                className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-primary/30 focus:border-primary"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Tulajdonos neve *</label>
            <input
              required
              value={form.owner_name}
              onChange={e => setForm(p => ({ ...p, owner_name: e.target.value }))}
              placeholder="Kovács János"
              className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-primary/30 focus:border-primary"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Elérhetőség</label>
              <input
                value={form.owner_contact}
                onChange={e => setForm(p => ({ ...p, owner_contact: e.target.value }))}
                placeholder="Tel / email"
                className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-primary/30 focus:border-primary"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Tulajdoni hányad</label>
              <input
                type="number"
                step="0.0001"
                min="0"
                max="1"
                value={form.ownership_share}
                onChange={e => setForm(p => ({ ...p, ownership_share: e.target.value }))}
                placeholder="pl. 0.0312"
                className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-primary/30 focus:border-primary"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Havi közös költség (Ft) *</label>
            <input
              required
              type="number"
              min="0"
              value={form.monthly_common_fee}
              onChange={e => setForm(p => ({ ...p, monthly_common_fee: e.target.value }))}
              placeholder="pl. 45000"
              className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-primary/30 focus:border-primary"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Megjegyzés</label>
            <textarea
              rows={2}
              value={form.notes}
              onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
              className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-primary/30 focus:border-primary resize-none"
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-border">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors">
            Mégse
          </button>
          <button type="submit" className="px-4 py-2 text-sm font-medium bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors">
            {editUnit ? 'Mentés' : 'Hozzáadás'}
          </button>
        </div>
      </form>
    </div>
  );
}
