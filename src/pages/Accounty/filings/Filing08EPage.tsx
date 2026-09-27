import React, { useState, useMemo, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, FileText, Plus, Trash2, Save, CheckCircle, AlertTriangle,
  Clock, Send, Loader2, Database, X, ExternalLink, Download, Printer, ShieldCheck
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DatePicker } from '@/components/ui/date-picker';
import { ExportButton } from '@/components/accounty/ExportButton';
import { cn } from '@/lib/utils';
import { usePayrollEmployees } from '@/hooks/usePayrollData';
import { useAccountyClients } from '@/hooks/accounty';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { UnifiedPagination } from '@/components/ui/unified-pagination';
import { FinancialPageSkeleton } from '@/components/ui/financial-skeleton';
import { generate08EXml, type XmlExport08EItem } from '@/lib/payroll/xmlGenerator';
import {
  generateRegistrationCertificatePdf,
  previewPdfInNewTab,
  downloadPdf
} from '@/lib/payroll/tbCertificatesPdf';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog';

const CHANGE_CODES = [
  { code: '01', label: 'Biztosítási jogviszony kezdete (munkába lépés előtt)', type: 'bejelentes' as const },
  { code: '02', label: 'Jogviszony megszűnése (8-15 nap)', type: 'kijelentes' as const },
  { code: '03', label: 'Heti munkaidő változás', type: 'valtozas' as const },
  { code: '04', label: 'FEOR-kód változás', type: 'valtozas' as const },
  { code: '05', label: 'Munkáltató személyében bekövetkezett változás', type: 'valtozas' as const },
  { code: '06', label: 'Munkavégzés helye szerinti telephely változás', type: 'valtozas' as const },
  { code: '07', label: 'Biztosítás szünetelése (fizetés nélküli szabadság)', type: 'valtozas' as const },
  { code: '08', label: 'Biztosítás szünetelésének vége', type: 'valtozas' as const },
];

