import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Rocket, CheckCircle2, Circle, ArrowRight, Building2, Shield, Settings, Users, FileText, CalendarCheck, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface Step {
  id: string;
  title: string;
  description: string;
  icon: React.ElementType;
  route?: string;
  isComplete: boolean;
}

const STORAGE_KEY = 'accounty-onboarding-progress';

function getProgress(): Record<string, boolean> {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
  } catch { return {}; }
}

function setProgress(id: string, done: boolean) {
  const p = getProgress();
  p[id] = done;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
}

export default function OnboardingPage() {
  const navigate = useNavigate();
  const [progress, setProgressState] = useState(getProgress());

  const steps: Step[] = [
    {
      id: 'company',
      title: 'Cég-adatok rögzítése',
      description: 'Alapadatok, adószám, székhely, képviselő megadása.',
      icon: Building2,
      isComplete: progress.company || false,
    },
    {
      id: 'cegkapu',
      title: 'Cégkapu / KÜNY beállítás',
      description: 'Cégkapu hozzáférés konfigurálása az automatikus bevallás-beadáshoz.',
      icon: Shield,
      isComplete: progress.cegkapu || false,
    },
    {
      id: 'authorization',
      title: 'Meghatalmazás bejelentése',
      description: 'NAV-hoz benyújtandó meghatalmazás a bérszámfejtéshez.',
      icon: FileText,
      isComplete: progress.authorization || false,
    },
    {
      id: 'payroll_settings',
      title: 'Bérszámfejtési beállítások',
      description: 'Kifizetési napok, banki paraméterek, juttatási politikák.',
      icon: Settings,
      isComplete: progress.payroll_settings || false,
    },
    {
      id: 'employees',
      title: 'Foglalkoztatottak importálása',
      description: 'Excel import vagy egyenkénti felvétel a foglalkoztatotti törzsbe.',
      icon: Users,
      isComplete: progress.employees || false,
    },
    {
      id: 'tax_declarations',
      title: 'Adóelőleg-nyilatkozatok bekérése',
      description: 'Családi kedvezmény, személyi kedvezmény és egyéb nyilatkozatok.',
      icon: CalendarCheck,
      isComplete: progress.tax_declarations || false,
    },
    {
      id: 'first_cycle',
      title: 'Első havi ciklus indítása',
      description: 'Az első bérszámfejtési ciklus előkészítése és futtatása.',
      icon: Play,
      isComplete: progress.first_cycle || false,
    },
  ];

  const completedCount = steps.filter(s => s.isComplete).length;
  const progressPct = Math.round((completedCount / steps.length) * 100);

  const toggleStep = (id: string) => {
    const newVal = !progress[id];
    setProgress(id, newVal);
    setProgressState(prev => ({ ...prev, [id]: newVal }));
  };

  return (
    <div className="w-full space-y-8 animate-in fade-in duration-500 max-w-3xl mx-auto">
      {/* Header */}
      <div className="text-center">
        <div className="p-3 bg-gradient-to-br from-primary to-violet-600 rounded-2xl shadow-lg shadow-primary/25 w-fit mx-auto mb-4">
          <Rocket className="w-7 h-7 text-white" />
        </div>
        <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100 mb-2">Üdvözlünk az eaisybooks-ban!</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 max-w-lg mx-auto">
          Az alábbi lépések segítenek a rendszer teljes beállításában. Haladj sorban, vagy ugorj bármelyik lépésre.
        </p>
      </div>

      {/* Progress bar */}
      <div className="bg-card rounded-xl border border-border p-5 shadow-soft">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Előrehaladás</p>
          <span className="text-sm font-bold text-primary">{completedCount} / {steps.length}</span>
        </div>
        <div className="h-3 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-primary to-violet-500 rounded-full transition-all duration-700 ease-out"
            style={{ width: `${progressPct}%` }}
          />
        </div>
        {progressPct === 100 && (
          <p className="text-xs text-green-600 dark:text-green-400 mt-2 font-medium"> Minden beállítás kész!</p>
        )}
      </div>

      {/* Steps */}
      <div className="space-y-3">
        {steps.map((step, i) => {
          const Icon = step.icon;
          const isComplete = step.isComplete;
          return (
            <div
              key={step.id}
              className={cn(
                'bg-card rounded-xl border border-border p-5 shadow-soft transition-all hover:shadow-md cursor-pointer',
                isComplete && 'border-green-200 dark:border-green-800/50 bg-green-50/30 dark:bg-green-900/10'
              )}
              onClick={() => toggleStep(step.id)}
            >
              <div className="flex items-start gap-4">
                {/* Step number / check */}
                <div className={cn(
                  'w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-all',
                  isComplete
                    ? 'bg-green-100 dark:bg-green-900/40'
                    : 'bg-slate-100 dark:bg-slate-800'
                )}>
                  {isComplete ? (
                    <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400" />
                  ) : (
                    <span className="text-sm font-bold text-slate-400">{i + 1}</span>
                  )}
                </div>
                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <Icon className={cn('w-4 h-4 shrink-0', isComplete ? 'text-green-500' : 'text-slate-400')} />
                    <h3 className={cn(
                      'text-sm font-bold',
                      isComplete ? 'text-green-700 dark:text-green-400 line-through decoration-green-300' : 'text-slate-900 dark:text-slate-100'
                    )}>
                      {step.title}
                    </h3>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{step.description}</p>
                </div>
                {/* Action */}
                <div className="shrink-0">
                  {isComplete ? (
                    <span className="text-[10px] font-semibold text-green-600 dark:text-green-400 px-2 py-1 bg-green-100 dark:bg-green-900/40 rounded-full">Kész</span>
                  ) : (
                    <Button variant="ghost" size="sm" className="text-xs h-7 text-primary gap-1" onClick={e => { e.stopPropagation(); toggleStep(step.id); }}>
                      Kész jelölés
                    </Button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
