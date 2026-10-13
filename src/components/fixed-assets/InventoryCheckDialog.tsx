import { useState, useMemo, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  ShieldCheck,
  Search,
  CheckCircle2,
  AlertCircle,
  QrCode,
  FileSpreadsheet,
  FileDown,
  Wrench,
  Trash2,
  MapPin,
  User,
  ArrowRight,
  ListFilter,
  Check,
  RefreshCw,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { useCompany } from '@/contexts/CompanyContext';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { formatCurrency } from '@/lib/utils';
import { useCompanySubLocations } from '@/hooks/useCompanySubLocations';
import { useCompanyEmployees } from '@/hooks/useFixedAssets';
import {
  exportInventoryReportXlsx,
  exportInventoryReportPdf,
  type InventoryCheckStatus,
  type InventoryItemReportRow,
} from '@/lib/fixed-assets/inventoryReportExport';
import type { FixedAsset } from '@/types/fixed-assets';
import { formatCustodianName } from '@/types/fixed-assets';
import { reportError } from '@/lib/errorReporter';

interface InventoryItemState {
  status: InventoryCheckStatus;
  notes?: string;
  newSubLocationId?: string | null;
  newCustodianId?: string | null;
}

interface InventoryCheckDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  assets: FixedAsset[];
}

