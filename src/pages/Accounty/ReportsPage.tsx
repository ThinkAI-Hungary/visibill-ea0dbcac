import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PreviewTable, exportCSV, exportPDF } from './reports/ReportHelpers';
import { Calendar, FileText, PieChart, TrendingUp, Users, FileWarning } from 'lucide-react';
import { useAccountyFullReportData, type FullReportData, type InvoiceReportRow, type ReportRow } from '@/hooks/accounty';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { reportError } from '@/lib/errorReporter';
import { ReportGeneratorModal } from './reports/ReportGeneratorModal';
import { ReportCatalog, type ReportTypeConfig } from './reports/ReportCatalog';
import {
  ReportHistoryList,
  type ReportHistoryEntry,
  getReportHistory,
  addToReportHistory,
  removeFromReportHistory,
} from './reports/ReportHistory';
import {
  addToApprovalQueue,
  type OutgoingMessage,
} from './generateRequestEmail';


type ReportType = 'havi' | 'afa' | 'koltseg' | 'cashflow' | 'partner' | 'hianyzo';


const reportTypes: ReportTypeConfig[] = [
  { id: 'havi', title: 'Havi összesítő', description: 'Bejövő és kimenő számlák összesítése, ÁFA kimutatás', icon: Calendar, color: 'text-indigo-500', bg: 'bg-indigo-50 dark:bg-indigo-900/30' },
  { id: 'afa', title: 'ÁFA kimutatás', description: 'Részletes ÁFA bontás kategóriánként', icon: FileText, color: 'text-primary', bg: 'bg-accent-subtle dark:bg-accent' },
  { id: 'koltseg', title: 'Költségkimutatás', description: 'Költségek főkönyvi szám és kategória szerint', icon: PieChart, color: 'text-amber-500', bg: 'bg-amber-50 dark:bg-amber-900/30' },
  { id: 'cashflow', title: 'Cash flow riport', description: 'Pénzforgalom és likviditás elemzés', icon: TrendingUp, color: 'text-blue-500', bg: 'bg-blue-50 dark:bg-blue-900/30' },
  { id: 'partner', title: 'Partner kimutatás', description: 'Szállítói és vevői forgalom riport', icon: Users, color: 'text-rose-500', bg: 'bg-rose-50 dark:bg-rose-900/30' },
  { id: 'hianyzo', title: 'Hiányzó számlák riport', description: 'Automatikus bekérő statisztikák', icon: FileWarning, color: 'text-red-500', bg: 'bg-red-50 dark:bg-red-900/30' },
];


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
      if (inv.clientName === 'SANDBOX') return false;
      if (!inv.date || inv.date === '-') return false;
      const parts = inv.date.split('. ').map(s => parseInt(s));
      if (parts.length < 3) return false;
      const invDate = new Date(parts[0], parts[1] - 1, parts[2]);
      return invDate >= fromDate && invDate <= toDate;
    });

    const filteredClients = rawReportData.clients.filter(c => c.clientName !== 'SANDBOX');
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
      const clientNames = [...new Set(reportData.invoices.map(i => i.clientName))].filter(Boolean);
      const companyLabel = clientNames.length === 1 ? clientNames[0] : `${clientNames.length} ügyfél`;

      let contactEmail = 'nincs-megadva@example.com';
      if (clientNames.length === 1) {
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
    toast({ title: `↓ ${entry.typeLabel} újragenerálva`, description: `${entry.format.toUpperCase()} formátumban` });
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
      <ReportCatalog reportTypes={reportTypes} onSelect={openModal} />

      {/* Recent Reports */}
      <ReportHistoryList
        reportHistory={reportHistory}
        reportTypes={reportTypes}
        onRedownload={handleRedownload}
        onDelete={handleDeleteReport}
      />

      <ReportGeneratorModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        selectedType={selectedType}
        onTypeChange={(v) => { setSelectedType(v); setGenerated(false); setShowPreview(false); }}
        format={format}
        onFormatChange={setFormat}
        dateFrom={dateFrom}
        dateTo={dateTo}
        onDateFromChange={(v) => { setDateFrom(v); setGenerated(false); setShowPreview(false); }}
        onDateToChange={(v) => { setDateTo(v); setGenerated(false); setShowPreview(false); }}
        includeDetails={includeDetails}
        onIncludeDetailsChange={setIncludeDetails}
        isGenerating={isGenerating}
        generated={generated}
        showPreview={showPreview}
        emailSent={emailSent}
        reportData={reportData}
        currentTypeLabel={currentTypeLabel}
        onGenerate={handleGenerate}
        onPreview={handlePreview}
        onSendEmail={handleSendEmail}
        onHidePreview={() => setShowPreview(false)}
      />
    </div>
  );
}
