import React, { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';

// ── Animated Number ──
export function AnimatedNumber({ value, duration = 1200 }: { value: number; duration?: number }) {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    if (value === 0) { setDisplay(0); return; }
    let start = 0;
    const step = Math.max(1, Math.ceil(value / (duration / 16)));
    const timer = setInterval(() => {
      start += step;
      if (start >= value) { setDisplay(value); clearInterval(timer); }
      else setDisplay(start);
    }, 16);
    return () => clearInterval(timer);
  }, [value, duration]);
  return <>{display.toLocaleString('hu-HU')}</>;
}

// ── KPI Card ──
const COLOR_MAP: Record<string, string> = {
  teal: 'from-primary/10 to-primary/5 dark:from-primary/20 dark:to-primary/10',
  emerald: 'from-primary/10 to-primary/5 dark:from-primary/20 dark:to-primary/10',
  blue: 'from-blue-500/10 to-blue-600/5 dark:from-blue-500/20 dark:to-blue-600/10',
  red: 'from-red-500/10 to-red-600/5 dark:from-red-500/20 dark:to-red-600/10',
  amber: 'from-amber-500/10 to-amber-600/5 dark:from-amber-500/20 dark:to-amber-600/10',
  violet: 'from-violet-500/10 to-violet-600/5 dark:from-violet-500/20 dark:to-violet-600/10',
};
const ICON_COLOR_MAP: Record<string, string> = {
  teal: 'bg-accent dark:bg-accent text-primary',
  emerald: 'bg-accent dark:bg-accent text-primary',
  blue: 'bg-blue-100 dark:bg-blue-900/50 text-blue-600',
  red: 'bg-red-100 dark:bg-red-900/50 text-red-600',
  amber: 'bg-amber-100 dark:bg-amber-900/50 text-amber-600',
  violet: 'bg-violet-100 dark:bg-violet-900/50 text-violet-600',
};

interface KpiCardProps {
  title: string;
  value: number | string;
  subtitle?: string;
  icon: React.ElementType;
  valueClass?: string;
  accentColor?: string;
}

export function KpiCard({ title, value, subtitle, icon: Icon, valueClass = 'text-slate-900 dark:text-slate-100', accentColor = 'teal' }: KpiCardProps) {
  return (
    <div
      className={cn(
        "relative overflow-hidden bg-gradient-to-br rounded-xl p-5 border border-border shadow-soft flex flex-col justify-between h-32 card-ripple",
        "hover:shadow-lg hover:scale-[1.02] hover:border-slate-200 dark:hover:border-slate-700 transition-all duration-300 cursor-default group",
        COLOR_MAP[accentColor] || COLOR_MAP.teal,
        "bg-card"
      )}
      onMouseMove={(e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        e.currentTarget.style.setProperty('--ripple-x', `${((e.clientX - rect.left) / rect.width) * 100}%`);
        e.currentTarget.style.setProperty('--ripple-y', `${((e.clientY - rect.top) / rect.height) * 100}%`);
      }}
    >
      <div className="flex items-start justify-between">
        <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400">{title}</h3>
        <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center transition-transform duration-300 group-hover:scale-110", ICON_COLOR_MAP[accentColor] || ICON_COLOR_MAP.teal)}>
          <Icon className="w-4.5 h-4.5" />
        </div>
      </div>
      <div>
        <p className={cn('text-3xl font-bold tracking-tight', valueClass)}>
          {typeof value === 'number' ? <AnimatedNumber value={value} /> : value}
        </p>
        {subtitle && <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{subtitle}</p>}
      </div>
      {/* Subtle shimmer on hover */}
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none bg-gradient-to-r from-transparent via-white/5 to-transparent" />
    </div>
  );
}

// ── Skeleton Card ──
export function SkeletonKpiCard() {
  return (
    <div className="bg-card rounded-xl p-5 border border-border h-32 animate-pulse">
      <div className="flex justify-between">
        <div className="h-4 w-24 bg-slate-200 dark:bg-slate-800 rounded" />
        <div className="w-9 h-9 bg-slate-100 dark:bg-slate-800 rounded-lg" />
      </div>
      <div className="h-8 w-16 bg-slate-200 dark:bg-slate-800 rounded mt-8" />
    </div>
  );
}

export function SkeletonListRow() {
  return (
    <div className="bg-card rounded-xl p-4 border border-border animate-pulse h-20 flex items-center gap-3">
      <div className="w-10 h-10 bg-slate-200 dark:bg-slate-800 rounded-full shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="h-4 w-32 bg-slate-200 dark:bg-slate-800 rounded" />
        <div className="h-3 w-20 bg-slate-100 dark:bg-slate-800 rounded" />
      </div>
      <div className="h-5 w-16 bg-slate-100 dark:bg-slate-800 rounded-full" />
    </div>
  );
}

export function SkeletonClientCard({ index = 0 }: { index?: number }) {
  return (
    <div className="bg-card rounded-xl border border-border overflow-hidden animate-pulse" style={{ animationDelay: `${index * 100}ms` }}>
      <div className="h-1 w-full bg-slate-200 dark:bg-slate-800" />
      <div className="p-5 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-slate-200 dark:bg-slate-800 rounded-lg" />
          <div className="space-y-2 flex-1">
            <div className="h-4 w-32 bg-slate-200 dark:bg-slate-800 rounded" />
            <div className="h-3 w-20 bg-slate-100 dark:bg-slate-800 rounded" />
          </div>
        </div>
        <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full" />
        <div className="grid grid-cols-2 gap-4">
          <div className="h-10 bg-slate-100 dark:bg-slate-800 rounded" />
          <div className="h-10 bg-slate-100 dark:bg-slate-800 rounded" />
        </div>
      </div>
    </div>
  );
}

// ── Empty State ──
interface EmptyStateProps {
  icon: React.ElementType;
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void; icon?: React.ElementType };
}

export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="py-16 text-center animate-in fade-in duration-300">
      <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto mb-4">
        <Icon className="w-7 h-7 text-slate-400 dark:text-slate-500" />
      </div>
      <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">{title}</p>
      {description && <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-xs mx-auto">{description}</p>}
      {action && (
        <button
          onClick={action.onClick}
          className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg text-sm font-medium transition-colors"
        >
          {action.icon && <action.icon className="w-4 h-4" />}
          {action.label}
        </button>
      )}
    </div>
  );
}

// ── Breadcrumb ──
interface BreadcrumbItem {
  label: string;
  href?: string;
}

export function Breadcrumb({ items, onNavigate }: { items: BreadcrumbItem[]; onNavigate: (href: string) => void }) {
  return (
    <nav className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 mb-4">
      {items.map((item, i) => (
        <React.Fragment key={i}>
          {i > 0 && <span className="text-slate-300 dark:text-slate-600">/</span>}
          {item.href ? (
            <button
              onClick={() => onNavigate(item.href!)}
              className="hover:text-primary transition-colors font-medium"
            >
              {item.label}
            </button>
          ) : (
            <span className="text-slate-700 dark:text-slate-300 font-semibold">{item.label}</span>
          )}
        </React.Fragment>
      ))}
    </nav>
  );
}
