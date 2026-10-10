import React, { useState } from 'react';
import {
  CheckCircle2,
  Circle,
  Clock,
  ArrowRight,
  ShieldCheck,
  FileCheck2,
  Calendar,
  AlertTriangle,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';

interface ChecklistItem {
  id: string;
  category: string;
  title: string;
  description: string;
  isCompleted: boolean;
  dueDate: string;
  targetTab?: string;
}

const INITIAL_CHECKLIST: ChecklistItem[] = [
  {
    id: 'inventory',
    category: 'Eszközök & Készletek',
    title: '1. Fizikai leltározás és készletértékelés lezárása',
    description: 'Raktári készlet összevetése a könyvviteli nyilvántartással, leltáreltérések elszámolása.',
    isCompleted: false,
    dueDate: 'Január 31.',
  },
  {
    id: 'recon_partners',
    category: 'Követelések & Kötelezettségek',
    title: '2. Vevő és szállító analitikák egyeztetése',
    description: 'Egyenlegközlő levelek kiküldése és visszaigazolása, vitatott tételek és kétes vevők felmérése.',
    isCompleted: false,
    dueDate: 'Február 15.',
  },
  {
    id: 'bank_cash',
    category: 'Pénzeszközök',
    title: '3. Bankkivonatok és pénztárrovancsok zárlata',
    description: 'December 31-i banki kivonatok záróegyenlegének és a készpénzkészletnek a főkönyvvel való egyeztetése.',
    isCompleted: false,
    dueDate: 'Február 10.',
  },
  {
    id: 'fx_revaluation',
    category: 'Értékelés',
    title: '4. Devizás eszközök és források MNB árfolyam-átértékelése',
    description: 'Devizás számlák, bankszámlák és hitelek átértékelése a december 31-i hivatalos MNB devizaárfolyamon.',
    isCompleted: false,
    dueDate: 'Február 20.',
  },
  {
    id: 'accruals',
    category: 'Időbeli elhatárolások',
    title: '5. Időbeli elhatárolások (AIE és PIE) könyvelése',
    description: 'Több évet érintő költségek (pl. bérleti díjak, biztosítások) és árbevételek időarányos elhatárolása.',
    isCompleted: false,
    dueDate: 'Március 15.',
  },
  {
    id: 'depreciation',
    category: 'Tárgyi eszközök',
    title: '6. Terv szerinti értékcsökkenés (ÉCS) elszámolása',
    description: 'Számviteli törvény és társasági adótörvény szerinti éves ÉCS kalkulációja és lekönyvelése.',
    isCompleted: false,
    dueDate: 'Március 20.',
  },
  {
    id: 'tax_calculation',
    category: 'Adózás',
    title: '7. Társasági adó (TAO) / KIVA és HIPA megállapítása',
    description: 'Adóalap-korrekciók levezetése, minimumadó ellenőrzés, megfizetett adóelőlegek levonása.',
    isCompleted: false,
    dueDate: 'Április 15.',
  },
  {
    id: 'audit_export',
    category: 'Könyvvizsgálat',
    title: '8. Könyvvizsgálói adatszolgáltatási csomag átadása',
    description: '20-oszlopos karton, ISA 560 utólagos rendezések és 15 analitikai csomag exportálása az auditor részére.',
    isCompleted: false,
    dueDate: 'Április 30.',
    targetTab: 'audit-export',
  },
  {
    id: 'annual_report',
    category: 'Közzététel',
    title: '9. Éves beszámoló és Kiegészítő melléklet jóváhagyása',
    description: 'Mérleg, eredménykimutatás, kiegészítő melléklet és taggyűlési határozatok elektronikus letétbe helyezése.',
    isCompleted: false,
    dueDate: 'Május 31.',
    targetTab: 'report',
  },
];

interface YearEndClosingChecklistProps {
  fiscalYear: number;
  onNavigateTab: (tabKey: string) => void;
}

export function YearEndClosingChecklist({
  fiscalYear,
  onNavigateTab,
}: YearEndClosingChecklistProps) {
  const storageKey = `visibill_year_end_closing_${fiscalYear}`;

  const [checklist, setChecklist] = useState<ChecklistItem[]>(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length === INITIAL_CHECKLIST.length) {
          return parsed;
        }
      }
    } catch {
      // Fallback
    }
    return INITIAL_CHECKLIST;
  });

  const toggleItem = (id: string) => {
    setChecklist((prev) => {
      const updated = prev.map((item) =>
        item.id === id ? { ...item, isCompleted: !item.isCompleted } : item
      );
      try {
        localStorage.setItem(storageKey, JSON.stringify(updated));
      } catch (e) {
        console.error('Failed to save checklist state', e);
      }
      return updated;
    });
  };

  const handleReset = () => {
    try {
      localStorage.removeItem(storageKey);
    } catch {}
    setChecklist(INITIAL_CHECKLIST);
  };

  const completedCount = checklist.filter((c) => c.isCompleted).length;
  const progressPercent = Math.round((completedCount / checklist.length) * 100);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Overview Progress Card */}
      <Card className="rounded-2xl border-border/40 shadow-sm overflow-hidden bg-card/60 backdrop-blur-sm">
        <CardHeader className="bg-muted/10 border-b border-border/40 p-5 md:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2.5">
                <CardTitle className="text-xl font-bold tracking-tight">
                  {fiscalYear}. Évi Számviteli Zárlati Ellenőrzőlista
                </CardTitle>
                <Badge variant="outline" className="border-primary/30 text-primary font-semibold text-xs">
                  Sztv. Zárlati Folyamat
                </Badge>
              </div>
              <CardDescription className="text-sm text-muted-foreground mt-1">
                A könyvelési év lezárásának és a beszámoló előkészítésének strukturált, jogszabályi lépései
              </CardDescription>
            </div>

            <div className="flex items-center gap-3">
              <div className="text-right">
                <div className="text-xs text-muted-foreground">Elkészültség:</div>
                <div className="text-lg font-bold text-foreground">
                  {completedCount} / {checklist.length} feladat kész ({progressPercent}%)
                </div>
              </div>
              {completedCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleReset}
                  className="text-xs text-muted-foreground hover:text-foreground h-8"
                  title="Minden feladat visszaállítása nyitott állapotba"
                >
                  Visszaállítás
                </Button>
              )}
            </div>
          </div>

          <div className="mt-4 pt-2">
            <Progress value={progressPercent} className="h-2.5 rounded-full" />
          </div>
        </CardHeader>

        <CardContent className="p-5 md:p-6 space-y-3">
          <div className="divide-y divide-border/20 rounded-xl border border-border/30 overflow-hidden bg-background/50">
            {checklist.map((item) => (
              <div
                key={item.id}
                className="p-4 flex items-start justify-between gap-4 hover:bg-muted/20 transition-colors"
              >
                <div
                  className="flex items-start gap-3.5 cursor-pointer flex-1"
                  onClick={() => toggleItem(item.id)}
                >
                  <button
                    type="button"
                    className="mt-0.5 shrink-0 text-muted-foreground hover:text-foreground"
                  >
                    {item.isCompleted ? (
                      <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                    ) : (
                      <Circle className="h-5 w-5 text-muted-foreground" />
                    )}
                  </button>

                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={`text-sm font-semibold transition-colors ${
                          item.isCompleted ? 'text-foreground/75' : 'text-foreground font-bold'
                        }`}
                      >
                        {item.title}
                      </span>
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
                        {item.category}
                      </Badge>
                      {item.isCompleted && (
                        <Badge
                          variant="outline"
                          className="border-emerald-500/30 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 text-[10px] px-1.5 py-0 h-4"
                        >
                          Kész
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {item.description}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <div className="text-right hidden sm:block">
                    <span className="text-xs text-muted-foreground font-mono">Határidő: {item.dueDate}</span>
                  </div>

                  {item.targetTab && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onNavigateTab(item.targetTab!)}
                      className="text-xs h-8 font-medium"
                    >
                      Ugrás a modulra
                      <ArrowRight className="h-3.5 w-3.5 ml-1" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
