import React, { useState, useCallback, useMemo } from 'react';
import {
  Plus, Save, X, ArrowUpRight, ArrowDownRight,
  HelpCircle, AlertCircle, ChevronDown, Info
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { formatHuf } from '@/lib/evCalculations';
import type { EvTaxpayerForm, EvVatStatus } from '@/hooks/useEvData';

// ─── Types ──────────────────────────────────────────────────────────────────

export type EntryDirection = 'bevetel' | 'kiadas';

export interface CashbookEntryFormData {
  entryDate: string;
  documentNumber: string;
  description: string;
  direction: EntryDirection;
  category: string;
  amount: number;
  vatAmount: number;
}

export interface CashbookEntryFormProps {
  onSave: (data: CashbookEntryFormData) => void;
  onCancel: () => void;
  nextSerialNumber: number;
  /** Taxpayer form affects which categories are available */
  taxpayerForm?: EvTaxpayerForm;
  /** VAT status controls whether VAT fields are editable */
  vatStatus?: EvVatStatus;
}

// ─── Category tree (Szja tv. 5. sz. melléklet) ─────────────────────────────

export interface CategoryNode {
  key: string;
  label: string;
  color: string;
  direction: EntryDirection;
  description?: string;
  children?: CategoryNode[];
}

export const CASHBOOK_CATEGORIES: CategoryNode[] = [
  {
    key: 'bevetel',
    label: 'Bevételek',
    color: 'text-green-600',
    direction: 'bevetel',
    children: [
      { key: 'bevetel_adokoteles', label: 'I. Adóköteles bevétel', color: 'text-green-600', direction: 'bevetel', description: 'Tevékenységből származó bevétel' },
      { key: 'bevetel_fizetendo_afa', label: 'II. Fizetendő ÁFA', color: 'text-teal-600', direction: 'bevetel', description: 'Áthárított ÁFA' },
      { key: 'bevetel_be_nem_szamito', label: 'III. Be nem számító bevétel', color: 'text-slate-500', direction: 'bevetel', description: 'Adóalapba be nem számító jövedelem (pl. alanyi mentes ÁFA)' },
    ],
  },
  {
    key: 'kiadas',
    label: 'Kiadások',
    color: 'text-red-600',
    direction: 'kiadas',
    children: [
      { key: 'kiadas_anyag_arubeszerzes', label: 'IV. Anyag- és árubeszerzés', color: 'text-red-600', direction: 'kiadas', description: 'Eladott áruk beszerzési értéke, anyagköltség' },
      { key: 'kiadas_kozvetitett_szolgaltatas', label: 'V. Közvetített szolgáltatás', color: 'text-orange-600', direction: 'kiadas', description: 'Alvállalkozói díjak, közvetített szolgáltatások' },
      { key: 'kiadas_alkalmazott_ber_kozteher', label: 'VI. Alkalmazottak bére és közterhei', color: 'text-violet-600', direction: 'kiadas', description: 'Bér, járulékok, szocho' },
      { key: 'kiadas_vallalkozoi_kivet', label: 'VII. Vállalkozói kivét', color: 'text-purple-600', direction: 'kiadas', description: 'Vállalkozó saját juttatása' },
      { key: 'kiadas_egyeb_koltseg', label: 'VIII. Egyéb költség', color: 'text-amber-600', direction: 'kiadas', description: 'Irodaszer, hosting, közüzem, stb.' },
      { key: 'kiadas_beruhazasi_koltseg', label: 'IX. Beruházási költség', color: 'text-rose-600', direction: 'kiadas', description: 'Tárgyi eszköz beszerzése (100e Ft felett)' },
      { key: 'kiadas_levonhato_afa', label: 'X. Levonható ÁFA', color: 'text-cyan-600', direction: 'kiadas', description: 'Beszerzésekre eső levonható ÁFA' },
      { key: 'kiadas_egyeb_nem_koltseg', label: 'XI. Egyéb, költségként nem figyelembe vehető', color: 'text-slate-400', direction: 'kiadas', description: 'Nem elszámolható kiadások' },
    ],
  },
];

const FLAT_CATEGORIES = CASHBOOK_CATEGORIES.flatMap(g => g.children || []);

// ─── VAT rates ──────────────────────────────────────────────────────────────

const VAT_RATES = [
  { value: 0, label: 'ÁFA mentes / Alanyi' },
  { value: 0.05, label: '5%' },
  { value: 0.18, label: '18%' },
  { value: 0.27, label: '27%' },
];

// ─── KATA allowed categories (simplified) ───────────────────────────────────

const KATA_ALLOWED_CATEGORIES = new Set([
  'bevetel_adokoteles',
  'bevetel_be_nem_szamito',
  'kiadas_vallalkozoi_kivet',
]);

// ─── Component ──────────────────────────────────────────────────────────────

export default function CashbookEntryForm({
  onSave, onCancel, nextSerialNumber, taxpayerForm, vatStatus,
}: CashbookEntryFormProps) {
  const [form, setForm] = useState<CashbookEntryFormData>({
    entryDate: new Date().toISOString().split('T')[0],
    documentNumber: '',
    description: '',
    direction: 'bevetel',
    category: '',
    amount: 0,
    vatAmount: 0,
  });

  const [vatRate, setVatRate] = useState(0);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showCategoryHelp, setShowCategoryHelp] = useState(false);

  // ─── Tax-form-aware category filtering ──────────────────────────────────
  const isAtalany = taxpayerForm === 'atalany';
  const isKata = taxpayerForm === 'kata';
  const isAlanyiMentes = vatStatus === 'alanyi_mentes';

  const availableCategories = useMemo(() => {
    let cats = FLAT_CATEGORIES.filter(c => c.direction === form.direction);

    // Átalányadó: kiadási oldalon nincs költségkimutatás (Szja tv. 50-56. §)
    if (isAtalany && form.direction === 'kiadas') {
      cats = [];
    }

    // KATA: csak bevétel + kivét (KATA tv. 7-8. §)
    if (isKata) {
      cats = cats.filter(c => KATA_ALLOWED_CATEGORIES.has(c.key));
    }

    return cats;
  }, [form.direction, isAtalany, isKata]);

  const handleAmountChange = useCallback((amount: number) => {
    const vat = vatRate > 0 ? Math.round(amount * vatRate / (1 + vatRate)) : 0;
    setForm(f => ({ ...f, amount, vatAmount: vat }));
  }, [vatRate]);

  const handleVatRateChange = useCallback((rate: number) => {
    setVatRate(rate);
    const vat = rate > 0 ? Math.round(form.amount * rate / (1 + rate)) : 0;
    setForm(f => ({ ...f, vatAmount: vat }));
  }, [form.amount]);

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (!form.entryDate) errs.entryDate = 'Dátum kötelező';
    if (!form.documentNumber.trim()) errs.documentNumber = 'Bizonylat szám kötelező';
    if (!form.description.trim()) errs.description = 'Megnevezés kötelező';
    if (!form.category) errs.category = 'Kategória kötelező';
    if (form.amount <= 0) errs.amount = 'Összeg pozitív kell legyen';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = () => {
    if (validate()) {
      onSave(form);
    }
  };

  return (
    <div className="bg-card rounded-xl border-2 border-indigo-200 dark:border-indigo-800 shadow-lg shadow-indigo-500/5 p-6 space-y-5 animate-in slide-in-from-top-2 duration-300">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg flex items-center justify-center">
            <Plus className="w-4 h-4 text-indigo-600" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              Új pénztárkönyv tétel
            </h3>
            <p className="text-[10px] text-slate-400">Sorszám: #{nextSerialNumber}</p>
          </div>
        </div>
        <button
          onClick={onCancel}
          className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-slate-400 hover:text-slate-600"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Tax-form info banners */}
      {isAtalany && (
        <div className="flex items-start gap-2.5 p-3 rounded-lg bg-indigo-50 dark:bg-indigo-900/15 border border-indigo-100 dark:border-indigo-800">
          <Info className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5" />
          <div className="text-xs text-indigo-700 dark:text-indigo-400">
            <p className="font-semibold">Átalányadózó mód</p>
            <p className="mt-0.5">Csak bevételek rögzíthetők — a költségeket a költséghányad automatikusan számolja (Szja tv. 50–56. §).</p>
          </div>
        </div>
      )}

      {isKata && (
        <div className="flex items-start gap-2.5 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/15 border border-amber-100 dark:border-amber-800">
          <Info className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
          <div className="text-xs text-amber-700 dark:text-amber-400">
            <p className="font-semibold">KATA üzemmód</p>
            <p className="mt-0.5">Egyszerűsített kategóriák: bevétel és vállalkozói kivét (KATA tv. 7–8. §).</p>
          </div>
        </div>
      )}

      {/* Direction toggle */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setForm(f => ({ ...f, direction: 'bevetel', category: '' }))}
          className={cn(
            'flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-all border-2',
            form.direction === 'bevetel'
              ? 'bg-green-50 dark:bg-green-900/20 border-green-500 text-green-700 dark:text-green-400 shadow-sm'
              : 'bg-card border-border text-slate-400 hover:border-green-300'
          )}
        >
          <ArrowUpRight className="w-4 h-4" /> Bevétel
        </button>
        {/* Átalányadó: kiadás gomb tiltva */}
        <button
          onClick={() => !isAtalany && setForm(f => ({ ...f, direction: 'kiadas', category: '' }))}
          disabled={isAtalany}
          className={cn(
            'flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-all border-2',
            isAtalany
              ? 'bg-slate-50 dark:bg-slate-800/30 border-border text-slate-300 dark:text-slate-600 cursor-not-allowed'
              : form.direction === 'kiadas'
                ? 'bg-red-50 dark:bg-red-900/20 border-red-500 text-red-700 dark:text-red-400 shadow-sm'
                : 'bg-card border-border text-slate-400 hover:border-red-300'
          )}
        >
          <ArrowDownRight className="w-4 h-4" /> Kiadás
          {isAtalany && <span className="text-[9px] ml-1 opacity-60">(nem elérhető)</span>}
        </button>
      </div>

      {/* Form fields */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">Dátum *</label>
          <Input
            type="date"
            value={form.entryDate}
            onChange={e => setForm(f => ({ ...f, entryDate: e.target.value }))}
            className={cn('bg-card', errors.entryDate && 'border-red-500')}
          />
          {errors.entryDate && <p className="text-[10px] text-red-500">{errors.entryDate}</p>}
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">Bizonylat szám *</label>
          <Input
            value={form.documentNumber}
            onChange={e => setForm(f => ({ ...f, documentNumber: e.target.value }))}
            placeholder={`SZ-2026-${String(nextSerialNumber).padStart(3, '0')}`}
            className={cn('bg-card', errors.documentNumber && 'border-red-500')}
          />
          {errors.documentNumber && <p className="text-[10px] text-red-500">{errors.documentNumber}</p>}
        </div>
        <div className="sm:col-span-2 space-y-1.5">
          <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">Megnevezés *</label>
          <Input
            value={form.description}
            onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
            placeholder="Tétel leírása..."
            className={cn('bg-card', errors.description && 'border-red-500')}
          />
          {errors.description && <p className="text-[10px] text-red-500">{errors.description}</p>}
        </div>
      </div>

      {/* Category */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">
            Pénztárkönyv-oszlop (kategória) *
          </label>
          <button
            onClick={() => setShowCategoryHelp(!showCategoryHelp)}
            className="text-[10px] text-indigo-500 hover:text-indigo-600 flex items-center gap-0.5"
          >
            <HelpCircle className="w-3 h-3" /> Kategória segéd
          </button>
        </div>

        {showCategoryHelp && (
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3 text-xs text-blue-600 dark:text-blue-400 animate-in fade-in duration-200">
            <p className="font-bold mb-1">Döntési fa:</p>
            <ul className="space-y-0.5 list-disc list-inside">
              <li>Számla ellenérték → <strong>I. Adóköteles bevétel</strong></li>
              <li>ÁFA tartalom → <strong>II. Fizetendő ÁFA</strong></li>
              <li>Anyag/áru vásárlás → <strong>IV. Anyag/árubeszerzés</strong></li>
              <li>Alvállalkozó → <strong>V. Közvetített szolgáltatás</strong></li>
              <li>Alkalmazott → <strong>VI. Bér és közteher</strong></li>
              <li>Saját juttatás → <strong>VII. Vállalkozói kivét</strong></li>
              <li>100e Ft feletti eszköz → <strong>IX. Beruházás</strong></li>
              <li>Minden más üzleti kiadás → <strong>VIII. Egyéb költség</strong></li>
            </ul>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {availableCategories.map(cat => (
            <button
              key={cat.key}
              onClick={() => setForm(f => ({ ...f, category: cat.key }))}
              className={cn(
                'flex items-start gap-3 p-3 rounded-lg border-2 text-left transition-all',
                form.category === cat.key
                  ? cn('border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 ring-1 ring-indigo-500/20')
                  : 'border-border hover:border-slate-300 dark:hover:border-slate-600'
              )}
            >
              <div className={cn('w-2 h-2 rounded-full mt-1.5 shrink-0',
                form.category === cat.key ? 'bg-indigo-500' : 'bg-slate-300 dark:bg-slate-600'
              )} />
              <div>
                <p className={cn('text-xs font-bold', cat.color)}>{cat.label}</p>
                {cat.description && (
                  <p className="text-[10px] text-slate-400 mt-0.5">{cat.description}</p>
                )}
              </div>
            </button>
          ))}
        </div>
        {errors.category && <p className="text-[10px] text-red-500 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{errors.category}</p>}
      </div>

      {/* Amount + VAT */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">Bruttó összeg (Ft) *</label>
          <Input
            type="number"
            value={form.amount || ''}
            onChange={e => handleAmountChange(+e.target.value)}
            placeholder="0"
            className={cn('bg-card font-mono tabular-nums', errors.amount && 'border-red-500')}
          />
          {errors.amount && <p className="text-[10px] text-red-500">{errors.amount}</p>}
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">
            ÁFA kulcs
            {isAlanyiMentes && <span className="ml-1 text-[9px] text-slate-400">(alanyi mentes)</span>}
          </label>
          <select
            value={isAlanyiMentes ? 0 : vatRate}
            onChange={e => handleVatRateChange(+e.target.value)}
            disabled={isAlanyiMentes}
            className={cn(
              'w-full text-sm border border-border rounded-lg px-3 py-2 bg-card text-foreground',
              isAlanyiMentes && 'opacity-50 cursor-not-allowed bg-slate-50 dark:bg-slate-800/50'
            )}
          >
            {VAT_RATES.map(r => (
              <option key={r.value} value={r.value}>{r.label}</option>
            ))}
          </select>
          {isAlanyiMentes && (
            <p className="text-[10px] text-slate-400">Áfa tv. 188. § — alanyi mentesség</p>
          )}
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">ÁFA összeg (Ft)</label>
          <Input
            type="number"
            value={form.vatAmount || ''}
            onChange={e => setForm(f => ({ ...f, vatAmount: +e.target.value }))}
            placeholder="0"
            disabled={isAlanyiMentes}
            className={cn(
              'bg-card font-mono tabular-nums',
              isAlanyiMentes && 'opacity-50 cursor-not-allowed'
            )}
          />
          <p className="text-[10px] text-slate-400">Nettó: {formatHuf(form.amount - form.vatAmount)}</p>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between pt-2 border-t border-border">
        <p className="text-xs text-slate-400">
          {form.direction === 'bevetel' ? '↗' : '↘'} {form.amount > 0 ? formatHuf(form.amount) : '—'}
        </p>
        <div className="flex items-center gap-2">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
          >
            Mégse
          </button>
          <button
            onClick={handleSubmit}
            className="flex items-center gap-1.5 px-5 py-2 text-sm font-semibold bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors shadow-sm"
          >
            <Save className="w-3.5 h-3.5" /> Mentés
          </button>
        </div>
      </div>
    </div>
  );
}
