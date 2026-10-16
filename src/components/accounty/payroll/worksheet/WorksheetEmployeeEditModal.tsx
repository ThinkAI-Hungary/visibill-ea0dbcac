import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  User,
  Briefcase,
  Banknote,
  Check,
  Loader2,
  Clock,
  Shield,
  CreditCard,
  Building,
} from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { useUpdateEmployee, useUpdateEmployment, payrollQueryKeys } from '@/hooks/usePayrollData';
import { toast } from '@/hooks/use-toast';
import { formatTajNumberOnType, formatBankAccountOnType } from '@/lib/payroll/validators';
import ProjectSelectOrAddCombobox from '../ProjectSelectOrAddCombobox';

export interface WorksheetEmployeeEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  employee: any;
  employment: any;
  companyId: string;
  onSuccess?: () => void;
}

const EMPLOYMENT_TYPES = [
  { value: 'munkaviszony', label: 'Munkaviszony (Mt. teljes munkaidő)' },
  { value: 'munkaviszony_reszido', label: 'Részmunkaidős munkaviszony' },
  { value: 'ev', label: 'Egyéni vállalkozó (EV)' },
  { value: 'ev_mellekfogl', label: 'Egyéni vállalkozó (mellékfoglalkozású)' },
  { value: 'tarsas_vallalkozo', label: 'Társas vállalkozó' },
  { value: 'megbizas', label: 'Megbízási jogviszony (Ptk.)' },
  { value: 'efo_alkalmi', label: 'Egyszerűsített foglalkoztatás (EFO alkalmi)' },
  { value: 'szakkep', label: 'Szakképzési tanulói munkaszerződés' },
  { value: 'nyugdijas', label: 'Nyugdíjas munkavállaló' },
];

