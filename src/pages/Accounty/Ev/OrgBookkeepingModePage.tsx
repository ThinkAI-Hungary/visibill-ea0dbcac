import React, { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft, ChevronRight, BookOpen, Building2, Calculator,
  CheckCircle2, AlertTriangle, Info, Scale, ArrowRight,
  FileText, Landmark, Shield, HelpCircle
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAccountyClient } from '@/hooks/accounty';

type BookkeepingMode = 'single' | 'double';

interface ModeOption {
  id: BookkeepingMode;
  name: string;
  subtitle: string;
  legalRef: string;
  description: string;
  conditions: string[];
  advantages: string[];
  icon: React.ElementType;
  color: string;
}

const MODES: ModeOption[] = [
  {
    id: 'single',
    name: 'Egyszeres könyvvitel',
    subtitle: 'Pénzforgalmi szemlélet',
    legalRef: 'Szt. 161. § (1)',
    description: 'A bevételek és kiadások tényleges pénzmozgáskor kerülnek rögzítésre. Egyszerűbb adminisztráció, kisebb szervezeteknek ideális.',
    conditions: [
      'Éves nettó árbevétel < 300 M Ft',
      'Nem kötelezett könyvvizsgálatra',
      'Nem részvénytársaság',
      'Nem tartozik konszolidálásba',
    ],
    advantages: [
      'Egyszerűbb adminisztráció',
      'Pénztárkönyv alapú nyilvántartás',
      'Kisebb könyvelési költség',
      'Gyorsabb időszaki zárás',
    ],
    icon: BookOpen,
    color: 'from-indigo-500 to-violet-600',
  },
  {
    id: 'double',
    name: 'Kettős könyvvitel',
    subtitle: 'Eredményszemléletű',
    legalRef: 'Szt. 12. § (1)',
    description: 'Minden gazdasági esemény kettős könyvelési tételként kerül rögzítésre. Átfogóbb pénzügyi kép, nagyobb szervezeteknek kötelező.',
    conditions: [
      'Éves nettó árbevétel ≥ 300 M Ft',
      'Könyvvizsgálatra kötelezett',
      'Részvénytársaság',
      'Konszolidálásba bevont vállalkozás',
    ],
    advantages: [
      'Átfogóbb pénzügyi kimutatás',
      'Mérleg- és eredménykimutatás',
      'Jobb döntéstámogatás',
      'Hitelezői elvárásoknak megfelel',
    ],
    icon: Calculator,
    color: 'from-emerald-500 to-teal-600',
  },
];

const ORG_TYPES = [
  { id: 'association', name: 'Egyesület', icon: Building2, rules: 'Egyszeres vagy kettős', typical: 'single' as BookkeepingMode },
  { id: 'foundation', name: 'Alapítvány', icon: Shield, rules: 'Egyszeres vagy kettős', typical: 'single' as BookkeepingMode },
  { id: 'condominium', name: 'Társasház', icon: Landmark, rules: 'Egyszeres kötelező', typical: 'single' as BookkeepingMode },
  { id: 'cooperative', name: 'Szövetkezet', icon: Building2, rules: 'Kettős kötelező', typical: 'double' as BookkeepingMode },
  { id: 'nonprofit', name: 'Nonprofit Kft.', icon: Building2, rules: 'Kettős kötelező', typical: 'double' as BookkeepingMode },
  { id: 'church', name: 'Egyházi jogi személy', icon: Landmark, rules: 'Egyszeres vagy kettős', typical: 'single' as BookkeepingMode },
  { id: 'other', name: 'Egyéb szervezet', icon: FileText, rules: 'Mérlegelés szükséges', typical: 'single' as BookkeepingMode },
];

