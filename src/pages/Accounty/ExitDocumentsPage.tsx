import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import {
  ArrowLeft, FileText, Download, Printer, CheckCircle, Clock,
  Eye, AlertTriangle, Package, Loader2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useEmployeeJobs } from '@/hooks/accounty';
import { ExportButton } from '@/components/accounty/ExportButton';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { usePayrollEmployee, usePayrollEmployments, usePayrollCalculations, usePayrollCycles, usePayrollLeaves } from '@/hooks/usePayrollData';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { AccountyErrorState } from '@/components/accounty/AccountyErrorState';
import { ContentSkeleton } from '@/components/ui/content-skeleton';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

function hu(text: string): string {
  return text.replace(/ő/g, 'ö').replace(/Ő/g, 'Ö').replace(/ű/g, 'ü').replace(/Ű/g, 'Ü');
}
const fmt = (n: number) => n.toLocaleString('hu-HU');
/** Format any date string or Date to consistent Hungarian format */
const fmtDate = (d: string | Date | null | undefined): string => {
  if (!d) return '–';
  const date = typeof d === 'string' ? new Date(d) : d;
  if (isNaN(date.getTime())) return String(d);
  return date.toLocaleDateString('hu-HU');
};

interface ExitDocument {
  id: string;
  title: string;
  legalRef: string;
  description: string;
  required: boolean;
  status: 'generated' | 'pending' | 'na';
  template: string;
}

const DOCUMENT_TEMPLATES: ExitDocument[] = [
  { id: 'cert', title: 'Munkáltatói igazolás', legalRef: 'Mt. 80. § (2)', description: 'Foglalkoztatás időtartama, munkakör, bérre vonatkozó adatok', required: true, status: 'pending', template: 'Tartalmazza a jogviszony kezdetét, végét, munkaköri leírást, az utolsó 6 havi bruttó átlagkeresetet.' },
  { id: 'tb', title: 'TB igazolás (OEP)', legalRef: 'Tbj. 50. §', description: 'Társadalombiztosítási jogviszony záró igazolás', required: true, status: 'pending', template: 'Igazolja a biztosítási jogviszony megszűnését, az utolsó TB járulék befizetés dátumát.' },
  { id: 'income', title: 'Jövedelemigazolás (M30)', legalRef: 'Szja tv. 46. § (4)', description: 'Éves jövedelem adatok a kilépés napjáig', required: true, status: 'pending', template: 'Az adott évi összes jövedelem, levont adó, járulékok összesítése január 1-től az utolsó napig.' },
  { id: 'leave', title: 'Szabadság-elszámolás', legalRef: 'Mt. 125. §', description: 'Ki nem vett szabadság megváltás kalkuláció', required: true, status: 'pending', template: 'Éves szabadságkeret felhasználtság és megváltás kalkuláció.' },
  { id: 'severance', title: 'Végkielégítés számfejtés', legalRef: 'Mt. 77. §', description: 'Végkielégítés összegének kiszámítása (ha jár)', required: false, status: 'na', template: 'A felek megállapodhatnak végkielégítésben.' },
  { id: 'final_payslip', title: 'Záró bérjegyzék', legalRef: 'Mt. 155. §', description: 'Az utolsó munkahónap bérjegyzéke', required: true, status: 'pending', template: 'Tartalmazza az arányos bért, szabadság-megváltást, végkielégítést, és a végső nettó összeget.' },
  { id: 'deregister', title: '08E kijelentés', legalRef: 'Art. 50. §', description: 'NAV felé történő biztosítotti kijelentés', required: true, status: 'pending', template: 'Változáskód: 02 (Jogviszony megszűnése). Határidő: utolsó naptól 15 nap.' },
  { id: 'pension', title: 'Szolgálati idő igazolás', legalRef: 'Tny. 96. §', description: 'Nyugdíjszolgáltatáshoz szükséges adatszolgáltatás', required: false, status: 'na', template: 'Tartalmazza a teljes jogviszony alatti biztosításban töltött napokat.' },
  { id: 'training', title: 'Tanulmányi szerződés elszámolás', legalRef: 'Mt. 229. §', description: 'Tanulmányi szerződés alapján fennálló visszafizetési kötelezettség', required: false, status: 'na', template: 'Nem alkalmazandó — nincs aktív tanulmányi szerződés.' },
  { id: 'competition', title: 'Versenytilalmi megállapodás', legalRef: 'Mt. 228. §', description: 'Kilépés utáni versenytilalmi kötelezettség és kompenzáció', required: false, status: 'na', template: 'Nem alkalmazandó — nincs versenytilalmi megállapodás.' },
];

