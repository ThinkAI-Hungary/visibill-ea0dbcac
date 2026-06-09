import React, { useState } from 'react';
import { Scale, Plus, Edit3, ExternalLink, RefreshCw, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useLegalUpdates, useAddLegalUpdate, useUpdateLegalUpdate } from '@/hooks/useAdminData';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

const SOURCE_CONFIG: Record<string, { label: string; color: string }> = {
  kozlony: { label: 'Magyar Közlöny', color: 'bg-purple-50 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400' },
  nav: { label: 'NAV közlemény', color: 'bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400' },
  egyeb: { label: 'Egyéb', color: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400' },
};

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  planned: { label: 'Tervezett', color: 'bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400' },
  in_progress: { label: 'Folyamatban', color: 'bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400' },
  deployed: { label: 'Élesítve', color: 'bg-green-50 text-green-600 dark:bg-green-900/30 dark:text-green-400' },
};

const MODULE_OPTIONS = [
  'Bérszámfejtés', 'Bevallások', 'NAV kapcsolat', 'Adóparaméterek',
  'Foglalkoztatottak', 'GDPR', 'Sablonok', 'Jogviszonykódok', 'Portál',
];

export default function LegalUpdatesPage() {
  const { data: updates = [], isLoading } = useLegalUpdates();
  const addUpdate = useAddLegalUpdate();
  const updateItem = useUpdateLegalUpdate();
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({
    title: '', source: 'kozlony', published_at: '', affected_modules: [] as string[],
    implementation_status: 'planned', notes: '',
  });
  const [fetching, setFetching] = useState(false);

  const handleFetchFeed = async () => {
    setFetching(true);
    try {
      const { data, error } = await supabase.functions.invoke('fetch-legal-updates');
      if (error) throw error;
      toast({
        title: 'Feed frissítve',
        description: `${data.new_inserted || 0} új bejegyzés · NAV: ${data.nav_found || 0}, Közlöny: ${data.kozlony_found || 0}`,
      });
      // Refetch the list
      window.location.reload();
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Hiba', description: err.message });
    } finally {
      setFetching(false);
    }
  };

  const handleCreate = () => {
    addUpdate.mutate(form, {
      onSuccess: () => {
        setCreateOpen(false);
        setForm({ title: '', source: 'kozlony', published_at: '', affected_modules: [], implementation_status: 'planned', notes: '' });
      },
    });
  };

  const toggleModule = (mod: string) => {
    setForm(f => ({
      ...f,
      affected_modules: f.affected_modules.includes(mod)
        ? f.affected_modules.filter(m => m !== mod)
        : [...f.affected_modules, mod],
    }));
  };

  return (
    <div className="w-full space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-gradient-to-br from-rose-500 to-pink-600 rounded-xl shadow-lg shadow-rose-500/25">
            <Scale className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Jogszabály-frissítések</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">Magyar Közlöny és NAV-közlemények napló</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" className="gap-2" onClick={handleFetchFeed} disabled={fetching}>
            {fetching ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            Feed frissítése
          </Button>
          <Button className="gap-2" onClick={() => setCreateOpen(true)}>
            <Plus className="w-4 h-4" />
            Új bejegyzés
          </Button>
        </div>
      </div>

      {/* Timeline */}
      <div className="space-y-4">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 bg-slate-200 dark:bg-slate-800 rounded-xl animate-pulse" />
          ))
        ) : updates.length === 0 ? (
          <div className="py-16 text-center bg-card rounded-xl border border-border">
            <Scale className="w-10 h-10 mx-auto mb-3 text-slate-300" />
            <p className="text-sm text-slate-400">Nincs jogszabály-frissítés</p>
          </div>
        ) : (
          updates.map((u: any) => {
            const sc = SOURCE_CONFIG[u.source] || SOURCE_CONFIG.egyeb;
            const st = STATUS_CONFIG[u.implementation_status] || STATUS_CONFIG.planned;
            return (
              <div key={u.id} className="bg-card rounded-xl border border-border shadow-soft p-5 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">{u.title}</h3>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${sc.color}`}>{sc.label}</span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${st.color}`}>{st.label}</span>
                    </div>
                    {u.published_at && (
                      <p className="text-xs text-slate-500 mb-2">Megjelenés: {new Date(u.published_at).toLocaleDateString('hu-HU')}</p>
                    )}
                    {u.affected_modules?.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-2">
                        {u.affected_modules.map((m: string) => (
                          <span key={m} className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-primary/10 text-primary">{m}</span>
                        ))}
                      </div>
                    )}
                    {u.notes && (
                      u.notes.startsWith('http') ? (
                        <a href={u.notes} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline flex items-center gap-1">
                          <ExternalLink className="w-3 h-3" /> Forrás megnyitása
                        </a>
                      ) : (
                        <p className="text-xs text-slate-400">{u.notes}</p>
                      )
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <select
                      value={u.implementation_status}
                      onChange={e => updateItem.mutate({ id: u.id, implementation_status: e.target.value })}
                      className="rounded-md border border-border bg-card px-2 py-1 text-xs"
                    >
                      {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                        <option key={k} value={k}>{v.label}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-lg bg-card">
          <DialogHeader>
            <DialogTitle>Új jogszabály-frissítés</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Cím</label>
              <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} className="mt-1" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Forrás</label>
                <select value={form.source} onChange={e => setForm(f => ({ ...f, source: e.target.value }))} className="mt-1 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm">
                  {Object.entries(SOURCE_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Megjelenés dátuma</label>
                <Input type="date" value={form.published_at} onChange={e => setForm(f => ({ ...f, published_at: e.target.value }))} className="mt-1" />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2 block">Érintett modulok</label>
              <div className="flex flex-wrap gap-1.5">
                {MODULE_OPTIONS.map(m => (
                  <button
                    key={m}
                    onClick={() => toggleModule(m)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                      form.affected_modules.includes(m)
                        ? 'bg-primary text-white'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-primary/10'
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Megjegyzés</label>
              <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} className="mt-1 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm min-h-[60px]" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Mégsem</Button>
            <Button onClick={handleCreate} disabled={!form.title || addUpdate.isPending}>Hozzáadás</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
