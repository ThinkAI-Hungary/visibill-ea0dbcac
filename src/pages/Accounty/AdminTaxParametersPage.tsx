import React, { useState, useMemo } from 'react';
import { Calculator, Search, Edit3, Check, X, Copy, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useGlobalTaxParams, useUpdateGlobalTaxParam, useDuplicateTaxYear } from '@/hooks/useAdminData';
import { useToast } from '@/hooks/use-toast';

const PARAM_LABELS: Record<string, string> = {
  minimum_wage: 'Minimálbér (havi)',
  guaranteed_minimum: 'Garantált bérminimum (havi)',
  szja_rate: 'SZJA kulcs',
  tb_rate: 'TB járulék kulcs',
  szocho_rate: 'SZOCHO kulcs',
  ev_minimum_multiplier: 'EV/társas vállalkozó minimumalap szorzó',
  family_1_child: 'Családi kedvezmény – 1 gyermek',
  family_2_children: 'Családi kedvezmény – 2 gyermek (gyermekenként)',
  family_3plus_children: 'Családi kedvezmény – 3+ gyermek (gyermekenként)',
  young_25_cap: '25 év alattiak kedvezménye (havi plafon)',
  personal_disability: 'Személyi kedvezmény',
  first_marriage: 'Első házasok kedvezménye',
  health_service_monthly: 'Eü. szolgáltatási járulék (havi)',
  efo_daily_tax: 'EFO napi közteher',
  efo_min_hourly_unskilled: 'EFO min. órabér (szakk. nélkül)',
  efo_min_hourly_skilled: 'EFO min. órabér (szakk.)',
  remote_work_allowance: 'Távmunka átalány (havi)',
  szep_recreation_annual: 'SZÉP rekreáció (éves)',
  szep_active_annual: 'SZÉP Aktív Magyarok (éves)',
  housing_support_monthly: 'Lakhatás 35 év alatt (havi)',
  rehab_penalty_per_person: 'Rehab. hozzájárulás (fő/év)',
  szocho_capital_cap: 'SZOCHO felső határ (tőkejöv.)',
};

function formatValue(key: string, value: number): string {
  if (key.includes('rate') || key.includes('pct') || key.includes('multiplier')) {
    if (value <= 1) return `${(value * 100).toFixed(1)}%`;
    return `${value}×`;
  }
  return value.toLocaleString('hu-HU') + ' Ft';
}

export default function AdminTaxParametersPage() {
  const [selectedYear, setSelectedYear] = useState(2026);
  const [searchQuery, setSearchQuery] = useState('');
  const [editId, setEditId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [editRef, setEditRef] = useState('');
  const { toast } = useToast();

  const { data: params = [], isLoading } = useGlobalTaxParams(selectedYear);
  const updateParam = useUpdateGlobalTaxParam();
  const duplicateYear = useDuplicateTaxYear();

  const filtered = useMemo(() => {
    if (!searchQuery) return params;
    const q = searchQuery.toLowerCase();
    return params.filter((p: any) =>
      (PARAM_LABELS[p.key] || p.key).toLowerCase().includes(q) || p.key.includes(q)
    );
  }, [params, searchQuery]);

  const startEdit = (p: any) => {
    setEditId(p.id);
    setEditValue(String(p.value));
    setEditRef(p.legal_reference || '');
  };

  const saveEdit = () => {
    const numVal = parseFloat(editValue);
    if (isNaN(numVal)) {
      toast({ variant: 'destructive', title: 'Hibás érték' });
      return;
    }
    updateParam.mutate({ id: editId!, value: numVal, legal_reference: editRef || undefined }, {
      onSuccess: () => setEditId(null),
    });
  };

  const cancelEdit = () => setEditId(null);

  return (
    <div className="w-full space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-gradient-to-br from-orange-500 to-amber-600 rounded-xl shadow-lg shadow-orange-500/25">
            <Calculator className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Adómértékek és küszöbök</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">Globális paramétertábla — {selectedYear}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={selectedYear}
            onChange={e => setSelectedYear(parseInt(e.target.value))}
            className="rounded-lg border border-border bg-card px-3 py-2 text-sm"
          >
            {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <Button
            variant="outline"
            className="gap-2"
            onClick={() => {
              if (confirm(`${selectedYear}-es paraméterek másolása ${selectedYear + 1}-re?`)) {
                duplicateYear.mutate({ fromYear: selectedYear, toYear: selectedYear + 1 });
              }
            }}
          >
            <Copy className="w-4 h-4" />
            {selectedYear + 1} előkészítése
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <Input placeholder="Keresés paraméter neve..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-9 bg-card border-border" />
      </div>

      {/* Table */}
      <div className="bg-card rounded-xl border border-border shadow-soft overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border dark:bg-slate-900/30">
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Paraméter</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Érték {selectedYear}</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Jogalap</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50">
            {isLoading ? (
              Array.from({ length: 10 }).map((_, i) => (
                <tr key={i}><td colSpan={4} className="px-4 py-3"><div className="h-4 bg-slate-200 dark:bg-slate-800 rounded animate-pulse" /></td></tr>
              ))
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={4} className="py-16 text-center text-sm text-slate-400">
                  <Calculator className="w-10 h-10 mx-auto mb-3 text-slate-300" />
                  {params.length === 0 ? `Nincs paraméter a(z) ${selectedYear}. évre` : 'Nincs találat'}
                </td>
              </tr>
            ) : (
              filtered.map((p: any) => {
                const isEditing = editId === p.id;
                return (
                  <tr key={p.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group">
                    <td className="px-4 py-3">
                      <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{PARAM_LABELS[p.key] || p.key}</p>
                      <p className="text-[10px] font-mono text-slate-400">{p.key}</p>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {isEditing ? (
                        <Input
                          value={editValue}
                          onChange={e => setEditValue(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') cancelEdit(); }}
                          className="w-32 h-8 text-sm font-mono text-right ml-auto"
                          autoFocus
                        />
                      ) : (
                        <span className="text-sm font-bold text-primary font-mono">{formatValue(p.key, p.value)}</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {isEditing ? (
                        <Input value={editRef} onChange={e => setEditRef(e.target.value)} className="w-40 h-8 text-xs" placeholder="Jogszabály..." />
                      ) : (
                        <span className="text-xs text-slate-500 italic">{p.legal_reference || '-'}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {isEditing ? (
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-green-600" onClick={saveEdit}><Check className="w-3.5 h-3.5" /></Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500" onClick={cancelEdit}><X className="w-3.5 h-3.5" /></Button>
                        </div>
                      ) : (
                        <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => startEdit(p)}>
                          <Edit3 className="w-3.5 h-3.5 text-slate-400" />
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
