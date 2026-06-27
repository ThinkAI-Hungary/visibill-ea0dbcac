import React, { useState, useMemo } from 'react';
import { Link, useParams, Navigate } from 'react-router-dom';
import {
  ArrowLeft, ChevronRight, Plus, Search, Filter, Download, Trash2,
  Edit2, Eye, Calendar, AlertTriangle, CheckCircle2, Info,
  Users, Package, Car, Home, Coins, BookOpen, FileText, ExternalLink,
  ChevronDown, MoreHorizontal, ArrowUpDown, Loader2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAccountyClient } from '@/hooks/accounty';
import { formatHuf } from '@/lib/evCalculations';
import { useEvRecords } from '@/hooks/useEvData';

// ─── Record Type Configuration ─────────────────────────────────────────────

interface RecordConfig {
  id: string;
  name: string;
  description: string;
  legalRef: string;
  icon: React.ElementType;
  color: string;
  columns: ColumnDef[];
  data: Record<string, string | number>[];
}

interface ColumnDef {
  key: string;
  label: string;
  type: 'text' | 'number' | 'date' | 'currency' | 'badge';
  align?: 'left' | 'right' | 'center';
  width?: string;
}

// ─── Record configurations ──────────────────────────────────────────────────

const RECORD_CONFIGS: Record<string, RecordConfig> = {
  'vevo-szallito': {
    id: 'vevo-szallito',
    name: 'Vevő-szállító nyilvántartás',
    description: 'Kintlévőségek és kötelezettségek analitikus nyilvántartása',
    legalRef: 'Szt. 161. §',
    icon: Users,
    color: 'from-blue-500 to-indigo-600',
    columns: [
      { key: 'partner', label: 'Partner', type: 'text' },
      { key: 'taxId', label: 'Adószám', type: 'text' },
      { key: 'invoiceNumber', label: 'Számlaszám', type: 'text' },
      { key: 'invoiceDate', label: 'Számla kelt', type: 'date' },
      { key: 'dueDate', label: 'Esedékesség', type: 'date' },
      { key: 'amount', label: 'Összeg', type: 'currency', align: 'right' },
      { key: 'direction', label: 'Irány', type: 'badge' },
      { key: 'status', label: 'Státusz', type: 'badge' },
    ],
    data: [], // DB: useEvRecords → accounty_ev_records_receivables
  },

  'tao-kesz': {
    id: 'tao-kesz',
    name: 'Tárgyi eszköz nyilvántartás',
    description: 'Befektetett eszközök leltárja és értékcsökkenés-számítás',
    legalRef: 'Szt. 162. §',
    icon: Package,
    color: 'from-teal-500 to-emerald-600',
    columns: [
      { key: 'name', label: 'Eszköz neve', type: 'text' },
      { key: 'category', label: 'Kategória', type: 'text' },
      { key: 'acquisitionDate', label: 'Beszerzés', type: 'date' },
      { key: 'originalValue', label: 'Bruttó érték', type: 'currency', align: 'right' },
      { key: 'depreciationRate', label: 'ÉCS %', type: 'number', align: 'right' },
      { key: 'accumulatedDep', label: 'Halm. ÉCS', type: 'currency', align: 'right' },
      { key: 'netValue', label: 'Nettó érték', type: 'currency', align: 'right' },
      { key: 'status', label: 'Státusz', type: 'badge' },
    ],
    data: [], // DB: useEvRecords → accounty_ev_records_fixed_assets
  },

  'keszlet': {
    id: 'keszlet',
    name: 'Készletnyilvántartás',
    description: 'Anyagok, áruk, félkész és késztermékek nyilvántartása',
    legalRef: 'Szt. 163. §',
    icon: Package,
    color: 'from-amber-500 to-orange-600',
    columns: [
      { key: 'name', label: 'Megnevezés', type: 'text' },
      { key: 'unit', label: 'Egység', type: 'text' },
      { key: 'quantity', label: 'Mennyiség', type: 'number', align: 'right' },
      { key: 'unitPrice', label: 'Egységár', type: 'currency', align: 'right' },
      { key: 'totalValue', label: 'Érték', type: 'currency', align: 'right' },
      { key: 'category', label: 'Típus', type: 'badge' },
      { key: 'lastMove', label: 'Utolsó mozgás', type: 'date' },
    ],
    data: [], // DB: useEvRecords → accounty_ev_records_inventory
  },

  'utnyilv': {
    id: 'utnyilv',
    name: 'Útnyilvántartás',
    description: 'Üzleti célú gépjármű-használat menetlevele',
    legalRef: 'Szja tv. 5. sz. mell.',
    icon: Car,
    color: 'from-rose-500 to-pink-600',
    columns: [
      { key: 'date', label: 'Dátum', type: 'date' },
      { key: 'from', label: 'Honnan', type: 'text' },
      { key: 'to', label: 'Hová', type: 'text' },
      { key: 'purpose', label: 'Cél', type: 'text' },
      { key: 'km', label: 'Km', type: 'number', align: 'right' },
      { key: 'type', label: 'Típus', type: 'badge' },
      { key: 'odometerStart', label: 'Km-óra ind.', type: 'number', align: 'right' },
      { key: 'odometerEnd', label: 'Km-óra érk.', type: 'number', align: 'right' },
    ],
    data: [], // DB: useEvRecords → accounty_ev_records_vehicle_log
  },

  'berbeadas': {
    id: 'berbeadas',
    name: 'Bérbeadás nyilvántartás',
    description: 'Ingatlan bérbeadásból származó jövedelmek nyilvántartása',
    legalRef: 'Szja tv. 74. §',
    icon: Home,
    color: 'from-violet-500 to-purple-600',
    columns: [
      { key: 'property', label: 'Ingatlan', type: 'text' },
      { key: 'tenant', label: 'Bérlő', type: 'text' },
      { key: 'period', label: 'Időszak', type: 'text' },
      { key: 'rent', label: 'Bérleti díj', type: 'currency', align: 'right' },
      { key: 'expenses', label: 'Költségek', type: 'currency', align: 'right' },
      { key: 'income', label: 'Jövedelem', type: 'currency', align: 'right' },
      { key: 'status', label: 'Státusz', type: 'badge' },
    ],
    data: [], // DB: useEvRecords → accounty_ev_records_other_claims
  },

  'valuta': {
    id: 'valuta',
    name: 'Valutapénztár nyilvántartás',
    description: 'Devizás készpénz mozgások napi nyilvántartása',
    legalRef: 'Szt. 164. §',
    icon: Coins,
    color: 'from-cyan-500 to-blue-600',
    columns: [
      { key: 'date', label: 'Dátum', type: 'date' },
      { key: 'currency', label: 'Deviza', type: 'text' },
      { key: 'description', label: 'Leírás', type: 'text' },
      { key: 'direction', label: 'Irány', type: 'badge' },
      { key: 'foreignAmount', label: 'Deviza összeg', type: 'number', align: 'right' },
      { key: 'rate', label: 'Árfolyam', type: 'number', align: 'right' },
      { key: 'hufAmount', label: 'HUF összeg', type: 'currency', align: 'right' },
      { key: 'balance', label: 'Egyenleg', type: 'number', align: 'right' },
    ],
    data: [], // DB: useEvRecords → accounty_ev_records_other_claims
  },

  'munkaber': {
    id: 'munkaber',
    name: 'Munkabér-nyilvántartás',
    description: 'Alkalmazottak bér- és járulékadatainak nyilvántartása',
    legalRef: 'Mt. 154. §',
    icon: Users,
    color: 'from-green-500 to-emerald-600',
    columns: [
      { key: 'employee', label: 'Alkalmazott', type: 'text' },
      { key: 'taxId', label: 'Adóazonosító', type: 'text' },
      { key: 'period', label: 'Hónap', type: 'text' },
      { key: 'grossSalary', label: 'Bruttó bér', type: 'currency', align: 'right' },
      { key: 'szja', label: 'SZJA', type: 'currency', align: 'right' },
      { key: 'tb', label: 'TB járulék', type: 'currency', align: 'right' },
      { key: 'netSalary', label: 'Nettó bér', type: 'currency', align: 'right' },
      { key: 'status', label: 'Státusz', type: 'badge' },
    ],
    data: [], // DB: useEvRecords → accounty_ev_records_wages
  },

  'selejtezes': {
    id: 'selejtezes',
    name: 'Selejtezési jegyzőkönyv',
    description: 'Kiselejtezett eszközök dokumentálása és nyilvántartása',
    legalRef: 'Szt. 165. §',
    icon: FileText,
    color: 'from-slate-500 to-gray-600',
    columns: [
      { key: 'date', label: 'Dátum', type: 'date' },
      { key: 'assetName', label: 'Eszköz neve', type: 'text' },
      { key: 'originalValue', label: 'Eredeti érték', type: 'currency', align: 'right' },
      { key: 'residualValue', label: 'Maradványérték', type: 'currency', align: 'right' },
      { key: 'reason', label: 'Indoklás', type: 'text' },
      { key: 'method', label: 'Selejtezés módja', type: 'badge' },
      { key: 'approver', label: 'Jóváhagyta', type: 'text' },
    ],
    data: [], // DB: useEvRecords → accounty_ev_records_scrapping
  },

  'lekerdezes': {
    id: 'lekerdezes',
    name: 'Lekérdezés napló',
    description: 'NAV online adatlekérdezések és API-hívások naplózása',
    legalRef: 'Art. 129. §',
    icon: ExternalLink,
    color: 'from-sky-500 to-blue-600',
    columns: [
      { key: 'timestamp', label: 'Időpont', type: 'text' },
      { key: 'type', label: 'Típus', type: 'badge' },
      { key: 'endpoint', label: 'Végpont', type: 'text' },
      { key: 'taxId', label: 'Adószám', type: 'text' },
      { key: 'period', label: 'Időszak', type: 'text' },
      { key: 'resultCount', label: 'Eredmény', type: 'number', align: 'right' },
      { key: 'status', label: 'Státusz', type: 'badge' },
    ],
    data: [], // DB: useEvRecords → accounty_ev_audit_log
  },

  'jog-bizt': {
    id: 'jog-bizt',
    name: 'Biztosítási jogviszony nyilvántartás',
    description: 'Biztosítotti jogviszonyok és járulékfizetési kötelezettségek',
    legalRef: 'Tbj. 44. §',
    icon: FileText,
    color: 'from-fuchsia-500 to-pink-600',
    columns: [
      { key: 'name', label: 'Biztosított', type: 'text' },
      { key: 'taxId', label: 'Adóazonosító', type: 'text' },
      { key: 'type', label: 'Jogviszony típus', type: 'badge' },
      { key: 'startDate', label: 'Kezdet', type: 'date' },
      { key: 'endDate', label: 'Vége', type: 'text' },
      { key: 'monthlyBase', label: 'Havi járulékalap', type: 'currency', align: 'right' },
      { key: 'status', label: 'Státusz', type: 'badge' },
    ],
    data: [], // DB: useEvRecords → accounty_ev_records_wages
  },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatCellValue(value: string | number, type: ColumnDef['type']): React.ReactNode {
  if (value === undefined || value === null || value === '') return <span className="text-slate-300">—</span>;

  switch (type) {
    case 'currency':
      return <span className="font-mono tabular-nums">{formatHuf(Number(value))}</span>;
    case 'number':
      return <span className="font-mono tabular-nums">{Number(value).toLocaleString('hu-HU')}</span>;
    case 'date':
      return <span className="tabular-nums">{String(value)}</span>;
    case 'badge': {
      const str = String(value);
      const badgeColors: Record<string, string> = {
        'Aktív': 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
        'Kiegyenlített': 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
        'Sikeres': 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
        'Nyitott': 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
        'Üres': 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
        'Lejárt': 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
        'Hibás': 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
        'Megszűnt': 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
        'Leírt': 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
        'Vevő': 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
        'Szállító': 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400',
        'Üzleti': 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400',
        'Magán': 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400',
        'Bevétel': 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
        'Kiadás': 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
        'Számla': 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
        'Adózó': 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
        'Adószám': 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400',
        'Megsemmisítés': 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
        'Értékesítés': 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
        'Egyéni vállalkozó': 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400',
        'Munkaviszony': 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400',
        'Megbízási': 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
      };
      return (
        <span className={cn(
          'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold',
          badgeColors[str] || 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
        )}>
          {str}
        </span>
      );
    }
    default:
      return String(value);
  }
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function EvRecordDetailPage() {
  const { id, recordType } = useParams<{ id: string; recordType: string }>();
  const { data: client } = useAccountyClient(id);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortAsc, setSortAsc] = useState(true);

  const config = recordType ? RECORD_CONFIGS[recordType] : null;

  // Redirect to overview if unknown record type
  if (!config) {
    return <Navigate to={`/accounty/client/${id}/ev/records`} replace />;
  }

  // Fetch real data from DB
  const { data: dbRecords = [], isLoading } = useEvRecords(id, recordType || '', 2026);

  const Icon = config.icon;

  // Filter & sort
  const filteredData = useMemo(() => {
    let data = [...dbRecords];

    // Search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      data = data.filter(row =>
        Object.values(row).some(v => String(v).toLowerCase().includes(q))
      );
    }

    // Sort
    if (sortKey) {
      data.sort((a, b) => {
        const va = a[sortKey] ?? '';
        const vb = b[sortKey] ?? '';
        if (typeof va === 'number' && typeof vb === 'number') {
          return sortAsc ? va - vb : vb - va;
        }
        return sortAsc
          ? String(va).localeCompare(String(vb), 'hu')
          : String(vb).localeCompare(String(va), 'hu');
      });
    }

    return data;
  }, [dbRecords, searchQuery, sortKey, sortAsc]);

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortAsc(!sortAsc);
    } else {
      setSortKey(key);
      setSortAsc(true);
    }
  };

  const isEmpty = !isLoading && dbRecords.length === 0;

  return (
    <div className="w-full space-y-6 animate-in fade-in duration-500">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <Link to={`/accounty/client/${id}/ev`} className="hover:text-indigo-600 transition-colors flex items-center gap-1">
          <ArrowLeft className="w-3.5 h-3.5" /> EV Áttekintés
        </Link>
        <ChevronRight className="w-3 h-3" />
        <Link to={`/accounty/client/${id}/ev/records`} className="hover:text-indigo-600 transition-colors">
          Nyilvántartások
        </Link>
        <ChevronRight className="w-3 h-3" />
        <span className="text-slate-900 dark:text-slate-100 font-medium">{config.name}</span>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className={cn('p-2.5 bg-gradient-to-br rounded-xl shadow-lg', config.color)}>
            <Icon className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">{config.name}</h1>
            <p className="text-sm text-slate-500">
              {client?.name || 'Ügyfél'} · {config.legalRef} · {dbRecords.length} bejegyzés
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 bg-white dark:bg-slate-800 border border-border rounded-lg hover:bg-slate-50 transition-colors shadow-sm">
            <Download className="w-3 h-3" /> Export
          </button>
          <button className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors shadow-sm">
            <Plus className="w-3 h-3" /> Új bejegyzés
          </button>
        </div>
      </div>

      {/* Search & Filter bar */}
      {!isEmpty && (
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Keresés..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm bg-white dark:bg-slate-800 border border-border rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all"
            />
          </div>
          <button className="flex items-center gap-1.5 px-3 py-2 text-xs text-slate-500 border border-border rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
            <Filter className="w-3 h-3" /> Szűrők
          </button>
          <span className="text-xs text-slate-400">
            {filteredData.length} / {dbRecords.length} bejegyzés
          </span>
        </div>
      )}

      {/* Data table or empty state */}
      {isLoading ? (
        <div className="bg-card rounded-xl border border-border shadow-soft p-16 text-center">
          <Loader2 className="w-8 h-8 mx-auto mb-3 text-indigo-400 animate-spin" />
          <p className="text-sm text-slate-400">Betöltés...</p>
        </div>
      ) : isEmpty ? (
        <div className="bg-card rounded-xl border-2 border-dashed border-border p-12 text-center space-y-3">
          <div className={cn('w-14 h-14 bg-gradient-to-br rounded-2xl flex items-center justify-center mx-auto opacity-40', config.color)}>
            <Icon className="w-7 h-7 text-white" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Nincs bejegyzés</h3>
            <p className="text-xs text-slate-500 mt-1">
              Még nem került rögzítésre egyetlen tétel sem ebben a nyilvántartásban.
            </p>
          </div>
          <button className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors">
            <Plus className="w-3.5 h-3.5" /> Első bejegyzés rögzítése
          </button>
        </div>
      ) : (
        <div className="bg-card rounded-xl border border-border shadow-soft overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-slate-50 dark:bg-slate-900/30">
                  <th className="w-10 px-3 py-3">
                    <input type="checkbox" className="w-3.5 h-3.5 rounded border-slate-300" />
                  </th>
                  {config.columns.map(col => (
                    <th
                      key={col.key}
                      onClick={() => handleSort(col.key)}
                      className={cn(
                        'px-3 py-3 text-xs font-semibold uppercase tracking-wider cursor-pointer select-none hover:bg-slate-100 dark:hover:bg-slate-800/50 transition-colors',
                        col.align === 'right' ? 'text-right' : 'text-left',
                        'text-slate-500'
                      )}
                    >
                      <div className={cn('flex items-center gap-1', col.align === 'right' && 'justify-end')}>
                        {col.label}
                        <ArrowUpDown className={cn(
                          'w-3 h-3',
                          sortKey === col.key ? 'text-indigo-500' : 'text-slate-300'
                        )} />
                      </div>
                    </th>
                  ))}
                  <th className="w-12 px-3 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {filteredData.map((row, idx) => (
                  <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group">
                    <td className="px-3 py-2.5">
                      <input type="checkbox" className="w-3.5 h-3.5 rounded border-slate-300" />
                    </td>
                    {config.columns.map(col => (
                      <td
                        key={col.key}
                        className={cn(
                          'px-3 py-2.5 text-sm',
                          col.align === 'right' ? 'text-right' : 'text-left',
                          col.type === 'text' && col.key === config.columns[0].key
                            ? 'font-semibold text-slate-900 dark:text-slate-100'
                            : 'text-slate-600 dark:text-slate-400'
                        )}
                      >
                        {formatCellValue(row[col.key], col.type)}
                      </td>
                    ))}
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 hover:text-indigo-600" title="Szerkesztés">
                          <Edit2 className="w-3 h-3" />
                        </button>
                        <button className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 hover:text-red-600" title="Törlés">
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-4 py-3 border-t border-border bg-slate-50 dark:bg-slate-900/30">
            <span className="text-xs text-slate-400">
              Összesen: {filteredData.length} bejegyzés
            </span>
            <div className="flex items-center gap-2">
              <button className="px-2.5 py-1 text-xs text-slate-500 border border-border rounded hover:bg-white dark:hover:bg-slate-800 transition-colors" disabled>
                ← Előző
              </button>
              <span className="text-xs text-slate-600 font-medium">1. oldal</span>
              <button className="px-2.5 py-1 text-xs text-slate-500 border border-border rounded hover:bg-white dark:hover:bg-slate-800 transition-colors" disabled>
                Következő →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Legal info */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4">
        <div className="flex items-start gap-2">
          <Info className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
          <div className="text-xs text-blue-600 dark:text-blue-400 space-y-1">
            <p className="font-semibold">{config.name} — {config.legalRef}</p>
            <p>{config.description}</p>
            <p className="text-blue-500/70">
              A nyilvántartás adatai a NAV ellenőrzés során bemutatandók. A bejegyzések módosítása naplózásra kerül.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
