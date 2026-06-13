import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft, Settings, Save, Building2, Clock, Calculator, MapPin,
  Globe, AlertTriangle, Plus, Trash2, Loader2, CheckCircle, CreditCard
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { useAccountyClients, useAccountyTaxProfile } from '@/hooks/useAccountyData';
import { useCompanyLocations } from '@/hooks/useCompanyLocations';
import { supabase } from '@/integrations/supabase/client';
import { Breadcrumb } from '@/components/accounty/SharedComponents';

type Tab = 'payroll' | 'locations' | 'nav' | 'documents';

interface PayrollSettings {
  rounding: 'none' | '1' | '10' | '100';
  workDaysSource: 'official' | 'custom';
  customWorkDays: number;
  premiumRules: 'mt' | 'ksz' | 'custom';
  costCenterEnabled: boolean;
  defaultWeeklyHours: number;
  szepProvider: string;
  paymentDay: number;
  emailPayslips: boolean;
  remoteAllowanceDefault: number;
}

const DEFAULT_SETTINGS: PayrollSettings = {
  rounding: '1',
  workDaysSource: 'official',
  customWorkDays: 22,
  premiumRules: 'mt',
  costCenterEnabled: false,
  defaultWeeklyHours: 40,
  szepProvider: '',
  paymentDay: 10,
  emailPayslips: false,
  remoteAllowanceDefault: 32280,
};

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: 'payroll', label: 'Bérszámfejtés', icon: Calculator },
  { id: 'locations', label: 'Telephelyek', icon: MapPin },
  { id: 'nav', label: 'NAV / Integráció', icon: Globe },
  { id: 'documents', label: 'Dokumentumok', icon: CreditCard },
];

