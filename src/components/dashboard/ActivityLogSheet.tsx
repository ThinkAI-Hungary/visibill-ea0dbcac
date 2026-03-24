import { useState, useMemo, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useCompany } from '@/contexts/CompanyContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import {
  Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger,
} from '@/components/ui/sheet';
import {
  History, Plus, Pencil, Trash2, Upload, Link2, FileText, Banknote,
  ArrowLeftRight, Tag, ClipboardList, Search, User, CalendarDays, CheckCircle2, Bot,
} from 'lucide-react';
import { format, startOfDay, endOfDay, subDays, startOfWeek } from 'date-fns';
import { formatDistanceToNow } from 'date-fns';
import { hu } from 'date-fns/locale';

// ─── Types ─────────────────────────────────────────────────────────────────────
interface AuditLogRow {
  id: string;
  company_id: string;
  user_id: string | null;
  action: string;
  entity: string;
  entity_name: string | null;
  details: any;
  created_at: string;
}

interface CompanyMember {
  user_id: string;
  name: string | null;
}

type TimePeriod = 'today' | 'yesterday' | 'week' | 'custom';

// ─── Config maps ───────────────────────────────────────────────────────────────
const ACTION_CONFIG: Record<string, { icon: typeof Plus; color: string; label: string }> = {
  'létrehozás': { icon: Plus, color: 'text-emerald-500 bg-emerald-50 dark:bg-emerald-950/30', label: 'létrehozott' },
  'módosítás': { icon: Pencil, color: 'text-blue-500 bg-blue-50 dark:bg-blue-950/30', label: 'módosított' },
  'törlés': { icon: Trash2, color: 'text-red-500 bg-red-50 dark:bg-red-950/30', label: 'törölt' },
  'feltöltés': { icon: Upload, color: 'text-cyan-500 bg-cyan-50 dark:bg-cyan-950/30', label: 'feltöltött' },
  'párosítás': { icon: Link2, color: 'text-purple-500 bg-purple-50 dark:bg-purple-950/30', label: 'párosított' },
};

const ENTITY_CONFIG: Record<string, { icon: typeof FileText; label: string }> = {
  'számla': { icon: FileText, label: 'számlát' },
  'bérjegyzék': { icon: Banknote, label: 'bérjegyzéket' },
  'tranzakció': { icon: ArrowLeftRight, label: 'tranzakciót' },
  'kategória': { icon: Tag, label: 'kategóriát' },
  'dokumentum': { icon: ClipboardList, label: 'dokumentumot' },
};

const PERIOD_BUTTONS: { key: TimePeriod; label: string }[] = [
  { key: 'today', label: 'Ma' },
  { key: 'yesterday', label: 'Tegnap' },
  { key: 'week', label: 'Hét' },
  { key: 'custom', label: 'Egyedi' },
];

// ─── Date helpers ──────────────────────────────────────────────────────────────
function getDateRange(period: TimePeriod, customFrom?: Date, customTo?: Date): { from: string; to: string } {
  const now = new Date();
  switch (period) {
    case 'today':
      return { from: startOfDay(now).toISOString(), to: endOfDay(now).toISOString() };
    case 'yesterday': {
      const y = subDays(now, 1);
      return { from: startOfDay(y).toISOString(), to: endOfDay(y).toISOString() };
    }
    case 'week':
      return { from: startOfWeek(now, { weekStartsOn: 1 }).toISOString(), to: endOfDay(now).toISOString() };
    case 'custom':
      return {
        from: customFrom ? startOfDay(customFrom).toISOString() : startOfDay(now).toISOString(),
        to: customTo ? endOfDay(customTo).toISOString() : endOfDay(now).toISOString(),
      };
    default:
      return { from: startOfDay(now).toISOString(), to: endOfDay(now).toISOString() };
  }
}

// ─── Processing detection ──────────────────────────────────────────────────────
function isProcessingComplete(log: AuditLogRow): boolean {
  if (log.action !== 'módosítás') return false;
  const details = log.details;
  if (!details || typeof details !== 'object') return false;
  const d = details as Record<string, any>;
  // The trigger sets is_system=true when n8n processes a file (status -> 'processed')
  return d.is_system === true;
}

