import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { CAT, fmt } from '@/lib/kintlevo-helpers';
import type { AgingCategory, UnifiedInvoice, CompanyGroup } from '@/lib/kintlevo-helpers';
import { ToggleLeft, ToggleRight } from 'lucide-react';

interface Props {
  totals: Record<AgingCategory, number>;
  grandTotal: number;
  netTotals: Record<AgingCategory, number>;
  netGrandTotal: number;
  companyGroups: CompanyGroup[];
  allInvoices: UnifiedInvoice[];
  showBrutto: boolean;
  onToggleBrutto: () => void;
}

export function KintlevoSummaryCards({ totals, grandTotal, netTotals, netGrandTotal, companyGroups, allInvoices, showBrutto, onToggleBrutto }: Props) {
  const displayTotals = showBrutto ? totals : netTotals;
  const displayGrand = showBrutto ? grandTotal : netGrandTotal;

  return (
    <div className="space-y-2">
      {/* Bruttó / Nettó toggle */}
      <div className="flex items-center justify-end">
        <Button
          variant="outline"
          size="sm"
          className="gap-2 text-xs"
          onClick={onToggleBrutto}
        >
          {showBrutto ? <ToggleRight className="h-4 w-4" /> : <ToggleLeft className="h-4 w-4" />}
          {showBrutto ? 'Bruttó' : 'Nettó'}
        </Button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <Card className="col-span-2 lg:col-span-1">
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground uppercase tracking-wide mb-0.5">
              Összes kintlévőség ({showBrutto ? 'bruttó' : 'nettó'})
            </p>
            <p className="text-xl font-bold">{fmt(displayGrand)}</p>
            <p className="text-xs text-muted-foreground">{companyGroups.length} cég · {allInvoices.length} számla</p>
          </CardContent>
        </Card>
        {(Object.keys(CAT) as AgingCategory[]).map(cat => {
          const c = CAT[cat];
          const Icon = c.icon;
          const invCount = allInvoices.filter(i => i.category === cat).length;
          return (
            <Card key={cat} className={cn('border', c.card)}>
              <CardContent className="pt-4 pb-3">
                <div className="flex items-center gap-1.5 mb-0.5">
                  <Icon className={cn('h-3.5 w-3.5', c.text)} />
                  <p className={cn('text-xs font-medium uppercase tracking-wide', c.text)}>{c.label}</p>
                </div>
                <p className={cn('text-xl font-bold', c.text)}>{fmt(displayTotals[cat])}</p>
                <p className="text-xs text-muted-foreground">{invCount} számla</p>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
