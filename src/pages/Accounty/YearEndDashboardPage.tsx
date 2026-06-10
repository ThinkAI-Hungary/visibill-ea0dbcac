import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft, Calendar, CheckCircle, Clock, AlertTriangle, ChevronRight,
  FileText, Calculator, Users, Gift, Briefcase, Shield, Download,
  TrendingUp, Eye, Star
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type TaskStatus = 'done' | 'in_progress' | 'pending' | 'blocked';

interface YearEndTask {
  id: string;
  title: string;
  subtitle: string;
  icon: React.ElementType;
  color: string;
  deadline: string;
  status: TaskStatus;
  legalRef: string;
  checklist: { item: string; done: boolean }[];
  output?: string;
}

const MOCK_TASKS: YearEndTask[] = [
  {
    id: 'm30', title: 'M30 Jövedelemigazolás', subtitle: 'Munkáltatói igazolás kiküldése minden dolgozónak',
    icon: FileText, color: 'from-blue-500 to-indigo-500', deadline: '2027-01-31', status: 'pending',
    legalRef: 'Szja tv. 46. § (4)',
    checklist: [
      { item: 'Éves jövedelem adatok véglegesítése', done: true },
      { item: 'Családi kedvezmény összesítés', done: true },
      { item: 'SZJA kalkuláció ellenőrzés', done: false },
      { item: 'M30 PDF generálás (42 fő)', done: false },
      { item: 'Kiküldés/nyomtatás', done: false },
    ],
    output: 'M30 PDF (42 db)',
  },
  {
    id: 'szja_plan', title: 'SZJA-tervezet kiküldés', subtitle: 'Tájékoztató az éves adóbevallás tervezetről',
    icon: Calculator, color: 'from-violet-500 to-purple-500', deadline: '2027-03-15', status: 'pending',
    legalRef: 'Szja tv. 11/A. §',
    checklist: [
      { item: 'NAV adategyeztetés (08E, 2608 összesítők)', done: false },
      { item: 'Családi kedvezmény megosztások ellenőrzése', done: false },
      { item: 'Dolgozói tájékoztató kiküldése', done: false },
    ],
  },
  {
    id: 'leave_carry', title: 'Szabadság átvitel', subtitle: 'Ki nem vett szabadságnapok átvezetése a következő évre',
    icon: Calendar, color: 'from-emerald-500 to-teal-500', deadline: '2027-01-15', status: 'pending',
    legalRef: 'Mt. 123. § (5)',
    checklist: [
      { item: 'Maradék szabadságnapok lekérdezése (42 fő)', done: true },
      { item: 'Törvényi átviteli korlát ellenőrzés', done: false },
      { item: 'Munkáltatói jóváhagyás az átvitelhez', done: false },
      { item: 'Szabadságkeret frissítés 2027-re', done: false },
    ],
  },
  {
    id: 'cafe_close', title: 'Cafeteria záró rendezés', subtitle: 'SZÉP kártya és egyéb juttatások éves zárása',
    icon: Gift, color: 'from-pink-500 to-rose-500', deadline: '2026-12-31', status: 'in_progress',
    legalRef: 'Szja tv. 71. §',
    checklist: [
      { item: 'Éves cafeteria keret felhasználás ellenőrzése', done: true },
      { item: 'Részleges felhasználás utáni közteherdöntés', done: true },
      { item: 'SZÉP kártya egyenleg záró kimutatás', done: false },
      { item: 'Adóköteles juttatás összesítés', done: false },
    ],
  },
  {
    id: 'rehab', title: 'Rehabilitációs hozzájárulás', subtitle: 'Éves rehabilitációs hozzájárulás bevallás és befizetés',
    icon: Shield, color: 'from-amber-500 to-orange-500', deadline: '2027-03-31', status: 'pending',
    legalRef: 'Mmtv. 23. §',
    checklist: [
      { item: 'Éves átlagos stat. létszám kiszámítása', done: false },
      { item: 'Kötelező foglalkoztatási arány (5%) ellenőrzése', done: false },
      { item: 'Rehab hozzájárulás összeg kiszámítása', done: false },
      { item: 'REHAB bevallás beküldése', done: false },
    ],
  },
  {
    id: 'annual_filing', title: '2658 Éves összesítő bevallás', subtitle: 'Éves összesítő járulékbevallás a NAV felé',
    icon: Briefcase, color: 'from-cyan-500 to-blue-500', deadline: '2027-02-25', status: 'pending',
    legalRef: 'Art. 50. §',
    checklist: [
      { item: 'Havi bevallások egyeztetése (12 hó)', done: false },
      { item: 'Éves összesítő összeállítása', done: false },
      { item: 'Ellenőrzés és jóváhagyás', done: false },
      { item: 'XML generálás és beküldés', done: false },
    ],
  },
  {
    id: 'min_wage', title: 'Minimálbér-emelés előkészítés', subtitle: 'Következő évi minimálbér és garantált bérminimum átvezetés',
    icon: TrendingUp, color: 'from-green-500 to-emerald-500', deadline: '2027-01-01', status: 'pending',
    legalRef: 'Mt. 153. §',
    checklist: [
      { item: 'Új minimálbér összeg rögzítése (2027)', done: false },
      { item: 'Garantált bérminimum rögzítése', done: false },
      { item: 'Érintett munkavállalók azonosítása', done: false },
      { item: 'Szerződésmódosítások előkészítése', done: false },
      { item: 'Járulékalap-változás kalkuláció', done: false },
    ],
  },
  {
    id: 'stat', title: 'KSH statisztikai jelentések', subtitle: 'Éves munkaügyi statisztikai adatszolgáltatás',
    icon: Users, color: 'from-slate-500 to-slate-600', deadline: '2027-02-15', status: 'pending',
    legalRef: 'Stt. 2016. évi CLV.',
    checklist: [
      { item: 'Éves létszámadatok összesítése', done: false },
      { item: 'Bérstatisztika összeállítása', done: false },
      { item: 'KSH űrlap kitöltése és beküldése', done: false },
    ],
  },
];

