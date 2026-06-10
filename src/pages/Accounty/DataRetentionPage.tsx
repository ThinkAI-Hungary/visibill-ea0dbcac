import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft, Shield, FileText, Clock, AlertTriangle, CheckCircle,
  Upload, Trash2, Eye, Download, Calendar, Database
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface RetentionRule {
  docType: string;
  retentionYears: number;
  legalBasis: string;
  autoDelete: boolean;
  count: number;
}

interface DataContract {
  id: string;
  partnerName: string;
  uploadDate: string;
  validUntil: string;
  status: 'active' | 'expired';
  fileName: string;
}

interface GdprRequest {
  id: string;
  type: 'access' | 'rectification' | 'restriction' | 'deletion';
  employeeName: string;
  requestDate: string;
  status: 'pending' | 'completed' | 'rejected';
  note?: string;
}

const RETENTION_RULES: RetentionRule[] = [
  { docType: 'Munkaszerződés', retentionYears: 3, legalBasis: 'Mt. 286. §', autoDelete: false, count: 45 },
  { docType: 'Bérjegyzék', retentionYears: 8, legalBasis: 'Sztv. 169. §', autoDelete: true, count: 540 },
  { docType: 'TAJ-kártya másolat', retentionYears: 3, legalBasis: 'Mt. 286. §', autoDelete: true, count: 42 },
  { docType: 'Adóelőleg-nyilatkozat', retentionYears: 5, legalBasis: 'Art. 78. §', autoDelete: true, count: 120 },
  { docType: 'Bevallási XML', retentionYears: 8, legalBasis: 'Sztv. 169. §', autoDelete: false, count: 96 },
  { docType: 'Kilépő dokumentumok', retentionYears: 3, legalBasis: 'Mt. 286. §', autoDelete: false, count: 12 },
  { docType: 'Nyugdíj-releváns iratok', retentionYears: 50, legalBasis: 'Tny. törvény', autoDelete: false, count: 38 },
  { docType: 'GDPR hozzájárulás', retentionYears: 5, legalBasis: 'GDPR 7. cikk', autoDelete: true, count: 45 },
];

const MOCK_CONTRACTS: DataContract[] = [
  { id: '1', partnerName: 'Accounty Könyvelőiroda Kft.', uploadDate: '2024-03-15', validUntil: '2027-03-15', status: 'active', fileName: 'adatfeldolgozo_szerzodes_2024.pdf' },
  { id: '2', partnerName: 'CloudBackup Zrt.', uploadDate: '2023-06-01', validUntil: '2025-05-31', status: 'expired', fileName: 'cloud_adatkezeles_2023.pdf' },
];

const MOCK_REQUESTS: GdprRequest[] = [
  { id: '1', type: 'access', employeeName: 'Nagy Anna', requestDate: '2026-06-01', status: 'completed' },
  { id: '2', type: 'deletion', employeeName: 'Kiss Béla', requestDate: '2026-06-05', status: 'rejected', note: 'Adóadat törlése 5 éven belül nem lehetséges (Art. 78. §)' },
  { id: '3', type: 'rectification', employeeName: 'Tóth Éva', requestDate: '2026-06-08', status: 'pending' },
];