const TYPE_LABELS: Record<string, { label: string; color: string }> = {
  bejelentes: { label: 'Bejelentés', color: 'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400' },
  valtozas: { label: 'Változás', color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-500/20 dark:text-yellow-400' },
  kijelentes: { label: 'Kijelentés', color: 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400' },
};

const STATUS_BADGE: Record<string, { label: string; color: string }> = {
  draft: { label: 'Piszkozat', color: 'bg-muted text-muted-foreground dark:bg-muted dark:text-muted-foreground' },
  ready: { label: 'Beküldésre kész', color: 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400' },
  sent: { label: 'Beküldve / Visszaigazolva', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400' },
};

interface Row08E {
  id?: string;
  employeeId?: string;
  receiptId?: string;
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
  const { companyId } = useParams<{ companyId: string }>();
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

  // Receipt entry modal state
  const [receiptModalRow, setReceiptModalRow] = useState<Row08E | null>(null);
  const [receiptNumberInput, setReceiptNumberInput] = useState('');
  const [receiptDateInput, setReceiptDateInput] = useState(new Date().toISOString().slice(0, 10));
  const [savingReceipt, setSavingReceipt] = useState(false);

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

  // Fetch employments for FEOR and job codes
  const [employments, setEmployments] = useState<any[]>([]);
  useEffect(() => {
    if (!companyId) return;
    supabase
      .from('accounty_employments')
      .select('*')
      .eq('company_id', companyId)
      .then(({ data }) => { if (data) setEmployments(data); });
  }, [companyId]);

  // Parse rows from all 08e filings
  const rows: Row08E[] = useMemo(() => {
    return filings
      .filter((f: any) => {
        if (typeof f.xml_data === 'string' && f.xml_data.trim().startsWith('<?xml')) return false;
        return true;
      })
      .map((f: any) => {
        const meta = typeof f.xml_data === 'string' ? (() => { try { return JSON.parse(f.xml_data); } catch { return {}; } })() : {};
        return {
          id: f.id,
          employeeId: meta.employeeId || '',
          receiptId: f.nav_receipt_id || meta.receiptId || '',
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

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  useEffect(() => {
    setCurrentPage(1);
  }, [rows.length]);

  const totalItems = rows.length;
  const totalPages = Math.ceil(totalItems / pageSize);

  const paginatedRows = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return rows.slice(start, start + pageSize);
  }, [rows, currentPage, pageSize]);

  const handleAddRow = async () => {
    if (!companyId || !newRow.employeeId) {
      toast({ variant: 'destructive', title: 'Hiba', description: 'Válassz ki egy foglalkoztatottat.' });
      return;
    }
    setSaving(true);
    const emp = employees.find(e => e.id === newRow.employeeId);
    const employment = employments.find(e => e.employee_id === newRow.employeeId);
    const changeInfo = CHANGE_CODES.find(c => c.code === newRow.changeCode);

    const rowData = {
      employeeId: newRow.employeeId,
      name: `${emp?.last_name || ''} ${emp?.first_name || ''}`.trim(),
      tajNumber: emp?.taj_number || '–',
      changeType: changeInfo?.type || 'bejelentes',
      changeCode: newRow.changeCode,
      effectiveDate: newRow.effectiveDate,
      feor: employment?.feor_code || '4112',
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

      toast({ title: 'Beküldve', description: `${draftIds.length} db bejelentés beküldve a NAV-nak.` });
      queryClient.invalidateQueries({ queryKey: ['filings-08e', companyId] });
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Hiba', description: err.message });
    } finally {
      setSubmitting(false);
    }
  };

  // 1-Click Print Tbj. 74. § Registration Certificate PDF
  const handlePrintRegistrationCert = (row: Row08E) => {
    const emp = employees.find(e => e.taj_number === row.tajNumber || `${e.last_name} ${e.first_name}`.trim() === row.name);
    const employment = employments.find(e => e.employee_id === emp?.id || e.employee_id === row.employeeId);

    const pdfDoc = generateRegistrationCertificatePdf({
      company: {
        name: company?.name || 'Munkáltató Kft.',
        taxNumber: company?.taxNumber || '12345678-2-42',
        address: company?.address || '',
        kshNumber: (company as any)?.ksh_number || '',
      },
      employee: {
        name: row.name,
        birthName: emp?.birth_name || row.name,
        motherName: emp?.mother_name || '',
        birthPlace: emp?.birth_place || '',
        birthDate: emp?.birth_date || '',
        taxId: emp?.tax_id || '',
        tajNumber: row.tajNumber,
        address: emp?.address || '',
      },
      employment: {
        startDate: row.effectiveDate,
        jobTitle: employment?.job_title || 'Munkavállaló',
        feorCode: row.feor || '4112',
        jobCode: employment?.job_code || '1101',
        jobSerialNumber: employment?.job_serial_number || 1,
        weeklyHours: row.weeklyHours,
        baseSalary: Number(employment?.base_salary || 0),
        receiptNumber08E: row.receiptId || null,
        filingDate08E: row.status === 'sent' ? row.effectiveDate : null,
      },
    });

    previewPdfInNewTab(pdfDoc);
  };

  // Download single 08E XML
  const handleDownloadSingle08EXml = (row: Row08E) => {
    const emp = employees.find(e => e.taj_number === row.tajNumber || `${e.last_name} ${e.first_name}`.trim() === row.name);
    const employment = employments.find(e => e.employee_id === emp?.id || e.employee_id === row.employeeId);

    const item: XmlExport08EItem = {
      employee: {
        lastName: emp?.last_name || row.name.split(' ')[0] || '',
        firstName: emp?.first_name || row.name.split(' ').slice(1).join(' ') || '',
        birthName: emp?.birth_name || row.name,
        motherName: emp?.mother_name || '',
        birthPlace: emp?.birth_place || '',
        birthDate: emp?.birth_date || '',
        taxId: emp?.tax_id || '',
        tajNumber: row.tajNumber,
      },
      changeCode: row.changeCode,
      jobCode: employment?.job_code || '1101',
      jobSerialNumber: employment?.job_serial_number || 1,
      feorCode: row.feor,
      weeklyHours: row.weeklyHours,
      effectiveDate: row.effectiveDate,
      isPensioner: !!employment?.is_pensioner,
    };

    generate08EXml({
      company: {
        name: company?.name || 'ceg',
        taxNumber: company?.taxNumber || '12345678-2-42',
        address: company?.address || '',
      },
      items: [item],
    });

    toast({ title: '08E XML letöltve', description: `${row.name} bejelentő XML fájlja elkészült.` });
  };

  // Download batch 08E XML for all draft/ready rows
  const handleDownloadAll08EXml = () => {
    if (rows.length === 0) {
      toast({ title: 'Nincs bejelentés', description: 'Nincsenek sorok az XML generáláshoz.' });
      return;
    }

    const items: XmlExport08EItem[] = rows.map(r => {
      const emp = employees.find(e => e.taj_number === r.tajNumber || `${e.last_name} ${e.first_name}`.trim() === r.name);
      const employment = employments.find(e => e.employee_id === emp?.id || e.employee_id === r.employeeId);

      return {
        employee: {
          lastName: emp?.last_name || r.name.split(' ')[0] || '',
          firstName: emp?.first_name || r.name.split(' ').slice(1).join(' ') || '',
          birthName: emp?.birth_name || r.name,
          motherName: emp?.mother_name || '',
          birthPlace: emp?.birth_place || '',
          birthDate: emp?.birth_date || '',
          taxId: emp?.tax_id || '',
          tajNumber: r.tajNumber,
        },
        changeCode: r.changeCode,
        jobCode: employment?.job_code || '1101',
        jobSerialNumber: employment?.job_serial_number || 1,
        feorCode: r.feor,
        weeklyHours: r.weeklyHours,
        effectiveDate: r.effectiveDate,
        isPensioner: !!employment?.is_pensioner,
      };
    });

    generate08EXml({
      company: {
        name: company?.name || 'ceg',
        taxNumber: company?.taxNumber || '12345678-2-42',
        address: company?.address || '',
      },
      items,
    });

    toast({ title: '08E XML Csomag letöltve', description: `${items.length} db bejelentés letöltve egyben.` });
  };

  // Open Receipt Modal
  const openReceiptModal = (row: Row08E) => {
    setReceiptModalRow(row);
    setReceiptNumberInput(row.receiptId || `NAV-${Date.now().toString(36).toUpperCase()}`);
    setReceiptDateInput(new Date().toISOString().slice(0, 10));
  };

  // Save Receipt to DB
  const handleSaveReceipt = async () => {
    if (!receiptModalRow || !receiptModalRow.id) return;
    setSavingReceipt(true);

    try {
      // 1. Update accounty_filings
      const { error: fErr } = await supabase
        .from('accounty_filings')
        .update({
          status: 'submitted',
          nav_receipt_id: receiptNumberInput,
          submitted_at: receiptDateInput,
        })
        .eq('id', receiptModalRow.id);

      if (fErr) throw fErr;

      // 2. Update accounty_employments if employee matched
      const emp = employees.find(e => e.taj_number === receiptModalRow.tajNumber || `${e.last_name} ${e.first_name}`.trim() === receiptModalRow.name);
      if (emp) {
        await supabase
          .from('accounty_employments')
          .update({
            filing_08e_status: 'beadva',
            filing_08e_receipt_id: receiptNumberInput,
            filing_08e_date: receiptDateInput,
          })
          .eq('employee_id', emp.id);
      }

      toast({
        title: 'Nyugtaszám sikeresen rögzítve',
        description: `${receiptModalRow.name} 08E bejelentése lezárva. Nyugta: ${receiptNumberInput}`,
      });

      setReceiptModalRow(null);
      queryClient.invalidateQueries({ queryKey: ['filings-08e', companyId] });
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Hiba a mentéskor', description: err.message });
    } finally {
      setSavingReceipt(false);
    }
  };

  const activeEmployees = employees.filter(e => e.status === 'active');

  return (
    <div className="w-full max-w-6xl mx-auto space-y-6 page-animate">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => window.history.back()} className="p-2 rounded-lg hover:bg-muted transition-colors"><ArrowLeft className="w-5 h-5" /></button>
          <div className="p-2.5 bg-gradient-to-br from-blue-500 to-primary rounded-lg shadow-lg shadow-blue-500/25"><FileText className="w-5 h-5 text-white" /></div>
          <div>
            <h1 className="text-2xl font-bold">08E — Biztosítotti bejelentés</h1>
            <p className="text-sm text-muted-foreground">{company?.name || '–'} — Tbj. 74. § / Art. 50. § — Jogviszony kezdet, változás, szünetelés, kilépés</p>
          </div>
        </div>
        <div className="flex gap-2">
          <ExportButton
            filename={`08e_bejelentesek_${company?.name || 'ceg'}`}
            headers={['Név', 'TAJ', 'Típus', 'Kód', 'Hatály', 'FEOR', 'Óra/hét', 'Státusz']}
            getRows={() => rows.map(r => [r.name, r.tajNumber, TYPE_LABELS[r.changeType]?.label || r.changeType, r.changeCode, r.effectiveDate, r.feor, r.weeklyHours, STATUS_BADGE[r.status]?.label || r.status])}
            size="sm"
          />
          <Button onClick={handleDownloadAll08EXml} variant="outline" className="gap-1.5" size="sm">
            <Download className="w-4 h-4" /> 08E XML Letöltése
          </Button>
          <Button onClick={() => setShowAdd(!showAdd)} variant="outline" className="gap-1.5" size="sm">
            <Plus className="w-4 h-4" /> Sor hozzáadása
          </Button>
          <Button className="gap-1.5 bg-blue-600 hover:bg-blue-700" size="sm" onClick={handleNavSubmit} disabled={submitting}>
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            {submitting ? 'Beküldés...' : `Beküldés a NAV-nak (${rows.filter(r => r.status === 'draft').length})`}
          </Button>
        </div>
      </div>

      {/* Statutory Deadline & Rules Banner */}
      <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4 text-xs space-y-1.5 text-amber-900 dark:text-amber-200">
        <div className="flex items-center gap-2 font-bold text-sm">
          <AlertTriangle className="w-4 h-4 text-amber-600" />
          <span>Törvényi Bejelentési Szabályok és Határidők (Art. 50. § & Tbj. 74. §):</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2 pt-1 font-mono text-[11px]">
          <div className="bg-card/70 p-2 rounded border border-amber-500/20">
            <strong>01 Kezdet (Bejelentés):</strong> Legkésőbb a jogviszony első napján a munkába lépést megelőzően!
          </div>
          <div className="bg-card/70 p-2 rounded border border-amber-500/20">
            <strong>02 Kijelentés (Megszűnés):</strong> A jogviszony megszűnésétől számított 8 napon belül.
          </div>
          <div className="bg-card/70 p-2 rounded border border-amber-500/20">
            <strong>03-08 Változás / Szünetelés:</strong> A bekövetkezéstől számított 15 napon belül.
          </div>
        </div>
      </div>

      {/* Add row form */}
      {showAdd && (
        <div className="bg-card rounded-lg border border-primary/30 shadow-soft p-6 animate-in slide-in-from-top-4 duration-300 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold">Új 08E bejelentési sor rögzítése</h3>
            <button onClick={() => setShowAdd(false)} className="p-1 hover:bg-muted rounded"><X className="w-4 h-4" /></button>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Foglalkoztatott</label>
              <select value={newRow.employeeId} onChange={e => setNewRow(p => ({ ...p, employeeId: e.target.value }))} className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm">
                <option value="">Válassz...</option>
                {activeEmployees.map(e => <option key={e.id} value={e.id}>{e.last_name} {e.first_name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Változáskód</label>
              <select value={newRow.changeCode} onChange={e => setNewRow(p => ({ ...p, changeCode: e.target.value }))} className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm">
                {CHANGE_CODES.map(c => <option key={c.code} value={c.code}>{c.code} — {c.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Hatályba lépés dátuma</label>
              <DatePicker value={newRow.effectiveDate} onChange={val => setNewRow(p => ({ ...p, effectiveDate: val }))} placeholder="éééé. hh. nn." clearable className="w-full bg-card" />
            </div>
          </div>
          <Button onClick={handleAddRow} disabled={saving} className="bg-primary hover:bg-primary/90 text-primary-foreground flex items-center gap-2">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {saving ? 'Mentés...' : 'Sor mentése'}
          </Button>
        </div>
      )}

      {isLoading ? (
        <FinancialPageSkeleton title="08E bejelentések betöltése..." />
      ) : rows.length === 0 ? (
        <div className="bg-card rounded-lg border border-border p-12 text-center space-y-3">
          <Database className="w-10 h-10 mx-auto text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Nincs rögzített 08E sor.</p>
          <p className="text-xs text-muted-foreground">Új munkavállaló belépése vagy kilépése esetén adj hozzá új bejelentési sort.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Bejelentés (01)', count: rows.filter(r => r.changeType === 'bejelentes').length, color: 'text-green-600' },
              { label: 'Változás / Szünetelés (03-08)', count: rows.filter(r => r.changeType === 'valtozas').length, color: 'text-yellow-600' },
              { label: 'Kijelentés (02)', count: rows.filter(r => r.changeType === 'kijelentes').length, color: 'text-red-600' },
            ].map(c => (
              <div key={c.label} className="bg-card rounded-lg border border-border p-4 text-center">
                <p className={cn('text-2xl font-bold', c.color)}>{c.count}</p>
                <p className="text-xs text-muted-foreground">{c.label}</p>
              </div>
            ))}
          </div>

          <div className="bg-card rounded-lg border border-border shadow-soft overflow-hidden">
            <div className="px-5 py-3 border-b border-border flex items-center justify-between">
              <h2 className="text-sm font-bold text-foreground/90">08E Bejelentési tételek ({rows.length})</h2>
              <span className="text-xs text-muted-foreground">ÁNYK / ONYA kompatibilis XML & Tbj. 74. § igazolások</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="text-left px-5 py-2 text-xs font-bold text-muted-foreground">Munkavállaló</th>
                    <th className="text-center px-3 py-2 text-xs font-bold text-muted-foreground">Típus</th>
                    <th className="text-center px-3 py-2 text-xs font-bold text-muted-foreground">Kód</th>
                    <th className="text-center px-3 py-2 text-xs font-bold text-muted-foreground">Hatály</th>
                    <th className="text-center px-3 py-2 text-xs font-bold text-muted-foreground">FEOR</th>
                    <th className="text-center px-3 py-2 text-xs font-bold text-muted-foreground">Óra</th>
                    <th className="text-center px-3 py-2 text-xs font-bold text-muted-foreground">Nyugtaszám</th>
                    <th className="text-center px-3 py-2 text-xs font-bold text-muted-foreground">Státusz</th>
                    <th className="text-right px-4 py-2 text-xs font-bold text-muted-foreground">Műveletek</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedRows.map((row, idx) => (
                    <tr
                      key={idx}
                      className="border-b border-border/50 hover:bg-muted/40 transition-colors"
                    >
                      <td className="px-5 py-2.5">
                        <div>
                          <p className="font-medium text-foreground">{row.name}</p>
                          <p className="text-[10px] text-muted-foreground font-mono">{row.tajNumber}</p>
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        <span className={cn('px-2 py-0.5 rounded-full text-[10px] font-bold', TYPE_LABELS[row.changeType]?.color)}>
                          {TYPE_LABELS[row.changeType]?.label}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        <span className="font-mono bg-muted px-1.5 py-0.5 rounded text-xs">{row.changeCode}</span>
                      </td>
                      <td className="px-3 py-2.5 text-center text-xs font-mono">{row.effectiveDate}</td>
                      <td className="px-3 py-2.5 text-center text-xs font-mono">{row.feor}</td>
                      <td className="px-3 py-2.5 text-center text-xs">{row.weeklyHours}</td>
                      <td className="px-3 py-2.5 text-center text-xs font-mono">
                        {row.receiptId ? (
                          <span className="text-emerald-600 dark:text-emerald-400 font-semibold">{row.receiptId}</span>
                        ) : (
                          <span className="text-muted-foreground/60">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        <span className={cn('px-2 py-0.5 rounded-full text-[10px] font-bold', STATUS_BADGE[row.status]?.color)}>
                          {STATUS_BADGE[row.status]?.label}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-xs gap-1"
                            title="Tbj. 74. § Nyilvántartásba vételi igazolás PDF nyomtatása"
                            onClick={() => handlePrintRegistrationCert(row)}
                          >
                            <Printer className="w-3.5 h-3.5" /> Igazolás
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-xs gap-1"
                            title="08E XML letöltése ehhez a tételhez"
                            onClick={() => handleDownloadSingle08EXml(row)}
                          >
                            <Download className="w-3.5 h-3.5" /> XML
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className={cn('h-7 px-2 text-xs gap-1', row.status === 'sent' ? 'text-emerald-600' : 'text-blue-600')}
                            title="NAV nyugtaszám manuális rögzítése"
                            onClick={() => openReceiptModal(row)}
                          >
                            <ShieldCheck className="w-3.5 h-3.5" /> {row.status === 'sent' ? 'Módosít' : 'Nyugta'}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {totalPages > 1 && (
              <div className="border-t border-border px-4 py-3 bg-card">
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

      {/* Manual Receipt Modal */}
      <Dialog open={!!receiptModalRow} onOpenChange={(open) => { if (!open) setReceiptModalRow(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-emerald-600" />
              NAV 08E Nyugtaszám Rögzítése
            </DialogTitle>
            <DialogDescription>
              {receiptModalRow?.name} ({receiptModalRow?.tajNumber}) bejelentésének visszaigazolása
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                NAV Iktatószám / Nyugtaazonosító (Receipt ID)
              </label>
              <input
                type="text"
                value={receiptNumberInput}
                onChange={(e) => setReceiptNumberInput(e.target.value)}
                placeholder="pl. NAV-08E-2026-987654"
                className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                Beadás / Visszaigazolás dátuma
              </label>
              <DatePicker
                value={receiptDateInput}
                onChange={(val) => setReceiptDateInput(val)}
                className="w-full bg-card"
              />
            </div>
            <p className="text-[11px] text-muted-foreground">
              A nyugtaszám rögzítésével a tétel állapota 'Beadva / Visszaigazolva'-ra vált, és a munkavállaló jogviszonya hitelesített bejelentett státuszt kap a rendszerben.
            </p>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setReceiptModalRow(null)}>Mégse</Button>
            <Button onClick={handleSaveReceipt} disabled={savingReceipt || !receiptNumberInput.trim()} className="bg-emerald-600 hover:bg-emerald-700 gap-1.5">
              {savingReceipt ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {savingReceipt ? 'Mentés...' : 'Nyugtaszám Mentése'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
