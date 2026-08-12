import React, { useState, useMemo, useEffect } from 'react';
import { UnifiedPagination } from '@/components/ui/unified-pagination';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, FileText, Plus, Shield, Clock, CheckCircle, AlertTriangle,
  ChevronRight, X, Calendar, Users, Trash2, Loader2, ChevronLeft
} from 'lucide-react';
import { useAccountyClient } from '@/hooks/accounty';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useNavRepresentations, useAddNavRepresentation, useRevokeNavRepresentation, type NavRepresentation } from '@/hooks/accounty';
import { useToast } from '@/hooks/use-toast';
import { AccountyErrorState } from '@/components/accounty/AccountyErrorState';

// Wizard steps
const WIZARD_STEPS = [
  { num: 1, label: 'Típus' },
  { num: 2, label: 'Hatáskör' },
  { num: 3, label: 'Időtartam' },
  { num: 4, label: 'Előnézet' },
  { num: 5, label: 'Beküldés' },
];

interface WizardData {
  type: 'person' | 'organization';
  name: string;
  taxId: string;
  scope: 'all' | 'payroll' | 'custom';
  customScopes: string[];
  startDate: string;
  endDate: string;
  indefinite: boolean;
}

const SCOPE_OPTIONS = [
  'SZJA bevallás', '2608 járulékbevallás', '08E bejelentés', 'KIVA bevallás',
  'TAO bevallás', 'HIPA bevallás', 'Rehabilitációs hozzájárulás',
  'KATA nyilatkozat', 'Meghatalmazás módosítása',
];

