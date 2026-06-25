import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, User, Briefcase, CreditCard, Calendar, FileText,
  Shield, Clock, ChevronRight, Edit3, Trash2, Plus, Check, X,
  Mail, Phone, MapPin, Banknote, AlertTriangle, Save, Loader2,
  Users, LogOut, FolderOpen
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  usePayrollEmployee, usePayrollEmployments, usePayrollDeclarations,
  usePayrollLeaves, usePayrollGarnishments, useEmployeeSalaryHistory,
  useAddDeclaration, useUpdateDeclaration, useRevokeDeclaration,
  useUpdateEmployee,
  type PayrollDeclaration, type PayrollEmployee
} from '@/hooks/usePayrollData';
import { formatTajNumber, formatBankAccount, formatAmount } from '@/lib/payroll/validators';
import { calculateLeaveBalance, type EmployeeLeaveInput } from '@/lib/payroll/leaveCalculator';
import { useToast } from '@/hooks/use-toast';
import { AccountyErrorState } from '@/components/accounty/AccountyErrorState';

// ── Declaration types (must match DB CHECK constraint) ──
const DECLARATION_TYPES = [
  { value: 'family', label: 'Családi kedvezmény' },
  { value: 'first_marriage', label: 'Első házasok kedvezménye' },
  { value: 'young_25', label: '25 év alattiak SZJA mentessége' },
  { value: 'young_mother_30', label: '30 év alatti anyák kedvezménye' },
  { value: 'netak', label: 'Négy vagy több gyermekes anyák (NÉTAK)' },
  { value: 'anyak_3', label: '3 gyermekes anyák kedvezménye' },
  { value: 'anyak_2', label: '2 gyermekes anyák kedvezménye (40 év alatt)' },
  { value: 'anyacska', label: 'Összevont anyák + családi (2026)' },
  { value: 'personal', label: 'Személyi kedvezmény (fogyatékosság)' },
  { value: 'ekho', label: 'EKHO nyilatkozat' },
] as const;

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
          <div className="p-6 space-y-6">
            {isEditing ? (
              /* ── EDIT MODE ── */
              <div className="space-y-6">
                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3 flex items-center gap-2">
                  <Edit3 className="w-4 h-4 text-amber-600" />
                  <span className="text-sm text-amber-700 dark:text-amber-400 font-medium">Szerkesztés mód — módosítsd az adatokat, majd kattints a Mentés gombra</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  <InfoSection title="Személyes adatok">
                    <EditField label="Vezetéknév" value={editForm.last_name || ''} onChange={v => setEditForm(f => ({ ...f, last_name: v }))} required />
                    <EditField label="Keresztnév" value={editForm.first_name || ''} onChange={v => setEditForm(f => ({ ...f, first_name: v }))} required />
                    <EditField label="Születési név" value={editForm.birth_name || ''} onChange={v => setEditForm(f => ({ ...f, birth_name: v || null }))} />
                    <EditField label="Születési hely" value={editForm.birth_place || ''} onChange={v => setEditForm(f => ({ ...f, birth_place: v || null }))} />
                    <EditField label="Születési dátum" value={editForm.birth_date || ''} onChange={v => setEditForm(f => ({ ...f, birth_date: v || null }))} type="date" />
                    <EditField label="Anyja neve" value={editForm.mothers_name || ''} onChange={v => setEditForm(f => ({ ...f, mothers_name: v || null }))} />
                  </InfoSection>

                  <InfoSection title="Elérhetőség">
                    <EditField label="E-mail" value={editForm.email || ''} onChange={v => setEditForm(f => ({ ...f, email: v || null }))} type="email" />
                    <EditField label="Telefon" value={editForm.phone || ''} onChange={v => setEditForm(f => ({ ...f, phone: v || null }))} />
                  </InfoSection>

                  <InfoSection title="Azonosítók">
                    <EditField label="TAJ-szám" value={editForm.taj_number || ''} onChange={v => setEditForm(f => ({ ...f, taj_number: v || null }))} placeholder="000-000-000" />
                    <EditField label="Adóazonosító" value={editForm.tax_id || ''} onChange={v => setEditForm(f => ({ ...f, tax_id: v || null }))} placeholder="10 jegyű" />
                    <EditField label="Bankszámla" value={editForm.bank_account || ''} onChange={v => setEditForm(f => ({ ...f, bank_account: v || null }))} placeholder="00000000-00000000-00000000" />
                  </InfoSection>
                </div>

                <div className="border-t border-border pt-4">
                  <InfoSection title="Státusz">
                    <div>
                      <label className="block text-xs font-medium text-slate-500 mb-1.5">Foglalkoztatott státusza</label>
                      <select
                        value={editForm.status || 'active'}
                        onChange={e => setEditForm(f => ({ ...f, status: e.target.value as PayrollEmployee['status'] }))}
                        className="w-full max-w-xs px-3 py-2 rounded-lg border border-border bg-background text-sm"
                      >
                        <option value="active">Aktív</option>
                        <option value="pending">Függő</option>
                        <option value="suspended">Szünetelő</option>
                        <option value="terminated">Kilépett</option>
                      </select>
                    </div>
                  </InfoSection>
                </div>
              </div>
            ) : (
              /* ── VIEW MODE ── */
              <>
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
              </>
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
                    <div className="flex items-center justify-between mt-3 pt-2 border-t border-border/50">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs text-slate-500 dark:text-slate-400 flex-1">
                        <span>Kezdés: {emp.start_date}</span>
                        <span>Munkakör: {emp.job_title || '–'}</span>
                        <span>FEOR: {emp.feor_code || '–'}</span>
                        <span>Alapbér: {emp.base_salary ? formatAmount(emp.base_salary) : '–'}</span>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex items-center gap-1.5 text-xs ml-4 shrink-0"
                        onClick={() => navigate(`/accounty/payroll/${companyId}/employees/${empId}/modification`)}
                      >
                        <Edit3 className="w-3 h-3" /> Módosítás
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
                <Users className="w-3 h-3" /> Több jogviszony
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="flex items-center gap-1.5 text-xs"
                onClick={() => navigate(`/accounty/payroll/${companyId}/employees/${empId}/exit`)}
              >
                <LogOut className="w-3 h-3" /> Kilépés indítása
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="flex items-center gap-1.5 text-xs"
                onClick={() => navigate(`/accounty/payroll/${companyId}/employees/${empId}/exit-docs`)}
              >
                <FolderOpen className="w-3 h-3" /> Kilépő dokumentumok
              </Button>
            </div>
          </div>
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

function EditField({ label, value, onChange, type = 'text', placeholder, required }: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        className="w-full px-3 py-1.5 rounded-lg border border-border bg-background text-sm focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none transition-all"
      />
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

const MONTHS_HU = [
  'Január', 'Február', 'Március', 'Április', 'Május', 'Június',
  'Július', 'Augusztus', 'Szeptember', 'Október', 'November', 'December',
];

function SalaryHistoryTab({ employmentId }: { employmentId: string }) {
  const { data: history = [], isLoading } = useEmployeeSalaryHistory(employmentId);

  if (!employmentId) {
    return (
      <div className="p-6 py-12 text-center text-sm text-slate-500">
        Nincs aktív jogviszony a bérelőzmények megjelenítéséhez.
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="p-6 space-y-3">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-16 bg-slate-100 dark:bg-slate-800 rounded-lg animate-pulse" />
        ))}
      </div>
    );
  }

  if (history.length === 0) {
    return (
      <div className="p-6 py-12 text-center text-sm text-slate-500">
        <Banknote className="w-10 h-10 mx-auto mb-3 text-slate-300" />
        Még nincs számfejtett bérelőzmény ehhez a jogviszonyhoz.
      </div>
    );
  }

  return (
    <div className="p-6">
      <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-4">Bérelőzmények</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left py-2 px-3 text-xs font-semibold text-slate-500 uppercase">Időszak</th>
              <th className="text-right py-2 px-3 text-xs font-semibold text-slate-500 uppercase">Bruttó</th>
              <th className="text-right py-2 px-3 text-xs font-semibold text-slate-500 uppercase">SZJA</th>
              <th className="text-right py-2 px-3 text-xs font-semibold text-slate-500 uppercase">TB</th>
              <th className="text-right py-2 px-3 text-xs font-semibold text-slate-500 uppercase">Nettó</th>
              <th className="text-center py-2 px-3 text-xs font-semibold text-slate-500 uppercase">Státusz</th>
            </tr>
          </thead>
          <tbody>
            {history.map((entry) => (
              <tr key={entry.id} className="border-b border-border/50 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                <td className="py-3 px-3 font-medium text-slate-900 dark:text-slate-100">
                  {entry.cycle_year}. {MONTHS_HU[(entry.cycle_month || 1) - 1]}
                </td>
                <td className="py-3 px-3 text-right font-mono text-slate-700 dark:text-slate-300">
                  {formatAmount(entry.gross_salary)}
                </td>
                <td className="py-3 px-3 text-right font-mono text-red-600 dark:text-red-400">
                  -{formatAmount(entry.szja_amount)}
                </td>
                <td className="py-3 px-3 text-right font-mono text-red-600 dark:text-red-400">
                  -{formatAmount(entry.tb_amount)}
                </td>
                <td className="py-3 px-3 text-right font-mono font-bold text-slate-900 dark:text-slate-100">
                  {formatAmount(entry.net_salary)}
                </td>
                <td className="py-3 px-3 text-center">
                  <span className={cn(
                    'px-2 py-0.5 rounded-full text-[10px] font-bold uppercase',
                    entry.cycle_status === 'closed' ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400' :
                    entry.cycle_status === 'approved' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400' :
                    'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400'
                  )}>
                    {entry.cycle_status === 'closed' ? 'Lezárt' :
                     entry.cycle_status === 'approved' ? 'Jóváhagyott' :
                     entry.cycle_status === 'draft' ? 'Tervezet' : entry.cycle_status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Summary */}
      {history.length > 0 && (
        <div className="mt-4 pt-4 border-t border-border grid grid-cols-2 md:grid-cols-4 gap-3">
          <MiniStat
            label="Össz. bruttó"
            value={`${formatAmount(history.reduce((s, e) => s + e.gross_salary, 0))}`}
          />
          <MiniStat
            label="Össz. SZJA"
            value={`${formatAmount(history.reduce((s, e) => s + e.szja_amount, 0))}`}
            color="red"
          />
          <MiniStat
            label="Össz. TB"
            value={`${formatAmount(history.reduce((s, e) => s + e.tb_amount, 0))}`}
            color="red"
          />
          <MiniStat
            label="Össz. nettó"
            value={`${formatAmount(history.reduce((s, e) => s + e.net_salary, 0))}`}
            color="green"
          />
        </div>
      )}
    </div>
  );
}

// ── New Declaration Dialog ──

function NewDeclarationDialog({ employeeId, onClose }: { employeeId: string; onClose: () => void }) {
  const addDeclaration = useAddDeclaration();
  const [type, setType] = useState('family');
  const [validFrom, setValidFrom] = useState(new Date().toISOString().split('T')[0]);
  const [validUntil, setValidUntil] = useState('');
  const [childrenCount, setChildrenCount] = useState(1);

  const handleSubmit = () => {
    const params: Record<string, unknown> = {};
    if (type === 'family') {
      params.children_count = childrenCount;
    }

    addDeclaration.mutate({
      employee_id: employeeId,
      declaration_type: type,
      valid_from: validFrom,
      valid_until: validUntil || undefined,
      parameters: params,
    }, {
      onSuccess: () => onClose(),
    });
  };

  return (
    <div className="mb-6 p-5 rounded-xl border-2 border-primary/30 bg-primary/5 dark:bg-primary/10 space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">Új adóelőleg-nyilatkozat</h4>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
          <X className="w-4 h-4" />
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Declaration type */}
        <div className="md:col-span-2">
          <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">Nyilatkozat típusa</label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none transition-all appearance-none bg-[length:16px_16px] bg-[right_10px_center] bg-no-repeat"
            style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")` }}
          >
            {DECLARATION_TYPES.map((dt) => (
              <option key={dt.value} value={dt.value}>{dt.label}</option>
            ))}
          </select>
        </div>

        {/* Children count (only for family credit) */}
        {type === 'family' && (
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">Eltartottak száma</label>
            <select
              value={childrenCount}
              onChange={(e) => setChildrenCount(Number(e.target.value))}
              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none transition-all appearance-none bg-[length:16px_16px] bg-[right_10px_center] bg-no-repeat"
            style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")` }}
            >
              {[1, 2, 3, 4, 5, 6, 7, 8].map(n => (
                <option key={n} value={n}>{n} {n === 1 ? 'gyermek' : 'gyermek'}</option>
              ))}
            </select>
          </div>
        )}

        {/* Valid from */}
        <div>
          <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">Érvényes ettől</label>
          <input
            type="date"
            value={validFrom}
            onChange={(e) => setValidFrom(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none transition-all"
          />
        </div>

        {/* Valid until */}
        <div>
          <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">Érvényes eddig (opcionális)</label>
          <input
            type="date"
            value={validUntil}
            onChange={(e) => setValidUntil(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none transition-all"
          />
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button variant="ghost" size="sm" onClick={onClose}>
          Mégse
        </Button>
        <Button
          size="sm"
          onClick={handleSubmit}
          disabled={addDeclaration.isPending || !validFrom}
          className="flex items-center gap-1"
        >
          <Check className="w-3 h-3" />
          {addDeclaration.isPending ? 'Mentés...' : 'Mentés'}
        </Button>
      </div>
    </div>
  );
}

// ── Edit Declaration Dialog ──

const selectClassName = "w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none transition-all appearance-none bg-[length:16px_16px] bg-[right_10px_center] bg-no-repeat";
const selectStyle = { backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")` };

function EditDeclarationDialog({
  declaration,
  employeeId,
  onClose,
}: {
  declaration: PayrollDeclaration;
  employeeId: string;
  onClose: () => void;
}) {
  const updateDeclaration = useUpdateDeclaration();
  const [type, setType] = useState(declaration.declaration_type);
  const [validFrom, setValidFrom] = useState(declaration.valid_from);
  const [validUntil, setValidUntil] = useState(declaration.valid_until || '');
  const [childrenCount, setChildrenCount] = useState(
    (declaration.parameters as any)?.children_count || 1
  );

  const handleSubmit = () => {
    const params: Record<string, unknown> = { ...(declaration.parameters as Record<string, unknown>) };
    if (type === 'family') {
      params.children_count = childrenCount;
    }

    updateDeclaration.mutate({
      id: declaration.id,
      employee_id: employeeId,
      declaration_type: type,
      valid_from: validFrom,
      valid_until: validUntil || null,
      parameters: params,
    }, {
      onSuccess: () => onClose(),
    });
  };

  return (
    <div className="mb-6 p-5 rounded-xl border-2 border-amber-500/30 bg-amber-500/5 dark:bg-amber-500/10 space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
          <Edit3 className="w-4 h-4 text-amber-500" />
          Nyilatkozat szerkesztése
        </h4>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
          <X className="w-4 h-4" />
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Declaration type (read-only) */}
        <div className="md:col-span-2">
          <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">Nyilatkozat típusa</label>
          <div className="w-full px-3 py-2 rounded-lg border border-border bg-slate-100 dark:bg-slate-800 text-sm text-slate-600 dark:text-slate-300 cursor-not-allowed">
            {DECLARATION_TYPES.find(t => t.value === type)?.label || type}
          </div>
        </div>

        {/* Children count (only for family credit) */}
        {type === 'family' && (
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">Eltartottak száma</label>
            <select value={childrenCount} onChange={(e) => setChildrenCount(Number(e.target.value))} className={selectClassName} style={selectStyle}>
              {[1, 2, 3, 4, 5, 6, 7, 8].map(n => (
                <option key={n} value={n}>{n} gyermek</option>
              ))}
            </select>
          </div>
        )}

        {/* Valid from */}
        <div>
          <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">Érvényes ettől</label>
          <input
            type="date"
            value={validFrom}
            onChange={(e) => setValidFrom(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none transition-all"
          />
        </div>

        {/* Valid until */}
        <div>
          <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">Érvényes eddig (opcionális)</label>
          <input
            type="date"
            value={validUntil}
            onChange={(e) => setValidUntil(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none transition-all"
          />
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button variant="ghost" size="sm" onClick={onClose}>
          Mégse
        </Button>
        <Button
          size="sm"
          onClick={handleSubmit}
          disabled={updateDeclaration.isPending || !validFrom}
          className="flex items-center gap-1 bg-amber-600 hover:bg-amber-700"
        >
          <Check className="w-3 h-3" />
          {updateDeclaration.isPending ? 'Mentés...' : 'Módosítás mentése'}
        </Button>
      </div>
    </div>
  );
}
