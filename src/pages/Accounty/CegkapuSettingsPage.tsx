import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft, Shield, Building2, Key, Clock, CheckCircle, AlertTriangle,
  Monitor, RefreshCw, Save, TestTube, User, FileText
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type TarhelyType = 'cegkapu' | 'kuny';
type KauType = 'ugyfelkapu_plus' | 'dap' | 'eszig';

interface CegkapuData {
  tarhelyType: TarhelyType;
  tarhelyId: string;
  tarhelyStatus: 'active' | 'error' | 'unknown';
  tarhelyCompanyName: string;
  capacityUsed: number;
  capacityTotal: number;
  signerName: string;
  signerKauType: KauType;
  signerKauId: string;
  signerVerified: boolean;
  pollingFrequency: '15' | '30' | '60';
  autoReceipt: boolean;
  lastSync: string | null;
}

const INITIAL: CegkapuData = {
  tarhelyType: 'cegkapu',
  tarhelyId: '',
  tarhelyStatus: 'unknown',
  tarhelyCompanyName: '',
  capacityUsed: 0,
  capacityTotal: 100,
  signerName: '',
  signerKauType: 'ugyfelkapu_plus',
  signerKauId: '',
  signerVerified: false,
  pollingFrequency: '15',
  autoReceipt: true,
  lastSync: null,
};

// Mock data for demo
const MOCK_DATA: CegkapuData = {
  tarhelyType: 'cegkapu',
  tarhelyId: '1234567890',
  tarhelyStatus: 'active',
  tarhelyCompanyName: 'Teszt Kft.',
  capacityUsed: 42,
  capacityTotal: 100,
  signerName: 'Kovács Péter',
  signerKauType: 'ugyfelkapu_plus',
  signerKauId: 'KP-2026-001',
  signerVerified: true,
  pollingFrequency: '15',
  autoReceipt: true,
  lastSync: '2026-06-10T10:30:00',
};

