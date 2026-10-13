import React, { useState, useMemo } from 'react';
import {
  FolderKanban,
  Plus,
  Coins,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  Building2,
  TrendingDown,
  Layers,
  ArrowRight,
  ExternalLink,
  Edit2,
  Trash2,
  Loader2,
  RefreshCw,
  Scale,
  Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { formatCurrency, formatDateLocale } from '@/lib/locale/formatters';
import { useGrantProjects } from '@/hooks/useGrantProjects';
import { useCompanyAssetComponents } from '@/hooks/useAssetComponents';
import {
  calculateGrantReconciliation,
  fetchGrantGlBalances,
} from '@/lib/fixed-assets/grantReconciliationService';
import {
  postGrantDeferralReleaseToLedger,
  calculateGrantDeferralReleaseAmount,
  resolveGrantDeferralAccounts,
  fetchAvailableGrantAccounts,
  type AvailableGrantAccounts,
} from '@/lib/fixed-assets/grantDeferralPostingService';
import type {
  FixedAsset,
  GrantProject,
  GrantProjectStatus,
} from '@/types/fixed-assets';
import {
  GRANT_PROJECT_STATUS_LABELS,
  GRANT_PROJECT_STATUS_COLORS,
} from '@/types/fixed-assets';
import { toast } from '@/hooks/use-toast';

interface GrantProjectsTabProps {
  companyId: string;
  currency?: string;
  assets: FixedAsset[];
  writable?: boolean;
  onOpenAsset?: (assetId: string) => void;
}

export const GrantProjectsTab: React.FC<GrantProjectsTabProps> = ({
  companyId,
  currency = 'HUF',
  assets,
  writable = true,
  onOpenAsset,
}) => {
  const {
    projects,
    isLoading,
    error,
    refetch: refetchProjects,
    createProject,
    updateProject,
    deleteProject,
    isCreating,
    isUpdating,
    isDeleting,
  } = useGrantProjects(companyId);

  const { data: allComponents = [], refetch: refetchComponents } = useCompanyAssetComponents(companyId);

  // Reference date for purity compliance
  const [todayStr] = useState(() => new Date().toISOString().slice(0, 10));

  // GL Balances state for 4-way reconciliation
  const [gl483Balance, setGl483Balance] = useState<number>(0);
  const [gl964Turnover, setGl964Turnover] = useState<number>(0);
  const [glLoading, setGlLoading] = useState(true);

  // Load GL balances on mount
  React.useEffect(() => {
    let mounted = true;
    fetchGrantGlBalances(companyId)
      .then(res => {
        if (mounted) {
          setGl483Balance(res.gl483Balance);
          setGl964Turnover(res.gl964Turnover);
        }
      })
      .finally(() => {
        if (mounted) setGlLoading(false);
      });
    return () => { mounted = false; };
  }, [companyId]);

  const handleRefreshGl = async () => {
    setGlLoading(true);
    try {
      const res = await fetchGrantGlBalances(companyId);
      setGl483Balance(res.gl483Balance);
      setGl964Turnover(res.gl964Turnover);
      await refetchProjects();
      await refetchComponents();
      toast({ title: 'Főkönyvi egyenlegek és rekonciliáció frissítve' });
    } finally {
      setGlLoading(false);
    }
  };

  // Négyoldalú rekonciliáció számítása
  const reconciliation = useMemo(() => {
    return calculateGrantReconciliation(projects, assets, allComponents, gl483Balance, gl964Turnover);
  }, [projects, assets, allComponents, gl483Balance, gl964Turnover]);

  // Project Dialog State
  const [projectDialogOpen, setProjectDialogOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<GrantProject | null>(null);

  // Form State
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [grantor, setGrantor] = useState('');
  const [contractNumber, setContractNumber] = useState('');
  const [eligibleCost, setEligibleCost] = useState<number>(0);
  const [grantAmount, setGrantAmount] = useState<number>(0);
  const [intensityRate, setIntensityRate] = useState<number>(70);
  const [advanceAmount, setAdvanceAmount] = useState<number>(0);
  const [disbursedAmount, setDisbursedAmount] = useState<number>(0);
  const [maintenanceYears, setMaintenanceYears] = useState<number>(3);
  const [maintenanceEndDate, setMaintenanceEndDate] = useState<string>('');
  const [status, setStatus] = useState<GrantProjectStatus>('active');
  const [notes, setNotes] = useState('');

  // Delete modal state
  const [deletingProjectId, setDeletingProjectId] = useState<string | null>(null);

  // PIE Post Dialog State
  const inFlightRef = React.useRef(false);
  const [pieDialogOpen, setPieDialogOpen] = useState(false);
  const [selectedProjectForPie, setSelectedProjectForPie] = useState<GrantProject | null>(null);
  const [piePeriodDate, setPiePeriodDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [pieDepreciationAmount, setPieDepreciationAmount] = useState<number>(100000);
  const [isPostingPie, setIsPostingPie] = useState(false);
  const [availableAccounts, setAvailableAccounts] = useState<AvailableGrantAccounts>({
    accounts483: [],
    accounts964: [],
    default483Id: null,
    default964Id: null,
  });
  const [selectedGl483Id, setSelectedGl483Id] = useState<string>('');
  const [selectedGl964Id, setSelectedGl964Id] = useState<string>('');

  const handleOpenAddProject = () => {
    setEditingProject(null);
    setName('');
    setCode('');
    setGrantor('Nemzetgazdasági Minisztérium');
    setContractNumber('');
    setEligibleCost(10000000);
    setGrantAmount(7000000);
    setIntensityRate(70);
    setAdvanceAmount(0);
    setDisbursedAmount(7000000);
    setMaintenanceYears(3);

    const today = new Date();
    today.setFullYear(today.getFullYear() + 3);
    setMaintenanceEndDate(today.toISOString().slice(0, 10));

    setStatus('active');
    setNotes('');
    setProjectDialogOpen(true);
  };

  const handleOpenEditProject = (p: GrantProject) => {
    setEditingProject(p);
    setName(p.name);
    setCode(p.code);
    setGrantor(p.grantor || '');
    setContractNumber(p.contract_number || '');
    setEligibleCost(Number(p.eligible_cost) || 0);
    setGrantAmount(Number(p.grant_amount) || 0);
    setIntensityRate(Number(p.intensity_rate) || 0);
    setAdvanceAmount(Number(p.advance_amount) || 0);
    setDisbursedAmount(Number(p.disbursed_amount) || 0);
    setMaintenanceYears(p.maintenance_period_years || 3);
    setMaintenanceEndDate(p.maintenance_end_date || '');
    setStatus(p.status);
    setNotes(p.notes || '');
    setProjectDialogOpen(true);
  };

  const handleSaveProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !code.trim() || grantAmount <= 0) return;

    const own = Math.max(0, eligibleCost - grantAmount);

    if (editingProject) {
      await updateProject({
        id: editingProject.id,
        updates: {
          name: name.trim(),
          code: code.trim(),
          grantor: grantor.trim() || null,
          contract_number: contractNumber.trim() || null,
          eligible_cost: eligibleCost,
          grant_amount: grantAmount,
          intensity_rate: intensityRate,
          own_contribution: own,
          advance_amount: advanceAmount,
          disbursed_amount: disbursedAmount,
          maintenance_period_years: maintenanceYears,
          maintenance_end_date: maintenanceEndDate || null,
          status,
          notes: notes.trim() || null,
        },
      });
    } else {
      await createProject({
        company_id: companyId,
        name: name.trim(),
        code: code.trim(),
        grantor: grantor.trim() || undefined,
        contract_number: contractNumber.trim() || undefined,
        eligible_cost: eligibleCost,
        grant_amount: grantAmount,
        intensity_rate: intensityRate,
        own_contribution: own,
        advance_amount: advanceAmount,
        disbursed_amount: disbursedAmount,
        maintenance_period_years: maintenanceYears,
        maintenance_end_date: maintenanceEndDate || undefined,
        status,
        notes: notes.trim() || undefined,
      });
    }

    setProjectDialogOpen(false);
  };

  const handleConfirmDelete = async () => {
    if (!deletingProjectId) return;
    await deleteProject(deletingProjectId);
    setDeletingProjectId(null);
  };

  const handleOpenPieRelease = (proj: GrantProject) => {
    setSelectedProjectForPie(proj);
    setPiePeriodDate(new Date().toISOString().slice(0, 10));

    fetchAvailableGrantAccounts(companyId).then(accs => {
      setAvailableAccounts(accs);
      setSelectedGl483Id(accs.default483Id || '');
      setSelectedGl964Id(accs.default964Id || '');
    });

    // Calculate approximate monthly grant depreciation of connected assets
    const projAssets = assets.filter(a => a.grant_project_id === proj.id);
    const totalMonthly = projAssets.reduce((sum, a) => {
      const gross = Number(a.acquisition_value) || 0;
      const life = a.useful_life_months > 0 ? a.useful_life_months : 60;
      return sum + Math.round(gross / life);
    }, 0);

    setPieDepreciationAmount(totalMonthly > 0 ? totalMonthly : 100000);
    setPieDialogOpen(true);
  };

  const handleExecutePieRelease = async () => {
    if (inFlightRef.current || isPostingPie || !selectedProjectForPie) return;
    inFlightRef.current = true;
    setIsPostingPie(true);

    try {
      // Megkeressük a projekthez tartozó első aktív eszközt
      const targetAsset = assets.find(a => a.grant_project_id === selectedProjectForPie.id) || assets[0];

      if (!targetAsset) {
        toast({ title: 'Nincs kapcsolódó tárgyi eszköz a könyveléshez.', variant: 'destructive' });
        return;
      }

      const releaseAmt = calculateGrantDeferralReleaseAmount(
        pieDepreciationAmount,
        selectedProjectForPie.intensity_rate
      );

      const result = await postGrantDeferralReleaseToLedger({
        companyId,
        assetId: targetAsset.id,
        grantProjectId: selectedProjectForPie.id,
        periodDate: piePeriodDate,
        depreciationAmount: pieDepreciationAmount,
        grantRatioPercent: selectedProjectForPie.intensity_rate,
        customReleaseAmount: releaseAmt,
        gl483Id: selectedGl483Id || undefined,
        gl964Id: selectedGl964Id || undefined,
        notes: `${selectedProjectForPie.code} támogatási elhatárolás időszaki feloldása`,
      });

      if (result.success) {
        toast({ title: result.message || 'Passzív időbeli elhatárolás feloldása sikeresen lekönyvelve!' });
        setPieDialogOpen(false);
        handleRefreshGl();
      } else {
        toast({ title: 'Hiba a könyveléskor', description: result.message, variant: 'destructive' });
      }
    } finally {
      inFlightRef.current = false;
      setIsPostingPie(false);
    }
  };

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-24 w-full rounded-xl" />
        <div className="grid grid-cols-4 gap-4">
          <Skeleton className="h-28 w-full rounded-xl" />
          <Skeleton className="h-28 w-full rounded-xl" />
          <Skeleton className="h-28 w-full rounded-xl" />
          <Skeleton className="h-28 w-full rounded-xl" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 text-center space-y-4">
        <AlertTriangle className="h-8 w-8 text-destructive mx-auto" />
        <h3 className="font-semibold text-lg">Hiba a pályázati projektek betöltésekor</h3>
        <Button variant="outline" onClick={() => refetchProjects()}>
          Újrapróbálás
        </Button>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* 4-oldalú Rekonciliációs Státusz Banner */}
      <div className={`p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs ${
        reconciliation.isBalanced
          ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-900 dark:text-emerald-300'
          : 'bg-amber-500/10 border-amber-500/20 text-amber-900 dark:text-amber-300'
      }`}>
        <div className="flex items-start gap-3">
          {reconciliation.isBalanced ? (
            <div className="w-9 h-9 rounded-lg bg-emerald-500/20 flex items-center justify-center flex-shrink-0 text-emerald-600 dark:text-emerald-400">
              <ShieldCheck className="h-5 w-5" />
            </div>
          ) : (
            <div className="w-9 h-9 rounded-lg bg-amber-500/20 flex items-center justify-center flex-shrink-0 text-amber-600 dark:text-amber-400">
              <AlertTriangle className="h-5 w-5" />
            </div>
          )}
          <div>
            <div className="flex items-center gap-2">
              <h4 className="font-semibold text-sm">
                {reconciliation.isBalanced
                  ? 'Négyoldalú Rekonciliáció: Egyensúlyban (Zero-Error)'
                  : 'Négyoldalú Rekonciliáció: Eltérés vagy Ellenőrzendő Elem'}
              </h4>
              <Badge variant="outline" className="text-[11px] bg-background/50">
                Pályázat ↔ TÉNY ↔ Főkönyv (483/964) ↔ Elhatárolás
              </Badge>
            </div>
            <p className="text-xs opacity-90 mt-0.5">
              {reconciliation.isBalanced
                ? 'A megítélt pályázati keretek, az aktivált eszköz-analitika és a főkönyvi passzív elhatárolások maradéktalanul szinkronban vannak.'
                : `${reconciliation.alerts.length} db figyelmeztetés talált. Kérjük, vizsgáld meg a részleteket!`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefreshGl}
            disabled={glLoading}
            className="gap-1.5 bg-background/70 hover:bg-background text-xs h-8"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${glLoading ? 'animate-spin' : ''}`} />
            Egyeztetés frissítése
          </Button>
          {writable && (
            <Button
              id="create-grant-project-btn"
              size="sm"
              onClick={handleOpenAddProject}
              className="gap-1.5 shadow-sm text-xs h-8"
            >
              <Plus className="h-3.5 w-3.5" />
              Új pályázati projekt
            </Button>
          )}
        </div>
      </div>

      {/* Riasztások listája, ha vannak */}
      {reconciliation.alerts.length > 0 && (
        <div className="space-y-2">
          {reconciliation.alerts.map(alert => (
            <div
              key={alert.id}
              className={`p-3 rounded-lg border text-xs flex items-center justify-between gap-3 ${
                alert.severity === 'error'
                  ? 'bg-destructive/10 border-destructive/20 text-destructive'
                  : 'bg-amber-500/10 border-amber-500/20 text-amber-800 dark:text-amber-300'
              }`}
            >
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                <div>
                  <span className="font-semibold mr-1">{alert.title}:</span>
                  <span>{alert.description}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 4 Fő KPI Kártya */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 bg-card rounded-xl border shadow-xs">
          <span className="text-xs text-muted-foreground font-medium block">Összes Pályázati Keret</span>
          <p className="text-2xl font-bold mt-1 tracking-tight text-foreground">
            {formatCurrency(reconciliation.pillars.grantContract.totalGrantAmount, currency)}
          </p>
          <div className="flex items-center justify-between text-xs text-muted-foreground mt-2 pt-2 border-t">
            <span>Elszámolható: {formatCurrency(reconciliation.pillars.grantContract.totalEligibleCost, currency)}</span>
            <span>{projects.length} projekt</span>
          </div>
        </div>

        <div className="p-4 bg-card rounded-xl border border-primary/20 shadow-xs">
          <span className="text-xs text-primary font-medium flex items-center gap-1.5">
            <Coins className="h-4 w-4" />
            Folyósított Támogatás
          </span>
          <p className="text-2xl font-bold mt-1 tracking-tight text-primary">
            {formatCurrency(reconciliation.pillars.grantContract.totalDisbursedAmount, currency)}
          </p>
          <div className="flex items-center justify-between text-xs text-muted-foreground mt-2 pt-2 border-t">
            <span>Előleg: {formatCurrency(reconciliation.pillars.grantContract.totalAdvanceAmount, currency)}</span>
            <span>
              {reconciliation.pillars.grantContract.totalGrantAmount > 0
                ? `${Math.round((reconciliation.pillars.grantContract.totalDisbursedAmount / reconciliation.pillars.grantContract.totalGrantAmount) * 100)}%`
                : '0%'}
            </span>
          </div>
        </div>

        <div className="p-4 bg-card rounded-xl border border-emerald-500/20 shadow-xs">
          <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1.5">
            <Layers className="h-4 w-4" />
            Eszközökhöz Allokált Támogatás
          </span>
          <p className="text-2xl font-bold mt-1 tracking-tight text-foreground">
            {formatCurrency(reconciliation.pillars.assetAnalytics.totalAllocatedGrantAmount, currency)}
          </p>
          <div className="flex items-center justify-between text-xs text-muted-foreground mt-2 pt-2 border-t">
            <span>{reconciliation.pillars.assetAnalytics.connectedAssetCount} eszköz ({reconciliation.pillars.assetAnalytics.connectedComponentCount} komponens)</span>
            <span className="font-semibold text-emerald-600 dark:text-emerald-400">
              {reconciliation.pillars.assetAnalytics.effectiveGrantRatioPercent}% arány
            </span>
          </div>
        </div>

        <div className="p-4 bg-card rounded-xl border border-amber-500/20 bg-amber-500/5 shadow-xs">
          <span className="text-xs text-amber-700 dark:text-amber-400 font-medium flex items-center gap-1.5">
            <TrendingDown className="h-4 w-4" />
            Főkönyvi PIE Egyenleg (483)
          </span>
          <p className="text-2xl font-bold mt-1 tracking-tight text-amber-700 dark:text-amber-400">
            {formatCurrency(gl483Balance, currency)}
          </p>
          <div className="flex items-center justify-between text-xs text-muted-foreground mt-2 pt-2 border-t">
            <span>Feloldott bevétel (964):</span>
            <span className="font-semibold text-foreground">{formatCurrency(gl964Turnover, currency)}</span>
          </div>
        </div>
      </div>

      {/* Projektek Listája */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-bold text-lg">Pályázati & Támogatási Projektek</h3>
            <p className="text-xs text-muted-foreground">
              Digitális projektlapok a szerződéses adatokkal, fenntartási monitoringgal és automatikus elhatárolással.
            </p>
          </div>
        </div>

        {projects.length === 0 ? (
          <div className="p-12 text-center rounded-2xl border border-dashed bg-card/50 space-y-3">
            <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto">
              <FolderKanban className="h-6 w-6" />
            </div>
            <div>
              <h4 className="font-semibold text-base">Nincs még rögzített pályázati projekt</h4>
              <p className="text-sm text-muted-foreground max-w-md mx-auto mt-1">
                Ha a cég nyert vissza nem térítendő európai uniós (pl. GINOP, RRF) vagy hazai beruházási támogatást,
                hozz létre egy digitális támogatási projektlapot a precíz elszámoláshoz.
              </p>
            </div>
            {writable && (
              <Button onClick={handleOpenAddProject} size="sm" className="gap-1.5 mt-2">
                <Plus className="h-4 w-4" />
                Első pályázat rögzítése
              </Button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {projects.map(project => {
              const projectAssets = assets.filter(a => a.grant_project_id === project.id);
              const projectComponents = allComponents.filter(c => c.grant_project_id === project.id);
              const allocatedGrant = projectComponents.reduce((s, c) => s + (Number(c.grant_funding_amount) || 0), 0) +
                projectAssets.filter(a => !projectComponents.some(c => c.fixed_asset_id === a.id)).reduce((s, a) => {
                  return s + Math.round((Number(a.acquisition_value) * project.intensity_rate) / 100);
                }, 0);

              const isMaintenanceActive = project.maintenance_end_date && project.maintenance_end_date > todayStr;

              return (
                <div key={project.id} className="p-5 bg-card rounded-xl border shadow-xs hover:border-primary/30 transition-all flex flex-col justify-between space-y-4">
                  <div>
                    {/* Felső sáv: Cím és Státusz */}
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-base text-foreground">{project.code}</span>
                          <Badge variant="outline" className={`text-xs ${GRANT_PROJECT_STATUS_COLORS[project.status]}`}>
                            {GRANT_PROJECT_STATUS_LABELS[project.status] || project.status}
                          </Badge>
                        </div>
                        <h4 className="font-medium text-sm text-muted-foreground mt-0.5 line-clamp-1">{project.name}</h4>
                      </div>

                      <div className="flex items-center gap-1">
                        {writable && (
                          <>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-foreground"
                              onClick={() => handleOpenEditProject(project)}
                            >
                              <Edit2 className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-destructive"
                              onClick={() => setDeletingProjectId(project.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Részletek és adatok */}
                    <div className="grid grid-cols-2 gap-3 mt-4 text-xs">
                      <div>
                        <span className="text-muted-foreground block">Támogató / Szerződésszám:</span>
                        <span className="font-medium truncate block">
                          {project.grantor || '—'} {project.contract_number ? `(${project.contract_number})` : ''}
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground block">Támogatási intenzitás:</span>
                        <span className="font-semibold text-primary">{project.intensity_rate}%</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground block">Megítélt támogatás:</span>
                        <span className="font-semibold tabular-nums">
                          {formatCurrency(project.grant_amount, currency)}
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground block">Allokált támogatás:</span>
                        <span className="font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums">
                          {formatCurrency(allocatedGrant, currency)}
                        </span>
                      </div>
                    </div>

                    {/* Fenntartási időszak sáv */}
                    <div className="mt-4 p-2.5 rounded-lg bg-muted/40 border text-xs flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <span className="text-muted-foreground">Fenntartási időszak: </span>
                          <span className="font-medium">
                            {project.maintenance_period_years} év ({project.maintenance_end_date ? formatDateLocale(project.maintenance_end_date) : 'Nincs megadva'})
                          </span>
                        </div>
                      </div>
                      {isMaintenanceActive ? (
                        <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 text-[10px]">
                          Aktív védelem
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-muted-foreground text-[10px]">
                          Lejárt / Zárt
                        </Badge>
                      )}
                    </div>

                    {/* Kapcsolódó eszközök lista */}
                    <div className="mt-3">
                      <span className="text-xs font-medium text-muted-foreground block mb-1">
                        Kapcsolt tárgyi eszközök ({projectAssets.length} db):
                      </span>
                      {projectAssets.length === 0 ? (
                        <span className="text-xs text-muted-foreground italic">Még nincs közvetlen eszköz rendelve ehhez a projekthez.</span>
                      ) : (
                        <div className="flex flex-wrap gap-1.5">
                          {projectAssets.map(asset => (
                            <button
                              key={asset.id}
                              onClick={() => onOpenAsset && onOpenAsset(asset.id)}
                              className="text-[11px] px-2 py-0.5 rounded-md bg-muted hover:bg-muted/80 text-foreground flex items-center gap-1 border border-border/50"
                            >
                              <span>{asset.inventory_number}</span>
                              <span className="text-muted-foreground truncate max-w-[120px]">({asset.name})</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Alsó műveleti gombok */}
                  <div className="pt-3 border-t flex items-center justify-between gap-2">
                    <span className="text-xs text-muted-foreground">
                      Elszámolható: {formatCurrency(project.eligible_cost, currency)}
                    </span>
                    {writable && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1.5 text-xs text-amber-700 dark:text-amber-400 border-amber-500/30 hover:bg-amber-500/10 h-8"
                        onClick={() => handleOpenPieRelease(project)}
                      >
                        <TrendingDown className="h-3.5 w-3.5" />
                        PIE feloldás könyvelése
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Pályázati Projekt Létrehozó / Szerkesztő Dialógus */}
      <Dialog open={projectDialogOpen} onOpenChange={setProjectDialogOpen}>
        <DialogContent className="max-w-xl">
          <form onSubmit={handleSaveProject}>
            <DialogHeader>
              <DialogTitle>
                {editingProject ? 'Pályázati Projekt Módosítása' : 'Új Támogatási Projekt Rögzítése'}
              </DialogTitle>
              <DialogDescription>
                A vissza nem térítendő beruházási támogatás szerződéses keretadatainak és fenntartási kötelezettségének rögzítése.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4 text-sm">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="proj-code">Pályázati Azonosító Kód *</Label>
                  <Input
                    id="proj-code"
                    value={code}
                    onChange={e => setCode(e.target.value)}
                    placeholder="pl. GINOP-Plusz-1.2.1-2026"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="proj-status">Projekt Státusza</Label>
                  <Select
                    value={status}
                    onValueChange={(val: GrantProjectStatus) => setStatus(val)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Aktív projekt</SelectItem>
                      <SelectItem value="completed">Megvalósult</SelectItem>
                      <SelectItem value="audit_in_progress">Audit alatt</SelectItem>
                      <SelectItem value="closed">Lezárt</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="proj-name">Projekt Megnevezése *</Label>
                <Input
                  id="proj-name"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="pl. Modern technológiai beruházás CNC kapacitásbővítésre"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="proj-grantor">Támogató Szervezet</Label>
                  <Input
                    id="proj-grantor"
                    value={grantor}
                    onChange={e => setGrantor(e.target.value)}
                    placeholder="pl. Nemzetgazdasági Minisztérium"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="proj-contract">Támogatási Szerződésszám</Label>
                  <Input
                    id="proj-contract"
                    value={contractNumber}
                    onChange={e => setContractNumber(e.target.value)}
                    placeholder="pl. GINOP-2026-001/SZERZ"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3 bg-muted/30 p-3 rounded-lg border">
                <div className="space-y-1.5">
                  <Label htmlFor="proj-eligible">Elszámolható (Ft)</Label>
                  <Input
                    id="proj-eligible"
                    type="number"
                    min={0}
                    value={eligibleCost || ''}
                    onChange={e => setEligibleCost(parseFloat(e.target.value) || 0)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="proj-grant-amt">Támogatás (Ft) *</Label>
                  <Input
                    id="proj-grant-amt"
                    type="number"
                    min={0}
                    value={grantAmount || ''}
                    onChange={e => setGrantAmount(parseFloat(e.target.value) || 0)}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="proj-intensity">Intenzitás (%) *</Label>
                  <Input
                    id="proj-intensity"
                    type="number"
                    min={0}
                    max={100}
                    value={intensityRate || ''}
                    onChange={e => setIntensityRate(parseFloat(e.target.value) || 0)}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="proj-disbursed">Eddig Folyósított Összeg (Ft)</Label>
                  <Input
                    id="proj-disbursed"
                    type="number"
                    min={0}
                    value={disbursedAmount || ''}
                    onChange={e => setDisbursedAmount(parseFloat(e.target.value) || 0)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="proj-advance">Kapott Előleg (Ft)</Label>
                  <Input
                    id="proj-advance"
                    type="number"
                    min={0}
                    value={advanceAmount || ''}
                    onChange={e => setAdvanceAmount(parseFloat(e.target.value) || 0)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="proj-maint-years">Kötelező Fenntartás (év)</Label>
                  <Input
                    id="proj-maint-years"
                    type="number"
                    min={1}
                    max={10}
                    value={maintenanceYears || ''}
                    onChange={e => setMaintenanceYears(parseInt(e.target.value, 10) || 3)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="proj-maint-end">Fenntartás Végső Határideje</Label>
                  <Input
                    id="proj-maint-end"
                    type="date"
                    value={maintenanceEndDate}
                    onChange={e => setMaintenanceEndDate(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="proj-notes">Megjegyzések, Pályázati Kikötések</Label>
                <Input
                  id="proj-notes"
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="pl. Eszköz zálogjoggal terhelt, eladási tilalom alatt áll"
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setProjectDialogOpen(false)}
                disabled={isCreating || isUpdating}
              >
                Mégse
              </Button>
              <Button
                id="save-grant-project-btn"
                type="submit"
                disabled={isCreating || isUpdating || !name.trim() || !code.trim() || grantAmount <= 0}
                className="gap-2"
              >
                {(isCreating || isUpdating) ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {editingProject ? 'Módosítás mentése' : 'Projekt rögzítése'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* PIE Feloldás Könyvelése Dialógus */}
      <Dialog open={pieDialogOpen} onOpenChange={setPieDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Passzív Időbeli Elhatárolás Feloldása</DialogTitle>
            <DialogDescription>
              {selectedProjectForPie?.code} — {selectedProjectForPie?.name}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-3 text-sm">
            <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-900 dark:text-amber-300 text-xs">
              <span className="font-semibold block mb-0.5">Sztv. szerinti könyvelési tétel:</span>
              <div className="font-mono mt-1">
                T 483 (Passzív időbeli elhatárolás) → K 964 (Egyéb támogatási bevétel)
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="pie-period-date">Könyvelési Fordulónap</Label>
              <Input
                id="pie-period-date"
                type="date"
                value={piePeriodDate}
                onChange={e => setPiePeriodDate(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="pie-dep-amount">Tárgyidőszaki Elszámolt ÉCS (Ft)</Label>
              <Input
                id="pie-dep-amount"
                type="number"
                min={1}
                value={pieDepreciationAmount || ''}
                onChange={e => setPieDepreciationAmount(parseFloat(e.target.value) || 0)}
              />
            </div>

            <div className="p-3 bg-muted rounded-lg flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Támogatási intenzitás:</span>
              <span className="font-bold">{selectedProjectForPie?.intensity_rate}%</span>
            </div>

            <div className="p-3 bg-primary/10 border border-primary/20 rounded-lg flex items-center justify-between text-xs">
              <span className="text-primary font-medium">Feloldandó egyéb bevétel:</span>
              <span className="font-bold text-base text-primary tabular-nums">
                {formatCurrency(
                  calculateGrantDeferralReleaseAmount(
                    pieDepreciationAmount,
                    selectedProjectForPie?.intensity_rate || 0
                  ),
                  currency
                )}
              </span>
            </div>
            {/* Számlatükör számlaválasztás */}
            <div className="space-y-3 pt-1 border-t">
              <div className="space-y-1">
                <Label htmlFor="gl-483-select" className="text-xs font-medium">
                  Tartozik: 483 Passzív Időbeli Elhatárolás Számla
                </Label>
                {availableAccounts.accounts483.length > 0 ? (
                  <Select value={selectedGl483Id} onValueChange={setSelectedGl483Id}>
                    <SelectTrigger id="gl-483-select" className="text-xs h-8">
                      <SelectValue placeholder="Válassz 483-as számlát..." />
                    </SelectTrigger>
                    <SelectContent>
                      {availableAccounts.accounts483.map(acc => (
                        <SelectItem key={acc.id} value={acc.id} className="text-xs">
                          {acc.gl_number} — {acc.short_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <div className="text-[11px] text-destructive bg-destructive/10 p-2 rounded border border-destructive/20">
                    Nem található 483-as számla a cégnél! Kérjük, vedd fel a Számlatükörbe a Beállításokban.
                  </div>
                )}
              </div>

              <div className="space-y-1">
                <Label htmlFor="gl-964-select" className="text-xs font-medium">
                  Követel: 964 Egyéb Támogatási Bevétel Számla
                </Label>
                {availableAccounts.accounts964.length > 0 ? (
                  <Select value={selectedGl964Id} onValueChange={setSelectedGl964Id}>
                    <SelectTrigger id="gl-964-select" className="text-xs h-8">
                      <SelectValue placeholder="Válassz 964-es számlát..." />
                    </SelectTrigger>
                    <SelectContent>
                      {availableAccounts.accounts964.map(acc => (
                        <SelectItem key={acc.id} value={acc.id} className="text-xs">
                          {acc.gl_number} — {acc.short_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <div className="text-[11px] text-destructive bg-destructive/10 p-2 rounded border border-destructive/20">
                    Nem található 964-es számla a cégnél! Kérjük, vedd fel a Számlatükörbe a Beállításokban.
                  </div>
                )}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setPieDialogOpen(false)}
              disabled={isPostingPie}
            >
              Mégse
            </Button>
            <Button
              id="confirm-pie-release-btn"
              onClick={handleExecutePieRelease}
              disabled={isPostingPie || pieDepreciationAmount <= 0 || !selectedGl483Id || !selectedGl964Id}
              className="gap-2 bg-amber-600 hover:bg-amber-700 text-white"
            >
              {isPostingPie ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Feloldás könyvelése
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Törlés Megerősítő Dialógus */}
      <AlertDialog open={!!deletingProjectId} onOpenChange={open => !open && setDeletingProjectId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Biztosan törölni szeretnéd ezt a pályázati projektet?</AlertDialogTitle>
            {(() => {
              const linkedAssetsCount = assets.filter(a => a.grant_project_id === deletingProjectId).length;
              const linkedCompsCount = allComponents.filter(c => c.grant_project_id === deletingProjectId).length;
              const hasUsage = linkedAssetsCount > 0 || linkedCompsCount > 0;

              if (hasUsage) {
                return (
                  <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-xs text-destructive space-y-1 text-left mt-2">
                    <span className="font-semibold block">A projekt az adatbázis-védelmi szabályok miatt nem törölhető!</span>
                    <span>
                      Ehhez a pályázathoz jelenleg {linkedAssetsCount} db tárgyi eszköz és {linkedCompsCount} db alkatrész-komponens kapcsolódik.
                      Kérjük, először szüntesd meg a projekt-hozzárendelést az érintett eszközök adatlapján.
                    </span>
                  </div>
                );
              }

              return (
                <AlertDialogDescription>
                  A pályázati projekt törlésével véglegesen megszűnik a projekt nyilvántartása. Ez a művelet nem vonható vissza.
                </AlertDialogDescription>
              );
            })()}
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Mégse</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              disabled={
                isDeleting ||
                assets.some(a => a.grant_project_id === deletingProjectId) ||
                allComponents.some(c => c.grant_project_id === deletingProjectId)
              }
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              Projekt törlése
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
