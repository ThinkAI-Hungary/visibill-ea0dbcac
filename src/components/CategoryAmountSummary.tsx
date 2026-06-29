import { formatCurrencyTotals } from '@/components/CategoryAccordionItem';

interface CategoryAmountStat {
  name: string;
  invoiceCount: number;
  totalAmount: number;
  currencyTotals?: Record<string, number>;
  color: string;
}

interface CategoryAmountSummaryProps {
  stats: CategoryAmountStat[];
}

export function CategoryAmountSummary({ stats }: CategoryAmountSummaryProps) {
  // Find max HUF-equivalent for bar scaling
  const maxAmount = Math.max(...stats.map(s => s.totalAmount), 1);

  // Filter to categories that have at least one invoice
  const activeStats = stats.filter(s => s.invoiceCount > 0);

  if (activeStats.length === 0) return null;

  return (
    <div className="p-5 bg-card border border-border rounded-lg">
      <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">
        Összeg kategóriánként
      </h3>
      <div className="space-y-2.5">
        {activeStats
          .sort((a, b) => b.totalAmount - a.totalAmount)
          .map((stat, i) => {
            const ct = stat.currencyTotals || {};
            const amountLabel = formatCurrencyTotals(ct);
            const barPct = maxAmount > 0 ? Math.max((stat.totalAmount / maxAmount) * 100, 2) : 0;

            return (
              <div key={i} className="flex items-center gap-3">
                {/* Color dot + name */}
                <div className="flex items-center gap-2 w-[140px] flex-shrink-0 min-w-0">
                  <span
                    className="w-2.5 h-2.5 rounded-sm flex-shrink-0"
                    style={{ backgroundColor: stat.color }}
                  />
                  <span className="text-xs text-foreground truncate">{stat.name}</span>
                </div>

                {/* Bar */}
                <div className="flex-1 h-5 bg-muted/50 rounded overflow-hidden relative">
                  <div
                    className="h-full rounded transition-all duration-500"
                    style={{
                      width: `${barPct}%`,
                      backgroundColor: stat.color,
                      opacity: 0.7,
                    }}
                  />
                </div>

                {/* Amount label */}
                <span className="text-xs font-semibold tabular-nums text-right w-[180px] flex-shrink-0 truncate" title={amountLabel}>
                  {amountLabel}
                </span>
              </div>
            );
          })}
      </div>
    </div>
  );
}
