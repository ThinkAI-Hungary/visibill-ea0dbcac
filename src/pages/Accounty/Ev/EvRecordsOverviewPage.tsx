import React, { useMemo } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import {
  ClipboardList, ArrowLeft, ChevronRight, Info, ExternalLink,
  FileText, BookOpen, Calculator, Car, Package, Users, Home, Coins
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAccountyClient } from '@/hooks/accounty';
import { useEvRecordCounts } from '@/hooks/useEvData';

// ─── Records definitions ───────────────────────────────────────────────────

interface RecordType {
  id: string;
  name: string;
  description: string;
  legalRef: string;
  icon: React.ElementType;
  color: string;
  required: boolean;
  entryCount: number;
}

const RECORDS: RecordType[] = [
  { id: 'vevo-szallito', name: 'Vevő-szállító nyilvántartás', description: 'Kintlévőségek és kötelezettségek', legalRef: 'Szt. 161. §', icon: Users, color: 'from-blue-500 to-indigo-600', required: true, entryCount: 0 },
  { id: 'tao-kesz', name: 'Tárgyi eszköz nyilvántartás', description: 'Befektetett eszközök leltárja', legalRef: 'Szt. 162. §', icon: Package, color: 'from-teal-500 to-emerald-600', required: true, entryCount: 0 },
  { id: 'keszlet', name: 'Készletnyilvántartás', description: 'Anyagok, áruk, félkész termékek', legalRef: 'Szt. 163. §', icon: Package, color: 'from-amber-500 to-orange-600', required: true, entryCount: 0 },
  { id: 'utnyilv', name: 'Útnyilvántartás', description: 'Üzleti célú gépjármű-használat', legalRef: 'Szja tv. 5. sz. mell.', icon: Car, color: 'from-rose-500 to-pink-600', required: false, entryCount: 0 },
  { id: 'berbeadas', name: 'Bérbeadás nyilvántartás', description: 'Ingatlan bérbeadásból származó jövedelmek', legalRef: 'Szja tv. 74. §', icon: Home, color: 'from-violet-500 to-purple-600', required: false, entryCount: 0 },
  { id: 'valuta', name: 'Valutapénztár nyilvántartás', description: 'Devizás készpénz mozgások', legalRef: 'Szt. 164. §', icon: Coins, color: 'from-cyan-500 to-blue-600', required: false, entryCount: 0 },
  { id: 'munkaber', name: 'Munkabér-nyilvántartás', description: 'Alkalmazottak bér- és járulékadatai', legalRef: 'Mt. 154. §', icon: Users, color: 'from-green-500 to-emerald-600', required: false, entryCount: 0 },
  { id: 'penztarkonyv', name: 'Pénztárkönyv', description: 'Bevételek és kiadások napi nyilvántartása', legalRef: 'Szt. 160. §', icon: BookOpen, color: 'from-indigo-500 to-violet-600', required: true, entryCount: 0 },
  { id: 'selejtezes', name: 'Selejtezési jegyzőkönyv', description: 'Kiselejtezett eszközök dokumentálása', legalRef: 'Szt. 165. §', icon: FileText, color: 'from-slate-500 to-gray-600', required: false, entryCount: 0 },
  { id: 'lekerdezes', name: 'Lekérdezés napló', description: 'NAV online adatlekérdezések naplózása', legalRef: 'Art. 129. §', icon: ExternalLink, color: 'from-sky-500 to-blue-600', required: false, entryCount: 0 },
  { id: 'jog-bizt', name: 'Biztosítási jogviszony', description: 'Biztosítotti jogviszony nyilvántartás', legalRef: 'Tbj. 44. §', icon: FileText, color: 'from-fuchsia-500 to-pink-600', required: true, entryCount: 0 },
];

// ─── Component ──────────────────────────────────────────────────────────────

