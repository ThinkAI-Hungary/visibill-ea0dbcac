import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, User, Briefcase, CreditCard, Calendar, FileText,
  Shield, Edit3, Trash2, Plus, X,
  Mail, Phone, MapPin, Banknote, AlertTriangle, Save, Loader2,
  Users, LogOut, FolderOpen, Printer, Download, Gift
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  usePayrollEmployee, usePayrollEmployments, usePayrollDeclarations,
  usePayrollLeaves, usePayrollGarnishments,
  useRevokeDeclaration,
  useUpdateEmployee,
  type PayrollDeclaration, type PayrollEmployee
} from '@/hooks/usePayrollData';
import { formatTajNumber, formatBankAccount, formatAmount } from '@/lib/payroll/validators';
import { calculateLeaveBalance, type EmployeeLeaveInput } from '@/lib/payroll/leaveCalculator';
import { useToast } from '@/hooks/use-toast';
import { AccountyErrorState } from '@/components/accounty/AccountyErrorState';
import { InfoSection, InfoRow, EditField, MiniStat } from './employee-details/EmployeeHelpers';
import { EmployeeOverviewTab, EmployeeEmploymentsTab } from './employee-details/EmployeeTabSections';
import { EmployeeDeclarationsTab } from './employee-details/EmployeeDeclarationsTab';
import { EmployeeLeaveTab } from './employee-details/EmployeeLeaveTab';
import { EmployeeGarnishmentsTab } from './employee-details/EmployeeGarnishmentsTab';
import { EmployeeCafeteriaTab } from './employee-details/EmployeeCafeteriaTab';
import SalaryHistoryTab from './employee-details/SalaryHistoryTab';
import { printEmploymentCertificate, printIncomeCertificate, printTimesheetTemplate, printAnnualLedger } from '@/lib/payroll/payslipTemplates';
import { generate2608Xml, generate2658Xml, generateT1041Xml, generateT1042EXml } from '@/lib/payroll/xmlGenerator';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { calculatePayroll, calculateGarnishments, DEFAULT_2026_PARAMS } from '@/lib/payroll/taxEngine';

// ── Tab definíciók ──
const TABS = [
  { id: 'overview', title: 'Áttekintés', icon: User },
  { id: 'employments', title: 'Jogviszonyok', icon: Briefcase },
  { id: 'declarations', title: 'Nyilatkozatok', icon: FileText },
  { id: 'cafeteria', title: 'Cafeteria', icon: Gift },
  { id: 'leave', title: 'Szabadság', icon: Calendar },
  { id: 'garnishments', title: 'Letiltások', icon: Shield },
  { id: 'salary', title: 'Bérelőzmények', icon: Banknote },
  { id: 'documents', title: 'Dokumentumok', icon: FileText },
];

