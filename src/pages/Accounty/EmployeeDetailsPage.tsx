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
import { DECLARATION_TYPES, NewDeclarationDialog, EditDeclarationDialog } from './employee-details/DeclarationDialogs';
import SalaryHistoryTab from './employee-details/SalaryHistoryTab';

// â”€â”€ Tab dÃ©finÃ­ciÃ³k â”€â”€
const TABS = [
  { id: 'overview', title: 'ÃttekintÃ©s', icon: User },
  { id: 'employments', title: 'Jogviszonyok', icon: Briefcase },
  { id: 'declarations', title: 'Nyilatkozatok', icon: FileText },
  { id: 'leave', title: 'SzabadsÃ¡g', icon: Calendar },
  { id: 'garnishments', title: 'LetiltÃ¡sok', icon: Shield },
  { id: 'salary', title: 'BÃ©relÅ‘zmÃ©nyek', icon: Banknote },
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
    return <AccountyErrorState message="Nem sikerÃ¼lt betÃ¶lteni a foglalkoztatott adatait." onRetry={() => refetchEmp()} />;
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
        <p className="text-slate-500">Foglalkoztatott nem talÃ¡lhatÃ³</p>
      </div>
    );
  }

  const statusLabel: Record<string, string> = {
    active: 'AktÃ­v', pending: 'FÃ¼ggÅ‘', terminated: 'KilÃ©pett', suspended: 'SzÃ¼netelÅ‘',
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
              <X className="w-4 h-4" /> MÃ©gse
            </Button>
            <Button onClick={saveEditing} disabled={updateEmployee.isPending} className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white">
              {updateEmployee.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              MentÃ©s
            </Button>
          </div>
        ) : (
          <Button variant="outline" className="flex items-center gap-2" onClick={startEditing}>
            <Edit3 className="w-4 h-4" /> SzerkesztÃ©s
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
          <div className="p-6 space-y-6">
            {isEditing ? (
              /* â”€â”€ EDIT MODE â”€â”€ */
              <div className="space-y-6">
                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3 flex items-center gap-2">
                  <Edit3 className="w-4 h-4 text-amber-600" />
                  <span className="text-sm text-amber-700 dark:text-amber-400 font-medium">SzerkesztÃ©s mÃ³d â€” mÃ³dosÃ­tsd az adatokat, majd kattints a MentÃ©s gombra</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  <InfoSection title="SzemÃ©lyes adatok">
                    <EditField label="VezetÃ©knÃ©v" value={editForm.last_name || ''} onChange={v => setEditForm(f => ({ ...f, last_name: v }))} required />
                    <EditField label="KeresztnÃ©v" value={editForm.first_name || ''} onChange={v => setEditForm(f => ({ ...f, first_name: v }))} required />
                    <EditField label="SzÃ¼letÃ©si nÃ©v" value={editForm.birth_name || ''} onChange={v => setEditForm(f => ({ ...f, birth_name: v || null }))} />
                    <EditField label="SzÃ¼letÃ©si hely" value={editForm.birth_place || ''} onChange={v => setEditForm(f => ({ ...f, birth_place: v || null }))} />
                    <EditField label="SzÃ¼letÃ©si dÃ¡tum" value={editForm.birth_date || ''} onChange={v => setEditForm(f => ({ ...f, birth_date: v || null }))} type="date" />
                    <EditField label="Anyja neve" value={editForm.mothers_name || ''} onChange={v => setEditForm(f => ({ ...f, mothers_name: v || null }))} />
                  </InfoSection>

                  <InfoSection title="ElÃ©rhetÅ‘sÃ©g">
                    <EditField label="E-mail" value={editForm.email || ''} onChange={v => setEditForm(f => ({ ...f, email: v || null }))} type="email" />
                    <EditField label="Telefon" value={editForm.phone || ''} onChange={v => setEditForm(f => ({ ...f, phone: v || null }))} />
                  </InfoSection>

                  <InfoSection title="AzonosÃ­tÃ³k">
                    <EditField label="TAJ-szÃ¡m" value={editForm.taj_number || ''} onChange={v => setEditForm(f => ({ ...f, taj_number: v || null }))} placeholder="000-000-000" />
                    <EditField label="AdÃ³azonosÃ­tÃ³" value={editForm.tax_id || ''} onChange={v => setEditForm(f => ({ ...f, tax_id: v || null }))} placeholder="10 jegyÅ±" />
                    <EditField label="BankszÃ¡mla" value={editForm.bank_account || ''} onChange={v => setEditForm(f => ({ ...f, bank_account: v || null }))} placeholder="00000000-00000000-00000000" />
                  </InfoSection>
                </div>

                <div className="border-t border-border pt-4">
                  <InfoSection title="StÃ¡tusz">
                    <div>
                      <label className="block text-xs font-medium text-slate-500 mb-1.5">Foglalkoztatott stÃ¡tusza</label>
                      <select
                        value={editForm.status || 'active'}
                        onChange={e => setEditForm(f => ({ ...f, status: e.target.value as PayrollEmployee['status'] }))}
                        className="w-full max-w-xs px-3 py-2 rounded-lg border border-border bg-background text-sm"
                      >
                        <option value="active">AktÃ­v</option>
                        <option value="pending">FÃ¼ggÅ‘</option>
                        <option value="suspended">SzÃ¼netelÅ‘</option>
                        <option value="terminated">KilÃ©pett</option>
                      </select>
                    </div>
                  </InfoSection>
                </div>
              </div>
            ) : (
              /* â”€â”€ VIEW MODE â”€â”€ */
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  <InfoSection title="SzemÃ©lyes adatok">
                    <InfoRow icon={User} label="SzÃ¼letÃ©si nÃ©v" value={employee.birth_name || 'â€“'} />
                    <InfoRow icon={MapPin} label="SzÃ¼letÃ©si hely" value={employee.birth_place || 'â€“'} />
                    <InfoRow icon={Calendar} label="SzÃ¼letÃ©si dÃ¡tum" value={employee.birth_date || 'â€“'} />
                    <InfoRow icon={User} label="Anyja neve" value={employee.mothers_name || 'â€“'} />
                  </InfoSection>

                  <InfoSection title="ElÃ©rhetÅ‘sÃ©g">
                    <InfoRow icon={Mail} label="E-mail" value={employee.email || 'â€“'} />
                    <InfoRow icon={Phone} label="Telefon" value={employee.phone || 'â€“'} />
                  </InfoSection>

                  <InfoSection title="AzonosÃ­tÃ³k">
                    <InfoRow icon={Shield} label="TAJ-szÃ¡m" value={employee.taj_number ? formatTajNumber(employee.taj_number) : 'â€“'} />
                    <InfoRow icon={FileText} label="AdÃ³azonosÃ­tÃ³" value={employee.tax_id || 'â€“'} />
                    <InfoRow icon={CreditCard} label="BankszÃ¡mla" value={employee.bank_account ? formatBankAccount(employee.bank_account) : 'â€“'} />
                  </InfoSection>
                </div>

                {/* Leave quick view */}
                {leaveBalance && (
                  <div className="border-t border-border pt-6">
                    <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-3">SzabadsÃ¡g mÃ©rleg ({new Date().getFullYear()})</h3>
                    <div className="grid grid-cols-4 gap-3">
                      <MiniStat label="Ã‰ves keret" value={`${leaveBalance.totalAnnual} nap`} />
                      <MiniStat label="FelhasznÃ¡lt" value={`${leaveBalance.used} nap`} />
                      <MiniStat label="FennmaradÃ³" value={`${leaveBalance.remaining} nap`} color={leaveBalance.remaining < 5 ? 'red' : 'green'} />
                      <MiniStat label="Ã‰letkori pÃ³tlÃ©k" value={`+${leaveBalance.ageSupplement} nap`} />
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Employments */}
        {activeTab === 'employments' && (
          <div className="p-6">
            {employments.length === 0 ? (
              <div className="py-8 text-center text-sm text-slate-500">Nincs rÃ¶gzÃ­tett jogviszony</div>
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
                        {emp.status === 'active' ? 'AktÃ­v' : emp.status}
                      </span>
                    </div>
                    <div className="flex items-center justify-between mt-3 pt-2 border-t border-border/50">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs text-slate-500 dark:text-slate-400 flex-1">
                        <span>KezdÃ©s: {emp.start_date}</span>
                        <span>MunkakÃ¶r: {emp.job_title || 'â€“'}</span>
                        <span>FEOR: {emp.feor_code || 'â€“'}</span>
                        <span>AlapbÃ©r: {emp.base_salary ? formatAmount(emp.base_salary) : 'â€“'}</span>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex items-center gap-1.5 text-xs ml-4 shrink-0"
                        onClick={() => navigate(`/accounty/payroll/${companyId}/employees/${empId}/modification`)}
                      >
                        <Edit3 className="w-3 h-3" /> MÃ³dosÃ­tÃ¡s
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Quick action buttons */}
            <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-border/50">
              <Button
                variant="outline"
                size="sm"
                className="flex items-center gap-1.5 text-xs"
                onClick={() => navigate(`/accounty/payroll/${companyId}/employees/${empId}/multi-job`)}
              >
                <Users className="w-3 h-3" /> TÃ¶bb jogviszony
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="flex items-center gap-1.5 text-xs"
                onClick={() => navigate(`/accounty/payroll/${companyId}/employees/${empId}/exit`)}
              >
                <LogOut className="w-3 h-3" /> KilÃ©pÃ©s indÃ­tÃ¡sa
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="flex items-center gap-1.5 text-xs"
                onClick={() => navigate(`/accounty/payroll/${companyId}/employees/${empId}/exit-docs`)}
              >
                <FolderOpen className="w-3 h-3" /> KilÃ©pÅ‘ dokumentumok
              </Button>
            </div>
          </div>
        )}

        {/* Declarations */}
        {activeTab === 'declarations' && (
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300">AdÃ³elÅ‘leg-nyilatkozatok</h3>
              <Button variant="outline" size="sm" className="flex items-center gap-1" onClick={() => setShowNewDeclaration(true)}>
                <Plus className="w-3 h-3" /> Ãšj nyilatkozat
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
              <div className="py-8 text-center text-sm text-slate-500">Nincs rÃ¶gzÃ­tett nyilatkozat</div>
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
                          {d.status === 'active' ? 'AktÃ­v' : d.status === 'revoked' ? 'Visszavont' : d.status === 'expired' ? 'LejÃ¡rt' : d.status}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Ã‰rvÃ©nyes: {d.valid_from}{d.valid_until ? ` â€“ ${d.valid_until}` : ' â€“'}
                        {d.declaration_type === 'family' && (d.parameters as any)?.children_count && (
                          <span className="ml-2">Â· {(d.parameters as any).children_count} eltartott</span>
                        )}
                      </p>
                    </div>
                    {d.status === 'active' && (
                      <div className="flex items-center gap-1 ml-3">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-slate-400 hover:text-primary"
                          title="SzerkesztÃ©s"
                          onClick={() => setEditingDeclaration(d)}
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-slate-400 hover:text-red-500"
                          title="VisszavonÃ¡s"
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
                <MiniStat label="Alap-szabadsÃ¡g" value={`${leaveBalance.baseLeave} nap`} />
                <MiniStat label="Ã‰letkori pÃ³tlÃ©k" value={`+${leaveBalance.ageSupplement} nap`} />
                <MiniStat label="Gyermek pÃ³tlÃ©k" value={`+${leaveBalance.childSupplement} nap`} />
                <MiniStat label="FelhasznÃ¡lt" value={`${leaveBalance.used} nap`} />
                <MiniStat label="FennmaradÃ³" value={`${leaveBalance.remaining} nap`} color={leaveBalance.remaining < 5 ? 'red' : 'green'} />
              </div>
            )}

            {leaves.length === 0 ? (
              <div className="py-8 text-center text-sm text-slate-500">Nincs rÃ¶gzÃ­tett tÃ¡vollÃ©t</div>
            ) : (
              <div className="space-y-2">
                {leaves.map((l) => (
                  <div key={l.id} className="p-3 rounded-lg border border-border flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 capitalize">
                        {l.leave_type.replace(/_/g, ' ')}
                      </p>
                      <p className="text-xs text-slate-500">{l.start_date} â€“ {l.end_date} Â· {l.days} nap</p>
                    </div>
                    <span className={cn(
                      'px-2 py-0.5 rounded-full text-[10px] font-bold uppercase',
                      l.status === 'approved' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                    )}>
                      {l.status === 'approved' ? 'JÃ³vÃ¡hagyva' : l.status}
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
              <div className="py-8 text-center text-sm text-slate-500">Nincs aktÃ­v letiltÃ¡s</div>
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
                      <span>HitelezÅ‘: {g.creditor_name || 'â€“'}</span>
                      <span>FennmaradÃ³: {g.remaining_amount ? formatAmount(g.remaining_amount) : 'â€“'}</span>
                      <span>Havi: {g.monthly_deduction ? formatAmount(g.monthly_deduction) : 'â€“'}</span>
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
            Dokumentumok kezelÃ©se hamarosan elÃ©rhetÅ‘.
          </div>
        )}
      </div>
    </div>
}

