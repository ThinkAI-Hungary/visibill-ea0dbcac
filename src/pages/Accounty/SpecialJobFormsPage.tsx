import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft, Users, Briefcase, GraduationCap, Globe, Heart,
  Clock, Shield, FileText, ChevronRight, CheckCircle, Info, Save
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type JobType = 'efo' | 'megbizas' | 'tartos_megbizas' | 'vallalkozo' | 'diak' | 'nyugdijas' | 'ekho' | 'kulfoldi' | 'alkalmi' | 'hazimunka' | 'onkenyes' | 'kozfoglalkoztatas';

interface JobTypeConfig {
  id: JobType;
  code: string;
  label: string;
  desc: string;
  icon: React.ElementType;
  color: string;
  legalRef: string;
  tbStatus: string;
  fields: { key: string; label: string; type: 'text' | 'date' | 'number' | 'select' | 'checkbox'; placeholder?: string; options?: string[]; required?: boolean; helpText?: string }[];
  notes: string[];
}

const JOB_TYPES: JobTypeConfig[] = [
  {
    id: 'efo', code: '1102', label: 'Egyszerűsített foglalkoztatás (EFO)', desc: 'Alkalmi munka, mezőgazdasági/turisztikai idénymunka',
    icon: Clock, color: 'from-amber-500 to-orange-500', legalRef: 'Efo tv. 1-11. §',
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
    icon: FileText, color: 'from-blue-500 to-indigo-500', legalRef: 'Ptk. 6:272-6:280. §',
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
    icon: Briefcase, color: 'from-violet-500 to-purple-500', legalRef: 'Tbj. 4. § d)',
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
    icon: Shield, color: 'from-emerald-500 to-teal-500', legalRef: 'Tbj. 4. § b)',
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
    icon: GraduationCap, color: 'from-cyan-500 to-blue-500', legalRef: 'Tbj. 5. § (1) a)',
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
    icon: Heart, color: 'from-pink-500 to-rose-500', legalRef: 'Tbj. 4. § f)',
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
    icon: Users, color: 'from-fuchsia-500 to-pink-500', legalRef: 'Ekho tv.',
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
    icon: Globe, color: 'from-indigo-500 to-blue-600', legalRef: 'Flt. + EU 883/2004',
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
    icon: Heart, color: 'from-rose-500 to-red-500', legalRef: 'Efo tv. 1. § (4)',
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
    icon: Shield, color: 'from-slate-500 to-slate-600', legalRef: 'Kftvr. 1. §',
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
  const { id, jobType } = useParams<{ id: string; jobType: string }>();
  const config = JOB_TYPES.find(j => j.id === jobType);
  const [formData, setFormData] = useState<Record<string, string | boolean>>({});
  const [saved, setSaved] = useState(false);

  if (!config) {
    return (
      <div className="w-full max-w-4xl mx-auto space-y-6 animate-in fade-in duration-500">
        <div className="flex items-center gap-3 mb-8">
          <Link to={`/accounty/payroll/${id}/employees/new`} className="p-2 rounded-lg hover:bg-muted transition-colors"><ArrowLeft className="w-5 h-5" /></Link>
          <h1 className="text-2xl font-bold">Speciális jogviszony típusok</h1>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {JOB_TYPES.map(jt => (
            <Link key={jt.id} to={`/accounty/payroll/${id}/employees/special/${jt.id}`}
              className="p-4 rounded-xl border border-border hover:border-blue-300 hover:shadow-lg hover:-translate-y-0.5 transition-all group">
              <div className={cn('w-8 h-8 rounded-lg bg-gradient-to-br text-white flex items-center justify-center mb-2 group-hover:scale-110 transition-transform', jt.color)}>
                <jt.icon className="w-4 h-4" />
              </div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[10px] font-mono bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">{jt.code}</span>
                <p className="text-sm font-bold">{jt.label}</p>
              </div>
              <p className="text-[10px] text-slate-400">{jt.desc}</p>
              <p className="text-[10px] text-blue-500 mt-1">{jt.tbStatus}</p>
            </Link>
          ))}
        </div>
      </div>
    );
  }

  const updateField = (key: string, value: string | boolean) => setFormData(prev => ({ ...prev, [key]: value }));
  const handleSave = () => { setSaved(true); setTimeout(() => setSaved(false), 3000); };
  const isComplete = config.fields.filter(f => f.required).every(f => {
    const val = formData[f.key];
    return f.type === 'checkbox' ? true : typeof val === 'string' && val.trim();
  });

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center gap-3">
        <Link to={`/accounty/payroll/${id}/employees/special`} className="p-2 rounded-lg hover:bg-muted transition-colors"><ArrowLeft className="w-5 h-5" /></Link>
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
        <Button variant="outline" asChild><Link to={`/accounty/payroll/${id}/employees/special`}>Mégse</Link></Button>
        <Button onClick={handleSave} className={cn('gap-1.5 bg-gradient-to-r hover:opacity-90', config.color)} disabled={!isComplete}>
          <Save className="w-4 h-4" /> {saved ? 'Mentve ✓' : 'Jogviszony mentése'}
        </Button>
      </div>
    </div>
  );
}
