import { useState, lazy, Suspense, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useCompany } from '@/contexts/CompanyContext';
import { useFixedAssets, useFixedAssetDetail } from '@/hooks/useFixedAssets';
import { useEaisybillPermissions } from '@/hooks/useEaisybillPermissions';
import { AssetListTable } from '@/components/fixed-assets/AssetListTable';
import { AssetDetailPanel } from '@/components/fixed-assets/AssetDetailPanel';
import { ContentSkeleton } from '@/components/ui/content-skeleton';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { Button } from '@/components/ui/button';
import { Package2, ShieldCheck } from 'lucide-react';

// Lazy-load heavy dialog to keep initial chunk small
const InventoryCheckDialog = lazy(() =>
  import('@/components/fixed-assets/InventoryCheckDialog').then(m => ({ default: m.InventoryCheckDialog }))
);

export default function FixedAssetsPage() {
  const { selectedCompany } = useCompany();
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [inventoryCheckOpen, setInventoryCheckOpen] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const { canWrite: canWriteModule } = useEaisybillPermissions();
  const writable = canWriteModule('fixed_assets');

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
              <h1 className="text-2xl font-bold">Tárgyi Eszköz Nyilvántartó</h1>
              <p className="text-sm text-muted-foreground">
                {selectedCompany.name} — {assets.length} eszköz ({activeCount} aktív)
              </p>
            </div>
          </div>

          {/* Header actions */}
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={handleOpenInventory}
              disabled={activeCount === 0 || !writable}
            >
              <ShieldCheck className="h-4 w-4" />
              Leltár ellenőrzés
            </Button>
          </div>
        </div>
      </div>

      {/* Master-Detail Layout */}
      <div className="flex-1 flex min-h-0 overflow-y-auto overflow-x-hidden">
        {/* Left panel: Asset List (60%) — stays in place */}
        <div className="w-[60%] shrink-0 grow-0 overflow-hidden border-r border-border/50 flex flex-col sticky top-0 self-start min-h-0 max-h-[calc(100vh-8rem)]">
          <AssetListTable
            assets={assets}
            loading={isLoading}
            selectedAssetId={selectedAssetId}
            onSelectAsset={handleSelectAsset}
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
                <p className="font-medium">Válassz egy eszközt</p>
                <p className="text-sm mt-1 opacity-75">
                  Kattints egy eszközre a bal oldali listában a részletek megtekintéséhez.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

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
