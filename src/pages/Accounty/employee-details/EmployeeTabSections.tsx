import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  User, Calendar, CreditCard, FileText, Shield,
  Edit3, Mail, Phone, MapPin, Users, LogOut, FolderOpen,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { type PayrollEmployee } from '@/hooks/usePayrollData';
import { formatTajNumber, formatBankAccount, formatAmount } from '@/lib/payroll/validators';
import type { LeaveBalance } from '@/lib/payroll/leaveCalculator';
import { InfoSection, InfoRow, EditField, MiniStat } from './EmployeeHelpers';


// ── Overview Tab: View + Edit Mode ──
interface OverviewTabProps {
  employee: PayrollEmployee;
  isEditing: boolean;
  editForm: Partial<PayrollEmployee>;
  setEditForm: React.Dispatch<React.SetStateAction<Partial<PayrollEmployee>>>;
  leaveBalance: LeaveBalance | null;
}

export function EmployeeOverviewTab({ employee, isEditing, editForm, setEditForm, leaveBalance }: OverviewTabProps) {
  return (
    <div className="p-6 space-y-6">
      {isEditing ? (
        /* ── EDIT MODE ── */
        <div className="space-y-6">
          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3 flex items-center gap-2">
            <Edit3 className="w-4 h-4 text-amber-600" />
            <span className="text-sm text-amber-700 dark:text-amber-400 font-medium">Szerkesztés mód – módosítsd az adatokat, majd kattints a Mentés gombra</span>
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
  );
}


// ── Employments Tab ──
interface EmploymentsTabProps {
  employments: Array<{
    id: string;
    employment_type: string;
    job_code: string;
    status: string;
    start_date: string;
    job_title: string | null;
    feor_code: string | null;
    base_salary: number | null;
  }>;
  companyId: string;
  empId: string;
}

export function EmployeeEmploymentsTab({ employments, companyId, empId }: EmploymentsTabProps) {
  const navigate = useNavigate();

  return (
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
        <Button variant="outline" size="sm" className="flex items-center gap-1.5 text-xs" onClick={() => navigate(`/accounty/payroll/${companyId}/employees/${empId}/multi-job`)}>
          <Users className="w-3 h-3" /> Több jogviszony
        </Button>
        <Button variant="outline" size="sm" className="flex items-center gap-1.5 text-xs" onClick={() => navigate(`/accounty/payroll/${companyId}/employees/${empId}/exit`)}>
          <LogOut className="w-3 h-3" /> Kilépés indítása
        </Button>
        <Button variant="outline" size="sm" className="flex items-center gap-1.5 text-xs" onClick={() => navigate(`/accounty/payroll/${companyId}/employees/${empId}/exit-docs`)}>
          <FolderOpen className="w-3 h-3" /> Kilépő dokumentumok
        </Button>
      </div>
    </div>
  );
}