const STATUS_BADGE: Record<TaskStatus, { label: string; color: string; icon: React.ElementType }> = {
  done: { label: 'Kész', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400', icon: CheckCircle },
  in_progress: { label: 'Folyamatban', color: 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400', icon: Clock },
  pending: { label: 'Várakozik', color: 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400', icon: Clock },
  blocked: { label: 'Blokkolva', color: 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400', icon: AlertTriangle },
};

export default function YearEndDashboardPage() {
  const { id } = useParams<{ id: string }>();
  const [tasks, setTasks] = useState(MOCK_TASKS);
  const [expandedTask, setExpandedTask] = useState<string | null>(null);

  const doneCount = tasks.filter(t => t.status === 'done').length;
  const totalChecks = tasks.reduce((s, t) => s + t.checklist.length, 0);
  const doneChecks = tasks.reduce((s, t) => s + t.checklist.filter(c => c.done).length, 0);
  const progress = Math.round((doneChecks / totalChecks) * 100);

  const toggleCheckItem = (taskId: string, itemIdx: number) => {
    setTasks(prev => prev.map(t => t.id === taskId ? {
      ...t,
      checklist: t.checklist.map((c, i) => i === itemIdx ? { ...c, done: !c.done } : c),
    } : t));
  };

  return (
    <div className="w-full max-w-5xl mx-auto space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center gap-3">
        <Link to={`/accounty/payroll/${id}`} className="p-2 rounded-lg hover:bg-muted transition-colors"><ArrowLeft className="w-5 h-5" /></Link>
        <div className="p-2.5 bg-gradient-to-br from-amber-500 to-red-500 rounded-xl shadow-lg shadow-amber-500/25"><Star className="w-5 h-5 text-white" /></div>
        <div>
          <h1 className="text-2xl font-bold">Év végi feladatok — 2026</h1>
          <p className="text-sm text-slate-500">Bérszámfejtési éves zárás teendők és határidők</p>
        </div>
      </div>

      {/* Progress */}
      <div className="bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-500/10 dark:to-orange-500/10 rounded-xl border border-amber-200 dark:border-amber-500/20 p-6">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-amber-800 dark:text-amber-300">Éves zárás haladás</h3>
          <span className="text-sm font-bold">{progress}% ({doneChecks}/{totalChecks} feladat)</span>
        </div>
        <div className="w-full h-3 bg-amber-100 dark:bg-amber-500/20 rounded-full overflow-hidden">
          <div className="h-full bg-gradient-to-r from-amber-500 to-orange-500 rounded-full transition-all" style={{ width: `${progress}%` }} />
        </div>
        <div className="grid grid-cols-4 gap-3 mt-4">
          <div className="text-center"><p className="text-2xl font-bold text-emerald-600">{doneCount}</p><p className="text-[10px] text-slate-500">Kész</p></div>
          <div className="text-center"><p className="text-2xl font-bold text-blue-600">{tasks.filter(t => t.status === 'in_progress').length}</p><p className="text-[10px] text-slate-500">Folyamatban</p></div>
          <div className="text-center"><p className="text-2xl font-bold text-slate-500">{tasks.filter(t => t.status === 'pending').length}</p><p className="text-[10px] text-slate-500">Várakozik</p></div>
          <div className="text-center"><p className="text-2xl font-bold">{tasks.length}</p><p className="text-[10px] text-slate-500">Összesen</p></div>
        </div>
      </div>

      {/* Task cards */}
      <div className="space-y-3">
        {tasks.map(task => {
          const badge = STATUS_BADGE[task.status];
          const taskDoneChecks = task.checklist.filter(c => c.done).length;
          const isExpanded = expandedTask === task.id;

          return (
            <div key={task.id} className="bg-card rounded-xl border border-border shadow-soft overflow-hidden">
              <button onClick={() => setExpandedTask(isExpanded ? null : task.id)} className="w-full flex items-center gap-4 px-5 py-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors text-left">
                <div className={cn('w-10 h-10 rounded-xl bg-gradient-to-br text-white flex items-center justify-center shrink-0', task.color)}>
                  <task.icon className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-bold">{task.title}</p>
                    <span className={cn('px-2 py-0.5 rounded-full text-[10px] font-bold', badge.color)}>{badge.label}</span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">{task.subtitle}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs text-slate-400">Határidő</p>
                  <p className="text-sm font-bold">{task.deadline}</p>
                </div>
                <div className="text-right shrink-0 w-16">
                  <p className="text-xs text-slate-400">Haladás</p>
                  <p className="text-sm font-bold">{taskDoneChecks}/{task.checklist.length}</p>
                </div>
                <ChevronRight className={cn('w-4 h-4 text-slate-400 transition-transform', isExpanded && 'rotate-90')} />
              </button>

              {isExpanded && (
                <div className="px-5 pb-5 pl-20 space-y-2 border-t border-border/50 pt-3">
                  <p className="text-[10px] text-slate-400 font-bold uppercase">{task.legalRef}</p>
                  {task.checklist.map((check, ci) => (
                    <button key={ci} onClick={() => toggleCheckItem(task.id, ci)} className={cn(
                      'w-full flex items-center gap-2 p-2 rounded-lg text-left text-sm transition-all',
                      check.done ? 'bg-emerald-50 dark:bg-emerald-500/10' : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                    )}>
                      <div className={cn('w-4 h-4 rounded flex items-center justify-center shrink-0',
                        check.done ? 'bg-emerald-500 text-white' : 'border border-slate-300'
                      )}>
                        {check.done && <CheckCircle className="w-3 h-3" />}
                      </div>
                      <span className={cn(check.done && 'line-through text-slate-400')}>{check.item}</span>
                    </button>
                  ))}
                  {task.output && (
                    <div className="flex justify-end pt-2">
                      <Button variant="outline" size="sm" className="gap-1 text-xs"><Download className="w-3 h-3" /> {task.output}</Button>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
