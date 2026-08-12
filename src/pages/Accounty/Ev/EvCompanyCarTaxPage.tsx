import React, { useMemo } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import {
  Car, ArrowLeft, ChevronRight, Info,
  Plus, Fuel, Tag, Loader2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAccountyClient } from '@/hooks/accounty';
import { formatHuf } from '@/lib/evCalculations';
import { useEvVehicleLog, useEvTaxReturns } from '@/hooks/useEvData';

// ─── Constants ──────────────────────────────────────────────────────────────

const ENGINE_LABELS: Record<string, string> = {
  benzin: 'Benzin', dizel: 'Dízel', hybrid: 'Hibrid', elektromos: 'Elektromos',
  petrol: 'Benzin', diesel: 'Dízel',
};

// ─── Component ──────────────────────────────────────────────────────────────

export default function EvCompanyCarTaxPage() {
  const { companyId, dateRange } = useParams<{ companyId: string; dateRange: string }>();
  const id = companyId;
  const [searchParams] = useSearchParams();
  const taxYear = Number(searchParams.get('year') || '2026');
  const { data: client } = useAccountyClient(id);

  // ─── Real data ────────────────────────────────────────────────────────────
  const { data: vehicleLog, isLoading: logLoading } = useEvVehicleLog(id, taxYear);
  const { data: allReturns, isLoading: returnsLoading } = useEvTaxReturns(id, taxYear);
  const isLoading = logLoading || returnsLoading;

  // Derive unique vehicles from the vehicle log entries
  const vehicles = useMemo(() => {
    const entries = vehicleLog || [];
    const plateMap = new Map<string, {
      plate: string;
      totalKm: number;
      businessKm: number;
      privateKm: number;
      totalFuelCost: number;
      trips: number;
    }>();

    entries.forEach((e: any) => {
      const plate = e.vehicle_plate || 'N/A';
      const existing = plateMap.get(plate) || {
        plate,
        totalKm: 0,
        businessKm: 0,
        privateKm: 0,
        totalFuelCost: 0,
        trips: 0,
      };
      existing.totalKm += e.distance_km || 0;
      if (e.is_business) existing.businessKm += e.distance_km || 0;
      else existing.privateKm += e.distance_km || 0;
      existing.totalFuelCost += e.fuel_cost || 0;
      existing.trips += 1;
      plateMap.set(plate, existing);
    });

    return Array.from(plateMap.values());
  }, [vehicleLog]);

  // Get car tax returns for totals
  const carTaxReturns = useMemo(() => {
    return (allReturns || []).filter((r: any) => r.return_type === 'car');
  }, [allReturns]);

  const totalAnnualTax = carTaxReturns.reduce((s: number, r: any) => s + (r.calculated_tax || 0), 0);
  const quarterlyTax = carTaxReturns.length > 0 ? carTaxReturns[0]?.calculated_tax || 0 : 0;

  return (
    <div className="w-full space-y-6 animate-in fade-in duration-500">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <Link to="/accounty?tab=ev" className="hover:text-indigo-600 transition-colors flex items-center gap-1">
          <ArrowLeft className="w-3.5 h-3.5" /> EV Portfólió
        </Link>
        <ChevronRight className="w-3 h-3" />
        <Link to={`/accounty/${id}/${dateRange}/ev?year=${taxYear}`} className="hover:text-indigo-600 transition-colors">
          {client?.name || 'Ügyfél'}
        </Link>
        <ChevronRight className="w-3 h-3" />
        <span className="text-slate-900 dark:text-slate-100 font-medium">Cégautóadó</span>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-gradient-to-br from-rose-500 to-pink-600 rounded-xl shadow-lg shadow-rose-500/25">
            <Car className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Cégautóadó</h1>
            <p className="text-sm text-slate-500">Gépjárműadóról szóló tv. – cégautóadó kötelezettség</p>
          </div>
        </div>
        <button className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-rose-600 text-white rounded-lg hover:bg-rose-700 transition-colors">
          <Plus className="w-3.5 h-3.5" /> Új jármű
        </button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-card rounded-xl border border-border p-4 shadow-soft">
          <p className="text-xs text-slate-500 mb-1">Járművek száma</p>
          <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{isLoading ? '...' : vehicles.length}</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-4 shadow-soft">
          <p className="text-xs text-slate-500 mb-1">Negyedéves adó</p>
          <p className="text-lg font-bold text-rose-600 tabular-nums">{isLoading ? '...' : formatHuf(quarterlyTax)}</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-4 shadow-soft">
          <p className="text-xs text-slate-500 mb-1">Éves adóteher</p>
          <p className="text-lg font-bold text-rose-600 tabular-nums">{isLoading ? '...' : formatHuf(totalAnnualTax)}</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-4 shadow-soft">
          <p className="text-xs text-slate-500 mb-1">Bevallás</p>
          <p className="text-lg font-bold text-green-600">Negyedéves</p>
        </div>
      </div>

      {/* Vehicle cards */}
      <div className="space-y-4">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400">
            <Loader2 className="w-8 h-8 mb-3 animate-spin text-rose-400" />
            <p className="text-sm">Betöltés...</p>
          </div>
        ) : vehicles.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400">
            <Car className="w-10 h-10 mb-3 opacity-50" />
            <p className="text-sm font-medium">Nincs rögzített jármű az útnyilvántartásban</p>
            <p className="text-xs mt-1">Az útnyilvántartásban rögzített járművek jelennek meg itt.</p>
          </div>
        ) : (
          vehicles.map(vehicle => {
            const usageRatio = vehicle.totalKm > 0 ? vehicle.businessKm / vehicle.totalKm : 0;
            return (
              <div key={vehicle.plate} className="bg-card rounded-xl border border-border shadow-soft overflow-hidden">
                <div className="px-5 py-4 flex items-center justify-between border-b border-border/50">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-rose-100 dark:bg-rose-900/30 flex items-center justify-center">
                      <Car className="w-6 h-6 text-rose-600" />
                    </div>
                    <div>
                      <p className="text-base font-bold text-slate-900 dark:text-slate-100">
                        {vehicle.plate}
                      </p>
                      <div className="flex items-center gap-3 mt-0.5">
                        <span className="text-xs font-mono font-bold text-indigo-600 bg-indigo-50 dark:bg-indigo-900/30 px-2 py-0.5 rounded">
                          {vehicle.plate}
                        </span>
                        <span className="text-xs text-slate-500">
                          {vehicle.trips} útnyilvántartás bejegyzés
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold font-mono tabular-nums text-rose-600">{formatHuf(vehicle.totalFuelCost)}</p>
                    <p className="text-xs text-slate-400">üzemanyagköltség</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-5">
                  <div>
                    <p className="text-[11px] text-slate-500 uppercase tracking-wider font-medium mb-1">Összes km</p>
                    <p className="text-sm font-medium text-slate-900 dark:text-slate-100 font-mono">{vehicle.totalKm.toLocaleString('hu-HU')} km</p>
                  </div>
                  <div>
                    <p className="text-[11px] text-slate-500 uppercase tracking-wider font-medium mb-1">Üzleti km</p>
                    <p className="text-sm font-medium text-slate-900 dark:text-slate-100 font-mono">{vehicle.businessKm.toLocaleString('hu-HU')} km</p>
                  </div>
                  <div>
                    <p className="text-[11px] text-slate-500 uppercase tracking-wider font-medium mb-1">Üzleti használat</p>
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                        <div className="h-full bg-rose-500 rounded-full" style={{ width: `${usageRatio * 100}%` }} />
                      </div>
                      <span className="text-sm font-medium text-slate-900 dark:text-slate-100">{(usageRatio * 100).toFixed(0)}%</span>
                    </div>
                  </div>
                  <div>
                    <p className="text-[11px] text-slate-500 uppercase tracking-wider font-medium mb-1">Magán km</p>
                    <p className="text-sm font-medium text-slate-900 dark:text-slate-100 font-mono">{vehicle.privateKm.toLocaleString('hu-HU')} km</p>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Info */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4">
        <div className="flex items-start gap-2">
          <Info className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
          <div className="text-xs text-blue-600 dark:text-blue-400 space-y-1">
            <p className="font-semibold">Cégautóadó szabályok</p>
            <ul className="list-disc list-inside space-y-0.5">
              <li>Kw és környezetvédelmi osztály alapján fix havi összeg</li>
              <li>Negyedéves bevallás és befizetés</li>
              <li>Elektromos járművek: adómentes</li>
              <li>Ha az EV költségei közt szerepel jármű költség (≥ havi 1 alkalom)</li>
              <li>Útnyilvántartás vezetése csökkenti a magánhasználati arányt</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
