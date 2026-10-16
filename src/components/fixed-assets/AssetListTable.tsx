import { useState, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Search, Package2, FolderKanban, Plus, Upload, X } from 'lucide-react';
import { cn, formatCurrency } from '@/lib/utils';
import type { FixedAsset } from '@/types/fixed-assets';
import { ASSET_STATUS_LABELS, ASSET_STATUS_COLORS } from '@/types/fixed-assets';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { UnifiedPagination } from '@/components/ui/unified-pagination';
import { useTranslation } from 'react-i18next';

function cleanEntityText(str?: string | null): string {
  if (!str) return '';
  return str
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function truncateText(str: string, maxLen = 28): string {
  if (!str) return '';
  return str.length > maxLen ? `${str.slice(0, maxLen).trim()}…` : str;
}

interface AssetListTableProps {
  assets: FixedAsset[];
  loading: boolean;
  selectedAssetId: string | null;
  onSelectAsset: (assetId: string) => void;
  onCreateAsset?: () => void;
  onImportAssets?: () => void;
}

export function AssetListTable({ assets, loading, selectedAssetId, onSelectAsset, onCreateAsset, onImportAssets }: AssetListTableProps) {
  const { t } = useTranslation(['hr', 'common']);
  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  const filtered = useMemo(() => {
    if (!search) return assets;
    const s = search.toLowerCase();
    return assets.filter((a) => {
      const cleanName = cleanEntityText(a.name).toLowerCase();
      const cleanProject = cleanEntityText(a.project?.name).toLowerCase();
      const cleanLocation = cleanEntityText(a.location?.name).toLowerCase();
      return (
        a.name.toLowerCase().includes(s) ||
        cleanName.includes(s) ||
        a.inventory_number.toLowerCase().includes(s) ||
        cleanLocation.includes(s) ||
        cleanProject.includes(s) ||
        (a.project?.project_code || '').toLowerCase().includes(s) ||
        (a.activated_by_name || '').toLowerCase().includes(s)
      );
    });
  }, [assets, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(Math.max(1, currentPage), totalPages);

  const paginatedAssets = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, safePage, pageSize]);

  const handleSearchChange = (val: string) => {
    setSearch(val);
    setCurrentPage(1);
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Search Header */}
      <div className="p-3 border-b border-border/50 shrink-0 flex items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t('hr:fixed_assets.search_placeholder', 'Keresés eszközök, projektek, helyszínek között...')}
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="pl-9 pr-8 h-9 bg-secondary/50 border-border/30"
          />
          {search && (
            <button
              onClick={() => handleSearchChange('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-0.5 rounded transition-colors"
              title={t('common:clear', 'Törlés')}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        {assets.length > 0 && (
          <div className="shrink-0 text-xs text-muted-foreground tabular-nums select-none px-1">
            {search ? (
              <span>
                <strong className="text-foreground font-semibold">{filtered.length}</strong> / {assets.length} {t('hr:fixed_assets.items_count', 'eszköz')}
              </span>
            ) : (
              <span>
                <strong className="text-foreground font-semibold">{assets.length}</strong> {t('hr:fixed_assets.items_count', 'eszköz')}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Table Content */}
      <div className="flex-1 min-h-0 flex flex-col relative overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <LoadingSpinner fullPage={false} size="md" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted/50 flex items-center justify-center">
              <Package2 className="h-8 w-8 opacity-50" />
            </div>
            <p className="font-medium">{t('hr:fixed_assets.no_assets', 'Nincsenek eszközök')}</p>
            <p className="text-sm mt-1 opacity-75">
              {search
                ? t('hr:fixed_assets.no_assets_search', 'Próbáld módosítani a keresést.')
                : t('hr:fixed_assets.no_assets_empty', 'Vigyél fel új vagy nyitó eszközt, vagy aktiválj a számlatételekből.')}
            </p>
            {!search && (
              <div className="flex items-center justify-center gap-2 mt-4">
                {onCreateAsset && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={onCreateAsset}
                    className="gap-1.5 text-primary hover:text-primary"
                  >
                    <Plus className="h-4 w-4" />
                    {t('hr:fixed_assets.create_asset_btn', 'Új eszköz felvétele')}
                  </Button>
                )}
                {onImportAssets && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={onImportAssets}
                    className="gap-1.5"
                  >
                    <Upload className="h-4 w-4" />
                    {t('hr:fixed_assets.import_assets_btn', 'Eszközök importálása')}
                  </Button>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="flex-1 min-h-0 overflow-y-auto overflow-x-auto">
            <Table className="compact-table w-full" containerClassName="overflow-visible">
              <TableHeader className="sticky top-0 z-10 bg-card/95 backdrop-blur-xs border-b border-border/50 shadow-2xs">
                <TableRow className="bg-muted/40 hover:bg-muted/40 select-none">
                  <TableHead className="w-7 min-w-[28px] text-center font-semibold text-xs whitespace-nowrap p-1">#</TableHead>
                  <TableHead className="w-[115px] min-w-[105px] font-semibold text-xs whitespace-nowrap p-1">{t('hr:fixed_assets.table.inventory_number', 'Leltári Szám')}</TableHead>
                  <TableHead className="min-w-[130px] font-semibold text-xs whitespace-nowrap p-1">{t('hr:fixed_assets.table.name', 'Megnevezés')}</TableHead>
                  <TableHead className="w-[65px] min-w-[55px] font-semibold text-xs text-center whitespace-nowrap p-1">{t('hr:fixed_assets.table.status', 'Státusz')}</TableHead>
                  <TableHead className="w-[90px] min-w-[80px] font-semibold text-xs text-right whitespace-nowrap p-1">{t('hr:fixed_assets.table.acquisition_value', 'Bekerülési érték')}</TableHead>
                  <TableHead className="w-[85px] min-w-[75px] font-semibold text-xs text-right whitespace-nowrap p-1">{t('hr:fixed_assets.table.dev_reserve', 'Fejlesztési tart.')}</TableHead>
                  <TableHead className="w-[85px] min-w-[75px] font-semibold text-xs text-right whitespace-nowrap p-1">{t('hr:fixed_assets.table.tao_base', 'TAO ÉCS alap')}</TableHead>
                  <TableHead className="w-[75px] min-w-[65px] font-semibold text-xs whitespace-nowrap p-1">{t('hr:fixed_assets.table.project', 'Projekt')}</TableHead>
                  <TableHead className="w-[85px] min-w-[75px] font-semibold text-xs whitespace-nowrap p-1">{t('hr:fixed_assets.table.location', 'Helyszín')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedAssets.map((asset, index) => {
                  const devReserveAmount = Number(asset.development_reserve_amount) || 0;
                  const taoBase = asset.tax_depreciation_base != null
                    ? Number(asset.tax_depreciation_base)
                    : Math.max(0, Number(asset.acquisition_value) - devReserveAmount);
                  const cleanedName = cleanEntityText(asset.name);
                  const rowNumber = (safePage - 1) * pageSize + index + 1;

                  return (
                    <TableRow
                      key={asset.id}
                      className={cn(
                        'cursor-pointer transition-colors',
                        selectedAssetId === asset.id
                          ? 'bg-primary/10 hover:bg-primary/15'
                          : 'hover:bg-muted/20'
                      )}
                      onClick={() => onSelectAsset(asset.id)}
                    >
                      <TableCell className="font-mono text-muted-foreground text-xs text-center whitespace-nowrap p-1">
                        {rowNumber}.
                      </TableCell>
                      <TableCell className="font-mono text-[11px] font-semibold text-foreground whitespace-nowrap truncate max-w-[115px] p-1" title={asset.inventory_number}>
                        {asset.inventory_number}
                      </TableCell>
                      <TableCell className="font-medium max-w-[160px] p-1" title={cleanedName}>
                        <div className="flex items-center gap-1 overflow-hidden">
                          <span className="truncate text-xs">
                            {truncateText(cleanedName, 28)}
                          </span>
                          {devReserveAmount > 0 && (
                            <span
                              className="shrink-0 text-[9px] font-semibold px-1 py-0.5 rounded bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30"
                              title={`Fejlesztési tartalék: ${devReserveAmount.toLocaleString('hu-HU')} Ft`}
                            >
                              FT
                            </span>
                          )}
                          {asset.grant_depreciation_base != null && (
                            <span
                              className="shrink-0 text-[9px] font-semibold px-1 py-0.5 rounded bg-purple-500/15 text-purple-700 dark:text-purple-400 border border-purple-500/30"
                              title={`Pályázati ÉCS: ${Number(asset.grant_depreciation_base).toLocaleString('hu-HU')} Ft`}
                            >
                              PÁLY
                            </span>
                          )}
                          {asset.has_tax_credit && (
                            <span
                              className="shrink-0 text-[9px] font-semibold px-1 py-0.5 rounded bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30"
                              title={`Beruházási adókedvezmény: megtartási gát ${asset.tax_credit_retention_until || '4 év'}`}
                            >
                              ADÓKEDV
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-center whitespace-nowrap p-1">
                        <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[11px] font-medium whitespace-nowrap ${ASSET_STATUS_COLORS[asset.status]}`}>
                          {t(`hr:fixed_assets.status.${asset.status}`, { defaultValue: ASSET_STATUS_LABELS[asset.status] })}
                        </span>
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs font-semibold text-foreground tabular-nums whitespace-nowrap p-1">
                        {formatCurrency(asset.acquisition_value, asset.currency)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs tabular-nums whitespace-nowrap p-1">
                        {devReserveAmount > 0 ? (
                          <span className="text-amber-700 dark:text-amber-400 font-semibold" title={`Levonás: ${devReserveAmount.toLocaleString('hu-HU')} Ft`}>
                            -{formatCurrency(devReserveAmount, asset.currency)}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs font-semibold text-primary tabular-nums whitespace-nowrap p-1">
                        {formatCurrency(taoBase, asset.currency)}
                      </TableCell>
                      <TableCell className="text-xs whitespace-nowrap p-1">
                        {asset.project ? (
                          <span
                            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-medium bg-primary/10 text-primary truncate max-w-[80px] border border-primary/20"
                            style={asset.project.color ? { borderColor: asset.project.color, color: asset.project.color } : undefined}
                            title={asset.project.project_code ? `${cleanEntityText(asset.project.name)} (${asset.project.project_code})` : cleanEntityText(asset.project.name)}
                          >
                            <FolderKanban className="h-3 w-3 shrink-0" />
                            <span className="truncate">{cleanEntityText(asset.project.name)}</span>
                          </span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-xs whitespace-nowrap p-1">
                        {asset.location ? (
                          <div className="flex flex-col truncate max-w-[85px]" title={asset.location.address ? `${cleanEntityText(asset.location.name)} — ${cleanEntityText(asset.location.address)}` : cleanEntityText(asset.location.name)}>
                            <span className="text-foreground font-medium truncate text-xs">{cleanEntityText(asset.location.name)}</span>
                            {asset.location.address && (
                              <span className="text-[10px] opacity-75 truncate">{cleanEntityText(asset.location.address)}</span>
                            )}
                          </div>
                        ) : (
                          <span>-</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}

        {/* Pagination Footer */}
        {!loading && filtered.length > 0 && (
          <div className="border-t border-border/50 px-3 py-1 shrink-0 bg-card/60">
            <UnifiedPagination
              currentPage={safePage}
              totalPages={totalPages}
              totalItems={filtered.length}
              pageSize={pageSize}
              onPageChange={setCurrentPage}
              onPageSizeChange={(newSize) => {
                setPageSize(newSize);
                setCurrentPage(1);
              }}
              pageSizeOptions={[25, 50, 100]}
              disableScrollToTop={true}
            />
          </div>
        )}
      </div>
    </div>
  );
}


