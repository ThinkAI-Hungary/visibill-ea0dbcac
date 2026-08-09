import React, { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Check, ChevronRight, ChevronLeft,
  Mail, ClipboardList, Clock, Coffee, Calculator,
  Receipt, FileText, Loader2, Users, AlertTriangle,
  CheckCircle2, Printer
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ExportButton } from '@/components/accounty/ExportButton';
import { cn } from '@/lib/utils';
import {
  usePayrollCycle, usePayrollEmployees, usePayrollItems,
  usePayrollCalculations, useCreateCycle, useUpdateCycleStep,
  useRunBatchPayroll
} from '@/hooks/usePayrollData';
import { useAccountyClients } from '@/hooks/accounty';
import { generatePayrollRequestEmail } from '@/lib/payroll/emailTemplates';
import { printPayslip, type PayslipData } from '@/lib/payroll/payslipGenerator';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { reportError } from '@/lib/errorReporter';
import { AccountyErrorState } from '@/components/accounty/AccountyErrorState';

import PayrollStep1 from '@/components/accounty/payroll/PayrollStep1';
import PayrollStep2 from '@/components/accounty/payroll/PayrollStep2';
import PayrollStep3 from '@/components/accounty/payroll/PayrollStep3';
import PayrollStep4 from '@/components/accounty/payroll/PayrollStep4';
import PayrollStep5 from '@/components/accounty/payroll/PayrollStep5';
import PayrollStep6 from '@/components/accounty/payroll/PayrollStep6';
import PayrollStep7 from '@/components/accounty/payroll/PayrollStep7';
import PayrollStep8 from '@/components/accounty/payroll/PayrollStep8';

// ── 8 lépés definíció ──
const CYCLE_STEPS = [
  { id: 1, title: 'Adatbekérés', desc: 'Ügyfél felé adatbekérés küldése', icon: Mail, color: 'blue' },
  { id: 2, title: 'Ellenőrzés', desc: 'Beérkezett adatok validálása', icon: ClipboardList, color: 'amber' },
  { id: 3, title: 'Jelenléti ív', desc: 'Munkaidő feldolgozás, OCR', icon: Clock, color: 'teal' },
  { id: 4, title: 'Telefon + Cafeteria', desc: 'Magáncélú telefon, juttatások', icon: Coffee, color: 'violet' },
  { id: 5, title: 'Bruttó + Pótlék', desc: 'Alapbér, pótlékok, prémium', icon: Calculator, color: 'indigo' },
  { id: 6, title: 'Adó + Járulék', desc: 'SZJA, TB, SZOCHO kalkuláció', icon: Receipt, color: 'red' },
  { id: 7, title: 'Levonások', desc: 'Letiltások, előlegek, pénztárak', icon: FileText, color: 'orange' },
  { id: 8, title: 'Számfejtés', desc: 'Véglegesítés, jóváhagyás', icon: Check, color: 'green' },
];

const MONTHS = ['Január', 'Február', 'Március', 'Április', 'Május', 'Június', 'Július', 'Augusztus', 'Szeptember', 'Október', 'November', 'December'];

