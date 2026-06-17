import { useMemo } from 'react';

interface CategoryStat {
  name: string;
  invoiceCount: number;
  totalAmount: number;
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
  'hsl(142, 76%, 36%)',   // green
  'hsl(217, 91%, 60%)',   // blue
  'hsl(43, 96%, 56%)',    // amber
  'hsl(189, 94%, 43%)',   // cyan
  'hsl(21, 90%, 48%)',    // orange
  'hsl(263, 70%, 50%)',   // purple
  'hsl(340, 82%, 52%)',   // rose
  'hsl(239, 84%, 67%)',   // indigo
  'hsl(174, 83%, 32%)',   // primary teal
  'hsl(220, 9%, 46%)',    // slate
];

export function getCategoryColor(index: number): string {
  return CATEGORY_COLORS[index % CATEGORY_COLORS.length];
}

export function CategoryDonutChart({
  stats,
  totalInvoices,
  totalAmount,
  onSegmentClick,
  activeIndex
}: CategoryDonutChartProps) {
  const segments = useMemo(() => {
    if (totalAmount <= 0) return [];
    const radius = 50;
    const circumference = 2 * Math.PI * radius;
    let offset = 0;
    
    return stats
      .filter(s => s.totalAmount > 0)
      .map((stat, i) => {
        const pct = stat.totalAmount / totalAmount;
        const dashLen = pct * circumference;
        const segment = {
          ...stat,
          index: stats.indexOf(stat),
          dasharray: `${dashLen} ${circumference - dashLen}`,
          dashoffset: -offset,
          pct: Math.round(pct * 100),
        };
        offset += dashLen;
        return segment;
      });
  }, [stats, totalAmount]);

  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat('hu-HU').format(amount) + ' Ft';
  };

  return (
    <div className="flex items-center gap-8 p-6 bg-card border border-border rounded-lg">
      {/* Donut */}
      <div className="relative flex-shrink-0" style={{ width: 130, height: 130 }}>
        <svg viewBox="0 0 120 120" width="130" height="130">
          {/* Background ring */}
          <circle
            cx="60" cy="60" r="50"
            fill="none"
            stroke="hsl(var(--muted))"
            strokeWidth="14"
          />
          {/* Segments */}
          {segments.map((seg, i) => (
            <circle
              key={i}
              cx="60" cy="60" r="50"
              fill="none"
              stroke={seg.color}
              strokeWidth={activeIndex === seg.index ? 18 : 14}
              strokeDasharray={seg.dasharray}
              strokeDashoffset={seg.dashoffset}
              style={{
                transform: 'rotate(-90deg)',
                transformOrigin: '60px 60px',
                cursor: onSegmentClick ? 'pointer' : 'default',
                transition: 'stroke-width 0.2s ease',
                opacity: activeIndex !== null && activeIndex !== undefined && activeIndex !== seg.index ? 0.4 : 1,
              }}
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
            <span className="text-muted-foreground tabular-nums">
              {stat.totalAmount > 0 ? `${Math.round((stat.totalAmount / totalAmount) * 100)}%` : '–'}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
