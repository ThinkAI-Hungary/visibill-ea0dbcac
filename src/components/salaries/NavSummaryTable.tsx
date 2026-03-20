import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/lib/utils';
import { Edit, Building2 } from 'lucide-react';
import { getStatusBadge, formatPaymentDate } from '@/lib/salary-helpers';
import type { SalaryItem } from '@/lib/salary-helpers';

interface Props {
  navItems: SalaryItem[];
  onEdit: (item: SalaryItem) => void;
}

export function NavSummaryTable({ navItems, onEdit }: Props) {
  if (navItems.length === 0) return null;

  return (
    <Card className="rounded-xl border-border/50 bg-card/50 backdrop-blur-sm">
      <CardContent className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <Building2 className="h-5 w-5 text-amber-500" />
          <h2 className="text-lg font-semibold">Havi bérösszesítő (NAV utalások)</h2>
        </div>

        <div className="rounded-lg border border-border/50 overflow-hidden">
          <div className="grid grid-cols-[1fr_120px_140px_140px_40px] items-center bg-muted/30 px-4 py-2.5">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Megnevezés</span>
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground text-center">Státusz</span>
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground text-center">Kifizetés ideje</span>
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground text-right">Összeg</span>
            <span />
          </div>
          {navItems.map(item => {
            const statusBadge = getStatusBadge(item);
            return (
              <div
                key={item.id}
                className="grid grid-cols-[1fr_120px_140px_140px_40px] items-center px-4 py-3 border-t border-border/30 hover:bg-muted/40 transition-colors"
              >
                <span className="font-medium">{item.név}</span>
                <div className="text-center">
                  <Badge variant="outline" className={`text-xs ${statusBadge.className}`}>
                    {statusBadge.label}
                  </Badge>
                </div>
                <span className="font-mono text-sm tabular-nums text-muted-foreground text-center">
                  {formatPaymentDate(item.kifizetes_ideje)}
                </span>
                <span className="font-mono font-semibold tabular-nums text-right">
                  {formatCurrency(item.összeg)}
                </span>
                <div className="flex justify-end">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 hover:bg-primary/10 hover:text-primary"
                    onClick={() => onEdit(item)}
                  >
                    <Edit className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            );
          })}
          <div className="grid grid-cols-[1fr_120px_140px_140px_40px] items-center px-4 py-3 bg-muted/20 border-t-2 border-border/60">
            <span className="font-semibold text-muted-foreground text-sm">NAV utalások összesen</span>
            <span />
            <span />
            <span className="font-mono font-bold tabular-nums text-right">
              {formatCurrency(navItems.reduce((sum, item) => sum + Number(item.összeg), 0))}
            </span>
            <span />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