export default function CompanyPayrollSettingsPage() {
  const { id: companyId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  const { data: allClients } = useAccountyClients();
  const company = allClients?.find(c => c.companyId === companyId);
  const companyName = company?.name || 'Cég';

  const { data: taxProfile } = useAccountyTaxProfile(companyId || '');
  const { locations, isLoading: locLoading, addLocation, deleteLocation } = useCompanyLocations(companyId);

  const [tab, setTab] = useState<Tab>('payroll');
  const [settings, setSettings] = useState<PayrollSettings>(DEFAULT_SETTINGS);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  // Location form
  const [newLocName, setNewLocName] = useState('');
  const [newLocAddress, setNewLocAddress] = useState('');
  const [newLocType, setNewLocType] = useState<'headquarters' | 'branch'>('branch');

  // NAV settings
  const [navApiKey, setNavApiKey] = useState('');
  const [navEnv, setNavEnv] = useState<'production' | 'sandbox'>('sandbox');
  const [navTechnicalUser, setNavTechnicalUser] = useState('');

  // Load existing settings from tax_profiles.payroll_settings
  useEffect(() => {
    if (!companyId) return;
    supabase
      .from('accounty_tax_profiles')
      .select('payroll_settings')
      .eq('company_id', companyId)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.payroll_settings && typeof data.payroll_settings === 'object') {
          setSettings(s => ({ ...s, ...(data.payroll_settings as Record<string, unknown>) }));
        }
      });
  }, [companyId]);

  const update = (patch: Partial<PayrollSettings>) => {
    setSettings(s => ({ ...s, ...patch }));
    setDirty(true);
  };

  const handleSave = async () => {
    if (!companyId) return;
    setSaving(true);
    try {
      // Upsert payroll_settings into accounty_tax_profiles
      const { error } = await supabase
        .from('accounty_tax_profiles')
        .upsert(
          {
            company_id: companyId,
            payroll_settings: settings as unknown as Record<string, unknown>,
            has_payroll: true,
          },
          { onConflict: 'company_id' }
        );
      if (error) throw error;
      setDirty(false);
      toast({ title: 'Beállítások mentve ' });
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Hiba', description: err.message });
    } finally {
      setSaving(false);
    }
  };

  const handleAddLocation = async () => {
    if (!newLocName.trim() || !newLocAddress.trim()) return;
    try {
      await addLocation.mutateAsync({ name: newLocName.trim(), address: newLocAddress.trim(), location_type: newLocType });
      setNewLocName('');
      setNewLocAddress('');
      toast({ title: 'Telephely hozzáadva ' });
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Hiba', description: err.message });
    }
  };

  const handleDeleteLocation = async (locId: string) => {
    try {
      await deleteLocation.mutateAsync(locId);
      toast({ title: 'Telephely törölve' });
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Hiba', description: err.message });
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6 animate-in fade-in duration-500">
      <Breadcrumb
        items={[
          { label: 'Portfólió', href: '/accounty' },
          { label: companyName, href: `/accounty/payroll/${companyId}` },
          { label: 'Beállítások' },
        ]}
        onNavigate={navigate}
      />

      <div className="flex items-center gap-3">
        <Link to={`/accounty/payroll/${companyId}`} className="p-2 rounded-lg hover:bg-muted transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="p-2.5 bg-gradient-to-br from-slate-600 to-slate-800 rounded-xl shadow-lg">
          <Settings className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Cég beállítások</h1>
          <p className="text-sm text-slate-500">{companyName} — Bérszámfejtési konfiguráció</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 dark:bg-slate-800/50 rounded-lg p-0.5 w-fit">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              'flex items-center gap-1.5 px-4 py-2 rounded-md text-xs font-medium transition-all',
              tab === t.id
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            )}
          >
            <t.icon className="w-3.5 h-3.5" /> {t.label}
          </button>
        ))}
      </div>

      {/* ── Bérszámfejtés tab ── */}
      {tab === 'payroll' && (
        <div className="space-y-6">
          <div className="bg-card rounded-xl border border-border p-6 space-y-4">
            <h2 className="text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2">
              <Clock className="w-4 h-4" /> Munkaidő & Kerekítés
            </h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-slate-500 mb-1 block">Heti munkaidő alapértelmezés (óra)</label>
                <input
                  type="number"
                  value={settings.defaultWeeklyHours}
                  onChange={e => update({ defaultWeeklyHours: Number(e.target.value) })}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm font-mono"
                />
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1 block">Kerekítés</label>
                <select
                  value={settings.rounding}
                  onChange={e => update({ rounding: e.target.value as PayrollSettings['rounding'] })}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm"
                >
                  <option value="none">Nincs kerekítés</option>
                  <option value="1">1 Ft-ra kerekít</option>
                  <option value="10">10 Ft-ra kerekít</option>
                  <option value="100">100 Ft-ra kerekít</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1 block">Munkanapok forrása</label>
                <select
                  value={settings.workDaysSource}
                  onChange={e => update({ workDaysSource: e.target.value as 'official' | 'custom' })}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm"
                >
                  <option value="official">Hivatalos munkarend</option>
                  <option value="custom">Egyéni munkanap-szám</option>
                </select>
              </div>
              {settings.workDaysSource === 'custom' && (
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">Egyéni munkanapok / hó</label>
                  <input
                    type="number"
                    value={settings.customWorkDays}
                    onChange={e => update({ customWorkDays: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm font-mono"
                  />
                </div>
              )}
            </div>
          </div>

          <div className="bg-card rounded-xl border border-border p-6 space-y-4">
            <h2 className="text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2">
              <Calculator className="w-4 h-4" /> Pótlék & Juttatás
            </h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-slate-500 mb-1 block">Pótlékszámítás</label>
                <select
                  value={settings.premiumRules}
                  onChange={e => update({ premiumRules: e.target.value as 'mt' | 'ksz' | 'custom' })}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm"
                >
                  <option value="mt">Munka Törvénykönyve (Mt.)</option>
                  <option value="ksz">Kollektív Szerződés (KSZ)</option>
                  <option value="custom">Egyéni szabályok</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1 block">SZÉP-kártya szolgáltató</label>
                <select
                  value={settings.szepProvider}
                  onChange={e => update({ szepProvider: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm"
                >
                  <option value="">— Nincs megadva —</option>
                  <option value="otp">OTP Bank</option>
                  <option value="kh">K&H Bank</option>
                  <option value="mbh">MBH Bank</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1 block">Távmunka átalány (Ft/hó)</label>
                <input
                  type="number"
                  value={settings.remoteAllowanceDefault}
                  onChange={e => update({ remoteAllowanceDefault: Number(e.target.value) })}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm font-mono"
                />
                <p className="text-[10px] text-slate-400 mt-0.5">2026: max 32 280 Ft/hó adómentes</p>
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1 block">Fizetési nap (hónap hányadika)</label>
                <input
                  type="number"
                  min={1}
                  max={28}
                  value={settings.paymentDay}
                  onChange={e => update({ paymentDay: Number(e.target.value) })}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm font-mono"
                />
              </div>
            </div>
          </div>

          <div className="bg-card rounded-xl border border-border p-6 space-y-4">
            <h2 className="text-sm font-bold text-slate-700 dark:text-slate-300">Egyéb</h2>
            <div className="space-y-3">
              {[
                { key: 'costCenterEnabled' as const, label: 'Költséghely-kezelés engedélyezése', desc: 'Foglalkoztatottaknál költséghely mezők megjelenítése' },
                { key: 'emailPayslips' as const, label: 'Bérjegyzék e-mailben', desc: 'Automatikus e-mail küldés a számfejtés lezárásakor' },
              ].map(item => (
                <div key={item.key} className="flex items-center justify-between p-4 rounded-xl border border-border hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                  <div>
                    <p className="text-sm font-bold">{item.label}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{item.desc}</p>
                  </div>
                  <button
                    onClick={() => update({ [item.key]: !settings[item.key] } as Partial<PayrollSettings>)}
                    className={cn(
                      'relative w-12 h-6 rounded-full transition-colors',
                      settings[item.key] ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'
                    )}
                  >
                    <div className={cn(
                      'absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform',
                      settings[item.key] ? 'translate-x-6' : 'translate-x-0.5'
                    )} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Telephelyek tab ── */}
      {tab === 'locations' && (
        <div className="space-y-6">
          <div className="bg-card rounded-xl border border-border p-6 space-y-4">
            <h2 className="text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2">
              <MapPin className="w-4 h-4" /> Telephelyek
            </h2>
            <p className="text-xs text-slate-500">A telephelyek a jogviszony módosítás és eszköznyilvántartás modulokban jelennek meg.</p>

            {locLoading ? (
              <div className="flex items-center justify-center py-8 text-muted-foreground gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Betöltés...</div>
            ) : locations.length === 0 ? (
              <div className="py-8 text-center text-sm text-slate-400">
                <MapPin className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                Nincs telephely felvéve
              </div>
            ) : (
              <div className="divide-y divide-border/50">
                {locations.map(loc => (
                  <div key={loc.id} className="flex items-center justify-between py-3">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        'w-8 h-8 rounded-lg flex items-center justify-center',
                        loc.location_type === 'headquarters' ? 'bg-blue-100 dark:bg-blue-900/30' : 'bg-slate-100 dark:bg-slate-800'
                      )}>
                        {loc.location_type === 'headquarters' ? <Building2 className="w-4 h-4 text-blue-600" /> : <MapPin className="w-4 h-4 text-slate-500" />}
                      </div>
                      <div>
                        <p className="text-sm font-semibold">{loc.name}</p>
                        <p className="text-xs text-slate-500">{loc.address} · {loc.location_type === 'headquarters' ? 'Székhely' : 'Telephely'}</p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteLocation(loc.id)}
                      className="text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Add new location */}
          <div className="bg-card rounded-xl border border-border p-6 space-y-4">
            <h2 className="text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2">
              <Plus className="w-4 h-4" /> Új telephely hozzáadása
            </h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-slate-500 mb-1 block">Telephely neve</label>
                <input
                  type="text"
                  value={newLocName}
                  onChange={e => setNewLocName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm"
                  placeholder="Pl. Központi iroda"
                />
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1 block">Cím</label>
                <input
                  type="text"
                  value={newLocAddress}
                  onChange={e => setNewLocAddress(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm"
                  placeholder="Pl. 1052 Budapest, Váci u. 1."
                />
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1 block">Típus</label>
                <select
                  value={newLocType}
                  onChange={e => setNewLocType(e.target.value as 'headquarters' | 'branch')}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm"
                >
                  <option value="headquarters">Székhely</option>
                  <option value="branch">Telephely</option>
                </select>
              </div>
            </div>
            <Button
              onClick={handleAddLocation}
              disabled={!newLocName.trim() || !newLocAddress.trim() || addLocation.isPending}
              className="gap-1.5"
            >
              {addLocation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Hozzáadás
            </Button>
          </div>
        </div>
      )}

      {/* ── NAV / Integráció tab ── */}
      {tab === 'nav' && (
        <div className="space-y-6">
          <div className="bg-card rounded-xl border border-border p-6 space-y-5">
            <h2 className="text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2">
              <Globe className="w-4 h-4" /> NAV Online kapcsolat
            </h2>
            <div className="bg-yellow-50 dark:bg-yellow-500/10 border border-yellow-200 dark:border-yellow-500/20 rounded-lg p-3 text-sm text-yellow-800 dark:text-yellow-300">
              <AlertTriangle className="w-4 h-4 inline mr-1" />
              Az API kulcs módosítása azonnali hatással van a NAV Online Számla és bevallás modulokra.
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-slate-500 mb-1 block">NAV technikai felhasználó</label>
                <input
                  type="text"
                  value={navTechnicalUser}
                  onChange={e => setNavTechnicalUser(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm font-mono"
                  placeholder="technikai_felhasznalo"
                />
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1 block">NAV API kulcs</label>
                <input
                  type="password"
                  value={navApiKey}
                  onChange={e => setNavApiKey(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm font-mono"
                  placeholder="••••••••"
                />
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1 block">Környezet</label>
                <select
                  value={navEnv}
                  onChange={e => setNavEnv(e.target.value as 'production' | 'sandbox')}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm"
                >
                  <option value="production"> Éles (production)</option>
                  <option value="sandbox"> Teszt (sandbox)</option>
                </select>
              </div>
            </div>
          </div>

          <div className="bg-card rounded-xl border border-border p-6 space-y-4">
            <h2 className="text-sm font-bold text-slate-700 dark:text-slate-300">Adózási profil</h2>
            <div className="grid grid-cols-3 gap-4">
              <div className="p-4 rounded-xl border border-border text-center">
                <p className="text-xs text-slate-500">ÁFA gyakoriság</p>
                <p className="text-sm font-bold mt-1">{taxProfile?.vatFrequency === 'monthly' ? 'Havi' : taxProfile?.vatFrequency === 'quarterly' ? 'Negyedéves' : taxProfile?.vatFrequency === 'annual' ? 'Éves' : '—'}</p>
              </div>
              <div className="p-4 rounded-xl border border-border text-center">
                <p className="text-xs text-slate-500">KATA</p>
                <p className="text-sm font-bold mt-1">{taxProfile?.isKata ? ' Igen' : ' Nem'}</p>
              </div>
              <div className="p-4 rounded-xl border border-border text-center">
                <p className="text-xs text-slate-500">KIVA</p>
                <p className="text-sm font-bold mt-1">{taxProfile?.isKiva ? ' Igen' : ' Nem'}</p>
              </div>
            </div>
            <p className="text-[10px] text-slate-400">Az adózási profilt az Accounty Portfólió → Cégadatok oldalon módosíthatod.</p>
          </div>
        </div>
      )}

      {/* ── Dokumentumok tab ── */}
      {tab === 'documents' && (
        <div className="bg-card rounded-xl border border-border p-6 space-y-5">
          <h2 className="text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2">
            <CreditCard className="w-4 h-4" /> Dokumentum beállítások
          </h2>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-4 rounded-xl border border-border">
              <div>
                <p className="text-sm font-bold">E-bérjegyzék engedélyezése</p>
                <p className="text-xs text-slate-500 mt-0.5">Foglalkoztatottak e-mailben kapják a bérjegyzéket PDF-ben</p>
              </div>
              <button
                onClick={() => update({ emailPayslips: !settings.emailPayslips })}
                className={cn(
                  'relative w-12 h-6 rounded-full transition-colors',
                  settings.emailPayslips ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'
                )}
              >
                <div className={cn(
                  'absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform',
                  settings.emailPayslips ? 'translate-x-6' : 'translate-x-0.5'
                )} />
              </button>
            </div>
          </div>
          <p className="text-[10px] text-slate-400">További dokumentum-sablonok az Admin → Sablonok menüben kezelhetők.</p>
        </div>
      )}

      {/* Save button */}
      <div className="flex items-center justify-between">
        {dirty && (
          <p className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
            <AlertTriangle className="w-3.5 h-3.5" /> Mentetlen módosítások
          </p>
        )}
        <div className="flex gap-3 ml-auto">
          <Button variant="outline" asChild>
            <Link to={`/accounty/payroll/${companyId}`}>Vissza</Link>
          </Button>
          <Button onClick={handleSave} disabled={saving} className="gap-1.5 bg-slate-900 dark:bg-slate-100 dark:text-slate-900 hover:bg-slate-800">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {saving ? 'Mentés...' : 'Beállítások mentése'}
          </Button>
        </div>
      </div>
    </div>
  );
}