const EMPLOYMENT_TYPE_LABELS: Record<string, string> = {
  munkaviszony: 'Munkaviszony (Mt.)',
  munkaviszony_reszido: 'Részmunkaidős munkaviszony',
  bedolgozo: 'Bedolgozói jogviszony',
  munkaero_kolcsonzes: 'Munkaerő-kölcsönzés',
  szakkep: 'Szakképzési munkaszerződés',
  osztondijas: 'Ösztöndíjas foglalkoztatott',
  neveloszulo: 'Nevelőszülő',
  haztartasi: 'Háztartási alkalmazott',
  kozalkalmazott: 'Közalkalmazott (Kjt.)',
  kozszolgalati: 'Köztisztviselő (Kttv.)',
  kormanytisztviselo: 'Kormánytisztviselő (Kit.)',
  biro_ugyesz: 'Bíró, ügyész, igazságügyi alk.',
  'hivatásos_katona': 'Hivatásos/szerződéses katona',
  egyhazi: 'Egyházi személy',
  kozfogl: 'Közfoglalkoztatás',
  premiumevek: 'Prémiumévek program',
  tartos_megbizas: 'Tartós megbízás (2026)',
  megbizas: 'Megbízási jogviszony',
  megbizas_eseti: 'Eseti megbízás (nem biztosított)',
  valasztott_tisztsegviselo: 'Választott tisztségviselő',
  tarsas_vallalkozo: 'Társas vállalkozó (főfogl.)',
  tarsas_vallalkozo_mellekfogl: 'Társas vállalkozó (mellékfogl.)',
  ev: 'Egyéni vállalkozó (főfogl.)',
  ev_mellekfogl: 'Egyéni vállalkozó (mellékfogl.)',
  szovetkezeti_tag: 'Szövetkezeti tag',
  iskolaszovetkezet: 'Iskolaszövetkezeti tag',
  efo_alkalmi: 'Egyszerűsített foglalkoztatás (EFO)',
  nyugdijas: 'Nyugdíjas munkavállaló',
  gyes_gyed: 'GYES/GYED melletti fogl.',
  kulfold_kikuld: 'Külföldi kiküldetés (expat)',
  segito_csaladtag: 'Segítő családtag',
  onkentes: 'Közérdekű önkéntes',
};

