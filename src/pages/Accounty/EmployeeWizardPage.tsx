import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, ArrowRight, Check, User, Briefcase, CreditCard,
  FileText, Shield, Calendar, Building2, ChevronDown, Loader2,
  HelpCircle, AlertTriangle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { useCreateEmployee, useCreateEmployment, useJobCodes } from '@/hooks/usePayrollData';
import { validateTajNumber, validateTaxId, validateBankAccount, validateFeorCode, formatTajNumber, formatBankAccount } from '@/lib/payroll/validators';

// ── Step definitions ──
const STEPS = [
  { id: 'type', title: 'Jogviszony típus', subtitle: 'Milyen típusú foglalkoztatás?', icon: Briefcase },
  { id: 'personal', title: 'Személyes adatok', subtitle: 'Név, születési adatok, azonosítók', icon: User },
  { id: 'employment', title: 'Jogviszony részletek', subtitle: 'Munkakör, bérezés, időszak', icon: FileText },
  { id: 'financial', title: 'Pénzügyi adatok', subtitle: 'Bankszámla, adóelőleg', icon: CreditCard },
  { id: 'review', title: 'Áttekintés', subtitle: 'Ellenőrzés és mentés', icon: Check },
];

// ── Employment type cards ──
const EMPLOYMENT_TYPES = [
  { value: 'munkaviszony', label: 'Munkaviszony (Mt.)', code: '1101', desc: 'Klasszikus munkaviszony', icon: '👔' },
  { value: 'tartos_megbizas', label: 'Tartós megbízás (ÚJ 2026)', code: '1115', desc: 'Előzetes bejelentés, biztosított', icon: '📋', isNew: true },
  { value: 'megbizas', label: 'Megbízási jogviszony', code: '1300', desc: 'Ptk. szerinti megbízás', icon: '📑' },
  { value: 'tarsas_vallalkozo', label: 'Társas vállalkozó', code: '1452', desc: 'Személyesen közreműködő tag', icon: '🏢' },
  { value: 'szakkep', label: 'Szakképzési munkaszerződés', code: '1131', desc: 'Szkt. szerinti jogviszony', icon: '🎓' },
  { value: 'efo_alkalmi', label: 'Egyszerűsített foglalkoztatás', code: 'EFO', desc: 'Alkalmi munka (EFO)', icon: '⚡' },
  { value: 'kozfogl', label: 'Közfoglalkoztatás', code: '1600', desc: 'Közfoglalkoztatási jogviszony', icon: '🏛️' },
  { value: 'ev', label: 'Egyéni vállalkozó', code: '1470', desc: 'Főállású EV', icon: '🧑‍💼' },
];

type FormData = {
  // Step 1: Type
  employment_type: string;
  job_code: string;
  // Step 2: Personal
  first_name: string;
  last_name: string;
  birth_name: string;
  birth_place: string;
  birth_date: string;
  mothers_name: string;
  gender: string;
  taj_number: string;
  tax_id: string;
  email: string;
  phone: string;
  // Step 3: Employment
  start_date: string;
  feor_code: string;
  job_title: string;
  base_salary: string;
  salary_type: string;
  weekly_hours: string;
  is_fixed_term: boolean;
  end_date: string;
  // Step 4: Financial
  bank_account: string;
};

const INITIAL_FORM: FormData = {
  employment_type: '',
  job_code: '',
  first_name: '',
  last_name: '',
  birth_name: '',
  birth_place: '',
  birth_date: '',
  mothers_name: '',
  gender: '',
  taj_number: '',
  tax_id: '',
  email: '',
  phone: '',
  start_date: new Date().toISOString().slice(0, 10),
  feor_code: '',
  job_title: '',
  base_salary: '',
  salary_type: 'monthly',
  weekly_hours: '40',
  is_fixed_term: false,
  end_date: '',
  bank_account: '',
};

