import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import { getAvatarColor, getInitials } from '@/lib/helpers';
import { Skeleton } from '@/components/ui/skeleton';
import { useTheme } from '@/contexts/ThemeContext';

// ── Color palette for treemap cells (light + dark mode aware) ──
const TREEMAP_COLORS = [
  { bg: 'rgba(59,130,246,0.18)',  textLight: '#2563eb', textDark: '#93c5fd' },
  { bg: 'rgba(168,85,247,0.15)',  textLight: '#7c3aed', textDark: '#c4b5fd' },
  { bg: 'rgba(236,72,153,0.15)',  textLight: '#db2777', textDark: '#f9a8d4' },
  { bg: 'rgba(245,158,11,0.14)',  textLight: '#b45309', textDark: '#fcd34d' },
  { bg: 'rgba(20,184,166,0.14)',  textLight: '#0d9488', textDark: '#5eead4' },
  { bg: 'rgba(99,102,241,0.14)',  textLight: '#4f46e5', textDark: '#a5b4fc' },
  { bg: 'rgba(249,115,22,0.12)',  textLight: '#c2410c', textDark: '#fdba74' },
  { bg: 'rgba(244,63,94,0.10)',   textLight: '#e11d48', textDark: '#fda4af' },
  { bg: 'rgba(6,182,212,0.10)',   textLight: '#0891b2', textDark: '#67e8f9' },
  { bg: 'rgba(148,163,184,0.08)', textLight: '#475569', textDark: '#94a3b8' },
];

export interface RankedPartner {
  tax_number: string;
  name: string;
  invoice_count: number;
  total_gross: number;
  custom_color?: string | null;
  custom_bg_color?: string | null;
  custom_monogram?: string | null;
}

interface PartnerRankingCardProps {
  title: string;
  type: 'supplier' | 'customer';
  data: RankedPartner[];
  totalAll: number;
  isLoading: boolean;
  onPartnerClick?: (taxNumber: string) => void;
}

/** Format number as compact Hungarian: 4.2M, 850E, 12 */
function formatCompact(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return (value / 1_000_000).toFixed(1).replace('.0', '') + 'M';
  if (abs >= 1_000) return (value / 1_000).toFixed(0) + 'E';
  return Math.round(value).toString();
}

