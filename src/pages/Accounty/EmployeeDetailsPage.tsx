import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, User, Briefcase, CreditCard, Calendar, FileText,
  Shield, Clock, ChevronRight, Edit3, Trash2, Plus, Check,
  Mail, Phone, MapPin, Banknote, AlertTriangle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  usePayrollEmployee, usePayrollEmployments, usePayrollDeclarations,
  usePayrollLeaves, usePayrollGarnishments
} from '@/hooks/usePayrollData';
import { formatTajNumber, formatBankAccount, formatAmount } from '@/lib/payroll/validators';
import { calculateLeaveBalance, type EmployeeLeaveInput } from '@/lib/payroll/leaveCalculator';

// ── Tab définíciók ──
const TABS = [
  { id: 'overview', title: 'Áttekintés', icon: User },
  { id: 'employments', title: 'Jogviszonyok', icon: Briefcase },
  { id: 'declarations', title: 'Nyilatkozatok', icon: FileText },
  { id: 'leave', title: 'Szabadság', icon: Calendar },
  { id: 'garnishments', title: 'Letiltások', icon: Shield },
  { id: 'salary', title: 'Bérelőzmények', icon: Banknote },
  { id: 'documents', title: 'Dokumentumok', icon: FileText },
];

export default function EmployeeDetailsPage() {
  const { id: companyId, empId } = useParams<{ id: string; empId: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('overview');

  const { data: employee, isLoading: empLoading } = usePayrollEmployee(empId || '');
  const { data: employments = [] } = usePayrollEmployments(empId || '');
  const { data: declarations = [] } = usePayrollDeclarations(empId || '');
  const { data: garnishments = [] } = usePayrollGarnishments(empId || '');

  // Get first employment for leave calc
  const primaryEmployment = employments.find(e => e.status === 'active') || employments[0];
  const { data: leaves = [] } = usePayrollLeaves(primaryEmployment?.id || '');

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

  return (
    <div className="w-full space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(`/accounty/payroll/${companyId}/employees`)} className="h-9 w-9">
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
        <Button variant="outline" className="flex items-center gap-2">
          <Edit3 className="w-4 h-4" /> Szerkesztés
        </Button>
      </div>

      {/* Tab bar */}
      <div className="flex items-center gap-1 overflow-x-auto bg-slate-100/80 dark:bg-slate-900/80 p-1 rounded-xl border border-border/60">
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
      <div className="bg-card rounded-xl border border-border shadow-soft">
        {/* Overview */}
        {activeTab === 'overview' && (
          <div className="p-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <InfoSection title="Személyes adatok">
                <InfoRow icon={User} label="Születési név" value={employee.birth_name || '–'} />
                <InfoRow icon={MapPin} label="Születési hely" value={employee.birth_place || '–'} />
                <InfoRow icon={Calendar} label="Születési dátum" value={employee.birth_date || '–'} />
                <InfoRow icon={User} label="Anyja neve" value={employee.mothers_name || '–'} />
              </InfoSection>

              <InfoSection title="Elérhetőség">
                <InfoRow icon={Mail} label="E-mail" value={employee.email || '–'} />
                <InfoRow icon={Phone} label="Telefon" value={employee.phone || '–'} />
              </InfoSection>

              <InfoSection title="Azonosítók">
                <InfoRow icon={Shield} label="TAJ-szám" value={employee.taj_number ? formatTajNumber(employee.taj_number) : '–'} />
                <InfoRow icon={FileText} label="Adóazonosító" value={employee.tax_id || '–'} />
                <InfoRow icon={CreditCard} label="Bankszámla" value={employee.bank_account ? formatBankAccount(employee.bank_account) : '–'} />
              </InfoSection>
            </div>

            {/* Leave quick view */}
            {leaveBalance && (
              <div className="border-t border-border pt-6">
                <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-3">Szabadság mérleg ({new Date().getFullYear()})</h3>
                <div className="grid grid-cols-4 gap-3">
                  <MiniStat label="Éves keret" value={`${leaveBalance.totalAnnual} nap`} />
                  <MiniStat label="Felhasznált" value={`${leaveBalance.used} nap`} />
                  <MiniStat label="Fennmaradó" value={`${leaveBalance.remaining} nap`} color={leaveBalance.remaining < 5 ? 'red' : 'green'} />
                  <MiniStat label="Életkori pótlék" value={`+${leaveBalance.ageSupplement} nap`} />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Employments */}
        {activeTab === 'employments' && (
          <div className="p-6">
            {employments.length === 0 ? (
              <div className="py-8 text-center text-sm text-slate-500">Nincs rögzített jogviszony</div>
            ) : (
              <div className="space-y-3">
                {employments.map((emp) => (
                  <div key={emp.id} className="p-4 rounded-lg border border-border hover:border-primary/30 transition-colors">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-slate-900 dark:text-slate-100">{emp.employment_type}</span>
                        <span className="px-1.5 py-0.5 text-[10px] font-mono bg-slate-100 dark:bg-slate-800 rounded">{emp.job_code}</span>
                      </div>
                      <span className={cn(
                        'px-2 py-0.5 rounded-full text-[10px] font-bold uppercase',
                        emp.status === 'active' ? 'bg-green-100 text-green-700 dark:bg-green-900/40' : 'bg-slate-100 text-slate-600 dark:bg-slate-800'
                      )}>
                        {emp.status === 'active' ? 'Aktív' : emp.status}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs text-slate-500 dark:text-slate-400">
                      <span>Kezdés: {emp.start_date}</span>
                      <span>Munkakör: {emp.job_title || '–'}</span>
                      <span>FEOR: {emp.feor_code || '–'}</span>
                      <span>Alapbér: {emp.base_salary ? formatAmount(emp.base_salary) : '–'}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Declarations */}
        {activeTab === 'declarations' && (
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300">Adóelőleg-nyilatkozatok</h3>
              <Button variant="outline" size="sm" className="flex items-center gap-1">
                <Plus className="w-3 h-3" /> Új nyilatkozat
              </Button>
            </div>
            {declarations.length === 0 ? (
              <div className="py-8 text-center text-sm text-slate-500">Nincs rögzített nyilatkozat</div>
            ) : (
              <div className="space-y-2">
                {declarations.map((d) => (
                  <div key={d.id} className="p-3 rounded-lg border border-border flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 capitalize">
                        {d.declaration_type.replace(/_/g, ' ')}
                      </p>
                      <p className="text-xs text-slate-500">Érvényes: {d.valid_from}{d.valid_until ? ` – ${d.valid_until}` : ''}</p>
                    </div>
                    <span className={cn(
                      'px-2 py-0.5 rounded-full text-[10px] font-bold uppercase',
                      d.status === 'active' ? 'bg-green-100 text-green-700 dark:bg-green-900/40' : 'bg-slate-100 text-slate-600 dark:bg-slate-800'
                    )}>
                      {d.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Leave */}
        {activeTab === 'leave' && (
          <div className="p-6">
            {leaveBalance && (
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
                <MiniStat label="Alap-szabadság" value={`${leaveBalance.baseLeave} nap`} />
                <MiniStat label="Életkori pótlék" value={`+${leaveBalance.ageSupplement} nap`} />
                <MiniStat label="Gyermek pótlék" value={`+${leaveBalance.childSupplement} nap`} />
                <MiniStat label="Felhasznált" value={`${leaveBalance.used} nap`} />
                <MiniStat label="Fennmaradó" value={`${leaveBalance.remaining} nap`} color={leaveBalance.remaining < 5 ? 'red' : 'green'} />
              </div>
            )}

            {leaves.length === 0 ? (
              <div className="py-8 text-center text-sm text-slate-500">Nincs rögzített távollét</div>
            ) : (
              <div className="space-y-2">
                {leaves.map((l) => (
                  <div key={l.id} className="p-3 rounded-lg border border-border flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 capitalize">
                        {l.leave_type.replace(/_/g, ' ')}
                      </p>
                      <p className="text-xs text-slate-500">{l.start_date} – {l.end_date} · {l.days} nap</p>
                    </div>
                    <span className={cn(
                      'px-2 py-0.5 rounded-full text-[10px] font-bold uppercase',
                      l.status === 'approved' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                    )}>
                      {l.status === 'approved' ? 'Jóváhagyva' : l.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Garnishments */}
        {activeTab === 'garnishments' && (
          <div className="p-6">
            {garnishments.length === 0 ? (
              <div className="py-8 text-center text-sm text-slate-500">Nincs aktív letiltás</div>
            ) : (
              <div className="space-y-2">
                {garnishments.map((g) => (
                  <div key={g.id} className="p-4 rounded-lg border border-border">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 capitalize">
                        {g.garnishment_type.replace(/_/g, ' ')}
                      </p>
                      <span className="text-[10px] font-bold bg-red-100 text-red-700 dark:bg-red-900/40 px-2 py-0.5 rounded-full uppercase">
                        Max {g.max_deduction_pct}%
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-xs text-slate-500">
                      <span>Hitelező: {g.creditor_name || '–'}</span>
                      <span>Fennmaradó: {g.remaining_amount ? formatAmount(g.remaining_amount) : '–'}</span>
                      <span>Havi: {g.monthly_deduction ? formatAmount(g.monthly_deduction) : '–'}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Salary history + Documents (placeholder) */}
        {(activeTab === 'salary' || activeTab === 'documents') && (
          <div className="p-6 py-16 text-center text-sm text-slate-500">
            <FileText className="w-10 h-10 mx-auto mb-3 text-slate-300" />
            Ez a funkció a következő fázisban lesz elérhető.
          </div>
        )}
      </div>
    </div>
  );
}

// ── Helper components ──

function InfoSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-3">{title}</h3>
      <div className="space-y-2.5">{children}</div>
    </div>
  );
}

function InfoRow({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2">
      <Icon className="w-3.5 h-3.5 text-slate-400 shrink-0" />
      <span className="text-xs text-slate-500 dark:text-slate-400 shrink-0 w-24">{label}</span>
      <span className="text-sm text-slate-900 dark:text-slate-100 font-medium truncate">{value}</span>
    </div>
  );
}

function MiniStat({ label, value, color }: { label: string; value: string; color?: 'green' | 'red' }) {
  return (
    <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-3 text-center">
      <p className="text-[10px] font-medium text-slate-500 uppercase tracking-wider">{label}</p>
      <p className={cn(
        'text-lg font-bold mt-0.5',
        color === 'green' ? 'text-green-600 dark:text-green-400' :
        color === 'red' ? 'text-red-600 dark:text-red-400' :
        'text-slate-900 dark:text-slate-100'
      )}>
        {value}
      </p>
    </div>
  );
}