export default function PayrollCyclePage() {
  const { companyId, cycleId } = useParams<{ companyId: string; cycleId: string }>();
  const navigate = useNavigate();

  const isNewCycle = !cycleId || cycleId === 'new';
  const { data: cycle, isLoading: cycleLoading, isError: cycleError, refetch: refetchCycle } = usePayrollCycle(isNewCycle ? '' : cycleId || '');
  const { data: employees = [] } = usePayrollEmployees(companyId || '');
  const { data: items = [] } = usePayrollItems(cycle?.id || '');
  const { data: calculations = [] } = usePayrollCalculations(cycle?.id || '');
  const updateStep = useUpdateCycleStep();
  const createCycle = useCreateCycle();
  const runBatch = useRunBatchPayroll();
  const { data: clients } = useAccountyClients();
  const { toast } = useToast();
  const { user } = useAuth();
  const [emailSending, setEmailSending] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [emailTo, setEmailTo] = useState('');

  // Fetch all employments for this company
  const [allEmployments, setAllEmployments] = useState<any[]>([]);
  React.useEffect(() => {
    if (!companyId) return;
    supabase.from('accounty_employments').select('*').eq('company_id', companyId).eq('status', 'active')
      .then(({ data }) => { if (data) setAllEmployments(data); });
  }, [companyId]);

  // Fetch saved timesheet data for this cycle
  React.useEffect(() => {
    if (!cycle?.id || allEmployments.length === 0) return;
    supabase.from('accounty_timesheets')
      .select('*')
      .eq('cycle_id', cycle.id)
      .then(({ data, error }) => {
        if (error) {
          console.error('Error fetching timesheets:', error);
          return;
        }
        if (data && data.length > 0) {
          const loadedAttendance: Record<string, { workDays: number; overtime: number; sickDays: number; leaveDays: number }> = {};
          data.forEach(t => {
            const emp = allEmployments.find(e => e.id === t.employment_id);
            if (emp && t.ocr_data) {
              const ocr = t.ocr_data as any;
              loadedAttendance[emp.employee_id] = {
                workDays: ocr.workDays ?? 22,
                overtime: ocr.overtime ?? 0,
                sickDays: ocr.sickDays ?? 0,
                leaveDays: ocr.leaveDays ?? 0,
              };
            }
          });
          setAttendanceData(loadedAttendance);
        }
      });
  }, [cycle?.id, allEmployments]);
  
  const [attendanceData, setAttendanceData] = useState<Record<string, { workDays: number; overtime: number; sickDays: number; leaveDays: number }>>({});

  const [garnishments, setGarnishments] = useState<any[]>([]);
  React.useEffect(() => {
    if (activeEmployees.length === 0) return;
    const empIds = activeEmployees.map(e => e.id);
    supabase.from('accounty_garnishments')
      .select('*')
      .in('employee_id', empIds)
      .eq('is_active', true)
      .then(({ data }) => { if (data) setGarnishments(data); });
  }, [employees]);

  const [companyDetails, setCompanyDetails] = useState<any>(null);
  React.useEffect(() => {
    if (!companyId) return;
    supabase.from('companies').select('*').eq('id', companyId).single()
      .then(({ data }) => { if (data) setCompanyDetails(data); });
  }, [companyId]);

  // CSV validation results
  interface CsvValidationResult {
    matched: number;
    total: number;
    fileName: string;
    unmatchedNames: string[];
    warnings: { row: number; name: string; message: string }[];
  }
  const [csvValidation, setCsvValidation] = useState<CsvValidationResult | null>(null);

  const getAttendance = (empId: string) => attendanceData[empId] || { workDays: 22, overtime: 0, sickDays: 0, leaveDays: 0 };

  // CSV parser with validation
  const handleCsvUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      if (!text) return;
      const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
      const newData: typeof attendanceData = {};
      let matched = 0;
      const unmatchedNames: string[] = [];
      const warnings: CsvValidationResult['warnings'] = [];

      const startIdx = lines[0]?.match(/n[eé]v|munkanap/i) ? 1 : 0;
      const dataRowCount = lines.length - startIdx;

      for (let i = startIdx; i < lines.length; i++) {
        const cols = lines[i].split(/[;,\t]/).map(c => c.trim());
        if (cols.length < 2) {
          warnings.push({ row: i + 1, name: cols[0] || '?', message: 'Túl kevés oszlop (minimum 2 szükséges)' });
          continue;
        }
        const name = cols[0].toLowerCase();

        const emp = activeEmployees.find(emp =>
          `${emp.last_name} ${emp.first_name}`.toLowerCase() === name ||
          `${emp.first_name} ${emp.last_name}`.toLowerCase() === name
        );

        if (emp) {
          const workDays = parseInt(cols[1]);
          const overtime = parseInt(cols[2]) || 0;
          const sickDays = parseInt(cols[3]) || 0;
          const leaveDays = parseInt(cols[4]) || 0;

          if (isNaN(workDays)) {
            warnings.push({ row: i + 1, name: cols[0], message: `Érvénytelen munkanapok: "${cols[1]}"` });
          }
          if (workDays > 31) {
            warnings.push({ row: i + 1, name: cols[0], message: `Munkanapok > 31: ${workDays}` });
          }
          if (overtime > 200) {
            warnings.push({ row: i + 1, name: cols[0], message: `Rendkívül magas túlóra: ${overtime} óra` });
          }
          if (sickDays + leaveDays > workDays && workDays > 0) {
            warnings.push({ row: i + 1, name: cols[0], message: `Táppénz + szabadság (${sickDays + leaveDays}) > munkanapok (${workDays})` });
          }

          newData[emp.id] = {
            workDays: isNaN(workDays) ? 22 : workDays,
            overtime,
            sickDays,
            leaveDays,
          };
          matched++;
        } else {
          unmatchedNames.push(cols[0]);
        }
      }

      setAttendanceData(prev => ({ ...prev, ...newData }));

      // Save parsed timesheet data to the database
      if (cycle?.id) {
        supabase
          .from('accounty_timesheets')
          .delete()
          .eq('cycle_id', cycle.id)
          .then(async () => {
            const recordsToInsert = Object.keys(newData).map(employeeId => {
              const employment = allEmployments.find(e => e.employee_id === employeeId);
              return {
                cycle_id: cycle.id,
                employment_id: employment?.id,
                ocr_data: newData[employeeId],
                is_verified: true,
              };
            }).filter(r => r.employment_id);

            if (recordsToInsert.length > 0) {
              const { error } = await supabase.from('accounty_timesheets').insert(recordsToInsert);
              if (error) {
                console.error('Error saving timesheets:', error);
              }
            }
          });
      }

      setCsvValidation({
        matched,
        total: dataRowCount,
        fileName: file.name,
        unmatchedNames,
        warnings,
      });

      toast({
        title: unmatchedNames.length === 0 && warnings.length === 0 ? 'CSV sikeresen beolvasva ' : 'CSV beolvasva — figyelmeztetésekkel',
        description: `${file.name} — ${matched}/${dataRowCount} foglalkoztatott párosítva.${unmatchedNames.length > 0 ? ` ${unmatchedNames.length} nem párosított.` : ''}`,
        variant: unmatchedNames.length > 0 ? 'destructive' : undefined,
      });
    };
    reader.readAsText(file);
  };

  const company = useMemo(() => clients?.find(c => c.id === companyId), [clients, companyId]);

  const getCalcName = (calc: any) => {
    const meta = calc.metadata as any;
    if (meta?.employee_name) return meta.employee_name;
    return '–';
  };

  const getEmailData = () => {
    if (!cycle) return null;
    return generatePayrollRequestEmail({
      companyName: company?.name || 'Cég',
      contactName: 'Tisztelt Ügyfelünk',
      year: cycle.year,
      month: cycle.month,
      dueDate: new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10),
      senderName: user?.user_metadata?.name || 'Könyvelő',
      senderCompany: 'eaisybooks',
    });
  };

  const handleEmailPreview = () => {
    const result = getEmailData();
    if (!result) return;
    const win = window.open('', '_blank', 'width=700,height=800');
    if (win) {
      win.document.write(result.htmlBody);
      win.document.close();
    }
    toast({ title: 'E-mail előnézet', description: `Tárgy: ${result.subject}` });
  };

  const handleSendEmail = async () => {
    if (!user?.id || !cycle) return;
    if (!emailTo || !emailTo.includes('@')) {
      toast({ title: 'Hibás email', description: 'Kérlek adj meg egy érvényes email címet.', variant: 'destructive' });
      return;
    }
    const result = getEmailData();
    if (!result) return;

    setEmailSending(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-notification-email', {
        body: {
          user_id: user.id,
          to_email: emailTo,
          type: 'salary_processed',
          title: result.subject,
          body_html: result.htmlBody,
          subject: result.subject,
        },
      });

      if (error) throw error;

      const responseData = typeof data === 'string' ? JSON.parse(data) : data;
      if (responseData?.error) throw new Error(responseData.error);

      setEmailSent(true);
      setEmailDialogOpen(false);
      toast({ title: ' E-mail elküldve!', description: `Adatbekérő kiküldve: ${emailTo}` });
    } catch (err: any) {
      reportError({ type: 'db_query', component: 'PayrollCyclePage', action: 'error', message: 'Email send error:', error: err });
      toast({ title: 'Hiba', description: err?.message || 'Nem sikerült elküldeni az e-mailt.', variant: 'destructive' });
    } finally {
      setEmailSending(false);
    }
  };

  const handlePrintPayslip = (calc: any) => {
    const meta = calc.metadata as any;
    const emp = activeEmployees.find(e => e.id === meta?.employee_id);
    const employment = allEmployments.find(e => e.employee_id === emp?.id);
    
    // Retrieve attendance stats
    const att = attendanceData[emp?.id || ''] || { workDays: 22, overtime: 0, sickDays: 0, leaveDays: 0 };
    
    // Parse deductions details if present
    const decs = (calc.deductions || {}) as any;
    const garnishmentAmount = decs.garnishments || 0;
    const advanceAmount = decs.advances || 0;
    const otherDeductionsAmount = decs.other || 0;
    
    // Extract tax credits
    const credits = (calc.tax_credits || []) as any[];
    const familyCredit = credits.filter(c => c.type === 'family' || c.type === 'family_tb').reduce((sum, c) => sum + (c.taxSaving || 0) + (c.tbSaving || 0), 0);
    const under25Credit = credits.find(c => c.type === 'young_25')?.taxSaving || 0;
    const newMotherCredit = credits.find(c => c.type === 'young_mother_30')?.taxSaving || 0;
    const firstMarriageCredit = credits.find(c => c.type === 'first_marriage')?.taxSaving || 0;
    const personalDisabilityCredit = credits.find(c => c.type === 'personal')?.taxSaving || 0;

    // Calculate supplement amounts
    const weeklyHours = employment?.weekly_hours || 40;
    const dailyHours = weeklyHours / 5;
    const rawBaseSalary = employment ? Number(employment.base_salary) : 0;
    const isHourly = employment?.salary_type === 'hourly';

    let hourlyRate = 0;
    let dailyRate = 0;
    let calculatedOvertime = 0;
    let calculatedSickLeave = 0;
    let calculatedLeaveAmount = 0;
    let calculatedBase = 0;

    if (isHourly) {
      hourlyRate = rawBaseSalary;
      dailyRate = hourlyRate * dailyHours;

      const actualWorkedHours = (att.workDays || 0) * dailyHours;
      const sickHours = (att.sickDays || 0) * dailyHours;
      const leaveHours = (att.leaveDays || 0) * dailyHours;

      calculatedBase = Math.round(actualWorkedHours * hourlyRate);
      calculatedOvertime = Math.round(hourlyRate * (att.overtime || 0) * 1.5);
      calculatedSickLeave = Math.round(hourlyRate * sickHours * 0.70);
      calculatedLeaveAmount = Math.round(hourlyRate * leaveHours * 1.0);
    } else {
      dailyRate = rawBaseSalary / 22;
      hourlyRate = rawBaseSalary / (dailyHours * 22);

      const baseReduction = Math.round(dailyRate * (att.sickDays || 0));
      calculatedBase = Math.max(0, rawBaseSalary - baseReduction);

      calculatedOvertime = Math.round(hourlyRate * (att.overtime || 0) * 1.5);
      calculatedSickLeave = Math.round(dailyRate * (att.sickDays || 0) * 0.70);
      calculatedLeaveAmount = 0; // Already covered in base monthly wage
    }

    // Sum explicit items
    const empItems = items.filter(i => i.employment_id === employment?.id && !i.is_deduction);
    const overtimeOverride = empItems.find(i => i.item_type === 'overtime')?.amount;
    const sickLeaveOverride = empItems.find(i => i.item_type === 'sick_leave')?.amount;
    
    const finalOvertime = overtimeOverride !== undefined ? Number(overtimeOverride) : calculatedOvertime;
    const finalSickLeave = sickLeaveOverride !== undefined ? Number(sickLeaveOverride) : calculatedSickLeave;

    const baseSalary = empItems.find(i => i.item_type === 'base_salary')?.amount 
      || calculatedBase;

    const otherPremiums = empItems
      .filter(i => !['base_salary', 'overtime', 'sick_leave'].includes(i.item_type))
      .reduce((s, i) => s + (i.amount || 0), 0);

    const payslipData: PayslipData = {
      companyName: companyDetails?.name || company?.name || '–',
      companyTaxNumber: companyDetails?.tax_number || company?.taxNumber || '–',
      companyAddress: companyDetails?.address || '–',
      employeeName: meta?.employee_name || '–',
      tajNumber: emp?.taj_number || '–',
      taxId: emp?.tax_id || '–',
      bankAccount: emp?.bank_account || '–',
      jobTitle: employment?.job_title || '–',
      jobCode: employment?.job_code || '–',
      year: cycle?.year || new Date().getFullYear(),
      month: cycle?.month || new Date().getMonth() + 1,
      workDays: att.workDays ?? 22,
      workedDays: Math.max(0, (att.workDays ?? 22) - (att.sickDays || 0) - (att.leaveDays || 0)),
      overtimeHours: att.overtime || 0,
      sickDays: att.sickDays || 0,
      leaveDays: att.leaveDays || 0,
      baseSalary: baseSalary,
      supplements: finalOvertime + finalSickLeave,
      bonuses: otherPremiums,
      otherIncome: calculatedLeaveAmount, // leave paid amount
      grossTotal: calc.gross_salary || 0,
      szjaBase: calc.szja_base || calc.gross_salary || 0,
      szjaAmount: calc.szja_amount || 0,
      tbAmount: calc.tb_amount || 0,
      szochoAmount: calc.szocho_amount || 0,
      familyCredit,
      under25Credit,
      newMotherCredit,
      firstMarriageCredit,
      personalDisabilityCredit,
      garnishments: garnishmentAmount,
      advances: advanceAmount,
      otherDeductions: otherDeductionsAmount,
      netSalary: calc.net_salary || 0,
    };
    printPayslip(payslipData);
  };

  const [newYear, setNewYear] = useState(new Date().getFullYear());
  const [newMonth, setNewMonth] = useState(new Date().getMonth() + 1);

  const currentStep = cycle?.current_step || 1;
  const activeEmployees = employees.filter(e => e.status === 'active');

  const handleCreateCycle = async () => {
    if (!companyId) return;
    try {
      const result = await createCycle.mutateAsync({ company_id: companyId, year: newYear, month: newMonth });
      navigate(`/accounty/payroll/${companyId}/cycle/${result.id}`, { replace: true });
    } catch {
      // Error handled by mutation
    }
  };

  const handleStepChange = async (step: number) => {
    if (!cycle?.id) return;
    const statusMap: Record<number, string> = {
      1: 'data_collection', 2: 'review', 3: 'review', 4: 'review',
      5: 'calculating', 6: 'calculating', 7: 'calculating', 8: 'calculated',
    };
    await updateStep.mutateAsync({ cycleId: cycle.id, step, status: statusMap[step] || 'draft' });
  };

  if (isNewCycle) {
    return (
      <div className="w-full max-w-2xl mx-auto space-y-8 animate-in fade-in duration-500">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="h-9 w-9">
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Új havi ciklus</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">Bérszámfejtési időszak indítása</p>
          </div>
        </div>

        <div className="bg-card rounded-xl border border-border shadow-soft p-8">
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Év</label>
              <select
                value={newYear}
                onChange={(e) => setNewYear(parseInt(e.target.value))}
                className="w-full rounded-lg border border-border bg-card px-3 py-2.5 text-sm text-slate-900 dark:text-slate-100"
              >
                {[2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Hónap</label>
              <select
                value={newMonth}
                onChange={(e) => setNewMonth(parseInt(e.target.value))}
                className="w-full rounded-lg border border-border bg-card px-3 py-2.5 text-sm text-slate-900 dark:text-slate-100"
              >
                {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
              </select>
            </div>
          </div>

          <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800 mb-6">
            <p className="text-sm text-blue-700 dark:text-blue-300">
              <strong>{activeEmployees.length}</strong> aktív foglalkoztatott lesz ebben a ciklusban.
            </p>
          </div>

          <Button
            onClick={handleCreateCycle}
            disabled={createCycle.isPending}
            className="w-full bg-primary hover:bg-primary/90 text-primary-foreground flex items-center justify-center gap-2 py-3"
          >
            {createCycle.isPending ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Létrehozás...</>
            ) : (
              <><Check className="w-4 h-4" /> Ciklus indítása — {newYear}. {MONTHS[newMonth - 1]}</>
            )}
          </Button>
        </div>
      </div>
    );
  }

  if (cycleError) {
    return <AccountyErrorState message="Nem sikerült betölteni a bérszámfejtési ciklust." onRetry={() => refetchCycle()} />;
  }

  if (cycleLoading) {
    return (
      <div className="w-full space-y-6 animate-in fade-in">
        <div className="h-8 w-64 bg-slate-200 dark:bg-slate-800 rounded animate-pulse" />
        <div className="h-24 bg-slate-200 dark:bg-slate-800 rounded-xl animate-pulse" />
        <div className="h-64 bg-slate-200 dark:bg-slate-800 rounded-xl animate-pulse" />
      </div>
    );
  }

  if (!cycle) {
    return (
      <div className="w-full text-center py-16">
        <AlertTriangle className="w-12 h-12 mx-auto mb-3 text-slate-300" />
        <p className="text-slate-500">Ciklus nem található</p>
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
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
              {cycle.year}. {MONTHS[cycle.month - 1]}
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {activeEmployees.length} foglalkoztatott · Lépés {currentStep}/8
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <ExportButton
            filename={`berszamfejtes_${cycle.year}_${MONTHS[cycle.month - 1]}`}
            headers={['Név', 'Bruttó (Ft)', 'SZJA (Ft)', 'TB (Ft)', 'SZOCHO (Ft)', 'Levonás (Ft)', 'Nettó (Ft)']}
            getRows={() => {
              const rows = calculations.map(calc => [
                getCalcName(calc),
                calc.gross_salary || 0,
                calc.szja_amount || 0,
                calc.tb_amount || 0,
                calc.szocho_amount || 0,
                calc.total_deductions || 0,
                calc.net_salary || 0,
              ]);
              rows.push([
                'ÖSSZESEN',
                calculations.reduce((s, c) => s + (c.gross_salary || 0), 0),
                calculations.reduce((s, c) => s + (c.szja_amount || 0), 0),
                calculations.reduce((s, c) => s + (c.tb_amount || 0), 0),
                calculations.reduce((s, c) => s + (c.szocho_amount || 0), 0),
                calculations.reduce((s, c) => s + (c.total_deductions || 0), 0),
                calculations.reduce((s, c) => s + (c.net_salary || 0), 0),
              ]);
              return rows;
            }}
            size="sm"
          />
        </div>
      </div>

      {/* 8-step stepper */}
      <div className="bg-card rounded-xl border border-border shadow-soft p-6 overflow-hidden">
        <div className="flex items-center gap-0">
          {CYCLE_STEPS.map((s, i) => {
            const isActive = s.id === currentStep;
            const isDone = s.id < currentStep;
            const isFuture = s.id > currentStep;

            return (
              <React.Fragment key={s.id}>
                <button
                  onClick={() => isDone && handleStepChange(s.id)}
                  className={cn(
                    'relative flex flex-col items-center gap-1.5 transition-all group min-w-0',
                    isDone && 'cursor-pointer',
                    isFuture && 'opacity-40'
                  )}
                >
                  <div className={cn(
                    'w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300',
                    isActive ? 'bg-primary text-primary-foreground shadow-lg scale-110 ring-4 ring-primary/20' :
                    isDone ? 'bg-green-500 text-white' :
                    'bg-slate-200 text-slate-400 dark:bg-slate-700 dark:text-slate-500'
                  )}>
                    {isDone ? <CheckCircle2 className="w-5 h-5" /> : <s.icon className="w-4 h-4" />}
                  </div>
                  <span className={cn(
                    'text-[10px] font-semibold text-center leading-tight max-w-[72px]',
                    isActive ? 'text-primary' : isDone ? 'text-green-600 dark:text-green-400' : 'text-slate-400'
                  )}>
                    {s.title}
                  </span>
                </button>
                {i < CYCLE_STEPS.length - 1 && (
                  <div className={cn(
                    'flex-1 h-0.5 rounded-full mx-1',
                    s.id < currentStep ? 'bg-green-500' : 'bg-slate-200 dark:bg-slate-700'
                  )} />
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {/* Step content card */}
      <div className="bg-card rounded-xl border border-border shadow-soft overflow-hidden">
        <div className="p-6 border-b border-border">
          <div className="flex items-center gap-3">
            {(() => {
              const StepIcon = CYCLE_STEPS[currentStep - 1].icon;
              return (
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <StepIcon className="w-5 h-5 text-primary" />
                </div>
              );
            })()}
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                {currentStep}. {CYCLE_STEPS[currentStep - 1].title}
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {CYCLE_STEPS[currentStep - 1].desc}
              </p>
            </div>
          </div>
        </div>

        <div className="p-6">
          {currentStep === 1 && (
            <PayrollStep1
              emailSent={emailSent}
              emailSending={emailSending}
              emailDialogOpen={emailDialogOpen}
              setEmailDialogOpen={setEmailDialogOpen}
              emailTo={emailTo}
              setEmailTo={setEmailTo}
              handleSendEmail={handleSendEmail}
              handleEmailPreview={handleEmailPreview}
            />
          )}
          {currentStep === 2 && (
            <PayrollStep2
              activeEmployees={activeEmployees}
              allEmployments={allEmployments}
              EMPLOYMENT_TYPE_LABELS={EMPLOYMENT_TYPE_LABELS}
            />
          )}
          {currentStep === 3 && (
            <PayrollStep3
              activeEmployees={activeEmployees}
              attendanceData={attendanceData}
              getAttendance={getAttendance}
              handleCsvUpload={handleCsvUpload}
              csvValidation={csvValidation}
              setCsvValidation={setCsvValidation}
            />
          )}
          {currentStep === 4 && (
            <PayrollStep4
              activeEmployees={activeEmployees}
              allEmployments={allEmployments}
              items={items}
            />
          )}
          {currentStep === 5 && (
            <PayrollStep5
              activeEmployees={activeEmployees}
              allEmployments={allEmployments}
              items={items}
            />
          )}
          {currentStep === 6 && (
            <PayrollStep6
              calculations={calculations}
              getCalcName={getCalcName}
            />
          )}
          {currentStep === 7 && (
            <PayrollStep7
              activeEmployees={activeEmployees}
              items={items}
              garnishments={garnishments}
              allEmployments={allEmployments}
            />
          )}
          {currentStep === 8 && (
            <PayrollStep8
              calculations={calculations}
              activeEmployees={activeEmployees}
              cycle={cycle}
              companyId={companyId || ''}
              runBatch={runBatch}
              getCalcName={getCalcName}
              handlePrintPayslip={handlePrintPayslip}
            />
          )}
        </div>
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          onClick={() => currentStep > 1 ? handleStepChange(currentStep - 1) : navigate(`/accounty/payroll/${companyId}`)}
          className="flex items-center gap-2"
          disabled={updateStep.isPending}
        >
          <ChevronLeft className="w-4 h-4" />
          {currentStep === 1 ? 'Vissza' : 'Előző lépés'}
        </Button>

        {currentStep < 8 ? (
          <Button
            onClick={() => handleStepChange(currentStep + 1)}
            className="bg-primary hover:bg-primary/90 text-primary-foreground flex items-center gap-2"
            disabled={updateStep.isPending}
          >
            {updateStep.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                Következő lépés
                <ChevronRight className="w-4 h-4" />
              </>
            )}
          </Button>
        ) : (
          <Button
            className="bg-green-600 hover:bg-green-700 text-white flex items-center gap-2"
            disabled={updateStep.isPending}
            onClick={async () => {
              if (!cycle?.id) return;
              await supabase.from('payroll_cycles').update({ status: 'closed', current_step: 8 }).eq('id', cycle.id);
              toast({ title: ' Ciklus lezárva', description: `${cycle.year}. ${MONTHS[cycle.month - 1]} bérszámfejtés lezárva.` });
              navigate(`/accounty/payroll/${companyId}`);
            }}
          >
            <Check className="w-4 h-4" />
            Ciklus lezárása
          </Button>
        )}
      </div>
    </div>
  );
}
