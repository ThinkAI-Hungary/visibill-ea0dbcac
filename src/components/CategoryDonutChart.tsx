import { useMemo } from 'react';
import { formatCurrencyTotals } from '@/components/CategoryAccordionItem';

interface CategoryStat {
  name: string;
  invoiceCount: number;
  totalAmount: number;
  currencyTotals?: Record<string, number>;
  color: string;
}

interface CategoryDonutChartProps {
  stats: CategoryStat[];
  totalInvoices: number;
  totalAmount: number;
  onSegmentClick?: (index: number) => void;
  activeIndex?: number | null;
}

const CATEGORY_COLORS = [
  'hsl(142, 76%, 36%)',
  'hsl(217, 91%, 60%)',
  'hsl(43, 96%, 56%)',
  'hsl(189, 94%, 43%)',
  'hsl(21, 90%, 48%)',
  'hsl(263, 70%, 50%)',
  'hsl(340, 82%, 52%)',
  'hsl(239, 84%, 67%)',
  'hsl(174, 83%, 32%)',
  'hsl(220, 9%, 46%)',
];

export function getCategoryColor(index: number): string {
  return CATEGORY_COLORS[index % CATEGORY_COLORS.length];
}

export function CategoryDonutChart({
  stats,
  totalInvoices,
  onSegmentClick,
  activeIndex,
}: CategoryDonutChartProps) {
  const radius = 50;
  const circumference = 2 * Math.PI * radius;

  // Use invoiceCount as proportion (works for any currency mix)
  const segments = useMemo(() => {
    if (totalInvoices <= 0) return [];
    let offset = 0;

    return stats
      .filter(s => s.invoiceCount > 0)
      .map((stat) => {
        const pct = stat.invoiceCount / totalInvoices;
        const dashLen = pct * circumference;
        const segment = {
          ...stat,
          index: stats.indexOf(stat),
          dashLen,
          dasharray: `${dashLen} ${circumference - dashLen}`,
          dashoffset: -offset,
          pct: Math.round(pct * 100),
        };
        offset += dashLen;
        return segment;
      });
  }, [stats, totalInvoices, circumference]);

  return (
    <>
      {/* CSS keyframe for draw-in animation */}
      <style>{`
        @keyframes donut-draw {
          from { stroke-dashoffset: var(--donut-full); }
          to   { stroke-dashoffset: var(--donut-offset); }
        }
        .donut-segment {
          animation: donut-draw 0.8s cubic-bezier(0.4, 0, 0.2, 1) both;
        }
      `}</style>

      <div className="flex items-center gap-8 p-6 bg-card border border-border rounded-lg">
        {/* Donut */}
        <div className="relative flex-shrink-0" style={{ width: 130, height: 130 }}>
          <svg viewBox="0 0 120 120" width="130" height="130">
            {/* Background ring */}
            <circle
              cx="60" cy="60" r={radius}
              fill="none"
              stroke="hsl(var(--muted))"
              strokeWidth="14"
            />
            {/* Animated segments */}
            {segments.map((seg, i) => (
              <circle
                key={i}
                cx="60" cy="60" r={radius}
                fill="none"
                stroke={seg.color}
                strokeWidth={activeIndex === seg.index ? 18 : 14}
                strokeDasharray={seg.dasharray}
                className="donut-segment"
                style={{
                  // Draw-in: start fully offset, end at actual dashoffset
                  '--donut-full': `${circumference}`,
                  '--donut-offset': `${seg.dashoffset}`,
                  strokeDashoffset: seg.dashoffset,
                  transform: 'rotate(-90deg)',
                  transformOrigin: '60px 60px',
                  cursor: onSegmentClick ? 'pointer' : 'default',
                  transition: 'stroke-width 0.2s ease, opacity 0.2s ease',
                  opacity:
                    activeIndex !== null && activeIndex !== undefined && activeIndex !== seg.index
                      ? 0.4
                      : 1,
                  animationDelay: `${i * 80}ms`,
                } as React.CSSProperties}
                onClick={() => onSegmentClick?.(seg.index)}
              />
            ))}
          </svg>
          {/* Center text */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-xl font-bold text-foreground">{totalInvoices}</span>
            <span className="text-[10px] text-muted-foreground">számla</span>
          </div>
        </div>

        {/* Legend */}
        <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 flex-1">
          {stats.map((stat, i) => (
            <button
              key={i}
              className={`flex items-center gap-2 text-left text-xs hover:bg-muted/50 rounded px-1.5 py-1 transition-colors ${
                activeIndex === i ? 'bg-primary/10' : ''
              }`}
              onClick={() => onSegmentClick?.(i)}
            >
              <span
                className="w-2.5 h-2.5 rounded-sm flex-shrink-0"
                style={{ backgroundColor: stat.color }}
              />
              <span className={`flex-1 truncate ${stat.invoiceCount === 0 ? 'text-muted-foreground' : 'text-foreground'}`}>
                {stat.name}
              </span>
              <span className="text-muted-foreground tabular-nums text-right shrink-0">
                {(() => {
                  const ct = stat.currencyTotals || {};
                  const hasAny = Object.values(ct).some(v => v > 0);
                  if (!hasAny) return '–';
                  // HUF-only: show % of invoice count
                  if (Object.keys(ct).length === 1 && ct['HUF']) {
                    return `${Math.round((stat.invoiceCount / totalInvoices) * 100)}%`;
                  }
                  // Multi-currency: show formatted amounts
                  return formatCurrencyTotals(ct);
                })()}
              </span>
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
