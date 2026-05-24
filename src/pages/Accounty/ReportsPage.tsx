import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Calendar, FileText, PieChart, TrendingUp, Users, FileWarning, 
  Download, FileJson, Mail, ChevronRight, X, Eye, Check, Loader2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import { useAccountyFullReportData, type FullReportData, type InvoiceReportRow, type ReportRow } from '@/hooks/useAccountyData';

type ReportType = 'havi' | 'afa' | 'koltseg' | 'cashflow' | 'partner' | 'hianyzo';

const reportTypes = [
  { id: 'havi', title: 'Havi összesítő', description: 'Bejövő és kimenő számlák összesítése, ÁFA kimutatás', icon: Calendar, color: 'text-indigo-500', bg: 'bg-indigo-50 dark:bg-indigo-900/30' },
  { id: 'afa', title: 'ÁFA kimutatás', description: 'Részletes ÁFA bontás kategóriánként', icon: FileText, color: 'text-primary', bg: 'bg-accent-subtle dark:bg-accent' },
  { id: 'koltseg', title: 'Költségkimutatás', description: 'Költségek főkönyvi szám és kategória szerint', icon: PieChart, color: 'text-amber-500', bg: 'bg-amber-50 dark:bg-amber-900/30' },
  { id: 'cashflow', title: 'Cash flow riport', description: 'Pénzforgalom és likviditás elemzés', icon: TrendingUp, color: 'text-blue-500', bg: 'bg-blue-50 dark:bg-blue-900/30' },
  { id: 'partner', title: 'Partner kimutatás', description: 'Szállítói és vevői forgalom riport', icon: Users, color: 'text-rose-500', bg: 'bg-rose-50 dark:bg-rose-900/30' },
  { id: 'hianyzo', title: 'Hiányzó számlák riport', description: 'Automatikus bekérő statisztikák', icon: FileWarning, color: 'text-red-500', bg: 'bg-red-50 dark:bg-red-900/30' },
];

