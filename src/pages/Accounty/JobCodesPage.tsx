import React, { useState, useMemo, useEffect } from 'react';
import { BookOpen, Search, Plus, Edit3, Check, X, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useJobCodes, useUpsertJobCode } from '@/hooks/useAdminData';
import { UnifiedPagination } from '@/components/ui/unified-pagination';

type Filter = 'all' | 'active' | 'inactive';

export default function JobCodesPage() {
  const [filter, setFilter] = useState<Filter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const { data: codes = [], isLoading } = useJobCodes(filter === 'active');
  const upsertCode = useUpsertJobCode();
  const [editModal, setEditModal] = useState<any>(null);
  const [form, setForm] = useState({
    code: '', name: '', is_insured: true, min_contribution_base_rule: '', is_active: true,
    valid_from: '', valid_to: '', nav_reference_url: '', notes: '',
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, filter]);

  const filtered = useMemo(() => {
    let list = codes;
    if (filter === 'inactive') list = list.filter((c: any) => !c.is_active);
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter((c: any) =>
        c.code.toLowerCase().includes(q) || c.name.toLowerCase().includes(q)
      );
    }
    return list;
  }, [codes, filter, searchQuery]);

  const totalItems = filtered.length;
  const totalPages = Math.ceil(totalItems / pageSize);

  const paginated = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, currentPage, pageSize]);

  const openCreate = () => {
    setForm({ code: '', name: '', is_insured: true, min_contribution_base_rule: '', is_active: true, valid_from: '', valid_to: '', nav_reference_url: '', notes: '' });
    setEditModal({ isNew: true });
  };

  const openEdit = (c: any) => {
    setForm({
      code: c.code || '', name: c.name || '', is_insured: c.is_insured ?? true,
      min_contribution_base_rule: c.min_contribution_base_rule || '', is_active: c.is_active ?? true,
      valid_from: c.valid_from || '', valid_to: c.valid_to || '', nav_reference_url: c.nav_reference_url || '', notes: c.notes || '',
    });
    setEditModal(c);
  };

  const handleSave = () => {
    upsertCode.mutate({
      id: editModal?.isNew ? undefined : editModal?.id,
      ...form,
    }, {
      onSuccess: () => setEditModal(null),
    });
  };

  return (
    <div className="w-full space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-gradient-to-br from-sky-500 to-blue-600 rounded-xl shadow-lg shadow-sky-500/25">
            <BookOpen className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Jogviszonykódok</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">NAV jogviszonykódok master tábla</p>
          </div>
        </div>
        <Button className="gap-2" onClick={openCreate}>
          <Plus className="w-4 h-4" />
          Új kód
        </Button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input placeholder="Keresés kód vagy megnevezés..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-9 bg-card border-border" />
        </div>
        <div className="flex gap-1 bg-slate-100 dark:bg-slate-800/50 rounded-lg p-0.5">
          {([['all', 'Mind'], ['active', 'Aktív'], ['inactive', 'Inaktív']] as [Filter, string][]).map(([v, l]) => (
            <button key={v} onClick={() => setFilter(v)} className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${filter === v ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-sm' : 'text-slate-500'}`}>
              {l}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-card rounded-xl border border-border shadow-soft overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border dark:bg-slate-900/30">
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Kód</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Megnevezés</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Biztosítás</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Min. járulékalap</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Érvényesség</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Aktív</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50">
            {isLoading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <tr key={i}><td colSpan={7} className="px-4 py-3"><div className="h-4 bg-slate-200 dark:bg-slate-800 rounded animate-pulse" /></td></tr>
              ))
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-16 text-center text-sm text-slate-400">
                  <BookOpen className="w-10 h-10 mx-auto mb-3 text-slate-300" />
                  Nincs találat
                </td>
              </tr>
            ) : (
              paginated.map((c: any) => (
                <tr key={c.id || c.code} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                  <td className="px-4 py-3 text-sm font-bold font-mono text-primary">{c.code}</td>
                  <td className="px-4 py-3 text-sm font-medium text-slate-900 dark:text-slate-100">{c.name}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${c.is_insured ? 'bg-green-50 text-green-600 dark:bg-green-900/30 dark:text-green-400' : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-500'}`}>
                      {c.is_insured ? 'Igen' : 'Nem'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500">{c.min_contribution_base_rule || '-'}</td>
                  <td className="px-4 py-3 text-xs text-slate-500">
                    {c.valid_from ? new Date(c.valid_from).toLocaleDateString('hu-HU') : '–'}
                    {c.valid_to && ` → ${new Date(c.valid_to).toLocaleDateString('hu-HU')}`}
                  </td>
                  <td className="px-4 py-3">
                    <div className={`w-2.5 h-2.5 rounded-full ${c.is_active ? 'bg-green-500' : 'bg-slate-300'}`} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(c)}>
                      <Edit3 className="w-3.5 h-3.5 text-slate-400" />
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        {totalPages > 1 && (
          <div className="border-t border-border px-4 py-3 bg-card">
            <UnifiedPagination
              currentPage={currentPage}
              totalPages={totalPages}
              totalItems={totalItems}
              pageSize={pageSize}
              onPageChange={setCurrentPage}
              onPageSizeChange={setPageSize}
              pageSizeOptions={[25, 50, 100]}
            />
          </div>
        )}
      </div>

      {/* Edit/Create modal */}
      <Dialog open={!!editModal} onOpenChange={() => setEditModal(null)}>
        <DialogContent className="sm:max-w-lg bg-card">
          <DialogHeader>
            <DialogTitle>{editModal?.isNew ? 'Új jogviszonykód' : 'Jogviszonykód szerkesztése'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Kód</label>
                <Input value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value }))} placeholder="pl. 1101" className="mt-1 font-mono" />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Megnevezés</label>
                <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="mt-1" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Érvényes tól</label>
                <Input type="date" value={form.valid_from} onChange={e => setForm(f => ({ ...f, valid_from: e.target.value }))} className="mt-1" />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Érvényes ig</label>
                <Input type="date" value={form.valid_to} onChange={e => setForm(f => ({ ...f, valid_to: e.target.value }))} className="mt-1" />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Min. járulékalap szabály</label>
              <Input value={form.min_contribution_base_rule} onChange={e => setForm(f => ({ ...f, min_contribution_base_rule: e.target.value }))} className="mt-1" />
            </div>
            <div className="flex items-center gap-6">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={form.is_insured} onChange={e => setForm(f => ({ ...f, is_insured: e.target.checked }))} className="rounded" />
                Biztosított
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={form.is_active} onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))} className="rounded" />
                Aktív
              </label>
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Megjegyzés</label>
              <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} className="mt-1 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm min-h-[60px]" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditModal(null)}>Mégsem</Button>
            <Button onClick={handleSave} disabled={!form.code || !form.name || upsertCode.isPending}>Mentés</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
