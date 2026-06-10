import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft, Brain, AlertTriangle, CheckCircle, TrendingUp, TrendingDown,
  Users, DollarSign, Clock, Eye, Shield, RefreshCw, Zap
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type Severity = 'critical' | 'warning' | 'info';

interface Anomaly {
  id: string;
  title: string;
  description: string;
  severity: Severity;
  category: string;
  affectedEmployees: string[];
  potentialImpact: string;
  recommendation: string;
  detectedAt: string;
  resolved: boolean;
}

const MOCK_ANOMALIES: Anomaly[] = [
  {
    id: '1', title: 'Minimálbér alatti alapbér', description: 'Szabó Péter alapbére (310 000 Ft) a 2026-os minimálbér (322 800 Ft) alatt van. Napi 8 órás, teljes munkaidős jogviszony.',
    severity: 'critical', category: 'Bér', affectedEmployees: ['Szabó Péter'],
    potentialImpact: 'Munkaügyi bírság, járulék utólagos megállapítás', recommendation: 'Azonnali béremelés 322 800 Ft-ra vagy magasabbra. Járulékokat a minimálbér alapján kell fizetni.',
    detectedAt: '2026-06-10', resolved: false,
  },
  {
    id: '2', title: 'TB járulék eltérés', description: 'Horváth Dávid TB járuléka 2 800 Ft-tal több mint a bruttó 18,5%-a. Valószínű dupla levonás a korrekciós számfejtésben.',
    severity: 'warning', category: 'Járulék', affectedEmployees: ['Horváth Dávid'],
    potentialImpact: 'Munkavállaló túlfizetése, nettó bér csökkenés', recommendation: 'A májusi számfejtés TB sorának manuális ellenőrzése és korrekció a júniusi hónapban.',
    detectedAt: '2026-06-09', resolved: false,
  },
  {
    id: '3', title: 'SZOCHO kedvezmény nem érvényesítve', description: 'Kiss Béla (54 éves) foglalkoztatási kedvezmény (Munkahelyvédelmi Akció) jogosult, de a SZOCHO-ból nem vonódik le a kedvezmény.',
    severity: 'warning', category: 'Kedvezmény', affectedEmployees: ['Kiss Béla'],
    potentialImpact: 'Éves szinten ~250 000 Ft többlet közteherkiadás a munkáltatónak', recommendation: 'Életkor-alapú kedvezmény aktiválása a bérszámfejtő rendszerben.',
    detectedAt: '2026-06-08', resolved: false,
  },
  {
    id: '4', title: 'Szabadságnap túllépés veszély', description: '3 munkavállalónak 15+ nap ki nem vett szabadsága van félévkor. Év végéig nem valószínű a felhasználás.',
    severity: 'info', category: 'Szabadság', affectedEmployees: ['Nagy Anna (18 nap)', 'Tóth Éva (15 nap)', 'Horváth Dávid (22 nap)'],
    potentialImpact: 'Mt. 123. § alapján a szabadságot az esedékesség évében ki kell adni', recommendation: 'Szabadság-terv készítés a 2. félévre, munkáltatói kijelölés ha szükséges.',
    detectedAt: '2026-06-10', resolved: false,
  },
  {
    id: '5', title: 'Családi kedvezmény megosztás inkonzisztencia', description: 'Nagy Anna 50%-os megosztást jelölt a családi kedvezménynél, de a házastárs munkáltatójának nyilatkozata nem érkezett be.',
    severity: 'info', category: 'Nyilatkozat', affectedEmployees: ['Nagy Anna'],
    potentialImpact: 'SZJA különbözet az éves bevallásban', recommendation: 'Házastárs munkáltatójától nyilatkozat bekérése a megosztás megerősítéséhez.',
    detectedAt: '2026-06-07', resolved: true,
  },
];

const SEV_CONFIG: Record<Severity, { label: string; color: string; bg: string; icon: React.ElementType }> = {
  critical: { label: 'Kritikus', color: 'text-red-700 dark:text-red-400', bg: 'bg-red-50 border-red-200 dark:bg-red-500/10 dark:border-red-500/20', icon: AlertTriangle },
  warning: { label: 'Figyelmeztetés', color: 'text-yellow-700 dark:text-yellow-400', bg: 'bg-yellow-50 border-yellow-200 dark:bg-yellow-500/10 dark:border-yellow-500/20', icon: AlertTriangle },
  info: { label: 'Információ', color: 'text-blue-700 dark:text-blue-400', bg: 'bg-blue-50 border-blue-200 dark:bg-blue-500/10 dark:border-blue-500/20', icon: Zap },
};

