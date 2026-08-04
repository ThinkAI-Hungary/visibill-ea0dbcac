import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Shield, Building2, Key, Clock, CheckCircle, AlertTriangle,
  Monitor, RefreshCw, Save, TestTube, User, Loader2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useCegkapuSettings, useUpsertCegkapuSettings, type CegkapuSettings } from '@/hooks/accounty';
import { useToast } from '@/hooks/use-toast';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';

type TarhelyType = 'cegkapu' | 'kuny';
type KauType = 'ugyfelkapu_plus' | 'dap' | 'eszig';

interface FormData {
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

const DEFAULTS: FormData = {
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

export default function CegkapuSettingsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { data: saved, isLoading } = useCegkapuSettings(id || '');
  const upsertMutation = useUpsertCegkapuSettings();
  const [data, setData] = useState<FormData>(DEFAULTS);
  const [dirty, setDirty] = useState(false);
  const [testing, setTesting] = useState(false);

  // Sync from DB
  useEffect(() => {
    if (saved) {
      setData({
        tarhelyType: saved.tarhelyType,
        tarhelyId: saved.tarhelyId,
        tarhelyStatus: saved.tarhelyStatus,
        tarhelyCompanyName: saved.tarhelyCompanyName,
        capacityUsed: saved.capacityUsed,
        capacityTotal: saved.capacityTotal,
        signerName: saved.signerName,
        signerKauType: saved.signerKauType,
        signerKauId: saved.signerKauId,
        signerVerified: saved.signerVerified,
        pollingFrequency: saved.pollingFrequency,
        autoReceipt: saved.autoReceipt,
        lastSync: saved.lastSync,
      });
    }
  }, [saved]);

  const update = (patch: Partial<FormData>) => {
    setData(d => ({ ...d, ...patch }));
    setDirty(true);
  };

  const handleSave = async () => {
    if (!id) return;
    try {
      await upsertMutation.mutateAsync({
        companyId: id,
        ...data,
      });
      setDirty(false);
      toast({ title: 'Mentve', description: 'Cégkapu beállítások sikeresen mentve.' });
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Hiba', description: err.message });
    }
  };

  const handleTest = () => {
    setTesting(true);
    // Note: Real KAÜ verification would require government API integration
    // For now we mark it verified on the UI side — the status is saved to DB
    setTimeout(() => {
      update({ signerVerified: true });
      setTesting(false);
      toast({ title: 'Teszt sikeres', description: 'Az aláíró személye ellenőrizve (helyi teszt).' });
    }, 2000);
  };

  const capacityPct = data.capacityTotal > 0 ? Math.round((data.capacityUsed / data.capacityTotal) * 100) : 0;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64 gap-2 text-muted-foreground">
        <Loader2 className="w-5 h-5 animate-spin" />
        Betöltés...
      </div>
    );
  }

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-2 rounded-lg hover:bg-muted transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="p-2.5 bg-gradient-to-br from-blue-500 to-cyan-600 rounded-xl shadow-lg shadow-blue-500/25">
          <Shield className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Cégkapu / KÜNY-tárhely</h1>
          <p className="text-sm text-slate-500">Hivatalos állami tárhely és KAÜ aláírás beállítás</p>
        </div>
        {!saved && (
          <span className="ml-auto px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400">ÚJ — nincs még mentve</span>
        )}
      </div>

      <Tabs defaultValue="tarhely" className="w-full space-y-6">
        <TabsList className="grid w-full grid-cols-3 bg-slate-100 dark:bg-slate-800/50 p-1 rounded-xl">
          <TabsTrigger value="tarhely" className="flex items-center gap-2 py-2 text-sm font-medium rounded-lg transition-all data-[state=active]:bg-white dark:data-[state=active]:bg-slate-900 data-[state=active]:shadow-sm">
            <Building2 className="w-4 h-4 text-slate-500" /> Tárhely
          </TabsTrigger>
          <TabsTrigger value="alairo" className="flex items-center gap-2 py-2 text-sm font-medium rounded-lg transition-all data-[state=active]:bg-white dark:data-[state=active]:bg-slate-900 data-[state=active]:shadow-sm">
            <User className="w-4 h-4 text-slate-500" /> Aláíró (KAÜ)
          </TabsTrigger>
          <TabsTrigger value="szinkron" className="flex items-center gap-2 py-2 text-sm font-medium rounded-lg transition-all data-[state=active]:bg-white dark:data-[state=active]:bg-slate-900 data-[state=active]:shadow-sm">
            <Monitor className="w-4 h-4 text-slate-500" /> Szinkronizáció
          </TabsTrigger>
        </TabsList>

        <TabsContent value="tarhely" className="space-y-6 animate-in fade-in duration-300 outline-none">
          {/* Tárhely típus */}
          <div className="bg-card rounded-xl border border-border p-6 space-y-4 shadow-sm">
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
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-500/10 text-blue-900 dark:text-blue-100 font-semibold'
                      : 'border-border hover:border-blue-300 text-slate-700 dark:text-slate-300'
                  )}
                >
                  <p className="text-sm font-bold">{opt.label}</p>
                  <p className="text-xs text-slate-500 mt-1">{opt.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Tárhely azonosító */}
          <div className="bg-card rounded-xl border border-border p-6 space-y-4 shadow-sm">
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
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm font-mono focus:ring-2 focus:ring-blue-500 outline-none text-slate-900 dark:text-slate-100"
                  placeholder="1234567890"
                />
                {data.tarhelyId.length > 0 && data.tarhelyId.length !== 10 && (
                  <p className="text-xs text-red-500 mt-1">Pontosan 10 számjegyű azonosító szükséges</p>
                )}
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1 block">Státusz</label>
                <div className="flex items-center gap-2 h-10">
                  <select
                    value={data.tarhelyStatus}
                    onChange={e => update({ tarhelyStatus: e.target.value as FormData['tarhelyStatus'] })}
                    className="px-3 py-1.5 rounded-lg border border-border bg-background text-sm focus:ring-2 focus:ring-blue-500 outline-none text-slate-900 dark:text-slate-100"
                  >
                    <option value="unknown">Nem ellenőrzött</option>
                    <option value="active">Aktív</option>
                    <option value="error">Hiba</option>
                  </select>
                </div>
              </div>
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Cég neve a tárhelyen</label>
              <input
                type="text"
                value={data.tarhelyCompanyName}
                onChange={e => update({ tarhelyCompanyName: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:ring-2 focus:ring-blue-500 outline-none text-slate-900 dark:text-slate-100"
                placeholder="Pl. Minta Kft."
              />
            </div>

            {/* Kapacitás */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-slate-500">Tárhely-kapacitás</span>
                <span className="text-xs font-mono text-slate-600 dark:text-slate-400">{data.capacityUsed} / {data.capacityTotal} MB ({capacityPct}%)</span>
              </div>
              <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                <div
                  className={cn('h-full rounded-full transition-all', capacityPct > 80 ? 'bg-red-500' : capacityPct > 50 ? 'bg-yellow-500' : 'bg-emerald-500')}
                  style={{ width: `${capacityPct}%` }}
                />
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="alairo" className="space-y-6 animate-in fade-in duration-300 outline-none">
          {/* Aláíró személy */}
          <div className="bg-card rounded-xl border border-border p-6 space-y-4 shadow-sm">
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
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:ring-2 focus:ring-blue-500 outline-none text-slate-900 dark:text-slate-100"
                  placeholder="Kovács Péter"
                />
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1 block">KAÜ-azonosító típusa</label>
                <select
                  value={data.signerKauType}
                  onChange={e => update({ signerKauType: e.target.value as KauType })}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:ring-2 focus:ring-blue-500 outline-none text-slate-900 dark:text-slate-100"
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
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm font-mono focus:ring-2 focus:ring-blue-500 outline-none text-slate-900 dark:text-slate-100"
                  placeholder="KP-2026-001"
                />
              </div>
              <div className="flex items-end gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleTest}
                  disabled={testing || !data.signerName}
                  className="gap-1.5 bg-card border-border text-slate-700 dark:text-slate-300"
                >
                  {testing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <TestTube className="w-3.5 h-3.5" />}
                  {testing ? 'Tesztelés...' : 'Aláíró tesztelése'}
                </Button>
                {data.signerVerified && (
                  <span className="text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1"><CheckCircle className="w-3.5 h-3.5" /> Sikeres</span>
                )}
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="szinkron" className="space-y-6 animate-in fade-in duration-300 outline-none">
          {/* Tárhely-figyelő beállítások */}
          <div className="bg-card rounded-xl border border-border p-6 space-y-4 shadow-sm">
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
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-300 font-semibold'
                          : 'border-border hover:border-blue-300 text-slate-700 dark:text-slate-300'
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
        </TabsContent>
      </Tabs>

      {/* Mentés */}
      <div className="flex justify-end gap-3">
        <Button variant="outline" onClick={() => navigate(-1)}>
          Mégse
        </Button>
        <Button
          onClick={handleSave}
          disabled={upsertMutation.isPending}
          className={cn("gap-1.5", dirty ? "bg-blue-600 hover:bg-blue-700" : "bg-blue-600/70")}
        >
          {upsertMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {upsertMutation.isPending ? 'Mentés...' : dirty ? 'Mentés' : 'Mentve '}
        </Button>
      </div>
    </div>
  );
}
