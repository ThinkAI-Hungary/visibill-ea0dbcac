import { useState, lazy, Suspense, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useCompany } from '@/contexts/CompanyContext';
import { useFixedAssets, useFixedAssetDetail } from '@/hooks/useFixedAssets';
import { useEaisybillPermissions } from '@/hooks/useEaisybillPermissions';
import { AssetListTable } from '@/components/fixed-assets/AssetListTable';
import { AssetDetailPanel } from '@/components/fixed-assets/AssetDetailPanel';
import { DevelopmentReservesTab } from '@/components/fixed-assets/DevelopmentReservesTab';
import { ContentSkeleton } from '@/components/ui/content-skeleton';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { Button } from '@/components/ui/button';
import { Package2, ShieldCheck, PiggyBank, Calculator, Plus, Upload } from 'lucide-react';
import { useTranslation } from 'react-i18next';

// Lazy-load heavy dialogs to keep initial chunk small
const InventoryCheckDialog = lazy(() =>
  import('@/components/fixed-assets/InventoryCheckDialog').then(m => ({ default: m.InventoryCheckDialog }))
);
const DepreciationRunDialog = lazy(() =>
  import('@/components/fixed-assets/DepreciationRunDialog').then(m => ({ default: m.DepreciationRunDialog }))
);
const CreateFixedAssetDialog = lazy(() =>
  import('@/components/fixed-assets/CreateFixedAssetDialog').then(m => ({ default: m.CreateFixedAssetDialog }))
);
const AssetImportModal = lazy(() =>
  import('@/components/fixed-assets/AssetImportModal').then(m => ({ default: m.AssetImportModal }))
);

