import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, ArrowRight, Check, User, Briefcase, CreditCard,
  FileText, Shield, Calendar, Building2, ChevronDown, Loader2,
  HelpCircle, AlertTriangle, Search, Plus, Trash2, Users
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { useCreateEmployee, useCreateEmployment, useJobCodes, useCreateDependent } from '@/hooks/usePayrollData';
import { validateTajNumber, validateTaxId, validateBankAccount, validateFeorCode, formatTajNumber, formatBankAccount } from '@/lib/payroll/validators';

// ── Step definitions ──
const STEPS = [
  { id: 'type', title: 'Jogviszony típus', subtitle: 'Milyen típusú foglalkoztatás?', icon: Briefcase },
  { id: 'personal', title: 'Személyes adatok', subtitle: 'Név, születési adatok, azonosítók', icon: User },
  { id: 'dependents', title: 'Eltartottak', subtitle: 'Eltartottak és adókedvezmények', icon: Users },
  { id: 'employment', title: 'Jogviszony részletek', subtitle: 'Munkakör, bérezés, időszak', icon: FileText },
  { id: 'financial', title: 'Pénzügyi adatok', subtitle: 'Bankszámla, adóelőleg', icon: CreditCard },
  { id: 'review', title: 'Áttekintés', subtitle: 'Ellenőrzés és mentés', icon: Check },
];

