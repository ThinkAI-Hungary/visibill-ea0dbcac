import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import {
  ArrowLeft, FileText, Download, Printer, CheckCircle, Clock,
  Eye, AlertTriangle, Package, Loader2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useEmployeeJobs, useAccountyClients } from '@/hooks/accounty';
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
  na: { label: 'Nem alkalmazandó', color: 'bg-muted text-muted-foreground dark:bg-muted dark:text-muted-foreground', icon: Clock },
};

export default function ExitDocumentsPage() {
  const { companyId, empId } = useParams<{ companyId: string; empId: string }>();
  const id = companyId;
  const { data: jobs, isLoading, isError: jobsError, refetch: refetchJobs } = useEmployeeJobs(id || '', empId || '');
  const { data: clients } = useAccountyClients();
  const currentCompany = clients?.find(c => c.id === id || c.companyId === id);
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

  const renderExitDocumentPage = (d: jsPDF, doc: ExitDocument, pageIndex: number, totalPages: number) => {
    const pw = d.internal.pageSize.getWidth();
    const ph = d.internal.pageSize.getHeight();
    const today = new Date().toLocaleDateString('hu-HU');
    const exitDate = primaryEmployment?.end_date ? fmtDate(primaryEmployment.end_date) : today;
    const startDate = primaryEmployment?.start_date ? fmtDate(primaryEmployment.start_date) : '2026. 01. 01.';
    const companyName = currentCompany?.name || 'Munkáltató Kft.';
    const companyTaxId = currentCompany?.taxNumber || (currentCompany as any)?.tax_id || '12345678-2-42';

    // Realistic wage and tax resolution
    const gross = empCalc?.gross_salary || primaryEmployment?.base_salary || 450000;
    const szja = empCalc?.szja_amount || Math.round(gross * 0.15);
    const tb = empCalc?.tb_amount || Math.round(gross * 0.185);
    const net = empCalc?.net_salary || (gross - szja - tb);

    const months = currentCycle?.month || new Date().getMonth() + 1;
    const yearGross = (empCalc?.gross_salary || gross) * months;
    const yearSzja = Math.round(yearGross * 0.15);
    const yearTb = Math.round(yearGross * 0.185);
    const yearNet = yearGross - yearSzja - yearTb;

    // Vacation resolution
    const usedDays = leaves.filter(l => l.leave_type === 'annual' && l.status === 'approved').reduce((s, l) => s + l.days, 0);
    const baseDays = 20;
    const bonusDays = 2;
    const totalAnnualDays = baseDays + bonusDays;
    const proportion = Math.min(1, Math.max(0.08, months / 12));
    const proportionalDays = Math.max(usedDays, Math.round(totalAnnualDays * proportion));
    const remainingDays = Math.max(0, proportionalDays - usedDays);
    const dailyRate = Math.round(gross / 21.67);
    const leaveCompensation = remainingDays * dailyRate;

    // Header band (Deep teal)
    d.setFillColor(15, 118, 110);
    d.rect(0, 0, pw, 20, 'F');
    d.setTextColor(255);
    d.setFontSize(11);
    d.setFont('helvetica', 'bold');
    d.text(hu(doc.title.toUpperCase()), 16, 13);
    d.setFontSize(8.5);
    d.setFont('helvetica', 'normal');
    d.text(hu(doc.legalRef), pw - 16, 13, { align: 'right' });
    d.setTextColor(0);

    // Employee & Company Card
    d.setFillColor(248, 250, 252);
    d.setDrawColor(226, 232, 240);
    d.setLineWidth(0.4);
    d.roundedRect(16, 25, pw - 32, 30, 2, 2, 'FD');

    // Left Column
    d.setFontSize(8);
    d.setTextColor(100);
    d.text(hu('Munkavállaló neve:'), 22, 33);
    d.text(hu('Munkakör / FEOR:'), 22, 41);
    d.text(hu('Adóazonosító / TAJ:'), 22, 49);

    d.setFont('helvetica', 'bold');
    d.setTextColor(30);
    d.text(hu(empName), 58, 33);
    d.text(hu(`${activeJob?.position || primaryEmployment?.job_title || 'Alkalmazott'} (FEOR: ${primaryEmployment?.feor_code || '4112'})`), 58, 41);
    d.text(hu(`${employee?.tax_id || '8000000008'} / ${employee?.taj_number || '123-456-788'}`), 58, 49);

    // Right Column
    d.setFont('helvetica', 'normal');
    d.setTextColor(100);
    d.text(hu('Munkáltató:'), pw / 2 + 6, 33);
    d.text(hu('Munkaviszony kezdete:'), pw / 2 + 6, 41);
    d.text(hu('Kilépés napja / Keltezés:'), pw / 2 + 6, 49);

    d.setFont('helvetica', 'bold');
    d.setTextColor(30);
    d.text(hu(`${companyName} (${companyTaxId})`), pw / 2 + 48, 33);
    d.text(hu(startDate), pw / 2 + 48, 41);
    d.text(hu(`${exitDate} / ${today}`), pw / 2 + 48, 49);

    // Section subheader
    d.setFont('helvetica', 'bold');
    d.setFontSize(9);
    d.setTextColor(15, 118, 110);
    d.text(hu('HIVATALOS IGAZOLÁS TARTALMA ÉS RÉSZLETEZŐ KIMUTATÁSA'), 16, 62);
    d.setDrawColor(15, 118, 110);
    d.setLineWidth(0.4);
    d.line(16, 64, pw - 16, 64);

    // Content based on doc.id
    switch (doc.id) {
      case 'cert': {
        autoTable(d, {
          startY: 68,
          head: [[hu('Jogszabályi adatcsoport (Mt. 80. §)'), hu('Nyilvántartott és igazolt adat')]],
          body: [
            [hu('Munkaviszony időtartama'), `${startDate} – ${exitDate}`],
            [hu('Munkakör megnevezése és FEOR'), hu(`${primaryEmployment?.job_title || activeJob?.position || 'Alkalmazott'} (FEOR: ${primaryEmployment?.feor_code || '4112'})`)],
            [hu('Megszűnés jogcíme'), hu('Közös megegyezés (Mt. 64. § (1) bek. a) pont)')],
            [hu('Havi bruttó alapbér (utolsó érvényes)'), `${fmt(gross)} Ft`],
            [hu('Irányadó átlagkereset / távolléti díj'), `${fmt(gross)} Ft/hó`],
            [hu('Tárgyévi rendes szabadság elszámolása'), hu(`${proportionalDays} napból ${usedDays} nap kiadva, ${remainingDays} nap megváltva (${fmt(leaveCompensation)} Ft)`)],
            [hu('Munkabérből levonandó tartozás / letiltás'), hu('Nincs érvényben lévő letiltás / Levonásmentes')],
            [hu('Végkielégítés megállapítása'), hu('0 Ft (közös megegyezés alapján nem került megállapításra)')],
            [hu('Versenytilalmi kötelezettség / tanulmányi szerződés'), hu('Nem terheli a munkavállalót')],
            [hu('Felek elszámolási nyilatkozata'), hu('A felek a munkaviszonyból eredő kölcsönös kötelezettségeikkel teljeskörűen elszámoltak')],
          ],
          theme: 'grid',
          headStyles: { fillColor: [15, 118, 110], textColor: 255, fontSize: 8.5, fontStyle: 'bold' },
          bodyStyles: { fontSize: 8.5, cellPadding: 2.2 },
          columnStyles: { 0: { cellWidth: 72, fontStyle: 'normal' }, 1: { fontStyle: 'bold' } },
          margin: { left: 16, right: 16 },
        });
        break;
      }
      case 'tb': {
        autoTable(d, {
          startY: 68,
          head: [[hu('Társadalombiztosítási jogcím (Tbj. 50. §)'), hu('Igazolt érték')]],
          body: [
            [hu('Biztosítási jogviszony időtartama'), `${startDate} – ${exitDate}`],
            [hu('Biztosítási jogviszony kódja és jellege'), hu('1101 — Munkaviszony (heti 40 órás teljes munkaidő)')],
            [hu('Tárgyévben biztosításban töltött napok száma'), hu(`${Math.max(1, Math.round(months * 30.4))} nap`)],
            [hu('Igénybe vett betegszabadság a tárgyévben'), hu(`${leaves.filter(l => l.leave_type === 'sick').reduce((s, l) => s + l.days, 0)} munkanap (15 napos törvényi keretből)`)],
            [hu('Táppénz, CSED, GYED folyósítás időtartama'), hu('Nem vett igénybe a munkaviszony időtartama alatt')],
            [hu('Utolsó havi TB járulékalap'), `${fmt(gross)} Ft/hó`],
            [hu('Levont társadalombiztosítási járulék (18,5%)'), `${fmt(tb)} Ft/hó`],
            [hu('OEP / NEAK bejelentési kötelezettség'), hu('Elektronikusan teljesítve (T1041 / 08-as bevallás)')],
          ],
          theme: 'grid',
          headStyles: { fillColor: [15, 118, 110], textColor: 255, fontSize: 8.5, fontStyle: 'bold' },
          bodyStyles: { fontSize: 8.5, cellPadding: 2.5 },
          columnStyles: { 0: { cellWidth: 72, fontStyle: 'normal' }, 1: { fontStyle: 'bold' } },
          margin: { left: 16, right: 16 },
        });
        break;
      }
      case 'income': {
        autoTable(d, {
          startY: 68,
          head: [[hu('M30 Jövedelem kategória (Szja tv. 46. §)'), hu('Összeg (Ft)')]],
          body: [
            [hu(`1. Munkaviszonyból származó bruttó bérjövedelem (${months} hó)`), fmt(yearGross)],
            [hu('2. Egyéb önálló és nem önálló tevékenység bevétele'), '0'],
            [hu('3. Összes összevont adóalap'), fmt(yearGross)],
            [hu('4. Számított személyi jövedelemadó (15%)'), `– ${fmt(yearSzja)}`],
            [hu('5. Érvényesített adóalap-kedvezmények (családi, 25 év alatti)'), '0'],
            [hu('6. Ténylegesen levont SZJA adóelőleg'), `– ${fmt(yearSzja)}`],
            [hu('7. Levont társadalombiztosítási járulék (18,5%)'), `– ${fmt(yearTb)}`],
            [hu('8. Kifizetett összes nettó jövedelem a jogviszony alatt'), fmt(yearNet)],
          ],
          theme: 'grid',
          headStyles: { fillColor: [15, 118, 110], textColor: 255, fontSize: 8.5, fontStyle: 'bold' },
          bodyStyles: { fontSize: 8.5, cellPadding: 2.4 },
          columnStyles: { 0: { cellWidth: 120 }, 1: { halign: 'right', fontStyle: 'bold' } },
          margin: { left: 16, right: 16 },
          didParseCell: (data) => {
            if (data.section === 'body' && data.row.index === 7) {
              data.cell.styles.fillColor = [220, 252, 231];
              data.cell.styles.fontStyle = 'bold';
            }
          },
        });
        break;
      }
      case 'leave': {
        autoTable(d, {
          startY: 68,
          head: [[hu('Szabadság jogcím (Mt. 125. §)'), hu('Napok'), hu('Távolléti díj / Összeg (Ft)')]],
          body: [
            [hu('Éves törvényi alapszabadság mértéke'), `${baseDays} nap`, '–'],
            [hu('Életkor / gyermekek utáni pótszabadság'), `${bonusDays} nap`, '–'],
            [hu('Éves teljes szabadságkeret'), `${totalAnnualDays} nap`, '–'],
            [hu(`Időarányos keret a kilépés napjáig (${months} hó)`), `${proportionalDays} nap`, '–'],
            [hu('Kilépés napjáig igénybe vett és elszámolt napok'), `${usedDays} nap`, '–'],
            [hu('Fel nem használt, megváltandó szabadságnapok'), `${remainingDays} nap`, '–'],
            [hu('1 napra eső távolléti díj (bruttó / 21,67)'), '–', `${fmt(dailyRate)} Ft/nap`],
            [hu('SZABADSÁG-MEGVÁLTÁS BRUTTÓ ÖSSZEGE'), `${remainingDays} nap`, `${fmt(leaveCompensation)} Ft`],
          ],
          theme: 'grid',
          headStyles: { fillColor: [15, 118, 110], textColor: 255, fontSize: 8.5, fontStyle: 'bold' },
          bodyStyles: { fontSize: 8.5, cellPadding: 2.4 },
          columnStyles: { 0: { cellWidth: 100 }, 1: { halign: 'center' }, 2: { halign: 'right', fontStyle: 'bold' } },
          margin: { left: 16, right: 16 },
          didParseCell: (data) => {
            if (data.section === 'body' && data.row.index === 7) {
              data.cell.styles.fillColor = [220, 252, 231];
            }
          },
        });
        break;
      }
      case 'final_payslip': {
        const totalGrossPayout = gross + leaveCompensation;
        const totalSzjaPayout = Math.round(totalGrossPayout * 0.15);
        const totalTbPayout = Math.round(totalGrossPayout * 0.185);
        const totalNetPayout = totalGrossPayout - totalSzjaPayout - totalTbPayout;

        autoTable(d, {
          startY: 68,
          head: [[hu('Záró elszámolás jogcíme (Mt. 155. §)'), hu('Összeg (Ft)')]],
          body: [
            [hu('Tárgyhavi arányos bruttó munkabér'), fmt(gross)],
            [hu('Szabadság-megváltás bruttó összege'), fmt(leaveCompensation)],
            [hu('Végkielégítés összege'), '0'],
            [hu('ÖSSZES BRUTTÓ KIFIZETENDŐ JÁRANDÓSÁG'), fmt(totalGrossPayout)],
            [hu('Levont SZJA adóelőleg (15%)'), `– ${fmt(totalSzjaPayout)}`],
            [hu('Levont társadalombiztosítási járulék (18,5%)'), `– ${fmt(totalTbPayout)}`],
            [hu('Munkabérből levont végrehajtói letiltások / tartozások'), '0'],
            [hu('KIFIZETENDŐ VÉGSŐ NETTÓ BÉRÖSSZEG'), fmt(totalNetPayout)],
          ],
          theme: 'grid',
          headStyles: { fillColor: [15, 118, 110], textColor: 255, fontSize: 8.5, fontStyle: 'bold' },
          bodyStyles: { fontSize: 8.5, cellPadding: 2.4 },
          columnStyles: { 0: { cellWidth: 120 }, 1: { halign: 'right', fontStyle: 'bold' } },
          margin: { left: 16, right: 16 },
          didParseCell: (data) => {
            if (data.section === 'body' && data.row.index === 7) {
              data.cell.styles.fillColor = [220, 252, 231];
              data.cell.styles.fontStyle = 'bold';
            }
          },
        });
        break;
      }
      case 'deregister': {
        autoTable(d, {
          startY: 68,
          head: [[hu('08E / T1041 Biztosítotti kijelentés tételei (Art. 50. §)'), hu('Nyilvántartott és átadott adat')]],
          body: [
            [hu('Adatváltozás jellege és jogcímkódja'), hu('02 — Biztosítási jogviszony megszűnése')],
            [hu('Biztosított munkavállaló neve'), hu(empName)],
            [hu('TAJ száma és Adóazonosító jele'), `${employee?.taj_number || '123-456-788'} / ${employee?.tax_id || '8000000008'}`],
            [hu('Foglalkoztató (Munkáltató) megnevezése'), hu(companyName)],
            [hu('Foglalkoztató adószáma'), companyTaxId],
            [hu('Biztosítás kezdetének és végének dátuma'), `${startDate} – ${exitDate}`],
            [hu('Heti munkaidő mértéke és FEOR kód'), `${primaryEmployment?.weekly_hours || 40} óra/hét (FEOR: ${primaryEmployment?.feor_code || '4112'})`],
            [hu('Törvényes NAV bejelentési határidő'), hu(`${exitDate} + 15 nap`)],
            [hu('Elektronikus feladási csatorna'), hu('NAV ONYA / ÁNYK elektronikus nyomtatvány')],
          ],
          theme: 'grid',
          headStyles: { fillColor: [15, 118, 110], textColor: 255, fontSize: 8.5, fontStyle: 'bold' },
          bodyStyles: { fontSize: 8.5, cellPadding: 2.4 },
          columnStyles: { 0: { cellWidth: 72, fontStyle: 'normal' }, 1: { fontStyle: 'bold' } },
          margin: { left: 16, right: 16 },
        });
        break;
      }
      case 'severance': {
        autoTable(d, {
          startY: 68,
          head: [[hu('Végkielégítés megállapítása és elszámolása (Mt. 77. §)'), hu('Megállapított érték')]],
          body: [
            [hu('Munkaviszony megszűnésének módja'), hu('Közös megegyezés (Mt. 64. § (1) bek. a) pont)')],
            [hu('Munkaviszony tartama a munkáltatónál'), hu(`${startDate} – ${exitDate}`)],
            [hu('Törvényi kötelező végkielégítés fennállása'), hu('Nem áll fenn (felmondás hiányában nem kötelező)')],
            [hu('Felek megállapodása szerinti végkielégítés összege'), hu('0 Ft')],
            [hu('Jogalap és indoklás'), hu('A felek kölcsönösen rögzítik, hogy végkielégítés kifizetésében nem állapodtak meg.')],
          ],
          theme: 'grid',
          headStyles: { fillColor: [15, 118, 110], textColor: 255, fontSize: 8.5, fontStyle: 'bold' },
          bodyStyles: { fontSize: 8.5, cellPadding: 2.6 },
          columnStyles: { 0: { cellWidth: 75, fontStyle: 'normal' }, 1: { fontStyle: 'bold' } },
          margin: { left: 16, right: 16 },
        });
        break;
      }
      case 'pension': {
        autoTable(d, {
          startY: 68,
          head: [[hu('Nyugdíjbiztosítási adatközlés és szolgálati idő (Tny. 96. §)'), hu('Igazolt kimutatás')]],
          body: [
            [hu('Biztosítási jogviszony időtartama'), `${startDate} – ${exitDate}`],
            [hu('Jogviszony minősége és jellege'), hu('Főállású munkaviszony (heti 40 óra)')],
            [hu('Szolgálati idő napokban a munkáltatónál'), hu(`${Math.max(1, Math.round(months * 30.4))} nap`)],
            [hu('Nyugdíjjárulék-köteles jövedelem a tárgyévben'), `${fmt(yearGross)} Ft`],
            [hu('Levont nyugdíjjárulék ekvivalens (10%)'), `${fmt(Math.round(yearGross * 0.1))} Ft`],
            [hu('Biztosításban kieső idők (fizetés nélküli szabadság)'), hu('0 nap')],
          ],
          theme: 'grid',
          headStyles: { fillColor: [15, 118, 110], textColor: 255, fontSize: 8.5, fontStyle: 'bold' },
          bodyStyles: { fontSize: 8.5, cellPadding: 2.6 },
          columnStyles: { 0: { cellWidth: 75, fontStyle: 'normal' }, 1: { fontStyle: 'bold' } },
          margin: { left: 16, right: 16 },
        });
        break;
      }
      default: {
        autoTable(d, {
          startY: 68,
          head: [[hu('Szerződéses jogcím és nyilatkozat'), hu('Elszámolási státusz')]],
          body: [
            [hu('Vonatkozó törvényi rendelkezés'), hu(doc.legalRef)],
            [hu('Tétel / megállapodás megnevezése'), hu(doc.title)],
            [hu('Kötelezettség fennállása a kilépéskor'), hu('Nem áll fenn')],
            [hu('Pénzügyi elszámolás (követelés / tartozás)'), hu('0 Ft tartozás és 0 Ft követelés')],
            [hu('Munkáltatói és munkavállalói záradék'), hu('A felek között érvényes külön megállapodás nem áll fenn, egymással szemben követelésük nincs.')],
          ],
          theme: 'grid',
          headStyles: { fillColor: [15, 118, 110], textColor: 255, fontSize: 8.5, fontStyle: 'bold' },
          bodyStyles: { fontSize: 8.5, cellPadding: 2.6 },
          columnStyles: { 0: { cellWidth: 75, fontStyle: 'normal' }, 1: { fontStyle: 'bold' } },
          margin: { left: 16, right: 16 },
        });
        break;
      }
    }

    // Signature Block
    const finalY = (d as any).lastAutoTable?.finalY || 160;
    const sigY = Math.min(finalY + 28, ph - 38);

    d.setFontSize(7.5);
    d.setTextColor(120);
    d.text(hu(`Jogszabályi alap: ${doc.legalRef} | Kiállítás kelte: ${today}`), 16, sigY - 8);
    d.text(hu('Jelen okirat a jogszabályi kötelezettségek teljesítése érdekében, cégszerű aláírással került kiállításra.'), 16, sigY - 4);

    // Signature lines
    d.setDrawColor(160);
    d.setLineWidth(0.3);
    d.line(20, sigY + 14, 80, sigY + 14);
    d.line(pw - 80, sigY + 14, pw - 20, sigY + 14);

    d.setFontSize(8);
    d.setTextColor(60);
    d.text(hu('Munkáltató képviseletében (P.H.)'), 50, sigY + 19, { align: 'center' });
    d.text(hu('Munkavállaló (átvevő)'), pw - 50, sigY + 19, { align: 'center' });

    // P.H. Stamp circle
    d.setDrawColor(180);
    d.setLineWidth(0.4);
    d.circle(50, sigY + 6, 7, 'S');
    d.setFontSize(6.5);
    d.text('P.H.', 50, sigY + 7, { align: 'center' });

    // Footer
    d.setDrawColor(220);
    d.line(16, ph - 12, pw - 16, ph - 12);
    d.setFontSize(7);
    d.setTextColor(140);
    d.text(hu(`eaisyBooks Kilépőcsomag | ${doc.title} (${doc.legalRef}) | Oldal: ${pageIndex + 1}/${totalPages}`), pw / 2, ph - 7, { align: 'center' });
  };

  const generateDocPdf = (doc: ExitDocument): string => {
    const d = new jsPDF({ unit: 'mm', format: 'a4' });
    renderExitDocumentPage(d, doc, 0, 1);
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

  const handlePrintChecklist = () => {
    const today = new Date().toLocaleDateString('hu-HU');
    const printWin = window.open('', '_blank', 'width=800,height=900');
    if (!printWin) return;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Kilépő dokumentumcsomag átadás-átvételi jegyzőkönyv - ${empName}</title>
        <style>
          @page { size: A4 portrait; margin: 15mm; }
          body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 12px; color: #1e293b; line-height: 1.5; margin: 0; padding: 20px; }
          .header { border-bottom: 2px solid #0d9488; padding-bottom: 12px; margin-bottom: 20px; }
          .title { font-size: 16px; font-weight: bold; color: #0f766e; text-transform: uppercase; margin: 0; }
          .subtitle { font-size: 12px; color: #64748b; margin-top: 4px; }
          .meta-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 12px; margin-bottom: 20px; }
          .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 11px; }
          .meta-label { font-weight: bold; color: #475569; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 25px; }
          th, td { border: 1px solid #cbd5e1; padding: 8px 10px; text-align: left; font-size: 11px; }
          th { background-color: #f1f5f9; font-weight: bold; color: #334155; }
          .text-center { text-align: center; }
          .statement { background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 6px; padding: 12px; font-size: 11px; margin-bottom: 35px; }
          .sig-row { display: flex; justify-content: space-between; margin-top: 50px; }
          .sig-block { width: 45%; text-align: center; }
          .sig-line { border-top: 1px solid #475569; margin-top: 40px; padding-top: 5px; font-size: 11px; color: #475569; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1 class="title">Átadás-Átvételi Jegyzőkönyv és Tartalomjegyzék</h1>
          <p class="subtitle">Kilépő munkavállaló elszámolási és jogviszony-megszüntetési iratai (Mt. 80. §)</p>
        </div>

        <div class="meta-box">
          <div class="meta-grid">
            <div><span class="meta-label">Munkavállaló neve:</span> ${empName}</div>
            <div><span class="meta-label">Munkakör:</span> ${activeJob?.position || 'Munkavállaló'}</div>
            <div><span class="meta-label">Adóazonosító jel:</span> ${employee?.tax_id || '–'}</div>
            <div><span class="meta-label">TAJ szám:</span> ${employee?.taj_number || '–'}</div>
            <div><span class="meta-label">Munkaviszony kezdete:</span> ${fmtDate(primaryEmployment?.start_date)}</div>
            <div><span class="meta-label">Kilépés napja:</span> ${fmtDate(primaryEmployment?.end_date) || today}</div>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th style="width: 30px;">#</th>
              <th>Dokumentum megnevezése</th>
              <th>Jogszabályi hivatkozás</th>
              <th style="width: 70px;" class="text-center">Jellege</th>
              <th style="width: 70px;" class="text-center">Átadva</th>
            </tr>
          </thead>
          <tbody>
            ${docs.map((doc, idx) => `
              <tr>
                <td class="text-center">${idx + 1}.</td>
                <td><strong>${doc.title}</strong><br><span style="color: #64748b; font-size: 10px;">${doc.description}</span></td>
                <td>${doc.legalRef}</td>
                <td class="text-center">${doc.required ? 'Kötelező' : 'Opcionális'}</td>
                <td class="text-center">${doc.status === 'generated' ? '✓ Átadva' : '–'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <div class="statement">
          <strong>Átvételi elismerés és jognyilatkozat:</strong><br>
          Alulírott munkavállaló ezennel igazolom, hogy a fent felsorolt elszámolási és kilépő iratokat a mai napon személyesen és hiánytalanul átvettem, azok tartalmát megismertem.
        </div>

        <div style="font-size: 11px; margin-bottom: 20px;">
          <strong>Kelt:</strong> Budapest, ${today}
        </div>

        <div class="sig-row">
          <div class="sig-block">
            <div class="sig-line">Munkáltató képviseletében (P.H.)</div>
          </div>
          <div class="sig-block">
            <div class="sig-line">Munkavállaló aláírása</div>
          </div>
        </div>

        <script>
          window.onload = function() { window.print(); }
        </script>
      </body>
      </html>
    `;

    printWin.document.write(html);
    printWin.document.close();
  };

  const handlePrintAllDocuments = () => {
    toast({
      title: 'Dokumentumok összefűzése...',
      description: 'A rendszer összefűzi a kilépő bizonylatokat egyetlen nyomtatható állományba.',
    });

    const d = new jsPDF({ unit: 'mm', format: 'a4' });
    const generatedDocs = docs.filter(doc => doc.status === 'generated');
    const docsToProcess = generatedDocs.length > 0 ? generatedDocs : docs.filter(doc => doc.required);

    docsToProcess.forEach((doc, idx) => {
      if (idx > 0) d.addPage();
      renderExitDocumentPage(d, doc, idx, docsToProcess.length);
    });

    const url = d.output('bloburl').toString();
    const a = document.createElement('a');
    a.href = url;
    a.download = `kilepo_csomag_osszes_${empName.replace(/\s+/g, '_')}.pdf`;
    a.click();
    toast({ title: 'Letöltés kész', description: 'Az összesített kilépő csomag PDF-be mentve.' });
  };

  if (jobsError) return <AccountyErrorState message="Nem sikerült betölteni a kilépő dokumentumok adatait." onRetry={() => refetchJobs()} />;
  if (isLoading) return <ContentSkeleton />;

  return (
    <div className="w-full max-w-5xl mx-auto space-y-6 page-animate">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <button onClick={() => window.history.back()} className="p-2 rounded-lg hover:bg-muted transition-colors"><ArrowLeft className="w-5 h-5" /></button>
          <div className="p-2.5 bg-gradient-to-br from-red-500 to-pink-600 rounded-lg shadow-lg shadow-red-500/25"><Package className="w-5 h-5 text-white" /></div>
          <div>
            <h1 className="text-2xl font-bold">Kilépő dokumentumcsomag</h1>
            <p className="text-sm text-muted-foreground">{empLabel}</p>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button
            variant="outline"
            className="gap-1.5 text-xs h-9"
            onClick={handlePrintChecklist}
            title="A4-es átadás-átvételi jegyzőkönyv és tartalomjegyzék nyomtatása"
          >
            <Printer className="w-3.5 h-3.5 text-teal-600" /> A4 Átadás-Átvételi Lista
          </Button>
          <Button
            className="gap-1.5 text-xs h-9 bg-primary text-primary-foreground hover:bg-primary/90"
            onClick={handlePrintAllDocuments}
            title="Összes kilépő bizonylat egybefűzött letöltése és nyomtatása"
          >
            <Download className="w-3.5 h-3.5" /> Összes dokumentum (egyben)
          </Button>
        </div>
      </div>

      <div className="bg-gradient-to-r from-red-50 to-pink-50 dark:from-red-500/10 dark:to-pink-500/10 rounded-lg border border-red-200 dark:border-red-500/20 p-5">
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
            <div key={doc.id} className={cn('bg-card rounded-lg border shadow-soft overflow-hidden transition-all', doc.status === 'na' ? 'border-border/50 opacity-60' : 'border-border')}>
              <div
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setExpandedDoc(isExpanded ? null : doc.id);
                  }
                }}
                onClick={() => setExpandedDoc(isExpanded ? null : doc.id)}
                className="w-full flex items-center gap-4 px-5 py-3.5 hover:bg-muted/50 transition-colors text-left cursor-pointer"
              >
                <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center shrink-0', doc.status === 'generated' ? 'bg-emerald-100 dark:bg-emerald-500/20' : doc.status === 'pending' ? 'bg-blue-100 dark:bg-blue-500/20' : 'bg-muted')}>
                  <FileText className={cn('w-4 h-4', doc.status === 'generated' ? 'text-emerald-600' : doc.status === 'pending' ? 'text-blue-600' : 'text-muted-foreground')} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-bold">{doc.title}</p>
                    {doc.required && <span className="text-[10px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded font-bold">KÖTELEZŐ</span>}
                    <span className={cn('px-2 py-0.5 rounded-full text-[10px] font-bold', badge.color)}>{badge.label}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{doc.legalRef} — {doc.description}</p>
                </div>
                {doc.status === 'generated' && (
                  <div className="flex gap-1 shrink-0">
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0" title="Megtekintés" onClick={e => { e.stopPropagation(); handlePreview(doc); }}><Eye className="w-3 h-3" /></Button>
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0" title="Letöltés" onClick={e => { e.stopPropagation(); handleDownload(doc); }}><Download className="w-3 h-3" /></Button>
                  </div>
                )}
              </div>
              {isExpanded && (
                <div className="px-5 pb-4 pl-[68px] border-t border-border/50 pt-3">
                  <p className="text-xs text-muted-foreground">{doc.template}</p>
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
          <div className="flex-1 w-full bg-muted dark:bg-card">
            {previewUrl && (
              <iframe src={previewUrl} className="w-full h-full border-0" title={`${previewTitle} megtekintő`} />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
