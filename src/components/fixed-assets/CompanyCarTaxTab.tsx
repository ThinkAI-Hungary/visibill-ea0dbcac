import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Car,
  Plus,
  Receipt,
  Pencil,
  Trash2,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  ShieldCheck,
  TrendingDown,
  Clock,
  Sparkles,
  ExternalLink,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { formatCurrency } from '@/lib/utils';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { Skeleton } from '@/components/ui/skeleton';
import {
  fetchCompanyCars,
  fetchCompanyCarTaxPayments,
  calculateCarQuarterTax,
  deleteCompanyCar,
  getQuarterDueDate,
} from '@/lib/fixed-assets/companyCarTaxService';
import { CreateCompanyCarDialog } from './CreateCompanyCarDialog';
import { RecordVehicleTaxDialog } from './RecordVehicleTaxDialog';
import type { FixedAsset } from '@/types/fixed-assets';
import {
  type CompanyCar,
  type CompanyCarTaxPayment,
  CAR_OWNERSHIP_LABELS,
  ENVIRONMENTAL_CATEGORY_LABELS,
} from '@/types/company-car-tax';

interface CompanyCarTaxTabProps {
  companyId: string;
  assets?: FixedAsset[];
  writable?: boolean;
  onOpenAsset?: (assetId: string) => void;
}