// ── Employment type cards — complete list based on Tbj. / NAV 08E ──
const EMPLOYMENT_TYPES = [
  // ── Magánszféra — munkaviszony alapú ──
  { value: 'munkaviszony', label: 'Munkaviszony (Mt.)', code: '1101', desc: 'Klasszikus munkaviszony', icon: '', group: 'Munkaviszony' },
  { value: 'munkaviszony_reszido', label: 'Részmunkaidős munkaviszony', code: '1101', desc: 'Mt. szerinti, csökkentett óraszám', icon: '', group: 'Munkaviszony' },
  { value: 'bedolgozo', label: 'Bedolgozói jogviszony', code: '1101', desc: 'Otthoni munkavégzés, Mt. speciális', icon: '', group: 'Munkaviszony' },
  { value: 'munkaero_kolcsonzes', label: 'Munkaerő-kölcsönzés', code: '1101', desc: 'Kölcsönbeadó által foglalkoztatott', icon: '', group: 'Munkaviszony' },
  { value: 'szakkep', label: 'Szakképzési munkaszerződés', code: '1131', desc: 'Szkt. szerinti tanulói jogviszony', icon: '', group: 'Munkaviszony' },
  { value: 'osztondijas', label: 'Ösztöndíjas foglalkoztatott', code: '1140', desc: 'Gyakornoki / ösztöndíjas jogviszony', icon: '', group: 'Munkaviszony' },
  { value: 'neveloszulo', label: 'Nevelőszülő', code: '1150', desc: 'Nevelőszülői foglalkoztatási jogviszony', icon: '', group: 'Munkaviszony' },
  { value: 'haztartasi', label: 'Háztartási alkalmazott', code: '1190', desc: 'Háztartási munkára irányuló egyszerűsített fogl.', icon: '', group: 'Munkaviszony' },

  // ── Közszféra ──
  { value: 'kozalkalmazott', label: 'Közalkalmazott (Kjt.)', code: '1201', desc: 'Önkormányzat, iskola, kórház, kultúra', icon: '', group: 'Közszféra', tag: 'KÖZSZ' },
  { value: 'kozszolgalati', label: 'Köztisztviselő (Kttv.)', code: '1220', desc: 'Államigazgatási szerv, jegyző', icon: '', group: 'Közszféra', tag: 'KÖZSZ' },
  { value: 'kormanytisztviselo', label: 'Kormánytisztviselő (Kit.)', code: '1210', desc: 'Kormányzati igazgatási szerv', icon: '', group: 'Közszféra', tag: 'KÖZSZ' },
  { value: 'biro_ugyesz', label: 'Bíró, ügyész, igazságügyi alk.', code: '1120', desc: 'Igazságszolgáltatási jogviszony', icon: '', group: 'Közszféra', tag: 'KÖZSZ' },
  { value: 'hivatásos_katona', label: 'Hivatásos/szerződéses katona', code: '1130', desc: 'Honvédelmi jogviszony (Hjt.)', icon: '', group: 'Közszféra', tag: 'KÖZSZ' },
  { value: 'egyhazi', label: 'Egyházi személy', code: '1500', desc: 'Egyházi szolgálati jogviszony', icon: '', group: 'Közszféra', tag: 'KÖZSZ' },
  { value: 'kozfogl', label: 'Közfoglalkoztatás', code: '1600', desc: 'Közfoglalkoztatási jogviszony', icon: '', group: 'Közszféra', tag: 'KÖZSZ' },
  { value: 'premiumevek', label: 'Prémiumévek program', code: '1240', desc: 'Nyugdíj előtti foglalkoztatási program', icon: '', group: 'Közszféra', tag: 'KÖZSZ' },

  // ── Megbízás / választott ──
  { value: 'tartos_megbizas', label: 'Tartós megbízás (ÚJ 2026)', code: '1115', desc: 'Előzetes bejelentés, biztosított', icon: '', group: 'Megbízás', isNew: true },
  { value: 'megbizas', label: 'Megbízási jogviszony', code: '1300', desc: 'Ptk. szerinti megbízás (biztosított)', icon: '', group: 'Megbízás' },
  { value: 'megbizas_eseti', label: 'Eseti megbízás (nem biztosított)', code: '1301', desc: 'Ptk. megbízás, nem éri el a bizt. küszöböt', icon: '', group: 'Megbízás' },
  { value: 'valasztott_tisztsegviselo', label: 'Választott tisztségviselő', code: '1350', desc: 'Önkormányzati, társasházi, alapítványi', icon: '', group: 'Megbízás' },

  // ── Vállalkozók ──
  { value: 'tarsas_vallalkozo', label: 'Társas vállalkozó (főfogl.)', code: '1451', desc: 'Személyesen közreműködő tag, főállás', icon: '', group: 'Vállalkozó' },
  { value: 'tarsas_vallalkozo_mellekfogl', label: 'Társas vállalkozó (mellékfogl.)', code: '1452', desc: 'Mellékfoglalkozású társas vállalkozó', icon: '', group: 'Vállalkozó', tag: 'KEDV' },
  { value: 'ev', label: 'Egyéni vállalkozó (főfogl.)', code: '1470', desc: 'Főállású egyéni vállalkozó', icon: '', group: 'Vállalkozó' },
  { value: 'ev_mellekfogl', label: 'Egyéni vállalkozó (mellékfogl.)', code: '1471', desc: 'Mellékfoglalkozású EV', icon: '', group: 'Vállalkozó', tag: 'KEDV' },
  { value: 'szovetkezeti_tag', label: 'Szövetkezeti tag', code: '1460', desc: 'Szövetkezetben személyesen közreműködő', icon: '', group: 'Vállalkozó' },
  { value: 'iskolaszovetkezet', label: 'Iskolaszövetkezeti tag', code: '1464', desc: 'Diákmunka iskolaszövetkezeten keresztül', icon: '', group: 'Vállalkozó' },

  // ── Speciális / kedvezményes ──
  { value: 'efo_alkalmi', label: 'Egyszerűsített foglalkoztatás (EFO)', code: 'EFO', desc: 'Alkalmi munka, mezőgazdasági idénymunka', icon: '', group: 'Speciális' },
  { value: 'nyugdijas', label: 'Nyugdíjas munkavállaló', code: '1101', desc: 'Öregségi nyugdíj mellett, SZOCHO/járulék kedv.', icon: '', group: 'Speciális', tag: 'KEDV' },
  { value: 'gyes_gyed', label: 'GYES/GYED melletti fogl.', code: '1101', desc: 'Gyermekgondozási ellátás mellett dolgozó', icon: '', group: 'Speciális', tag: 'KEDV' },
  { value: 'kulfold_kikuld', label: 'Külföldi kiküldetés (expat)', code: '1101', desc: 'Kiküldetés EGT/harmadik országba', icon: '', group: 'Speciális' },
  { value: 'segito_csaladtag', label: 'Segítő családtag', code: '1800', desc: 'Családi gazdaságban segítő rokon', icon: '', group: 'Speciális' },
  { value: 'onkentes', label: 'Közérdekű önkéntes', code: '1900', desc: 'Díjazás nélküli önkéntes tevékenység', icon: '', group: 'Speciális' },
];

