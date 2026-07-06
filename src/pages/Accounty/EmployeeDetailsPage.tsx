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
import { EmployeeDeclarationsTab } from './employee-details/EmployeeDeclarationsTab';
import { EmployeeLeaveTab } from './employee-details/EmployeeLeaveTab';
import { EmployeeGarnishmentsTab } from './employee-details/EmployeeGarnishmentsTab';
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

        {activeTab === 'leave' && (
          <EmployeeLeaveTab leaves={leaves} leaveBalance={leaveBalance} />
        )}

        {activeTab === 'garnishments' && (
          <EmployeeGarnishmentsTab garnishments={garnishments} />
        )}

        {activeTab === 'salary' && (
          <SalaryHistoryTab employmentId={primaryEmployment?.id || ''} />
        )}

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