export default function WorksheetEmployeeEditModal({
  isOpen,
  onClose,
  employee,
  employment,
  companyId,
  onSuccess,
}: WorksheetEmployeeEditModalProps) {
  const queryClient = useQueryClient();
  const updateEmployee = useUpdateEmployee();
  const updateEmployment = useUpdateEmployment();

  const [activeTab, setActiveTab] = useState<'job' | 'personal'>('job');
  const [isSaving, setIsSaving] = useState(false);

  // Employment Form State
  const [baseSalary, setBaseSalary] = useState<string>('');
  const [salaryType, setSalaryType] = useState<string>('monthly');
  const [jobTitle, setJobTitle] = useState<string>('');
  const [feorCode, setFeorCode] = useState<string>('');
  const [weeklyHours, setWeeklyHours] = useState<string>('40');
  const [employmentType, setEmploymentType] = useState<string>('munkaviszony');
  const [costCenter, setCostCenter] = useState<string>('');
  const [projectId, setProjectId] = useState<string | null>(null);

  // Personal Form State
  const [lastName, setLastName] = useState<string>('');
  const [firstName, setFirstName] = useState<string>('');
  const [taxId, setTaxId] = useState<string>('');
  const [tajNumber, setTajNumber] = useState<string>('');
  const [bankAccount, setBankAccount] = useState<string>('');
  const [birthDate, setBirthDate] = useState<string>('');
  const [mothersName, setMothersName] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [phone, setPhone] = useState<string>('');

  // Sync state whenever employee or employment props change
  useEffect(() => {
    if (employment) {
      setBaseSalary(String(employment.base_salary || ''));
      setSalaryType(employment.salary_type || 'monthly');
      setJobTitle(employment.job_title || '');
      setFeorCode(employment.feor_code || employment.job_code || '');
      setWeeklyHours(String(employment.weekly_hours || 40));
      setEmploymentType(employment.employment_type || 'munkaviszony');
      setCostCenter(employment.cost_center || '');
      setProjectId(employment.project_id || null);
    }
    if (employee) {
      setLastName(employee.last_name || '');
      setFirstName(employee.first_name || '');
      setTaxId(employee.tax_id || employee.tax_number || '');
      setTajNumber(employee.taj_number || '');
      setBankAccount(employee.bank_account || '');
      setBirthDate(employee.birth_date ? employee.birth_date.split('T')[0] : '');
      setMothersName(employee.mothers_name || '');
      setEmail(employee.email || '');
      setPhone(employee.phone || '');
    }
  }, [employee, employment, isOpen]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!employee?.id || !employment?.id) return;

    const parsedSalary = parseFloat(baseSalary);
    if (isNaN(parsedSalary) || parsedSalary < 0) {
      toast({
        title: 'Érvénytelen alapbér',
        description: 'Kérlek adj meg érvényes alapbért!',
        variant: 'destructive',
      });
      return;
    }

    const parsedHours = parseFloat(weeklyHours);
    if (isNaN(parsedHours) || parsedHours <= 0 || parsedHours > 168) {
      toast({
        title: 'Érvénytelen heti munkaidő',
        description: 'A heti óraszámnak 1 és 168 óra között kell lennie!',
        variant: 'destructive',
      });
      return;
    }

    setIsSaving(true);
    try {
      // 1. Update Employment
      await updateEmployment.mutateAsync({
        id: employment.id,
        base_salary: parsedSalary,
        salary_type: salaryType,
        job_title: jobTitle.trim() || null,
        feor_code: feorCode.trim() || null,
        job_code: feorCode.trim() || null,
        weekly_hours: parsedHours,
        employment_type: employmentType,
        cost_center: costCenter.trim() || null,
        project_id: projectId || null,
      });

      // 2. Update Employee
      await updateEmployee.mutateAsync({
        id: employee.id,
        last_name: lastName.trim(),
        first_name: firstName.trim(),
        tax_id: taxId.trim() || null,
        taj_number: tajNumber.trim() || null,
        bank_account: bankAccount.trim() || null,
        birth_date: birthDate || null,
        mothers_name: mothersName.trim() || null,
        email: email.trim() || null,
        phone: phone.trim() || null,
      });

      // Invalidate cache so that list, details, and live payslip re-fetch immediately
      if (companyId) {
        queryClient.invalidateQueries({ queryKey: payrollQueryKeys.employees(companyId) });
      }
      if (employee.id) {
        queryClient.invalidateQueries({ queryKey: payrollQueryKeys.employments(employee.id) });
      }

      toast({
        title: 'Dolgozói adatok sikeresen frissítve!',
        description: `${lastName} ${firstName} alapbére és adatai mentve.`,
      });

      onSuccess?.();
      onClose();
    } catch (err: any) {
      toast({
        title: 'Mentési hiba',
        description: err?.message || 'Nem sikerült menteni a dolgozói adatokat.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <User className="w-5 h-5 text-primary" />
            Dolgozó és Bér Adatainak Módosítása — {employee?.last_name} {employee?.first_name}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSave} className="space-y-4 py-2">
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'job' | 'personal')}>
            <TabsList className="grid grid-cols-2 w-full mb-4">
              <TabsTrigger value="job" className="gap-2">
                <Briefcase className="w-4 h-4" />
                Bér & Jogviszony Adatok
              </TabsTrigger>
              <TabsTrigger value="personal" className="gap-2">
                <User className="w-4 h-4" />
                Személyes Adatok & Bank
              </TabsTrigger>
            </TabsList>

            {/* TAB 1: Bér és Jogviszony adatok */}
            <TabsContent value="job" className="space-y-4">
              <div className="p-3 bg-muted/30 rounded-lg border border-border/60 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">
                    Alapbér összege (Ft) <span className="text-destructive">*</span>
                  </label>
                  <div className="relative">
                    <Banknote className="w-4 h-4 text-muted-foreground absolute left-3 top-2.5" />
                    <Input
                      type="number"
                      min={0}
                      value={baseSalary}
                      onChange={(e) => setBaseSalary(e.target.value)}
                      placeholder="pl. 373200"
                      className="pl-9 font-mono font-medium"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">
                    Bér típusa <span className="text-destructive">*</span>
                  </label>
                  <select
                    value={salaryType}
                    onChange={(e) => setSalaryType(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="monthly">Havi alapbér (Ft/hó)</option>
                    <option value="hourly">Órabér (Ft/óra)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">
                    Munkakör megnevezése
                  </label>
                  <Input
                    type="text"
                    value={jobTitle}
                    onChange={(e) => setJobTitle(e.target.value)}
                    placeholder="pl. Értékesítési vezető, Szakács"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">
                    FEOR-08 kód
                  </label>
                  <Input
                    type="text"
                    value={feorCode}
                    onChange={(e) => setFeorCode(e.target.value)}
                    placeholder="pl. 4223 vagy 2512"
                    maxLength={4}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">
                    Heti munkaórák száma <span className="text-destructive">*</span>
                  </label>
                  <div className="relative">
                    <Clock className="w-4 h-4 text-muted-foreground absolute left-3 top-2.5" />
                    <Input
                      type="number"
                      min={1}
                      max={168}
                      value={weeklyHours}
                      onChange={(e) => setWeeklyHours(e.target.value)}
                      placeholder="40"
                      className="pl-9 font-mono"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">
                    Foglalkoztatási forma
                  </label>
                  <select
                    value={employmentType}
                    onChange={(e) => setEmploymentType(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    {EMPLOYMENT_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Költséghely és Projekt választó */}
              <div className="p-3 bg-muted/20 rounded-lg border border-border/50 space-y-2">
                <label className="block text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <Building className="w-3.5 h-3.5 text-primary" />
                  Költséghely és Projekt hozzárendelés
                </label>
                <ProjectSelectOrAddCombobox
                  companyId={companyId}
                  value={costCenter}
                  projectId={projectId}
                  onChange={(val, projId) => {
                    setCostCenter(val);
                    setProjectId(projId || null);
                  }}
                  placeholder="Válassz projektet vagy adj meg költséghelyet…"
                />
              </div>
            </TabsContent>

            {/* TAB 2: Személyes Adatok & Bank */}
            <TabsContent value="personal" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">
                    Vezetéknév <span className="text-destructive">*</span>
                  </label>
                  <Input
                    type="text"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">
                    Keresztnév <span className="text-destructive">*</span>
                  </label>
                  <Input
                    type="text"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">
                    Adóazonosító jel (10 számjegy)
                  </label>
                  <Input
                    type="text"
                    value={taxId}
                    onChange={(e) => setTaxId(e.target.value)}
                    placeholder="8xxxxxxxx"
                    maxLength={10}
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">
                    TAJ-szám (9 számjegy)
                  </label>
                  <Input
                    type="text"
                    value={tajNumber}
                    onChange={(e) => setTajNumber(formatTajNumberOnType(e.target.value))}
                    placeholder="123-456-789"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">
                    Bankszámlaszám (GIRO átutaláshoz)
                  </label>
                  <div className="relative">
                    <CreditCard className="w-4 h-4 text-muted-foreground absolute left-3 top-2.5" />
                    <Input
                      type="text"
                      value={bankAccount}
                      onChange={(e) => setBankAccount(formatBankAccountOnType(e.target.value))}
                      placeholder="11773016-00000000-00000000"
                      className="pl-9 font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">
                    Születési dátum
                  </label>
                  <Input
                    type="date"
                    value={birthDate}
                    onChange={(e) => setBirthDate(e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">
                    Anyja születési neve
                  </label>
                  <Input
                    type="text"
                    value={mothersName}
                    onChange={(e) => setMothersName(e.target.value)}
                    placeholder="pl. Kis Katalin"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">
                    E-mail cím
                  </label>
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="dolgozo@ceg.hu"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-foreground mb-1">
                  Telefonszám
                </label>
                <Input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+36 30 123 4567"
                />
              </div>
            </TabsContent>
          </Tabs>

          <DialogFooter className="gap-2 sm:gap-0 pt-4 border-t border-border/60">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isSaving}
            >
              Mégse
            </Button>
            <Button
              type="submit"
              disabled={isSaving || !baseSalary}
              className="gap-1.5 bg-primary hover:bg-primary/90"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Mentés...
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  Módosítások mentése
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