// ─── Component ─────────────────────────────────────────────────────────────────
export function ActivityLogSheet() {
  const { selectedCompany } = useCompany();
  const companyId = selectedCompany?.id;

  // Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [uploaderFilter, setUploaderFilter] = useState('all');
  const [timePeriod, setTimePeriod] = useState<TimePeriod>('today');
  const [customFrom, setCustomFrom] = useState<Date | undefined>(undefined);
  const [customTo, setCustomTo] = useState<Date | undefined>(undefined);
  const [isOpen, setIsOpen] = useState(false);

  const dateRange = useMemo(
    () => getDateRange(timePeriod, customFrom, customTo),
    [timePeriod, customFrom, customTo]
  );

  // ── MAIN QUERY: audit_logs with STRICT company_id filter ─────────────────
  const { data: logs = [], isLoading } = useQuery({
    queryKey: ['audit_logs', companyId, dateRange.from, dateRange.to, uploaderFilter],
    queryFn: async () => {
      // SECURITY: ALWAYS filter by company_id — strict multi-tenancy
      let query = supabase
        .from('audit_logs' as any)
        .select('*')
        .eq('company_id', companyId!)
        .gte('created_at', dateRange.from)
        .lte('created_at', dateRange.to)
        .order('created_at', { ascending: false })
        .limit(200);

      // Server-side user filter
      if (uploaderFilter !== 'all') {
        if (uploaderFilter === '__system__') {
          query = query.is('user_id', null);
        } else {
          query = query.eq('user_id', uploaderFilter);
        }
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as unknown as AuditLogRow[];
    },
    enabled: !!companyId && isOpen,
    staleTime: 30_000,
  });

  // ── Company members for the uploader dropdown ────────────────────────────
  const { data: companyMembers = [] } = useQuery({
    queryKey: ['company_members_profiles', companyId],
    queryFn: async () => {
      const { data: members, error: membersError } = await supabase
        .from('company_members')
        .select('user_id')
        .eq('company_id', companyId!);
      if (membersError) throw membersError;
      if (!members || members.length === 0) return [];

      const memberUserIds = members.map(m => m.user_id);
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('user_id, name')
        .in('user_id', memberUserIds);
      if (profilesError) throw profilesError;

      return (profiles || []).map(p => ({
        user_id: p.user_id,
        name: p.name,
      })) as CompanyMember[];
    },
    enabled: !!companyId && isOpen,
  });

  const profileMap = useMemo(() => {
    const map = new Map<string, string>();
    companyMembers.forEach(m => { if (m.name) map.set(m.user_id, m.name); });
    return map;
  }, [companyMembers]);

  const getUserName = useCallback((userId: string | null): string => {
    if (!userId) return 'Rendszer';
    return profileMap.get(userId) || 'Felhasználó';
  }, [profileMap]);

  // ── Client-side text search (entity_name + action) ───────────────────────
  const filteredLogs = useMemo(() => {
    if (!searchQuery.trim()) return logs;
    const q = searchQuery.toLowerCase();
    return logs.filter(log =>
      (log.entity_name && log.entity_name.toLowerCase().includes(q)) ||
      log.action.toLowerCase().includes(q) ||
      log.entity.toLowerCase().includes(q)
    );
  }, [logs, searchQuery]);

  // ── Handlers ─────────────────────────────────────────────────────────────
  const handlePeriodChange = (period: TimePeriod) => {
    setTimePeriod(period);
    if (period !== 'custom') {
      setCustomFrom(undefined);
      setCustomTo(undefined);
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" className="h-9">
          <History className="mr-2 h-4 w-4" />
          Műveleti napló
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-lg flex flex-col overflow-hidden p-0" onCloseAutoFocus={(e) => e.preventDefault()}>
        <SheetHeader className="px-6 pt-6 pb-0">
          <SheetTitle>Műveleti napló</SheetTitle>
          <SheetDescription>Az aktuális cég eseményeinek idővonala.</SheetDescription>
        </SheetHeader>

        {/* ── STICKY FILTER BAR ─────────────────────────────────────────── */}
        <div className="sticky top-0 z-20 bg-background border-b border-border/50 px-6 py-3 space-y-3">

          {/* Row 1: Search + User filter */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Keresés név, művelet..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 h-8 text-sm bg-secondary/30 border-border/50"
              />
            </div>
            <Select value={uploaderFilter} onValueChange={setUploaderFilter}>
              <SelectTrigger className="h-8 w-[180px] text-sm bg-secondary/30 border-border/50">
                <User className="h-3 w-3 mr-1.5 text-muted-foreground shrink-0" />
                <SelectValue placeholder="Feltöltő" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Összes felhasználó</SelectItem>
                <SelectItem value="__system__">
                  <span className="flex items-center gap-1.5">
                    <Bot className="h-3 w-3" />
                    Automatizált rendszer
                  </span>
                </SelectItem>
                {companyMembers.map(member => (
                  <SelectItem key={member.user_id} value={member.user_id}>
                    {member.name || 'Névtelen felhasználó'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Row 2: Time period buttons */}
          <div className="flex items-center gap-1.5">
            {PERIOD_BUTTONS.map(({ key, label }) => (
              <Button
                key={key}
                variant={timePeriod === key ? 'default' : 'outline'}
                size="sm"
                className={`h-7 px-3 text-xs font-medium transition-all border-transparent ${
                  key === 'today'
                    ? timePeriod === key
                      ? 'bg-pink-500 text-white hover:bg-pink-600 shadow-sm dark:bg-pink-500 dark:text-white dark:hover:bg-pink-600'
                      : 'bg-pink-500/80 text-white hover:bg-pink-500 shadow-sm dark:bg-pink-500/80 dark:text-white dark:hover:bg-pink-500'
                    : timePeriod === key
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'bg-secondary/30 hover:bg-secondary/60'
                } ${key === 'yesterday' ? 'text-amber-500' : ''}`}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => handlePeriodChange(key)}
              >
                {label}
              </Button>
            ))}

            {/* Custom date pickers */}
            {timePeriod === 'custom' && (
              <div className="flex items-center gap-1.5 ml-1">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="h-7 px-2 text-xs gap-1 bg-secondary/30">
                      <CalendarDays className="h-3 w-3" />
                      {customFrom ? format(customFrom, 'MM.dd.', { locale: hu }) : '-tól'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={customFrom}
                      onSelect={setCustomFrom}
                      locale={hu}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
                <span className="text-xs text-muted-foreground">–</span>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="h-7 px-2 text-xs gap-1 bg-secondary/30">
                      <CalendarDays className="h-3 w-3" />
                      {customTo ? format(customTo, 'MM.dd.', { locale: hu }) : '-ig'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={customTo}
                      onSelect={setCustomTo}
                      locale={hu}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
            )}
          </div>
        </div>

        {/* ── TIMELINE CONTENT ──────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">
              <div className="flex items-center gap-2">
                <div className="h-4 w-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                Betöltés...
              </div>
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <History className="h-10 w-10 mb-3 opacity-30" />
              <p className="text-sm font-medium">
                {logs.length === 0 ? 'Nincsenek események ebben az időszakban.' : 'Nincs találat a megadott szűrőkkel.'}
              </p>
              <p className="text-xs mt-1 opacity-70">
                {logs.length === 0 ? 'Próbálj másik időszakot választani.' : 'Módosítsd a keresést vagy szűrőket.'}
              </p>
            </div>
          ) : (
            <div className="relative">
              {/* Timeline vertical line */}
              <div className="absolute left-[19px] top-2 bottom-2 w-px bg-border" />

              <div className="space-y-0.5">
                {filteredLogs.map((log) => {
                  const processed = isProcessingComplete(log);
                  const actionCfg = processed
                    ? { icon: CheckCircle2, color: 'text-green-600 bg-green-50 dark:bg-green-950/30', label: 'feldolgozta' }
                    : (ACTION_CONFIG[log.action] || ACTION_CONFIG['módosítás']);
                  const entityCfg = ENTITY_CONFIG[log.entity] || { label: log.entity, icon: FileText };
                  const userName = getUserName(log.user_id);
                  const ActionIcon = actionCfg.icon;
                  const isSystemAction = processed; // is_system from trigger details

                  return (
                    <div key={log.id} className="relative flex gap-3 py-2.5 pl-0">
                      {/* Icon dot */}
                      <div className={`relative z-10 flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-full border border-border/50 ${actionCfg.color}`}>
                        <ActionIcon className="h-4 w-4" />
                      </div>

                      {/* Content */}
                      <div className="min-w-0 flex-1 pt-0.5">
                        {isSystemAction ? (
                          // Processing complete message — attributed to original uploader
                          <p className="text-sm leading-snug">
                            <span className="font-semibold">{userName}</span>
                            {' '}
                            <span className="text-muted-foreground">feltöltése feldolgozva:</span>
                            {' '}
                            <span className="font-medium text-green-600 dark:text-green-400">
                              {log.entity_name || 'ismeretlen fájl'}
                            </span>
                          </p>
                        ) : (
                          // Normal activity message
                          <p className="text-sm leading-snug">
                            <span className="font-semibold">
                              {userName}
                            </span>
                            {' '}
                            <span className="text-muted-foreground">{actionCfg.label} egy {entityCfg.label}</span>
                            {log.entity_name && (
                              <>
                                {': '}
                                <span className="font-medium text-foreground">{log.entity_name}</span>
                              </>
                            )}
                          </p>
                        )}
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {format(new Date(log.created_at), 'HH:mm', { locale: hu })}
                          {' · '}
                          {formatDistanceToNow(new Date(log.created_at), { addSuffix: true, locale: hu })}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Result count */}
              <div className="mt-4 pt-3 border-t border-border/30 text-center">
                <p className="text-xs text-muted-foreground">
                  {filteredLogs.length} esemény{filteredLogs.length !== logs.length ? ` (${logs.length} összesen)` : ''}
                </p>
              </div>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