export default function FixedAssetsPage() {
  const { t } = useTranslation(['hr', 'common']);
  const { selectedCompany } = useCompany();
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [inventoryCheckOpen, setInventoryCheckOpen] = useState(false);
  const [depreciationDialogOpen, setDepreciationDialogOpen] = useState(false);
  const [createAssetOpen, setCreateAssetOpen] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const { canWrite: canWriteModule } = useEaisybillPermissions();
  const writable = canWriteModule('fixed_assets');

  const currentTab = searchParams.get('tab') || 'assets';
  const handleTabChange = useCallback((tab: string) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      if (tab === 'assets') next.delete('tab');
      else next.set('tab', tab);
      return next;
    }, { replace: true });
  }, [setSearchParams]);

  const { data: assets = [], isLoading } = useFixedAssets(selectedCompany?.id);
  const { data: detailData, isFetching: detailLoading } = useFixedAssetDetail(selectedAssetId);

  // ── URL-based asset deep-linking (?asset=<id>) ──
  const setAssetParam = useCallback((assetId: string | null) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      if (assetId) next.set('asset', assetId);
      else next.delete('asset');
      return next;
    }, { replace: true });
  }, [setSearchParams]);

  // ── URL param for inventory dialog ──
  const setInventoryParam = useCallback((open: boolean) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      if (open) next.set('action', 'inventory');
      else next.delete('action');
      return next;
    }, { replace: true });
  }, [setSearchParams]);

  const handleOpenInventory = useCallback(() => {
    setInventoryCheckOpen(true);
    setInventoryParam(true);
  }, [setInventoryParam]);

  const handleCloseInventory = useCallback((v: boolean) => {
    setInventoryCheckOpen(v);
    if (!v) setInventoryParam(false);
  }, [setInventoryParam]);

  // Select asset and update URL
  const handleSelectAsset = useCallback((assetId: string | null) => {
    setSelectedAssetId(assetId);
    setAssetParam(assetId);
  }, [setAssetParam]);

  // Auto-open from URL (?asset=<id>)
  const assetIdFromUrl = searchParams.get('asset');
  useEffect(() => {
    if (!assetIdFromUrl || isLoading) return;
    // Only set if not already selected (avoid re-render loops)
    if (selectedAssetId !== assetIdFromUrl) {
      setSelectedAssetId(assetIdFromUrl);
    }
  }, [assetIdFromUrl, isLoading]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-open inventory dialog from URL
  const actionFromUrl = searchParams.get('action');
  useEffect(() => {
    if (actionFromUrl === 'inventory' && !inventoryCheckOpen) setInventoryCheckOpen(true);
  }, [actionFromUrl]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!selectedCompany) return null;

  const activeCount = assets.filter(a => a.status === 'active').length;

  return (
    <div className="h-full flex flex-col page-animate">
      {/* Header */}
      <div className="px-6 py-4 border-b border-border/50 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Package2 className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">{t('hr:fixed_assets.title', 'Tárgyi Eszköz Nyilvántartó')}</h1>
              <p className="text-sm text-muted-foreground">
                {t('hr:fixed_assets.subtitle', { company: selectedCompany.name, total: assets.length, active: activeCount, defaultValue: `${selectedCompany.name} — ${assets.length} eszköz (${activeCount} aktív)` })}
              </p>
            </div>
          </div>

          {/* Header actions */}
          <div className="flex items-center gap-3">
            {/* Tabs Pill */}
            <div className="flex rounded-lg border border-border/60 bg-muted/30 p-1">
              <button
                onClick={() => handleTabChange('assets')}
                className={`flex items-center gap-2 px-3 py-1.5 text-xs rounded-md font-medium transition-colors ${currentTab === 'assets' ? 'bg-background shadow-xs text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
              >
                <Package2 className="h-3.5 w-3.5" />
                {t('hr:fixed_assets.tab_assets', { count: assets.length, defaultValue: `Eszközök (${assets.length})` })}
              </button>
              <button
                onClick={() => handleTabChange('development_reserves')}
                className={`flex items-center gap-2 px-3 py-1.5 text-xs rounded-md font-medium transition-colors ${currentTab === 'development_reserves' ? 'bg-background shadow-xs text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
              >
                <PiggyBank className="h-3.5 w-3.5 text-amber-500" />
                {t('hr:fixed_assets.tab_dev_reserves', 'Fejlesztési Tartalékok')}
              </button>
            </div>

            {currentTab === 'assets' && (
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90 font-medium shadow-xs"
                  onClick={() => setCreateAssetOpen(true)}
                  disabled={!writable}
                >
                  <Plus className="h-4 w-4" />
                  {t('hr:fixed_assets.create_asset', 'Új eszköz felvétele')}
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2 font-medium"
                  onClick={() => setImportModalOpen(true)}
                  disabled={!writable}
                >
                  <Upload className="h-4 w-4" />
                  {t('hr:fixed_assets.import_assets', 'Eszközök importálása')}
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2 text-primary hover:text-primary font-medium"
                  onClick={() => setDepreciationDialogOpen(true)}
                  disabled={activeCount === 0 || !writable}
                >
                  <Calculator className="h-4 w-4" />
                  {t('hr:fixed_assets.depreciation_run', 'ÉCS elszámolás')}
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  onClick={handleOpenInventory}
                  disabled={activeCount === 0 || !writable}
                >
                  <ShieldCheck className="h-4 w-4" />
                  {t('hr:fixed_assets.inventory_check', 'Leltár ellenőrzés')}
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Body */}
      {currentTab === 'development_reserves' ? (
        <div className="flex-1 overflow-y-auto">
          <DevelopmentReservesTab />
        </div>
      ) : (
        /* Master-Detail Layout */
        <div className="flex-1 flex min-h-0 overflow-y-auto overflow-x-hidden">
          {/* Left panel: Asset List (60%) — stays in place */}
          <div className="w-[60%] shrink-0 grow-0 overflow-hidden border-r border-border/50 flex flex-col sticky top-0 self-start min-h-0 max-h-[calc(100vh-8rem)]">
            <AssetListTable
              assets={assets}
              loading={isLoading}
              selectedAssetId={selectedAssetId}
              onSelectAsset={handleSelectAsset}
              onCreateAsset={() => setCreateAssetOpen(true)}
              onImportAssets={() => setImportModalOpen(true)}
            />
          </div>

        {/* Right panel: Asset Detail (40%) — full height, no scroll */}
        <div className="w-[40%] shrink-0 grow-0 overflow-hidden">
          {selectedAssetId && detailData?.asset ? (
            <AssetDetailPanel
              asset={detailData.asset}
              events={detailData.events}
            />
          ) : selectedAssetId ? (
            /* Loading state — asset selected but data not yet ready */
            <div className="flex items-center justify-center min-h-[400px]">
              <LoadingSpinner fullPage={false} size="md" />
            </div>
          ) : (
            <div className="flex items-center justify-center min-h-[400px] text-muted-foreground">
              <div className="text-center">
                <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-muted/30 flex items-center justify-center">
                  <Package2 className="h-10 w-10 opacity-30" />
                </div>
                <p className="font-medium">{t('hr:fixed_assets.select_asset', 'Válassz egy eszközt')}</p>
                <p className="text-sm mt-1 opacity-75">
                  {t('hr:fixed_assets.select_asset_desc', 'Kattints egy eszközre a bal oldali listában a részletek megtekintéséhez.')}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    )}

      {/* Create Fixed Asset Dialog — lazy loaded */}
      <Suspense fallback={null}>
        {createAssetOpen && (
          <CreateFixedAssetDialog
            open={createAssetOpen}
            onOpenChange={setCreateAssetOpen}
          />
        )}
      </Suspense>

      {/* Asset Import Modal — lazy loaded */}
      <Suspense fallback={null}>
        {importModalOpen && (
          <AssetImportModal
            open={importModalOpen}
            onOpenChange={setImportModalOpen}
          />
        )}
      </Suspense>

      {/* Depreciation Run Dialog — lazy loaded */}
      <Suspense fallback={null}>
        {depreciationDialogOpen && (
          <DepreciationRunDialog
            open={depreciationDialogOpen}
            onOpenChange={setDepreciationDialogOpen}
          />
        )}
      </Suspense>

      {/* Inventory Check Dialog — lazy loaded */}
      <Suspense fallback={null}>
        {inventoryCheckOpen && (
          <InventoryCheckDialog
            open={inventoryCheckOpen}
            onOpenChange={handleCloseInventory}
            assets={assets}
          />
        )}
      </Suspense>
    </div>
  );
}