export default function CegkapuSettingsPage() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<CegkapuData>(MOCK_DATA);
  const [saved, setSaved] = useState(false);
  const [testing, setTesting] = useState(false);

  const update = (patch: Partial<CegkapuData>) => {
    setData(d => ({ ...d, ...patch }));
    setSaved(false);
  };

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const handleTest = () => {
    setTesting(true);
    setTimeout(() => {
      update({ signerVerified: true });
      setTesting(false);
    }, 2000);
  };

  const capacityPct = Math.round((data.capacityUsed / data.capacityTotal) * 100);

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link to={`/accounty/client/${id}`} className="p-2 rounded-lg hover:bg-muted transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="p-2.5 bg-gradient-to-br from-blue-500 to-cyan-600 rounded-xl shadow-lg shadow-blue-500/25">
          <Shield className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Cégkapu / KÜNY-tárhely</h1>
          <p className="text-sm text-slate-500">Hivatalos állami tárhely és KAÜ aláírás beállítás</p>
        </div>
      </div>

      {/* Tárhely típus */}
      <div className="bg-card rounded-xl border border-border p-6 space-y-4">
        <h2 className="text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2">
          <Building2 className="w-4 h-4" /> Tárhely típusa
        </h2>
        <div className="grid grid-cols-2 gap-3">
          {[
            { value: 'cegkapu' as TarhelyType, label: 'Cégkapu', desc: 'Gazdasági társaságok számára' },
            { value: 'kuny' as TarhelyType, label: 'KÜNY-tárhely', desc: 'Egyéni vállalkozó / magánszemély' },
          ].map(opt => (
            <button
              key={opt.value}
              onClick={() => update({ tarhelyType: opt.value })}
              className={cn(
                'p-4 rounded-xl border-2 text-left transition-all',
                data.tarhelyType === opt.value
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-500/10'
                  : 'border-border hover:border-blue-300'
              )}
            >
              <p className="text-sm font-bold">{opt.label}</p>
              <p className="text-xs text-slate-500 mt-1">{opt.desc}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Tárhely azonosító */}
      <div className="bg-card rounded-xl border border-border p-6 space-y-4">
        <h2 className="text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2">
          <Key className="w-4 h-4" /> Tárhely-azonosító
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-slate-500 mb-1 block">Azonosító (10 jegyű)</label>
            <input
              type="text"
              maxLength={10}
              value={data.tarhelyId}
              onChange={e => {
                const val = e.target.value.replace(/\D/g, '').slice(0, 10);
                update({ tarhelyId: val });
              }}
              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm font-mono focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder="1234567890"
            />
            {data.tarhelyId.length > 0 && data.tarhelyId.length !== 10 && (
              <p className="text-xs text-red-500 mt-1">Pontosan 10 számjegyű azonosító szükséges</p>
            )}
          </div>
          <div>
            <label className="text-xs text-slate-500 mb-1 block">Státusz</label>
            <div className="flex items-center gap-2 h-10">
              <div className={cn(
                'px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-1.5',
                data.tarhelyStatus === 'active' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400' :
                data.tarhelyStatus === 'error' ? 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400' :
                'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400'
              )}>
                {data.tarhelyStatus === 'active' ? <CheckCircle className="w-3.5 h-3.5" /> :
                 data.tarhelyStatus === 'error' ? <AlertTriangle className="w-3.5 h-3.5" /> :
                 <Clock className="w-3.5 h-3.5" />}
                {data.tarhelyStatus === 'active' ? 'Aktív' : data.tarhelyStatus === 'error' ? 'Hiba' : 'Nem ellenőrzött'}
              </div>
            </div>
          </div>
        </div>
        {data.tarhelyCompanyName && (
          <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 dark:bg-blue-500/10 rounded-lg border border-blue-200 dark:border-blue-500/20">
            <Building2 className="w-4 h-4 text-blue-600" />
            <span className="text-sm text-blue-700 dark:text-blue-300">Címzett: <strong>{data.tarhelyCompanyName}</strong></span>
          </div>
        )}

        {/* Kapacitás */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-slate-500">Tárhely-kapacitás</span>
            <span className="text-xs font-mono text-slate-600">{data.capacityUsed} / {data.capacityTotal} MB ({capacityPct}%)</span>
          </div>
          <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
            <div
              className={cn('h-full rounded-full transition-all', capacityPct > 80 ? 'bg-red-500' : capacityPct > 50 ? 'bg-yellow-500' : 'bg-emerald-500')}
              style={{ width: `${capacityPct}%` }}
            />
          </div>
        </div>
      </div>

      {/* Aláíró személy */}
      <div className="bg-card rounded-xl border border-border p-6 space-y-4">
        <h2 className="text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2">
          <User className="w-4 h-4" /> Aláíró személy
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-slate-500 mb-1 block">Aláíró neve</label>
            <input
              type="text"
              value={data.signerName}
              onChange={e => update({ signerName: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder="Kovács Péter"
            />
          </div>
          <div>
            <label className="text-xs text-slate-500 mb-1 block">KAÜ-azonosító típusa</label>
            <select
              value={data.signerKauType}
              onChange={e => update({ signerKauType: e.target.value as KauType })}
              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            >
              <option value="ugyfelkapu_plus">Ügyfélkapu+</option>
              <option value="dap">DÁP (Digitális Állampolgárság Program)</option>
              <option value="eszig">e-SZIG</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-slate-500 mb-1 block">KAÜ azonosító</label>
            <input
              type="text"
              value={data.signerKauId}
              onChange={e => update({ signerKauId: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm font-mono focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder="KP-2026-001"
            />
          </div>
          <div className="flex items-end gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleTest}
              disabled={testing || !data.signerName}
              className="gap-1.5"
            >
              {testing ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <TestTube className="w-3.5 h-3.5" />}
              {testing ? 'Tesztelés...' : 'Aláíró tesztelése'}
            </Button>
            {data.signerVerified && (
              <span className="text-xs text-emerald-600 flex items-center gap-1"><CheckCircle className="w-3.5 h-3.5" /> Sikeres</span>
            )}
          </div>
        </div>
      </div>

      {/* Tárhely-figyelő beállítások */}
      <div className="bg-card rounded-xl border border-border p-6 space-y-4">
        <h2 className="text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2">
          <Monitor className="w-4 h-4" /> Tárhely-figyelő beállítások
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-slate-500 mb-1 block">Polling gyakoriság</label>
            <div className="flex gap-2">
              {(['15', '30', '60'] as const).map(freq => (
                <button
                  key={freq}
                  onClick={() => update({ pollingFrequency: freq })}
                  className={cn(
                    'px-4 py-2 rounded-lg text-sm font-medium transition-all border',
                    data.pollingFrequency === freq
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-300'
                      : 'border-border hover:border-blue-300'
                  )}
                >
                  {freq === '60' ? '1 óra' : `${freq} perc`}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs text-slate-500 mb-1 block">Automatikus nyugta-feldolgozás</label>
            <button
              onClick={() => update({ autoReceipt: !data.autoReceipt })}
              className={cn(
                'relative w-12 h-6 rounded-full transition-colors',
                data.autoReceipt ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'
              )}
            >
              <div className={cn(
                'absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform',
                data.autoReceipt ? 'translate-x-6' : 'translate-x-0.5'
              )} />
            </button>
          </div>
        </div>
        {data.lastSync && (
          <p className="text-xs text-slate-400">
            Utolsó szinkronizáció: {new Date(data.lastSync).toLocaleString('hu-HU')}
          </p>
        )}
      </div>

      {/* Mentés */}
      <div className="flex justify-end gap-3">
        <Button variant="outline" asChild>
          <Link to={`/accounty/client/${id}`}>Mégse</Link>
        </Button>
        <Button onClick={handleSave} className="gap-1.5 bg-blue-600 hover:bg-blue-700">
          <Save className="w-4 h-4" />
          {saved ? 'Mentve ✓' : 'Mentés'}
        </Button>
      </div>
    </div>
  );
}
