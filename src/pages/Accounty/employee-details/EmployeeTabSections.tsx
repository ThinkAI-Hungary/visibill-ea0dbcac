import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  User, Calendar, CreditCard, FileText, Shield,
  Edit3, Mail, Phone, MapPin, Users, LogOut, FolderOpen,
  Settings, Check, X, Loader2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { type PayrollEmployee, type PayrollEmployment, useUpdateEmployment } from '@/hooks/usePayrollData';
import { formatTajNumber, formatBankAccount, formatAmount, formatTajNumberOnType, formatBankAccountOnType } from '@/lib/payroll/validators';
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

            <InfoSection title="Elérhetőség & Cím">
              <EditField label="E-mail" value={editForm.email || ''} onChange={v => setEditForm(f => ({ ...f, email: v || null }))} type="email" />
              <EditField label="Telefon" value={editForm.phone || ''} onChange={v => setEditForm(f => ({ ...f, phone: v || null }))} />
              <div className="flex items-center gap-2 mt-3 p-2 border rounded-lg bg-slate-50 dark:bg-slate-900/30">
                <input
                  type="checkbox"
                  id="has_no_hungarian_address"
                  checked={!!editForm.has_no_hungarian_address}
                  onChange={e => setEditForm(f => ({ ...f, has_no_hungarian_address: e.target.checked }))}
                  className="w-4 h-4 rounded border-slate-300"
                />
                <label htmlFor="has_no_hungarian_address" className="text-xs font-medium text-slate-700 dark:text-slate-300">Nincs magyar lakcíme</label>
              </div>
            </InfoSection>

            <InfoSection title="Azonosítók & Egyedi mezők">
              <EditField label="TAJ-szám" value={editForm.taj_number || ''} onChange={v => setEditForm(f => ({ ...f, taj_number: formatTajNumberOnType(v) || null }))} placeholder="000-000-000" />
              <EditField label="Adóazonosító" value={editForm.tax_id || ''} onChange={v => setEditForm(f => ({ ...f, tax_id: v || null }))} placeholder="10 jegyű" />
              <EditField label="EU adóazonosító" value={editForm.eu_tax_id || ''} onChange={v => setEditForm(f => ({ ...f, eu_tax_id: v || null }))} placeholder="Foreign EU tax ID" />
              <EditField label="Bankszámla" value={editForm.bank_account || ''} onChange={v => setEditForm(f => ({ ...f, bank_account: formatBankAccountOnType(v) || null }))} placeholder="00000000-00000000-00000000" />
              
              <div className="mt-3">
                <label className="block text-xs font-medium text-slate-500 mb-1">Végzettség</label>
                <select
                  value={editForm.education_level || 'none'}
                  onChange={e => setEditForm(f => ({ ...f, education_level: e.target.value }))}
                  className="w-full px-3 py-1.5 rounded-lg border border-border bg-background text-sm"
                >
                  <option value="none">Nincs megadva</option>
                  <option value="primary">Általános iskola</option>
                  <option value="secondary">Középiskola</option>
                  <option value="professional">Szakiskola</option>
                  <option value="university">Főiskola/Egyetem</option>
                </select>
              </div>

              <div className="flex flex-col gap-2 mt-3">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="has_age_concession"
                    checked={!!editForm.has_age_concession}
                    onChange={e => setEditForm(f => ({ ...f, has_age_concession: e.target.checked }))}
                    className="w-4 h-4 rounded border-slate-300"
                  />
                  <label htmlFor="has_age_concession" className="text-xs font-medium text-slate-700 dark:text-slate-300">Korkedvezmény</label>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="has_union_fee"
                    checked={!!editForm.has_union_fee}
                    onChange={e => setEditForm(f => ({ ...f, has_union_fee: e.target.checked }))}
                    className="w-4 h-4 rounded border-slate-300"
                  />
                  <label htmlFor="has_union_fee" className="text-xs font-medium text-slate-700 dark:text-slate-300">Szakszervezeti tagdíj</label>
                </div>
              </div>
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
              <InfoRow icon={FileText} label="Végzettség" value={employee.education_level || '–'} />
            </InfoSection>

            <InfoSection title="Elérhetőség & Cím">
              <InfoRow icon={Mail} label="E-mail" value={employee.email || '–'} />
              <InfoRow icon={Phone} label="Telefon" value={employee.phone || '–'} />
              <InfoRow icon={MapPin} label="Cím státusz" value={employee.has_no_hungarian_address ? 'Nincs magyar címe' : 'Magyar lakcímmel'} />
            </InfoSection>

            <InfoSection title="Azonosítók & Jogok">
              <InfoRow icon={Shield} label="TAJ-szám" value={employee.taj_number ? formatTajNumber(employee.taj_number) : '–'} />
              <InfoRow icon={FileText} label="Adóazonosító" value={employee.tax_id || '–'} />
              {employee.eu_tax_id && <InfoRow icon={FileText} label="EU adóazonosító" value={employee.eu_tax_id} />}
              <InfoRow icon={CreditCard} label="Bankszámla" value={employee.bank_account ? formatBankAccount(employee.bank_account) : '–'} />
              <InfoRow icon={Shield} label="Korkedvezmény" value={employee.has_age_concession ? 'Igen' : 'Nem'} />
              <InfoRow icon={Users} label="Szakszervezet" value={employee.has_union_fee ? 'Tag (tagdíjlevonás)' : 'Nem tag'} />
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
  employments: PayrollEmployment[];
  companyId: string;
  empId: string;
}