export default function OrgBookkeepingModePage() {
  const { id } = useParams<{ id: string }>();
  const { data: client } = useAccountyClient(id);
  const [selectedMode, setSelectedMode] = useState<BookkeepingMode | null>(null);
  const [selectedOrgType, setSelectedOrgType] = useState<string | null>(null);

  return (
    <div className="w-full space-y-6 animate-in fade-in duration-500">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <Link to={`/accounty/client/${id}/ev`} className="hover:text-primary transition-colors flex items-center gap-1">
          <ArrowLeft className="w-3.5 h-3.5" /> EV Áttekintés
        </Link>
        <ChevronRight className="w-3 h-3" />
        <span className="text-slate-900 dark:text-slate-100 font-medium">Könyvvezetési mód</span>
      </div>

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Könyvvezetési mód választó</h1>
        <p className="text-sm text-slate-500 mt-1">
          {client?.name || 'Szervezet'} · Határozza meg a könyvvezetés módját a szervezeti forma és törvényi feltételek alapján.
        </p>
      </div>

      {/* Organization type selector */}
      <div className="bg-card rounded-xl border border-border p-5 space-y-4">
        <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
          <Building2 className="w-4 h-4 text-primary" /> Szervezeti forma kiválasztása
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {ORG_TYPES.map(org => {
            const Icon = org.icon;
            const isSelected = selectedOrgType === org.id;
            return (
              <button
                key={org.id}
                onClick={() => {
                  setSelectedOrgType(org.id);
                  setSelectedMode(org.typical);
                }}
                className={cn(
                  'flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all text-center',
                  isSelected
                    ? 'border-primary bg-primary/5 shadow-sm'
                    : 'border-border hover:border-primary/30 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                )}
              >
                <Icon className={cn('w-5 h-5', isSelected ? 'text-primary' : 'text-slate-400')} />
                <span className={cn('text-xs font-semibold', isSelected ? 'text-primary' : 'text-slate-700 dark:text-slate-300')}>{org.name}</span>
                <span className="text-[10px] text-slate-400">{org.rules}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Mode comparison */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {MODES.map(mode => {
          const Icon = mode.icon;
          const isSelected = selectedMode === mode.id;
          return (
            <button
              key={mode.id}
              onClick={() => setSelectedMode(mode.id)}
              className={cn(
                'bg-card rounded-xl border-2 p-5 text-left transition-all group',
                isSelected
                  ? 'border-primary shadow-lg shadow-primary/10'
                  : 'border-border hover:border-primary/30 hover:shadow-md'
              )}
            >
              {/* Header */}
              <div className="flex items-center gap-3 mb-4">
                <div className={cn('p-2.5 rounded-xl bg-gradient-to-br shadow-sm', mode.color)}>
                  <Icon className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">{mode.name}</h3>
                    {isSelected && <CheckCircle2 className="w-4 h-4 text-primary" />}
                  </div>
                  <p className="text-xs text-slate-500">{mode.subtitle} · {mode.legalRef}</p>
                </div>
              </div>

              <p className="text-xs text-slate-600 dark:text-slate-400 mb-4">{mode.description}</p>

              {/* Conditions */}
              <div className="mb-3">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                  {mode.id === 'single' ? 'Alkalmazási feltételek' : 'Kötelező, ha'}
                </p>
                <ul className="space-y-1">
                  {mode.conditions.map((c, i) => (
                    <li key={i} className="flex items-start gap-1.5 text-xs text-slate-600 dark:text-slate-400">
                      <span className={cn('w-1 h-1 rounded-full mt-1.5 shrink-0', mode.id === 'single' ? 'bg-indigo-400' : 'bg-emerald-400')} />
                      {c}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Advantages */}
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">Előnyök</p>
                <ul className="space-y-1">
                  {mode.advantages.map((a, i) => (
                    <li key={i} className="flex items-start gap-1.5 text-xs text-slate-600 dark:text-slate-400">
                      <CheckCircle2 className="w-3 h-3 mt-0.5 shrink-0 text-green-500" />
                      {a}
                    </li>
                  ))}
                </ul>
              </div>
            </button>
          );
        })}
      </div>

      {/* Decision result */}
      {selectedMode && selectedOrgType && (
        <div className={cn(
          'rounded-xl border p-5 animate-in slide-in-from-bottom-4 duration-300',
          'bg-primary/5 border-primary/20'
        )}>
          <div className="flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-primary mt-0.5 shrink-0" />
            <div className="flex-1 space-y-2">
              <p className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Javasolt könyvvezetési mód: {MODES.find(m => m.id === selectedMode)?.name}
              </p>
              <p className="text-xs text-slate-600 dark:text-slate-400">
                A kiválasztott szervezeti forma ({ORG_TYPES.find(o => o.id === selectedOrgType)?.name})
                és a törvényi feltételek alapján a(z) {selectedMode === 'single' ? 'egyszeres' : 'kettős'} könyvvitel alkalmazása javasolt.
              </p>
              <div className="flex items-center gap-2 pt-2">
                <button className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-primary rounded-lg hover:bg-primary/90 transition-colors shadow-sm">
                  Beállítás mentése <ArrowRight className="w-3.5 h-3.5" />
                </button>
                <button className="flex items-center gap-1.5 px-4 py-2 text-sm text-slate-600 border border-border rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                  <HelpCircle className="w-3.5 h-3.5" /> Részletes tájékoztató
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Legal info */}
      <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4">
        <div className="flex items-start gap-2">
          <Scale className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
          <div className="text-xs text-amber-700 dark:text-amber-400 space-y-1">
            <p className="font-semibold">Számviteli törvény (2000. évi C. tv.) — 161. §</p>
            <p>Az egyszeres könyvvitel alkalmazásának feltételei jogszabályban meghatározottak. A könyvvezetési mód megváltoztatása az üzleti év végén, a mérleg fordulónapjával történhet.</p>
            <p className="text-amber-600/70">A döntés módosítása adóéven belül nem lehetséges. Kérjük, körültekintően válasszon!</p>
          </div>
        </div>
      </div>
    </div>
  );
}