export function InventoryCheckDialog({ open, onOpenChange, assets }: InventoryCheckDialogProps) {
  const { t } = useTranslation(['hr', 'common']);
  const { toast } = useToast();
  const { user } = useAuth();
  const { selectedCompany } = useCompany();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<'scanner' | 'list' | 'report'>('scanner');
  const [searchInput, setSearchInput] = useState('');
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);

  // Leltározott tételek nyilvántartása a dialógus alatt: assetId -> state
  const [inventoryMap, setInventoryMap] = useState<Map<string, InventoryItemState>>(new Map());

  // Kijelölt eszköz állapota a szkenner kártyán
  const [currentCondition, setCurrentCondition] = useState<InventoryCheckStatus>('found');
  const [currentNotes, setCurrentNotes] = useState('');
  const [currentSubLocId, setCurrentSubLocId] = useState<string>('none');
  const [currentCustodianId, setCurrentCustodianId] = useState<string>('none');

  // Leltározó bizottság adatai
  const [cutoffDate, setCutoffDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [committeeTaker, setCommitteeTaker] = useState('');
  const [committeeInspector, setCommitteeInspector] = useState('');
  const [committeeApprover, setCommitteeApprover] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const scanInputRef = useRef<HTMLInputElement>(null);

  // Hookok a segédlistákhoz
  const { subLocations = [] } = useCompanySubLocations(selectedCompany?.id);
  const { data: employees = [] } = useCompanyEmployees(selectedCompany?.id);

  // Csak az aktív eszközök leltározhatóak
  const activeAssets = useMemo(() => assets.filter((a) => a.status === 'active'), [assets]);

  // Autofókusz a beolvasó mezőre megnyitáskor vagy tabváltáskor
  useEffect(() => {
    if (open && activeTab === 'scanner') {
      const timer = setTimeout(() => scanInputRef.current?.focus(), 150);
      return () => clearTimeout(timer);
    }
  }, [open, activeTab]);

  const selectAsset = (assetId: string) => {
    setSelectedAssetId(assetId);
    setSearchInput('');

    const existing = inventoryMap.get(assetId);
    const asset = activeAssets.find((a) => a.id === assetId);
    if (existing) {
      setCurrentCondition(existing.status);
      setCurrentNotes(existing.notes || '');
      setCurrentSubLocId(existing.newSubLocationId || asset?.sub_location?.id || 'none');
      setCurrentCustodianId(existing.newCustodianId || asset?.custodian?.id || 'none');
    } else if (asset) {
      setCurrentCondition('found');
      setCurrentNotes('');
      setCurrentSubLocId(asset.sub_location?.id || 'none');
      setCurrentCustodianId(asset.custodian?.id || 'none');
    }
  };

  // Szűrés a leltárlistában
  const [listFilter, setListFilter] = useState<'all' | 'uncheked' | 'found' | 'damaged' | 'missing'>('all');
  const [listSearch, setListSearch] = useState('');

  const filteredListAssets = useMemo(() => {
    return activeAssets.filter((a) => {
      const state = inventoryMap.get(a.id);
      if (listFilter === 'uncheked' && state) return false;
      if (listFilter === 'found' && state?.status !== 'found') return false;
      if (listFilter === 'damaged' && state?.status !== 'damaged' && state?.status !== 'scrap_candidate') return false;
      if (listFilter === 'missing' && state?.status !== 'missing') return false;

      if (listSearch) {
        const s = listSearch.toLowerCase();
        return (
          a.name.toLowerCase().includes(s) ||
          a.inventory_number.toLowerCase().includes(s) ||
          (a.location?.name || '').toLowerCase().includes(s) ||
          (a.sub_location?.name || '').toLowerCase().includes(s) ||
          formatCustodianName(a.custodian).toLowerCase().includes(s)
        );
      }
      return true;
    });
  }, [activeAssets, inventoryMap, listFilter, listSearch]);

  // Scanner keresési találatok
  const searchMatches = useMemo(() => {
    if (!searchInput.trim()) return [];
    const q = searchInput.trim().toLowerCase();
    return activeAssets.filter(
      (a) =>
        a.inventory_number.toLowerCase() === q ||
        a.id.toLowerCase() === q ||
        a.inventory_number.toLowerCase().includes(q) ||
        a.name.toLowerCase().includes(q)
    );
  }, [searchInput, activeAssets]);

  // Scanner enter / auto-select
  const handleScannerKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (searchMatches.length > 0) {
        selectAsset(searchMatches[0].id);
      }
    }
  };

  const handleSelectAsset = (assetId: string) => {
    selectAsset(assetId);
  };

  // Kijelölt eszköz rögzítése
  const handleSaveCurrentAsset = () => {
    if (!selectedAssetId) return;
    const asset = activeAssets.find((a) => a.id === selectedAssetId);
    if (!asset) return;

    setInventoryMap((prev) => {
      const next = new Map(prev);
      next.set(selectedAssetId, {
        status: currentCondition,
        notes: currentNotes.trim() || undefined,
        newSubLocationId: currentSubLocId !== 'none' && currentSubLocId !== asset.sub_location?.id ? currentSubLocId : undefined,
        newCustodianId: currentCustodianId !== 'none' && currentCustodianId !== asset.custodian?.id ? currentCustodianId : undefined,
      });
      return next;
    });

    toast({
      title: 'Tétel leltározva',
      description: `${asset.inventory_number} — ${asset.name} rögzítve.`,
    });

    // Reseteljük a kártyát és visszatérünk a keresőmezőhöz a következő eszköz beolvasásához
    setSelectedAssetId(null);
    setSearchInput('');
    setTimeout(() => scanInputRef.current?.focus(), 100);
  };

  // Gyors pipa a listanézetben
  const handleQuickToggleInList = (asset: FixedAsset) => {
    setInventoryMap((prev) => {
      const next = new Map(prev);
      if (next.has(asset.id)) {
        next.delete(asset.id);
      } else {
        next.set(asset.id, { status: 'found' });
      }
      return next;
    });
  };

  // Összes még nem leltározott eszköz azonnali felleltté tétele
  const handleMarkAllUncheckedAsFound = () => {
    setInventoryMap((prev) => {
      const next = new Map(prev);
      activeAssets.forEach((a) => {
        if (!next.has(a.id)) {
          next.set(a.id, { status: 'found' });
        }
      });
      return next;
    });
    toast({
      title: 'Mind fellelve jelölve',
      description: `${activeAssets.length} aktív eszköz állapota fellelve lett.`,
    });
  };

  // Statisztikák számítása
  const stats = useMemo(() => {
    let found = 0;
    let damaged = 0;
    let scrap = 0;
    let explicitMissing = 0;

    inventoryMap.forEach((val) => {
      if (val.status === 'found') found++;
      else if (val.status === 'damaged') damaged++;
      else if (val.status === 'scrap_candidate') scrap++;
      else if (val.status === 'missing') explicitMissing++;
    });

    const checkedTotal = inventoryMap.size;
    const uncheked = Math.max(0, activeAssets.length - checkedTotal);
    const totalMissing = explicitMissing + uncheked;

    return {
      total: activeAssets.length,
      checkedTotal,
      found,
      damaged,
      scrap,
      uncheked,
      totalMissing,
    };
  }, [activeAssets.length, inventoryMap]);

  // Exportálandó adatsorok előkészítése
  const reportRows: InventoryItemReportRow[] = useMemo(() => {
    return activeAssets.map((asset) => {
      const state = inventoryMap.get(asset.id);
      const subLoc = subLocations.find((s) => s.id === state?.newSubLocationId) || asset.sub_location;
      const cust = employees.find((e) => e.id === state?.newCustodianId) || asset.custodian;

      const checkStatus: InventoryCheckStatus = state ? state.status : 'missing';

      return {
        asset,
        checkStatus,
        notes: state?.notes || (!state ? 'Leltárhiány (nem került beolvasásra)' : undefined),
        physicalLocation: subLoc ? `${asset.location?.name || ''} / ${subLoc.name}` : asset.location?.name,
        physicalCustodian: cust ? formatCustodianName(cust) : undefined,
      };
    });
  }, [activeAssets, inventoryMap, subLocations, employees]);

  // Excel (.xlsx) export futtatása
  const handleExportXlsx = async () => {
    if (!selectedCompany) return;
    try {
      await exportInventoryReportXlsx({
        companyName: selectedCompany.name,
        companyTaxNumber: (selectedCompany as any).tax_number,
        companyAddress: (selectedCompany as any).address,
        cutoffDate,
        items: reportRows,
        committeeMembers: {
          taker: committeeTaker,
          inspector: committeeInspector,
          approver: committeeApprover,
        },
      });
      toast({ title: 'Excel leltárív sikeresen letöltve' });
    } catch (err: any) {
      toast({ title: 'Hiba a leltárív letöltésekor', description: err.message, variant: 'destructive' });
    }
  };

  // PDF (.pdf) export futtatása
  const handleExportPdf = () => {
    if (!selectedCompany) return;
    try {
      exportInventoryReportPdf({
        companyName: selectedCompany.name,
        companyTaxNumber: (selectedCompany as any).tax_number,
        companyAddress: (selectedCompany as any).address,
        cutoffDate,
        items: reportRows,
        committeeMembers: {
          taker: committeeTaker,
          inspector: committeeInspector,
          approver: committeeApprover,
        },
      });
      toast({ title: 'PDF leltárív sikeresen letöltve' });
    } catch (err: any) {
      toast({ title: 'Hiba a PDF generálásakor', description: err.message, variant: 'destructive' });
    }
  };

  // Leltár Végleges Zárása és Adatbázis Mentés
  const handleFinalizeInventory = async () => {
    if (!user || !selectedCompany) return;
    setSubmitting(true);

    try {
      const nowIso = new Date().toISOString();
      const events: any[] = [];
      const assetUpdates: Promise<any>[] = [];

      // 1. Leltározott eszközök eseményei
      for (const asset of activeAssets) {
        const state = inventoryMap.get(asset.id);
        const isFound = state && state.status !== 'missing';

        let description = '';
        if (state) {
          if (state.status === 'found') description = 'Leltár — Fellelve, állapota épp ✅';
          else if (state.status === 'damaged') description = `Leltár — Fellelve, de sérült ⚠️ (${state.notes || 'javítás szükséges'})`;
          else if (state.status === 'scrap_candidate') description = `Leltár — Selejtezendő 🗑️ (${state.notes || 'kivezetés javasolt'})`;
          else description = 'Leltár — Nem fellelve ❌';
        } else {
          description = 'Leltár — Nem fellelve (hiány) ❌';
        }

        if (state?.notes && state.status === 'found') {
          description += ` | Megjegyzés: ${state.notes}`;
        }

        events.push({
          asset_id: asset.id,
          company_id: selectedCompany.id,
          user_id: user.id,
          event_type: 'inventory_check' as const,
          event_date: cutoffDate,
          description,
        });

      }

      // Események mentése adatbázisba
      const { error: eventsError } = await supabase.from('asset_events').insert(events);
      if (eventsError) throw eventsError;

      // 2. Hiányzó eszközök státuszának frissítése 'missing'-re kötegelten
      const missingIds = activeAssets
        .filter((a) => !inventoryMap.has(a.id) || inventoryMap.get(a.id)?.status === 'missing')
        .map((a) => a.id);

      if (missingIds.length > 0) {
        await supabase
          .from('fixed_assets')
          .update({ status: 'missing', updated_at: nowIso })
          .in('id', missingIds);
      }

      // 3. Helyszíni korrekciók mentése (új tárolóhely vagy felelős)
      for (const asset of activeAssets) {
        const state = inventoryMap.get(asset.id);
        if (state && state.status !== 'missing') {
          const patch: Record<string, any> = { updated_at: nowIso };
          let hasPatch = false;

          if (state.newSubLocationId && state.newSubLocationId !== asset.sub_location?.id) {
            patch.sub_location_id = state.newSubLocationId;
            hasPatch = true;
          }
          if (state.newCustodianId && state.newCustodianId !== asset.custodian?.id) {
            patch.custodian_id = state.newCustodianId;
            hasPatch = true;
          }

          if (hasPatch) {
            await supabase.from('fixed_assets').update(patch).eq('id', asset.id);
          }
        }
      }

      // Cache invalidálás
      queryClient.invalidateQueries({ queryKey: ['fixedAssets', selectedCompany.id] });
      activeAssets.forEach((a) => queryClient.invalidateQueries({ queryKey: ['fixedAssetDetail', a.id] }));

      toast({
        title: 'Leltár sikeresen lezárva',
        description: `${stats.found + stats.damaged + stats.scrap} eszköz fellelve, ${stats.totalMissing} hiányzóként rögzítve.`,
      });

      onOpenChange(false);
    } catch (err: any) {
      reportError({ type: 'db_query', component: 'InventoryCheckDialog', action: 'error', message: 'Leltár lezárási hiba:', error: err });
      toast({
        title: 'Hiba a leltár lezárásakor',
        description: err.message || 'Nem sikerült menteni a leltáradatokat.',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const selectedAsset = useMemo(
    () => activeAssets.find((a) => a.id === selectedAssetId) || null,
    [selectedAssetId, activeAssets]
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[92vh] overflow-hidden flex flex-col p-4 sm:p-6">
        <DialogHeader className="pb-2 border-b">
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2 text-lg sm:text-xl font-bold">
              <ShieldCheck className="h-5 w-5 text-primary" />
              Tárgyi Eszköz Leltározó és Fordulónapi Leltárív
            </DialogTitle>
            <div className="flex items-center gap-2">
              <span className="text-xs px-2.5 py-1 rounded-full bg-primary/10 text-primary font-semibold">
                Összesen: {activeAssets.length} aktív
              </span>
            </div>
          </div>
          <DialogDescription className="text-xs sm:text-sm">
            Gyors optikai szkenneres leltár, helyszíni állapotrögzítés, és Sztv. szerinti fordulónapi analitikus leltárív export.
          </DialogDescription>
        </DialogHeader>

        {/* Fő fülek: Scanner / Lista / Zárás és Export */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="flex-1 flex flex-col min-h-0 pt-2">
          <div className="flex items-center justify-between pb-3">
            <TabsList className="grid grid-cols-3 w-full sm:w-[420px] h-9">
              <TabsTrigger value="scanner" className="text-xs sm:text-sm gap-1.5">
                <QrCode className="h-3.5 w-3.5" />
                Gyors Scanner
              </TabsTrigger>
              <TabsTrigger value="list" className="text-xs sm:text-sm gap-1.5">
                <ListFilter className="h-3.5 w-3.5" />
                Leltárlista ({stats.checkedTotal}/{stats.total})
              </TabsTrigger>
              <TabsTrigger value="report" className="text-xs sm:text-sm gap-1.5">
                <FileSpreadsheet className="h-3.5 w-3.5" />
                Zárás & Export
              </TabsTrigger>
            </TabsList>

            {/* Mini statisztika badge-ek */}
            <div className="hidden md:flex items-center gap-2 text-xs">
              <span className="inline-flex items-center gap-1 text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded font-medium">
                <CheckCircle2 className="h-3 w-3" /> Fellelve: {stats.found}
              </span>
              {(stats.damaged > 0 || stats.scrap > 0) && (
                <span className="inline-flex items-center gap-1 text-amber-600 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded font-medium">
                  <Wrench className="h-3 w-3" /> Sérült/Selejt: {stats.damaged + stats.scrap}
                </span>
              )}
              {stats.uncheked > 0 && (
                <span className="inline-flex items-center gap-1 text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded font-medium">
                  Még hátra: {stats.uncheked}
                </span>
              )}
            </div>
          </div>

          {/* ── TAB 1: SCANNER NÉZET (MOBILBARÁT BEOLVASÓ) ── */}
          <TabsContent value="scanner" className="flex-1 flex flex-col min-h-0 space-y-4 m-0 overflow-y-auto pr-1">
            {/* Beolvasó / Kereső beviteli mező */}
            <div className="relative">
              <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-primary">
                <QrCode className="h-5 w-5 animate-pulse" />
              </div>
              <Input
                ref={scanInputRef}
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={handleScannerKeyDown}
                placeholder="Olvass be vonalkódot vagy gépelj leltári számot (pl. TE-2026/001)..."
                className="pl-11 h-12 text-sm sm:text-base font-medium shadow-sm border-primary/40 focus-visible:ring-primary"
              />
              {searchInput && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setSearchInput('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 h-7 text-xs"
                >
                  Törlés
                </Button>
              )}
            </div>

            {/* Keresési találatok listája (ha nincs konkrét kiválasztva és gépel a user) */}
            {searchInput && searchMatches.length > 0 && !selectedAsset && (
              <div className="border rounded-lg bg-card divide-y max-h-48 overflow-y-auto shadow-sm">
                {searchMatches.slice(0, 5).map((asset) => (
                  <div
                    key={asset.id}
                    onClick={() => handleSelectAsset(asset.id)}
                    className="p-2.5 flex items-center justify-between hover:bg-muted/60 cursor-pointer transition-colors"
                  >
                    <div>
                      <div className="font-semibold text-xs sm:text-sm text-foreground">{asset.name}</div>
                      <div className="font-mono text-xs text-muted-foreground">{asset.inventory_number}</div>
                    </div>
                    <Button size="sm" variant="outline" className="h-7 text-xs gap-1">
                      Kiválasztás <ArrowRight className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            {/* Kiválasztott vagy beolvasott eszköz kártyája */}
            {selectedAsset ? (
              <div className="border-2 border-primary/30 rounded-xl p-4 sm:p-5 bg-card shadow-md space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b pb-3">
                  <div>
                    <span className="font-mono text-xs px-2 py-0.5 rounded bg-primary/10 text-primary font-bold">
                      {selectedAsset.inventory_number}
                    </span>
                    <h3 className="font-bold text-base sm:text-lg text-foreground mt-1">
                      {selectedAsset.name}
                    </h3>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-muted-foreground">Könyv szerinti nettó:</div>
                    <div className="font-mono font-bold text-sm sm:text-base text-primary">
                      {formatCurrency(selectedAsset.net_book_value ?? selectedAsset.acquisition_value, selectedAsset.currency)}
                    </div>
                  </div>
                </div>

                {/* Nyilvántartott adatok */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs bg-muted/30 p-2.5 rounded-lg border border-border/50">
                  <div>
                    <span className="text-muted-foreground block">Telephely:</span>
                    <span className="font-medium flex items-center gap-1 mt-0.5">
                      <MapPin className="h-3 w-3 text-slate-400" />
                      {selectedAsset.location?.name || '-'}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block">Nyilvántartott tárolóhely:</span>
                    <span className="font-medium mt-0.5 block truncate">
                      {selectedAsset.sub_location?.name || 'Nincs hozzárendelve'}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block">Nyilvántartott felelős:</span>
                    <span className="font-medium flex items-center gap-1 mt-0.5 truncate">
                      <User className="h-3 w-3 text-slate-400" />
                      {formatCustodianName(selectedAsset.custodian) || 'Nincs hozzárendelve'}
                    </span>
                  </div>
                </div>

                {/* Fizikai állapot választó gombok (Nagy gombok érintőképernyőhöz) */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-foreground">Fizikai állapot:</Label>
                  <div className="grid grid-cols-3 gap-2">
                    <Button
                      type="button"
                      variant={currentCondition === 'found' ? 'default' : 'outline'}
                      className={`h-11 flex items-center justify-center gap-1.5 font-semibold text-xs sm:text-sm ${
                        currentCondition === 'found' ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : ''
                      }`}
                      onClick={() => setCurrentCondition('found')}
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      Épp / Rendben
                    </Button>

                    <Button
                      type="button"
                      variant={currentCondition === 'damaged' ? 'default' : 'outline'}
                      className={`h-11 flex items-center justify-center gap-1.5 font-semibold text-xs sm:text-sm ${
                        currentCondition === 'damaged' ? 'bg-amber-600 hover:bg-amber-700 text-white' : ''
                      }`}
                      onClick={() => setCurrentCondition('damaged')}
                    >
                      <Wrench className="h-4 w-4" />
                      Sérült
                    </Button>

                    <Button
                      type="button"
                      variant={currentCondition === 'scrap_candidate' ? 'default' : 'outline'}
                      className={`h-11 flex items-center justify-center gap-1.5 font-semibold text-xs sm:text-sm ${
                        currentCondition === 'scrap_candidate' ? 'bg-destructive hover:bg-destructive/90 text-white' : ''
                      }`}
                      onClick={() => setCurrentCondition('scrap_candidate')}
                    >
                      <Trash2 className="h-4 w-4" />
                      Selejtezendő
                    </Button>
                  </div>
                </div>

                {/* Helyszíni korrekció (ha eltér a valóságban a tárolóhely vagy felelős) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Tényleges tárolóhely (korrekció):</Label>
                    <Select value={currentSubLocId} onValueChange={setCurrentSubLocId}>
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue placeholder="Válassz tárolóhelyet..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">-- Változatlan --</SelectItem>
                        {subLocations.map((sub) => (
                          <SelectItem key={sub.id} value={sub.id}>
                            {sub.name} {sub.code ? `(${sub.code})` : ''}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Tényleges felelős (korrekció):</Label>
                    <Select value={currentCustodianId} onValueChange={setCurrentCustodianId}>
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue placeholder="Válassz felelőst..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">-- Változatlan --</SelectItem>
                        {employees.map((emp) => (
                          <SelectItem key={emp.id} value={emp.id}>
                            {formatCustodianName(emp)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Megjegyzés mező */}
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Leltári megjegyzés / Eltérés indoklása:</Label>
                  <Input
                    value={currentNotes}
                    onChange={(e) => setCurrentNotes(e.target.value)}
                    placeholder="Opcionális megjegyzés a leltárívre..."
                    className="h-8 text-xs"
                  />
                </div>

                {/* Rögzítés gombok */}
                <div className="flex gap-2 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setSelectedAssetId(null)}
                    className="flex-1 text-xs"
                  >
                    Mégse
                  </Button>
                  <Button
                    type="button"
                    onClick={handleSaveCurrentAsset}
                    className="flex-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs sm:text-sm gap-2"
                  >
                    <Check className="h-4 w-4" />
                    Rögzítés és Következő Eszköz
                  </Button>
                </div>
              </div>
            ) : (
              <div className="border border-dashed rounded-xl p-8 text-center text-muted-foreground space-y-2 bg-muted/20">
                <QrCode className="h-10 w-10 mx-auto text-muted-foreground/60" />
                <h4 className="font-semibold text-sm text-foreground">Készen áll a beolvasásra</h4>
                <p className="text-xs max-w-sm mx-auto">
                  Használj kézi optikai vonalkód olvasót, mobilkamerát, vagy gépeld be a leltári számot a fenti keresőmezőbe!
                </p>
              </div>
            )}
          </TabsContent>

          {/* ── TAB 2: LELTÁRLISTA ÉS TÖMEGES ELLENŐRZÉS ── */}
          <TabsContent value="list" className="flex-1 flex flex-col min-h-0 space-y-3 m-0">
            <div className="flex flex-col sm:flex-row gap-2 justify-between items-center">
              <div className="flex items-center gap-1.5 flex-wrap">
                <Button
                  size="sm"
                  variant={listFilter === 'all' ? 'default' : 'outline'}
                  onClick={() => setListFilter('all')}
                  className="h-7 text-xs"
                >
                  Mind ({activeAssets.length})
                </Button>
                <Button
                  size="sm"
                  variant={listFilter === 'uncheked' ? 'default' : 'outline'}
                  onClick={() => setListFilter('uncheked')}
                  className="h-7 text-xs"
                >
                  Még nincs leltározva ({stats.uncheked})
                </Button>
                <Button
                  size="sm"
                  variant={listFilter === 'found' ? 'default' : 'outline'}
                  onClick={() => setListFilter('found')}
                  className="h-7 text-xs text-emerald-600"
                >
                  Fellelve ({stats.found})
                </Button>
                <Button
                  size="sm"
                  variant={listFilter === 'damaged' ? 'default' : 'outline'}
                  onClick={() => setListFilter('damaged')}
                  className="h-7 text-xs text-amber-600"
                >
                  Sérült/Selejt ({stats.damaged + stats.scrap})
                </Button>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <Input
                  value={listSearch}
                  onChange={(e) => setListSearch(e.target.value)}
                  placeholder="Keresés a listában..."
                  className="h-7 text-xs w-full sm:w-44"
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleMarkAllUncheckedAsFound}
                  className="h-7 text-xs whitespace-nowrap"
                >
                  Mind fellelve
                </Button>
              </div>
            </div>

            {/* Táblázat */}
            <div className="flex-1 overflow-auto rounded-lg border border-border">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40 hover:bg-muted/40 text-xs">
                    <TableHead className="w-10">Státusz</TableHead>
                    <TableHead className="font-bold">Leltári szám</TableHead>
                    <TableHead className="font-bold">Megnevezés</TableHead>
                    <TableHead>Tárolóhely / Telephely</TableHead>
                    <TableHead>Felelős</TableHead>
                    <TableHead className="text-right">Nettó érték</TableHead>
                    <TableHead className="text-right w-24">Művelet</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="text-xs">
                  {filteredListAssets.map((asset) => {
                    const itemState = inventoryMap.get(asset.id);
                    return (
                      <TableRow
                        key={asset.id}
                        className={itemState ? 'bg-emerald-50/30 dark:bg-emerald-950/10' : ''}
                      >
                        <TableCell>
                          <Checkbox
                            checked={!!itemState}
                            onCheckedChange={() => handleQuickToggleInList(asset)}
                          />
                        </TableCell>
                        <TableCell className="font-mono font-semibold">{asset.inventory_number}</TableCell>
                        <TableCell className="font-medium max-w-[200px] truncate">{asset.name}</TableCell>
                        <TableCell className="text-muted-foreground truncate max-w-[140px]">
                          {asset.sub_location?.name || asset.location?.name || '-'}
                        </TableCell>
                        <TableCell className="text-muted-foreground truncate max-w-[120px]">
                          {formatCustodianName(asset.custodian) || '-'}
                        </TableCell>
                        <TableCell className="text-right font-mono font-medium">
                          {formatCurrency(asset.net_book_value ?? asset.acquisition_value, asset.currency)}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              selectAsset(asset.id);
                              setActiveTab('scanner');
                            }}
                            className="h-6 text-[11px] px-1.5"
                          >
                            {itemState ? 'Módosít' : 'Rögzít'}
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          {/* ── TAB 3: ZÁRÁS & SZTV LELTÁRÍV EXPORT ── */}
          <TabsContent value="report" className="flex-1 flex flex-col min-h-0 space-y-4 m-0 overflow-y-auto pr-1">
            {/* Összesítő kártyák */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 rounded-lg border bg-card text-center">
                <span className="text-xs text-muted-foreground block">Összes eszköz</span>
                <span className="text-lg font-bold font-mono text-foreground">{stats.total} db</span>
              </div>
              <div className="p-3 rounded-lg border bg-emerald-50/50 dark:bg-emerald-950/20 text-center border-emerald-200">
                <span className="text-xs text-emerald-700 dark:text-emerald-300 block">Fellelve (Rendben)</span>
                <span className="text-lg font-bold font-mono text-emerald-600">{stats.found} db</span>
              </div>
              <div className="p-3 rounded-lg border bg-amber-50/50 dark:bg-amber-950/20 text-center border-amber-200">
                <span className="text-xs text-amber-700 dark:text-amber-300 block">Sérült / Selejt</span>
                <span className="text-lg font-bold font-mono text-amber-600">{stats.damaged + stats.scrap} db</span>
              </div>
              <div className="p-3 rounded-lg border bg-rose-50/50 dark:bg-rose-950/20 text-center border-rose-200">
                <span className="text-xs text-rose-700 dark:text-rose-300 block">Hiányzó / Nem fellelt</span>
                <span className="text-lg font-bold font-mono text-rose-600">{stats.totalMissing} db</span>
              </div>
            </div>

            {/* Leltározó bizottság és fordulónap adatok */}
            <div className="border rounded-lg p-4 bg-muted/20 space-y-3">
              <h4 className="font-semibold text-xs text-foreground uppercase tracking-wide">
                Leltározó Bizottság és Fordulónap (Sztv. 69. §)
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Leltár fordulónapja:</Label>
                  <Input
                    type="date"
                    value={cutoffDate}
                    onChange={(e) => setCutoffDate(e.target.value)}
                    className="h-8 text-xs font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Leltárfelvevő neve:</Label>
                  <Input
                    value={committeeTaker}
                    onChange={(e) => setCommitteeTaker(e.target.value)}
                    placeholder="pl. Kovács János"
                    className="h-8 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Leltárellenőr neve:</Label>
                  <Input
                    value={committeeInspector}
                    onChange={(e) => setCommitteeInspector(e.target.value)}
                    placeholder="pl. Kiss Péter"
                    className="h-8 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Felelős vezető neve:</Label>
                  <Input
                    value={committeeApprover}
                    onChange={(e) => setCommitteeApprover(e.target.value)}
                    placeholder="pl. Dr. Nagy Béla"
                    className="h-8 text-xs"
                  />
                </div>
              </div>
            </div>

            {/* Leltárív Letöltése gombok */}
            <div className="flex flex-col sm:flex-row gap-3">
              <Button
                variant="outline"
                onClick={handleExportXlsx}
                className="flex-1 h-10 gap-2 border-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 font-semibold text-xs sm:text-sm"
              >
                <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
                Hivatalos Excel Leltárív (.xlsx) Letöltése
              </Button>

              <Button
                variant="outline"
                onClick={handleExportPdf}
                className="flex-1 h-10 gap-2 border-primary/30 hover:bg-primary/5 text-primary font-semibold text-xs sm:text-sm"
              >
                <FileDown className="h-4 w-4 text-primary" />
                Nyomtatható PDF Leltárív (.pdf) Letöltése
              </Button>
            </div>

            {/* Figyelmeztetés a végleges lezárás előtt */}
            {stats.totalMissing > 0 && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-rose-50 dark:bg-rose-950/30 border border-rose-200 text-rose-800 dark:text-rose-200 text-xs">
                <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0 text-rose-600" />
                <div>
                  <span className="font-bold">Figyelem! {stats.totalMissing} eszköz nem lett leltározva.</span>
                  <p className="mt-0.5 text-rose-700/80 dark:text-rose-300/80">
                    A leltár véglegesítésekor ezek az eszközök automatikusan "Hiányzik" (missing) státuszt kapnak, és leltárhiány esemény kerül rögzítésre.
                  </p>
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* Dialógus lábléc */}
        <DialogFooter className="pt-3 border-t flex flex-col sm:flex-row gap-2">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Bezárás
          </Button>

          {activeTab === 'report' ? (
            <Button
              size="sm"
              onClick={handleFinalizeInventory}
              disabled={submitting}
              className="gap-2 bg-primary text-primary-foreground font-bold"
            >
              {submitting ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  Leltár rögzítése...
                </>
              ) : (
                <>
                  <ShieldCheck className="h-4 w-4" />
                  Leltár Véglegesítése és Mentése ({stats.checkedTotal} tétel)
                </>
              )}
            </Button>
          ) : (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setActiveTab('report')}
              className="gap-1.5"
            >
              Tovább a Záráshoz és Exportáláshoz
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