export function CompanyCarTaxTab({
  companyId,
  assets = [],
  writable = true,
  onOpenAsset,
}: CompanyCarTaxTabProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [selectedYear, setSelectedYear] = useState<number>(() => new Date().getFullYear());
  const [selectedQuarter, setSelectedQuarter] = useState<1 | 2 | 3 | 4>(1);

  // Párbeszédablak állapotok
  const [createCarOpen, setCreateCarOpen] = useState(false);
  const [editingCar, setEditingCar] = useState<CompanyCar | null>(null);
  const [vehicleTaxOpen, setVehicleTaxOpen] = useState(false);
  const [selectedCarForTax, setSelectedCarForTax] = useState<CompanyCar | null>(null);

  // Gépjárművek lekérdezése
  const { data: cars = [], isLoading: carsLoading } = useQuery({
    queryKey: ['company_cars', companyId],
    queryFn: () => fetchCompanyCars(companyId),
    enabled: !!companyId,
  });

  // Gépjárműadó befizetések lekérdezése a kiválasztott évre
  const { data: payments = [], isLoading: paymentsLoading } = useQuery({
    queryKey: ['company_car_tax_payments', companyId, selectedYear],
    queryFn: () => fetchCompanyCarTaxPayments(companyId, selectedYear),
    enabled: !!companyId,
  });

  // Törlés mutáció
  const deleteMutation = useMutation({
    mutationFn: (carId: string) => deleteCompanyCar(carId, companyId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company_cars', companyId] });
      toast({ title: 'Gépjármű törölve', description: 'A cégautó sikeresen eltávolítva a nyilvántartásból.' });
    },
    onError: (err: any) => {
      toast({ title: 'Hiba a törlés során', description: err.message, variant: 'destructive' });
    },
  });

  const handleDeleteCar = (car: CompanyCar) => {
    if (window.confirm(`Biztosan törölni szeretné a(z) ${car.license_plate} rendszámú cégautót?`)) {
      deleteMutation.mutate(car.id);
    }
  };

  // Autónkénti negyedéves kalkulációk
  const carCalculations = useMemo(() => {
    return cars.map(car => {
      const carPayments = payments.filter(p => p.car_id === car.id);
      const calc = calculateCarQuarterTax(car, selectedYear, selectedQuarter, carPayments);
      return {
        car,
        calc,
        carPayments,
      };
    });
  }, [cars, payments, selectedYear, selectedQuarter]);

  // Negyedéves összesítők
  const summary = useMemo(() => {
    let grossTotal = 0;
    let deductibleTotal = 0;
    let netTotal = 0;
    let activeCarsCount = 0;
    let exemptCarsCount = 0;

    for (const item of carCalculations) {
      if (item.car.is_tax_exempt || item.car.environmental_category === 'GREEN_ELECTRIC') {
        exemptCarsCount++;
      } else if (item.calc.activeMonthsCount > 0) {
        activeCarsCount++;
      }
      grossTotal += item.calc.grossQuarterlyTax;
      deductibleTotal += item.calc.deductibleVehicleTax;
      netTotal += item.calc.netPayableTax;
    }

    return {
      grossTotal,
      deductibleTotal,
      netTotal,
      activeCarsCount,
      exemptCarsCount,
      dueDate: getQuarterDueDate(selectedYear, selectedQuarter),
    };
  }, [carCalculations, selectedYear, selectedQuarter]);

  if (carsLoading || paymentsLoading) {
    return <CompanyCarTaxSkeleton />;
  }

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Fejléc és Időszak választó */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Car className="h-6 w-6 text-primary" />
            Cégautóadó Modul (Gjt. 17/A. §)
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Negyedéves adókalkuláció, gépjárműadó (súlyadó) levonási automatizmus és NAV tervezet
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Év választó */}
          <Select value={String(selectedYear)} onValueChange={v => setSelectedYear(parseInt(v, 10))}>
            <SelectTrigger className="w-28 h-9 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[2024, 2025, 2026, 2027].map(y => (
                <SelectItem key={y} value={String(y)}>{y}. év</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Negyedév választó fülek */}
          <div className="flex rounded-lg border bg-muted/40 p-1">
            {([1, 2, 3, 4] as const).map(q => (
              <button
                key={q}
                onClick={() => setSelectedQuarter(q)}
                className={`px-3 py-1 text-xs rounded-md font-medium transition-colors ${
                  selectedQuarter === q
                    ? 'bg-background text-foreground shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Q{q}
              </button>
            ))}
          </div>

          {writable && (
            <Button
              size="sm"
              className="gap-1.5 h-9 text-xs"
              onClick={() => {
                setEditingCar(null);
                setCreateCarOpen(true);
              }}
            >
              <Plus className="h-4 w-4" />
              Új cégautó
            </Button>
          )}
        </div>
      </div>

      {/* KPI Kártyák */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl border bg-card/60 backdrop-blur-xs shadow-xs space-y-1">
          <span className="text-xs font-medium text-muted-foreground">Flotta státusz ({selectedYear}. Q{selectedQuarter})</span>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-foreground">{cars.length}</span>
            <span className="text-xs text-muted-foreground">gépjármű</span>
          </div>
          <p className="text-[11px] text-muted-foreground">
            {summary.activeCarsCount} adóköteles, {summary.exemptCarsCount} mentes / zöld
          </p>
        </div>

        <div className="p-4 rounded-xl border bg-card/60 backdrop-blur-xs shadow-xs space-y-1">
          <span className="text-xs font-medium text-muted-foreground">Bruttó cégautóadó</span>
          <div className="text-2xl font-bold text-foreground">
            {formatCurrency(summary.grossTotal, 'HUF')}
          </div>
          <p className="text-[11px] text-muted-foreground">Törvényi havi tételek alapján</p>
        </div>

        <div className="p-4 rounded-xl border bg-card/60 backdrop-blur-xs shadow-xs space-y-1">
          <span className="text-xs font-medium text-muted-foreground">Levonható gépjárműadó (súlyadó)</span>
          <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
            -{formatCurrency(summary.deductibleTotal, 'HUF')}
          </div>
          <p className="text-[11px] text-emerald-700/80 dark:text-emerald-400/80 flex items-center gap-1">
            <CheckCircle2 className="h-3 w-3" /> Időben megfizetve a NAV-nak
          </p>
        </div>

        <div className="p-4 rounded-xl border border-primary/30 bg-primary/5 shadow-xs space-y-1">
          <span className="text-xs font-medium text-primary">Nettó fizetendő cégautóadó</span>
          <div className="text-2xl font-bold text-foreground">
            {formatCurrency(summary.netTotal, 'HUF')}
          </div>
          <p className="text-[11px] text-muted-foreground flex items-center gap-1">
            <Clock className="h-3 w-3 text-primary" /> Határidő: <strong className="text-foreground">{summary.dueDate}</strong>
          </p>
        </div>
      </div>

      {/* Gépjárművek táblázata */}
      {cars.length === 0 ? (
        <div className="p-12 text-center border rounded-xl bg-muted/10 space-y-3">
          <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto">
            <Car className="h-6 w-6" />
          </div>
          <h3 className="text-base font-semibold">Nincs rögzített céges személygépkocsi</h3>
          <p className="text-xs text-muted-foreground max-w-md mx-auto">
            Rögzítse a társaság tulajdonában, bérletében vagy lízingjében álló személygépkocsikat a negyedéves cégautóadó és a súlyadó levonások automatikus elszámolásához.
          </p>
          {writable && (
            <Button
              size="sm"
              className="gap-1.5"
              onClick={() => {
                setEditingCar(null);
                setCreateCarOpen(true);
              }}
            >
              <Plus className="h-4 w-4" />
              Első cégautó rögzítése
            </Button>
          )}
        </div>
      ) : (
        <div className="rounded-xl border overflow-hidden bg-card/60 backdrop-blur-xs shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-muted/50 border-b text-muted-foreground font-medium">
                <tr>
                  <th className="py-3 px-4">Rendszám & Típus</th>
                  <th className="py-3 px-3">Használat / TENY kapcsolat</th>
                  <th className="py-3 px-3">Teljesítmény & Környezetvédelem</th>
                  <th className="py-3 px-3 text-right">Havi adótétel</th>
                  <th className="py-3 px-3 text-center">Aktív hónapok (Q{selectedQuarter})</th>
                  <th className="py-3 px-3 text-right">Bruttó adó</th>
                  <th className="py-3 px-3 text-right">Levont gépjárműadó</th>
                  <th className="py-3 px-3 text-right font-bold text-foreground">Nettó fizetendő</th>
                  <th className="py-3 px-4 text-center">Műveletek</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {carCalculations.map(({ car, calc, carPayments }) => (
                  <tr key={car.id} className="hover:bg-muted/30 transition-colors">
                    {/* Rendszám & Modell */}
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-sm bg-muted px-2 py-0.5 rounded border border-border/80">
                          {car.license_plate}
                        </span>
                        {car.is_tax_exempt && (
                          <span className="text-[10px] bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 px-1.5 py-0.5 rounded font-medium">
                            Mentes
                          </span>
                        )}
                      </div>
                      {car.make_and_model && (
                        <p className="text-[11px] text-muted-foreground mt-0.5">{car.make_and_model}</p>
                      )}
                    </td>

                    {/* Használat & TENY kapcsolat */}
                    <td className="py-3 px-3">
                      <span className="inline-block text-[11px] font-medium text-foreground">
                        {CAR_OWNERSHIP_LABELS[car.ownership_type]}
                      </span>
                      {car.fixed_asset ? (
                        <button
                          type="button"
                          onClick={() => onOpenAsset?.(car.fixed_asset!.id)}
                          className="flex items-center gap-1 text-[11px] text-primary hover:underline mt-0.5 text-left"
                          title="Ugrás a tárgyi eszköz kartonra"
                        >
                          <ExternalLink className="h-3 w-3 shrink-0" />
                          <span>{car.fixed_asset.inventory_number} ({car.fixed_asset.name})</span>
                        </button>
                      ) : (
                        <span className="text-[11px] text-muted-foreground block">Nincs TENY karton</span>
                      )}
                    </td>

                    {/* Teljesítmény & Besorolás */}
                    <td className="py-3 px-3">
                      <div className="font-mono font-semibold">
                        {car.engine_power_kw} kW <span className="text-muted-foreground font-normal">({Math.round(car.engine_power_kw * 1.36)} LE)</span>
                      </div>
                      <p className="text-[11px] text-muted-foreground truncate max-w-[200px]" title={ENVIRONMENTAL_CATEGORY_LABELS[car.environmental_category]}>
                        {ENVIRONMENTAL_CATEGORY_LABELS[car.environmental_category]}
                      </p>
                    </td>

                    {/* Havi adótétel */}
                    <td className="py-3 px-3 text-right tabular-nums">
                      {car.is_tax_exempt || car.environmental_category === 'GREEN_ELECTRIC' ? (
                        <span className="text-muted-foreground font-medium">0 Ft / hó</span>
                      ) : (
                        <span className="font-semibold">{formatCurrency(car.monthly_tax_rate, 'HUF')} / hó</span>
                      )}
                    </td>

                    {/* Aktív hónapok */}
                    <td className="py-3 px-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        {calc.monthsActive.map(m => (
                          <span
                            key={m.month}
                            className={`w-6 h-6 rounded flex items-center justify-center text-[10px] font-bold ${
                              m.isTaxable
                                ? 'bg-primary/20 text-primary border border-primary/30'
                                : 'bg-muted text-muted-foreground opacity-40'
                            }`}
                            title={`${m.monthName}: ${m.isTaxable ? `${formatCurrency(m.monthlyTaxRate, 'HUF')}` : 'Nem adóköteles'}`}
                          >
                            {m.month}
                          </span>
                        ))}
                      </div>
                      <span className="text-[10px] text-muted-foreground mt-0.5 block">
                        {calc.activeMonthsCount} / 3 hónap
                      </span>
                    </td>

                    {/* Bruttó adó */}
                    <td className="py-3 px-3 text-right tabular-nums font-semibold">
                      {formatCurrency(calc.grossQuarterlyTax, 'HUF')}
                    </td>

                    {/* Levont gépjárműadó */}
                    <td className="py-3 px-3 text-right tabular-nums">
                      {calc.deductibleVehicleTax > 0 ? (
                        <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                          -{formatCurrency(calc.deductibleVehicleTax, 'HUF')}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                      {calc.latePaidVehicleTax > 0 && (
                        <span
                          className="text-[10px] text-destructive block"
                          title="Késedelmes fizetés miatt nem vonható le!"
                        >
                          +{formatCurrency(calc.latePaidVehicleTax, 'HUF')} késve
                        </span>
                      )}
                    </td>

                    {/* Nettó fizetendő */}
                    <td className="py-3 px-3 text-right tabular-nums font-bold text-sm text-foreground">
                      {formatCurrency(calc.netPayableTax, 'HUF')}
                    </td>

                    {/* Műveletek */}
                    <td className="py-3 px-4 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
                          title="Gépjárműadó befizetés rögzítése"
                          disabled={!writable}
                          onClick={() => {
                            setSelectedCarForTax(car);
                            setVehicleTaxOpen(true);
                          }}
                        >
                          <Receipt className="h-3.5 w-3.5" />
                        </Button>

                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-foreground"
                          title="Szerkesztés"
                          disabled={!writable}
                          onClick={() => {
                            setEditingCar(car);
                            setCreateCarOpen(true);
                          }}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>

                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive hover:bg-destructive/10"
                          title="Törlés"
                          disabled={!writable || deleteMutation.isPending}
                          onClick={() => handleDeleteCar(car)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Cégautó Létrehozó / Szerkesztő Dialógus */}
      {createCarOpen && (
        <CreateCompanyCarDialog
          open={createCarOpen}
          onOpenChange={setCreateCarOpen}
          companyId={companyId}
          assets={assets}
          editingCar={editingCar}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['company_cars', companyId] });
          }}
        />
      )}

      {/* Gépjárműadó Befizetés Dialógus */}
      {vehicleTaxOpen && selectedCarForTax && (
        <RecordVehicleTaxDialog
          open={vehicleTaxOpen}
          onOpenChange={setVehicleTaxOpen}
          companyId={companyId}
          car={selectedCarForTax}
          initialYear={selectedYear}
          initialQuarter={selectedQuarter}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['company_car_tax_payments', companyId, selectedYear] });
          }}
        />
      )}
    </div>
  );
}

export function CompanyCarTaxSkeleton() {
  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Fejléc placeholder */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Car className="h-6 w-6 text-primary" />
            Cégautóadó Modul (Gjt. 17/A. §)
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Negyedéves adókalkuláció, gépjárműadó (súlyadó) levonási automatizmus és NAV tervezet
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Skeleton className="w-28 h-9 rounded-md" />
          <Skeleton className="w-32 h-9 rounded-md" />
        </div>
      </div>

      {/* Összesítő kártyák placeholder */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Skeleton className="h-28 rounded-xl" />
        <Skeleton className="h-28 rounded-xl" />
        <Skeleton className="h-28 rounded-xl" />
        <Skeleton className="h-28 rounded-xl" />
      </div>

      {/* Táblázat / Tartalom placeholder */}
      <Skeleton className="h-72 w-full rounded-xl" />
    </div>
  );
}