export default function EmployeeDetailsPage() {
  const { companyId, empId } = useParams<{ companyId: string; empId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('overview');
  const [showNewDeclaration, setShowNewDeclaration] = useState(false);
  const [editingDeclaration, setEditingDeclaration] = useState<PayrollDeclaration | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<Partial<PayrollEmployee>>({});
  const updateEmployee = useUpdateEmployee();

  const { data: employee, isLoading: empLoading, isError: empError, refetch: refetchEmp } = usePayrollEmployee(empId || '');
  const { data: employments = [] } = usePayrollEmployments(empId || '');
  const { data: declarations = [] } = usePayrollDeclarations(empId || '');
  const { data: garnishments = [] } = usePayrollGarnishments(empId || '');

  const { data: companyData } = useQuery({
    queryKey: ['company', companyId],
    queryFn: async () => {
      const { data, error } = await supabase.from('companies').select('*').eq('id', companyId).single();
      if (error) throw error;
      return data;
    },
    enabled: !!companyId
  });

  // Get first employment for leave calc
  const primaryEmployment = employments.find(e => e.status === 'active') || employments[0];
  const { data: leaves = [] } = usePayrollLeaves(primaryEmployment?.id || '');

  if (empError) {
    return <AccountyErrorState message="Nem sikerült betölteni a foglalkoztatott adatait." onRetry={() => refetchEmp()} />;
  }

  if (empLoading) {
    return (
      <div className="w-full space-y-6 animate-in fade-in">
        <div className="h-8 w-64 bg-slate-200 dark:bg-slate-800 rounded animate-pulse" />
        <div className="h-48 bg-slate-200 dark:bg-slate-800 rounded-xl animate-pulse" />
      </div>
    );
  }

  if (!employee) {
    return (
      <div className="w-full text-center py-16">
        <AlertTriangle className="w-12 h-12 mx-auto mb-3 text-slate-300" />
        <p className="text-slate-500">Foglalkoztatott nem található</p>
      </div>
    );
  }

  const statusLabel: Record<string, string> = {
    active: 'Aktív', pending: 'Függő', terminated: 'Kilépett', suspended: 'Szünetelő',
  };
  const statusColor: Record<string, string> = {
    active: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400',
    pending: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400',
    terminated: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
    suspended: 'bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400',
  };

  // Leave balance (simplified)
  const leaveBalance = (() => {
    if (!employee.birth_date) return null;
    const birthYear = new Date(employee.birth_date).getFullYear();
    const age = new Date().getFullYear() - birthYear;
    const input: EmployeeLeaveInput = {
      ageAtYearStart: age,
      childrenUnder16: 0,
      disabledChildren: 0,
      carriedOverDays: 0,
      extraLeaveDays: 0,
      year: new Date().getFullYear(),
      usedDays: leaves.filter(l => l.leave_type === 'annual' && l.status === 'approved').reduce((s, l) => s + l.days, 0),
    };
    return calculateLeaveBalance(input);
  })();

  const startEditing = () => {
    if (!employee) return;
    setEditForm({
      first_name: employee.first_name,
      last_name: employee.last_name,
      birth_name: employee.birth_name,
      birth_place: employee.birth_place,
      birth_date: employee.birth_date,
      mothers_name: employee.mothers_name,
      email: employee.email,
      phone: employee.phone,
      taj_number: employee.taj_number,
      tax_id: employee.tax_id,
      bank_account: employee.bank_account,
      status: employee.status,
      eu_tax_id: employee.eu_tax_id,
      education_level: employee.education_level,
      has_age_concession: employee.has_age_concession,
      has_union_fee: employee.has_union_fee,
      has_no_hungarian_address: employee.has_no_hungarian_address,
    });
    setIsEditing(true);
    setActiveTab('overview');
  };

  const cancelEditing = () => {
    setIsEditing(false);
    setEditForm({});
  };

  const saveEditing = async () => {
    if (!empId) return;
    try {
      await updateEmployee.mutateAsync({ id: empId, ...editForm });
      setIsEditing(false);
      setEditForm({});
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Hiba', description: err.message });
    }
  };

  return (
    <div className="w-full space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(`/eaisybooks/payroll/${companyId}/employees`)} className="h-9 w-9">
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center text-xl font-bold text-primary">
              {employee.last_name[0]}{employee.first_name[0]}
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                {employee.last_name} {employee.first_name}
              </h1>
              <div className="flex items-center gap-3 mt-1">
                <span className={cn('px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase', statusColor[employee.status])}>
                  {statusLabel[employee.status] || employee.status}
                </span>
                {employee.taj_number && (
                  <span className="text-xs text-slate-500 font-mono">TAJ: {formatTajNumber(employee.taj_number)}</span>
                )}
              </div>
            </div>
          </div>
        </div>
        {isEditing ? (
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={cancelEditing} className="flex items-center gap-2">
              <X className="w-4 h-4" /> Mégse
            </Button>
            <Button onClick={saveEditing} disabled={updateEmployee.isPending} className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white">
              {updateEmployee.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Mentés
            </Button>
          </div>
        ) : (
          <Button variant="outline" className="flex items-center gap-2" onClick={startEditing}>
            <Edit3 className="w-4 h-4" /> Szerkesztés
          </Button>
        )}
      </div>

      {/* Tab bar */}
      <div className="flex items-center gap-1 overflow-x-auto bg-muted/80 p-1 rounded-xl border border-border/60">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              'flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all',
              activeTab === tab.id
                ? 'bg-card text-slate-900 dark:text-slate-100 shadow-soft'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-700'
            )}
          >
            <tab.icon className="w-4 h-4" />
            {tab.title}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div key={activeTab} className="bg-card rounded-xl border border-border shadow-soft tab-content-animate">
        {activeTab === 'overview' && (
          <EmployeeOverviewTab
            employee={employee}
            isEditing={isEditing}
            editForm={editForm}
            setEditForm={setEditForm}
            leaveBalance={leaveBalance}
          />
        )}

        {activeTab === 'employments' && (
          <EmployeeEmploymentsTab
            employments={employments}
            companyId={companyId || ''}
            empId={empId || ''}
          />
        )}

        {activeTab === 'declarations' && (
          <EmployeeDeclarationsTab
            declarations={declarations}
            empId={empId || ''}
            showNewDeclaration={showNewDeclaration}
            setShowNewDeclaration={setShowNewDeclaration}
            editingDeclaration={editingDeclaration}
            setEditingDeclaration={setEditingDeclaration}
          />
        )}

        {activeTab === 'cafeteria' && (
          <EmployeeCafeteriaTab employmentId={primaryEmployment?.id || ''} />
        )}

        {activeTab === 'leave' && (
          <EmployeeLeaveTab leaves={leaves} leaveBalance={leaveBalance} />
        )}

        {activeTab === 'garnishments' && (
          <EmployeeGarnishmentsTab garnishments={garnishments} empId={empId || ''} />
        )}

        {activeTab === 'salary' && (
          <SalaryHistoryTab employmentId={primaryEmployment?.id || ''} />
        )}

        {activeTab === 'documents' && (
          <div className="p-6 space-y-6">
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Generáld és nyomtasd ki a dolgozó munkaviszonyával kapcsolatos kötelező bizonylatokat, vagy töltsd le a NAV ÁNYK kompatibilis bejelentő XML fájlokat.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Printable documents block */}
              <div className="p-4 rounded-xl border border-border bg-card space-y-4 shadow-sm">
                <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <Printer className="w-4 h-4 text-primary" /> Munkáltatói Igazolások és Bizonylatok
                </h4>
                <div className="divide-y divide-border/60 text-xs">
                  <div className="py-2.5 flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-slate-700 dark:text-slate-300">Foglalkoztatási Igazolás</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">Hivatalos igazolás a fennálló munkaviszonyról.</p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs"
                      onClick={() => {
                        const compInfo = {
                          name: companyData?.name || 'Thinkai Kft.',
                          taxNumber: companyData?.tax_number || '27384950-2-42',
                          address: companyData?.address || '1113 Budapest, Bocskai út 77-79.'
                        };
                        const empInfo = {
                          name: `${employee.last_name} ${employee.first_name}`,
                          birthName: employee.birth_name || undefined,
                          birthPlace: employee.birth_place || undefined,
                          birthDate: employee.birth_date || undefined,
                          mothersName: employee.mothers_name || undefined,
                          tajNumber: employee.taj_number || '–',
                          taxId: employee.tax_id || '–',
                          jobTitle: primaryEmployment?.job_title || '–',
                          startDate: primaryEmployment?.start_date || '–'
                        };
                        printEmploymentCertificate(compInfo, empInfo);
                      }}
                    >
                      Nyomtatás
                    </Button>
                  </div>

                  <div className="py-2.5 flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-slate-700 dark:text-slate-300">Munkáltatói Jövedelemigazolás</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">Havi nettó jövedelem igazolása (pl. hitelügyintézéshez).</p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs"
                      onClick={() => {
                        const calculatedNet = (() => {
                          if (!employee || !primaryEmployment) return 380000;
                          
                          // Parse declarations
                          const parsedDecs: any = {};
                          for (const decl of declarations) {
                            if (decl.declaration_type === 'family_credit') {
                              const children = decl.parameters?.children_count || 0;
                              const sharePct = decl.parameters?.share_pct || 100;
                              parsedDecs.family = {
                                dependentCount: Number(children),
                                eligibleChildrenCount: Number(children),
                                sharePct: Number(sharePct),
                              };
                            }
                            if (decl.declaration_type === 'netak') {
                              parsedDecs.netak = { eligible: true };
                            }
                            if (decl.declaration_type === 'under_25') {
                              parsedDecs.young25 = { eligible: true };
                            }
                            if (decl.declaration_type === 'new_mother') {
                              parsedDecs.youngMother30 = { maxDeduction: 0 };
                            }
                            if (decl.declaration_type === 'first_marriage') {
                              const months = decl.parameters?.months_remaining || 24;
                              parsedDecs.firstMarriage = { eligible: true, monthsRemaining: Number(months) };
                            }
                            if (decl.declaration_type === 'personal_disability') {
                              parsedDecs.personal = { eligible: true };
                            }
                          }

                          const birthDate = employee.birth_date ? new Date(employee.birth_date) : null;
                          const employeeAge = birthDate
                            ? Math.floor((Date.now() - birthDate.getTime()) / (365.25 * 86400000))
                            : 30;

                          const baseSalary = Number(primaryEmployment.base_salary) || 0;

                          const calcInput = {
                            grossComponents: {
                              baseSalary,
                              overtime: 0,
                              nightShift: 0,
                              sundayPremium: 0,
                              holidayPremium: 0,
                              bonus: 0,
                              sickLeave: 0,
                              otherIncome: 0,
                            },
                            declarations: parsedDecs,
                            employeeAge,
                            employeeGender: employee.gender || 'other',
                            isInsured: primaryEmployment.is_insured ?? true,
                            jobCode: primaryEmployment.job_code || '',
                            weeklyHours: primaryEmployment.weekly_hours || 40,
                            params: DEFAULT_2026_PARAMS,
                            isPensioner: !!primaryEmployment.is_pensioner,
                            ekhoCategory: primaryEmployment.ekho_category || 'normal',
                            ekhoPayer: primaryEmployment.ekho_payer || 'employee',
                            isEkho: !!primaryEmployment.is_ekho,
                            isSzochoDiscount: !!primaryEmployment.is_szocho_discount,
                            szochoDiscountType: primaryEmployment.szocho_discount_type || 'none',
                            szochoDiscountMonthsElapsed: primaryEmployment.szocho_discount_start 
                               ? Math.max(0, (new Date().getFullYear() - new Date(primaryEmployment.szocho_discount_start).getFullYear()) * 12 + (new Date().getMonth() - new Date(primaryEmployment.szocho_discount_start).getMonth()))
                               : 0,
                            cafeteria: [],
                          };

                          try {
                            const payrollResult = calculatePayroll(calcInput as any);
                            
                            // Parse garnishments
                            const parsedGarnishments = (garnishments || []).map((g: any) => ({
                              type: (g.garnishment_type || 'private_debt') as any,
                              monthlyDeduction: Number(g.monthly_deduction) || 0,
                              maxDeductionPct: Number(g.max_deduction_pct) || 0.33,
                              priority: Number(g.priority) || 1,
                            }));
                            
                            const garnishResult = calculateGarnishments(payrollResult.netSalary, parsedGarnishments);
                            const finalNet = payrollResult.netSalary - garnishResult.total;
                            return finalNet > 0 ? finalNet : payrollResult.netSalary;
                          } catch (e) {
                            console.error('Error calculating net salary:', e);
                            return 380000;
                          }
                        })();

                        const compInfo = {
                          name: companyData?.name || 'Thinkai Kft.',
                          taxNumber: companyData?.tax_number || '27384950-2-42',
                          address: companyData?.address || '1113 Budapest, Bocskai út 77-79.'
                        };
                        const empInfo = {
                          name: `${employee.last_name} ${employee.first_name}`,
                          birthName: employee.birth_name || undefined,
                          birthPlace: employee.birth_place || undefined,
                          birthDate: employee.birth_date || undefined,
                          mothersName: employee.mothers_name || undefined,
                          tajNumber: employee.taj_number || '–',
                          taxId: employee.tax_id || '–',
                          jobTitle: primaryEmployment?.job_title || '–',
                          startDate: primaryEmployment?.start_date || '–'
                        };
                        printIncomeCertificate(compInfo, empInfo, calculatedNet);
                      }}
                    >
                      Nyomtatás
                    </Button>
                  </div>

                  <div className="py-2.5 flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-slate-700 dark:text-slate-300">Jelenléti ív sablon</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">Üres havi munkaidő nyilvántartó lap kézi kitöltéshez.</p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs"
                      onClick={() => {
                        const year = new Date().getFullYear();
                        const monthStr = window.prompt('Melyik hónapra kéred a jelenléti ívet (1-12)?', String(new Date().getMonth() + 1));
                        if (!monthStr) return;
                        const month = parseInt(monthStr) || 1;
                        const compInfo = {
                          name: companyData?.name || 'Thinkai Kft.',
                          taxNumber: companyData?.tax_number || '27384950-2-42',
                          address: companyData?.address || '1113 Budapest, Bocskai út 77-79.'
                        };
                        const empInfo = {
                          name: `${employee.last_name} ${employee.first_name}`,
                          birthName: employee.birth_name || undefined,
                          birthPlace: employee.birth_place || undefined,
                          birthDate: employee.birth_date || undefined,
                          mothersName: employee.mothers_name || undefined,
                          tajNumber: employee.taj_number || '–',
                          taxId: employee.tax_id || '–',
                          jobTitle: primaryEmployment?.job_title || '–',
                          startDate: primaryEmployment?.start_date || '–'
                        };
                        printTimesheetTemplate(compInfo, empInfo, year, month);
                      }}
                    >
                      Nyomtatás
                    </Button>
                  </div>

                  <div className="py-2.5 flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-slate-700 dark:text-slate-300">Éves Bérkarton</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">Összesített adókarton az adott adóév kifizetéseiről.</p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs"
                      onClick={() => {
                        const year = new Date().getFullYear();
                        const compInfo = {
                          name: companyData?.name || 'Thinkai Kft.',
                          taxNumber: companyData?.tax_number || '27384950-2-42',
                          address: companyData?.address || '1113 Budapest, Bocskai út 77-79.'
                        };
                        const empInfo = {
                          name: `${employee.last_name} ${employee.first_name}`,
                          birthName: employee.birth_name || undefined,
                          birthPlace: employee.birth_place || undefined,
                          birthDate: employee.birth_date || undefined,
                          mothersName: employee.mothers_name || undefined,
                          tajNumber: employee.taj_number || '–',
                          taxId: employee.tax_id || '–',
                          jobTitle: primaryEmployment?.job_title || '–',
                          startDate: primaryEmployment?.start_date || '–'
                        };
                        printAnnualLedger(compInfo, empInfo, year, []);
                      }}
                    >
                      Nyomtatás
                    </Button>
                  </div>
                </div>
              </div>

              {/* NAV XML generation block */}
              <div className="p-4 rounded-xl border border-border bg-card space-y-4 shadow-sm">
                <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <Download className="w-4 h-4 text-primary" /> Kormányzati NAV XML exportok (ÁNYK)
                </h4>
                <div className="divide-y divide-border/60 text-xs">
                  <div className="py-2.5 flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-slate-700 dark:text-slate-300">T1041 Biztosítotti bejelentés</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">Biztosítási jogviszony kezdetének / végének bejelentése.</p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs"
                      onClick={() => {
                        const compInfo = {
                          name: companyData?.name || 'Thinkai Kft.',
                          taxNumber: companyData?.tax_number || '27384950-2-42',
                          address: companyData?.address || '1113 Budapest, Bocskai út 77-79.'
                        };
                        generateT1041Xml({
                          company: compInfo,
                          employee,
                          action: 'bejelentes',
                          date: primaryEmployment?.start_date || new Date().toISOString().slice(0, 10)
                        });
                      }}
                    >
                      Letöltés (.xml)
                    </Button>
                  </div>

                  <div className="py-2.5 flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-slate-700 dark:text-slate-300">T1042E EFO Alkalmi Munka</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">Alkalmi / egyszerűsített foglalkoztatás napi bejelentője.</p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs"
                      onClick={() => {
                        const date = new Date().toISOString().slice(0, 10);
                        const compInfo = {
                          name: companyData?.name || 'Thinkai Kft.',
                          taxNumber: companyData?.tax_number || '27384950-2-42',
                          address: companyData?.address || '1113 Budapest, Bocskai út 77-79.'
                        };
                        generateT1042EXml({
                          company: compInfo,
                          employee,
                          date,
                          daysCount: 1
                        });
                      }}
                    >
                      Letöltés (.xml)
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
