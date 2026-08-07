import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft, Calendar, CheckCircle, Clock, AlertTriangle, ChevronRight,
  FileText, Calculator, Users, Gift, Briefcase, Shield, Download,
  TrendingUp, Star, Loader2, Database, Plus
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { ExportButton } from '@/components/accounty/ExportButton';
import { exportPdf } from '@/lib/exportPdf';
import {
  useYearEndTasks, useUpdateYearEndTask, useSeedYearEndTasks,
  type YearEndTask,
} from '@/hooks/accounty';

const ICON_MAP: Record<string, React.ElementType> = {
  FileText, Calendar, Calculator, Users, Gift, Briefcase, Shield, TrendingUp, Star,
};

type TaskStatus = 'done' | 'in_progress' | 'pending' | 'blocked';

const STATUS_BADGE: Record<TaskStatus, { label: string; color: string; icon: React.ElementType }> = {
  done: { label: 'Kész', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400', icon: CheckCircle },
  in_progress: { label: 'Folyamatban', color: 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400', icon: Clock },
  pending: { label: 'Várakozik', color: 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400', icon: Clock },
  blocked: { label: 'Blokkolva', color: 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400', icon: AlertTriangle },
};

export default function YearEndDashboardPage() {
  const { companyId } = useParams<{ companyId: string }>();
  const id = companyId;
  const { toast } = useToast();
  const currentYear = new Date().getFullYear();
  const [expandedTask, setExpandedTask] = useState<string | null>(null);

  const { data: tasks, isLoading } = useYearEndTasks(id || '', currentYear);
  const updateMut = useUpdateYearEndTask();
  const seedMut = useSeedYearEndTasks();

  const taskList = tasks || [];
  const doneCount = taskList.filter(t => t.status === 'done').length;
  const totalChecks = taskList.reduce((s, t) => s + t.checklist.length, 0);
  const doneChecks = taskList.reduce((s, t) => s + t.checklist.filter(c => c.done).length, 0);
  const progress = totalChecks > 0 ? Math.round((doneChecks / totalChecks) * 100) : 0;

  const toggleCheckItem = async (task: YearEndTask, itemIdx: number) => {
    const newChecklist = task.checklist.map((c, i) => i === itemIdx ? { ...c, done: !c.done } : c);
    const allDone = newChecklist.every(c => c.done);
    const anyDone = newChecklist.some(c => c.done);
    try {
      await updateMut.mutateAsync({
        ...task,
        checklist: newChecklist,
        status: allDone ? 'done' : anyDone ? 'in_progress' : 'pending',
      });
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : 'Ismeretlen hiba';
      toast({ variant: 'destructive', title: 'Hiba', description: errMsg });
    }
  };

  const handleSeed = async () => {
    if (!id) return;
    try {
      await seedMut.mutateAsync({ companyId: id, year: currentYear });
      toast({ title: 'Alapértelmezett feladatok létrehozva' });
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : 'Ismeretlen hiba';
      toast({ variant: 'destructive', title: 'Hiba', description: errMsg });
    }
  };

  return (
    <div className="w-full max-w-5xl mx-auto space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center gap-3">
        <button onClick={() => window.history.back()} className="p-2 rounded-lg hover:bg-muted transition-colors"><ArrowLeft className="w-5 h-5" /></button>
        <div className="p-2.5 bg-gradient-to-br from-amber-500 to-red-500 rounded-xl shadow-lg shadow-amber-500/25"><Star className="w-5 h-5 text-white" /></div>
        <div>
          <h1 className="text-2xl font-bold">Év végi feladatok — {currentYear}</h1>
          <p className="text-sm text-slate-500">Bérszámfejtési éves zárás teendők és határidők</p>
        </div>
        <div className="flex gap-2">
          <ExportButton
            filename={`evvegi_feladatok_${currentYear}`}
            headers={['Feladat', 'Státusz', 'Határidő', 'Haladás']}
            getRows={() => taskList.map(t => [t.title, STATUS_BADGE[t.status].label, t.deadline || '', `${t.checklist.filter(c => c.done).length}/${t.checklist.length}`])}
            size="sm"
          />
          <Button variant="outline" className="gap-1.5" onClick={() => exportPdf(`evvegi_${currentYear}`, {
            title: `Év végi feladatok — ${currentYear}`,
            headers: ['Feladat', 'Státusz', 'Határidő', 'Haladás', 'Jogszabály'],
            rows: taskList.map(t => [t.title, STATUS_BADGE[t.status].label, t.deadline || '–', `${t.checklist.filter(c => c.done).length}/${t.checklist.length}`, t.legalRef || '']),
          })}><Download className="w-4 h-4" /> PDF</Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-32 gap-2 text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin" /> Betöltés...</div>
      ) : taskList.length === 0 ? (
        <div className="bg-card rounded-xl border border-border p-12 text-center space-y-3">
          <Database className="w-10 h-10 mx-auto text-slate-400" />
          <p className="text-sm text-slate-500">Nincsenek évzárási feladatok rögzítve erre az évre.</p>
          <Button onClick={handleSeed} disabled={seedMut.isPending} className="gap-1.5">
            {seedMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Alapértelmezett feladatok betöltése
          </Button>
        </div>
      ) : (
        <>
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
              <div className="text-center"><p className="text-2xl font-bold text-blue-600">{taskList.filter(t => t.status === 'in_progress').length}</p><p className="text-[10px] text-slate-500">Folyamatban</p></div>
              <div className="text-center"><p className="text-2xl font-bold text-slate-500">{taskList.filter(t => t.status === 'pending').length}</p><p className="text-[10px] text-slate-500">Várakozik</p></div>
              <div className="text-center"><p className="text-2xl font-bold">{taskList.length}</p><p className="text-[10px] text-slate-500">Összesen</p></div>
            </div>
          </div>

          {/* Task cards */}
          <div className="space-y-3">
            {taskList.map(task => {
              const badge = STATUS_BADGE[task.status];
              const taskDoneChecks = task.checklist.filter(c => c.done).length;
              const isExpanded = expandedTask === task.id;
              const IconComp = ICON_MAP[task.iconName] || FileText;

              return (
                <div key={task.id} className="bg-card rounded-xl border border-border shadow-soft overflow-hidden">
                  <button onClick={() => setExpandedTask(isExpanded ? null : task.id)} className="w-full flex items-center gap-4 px-5 py-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors text-left">
                    <div className={cn('w-10 h-10 rounded-xl bg-gradient-to-br text-white flex items-center justify-center shrink-0', task.color)}>
                      <IconComp className="w-5 h-5" />
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
                      <p className="text-sm font-bold">{task.deadline || '—'}</p>
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
                        <button key={ci} onClick={() => toggleCheckItem(task, ci)} className={cn(
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
                      {task.outputLabel && (
                        <div className="flex justify-end pt-2">
                          <Button variant="outline" size="sm" className="gap-1 text-xs" onClick={() => {
                            exportPdf(`evvegi_${task.title.replace(/\s+/g, '_')}`, {
                              title: task.title,
                              subtitle: task.subtitle,
                              headers: ['Feladat', 'Kész'],
                              rows: task.checklist.map(c => [c.item, c.done ? 'Igen' : 'Nem']),
                            });
                          }}><Download className="w-3 h-3" /> {task.outputLabel}</Button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
