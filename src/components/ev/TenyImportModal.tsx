import React, { useState, useMemo } from 'react';
import { X, Download, Search, Package, Check, AlertTriangle, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatHuf } from '@/lib/evCalculations';
import {
  useTenyAssetsForImport,
  useImportTenyToEcs,
  type TenyImportItem,
} from '@/hooks/useEvData';

// ─── Suggested SZJA depreciation rates by asset category ────────────────────
const SZJA_RATE_SUGGESTIONS: Record<string, number> = {
  'Számítástechnikai': 33.3,
  'Szoftver': 50,
  'Bútor': 14.5,
  'Gépjármű': 20,
  'Ingatlan': 2,
  'Irodai': 14.5,
};

function suggestSzjaRate(name: string, taoRate: number | null): number {
  const lower = name.toLowerCase();
  if (/laptop|pc|számítógép|monitor|webcam|logitech|billentyű|egér|mouse|keyboard|headset/i.test(lower)) return 33.3;
  if (/szoftver|google|workspace|licen[sc]/i.test(lower)) return 50;
  if (/bútor|asztal|szék|polc/i.test(lower)) return 14.5;
  if (/autó|gépjármű|kocsi/i.test(lower)) return 20;
  if (/ingatlan|épület|iroda/i.test(lower)) return 2;
  // Fallback to TAO rate or default 14.5%
  return taoRate ?? 14.5;
}

// ─── Component ──────────────────────────────────────────────────────────────

interface TenyImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  companyId: string;
  taxYear: number;
}

