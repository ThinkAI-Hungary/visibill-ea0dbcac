import { useMemo, useState } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/lib/utils';
import { TableProperties, Download, TrendingUp, Scale } from 'lucide-react';
import type { FixedAsset } from '@/types/fixed-assets';

export interface AssetYearlyMovementRow {
  year: number;
  openingGross: number;
  acquisitions: number; // növekedés
  disposals: number;    // csökkenés
  closingGross: number;
  openingDepr: number;
  currentDeprSztv: number;
  currentDeprTao: number;
  closingDeprSztv: number;
  closingNetSztv: number;
  closingNetTao: number;
  taoDifference: number; // Sztv ÉCS - Tao ÉCS (társasági adóalap korrekció)
}

interface MultiYearMovementTableProps {
  /** Ha meg van adva, egyedi eszköz karton vetület */
  asset?: FixedAsset;
  /** Ha meg van adva, vállalati szintű összesített vetület */
  assets?: FixedAsset[];
  startYear?: number;
  endYear?: number;
}

export function MultiYearMovementTable({
  asset,
  assets,
  startYear,
  endYear,
}: MultiYearMovementTableProps) {
  const [showTaoComparison, setShowTaoComparison] = useState(true);
  const [currentYear] = useState(() => new Date().getFullYear());

  // ── 1. EGYEDI ESZKÖZ TÖBBÉVES VETÜLETE ──
  const singleAssetRows = useMemo<AssetYearlyMovementRow[]>(() => {
    if (!asset) return [];

    const gross = Number(asset.acquisition_value || 0);
    const residual = Number(asset.residual_value || 0);
    const depreciableAmount = Math.max(0, gross - residual);

    const actDateStr = asset.activation_date || asset.purchase_date || asset.acquisition_date;
    const actYear = actDateStr ? new Date(actDateStr).getFullYear() : currentYear;

    const derivedRate = Number(asset.annual_depreciation_rate || (asset.useful_life_months > 0 ? (12 / asset.useful_life_months) * 100 : 20));
    const sztvRate = derivedRate / 100;
    const taoRate = Number(asset.tao_template?.tao_rate_percent || derivedRate) / 100;

    const yearlySztvDepr = sztvRate > 0 ? depreciableAmount * sztvRate : 0;
    const yearlyTaoDepr = taoRate > 0 ? depreciableAmount * taoRate : 0;

    const maxYears = Math.min(15, Math.max(5, sztvRate > 0 ? Math.ceil(1 / sztvRate) + 1 : 5));
    const rows: AssetYearlyMovementRow[] = [];

    let currentSztvDeprAccum = 0;
    let currentTaoDeprAccum = 0;

    for (let i = 0; i < maxYears; i++) {
      const year = actYear + i;

      // Ha már elérte a maradványértéket, nem számolunk tovább
      if (currentSztvDeprAccum >= depreciableAmount && currentTaoDeprAccum >= depreciableAmount && i > 0) {
        break;
      }

      const openingGross = i === 0 ? 0 : gross;
      const acquisitions = i === 0 ? gross : 0;
      const disposals = 0;
      const closingGross = gross;

      const openingDepr = currentSztvDeprAccum;

      // Sztv tárgyévi leírás
      const remainingDepreciableSztv = Math.max(0, depreciableAmount - currentSztvDeprAccum);
      const sztvDepr = Math.min(yearlySztvDepr, remainingDepreciableSztv);
      currentSztvDeprAccum += sztvDepr;

      // Tao tárgyévi leírás
      const remainingDepreciableTao = Math.max(0, depreciableAmount - currentTaoDeprAccum);
      const taoDepr = Math.min(yearlyTaoDepr, remainingDepreciableTao);
      currentTaoDeprAccum += taoDepr;

      const closingNetSztv = Math.max(residual, gross - currentSztvDeprAccum);
      const closingNetTao = Math.max(residual, gross - currentTaoDeprAccum);

      rows.push({
        year,
        openingGross,
        acquisitions,
        disposals,
        closingGross,
        openingDepr,
        currentDeprSztv: Math.round(sztvDepr),
        currentDeprTao: Math.round(taoDepr),
        closingDeprSztv: Math.round(currentSztvDeprAccum),
        closingNetSztv: Math.round(closingNetSztv),
        closingNetTao: Math.round(closingNetTao),
        taoDifference: Math.round(sztvDepr - taoDepr),
      });

      if (closingNetSztv <= residual && closingNetTao <= residual) {
        break;
      }
    }

    return rows;
  }, [asset, currentYear]);

  // ── 2. VÁLLALATI SZINTŰ ÖSSZESÍTETT VETÜLET (elmúlt 5 év + tárgyév) ──
  const companyAggregateRows = useMemo<AssetYearlyMovementRow[]>(() => {
    if (!assets || assets.length === 0) return [];

    const years = [
      currentYear - 4,
      currentYear - 3,
      currentYear - 2,
      currentYear - 1,
      currentYear,
    ];

    return years.map((year) => {
      let openingGross = 0;
      let acquisitions = 0;
      let disposals = 0;
      let closingGross = 0;
      let openingDepr = 0;
      let currentDeprSztv = 0;
      let currentDeprTao = 0;
      let closingDeprSztv = 0;
      let closingNetSztv = 0;
      let closingNetTao = 0;

      assets.forEach((a) => {
        const gross = Number(a.acquisition_value || 0);
        const actDateStr = a.activation_date || a.purchase_date || a.acquisition_date;
        const actYear = actDateStr ? new Date(actDateStr).getFullYear() : currentYear;

        const derivedRate = Number(a.annual_depreciation_rate || (a.useful_life_months > 0 ? (12 / a.useful_life_months) * 100 : 20));
        const sztvRate = derivedRate / 100;
        const taoRate = Number(a.tao_template?.tao_rate_percent || derivedRate) / 100;

        if (actYear === year) {
          acquisitions += gross;
        } else if (actYear < year) {
          openingGross += gross;
        }

        if (actYear <= year) {
          closingGross += gross;
          const yearsInService = year - actYear;
          const yearDeprSztv = Math.min(gross, gross * sztvRate);
          const yearDeprTao = Math.min(gross, gross * taoRate);

          if (yearsInService > 0) {
            openingDepr += Math.min(gross, (yearsInService - 1) * yearDeprSztv);
          }

          currentDeprSztv += yearDeprSztv;
          currentDeprTao += yearDeprTao;

          const totalDeprToDate = Math.min(gross, yearsInService * yearDeprSztv);
          closingDeprSztv += totalDeprToDate;
          closingNetSztv += Math.max(0, gross - totalDeprToDate);
          closingNetTao += Math.max(0, gross - Math.min(gross, yearsInService * yearDeprTao));
        }
      });

      return {
        year,
        openingGross: Math.round(openingGross),
        acquisitions: Math.round(acquisitions),
        disposals: Math.round(disposals),
        closingGross: Math.round(closingGross),
        openingDepr: Math.round(openingDepr),
        currentDeprSztv: Math.round(currentDeprSztv),
        currentDeprTao: Math.round(currentDeprTao),
        closingDeprSztv: Math.round(closingDeprSztv),
        closingNetSztv: Math.round(closingNetSztv),
        closingNetTao: Math.round(closingNetTao),
        taoDifference: Math.round(currentDeprSztv - currentDeprTao),
      };
    });
  }, [assets, currentYear]);

  const displayRows = asset ? singleAssetRows : companyAggregateRows;

  if (displayRows.length === 0) {
    return (
      <div className="p-6 text-center text-xs text-muted-foreground border rounded-lg">
        Nincsenek megjeleníthető többéves mozgástábla adatok.
      </div>
    );
  }

  return (
    <Card className="shadow-sm border-border">
      <CardHeader className="py-3 px-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <TableProperties className="h-4 w-4 text-primary" />
              {asset ? `Többéves Amortizációs Mozgástábla — ${asset.inventory_number}` : 'Vállalati Többéves Tárgyieszköz Mozgástábla'}
            </CardTitle>
            <CardDescription className="text-xs">
              {asset
                ? `Aktiválástól a leírásig tartó analitikus bruttó, nettó és Tao szerinti adóalap korrekció (ÉCS kulcs: ${asset.annual_depreciation_rate ?? (asset.useful_life_months > 0 ? Math.round((12 / asset.useful_life_months) * 100) : 20)}% Sztv / ${asset.tao_template?.tao_rate_percent || asset.annual_depreciation_rate || 20}% Tao)`
                : 'Bruttó eszközérték, évi beruházások, terv szerinti ÉCS elszámolások és könyv szerinti záró nettó vagyon.'}
            </CardDescription>
          </div>

          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant={showTaoComparison ? 'default' : 'outline'}
              onClick={() => setShowTaoComparison(!showTaoComparison)}
              className="h-7 text-xs gap-1.5"
            >
              <Scale className="h-3 w-3" />
              Tao ÉCS összehasonlítás
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-0 overflow-hidden">
        <Table containerClassName="w-full overflow-x-auto">
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-muted/40 text-xs">
              <TableHead className="font-bold w-12 text-center px-2 py-2.5 whitespace-nowrap text-[11px]">Év</TableHead>
              <TableHead className="text-right px-2 py-2.5 whitespace-nowrap text-[11px]">Bruttó Nyitó</TableHead>
              <TableHead className="text-right text-emerald-600 font-semibold px-2 py-2.5 whitespace-nowrap text-[11px]">Növekedés (+)</TableHead>
              <TableHead className="text-right text-rose-600 font-semibold px-2 py-2.5 whitespace-nowrap text-[11px]">Csökkenés (-)</TableHead>
              <TableHead className="text-right font-bold px-2 py-2.5 whitespace-nowrap text-[11px]">Bruttó Záró</TableHead>
              <TableHead className="text-right px-2 py-2.5 whitespace-nowrap text-[11px]">Tárgyévi Sztv ÉCS</TableHead>
              {showTaoComparison && (
                <TableHead className="text-right text-primary font-semibold px-2 py-2.5 whitespace-nowrap text-[11px]">Tárgyévi Tao ÉCS</TableHead>
              )}
              {showTaoComparison && (
                <TableHead className="text-right text-amber-600 font-semibold px-2 py-2.5 whitespace-nowrap text-[11px]">Tao Különbözet</TableHead>
              )}
              <TableHead className="text-right px-2 py-2.5 whitespace-nowrap text-[11px]">Halmozott ÉCS</TableHead>
              <TableHead className="text-right font-bold text-foreground px-2 py-2.5 whitespace-nowrap text-[11px]">Záró Nettó (Sztv)</TableHead>
              {showTaoComparison && (
                <TableHead className="text-right font-bold text-primary px-2 py-2.5 whitespace-nowrap text-[11px]">Záró Nettó (Tao)</TableHead>
              )}
            </TableRow>
          </TableHeader>
          <TableBody className="text-xs font-mono">
            {displayRows.map((row) => {
              const isCurrent = row.year === currentYear;
              return (
                <TableRow
                  key={row.year}
                  className={isCurrent ? 'bg-primary/5 font-semibold' : ''}
                >
                  <TableCell className="text-center font-bold font-sans px-2 py-2 whitespace-nowrap">
                    {row.year} {isCurrent ? '⭐' : ''}
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground px-2 py-2 whitespace-nowrap">
                    {formatCurrency(row.openingGross, 'HUF')}
                  </TableCell>
                  <TableCell className="text-right text-emerald-600 px-2 py-2 whitespace-nowrap">
                    {row.acquisitions > 0 ? `+${formatCurrency(row.acquisitions, 'HUF')}` : '-'}
                  </TableCell>
                  <TableCell className="text-right text-rose-600 px-2 py-2 whitespace-nowrap">
                    {row.disposals > 0 ? `-${formatCurrency(row.disposals, 'HUF')}` : '-'}
                  </TableCell>
                  <TableCell className="text-right font-bold text-foreground px-2 py-2 whitespace-nowrap">
                    {formatCurrency(row.closingGross, 'HUF')}
                  </TableCell>
                  <TableCell className="text-right text-foreground px-2 py-2 whitespace-nowrap">
                    {formatCurrency(row.currentDeprSztv, 'HUF')}
                  </TableCell>
                  {showTaoComparison && (
                    <TableCell className="text-right text-primary px-2 py-2 whitespace-nowrap">
                      {formatCurrency(row.currentDeprTao, 'HUF')}
                    </TableCell>
                  )}
                  {showTaoComparison && (
                    <TableCell
                      className={`text-right font-semibold px-2 py-2 whitespace-nowrap ${
                        row.taoDifference > 0
                          ? 'text-amber-600'
                          : row.taoDifference < 0
                          ? 'text-indigo-600'
                          : 'text-muted-foreground'
                      }`}
                    >
                      {row.taoDifference !== 0
                        ? `${row.taoDifference > 0 ? '+' : ''}${formatCurrency(row.taoDifference, 'HUF')}`
                        : '0 Ft'}
                    </TableCell>
                  )}
                  <TableCell className="text-right text-muted-foreground px-2 py-2 whitespace-nowrap">
                    {formatCurrency(row.closingDeprSztv, 'HUF')}
                  </TableCell>
                  <TableCell className="text-right font-bold text-foreground font-sans px-2 py-2 whitespace-nowrap">
                    {formatCurrency(row.closingNetSztv, 'HUF')}
                  </TableCell>
                  {showTaoComparison && (
                    <TableCell className="text-right font-bold text-primary font-sans px-2 py-2 whitespace-nowrap">
                      {formatCurrency(row.closingNetTao, 'HUF')}
                    </TableCell>
                  )}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