export default function RepresentationPage() {
  const { companyId, dateRange } = useParams<{ companyId: string; dateRange: string }>();
  const navigate = useNavigate();
  const id = companyId;
  const { toast } = useToast();
  const { data: client, isLoading: clientLoading } = useAccountyClient(id || '');
  const { data: reps, isLoading, isError: repsError, refetch: refetchReps } = useNavRepresentations(id || '');
  const addMutation = useAddNavRepresentation();
  const revokeMutation = useRevokeNavRepresentation();
  
  const [showWizard, setShowWizard] = useState(false);
  const [wizardStep, setWizardStep] = useState(1);
  const [confirmed, setConfirmed] = useState(false);
  const [wizardData, setWizardData] = useState<WizardData>({
    type: 'organization',
    name: '',
    taxId: '',
    scope: 'all',
    customScopes: [],
    startDate: new Date().toISOString().split('T')[0],
    endDate: '',
    indefinite: true,
  });

  // Step validation
  const isStepValid = (step: number): boolean => {
    switch (step) {
      case 1: return wizardData.name.trim().length >= 2 && wizardData.taxId.trim().length >= 8;
      case 2: return wizardData.scope !== 'custom' || wizardData.customScopes.length > 0;
      case 3: return !!wizardData.startDate && (wizardData.indefinite || !!wizardData.endDate);
      case 4: return true; // preview, always valid
      case 5: return confirmed;
      default: return true;
    }
  };

  const allReps = reps || [];
  const activeReps = allReps.filter(r => r.status === 'active');
  const inactiveReps = allReps.filter(r => r.status !== 'active');

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // Reset page when reps change
  useEffect(() => {
    setCurrentPage(1);
  }, [reps]);

  const totalItems = activeReps.length;
  const totalPages = Math.ceil(totalItems / pageSize);

  const paginatedActiveReps = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return activeReps.slice(start, start + pageSize);
  }, [activeReps, currentPage, pageSize]);

  const updateWizard = (patch: Partial<WizardData>) => setWizardData(d => ({ ...d, ...patch }));

  const toggleScope = (s: string) => {
    setWizardData(d => ({
      ...d,
      customScopes: d.customScopes.includes(s) ? d.customScopes.filter(x => x !== s) : [...d.customScopes, s],
    }));
  };

  const handleSubmit = async () => {
    if (!id) return;
    try {
      await addMutation.mutateAsync({
        companyId: id,
        repType: wizardData.type,
        name: wizardData.name,
        taxId: wizardData.taxId,
        scope: wizardData.scope,
        scopeDetails: wizardData.scope === 'custom' ? wizardData.customScopes.join(', ') : null,
        startDate: wizardData.startDate,
        endDate: wizardData.indefinite ? null : wizardData.endDate,
        status: 'active',
        registrationNumber: `UJ-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 999999)).padStart(6, '0')}`,
      });
      toast({ title: 'Meghatalmazás létrehozva', description: `${wizardData.name} hozzáadva.` });
      setShowWizard(false);
      setWizardStep(1);
      setConfirmed(false);
      setWizardData({
        type: 'organization', name: '', taxId: '', scope: 'all',
        customScopes: [], startDate: new Date().toISOString().split('T')[0],
        endDate: '', indefinite: true,
      });
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Hiba', description: err.message });
    }
  };

  const handleRevoke = async (rep: NavRepresentation) => {
    try {
      await revokeMutation.mutateAsync({ id: rep.id, companyId: rep.companyId });
      toast({ title: 'Visszavonva', description: `${rep.name} meghatalmazása visszavonva.` });
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Hiba', description: err.message });
    }
  };

  const renderWizardContent = () => {
    switch (wizardStep) {
      case 1:
        return (
          <div className="space-y-4">
            <h3 className="text-lg font-bold">Meghatalmazott típusa</h3>
            <p className="text-sm text-slate-500">Air. 17. § (1) g) pontja alapján 2025.02.01-től a könyvelőiroda szervezetet is be lehet jegyezni állandó meghatalmazottként.</p>
            <div className="grid grid-cols-2 gap-3">
              {[
                { value: 'organization' as const, label: 'Könyvelőiroda (szervezet)', icon: Users, desc: 'A könyvelőiroda mint szervezet kerül bejegyzésre' },
                { value: 'person' as const, label: 'Magánszemély könyvelő', icon: FileText, desc: 'Egyéni könyvelő mint természetes személy' },
              ].map(opt => (
                <button
                  key={opt.value}
                  onClick={() => updateWizard({ type: opt.value })}
                  className={cn(
                    'p-4 rounded-xl border-2 text-left transition-all',
                    wizardData.type === opt.value
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-500/10'
                      : 'border-border hover:border-blue-300'
                  )}
                >
                  <opt.icon className="w-5 h-5 mb-2 text-blue-600" />
                  <p className="text-sm font-bold">{opt.label}</p>
                  <p className="text-xs text-slate-500 mt-1">{opt.desc}</p>
                </button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-4 mt-4">
              <div>
                <label className="text-xs text-slate-500 mb-1 block">Meghatalmazott neve</label>
                <input
                  type="text"
                  value={wizardData.name}
                  onChange={e => updateWizard({ name: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder={wizardData.type === 'organization' ? 'Könyvelőiroda Kft.' : 'Kovács Péter'}
                />
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1 block">{wizardData.type === 'organization' ? 'Adószám' : 'Adóazonosító jel'}</label>
                <input
                  type="text"
                  value={wizardData.taxId}
                  onChange={e => updateWizard({ taxId: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm font-mono focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder={wizardData.type === 'organization' ? '12345678-2-41' : '1234567890'}
                />
              </div>
            </div>
          </div>
        );
      case 2:
        return (
          <div className="space-y-4">
            <h3 className="text-lg font-bold">Hatáskör részletezése</h3>
            <div className="space-y-2">
              {[
                { value: 'all' as const, label: 'Minden adóügyre kiterjedő', desc: 'Teljes körű képviselet az összes adónemben' },
                { value: 'payroll' as const, label: 'Csak bérszámfejtésre', desc: 'SZJA, TB, SZOCHO, 08E, 2608 bevallások' },
                { value: 'custom' as const, label: 'Egyedi (checkbox lista)', desc: 'Kiválasztott adónemek és nyomtatványok' },
              ].map(opt => (
                <button
                  key={opt.value}
                  onClick={() => updateWizard({ scope: opt.value })}
                  className={cn(
                    'w-full p-4 rounded-xl border-2 text-left transition-all',
                    wizardData.scope === opt.value
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-500/10'
                      : 'border-border hover:border-blue-300'
                  )}
                >
                  <p className="text-sm font-bold">{opt.label}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{opt.desc}</p>
                </button>
              ))}
            </div>
            {wizardData.scope === 'custom' && (
              <div className="grid grid-cols-2 gap-2 mt-4 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                {SCOPE_OPTIONS.map(s => (
                  <label key={s} className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={wizardData.customScopes.includes(s)}
                      onChange={() => toggleScope(s)}
                      className="rounded border-border"
                    />
                    {s}
                  </label>
                ))}
              </div>
            )}
          </div>
        );
      case 3:
        return (
          <div className="space-y-4">
            <h3 className="text-lg font-bold">Időtartam</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-slate-500 mb-1 block">Kezdő dátum</label>
                <input
                  type="date"
                  value={wizardData.startDate}
                  onChange={e => updateWizard({ startDate: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1 block">Záró dátum</label>
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={wizardData.indefinite}
                      onChange={e => updateWizard({ indefinite: e.target.checked })}
                      className="rounded"
                    />
                    Visszavonásig érvényes
                  </label>
                  {!wizardData.indefinite && (
                    <input
                      type="date"
                      value={wizardData.endDate}
                      onChange={e => updateWizard({ endDate: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      case 4:
        return (
          <div className="space-y-4">
            <h3 className="text-lg font-bold">UJEGYKE-űrlap előnézet</h3>
            <div className="border border-border rounded-lg p-6 bg-white dark:bg-slate-900 space-y-3 text-sm">
              <div className="text-center border-b pb-3 mb-3">
                <p className="font-bold text-base">UJEGYKE — Állandó meghatalmazás bejelentése</p>
                <p className="text-xs text-slate-500">NAV — Nemzeti Adó- és Vámhivatal</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><span className="text-slate-500">Típus:</span> <strong>{wizardData.type === 'organization' ? 'Szervezet' : 'Magánszemély'}</strong></div>
                <div><span className="text-slate-500">Név:</span> <strong>{wizardData.name || '—'}</strong></div>
                <div><span className="text-slate-500">Azonosító:</span> <strong className="font-mono">{wizardData.taxId || '—'}</strong></div>
                <div><span className="text-slate-500">Hatáskör:</span> <strong>
                  {wizardData.scope === 'all' ? 'Teljes körű' : wizardData.scope === 'payroll' ? 'Bérszámfejtés' : wizardData.customScopes.join(', ')}
                </strong></div>
                <div><span className="text-slate-500">Kezdete:</span> <strong>{wizardData.startDate}</strong></div>
                <div><span className="text-slate-500">Vége:</span> <strong>{wizardData.indefinite ? 'Visszavonásig' : wizardData.endDate}</strong></div>
              </div>
            </div>
            <div className="bg-yellow-50 dark:bg-yellow-500/10 border border-yellow-200 dark:border-yellow-500/20 rounded-lg p-3 text-sm text-yellow-800 dark:text-yellow-300">
              <AlertTriangle className="w-4 h-4 inline mr-1.5" />
              Kérjük, ellenőrizze az adatokat a beküldés előtt. A beküldést követően az UJEGYKE revíziós formmal lehet módosítani.
            </div>
          </div>
        );
      case 5:
        return (
          <div className="space-y-5 py-4">
            <div className="text-center">
              <div className="p-4 bg-amber-50 dark:bg-amber-500/10 rounded-xl inline-block">
                <Shield className="w-12 h-12 text-amber-600" />
              </div>
              <h3 className="text-lg font-bold mt-3">AVDH aláírás és beküldés</h3>
              <p className="text-sm text-slate-500 max-w-md mx-auto mt-1">
                A meghatalmazás aláírásra és beküldésre kész. Az aláíró személynek hitelesítenie kell magát a kiválasztott KAÜ szolgáltatón keresztül.
              </p>
            </div>

            <div className="bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 rounded-lg p-4 text-sm text-amber-800 dark:text-amber-300">
              <AlertTriangle className="w-4 h-4 inline mr-1.5" />
              <strong>Figyelem:</strong> Éles környezetben ez az aláírás a NAV AVDH rendszerén keresztül történik. Jelenleg a meghatalmazás rögzítése az eaisybooks nyilvántartásba történik, nem kerül beküldésre a NAV felé.
            </div>

            <label className="flex items-start gap-3 p-4 rounded-xl border-2 border-border hover:border-indigo-300 transition-all cursor-pointer">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={e => setConfirmed(e.target.checked)}
                className="mt-0.5 rounded"
              />
              <span className="text-sm text-slate-700 dark:text-slate-300">
                Kijelentem, hogy az adatokat ellenőriztem, és hozzájárulok a meghatalmazás rögzítéséhez az eaisybooks rendszerben.
              </span>
            </label>

            <div className="text-center">
              <Button
                onClick={handleSubmit}
                disabled={addMutation.isPending || !confirmed}
                className={cn("gap-1.5 mt-2", confirmed ? "bg-emerald-600 hover:bg-emerald-700" : "bg-slate-400 cursor-not-allowed")}
              >
                {addMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Shield className="w-4 h-4" />}
                {addMutation.isPending ? 'Rögzítés...' : 'Megerősítés és rögzítés'}
              </Button>
            </div>
          </div>
        );
    }
  };

  const renderRepCard = (rep: NavRepresentation) => (
    <div key={rep.id} className="flex items-center gap-4 px-5 py-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
      <div className={cn(
        'w-10 h-10 rounded-xl flex items-center justify-center',
        rep.status === 'active' ? 'bg-emerald-100 dark:bg-emerald-500/20' :
        rep.status === 'revoked' ? 'bg-red-100 dark:bg-red-500/20' :
        'bg-slate-100 dark:bg-slate-700'
      )}>
        {rep.repType === 'organization' ? <Users className="w-5 h-5 text-current" /> : <FileText className="w-5 h-5 text-current" />}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-slate-900 dark:text-slate-100">{rep.name}</p>
        <p className="text-xs text-slate-500 font-mono">{rep.taxId}</p>
      </div>
      <div className="text-right">
        <div className={cn(
          'px-2.5 py-1 rounded-full text-xs font-bold',
          rep.status === 'active' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400' :
          rep.status === 'revoked' ? 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400' :
          'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400'
        )}>
          {rep.status === 'active' ? 'Aktív' : rep.status === 'revoked' ? 'Visszavont' : 'Lejárt'}
        </div>
        <p className="text-[10px] text-slate-400 mt-1">
          {rep.scope === 'all' ? 'Teljes körű' : rep.scope === 'payroll' ? 'Bérszámfejtés' : 'Egyedi'}
        </p>
      </div>
      <div className="text-right text-xs text-slate-500">
        <p>{rep.startDate} —</p>
        <p>{rep.endDate || 'visszavonásig'}</p>
      </div>
      <div className="flex items-center gap-1">
        {rep.status === 'active' && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleRevoke(rep)}
            disabled={revokeMutation.isPending}
            className="text-red-500 hover:text-red-600 hover:bg-red-50"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        )}
      </div>
    </div>
  );

  if (repsError) {
    return <AccountyErrorState message="Nem sikerült betölteni a meghatalmazásokat." onRetry={() => refetchReps()} />;
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64 gap-2 text-muted-foreground">
        <Loader2 className="w-5 h-5 animate-spin" />
        Betöltés...
      </div>
    );
  }

  return (
    <div className="w-full max-w-5xl mx-auto space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-4">
          <button 
            onClick={() => {
              if (window.history.state && window.history.state.idx > 0) {
                navigate(-1);
              } else {
                navigate(`/accounty/${companyId}/${dateRange}/overview`);
              }
            }}
            className="flex items-center justify-center w-8 h-8 mt-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shadow-sm shrink-0"
            title="Vissza"
          >
            <ChevronLeft className="w-5 h-5 text-slate-600 dark:text-slate-400" />
          </button>
          <div>
            <div className="flex items-center gap-1.5 mb-1">
              {clientLoading ? (
                <div className="h-3.5 w-32 bg-slate-200 dark:bg-slate-800 rounded animate-pulse" />
              ) : (
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">{client?.name || 'Ügyfél'}</span>
              )}
            </div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">NAV-meghatalmazás kezelés</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">UJEGYKE — Állandó meghatalmazások nyilvántartása</p>
          </div>
        </div>
        <Button onClick={() => { setShowWizard(true); setWizardStep(1); }} className="gap-1.5 bg-indigo-600 hover:bg-indigo-700">
          <Plus className="w-4 h-4" /> Új meghatalmazás
        </Button>
      </div>

      {/* Info banner */}
      <div className="bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 rounded-xl p-4 text-sm text-blue-800 dark:text-blue-300">
        <strong>Air. 17. § (1) g):</strong> 2025.02.01-től a könyvelőiroda szervezetet is be lehet jegyezni állandó meghatalmazottként a NAV-nál.
      </div>

      {/* Active */}
      <div className="bg-card rounded-xl border border-border shadow-soft overflow-hidden">
        <div className="px-5 py-3 border-b border-border dark:bg-slate-900/30 flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-700 dark:text-slate-300">Aktív meghatalmazások</h2>
          <span className="text-xs bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400 px-2 py-0.5 rounded-full font-bold">
            {activeReps.length}
          </span>
        </div>
        <div className="divide-y divide-border/50">
          {activeReps.length === 0 ? (
            <div className="py-12 text-center text-sm text-slate-400">Nincs aktív meghatalmazás</div>
          ) : (
            paginatedActiveReps.map(renderRepCard)
          )}
        </div>
        {totalPages > 1 && (
          <div className="border-t border-border px-5 py-3 bg-card">
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
      </div>

      {/* Inactive */}
      {inactiveReps.length > 0 && (
        <div className="bg-card rounded-xl border border-border shadow-soft overflow-hidden">
          <div className="px-5 py-3 border-b border-border dark:bg-slate-900/30">
            <h2 className="text-sm font-bold text-slate-400">Lejárt / Visszavont</h2>
          </div>
          <div className="divide-y divide-border/50 opacity-60">
            {inactiveReps.map(renderRepCard)}
          </div>
        </div>
      )}

      {/* Wizard Modal */}
      {showWizard && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setShowWizard(false)}>
          <div className="bg-card rounded-2xl border border-border shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-auto" onClick={e => e.stopPropagation()}>
            {/* Stepper */}
            <div className="px-6 pt-6 pb-4 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-2">
                {WIZARD_STEPS.map((step, i) => (
                  <React.Fragment key={step.num}>
                    <div className={cn(
                      'w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all',
                      wizardStep > step.num ? 'bg-emerald-500 text-white' :
                      wizardStep === step.num ? 'bg-indigo-600 text-white ring-2 ring-indigo-300' :
                      'bg-slate-200 dark:bg-slate-700 text-slate-500'
                    )}>
                      {wizardStep > step.num ? <CheckCircle className="w-4 h-4" /> : step.num}
                    </div>
                    {i < WIZARD_STEPS.length - 1 && (
                      <div className={cn('w-8 h-0.5', wizardStep > step.num ? 'bg-emerald-500' : 'bg-slate-200 dark:bg-slate-700')} />
                    )}
                  </React.Fragment>
                ))}
              </div>
              <button onClick={() => setShowWizard(false)} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg">
                <X className="w-4 h-4" />
              </button>
            </div>
            {/* Content */}
            <div className="p-6">
              {renderWizardContent()}
            </div>
            {/* Footer */}
            {wizardStep < 5 && (
              <div className="px-6 pb-6 flex justify-between">
                <Button variant="outline" onClick={() => setWizardStep(s => Math.max(1, s - 1))} disabled={wizardStep === 1}>
                  Vissza
                </Button>
                <Button onClick={() => setWizardStep(s => s + 1)} disabled={!isStepValid(wizardStep)} className="gap-1.5">
                  Tovább <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