export function EmployeeEmploymentsTab({ employments, companyId, empId }: EmploymentsTabProps) {
  const navigate = useNavigate();
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [form, setForm] = React.useState<Partial<PayrollEmployment>>({});
  const updateEmployment = useUpdateEmployment();

  const handleEditClick = (emp: PayrollEmployment) => {
    setEditingId(emp.id);
    setForm({
      id: emp.id,
      is_pensioner: !!emp.is_pensioner,
      pension_type: emp.pension_type || 'none',
      is_ekho: !!emp.is_ekho,
      ekho_payer: emp.ekho_payer || 'employee',
      ekho_category: emp.ekho_category || 'normal',
      is_szocho_discount: !!emp.is_szocho_discount,
      szocho_discount_type: emp.szocho_discount_type || 'none',
      szocho_discount_months_elapsed: emp.szocho_discount_start 
        ? Math.max(0, (new Date().getFullYear() - new Date(emp.szocho_discount_start).getFullYear()) * 12 + (new Date().getMonth() - new Date(emp.szocho_discount_start).getMonth()))
        : 0,
      minimum_contribution_base_rule: emp.minimum_contribution_base_rule || 'none',
      is_min_base_paid_elsewhere: !!emp.is_min_base_paid_elsewhere,
      other_company_name: emp.other_company_name || '',
      other_company_tax_number: emp.other_company_tax_number || '',
      is_min_base_exempt_gyes_gyed: !!emp.is_min_base_exempt_gyes_gyed,
      is_min_base_exempt_student: !!emp.is_min_base_exempt_student,
    });
  };

  const handleSave = async () => {
    if (!editingId) return;

    if (form.minimum_contribution_base_rule !== 'none' && form.is_min_base_paid_elsewhere) {
      if (!form.other_company_name?.trim() || !form.other_company_tax_number?.trim()) {
        alert('Kérjük, adja meg a másik cég nevét és adószámát!');
        return;
      }
    }

    try {
      await updateEmployment.mutateAsync({
        id: editingId,
        is_pensioner: form.is_pensioner,
        pension_type: form.is_pensioner ? form.pension_type : 'none',
        is_ekho: form.is_ekho,
        ekho_payer: form.is_ekho ? form.ekho_payer : 'employee',
        ekho_category: form.is_ekho ? form.ekho_category : 'normal',
        is_szocho_discount: form.is_szocho_discount,
        szocho_discount_type: form.is_szocho_discount ? form.szocho_discount_type : 'none',
        szocho_discount_start: form.is_szocho_discount 
          ? (() => {
              const months = Number(form.szocho_discount_months_elapsed) || 0;
              const d = new Date();
              d.setMonth(d.getMonth() - months);
              return d.toISOString().slice(0, 10);
            })()
          : null,
        szocho_discount_end: null,
        minimum_contribution_base_rule: form.minimum_contribution_base_rule || 'none',
        has_minimum_base: form.minimum_contribution_base_rule !== 'none',
        is_min_base_paid_elsewhere: form.is_min_base_paid_elsewhere,
        other_company_name: form.is_min_base_paid_elsewhere ? form.other_company_name : null,
        other_company_tax_number: form.is_min_base_paid_elsewhere ? form.other_company_tax_number : null,
        is_min_base_exempt_gyes_gyed: form.is_min_base_exempt_gyes_gyed,
        is_min_base_exempt_student: form.is_min_base_exempt_student,
      } as any);
      setEditingId(null);
    } catch {
      // hibaüzenet a hookban kezelve
    }
  };

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
                  <span>
                    Alapbér: {emp.base_salary ? `${formatAmount(emp.base_salary)} ${
                      emp.salary_type === 'hourly' ? '/ óra' : 
                      emp.salary_type === 'monthly' ? '/ hó' : 
                      emp.salary_type === 'daily' ? '/ nap' : 
                      emp.salary_type === 'weekly' ? '/ hét' : 
                      emp.salary_type === 'project' ? '/ projekt' : 
                      emp.salary_type === 'performance' ? '/ telj.' : 
                      `(${emp.salary_type})`
                    }` : '–'}
                  </span>
                </div>
                <div className="flex items-center gap-2 ml-4 shrink-0">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex items-center gap-1.5 text-xs bg-slate-50 dark:bg-slate-900"
                    onClick={() => handleEditClick(emp)}
                  >
                    <Settings className="w-3 h-3 text-slate-500" /> Adózás
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex items-center gap-1.5 text-xs"
                    onClick={() => navigate(`/accounty/payroll/${companyId}/employees/${empId}/modification`)}
                  >
                    <Edit3 className="w-3 h-3" /> Módosítás
                  </Button>
                </div>
              </div>

              {/* View Tax settings */}
              {editingId !== emp.id && (
                <div className="mt-3 pt-3 border-t border-border/40 grid grid-cols-1 md:grid-cols-2 gap-3 bg-slate-50/50 dark:bg-slate-900/10 p-3 rounded-lg text-xs">
                  <div>
                    <span className="font-bold text-slate-700 dark:text-slate-300">Minimális járulékalap szabály:</span>{' '}
                    <span className="text-slate-600 dark:text-slate-400">
                      {emp.minimum_contribution_base_rule === 'minimal_wage' 
                        ? 'Minimálbér' 
                        : emp.minimum_contribution_base_rule === 'guaranteed_minimum' 
                        ? 'Garantált bérminimum' 
                        : 'Nincs'}
                    </span>
                    {emp.minimum_contribution_base_rule && emp.minimum_contribution_base_rule !== 'none' && (
                      <div className="mt-1 pl-2 border-l border-border/60 space-y-0.5 text-[11px] text-slate-500">
                        <div>Máshol megfizetve: {emp.is_min_base_paid_elsewhere ? `Igen (${emp.other_company_name || '–'}, adószám: ${emp.other_company_tax_number || '–'})` : 'Nem'}</div>
                        {emp.is_min_base_exempt_gyes_gyed && <div>Mentesség: GYES/GYED</div>}
                        {emp.is_min_base_exempt_student && <div>Mentesség: Nappali tagozatos diák</div>}
                      </div>
                    )}
                  </div>
                  <div>
                    <span className="font-bold text-slate-700 dark:text-slate-300">Speciális adózás:</span>
                    <div className="mt-1 space-y-0.5 text-[11px] text-slate-600 dark:text-slate-400">
                      <div>Nyugdíjas: {emp.is_pensioner ? `Igen (${emp.pension_type === 'old_age' ? 'Öregségi' : emp.pension_type === 'rehab' ? 'Rehab' : emp.pension_type === 'disability' ? 'Rokkantsági' : 'Egyéb'})` : 'Nem'}</div>
                      <div>EKHO: {emp.is_ekho ? `Igen (Fizeti: ${emp.ekho_payer === 'employee' ? 'Dolgozó' : 'Munkáltató'}, kategória: ${emp.ekho_category === 'normal' ? 'Normál' : emp.ekho_category === 'athlete' ? 'Sportoló' : 'EGT'})` : 'Nem'}</div>
                      <div>SZOCHO kedvezmény: {emp.is_szocho_discount ? `Igen (${emp.szocho_discount_type === 'agriculture' ? 'Mezőgazdasági' : emp.szocho_discount_type === 'market_entry' ? 'Piacra lépő' : emp.szocho_discount_type === 'mother_market_entry' ? 'Anya piacra lépő' : emp.szocho_discount_type === 'fiatalkoru' ? '25 év alatti' : emp.szocho_discount_type === '55_feletti' ? '55 év feletti' : emp.szocho_discount_type === 'szakkepzetlen' ? 'Szakképzetlen (FEOR 9)' : 'PhD kutató'}, eltelt: ${emp.szocho_discount_start ? Math.max(0, (new Date().getFullYear() - new Date(emp.szocho_discount_start).getFullYear()) * 12 + (new Date().getMonth() - new Date(emp.szocho_discount_start).getMonth())) : 0} hó)` : 'Nem'}</div>
                    </div>
                  </div>
                </div>
              )}

              {/* Edit Tax form */}
              {editingId === emp.id && (
                <div className="mt-4 pt-4 border-t border-border/80 space-y-4 bg-slate-50/70 dark:bg-slate-900/20 p-4 rounded-xl border border-border animate-in slide-in-from-top-1 duration-200">
                  <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                    <Settings className="w-3.5 h-3.5 text-primary" /> Adózási és Járulékfizetési Beállítások Szerkesztése
                  </h4>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Minimális Járulékalap Szabály */}
                    <div className="p-3 border border-border bg-card rounded-lg space-y-3">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-500 mb-1">Minimális Járulékalap Szabály</label>
                        <select
                          value={form.minimum_contribution_base_rule || 'none'}
                          onChange={e => setForm(f => ({ ...f, minimum_contribution_base_rule: e.target.value }))}
                          className="w-full px-2 py-1 h-8 rounded border border-border bg-background text-xs"
                        >
                          <option value="none">Nincs szabály (tényleges bér alapján)</option>
                          <option value="minimal_wage">Minimálbér (Minimal Wage)</option>
                          <option value="guaranteed_minimum">Garantált bérminimum (Guaranteed Minimum)</option>
                        </select>
                      </div>

                      {form.minimum_contribution_base_rule !== 'none' && (
                        <div className="space-y-2 border-t border-border/60 pt-2 text-xs">
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              id="is_min_base_paid_elsewhere"
                              checked={!!form.is_min_base_paid_elsewhere}
                              onChange={e => setForm(f => ({ ...f, is_min_base_paid_elsewhere: e.target.checked }))}
                              className="w-3.5 h-3.5 rounded border-slate-300"
                            />
                            <label htmlFor="is_min_base_paid_elsewhere" className="font-semibold text-slate-700 dark:text-slate-300">
                              Máshol megfizették a járulékot
                            </label>
                          </div>

                          {form.is_min_base_paid_elsewhere && (
                            <div className="grid grid-cols-1 gap-2 pl-5 mt-1">
                              <div>
                                <label className="block text-[10px] text-slate-400">Másik cég neve *</label>
                                <input
                                  type="text"
                                  value={form.other_company_name || ''}
                                  onChange={e => setForm(f => ({ ...f, other_company_name: e.target.value }))}
                                  className="w-full px-2 py-1 h-7 rounded border border-border bg-background text-xs"
                                  placeholder="pl. Teszt Kft."
                                />
                              </div>
                              <div>
                                <label className="block text-[10px] text-slate-400">Másik cég adószáma *</label>
                                <input
                                  type="text"
                                  value={form.other_company_tax_number || ''}
                                  onChange={e => setForm(f => ({ ...f, other_company_tax_number: e.target.value }))}
                                  className="w-full px-2 py-1 h-7 rounded border border-border bg-background text-xs"
                                  placeholder="pl. 12345678-1-12"
                                />
                              </div>
                            </div>
                          )}

                          <div className="flex items-center gap-2 pt-1">
                            <input
                              type="checkbox"
                              id="is_min_base_exempt_gyes_gyed"
                              checked={!!form.is_min_base_exempt_gyes_gyed}
                              onChange={e => setForm(f => ({ ...f, is_min_base_exempt_gyes_gyed: e.target.checked }))}
                              className="w-3.5 h-3.5 rounded border-slate-300"
                            />
                            <label htmlFor="is_min_base_exempt_gyes_gyed" className="font-semibold text-slate-700 dark:text-slate-300">
                              GYES/GYED mentesség
                            </label>
                          </div>

                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              id="is_min_base_exempt_student"
                              checked={!!form.is_min_base_exempt_student}
                              onChange={e => setForm(f => ({ ...f, is_min_base_exempt_student: e.target.checked }))}
                              className="w-3.5 h-3.5 rounded border-slate-300"
                            />
                            <label htmlFor="is_min_base_exempt_student" className="font-semibold text-slate-700 dark:text-slate-300">
                              Nappali tagozatos tanuló mentesség
                            </label>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Nyugdíjas, EKHO, SZOCHO */}
                    <div className="p-3 border border-border bg-card rounded-lg space-y-3">
                      {/* Nyugdíjas */}
                      <div className="border-b border-border/50 pb-2">
                        <div className="flex items-center gap-2 mb-1">
                          <input
                            type="checkbox"
                            id="is_pensioner"
                            checked={!!form.is_pensioner}
                            onChange={e => setForm(f => ({ ...f, is_pensioner: e.target.checked }))}
                            className="w-3.5 h-3.5 rounded border-slate-300"
                          />
                          <label htmlFor="is_pensioner" className="text-xs font-bold text-slate-700 dark:text-slate-300">Nyugdíjas státusz</label>
                        </div>
                        {form.is_pensioner && (
                          <select
                            value={form.pension_type || 'none'}
                            onChange={e => setForm(f => ({ ...f, pension_type: e.target.value }))}
                            className="w-full px-2 py-1 h-7 mt-1 rounded border border-border bg-background text-xs"
                          >
                            <option value="none">Válassz típust...</option>
                            <option value="old_age">Öregségi nyugdíjas</option>
                            <option value="rehab">Rehabilitációs ellátott</option>
                            <option value="disability">Rokkantsági nyugdíjas</option>
                            <option value="other">Egyéb kiegészítő tevékenység</option>
                          </select>
                        )}
                      </div>

                      {/* EKHO */}
                      <div className="border-b border-border/50 pb-2">
                        <div className="flex items-center gap-2 mb-1">
                          <input
                            type="checkbox"
                            id="is_ekho"
                            checked={!!form.is_ekho}
                            onChange={e => setForm(f => ({ ...f, is_ekho: e.target.checked }))}
                            className="w-3.5 h-3.5 rounded border-slate-300"
                          />
                          <label htmlFor="is_ekho" className="text-xs font-bold text-slate-700 dark:text-slate-300">EKHO választása</label>
                        </div>
                        {form.is_ekho && (
                          <div className="grid grid-cols-2 gap-2 mt-1">
                            <div>
                              <label className="block text-[9px] text-slate-400">Ki fizeti?</label>
                              <select
                                value={form.ekho_payer || 'employee'}
                                onChange={e => setForm(f => ({ ...f, ekho_payer: e.target.value }))}
                                className="w-full px-2 py-1 h-7 rounded border border-border bg-background text-xs"
                              >
                                <option value="employee">Munkavállaló</option>
                                <option value="employer">Munkáltató</option>
                              </select>
                            </div>
                            <div>
                              <label className="block text-[9px] text-slate-400">Kategória</label>
                              <select
                                value={form.ekho_category || 'normal'}
                                onChange={e => setForm(f => ({ ...f, ekho_category: e.target.value }))}
                                className="w-full px-2 py-1 h-7 rounded border border-border bg-background text-xs"
                              >
                                <option value="normal">Normál (60M)</option>
                                <option value="athlete">Sportoló (500M)</option>
                                <option value="egt">EGT tagállam</option>
                              </select>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* SZOCHO kedvezmény */}
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <input
                            type="checkbox"
                            id="is_szocho_discount"
                            checked={!!form.is_szocho_discount}
                            onChange={e => setForm(f => ({ ...f, is_szocho_discount: e.target.checked }))}
                            className="w-3.5 h-3.5 rounded border-slate-300"
                          />
                          <label htmlFor="is_szocho_discount" className="text-xs font-bold text-slate-700 dark:text-slate-300">SZOCHO kedvezmény</label>
                        </div>
                        {form.is_szocho_discount && (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-1">
                            <div>
                              <label className="block text-[9px] text-slate-400">Kedvezmény típusa</label>
                              <select
                                value={form.szocho_discount_type || 'none'}
                                onChange={e => setForm(f => ({ ...f, szocho_discount_type: e.target.value }))}
                                className="w-full px-2 py-1 h-7 rounded border border-border bg-background text-xs"
                              >
                                <option value="agriculture">Mezőgazdasági (FEOR 9)</option>
                                <option value="market_entry">Piacra lépő (Y1-Y2: 100%, Y3: 50%)</option>
                                <option value="mother_market_entry">Anya piacra lépő</option>
                                <option value="phd_researcher">K+F / PhD kutató</option>
                                <option value="fiatalkoru">25 év alatti fiatal</option>
                                <option value="55_feletti">55 év feletti</option>
                                <option value="szakkepzetlen">Szakképzetlen (FEOR 9)</option>
                              </select>
                            </div>
                            <div>
                              <label className="block text-[9px] text-slate-400">Eltelt hónapok</label>
                              <input
                                type="number"
                                value={form.szocho_discount_months_elapsed || 0}
                                onChange={e => setForm(f => ({ ...f, szocho_discount_months_elapsed: Number(e.target.value) || 0 }))}
                                className="w-full px-2 py-1 h-7 rounded border border-border bg-background text-xs"
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 mt-2 pt-2 border-t border-border/50">
                    <Button variant="ghost" size="sm" onClick={() => setEditingId(null)} className="h-8 text-xs">
                      <X className="w-3.5 h-3.5 mr-1" /> Mégse
                    </Button>
                    <Button onClick={handleSave} disabled={updateEmployment.isPending} className="h-8 text-xs bg-green-600 hover:bg-green-700 text-white">
                      {updateEmployment.isPending ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Check className="w-3.5 h-3.5 mr-1" />}
                      Mentés
                    </Button>
                  </div>
                </div>
              )}
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