const REQUEST_TYPE_LABELS: Record<string, { label: string; color: string }> = {
  access: { label: 'Hozzáférési', color: 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400' },
  rectification: { label: 'Helyesbítési', color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-500/20 dark:text-yellow-400' },
  restriction: { label: 'Korlátozási', color: 'bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-400' },
  deletion: { label: 'Törlési', color: 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400' },
};

export default function DataRetentionPage() {
  const { id } = useParams<{ id: string }>();
  const [tab, setTab] = useState<'retention' | 'contracts' | 'requests'>('retention');
  const [dragging, setDragging] = useState(false);

  return (
    <div className="w-full max-w-5xl mx-auto space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link to={`/accounty/client/${id}`} className="p-2 rounded-lg hover:bg-muted transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="p-2.5 bg-gradient-to-br from-red-500 to-pink-600 rounded-xl shadow-lg shadow-red-500/25">
          <Shield className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Iratkezelés és GDPR</h1>
          <p className="text-sm text-slate-500">Megőrzési szabályzat, adatfeldolgozói szerződések, érintetti kérelmek</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 dark:bg-slate-800/50 rounded-lg p-0.5 w-fit">
        {[
          { id: 'retention' as const, label: 'Megőrzési idők', icon: Clock },
          { id: 'contracts' as const, label: 'Adatfeldolgozói szerződések', icon: FileText },
          { id: 'requests' as const, label: 'Érintetti kérelmek', icon: Database },
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              'flex items-center gap-1.5 px-4 py-2 rounded-md text-xs font-medium transition-all',
              tab === t.id ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            )}
          >
            <t.icon className="w-3.5 h-3.5" />
            {t.label}
          </button>
        ))}
      </div>

      {/* Retention rules table */}
      {tab === 'retention' && (
        <div className="bg-card rounded-xl border border-border shadow-soft overflow-hidden">
          <div className="px-5 py-3 border-b border-border bg-slate-50/50 dark:bg-slate-900/30">
            <h2 className="text-sm font-bold text-slate-700 dark:text-slate-300">Dokumentumtípusok és megőrzési idők</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-slate-50/30 dark:bg-slate-900/20">
                  <th className="text-left px-5 py-2.5 text-xs font-bold text-slate-500 uppercase">Dokumentumtípus</th>
                  <th className="text-center px-3 py-2.5 text-xs font-bold text-slate-500 uppercase">Megőrzés</th>
                  <th className="text-left px-3 py-2.5 text-xs font-bold text-slate-500 uppercase">Jogalap</th>
                  <th className="text-center px-3 py-2.5 text-xs font-bold text-slate-500 uppercase">Auto törlés</th>
                  <th className="text-center px-3 py-2.5 text-xs font-bold text-slate-500 uppercase">Darabszám</th>
                </tr>
              </thead>
              <tbody>
                {RETENTION_RULES.map((rule, i) => (
                  <tr key={i} className="border-b border-border/50 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="px-5 py-3 font-medium text-slate-900 dark:text-slate-100">{rule.docType}</td>
                    <td className="px-3 py-3 text-center">
                      <span className={cn(
                        'px-2 py-0.5 rounded-full text-xs font-bold',
                        rule.retentionYears >= 50 ? 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400' :
                        rule.retentionYears >= 8 ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-500/20 dark:text-yellow-400' :
                        'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400'
                      )}>
                        {rule.retentionYears} év
                      </span>
                    </td>
                    <td className="px-3 py-3 text-xs text-slate-500 font-mono">{rule.legalBasis}</td>
                    <td className="px-3 py-3 text-center">
                      <div className={cn(
                        'w-5 h-5 rounded-full mx-auto flex items-center justify-center',
                        rule.autoDelete ? 'bg-emerald-100 dark:bg-emerald-500/20' : 'bg-slate-100 dark:bg-slate-700'
                      )}>
                        {rule.autoDelete ? <CheckCircle className="w-3.5 h-3.5 text-emerald-600" /> : <span className="text-slate-400 text-[10px]">—</span>}
                      </div>
                    </td>
                    <td className="px-3 py-3 text-center font-mono text-slate-600 dark:text-slate-400">{rule.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-5 py-3 bg-slate-50/50 dark:bg-slate-900/30 border-t border-border text-xs text-slate-500">
            Összesen: {RETENTION_RULES.reduce((s, r) => s + r.count, 0)} dokumentum nyilvántartva
          </div>
        </div>
      )}

      {/* Contracts */}
      {tab === 'contracts' && (
        <div className="space-y-4">
          {/* Upload zone */}
          <div
            className={cn(
              'border-2 border-dashed rounded-xl p-8 text-center transition-all cursor-pointer',
              dragging ? 'border-blue-500 bg-blue-50 dark:bg-blue-500/10' : 'border-border hover:border-blue-300'
            )}
            onDragOver={e => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={e => { e.preventDefault(); setDragging(false); }}
          >
            <Upload className="w-8 h-8 mx-auto mb-2 text-slate-400" />
            <p className="text-sm font-medium text-slate-600 dark:text-slate-300">Új szerződés feltöltése</p>
            <p className="text-xs text-slate-400 mt-1">Drag & drop vagy kattintson ide (PDF, DOC)</p>
          </div>

          {/* Contracts list */}
          <div className="bg-card rounded-xl border border-border shadow-soft overflow-hidden">
            <div className="px-5 py-3 border-b border-border bg-slate-50/50 dark:bg-slate-900/30">
              <h2 className="text-sm font-bold text-slate-700 dark:text-slate-300">Adatfeldolgozói szerződések (GDPR 28. cikk)</h2>
            </div>
            <div className="divide-y divide-border/50">
              {MOCK_CONTRACTS.map(c => (
                <div key={c.id} className="flex items-center gap-4 px-5 py-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                  <div className={cn(
                    'w-10 h-10 rounded-xl flex items-center justify-center',
                    c.status === 'active' ? 'bg-emerald-100 dark:bg-emerald-500/20' : 'bg-red-100 dark:bg-red-500/20'
                  )}>
                    <FileText className="w-5 h-5" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-bold">{c.partnerName}</p>
                    <p className="text-xs text-slate-500">{c.fileName}</p>
                  </div>
                  <div className={cn(
                    'px-2.5 py-1 rounded-full text-xs font-bold',
                    c.status === 'active' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400' :
                    'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400'
                  )}>
                    {c.status === 'active' ? 'Érvényes' : 'Lejárt'}
                  </div>
                  <div className="text-xs text-slate-500 text-right">
                    <p>Feltöltve: {c.uploadDate}</p>
                    <p>Érvényes: {c.validUntil}</p>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="sm"><Eye className="w-3.5 h-3.5" /></Button>
                    <Button variant="ghost" size="sm"><Download className="w-3.5 h-3.5" /></Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* GDPR Requests */}
      {tab === 'requests' && (
        <div className="bg-card rounded-xl border border-border shadow-soft overflow-hidden">
          <div className="px-5 py-3 border-b border-border bg-slate-50/50 dark:bg-slate-900/30 flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-700 dark:text-slate-300">Érintetti kérelmek</h2>
            <Button variant="outline" size="sm" className="text-xs" asChild>
              <Link to="/accounty/admin/gdpr">Rendszerszintű GDPR modul →</Link>
            </Button>
          </div>
          <div className="divide-y divide-border/50">
            {MOCK_REQUESTS.map(req => (
              <div key={req.id} className="flex items-center gap-4 px-5 py-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                <span className={cn('px-2.5 py-1 rounded-full text-xs font-bold', REQUEST_TYPE_LABELS[req.type].color)}>
                  {REQUEST_TYPE_LABELS[req.type].label}
                </span>
                <div className="flex-1">
                  <p className="text-sm font-medium">{req.employeeName}</p>
                  <p className="text-xs text-slate-500">{req.requestDate}</p>
                </div>
                <div className={cn(
                  'px-2.5 py-1 rounded-full text-xs font-bold',
                  req.status === 'completed' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400' :
                  req.status === 'rejected' ? 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400' :
                  'bg-yellow-100 text-yellow-700 dark:bg-yellow-500/20 dark:text-yellow-400'
                )}>
                  {req.status === 'completed' ? 'Teljesítve' : req.status === 'rejected' ? 'Elutasítva' : 'Függőben'}
                </div>
                {req.note && (
                  <p className="text-xs text-slate-400 max-w-[200px] truncate" title={req.note}>{req.note}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