export default function AiAnomalyReportPage() {
  const { id } = useParams<{ id: string }>();
  const [anomalies, setAnomalies] = useState(MOCK_ANOMALIES);
  const [filter, setFilter] = useState<'all' | Severity>('all');
  const [scanning, setScanning] = useState(false);

  const filtered = filter === 'all' ? anomalies : anomalies.filter(a => a.severity === filter);
  const unresolvedCount = anomalies.filter(a => !a.resolved).length;

  const handleScan = () => { setScanning(true); setTimeout(() => setScanning(false), 3000); };
  const toggleResolved = (anomId: string) => setAnomalies(prev => prev.map(a => a.id === anomId ? { ...a, resolved: !a.resolved } : a));

  return (
    <div className="w-full max-w-5xl mx-auto space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link to={`/accounty/payroll/${id}/advanced-reports`} className="p-2 rounded-lg hover:bg-muted transition-colors"><ArrowLeft className="w-5 h-5" /></Link>
          <div className="p-2.5 bg-gradient-to-br from-purple-500 to-pink-600 rounded-xl shadow-lg shadow-purple-500/25"><Brain className="w-5 h-5 text-white" /></div>
          <div>
            <h1 className="text-2xl font-bold">Anomália észlelés</h1>
            <p className="text-sm text-slate-500">Szabályalapú bérszámfejtési anomáliák felderítése</p>
          </div>
        </div>
        <Button onClick={handleScan} disabled={scanning} className="gap-1.5 bg-purple-600 hover:bg-purple-700">
          {scanning ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Brain className="w-4 h-4" />}
          {scanning ? 'Elemzés...' : 'Újra elemzés'}
        </Button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-4 gap-3">
        <div className="bg-card rounded-xl border border-border p-4 text-center">
          <p className="text-2xl font-bold text-red-600">{anomalies.filter(a => a.severity === 'critical' && !a.resolved).length}</p>
          <p className="text-xs text-slate-500">Kritikus</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-4 text-center">
          <p className="text-2xl font-bold text-yellow-600">{anomalies.filter(a => a.severity === 'warning' && !a.resolved).length}</p>
          <p className="text-xs text-slate-500">Figyelmeztetés</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-4 text-center">
          <p className="text-2xl font-bold text-blue-600">{anomalies.filter(a => a.severity === 'info' && !a.resolved).length}</p>
          <p className="text-xs text-slate-500">Információ</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-4 text-center">
          <p className="text-2xl font-bold text-emerald-600">{anomalies.filter(a => a.resolved).length}</p>
          <p className="text-xs text-slate-500">Megoldva</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-1 bg-slate-100 dark:bg-slate-800/50 rounded-lg p-0.5 w-fit">
        {[{ id: 'all' as const, label: 'Mind' }, { id: 'critical' as const, label: 'Kritikus' }, { id: 'warning' as const, label: 'Figyelmeztetés' }, { id: 'info' as const, label: 'Info' }].map(f => (
          <button key={f.id} onClick={() => setFilter(f.id)} className={cn('px-3 py-1.5 rounded-md text-xs font-medium transition-all', filter === f.id ? 'bg-white dark:bg-slate-700 shadow-sm' : 'text-slate-500')}>{f.label}</button>
        ))}
      </div>

      {/* Anomaly cards */}
      <div className="space-y-3">
        {filtered.map(anomaly => {
          const sev = SEV_CONFIG[anomaly.severity];
          return (
            <div key={anomaly.id} className={cn('rounded-xl border p-5 space-y-3 transition-all', anomaly.resolved ? 'bg-slate-50 dark:bg-slate-900/30 border-border opacity-60' : sev.bg)}>
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <sev.icon className={cn('w-5 h-5 mt-0.5 shrink-0', sev.color)} />
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-bold">{anomaly.title}</h3>
                      <span className={cn('px-2 py-0.5 rounded-full text-[10px] font-bold', anomaly.severity === 'critical' ? 'bg-red-200 text-red-800' : anomaly.severity === 'warning' ? 'bg-yellow-200 text-yellow-800' : 'bg-blue-200 text-blue-800')}>{sev.label}</span>
                      <span className="text-[10px] bg-slate-200 dark:bg-slate-700 px-2 py-0.5 rounded">{anomaly.category}</span>
                    </div>
                    <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">{anomaly.description}</p>
                  </div>
                </div>
                <button onClick={() => toggleResolved(anomaly.id)} className={cn('px-3 py-1 rounded-lg text-xs font-bold transition-colors', anomaly.resolved ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600 hover:bg-emerald-100 hover:text-emerald-700')}>
                  {anomaly.resolved ? '✓ Megoldva' : 'Megoldás jelölés'}
                </button>
              </div>
              {!anomaly.resolved && (
                <>
                  <div className="grid grid-cols-2 gap-3 pl-8 text-xs">
                    <div><span className="text-slate-400">Érintett:</span> <strong>{anomaly.affectedEmployees.join(', ')}</strong></div>
                    <div><span className="text-slate-400">Hatás:</span> <strong>{anomaly.potentialImpact}</strong></div>
                  </div>
                  <div className="pl-8 bg-white dark:bg-slate-900 rounded-lg p-3 text-sm border border-border/50">
                    <span className="text-[10px] text-emerald-600 font-bold uppercase">Javaslat:</span>
                    <p className="text-slate-700 dark:text-slate-300 mt-0.5">{anomaly.recommendation}</p>
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