export default function TenyImportModal({ isOpen, onClose, companyId, taxYear }: TenyImportModalProps) {
  const { data: tenyAssets = [], isLoading } = useTenyAssetsForImport(companyId, taxYear);
  const importMutation = useImportTenyToEcs();

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [rateOverrides, setRateOverrides] = useState<Record<string, number>>({});
  const [search, setSearch] = useState('');

  // Filter by search
  const filtered = useMemo(() => {
    if (!search.trim()) return tenyAssets;
    const q = search.toLowerCase();
    return tenyAssets.filter((a: TenyImportItem) =>
      a.name.toLowerCase().includes(q) ||
      a.inventoryNumber?.toLowerCase().includes(q)
    );
  }, [tenyAssets, search]);

  const toggleAll = () => {
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map((a: TenyImportItem) => a.id)));
    }
  };

  const toggleOne = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelectedIds(next);
  };

  const getRate = (asset: TenyImportItem) =>
    rateOverrides[asset.id] ?? suggestSzjaRate(asset.name, asset.taoRatePercent);

  const setRate = (id: string, rate: number) => {
    setRateOverrides(prev => ({ ...prev, [id]: rate }));
  };

  const THRESHOLD = 200_000; // 200 000 Ft alatti eszközök egyben leírhatók

  const [importError, setImportError] = useState<string | null>(null);

  const handleImport = async () => {
    const items = filtered
      .filter((a: TenyImportItem) => selectedIds.has(a.id))
      .map((a: TenyImportItem) => ({
        sourceId: a.id,
        name: a.name,
        acquisitionDate: a.activationDate || a.purchaseDate,
        acquisitionCost: a.acquisitionValue,
        depreciationRate: a.acquisitionValue < THRESHOLD ? 100 : getRate(a),
        isBelowThreshold: a.acquisitionValue < THRESHOLD,
      }));

    if (items.length === 0) return;
    setImportError(null);

    try {
      await importMutation.mutateAsync({
        companyId,
        taxYear,
        items,
      });
      setSelectedIds(new Set());
      onClose();
    } catch (err: any) {
      const msg = err?.message || String(err);
      // If source_fixed_asset_id column doesn't exist yet, retry without it
      if (msg.includes('source_fixed_asset_id') || msg.includes('column')) {
        try {
          await importWithoutLink(items);
          setSelectedIds(new Set());
          onClose();
        } catch (retryErr: any) {
          setImportError(retryErr?.message || 'Ismeretlen hiba az importálás során.');
        }
      } else {
        setImportError(msg);
      }
    }
  };

  // Fallback: import without TÉNY link (if migration not yet run)
  const importWithoutLink = async (items: Array<{
    sourceId: string; name: string; acquisitionDate: string;
    acquisitionCost: number; depreciationRate: number; isBelowThreshold: boolean;
  }>) => {
    const { supabase } = await import('@/integrations/supabase/client');
    const rows = items.map(item => ({
      company_id: companyId,
      tax_year: taxYear,
      asset_name: item.name,
      acquisition_date: item.acquisitionDate,
      acquisition_cost: Math.round(item.acquisitionCost),
      depreciation_rate: item.depreciationRate,
      accumulated_depreciation: 0,
      net_value: Math.round(item.acquisitionCost),
      is_below_threshold: item.isBelowThreshold,
    }));
    const { error } = await supabase
      .from('accounty_ev_records_fixed_assets')
      .insert(rows);
    if (error) throw error;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-card rounded-2xl border border-border shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-teal-500 to-emerald-600 rounded-lg">
              <Download className="w-4 h-4 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Importálás TÉNY-ből</h2>
              <p className="text-xs text-slate-500">Tárgyi eszközök áthúzása az ÉCS nyilvántartásba — {taxYear}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        {/* Search */}
        <div className="px-6 py-3 border-b border-border/50">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Keresés eszköznév vagy leltári szám alapján..."
              className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 dark:bg-slate-800/50 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500/30"
            />
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-3">
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-8 h-8 text-teal-500 animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16">
              <Package className="w-10 h-10 mx-auto mb-3 text-slate-300" />
              <p className="text-sm text-slate-500">
                {tenyAssets.length === 0
                  ? 'Nincs importálható eszköz a TÉNY nyilvántartásban, vagy már mind importálva van.'
                  : 'Nincs a keresésnek megfelelő eszköz.'}
              </p>
            </div>
          ) : (
            <div className="space-y-1">
              {/* Select all */}
              <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-800/30 mb-2">
                <input
                  type="checkbox"
                  checked={selectedIds.size === filtered.length && filtered.length > 0}
                  onChange={toggleAll}
                  className="w-4 h-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                />
                <span className="text-xs font-medium text-slate-500">
                  Összes kiválasztása ({filtered.length} eszköz)
                </span>
              </div>

              {/* Asset rows */}
              {filtered.map((asset: TenyImportItem) => {
                const isSelected = selectedIds.has(asset.id);
                const isBelowThreshold = asset.acquisitionValue < THRESHOLD;
                const rate = getRate(asset);

                return (
                  <div
                    key={asset.id}
                    className={cn(
                      'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors cursor-pointer',
                      isSelected
                        ? 'bg-teal-50 dark:bg-teal-900/20 border border-teal-200 dark:border-teal-800'
                        : 'hover:bg-slate-50 dark:hover:bg-slate-800/30 border border-transparent'
                    )}
                    onClick={() => toggleOne(asset.id)}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleOne(asset.id)}
                      onClick={e => e.stopPropagation()}
                      className="w-4 h-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500 shrink-0"
                    />

                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">
                        {asset.name}
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {asset.inventoryNumber} · {new Date(asset.activationDate || asset.purchaseDate).toLocaleDateString('hu-HU')}
                      </p>
                    </div>

                    <div className="text-right shrink-0 mr-2">
                      <p className="text-sm font-mono tabular-nums text-slate-700 dark:text-slate-300">
                        {formatHuf(asset.acquisitionValue)}
                      </p>
                      {asset.taoRatePercent && (
                        <p className="text-[10px] text-slate-400">TAO: {asset.taoRatePercent}%</p>
                      )}
                    </div>

                    {/* SZJA ÉCS rate input */}
                    <div className="shrink-0 w-20" onClick={e => e.stopPropagation()}>
                      {isBelowThreshold ? (
                        <span className="text-xs text-amber-600 font-medium flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" /> 100%
                        </span>
                      ) : (
                        <div className="relative">
                          <input
                            type="number"
                            value={rate}
                            onChange={e => setRate(asset.id, Number(e.target.value) || 0)}
                            min={0}
                            max={100}
                            step={0.1}
                            className="w-full text-xs border border-border rounded px-2 py-1 bg-card text-right font-mono tabular-nums"
                          />
                          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-slate-400">%</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-border bg-slate-50/50 dark:bg-slate-800/20 rounded-b-2xl">
          <div className="text-xs text-slate-500">
            {importError ? (
              <span className="font-medium text-red-500 flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5" />
                {importError}
              </span>
            ) : selectedIds.size > 0 ? (
              <span className="font-medium text-teal-600">
                <Check className="w-3.5 h-3.5 inline mr-1" />
                {selectedIds.size} eszköz kiválasztva
              </span>
            ) : (
              'Válasszon ki eszközöket az importáláshoz'
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 transition-colors"
            >
              Mégse
            </button>
            <button
              onClick={handleImport}
              disabled={selectedIds.size === 0 || importMutation.isPending}
              className={cn(
                'flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg transition-colors',
                selectedIds.size > 0
                  ? 'bg-teal-600 text-white hover:bg-teal-700'
                  : 'bg-slate-200 text-slate-400 cursor-not-allowed dark:bg-slate-700 dark:text-slate-500'
              )}
            >
              {importMutation.isPending ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Download className="w-3.5 h-3.5" />
              )}
              Importálás ({selectedIds.size})
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