export default function EmployeeWizardPage() {
  const { id: companyId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormData>(INITIAL_FORM);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const createEmployee = useCreateEmployee();
  const createEmployment = useCreateEmployment();
  const { data: jobCodes = [] } = useJobCodes();

  const update = (field: keyof FormData, value: string | boolean) => {
    setForm(prev => ({ ...prev, [field]: value }));
    setErrors(prev => { const next = { ...prev }; delete next[field]; return next; });
  };

  const validateStep = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (step === 0) {
      if (!form.employment_type) newErrors.employment_type = 'Válassz jogviszony típust';
    }

    if (step === 1) {
      if (!form.last_name.trim()) newErrors.last_name = 'Kötelező mező';
      if (!form.first_name.trim()) newErrors.first_name = 'Kötelező mező';

      if (form.taj_number) {
        const tajResult = validateTajNumber(form.taj_number);
        if (!tajResult.valid) newErrors.taj_number = tajResult.error!;
      }

      if (form.tax_id) {
        const taxResult = validateTaxId(form.tax_id);
        if (!taxResult.valid) newErrors.tax_id = taxResult.error!;
      }
    }

    if (step === 2) {
      if (!form.start_date) newErrors.start_date = 'Kötelező mező';
      if (form.feor_code) {
        const feorResult = validateFeorCode(form.feor_code);
        if (!feorResult.valid) newErrors.feor_code = feorResult.error!;
      }
    }

    if (step === 3) {
      if (form.bank_account) {
        const bankResult = validateBankAccount(form.bank_account);
        if (!bankResult.valid) newErrors.bank_account = bankResult.error!;
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (!validateStep()) return;
    if (step < STEPS.length - 1) setStep(step + 1);
  };

  const handleBack = () => {
    if (step > 0) setStep(step - 1);
  };

  const handleSubmit = async () => {
    if (!companyId) return;

    try {
      // 1. Create employee
      const emp = await createEmployee.mutateAsync({
        company_id: companyId,
        first_name: form.first_name,
        last_name: form.last_name,
        birth_name: form.birth_name || null,
        birth_place: form.birth_place || null,
        birth_date: form.birth_date || null,
        mothers_name: form.mothers_name || null,
        gender: (form.gender || null) as any,
        nationality: 'HU',
        taj_number: form.taj_number || null,
        tax_id: form.tax_id || null,
        id_card_number: null,
        address: null,
        temp_address: null,
        email: form.email || null,
        phone: form.phone || null,
        bank_account: form.bank_account || null,
        iban: null,
        status: 'active',
        avatar_url: null,
      });

      // 2. Create employment
      await createEmployment.mutateAsync({
        employee_id: emp.id,
        company_id: companyId,
        job_code: form.job_code || '1101',
        job_serial_number: 1,
        employment_type: form.employment_type,
        start_date: form.start_date,
        end_date: form.is_fixed_term && form.end_date ? form.end_date : null,
        probation_end: null,
        is_fixed_term: form.is_fixed_term,
        weekly_hours: parseFloat(form.weekly_hours) || 40,
        feor_code: form.feor_code || null,
        job_title: form.job_title || null,
        location_id: null,
        cost_center: null,
        department: null,
        base_salary: form.base_salary ? parseFloat(form.base_salary) : null,
        salary_type: form.salary_type,
        remote_work_type: null,
        remote_work_days_per_week: null,
        is_insured: true,
        status: 'active',
        metadata: {},
      });

      navigate(`/accounty/payroll/${companyId}/employees`);
    } catch {
      // Error handled by mutation's onError
    }
  };

  const isSaving = createEmployee.isPending || createEmployment.isPending;

  return (
    <div className="w-full max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="h-9 w-9">
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">Új foglalkoztatott</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Belépő rögzítése lépésről lépésre</p>
        </div>
      </div>

      {/* Stepper */}
      <div className="flex items-center gap-2">
        {STEPS.map((s, i) => (
          <React.Fragment key={s.id}>
            <button
              onClick={() => i < step && setStep(i)}
              className={cn(
                'flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all',
                i === step ? 'bg-primary text-primary-foreground shadow-lg' :
                i < step ? 'bg-accent text-primary cursor-pointer hover:bg-accent/80' :
                'bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500'
              )}
            >
              <s.icon className="w-4 h-4" />
              <span className="hidden md:inline">{s.title}</span>
              <span className="md:hidden">{i + 1}</span>
            </button>
            {i < STEPS.length - 1 && (
              <div className={cn('flex-1 h-0.5 rounded-full', i < step ? 'bg-primary' : 'bg-slate-200 dark:bg-slate-700')} />
            )}
          </React.Fragment>
        ))}
      </div>

      {/* Step content */}
      <div className="bg-card rounded-xl border border-border shadow-soft p-6 md:p-8">
        <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-1">{STEPS[step].title}</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">{STEPS[step].subtitle}</p>

        {/* Step 0: Employment type selection */}
        {step === 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {EMPLOYMENT_TYPES.map((type) => (
              <button
                key={type.value}
                onClick={() => {
                  update('employment_type', type.value);
                  update('job_code', type.code);
                }}
                className={cn(
                  'relative flex items-start gap-3 p-4 rounded-xl border-2 text-left transition-all duration-200',
                  form.employment_type === type.value
                    ? 'border-primary bg-primary/5 shadow-lg'
                    : 'border-border hover:border-primary/30 hover:shadow-md'
                )}
              >
                <span className="text-2xl">{type.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-bold text-slate-900 dark:text-slate-100">{type.label}</p>
                    {type.isNew && (
                      <span className="px-1.5 py-0.5 text-[9px] font-bold bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400 rounded-full uppercase">ÚJ</span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{type.desc}</p>
                  <p className="text-[10px] font-mono text-primary mt-1">Kód: {type.code}</p>
                </div>
                {form.employment_type === type.value && (
                  <div className="absolute top-3 right-3 w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                    <Check className="w-3 h-3 text-white" />
                  </div>
                )}
              </button>
            ))}
            {errors.employment_type && (
              <p className="col-span-full text-sm text-red-500 flex items-center gap-1">
                <AlertTriangle className="w-4 h-4" /> {errors.employment_type}
              </p>
            )}
          </div>
        )}

        {/* Step 1: Personal data */}
        {step === 1 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField label="Vezetéknév *" value={form.last_name} onChange={(v) => update('last_name', v)} error={errors.last_name} placeholder="pl. Kovács" />
            <FormField label="Keresztnév *" value={form.first_name} onChange={(v) => update('first_name', v)} error={errors.first_name} placeholder="pl. János" />
            <FormField label="Születési név" value={form.birth_name} onChange={(v) => update('birth_name', v)} placeholder="Ha eltér a jelenlegi névtől" />
            <FormField label="Születési hely" value={form.birth_place} onChange={(v) => update('birth_place', v)} placeholder="pl. Budapest" />
            <FormField label="Születési dátum" value={form.birth_date} onChange={(v) => update('birth_date', v)} type="date" />
            <FormField label="Anyja neve" value={form.mothers_name} onChange={(v) => update('mothers_name', v)} placeholder="pl. Kiss Mária" />
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Nem</label>
              <Select value={form.gender} onValueChange={(v) => update('gender', v)}>
                <SelectTrigger className="bg-card border-border">
                  <SelectValue placeholder="Válassz..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="male">Férfi</SelectItem>
                  <SelectItem value="female">Nő</SelectItem>
                  <SelectItem value="other">Egyéb</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="md:col-span-2 border-t border-border pt-4 mt-2">
              <p className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-3">Azonosítók</p>
            </div>
            <FormField label="TAJ-szám" value={form.taj_number} onChange={(v) => update('taj_number', v)} error={errors.taj_number} placeholder="000-000-000" />
            <FormField label="Adóazonosító jel" value={form.tax_id} onChange={(v) => update('tax_id', v)} error={errors.tax_id} placeholder="8XXXXXXXXX" />
            <div className="md:col-span-2 border-t border-border pt-4 mt-2">
              <p className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-3">Elérhetőség</p>
            </div>
            <FormField label="E-mail" value={form.email} onChange={(v) => update('email', v)} type="email" placeholder="pelda@email.hu" />
            <FormField label="Telefon" value={form.phone} onChange={(v) => update('phone', v)} type="tel" placeholder="+36 30 123 4567" />
          </div>
        )}

        {/* Step 2: Employment details */}
        {step === 2 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField label="Belépés dátuma *" value={form.start_date} onChange={(v) => update('start_date', v)} error={errors.start_date} type="date" />
            <FormField label="FEOR kód" value={form.feor_code} onChange={(v) => update('feor_code', v)} error={errors.feor_code} placeholder="pl. 2411" />
            <FormField label="Munkakör" value={form.job_title} onChange={(v) => update('job_title', v)} placeholder="pl. Könyvelő" className="md:col-span-2" />
            <FormField label="Alapbér (Ft)" value={form.base_salary} onChange={(v) => update('base_salary', v)} type="number" placeholder="pl. 450000" />
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Bérezés típusa</label>
              <Select value={form.salary_type} onValueChange={(v) => update('salary_type', v)}>
                <SelectTrigger className="bg-card border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly">Havibér</SelectItem>
                  <SelectItem value="hourly">Órabér</SelectItem>
                  <SelectItem value="daily">Napidíj</SelectItem>
                  <SelectItem value="project">Projektdíj</SelectItem>
                  <SelectItem value="performance">Teljesítménybér</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <FormField label="Heti munkaidő (óra)" value={form.weekly_hours} onChange={(v) => update('weekly_hours', v)} type="number" placeholder="40" />
            <div className="flex items-center gap-3 p-3 rounded-lg border border-border">
              <input type="checkbox" checked={form.is_fixed_term} onChange={(e) => update('is_fixed_term', e.target.checked)} className="w-4 h-4 rounded border-slate-300" />
              <label className="text-sm text-slate-700 dark:text-slate-300">Határozott idejű</label>
            </div>
            {form.is_fixed_term && (
              <FormField label="Jogviszony vége" value={form.end_date} onChange={(v) => update('end_date', v)} type="date" />
            )}
          </div>
        )}

        {/* Step 3: Financial data */}
        {step === 3 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField label="Bankszámlaszám" value={form.bank_account} onChange={(v) => update('bank_account', v)} error={errors.bank_account} placeholder="XXXXXXXX-XXXXXXXX-XXXXXXXX" className="md:col-span-2" />
            <div className="md:col-span-2 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
              <p className="text-sm text-blue-700 dark:text-blue-300 flex items-center gap-2">
                <HelpCircle className="w-4 h-4 shrink-0" />
                Az adóelőleg-nyilatkozatokat (családi kedvezmény, NÉTAK, stb.) a foglalkoztatott profil oldalán tudod felvinni a mentés után.
              </p>
            </div>
          </div>
        )}

        {/* Step 4: Review */}
        {step === 4 && (
          <div className="space-y-4">
            <ReviewRow label="Jogviszony típus" value={EMPLOYMENT_TYPES.find(t => t.value === form.employment_type)?.label || form.employment_type} />
            <ReviewRow label="Jogviszonykód" value={form.job_code} />
            <div className="border-t border-border pt-3" />
            <ReviewRow label="Név" value={`${form.last_name} ${form.first_name}`} />
            {form.birth_name && <ReviewRow label="Születési név" value={form.birth_name} />}
            {form.birth_date && <ReviewRow label="Születési dátum" value={form.birth_date} />}
            {form.taj_number && <ReviewRow label="TAJ-szám" value={formatTajNumber(form.taj_number)} />}
            {form.tax_id && <ReviewRow label="Adóazonosító" value={form.tax_id} />}
            <div className="border-t border-border pt-3" />
            <ReviewRow label="Belépés" value={form.start_date} />
            {form.job_title && <ReviewRow label="Munkakör" value={form.job_title} />}
            {form.base_salary && <ReviewRow label="Alapbér" value={`${parseInt(form.base_salary).toLocaleString('hu-HU')} Ft`} />}
            <ReviewRow label="Munkaidő" value={`${form.weekly_hours} óra/hét`} />
            {form.bank_account && <ReviewRow label="Bankszámla" value={formatBankAccount(form.bank_account)} />}
          </div>
        )}
      </div>

      {/* Navigation buttons */}
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          onClick={step === 0 ? () => navigate(-1) : handleBack}
          className="flex items-center gap-2"
        >
          <ArrowLeft className="w-4 h-4" />
          {step === 0 ? 'Mégse' : 'Vissza'}
        </Button>

        {step < STEPS.length - 1 ? (
          <Button onClick={handleNext} className="bg-primary hover:bg-primary/90 text-primary-foreground flex items-center gap-2">
            Tovább
            <ArrowRight className="w-4 h-4" />
          </Button>
        ) : (
          <Button
            onClick={handleSubmit}
            disabled={isSaving}
            className="bg-primary hover:bg-primary/90 text-primary-foreground flex items-center gap-2 min-w-[160px]"
          >
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Mentés...
              </>
            ) : (
              <>
                <Check className="w-4 h-4" />
                Foglalkoztatott mentése
              </>
            )}
          </Button>
        )}
      </div>
    </div>
  );
}

// ── Helper components ──

function FormField({ label, value, onChange, error, type = 'text', placeholder, className }: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
  type?: string;
  placeholder?: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">{label}</label>
      <Input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={cn('bg-card border-border', error && 'border-red-500 focus-visible:ring-red-500')}
      />
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <span className="text-sm text-slate-500 dark:text-slate-400">{label}</span>
      <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">{value}</span>
    </div>
  );
}
