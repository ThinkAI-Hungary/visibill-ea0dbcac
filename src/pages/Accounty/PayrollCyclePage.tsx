import React, { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Check, ChevronRight, ChevronLeft,
  Mail, ClipboardList, Clock, Phone, Coffee, Calculator,
  Receipt, FileText, Loader2, Users, AlertTriangle,
  CheckCircle2, Send, Download, Play, Printer, Eye
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  usePayrollCycle, usePayrollEmployees, usePayrollItems,
  usePayrollCalculations, useCreateCycle, useUpdateCycleStep,
  useRunBatchPayroll
} from '@/hooks/usePayrollData';
import { useAccountyClients } from '@/hooks/useAccountyData';
import { generatePayrollRequestEmail } from '@/lib/payroll/emailTemplates';
import { printPayslip, type PayslipData } from '@/lib/payroll/payslipGenerator';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

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

export default function PayrollCyclePage() {
  const { id: companyId, cycleId } = useParams<{ id: string; cycleId: string }>();
  const navigate = useNavigate();

  const isNewCycle = !cycleId || cycleId === 'new';
  const { data: cycle, isLoading: cycleLoading } = usePayrollCycle(isNewCycle ? '' : cycleId || '');
  const { data: employees = [] } = usePayrollEmployees(companyId || '');
  const { data: items = [] } = usePayrollItems(cycle?.id || '');
  const { data: calculations = [] } = usePayrollCalculations(cycle?.id || '');
  const updateStep = useUpdateCycleStep();
  const createCycle = useCreateCycle();
  const runBatch = useRunBatchPayroll();
  const { data: clients } = useAccountyClients();
  const { toast } = useToast();
  const { user } = useAuth();
  const [emailPreview, setEmailPreview] = useState<string | null>(null);
  const [emailSending, setEmailSending] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  // Attendance data per employee
  const [attendanceData, setAttendanceData] = useState<Record<string, { workDays: number; overtime: number; sickDays: number; leaveDays: number }>>({});

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

      // Skip header if first line looks like header
      const startIdx = lines[0]?.match(/n[eé]v|munkanap/i) ? 1 : 0;
      const dataRowCount = lines.length - startIdx;

      for (let i = startIdx; i < lines.length; i++) {
        const cols = lines[i].split(/[;,\t]/).map(c => c.trim());
        if (cols.length < 2) {
          warnings.push({ row: i + 1, name: cols[0] || '?', message: 'Túl kevés oszlop (minimum 2 szükséges)' });
          continue;
        }
        const name = cols[0].toLowerCase();

        // Try to match employee
        const emp = activeEmployees.find(emp =>
          `${emp.last_name} ${emp.first_name}`.toLowerCase() === name ||
          `${emp.first_name} ${emp.last_name}`.toLowerCase() === name
        );

        if (emp) {
          const workDays = parseInt(cols[1]);
          const overtime = parseInt(cols[2]) || 0;
          const sickDays = parseInt(cols[3]) || 0;
          const leaveDays = parseInt(cols[4]) || 0;

          // Validate values
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
      setCsvValidation({
        matched,
        total: dataRowCount,
        fileName: file.name,
        unmatchedNames,
        warnings,
      });


      toast({
        title: unmatchedNames.length === 0 && warnings.length === 0 ? 'CSV sikeresen beolvasva ✓' : 'CSV beolvasva — figyelmeztetésekkel',
        description: `${file.name} — ${matched}/${dataRowCount} foglalkoztatott párosítva.${unmatchedNames.length > 0 ? ` ${unmatchedNames.length} nem párosított.` : ''}`,
        variant: unmatchedNames.length > 0 ? 'destructive' : undefined,
      });
    };
    reader.readAsText(file);
  };

  const company = useMemo(() => clients?.find(c => c.id === companyId), [clients, companyId]);

  // Helper: get employee name from calculation metadata
  const getCalcName = (calc: any) => {
    const meta = calc.metadata as any;
    if (meta?.employee_name) return meta.employee_name;
    return '–';
  };

  // Generate email data
  const getEmailData = () => {
    if (!cycle) return null;
    return generatePayrollRequestEmail({
      companyName: company?.name || 'Cég',
      contactName: 'Tisztelt Ügyfelünk',
      year: cycle.year,
      month: cycle.month,
      dueDate: new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10),
      senderName: user?.user_metadata?.name || 'Könyvelő',
      senderCompany: 'Accounty',
    });
  };

  // Preview email in new window
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

  // Send email via Supabase Edge Function
  const handleSendEmail = async () => {
    if (!user?.id || !cycle) return;
    const result = getEmailData();
    if (!result) return;

    setEmailSending(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-notification-email', {
        body: {
          user_id: user.id,
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
      toast({ title: '✅ E-mail elküldve!', description: `A bérszámfejtési adatbekérő kiküldve a(z) ${company?.name || 'ügyfél'} részére.` });
    } catch (err: any) {
      console.error('Email send error:', err);
      toast({ title: 'Hiba', description: err?.message || 'Nem sikerült elküldeni az e-mailt.', variant: 'destructive' });
    } finally {
      setEmailSending(false);
    }
  };

  // Print payslip for a calculation
  const handlePrintPayslip = (calc: any) => {
    const meta = calc.metadata as any;
    const emp = activeEmployees.find(e => e.id === meta?.employee_id);
    const payslipData: PayslipData = {
      companyName: company?.name || '–',
      companyTaxNumber: company?.taxNumber || '–',
      companyAddress: '–',
      employeeName: meta?.employee_name || '–',
      tajNumber: emp?.taj_number || '–',
      taxId: emp?.tax_id || '–',
      bankAccount: emp?.bank_account || '–',
      jobTitle: '–',
      jobCode: '1101',
      year: cycle?.year || new Date().getFullYear(),
      month: cycle?.month || new Date().getMonth() + 1,
      workDays: 22,
      workedDays: 22,
      overtimeHours: 0,
      sickDays: 0,
      leaveDays: 0,
      baseSalary: calc.gross_salary || 0,
      supplements: 0,
      bonuses: 0,
      otherIncome: 0,
      grossTotal: calc.gross_salary || 0,
      szjaBase: calc.szja_base || calc.gross_salary || 0,
      szjaAmount: calc.szja_amount || 0,
      tbAmount: calc.tb_amount || 0,
      szochoAmount: calc.szocho_amount || 0,
      familyCredit: 0,
      under25Credit: 0,
      newMotherCredit: 0,
      firstMarriageCredit: 0,
      personalDisabilityCredit: 0,
      garnishments: 0,
      advances: 0,
      otherDeductions: calc.total_deductions || 0,
      netSalary: calc.net_salary || 0,
    };
    printPayslip(payslipData);
  };

  // New cycle form
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

  // ── New cycle view ──
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

  // ── Loading ──
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
          <Button variant="outline" size="sm" className="flex items-center gap-2">
            <Download className="w-4 h-4" /> Export
          </Button>
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
          {/* Step 1: Adatbekérés */}
          {currentStep === 1 && (
            <div className="space-y-4">
              <p className="text-sm text-slate-600 dark:text-slate-300">
                Küldj adatbekérő üzenetet az ügyfélnek a hiányzó bér-adatokról (jelenléti ív, változások, új belépők/kilépők).
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <button
                  onClick={handleSendEmail}
                  disabled={emailSending || emailSent}
                  className={cn(
                    "flex items-center gap-3 p-4 rounded-lg border transition-all",
                    emailSent
                      ? "border-green-300 bg-green-50 dark:bg-green-900/20"
                      : "border-border hover:border-primary/30 hover:bg-primary/5",
                    (emailSending || emailSent) && "opacity-80 cursor-not-allowed"
                  )}
                >
                  {emailSending ? (
                    <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />
                  ) : emailSent ? (
                    <CheckCircle2 className="w-5 h-5 text-green-500" />
                  ) : (
                    <Mail className="w-5 h-5 text-blue-500" />
                  )}
                  <div className="text-left">
                    <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                      {emailSending ? 'Küldés...' : emailSent ? 'Elküldve ✓' : 'E-mail küldése'}
                    </p>
                    <p className="text-xs text-slate-500">
                      {emailSent ? 'Adatbekérő sikeresen kiküldve' : 'Sablon-alapú bekérés'}
                    </p>
                  </div>
                </button>
                <button
                  onClick={handleEmailPreview}
                  className="flex items-center gap-3 p-4 rounded-lg border border-border hover:border-primary/30 hover:bg-primary/5 transition-all"
                >
                  <Eye className="w-5 h-5 text-violet-500" />
                  <div className="text-left">
                    <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Előnézet</p>
                    <p className="text-xs text-slate-500">E-mail megtekintése</p>
                  </div>
                </button>
                <button className="flex items-center gap-3 p-4 rounded-lg border border-border hover:border-primary/30 hover:bg-primary/5 transition-all">
                  <Send className="w-5 h-5 text-teal-500" />
                  <div className="text-left">
                    <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Portál link</p>
                    <p className="text-xs text-slate-500">Ügyfélportál meghívó</p>
                  </div>
                </button>
              </div>
            </div>
          )}

          {/* Step 2: Ellenőrzés */}
          {currentStep === 2 && (
            <div className="space-y-4">
              <p className="text-sm text-slate-600 dark:text-slate-300">
                Ellenőrizd a beérkezett adatokat: változások, új belépők, kilépők, módosítások.
              </p>
              <div className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
                <p className="text-sm text-amber-700 dark:text-amber-300">
                  <strong>{activeEmployees.length}</strong> aktív foglalkoztatott · Ellenőrizd az adatokat, majd lépj tovább.
                </p>
              </div>
              {/* Employee checklist */}
              <div className="divide-y divide-border/50 rounded-lg border border-border overflow-hidden">
                {activeEmployees.map((emp) => (
                  <div key={emp.id} className="px-4 py-3 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/50">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                        {emp.last_name[0]}{emp.first_name[0]}
                      </div>
                      <span className="text-sm font-medium text-slate-900 dark:text-slate-100">{emp.last_name} {emp.first_name}</span>
                    </div>
                    <CheckCircle2 className="w-4 h-4 text-green-500" />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Step 3: Jelenléti ív */}
          {currentStep === 3 && (
            <div className="space-y-4">
              <p className="text-sm text-slate-600 dark:text-slate-300">
                Munkaidő feldolgozás. Töltsd fel a jelenléti ívet, vagy add meg manuálisan a munkanapokat.
              </p>

              {/* CSV Upload */}
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-dashed border-primary/40 bg-primary/5 hover:bg-primary/10 cursor-pointer transition-all">
                  <Download className="w-4 h-4 text-primary rotate-180" />
                  <span className="text-sm font-semibold text-primary">CSV / Excel feltöltés</span>
                  <input
                    type="file"
                    accept=".csv,.xlsx,.xls"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleCsvUpload(file);
                    }}
                  />
                </label>
                <span className="text-xs text-slate-500">Formátum: Név, Munkanapok, Túlóra, Táppénz, Szabadság</span>
                {Object.keys(attendanceData).length > 0 && (
                  <span className="flex items-center gap-1 text-xs text-green-600 font-semibold">
                    <CheckCircle2 className="w-3.5 h-3.5" /> {Object.keys(attendanceData).length} betöltve
                  </span>
                )}
              </div>

              {/* CSV Validation Feedback */}
              {csvValidation && (
                <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-300">
                  {/* Summary bar */}
                  <div className={cn(
                    'flex items-center justify-between px-4 py-3 rounded-lg border text-sm',
                    csvValidation.unmatchedNames.length === 0 && csvValidation.warnings.length === 0
                      ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                      : 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800'
                  )}>
                    <div className="flex items-center gap-2">
                      {csvValidation.unmatchedNames.length === 0 && csvValidation.warnings.length === 0 ? (
                        <CheckCircle2 className="w-4 h-4 text-green-600 dark:text-green-400" />
                      ) : (
                        <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                      )}
                      <span className="font-medium text-slate-900 dark:text-slate-100">
                        {csvValidation.fileName}: {csvValidation.matched}/{csvValidation.total} párosítva
                      </span>
                    </div>
                    <button onClick={() => setCsvValidation(null)} className="text-slate-400 hover:text-slate-600 text-xs font-medium">
                      Bezárás
                    </button>
                  </div>

                  {/* Unmatched names */}
                  {csvValidation.unmatchedNames.length > 0 && (
                    <div className="px-4 py-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
                      <p className="text-xs font-bold text-red-700 dark:text-red-400 uppercase tracking-wider mb-1.5">
                        Nem párosított nevek ({csvValidation.unmatchedNames.length})
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {csvValidation.unmatchedNames.map((name, i) => (
                          <span key={i} className="px-2 py-0.5 bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 rounded text-xs font-mono">
                            {name}
                          </span>
                        ))}
                      </div>
                      <p className="text-[10px] text-red-500 dark:text-red-400 mt-2">
                        Tipp: a CSV-ben a nevek formátuma legyen „Vezetéknév Keresztnév" vagy „Keresztnév Vezetéknév"
                      </p>
                    </div>
                  )}

                  {/* Warnings */}
                  {csvValidation.warnings.length > 0 && (
                    <div className="px-4 py-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
                      <p className="text-xs font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wider mb-1.5">
                        Figyelmeztetések ({csvValidation.warnings.length})
                      </p>
                      <div className="space-y-1">
                        {csvValidation.warnings.slice(0, 10).map((w, i) => (
                          <div key={i} className="flex items-start gap-2 text-xs text-amber-700 dark:text-amber-300">
                            <span className="font-mono text-[10px] text-amber-500 shrink-0">#{w.row}</span>
                            <span className="font-medium">{w.name}:</span>
                            <span>{w.message}</span>
                          </div>
                        ))}
                        {csvValidation.warnings.length > 10 && (
                          <p className="text-[10px] text-amber-500 mt-1">…és még {csvValidation.warnings.length - 10} figyelmeztetés</p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="overflow-x-auto rounded-lg border border-border">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border bg-slate-50/50 dark:bg-slate-900/30">
                      <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase">Név</th>
                      <th className="px-4 py-2 text-center text-xs font-medium text-slate-500 uppercase">Munkanapok</th>
                      <th className="px-4 py-2 text-center text-xs font-medium text-slate-500 uppercase">Túlóra (h)</th>
                      <th className="px-4 py-2 text-center text-xs font-medium text-slate-500 uppercase">Táppénz</th>
                      <th className="px-4 py-2 text-center text-xs font-medium text-slate-500 uppercase">Szabadság</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {activeEmployees.map((emp) => {
                      const att = getAttendance(emp.id);
                      const fromCsv = !!attendanceData[emp.id];
                      return (
                        <tr key={emp.id} className={cn('hover:bg-slate-50 dark:hover:bg-slate-800/50', fromCsv && 'bg-green-50/50 dark:bg-green-900/10')}>
                          <td className="px-4 py-2.5 text-sm font-medium text-slate-900 dark:text-slate-100">
                            {emp.last_name} {emp.first_name}
                            {fromCsv && <CheckCircle2 className="w-3 h-3 inline ml-1.5 text-green-500" />}
                          </td>
                          <td className="px-4 py-2.5 text-center text-sm font-mono text-slate-700 dark:text-slate-300">{att.workDays}</td>
                          <td className="px-4 py-2.5 text-center text-sm font-mono text-slate-700 dark:text-slate-300">{att.overtime}</td>
                          <td className="px-4 py-2.5 text-center text-sm font-mono text-slate-700 dark:text-slate-300">{att.sickDays}</td>
                          <td className="px-4 py-2.5 text-center text-sm font-mono text-slate-700 dark:text-slate-300">{att.leaveDays}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Step 4: Telefon + Cafeteria */}
          {currentStep === 4 && (
            <div className="space-y-4">
              <p className="text-sm text-slate-600 dark:text-slate-300">
                Magáncélú telefonhasználat, cafeteria juttatások, SZÉP kártya kezelés.
              </p>

              {/* Tax info banner */}
              <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800 flex items-center gap-2">
                <span className="px-2 py-0.5 bg-blue-600 text-white text-[10px] font-bold rounded-full">28%</span>
                <p className="text-xs text-blue-700 dark:text-blue-300">
                  Cafeteria közteher: SZJA 15% + SZOCHO 13% = <strong>28%</strong> · Rekreáció 75.000 Ft/év adómentes
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Phone panel */}
                <div className="p-4 rounded-lg border border-border">
                  <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-2">📱 Magáncélú telefon</h4>
                  <p className="text-xs text-slate-500 mb-3">A magáncélú telefonhasználat 20%-a kerül adóztatásra.</p>
                  <div className="text-center py-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                    <p className="text-sm text-slate-400">Nincs rögzített tétel</p>
                  </div>
                </div>

                {/* SZÉP kártya panel */}
                <div className="p-4 rounded-lg border border-border">
                  <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-2">🎁 SZÉP kártya</h4>
                  <p className="text-xs text-slate-500 mb-3">Éves limit: 450.000 Ft / zseb</p>
                  <div className="space-y-3">
                    {[
                      { name: 'Szálláshely', used: 0, limit: 450000, color: 'bg-blue-500' },
                      { name: 'Vendéglátás', used: 0, limit: 450000, color: 'bg-amber-500' },
                      { name: 'Szabadidő', used: 0, limit: 450000, color: 'bg-green-500' },
                    ].map((pocket) => (
                      <div key={pocket.name}>
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="text-slate-600 dark:text-slate-400">{pocket.name}</span>
                          <span className="font-mono text-slate-500">{pocket.used.toLocaleString('hu-HU')} / {pocket.limit.toLocaleString('hu-HU')} Ft</span>
                        </div>
                        <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                          <div
                            className={cn('h-full rounded-full transition-all', pocket.color)}
                            style={{ width: `${Math.min(100, (pocket.used / pocket.limit) * 100)}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Rekreáció */}
              <div className="p-4 rounded-lg border border-border">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">🧘 Rekreáció</h4>
                  <span className="text-xs text-slate-500 font-mono">0 / 75.000 Ft</span>
                </div>
                <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div className="h-full bg-violet-500 rounded-full" style={{ width: '0%' }} />
                </div>
                <p className="text-[10px] text-slate-400 mt-1">Adómentes keret: évi 75.000 Ft</p>
              </div>
            </div>
          )}

          {/* Step 5: Bruttó + Pótlék */}
          {currentStep === 5 && (
            <div className="space-y-4">
              <p className="text-sm text-slate-600 dark:text-slate-300">
                Alapbér, pótlékok, prémiumok meghatározása. A rendszer az aktív jogviszony alapján kalkulál.
              </p>
              <div className="overflow-x-auto rounded-lg border border-border">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border bg-slate-50/50 dark:bg-slate-900/30">
                      <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase">Név</th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-slate-500 uppercase">Alapbér</th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-slate-500 uppercase">Pótlék</th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-slate-500 uppercase">Prémium</th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-slate-500 uppercase">Bruttó összesen</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {activeEmployees.map((emp) => {
                      const empItems = items.filter(i => i.employee_id === emp.id && !i.is_deduction);
                      const base = empItems.find(i => i.item_type === 'base_salary')?.amount || 0;
                      const premium = empItems.filter(i => i.item_type !== 'base_salary').reduce((s, i) => s + (i.amount || 0), 0);
                      return (
                        <tr key={emp.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                          <td className="px-4 py-2.5 text-sm font-medium text-slate-900 dark:text-slate-100">{emp.last_name} {emp.first_name}</td>
                          <td className="px-4 py-2.5 text-right text-sm font-mono text-slate-700 dark:text-slate-300">{base.toLocaleString('hu-HU')} Ft</td>
                          <td className="px-4 py-2.5 text-right text-sm font-mono text-slate-500">0 Ft</td>
                          <td className="px-4 py-2.5 text-right text-sm font-mono text-slate-500">{premium.toLocaleString('hu-HU')} Ft</td>
                          <td className="px-4 py-2.5 text-right text-sm font-bold font-mono text-primary">{(base + premium).toLocaleString('hu-HU')} Ft</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Step 6: Adó + Járulék */}
          {currentStep === 6 && (
            <div className="space-y-4">
              <p className="text-sm text-slate-600 dark:text-slate-300">
                SZJA (15%), TB járulék (18.5%), SZOCHO (13%) kalkuláció az adómotor segítségével.
              </p>
              <div className="grid grid-cols-3 gap-3 mb-4">
                <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-3 text-center border border-red-200 dark:border-red-800">
                  <p className="text-[10px] font-bold text-red-600 uppercase">SZJA</p>
                  <p className="text-lg font-bold text-red-700 dark:text-red-400">15%</p>
                </div>
                <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 text-center border border-blue-200 dark:border-blue-800">
                  <p className="text-[10px] font-bold text-blue-600 uppercase">TB járulék</p>
                  <p className="text-lg font-bold text-blue-700 dark:text-blue-400">18.5%</p>
                </div>
                <div className="bg-violet-50 dark:bg-violet-900/20 rounded-lg p-3 text-center border border-violet-200 dark:border-violet-800">
                  <p className="text-[10px] font-bold text-violet-600 uppercase">SZOCHO</p>
                  <p className="text-lg font-bold text-violet-700 dark:text-violet-400">13%</p>
                </div>
              </div>
              {calculations.length > 0 ? (
                <div className="overflow-x-auto rounded-lg border border-border">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-border bg-slate-50/50 dark:bg-slate-900/30">
                        <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase">Név</th>
                        <th className="px-4 py-2 text-right text-xs font-medium text-slate-500 uppercase">SZJA</th>
                        <th className="px-4 py-2 text-right text-xs font-medium text-slate-500 uppercase">TB</th>
                        <th className="px-4 py-2 text-right text-xs font-medium text-slate-500 uppercase">SZOCHO</th>
                        <th className="px-4 py-2 text-right text-xs font-medium text-slate-500 uppercase">Nettó</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/50">
                      {calculations.map((calc) => {
                        return (
                          <tr key={calc.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                            <td className="px-4 py-2.5 text-sm font-medium text-slate-900 dark:text-slate-100">
                              {getCalcName(calc)}
                            </td>
                            <td className="px-4 py-2.5 text-right text-sm font-mono text-red-600">{(calc.szja_amount || 0).toLocaleString('hu-HU')} Ft</td>
                            <td className="px-4 py-2.5 text-right text-sm font-mono text-blue-600">{(calc.tb_amount || 0).toLocaleString('hu-HU')} Ft</td>
                            <td className="px-4 py-2.5 text-right text-sm font-mono text-violet-600">{(calc.szocho_amount || 0).toLocaleString('hu-HU')} Ft</td>
                            <td className="px-4 py-2.5 text-right text-sm font-bold font-mono text-green-600">{(calc.net_salary || 0).toLocaleString('hu-HU')} Ft</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
                  <p className="text-sm text-amber-700 dark:text-amber-300">
                    A számfejtés futtatásához lépj tovább a Számfejtés lépésre (8. lépés).
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Step 7: Levonások */}
          {currentStep === 7 && (
            <div className="space-y-4">
              <p className="text-sm text-slate-600 dark:text-slate-300">
                Letiltások, előleg-visszavonások, szakszervezeti tagdíj, önkéntes pénztárak.
              </p>
              <div className="overflow-x-auto rounded-lg border border-border">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border bg-slate-50/50 dark:bg-slate-900/30">
                      <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase">Név</th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-slate-500 uppercase">Letiltás</th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-slate-500 uppercase">Előleg</th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-slate-500 uppercase">Egyéb</th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-slate-500 uppercase">Össz. levonás</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {activeEmployees.map((emp) => {
                      const empDeductions = items.filter(i => i.employee_id === emp.id && i.is_deduction);
                      const total = empDeductions.reduce((s, i) => s + (i.amount || 0), 0);
                      return (
                        <tr key={emp.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                          <td className="px-4 py-2.5 text-sm font-medium text-slate-900 dark:text-slate-100">{emp.last_name} {emp.first_name}</td>
                          <td className="px-4 py-2.5 text-right text-sm font-mono text-slate-500">0 Ft</td>
                          <td className="px-4 py-2.5 text-right text-sm font-mono text-slate-500">0 Ft</td>
                          <td className="px-4 py-2.5 text-right text-sm font-mono text-slate-500">{total.toLocaleString('hu-HU')} Ft</td>
                          <td className="px-4 py-2.5 text-right text-sm font-bold font-mono text-red-600">{total.toLocaleString('hu-HU')} Ft</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Step 8: Számfejtés */}
          {currentStep === 8 && (
            <div className="space-y-4">
              <p className="text-sm text-slate-600 dark:text-slate-300">
                Véglegesítés: bruttó→nettó összesítő, jóváhagyás, bérjegyzék és dokumentumok generálása.
              </p>
              {calculations.length > 0 ? (
                <>
                  {/* Summary totals */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {[
                      { label: 'Össz. bruttó', value: calculations.reduce((s, c) => s + (c.gross_salary || 0), 0), color: 'text-slate-900 dark:text-slate-100' },
                      { label: 'Össz. SZJA+TB', value: calculations.reduce((s, c) => s + (c.szja_amount || 0) + (c.tb_amount || 0), 0), color: 'text-red-600' },
                      { label: 'Össz. SZOCHO', value: calculations.reduce((s, c) => s + (c.szocho_amount || 0), 0), color: 'text-violet-600' },
                      { label: 'Össz. nettó', value: calculations.reduce((s, c) => s + (c.net_salary || 0), 0), color: 'text-green-600' },
                    ].map((item) => (
                      <div key={item.label} className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-3 text-center">
                        <p className="text-[10px] font-medium text-slate-500 uppercase">{item.label}</p>
                        <p className={cn('text-lg font-bold mt-0.5 font-mono', item.color)}>
                          {item.value.toLocaleString('hu-HU')} Ft
                        </p>
                      </div>
                    ))}
                  </div>

                  {/* Detail table */}
                  <div className="overflow-x-auto rounded-lg border border-border">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-border bg-slate-50/50 dark:bg-slate-900/30">
                          <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase">Név</th>
                          <th className="px-4 py-2 text-right text-xs font-medium text-slate-500 uppercase">Bruttó</th>
                          <th className="px-4 py-2 text-right text-xs font-medium text-slate-500 uppercase">SZJA</th>
                          <th className="px-4 py-2 text-right text-xs font-medium text-slate-500 uppercase">TB</th>
                          <th className="px-4 py-2 text-right text-xs font-medium text-slate-500 uppercase">SZOCHO</th>
                          <th className="px-4 py-2 text-right text-xs font-medium text-slate-500 uppercase">Levonás</th>
                          <th className="px-4 py-2 text-right text-xs font-medium text-slate-500 uppercase">Nettó</th>
                          <th className="px-4 py-2 text-center text-xs font-medium text-slate-500 uppercase">Bérjegyzék</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/50">
                        {calculations.map((calc) => {
                          return (
                            <tr key={calc.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                              <td className="px-4 py-2.5 text-sm font-medium text-slate-900 dark:text-slate-100">
                                {getCalcName(calc)}
                              </td>
                              <td className="px-4 py-2.5 text-right text-sm font-mono">{(calc.gross_salary || 0).toLocaleString('hu-HU')}</td>
                              <td className="px-4 py-2.5 text-right text-sm font-mono text-red-600">{(calc.szja_amount || 0).toLocaleString('hu-HU')}</td>
                              <td className="px-4 py-2.5 text-right text-sm font-mono text-blue-600">{(calc.tb_amount || 0).toLocaleString('hu-HU')}</td>
                              <td className="px-4 py-2.5 text-right text-sm font-mono text-violet-600">{(calc.szocho_amount || 0).toLocaleString('hu-HU')}</td>
                              <td className="px-4 py-2.5 text-right text-sm font-mono text-orange-600">{(calc.total_deductions || 0).toLocaleString('hu-HU')}</td>
                              <td className="px-4 py-2.5 text-right text-sm font-bold font-mono text-green-600">{(calc.net_salary || 0).toLocaleString('hu-HU')}</td>
                              <td className="px-4 py-2.5 text-center">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handlePrintPayslip(calc)}
                                  className="h-7 px-2"
                                  title="Bérjegyzék nyomtatása"
                                >
                                  <Printer className="w-3.5 h-3.5" />
                                </Button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot>
                        <tr className="border-t-2 border-border bg-slate-50/80 dark:bg-slate-900/50 font-bold">
                          <td className="px-4 py-2.5 text-sm text-slate-900 dark:text-slate-100">ÖSSZESEN</td>
                          <td className="px-4 py-2.5 text-right text-sm font-mono">{calculations.reduce((s, c) => s + (c.gross_salary || 0), 0).toLocaleString('hu-HU')}</td>
                          <td className="px-4 py-2.5 text-right text-sm font-mono text-red-600">{calculations.reduce((s, c) => s + (c.szja_amount || 0), 0).toLocaleString('hu-HU')}</td>
                          <td className="px-4 py-2.5 text-right text-sm font-mono text-blue-600">{calculations.reduce((s, c) => s + (c.tb_amount || 0), 0).toLocaleString('hu-HU')}</td>
                          <td className="px-4 py-2.5 text-right text-sm font-mono text-violet-600">{calculations.reduce((s, c) => s + (c.szocho_amount || 0), 0).toLocaleString('hu-HU')}</td>
                          <td className="px-4 py-2.5 text-right text-sm font-mono text-orange-600">{calculations.reduce((s, c) => s + (c.total_deductions || 0), 0).toLocaleString('hu-HU')}</td>
                          <td className="px-4 py-2.5 text-right text-sm font-mono text-green-600">{calculations.reduce((s, c) => s + (c.net_salary || 0), 0).toLocaleString('hu-HU')}</td>
                          <td></td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>

                  <div className="flex items-center gap-3 p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                    <div className="flex-1">
                      <p className="text-sm text-green-700 dark:text-green-300">
                        <CheckCircle2 className="w-4 h-4 inline mr-1" />
                        <strong>{calculations.length}</strong> foglalkoztatott számfejtése kész. Lezáráshoz kattints a "Ciklus lezárása" gombra.
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => calculations.forEach(c => handlePrintPayslip(c))}
                      className="flex items-center gap-1.5 shrink-0"
                    >
                      <Printer className="w-3.5 h-3.5" /> Összes bérjegyzék
                    </Button>
                  </div>
                </>
              ) : (
                <div className="space-y-4">
                  <div className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
                    <p className="text-sm text-amber-700 dark:text-amber-300">
                      Még nincs futtatott számfejtés ebben a ciklusban.
                    </p>
                  </div>
                  <Button
                    onClick={() => cycle && companyId && runBatch.mutate({
                      cycleId: cycle.id,
                      companyId,
                      year: cycle.year,
                      month: cycle.month,
                    })}
                    disabled={runBatch.isPending}
                    className="w-full bg-primary hover:bg-primary/90 text-primary-foreground flex items-center justify-center gap-2 py-3"
                  >
                    {runBatch.isPending ? (
                      <><Loader2 className="w-4 h-4 animate-spin" /> Számfejtés folyamatban...</>
                    ) : (
                      <><Play className="w-4 h-4" /> Számfejtés futtatása ({activeEmployees.length} fő)</>
                    )}
                  </Button>
                </div>
              )}
            </div>
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
              await supabase.from('payroll_cycles').update({ status: 'closed', current_step: 8 } as any).eq('id', cycle.id);
              toast({ title: '✅ Ciklus lezárva', description: `${cycle.year}. ${MONTHS[cycle.month - 1]} bérszámfejtés lezárva.` });
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
