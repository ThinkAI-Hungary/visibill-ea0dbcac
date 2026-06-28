import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, User, Briefcase, CreditCard, Calendar, FileText,
  Shield, Edit3, Trash2, Plus, X,
  Mail, Phone, MapPin, Banknote, AlertTriangle, Save, Loader2,
  Users, LogOut, FolderOpen
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
import { DECLARATION_TYPES, NewDeclarationDialog, EditDeclarationDialog } from './employee-details/DeclarationDialogs';
import SalaryHistoryTab from './employee-details/SalaryHistoryTab';

// ── Tab definíciók ──
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
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('overview');
  const [showNewDeclaration, setShowNewDeclaration] = useState(false);
  const [editingDeclaration, setEditingDeclaration] = useState<PayrollDeclaration | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<Partial<PayrollEmployee>>({});
  const revokeDeclaration = useRevokeDeclaration();
  const updateEmployee = useUpdateEmployee();

  const { data: employee, isLoading: empLoading, isError: empError, refetch: refetchEmp } = usePayrollEmployee(empId || '');
  const { data: employments = [] } = usePayrollEmployments(empId || '');
  const { data: declarations = [] } = usePayrollDeclarations(empId || '');
  const { data: garnishments = [] } = usePayrollGarnishments(empId || '');

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
      <div key={activeTab} className="bg-card rounded-xl border border-border shadow-soft tab-content-animate">
        {/* Overview */}
        {activeTab === 'overview' && (
          <EmployeeOverviewTab
            employee={employee}
            isEditing={isEditing}
            editForm={editForm}
            setEditForm={setEditForm}
            leaveBalance={leaveBalance}
          />
        )}

        {/* Employments */}
        {activeTab === 'employments' && (
          <EmployeeEmploymentsTab
            employments={employments}
            companyId={companyId || ''}
            empId={empId || ''}
          />
        )}

        {/* Declarations */}
        {activeTab === 'declarations' && (
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300">Adóelőleg-nyilatkozatok</h3>
              <Button variant="outline" size="sm" className="flex items-center gap-1" onClick={() => setShowNewDeclaration(true)}>
                <Plus className="w-3 h-3" /> Új nyilatkozat
              </Button>
            </div>

            {/* New Declaration Dialog */}
            {showNewDeclaration && (
              <NewDeclarationDialog
                employeeId={empId || ''}
                onClose={() => setShowNewDeclaration(false)}
              />
            )}

            {/* Edit Declaration Dialog */}
            {editingDeclaration && (
              <EditDeclarationDialog
                declaration={editingDeclaration}
                employeeId={empId || ''}
                onClose={() => setEditingDeclaration(null)}
              />
            )}

            {declarations.length === 0 ? (
              <div className="py-8 text-center text-sm text-slate-500">Nincs rögzített nyilatkozat</div>
            ) : (
              <div className="space-y-2">
                {declarations.map((d) => (
                  <div key={d.id} className={cn(
                    'p-4 rounded-lg border flex items-center justify-between transition-colors',
                    d.status === 'revoked'
                      ? 'border-border/50 opacity-60'
                      : 'border-border hover:border-primary/30'
                  )}>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                          {DECLARATION_TYPES.find(t => t.value === d.declaration_type)?.label || d.declaration_type.replace(/_/g, ' ')}
                        </p>
                        <span className={cn(
                          'px-2 py-0.5 rounded-full text-[10px] font-bold uppercase',
                          d.status === 'active' ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400' :
                          d.status === 'revoked' ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400' :
                          'bg-slate-100 text-slate-600 dark:bg-slate-800'
                        )}>
                          {d.status === 'active' ? 'Aktív' : d.status === 'revoked' ? 'Visszavont' : d.status === 'expired' ? 'Lejárt' : d.status}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Érvényes: {d.valid_from}{d.valid_until ? ` – ${d.valid_until}` : ' –'}
                        {d.declaration_type === 'family' && (d.parameters as any)?.children_count && (
                          <span className="ml-2">· {(d.parameters as any).children_count} eltartott</span>
                        )}
                      </p>
                    </div>
                    {d.status === 'active' && (
                      <div className="flex items-center gap-1 ml-3">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-slate-400 hover:text-primary"
                          title="Szerkesztés"
                          onClick={() => setEditingDeclaration(d)}
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-slate-400 hover:text-red-500"
                          title="Visszavonás"
                          disabled={revokeDeclaration.isPending}
                          onClick={() => {
                            if (window.confirm('Biztosan visszavonod ezt a nyilatkozatot?')) {
                              revokeDeclaration.mutate({ id: d.id, employee_id: empId || '' });
                            }
                          }}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    )}
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

        {/* Salary history */}
        {activeTab === 'salary' && (
          <SalaryHistoryTab employmentId={primaryEmployment?.id || ''} />
        )}

        {/* Documents */}
        {activeTab === 'documents' && (
          <div className="p-6 py-16 text-center text-sm text-slate-500">
            <FileText className="w-10 h-10 mx-auto mb-3 text-slate-300" />
            Dokumentumok kezelése hamarosan elérhető.
          </div>
        )}
      </div>
    </div>
  );
}
