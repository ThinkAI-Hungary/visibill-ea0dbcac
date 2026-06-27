import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PreviewTable, exportCSV, exportPDF } from './reports/ReportHelpers';


import { 
  Calendar, FileText, PieChart, TrendingUp, Users, FileWarning, 
  Download, FileJson, Mail, ChevronRight, X, Eye, Check, Loader2, Trash2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import { useAccountyFullReportData, type FullReportData, type InvoiceReportRow, type ReportRow } from '@/hooks/accounty';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { reportError } from '@/lib/errorReporter';
import {
  addToApprovalQueue,
  type OutgoingMessage,
} from './generateRequestEmail';


type ReportType = 'havi' | 'afa' | 'koltseg' | 'cashflow' | 'partner' | 'hianyzo';


const reportTypes = [
  { id: 'havi', title: 'Havi összesítő', description: 'Bejövő és kimenő számlák összesítése, ÁFA kimutatás', icon: Calendar, color: 'text-indigo-500', bg: 'bg-indigo-50 dark:bg-indigo-900/30' },
  { id: 'afa', title: 'ÁFA kimutatás', description: 'Részletes ÁFA bontás kategóriánként', icon: FileText, color: 'text-primary', bg: 'bg-accent-subtle dark:bg-accent' },
  { id: 'koltseg', title: 'Költségkimutatás', description: 'Költségek főkönyvi szám és kategória szerint', icon: PieChart, color: 'text-amber-500', bg: 'bg-amber-50 dark:bg-amber-900/30' },
  { id: 'cashflow', title: 'Cash flow riport', description: 'Pénzforgalom és likviditás elemzés', icon: TrendingUp, color: 'text-blue-500', bg: 'bg-blue-50 dark:bg-blue-900/30' },
  { id: 'partner', title: 'Partner kimutatás', description: 'Szállítói és vevői forgalom riport', icon: Users, color: 'text-rose-500', bg: 'bg-rose-50 dark:bg-rose-900/30' },
  { id: 'hianyzo', title: 'Hiányzó számlák riport', description: 'Automatikus bekérő statisztikák', icon: FileWarning, color: 'text-red-500', bg: 'bg-red-50 dark:bg-red-900/30' },
];


// â”€â”€ Report history (localStorage) â”€â”€
interface ReportHistoryEntry {
  id: string;
  type: ReportType;
  typeLabel: string;
  format: 'pdf' | 'excel';
  dateFrom: string;
  dateTo: string;
  invoiceCount: number;
  includeDetails: boolean;
  generatedAt: string;
  sentToApproval: boolean;
}


const REPORT_HISTORY_KEY = 'eaisybooks_report_history';


function getReportHistory(): ReportHistoryEntry[] {
  try {
    const raw = localStorage.getItem(REPORT_HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}


function addToReportHistory(entry: ReportHistoryEntry) {
  const history = getReportHistory();
  history.unshift(entry);
  // Keep last 20
  localStorage.setItem(REPORT_HISTORY_KEY, JSON.stringify(history.slice(0, 20)));
}


function removeFromReportHistory(id: string) {
  const history = getReportHistory().filter(e => e.id !== id);
  localStorage.setItem(REPORT_HISTORY_KEY, JSON.stringify(history));
}


export default function ReportsPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedType, setSelectedType] = useState<ReportType>('havi');
  const [format, setFormat] = useState<'pdf' | 'excel'>('pdf');
  const [includeDetails, setIncludeDetails] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generated, setGenerated] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [reportHistory, setReportHistory] = useState<ReportHistoryEntry[]>(getReportHistory);
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
      const typeLabel = reportTypes.find(r => r.id === selectedType)?.title || selectedType;
      const entry: ReportHistoryEntry = {
        id: `rpt-${Date.now()}`,
        type: selectedType,
        typeLabel,
        format,
        dateFrom,
        dateTo,
        invoiceCount: reportData.invoices.length,
        includeDetails,
        generatedAt: new Date().toISOString(),
        sentToApproval: false,
      };
      addToReportHistory(entry);
      setReportHistory(getReportHistory());
      setIsGenerating(false);
      setGenerated(true);
    }, 600);
  };


  const handlePreview = () => {
    setShowPreview(true);
  };


  const handleSendEmail = async () => {
    setIsGenerating(true);
    try {


      const typeLabel = reportTypes.find(r => r.id === selectedType)?.title || selectedType;
      const fromFormatted = new Date(dateFrom).toLocaleDateString('hu-HU');
      const toFormatted = new Date(dateTo).toLocaleDateString('hu-HU');
      const invoiceCount = reportData.invoices.length;


      // Get unique client names from the report data
      const clientNames = [...new Set(reportData.invoices.map(i => i.clientName))].filter(Boolean);
      const companyLabel = clientNames.length === 1 ? clientNames[0] : `${clientNames.length} ügyfél`;


      // Fetch a contact email from the first client's comm prefs (if single-client report)
      let contactEmail = 'nincs-megadva@example.com';
      if (clientNames.length === 1) {
        // Try to find company ID for this client
        const { data: companyRow } = await supabase
          .from('companies')
          .select('id')
          .eq('name', clientNames[0])
          .maybeSingle();
        if (companyRow) {
          const { data: commPrefs } = await supabase
            .from('accounty_communication_preferences')
            .select('contact_email')
            .eq('company_id', companyRow.id)
            .maybeSingle();
          if ((commPrefs as any)?.contact_email) {
            contactEmail = (commPrefs as any).contact_email;
          }
        }
      }


      const greeting = clientNames.length === 1
        ? `Tisztelt ${clientNames[0]}!`
        : 'Tisztelt Partnerünk!';


      const subject = `${typeLabel} – ${fromFormatted} - ${toFormatted}`;


      const body = `${greeting}


Értesítjük, hogy az alábbi riport elkészült:


• Riport típusa: ${typeLabel}
• Időszak: ${fromFormatted} – ${toFormatted}
• Számlák száma: ${invoiceCount}
• Formátum: ${format.toUpperCase()}


A riport a fenti időszak összes számláját tartalmazza${includeDetails ? ' részletes tételsorokkal' : ' összesítve'}.


Üdvözlettel,
ThinkAI`;


      const htmlPreview = `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto;">
  <div style="background: #111827; padding: 24px 28px; border-radius: 8px 8px 0 0;">
    <div style="color: #ffffff; font-size: 20px; font-weight: 700;">eaisybooks</div>
    <div style="color: #9ca3af; font-size: 12px; margin-top: 2px;">Riport küldés</div>
  </div>
  <div style="padding: 28px; background: #ffffff; border: 1px solid #e5e7eb; border-top: none;">
    <p style="font-size: 15px; color: #374151; margin-bottom: 16px;">${greeting}</p>
    <p style="font-size: 14px; color: #374151; line-height: 1.6;">Értesítjük, hogy az alábbi riport elkészült:</p>
    <div style="margin: 20px 0; border-radius: 6px; overflow: hidden; border: 1px solid #e5e7eb;">
      <table style="width: 100%; border-collapse: collapse;">
        <tbody>
          <tr style="background: #f3f4f6;"><td style="padding: 10px 12px; font-size: 12px; font-weight: 600; color: #6b7280; text-transform: uppercase;">Típus</td><td style="padding: 10px 12px; font-size: 14px; color: #111827; font-weight: 500;">${typeLabel}</td></tr>
          <tr><td style="padding: 10px 12px; border-top: 1px solid #e5e7eb; font-size: 12px; font-weight: 600; color: #6b7280; text-transform: uppercase;">Időszak</td><td style="padding: 10px 12px; border-top: 1px solid #e5e7eb; font-size: 14px; color: #111827; font-weight: 500;">${fromFormatted} – ${toFormatted}</td></tr>
          <tr><td style="padding: 10px 12px; border-top: 1px solid #e5e7eb; font-size: 12px; font-weight: 600; color: #6b7280; text-transform: uppercase;">Számlák</td><td style="padding: 10px 12px; border-top: 1px solid #e5e7eb; font-size: 14px; color: #111827; font-weight: 500;">${invoiceCount} db</td></tr>
          <tr><td style="padding: 10px 12px; border-top: 1px solid #e5e7eb; font-size: 12px; font-weight: 600; color: #6b7280; text-transform: uppercase;">Formátum</td><td style="padding: 10px 12px; border-top: 1px solid #e5e7eb; font-size: 14px; color: #111827; font-weight: 500;">${format.toUpperCase()}</td></tr>
        </tbody>
      </table>
    </div>
    <p style="font-size: 14px; color: #374151; margin-top: 20px;">Üdvözlettel,<br/><strong>ThinkAI</strong></p>
  </div>
  <div style="background: #f3f4f6; padding: 14px 28px; text-align: center; border-radius: 0 0 8px 8px; border: 1px solid #e5e7eb; border-top: none;">
    <p style="font-size: 11px; color: #9ca3af; margin: 0;">Ez a levél automatikusan készült az eaisybooks rendszerből.</p>
  </div>
</div>`;


      const message: OutgoingMessage = {
        id: `msg-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        companyId: '',
        companyName: companyLabel,
        contactEmail,
        channel: 'email',
        category: 'normal',
        subject,
        originalContext: `${typeLabel} riport – ${fromFormatted} - ${toFormatted} (${invoiceCount} számla, ${format.toUpperCase()})`,
        aiGeneratedBody: body,
        htmlPreview,
        portalLink: '',
        status: 'pending',
        createdAt: new Date().toISOString(),
        missingItemIds: [],
      };


      addToApprovalQueue(message);
      const entry: ReportHistoryEntry = {
        id: `rpt-${Date.now()}`,
        type: selectedType,
        typeLabel,
        format,
        dateFrom,
        dateTo,
        invoiceCount,
        includeDetails,
        generatedAt: new Date().toISOString(),
        sentToApproval: true,
      };
      addToReportHistory(entry);
      setReportHistory(getReportHistory());
      setEmailSent(true);
      setTimeout(() => setEmailSent(false), 3000);
      toast({
        title: '✉ Riport a jóváhagyó sorba került',
        description: `${typeLabel} – ${companyLabel}`,
      });
    } catch (err) {
      reportError({ type: 'db_query', component: 'ReportsPage', action: 'reportSend', message: 'Report send error', error: err as Error });
      toast({
        variant: 'destructive',
        title: 'Hiba',
        description: 'Nem sikerült a riportot a jóváhagyó sorba tenni.',
      });
    } finally {
      setIsGenerating(false);
    }
  };


  const currentTypeLabel = reportTypes.find(r => r.id === selectedType)?.title || '';


  const handleRedownload = (entry: ReportHistoryEntry) => {
    if (entry.format === 'excel') {
      exportCSV(reportData, entry.type, { details: entry.includeDetails });
    } else {
      exportPDF(reportData, entry.type, { details: entry.includeDetails });
    }
    toast({ title: `â†“ ${entry.typeLabel} újragenerálva`, description: `${entry.format.toUpperCase()} formátumban` });
  };


  const handleDeleteReport = (id: string) => {
    removeFromReportHistory(id);
    setReportHistory(getReportHistory());
  };


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
          {reportHistory.length === 0 ? (
            <div className="p-12 text-center">
              <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto mb-4">
                <FileText className="w-6 h-6 text-slate-400" />
              </div>
              <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Még nincs generált riport</p>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">A generált riportok itt fognak megjelenni</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {reportHistory.slice(0, 10).map((entry) => {
                const icon = reportTypes.find(r => r.id === entry.type);
                const IconComp = icon?.icon || FileText;
                const genDate = new Date(entry.generatedAt);
                const fromFmt = new Date(entry.dateFrom).toLocaleDateString('hu-HU', { year: 'numeric', month: '2-digit', day: '2-digit' });
                const toFmt = new Date(entry.dateTo).toLocaleDateString('hu-HU', { year: 'numeric', month: '2-digit', day: '2-digit' });
                return (
                  <div key={entry.id} className="flex items-center gap-4 px-5 py-3.5 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center shrink-0", icon?.bg || 'bg-slate-100')}>
                      <IconComp className={cn("w-4.5 h-4.5", icon?.color || 'text-slate-500')} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">{entry.typeLabel}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        {fromFmt} – {toFmt} · {entry.invoiceCount} számla
                      </p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className={cn(
                        "text-[10px] font-bold px-2 py-0.5 rounded-full uppercase",
                        entry.format === 'pdf' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                      )}>
                        {entry.format}
                      </span>
                      {entry.sentToApproval && (
                        <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400">
                          ✉ Küldve
                        </span>
                      )}
                      <span className="text-[11px] text-slate-400 dark:text-slate-500 tabular-nums">
                        {genDate.toLocaleDateString('hu-HU')} {genDate.toLocaleTimeString('hu-HU', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      <button
                        onClick={() => handleRedownload(entry)}
                        className="p-1.5 rounded-md text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:text-blue-400 dark:hover:bg-blue-900/30 transition-colors"
                        title="Újra letöltés"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteReport(entry.id)}
                        className="p-1.5 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:text-red-400 dark:hover:bg-red-900/30 transition-colors"
                        title="Törlés"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
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
                    <span className="text-xs font-semibold text-slate-600 dark:text-slate-400"> Előnézet — {currentTypeLabel}</span>
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
            <div className="p-4 border-t border-border flex items-center justify-between shrink-0 dark:bg-slate-900/50">
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
