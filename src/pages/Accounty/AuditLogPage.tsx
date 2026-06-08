import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, Search, Download, Filter, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuditLog } from '@/hooks/useAdminData';

const EVENT_TYPES = ['Minden', 'login', 'create', 'update', 'delete', 'submit', 'export', 'upload', 'resolve', 'send_email'];

const EVENT_LABELS: Record<string, string> = {
  login: 'Bejelentkezés',
  logout: 'Kijelentkezés',
  create: 'Létrehozás',
  update: 'Módosítás',
  delete: 'Törlés',
  submit: 'Beküldés',
  export: 'Exportálás',
  view: 'Megtekintés',
  upload: 'Feltöltés',
  resolve: 'Megoldás',
  send_email: 'Email küldés',
  approve: 'Jóváhagyás',
  reject: 'Elutasítás',
};

const EVENT_COLORS: Record<string, string> = {
  login: 'bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400',
  create: 'bg-green-50 text-green-600 dark:bg-green-900/30 dark:text-green-400',
  update: 'bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400',
  delete: 'bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400',
  submit: 'bg-purple-50 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400',
  export: 'bg-teal-50 text-teal-600 dark:bg-teal-900/30 dark:text-teal-400',
};

export default function AuditLogPage() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [eventFilter, setEventFilter] = useState('Minden');
  const [page, setPage] = useState(0);
  const pageSize = 50;

  const { data, isLoading } = useAuditLog({
    eventType: eventFilter !== 'Minden' ? eventFilter : undefined,
    page,
    pageSize,
  });

  const entries = data?.data || [];
  const totalCount = data?.count || 0;
  const totalPages = Math.ceil(totalCount / pageSize);

  const filtered = useMemo(() => {
    if (!searchQuery) return entries;
    const q = searchQuery.toLowerCase();
    return entries.filter((e: any) =>
      (e.user_email || '').toLowerCase().includes(q) ||
      (e.entity_type || '').toLowerCase().includes(q) ||
      (e.entity_id || '').toLowerCase().includes(q)
    );
  }, [entries, searchQuery]);

  const handleExportCsv = () => {
    const headers = ['Dátum', 'Felhasználó', 'Esemény', 'Entitás', 'Entitás ID', 'IP'];
    const rows = filtered.map((e: any) => [
      new Date(e.created_at).toLocaleString('hu-HU'),
      e.user_email || '-',
      EVENT_LABELS[e.event_type] || e.event_type,
      e.entity_type,
      e.entity_id || '-',
      e.ip_address || '-',
    ]);
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit_log_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  };

  return (
    <div className="w-full space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl shadow-lg shadow-indigo-500/25">
            <Shield className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Audit napló</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">Összes adatmódosítás, bejelentkezés és beküldés naplója</p>
          </div>
        </div>
        <Button variant="outline" className="gap-2" onClick={handleExportCsv}>
          <Download className="w-4 h-4" />
          Export CSV
        </Button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            placeholder="Keresés email, entitás..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="pl-9 bg-card border-border"
          />
        </div>
        <div className="flex items-center gap-1.5">
          <Filter className="w-4 h-4 text-slate-400" />
          <select
            value={eventFilter}
            onChange={e => { setEventFilter(e.target.value); setPage(0); }}
            className="rounded-lg border border-border bg-card px-3 py-2 text-sm"
          >
            {EVENT_TYPES.map(t => (
              <option key={t} value={t}>{t === 'Minden' ? 'Minden esemény' : EVENT_LABELS[t] || t}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-card rounded-xl border border-border shadow-soft overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-slate-50/50 dark:bg-slate-900/30">
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Dátum</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Felhasználó</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Esemény</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Entitás</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Változás</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">IP</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {isLoading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 6 }).map((_, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded animate-pulse" style={{ width: `${60 + j * 10}%` }} />
                      </td>
                    ))}
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-16 text-center text-sm text-slate-400">
                    <Shield className="w-10 h-10 mx-auto mb-3 text-slate-300" />
                    Nincs naplóbejegyzés
                  </td>
                </tr>
              ) : (
                filtered.map((entry: any) => (
                  <tr key={entry.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400 whitespace-nowrap">
                      {new Date(entry.created_at).toLocaleString('hu-HU', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-slate-900 dark:text-slate-100">
                      {entry.user_email || '-'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${EVENT_COLORS[entry.event_type] || 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'}`}>
                        {EVENT_LABELS[entry.event_type] || entry.event_type}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400">
                      <span className="font-medium">{entry.entity_type}</span>
                      {entry.entity_id && <span className="text-slate-400 ml-1 font-mono text-xs">#{entry.entity_id.slice(0, 8)}</span>}
                    </td>
                    <td className="px-4 py-3 text-xs font-mono text-slate-500 dark:text-slate-400 max-w-[200px] truncate">
                      {entry.old_value && entry.new_value ? (
                        <span className="text-amber-600 dark:text-amber-400">módosítva</span>
                      ) : entry.new_value ? (
                        <span className="text-green-600 dark:text-green-400">létrehozva</span>
                      ) : entry.old_value ? (
                        <span className="text-red-600 dark:text-red-400">törölve</span>
                      ) : '-'}
                    </td>
                    <td className="px-4 py-3 text-xs font-mono text-slate-400">
                      {entry.ip_address || '-'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-border">
            <p className="text-xs text-slate-500">{totalCount} bejegyzés</p>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" className="h-8 w-8" disabled={page === 0} onClick={() => setPage(p => p - 1)}>
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <span className="text-sm text-slate-600 dark:text-slate-400">{page + 1} / {totalPages}</span>
              <Button variant="ghost" size="icon" className="h-8 w-8" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