const STATUS_BADGE: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  generated: { label: 'Elkészült', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400', icon: CheckCircle },
  pending: { label: 'Készítendő', color: 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400', icon: Clock },
  na: { label: 'Nem alkalmazandó', color: 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400', icon: Clock },
};

export default function ExitDocumentsPage() {
  const { companyId, empId } = useParams<{ companyId: string; empId: string }>();
  const id = companyId;
  const { data: jobs, isLoading, isError: jobsError, refetch: refetchJobs } = useEmployeeJobs(id || '', empId || '');
  const { data: employee } = usePayrollEmployee(empId || '');
  const { data: employments = [] } = usePayrollEmployments(empId || '');
  const { data: cycles = [] } = usePayrollCycles(id || '');
  const currentCycle = cycles.find(c => c.year === new Date().getFullYear() && c.month === new Date().getMonth() + 1) || cycles[0];
  const { data: calculations = [] } = usePayrollCalculations(currentCycle?.id || '');
  const primaryEmployment = employments.find(e => e.status === 'active') || employments[0];
  const { data: leaves = [] } = usePayrollLeaves(primaryEmployment?.id || '');

  const { toast } = useToast();
  const [docs, setDocs] = useState(DOCUMENT_TEMPLATES);
  const [expandedDoc, setExpandedDoc] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewTitle, setPreviewTitle] = useState('');
  const [saving, setSaving] = useState(false);

  // Load saved document states from DB
  useEffect(() => {
    if (!id || !empId) return;
    (async () => {
      const { data: savedDocs } = await supabase
        .from('accounty_documents')
        .select('doc_type')
        .eq('company_id', id)
        .eq('employee_id', empId)
        .like('doc_type', 'exit_%');
      if (savedDocs && savedDocs.length > 0) {
        const savedIds = new Set(savedDocs.map((d: any) => d.doc_type.replace('exit_', '')));
        setDocs(prev => prev.map(d => savedIds.has(d.id) ? { ...d, status: 'generated' as const } : d));
      }
    })();
  }, [id, empId]);

  const activeJob = (jobs || []).find(j => j.status === 'active');
  const empName = employee ? `${employee.last_name} ${employee.first_name}` : 'Munkavállaló';
  const empLabel = activeJob ? `${empName} — ${activeJob.position}` : empName;

  const generatedCount = docs.filter(d => d.status === 'generated').length;
  const requiredCount = docs.filter(d => d.required).length;
  const requiredDoneCount = docs.filter(d => d.required && d.status === 'generated').length;

  // Get the employee's own calculation
  const empCalc = calculations.find(c => {
    const meta = c.metadata as any;
    return meta?.employee_id === empId;
  }) || calculations[0];

  const generateDocPdf = (doc: ExitDocument): string => {
    const d = new jsPDF({ unit: 'mm', format: 'a4' });
    const pw = d.internal.pageSize.getWidth();
    const today = new Date().toLocaleDateString('hu-HU');

    // Header bar
    d.setFillColor(220, 38, 38);
    d.rect(0, 0, pw, 32, 'F');
    d.setTextColor(255);
    d.setFontSize(14);
    d.setFont('helvetica', 'bold');
    d.text(hu(doc.title), 16, 14);
    d.setFontSize(8);
    d.setFont('helvetica', 'normal');
    d.text(hu(`Jogszabályi alap: ${doc.legalRef}`), 16, 22);
    d.text(hu(`Dátum: ${today}`), pw - 16, 14, { align: 'right' });
    d.text(hu(`Generálva: ${new Date().toLocaleString('hu-HU')}`), pw - 16, 22, { align: 'right' });
    d.setTextColor(0);

    let y = 42;

    // Document title
    d.setFontSize(13);
    d.setFont('helvetica', 'bold');
    d.text(hu(doc.title.toUpperCase()), pw / 2, y, { align: 'center' });
    y += 10;

    // Employee info box
    d.setFillColor(245, 247, 250);
    d.roundedRect(16, y, pw - 32, 24, 3, 3, 'F');
    d.setFontSize(9);
    d.setFont('helvetica', 'bold');
    d.setTextColor(30, 58, 95);
    d.text(hu('Munkavállaló adatai'), 22, y + 7);
    d.setTextColor(0);
    d.setFont('helvetica', 'normal');
    d.text(hu(`Név: ${empName}`), 22, y + 14);
    d.text(hu(`TAJ: ${employee?.taj_number || '–'}`), 100, y + 14);
    d.text(hu(`Adóazonosító: ${employee?.tax_id || '–'}`), 22, y + 20);
    d.text(hu(`Munkakör: ${activeJob?.position || primaryEmployment?.job_title || '–'}`), 100, y + 20);
    y += 32;

    // Document-specific content
    switch (doc.id) {
      case 'cert': {
        d.setFontSize(9);
        d.setFont('helvetica', 'normal');
        d.text(hu('Alulírott munkáltató igazolom, hogy a fent nevezett munkavállaló cégünknél'), 16, y); y += 5;
        d.text(hu('munkaviszonyban állt az alábbiak szerint:'), 16, y); y += 10;

        autoTable(d, {
          startY: y,
          head: [[hu('Adat'), hu('Érték')]],
          body: [
            [hu('Jogviszony kezdete'), fmtDate(primaryEmployment?.start_date)],
            [hu('Jogviszony vége'), today],
            [hu('Munkakör'), hu(primaryEmployment?.job_title || '–')],
            [hu('FEOR kód'), primaryEmployment?.feor_code || '–'],
            [hu('Utolsó havi bruttó bér'), empCalc ? `${fmt(empCalc.gross_salary || 0)} Ft` : '–'],
            [hu('Utolsó havi nettó bér'), empCalc ? `${fmt(empCalc.net_salary || 0)} Ft` : '–'],
            [hu('Jogviszony megszünésének módja'), hu('Közös megegyezés')],
          ],
          theme: 'grid',
          headStyles: { fillColor: [220, 38, 38], textColor: 255, fontSize: 9, fontStyle: 'bold' },
          bodyStyles: { fontSize: 9 },
          columnStyles: { 1: { fontStyle: 'bold' } },
          margin: { left: 16, right: 16 },
        });
        break;
      }
      case 'tb': {
        d.setFontSize(9);
        d.setFont('helvetica', 'normal');
        d.text(hu('Igazolom, hogy a fent nevezett személy társadalombiztosítási jogviszonya'), 16, y); y += 5;
        d.text(hu('cégünknél az alábbiak szerint alakult:'), 16, y); y += 10;

        autoTable(d, {
          startY: y,
          head: [[hu('Adat'), hu('Érték')]],
          body: [
            [hu('Biztosítás kezdete'), fmtDate(primaryEmployment?.start_date)],
            [hu('Biztosítás vége'), today],
            [hu('Biztosítási jogviszony típusa'), hu('Munkaviszony (Tbj. 6. §)')],
            [hu('Utolsó TB járulék befizetés'), today],
            [hu('TB járulék alapja (utolsó hó)'), empCalc ? `${fmt(empCalc.gross_salary || 0)} Ft` : '–'],
            [hu('Levont TB járulék (utolsó hó)'), empCalc ? `${fmt(empCalc.tb_amount || 0)} Ft` : '–'],
          ],
          theme: 'grid',
          headStyles: { fillColor: [220, 38, 38], textColor: 255, fontSize: 9, fontStyle: 'bold' },
          bodyStyles: { fontSize: 9 },
          columnStyles: { 1: { fontStyle: 'bold' } },
          margin: { left: 16, right: 16 },
        });
        break;
      }
      case 'income': {
        d.setFontSize(9);
        d.setFont('helvetica', 'normal');
        d.text(hu(`Jövedelemigazolás a ${new Date().getFullYear()}. adóév kezdetétől a jogviszony`), 16, y); y += 5;
        d.text(hu('megszünéséig terjedő időszakra:'), 16, y); y += 10;

        const months = currentCycle?.month || new Date().getMonth() + 1;
        const yearGross = (empCalc?.gross_salary || 0) * months;
        const yearSzja = (empCalc?.szja_amount || 0) * months;
        const yearTb = (empCalc?.tb_amount || 0) * months;
        const yearNet = (empCalc?.net_salary || 0) * months;

        autoTable(d, {
          startY: y,
          head: [[hu('Jogcím'), hu('Összeg (Ft)')]],
          body: [
            [hu(`Bruttó jövedelem (${months} hónap)`), fmt(yearGross)],
            [hu('Levont SZJA (15%)'), `– ${fmt(yearSzja)}`],
            [hu('Levont TB járulék (18,5%)'), `– ${fmt(yearTb)}`],
            [hu('Nettó jövedelem összesen'), fmt(yearNet)],
          ],
          theme: 'grid',
          headStyles: { fillColor: [220, 38, 38], textColor: 255, fontSize: 9, fontStyle: 'bold' },
          bodyStyles: { fontSize: 9 },
          columnStyles: { 1: { halign: 'right', fontStyle: 'bold' } },
          margin: { left: 16, right: 16 },
          didParseCell: (data) => {
            if (data.section === 'body' && data.row.index === 3) {
              data.cell.styles.fillColor = [220, 252, 231];
              data.cell.styles.fontStyle = 'bold';
            }
          },
        });
        break;
      }
      case 'leave': {
        d.setFontSize(9);
        d.setFont('helvetica', 'normal');
        d.text(hu('Szabadságra vonatkozó elszámolás a jogviszony megszünésekor:'), 16, y); y += 10;

        const usedDays = leaves.filter(l => l.leave_type === 'annual' && l.status === 'approved').reduce((s, l) => s + l.days, 0);
        const totalDays = 20; // base leave
        const remaining = totalDays - usedDays;
        const dailyRate = Math.round((empCalc?.gross_salary || 0) / 21.67);

        autoTable(d, {
          startY: y,
          head: [[hu('Tétel'), hu('Napok'), hu('Összeg (Ft)')]],
          body: [
            [hu('Éves szabadságkeret'), `${totalDays}`, '–'],
            [hu('Felhasznált szabadság'), `${usedDays}`, '–'],
            [hu('Ki nem vett szabadság'), `${remaining}`, '–'],
            [hu('Napi bruttó bér (számított)'), '–', fmt(dailyRate)],
            [hu('Szabadság-megváltás bruttó összege'), `${remaining}`, fmt(remaining * dailyRate)],
          ],
          theme: 'grid',
          headStyles: { fillColor: [220, 38, 38], textColor: 255, fontSize: 9, fontStyle: 'bold' },
          bodyStyles: { fontSize: 9 },
          columnStyles: { 1: { halign: 'center' }, 2: { halign: 'right', fontStyle: 'bold' } },
          margin: { left: 16, right: 16 },
          didParseCell: (data) => {
            if (data.section === 'body' && data.row.index === 4) {
              data.cell.styles.fillColor = [220, 252, 231];
            }
          },
        });
        break;
      }
      case 'final_payslip': {
        d.setFontSize(9);
        d.setFont('helvetica', 'normal');
        d.text(hu('Záró bérjegyzék — utolsó havi elszámolás:'), 16, y); y += 10;

        autoTable(d, {
          startY: y,
          head: [[hu('Jogcím'), hu('Összeg (Ft)')]],
          body: [
            [hu('Arányos bruttó munkabér'), fmt(empCalc?.gross_salary || 0)],
            [hu('SZJA (15%)'), `– ${fmt(empCalc?.szja_amount || 0)}`],
            [hu('TB járulék (18,5%)'), `– ${fmt(empCalc?.tb_amount || 0)}`],
            [hu('Egyéb levonások'), `– ${fmt(empCalc?.total_deductions || 0)}`],
            [hu('Nettó kifizetés'), fmt(empCalc?.net_salary || 0)],
          ],
          theme: 'grid',
          headStyles: { fillColor: [220, 38, 38], textColor: 255, fontSize: 9, fontStyle: 'bold' },
          bodyStyles: { fontSize: 9 },
          columnStyles: { 1: { halign: 'right', fontStyle: 'bold' } },
          margin: { left: 16, right: 16 },
          didParseCell: (data) => {
            if (data.section === 'body' && data.row.index === 4) {
              data.cell.styles.fillColor = [220, 252, 231];
              data.cell.styles.fontStyle = 'bold';
            }
          },
        });
        break;
      }
      case 'deregister': {
        d.setFontSize(9);
        d.setFont('helvetica', 'normal');
        d.text(hu('NAV felé benyújtandó 08E biztosítotti bejelentés/kijelentés adatai:'), 16, y); y += 10;

        autoTable(d, {
          startY: y,
          head: [[hu('Mező'), hu('Érték')]],
          body: [
            [hu('Változás kódja'), hu('02 — Jogviszony megszünése')],
            [hu('Biztosított neve'), hu(empName)],
            [hu('TAJ száma'), employee?.taj_number || '–'],
            [hu('Adóazonosító jel'), employee?.tax_id || '–'],
            [hu('Jogviszony típusa'), hu('Munkaviszony')],
            [hu('Biztosítás vége'), today],
            [hu('Benyújtási határidő'), hu(`${today} + 15 nap`)],
          ],
          theme: 'grid',
          headStyles: { fillColor: [220, 38, 38], textColor: 255, fontSize: 9, fontStyle: 'bold' },
          bodyStyles: { fontSize: 9 },
          columnStyles: { 1: { fontStyle: 'bold' } },
          margin: { left: 16, right: 16 },
        });
        break;
      }
      default: {
        d.setFontSize(10);
        d.setFont('helvetica', 'normal');
        d.text(hu(doc.template), 16, y, { maxWidth: pw - 32 });
      }
    }

    // Legal reference
    const finalY = (d as any).lastAutoTable?.finalY || y + 20;
    d.setFontSize(7);
    d.setTextColor(120);
    d.text(hu(`Jogszabályi alap: ${doc.legalRef}`), 16, finalY + 12);
    d.text(hu('Jelen dokumentum a jogszabályi kötelezettségek teljesítése érdekében került kiállításra.'), 16, finalY + 16);
    d.setTextColor(0);

    // Signature block
    const sigY = Math.min(finalY + 30, d.internal.pageSize.getHeight() - 40);
    d.setDrawColor(180);
    d.setLineWidth(0.3);
    d.line(16, sigY, 80, sigY);
    d.line(pw - 80, sigY, pw - 16, sigY);
    d.setFontSize(8);
    d.setTextColor(120);
    d.text(hu('Munkáltató aláírása, bélyegző'), 48, sigY + 5, { align: 'center' });
    d.text(hu('Keltezés'), pw - 48, sigY + 5, { align: 'center' });
    d.setDrawColor(180);
    d.setLineWidth(0.5);
    d.circle(48, sigY - 12, 8, 'S');
    d.setFontSize(7);
    d.text('P.H.', 48, sigY - 11, { align: 'center' });

    // Footer
    const ph = d.internal.pageSize.getHeight();
    d.setDrawColor(200);
    d.line(16, ph - 16, pw - 16, ph - 16);
    d.setTextColor(150);
    d.setFontSize(7);
    d.text(hu(`${doc.title} | ${doc.legalRef} | ${today}`), pw / 2, ph - 10, { align: 'center' });

    return d.output('bloburl').toString();
  };

  const handlePreview = (doc: ExitDocument) => {
    const url = generateDocPdf(doc);
    setPreviewUrl(url);
    setPreviewTitle(doc.title);
  };

  const handleDownload = (doc: ExitDocument) => {
    const d = new jsPDF({ unit: 'mm', format: 'a4' });
    // Re-generate the same PDF and save
    const url = generateDocPdf(doc);
    // Download using blob url
    const a = document.createElement('a');
    a.href = url;
    a.download = `${doc.id}_${empName.replace(/\s+/g, '_')}.pdf`;
    a.click();
  };

  if (jobsError) return <AccountyErrorState message="Nem sikerült betölteni a kilépő dokumentumok adatait." onRetry={() => refetchJobs()} />;
  if (isLoading) return <ContentSkeleton />;

  return (
    <div className="w-full max-w-5xl mx-auto space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => window.history.back()} className="p-2 rounded-lg hover:bg-muted transition-colors"><ArrowLeft className="w-5 h-5" /></button>
          <div className="p-2.5 bg-gradient-to-br from-red-500 to-pink-600 rounded-xl shadow-lg shadow-red-500/25"><Package className="w-5 h-5 text-white" /></div>
          <div>
            <h1 className="text-2xl font-bold">Kilépő dokumentumcsomag</h1>
            <p className="text-sm text-slate-500">{empLabel}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <ExportButton
            filename={`kilepo_csomag_${empName}`}
            headers={['Dokumentum', 'Jogszabály', 'Státusz', 'Kötelező']}
            getRows={() => docs.map(d => [d.title, d.legalRef, STATUS_BADGE[d.status].label, d.required ? 'Igen' : 'Nem'])}
            size="sm"
            pdfOptions={{ title: 'Kilépő dokumentumcsomag' }}
          />
          <Button variant="outline" className="gap-1.5" onClick={() => window.print()}><Printer className="w-4 h-4" /> Nyomtatás</Button>
        </div>
      </div>

      <div className="bg-gradient-to-r from-red-50 to-pink-50 dark:from-red-500/10 dark:to-pink-500/10 rounded-xl border border-red-200 dark:border-red-500/20 p-5">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-bold text-red-800 dark:text-red-300">Kötelező dokumentumok</h3>
          <span className="text-sm font-bold">{requiredDoneCount}/{requiredCount}</span>
        </div>
        <div className="w-full h-2 bg-red-100 dark:bg-red-500/20 rounded-full overflow-hidden">
          <div className="h-full bg-red-500 rounded-full transition-all" style={{ width: `${requiredCount > 0 ? (requiredDoneCount / requiredCount) * 100 : 0}%` }} />
        </div>
        {requiredDoneCount < requiredCount && (
          <p className="text-xs text-red-600 mt-2 flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> {requiredCount - requiredDoneCount} kötelező dokumentum még hiányzik</p>
        )}
      </div>

      <div className="space-y-2">
        {docs.map(doc => {
          const badge = STATUS_BADGE[doc.status];
          const isExpanded = expandedDoc === doc.id;
          return (
            <div key={doc.id} className={cn('bg-card rounded-xl border shadow-soft overflow-hidden transition-all', doc.status === 'na' ? 'border-border/50 opacity-60' : 'border-border')}>
              <button onClick={() => setExpandedDoc(isExpanded ? null : doc.id)} className="w-full flex items-center gap-4 px-5 py-3.5 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors text-left">
                <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center shrink-0', doc.status === 'generated' ? 'bg-emerald-100 dark:bg-emerald-500/20' : doc.status === 'pending' ? 'bg-blue-100 dark:bg-blue-500/20' : 'bg-slate-100 dark:bg-slate-800')}>
                  <FileText className={cn('w-4 h-4', doc.status === 'generated' ? 'text-emerald-600' : doc.status === 'pending' ? 'text-blue-600' : 'text-slate-400')} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-bold">{doc.title}</p>
                    {doc.required && <span className="text-[10px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded font-bold">KÖTELEZŐ</span>}
                    <span className={cn('px-2 py-0.5 rounded-full text-[10px] font-bold', badge.color)}>{badge.label}</span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">{doc.legalRef} — {doc.description}</p>
                </div>
                {doc.status === 'generated' && (
                  <div className="flex gap-1 shrink-0">
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0" title="Megtekintés" onClick={e => { e.stopPropagation(); handlePreview(doc); }}><Eye className="w-3 h-3" /></Button>
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0" title="Letöltés" onClick={e => { e.stopPropagation(); handleDownload(doc); }}><Download className="w-3 h-3" /></Button>
                  </div>
                )}
              </button>
              {isExpanded && (
                <div className="px-5 pb-4 pl-[68px] border-t border-border/50 pt-3">
                  <p className="text-xs text-slate-600 dark:text-slate-400">{doc.template}</p>
                  {doc.status === 'pending' && (
                    <Button size="sm" className="mt-3 gap-1 text-xs bg-blue-600 hover:bg-blue-700" disabled={saving} onClick={async () => {
                      setSaving(true);
                      try {
                        await supabase.from('accounty_documents').insert({
                          company_id: id,
                          employee_id: empId,
                          title: doc.title,
                          doc_type: `exit_${doc.id}`,
                          status: 'generated',
                          period: `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`,
                          generated_at: new Date().toISOString(),
                          file_url: '',
                        });
                        setDocs(prev => prev.map(d => d.id === doc.id ? { ...d, status: 'generated' as const } : d));
                        toast({ title: 'Dokumentum generálva', description: doc.title });
                      } catch (err: any) {
                        toast({ variant: 'destructive', title: 'Hiba', description: err.message });
                      } finally {
                        setSaving(false);
                      }
                    }}>
                      {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <FileText className="w-3 h-3" />} Generálás most
                    </Button>
                  )}
                  {doc.status === 'generated' && (
                    <div className="flex gap-2 mt-3">
                      <Button size="sm" variant="outline" className="gap-1 text-xs" onClick={() => handlePreview(doc)}>
                        <Eye className="w-3 h-3" /> Megtekintés
                      </Button>
                      <Button size="sm" variant="outline" className="gap-1 text-xs" onClick={() => handleDownload(doc)}>
                        <Download className="w-3 h-3" /> Letöltés
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <Dialog open={!!previewUrl} onOpenChange={(open) => !open && setPreviewUrl(null)}>
        <DialogContent className="max-w-5xl h-[90vh] flex flex-col p-0 gap-0">
          <DialogHeader className="px-6 py-4 border-b border-border">
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-red-500" />
              {previewTitle}
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 w-full bg-slate-200 dark:bg-slate-900">
            {previewUrl && (
              <iframe src={previewUrl} className="w-full h-full border-0" title={`${previewTitle} megtekintő`} />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
