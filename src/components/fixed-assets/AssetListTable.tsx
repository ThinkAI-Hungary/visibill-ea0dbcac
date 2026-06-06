import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Search, Package2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { FixedAsset } from '@/types/fixed-assets';
import { ASSET_STATUS_LABELS, ASSET_STATUS_COLORS } from '@/types/fixed-assets';
import { LoadingSpinner } from '@/components/ui/loading-spinner';

interface AssetListTableProps {
  assets: FixedAsset[];
  loading: boolean;
  selectedAssetId: string | null;
  onSelectAsset: (assetId: string) => void;
}

export function AssetListTable({ assets, loading, selectedAssetId, onSelectAsset }: AssetListTableProps) {
  const [search, setSearch] = useState('');

  const filtered = assets.filter((a) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      a.name.toLowerCase().includes(s) ||
      a.inventory_number.toLowerCase().includes(s) ||
      (a.location?.name || '').toLowerCase().includes(s) ||
      (a.activated_by_name || '').toLowerCase().includes(s)
    );
  });

  return (
    <div className="flex flex-col h-full">
      {/* Search */}
      <div className="p-4 border-b border-border/50">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Keresés eszközök között..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9 bg-secondary/50 border-border/30"
          />
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <LoadingSpinner />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted/50 flex items-center justify-center">
              <Package2 className="h-8 w-8 opacity-50" />
            </div>
            <p className="font-medium">Nincsenek eszközök</p>
            <p className="text-sm mt-1 opacity-75">
              {search ? 'Próbáld módosítani a keresést.' : 'Aktiválj eszközöket a Számlatételek menüből.'}
            </p>
          </div>
        ) : (
          <Table className="compact-table table-fixed w-full">
            <TableHeader>
              <TableRow className="bg-muted/30 hover:bg-muted/30">
                <TableHead className="w-[30px] font-semibold">#</TableHead>
                <TableHead className="w-[18%] font-semibold">Leltári Szám</TableHead>
                <TableHead className="w-[35%] font-semibold">Megnevezés</TableHead>
                <TableHead className="w-[70px] font-semibold text-center">Státusz</TableHead>
                <TableHead className="w-[20%] font-semibold">Helyszín</TableHead>
                <TableHead className="w-[15%] font-semibold">Felelős</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((asset, index) => (
                <TableRow
                  key={asset.id}
                  className={cn(
                    'cursor-pointer transition-colors border-l-2',
                    selectedAssetId === asset.id
                      ? 'bg-primary/10 border-l-primary'
                      : 'border-l-transparent hover:bg-muted/20'
                  )}
                  onClick={() => onSelectAsset(asset.id)}
                >
                  <TableCell className="font-mono text-muted-foreground text-xs">{index + 1}.</TableCell>
                  <TableCell className="font-mono text-xs">{asset.inventory_number}</TableCell>
                  <TableCell className="font-medium max-w-[280px] truncate" title={asset.name}>{asset.name}</TableCell>
                  <TableCell className="text-center">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${ASSET_STATUS_COLORS[asset.status]}`}>
                      {ASSET_STATUS_LABELS[asset.status]}
                    </span>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {asset.location ? (
                      <span title={asset.location.address || ''}>
                        {asset.location.name}
                        {asset.location.address && (
                          <span className="block text-xs opacity-75 truncate max-w-[180px]">{asset.location.address}</span>
                        )}
                      </span>
                    ) : '-'}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">{asset.activated_by_name || '-'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
