import React, { useState, useEffect } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, ChevronRight, Receipt, Check, AlertCircle,
  Building2, Briefcase, FileText, Settings, Shield,
  ChevronLeft, Save, Loader2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { useAccountyClient } from '@/hooks/accounty';
import { useEvClientSettings, useUpdateEvSettings } from '@/hooks/useEvData';
import { toast } from '@/hooks/use-toast';

// ─── Types ──────────────────────────────────────────────────────────────────

type TaxpayerForm = 'atalany' | 'vszja' | 'kata';
type EmploymentStatus = 'foallasu' | 'mellekallasu' | 'kiegeszito';
type VatStatus = 'alanyi_mentes' | 'afas' | 'penzforgalmi';
type CostRatio = 'general' | 'high_80' | 'retail_90';
type BookkeepingMode = 'egyszeres' | 'kettos';
type OrgType = 'egyesulet' | 'alapitvany' | 'egyhaz' | 'tarsashaz' | 'lakasszov' | 'mrp' | 'egyeb' | null;

interface WizardFormData {
  taxpayerForm: TaxpayerForm;
  employmentStatus: EmploymentStatus;
  vatStatus: VatStatus;
  costRatioCategory: CostRatio;
  bookkeepingMode: BookkeepingMode;
  registrationNumber: string;
  mainActivityCode: string;
  skilledMainActivity: boolean;
  orgType: OrgType;
  isPublicBenefit: boolean;
  taxYear: number;
}

const STEPS = [
  { id: 'type', title: 'Típus', icon: Building2 },
  { id: 'form', title: 'Adóforma', icon: FileText },
  { id: 'details', title: 'Részletek', icon: Settings },
  { id: 'review', title: 'Összegzés', icon: Check },
];