type DependentData = {
  birth_name: string;
  tax_id: string;
  taj_number: string;
  birth_date: string;
  mothers_birth_name: string;
  is_fetus: boolean;
};

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
  eu_tax_id: string;
  education_level: string;
  has_age_concession: boolean;
  has_union_fee: boolean;
  has_no_hungarian_address: boolean;
  // Step 3: Dependents
  dependents: DependentData[];
  // Step 4: Employment
  start_date: string;
  feor_code: string;
  job_title: string;
  base_salary: string;
  salary_type: string;
  weekly_hours: string;
  is_fixed_term: boolean;
  end_date: string;
  is_pensioner: boolean;
  pension_type: string;
  is_ekho: boolean;
  ekho_payer: string;
  ekho_category: string;
  is_szocho_discount: boolean;
  szocho_discount_type: string;
  szocho_discount_months_elapsed: string;
  insurance_relationship_code: string;
  feor_description: string;
  // Step 5: Financial
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
  eu_tax_id: '',
  education_level: 'none',
  has_age_concession: false,
  has_union_fee: false,
  has_no_hungarian_address: false,
  dependents: [],
  start_date: new Date().toISOString().slice(0, 10),
  feor_code: '',
  job_title: '',
  base_salary: '',
  salary_type: 'monthly',
  weekly_hours: '40',
  is_fixed_term: false,
  end_date: '',
  is_pensioner: false,
  pension_type: 'none',
  is_ekho: false,
  ekho_payer: 'employee',
  ekho_category: 'normal',
  is_szocho_discount: false,
  szocho_discount_type: 'none',
  szocho_discount_months_elapsed: '0',
  insurance_relationship_code: '',
  feor_description: '',
  bank_account: '',
};

import { supabase } from '@/integrations/supabase/client';

