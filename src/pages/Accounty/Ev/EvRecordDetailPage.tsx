import { useDateRange } from '@/contexts/DateRangeContext';
import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { UnifiedPagination } from '@/components/ui/unified-pagination';
import { Link, useParams, Navigate, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft, ChevronRight, Plus, Search, Filter, Download, Trash2,
  Edit2, Calendar, AlertTriangle, CheckCircle2, Info, X, Save,
  Users, Package, Car, Home, Coins, BookOpen, FileText, ExternalLink,
  ArrowUpDown, Loader2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useAccountyClient } from '@/hooks/accounty';
import { formatHuf } from '@/lib/evCalculations';
import { useEvRecords, useCreateEvRecord, useUpdateEvRecord, useDeleteEvRecord } from '@/hooks/useEvData';
import { toast } from '@/hooks/use-toast';

// ─── DB Field definitions per record type ───────────────────────────────────

interface DbField {
  key: string;
  label: string;
  type: 'text' | 'number' | 'date' | 'select' | 'boolean';
  required?: boolean;
  options?: { value: string; label: string }[];
  placeholder?: string;
  isCurrency?: boolean;
}

interface RecordTypeConfig {
  name: string;
  description: string;
  legalRef: string;
  icon: React.ElementType;
  color: string;
  dbFields: DbField[];
  displayColumns: { key: string; label: string; type: 'text' | 'number' | 'date' | 'currency' | 'badge'; align?: 'left' | 'right' }[];
}

