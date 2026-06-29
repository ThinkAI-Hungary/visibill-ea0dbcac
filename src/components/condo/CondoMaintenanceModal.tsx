import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { CondoMaintenance } from '@/hooks/useEvData';

interface Props {
  open: boolean;
  onClose: () => void;
  onSave: (item: Partial<CondoMaintenance>) => void;
  editItem?: CondoMaintenance | null;
}

const CATEGORIES = [
  { value: 'altalanos', label: 'Általános' },
  { value: 'epuletgepeszet', label: 'Épületgépészet' },
  { value: 'felujitas', label: 'Felújítás' },
  { value: 'biztonsag', label: 'Biztonság' },
  { value: 'kozterulet', label: 'Közterület' },
] as const;

const PRIORITIES = [
  { value: 'low', label: 'Alacsony', color: 'text-slate-500' },
  { value: 'normal', label: 'Normál', color: 'text-blue-500' },
  { value: 'high', label: 'Magas', color: 'text-amber-500' },
  { value: 'urgent', label: 'Sürgős', color: 'text-red-500' },
] as const;

const STATUSES = [
  { value: 'planned', label: 'Tervezett' },
  { value: 'in_progress', label: 'Folyamatban' },
  { value: 'completed', label: 'Befejezett' },
  { value: 'cancelled', label: 'Törölve' },
] as const;

export default function CondoMaintenanceModal({ open, onClose, onSave, editItem }: Props) {
  const [form, setForm] = useState({
    title: '',
    description: '',
    category: 'altalanos' as CondoMaintenance['category'],
    status: 'planned' as CondoMaintenance['status'],
    priority: 'normal' as CondoMaintenance['priority'],
    estimated_cost: '',
    actual_cost: '',
    vendor_name: '',
    planned_date: '',
    completed_date: '',
    fund_type: 'felujitasi',
    notes: '',
  });

  useEffect(() => {
    if (editItem) {
      setForm({
        title: editItem.title,
        description: editItem.description || '',
        category: editItem.category,
        status: editItem.status,
        priority: editItem.priority,
        estimated_cost: editItem.estimated_cost.toString(),
        actual_cost: editItem.actual_cost.toString(),
        vendor_name: editItem.vendor_name || '',
        planned_date: editItem.planned_date || '',
        completed_date: editItem.completed_date || '',
        fund_type: editItem.fund_type || 'felujitasi',
        notes: editItem.notes || '',
      });
    } else {
      setForm({
        title: '', description: '', category: 'altalanos', status: 'planned',
        priority: 'normal', estimated_cost: '', actual_cost: '', vendor_name: '',
        planned_date: '', completed_date: '', fund_type: 'felujitasi', notes: '',
      });
    }
  }, [editItem, open]);

  if (!open) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      ...(editItem ? { id: editItem.id } : {}),
      title: form.title,
      description: form.description || null,
      category: form.category,
      status: form.status,
      priority: form.priority,
      estimated_cost: parseInt(form.estimated_cost) || 0,
      actual_cost: parseInt(form.actual_cost) || 0,
      vendor_name: form.vendor_name || null,
      planned_date: form.planned_date || null,
      completed_date: form.completed_date || null,
      fund_type: form.fund_type,
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
            {editItem ? 'Feladat szerkesztése' : 'Új karbantartási feladat'}
          </h2>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4 max-h-[60vh] overflow-y-auto">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Feladat neve *</label>
            <input
              required
              value={form.title}
              onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
              placeholder="pl. Lépcsőházi festés"
              className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-primary/30 focus:border-primary"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Kategória</label>
              <select
                value={form.category}
                onChange={e => setForm(p => ({ ...p, category: e.target.value as any }))}
                className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background text-slate-900 dark:text-slate-100"
              >
                {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Prioritás</label>
              <select
                value={form.priority}
                onChange={e => setForm(p => ({ ...p, priority: e.target.value as any }))}
                className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background text-slate-900 dark:text-slate-100"
              >
                {PRIORITIES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Státusz</label>
              <select
                value={form.status}
                onChange={e => setForm(p => ({ ...p, status: e.target.value as any }))}
                className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background text-slate-900 dark:text-slate-100"
              >
                {STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Finanszírozás</label>
              <select
                value={form.fund_type}
                onChange={e => setForm(p => ({ ...p, fund_type: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background text-slate-900 dark:text-slate-100"
              >
                <option value="uzemeltetesi">Üzemeltetési alap</option>
                <option value="felujitasi">Felújítási alap</option>
                <option value="tartalek">Tartalék alap</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Becsült költség (Ft)</label>
              <input
                type="number"
                min="0"
                value={form.estimated_cost}
                onChange={e => setForm(p => ({ ...p, estimated_cost: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-primary/30 focus:border-primary"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Tényleges költség (Ft)</label>
              <input
                type="number"
                min="0"
                value={form.actual_cost}
                onChange={e => setForm(p => ({ ...p, actual_cost: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-primary/30 focus:border-primary"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Kivitelező</label>
            <input
              value={form.vendor_name}
              onChange={e => setForm(p => ({ ...p, vendor_name: e.target.value }))}
              placeholder="pl. ÉpKer Kft."
              className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-primary/30 focus:border-primary"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Tervezett dátum</label>
              <input
                type="date"
                value={form.planned_date}
                onChange={e => setForm(p => ({ ...p, planned_date: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background text-slate-900 dark:text-slate-100"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Befejezés dátuma</label>
              <input
                type="date"
                value={form.completed_date}
                onChange={e => setForm(p => ({ ...p, completed_date: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background text-slate-900 dark:text-slate-100"
              />
            </div>
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
            {editItem ? 'Mentés' : 'Hozzáadás'}
          </button>
        </div>
      </form>
    </div>
  );
}
