import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft, Users, Briefcase, GraduationCap, Globe, Heart,
  Clock, Shield, FileText, ChevronRight, CheckCircle, Info, Save, Loader2, Search, Check
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

type JobType = 'munkaviszony' | 'ev' | 'kata' | 'szakkepzes' | 'efo' | 'megbizas' | 'tartos_megbizas' | 'vallalkozo' | 'diak' | 'nyugdijas' | 'ekho' | 'kulfoldi' | 'alkalmi' | 'hazimunka' | 'onkenyes' | 'kozfoglalkoztatas';

interface JobTypeConfig {
  id: JobType;
  code: string;
  label: string;
  desc: string;
  icon: React.ElementType;
  color: string;
  legalRef: string;
  tbStatus: string;
  category: 'general' | 'special';
  fields: { key: string; label: string; type: 'text' | 'date' | 'number' | 'select' | 'checkbox'; placeholder?: string; options?: string[]; required?: boolean; helpText?: string }[];
  notes: string[];
}

const JOB_TYPES: JobTypeConfig[] = [
  {
    id: 'munkaviszony', code: '1101', label: 'Munkaviszony', desc: 'Mt. szerinti munkaszerződés alapján létrejött jogviszony',
    icon: Briefcase, color: 'from-blue-500 to-indigo-500', legalRef: 'Mt. 42-44. §', category: 'general',
    tbStatus: 'Biztosított — teljes TB és SZOCHO kötelezettség',
    fields: [
      { key: 'baseSalary', label: 'Alapbér (Ft)', type: 'number', required: true, placeholder: '322800' },
      { key: 'weeklyHours', label: 'Heti munkaidő (óra)', type: 'number', placeholder: '40', required: true },
      { key: 'startDate', label: 'Munkaviszony kezdete', type: 'date', required: true },
      { key: 'endDate', label: 'Munkaviszony vége', type: 'date', helpText: 'Határozatlan idejű esetén hagyja üresen' },
      { key: 'isFixedTerm', label: 'Határozott idejű', type: 'checkbox' },
      { key: 'probationEnd', label: 'Próbaidő vége', type: 'date', helpText: 'Max 3 hónap (KSZ-ben max 6 hó)' },
      { key: 'feorCode', label: 'FEOR kód', type: 'text', placeholder: '2512' },
      { key: 'jobTitle', label: 'Munkakör', type: 'text', placeholder: 'pl. Szoftverfejlesztő' },
    ],
    notes: ['Minimálbér 2026: 322 800 Ft (szakképzettséget igénylő: 347 400 Ft)', 'Járulékok: TB 18,5% + SZOCHO 13%', 'NAV felé T1041E bejelentés a munkaviszony létesítésekor'],
  },
  {
    id: 'efo', code: '1102', label: 'Egyszerűsített foglalkoztatás (EFO)', desc: 'Alkalmi munka, mezőgazdasági/turisztikai idénymunka',
    icon: Clock, color: 'from-amber-500 to-orange-500', legalRef: 'Efo tv. 1-11. §', category: 'special',
    tbStatus: 'Regisztrációs díjas — nem TB biztosított',
    fields: [
      { key: 'efoType', label: 'EFO típus', type: 'select', options: ['Alkalmi munka', 'Mezőgazdasági idénymunka', 'Turisztikai idénymunka', 'Filmipari alkalmi'], required: true },
      { key: 'dailyFee', label: 'Napi közteher (Ft)', type: 'number', placeholder: '2780', helpText: '2026: alkalmi 2780 Ft/nap, idény 1390 Ft/nap' },
      { key: 'maxDays', label: 'Max. munkanapok / hó', type: 'number', placeholder: '15', helpText: 'Alkalmi: 15 nap/hó, 90 nap/év' },
      { key: 'startDate', label: 'Foglalkoztatás kezdete', type: 'date', required: true },
      { key: 'endDate', label: 'Foglalkoztatás vége', type: 'date' },
    ],
    notes: ['EFO bejelentés a NAV felé T1042E nyomtatványon kell', 'Maximum 15 nap/hó, 90 nap/év alkalmi munkánál', 'A napi közteher összege fix, nem a bér alapján számol'],
  },
  {
    id: 'megbizas', code: '1113', label: 'Megbízási jogviszony', desc: 'Ptk. 6:272. § szerinti megbízási szerződés',
    icon: FileText, color: 'from-blue-500 to-indigo-500', legalRef: 'Ptk. 6:272-6:280. §', category: 'general',
    tbStatus: 'Biztosított, ha a díj eléri a minimálbér 30%-át',
    fields: [
      { key: 'contractType', label: 'Megbízás jellege', type: 'select', options: ['Eseti megbízás', 'Rendszeres megbízás', 'Választott tisztségviselő'], required: true },
      { key: 'monthlyFee', label: 'Havi megbízási díj (Ft)', type: 'number', required: true },
      { key: 'taskDescription', label: 'Feladatkör leírása', type: 'text', placeholder: 'pl. Könyvelési tanácsadás' },
      { key: 'startDate', label: 'Szerződés kezdete', type: 'date', required: true },
      { key: 'endDate', label: 'Szerződés vége', type: 'date', helpText: 'Határozatlan idejű esetén hagyja üresen' },
      { key: 'insured', label: 'TB biztosított', type: 'checkbox', helpText: 'Automatikusan igen, ha a díj ≥ minimálbér 30%' },
    ],
    notes: ['Ha a díj < minimálbér 30%, nem biztosított (csak EHO köteles)', 'Megbízottnál nincs munkaidő-nyilvántartási kötelezettség', 'SZJA: 15% + SZOCHO: 13% (ha biztosított)'],
  },
  {
    id: 'tartos_megbizas', code: '1115', label: 'Tartós megbízási jogviszony', desc: 'Ptk. 6:272. § + folyamatos, rendszeres megbízás',
    icon: Briefcase, color: 'from-violet-500 to-purple-500', legalRef: 'Tbj. 4. § d)', category: 'general',
    tbStatus: 'Biztosított — járulékköteles',
    fields: [
      { key: 'monthlyFee', label: 'Havi megbízási díj (Ft)', type: 'number', required: true },
      { key: 'weeklyHours', label: 'Heti munkavégzés ideje (óra)', type: 'number', placeholder: '10' },
      { key: 'taskDescription', label: 'Feladatkör', type: 'text', required: true },
      { key: 'startDate', label: 'Szerződés kezdete', type: 'date', required: true },
      { key: 'endDate', label: 'Szerződés vége', type: 'date' },
    ],
    notes: ['A tartós megbízás biztosítási jogviszonyt keletkeztet', '08E bejelentési kötelezettség van', 'Minimum járulékalap szabályok vonatkoznak rá'],
  },
  {
    id: 'vallalkozo', code: '1120', label: 'Társas vállalkozó / Személyes közreműködő', desc: 'Bt. beltag, Kft. tag személyes közreműködéssel',
    icon: Shield, color: 'from-emerald-500 to-teal-500', legalRef: 'Tbj. 4. § b)', category: 'special',
    tbStatus: 'Biztosított — minimum járulékalap kötelező',
    fields: [
      { key: 'companyRole', label: 'Tagi minőség', type: 'select', options: ['Kft. tag-ügyvezető', 'Bt. beltag', 'Kkt. tag', 'Szövetkezeti tag', 'Egyéni cég tagja'], required: true },
      { key: 'personalContribution', label: 'Személyes közreműködés', type: 'checkbox', helpText: 'Kötelező jelölni, ha a tagi jövedelem bérjövedelem' },
      { key: 'minimumBase', label: 'Minimum járulékalap (Ft)', type: 'number', placeholder: '322800', helpText: '2026: minimálbér (322 800 Ft) vagy garantált bérmin. (347 400 Ft)' },
      { key: 'actualSalary', label: 'Tényleges tagi jövedelem (Ft)', type: 'number', required: true },
      { key: 'startDate', label: 'Jogviszony kezdete', type: 'date', required: true },
    ],
    notes: ['Minimum járulékalap: minimálbér 100% (vagy garantált bérminimum)', 'Ha máshol is biztosított, kérhető arányosítás', 'SZOCHO + TB járulék a minimum alapon is fizetendő'],
  },
  {
    id: 'diak', code: '1130', label: 'Hallgatói munkaszerződés / Diákmunka', desc: 'Nappali tagozatos diák foglalkoztatása',
    icon: GraduationCap, color: 'from-cyan-500 to-blue-500', legalRef: 'Tbj. 5. § (1) a)', category: 'special',
    tbStatus: 'Nappali tagozat: nem biztosított (25 év alattiak kedvezménye)',
    fields: [
      { key: 'institution', label: 'Oktatási intézmény', type: 'text', required: true, placeholder: 'Budapesti Corvinus Egyetem' },
      { key: 'studentStatus', label: 'Hallgatói jogviszony', type: 'select', options: ['Nappali tagozat', 'Esti tagozat', 'Levelező tagozat'], required: true },
      { key: 'isfa', label: 'Iskolaszövetkezeten keresztül', type: 'checkbox' },
      { key: 'baseSalary', label: 'Alapbér / órabér (Ft)', type: 'number', required: true },
      { key: 'weeklyHours', label: 'Heti munkaidő (óra)', type: 'number', placeholder: '20' },
      { key: 'startDate', label: 'Foglalkoztatás kezdete', type: 'date', required: true },
      { key: 'expectedEndDate', label: 'Tanulmányok várható befejezése', type: 'date' },
    ],
    notes: ['Nappali tagozatos 25 év alatt: SZJA mentes a bruttó átlagkeresetig', 'Iskolaszövetkezeti foglalkoztatásnál nincs biztosítási jogviszony', 'A hallgatói jogviszony igazolást érdemes bebekérni'],
  },
  {
    id: 'nyugdijas', code: '1141', label: 'Nyugdíjas foglalkoztatott', desc: 'Öregségi nyugdíj mellett munkát végző személy',
    icon: Heart, color: 'from-pink-500 to-rose-500', legalRef: 'Tbj. 4. § f)', category: 'special',
    tbStatus: 'Biztosított, de SZOCHO mentes (ha saját jogú nyugdíjas)',
    fields: [
      { key: 'pensionType', label: 'Nyugdíj típusa', type: 'select', options: ['Öregségi nyugdíj', 'Nők 40 év', 'Korkedvezményes', 'Rokkantsági ellátás', 'Özvegyi nyugdíj'], required: true },
      { key: 'pensionStartDate', label: 'Nyugdíj kezdete', type: 'date', required: true },
      { key: 'baseSalary', label: 'Alapbér (Ft)', type: 'number', required: true },
      { key: 'weeklyHours', label: 'Heti munkaidő (óra)', type: 'number', placeholder: '20' },
      { key: 'startDate', label: 'Foglalkoztatás kezdete', type: 'date', required: true },
    ],
    notes: ['Saját jogú öregségi nyugdíjas: SZOCHO mentes', 'TB járulék: 18,5% fizetendő', 'Öregségi nyugdíjas nem szüntetheti meg a jogviszonyt próbaidővel'],
  },
  {
    id: 'ekho', code: '1150', label: 'EKHO — Egyszerűsített közteherviselés', desc: 'Előadóművészek, sportolók kedvezményes adózása',
    icon: Users, color: 'from-fuchsia-500 to-pink-500', legalRef: 'Ekho tv.', category: 'special',
    tbStatus: 'Különleges TB státusz — EKHO közteher',
    fields: [
      { key: 'ekhoCategory', label: 'EKHO kategória', type: 'select', options: ['Előadóművész', 'Sportoló', 'Edző', 'Filmipari munkakör'], required: true },
      { key: 'monthlyIncome', label: 'Havi jövedelem (Ft)', type: 'number', required: true },
      { key: 'ekhoRate', label: 'EKHO mértéke', type: 'select', options: ['15% (biztosított)', '13% (nem biztosított)'], required: true },
      { key: 'startDate', label: 'Jogviszony kezdete', type: 'date', required: true },
    ],
    notes: ['EKHO választásra jogosultak köre szűk — TEÁOR/FEOR ellenőrzés szükséges', 'Éves jövedelemkorlát: bruttó átlagkereset 60%-a x 12 hónap', 'Felette: normál SZJA+járulék kötelezettség'],
  },
  {
    id: 'kulfoldi', code: '1160', label: 'Külföldi munkavállaló', desc: 'EGT/harmadik országbeli munkavállaló Magyarországon',
    icon: Globe, color: 'from-indigo-500 to-blue-600', legalRef: 'Flt. + EU 883/2004', category: 'special',
    tbStatus: 'A1 igazolás vagy magyar TB jogviszony',
    fields: [
      { key: 'nationality', label: 'Állampolgárság', type: 'text', required: true, placeholder: 'pl. Román, Ukrán, Szerb' },
      { key: 'egtMember', label: 'EGT/EU tagállam polgár', type: 'checkbox' },
      { key: 'workPermitType', label: 'Munkavállalási engedély', type: 'select', options: ['Nem szükséges (EGT)', 'Összevont engedély', 'EU Kék kártya', 'Szezonális munkavállalási engedély', 'ICT engedély'], required: true },
      { key: 'workPermitNumber', label: 'Engedély száma', type: 'text', placeholder: 'MW-2026-12345' },
      { key: 'workPermitExpiry', label: 'Engedély érvényesség', type: 'date' },
      { key: 'a1Certificate', label: 'A1 igazolás van', type: 'checkbox', helpText: 'Ha van, a küldő ország TB rendszere alkalmazandó' },
      { key: 'hunTaxId', label: 'Magyar adóazonosító jel', type: 'text', placeholder: '1234567890' },
      { key: 'baseSalary', label: 'Alapbér (Ft)', type: 'number', required: true },
      { key: 'startDate', label: 'Foglalkoztatás kezdete', type: 'date', required: true },
    ],
    notes: ['EGT polgár: szabad munkavállalás, nem kell engedély', 'Harmadik országbeli: összevont engedély szükséges (kivételek vannak)', 'A1 igazolás esetén TB járulék a küldő országban fizetendő', 'NAV felé 08E bejelentés kötelező'],
  },
  {
    id: 'alkalmi', code: '1170', label: 'Háztartási alkalmazott', desc: 'Természetes személy háztartásában végzett munka',
    icon: Heart, color: 'from-rose-500 to-red-500', legalRef: 'Efo tv. 1. § (4)', category: 'special',
    tbStatus: 'Regisztrációs díjas — nem TB biztosított',
    fields: [
      { key: 'employerName', label: 'Foglalkoztató (magánszemély) neve', type: 'text', required: true },
      { key: 'employerTaxId', label: 'Foglalkoztató adóazonosítója', type: 'text', required: true },
      { key: 'taskType', label: 'Tevékenység', type: 'select', options: ['Takarítás', 'Gyermekfelügyelet', 'Idősgondozás', 'Kertészet', 'Egyéb háztartási munka'], required: true },
      { key: 'dailyFee', label: 'Napi regisztrációs díj (Ft)', type: 'number', placeholder: '1390' },
      { key: 'startDate', label: 'Foglalkoztatás kezdete', type: 'date', required: true },
    ],
    notes: ['Természetes személy háztartásában végezhető', 'Napi regisztrációs díj: 1 390 Ft/nap (2026)', 'Havi max. 15 nap foglalkoztatás lehetséges'],
  },
  {
    id: 'kozfoglalkoztatas', code: '1180', label: 'Közfoglalkoztatás', desc: 'Önkormányzati / állami közfoglalkoztatási jogviszony',
    icon: Shield, color: 'from-slate-500 to-slate-600', legalRef: 'Kftvr. 1. §', category: 'special',
    tbStatus: 'Biztosított — speciális járulékszabályok',
    fields: [
      { key: 'programName', label: 'Közfoglalkoztatási program neve', type: 'text', required: true },
      { key: 'organizerName', label: 'Szervező neve', type: 'text', required: true },
      { key: 'dailyWorkHours', label: 'Napi munkaidő (óra)', type: 'select', options: ['6 óra', '8 óra'], required: true },
      { key: 'monthlySalary', label: 'Közfoglalkoztatási bér (Ft)', type: 'number', placeholder: '161400', helpText: '2026: közfoglalkoztatási bér 161 400 Ft (6 óra) / 215 200 Ft (8 óra)' },
      { key: 'startDate', label: 'Jogviszony kezdete', type: 'date', required: true },
      { key: 'endDate', label: 'Jogviszony vége', type: 'date', required: true },
    ],
    notes: ['A közfoglalkoztatási bér fix összeg, nem a minimálbér', 'Határozott idejű, max. 12 hónap', 'Speciális járulékszabályok — kedvezményes SZOCHO'],
  },
];

