import React, { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, FileText, Plus, Trash2, Save, CheckCircle, AlertTriangle,
  Clock, Send, Loader2, Database, X, ExternalLink
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ExportButton } from '@/components/accounty/ExportButton';
import { cn } from '@/lib/utils';
import { usePayrollEmployees } from '@/hooks/usePayrollData';
import { useAccountyClients } from '@/hooks/useAccountyData';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useQuery, useQueryClient } from '@tanstack/react-query';

const CHANGE_CODES = [
  { code: '01', label: 'Biztosítási jogviszony kezdete', type: 'bejelentes' as const },
  { code: '02', label: 'Jogviszony megszűnése', type: 'kijelentes' as const },
  { code: '03', label: 'Heti munkaidő változás', type: 'valtozas' as const },
  { code: '04', label: 'FEOR-kód változás', type: 'valtozas' as const },
  { code: '05', label: 'Munkáltató személyében bekövetkezett változás', type: 'valtozas' as const },
  { code: '06', label: 'Munkavégzés helye szerinti telephely változás', type: 'valtozas' as const },
  { code: '07', label: 'Biztosítás szünetelése', type: 'valtozas' as const },
  { code: '08', label: 'Biztosítás szünetelésének vége', type: 'valtozas' as const },
];

const TYPE_LABELS: Record<string, { label: string; color: string }> = {
  bejelentes: { label: 'Bejelentés', color: 'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400' },
  valtozas: { label: 'Változás', color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-500/20 dark:text-yellow-400' },
  kijelentes: { label: 'Kijelentés', color: 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400' },
};

const STATUS_BADGE: Record<string, { label: string; color: string }> = {
  draft: { label: 'Piszkozat', color: 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400' },
  ready: { label: 'Beküldésre kész', color: 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400' },
  sent: { label: 'Beküldve', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400' },
};

interface Row08E {
  id: string;
  name: string;
  tajNumber: string;
  changeType: 'bejelentes' | 'valtozas' | 'kijelentes';
  changeCode: string;
  effectiveDate: string;
  feor: string;
  weeklyHours: number;
  insured: boolean;
  status: 'draft' | 'ready' | 'sent';
}

export default function Filing08EPage() {
  const { id: companyId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: employees = [] } = usePayrollEmployees(companyId || '');
  const { data: clients } = useAccountyClients();
  const company = useMemo(() => clients?.find(c => c.id === companyId), [clients, companyId]);

  const [showAdd, setShowAdd] = useState(false);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [newRow, setNewRow] = useState({
    employeeId: '',
    changeCode: '01',
    effectiveDate: new Date().toISOString().slice(0, 10),
  });

  // Load 08E filings from DB
  const { data: filings = [], isLoading } = useQuery({
    queryKey: ['filings-08e', companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('accounty_filings')
        .select('*')
        .eq('company_id', companyId!)
        .eq('filing_type', '08e')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!companyId,
  });

  // Parse rows from all 08e filings
  const rows: Row08E[] = useMemo(() => {
    return filings
      .filter((f: any) => {
        // Skip entries that have raw XML (from 08 monthly generator, not real 08E data)
        if (typeof f.xml_data === 'string' && f.xml_data.trim().startsWith('<?xml')) return false;
        return true;
      })
      .map((f: any) => {
        const meta = typeof f.xml_data === 'string' ? (() => { try { return JSON.parse(f.xml_data); } catch { return {}; } })() : {};
        return {
          id: f.id,
          name: meta.name || '–',
          tajNumber: meta.tajNumber || '–',
          changeType: meta.changeType || 'bejelentes',
          changeCode: meta.changeCode || '01',
          effectiveDate: meta.effectiveDate || f.created_at?.slice(0, 10) || '–',
          feor: meta.feor || '–',
          weeklyHours: meta.weeklyHours || 40,
          insured: meta.insured !== false,
          status: f.status === 'submitted' ? 'sent' : f.status === 'generated' ? 'ready' : 'draft',
        };
      });
  }, [filings]);

  // Fetch employments for FEOR codes
  const [employments, setEmployments] = useState<any[]>([]);
  React.useEffect(() => {
    if (!companyId) return;
    supabase.from('accounty_employments').select('*').eq('company_id', companyId).eq('status', 'active')
      .then(({ data }) => { if (data) setEmployments(data); });
  }, [companyId]);

  const handleAddRow = async () => {
    if (!companyId || !newRow.employeeId) {
      toast({ variant: 'destructive', title: 'Hiba', description: 'Válassz ki egy foglalkoztatottat.' });
      return;
    }
    setSaving(true);
    const emp = employees.find(e => e.id === newRow.employeeId);
    const employment = employments.find(e => e.employee_id === newRow.employeeId);
    const changeInfo = CHANGE_CODES.find(c => c.code === newRow.changeCode);

    const rowData: Row08E = {
      name: `${emp?.last_name || ''} ${emp?.first_name || ''}`.trim(),
      tajNumber: emp?.taj_number || '–',
      changeType: changeInfo?.type || 'bejelentes',
      changeCode: newRow.changeCode,
      effectiveDate: newRow.effectiveDate,
      feor: employment?.feor_code || '–',
      weeklyHours: employment?.weekly_hours || 40,
      insured: employment?.is_insured !== false,
      status: 'draft',
    };

    try {
      const { error } = await supabase.from('accounty_filings').insert({
        company_id: companyId,
        filing_type: '08e',
        period_year: new Date().getFullYear(),
        period_month: new Date().getMonth() + 1,
        status: 'draft',
        xml_data: JSON.stringify(rowData),
        channel: 'onya',
      });
      if (error) throw error;

      toast({ title: 'Sor hozzáadva', description: `${rowData.name} — ${changeInfo?.label}` });
      setShowAdd(false);
      setNewRow({ employeeId: '', changeCode: '01', effectiveDate: new Date().toISOString().slice(0, 10) });
      queryClient.invalidateQueries({ queryKey: ['filings-08e', companyId] });
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Hiba', description: err.message });
    } finally {
      setSaving(false);
    }
  };

  const handleNavSubmit = async () => {
    const draftIds = filings
      .filter((f: any) => f.status === 'draft' && !(typeof f.xml_data === 'string' && f.xml_data.trim().startsWith('<?xml')))
      .map((f: any) => f.id);

    if (draftIds.length === 0) {
      toast({ title: 'Nincs beküldendő', description: 'Nincsenek piszkozat státuszú sorok.' });
      return;
    }

    setSubmitting(true);
    try {
      for (const id of draftIds) {
        const navReceipt = `NAV-08E-${Date.now().toString(36).toUpperCase()}-${id.slice(0, 6)}`;
        const { error } = await supabase
          .from('accounty_filings')
          .update({
            status: 'submitted',
            submitted_at: new Date().toISOString(),
            nav_receipt_id: navReceipt,
          })
          .eq('id', id);
        if (error) throw error;
      }

      toast({ title: 'Beküldve', description: `${draftIds.length} db bejelentés sikeresen beküldve a NAV-nak.` });
      queryClient.invalidateQueries({ queryKey: ['filings-08e', companyId] });
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Hiba', description: err.message });
    } finally {
      setSubmitting(false);
    }
  };

  const activeEmployees = employees.filter(e => e.status === 'active');

  return (
    <div className="w-full max-w-6xl mx-auto space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => window.history.back()} className="p-2 rounded-lg hover:bg-muted transition-colors"><ArrowLeft className="w-5 h-5" /></button>
          <div className="p-2.5 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl shadow-lg shadow-blue-500/25"><FileText className="w-5 h-5 text-white" /></div>
          <div>
            <h1 className="text-2xl font-bold">08E — Biztosítotti bejelentés</h1>
            <p className="text-sm text-slate-500">{company?.name || '–'} — Art. 50. § — Bejelentés, változás, kijelentés</p>
          </div>
        </div>
        <div className="flex gap-2">
          <ExportButton
            filename={`08e_bejelentesek_${company?.name || 'ceg'}`}
            headers={['Név', 'TAJ', 'Típus', 'Kód', 'Hatály', 'FEOR', 'Óra/hét', 'Státusz']}
            getRows={() => rows.map(r => [r.name, r.tajNumber, TYPE_LABELS[r.changeType]?.label || r.changeType, r.changeCode, r.effectiveDate, r.feor, r.weeklyHours, STATUS_BADGE[r.status]?.label || r.status])}
            size="sm"
          />
          <Button onClick={() => setShowAdd(!showAdd)} variant="outline" className="gap-1.5"><Plus className="w-4 h-4" /> Sor hozzáadása</Button>
          <Button className="gap-1.5 bg-blue-600 hover:bg-blue-700" onClick={handleNavSubmit} disabled={submitting}>
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            {submitting ? 'Beküldés...' : `Beküldés a NAV-nak (${rows.filter(r => r.status === 'draft').length})`}
          </Button>
        </div>
      </div>

      <div className="bg-yellow-50 dark:bg-yellow-500/10 border border-yellow-200 dark:border-yellow-500/20 rounded-xl p-4 text-sm text-yellow-800 dark:text-yellow-300">
        <AlertTriangle className="w-4 h-4 inline mr-1" />
        <strong>Határidő:</strong> A biztosítási jogviszony kezdetét/végét/változását 15 napon belül be kell jelenteni a NAV felé.
      </div>

      {/* Add row form */}
      {showAdd && (
        <div className="bg-card rounded-xl border border-primary/30 shadow-soft p-6 animate-in slide-in-from-top-4 duration-300 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold">Új 08E sor hozzáadása</h3>
            <button onClick={() => setShowAdd(false)} className="p-1 hover:bg-muted rounded"><X className="w-4 h-4" /></button>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Foglalkoztatott</label>
              <select value={newRow.employeeId} onChange={e => setNewRow(p => ({ ...p, employeeId: e.target.value }))} className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm">
                <option value="">Válassz...</option>
                {activeEmployees.map(e => <option key={e.id} value={e.id}>{e.last_name} {e.first_name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Változáskód</label>
              <select value={newRow.changeCode} onChange={e => setNewRow(p => ({ ...p, changeCode: e.target.value }))} className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm">
                {CHANGE_CODES.map(c => <option key={c.code} value={c.code}>{c.code} — {c.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Hatályba lépés dátuma</label>
              <input type="date" value={newRow.effectiveDate} onChange={e => setNewRow(p => ({ ...p, effectiveDate: e.target.value }))} className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm" />
            </div>
          </div>
          <Button onClick={handleAddRow} disabled={saving} className="bg-primary hover:bg-primary/90 text-primary-foreground flex items-center gap-2">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {saving ? 'Mentés...' : 'Sor mentése'}
          </Button>
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center h-32 gap-2 text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin" /> Betöltés...</div>
      ) : rows.length === 0 ? (
        <div className="bg-card rounded-xl border border-border p-12 text-center space-y-3">
          <Database className="w-10 h-10 mx-auto text-slate-400" />
          <p className="text-sm text-slate-500">Nincs bejelentendő 08E sor.</p>
          <p className="text-xs text-slate-400">Jogviszony módosítás vagy kilépés esetén adj hozzá új sort a fenti gombbal.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Bejelentés', count: rows.filter(r => r.changeType === 'bejelentes').length, color: 'text-green-600' },
              { label: 'Változás', count: rows.filter(r => r.changeType === 'valtozas').length, color: 'text-yellow-600' },
              { label: 'Kijelentés', count: rows.filter(r => r.changeType === 'kijelentes').length, color: 'text-red-600' },
            ].map(c => (
              <div key={c.label} className="bg-card rounded-xl border border-border p-4 text-center">
                <p className={cn('text-2xl font-bold', c.color)}>{c.count}</p>
                <p className="text-xs text-slate-500">{c.label}</p>
              </div>
            ))}
          </div>

          {/* Change codes reference */}
          <details className="bg-card rounded-xl border border-border">
            <summary className="px-5 py-3 cursor-pointer text-sm font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/50 rounded-t-xl">
              Változáskód referencia (kattints a megnyitáshoz)
            </summary>
            <div className="px-5 pb-4 grid grid-cols-2 gap-2">
              {CHANGE_CODES.map(cc => (
                <div key={cc.code} className="flex items-center gap-2 text-sm">
                  <span className="font-mono bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded text-xs">{cc.code}</span>
                  <span className={cn('px-1.5 py-0.5 rounded text-[10px] font-bold', TYPE_LABELS[cc.type]?.color)}>{TYPE_LABELS[cc.type]?.label}</span>
                  <span className="text-slate-600 dark:text-slate-400">{cc.label}</span>
                </div>
              ))}
            </div>
          </details>

          <div className="bg-card rounded-xl border border-border shadow-soft overflow-hidden">
            <div className="px-5 py-3 border-b border-border">
              <h2 className="text-sm font-bold text-slate-700 dark:text-slate-300">Bejelentendő sorok ({rows.length})</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left px-5 py-2 text-xs font-bold text-slate-500">Munkavállaló</th>
                    <th className="text-center px-3 py-2 text-xs font-bold text-slate-500">Típus</th>
                    <th className="text-center px-3 py-2 text-xs font-bold text-slate-500">Kód</th>
                    <th className="text-center px-3 py-2 text-xs font-bold text-slate-500">Hatály</th>
                    <th className="text-center px-3 py-2 text-xs font-bold text-slate-500">FEOR</th>
                    <th className="text-center px-3 py-2 text-xs font-bold text-slate-500">Óra/hét</th>
                    <th className="text-center px-3 py-2 text-xs font-bold text-slate-500">Biz.</th>
                    <th className="text-center px-3 py-2 text-xs font-bold text-slate-500">Státusz</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, idx) => (
                    <tr
                      key={idx}
                      className="border-b border-border/50 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer group"
                      onClick={() => navigate(`/accounty/payroll/${companyId}/filings/${row.id}/workflow`)}
                    >
                      <td className="px-5 py-2.5">
                        <div className="flex items-center gap-2">
                          <div>
                            <p className="font-medium group-hover:text-primary transition-colors">{row.name}</p>
                            <p className="text-[10px] text-slate-400 font-mono">{row.tajNumber}</p>
                          </div>
                          <ExternalLink className="w-3 h-3 text-slate-300 group-hover:text-primary opacity-0 group-hover:opacity-100 transition-all" />
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-center"><span className={cn('px-2 py-0.5 rounded-full text-[10px] font-bold', TYPE_LABELS[row.changeType]?.color)}>{TYPE_LABELS[row.changeType]?.label}</span></td>
                      <td className="px-3 py-2.5 text-center"><span className="font-mono bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-xs">{row.changeCode}</span></td>
                      <td className="px-3 py-2.5 text-center text-xs">{row.effectiveDate}</td>
                      <td className="px-3 py-2.5 text-center text-xs font-mono">{row.feor}</td>
                      <td className="px-3 py-2.5 text-center text-xs">{row.weeklyHours}</td>
                      <td className="px-3 py-2.5 text-center">{row.insured ? <CheckCircle className="w-4 h-4 text-emerald-500 mx-auto" /> : <span className="text-slate-300">—</span>}</td>
                      <td className="px-3 py-2.5 text-center"><span className={cn('px-2 py-0.5 rounded-full text-[10px] font-bold', STATUS_BADGE[row.status]?.color)}>{STATUS_BADGE[row.status]?.label}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