const CONFIGS: Record<string, RecordTypeConfig> = {
  'vevo-szallito': {
    name: 'Vevő-szállító nyilvántartás',
    description: 'Kintlévőségek és kötelezettségek analitikus nyilvántartása',
    legalRef: 'Szt. 161. §',
    icon: Users,
    color: 'from-blue-500 to-indigo-600',
    dbFields: [
      { key: 'customer_name', label: 'Partner neve', type: 'text', required: true, placeholder: 'Pl. Kovács Kft.' },
      { key: 'invoice_number', label: 'Számlaszám', type: 'text', placeholder: 'Pl. SZ-2026-001' },
      { key: 'completion_date', label: 'Teljesítés dátuma', type: 'date' },
      { key: 'amount', label: 'Összeg (Ft)', type: 'number', required: true, isCurrency: true },
      { key: 'settlement_date', label: 'Pénzügyi rendezés', type: 'date' },
      { key: 'notes', label: 'Megjegyzés', type: 'text', placeholder: 'Opcionális megjegyzés' },
    ],
    displayColumns: [
      { key: 'customer_name', label: 'Partner', type: 'text' },
      { key: 'invoice_number', label: 'Számlaszám', type: 'text' },
      { key: 'completion_date', label: 'Teljesítés', type: 'date' },
      { key: 'amount', label: 'Összeg', type: 'currency', align: 'right' },
      { key: 'settlement_date', label: 'Rendezés', type: 'date' },
    ],
  },
  'tao-kesz': {
    name: 'Tárgyi eszköz nyilvántartás',
    description: 'Befektetett eszközök leltárja és értékcsökkenés-számítás',
    legalRef: 'Szt. 162. §',
    icon: Package,
    color: 'from-teal-500 to-emerald-600',
    dbFields: [
      { key: 'asset_name', label: 'Eszköz neve', type: 'text', required: true, placeholder: 'Pl. Laptop Dell XPS 15' },
      { key: 'acquisition_date', label: 'Beszerzés dátuma', type: 'date', required: true },
      { key: 'acquisition_cost', label: 'Bruttó érték (Ft)', type: 'number', required: true, isCurrency: true },
      { key: 'depreciation_rate', label: 'ÉCS kulcs (%)', type: 'number', placeholder: 'Pl. 33' },
      { key: 'accumulated_depreciation', label: 'Halmozott ÉCS (Ft)', type: 'number', isCurrency: true },
      { key: 'net_value', label: 'Nettó érték (Ft)', type: 'number', isCurrency: true },
      { key: 'is_below_threshold', label: 'Kisértékű (< 200e Ft)', type: 'boolean' },
      { key: 'notes', label: 'Megjegyzés', type: 'text' },
    ],
    displayColumns: [
      { key: 'asset_name', label: 'Eszköz neve', type: 'text' },
      { key: 'acquisition_date', label: 'Beszerzés', type: 'date' },
      { key: 'acquisition_cost', label: 'Bruttó érték', type: 'currency', align: 'right' },
      { key: 'depreciation_rate', label: 'ÉCS %', type: 'number', align: 'right' },
      { key: 'net_value', label: 'Nettó érték', type: 'currency', align: 'right' },
    ],
  },
  'keszlet': {
    name: 'Készletnyilvántartás',
    description: 'Anyagok, áruk, félkész és késztermékek nyilvántartása',
    legalRef: 'Szt. 163. §',
    icon: Package,
    color: 'from-amber-500 to-orange-600',
    dbFields: [
      { key: 'item_name', label: 'Megnevezés', type: 'text', required: true, placeholder: 'Pl. Irodaszer készlet' },
      { key: 'quantity', label: 'Mennyiség', type: 'number' },
      { key: 'unit_price', label: 'Egységár (Ft)', type: 'number', isCurrency: true },
      { key: 'total_value', label: 'Összérték (Ft)', type: 'number', required: true, isCurrency: true },
      { key: 'inventory_date', label: 'Leltár dátuma', type: 'date', required: true },
      { key: 'notes', label: 'Megjegyzés', type: 'text' },
    ],
    displayColumns: [
      { key: 'item_name', label: 'Megnevezés', type: 'text' },
      { key: 'quantity', label: 'Mennyiség', type: 'number', align: 'right' },
      { key: 'unit_price', label: 'Egységár', type: 'currency', align: 'right' },
      { key: 'total_value', label: 'Összérték', type: 'currency', align: 'right' },
      { key: 'inventory_date', label: 'Leltár dátum', type: 'date' },
    ],
  },
  'utnyilv': {
    name: 'Útnyilvántartás',
    description: 'Üzleti célú gépjármű-használat menetlevele',
    legalRef: 'Szja tv. 5. sz. mell.',
    icon: Car,
    color: 'from-rose-500 to-pink-600',
    dbFields: [
      { key: 'entry_date', label: 'Dátum', type: 'date', required: true },
      { key: 'departure_location', label: 'Indulás helye', type: 'text', placeholder: 'Pl. Budapest, Iroda' },
      { key: 'arrival_location', label: 'Érkezés helye', type: 'text', placeholder: 'Pl. Debrecen, Ügyfél' },
      { key: 'distance_km', label: 'Távolság (km)', type: 'number', required: true },
      { key: 'purpose', label: 'Utazás célja', type: 'text', required: true, placeholder: 'Pl. Ügyféltalálkozó' },
      { key: 'is_business', label: 'Üzleti célú', type: 'boolean' },
      { key: 'vehicle_plate', label: 'Rendszám', type: 'text', placeholder: 'Pl. ABC-123' },
      { key: 'odometer_start', label: 'Km-óra indulás', type: 'number' },
      { key: 'odometer_end', label: 'Km-óra érkezés', type: 'number' },
      { key: 'fuel_cost', label: 'Üzemanyag költség (Ft)', type: 'number', isCurrency: true },
      { key: 'notes', label: 'Megjegyzés', type: 'text' },
    ],
    displayColumns: [
      { key: 'entry_date', label: 'Dátum', type: 'date' },
      { key: 'departure_location', label: 'Honnan', type: 'text' },
      { key: 'arrival_location', label: 'Hová', type: 'text' },
      { key: 'purpose', label: 'Cél', type: 'text' },
      { key: 'distance_km', label: 'Km', type: 'number', align: 'right' },
      { key: 'odometer_start', label: 'Km-óra ind.', type: 'number', align: 'right' },
      { key: 'odometer_end', label: 'Km-óra érk.', type: 'number', align: 'right' },
    ],
  },
  'berbeadas': {
    name: 'Egyéb követelések / bérbeadás',
    description: 'Előlegek, kölcsönök és egyéb követelések/kötelezettségek',
    legalRef: 'Szja tv. 74. §',
    icon: Home,
    color: 'from-violet-500 to-purple-600',
    dbFields: [
      { key: 'claim_type', label: 'Típus', type: 'select', required: true, options: [
        { value: 'advance_given', label: 'Adott előleg' },
        { value: 'advance_received', label: 'Kapott előleg' },
        { value: 'loan_given', label: 'Adott kölcsön' },
        { value: 'tax_obligation', label: 'Adókötelezettség' },
      ]},
      { key: 'counterparty', label: 'Partner', type: 'text', placeholder: 'Pl. Bérlő neve' },
      { key: 'amount', label: 'Összeg (Ft)', type: 'number', required: true, isCurrency: true },
      { key: 'date_incurred', label: 'Keletkezés dátuma', type: 'date', required: true },
      { key: 'date_settled', label: 'Rendezés dátuma', type: 'date' },
      { key: 'notes', label: 'Megjegyzés', type: 'text' },
    ],
    displayColumns: [
      { key: 'claim_type', label: 'Típus', type: 'badge' },
      { key: 'counterparty', label: 'Partner', type: 'text' },
      { key: 'amount', label: 'Összeg', type: 'currency', align: 'right' },
      { key: 'date_incurred', label: 'Keletkezés', type: 'date' },
      { key: 'date_settled', label: 'Rendezés', type: 'date' },
    ],
  },
  'valuta': {
    name: 'Valutapénztár nyilvántartás',
    description: 'Devizás készpénz mozgások napi nyilvántartása',
    legalRef: 'Szt. 164. §',
    icon: Coins,
    color: 'from-cyan-500 to-blue-600',
    dbFields: [
      { key: 'claim_type', label: 'Típus', type: 'select', required: true, options: [
        { value: 'advance_given', label: 'Deviza bevétel' },
        { value: 'advance_received', label: 'Deviza kiadás' },
      ]},
      { key: 'counterparty', label: 'Leírás', type: 'text', placeholder: 'Deviza tranzakció leírása' },
      { key: 'amount', label: 'HUF összeg (Ft)', type: 'number', required: true, isCurrency: true },
      { key: 'date_incurred', label: 'Dátum', type: 'date', required: true },
      { key: 'notes', label: 'Megjegyzés', type: 'text', placeholder: 'Pl. devizanem, árfolyam' },
    ],
    displayColumns: [
      { key: 'date_incurred', label: 'Dátum', type: 'date' },
      { key: 'counterparty', label: 'Leírás', type: 'text' },
      { key: 'claim_type', label: 'Irány', type: 'badge' },
      { key: 'amount', label: 'HUF összeg', type: 'currency', align: 'right' },
    ],
  },
  'munkaber': {
    name: 'Munkabér-nyilvántartás',
    description: 'Alkalmazottak bér- és járulékadatainak nyilvántartása',
    legalRef: 'Mt. 154. §',
    icon: Users,
    color: 'from-green-500 to-emerald-600',
    dbFields: [
      { key: 'record_type', label: 'Típus', type: 'select', required: true, options: [
        { value: 'wage', label: 'Munkabér' },
        { value: 'kivet', label: 'Vállalkozói kivét' },
        { value: 'contribution', label: 'Járulék' },
      ]},
      { key: 'period_month', label: 'Hónap (1-12)', type: 'number' },
      { key: 'gross_amount', label: 'Bruttó összeg (Ft)', type: 'number', required: true, isCurrency: true },
      { key: 'net_amount', label: 'Nettó összeg (Ft)', type: 'number', isCurrency: true },
      { key: 'tax_amount', label: 'SZJA (Ft)', type: 'number', isCurrency: true },
      { key: 'contribution_amount', label: 'TB járulék (Ft)', type: 'number', isCurrency: true },
      { key: 'notes', label: 'Megjegyzés', type: 'text' },
    ],
    displayColumns: [
      { key: 'record_type', label: 'Típus', type: 'badge' },
      { key: 'period_month', label: 'Hónap', type: 'number' },
      { key: 'gross_amount', label: 'Bruttó', type: 'currency', align: 'right' },
      { key: 'tax_amount', label: 'SZJA', type: 'currency', align: 'right' },
      { key: 'contribution_amount', label: 'TB', type: 'currency', align: 'right' },
      { key: 'net_amount', label: 'Nettó', type: 'currency', align: 'right' },
    ],
  },
  'selejtezes': {
    name: 'Selejtezési jegyzőkönyv',
    description: 'Kiselejtezett eszközök dokumentálása és nyilvántartása',
    legalRef: 'Szt. 165. §',
    icon: FileText,
    color: 'from-slate-500 to-gray-600',
    dbFields: [
      { key: 'asset_name', label: 'Eszköz neve', type: 'text', required: true, placeholder: 'Pl. Régi nyomtató' },
      { key: 'scrapping_date', label: 'Selejtezés dátuma', type: 'date', required: true },
      { key: 'scrapping_reason', label: 'Indoklás', type: 'text', placeholder: 'Pl. Működésképtelen' },
      { key: 'original_value', label: 'Eredeti érték (Ft)', type: 'number', isCurrency: true },
      { key: 'residual_value', label: 'Maradványérték (Ft)', type: 'number', isCurrency: true },
      { key: 'notes', label: 'Megjegyzés', type: 'text' },
    ],
    displayColumns: [
      { key: 'asset_name', label: 'Eszköz neve', type: 'text' },
      { key: 'scrapping_date', label: 'Selejtezés dátuma', type: 'date' },
      { key: 'scrapping_reason', label: 'Indoklás', type: 'text' },
      { key: 'original_value', label: 'Eredeti érték', type: 'currency', align: 'right' },
      { key: 'residual_value', label: 'Maradványérték', type: 'currency', align: 'right' },
    ],
  },
  'lekerdezes': {
    name: 'Lekérdezés napló',
    description: 'NAV online adatlekérdezések és API-hívások naplózása',
    legalRef: 'Art. 129. §',
    icon: ExternalLink,
    color: 'from-sky-500 to-blue-600',
    dbFields: [], // Read-only — populated by system
    displayColumns: [
      { key: 'action_type', label: 'Típus', type: 'badge' },
      { key: 'description', label: 'Leírás', type: 'text' },
      { key: 'created_at', label: 'Időpont', type: 'date' },
    ],
  },
  'jog-bizt': {
    name: 'Biztosítási jogviszony nyilvántartás',
    description: 'Biztosítotti jogviszonyok és járulékfizetési kötelezettségek',
    legalRef: 'Tbj. 44. §',
    icon: FileText,
    color: 'from-fuchsia-500 to-pink-600',
    dbFields: [
      { key: 'record_type', label: 'Jogviszony típus', type: 'select', required: true, options: [
        { value: 'wage', label: 'Munkaviszony' },
        { value: 'kivet', label: 'Egyéni vállalkozó' },
        { value: 'contribution', label: 'Megbízási' },
      ]},
      { key: 'period_month', label: 'Hónap (1-12)', type: 'number' },
      { key: 'gross_amount', label: 'Havi járulékalap (Ft)', type: 'number', required: true, isCurrency: true },
      { key: 'notes', label: 'Megjegyzés', type: 'text' },
    ],
    displayColumns: [
      { key: 'record_type', label: 'Jogviszony', type: 'badge' },
      { key: 'period_month', label: 'Hónap', type: 'number' },
      { key: 'gross_amount', label: 'Járulékalap', type: 'currency', align: 'right' },
      { key: 'notes', label: 'Megjegyzés', type: 'text' },
    ],
  },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

const BADGE_LABELS: Record<string, string> = {
  'advance_given': 'Adott előleg',
  'advance_received': 'Kapott előleg',
  'loan_given': 'Adott kölcsön',
  'tax_obligation': 'Adókötelezettség',
  'wage': 'Munkabér',
  'kivet': 'Vállalkozói kivét',
  'contribution': 'Járulék',
};

function formatCell(value: any, type: string): React.ReactNode {
  if (value === undefined || value === null || value === '') return <span className="text-slate-300">—</span>;
  switch (type) {
    case 'currency': return <span className="font-mono tabular-nums">{formatHuf(Number(value))}</span>;
    case 'number': return <span className="font-mono tabular-nums">{Number(value).toLocaleString('hu-HU')}</span>;
    case 'date': return <span className="tabular-nums">{String(value).substring(0, 10)}</span>;
    case 'badge': {
      const label = BADGE_LABELS[String(value)] || String(value);
      return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-primary/10 text-primary dark:bg-primary/20 dark:text-primary-foreground">{label}</span>;
    }
    default: return String(value);
  }
}

// ─── Inline form component ──────────────────────────────────────────────────

// Helper to fetch distance using Nominatim and OSRM API
async function calculateOsrmDistance(departure: string, arrival: string): Promise<number> {
  const geocode = async (query: string) => {
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`;
    const res = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'eaisybooks-visibill'
      }
    });
    if (!res.ok) throw new Error(`Geokódolás hiba: ${res.statusText}`);
    const data = await res.json();
    if (!data || data.length === 0) {
      throw new Error(`A helyszín nem található: "${query}"`);
    }
    return {
      lat: parseFloat(data[0].lat),
      lon: parseFloat(data[0].lon)
    };
  };

  const startCoords = await geocode(departure);
  const endCoords = await geocode(arrival);

  const routeUrl = `https://router.project-osrm.org/route/v1/driving/${startCoords.lon},startCoords.lat;${endCoords.lon},${endCoords.lat}?overview=false`;
  const formattedRouteUrl = `https://router.project-osrm.org/route/v1/driving/${startCoords.lon},${startCoords.lat};${endCoords.lon},${endCoords.lat}?overview=false`;
  const routeRes = await fetch(formattedRouteUrl);
  if (!routeRes.ok) throw new Error(`Útvonaltervezés hiba: ${routeRes.statusText}`);
  const routeData = await routeRes.json();
  if (!routeData.routes || routeData.routes.length === 0) {
    throw new Error('Nem található útvonal a megadott helyszínek között.');
  }

  // distance is in meters, return in km rounded to 1 decimal place
  return Math.round((routeData.routes[0].distance / 1000) * 10) / 10;
}

interface QuickDistanceCalculatorProps {
  onUseDistance?: (departure: string, arrival: string, distance: number) => void;
}

function QuickDistanceCalculator({ onUseDistance }: QuickDistanceCalculatorProps) {
  const [departure, setDeparture] = useState('');
  const [arrival, setArrival] = useState('');
  const [distance, setDistance] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCalculate = async () => {
    if (!departure || !arrival) {
      toast({
        variant: 'destructive',
        title: 'Hiányzó adatok',
        description: 'Kérjük, add meg az indulás és érkezés helyét!'
      });
      return;
    }
    setLoading(true);
    setError(null);
    setDistance(null);
    try {
      const dist = await calculateOsrmDistance(departure, arrival);
      setDistance(dist);
      toast({
        title: 'Távolság kiszámítva',
        description: `${dist} km`
      });
    } catch (err: any) {
      setError(err.message || 'Hiba történt az útvonal lekérése során.');
      toast({
        variant: 'destructive',
        title: 'Hiba a számítás során',
        description: err.message || 'Nem sikerült kiszámítani a távolságot.'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    if (distance === null) return;
    navigator.clipboard.writeText(String(distance));
    toast({ title: 'Másolva', description: 'Távolság a vágólapra másolva.' });
  };

  return (
    <div className="bg-card rounded-xl border border-primary/20 dark:border-primary/10 p-4 shadow-soft space-y-3">
      <div className="flex items-center gap-2 text-primary">
        <Car className="w-4 h-4" />
        <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Gyors Távolság-kalkulátor (OSRM / OpenStreetMap)</h3>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 items-end">
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-slate-500">Indulási hely</label>
          <Input
            placeholder="Pl. Budapest, Hősök tere"
            value={departure}
            onChange={e => setDeparture(e.target.value)}
            className="h-9 text-sm bg-card"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-slate-500">Érkezési hely</label>
          <Input
            placeholder="Pl. Debrecen, Kossuth tér"
            value={arrival}
            onChange={e => setArrival(e.target.value)}
            className="h-9 text-sm bg-card"
          />
        </div>
        <div className="flex gap-2">
          <Button
            type="button"
            onClick={handleCalculate}
            disabled={loading}
            className="flex-1 h-9 bg-primary hover:bg-primary/90 text-white text-xs font-semibold"
          >
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <Car className="w-3.5 h-3.5 mr-1" />}
            Számítás
          </Button>
        </div>
      </div>

      {distance !== null && (
        <div className="flex items-center justify-between bg-primary/5 dark:bg-primary/10 p-3 rounded-lg border border-primary/10 dark:border-primary/20 animate-in fade-in duration-300">
          <div className="text-sm text-slate-700 dark:text-slate-300">
            <span className="text-slate-500">Útvonal távolsága:</span>{' '}
            <strong className="text-primary font-bold font-mono text-base">{distance} km</strong>
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleCopy}
              className="text-xs h-8"
            >
              Másolás
            </Button>
            {onUseDistance && (
              <Button
                type="button"
                size="sm"
                onClick={() => onUseDistance(departure, arrival, distance)}
                className="bg-primary hover:bg-primary/90 text-white text-xs h-8"
              >
                Felvitel tételként
              </Button>
            )}
          </div>
        </div>
      )}

      {error && (
        <p className="text-xs text-red-500 bg-red-50 dark:bg-red-950/20 p-2.5 rounded-lg border border-red-100 dark:border-red-900/50">
          {error}
        </p>
      )}
    </div>
  );
}

function RecordForm({ fields, initialValues, onSave, onCancel, saving, recordType }: {
  fields: DbField[];
  initialValues?: Record<string, any>;
  onSave: (data: Record<string, any>) => void;
  onCancel: () => void;
  saving: boolean;
  recordType?: string;
}) {
  const [isCalculatingDistance, setIsCalculatingDistance] = useState(false);
  const [form, setForm] = useState<Record<string, any>>(() => {
    const init: Record<string, any> = {};
    fields.forEach(f => {
      if (initialValues && initialValues[f.key] !== undefined) {
        init[f.key] = initialValues[f.key];
      } else if (f.type === 'boolean') {
        init[f.key] = true;
      } else {
        init[f.key] = '';
      }
    });
    return init;
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Validate required fields
    for (const f of fields) {
      if (f.required && !form[f.key] && form[f.key] !== 0) {
        toast({ variant: 'destructive', title: 'Hiányzó mező', description: `„${f.label}" kitöltése kötelező.` });
        return;
      }
    }
    // Convert types
    const data: Record<string, any> = {};
    fields.forEach(f => {
      const val = form[f.key];
      if (f.type === 'number' && val !== '' && val !== undefined) {
        data[f.key] = Number(val);
      } else if (f.type === 'boolean') {
        data[f.key] = !!val;
      } else if (f.type === 'date' && val) {
        data[f.key] = val;
      } else if (val !== '' && val !== undefined) {
        data[f.key] = val;
      } else {
        data[f.key] = null;
      }
    });
    onSave(data);
  };

  return (
    <form onSubmit={handleSubmit} className="bg-card rounded-xl border-2 border-primary/20 dark:border-primary/10 shadow-soft p-5 space-y-4 animate-in slide-in-from-top-2 duration-300">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
          {initialValues ? 'Bejegyzés szerkesztése' : 'Új bejegyzés rögzítése'}
        </h3>
        <button type="button" onClick={onCancel} className="text-slate-400 hover:text-slate-600">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {fields.map(field => (
          <div key={field.key} className="space-y-1.5">
            <label className="text-xs font-medium text-slate-600 dark:text-slate-400">
              {field.label} {field.required && <span className="text-red-500">*</span>}
            </label>
            {field.type === 'select' ? (
              <select
                value={form[field.key] || ''}
                onChange={e => setForm(f => ({ ...f, [field.key]: e.target.value }))}
                className="w-full text-sm border border-border rounded-lg px-3 py-2 bg-card text-foreground"
                required={field.required}
              >
                <option value="">Válasszon...</option>
                {field.options?.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            ) : field.type === 'boolean' ? (
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={!!form[field.key]}
                  onChange={e => setForm(f => ({ ...f, [field.key]: e.target.checked }))}
                  className="w-4 h-4 rounded border-slate-300"
                />
                <span className="text-sm text-slate-600 dark:text-slate-400">Igen</span>
              </label>
            ) : (
              <Input
                type={field.type === 'date' ? 'date' : field.type === 'number' ? 'number' : 'text'}
                value={form[field.key] ?? ''}
                onChange={e => setForm(f => ({ ...f, [field.key]: e.target.value }))}
                placeholder={field.placeholder}
                required={field.required}
                step={field.type === 'number' ? 'any' : undefined}
                className="bg-card text-sm"
              />
            )}
            {field.key === 'distance_km' && recordType === 'utnyilv' && (
              <div className="mt-1.5">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    const dep = form['departure_location'];
                    const arr = form['arrival_location'];
                    if (!dep || !arr) {
                      toast({
                        variant: 'destructive',
                        title: 'Hiányzó adatok',
                        description: 'Kérjük, add meg az indulás és érkezés helyét a távolság számításához!'
                      });
                      return;
                    }
                    setIsCalculatingDistance(true);
                    try {
                      const dist = await calculateOsrmDistance(dep, arr);
                      setForm(f => ({ ...f, distance_km: dist }));
                      toast({
                        title: 'Távolság kiszámítva',
                        description: `Sikeres útvonaltervezés: ${dist} km`
                      });
                    } catch (err: any) {
                      toast({
                        variant: 'destructive',
                        title: 'Hiba a számítás során',
                        description: err.message || 'Nem sikerült kiszámítani az útvonalat.'
                      });
                    } finally {
                      setIsCalculatingDistance(false);
                    }
                  }}
                  disabled={isCalculatingDistance}
                  className="w-full gap-1.5 text-xs font-semibold py-1 bg-primary/5 dark:bg-primary/10 text-primary hover:bg-primary/10 border-primary/20"
                >
                  {isCalculatingDistance ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Car className="w-3.5 h-3.5" />
                  )}
                  Távolság lekérése OSRM-mel
                </Button>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="flex justify-end gap-2 pt-2 border-t border-border">
        <button type="button" onClick={onCancel} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors">
          Mégse
        </button>
        <button type="submit" disabled={saving} className="flex items-center gap-1.5 px-5 py-2 text-sm font-semibold bg-primary hover:bg-primary/90 text-white rounded-lg transition-colors disabled:opacity-50">
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
          Mentés
        </button>
      </div>
    </form>
  );
}

// ─── Delete confirmation ────────────────────────────────────────────────────

function DeleteConfirm({ onConfirm, onCancel, deleting }: {
  onConfirm: () => void;
  onCancel: () => void;
  deleting: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 animate-in fade-in duration-200">
      <div className="bg-card rounded-xl border border-border shadow-xl p-6 max-w-sm w-full mx-4 space-y-4 animate-in zoom-in-95 duration-200">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center">
            <AlertTriangle className="w-5 h-5 text-red-600" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Biztosan törli?</h3>
            <p className="text-xs text-slate-500">A törlés nem vonható vissza.</p>
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <button onClick={onCancel} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">Mégse</button>
          <button onClick={onConfirm} disabled={deleting} className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50">
            {deleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
            Törlés
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main component ─────────────────────────────────────────────────────────

export default function EvRecordDetailPage() {
  const { companyId, recordType, dateRange } = useParams<{ companyId: string; recordType: string; dateRange: string }>();
  const id = companyId;
  const { data: client } = useAccountyClient(id);

  // UI state
  const [searchQuery, setSearchQuery] = useState('');
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortAsc, setSortAsc] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingRow, setEditingRow] = useState<Record<string, any> | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [prepopulatedValues, setPrepopulatedValues] = useState<Record<string, any> | null>(null);

  const handleUseDistance = useCallback((departure: string, arrival: string, distance: number) => {
    setPrepopulatedValues({
      departure_location: departure,
      arrival_location: arrival,
      distance_km: distance,
      entry_date: new Date().toISOString().split('T')[0]
    });
    setShowAddForm(true);
    setEditingRow(null);
  }, []);

  const config = recordType ? CONFIGS[recordType] : null;

  const [searchParams] = useSearchParams();
  const { dateFrom, setDateFrom, setDateTo, dateFromFormatted, dateToFormatted } = useDateRange();
  const taxYear = dateFrom.getFullYear();

  // Hooks
  const { data: dbRecords = [], isLoading } = useEvRecords(id, config && recordType ? recordType : '', taxYear);
  const createRecord = useCreateEvRecord();
  const updateRecord = useUpdateEvRecord();
  const deleteRecord = useDeleteEvRecord();

  const Icon = config?.icon;
  const isReadOnly = config ? config.dbFields.length === 0 : true; // e.g. audit log

  // Find primary date column for filtering
  const dateCol = config?.displayColumns.find(c => c.type === 'date')?.key;

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

    // Date range filter
    if (dateCol && filterDateFrom) {
      data = data.filter(row => String(row[dateCol] ?? '') >= filterDateFrom);
    }
    if (dateCol && filterDateTo) {
      data = data.filter(row => String(row[dateCol] ?? '') <= filterDateTo);
    }

    // Sort
    if (sortKey) {
      data.sort((a, b) => {
        const va = a[sortKey] ?? '';
        const vb = b[sortKey] ?? '';
        if (typeof va === 'number' && typeof vb === 'number') return sortAsc ? va - vb : vb - va;
        return sortAsc ? String(va).localeCompare(String(vb), 'hu') : String(vb).localeCompare(String(va), 'hu');
      });
    }

    return data;
  }, [dbRecords, searchQuery, sortKey, sortAsc, dateCol, filterDateFrom, filterDateTo]);

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, filterDateFrom, filterDateTo, sortKey, sortAsc]);

  const totalItems = filteredData.length;
  const totalPages = Math.ceil(totalItems / pageSize);

  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredData.slice(start, start + pageSize);
  }, [filteredData, currentPage, pageSize]);

  const handleSort = (key: string) => {
    if (sortKey === key) setSortAsc(!sortAsc);
    else { setSortKey(key); setSortAsc(true); }
  };

  const handleCreate = useCallback(async (data: Record<string, any>) => {
    if (!id || !recordType) return;
    try {
      await createRecord.mutateAsync({
        recordType,
        data: { ...data, company_id: id, tax_year: taxYear },
      });
      toast({ title: 'Bejegyzés rögzítve', description: 'Sikeresen mentve.' });
      setShowAddForm(false);
      setPrepopulatedValues(null);
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Hiba', description: err.message || 'Nem sikerült menteni.' });
    }
  }, [id, recordType, createRecord, taxYear]);

  const handleUpdate = useCallback(async (data: Record<string, any>) => {
    if (!editingRow?.id || !recordType) return;
    try {
      await updateRecord.mutateAsync({
        recordType,
        id: editingRow.id,
        data,
      });
      toast({ title: 'Bejegyzés frissítve', description: 'Sikeresen mentve.' });
      setEditingRow(null);
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Hiba', description: err.message || 'Nem sikerült menteni.' });
    }
  }, [editingRow, recordType, updateRecord]);

  const handleDelete = useCallback(async () => {
    if (!deletingId || !recordType) return;
    try {
      await deleteRecord.mutateAsync({ recordType, id: deletingId });
      toast({ title: 'Bejegyzés törölve' });
      setDeletingId(null);
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Hiba', description: err.message || 'Nem sikerült törölni.' });
    }
  }, [deletingId, recordType, deleteRecord]);

  if (!config) {
    return <Navigate to={`/eaisybooks/${id}/${dateRange}/ev/records`} replace />;
  }

  const handleExport = () => {
    if (filteredData.length === 0) {
      toast({ variant: 'destructive', title: 'Nincs exportálható adat' });
      return;
    }
    const headers = config.displayColumns.map(c => c.label).join(';');
    const rows = filteredData.map(row =>
      config.displayColumns.map(col => {
        const val = row[col.key];
        if (col.type === 'badge') return BADGE_LABELS[String(val)] || String(val ?? '');
        return String(val ?? '');
      }).join(';')
    );
    const csv = '\uFEFF' + [headers, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${recordType}_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: 'Export kész', description: `${filteredData.length} bejegyzés exportálva.` });
  };

  const isEmpty = !isLoading && dbRecords.length === 0;

  return (
    <div className="w-full space-y-6 animate-in fade-in duration-500">
      {/* Delete confirmation modal */}
      {deletingId && (
        <DeleteConfirm
          onConfirm={handleDelete}
          onCancel={() => setDeletingId(null)}
          deleting={deleteRecord.isPending}
        />
      )}

      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <Link to={`/eaisybooks/${id}/${dateRange}/ev?year=${taxYear}`} className="hover:text-primary transition-colors flex items-center gap-1">
          <ArrowLeft className="w-3.5 h-3.5" /> EV Áttekintés
        </Link>
        <ChevronRight className="w-3 h-3" />
        <Link to={`/eaisybooks/${id}/${dateRange}/ev/records?year=${taxYear}`} className="hover:text-primary transition-colors">
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
          <button onClick={handleExport} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 bg-white dark:bg-slate-800 border border-border rounded-lg hover:bg-slate-50 transition-colors shadow-sm">
            <Download className="w-3 h-3" /> Export
          </button>
          {!isReadOnly && (
            <button
              onClick={() => { setShowAddForm(!showAddForm); setEditingRow(null); }}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors shadow-sm',
                showAddForm
                  ? 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                  : 'bg-primary text-white hover:bg-primary/90'
              )}
            >
              {showAddForm ? <><X className="w-3 h-3" /> Mégse</> : <><Plus className="w-3 h-3" /> Új bejegyzés</>}
            </button>
          )}
        </div>
      </div>

      {/* Quick Distance Calculator for Mileage Log */}
      {recordType === 'utnyilv' && !isReadOnly && (
        <QuickDistanceCalculator onUseDistance={handleUseDistance} />
      )}

      {/* Add form */}
      {showAddForm && !isReadOnly && (
        <RecordForm
          fields={config.dbFields}
          initialValues={prepopulatedValues || undefined}
          onSave={handleCreate}
          onCancel={() => { setShowAddForm(false); setPrepopulatedValues(null); }}
          saving={createRecord.isPending}
          recordType={recordType}
        />
      )}

      {/* Edit form */}
      {editingRow && !isReadOnly && (
        <RecordForm
          fields={config.dbFields}
          initialValues={editingRow}
          onSave={handleUpdate}
          onCancel={() => setEditingRow(null)}
          saving={updateRecord.isPending}
          recordType={recordType}
        />
      )}

      {/* Search & Filter bar */}
      {!isEmpty && (
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Keresés..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm bg-white dark:bg-slate-800 border border-border rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
              />
            </div>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-2 text-xs border rounded-lg transition-colors',
                showFilters
                  ? 'border-primary bg-primary/5 dark:bg-primary/10 text-primary hover:bg-primary/10'
                  : 'text-slate-500 border-border hover:bg-slate-50 dark:hover:bg-slate-800'
              )}
            >
              <Filter className="w-3 h-3" /> Szűrők
              {(filterDateFrom || filterDateTo) && (
                <span className="w-1.5 h-1.5 rounded-full bg-primary" />
              )}
            </button>
            <span className="text-xs text-slate-400">
              {filteredData.length} / {dbRecords.length} bejegyzés
            </span>
          </div>

          {/* Filter panel */}
          {showFilters && dateCol && (
            <div className="bg-card border border-border rounded-lg p-4 flex items-end gap-4 animate-in slide-in-from-top-2 duration-200">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-500">Dátum tól</label>
                <Input
                  type="date"
                  value={filterDateFrom}
                  onChange={e => setFilterDateFrom(e.target.value)}
                  className="bg-card h-8 text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-500">Dátum ig</label>
                <Input
                  type="date"
                  value={filterDateTo}
                  onChange={e => setFilterDateTo(e.target.value)}
                  className="bg-card h-8 text-sm"
                />
              </div>
              {(filterDateFrom || filterDateTo) && (
                <button
                  onClick={() => { setFilterDateFrom(''); setFilterDateTo(''); }}
                  className="px-3 py-1.5 text-xs text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                >
                  Szűrők törlése
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Data table or empty state */}
      {isLoading ? (
        <div className="bg-card rounded-xl border border-border shadow-soft p-16 text-center">
          <Loader2 className="w-8 h-8 mx-auto mb-3 text-primary animate-spin" />
          <p className="text-sm text-slate-400">Betöltés...</p>
        </div>
      ) : isEmpty && !showAddForm ? (
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
          {!isReadOnly && (
            <button
              onClick={() => setShowAddForm(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-primary rounded-lg hover:bg-primary/90 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" /> Első bejegyzés rögzítése
            </button>
          )}
        </div>
      ) : filteredData.length > 0 && (
        <div className="bg-card rounded-xl border border-border shadow-soft overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-slate-50 dark:bg-slate-900/30">
                  {config.displayColumns.map(col => (
                    <th
                      key={col.key}
                      onClick={() => handleSort(col.key)}
                      className={cn(
                        'px-4 py-3 text-xs font-semibold uppercase tracking-wider cursor-pointer select-none hover:bg-slate-100 dark:hover:bg-slate-800/50 transition-colors',
                        col.align === 'right' ? 'text-right' : 'text-left',
                        'text-slate-500'
                      )}
                    >
                      <div className={cn('flex items-center gap-1', col.align === 'right' && 'justify-end')}>
                        {col.label}
                        <ArrowUpDown className={cn('w-3 h-3', sortKey === col.key ? 'text-primary' : 'text-slate-300')} />
                      </div>
                    </th>
                  ))}
                  {!isReadOnly && <th className="w-20 px-3 py-3" />}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {paginatedData.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group">
                    {config.displayColumns.map((col, ci) => (
                      <td
                        key={col.key}
                        className={cn(
                          'px-4 py-2.5 text-sm',
                          col.align === 'right' ? 'text-right' : 'text-left',
                          ci === 0 ? 'font-semibold text-slate-900 dark:text-slate-100' : 'text-slate-600 dark:text-slate-400'
                        )}
                      >
                        {formatCell(row[col.key], col.type)}
                      </td>
                    ))}
                    {!isReadOnly && (
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => { setEditingRow(row); setShowAddForm(false); }}
                            className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 hover:text-primary transition-colors"
                            title="Szerkesztés"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setDeletingId(row.id)}
                            className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 hover:text-red-600 transition-colors"
                            title="Törlés"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="border-t border-border px-4 py-3 bg-card">
              <UnifiedPagination
                currentPage={currentPage}
                totalPages={totalPages}
                totalItems={totalItems}
                pageSize={pageSize}
                onPageChange={setCurrentPage}
                onPageSizeChange={setPageSize}
                pageSizeOptions={[10, 25, 50]}
              />
            </div>
          )}

          {/* Footer */}
          <div className="flex items-center justify-between px-4 py-3 border-t border-border bg-slate-50 dark:bg-slate-900/30">
            <span className="text-xs text-slate-400">
              Összesen: {filteredData.length} bejegyzés
            </span>
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
