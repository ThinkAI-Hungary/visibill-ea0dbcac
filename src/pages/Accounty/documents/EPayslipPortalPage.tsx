import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft, FileText, Download, Eye, CheckCircle, Mail,
  Send, Users, Lock, Clock, AlertTriangle, Shield, RefreshCw
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface EPayslipEmployee {
  id: string;
  name: string;
  email: string;
  portalAccess: boolean;
  lastViewed: string | null;
  payslipReady: boolean;
  sentDate: string | null;
}

const MOCK_EMPLOYEES: EPayslipEmployee[] = [
  { id: '1', name: 'Nagy Anna', email: 'nagy.anna@email.hu', portalAccess: true, lastViewed: '2026-05-15', payslipReady: true, sentDate: '2026-06-10' },
  { id: '2', name: 'Kiss Béla', email: 'kiss.bela@email.hu', portalAccess: true, lastViewed: null, payslipReady: true, sentDate: '2026-06-10' },
  { id: '3', name: 'Tóth Éva', email: 'toth.eva@email.hu', portalAccess: false, lastViewed: null, payslipReady: true, sentDate: null },
  { id: '4', name: 'Szabó Péter', email: 'szabo.peter@email.hu', portalAccess: true, lastViewed: '2026-06-10', payslipReady: true, sentDate: '2026-06-10' },
  { id: '5', name: 'Horváth Dávid', email: '', portalAccess: false, lastViewed: null, payslipReady: false, sentDate: null },
];

export default function EPayslipPortalPage() {
  const { id } = useParams<{ id: string }>();
  const [employees, setEmployees] = useState(MOCK_EMPLOYEES);
  const [sending, setSending] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const toggleSelect = (empId: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(empId) ? next.delete(empId) : next.add(empId);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedIds.size === employees.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(employees.map(e => e.id)));
  };

  const readyCount = employees.filter(e => e.payslipReady).length;
  const sentCount = employees.filter(e => e.sentDate).length;
  const viewedCount = employees.filter(e => e.lastViewed && e.sentDate).length;

  const handleSendAll = () => {
    setSending(true);
    setTimeout(() => {
      setEmployees(prev => prev.map(e => selectedIds.has(e.id) || selectedIds.size === 0 ? { ...e, sentDate: new Date().toISOString().split('T')[0] } : e));
      setSending(false);
    }, 2000);
  };

  return (
    <div className="w-full max-w-5xl mx-auto space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link to={`/accounty/payroll/${id}/documents`} className="p-2 rounded-lg hover:bg-muted transition-colors"><ArrowLeft className="w-5 h-5" /></Link>
          <div className="p-2.5 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl shadow-lg shadow-blue-500/25"><Mail className="w-5 h-5 text-white" /></div>
          <div>
            <h1 className="text-2xl font-bold">E-bérjegyzék portál</h1>
            <p className="text-sm text-slate-500">Elektronikus bérjegyzék hozzáférhetővé tétel — Mt. 155. § (3)</p>
          </div>
        </div>
        <Button onClick={handleSendAll} disabled={sending} className="gap-1.5 bg-blue-600 hover:bg-blue-700">
          {sending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          {sending ? 'Küldés...' : `Kiküldés (${selectedIds.size || 'mind'})`}
        </Button>
      </div>

      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'Összes', value: employees.length, color: 'text-slate-700' },
          { label: 'Generálva', value: readyCount, color: 'text-blue-600' },
          { label: 'Kiküldve', value: sentCount, color: 'text-emerald-600' },
          { label: 'Megtekintve', value: viewedCount, color: 'text-violet-600' },
        ].map(s => (
          <div key={s.label} className="bg-card rounded-xl border border-border p-4 text-center">
            <p className={cn('text-2xl font-bold', s.color)}>{s.value}</p>
            <p className="text-xs text-slate-500">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 rounded-xl p-4 text-sm text-blue-800 dark:text-blue-300">
        <Shield className="w-4 h-4 inline mr-1" />
        <strong>Titkosított hozzáférés:</strong> A bérjegyzékek jelszóval védett PDF formátumban érhetők el a dolgozói portálon. A jelszó alapértelmezetten a TAJ szám utolsó 6 számjegye.
      </div>

      <div className="bg-card rounded-xl border border-border shadow-soft overflow-hidden">
        <div className="px-5 py-3 border-b border-border bg-slate-50/50 dark:bg-slate-900/30">
          <h2 className="text-sm font-bold text-slate-700 dark:text-slate-300">Bérjegyzék hozzáférés státusz</h2>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-slate-50/30">
              <th className="px-5 py-2"><input type="checkbox" checked={selectedIds.size === employees.length} onChange={toggleAll} className="rounded" /></th>
              <th className="text-left px-3 py-2 text-xs font-bold text-slate-500">Munkavállaló</th>
              <th className="text-left px-3 py-2 text-xs font-bold text-slate-500">E-mail</th>
              <th className="text-center px-3 py-2 text-xs font-bold text-slate-500">Portál</th>
              <th className="text-center px-3 py-2 text-xs font-bold text-slate-500">Kiküldve</th>
              <th className="text-center px-3 py-2 text-xs font-bold text-slate-500">Megtekintve</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {employees.map(emp => (
              <tr key={emp.id} className={cn('border-b border-border/50 hover:bg-slate-50 dark:hover:bg-slate-800/50', !emp.email && 'bg-yellow-50/30 dark:bg-yellow-500/5')}>
                <td className="px-5 py-2.5"><input type="checkbox" checked={selectedIds.has(emp.id)} onChange={() => toggleSelect(emp.id)} className="rounded" /></td>
                <td className="px-3 py-2.5 font-medium">{emp.name}</td>
                <td className="px-3 py-2.5 text-xs">{emp.email || <span className="text-red-500 flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> Hiányzik</span>}</td>
                <td className="px-3 py-2.5 text-center">{emp.portalAccess ? <CheckCircle className="w-4 h-4 text-emerald-500 mx-auto" /> : <Lock className="w-4 h-4 text-slate-300 mx-auto" />}</td>
                <td className="px-3 py-2.5 text-center text-xs">{emp.sentDate || '—'}</td>
                <td className="px-3 py-2.5 text-center">{emp.lastViewed ? <span className="text-xs text-emerald-600">{emp.lastViewed}</span> : <Clock className="w-4 h-4 text-slate-300 mx-auto" />}</td>
                <td className="px-3 py-2.5"><Button variant="ghost" size="sm" className="h-7 w-7 p-0"><Eye className="w-3 h-3" /></Button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