export default function EvRecordsOverviewPage() {
  const { companyId, dateRange } = useParams<{ companyId: string; dateRange: string }>();
  const id = companyId;
  const { data: client } = useAccountyClient(id);
  const [searchParams] = useSearchParams();
  const taxYear = Number(searchParams.get('year') || '2026');
  const { data: counts = {} } = useEvRecordCounts(id, taxYear);

  const records = useMemo(() => {
    return RECORDS.map(r => ({
      ...r,
      entryCount: counts[r.id] ?? 0
    }));
  }, [counts]);

  const requiredRecords = records.filter(r => r.required);
  const optionalRecords = records.filter(r => !r.required);
  const totalEntries = records.reduce((s, r) => s + r.entryCount, 0);
  const activeRecords = records.filter(r => r.entryCount > 0).length;

  return (
    <div className="w-full space-y-6 animate-in fade-in duration-500">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <Link to={`/accounty/ev?year=${taxYear}`} className="hover:text-indigo-600 transition-colors flex items-center gap-1">
          <ArrowLeft className="w-3.5 h-3.5" /> EV Portfólió
        </Link>
        <ChevronRight className="w-3 h-3" />
        <Link to={`/accounty/${id}/${dateRange}/ev?year=${taxYear}`} className="hover:text-indigo-600 transition-colors">
          {client?.name || 'Ügyfél'}
        </Link>
        <ChevronRight className="w-3 h-3" />
        <span className="text-slate-900 dark:text-slate-100 font-medium">Részletező nyilvántartások</span>
      </div>

      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2.5 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl shadow-lg shadow-violet-500/25">
          <ClipboardList className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Részletező nyilvántartások</h1>
          <p className="text-sm text-slate-500">Szt. 160-165. § – kötelező és opcionális analitikák</p>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-card rounded-xl border border-border p-4 shadow-soft">
          <p className="text-xs text-slate-500 mb-1">Nyilvántartás típusok</p>
          <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{RECORDS.length}</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-4 shadow-soft">
          <p className="text-xs text-slate-500 mb-1">Aktív nyilvántartások</p>
          <p className="text-2xl font-bold text-violet-600">{activeRecords}</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-4 shadow-soft">
          <p className="text-xs text-slate-500 mb-1">Összes bejegyzés</p>
          <p className="text-2xl font-bold text-indigo-600 tabular-nums">{totalEntries}</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-4 shadow-soft">
          <p className="text-xs text-slate-500 mb-1">Kötelező</p>
          <p className="text-2xl font-bold text-emerald-600">{requiredRecords.length}</p>
        </div>
      </div>

      {/* Required */}
      <div>
        <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-3 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-red-500" /> Kötelező nyilvántartások
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {requiredRecords.map(rec => {
            const Icon = rec.icon;
            const targetPath = rec.id === 'penztarkonyv'
              ? `/accounty/${id}/${dateRange}/ev/cashbook?year=${taxYear}`
              : `/accounty/${id}/${dateRange}/ev/records/${rec.id}?year=${taxYear}`;
            return (
              <Link key={rec.id} to={targetPath} className="bg-card rounded-xl border border-border shadow-soft hover:shadow-md transition-all cursor-pointer group overflow-hidden">
                <div className="flex items-center gap-4 px-5 py-4">
                  <div className={cn('w-10 h-10 rounded-xl bg-gradient-to-br flex items-center justify-center shadow-sm', rec.color)}>
                    <Icon className="w-5 h-5 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-slate-900 dark:text-slate-100 group-hover:text-indigo-600 transition-colors">
                      {rec.name}
                    </p>
                    <p className="text-xs text-slate-500 truncate">{rec.description}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-lg font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100">{rec.entryCount}</p>
                    <p className="text-[10px] text-slate-400">{rec.legalRef}</p>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Optional */}
      <div>
        <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-3 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-blue-500" /> Opcionális nyilvántartások
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {optionalRecords.map(rec => {
            const Icon = rec.icon;
            const isEmpty = rec.entryCount === 0;
            const targetPath = `/accounty/${id}/${dateRange}/ev/records/${rec.id}?year=${taxYear}`;
            return (
              <Link key={rec.id} to={targetPath} className={cn(
                'bg-card rounded-xl border shadow-soft hover:shadow-md transition-all cursor-pointer group overflow-hidden',
                isEmpty ? 'border-dashed border-border opacity-60 hover:opacity-100' : 'border-border'
              )}>
                <div className="flex items-center gap-4 px-5 py-4">
                  <div className={cn('w-10 h-10 rounded-xl bg-gradient-to-br flex items-center justify-center shadow-sm', isEmpty ? 'opacity-40' : '', rec.color)}>
                    <Icon className="w-5 h-5 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-slate-900 dark:text-slate-100 group-hover:text-indigo-600 transition-colors">
                      {rec.name}
                    </p>
                    <p className="text-xs text-slate-500 truncate">{rec.description}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className={cn('text-lg font-bold font-mono tabular-nums', isEmpty ? 'text-slate-300 dark:text-slate-600' : 'text-slate-900 dark:text-slate-100')}>
                      {isEmpty ? '—' : rec.entryCount}
                    </p>
                    <p className="text-[10px] text-slate-400">{rec.legalRef}</p>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Info */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4">
        <div className="flex items-start gap-2">
          <Info className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
          <div className="text-xs text-blue-600 dark:text-blue-400 space-y-1">
            <p className="font-semibold">Nyilvántartási kötelezettségek</p>
            <ul className="list-disc list-inside space-y-0.5">
              <li>Egyszeres könyvvitel: pénztárkönyv + analitikus nyilvántartások</li>
              <li>Kötelező: vevő-szállító, tárgyi eszköz, készlet, pénztárkönyv, biztosítotti jogviszony</li>
              <li>Opcionális: útnyilvántartás (jármű költség elszámoláshoz), bérbeadás, valutapénztár</li>
              <li>NAV ellenőrzésnél: minden nyilvántartás bemutatása kötelező</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
