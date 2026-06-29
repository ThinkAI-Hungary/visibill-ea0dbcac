import React, { useState, useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  BarChart3, ArrowLeft, ChevronRight, Plus, Edit3, Trash2,
  Calculator, Info, Calendar, Tag, Loader2, Download, ExternalLink
} from 'lucide-react';
import TenyImportModal from '@/components/ev/TenyImportModal';
import { cn } from '@/lib/utils';
import { useAccountyClient } from '@/hooks/accounty';
import { formatHuf } from '@/lib/evCalculations';
import { useEvFixedAssets, type EvFixedAsset } from '@/hooks/useEvData';

// ─── Component ──────────────────────────────────────────────────────────────

export default function EvDepreciationPage() {
  const { id } = useParams<{ id: string }>();
  const { data: client } = useAccountyClient(id);
  const [taxYear] = useState(2026);
  const [importOpen, setImportOpen] = useState(false);

  // ─── Real data from Supabase ───────────────────────────────────────────────
  const { data: rawAssets, isLoading } = useEvFixedAssets(id, taxYear);

  const assets = useMemo(() => {
    return (rawAssets || []).map((a: EvFixedAsset) => {
      const depRate = a.depreciation_rate || 0;
      const currentYearDep = a.is_below_threshold
        ? a.acquisition_cost
        : Math.round(a.acquisition_cost * (depRate / 100));
      const netBookValue = a.net_value ?? (a.acquisition_cost - a.accumulated_depreciation);
      return {
        id: a.id,
        name: a.asset_name,
        category: a.notes || 'Egyéb',
        acquisitionDate: a.acquisition_date,
        acquisitionCost: a.acquisition_cost,
        residualValue: 0,
        usefulLifeYears: depRate > 0 ? Math.round(100 / depRate) : 0,
        annualRate: depRate,
        method: 'linear' as const,
        cumulativeDepreciation: a.accumulated_depreciation,
        currentYearDepreciation: currentYearDep,
        netBookValue,
        isLinked: !!a.source_fixed_asset_id,
      };
    });
  }, [rawAssets]);

  const totalAcquisition = assets.reduce((s, a) => s + a.acquisitionCost, 0);
  const totalCurrentYear = assets.reduce((s, a) => s + a.currentYearDepreciation, 0);
  const totalCumulative = assets.reduce((s, a) => s + a.cumulativeDepreciation, 0);
  const totalNetBook = assets.reduce((s, a) => s + a.netBookValue, 0);

  return (
    <div className="w-full space-y-6 animate-in fade-in duration-500">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <Link to="/accounty/ev" className="hover:text-indigo-600 transition-colors flex items-center gap-1">
          <ArrowLeft className="w-3.5 h-3.5" /> EV Portfólió
        </Link>
        <ChevronRight className="w-3 h-3" />
        <Link to={`/accounty/client/${id}/ev`} className="hover:text-indigo-600 transition-colors">
          {client?.name || 'Ügyfél'}
        </Link>
        <ChevronRight className="w-3 h-3" />
        <span className="text-slate-900 dark:text-slate-100 font-medium">Értékcsökkenés</span>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-gradient-to-br from-teal-500 to-cyan-600 rounded-xl shadow-lg shadow-teal-500/25">
            <BarChart3 className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Értékcsökkenési leírás (ÉCS)</h1>
            <p className="text-sm text-slate-500">Szja tv. 11. sz. melléklet – tárgyi eszközök amortizációja</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setImportOpen(true)}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
          >
            <Download className="w-3.5 h-3.5" /> Importálás TÉNY-ből
          </button>
          <button className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors">
            <Plus className="w-3.5 h-3.5" /> Új eszköz
          </button>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-card rounded-xl border border-border p-4 shadow-soft">
          <p className="text-xs text-slate-500 mb-1">Bruttó érték összesen</p>
          <p className="text-lg font-bold text-slate-900 dark:text-slate-100 tabular-nums">{formatHuf(totalAcquisition)}</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-4 shadow-soft">
          <p className="text-xs text-slate-500 mb-1">Tárgyévi ÉCS</p>
          <p className="text-lg font-bold text-teal-600 tabular-nums">{formatHuf(totalCurrentYear)}</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-4 shadow-soft">
          <p className="text-xs text-slate-500 mb-1">Halmozott ÉCS</p>
          <p className="text-lg font-bold text-amber-600 tabular-nums">{formatHuf(totalCumulative)}</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-4 shadow-soft">
          <p className="text-xs text-slate-500 mb-1">Nettó könyv szerinti ért.</p>
          <p className="text-lg font-bold text-green-600 tabular-nums">{formatHuf(totalNetBook)}</p>
        </div>
      </div>

      {/* Assets table */}
      <div className="bg-card rounded-xl border border-border shadow-soft overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-slate-50/50 dark:bg-slate-800/30">
                <th className="text-left py-3 px-4 font-medium text-slate-500 text-xs uppercase tracking-wider">Eszköz</th>
                <th className="text-left py-3 px-4 font-medium text-slate-500 text-xs uppercase tracking-wider">Beszerzés</th>
                <th className="text-right py-3 px-4 font-medium text-slate-500 text-xs uppercase tracking-wider">Bruttó érték</th>
                <th className="text-center py-3 px-4 font-medium text-slate-500 text-xs uppercase tracking-wider">Kulcs</th>
                <th className="text-right py-3 px-4 font-medium text-slate-500 text-xs uppercase tracking-wider">Tárgyévi ÉCS</th>
                <th className="text-right py-3 px-4 font-medium text-slate-500 text-xs uppercase tracking-wider">Halm. ÉCS</th>
                <th className="text-right py-3 px-4 font-medium text-slate-500 text-xs uppercase tracking-wider">Nettó ért.</th>
                <th className="text-center py-3 px-4 font-medium text-slate-500 text-xs uppercase tracking-wider w-20">Műv.</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="py-16 text-center text-sm text-slate-400">
                    <Loader2 className="w-8 h-8 mx-auto mb-3 text-teal-400 animate-spin" />
                    Betöltés...
                  </td>
                </tr>
              ) : assets.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-16 text-center">
                    <BarChart3 className="w-10 h-10 mx-auto mb-3 text-slate-300" />
                    <p className="text-sm text-slate-400 mb-3">Nincs még rögzített tárgyi eszköz</p>
                    <button
                      onClick={() => setImportOpen(true)}
                      className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition-colors"
                    >
                      <Download className="w-3.5 h-3.5" /> Importálás a TÉNY nyilvántartásból
                    </button>
                  </td>
                </tr>
              ) : (
                assets.map(asset => {
                  const depPercentage = asset.acquisitionCost > 0
                    ? (asset.cumulativeDepreciation / asset.acquisitionCost) * 100
                    : 0;
                  return (
                    <tr key={asset.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5">
                          <p className="font-semibold text-slate-900 dark:text-slate-100">{asset.name}</p>
                          {asset.isLinked && (
                            <span className="shrink-0 inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-bold rounded bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 border border-emerald-200 dark:border-emerald-800" title="Importálva a TÉNY nyilvántartásból">
                              TÉNY
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1">
                          <Tag className="w-3 h-3" /> {asset.category}
                        </p>
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-xs font-mono tabular-nums text-slate-600 dark:text-slate-400 flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {new Date(asset.acquisitionDate).toLocaleDateString('hu-HU')}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-700 dark:text-slate-300">
                        {formatHuf(asset.acquisitionCost)}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className="text-xs font-bold text-teal-600 bg-teal-50 dark:bg-teal-900/30 px-2 py-0.5 rounded-full">
                          {asset.annualRate}%
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums text-teal-600 font-medium">
                        {formatHuf(asset.currentYearDepreciation)}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center gap-2 justify-end">
                          <div className="w-12 h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-amber-500 rounded-full"
                              style={{ width: `${Math.min(100, depPercentage)}%` }}
                            />
                          </div>
                          <span className="text-xs font-mono tabular-nums text-slate-600 dark:text-slate-400">
                            {formatHuf(asset.cumulativeDepreciation)}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums text-green-600 font-medium">
                        {formatHuf(asset.netBookValue)}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center gap-1 justify-center">
                          <button className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-slate-400 hover:text-slate-600">
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors text-slate-400 hover:text-red-600">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
            {assets.length > 0 && (
              <tfoot>
                <tr className="border-t-2 border-border bg-slate-50/30 dark:bg-slate-800/20 font-bold">
                  <td className="py-3 px-4 text-slate-900 dark:text-slate-100" colSpan={2}>Összesen</td>
                  <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-900 dark:text-slate-100">{formatHuf(totalAcquisition)}</td>
                  <td className="py-3 px-4" />
                  <td className="py-3 px-4 text-right font-mono tabular-nums text-teal-600">{formatHuf(totalCurrentYear)}</td>
                  <td className="py-3 px-4 text-right font-mono tabular-nums text-amber-600">{formatHuf(totalCumulative)}</td>
                  <td className="py-3 px-4 text-right font-mono tabular-nums text-green-600">{formatHuf(totalNetBook)}</td>
                  <td className="py-3 px-4" />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* Info */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4">
        <div className="flex items-start gap-2">
          <Info className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
          <div className="text-xs text-blue-600 dark:text-blue-400 space-y-1">
            <p className="font-semibold">ÉCS szabályok (Szja tv. 11. sz. melléklet)</p>
            <ul className="list-disc list-inside space-y-0.5">
              <li>Számítástechnikai eszközök: max. 33,3% (3 év)</li>
              <li>Bútorok, berendezések: max. 14,5% (7 év)</li>
              <li>Járművek: max. 20% (5 év)</li>
              <li>Ingatlanok: 2-6% (típustól függően)</li>
              <li>100 ezer Ft alatti eszközök: egyben leírhatók</li>
            </ul>
          </div>
        </div>
      </div>

      {/* TÉNY Import Modal */}
      {id && (
        <TenyImportModal
          isOpen={importOpen}
          onClose={() => setImportOpen(false)}
          companyId={id}
          taxYear={taxYear}
        />
      )}
    </div>
  );
}
