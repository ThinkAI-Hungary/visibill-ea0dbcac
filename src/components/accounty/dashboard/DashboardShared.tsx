import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Building2, 
  Clock, 
  ChevronUp, 
  ChevronDown, 
  Check, 
  GripVertical
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { ClientData } from '@/pages/Accounty/types';
import { useAccountyAccountants } from '@/hooks/accounty';
import { useAccountyRole } from '@/pages/Accounty/AccountyRoleContext';

export const CLIENT_COLORS = [
  'bg-accent text-primary', 'bg-amber-100 text-amber-600',
  'bg-indigo-100 text-indigo-600', 'bg-pink-100 text-pink-600',
  'bg-teal-100 text-teal-600', 'bg-sky-100 text-sky-600',
  'bg-violet-100 text-violet-600', 'bg-rose-100 text-rose-600',
];

export function AnimatedNumber({ value, duration = 1200 }: { value: number; duration?: number }) {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    if (value === 0) { setDisplay(0); return; }
    let startTime: number | null = null;
    let rafId: number;
    const animate = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      setDisplay(Math.round(progress * value));
      if (progress < 1) rafId = requestAnimationFrame(animate);
    };
    rafId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafId);
  }, [value, duration]);
  return <>{display.toLocaleString('hu-HU')}</>;
}

export function KpiCard({ 
  title, 
  value, 
  icon: Icon, 
  valueClass = "text-foreground", 
  accentColor = "teal", 
  onClick 
}: { 
  title: string, 
  value: number, 
  icon: React.ElementType, 
  valueClass?: string, 
  accentColor?: string, 
  onClick?: () => void 
}) {
  const colorMap: Record<string, string> = {
    teal: 'from-primary/10 to-primary/5 dark:from-primary/20 dark:to-primary/10',
    emerald: 'from-primary/10 to-primary/5 dark:from-primary/20 dark:to-primary/10',
    blue: 'from-blue-500/10 to-blue-600/5 dark:from-blue-500/20 dark:to-blue-600/10',
    red: 'from-red-500/10 to-red-600/5 dark:from-red-500/20 dark:to-red-600/10',
    amber: 'from-amber-500/10 to-amber-600/5 dark:from-amber-500/20 dark:to-amber-600/10',
  };
  const iconColorMap: Record<string, string> = {
    teal: 'bg-accent dark:bg-accent text-primary',
    emerald: 'bg-accent dark:bg-accent text-primary',
    blue: 'bg-blue-100 dark:bg-blue-900/50 text-blue-600',
    red: 'bg-red-100 dark:bg-red-900/50 text-red-600',
    amber: 'bg-amber-100 dark:bg-amber-900/50 text-amber-600',
  };
  return (
    <div
      onClick={onClick}
      className={cn(
        "relative overflow-hidden bg-gradient-to-br rounded-xl p-5 border border-border/80 shadow-soft flex flex-col justify-between h-32 card-ripple bg-card/50 backdrop-blur-md",
        "hover:scale-[1.02] hover:border-border/90 transition-all duration-300 group",
        onClick ? "cursor-pointer" : "cursor-default",
        colorMap[accentColor] || colorMap.emerald
      )}
      onMouseMove={(e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        e.currentTarget.style.setProperty('--ripple-x', `${((e.clientX - rect.left) / rect.width) * 100}%`);
        e.currentTarget.style.setProperty('--ripple-y', `${((e.clientY - rect.top) / rect.height) * 100}%`);
      }}
    >
      <div className="flex items-start justify-between">
        <h3 className="text-sm font-medium text-muted-foreground">{title}</h3>
        <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center transition-transform duration-300 group-hover:scale-110", iconColorMap[accentColor] || iconColorMap.emerald)}>
          <Icon className="w-4.5 h-4.5" />
        </div>
      </div>
      <p className={`text-3xl font-bold tracking-tight ${valueClass}`}>
        <AnimatedNumber value={value} />
      </p>
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none bg-gradient-to-r from-transparent via-white/5 to-transparent" />
    </div>
  );
}

export function StatusBadge({ status }: { status: ClientData['status'] }) {
  const styles = {
    'Rendben': 'bg-accent text-accent-foreground dark:bg-accent dark:text-primary',
    'Feldolgozandó': 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400',
    'Kritikus': 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400',
  };
  return (
    <span className={cn("inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider", styles[status])}>
      {status}
    </span>
  );
}

