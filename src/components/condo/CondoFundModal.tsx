import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { CondoFund } from '@/hooks/useEvData';

interface Props {
  open: boolean;
  onClose: () => void;
  onSave: (fund: Partial<CondoFund>) => void;
  editFund?: CondoFund | null;
}

const FUND_TYPES = [
  { value: 'uzemeltetesi', label: 'Üzemeltetési alap', color: 'bg-blue-500' },
  { value: 'felujitasi', label: 'Felújítási alap', color: 'bg-amber-500' },
  { value: 'tartalek', label: 'Tartalék alap', color: 'bg-emerald-500' },
  { value: 'egyeb', label: 'Egyéb alap', color: 'bg-slate-500' },
] as const;

export default function CondoFundModal({ open, onClose, onSave, editFund }: Props) {
  const [form, setForm] = useState({
    fund_name: '',
    fund_type: 'uzemeltetesi' as CondoFund['fund_type'],
    current_balance: '',
    target_balance: '',
    monthly_contribution: '',
    description: '',
  });

  useEffect(() => {
    if (editFund) {
      setForm({
        fund_name: editFund.fund_name,
        fund_type: editFund.fund_type,
        current_balance: editFund.current_balance.toString(),
        target_balance: editFund.target_balance.toString(),
        monthly_contribution: editFund.monthly_contribution.toString(),
        description: editFund.description || '',
      });
    } else {
      setForm({
        fund_name: '', fund_type: 'uzemeltetesi', current_balance: '',
        target_balance: '', monthly_contribution: '', description: '',
      });
    }
  }, [editFund, open]);

  if (!open) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const selectedType = FUND_TYPES.find(t => t.value === form.fund_type);
    onSave({
      ...(editFund ? { id: editFund.id } : {}),
      fund_name: form.fund_name || selectedType?.label || 'Alap',
      fund_type: form.fund_type,
      current_balance: parseInt(form.current_balance) || 0,
      target_balance: parseInt(form.target_balance) || 0,
      monthly_contribution: parseInt(form.monthly_contribution) || 0,
      description: form.description || null,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <form
        onSubmit={handleSubmit}
        className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-md mx-4 animate-in zoom-in-95 duration-200"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
            {editFund ? 'Alap szerkesztése' : 'Új pénzalap'}
          </h2>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-2">Alap típusa</label>
            <div className="grid grid-cols-2 gap-2">
              {FUND_TYPES.map(t => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setForm(p => ({ ...p, fund_type: t.value, fund_name: p.fund_name || t.label }))}
                  className={cn(
                    'flex items-center gap-2 p-2.5 rounded-xl border text-xs font-medium transition-all',
                    form.fund_type === t.value
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border text-slate-500 hover:border-slate-400'
                  )}
                >
                  <span className={cn('w-2.5 h-2.5 rounded-full', t.color)} />
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Alap neve</label>
            <input
              value={form.fund_name}
              onChange={e => setForm(p => ({ ...p, fund_name: e.target.value }))}
              placeholder="pl. Felújítási alap"
              className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-primary/30 focus:border-primary"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Aktuális egyenleg (Ft)</label>
              <input
                type="number"
                min="0"
                value={form.current_balance}
                onChange={e => setForm(p => ({ ...p, current_balance: e.target.value }))}
                placeholder="0"
                className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-primary/30 focus:border-primary"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Cél egyenleg (Ft)</label>
              <input
                type="number"
                min="0"
                value={form.target_balance}
                onChange={e => setForm(p => ({ ...p, target_balance: e.target.value }))}
                placeholder="0"
                className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-primary/30 focus:border-primary"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Havi hozzájárulás / lakás (Ft)</label>
            <input
              type="number"
              min="0"
              value={form.monthly_contribution}
              onChange={e => setForm(p => ({ ...p, monthly_contribution: e.target.value }))}
              placeholder="0"
              className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-primary/30 focus:border-primary"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Leírás</label>
            <textarea
              rows={2}
              value={form.description}
              onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
              className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-primary/30 focus:border-primary resize-none"
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-border">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors">
            Mégse
          </button>
          <button type="submit" className="px-4 py-2 text-sm font-medium bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors">
            {editFund ? 'Mentés' : 'Hozzáadás'}
          </button>
        </div>
      </form>
    </div>
  );
}
