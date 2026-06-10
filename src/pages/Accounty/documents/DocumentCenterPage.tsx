import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft, FileText, Download, Printer, CheckCircle, Clock, RefreshCw,
  Folder, FileSpreadsheet, CreditCard, Users, AlertTriangle, Archive, Eye
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface DocumentCard {
  id: string;
  title: string;
  icon: React.ElementType;
  count: number;
  status: 'ready' | 'generating' | 'pending';
  size?: string;
  color: string;
}

const MOCK_DOCS: DocumentCard[] = [
  { id: 'payslips', title: 'Bérjegyzékek', icon: FileText, count: 42, status: 'ready', size: '3.2 MB', color: 'from-blue-500 to-indigo-500' },
  { id: 'transfers', title: 'Utalási lista', icon: CreditCard, count: 1, status: 'ready', size: '128 KB', color: 'from-emerald-500 to-teal-500' },
  { id: 'cash', title: 'Készpénzes kifizetési lista', icon: FileSpreadsheet, count: 1, status: 'pending', color: 'from-amber-500 to-orange-500' },
  { id: 'garnishments', title: 'Letiltások jegyzéke', icon: AlertTriangle, count: 3, status: 'ready', size: '45 KB', color: 'from-red-500 to-pink-500' },
  { id: 'cafeteria', title: 'Cafeteria feltöltési fájlok', icon: Archive, count: 2, status: 'ready', size: '89 KB', color: 'from-violet-500 to-purple-500' },
  { id: 'summary', title: 'Munkáltatói összesítő', icon: Users, count: 1, status: 'ready', size: '256 KB', color: 'from-slate-500 to-slate-600' },
  { id: 'declarations', title: 'Bevallás PDF-ek', icon: FileText, count: 2, status: 'generating', color: 'from-cyan-500 to-blue-500' },
  { id: 'certificates', title: 'Jövedelem- és foglalkoztatási igazolások', icon: Folder, count: 5, status: 'pending', color: 'from-green-500 to-emerald-500' },
];

export default function DocumentCenterPage() {
  const { id } = useParams<{ id: string }>();
  const [docs, setDocs] = useState(MOCK_DOCS);
  const [generatingAll, setGeneratingAll] = useState(false);

  const readyCount = docs.filter(d => d.status === 'ready').length;
  const totalCount = docs.length;

  const handleGenerateAll = () => {
    setGeneratingAll(true);
    setTimeout(() => {
      setDocs(prev => prev.map(d => ({ ...d, status: 'ready' as const, size: d.size || '64 KB' })));
      setGeneratingAll(false);
    }, 3000);
  };

  const STATUS_BADGE: Record<string, { label: string; color: string; icon: React.ElementType }> = {
    ready: { label: 'Kész', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400', icon: CheckCircle },
    generating: { label: 'Generálás...', color: 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400', icon: RefreshCw },
    pending: { label: 'Várakozik', color: 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400', icon: Clock },
  };

  return (
    <div className="w-full max-w-5xl mx-auto space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link to={`/accounty/payroll/${id}`} className="p-2 rounded-lg hover:bg-muted transition-colors"><ArrowLeft className="w-5 h-5" /></Link>
          <div className="p-2.5 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl shadow-lg shadow-blue-500/25"><Folder className="w-5 h-5 text-white" /></div>
          <div>
            <h1 className="text-2xl font-bold">Dokumentum-központ</h1>
            <p className="text-sm text-slate-500">2026. május — Havi kimeneti állományok</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button onClick={handleGenerateAll} disabled={generatingAll} className="gap-1.5 bg-blue-600 hover:bg-blue-700">
            {generatingAll ? <RefreshCw className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
            {generatingAll ? 'Generálás...' : 'Mind generálása'}
          </Button>
          <Button variant="outline" className="gap-1.5"><Download className="w-4 h-4" /> Minden letöltése (ZIP)</Button>
        </div>
      </div>

      {/* Progress */}
      <div className="bg-card rounded-xl border border-border p-4 flex items-center gap-4">
        <div className="flex-1">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-slate-500">Generálási állapot</span>
            <span className="text-xs font-bold">{readyCount}/{totalCount} kész</span>
          </div>
          <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
            <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${(readyCount / totalCount) * 100}%` }} />
          </div>
        </div>
      </div>

      {/* Document cards grid */}
      <div className="grid grid-cols-2 gap-4">
        {docs.map(doc => {
          const badge = STATUS_BADGE[doc.status];
          return (
            <div key={doc.id} className="bg-card rounded-xl border border-border shadow-soft overflow-hidden hover:shadow-lg hover:-translate-y-0.5 transition-all">
              <div className="p-5 flex items-start gap-4">
                <div className={cn('w-12 h-12 rounded-xl bg-gradient-to-br text-white flex items-center justify-center shrink-0', doc.color)}>
                  <doc.icon className="w-6 h-6" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">{doc.title}</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={cn('px-2 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1', badge.color)}>
                      <badge.icon className={cn('w-3 h-3', doc.status === 'generating' && 'animate-spin')} />
                      {badge.label}
                    </span>
                    <span className="text-xs text-slate-400">{doc.count} db</span>
                    {doc.size && <span className="text-xs text-slate-400">• {doc.size}</span>}
                  </div>
                </div>
              </div>
              <div className="px-5 pb-4 flex gap-2">
                <Button variant="outline" size="sm" className="text-xs gap-1" disabled={doc.status !== 'ready'}><Eye className="w-3 h-3" /> Előnézet</Button>
                <Button variant="outline" size="sm" className="text-xs gap-1" disabled={doc.status !== 'ready'}><Download className="w-3 h-3" /> Letöltés</Button>
                <Button variant="ghost" size="sm" className="text-xs gap-1"><RefreshCw className="w-3 h-3" /> Újra</Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
