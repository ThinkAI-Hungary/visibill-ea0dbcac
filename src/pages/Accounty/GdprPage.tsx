import React, { useState } from 'react';
import { ShieldCheck, Plus, FileText, Eye, CheckCircle, Clock, XCircle, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useGdprRequests, useCreateGdprRequest, useUpdateGdprRequest } from '@/hooks/useAdminData';
import { useAccountyClients } from '@/hooks/accounty';
import { AccountyErrorState } from '@/components/accounty/AccountyErrorState';

const TYPE_LABELS: Record<string, string> = {
  access: 'Hozzáférés',
  rectification: 'Helyesbítés',
  restriction: 'Korlátozás',
  deletion: 'Törlés',
};

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  pending: { label: 'Függőben', color: 'bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400 border-amber-100 dark:border-amber-800', icon: Clock },
  in_progress: { label: 'Folyamatban', color: 'bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400 border-blue-100 dark:border-blue-800', icon: Eye },
  completed: { label: 'Teljesítve', color: 'bg-green-50 text-green-600 dark:bg-green-900/30 dark:text-green-400 border-green-100 dark:border-green-800', icon: CheckCircle },
  rejected: { label: 'Elutasítva', color: 'bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400 border-red-100 dark:border-red-800', icon: XCircle },
};

export default function GdprPage() {
  const { data: requests = [], isLoading, isError: reqError, refetch: refetchReqs } = useGdprRequests();
  const { data: clients = [] } = useAccountyClients();
  const createRequest = useCreateGdprRequest();
  const updateRequest = useUpdateGdprRequest();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedCompanyId, setSelectedCompanyId] = useState('');
  const [form, setForm] = useState({ employee_name: '', request_type: 'access', notes: '' });

  // Use selected company or first available
  const effectiveCompanyId = selectedCompanyId || (clients.length > 0 ? clients[0].id : '');

  const handleCreate = () => {
    if (!effectiveCompanyId) return;
    createRequest.mutate({
      company_id: effectiveCompanyId,
      employee_name: form.employee_name,
      request_type: form.request_type,
      notes: form.notes || undefined,
    }, {
      onSuccess: () => {
        setIsCreateOpen(false);
        setForm({ employee_name: '', request_type: 'access', notes: '' });
      },
    });
  };

  const stats = {
    pending: requests.filter((r: any) => r.status === 'pending').length,
    in_progress: requests.filter((r: any) => r.status === 'in_progress').length,
    completed: requests.filter((r: any) => r.status === 'completed').length,
  };

  if (reqError) {
    return <AccountyErrorState message="Nem sikerült betölteni a GDPR kérelmeket." onRetry={() => refetchReqs()} />;
  }

  return (
    <div className="w-full space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl shadow-lg shadow-emerald-500/25">
            <ShieldCheck className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">GDPR modul</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">Érintetti kérelmek kezelése</p>
          </div>
        </div>
        <Button className="gap-2" onClick={() => setIsCreateOpen(true)}>
          <Plus className="w-4 h-4" />
          Új kérelem
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Függőben', value: stats.pending, color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-900/20' },
          { label: 'Folyamatban', value: stats.in_progress, color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-900/20' },
          { label: 'Teljesítve', value: stats.completed, color: 'text-green-600', bg: 'bg-green-50 dark:bg-green-900/20' },
        ].map(s => (
          <div key={s.label} className={`${s.bg} rounded-xl p-4 border border-border`}>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">{s.label}</p>
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="bg-card rounded-xl border border-border shadow-soft overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border dark:bg-slate-900/30">
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Érintett</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Típus</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Benyújtás</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Státusz</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Művelet</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50">
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}><td colSpan={5} className="px-4 py-3"><div className="h-4 bg-slate-200 dark:bg-slate-800 rounded animate-pulse" /></td></tr>
              ))
            ) : requests.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-16 text-center text-sm text-slate-400">
                  <ShieldCheck className="w-10 h-10 mx-auto mb-3 text-slate-300" />
                  Nincs érintetti kérelem
                </td>
              </tr>
            ) : (
              requests.map((req: any) => {
                const sc = STATUS_CONFIG[req.status] || STATUS_CONFIG.pending;
                return (
                  <tr key={req.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="px-4 py-3 text-sm font-medium text-slate-900 dark:text-slate-100">{req.employee_name}</td>
                    <td className="px-4 py-3 text-sm">{TYPE_LABELS[req.request_type] || req.request_type}</td>
                    <td className="px-4 py-3 text-sm text-slate-500">{new Date(req.requested_at).toLocaleDateString('hu-HU')}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold border ${sc.color}`}>
                        <sc.icon className="w-3 h-3" /> {sc.label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        {req.status === 'pending' && (
                          <Button size="sm" variant="ghost" className="text-xs h-7" onClick={() => updateRequest.mutate({ id: req.id, status: 'in_progress' })}>
                            Elkezd
                          </Button>
                        )}
                        {req.status === 'in_progress' && (
                          <Button size="sm" variant="ghost" className="text-xs h-7 text-green-600" onClick={() => updateRequest.mutate({ id: req.id, status: 'completed', completed_at: new Date().toISOString() })}>
                            Teljesít
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Create dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="sm:max-w-md bg-card">
          <DialogHeader>
            <DialogTitle>Új érintetti kérelem</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Érintett neve</label>
              <Input value={form.employee_name} onChange={e => setForm(f => ({ ...f, employee_name: e.target.value }))} placeholder="Név" className="mt-1" />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Kérelem típusa</label>
              <select value={form.request_type} onChange={e => setForm(f => ({ ...f, request_type: e.target.value }))} className="mt-1 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm">
                {Object.entries(TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Megjegyzés</label>
              <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} className="mt-1 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm min-h-[80px]" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateOpen(false)}>Mégsem</Button>
            <Button onClick={handleCreate} disabled={!form.employee_name || createRequest.isPending}>Létrehozás</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
