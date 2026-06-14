import React, { useState, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import {
  ArrowLeft, FileText, Send, Clock, CheckCircle, Eye, 
  Mail, RefreshCw, Loader2, Database, Shield
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useAccountyDocuments, useAccountyClients, type AccountyDocument } from '@/hooks/useAccountyData';
import { usePayrollCalculations, usePayrollCycles } from '@/hooks/usePayrollData';
import { useToast } from '@/hooks/use-toast';
import { getPayslipPreviewUrl, type PayslipPdfData } from '@/lib/payslipPdf';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';

export default function EPayslipPortalPage() {
  const { id } = useParams<{ id: string }>();
  const [sending, setSending] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewTitle, setPreviewTitle] = useState('');
  const { toast } = useToast();

  const { data: docs, isLoading } = useAccountyDocuments(id || '', 'payslip');
  const { data: clients } = useAccountyClients();
  const company = useMemo(() => clients?.find(c => c.id === id), [clients, id]);
  const { data: cycles = [] } = usePayrollCycles(id || '');

  const currentCycle = useMemo(() => {
    const now = new Date();
    return cycles.find(c => c.year === now.getFullYear() && c.month === now.getMonth() + 1) || cycles[0];
  }, [cycles]);

  const { data: calculations = [] } = usePayrollCalculations(currentCycle?.id || '');

  const slips = docs || [];
  const queryClient = useQueryClient();

  const toggleSelect = (docId: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(docId) ? next.delete(docId) : next.add(docId);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedIds.size === slips.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(slips.map(e => e.id)));
  };

  const sentCount = slips.filter(e => e.status === 'sent').length;
  const generatedCount = slips.filter(e => e.status === 'generated').length;

  // Build payslip data from calculation for a given document
  const getPayslipData = (slip: AccountyDocument): PayslipPdfData | null => {
    const calc = calculations.find(c => {
      const meta = c.metadata as any;
      return meta?.employee_id === slip.employeeId || c.employment_id === slip.employeeId;
    });

    if (!calc) {
      return {
        employeeName: slip.title.replace(' - Bérjegyzék', ''),
        period: slip.period,
        grossSalary: 0, szjaAmount: 0, tbAmount: 0, szochoAmount: 0,
        netSalary: 0, totalDeductions: 0,
        companyName: company?.name,
      };
    }

    const meta = calc.metadata as any;
    return {
      employeeName: meta?.employee_name || slip.title.replace(' - Bérjegyzék', ''),
      period: slip.period,
      grossSalary: calc.gross_salary || 0,
      szjaAmount: calc.szja_amount || 0,
      tbAmount: calc.tb_amount || 0,
      szochoAmount: calc.szocho_amount || 0,
      netSalary: calc.net_salary || 0,
      totalDeductions: calc.total_deductions || 0,
      companyName: company?.name,
    };
  };

  return (
    <div className="w-full max-w-5xl mx-auto space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => window.history.back()} className="p-2 rounded-lg hover:bg-muted transition-colors"><ArrowLeft className="w-5 h-5" /></button>
          <div className="p-2.5 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl shadow-lg shadow-blue-500/25"><Mail className="w-5 h-5 text-white" /></div>
          <div>
            <h1 className="text-2xl font-bold">E-bérjegyzék portál</h1>
            <p className="text-sm text-slate-500">Elektronikus bérjegyzék hozzáférhetővé tétel — Mt. 155. § (3)</p>
          </div>
        </div>
        <Button onClick={async () => {
          setSending(true);
          try {
            const idsToSend = selectedIds.size > 0 ? Array.from(selectedIds) : slips.map(s => s.id);
            const { error } = await supabase
              .from('accounty_documents')
              .update({ status: 'sent', updated_at: new Date().toISOString() })
              .in('id', idsToSend);
            if (error) throw error;
            queryClient.invalidateQueries({ queryKey: ['accounty-documents'] });
            toast({ title: 'E-bérjegyzékek kiküldve', description: `${idsToSend.length} bérjegyzék elküldve.` });
            setSelectedIds(new Set());
          } catch (err: any) {
            toast({ variant: 'destructive', title: 'Hiba', description: err.message });
          } finally {
            setSending(false);
          }
        }} disabled={sending || slips.length === 0} className="gap-1.5 bg-blue-600 hover:bg-blue-700">
          {sending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          {sending ? 'Küldés...' : `Kiküldés (${selectedIds.size || 'mind'})`}
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-32 gap-2 text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin" /> Betöltés...</div>
      ) : slips.length === 0 ? (
        <div className="bg-card rounded-xl border border-border p-12 text-center space-y-3">
          <Database className="w-10 h-10 mx-auto text-slate-400" />
          <p className="text-sm text-slate-500">Nincsenek bérjegyzékek a portálon.</p>
          <p className="text-xs text-slate-400">Először generálja a bérjegyzékeket a Bérjegyzék generálás oldalon.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-card rounded-xl border border-border p-4 text-center"><p className="text-2xl font-bold text-slate-700">{slips.length}</p><p className="text-xs text-slate-500">Összes</p></div>
            <div className="bg-card rounded-xl border border-border p-4 text-center"><p className="text-2xl font-bold text-blue-600">{generatedCount}</p><p className="text-xs text-slate-500">Generálva</p></div>
            <div className="bg-card rounded-xl border border-border p-4 text-center"><p className="text-2xl font-bold text-emerald-600">{sentCount}</p><p className="text-xs text-slate-500">Kiküldve</p></div>
          </div>

          <div className="bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 rounded-xl p-4 text-sm text-blue-800 dark:text-blue-300">
            <Shield className="w-4 h-4 inline mr-1" />
            <strong>Titkosított hozzáférés:</strong> A bérjegyzékek jelszóval védett PDF formátumban érhetők el. Jelszó: TAJ szám utolsó 6 számjegye.
          </div>

          <div className="bg-card rounded-xl border border-border shadow-soft overflow-hidden">
            <div className="px-5 py-3 border-b border-border dark:bg-slate-900/30">
              <h2 className="text-sm font-bold text-slate-700 dark:text-slate-300">Bérjegyzék hozzáférés státusz</h2>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="px-5 py-2"><input type="checkbox" checked={selectedIds.size === slips.length} onChange={toggleAll} className="rounded" /></th>
                  <th className="text-left px-3 py-2 text-xs font-bold text-slate-500">Dokumentum</th>
                  <th className="text-left px-3 py-2 text-xs font-bold text-slate-500">Időszak</th>
                  <th className="text-center px-3 py-2 text-xs font-bold text-slate-500">Státusz</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {slips.map(slip => {
                  const payslipData = getPayslipData(slip);
                  return (
                    <tr key={slip.id} className="border-b border-border/50 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                      <td className="px-5 py-2.5"><input type="checkbox" checked={selectedIds.has(slip.id)} onChange={() => toggleSelect(slip.id)} className="rounded" /></td>
                      <td className="px-3 py-2.5 font-medium">{slip.title}</td>
                      <td className="px-3 py-2.5 text-xs text-slate-500">{slip.period}</td>
                      <td className="px-3 py-2.5 text-center">
                        {slip.status === 'sent' ? <CheckCircle className="w-4 h-4 text-emerald-500 mx-auto" /> :
                         slip.status === 'generated' ? <span className="text-xs text-blue-600">Generálva</span> :
                         <Clock className="w-4 h-4 text-slate-300 mx-auto" />}
                      </td>
                      <td className="px-3 py-2.5">
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => {
                          if (!payslipData) return;
                          const url = getPayslipPreviewUrl(payslipData);
                          setPreviewTitle(slip.title);
                          setPreviewUrl(url);
                        }}><Eye className="w-3 h-3" /></Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      <Dialog open={!!previewUrl} onOpenChange={(open) => !open && setPreviewUrl(null)}>
        <DialogContent className="max-w-5xl h-[90vh] flex flex-col p-0 gap-0">
          <DialogHeader className="px-6 py-4 border-b border-border">
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-blue-500" />
              {previewTitle}
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 w-full bg-slate-200 dark:bg-slate-900">
            {previewUrl && (
              <iframe src={previewUrl} className="w-full h-full border-0" title="Bérjegyzék megtekintő" />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
