import React, { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, FileText, Download, Upload, CheckCircle2, Clock,
  AlertTriangle, Search, Plus, Loader2, Send, XCircle, Filter
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import {
  usePayrollFilings, usePayrollCycles, usePayrollCalculations,
  usePayrollEmployees, type PayrollFiling
} from '@/hooks/usePayrollData';
import { useAccountyClients } from '@/hooks/useAccountyData';
import { generateFiling08Xml, downloadXml, type Filing08Data, type Filing08EmployeeLine } from '@/lib/payroll/filingGenerator';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

const FILING_TYPES: Record<string, { label: string; color: string; desc: string }> = {
  '08': { label: '08-as bevallás', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400', desc: 'Havi foglalkoztatói bevallás' },
  'M30': { label: 'M30 igazolás', color: 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-400', desc: 'Éves jövedelemigazolás' },
  '2108': { label: '21/08 összesítő', color: 'bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-400', desc: 'Éves összesítő bevallás' },
};

const STATUS_MAP: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  draft: { label: 'Tervezet', color: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400', icon: FileText },
  generated: { label: 'Generálva', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400', icon: Clock },
  submitted: { label: 'Beküldve', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400', icon: Send },
  accepted: { label: 'Elfogadva', color: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400', icon: CheckCircle2 },
  rejected: { label: 'Elutasítva', color: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400', icon: XCircle },
  error: { label: 'Hiba', color: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400', icon: AlertTriangle },
};

const MONTHS = ['Jan', 'Feb', 'Már', 'Ápr', 'Máj', 'Jún', 'Júl', 'Aug', 'Szep', 'Okt', 'Nov', 'Dec'];

export default function FilingsPage() {
  const { id: companyId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [generating, setGenerating] = useState(false);
  const [genYear, setGenYear] = useState(new Date().getFullYear());
  const [genMonth, setGenMonth] = useState(new Date().getMonth() + 1);
  const [showGenPanel, setShowGenPanel] = useState(false);

  const { data: filings = [], isLoading } = usePayrollFilings(companyId || '');
  const { data: cycles = [] } = usePayrollCycles(companyId || '');
  const { data: employees = [] } = usePayrollEmployees(companyId || '');
  const { data: clients } = useAccountyClients();

  const company = useMemo(() => clients?.find(c => c.id === companyId), [clients, companyId]);

  // Filter filings
  const filteredFilings = useMemo(() => {
    let result = [...filings];
    if (filterType !== 'all') result = result.filter(f => f.filing_type === filterType);
    if (filterStatus !== 'all') result = result.filter(f => f.status === filterStatus);
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(f =>
        f.filing_type.toLowerCase().includes(q) ||
        f.nav_receipt_id?.toLowerCase().includes(q) ||
        `${f.period_year}/${f.period_month}`.includes(q)
      );
    }
    return result;
  }, [filings, filterType, filterStatus, searchQuery]);

  // Stats
  const stats = useMemo(() => ({
    total: filings.length,
    accepted: filings.filter(f => f.status === 'accepted').length,
    pending: filings.filter(f => f.status === 'submitted' || f.status === 'generated').length,
    draft: filings.filter(f => f.status === 'draft').length,
  }), [filings]);

  // Generate 08-as filing
  const handleGenerate08 = async () => {
    if (!companyId) return;
    setGenerating(true);

    try {
      // Find matching cycle
      const cycle = cycles.find(c => c.year === genYear && c.month === genMonth);
      if (!cycle) {
        toast({ variant: 'destructive', title: 'Hiba', description: `Nincs ${genYear}/${genMonth} havi ciklus.` });
        setGenerating(false);
        return;
      }

      // Fetch calculations for this cycle
      const { data: calcs, error: calcErr } = await supabase
        .from('accounty_payroll_calculations')
        .select('*')
        .eq('cycle_id', cycle.id);

      if (calcErr) throw calcErr;
      if (!calcs || calcs.length === 0) {
        toast({ variant: 'destructive', title: 'Hiba', description: 'Nincs számfejtés ehhez a ciklushoz. Először futtasd le a számfejtést.' });
        setGenerating(false);
        return;
      }

      // Build employee lines from calculations
      const empLines: Filing08EmployeeLine[] = (calcs as any[]).map((calc) => {
        const meta = calc.metadata as any;
        const emp = employees.find(e => e.id === meta?.employee_id);

        return {
          tajNumber: emp?.taj_number || '000-000-000',
          taxId: emp?.tax_id || '0000000000',
          lastName: emp?.last_name || meta?.employee_name?.split(' ')[0] || '–',
          firstName: emp?.first_name || meta?.employee_name?.split(' ').slice(1).join(' ') || '–',
          birthDate: emp?.birth_date || '1990-01-01',
          mothersName: emp?.mothers_name || '–',
          jobCode: '1101',
          insuranceStart: `${genYear}-${String(genMonth).padStart(2, '0')}-01`,
          weeklyHours: 40,
          grossSalary: calc.gross_salary || 0,
          taxBase: calc.szja_base || calc.gross_salary || 0,
          szjaAmount: calc.szja_amount || 0,
          tbBase: calc.gross_salary || 0,
          tbAmount: calc.tb_amount || 0,
          szochoBase: calc.gross_salary || 0,
          szochoAmount: calc.szocho_amount || 0,
          familyCreditUsed: 0,
          under25CreditUsed: 0,
          newMotherCreditUsed: 0,
          szochoCreditUsed: 0,
          netSalary: calc.net_salary || 0,
        };
      });

      const filingData: Filing08Data = {
        companyName: company?.name || 'Ismeretlen',
        companyTaxNumber: company?.taxNumber || '00000000-0-00',
        companyAddress: '–',
        year: genYear,
        month: genMonth,
        totalGrossSalary: empLines.reduce((s, e) => s + e.grossSalary, 0),
        totalSzja: empLines.reduce((s, e) => s + e.szjaAmount, 0),
        totalTb: empLines.reduce((s, e) => s + e.tbAmount, 0),
        totalSzocho: empLines.reduce((s, e) => s + e.szochoAmount, 0),
        totalEho: 0,
        employees: empLines,
        filingType: 'normal',
        submittedBy: 'Accounty',
        submittedAt: new Date().toISOString(),
      };

      const xml = generateFiling08Xml(filingData);

      // Save to DB
      const { error: saveErr } = await supabase
        .from('accounty_filings')
        .insert({
          company_id: companyId,
          filing_type: '08',
          period_year: genYear,
          period_month: genMonth,
          status: 'generated',
          xml_data: xml,
          channel: 'manual',
        });

      if (saveErr) throw saveErr;

      // Download XML
      downloadXml(xml, `NAV_08_${company?.name?.replace(/\s/g, '_') || 'ceg'}_${genYear}_${String(genMonth).padStart(2, '0')}.xml`);

      toast({ title: 'Siker', description: '08-as bevallás generálva és letöltve.' });
      setShowGenPanel(false);
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Generálási hiba', description: err.message });
    } finally {
      setGenerating(false);
    }
  };

  if (isLoading) {
    return (
      <div className="w-full space-y-6 animate-in fade-in">
        <div className="h-8 w-64 bg-slate-200 dark:bg-slate-800 rounded animate-pulse" />
        <div className="grid grid-cols-4 gap-4">
          {[0, 1, 2, 3].map(i => <div key={i} className="h-24 bg-slate-200 dark:bg-slate-800 rounded-xl animate-pulse" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="w-full space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(`/accounty/payroll/${companyId}`)} className="h-9 w-9">
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">NAV Bevallások</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">{company?.name || '–'}</p>
          </div>
        </div>
        <Button
          onClick={() => setShowGenPanel(!showGenPanel)}
          className="bg-primary hover:bg-primary/90 text-primary-foreground flex items-center gap-2"
        >
          <Plus className="w-4 h-4" /> Új bevallás
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Összes', value: stats.total, icon: FileText, color: 'text-slate-600', bg: 'bg-slate-100 dark:bg-slate-800' },
          { label: 'Elfogadva', value: stats.accepted, icon: CheckCircle2, color: 'text-green-600', bg: 'bg-green-50 dark:bg-green-900/20' },
          { label: 'Függőben', value: stats.pending, icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-900/20' },
          { label: 'Tervezet', value: stats.draft, icon: FileText, color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-900/20' },
        ].map((s) => (
          <div key={s.label} className="bg-card rounded-xl border border-border shadow-soft p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-slate-500 uppercase">{s.label}</span>
              <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center', s.bg)}>
                <s.icon className={cn('w-4 h-4', s.color)} />
              </div>
            </div>
            <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Generate panel */}
      {showGenPanel && (
        <div className="bg-card rounded-xl border border-primary/30 shadow-soft p-6 animate-in slide-in-from-top-4 duration-300">
          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-4">08-as bevallás generálása</h3>
          <div className="grid grid-cols-3 gap-4 items-end">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Év</label>
              <select value={genYear} onChange={(e) => setGenYear(parseInt(e.target.value))} className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm">
                {[2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Hónap</label>
              <select value={genMonth} onChange={(e) => setGenMonth(parseInt(e.target.value))} className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm">
                {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
              </select>
            </div>
            <Button
              onClick={handleGenerate08}
              disabled={generating}
              className="bg-primary hover:bg-primary/90 text-primary-foreground flex items-center gap-2"
            >
              {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              {generating ? 'Generálás...' : 'Generálás + Letöltés'}
            </Button>
          </div>
          <p className="text-xs text-slate-500 mt-3">
            A generálás a kiválasztott ciklus számfejtett eredményeiből állítja elő az XML-t.
          </p>
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            placeholder="Keresés..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 bg-card border-border text-sm"
          />
        </div>
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="rounded-lg border border-border bg-card px-3 py-2 text-sm"
        >
          <option value="all">Minden típus</option>
          {Object.entries(FILING_TYPES).map(([key, val]) => (
            <option key={key} value={key}>{val.label}</option>
          ))}
        </select>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="rounded-lg border border-border bg-card px-3 py-2 text-sm"
        >
          <option value="all">Minden státusz</option>
          {Object.entries(STATUS_MAP).map(([key, val]) => (
            <option key={key} value={key}>{val.label}</option>
          ))}
        </select>
      </div>

      {/* Filings table */}
      <div className="bg-card rounded-xl border border-border shadow-soft overflow-hidden">
        {filteredFilings.length === 0 ? (
          <div className="py-16 text-center">
            <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto mb-4">
              <FileText className="w-8 h-8 text-slate-400 dark:text-slate-500" />
            </div>
            <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
              {filterType !== 'all' || filterStatus !== 'all' || searchQuery
                ? 'Nincs bevallás a szűrési feltételeknek'
                : 'Még nincsenek bevallások'}
            </p>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1 max-w-sm mx-auto">
              {filterType !== 'all' || filterStatus !== 'all' || searchQuery
                ? 'Próbáld módosítani a szűrőket, vagy töröld a keresést.'
                : 'A 08-as bevallást a számfejtett ciklus alapján generálhatod.'}
            </p>
            {!(filterType !== 'all' || filterStatus !== 'all' || searchQuery) && (
              <Button
                onClick={() => setShowGenPanel(true)}
                className="mt-4 bg-primary hover:bg-primary/90 text-primary-foreground"
              >
                <Plus className="w-4 h-4 mr-2" />
                Első bevallás generálása
              </Button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-slate-50/50 dark:bg-slate-900/30">
                  <th className="px-5 py-3 text-left text-xs font-medium text-slate-500 uppercase">Típus</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-slate-500 uppercase">Időszak</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-slate-500 uppercase">Státusz</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-slate-500 uppercase">NAV azonosító</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-slate-500 uppercase">Beküldve</th>
                  <th className="px-5 py-3 text-right text-xs font-medium text-slate-500 uppercase">Műveletek</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {filteredFilings.map((filing) => {
                  const typeInfo = FILING_TYPES[filing.filing_type] || { label: filing.filing_type, color: 'bg-slate-100 text-slate-600', desc: '' };
                  const statusInfo = STATUS_MAP[filing.status] || STATUS_MAP.draft;
                  const StatusIcon = statusInfo.icon;

                  return (
                    <tr key={filing.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                      <td className="px-5 py-3">
                        <span className={cn('px-2.5 py-1 rounded-full text-[10px] font-bold uppercase', typeInfo.color)}>
                          {typeInfo.label}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-sm text-slate-900 dark:text-slate-100 font-mono">
                        {filing.period_year}/{filing.period_month ? String(filing.period_month).padStart(2, '0') : filing.period_quarter ? `Q${filing.period_quarter}` : '–'}
                      </td>
                      <td className="px-5 py-3">
                        <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase', statusInfo.color)}>
                          <StatusIcon className="w-3 h-3" />
                          {statusInfo.label}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-xs font-mono text-slate-500">
                        {filing.nav_receipt_id || '–'}
                      </td>
                      <td className="px-5 py-3 text-xs text-slate-500">
                        {filing.submitted_at ? new Date(filing.submitted_at).toLocaleDateString('hu-HU') : '–'}
                      </td>
                      <td className="px-5 py-3 text-right">
                        {filing.xml_data && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              downloadXml(
                                filing.xml_data!,
                                `NAV_${filing.filing_type}_${filing.period_year}_${String(filing.period_month || 0).padStart(2, '0')}.xml`
                              );
                            }}
                            className="h-7 px-2 text-xs"
                          >
                            <Download className="w-3 h-3 mr-1" /> XML
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
