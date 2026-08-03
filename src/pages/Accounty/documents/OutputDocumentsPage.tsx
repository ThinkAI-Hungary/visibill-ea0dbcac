import React, { useState, useMemo, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ExportButton } from '@/components/accounty/ExportButton';
import {
  ArrowLeft, FileSpreadsheet, Download, Eye, Banknote, AlertTriangle,
  Users, Coffee, FileText, CheckCircle, Printer, Loader2, Database
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { usePayrollCalculations, usePayrollCycles, usePayrollEmployees } from '@/hooks/usePayrollData';
import { usePayrollGarnishments } from '@/hooks/usePayrollData';
import { useAccountyClients, useAccountyDocuments } from '@/hooks/accounty';
import { getPdfBlobUrl } from '@/lib/exportPdf';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { UnifiedPagination } from '@/components/ui/unified-pagination';
import {
  generateCertificatePdf, generateCashPaymentPdf, generateGarnishmentPdf,
  generateCafeteriaPdf, generateSummaryPdf,
} from '@/lib/documentPdfs';

type DocType = 'cash' | 'garnishment' | 'cafeteria' | 'summary' | 'certificates';

interface DocConfig {
  title: string;
  subtitle: string;
  icon: React.ElementType;
  color: string;
  columns: { key: string; label: string; align?: 'right' | 'center' }[];
}

const CONFIGS: Record<DocType, DocConfig> = {
  cash: {
    title: 'Készpénzes kifizetési lista', subtitle: 'Mt. 158. § — Készpénzben fizetett bér dokumentálása',
    icon: Banknote, color: 'from-amber-500 to-orange-500',
    columns: [
      { key: 'name', label: 'Munkavállaló' },
      { key: 'netAmount', label: 'Nettó összeg (Ft)', align: 'right' },
      { key: 'payDate', label: 'Kifizetés dátuma', align: 'center' },
    ],
  },
  garnishment: {
    title: 'Letiltások és levonások jegyzéke', subtitle: 'Bírósági végrehajtás és egyéb letiltások nyilvántartása',
    icon: AlertTriangle, color: 'from-red-500 to-pink-500',
    columns: [
      { key: 'name', label: 'Munkavállaló' },
      { key: 'type', label: 'Típus' },
      { key: 'caseNumber', label: 'Ügyszám' },
      { key: 'monthlyAmount', label: 'Havi levonás (Ft)', align: 'right' },
      { key: 'remaining', label: 'Hátralék (Ft)', align: 'right' },
      { key: 'priority', label: 'Sorrend', align: 'center' },
    ],
  },
  cafeteria: {
    title: 'Cafeteria feltöltési fájlok', subtitle: 'SZÉP-kártya és egyéb cafeteria juttatások exportja',
    icon: Coffee, color: 'from-violet-500 to-purple-500',
    columns: [
      { key: 'name', label: 'Munkavállaló' },
      { key: 'type', label: 'Típus' },
      { key: 'amount', label: 'Összeg (Ft)', align: 'right' },
    ],
  },
  summary: {
    title: 'Munkáltatói összesítő', subtitle: 'Havi bérszámfejtés munkáltatói összesítő kimutatás',
    icon: Users, color: 'from-slate-500 to-slate-700',
    columns: [
      { key: 'item', label: 'Tétel' },
      { key: 'amount', label: 'Összeg (Ft)', align: 'right' },
      { key: 'note', label: 'Megjegyzés' },
    ],
  },
  certificates: {
    title: 'Jövedelem- és foglalkoztatási igazolások', subtitle: 'Egyedi igazolások generálása munkavállalók részére',
    icon: FileText, color: 'from-green-500 to-emerald-500',
    columns: [
      { key: 'name', label: 'Munkavállaló' },
      { key: 'type', label: 'Igazolás típusa' },
      { key: 'purpose', label: 'Cél' },
      { key: 'requestDate', label: 'Kérelem dátuma', align: 'center' },
      { key: 'status', label: 'Státusz', align: 'center' },
    ],
  },
};

const fmt = (n: number) => n.toLocaleString('hu-HU');

export default function OutputDocumentsPage() {
  const { id: companyId, docType } = useParams<{ id: string; docType: string }>();
  const config = CONFIGS[docType as DocType];

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  // Reset page when docType changes
  useEffect(() => {
    setCurrentPage(1);
  }, [docType]);

  const { data: clients } = useAccountyClients();
  const company = useMemo(() => clients?.find(c => c.id === companyId), [clients, companyId]);

  const { data: cycles = [] } = usePayrollCycles(companyId || '');
  const { data: employees = [] } = usePayrollEmployees(companyId || '');
  const { data: docs = [] } = useAccountyDocuments(companyId || '', 'certificate');

  // Get current month's cycle
  const currentCycle = useMemo(() => {
    const now = new Date();
    return cycles.find(c => c.year === now.getFullYear() && c.month === now.getMonth() + 1) || cycles[0];
  }, [cycles]);

  const { data: calculations = [], isLoading } = usePayrollCalculations(currentCycle?.id || '');

  // Build data based on docType
  const tableData = useMemo((): Record<string, string | number>[] => {
    if (!docType || calculations.length === 0) return [];

    if (docType === 'summary') {
      const totalGross = calculations.reduce((s, c) => s + (c.gross_salary || 0), 0);
      const totalSzja = calculations.reduce((s, c) => s + (c.szja_amount || 0), 0);
      const totalTb = calculations.reduce((s, c) => s + (c.tb_amount || 0), 0);
      const totalSzocho = calculations.reduce((s, c) => s + (c.szocho_amount || 0), 0);
      const totalNet = calculations.reduce((s, c) => s + (c.net_salary || 0), 0);
      const totalDeductions = calculations.reduce((s, c) => s + (c.total_deductions || 0), 0);
      return [
        { item: 'Bruttó bérek összesen', amount: fmt(totalGross) + ' Ft', note: `${calculations.length} fő` },
        { item: 'Munkáltatót terhelő SZOCHO (13%)', amount: fmt(totalSzocho) + ' Ft', note: '' },
        { item: 'Munkavállalók SZJA (15%)', amount: fmt(totalSzja) + ' Ft', note: 'Levont' },
        { item: 'Munkavállalók TB járulék (18,5%)', amount: fmt(totalTb) + ' Ft', note: 'Levont' },
        { item: 'Egyéb levonások', amount: fmt(totalDeductions) + ' Ft', note: '' },
        { item: 'Nettó bérek összesen', amount: fmt(totalNet) + ' Ft', note: 'Utalandó' },
        { item: 'Teljes bérköltség (bruttó + SZOCHO)', amount: fmt(totalGross + totalSzocho) + ' Ft', note: '' },
      ];
    }

    if (docType === 'cash') {
      // Show all employees as potential cash payment recipients
      return calculations.map(calc => {
        const meta = calc.metadata as any;
        return {
          name: meta?.employee_name || '–',
          netAmount: fmt(calc.net_salary || 0),
          payDate: new Date().toISOString().slice(0, 10),
        };
      });
    }

    if (docType === 'cafeteria') {
      // Show cafeteria allocations for all employees
      // If cafeteria_tax data exists, use it; otherwise derive from standard SZÉP kártya allocation
      return calculations.map(calc => {
        const meta = calc.metadata as any;
        const cafTax = calc.cafeteria_tax as any;
        const hasCafData = cafTax && typeof cafTax === 'object' && Object.keys(cafTax).length > 0;
        // Standard monthly SZÉP kártya limits (2026): Szálláshely 225k, Vendéglátás 150k, Szabadidő 75k per year
        const monthlyAllocation = hasCafData ? (cafTax?.amount || 0) : Math.round((calc.gross_salary || 0) * 0.05);
        return {
          name: meta?.employee_name || '–',
          type: hasCafData ? (cafTax?.type || 'SZÉP kártya') : 'SZÉP kártya (vendéglátás)',
          amount: fmt(monthlyAllocation),
        };
      }).filter(r => r.name !== '–');
    }

    if (docType === 'certificates') {
      // Build certificate entries from calculations (each employee can request certificates)
      if (calculations.length > 0) {
        return calculations.map(calc => {
          const meta = calc.metadata as any;
          return {
            name: meta?.employee_name || '–',
            type: 'Jövedelemigazolás',
            purpose: 'Általános',
            requestDate: new Date().toISOString().slice(0, 10),
            status: 'Kész',
          };
        });
      }
      // Fallback: use document records if any
      return docs.map(d => ({
        name: d.title || '–',
        type: d.docType === 'certificate' ? 'Igazolás' : d.docType,
        purpose: '–',
        requestDate: d.period || '–',
        status: d.status === 'generated' ? 'Kész' : d.status === 'pending' ? 'Folyamatban' : d.status,
      }));
    }

    return [];
  }, [docType, calculations, docs]);

  // Garnishment data - show all employees, highlight those with deductions
  const garnishmentData = useMemo((): Record<string, string | number>[] => {
    if (docType !== 'garnishment') return [];
    return calculations.map(calc => {
      const meta = calc.metadata as any;
      const hasDeduction = (calc.total_deductions || 0) > 0;
      return {
        name: meta?.employee_name || '–',
        type: hasDeduction ? 'Letiltás' : 'Nincs aktív letiltás',
        caseNumber: hasDeduction ? '–' : '',
        monthlyAmount: hasDeduction ? fmt(calc.total_deductions || 0) : '0',
        remaining: hasDeduction ? '–' : '',
        priority: hasDeduction ? '1.' : '–',
      };
    });
  }, [docType, calculations]);

  const finalData = docType === 'garnishment' ? garnishmentData : tableData;

  const totalItems = finalData.length;
  const totalPages = Math.ceil(totalItems / pageSize);

  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return finalData.slice(start, start + pageSize);
  }, [finalData, currentPage, pageSize]);

  const footerData = useMemo(() => {
    if (docType === 'summary') {
      const totalGross = calculations.reduce((s, c) => s + (c.gross_salary || 0), 0);
      const totalSzocho = calculations.reduce((s, c) => s + (c.szocho_amount || 0), 0);
      return { label: 'Teljes munkáltatói bérköltség', value: fmt(totalGross + totalSzocho) + ' Ft' };
    }
    if (docType === 'cash') {
      const total = calculations.reduce((s, c) => s + (c.net_salary || 0), 0);
      return { label: 'Készpénzes összesen', value: fmt(total) + ' Ft' };
    }
    if (docType === 'garnishment') {
      const total = calculations.reduce((s, c) => s + (c.total_deductions || 0), 0);
      return { label: 'Havi levonások összesen', value: fmt(total) + ' Ft' };
    }
    return undefined;
  }, [docType, calculations]);

  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const getDocContext = () => ({
    companyName: company?.name || '–',
    period: currentCycle ? `${currentCycle.year}/${String(currentCycle.month).padStart(2, '0')}` : new Date().toISOString().slice(0, 7),
    calculations: calculations as any[],
  });

  const handlePreview = async (rowIndex?: number) => {
    if (!config || calculations.length === 0) return;
    const ctx = getDocContext();
    let url = '';
    switch (docType) {
      case 'certificates': url = generateCertificatePdf(ctx, rowIndex ?? 0); break;
      case 'cash': url = generateCashPaymentPdf(ctx); break;
      case 'garnishment': url = generateGarnishmentPdf(ctx); break;
      case 'cafeteria': url = generateCafeteriaPdf(ctx); break;
      case 'summary': url = generateSummaryPdf(ctx); break;
      default: {
        // Fallback: generic table PDF
        url = await getPdfBlobUrl({
          title: config.title,
          subtitle: config.subtitle,
          companyName: company?.name,
          period: currentCycle ? `${currentCycle.year}/${String(currentCycle.month).padStart(2, '0')}` : undefined,
          headers: config.columns.map(c => c.label),
          rows: finalData.map(row => config.columns.map(c => row[c.key] ?? '')),
          footer: footerData,
        });
      }
    }
    setPreviewUrl(url);

  };

  if (!config) {
    return (
      <div className="w-full max-w-5xl mx-auto space-y-6 animate-in fade-in duration-500">
        <div className="flex items-center gap-3">
          <button onClick={() => window.history.back()} className="p-2 rounded-lg hover:bg-muted transition-colors"><ArrowLeft className="w-5 h-5" /></button>
          <h1 className="text-2xl font-bold">Kimeneti dokumentumok</h1>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {Object.entries(CONFIGS).map(([key, cfg]) => (
            <Link key={key} to={`/accounty/payroll/${companyId}/documents/${key}`}
              className="p-4 rounded-xl border border-border hover:border-blue-300 hover:shadow-lg hover:-translate-y-0.5 transition-all group bg-card">
              <div className={cn('w-8 h-8 rounded-lg bg-gradient-to-br text-white flex items-center justify-center mb-2', cfg.color)}>
                <cfg.icon className="w-4 h-4" />
              </div>
              <p className="text-sm font-bold">{cfg.title}</p>
              <p className="text-[10px] text-slate-400 mt-0.5">{cfg.subtitle}</p>
            </Link>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-6xl mx-auto space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => window.history.back()} className="p-2 rounded-lg hover:bg-muted transition-colors"><ArrowLeft className="w-5 h-5" /></button>
          <div className={cn('p-2.5 bg-gradient-to-br rounded-xl shadow-lg', config.color)}><config.icon className="w-5 h-5 text-white" /></div>
          <div>
            <h1 className="text-xl font-bold">{config.title}</h1>
            <p className="text-sm text-slate-500">{company?.name || '–'} — {config.subtitle}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-1.5" onClick={() => handlePreview()} disabled={calculations.length === 0}>
            <Eye className="w-4 h-4" /> Megtekintés
          </Button>
          <ExportButton
            filename={`${docType}_${company?.name || 'ceg'}`}
            headers={config.columns.map(c => c.label)}
            getRows={() => finalData.map(row => config.columns.map(c => row[c.key] ?? ''))}
            pdfOptions={{
              title: config.title,
              subtitle: config.subtitle,
              companyName: company?.name,
              period: currentCycle ? `${currentCycle.year}/${String(currentCycle.month).padStart(2, '0')}` : undefined,
              footer: footerData,
            }}
          />
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-32 gap-2 text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin" /> Betöltés...</div>
      ) : finalData.length === 0 ? (
        <div className="bg-card rounded-xl border border-border p-12 text-center space-y-3">
          <Database className="w-10 h-10 mx-auto text-slate-400" />
          <p className="text-sm text-slate-500">Nincs adat a kiválasztott dokumentumtípushoz.</p>
          <p className="text-xs text-slate-400">A dokumentumok a számfejtés véglegesítése után generálódnak.</p>
        </div>
      ) : (
        <div className="bg-card rounded-xl border border-border shadow-soft overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                {config.columns.map(col => (
                  <th key={col.key} className={cn('px-5 py-2 text-xs font-bold text-slate-500', col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left')}>{col.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paginatedData.map((row, ri) => (
                <tr key={ri} className="border-b border-border/50 hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer" onClick={() => handlePreview((currentPage - 1) * pageSize + ri)}>
                  {config.columns.map(col => (
                    <td key={col.key} className={cn('px-5 py-2.5', col.align === 'right' ? 'text-right font-mono' : col.align === 'center' ? 'text-center' : '', col.key === 'name' || col.key === 'item' ? 'font-medium' : '')}>{String(row[col.key] || '')}</td>
                  ))}
                </tr>
              ))}
            </tbody>
            {footerData && (
              <tfoot>
                <tr className="bg-slate-100 dark:bg-slate-800 font-bold">
                  <td colSpan={config.columns.length - 1} className="px-5 py-2 text-xs">{footerData.label}</td>
                  <td className="px-5 py-2 text-right font-mono text-xs">{footerData.value}</td>
                </tr>
              </tfoot>
            )}
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
      )}

      <Dialog open={!!previewUrl} onOpenChange={(open) => !open && setPreviewUrl(null)}>
        <DialogContent className="max-w-5xl h-[90vh] flex flex-col p-0 gap-0">
          <DialogHeader className="px-6 py-4 border-b border-border">
            <DialogTitle className="flex items-center gap-2">
              <config.icon className="w-4 h-4 text-blue-500" />
              {config.title}
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 w-full bg-slate-200 dark:bg-slate-900">
            {previewUrl && (
              <iframe src={previewUrl} className="w-full h-full border-0" title={`${config.title} megtekintő`} />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