export default function ReportsPage() {
  const navigate = useNavigate();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedType, setSelectedType] = useState<ReportType>('havi');
  const [format, setFormat] = useState<'pdf' | 'excel'>('pdf');
  const [includeDetails, setIncludeDetails] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generated, setGenerated] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const rawReportData = useAccountyFullReportData();

  // Default date range: current month
  const now = new Date();
  const [dateFrom, setDateFrom] = useState(() => `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`);
  const [dateTo, setDateTo] = useState(() => now.toISOString().slice(0, 10));

  // Filter out SANDBOX and apply date range
  const reportData = React.useMemo(() => {
    const fromDate = new Date(dateFrom);
    const toDate = new Date(dateTo);
    toDate.setHours(23, 59, 59); // inclusive

    const filteredInvoices = rawReportData.invoices.filter(inv => {
      // Exclude SANDBOX
      if (inv.clientName === 'SANDBOX') return false;
      // Date filter: parse the hu-HU formatted date back
      if (!inv.date || inv.date === '-') return false;
      const parts = inv.date.split('. ').map(s => parseInt(s));
      if (parts.length < 3) return false;
      const invDate = new Date(parts[0], parts[1] - 1, parts[2]);
      return invDate >= fromDate && invDate <= toDate;
    });

    const filteredClients = rawReportData.clients.filter(c => c.clientName !== 'SANDBOX');

    // Sort by date descending
    filteredInvoices.sort((a, b) => (b.date || '').localeCompare(a.date || ''));

    return { clients: filteredClients, invoices: filteredInvoices };
  }, [rawReportData, dateFrom, dateTo]);

  const openModal = (type: ReportType) => {
    if (type === 'hianyzo') {
      navigate('/accounty/reports/missing-invoices');
      return;
    }
    setSelectedType(type);
    setIsModalOpen(true);
    setGenerated(false);
    setShowPreview(false);
    setEmailSent(false);
  };

  const handleGenerate = () => {
    setIsGenerating(true);
    setTimeout(() => {
      if (format === 'excel') {
        exportCSV(reportData, selectedType, { details: includeDetails });
      } else {
        exportPDF(reportData, selectedType, { details: includeDetails });
      }
      setIsGenerating(false);
      setGenerated(true);
    }, 600);
  };

  const handlePreview = () => {
    setShowPreview(true);
  };

  const handleSendEmail = () => {
    setIsGenerating(true);
    setTimeout(() => {
      // Generate report + simulate email send
      if (format === 'excel') {
        exportCSV(reportData, selectedType, { details: includeDetails });
      } else {
        exportPDF(reportData, selectedType, { details: includeDetails });
      }
      setIsGenerating(false);
      setEmailSent(true);
      setTimeout(() => setEmailSent(false), 3000);
    }, 1000);
  };

  const currentTypeLabel = reportTypes.find(r => r.id === selectedType)?.title || '';

  return (
    <div className="w-full space-y-8 animate-in fade-in duration-500 relative">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">Riportok</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Átfogó riportok és kimutatások</p>
      </div>

      {/* Report Types Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {reportTypes.map((report) => (
          <button 
            key={report.id}
            onClick={() => openModal(report.id as ReportType)}
            className="flex flex-col text-left bg-card border border-border rounded-xl p-5 hover:border-slate-300 hover:shadow-soft transition-all group relative overflow-hidden"
          >
            <div className="flex justify-between items-start w-full mb-4">
              <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center", report.bg)}>
                <report.icon className={cn("w-5 h-5", report.color)} />
              </div>
              <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-slate-500 dark:text-slate-400 transition-colors" />
            </div>
            <h3 className="font-semibold text-slate-900 dark:text-slate-100 mb-1">{report.title}</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2">{report.description}</p>
          </button>
        ))}
      </div>

      {/* Recent Reports */}
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Legutóbbi riportok</h2>
        </div>

        <div className="bg-card border border-border rounded-xl shadow-soft overflow-hidden">
          <div className="p-12 text-center">
            <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto mb-4">
              <FileText className="w-6 h-6 text-slate-400" />
            </div>
            <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Még nincs generált riport</p>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">A generált riportok itt fognak megjelenni</p>
          </div>
        </div>
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-0">
          <div 
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity" 
            onClick={() => setIsModalOpen(false)}
          ></div>
          
          <div className="relative bg-card rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-200 z-10 flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="flex justify-between items-start p-6 border-b border-border shrink-0">
              <div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">Riport generálása</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Állítsd be a riport paramétereit</p>
              </div>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 p-1 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="p-6 space-y-6 overflow-y-auto">
              {/* Report Type */}
              <div className="space-y-3">
                <Label className="text-sm font-semibold text-slate-900 dark:text-slate-100">Riport típusa</Label>
                <RadioGroup value={selectedType} onValueChange={(v) => { setSelectedType(v as ReportType); setGenerated(false); setShowPreview(false); }} className="grid grid-cols-2 gap-3">
                  {reportTypes.filter(r => r.id !== 'hianyzo').map(r => (
                    <div key={r.id} className="flex items-center space-x-2">
                      <RadioGroupItem value={r.id} id={`type-${r.id}`} className="border-slate-300 text-slate-900 dark:text-slate-100" />
                      <Label htmlFor={`type-${r.id}`} className="text-sm font-normal cursor-pointer">{r.title}</Label>
                    </div>
                  ))}
                </RadioGroup>
              </div>

              {/* Date Range */}
              <div className="space-y-3">
                <Label className="text-sm font-semibold text-slate-900 dark:text-slate-100">Időszak</Label>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-slate-500 dark:text-slate-400">Kezdő dátum</Label>
                    <Input 
                      type="date" 
                      value={dateFrom} 
                      onChange={(e) => { setDateFrom(e.target.value); setGenerated(false); setShowPreview(false); }}
                      className="bg-card border-border text-sm" 
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-slate-500 dark:text-slate-400">Záró dátum</Label>
                    <Input 
                      type="date" 
                      value={dateTo} 
                      onChange={(e) => { setDateTo(e.target.value); setGenerated(false); setShowPreview(false); }}
                      className="bg-card border-border text-sm" 
                    />
                  </div>
                </div>
                <p className="text-[11px] text-slate-400">{reportData.invoices.length} számla a kiválasztott időszakban</p>
              </div>

              {/* Format */}
              <div className="space-y-3">
                <Label className="text-sm font-semibold text-slate-900 dark:text-slate-100">Formátum</Label>
                <div className="grid grid-cols-2 gap-3">
                  <button 
                    onClick={() => setFormat('pdf')}
                    className={cn(
                      "flex items-center gap-2 p-3 rounded-xl border-2 transition-colors text-sm font-medium",
                      format === 'pdf' ? "border-slate-900 dark:border-primary bg-slate-50 dark:bg-accent" : "border-border hover:border-slate-200"
                    )}
                  >
                    <FileText className={cn("w-4 h-4", format === 'pdf' ? "text-red-500" : "text-slate-400")} />
                    PDF
                  </button>
                  <button 
                    onClick={() => setFormat('excel')}
                    className={cn(
                      "flex items-center gap-2 p-3 rounded-xl border-2 transition-colors text-sm font-medium",
                      format === 'excel' ? "border-slate-900 dark:border-primary bg-slate-50 dark:bg-accent" : "border-border hover:border-slate-200"
                    )}
                  >
                    <FileJson className={cn("w-4 h-4", format === 'excel' ? "text-primary" : "text-slate-400")} />
                    Excel
                  </button>
                </div>
              </div>

              {/* Options */}
              <div className="space-y-3">
                <Label className="text-sm font-semibold text-slate-900 dark:text-slate-100">Opciók</Label>
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <Checkbox id="opt-1" checked={includeDetails} onCheckedChange={(c) => setIncludeDetails(!!c)} className="border-slate-300 rounded" />
                    <Label htmlFor="opt-1" className="text-sm font-normal cursor-pointer">Részletes tételsorok</Label>
                  </div>
                </div>
              </div>

              {/* Inline Preview */}
              {showPreview && (
                <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden animate-in slide-in-from-bottom-4 duration-300">
                  <div className="bg-slate-50 dark:bg-slate-800/50 p-3 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">📊 Előnézet — {currentTypeLabel}</span>
                    <button onClick={() => setShowPreview(false)} className="text-slate-400 hover:text-slate-600">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="p-4 max-h-[200px] overflow-y-auto text-xs">
                    <PreviewTable data={reportData} type={selectedType} options={{ details: includeDetails }} />
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-border flex items-center justify-between shrink-0 bg-slate-50/50 dark:bg-slate-900/50">
              <Button variant="ghost" className="text-slate-500 dark:text-slate-400 hover:text-slate-700 whitespace-nowrap" onClick={() => setIsModalOpen(false)}>
                Mégse
              </Button>
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  onClick={handleSendEmail}
                  disabled={isGenerating}
                  className={cn(
                    "gap-2 bg-card border-border whitespace-nowrap transition-all",
                    emailSent ? "text-primary border-primary/30" : "text-slate-700 dark:text-slate-300"
                  )}
                >
                  {emailSent ? <><Check className="w-4 h-4" /> Elküldve!</> : <><Mail className="w-4 h-4" /> Generálás és küldés</>}
                </Button>
                <Button 
                  variant="outline" 
                  onClick={handlePreview}
                  className={cn(
                    "gap-2 bg-card border-border whitespace-nowrap",
                    showPreview ? "text-indigo-600 border-indigo-300" : "text-slate-700 dark:text-slate-300"
                  )}
                >
                  <Eye className="w-4 h-4" /> Előnézet
                </Button>
                <Button 
                  onClick={handleGenerate}
                  disabled={isGenerating}
                  className={cn(
                    "gap-2 whitespace-nowrap transition-all",
                    generated 
                      ? "bg-primary text-white hover:bg-primary/90" 
                      : "bg-primary text-primary-foreground hover:bg-primary/90"
                  )}
                >
                  {isGenerating ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Generálás...</>
                  ) : generated ? (
                    <><Check className="w-4 h-4" /> Letöltve!</>
                  ) : (
                    <><Download className="w-4 h-4" /> Generálás</>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Preview table component ──

function PreviewTable({ data, type, options }: { data: FullReportData; type: ReportType; options?: { details: boolean } }) {
  const fmt = (n: number) => new Intl.NumberFormat('hu-HU').format(n);

  if (type === 'havi') {
    const inbound = data.invoices.filter(i => i.direction === 'Bejövő');
    const outbound = data.invoices.filter(i => i.direction === 'Kimenő');
    return (
      <div className="space-y-3">
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3"><div className="text-[10px] text-blue-600 font-medium">Összes számla</div><div className="text-lg font-bold text-blue-700">{data.invoices.length}</div></div>
          <div className="bg-accent-subtle dark:bg-accent rounded-lg p-3"><div className="text-[10px] text-primary font-medium">Bejövő</div><div className="text-lg font-bold text-accent-foreground">{inbound.length}</div></div>
          <div className="bg-amber-50 dark:bg-amber-900/20 rounded-lg p-3"><div className="text-[10px] text-amber-600 font-medium">Kimenő</div><div className="text-lg font-bold text-amber-700">{outbound.length}</div></div>
        </div>
        {options?.details !== false && (
          <table className="w-full"><thead><tr className="text-[10px] text-slate-500 border-b"><th className="pb-1 text-left">Szám</th><th className="pb-1 text-left">Partner</th><th className="pb-1">Irány</th><th className="pb-1 text-right">Bruttó</th></tr></thead>
          <tbody>{data.invoices.slice(0, 5).map((inv, i) => (
            <tr key={i} className="border-b border-slate-100"><td className="py-1 font-medium">{inv.invoiceNumber}</td><td className="py-1 text-slate-500">{inv.partnerName}</td><td className="py-1 text-center"><span className={cn("px-1.5 py-0.5 rounded text-[9px] font-bold", inv.direction === 'Bejövő' ? 'bg-accent text-accent-foreground' : 'bg-blue-100 text-blue-700')}>{inv.direction}</span></td><td className="py-1 text-right font-semibold">{fmt(inv.grossAmount)} {inv.currency}</td></tr>
          ))}</tbody></table>
        )}
        {data.invoices.length > 5 && <p className="text-[10px] text-slate-400 text-center">+{data.invoices.length - 5} további számla...</p>}
      </div>
    );
  }

  if (type === 'afa') {
    const totalNet = data.invoices.reduce((s, i) => s + i.netAmount, 0);
    const totalVat = data.invoices.reduce((s, i) => s + i.vatAmount, 0);
    const totalGross = data.invoices.reduce((s, i) => s + i.grossAmount, 0);
    return (
      <div className="space-y-3">
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-3"><div className="text-[10px] text-slate-500 font-medium">Nettó összesen</div><div className="text-sm font-bold">{fmt(totalNet)} Ft</div></div>
          <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-3"><div className="text-[10px] text-red-500 font-medium">ÁFA összesen</div><div className="text-sm font-bold text-red-700">{fmt(totalVat)} Ft</div></div>
          <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-3"><div className="text-[10px] text-slate-500 font-medium">Bruttó összesen</div><div className="text-sm font-bold">{fmt(totalGross)} Ft</div></div>
        </div>
        {options?.details !== false && (
          <table className="w-full"><thead><tr className="text-[10px] text-slate-500 border-b"><th className="pb-1 text-left">Szám</th><th className="pb-1 text-right">Nettó</th><th className="pb-1 text-right">ÁFA</th><th className="pb-1 text-right">Bruttó</th></tr></thead>
          <tbody>{data.invoices.slice(0, 5).map((inv, i) => (
            <tr key={i} className="border-b border-slate-100"><td className="py-1 font-medium">{inv.invoiceNumber}</td><td className="py-1 text-right">{fmt(inv.netAmount)} {inv.currency}</td><td className="py-1 text-right text-red-600 font-semibold">{fmt(inv.vatAmount)} {inv.currency}</td><td className="py-1 text-right font-semibold">{fmt(inv.grossAmount)} {inv.currency}</td></tr>
          ))}</tbody></table>
        )}
      </div>
    );
  }

  if (type === 'koltseg') {
    const costs = data.invoices.filter(i => i.direction === 'Bejövő');
    const byClient: Record<string, number> = {};
    costs.forEach(c => { byClient[c.clientName] = (byClient[c.clientName] || 0) + c.grossAmount; });
    return (
      <div className="space-y-3">
        <div className="bg-amber-50 dark:bg-amber-900/20 rounded-lg p-3"><div className="text-[10px] text-amber-600 font-medium">Összes költség (bejövő számlák)</div><div className="text-lg font-bold text-amber-700">{fmt(costs.reduce((s, c) => s + c.grossAmount, 0))} Ft</div></div>
        {options?.details !== false && (
          <table className="w-full"><thead><tr className="text-[10px] text-slate-500 border-b"><th className="pb-1 text-left">Ügyfél</th><th className="pb-1 text-right">Összeg</th></tr></thead>
          <tbody>{Object.entries(byClient).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([name, amount], i) => (
            <tr key={i} className="border-b border-slate-100"><td className="py-1 font-medium">{name}</td><td className="py-1 text-right font-semibold">{fmt(amount)} Ft</td></tr>
          ))}</tbody></table>
        )}
      </div>
    );
  }

  if (type === 'cashflow') {
    const inflow = data.invoices.filter(i => i.direction === 'Kimenő').reduce((s, i) => s + i.grossAmount, 0);
    const outflow = data.invoices.filter(i => i.direction === 'Bejövő').reduce((s, i) => s + i.grossAmount, 0);
    return (
      <div className="space-y-3">
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-accent-subtle dark:bg-accent rounded-lg p-3"><div className="text-[10px] text-primary font-medium">Befolyó (kimenő számlák)</div><div className="text-sm font-bold text-accent-foreground">+{fmt(inflow)} Ft</div></div>
          <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-3"><div className="text-[10px] text-red-500 font-medium">Kiáramló (bejövő számlák)</div><div className="text-sm font-bold text-red-700">-{fmt(outflow)} Ft</div></div>
          <div className={cn("rounded-lg p-3", inflow - outflow >= 0 ? "bg-accent-subtle dark:bg-accent" : "bg-red-50 dark:bg-red-900/20")}><div className="text-[10px] text-slate-500 font-medium">Egyenleg</div><div className={cn("text-sm font-bold", inflow - outflow >= 0 ? "text-accent-foreground" : "text-red-700")}>{fmt(inflow - outflow)} Ft</div></div>
        </div>
      </div>
    );
  }

  if (type === 'partner') {
    const byPartner: Record<string, { count: number; total: number }> = {};
    data.invoices.forEach(inv => {
      const p = inv.partnerName;
      if (!byPartner[p]) byPartner[p] = { count: 0, total: 0 };
      byPartner[p].count++;
      byPartner[p].total += inv.grossAmount;
    });
    return (
      <div className="space-y-3">
        <div className="bg-rose-50 dark:bg-rose-900/20 rounded-lg p-3"><div className="text-[10px] text-rose-600 font-medium">Egyedi partnerek</div><div className="text-lg font-bold text-rose-700">{Object.keys(byPartner).length}</div></div>
        {options?.details !== false && (
          <table className="w-full"><thead><tr className="text-[10px] text-slate-500 border-b"><th className="pb-1 text-left">Partner</th><th className="pb-1 text-right">Számlák</th><th className="pb-1 text-right">Forgalom</th></tr></thead>
          <tbody>{Object.entries(byPartner).sort((a, b) => b[1].total - a[1].total).slice(0, 8).map(([name, d], i) => (
            <tr key={i} className="border-b border-slate-100"><td className="py-1 font-medium">{name}</td><td className="py-1 text-right">{d.count}</td><td className="py-1 text-right font-semibold">{fmt(d.total)} Ft</td></tr>
          ))}</tbody></table>
        )}
      </div>
    );
  }

  return <p className="text-slate-500">Nincs elérhető előnézet.</p>;
}

// ── Export helpers ──

const reportTypeLabels: Record<string, string> = {
  havi: 'Havi összesítő',
  afa: 'ÁFA kimutatás',
  koltseg: 'Költségkimutatás',
  cashflow: 'Cash flow riport',
  partner: 'Partner kimutatás',
};

function exportCSV(data: FullReportData, type: string, options: { details: boolean } = { details: true }) {
  const bom = '\uFEFF';
  let csvContent = '';

  if (type === 'havi' || type === 'afa') {
    if (options.details) {
      csvContent = ['Számla szám;Partner;Dátum;Irány;Nettó (Ft);ÁFA (Ft);Bruttó (Ft);Ügyfél',
        ...data.invoices.map(i => [i.invoiceNumber, i.partnerName, i.date, i.direction, i.netAmount, i.vatAmount, i.grossAmount, i.clientName].join(';'))
      ].join('\n');
    } else {
      const totalNet = data.invoices.reduce((s, i) => s + i.netAmount, 0);
      const totalVat = data.invoices.reduce((s, i) => s + i.vatAmount, 0);
      const totalGross = data.invoices.reduce((s, i) => s + i.grossAmount, 0);
      csvContent = ['Nettó összesen (Ft);ÁFA összesen (Ft);Bruttó összesen (Ft)', `${totalNet};${totalVat};${totalGross}`].join('\n');
    }
  } else if (type === 'koltseg') {
    const costs = data.invoices.filter(i => i.direction === 'Bejövő');
    if (options.details) {
      csvContent = ['Számla szám;Szállító;Dátum;Nettó (Ft);ÁFA (Ft);Bruttó (Ft);Ügyfél',
        ...costs.map(i => [i.invoiceNumber, i.partnerName, i.date, i.netAmount, i.vatAmount, i.grossAmount, i.clientName].join(';'))
      ].join('\n');
    } else {
      const total = costs.reduce((s, c) => s + c.grossAmount, 0);
      csvContent = ['Összes költség (Ft);Számlák száma', `${total};${costs.length}`].join('\n');
    }
  } else if (type === 'cashflow') {
    const inflow = data.invoices.filter(i => i.direction === 'Kimenő').reduce((s, i) => s + i.grossAmount, 0);
    const outflow = data.invoices.filter(i => i.direction === 'Bejövő').reduce((s, i) => s + i.grossAmount, 0);
    if (options.details) {
      csvContent = ['Irány;Partner;Dátum;Bruttó (Ft);Ügyfél',
        ...data.invoices.map(i => [i.direction, i.partnerName, i.date, i.direction === 'Kimenő' ? i.grossAmount : -i.grossAmount, i.clientName].join(';'))
      ].join('\n');
    } else {
      csvContent = ['Befolyó (Ft);Kiáramló (Ft);Egyenleg (Ft)', `${inflow};${outflow};${inflow - outflow}`].join('\n');
    }
  } else if (type === 'partner') {
    const byPartner: Record<string, { count: number; total: number }> = {};
    data.invoices.forEach(inv => {
      if (!byPartner[inv.partnerName]) byPartner[inv.partnerName] = { count: 0, total: 0 };
      byPartner[inv.partnerName].count++;
      byPartner[inv.partnerName].total += inv.grossAmount;
    });
    csvContent = ['Partner;Számlák száma;Összes forgalom (Ft)',
      ...Object.entries(byPartner).sort((a, b) => b[1].total - a[1].total).map(([name, d]) => [name, d.count, d.total].join(';'))
    ].join('\n');
  }

  const blob = new Blob([bom + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `visibill_${type}_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function exportPDF(data: FullReportData, type: string, options: { details: boolean } = { details: true }) {
  const title = reportTypeLabels[type] || type;
  const now = new Date().toLocaleDateString('hu-HU');
  const fmt = (n: number) => new Intl.NumberFormat('hu-HU').format(n);

  let tableHtml = '';

  if (type === 'havi' || type === 'afa') {
    const totalNet = data.invoices.reduce((s, i) => s + i.netAmount, 0);
    const totalVat = data.invoices.reduce((s, i) => s + i.vatAmount, 0);
    const totalGross = data.invoices.reduce((s, i) => s + i.grossAmount, 0);
    tableHtml = `
      <div class="summary"><span>Nettó: <strong>${fmt(totalNet)} Ft</strong></span> &nbsp;|&nbsp; <span>ÁFA: <strong style="color:#dc2626">${fmt(totalVat)} Ft</strong></span> &nbsp;|&nbsp; <span>Bruttó: <strong>${fmt(totalGross)} Ft</strong></span></div>
      ${options.details ? `<table><thead><tr><th>Számla</th><th>Partner</th><th>Dátum</th><th>Irány</th><th style="text-align:right">Nettó</th><th style="text-align:right">ÁFA</th><th style="text-align:right">Bruttó</th><th>Ügyfél</th></tr></thead>
      <tbody>${data.invoices.map(i => `<tr><td><strong>${i.invoiceNumber}</strong></td><td>${i.partnerName}</td><td>${i.date}</td><td><span class="badge ${i.direction === 'Bejövő' ? 'rendben' : 'feldolgozando'}">${i.direction}</span></td><td style="text-align:right">${fmt(i.netAmount)} ${i.currency}</td><td style="text-align:right">${fmt(i.vatAmount)} ${i.currency}</td><td style="text-align:right"><strong>${fmt(i.grossAmount)} ${i.currency}</strong></td><td>${i.clientName}</td></tr>`).join('')}</tbody></table>` : ''}`;
  } else if (type === 'koltseg') {
    const costs = data.invoices.filter(i => i.direction === 'Bejövő');
    const total = costs.reduce((s, c) => s + c.grossAmount, 0);
    tableHtml = `
      <div class="summary">Összes költség: <strong>${fmt(total)} Ft</strong> (${costs.length} számla)</div>
      ${options.details ? `<table><thead><tr><th>Számla</th><th>Szállító</th><th>Dátum</th><th style="text-align:right">Bruttó</th><th>Ügyfél</th></tr></thead>
      <tbody>${costs.map(i => `<tr><td><strong>${i.invoiceNumber}</strong></td><td>${i.partnerName}</td><td>${i.date}</td><td style="text-align:right"><strong>${fmt(i.grossAmount)} ${i.currency}</strong></td><td>${i.clientName}</td></tr>`).join('')}</tbody></table>` : ''}`;
  } else if (type === 'cashflow') {
    const inflow = data.invoices.filter(i => i.direction === 'Kimenő').reduce((s, i) => s + i.grossAmount, 0);
    const outflow = data.invoices.filter(i => i.direction === 'Bejövő').reduce((s, i) => s + i.grossAmount, 0);
    tableHtml = `
      <div class="summary"><span style="color:hsl(173, 80%, 40%)">Befolyó: <strong>+${fmt(inflow)} Ft</strong></span> &nbsp;|&nbsp; <span style="color:#dc2626">Kiáramló: <strong>-${fmt(outflow)} Ft</strong></span> &nbsp;|&nbsp; Egyenleg: <strong>${fmt(inflow - outflow)} Ft</strong></div>
      ${options.details ? `<table><thead><tr><th>Irány</th><th>Partner</th><th>Dátum</th><th style="text-align:right">Összeg</th><th>Ügyfél</th></tr></thead>
      <tbody>${data.invoices.map(i => `<tr><td><span class="badge ${i.direction === 'Kimenő' ? 'rendben' : 'kritikus'}">${i.direction}</span></td><td>${i.partnerName}</td><td>${i.date}</td><td style="text-align:right"><strong>${i.direction === 'Kimenő' ? '+' : '-'}${fmt(i.grossAmount)} ${i.currency}</strong></td><td>${i.clientName}</td></tr>`).join('')}</tbody></table>` : ''}`;
  } else if (type === 'partner') {
    const byPartner: Record<string, { count: number; total: number }> = {};
    data.invoices.forEach(inv => {
      if (!byPartner[inv.partnerName]) byPartner[inv.partnerName] = { count: 0, total: 0 };
      byPartner[inv.partnerName].count++;
      byPartner[inv.partnerName].total += inv.grossAmount;
    });
    const sorted = Object.entries(byPartner).sort((a, b) => b[1].total - a[1].total);
    tableHtml = `
      <div class="summary">Egyedi partnerek: <strong>${sorted.length}</strong></div>
      ${options.details ? `<table><thead><tr><th>Partner</th><th style="text-align:right">Számlák</th><th style="text-align:right">Forgalom</th></tr></thead>
      <tbody>${sorted.map(([name, d]) => `<tr><td><strong>${name}</strong></td><td style="text-align:right">${d.count}</td><td style="text-align:right"><strong>${fmt(d.total)} Ft</strong></td></tr>`).join('')}</tbody></table>` : ''}`;
  }

  const html = `<html><head><title>${title} – Visibill</title>
    <style>
      body { font-family: 'Segoe UI', sans-serif; padding: 40px; color: #1e293b; }
      h1 { font-size: 22px; margin-bottom: 4px; }
      p.sub { color: #64748b; font-size: 13px; margin-bottom: 24px; }
      .summary { background: #f8fafc; padding: 12px 16px; border-radius: 8px; margin-bottom: 20px; font-size: 14px; border: 1px solid #e2e8f0; }
      table { width: 100%; border-collapse: collapse; font-size: 12px; }
      th { text-align: left; padding: 10px 12px; background: #f1f5f9; border-bottom: 2px solid #e2e8f0; font-weight: 600; }
      td { padding: 8px 12px; border-bottom: 1px solid #e2e8f0; }
      tr:nth-child(even) { background: #f8fafc; }
      .badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 10px; font-weight: 600; }
      .rendben { background: #d1fae5; color: #065f46; }
      .feldolgozando { background: #fef3c7; color: #92400e; }
      .kritikus { background: #fee2e2; color: #991b1b; }
      @media print { body { padding: 20px; } }
    </style></head><body>
    <h1>📊 ${title}</h1>
    <p class="sub">Generálva: ${now} – Visibill for Accountants</p>
    ${tableHtml}
    </body></html>`;
  
  const win = window.open('', '_blank');
  if (win) {
    win.document.write(html);
    win.document.close();
    setTimeout(() => win.print(), 400);
  }
}