export function PartnerRankingCard({ title, type, data, totalAll, isLoading, onPartnerClick }: PartnerRankingCardProps) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const isSupplier = type === 'supplier';
  const accentColor = isSupplier ? '#60a5fa' : '#34d399';
  const barGradient = isSupplier
    ? 'linear-gradient(90deg, #3b82f6, #60a5fa)'
    : 'linear-gradient(90deg, #10b981, #34d399)';

  const maxGross = data[0]?.total_gross || 1;
  const top10Total = useMemo(() => data.reduce((s, d) => s + d.total_gross, 0), [data]);
  const top3Total = useMemo(() => data.slice(0, 3).reduce((s, d) => s + d.total_gross, 0), [data]);
  const top10Pct = totalAll > 0 ? ((top10Total / totalAll) * 100).toFixed(1) : '0';
  const top3Pct = totalAll > 0 ? ((top3Total / totalAll) * 100).toFixed(1) : '0';

  // ── Treemap grid layout calculation ──
  const treemapRows = useMemo(() => {
    if (data.length === 0) return [];
    // Split into rows of 3
    const rows: RankedPartner[][] = [];
    for (let i = 0; i < data.length; i += 3) {
      rows.push(data.slice(i, i + 3));
    }
    return rows;
  }, [data]);

  if (isLoading) {
    return (
      <div className="rounded-xl border border-border/50 bg-card/50 backdrop-blur-sm p-5 space-y-3">
        <div className="flex items-center justify-between">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-5 w-16" />
        </div>
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center gap-2">
            <Skeleton className="h-6 w-6 rounded-full" />
            <Skeleton className="h-4 flex-1" />
          </div>
        ))}
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="rounded-xl border border-border/50 bg-card/50 backdrop-blur-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold">{title}</h3>
          <span className={cn(
            "text-[10px] font-semibold px-2 py-0.5 rounded-md border",
            isSupplier
              ? "bg-blue-500/10 text-blue-400 border-blue-500/20"
              : "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
          )}>
            {isSupplier ? 'Szállítók' : 'Vevők'}
          </span>
        </div>
        <p className="text-xs text-muted-foreground text-center py-8">Nincs adat</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border/50 bg-card/50 backdrop-blur-sm p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-3.5">
        <h3 className="text-sm font-semibold">{title}</h3>
        <span className={cn(
          "text-[10px] font-semibold px-2 py-0.5 rounded-md border",
          isSupplier
            ? "bg-blue-500/10 text-blue-400 border-blue-500/20"
            : "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
        )}>
          {isSupplier ? 'Szállítók' : 'Vevők'}
        </span>
      </div>

      {/* Ranking list */}
      <div className="flex flex-col gap-1">
        {data.map((partner, idx) => {
          const barWidth = maxGross > 0 ? Math.max(4, (partner.total_gross / maxGross) * 100) : 4;
          const avatarBg = partner.custom_bg_color || (partner.custom_color ? partner.custom_color + '20' : undefined);
          const avatarText = partner.custom_color || undefined;

          return (
            <div
              key={partner.tax_number}
              className="flex items-center gap-2 py-1 cursor-pointer hover:bg-accent/20 rounded-md px-1 -mx-1 transition-colors"
              onClick={() => onPartnerClick?.(partner.tax_number)}
            >
              <span className={cn(
                "w-5 text-[11px] font-bold text-right shrink-0 tabular-nums",
                idx < 3 ? "text-primary" : "text-muted-foreground/40"
              )}>
                {idx + 1}.
              </span>

              {/* Avatar */}
              <div
                className={cn(
                  "w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-semibold shrink-0",
                  !avatarBg && getAvatarColor(partner.name)
                )}
                style={avatarBg ? { backgroundColor: avatarBg, color: avatarText } : undefined}
              >
                {partner.custom_monogram || getInitials(partner.name)}
              </div>

              {/* Name + count */}
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-semibold truncate">{partner.name}</p>
                <p className="text-[9px] text-muted-foreground/50">{partner.invoice_count} számla</p>
              </div>

              {/* Bar + amount */}
              <div className="w-[120px] shrink-0 flex items-center gap-1.5">
                <div className="flex-1 h-[5px] bg-foreground/[0.04] rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${barWidth}%`, background: barGradient }}
                  />
                </div>
                <span className="text-[10px] font-semibold tabular-nums whitespace-nowrap" style={{ color: accentColor }}>
                  {formatCompact(partner.total_gross)}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Treemap */}
      {data.length > 0 && (
        <div className="mt-3.5 pt-3.5 border-t border-border/40">
          <p className="text-[10px] text-muted-foreground/50 font-medium uppercase tracking-wider mb-2">
            Top {data.length} arányos áttekintés
          </p>
          <div className="flex flex-wrap gap-[3px]">
            {data.map((partner, idx) => {
              const color = TREEMAP_COLORS[idx] || TREEMAP_COLORS[TREEMAP_COLORS.length - 1];
              const pct = top10Total > 0 ? (partner.total_gross / top10Total) * 100 : 10;
              // Width as percentage of total, minus gap compensation
              const widthPct = Math.max(8, pct);
              // Height based on rank tier
              const h = idx < 3 ? 48 : idx < 6 ? 40 : idx < 9 ? 34 : 28;
              return (
                <div
                  key={partner.tax_number}
                  className="rounded-md flex flex-col items-center justify-center px-1 cursor-pointer transition-opacity hover:opacity-80"
                  style={{
                    backgroundColor: color.bg,
                    color: isDark ? color.textDark : color.textLight,
                    overflow: 'hidden',
                    width: `calc(${widthPct}% - 3px)`,
                    height: `${h}px`,
                    flexShrink: 0,
                  }}
                  onClick={() => onPartnerClick?.(partner.tax_number)}
                  title={`${partner.name}: ${formatCompact(partner.total_gross)} Ft (${pct.toFixed(1)}%)`}
                >
                  {h >= 40 && (
                    <span className="text-[7px] font-extrabold opacity-40 leading-none">#{idx + 1}</span>
                  )}
                  <span className={`font-bold whitespace-nowrap leading-tight ${h >= 40 ? 'text-[11px]' : 'text-[10px]'}`}>
                    {formatCompact(partner.total_gross)}
                  </span>
                  <span className="text-[8px] font-medium opacity-60 whitespace-nowrap overflow-hidden text-ellipsis max-w-full text-center leading-none">
                    {partner.name.length > 12 ? partner.name.substring(0, 10) + '…' : partner.name}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Summary row */}
      <div className="mt-3.5 pt-3 border-t border-border/40 grid grid-cols-4 gap-2 text-center">
        <div>
          <p className="text-[9px] text-muted-foreground/50 font-medium uppercase tracking-wider">Top {data.length} összeg</p>
          <p className="text-[15px] font-extrabold mt-0.5" style={{ color: accentColor }}>
            {formatCompact(top10Total)}
          </p>
          <p className="text-[9px] text-muted-foreground/40">Ft</p>
        </div>
        <div>
          <p className="text-[9px] text-muted-foreground/50 font-medium uppercase tracking-wider">
            Összes {isSupplier ? 'beszerzés' : 'értékesítés'}
          </p>
          <p className="text-[15px] font-extrabold mt-0.5">{formatCompact(totalAll)}</p>
          <p className="text-[9px] text-muted-foreground/40">Ft</p>
        </div>
        <div>
          <p className="text-[9px] text-muted-foreground/50 font-medium uppercase tracking-wider">Top {data.length} arány</p>
          <p className="text-[15px] font-extrabold mt-0.5 text-amber-400">{top10Pct}%</p>
        </div>
        <div>
          <p className="text-[9px] text-muted-foreground/50 font-medium uppercase tracking-wider">Top 3 arány</p>
          <p className="text-[15px] font-extrabold mt-0.5 text-primary">{top3Pct}%</p>
        </div>
      </div>
    </div>
  );
}