export function OwnerDropdown({ 
  client, 
  onUpdateOwner 
}: { 
  client: ClientData, 
  onUpdateOwner?: (clientId: string, ownerId: string) => void 
}) {
  const [open, setOpen] = useState(false);
  const { data: accountants } = useAccountyAccountants();
  const { isAdmin } = useAccountyRole();
  const safeAccountants = accountants || [{ id: '1', userId: '1', name: 'Névtelen', initial: 'N', clientCount: 0 }];
  const owner = safeAccountants.find(a => a.id === client.ownerId) || safeAccountants[0];

  if (!owner) return null;

  if (!isAdmin) {
    return (
      <div className="h-8 px-2 flex items-center gap-2 bg-muted/10 rounded-lg border border-border/30 cursor-default select-none">
        <div className="w-5 h-5 rounded-full bg-muted-foreground/30 flex items-center justify-center text-[10px] font-bold text-white">
          {owner.initial}
        </div>
        <span className="text-xs font-semibold text-muted-foreground">{owner.name}</span>
      </div>
    );
  }

  return (
    <div onClick={(e) => e.stopPropagation()}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="sm" className="h-8 px-2 flex items-center gap-2 hover:bg-muted/20 dark:bg-muted/10 dark:hover:bg-muted/20 data-[state=open]:bg-muted/20 shadow-soft border border-border/50">
            <div className="w-5 h-5 rounded-full bg-muted-foreground/30 flex items-center justify-center text-[10px] font-bold text-white">
              {owner.initial}
            </div>
            <span className="text-xs font-semibold text-foreground">{owner.name}</span>
            <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[200px] p-0" align="start">
          <Command>
            <CommandInput placeholder="Keresés könyvelőre..." className="h-9 text-xs" />
            <CommandList>
              <CommandEmpty>Nincs találat.</CommandEmpty>
              <CommandGroup>
                {safeAccountants.map((acc) => (
                  <CommandItem
                     key={acc.id}
                     value={acc.name}
                     onSelect={() => {
                       onUpdateOwner?.(client.id, acc.id);
                       setOpen(false);
                     }}
                     className="flex items-center justify-between text-xs cursor-pointer py-2"
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 rounded-full bg-muted-foreground/30 flex items-center justify-center text-[10px] font-bold text-white">
                        {acc.initial}
                      </div>
                      <span>{acc.name}</span>
                    </div>
                    {acc.id === owner.id && (
                      <Check className="w-3.5 h-3.5 text-primary" />
                    )}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}

export function MissingItemsTooltip({ companyId }: { companyId: string }) {
  const { data: items } = useQuery({
    queryKey: ['missing-top3', companyId],
    queryFn: async () => {
      const { data } = await supabase
        .from('accounty_missing_items')
        .select('title, amount, priority')
        .eq('company_id', companyId)
        .in('status', ['open', 'notified'])
        .order('amount', { ascending: false, nullsFirst: false })
        .limit(3) as any;
      return (data || []) as { title: string; amount: number | null; priority: string }[];
    },
    staleTime: 60_000,
  });

  if (!items || items.length === 0) return null;

  return (
    <div className="absolute right-0 top-1/2 -translate-y-1/2 z-50 opacity-0 group-hover/row:opacity-100 pointer-events-none transition-opacity duration-200">
      <div className="bg-popover text-popover-foreground rounded-lg shadow-xl p-3 ml-2 min-w-[220px] border border-border">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2 font-semibold">Top tételek</p>
        {items.map((item, i) => (
          <div key={i} className="flex items-center justify-between gap-3 py-1">
            <span className="text-xs text-foreground truncate max-w-[140px]">{item.title}</span>
            {item.amount ? (
              <span className="text-xs font-bold text-primary whitespace-nowrap">{item.amount.toLocaleString('hu-HU')} Ft</span>
            ) : (
              <span className="text-xs text-muted-foreground">–</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export function ClientCard({ 
  client, 
  draggable, 
  onDragStart, 
  onDragEnd, 
  isDragged, 
  onUpdateOwner 
}: { 
  client: ClientData, 
  draggable?: boolean, 
  onDragStart?: (e: React.DragEvent) => void, 
  onDragEnd?: (e: React.DragEvent) => void, 
  isDragged?: boolean, 
  onUpdateOwner?: (clientId: string, ownerId: string) => void 
}) {
  const navigate = useNavigate();

  const daysLeft = Math.ceil((new Date(client.deadlineDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  const isOverdue = daysLeft < 0;
  const deadlineColor = isOverdue
    ? 'bg-red-500'
    : daysLeft <= 3
      ? 'bg-red-500'
      : daysLeft <= 7
        ? 'bg-amber-500'
        : 'bg-primary';
  const deadlineBadgeStyle = isOverdue
    ? 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400'
    : daysLeft <= 3
      ? 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400'
      : daysLeft <= 7
        ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400'
        : 'bg-accent dark:bg-accent text-accent-foreground dark:text-primary';
  const deadlineText = isOverdue
    ? `${Math.abs(daysLeft)} napja lejárt!`
    : daysLeft === 0
      ? 'Ma lejár!'
      : daysLeft === 1
        ? 'Holnap lejár'
        : `${daysLeft} nap`;
  const progressColor = client.progress >= 80
    ? 'bg-primary'
    : client.progress >= 50
      ? 'bg-amber-500'
      : 'bg-red-500';

  return (
    <div 
      draggable={draggable}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={() => navigate(`/eaisybooks/client/${client.id}`)}
      className={cn(
        "bg-card/50 backdrop-blur-md rounded-xl border border-border/80 shadow-soft flex flex-col group cursor-pointer h-full overflow-hidden", 
        "hover:border-border/90 hover:-translate-y-0.5 transition-all duration-300",
        "animate-in fade-in slide-in-from-bottom-2 duration-300",
        draggable && "cursor-grab active:cursor-grabbing",
        isDragged && "opacity-50 scale-[0.98] shadow-none border-dashed border-2 ring-2 ring-primary/20"
      )}
    >
      <div className={cn(
        "h-1 w-full",
        client.status === 'Rendben' ? 'bg-gradient-to-r from-primary to-primary/80' :
        client.status === 'Feldolgozandó' ? 'bg-gradient-to-r from-amber-400 to-amber-500' :
        'bg-gradient-to-r from-red-400 to-red-500'
      )} />
      <div className="p-5 flex flex-col h-full">
        <div className="flex justify-between items-start mb-4">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${client.colorHex}`}>
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-semibold text-foreground leading-tight">{client.name}</h4>
              <p className="text-xs text-muted-foreground mt-0.5">{client.taxNumber}</p>
            </div>
          </div>
        </div>

        <div className="flex justify-between items-center mb-4">
          <span className="text-xs text-muted-foreground">Státusz</span>
          <StatusBadge status={client.status} />
        </div>

        <div className="mb-4">
          <div className="flex justify-between items-center mb-1.5">
            <span className="text-[11px] text-muted-foreground font-medium">Havi zárás</span>
            <span className="text-[11px] font-bold text-foreground">{client.progress}%</span>
          </div>
          <div className="w-full bg-muted/20 dark:bg-muted/10 rounded-full h-1.5">
            <div className={cn('h-1.5 rounded-full transition-all duration-500', progressColor)} style={{ width: `${client.progress}%` }} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <p className="text-xs text-muted-foreground mb-1">Feldolgozatlan</p>
            <p className="font-semibold text-foreground">{client.unprocessedCount} számla</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">Hiányzó</p>
            <p className={`font-semibold ${client.missingCount > 0 ? 'text-red-600' : 'text-foreground'}`}>
              {client.missingCount} számla
            </p>
          </div>
        </div>

        <div className="mt-auto pt-4 border-t border-border flex justify-between items-center">
          <OwnerDropdown client={client} onUpdateOwner={onUpdateOwner} />
          <div className="flex items-center gap-1.5">
            <Clock className={cn('w-3.5 h-3.5', isOverdue ? 'text-red-500' : daysLeft <= 3 ? 'text-red-500' : daysLeft <= 7 ? 'text-amber-500' : 'text-muted-foreground')} />
            <span className={cn('text-[11px] font-bold px-2 py-0.5 rounded-full', deadlineBadgeStyle)}>
              {deadlineText}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

export function WidgetWrapper({ 
  children, 
  id, 
  editingLayout, 
  onMoveUp, 
  onMoveDown, 
  isFirst, 
  isLast,
  order
}: { 
  children: React.ReactNode; 
  id: string; 
  editingLayout: boolean; 
  onMoveUp: () => void; 
  onMoveDown: () => void;
  isFirst: boolean;
  isLast: boolean;
  order: number;
}) {
  return (
    <div className={cn("relative transition-all duration-300", editingLayout && "p-4 border-2 border-dashed border-primary/40 rounded-xl bg-primary/5")} style={{ order }}>
      {editingLayout && (
        <div className="absolute -left-3 top-1/2 -translate-y-1/2 flex flex-col gap-1 bg-card shadow-md rounded-lg p-1 z-10 border border-border">
          <button 
            onClick={onMoveUp} 
            disabled={isFirst}
            className="p-1 hover:bg-muted/20 rounded text-muted-foreground disabled:opacity-30"
          >
            <ChevronUp className="w-4 h-4" />
          </button>
          <div className="w-full h-px bg-border"></div>
          <button 
            onClick={onMoveDown} 
            disabled={isLast}
            className="p-1 hover:bg-muted/20 rounded text-muted-foreground disabled:opacity-30"
          >
            <ChevronDown className="w-4 h-4" />
          </button>
        </div>
      )}
      {children}
    </div>
  );
}
