import React, { useState, useMemo, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import {
  ArrowLeft, FileText, Send, Clock, CheckCircle, Eye, 
  Mail, RefreshCw, Loader2, Database, Shield
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import { useAccountyDocuments, useAccountyClients, type AccountyDocument } from '@/hooks/accounty';
import { usePayrollCalculations, usePayrollCycles } from '@/hooks/usePayrollData';
import { useToast } from '@/hooks/use-toast';
import { getPayslipPreviewUrl, type PayslipPdfData } from '@/lib/payslipPdf';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { UnifiedPagination } from '@/components/ui/unified-pagination';
import { FinancialPageSkeleton } from '@/components/ui/financial-skeleton';

export default function EPayslipPortalPage() {
  const { companyId } = useParams<{ companyId: string }>();
  const id = companyId;
   const [sending, setSending] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewTitle, setPreviewTitle] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
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
  const totalItems = slips.length;
  const totalPages = Math.ceil(totalItems / pageSize);

  const paginatedSlips = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return slips.slice(start, start + pageSize);
  }, [slips, currentPage, pageSize]);

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
    const cleanName = slip.title.replace(' - Bérjegyzék', '').replace(' - E-bérjegyzék', '').trim();
    const calc = calculations.find(c => {
      const meta = c.metadata as any;
      return (
        meta?.employee_id === slip.employeeId ||
        c.employment_id === slip.employeeId ||
        (meta?.employee_name && meta.employee_name.trim().toLowerCase() === cleanName.toLowerCase())
      );
    });

    if (!calc) {
      return {
        employeeName: cleanName,
        period: slip.period,
        grossSalary: 0, szjaAmount: 0, tbAmount: 0, szochoAmount: 0,
        netSalary: 0, totalDeductions: 0,
        companyName: company?.name,
      };
    }

    const meta = calc.metadata as any;
    return {
      employeeName: meta?.employee_name || cleanName,
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
    <div className="w-full max-w-5xl mx-auto space-y-6 page-animate">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => window.history.back()} className="p-2 rounded-lg hover:bg-muted transition-colors"><ArrowLeft className="w-5 h-5" /></button>
          <div className="p-2.5 bg-gradient-to-br from-blue-500 to-primary rounded-lg shadow-lg shadow-blue-500/25"><Mail className="w-5 h-5 text-white" /></div>
          <div>
            <h1 className="text-2xl font-bold">E-bérjegyzék portál</h1>
            <p className="text-sm text-muted-foreground">Elektronikus bérjegyzék hozzáférhetővé tétel — Mt. 155. § (3)</p>
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
        <FinancialPageSkeleton title="E-bérjegyzékek betöltése..." />
      ) : slips.length === 0 ? (
        <div className="bg-card rounded-lg border border-border p-12 text-center space-y-3">
          <Database className="w-10 h-10 mx-auto text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Nincsenek bérjegyzékek a portálon.</p>
          <p className="text-xs text-muted-foreground">Először generálja a bérjegyzékeket a Bérjegyzék generálás oldalon.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-card rounded-lg border border-border p-4 text-center"><p className="text-2xl font-bold text-foreground/90">{slips.length}</p><p className="text-xs text-muted-foreground">Összes</p></div>
            <div className="bg-card rounded-lg border border-border p-4 text-center"><p className="text-2xl font-bold text-blue-600">{generatedCount}</p><p className="text-xs text-muted-foreground">Generálva</p></div>
            <div className="bg-card rounded-lg border border-border p-4 text-center"><p className="text-2xl font-bold text-emerald-600">{sentCount}</p><p className="text-xs text-muted-foreground">Kiküldve</p></div>
          </div>

          <div className="bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 rounded-lg p-4 text-sm text-blue-800 dark:text-blue-300">
            <Shield className="w-4 h-4 inline mr-1" />
            <strong>Titkosított hozzáférés:</strong> A bérjegyzékek jelszóval védett PDF formátumban érhetők el. Jelszó: TAJ szám utolsó 6 számjegye.
          </div>

          <div className="bg-card rounded-lg border border-border shadow-soft overflow-hidden">
            <div className="px-5 py-3 border-b border-border dark:bg-card/30">
              <h2 className="text-sm font-bold text-foreground/90">Bérjegyzék hozzáférés státusz</h2>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="px-5 py-2"><Checkbox checked={selectedIds.size === slips.length && slips.length > 0} onCheckedChange={toggleAll} /></th>
                  <th className="text-left px-3 py-2 text-xs font-bold text-muted-foreground">Dokumentum</th>
                  <th className="text-left px-3 py-2 text-xs font-bold text-muted-foreground">Időszak</th>
                  <th className="text-center px-3 py-2 text-xs font-bold text-muted-foreground">Státusz</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {paginatedSlips.map(slip => {
                  const payslipData = getPayslipData(slip);
                  return (
                    <tr key={slip.id} className="border-b border-border/50 hover:bg-muted/50">
                      <td className="px-5 py-2.5"><Checkbox checked={selectedIds.has(slip.id)} onCheckedChange={() => toggleSelect(slip.id)} /></td>
                      <td className="px-3 py-2.5 font-medium">{slip.title}</td>
                      <td className="px-3 py-2.5 text-xs text-muted-foreground">{slip.period}</td>
                      <td className="px-3 py-2.5 text-center">
                        {slip.status === 'sent' ? <CheckCircle className="w-4 h-4 text-emerald-500 mx-auto" /> :
                         slip.status === 'generated' ? <span className="text-xs text-blue-600">Generálva</span> :
                         <Clock className="w-4 h-4 text-muted-foreground/60 mx-auto" />}
                      </td>
                      <td className="px-3 py-2.5">
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" title="Megtekintés" onClick={async () => {
                          if (!payslipData) return;
                          setPreviewTitle(slip.title);
                          const url = await getPayslipPreviewUrl(payslipData);
                          setPreviewUrl(url);
                        }}><Eye className="w-3 h-3" /></Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {totalPages > 1 && (
              <div className="border-t border-border px-5 py-3 bg-card">
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
        </>
      )}

      <Dialog open={!!previewUrl} onOpenChange={(open) => {
        if (!open) {
          if (previewUrl && previewUrl.startsWith('blob:')) {
            URL.revokeObjectURL(previewUrl);
          }
          setPreviewUrl(null);
        }
      }}>
        <DialogContent className="max-w-5xl h-[90vh] flex flex-col p-0 gap-0">
          <DialogHeader className="px-6 py-4 border-b border-border">
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-blue-500" />
              {previewTitle}
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 w-full bg-muted dark:bg-card">
            {previewUrl && (
              <iframe src={previewUrl} className="w-full h-full border-0" title="Bérjegyzék megtekintő" />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