export default function EvSetupWizardPage() {
  const { id } = useParams<{ id: string }>();
  const { data: client } = useAccountyClient(id);
  const navigate = useNavigate();
  const { data: existingSettings } = useEvClientSettings(id, 2026);
  const updateSettings = useUpdateEvSettings();

  const [step, setStep] = useState(0);
  const [form, setForm] = useState<WizardFormData>({
    taxpayerForm: 'atalany',
    employmentStatus: 'foallasu',
    vatStatus: 'alanyi_mentes',
    costRatioCategory: 'general',
    bookkeepingMode: 'egyszeres',
    registrationNumber: '',
    mainActivityCode: '',
    skilledMainActivity: false,
    orgType: null,
    isPublicBenefit: false,
    taxYear: 2026,
  });

  // Pre-populate from existing settings if available
  useEffect(() => {
    if (existingSettings) {
      setForm(f => ({
        ...f,
        taxpayerForm: existingSettings.taxpayer_form || f.taxpayerForm,
        employmentStatus: existingSettings.employment_status || f.employmentStatus,
        vatStatus: existingSettings.vat_status || f.vatStatus,
        costRatioCategory: existingSettings.cost_ratio_category || f.costRatioCategory,
        bookkeepingMode: existingSettings.bookkeeping_mode || f.bookkeepingMode,
        registrationNumber: existingSettings.registration_number || '',
        mainActivityCode: existingSettings.main_activity_code || '',
        skilledMainActivity: existingSettings.skilled_main_activity ?? false,
        orgType: existingSettings.org_type || null,
        isPublicBenefit: existingSettings.is_public_benefit ?? false,
        taxYear: existingSettings.tax_year || 2026,
      }));
    }
  }, [existingSettings]);

  const canProceed = () => {
    if (step === 0) return true;
    if (step === 1) return true;
    if (step === 2) return form.registrationNumber.length > 0 || form.orgType;
    return true;
  };

  const handleSave = () => {
    if (!id) return;

    updateSettings.mutate(
      {
        company_id: id,
        tax_year: form.taxYear,
        taxpayer_form: form.taxpayerForm,
        employment_status: form.employmentStatus,
        vat_status: form.vatStatus,
        cost_ratio_category: form.taxpayerForm === 'atalany' ? form.costRatioCategory : null,
        bookkeeping_mode: form.bookkeepingMode,
        registration_number: form.registrationNumber || null,
        main_activity_code: form.mainActivityCode || null,
        skilled_main_activity: form.skilledMainActivity,
        org_type: form.orgType,
        is_public_benefit: form.isPublicBenefit,
      },
      {
        onSuccess: () => {
          toast({
            title: 'Beállítások mentve',
            description: 'Az EV beállítások sikeresen elmentésre kerültek.',
          });
          navigate(`/accounty/client/${id}/ev`);
        },
        onError: (err) => {
          toast({
            title: 'Hiba történt',
            description: err instanceof Error ? err.message : 'Nem sikerült menteni a beállításokat.',
            variant: 'destructive',
          });
        },
      }
    );
  };

  // Step renderers
  const renderStepContent = () => {
    switch (step) {
      case 0: // Entity type
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-1">Milyen típusú entitás?</h3>
              <p className="text-sm text-slate-500">Válassza ki az ügyfél típusát az EV modul megfelelő konfigurálásához.</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                { value: null as OrgType, label: 'Egyéni vállalkozó', desc: 'Szja tv. hatálya alatti EV', icon: Briefcase },
                { value: 'egyesulet' as OrgType, label: 'Egyesület', desc: 'Civil szervezet', icon: Building2 },
                { value: 'alapitvany' as OrgType, label: 'Alapítvány', desc: 'Civil szervezet', icon: Shield },
                { value: 'tarsashaz' as OrgType, label: 'Társasház', desc: 'Közös tulajdon', icon: Building2 },
                { value: 'egyhaz' as OrgType, label: 'Egyházi szervezet', desc: 'Jogi személyiség', icon: Building2 },
                { value: 'egyeb' as OrgType, label: 'Egyéb szervezet', desc: 'Lakásszöv., MRP, stb.', icon: Building2 },
              ].map(opt => (
                <button
                  key={opt.value ?? 'ev'}
                  onClick={() => setForm(f => ({ ...f, orgType: opt.value }))}
                  className={cn(
                    'flex items-start gap-3 p-4 rounded-xl border-2 transition-all text-left',
                    form.orgType === opt.value
                      ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-900/20 ring-1 ring-indigo-200'
                      : 'border-border hover:border-indigo-200 dark:hover:border-indigo-800'
                  )}
                >
                  <div className={cn(
                    'p-2 rounded-lg transition-colors shrink-0',
                    form.orgType === opt.value
                      ? 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-400'
                  )}>
                    <opt.icon className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{opt.label}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{opt.desc}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        );

      case 1: // Tax form
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-1">Adózási forma</h3>
              <p className="text-sm text-slate-500">
                {form.orgType ? 'Szervezetek egyszeres könyvvitelt vezetnek.' : 'Milyen formában adózik a vállalkozó?'}
              </p>
            </div>

            {!form.orgType && (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {[
                    { value: 'atalany' as TaxpayerForm, label: 'Átalányadó', desc: 'Szja tv. 50–56. §', color: 'indigo' },
                    { value: 'vszja' as TaxpayerForm, label: 'Vállalkozói SZJA', desc: 'Szja tv. 49/B–49/C. §', color: 'violet' },
                    { value: 'kata' as TaxpayerForm, label: 'KATA', desc: 'KATA tv. 7–8. §', color: 'amber' },
                  ].map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => setForm(f => ({ ...f, taxpayerForm: opt.value }))}
                      className={cn(
                        'p-4 rounded-xl border-2 transition-all text-left',
                        form.taxpayerForm === opt.value
                          ? `border-${opt.color}-500 bg-${opt.color}-50/50 dark:bg-${opt.color}-900/20 ring-1 ring-${opt.color}-200`
                          : 'border-border hover:border-slate-300'
                      )}
                    >
                      <p className="text-sm font-bold text-slate-900 dark:text-slate-100">{opt.label}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{opt.desc}</p>
                    </button>
                  ))}
                </div>

                {form.taxpayerForm === 'atalany' && (
                  <div className="bg-indigo-50/50 dark:bg-indigo-900/10 rounded-xl border border-indigo-100 dark:border-indigo-800 p-4 space-y-3">
                    <p className="text-sm font-semibold text-indigo-700 dark:text-indigo-400">Költséghányad kategória</p>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { value: 'general' as CostRatio, label: '45%', desc: '2026. év általános' },
                        { value: 'high_80' as CostRatio, label: '80%', desc: 'Kiemelt tevékenység' },
                        { value: 'retail_90' as CostRatio, label: '90%', desc: 'Kiskereskedelem' },
                      ].map(opt => (
                        <button
                          key={opt.value}
                          onClick={() => setForm(f => ({ ...f, costRatioCategory: opt.value }))}
                          className={cn(
                            'p-3 rounded-lg border transition-all text-center',
                            form.costRatioCategory === opt.value
                              ? 'border-indigo-400 bg-indigo-100 dark:bg-indigo-900/30'
                              : 'border-border'
                          )}
                        >
                          <p className="text-lg font-bold text-slate-900 dark:text-slate-100">{opt.label}</p>
                          <p className="text-[10px] text-slate-500">{opt.desc}</p>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="space-y-3">
                  <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">Foglalkoztatási jogviszony</p>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { value: 'foallasu' as EmploymentStatus, label: 'Főfoglalkozás' },
                      { value: 'mellekallasu' as EmploymentStatus, label: 'Mellékállás' },
                      { value: 'kiegeszito' as EmploymentStatus, label: 'Kiegészítő (nyugdíjas)' },
                    ].map(opt => (
                      <button
                        key={opt.value}
                        onClick={() => setForm(f => ({ ...f, employmentStatus: opt.value }))}
                        className={cn(
                          'p-3 rounded-lg border transition-all text-sm font-medium',
                          form.employmentStatus === opt.value
                            ? 'border-indigo-400 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-400'
                            : 'border-border text-slate-600 dark:text-slate-400'
                        )}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-3">
                  <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">ÁFA-státusz</p>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { value: 'alanyi_mentes' as VatStatus, label: 'Alanyi mentes' },
                      { value: 'afas' as VatStatus, label: 'ÁFA-körös' },
                      { value: 'penzforgalmi' as VatStatus, label: 'Pénzforgalmi ÁFA' },
                    ].map(opt => (
                      <button
                        key={opt.value}
                        onClick={() => setForm(f => ({ ...f, vatStatus: opt.value }))}
                        className={cn(
                          'p-3 rounded-lg border transition-all text-sm font-medium',
                          form.vatStatus === opt.value
                            ? 'border-indigo-400 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-400'
                            : 'border-border text-slate-600 dark:text-slate-400'
                        )}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        );

      case 2: // Details
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-1">Részletek</h3>
              <p className="text-sm text-slate-500">Adja meg az azonosítókat és a fő tevékenységet.</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {!form.orgType && (
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-600 dark:text-slate-400">Nyilvántartási szám</label>
                  <Input
                    placeholder="EV-12345678"
                    value={form.registrationNumber}
                    onChange={e => setForm(f => ({ ...f, registrationNumber: e.target.value }))}
                    className="bg-card"
                  />
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-600 dark:text-slate-400">Fő TEÁOR / tevékenységi kód</label>
                <Input
                  placeholder="6201 - Számítógépes programozás"
                  value={form.mainActivityCode}
                  onChange={e => setForm(f => ({ ...f, mainActivityCode: e.target.value }))}
                  className="bg-card"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-600 dark:text-slate-400">Adóév</label>
                <select
                  value={form.taxYear}
                  onChange={e => setForm(f => ({ ...f, taxYear: Number(e.target.value) }))}
                  className="w-full text-sm border border-border rounded-lg px-3 py-2 bg-card text-foreground"
                >
                  <option value={2026}>2026</option>
                  <option value={2025}>2025</option>
                </select>
              </div>

              {!form.orgType && (
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-600 dark:text-slate-400">Könyvvezetés módja</label>
                  <div className="flex gap-2">
                    {[
                      { value: 'egyszeres' as BookkeepingMode, label: 'Egyszeres' },
                      { value: 'kettos' as BookkeepingMode, label: 'Kettős' },
                    ].map(opt => (
                      <button
                        key={opt.value}
                        onClick={() => setForm(f => ({ ...f, bookkeepingMode: opt.value }))}
                        className={cn(
                          'flex-1 p-2.5 rounded-lg border transition-all text-sm font-medium',
                          form.bookkeepingMode === opt.value
                            ? 'border-indigo-400 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700'
                            : 'border-border text-slate-500'
                        )}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {!form.orgType && (
              <div className="flex items-center gap-3 p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50">
                <input
                  type="checkbox"
                  id="skilled"
                  checked={form.skilledMainActivity}
                  onChange={e => setForm(f => ({ ...f, skilledMainActivity: e.target.checked }))}
                  className="rounded border-border"
                />
                <label htmlFor="skilled" className="text-sm text-slate-700 dark:text-slate-300">
                  Szakképzett tevékenység (garantált bérminimum alkalmazandó)
                </label>
              </div>
            )}

            {form.orgType && (
              <div className="flex items-center gap-3 p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50">
                <input
                  type="checkbox"
                  id="publicBenefit"
                  checked={form.isPublicBenefit}
                  onChange={e => setForm(f => ({ ...f, isPublicBenefit: e.target.checked }))}
                  className="rounded border-border"
                />
                <label htmlFor="publicBenefit" className="text-sm text-slate-700 dark:text-slate-300">
                  Közhasznú szervezet
                </label>
              </div>
            )}
          </div>
        );

      case 3: // Review
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-1">Összegzés</h3>
              <p className="text-sm text-slate-500">Ellenőrizze az adatokat a mentés előtt.</p>
            </div>

            <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-5 space-y-3">
              {[
                ['Típus', form.orgType ? form.orgType.charAt(0).toUpperCase() + form.orgType.slice(1) : 'Egyéni vállalkozó'],
                ['Adóforma', form.orgType ? 'Egyszeres könyvvitel' : form.taxpayerForm === 'atalany' ? 'Átalányadó' : form.taxpayerForm === 'vszja' ? 'Vállalkozói SZJA' : 'KATA'],
                ...(form.taxpayerForm === 'atalany' && !form.orgType ? [['Költséghányad', form.costRatioCategory === 'general' ? '45%' : form.costRatioCategory === 'high_80' ? '80%' : '90%']] : []),
                ...(!form.orgType ? [['Foglalkoztatás', form.employmentStatus === 'foallasu' ? 'Főfoglalkozás' : form.employmentStatus === 'mellekallasu' ? 'Mellékállás' : 'Kiegészítő']] : []),
                ['ÁFA', form.vatStatus === 'alanyi_mentes' ? 'Alanyi mentes' : form.vatStatus === 'afas' ? 'ÁFA-körös' : 'Pénzforgalmi'],
                ['Nyilv. szám', form.registrationNumber || '—'],
                ['Fő tevékenység', form.mainActivityCode || '—'],
                ['Adóév', String(form.taxYear)],
              ].map(([label, value]) => (
                <div key={label as string} className="flex justify-between items-center">
                  <span className="text-sm text-slate-500">{label}</span>
                  <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">{value}</span>
                </div>
              ))}
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="w-full max-w-3xl mx-auto space-y-6 animate-in fade-in duration-500">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <Link to={`/accounty/client/${id}/ev`} className="hover:text-indigo-600 transition-colors flex items-center gap-1">
          <ArrowLeft className="w-3.5 h-3.5" />
          EV Főoldal
        </Link>
        <ChevronRight className="w-3 h-3" />
        <span className="text-slate-900 dark:text-slate-100 font-medium">Beállítások</span>
      </div>

      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2.5 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl shadow-lg shadow-indigo-500/25">
          <Receipt className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">EV Beállítás varázsló</h1>
          <p className="text-sm text-slate-500">{client?.name || 'Ügyfél'}</p>
        </div>
      </div>

      {/* Stepper */}
      <div className="flex items-center gap-2">
        {STEPS.map((s, i) => (
          <React.Fragment key={s.id}>
            {i > 0 && <div className={cn('flex-1 h-px', i <= step ? 'bg-indigo-300' : 'bg-border')} />}
            <button
              onClick={() => i < step && setStep(i)}
              className={cn(
                'flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-all',
                i === step ? 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 ring-1 ring-indigo-200' :
                i < step ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 cursor-pointer' :
                'bg-slate-100 dark:bg-slate-800 text-slate-400'
              )}
            >
              {i < step ? <Check className="w-3.5 h-3.5" /> : <s.icon className="w-3.5 h-3.5" />}
              <span className="hidden sm:inline">{s.title}</span>
            </button>
          </React.Fragment>
        ))}
      </div>

      {/* Content */}
      <div className="bg-card rounded-xl border border-border shadow-soft p-6">
        {renderStepContent()}
      </div>

      {/* Navigation buttons */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => step > 0 && setStep(s => s - 1)}
          disabled={step === 0}
          className={cn(
            'flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all',
            step === 0 ? 'text-slate-300 cursor-not-allowed' : 'text-slate-600 hover:bg-slate-100'
          )}
        >
          <ChevronLeft className="w-4 h-4" /> Vissza
        </button>

        {step < STEPS.length - 1 ? (
          <button
            onClick={() => setStep(s => s + 1)}
            disabled={!canProceed()}
            className={cn(
              'flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all',
              canProceed()
                ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                : 'bg-slate-200 text-slate-400 cursor-not-allowed'
            )}
          >
            Következő <ChevronRight className="w-4 h-4" />
          </button>
        ) : (
          <button
            onClick={handleSave}
            disabled={updateSettings.isPending}
            className={cn(
              'flex items-center gap-1.5 px-5 py-2 rounded-lg text-sm font-medium transition-all',
              updateSettings.isPending
                ? 'bg-indigo-400 text-white cursor-not-allowed'
                : 'bg-indigo-600 text-white hover:bg-indigo-700'
            )}
          >
            {updateSettings.isPending ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Mentés...</>
            ) : (
              <><Save className="w-4 h-4" /> Mentés</>
            )}
          </button>
        )}
      </div>
    </div>
  );
}