export default function EmployeeWizardPage() {
  const { id: companyId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormData>(INITIAL_FORM);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [activeGroup, setActiveGroup] = useState('Mind');
  const [typeSearch, setTypeSearch] = useState('');

  const createEmployee = useCreateEmployee();
  const createEmployment = useCreateEmployment();
  const { data: jobCodes = [] } = useJobCodes();

  const update = (field: keyof FormData, value: string | boolean | any[]) => {
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

    // Step 2: Dependents (no strict validation required for basic flow)

    if (step === 3) {
      if (!form.start_date) newErrors.start_date = 'Kötelező mező';
      if (form.feor_code) {
        const feorResult = validateFeorCode(form.feor_code);
        if (!feorResult.valid) newErrors.feor_code = feorResult.error!;
      }
      if (form.weekly_hours) {
        const hours = parseFloat(form.weekly_hours);
        if (isNaN(hours) || hours <= 0) {
          newErrors.weekly_hours = 'Érvénytelen óraszám';
        } else if (hours > 168) {
          newErrors.weekly_hours = 'A heti munkaidő maximum 168 óra lehet';
        }
      }
    }

    if (step === 4) {
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
        eu_tax_id: form.eu_tax_id || null,
        education_level: form.education_level || 'none',
        has_age_concession: form.has_age_concession,
        has_union_fee: form.has_union_fee,
        has_no_hungarian_address: form.has_no_hungarian_address,
      } as any);

      // 2. Create dependents if any
      if (form.dependents && form.dependents.length > 0) {
        const { error: depErr } = await supabase
          .from('accounty_dependents')
          .insert(form.dependents.map(d => ({
            employee_id: emp.id,
            birth_name: d.birth_name,
            tax_id: d.tax_id || null,
            taj_number: d.taj_number || null,
            birth_date: d.birth_date || null,
            mothers_birth_name: d.mothers_birth_name || null,
            is_fetus: d.is_fetus,
          })));
        if (depErr) throw depErr;
      }

      // 3. Create employment
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
        is_pensioner: form.is_pensioner,
        pension_type: form.is_pensioner ? form.pension_type : 'none',
        is_ekho: form.is_ekho,
        ekho_payer: form.is_ekho ? form.ekho_payer : 'employee',
        ekho_category: form.is_ekho ? form.ekho_category : 'normal',
        is_szocho_discount: form.is_szocho_discount,
        szocho_discount_type: form.is_szocho_discount ? form.szocho_discount_type : 'none',
        szocho_discount_start: form.is_szocho_discount ? form.start_date : null,
        szocho_discount_end: null,
        minimum_contribution_base_rule: 'minimal_wage',
        has_minimum_base: !form.is_pensioner,
        is_min_base_exempt_gyes_gyed: false,
        is_min_base_exempt_student: false,
        is_unequal_work_schedule: false,
        insurance_relationship_code: form.insurance_relationship_code || null,
        job_valid_from: form.start_date,
        feor_description: form.feor_description || null,
      } as any);

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
        {step === 0 && (() => {
          const groups = ['Mind', ...Array.from(new Set(EMPLOYMENT_TYPES.map(t => (t as any).group).filter(Boolean)))];
          const filtered = EMPLOYMENT_TYPES.filter(t => {
            const matchGroup = activeGroup === 'Mind' || (t as any).group === activeGroup;
            const matchSearch = !typeSearch || t.label.toLowerCase().includes(typeSearch.toLowerCase()) || t.desc.toLowerCase().includes(typeSearch.toLowerCase()) || t.code.toLowerCase().includes(typeSearch.toLowerCase());
            return matchGroup && matchSearch;
          });
          return (
            <div className="space-y-4">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Keresés jogviszony neve, kódja alapján..."
                  value={typeSearch}
                  onChange={e => setTypeSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 text-sm bg-card border border-border rounded-lg outline-none focus:ring-2 focus:ring-primary/30 text-slate-900 dark:text-slate-100 placeholder:text-slate-400"
                />
              </div>
              {/* Group tabs */}
              <div className="flex flex-wrap gap-1.5">
                {groups.map(g => (
                  <button
                    key={g}
                    onClick={() => setActiveGroup(g)}
                    className={cn(
                      'px-3 py-1.5 rounded-full text-xs font-medium transition-colors',
                      activeGroup === g
                        ? 'bg-primary text-primary-foreground shadow-sm'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-primary/10 hover:text-primary'
                    )}
                  >
                    {g} {g !== 'Mind' ? `(${EMPLOYMENT_TYPES.filter(t => (t as any).group === g).length})` : `(${EMPLOYMENT_TYPES.length})`}
                  </button>
                ))}
              </div>
              {/* Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[420px] overflow-y-auto pr-1">
                {filtered.map((type) => (
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
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <p className="text-sm font-bold text-slate-900 dark:text-slate-100">{type.label}</p>
                        {type.isNew && (
                          <span className="px-1.5 py-0.5 text-[9px] font-bold bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400 rounded-full uppercase">ÚJ</span>
                        )}
                        {(type as any).tag === 'KEDV' && (
                          <span className="px-1.5 py-0.5 text-[9px] font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400 rounded-full uppercase">KEDV</span>
                        )}
                        {(type as any).tag === 'KÖZSZ' && (
                          <span className="px-1.5 py-0.5 text-[9px] font-bold bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400 rounded-full uppercase">KÖZSZ</span>
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
                {filtered.length === 0 && (
                  <p className="col-span-full text-center text-sm text-slate-400 py-8">Nincs találat a keresésre.</p>
                )}
              </div>
              {errors.employment_type && (
                <p className="text-sm text-red-500 flex items-center gap-1">
                  <AlertTriangle className="w-4 h-4" /> {errors.employment_type}
                </p>
              )}
            </div>
          );
        })()}


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
            <FormField label="Állampolgárság" value={form.eu_tax_id ? 'Külföldi' : 'Magyar'} onChange={() => {}} placeholder="Magyar" className="opacity-70 pointer-events-none" />
            
            <div className="md:col-span-2 border-t border-border pt-4 mt-2">
              <p className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-3">Külföldi / Egyedi adatok</p>
            </div>
            <FormField label="EU adóazonosító (külföldieknek)" value={form.eu_tax_id} onChange={(v) => update('eu_tax_id', v)} placeholder="pl. DE123456789" />
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Végzettség / szakképzettség</label>
              <Select value={form.education_level} onValueChange={(v) => update('education_level', v)}>
                <SelectTrigger className="bg-card border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nincs megadva</SelectItem>
                  <SelectItem value="primary">Általános iskola</SelectItem>
                  <SelectItem value="secondary">Középiskola / Gimnázium</SelectItem>
                  <SelectItem value="professional">Szakiskola / Szakmunkás</SelectItem>
                  <SelectItem value="university">Főiskola / Egyetem</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-3 gap-3 mt-2">
              <div className="flex items-center gap-3 p-3 rounded-lg border border-border">
                <input type="checkbox" id="age_concession" checked={form.has_age_concession} onChange={(e) => update('has_age_concession', e.target.checked)} className="w-4 h-4 rounded border-slate-300" />
                <label htmlFor="age_concession" className="text-xs text-slate-700 dark:text-slate-300 font-medium">Korkedvezményre jogosult</label>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-lg border border-border">
                <input type="checkbox" id="union_fee" checked={form.has_union_fee} onChange={(e) => update('has_union_fee', e.target.checked)} className="w-4 h-4 rounded border-slate-300" />
                <label htmlFor="union_fee" className="text-xs text-slate-700 dark:text-slate-300 font-medium">Érdekképviseleti tagdíj (szakszervezet)</label>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-lg border border-border">
                <input type="checkbox" id="no_hungarian_address" checked={form.has_no_hungarian_address} onChange={(e) => update('has_no_hungarian_address', e.target.checked)} className="w-4 h-4 rounded border-slate-300" />
                <label htmlFor="no_hungarian_address" className="text-xs text-slate-700 dark:text-slate-300 font-medium">Nincs magyar lakcíme</label>
              </div>
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

        {/* Step 2: Dependents */}
        {step === 2 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Add meg az eltartottak (gyermekek, magzatok) adatait a családi kedvezmény érvényesítéséhez.
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  const newDep: DependentData = {
                    birth_name: '',
                    tax_id: '',
                    taj_number: '',
                    birth_date: '',
                    mothers_birth_name: '',
                    is_fetus: false
                  };
                  update('dependents', [...form.dependents, newDep]);
                }}
                className="flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" /> Eltartott hozzáadása
              </Button>
            </div>

            {form.dependents.length > 0 ? (
              <div className="border border-border rounded-lg overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-900/50 border-b border-border text-slate-500">
                      <th className="px-3 py-2 text-left">Név</th>
                      <th className="px-3 py-2 text-left">Adóazonosító</th>
                      <th className="px-3 py-2 text-left">TAJ szám</th>
                      <th className="px-3 py-2 text-left">Szül. dátum</th>
                      <th className="px-3 py-2 text-left">Anyja szül. neve</th>
                      <th className="px-3 py-2 text-center">Magzat? (91. nap+)</th>
                      <th className="px-3 py-2 text-center w-12"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {form.dependents.map((dep, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/40">
                        <td className="p-2">
                          <Input
                            value={dep.birth_name}
                            onChange={(e) => {
                              const list = [...form.dependents];
                              list[idx].birth_name = e.target.value;
                              update('dependents', list);
                            }}
                            placeholder="pl. Kis János"
                            className="h-8 text-xs"
                          />
                        </td>
                        <td className="p-2">
                          <Input
                            value={dep.tax_id}
                            onChange={(e) => {
                              const list = [...form.dependents];
                              list[idx].tax_id = e.target.value;
                              update('dependents', list);
                            }}
                            placeholder="8XXXXXXXXX"
                            className="h-8 text-xs"
                          />
                        </td>
                        <td className="p-2">
                          <Input
                            value={dep.taj_number}
                            onChange={(e) => {
                              const list = [...form.dependents];
                              list[idx].taj_number = e.target.value;
                              update('dependents', list);
                            }}
                            placeholder="000-000-000"
                            className="h-8 text-xs"
                          />
                        </td>
                        <td className="p-2">
                          <Input
                            type="date"
                            value={dep.birth_date}
                            onChange={(e) => {
                              const list = [...form.dependents];
                              list[idx].birth_date = e.target.value;
                              update('dependents', list);
                            }}
                            className="h-8 text-xs"
                          />
                        </td>
                        <td className="p-2">
                          <Input
                            value={dep.mothers_birth_name}
                            onChange={(e) => {
                              const list = [...form.dependents];
                              list[idx].mothers_birth_name = e.target.value;
                              update('dependents', list);
                            }}
                            placeholder="születési név"
                            className="h-8 text-xs"
                          />
                        </td>
                        <td className="p-2 text-center">
                          <input
                            type="checkbox"
                            checked={dep.is_fetus}
                            onChange={(e) => {
                              const list = [...form.dependents];
                              list[idx].is_fetus = e.target.checked;
                              update('dependents', list);
                            }}
                            className="w-4 h-4 rounded border-slate-300"
                          />
                        </td>
                        <td className="p-2 text-center">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              const list = form.dependents.filter((_, i) => i !== idx);
                              update('dependents', list);
                            }}
                            className="h-7 w-7 text-red-500 hover:bg-red-50"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-10 border-2 border-dashed border-border rounded-xl">
                <p className="text-sm text-slate-400">Nincsenek felvéve eltartottak ehhez a dolgozóhoz.</p>
              </div>
            )}
          </div>
        )}

        {/* Step 3: Employment details */}
        {step === 3 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField label="Belépés dátuma *" value={form.start_date} onChange={(v) => update('start_date', v)} error={errors.start_date} type="date" />
            <FormField label="FEOR kód" value={form.feor_code} onChange={(v) => update('feor_code', v)} error={errors.feor_code} placeholder="pl. 2411" />
            <FormField label="FEOR leírása" value={form.feor_description} onChange={(v) => update('feor_description', v)} placeholder="Szakmai megnevezés" />
            <FormField label="Biztosítási jogviszony kódja (T1041)" value={form.insurance_relationship_code} onChange={(v) => update('insurance_relationship_code', v)} placeholder="pl. 1101" />
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
            <FormField label="Heti munkaidő (óra)" value={form.weekly_hours} onChange={(v) => update('weekly_hours', v)} type="number" placeholder="40" error={errors.weekly_hours} />
            <div className="flex items-center gap-3 p-3 rounded-lg border border-border">
              <input type="checkbox" checked={form.is_fixed_term} onChange={(e) => update('is_fixed_term', e.target.checked)} className="w-4 h-4 rounded border-slate-300" />
              <label className="text-sm text-slate-700 dark:text-slate-300">Határozott idejű</label>
            </div>
            {form.is_fixed_term && (
              <FormField label="Jogviszony vége" value={form.end_date} onChange={(v) => update('end_date', v)} type="date" />
            )}

            <div className="md:col-span-2 border-t border-border pt-4 mt-2">
              <p className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-3">Speciális Adózási Formák</p>
            </div>
            <div className="flex flex-col gap-2 p-3 rounded-lg border border-border">
              <div className="flex items-center gap-3">
                <input type="checkbox" id="is_pensioner" checked={form.is_pensioner} onChange={(e) => update('is_pensioner', e.target.checked)} className="w-4 h-4 rounded border-slate-300" />
                <label htmlFor="is_pensioner" className="text-sm text-slate-700 dark:text-slate-300 font-semibold">Nyugdíjas státusz</label>
              </div>
              {form.is_pensioner && (
                <div className="mt-2 pl-6">
                  <label className="block text-xs font-medium text-slate-500 mb-1">Nyugdíj típusa</label>
                  <Select value={form.pension_type} onValueChange={(v) => update('pension_type', v)}>
                    <SelectTrigger className="bg-card border-border h-8 text-xs">
                      <SelectValue placeholder="Válassz..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="old_age">Öregségi nyugdíjas</SelectItem>
                      <SelectItem value="rehab">Rehabilitációs ellátott</SelectItem>
                      <SelectItem value="disability">Rokkantsági nyugdíjas</SelectItem>
                      <SelectItem value="other">Egyéb kiegészítő tevékenység</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            <div className="flex flex-col gap-2 p-3 rounded-lg border border-border">
              <div className="flex items-center gap-3">
                <input type="checkbox" id="is_ekho" checked={form.is_ekho} onChange={(e) => update('is_ekho', e.target.checked)} className="w-4 h-4 rounded border-slate-300" />
                <label htmlFor="is_ekho" className="text-sm text-slate-700 dark:text-slate-300 font-semibold">EKHO választása</label>
              </div>
              {form.is_ekho && (
                <div className="mt-2 pl-6 grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">Ki fizeti?</label>
                    <Select value={form.ekho_payer} onValueChange={(v) => update('ekho_payer', v)}>
                      <SelectTrigger className="bg-card border-border h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="employee">Munkavállaló</SelectItem>
                        <SelectItem value="employer">Munkáltató fizeti helyette</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">EKHO kategória</label>
                    <Select value={form.ekho_category} onValueChange={(v) => update('ekho_category', v)}>
                      <SelectTrigger className="bg-card border-border h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="normal">Művész / Alkotó (60M limit)</SelectItem>
                        <SelectItem value="athlete">Hivatásos sportoló (500M limit)</SelectItem>
                        <SelectItem value="egt">EGT tagállamban biztosított</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}
            </div>

            <div className="flex flex-col gap-2 p-3 rounded-lg border border-border md:col-span-2">
              <div className="flex items-center gap-3">
                <input type="checkbox" id="is_szocho_discount" checked={form.is_szocho_discount} onChange={(e) => update('is_szocho_discount', e.target.checked)} className="w-4 h-4 rounded border-slate-300" />
                <label htmlFor="is_szocho_discount" className="text-sm text-slate-700 dark:text-slate-300 font-semibold">SZOCHO kedvezmény érvényesítése</label>
              </div>
              {form.is_szocho_discount && (
                <div className="mt-2 pl-6 grid grid-cols-1 md:grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">Kedvezmény típusa</label>
                    <Select value={form.szocho_discount_type} onValueChange={(v) => update('szocho_discount_type', v)}>
                      <SelectTrigger className="bg-card border-border h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="agriculture">Mezőgazdasági munkakör (FEOR 9)</SelectItem>
                        <SelectItem value="market_entry">Munkaerőpiacra lépő (Y1-Y2: 100%, Y3: 50%)</SelectItem>
                        <SelectItem value="mother_market_entry">3+ gyermekes anya piacra lépő (Y1-Y3: 100%, Y4-Y5: 50%)</SelectItem>
                        <SelectItem value="phd_researcher">K+F / PhD kutató (50% szocho)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <FormField label="Eltelt hónapok száma (ha van)" value={form.szocho_discount_months_elapsed} onChange={(v) => update('szocho_discount_months_elapsed', v)} type="number" className="h-8 text-xs" />
                </div>
              )}
            </div>
          </div>
        )}

        {/* Step 4: Financial data */}
        {step === 4 && (
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

        {/* Step 5: Review */}
        {step === 5 && (
          <div className="space-y-4">
            <ReviewRow label="Jogviszony típus" value={EMPLOYMENT_TYPES.find(t => t.value === form.employment_type)?.label || form.employment_type} />
            <ReviewRow label="Jogviszonykód" value={form.job_code} />
            {form.insurance_relationship_code && <ReviewRow label="Biztosítási kód" value={form.insurance_relationship_code} />}
            <div className="border-t border-border pt-3" />
            <ReviewRow label="Név" value={`${form.last_name} ${form.first_name}`} />
            {form.birth_name && <ReviewRow label="Születési név" value={form.birth_name} />}
            {form.birth_date && <ReviewRow label="Születési dátum" value={form.birth_date} />}
            {form.taj_number && <ReviewRow label="TAJ-szám" value={formatTajNumber(form.taj_number)} />}
            {form.tax_id && <ReviewRow label="Adóazonosító" value={form.tax_id} />}
            {form.eu_tax_id && <ReviewRow label="EU adóazonosító" value={form.eu_tax_id} />}
            <ReviewRow label="Végzettség" value={form.education_level} />
            <ReviewRow label="Eltartottak száma" value={`${form.dependents.length} fő`} />
            <div className="border-t border-border pt-3" />
            <ReviewRow label="Belépés" value={form.start_date} />
            {form.job_title && <ReviewRow label="Munkakör" value={form.job_title} />}
            {form.feor_code && <ReviewRow label="FEOR" value={`${form.feor_code} - ${form.feor_description || ''}`} />}
            {form.base_salary && <ReviewRow label="Alapbér" value={`${parseInt(form.base_salary).toLocaleString('hu-HU')} Ft`} />}
            <ReviewRow label="Munkaidő" value={`${form.weekly_hours} óra/hét`} />
            {form.is_ekho && <ReviewRow label="EKHO" value={`Igen (${form.ekho_category}, fizeti: ${form.ekho_payer})`} />}
            {form.is_pensioner && <ReviewRow label="Nyugdíjas" value={`Igen (${form.pension_type})`} />}
            {form.is_szocho_discount && <ReviewRow label="SZOCHO kedvezmény" value={form.szocho_discount_type} />}
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