export default function SpecialJobFormsPage() {
  const { companyId, empId, jobType } = useParams<{ companyId: string; empId: string; jobType: string }>();
  const id = companyId;
  const config = JOB_TYPES.find(j => j.id === jobType);
  const { toast } = useToast();
  const [formData, setFormData] = useState<Record<string, string | boolean>>({});
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  const updateField = (key: string, value: string | boolean) => setFormData(prev => ({ ...prev, [key]: value }));

  if (!config) {
    return <JobTypePicker id={id || ''} empId={empId || ''} />;
  }

  const handleSave = async () => {
    if (!isComplete || !id || !empId) return;

    if (formData.weeklyHours) {
      const hours = Number(formData.weeklyHours);
      if (isNaN(hours) || hours <= 0 || hours > 168) {
        toast({ variant: 'destructive', title: 'Hiba', description: 'A heti munkaidő maximum 168 óra lehet!' });
        return;
      }
    }

    setSaving(true);
    try {
      const { error: jobErr } = await (await import('@/integrations/supabase/client')).supabase
        .from('accounty_employments')
        .insert({
          employee_id: empId,
          company_id: id,
          employment_type: config.label,
          job_code: config.code,
          job_title: config.label,
          weekly_hours: Number(formData.weeklyHours) || 40,
          start_date: (formData.startDate as string) || new Date().toISOString().slice(0, 10),
          end_date: (formData.endDate as string) || null,
          base_salary: Number(formData.baseSalary || formData.monthlyFee || formData.actualSalary || formData.monthlySalary || formData.dailyFee || formData.monthlyIncome) || 0,
          status: 'active',
          metadata: formData,
        });

      if (jobErr) throw jobErr;

      toast({ title: 'Jogviszony létrehozva ', description: `${config.label} — ${config.code}` });
      setSaved(true);
      setTimeout(() => {
        window.location.href = `/eaisybooks/payroll/${id}/employees/${empId}`;
      }, 1500);
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Hiba a mentésnél', description: err.message });
    } finally {
      setSaving(false);
    }
  };
  const isComplete = config.fields.filter(f => f.required).every(f => {
    const val = formData[f.key];
    return f.type === 'checkbox' ? true : typeof val === 'string' && val.trim();
  });

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center gap-3">
        <button onClick={() => window.history.back()} className="p-2 rounded-lg hover:bg-muted transition-colors"><ArrowLeft className="w-5 h-5" /></button>
        <div className={cn('p-2.5 bg-gradient-to-br rounded-xl shadow-lg', config.color)}><config.icon className="w-5 h-5 text-white" /></div>
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">{config.code}</span>
            <h1 className="text-2xl font-bold">{config.label}</h1>
          </div>
          <p className="text-sm text-slate-500">{config.legalRef}</p>
        </div>
      </div>

      <div className="bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 rounded-xl p-4 text-sm text-blue-800 dark:text-blue-300 flex items-start gap-2">
        <Info className="w-4 h-4 mt-0.5 shrink-0" />
        <div><strong>TB státusz:</strong> {config.tbStatus}</div>
      </div>

      <div className="bg-card rounded-xl border border-border p-6 space-y-4">
        <h2 className="text-sm font-bold text-slate-700 dark:text-slate-300">Jogviszony adatai</h2>
        <div className="grid grid-cols-2 gap-4">
          {config.fields.map(f => (
            <div key={f.key} className={f.type === 'checkbox' ? 'col-span-2' : ''}>
              {f.type === 'checkbox' ? (
                <label className="flex items-center gap-2 cursor-pointer p-3 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50">
                  <input type="checkbox" checked={!!formData[f.key]} onChange={e => updateField(f.key, e.target.checked)} className="rounded" />
                  <div>
                    <span className="text-sm font-medium">{f.label}</span>
                    {f.helpText && <p className="text-[10px] text-slate-400">{f.helpText}</p>}
                  </div>
                </label>
              ) : (
                <>
                  <label className="text-xs text-slate-500 mb-1 block">{f.label} {f.required && <span className="text-red-500">*</span>}</label>
                  {f.type === 'select' ? (
                    <select value={(formData[f.key] as string) || ''} onChange={e => updateField(f.key, e.target.value)} className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:ring-2 focus:ring-blue-500 outline-none">
                      <option value="">Válasszon...</option>
                      {f.options?.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                    </select>
                  ) : (
                    <input type={f.type} value={(formData[f.key] as string) || ''} onChange={e => updateField(f.key, e.target.value)} placeholder={f.placeholder}
                      className={cn('w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:ring-2 focus:ring-blue-500 outline-none', f.type === 'number' && 'font-mono')} />
                  )}
                  {f.helpText && <p className="text-[10px] text-slate-400 mt-1">{f.helpText}</p>}
                </>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="bg-card rounded-xl border border-border p-5">
        <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-3">Tudnivalók</h3>
        <div className="space-y-1.5">
          {config.notes.map((n, i) => (
            <div key={i} className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-400">
              <CheckCircle className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" /> {n}
            </div>
          ))}
        </div>
      </div>

      <div className="flex justify-end gap-3">
        <Button variant="outline" onClick={() => window.history.back()}>Mégse</Button>
        <Button onClick={handleSave} className={cn('gap-1.5 bg-gradient-to-r hover:opacity-90', config.color)} disabled={!isComplete || saving}>
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} {saving ? 'Mentés...' : saved ? 'Mentve ' : 'Jogviszony mentése'}
        </Button>
      </div>
    </div>
  );
}

// ── Picker sub-component ──

const ALL_EMPLOYMENT_TYPES = [
  { value: 'munkaviszony', label: 'Munkaviszony (Mt.)', code: '1101', desc: 'Klasszikus munkaviszony', icon: '', group: 'Munkaviszony' },
  { value: 'munkaviszony_reszido', label: 'Részmunkaidős munkaviszony', code: '1101', desc: 'Mt. szerinti, csökkentett óraszám', icon: '', group: 'Munkaviszony' },
  { value: 'bedolgozo', label: 'Bedolgozói jogviszony', code: '1101', desc: 'Otthoni munkavégzés, Mt. speciális', icon: '', group: 'Munkaviszony' },
  { value: 'munkaero_kolcsonzes', label: 'Munkaerő-kölcsönzés', code: '1101', desc: 'Kölcsönbeadó által foglalkoztatott', icon: '', group: 'Munkaviszony' },
  { value: 'szakkepzes', label: 'Szakképzési munkaszerződés', code: '1131', desc: 'Szkt. szerinti tanulói jogviszony', icon: '', group: 'Munkaviszony' },
  { value: 'osztondijas', label: 'Ösztöndíjas foglalkoztatott', code: '1140', desc: 'Gyakornoki / ösztöndíjas jogviszony', icon: '', group: 'Munkaviszony' },
  { value: 'neveloszulo', label: 'Nevelőszülő', code: '1150', desc: 'Nevelőszülői foglalkoztatási jogviszony', icon: '', group: 'Munkaviszony' },
  { value: 'alkalmi', label: 'Háztartási alkalmazott', code: '1190', desc: 'Háztartási munkára irányuló egyszerűsített fogl.', icon: '', group: 'Munkaviszony' },
  { value: 'kozfoglalkoztatas', label: 'Közalkalmazott (Kjt.)', code: '1201', desc: 'Önkormányzat, iskola, kórház, kultúra', icon: '', group: 'Közszféra' },
  { value: 'kozszolgalati', label: 'Köztisztviselő (Kttv.)', code: '1220', desc: 'Államigazgatási szerv, jegyző', icon: '', group: 'Közszféra' },
  { value: 'kormanytisztviselo', label: 'Kormánytisztviselő (Kit.)', code: '1210', desc: 'Kormányzati igazgatási szerv', icon: '', group: 'Közszféra' },
  { value: 'biro_ugyesz', label: 'Bíró, ügyész, igazságügyi alk.', code: '1120', desc: 'Igazságszolgáltatási jogviszony', icon: '', group: 'Közszféra' },
  { value: 'hivatasos_katona', label: 'Hivatásos/szerződéses katona', code: '1130', desc: 'Honvédelmi jogviszony (Hjt.)', icon: '', group: 'Közszféra' },
  { value: 'egyhazi', label: 'Egyházi személy', code: '1500', desc: 'Egyházi szolgálati jogviszony', icon: '', group: 'Közszféra' },
  { value: 'kozfogl_program', label: 'Közfoglalkoztatás', code: '1600', desc: 'Közfoglalkoztatási jogviszony', icon: '', group: 'Közszféra' },
  { value: 'premiumevek', label: 'Prémiumévek program', code: '1240', desc: 'Nyugdíj előtti foglalkoztatási program', icon: '', group: 'Közszféra' },
  { value: 'tartos_megbizas', label: 'Tartós megbízás (ÚJ 2026)', code: '1115', desc: 'Előzetes bejelentés, biztosított', icon: '', group: 'Megbízás', isNew: true },
  { value: 'megbizas', label: 'Megbízási jogviszony', code: '1300', desc: 'Ptk. szerinti megbízás (biztosított)', icon: '', group: 'Megbízás' },
  { value: 'megbizas_eseti', label: 'Eseti megbízás (nem biztosított)', code: '1301', desc: 'Ptk. megbízás, nem éri el a bizt. küszöböt', icon: '', group: 'Megbízás' },
  { value: 'valasztott_tisztsegviselo', label: 'Választott tisztségviselő', code: '1350', desc: 'Önkormányzati, társasházi, alapítványi', icon: '', group: 'Megbízás' },
  { value: 'vallalkozo', label: 'Társas vállalkozó (főfogl.)', code: '1451', desc: 'Személyesen közreműködő tag, főállás', icon: '', group: 'Vállalkozó' },
  { value: 'tarsas_vallalkozo_mellekfogl', label: 'Társas vállalkozó (mellékfogl.)', code: '1452', desc: 'Mellékfoglalkozású társas vállalkozó', icon: '', group: 'Vállalkozó', tag: 'KEDV' },
  { value: 'ev', label: 'Egyéni vállalkozó (főfogl.)', code: '1470', desc: 'Főállású egyéni vállalkozó', icon: '', group: 'Vállalkozó' },
  { value: 'ev_mellekfogl', label: 'Egyéni vállalkozó (mellékfogl.)', code: '1471', desc: 'Mellékfoglalkozású EV', icon: '', group: 'Vállalkozó', tag: 'KEDV' },
  { value: 'szovetkezeti_tag', label: 'Szövetkezeti tag', code: '1460', desc: 'Szövetkezetben személyesen közreműködő', icon: '', group: 'Vállalkozó' },
  { value: 'iskolaszovetkezet', label: 'Iskolaszövetkezeti tag', code: '1464', desc: 'Diákmunka iskolaszövetkezeten keresztül', icon: '', group: 'Vállalkozó' },
  { value: 'efo', label: 'Egyszerűsített foglalkoztatás (EFO)', code: 'EFO', desc: 'Alkalmi munka, mezőgazdasági idénymunka', icon: '', group: 'Speciális' },
  { value: 'nyugdijas', label: 'Nyugdíjas munkavállaló', code: '1101', desc: 'Öregségi nyugdíj mellett, SZOCHO/járulék kedv.', icon: '', group: 'Speciális', tag: 'KEDV' },
  { value: 'gyes_gyed', label: 'GYES/GYED melletti fogl.', code: '1101', desc: 'Gyermekgondozási ellátás mellett dolgozó', icon: '', group: 'Speciális', tag: 'KEDV' },
  { value: 'kulfoldi', label: 'Külföldi kiküldetés (expat)', code: '1101', desc: 'Kiküldetés EGT/harmadik országba', icon: '', group: 'Speciális' },
  { value: 'diak', label: 'Hallgatói munkaszerződés / Diákmunka', code: '1130', desc: 'Nappali tagozatos diák foglalkoztatása', icon: '', group: 'Speciális' },
  { value: 'ekho', label: 'EKHO — Egyszerűsített közteherviselés', code: '1150', desc: 'Előadóművészek, sportolók kedvezményes adózása', icon: '', group: 'Speciális' },
  { value: 'segito_csaladtag', label: 'Segítő családtag', code: '1800', desc: 'Családi gazdaságban segítő rokon', icon: '', group: 'Speciális' },
  { value: 'onkentes', label: 'Közérdekű önkéntes', code: '1900', desc: 'Díjazás nélküli önkéntes tevékenység', icon: '', group: 'Speciális' },
];

function JobTypePicker({ id, empId }: { id: string; empId: string }) {
  const [search, setSearch] = useState('');
  const [activeGroup, setActiveGroup] = useState('Mind');

  const groups = ['Mind', ...Array.from(new Set(ALL_EMPLOYMENT_TYPES.map(t => t.group)))];
  const filtered = ALL_EMPLOYMENT_TYPES.filter(t => {
    const matchGroup = activeGroup === 'Mind' || t.group === activeGroup;
    const matchSearch = !search || t.label.toLowerCase().includes(search.toLowerCase()) || t.desc.toLowerCase().includes(search.toLowerCase()) || t.code.toLowerCase().includes(search.toLowerCase());
    return matchGroup && matchSearch;
  });

  // Map value to JOB_TYPES id for the form URL, fallback to 'munkaviszony'
  const getFormId = (value: string) => {
    const match = JOB_TYPES.find(jt => jt.id === value);
    return match ? match.id : 'munkaviszony';
  };

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center gap-3 mb-4">
        <button onClick={() => window.history.back()} className="p-2 rounded-lg hover:bg-muted transition-colors"><ArrowLeft className="w-5 h-5" /></button>
        <h1 className="text-2xl font-bold">Új jogviszony típusa</h1>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="text"
          placeholder="Keresés jogviszony neve, kódja alapján..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 text-sm bg-card border border-border rounded-lg outline-none focus:ring-2 focus:ring-primary/30 text-slate-900 dark:text-slate-100 placeholder:text-slate-400"
        />
      </div>

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
            {g} {g !== 'Mind' ? `(${ALL_EMPLOYMENT_TYPES.filter(t => t.group === g).length})` : `(${ALL_EMPLOYMENT_TYPES.length})`}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[520px] overflow-y-auto pr-1">
        {filtered.map(type => (
          <Link
            key={type.value}
            to={`/eaisybooks/payroll/${id}/employees/${empId}/special/${getFormId(type.value)}`}
            className="relative flex items-start gap-3 p-4 rounded-xl border-2 border-border text-left transition-all duration-200 hover:border-primary/30 hover:shadow-md group"
          >
            <span className="text-2xl">{type.icon}</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <p className="text-sm font-bold text-slate-900 dark:text-slate-100 group-hover:text-primary transition-colors">{type.label}</p>
                {(type as any).isNew && (
                  <span className="px-1.5 py-0.5 text-[9px] font-bold bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400 rounded-full uppercase">ÚJ</span>
                )}
                {(type as any).tag === 'KEDV' && (
                  <span className="px-1.5 py-0.5 text-[9px] font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400 rounded-full uppercase">KEDV</span>
                )}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{type.desc}</p>
              <p className="text-[10px] font-mono text-primary mt-1">Kód: {type.code}</p>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-300 dark:text-slate-600 mt-1 opacity-0 group-hover:opacity-100 transition-opacity" />
          </Link>
        ))}
        {filtered.length === 0 && (
          <p className="col-span-full text-center text-sm text-slate-400 py-8">Nincs találat a keresésre.</p>
        )}
      </div>
    </div>
  );
}
