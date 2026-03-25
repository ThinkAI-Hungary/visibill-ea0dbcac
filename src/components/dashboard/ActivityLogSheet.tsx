import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  History, Plus, Pencil, Trash2, Upload, Link2, FileText, Banknote,
  ArrowLeftRight, Tag, ClipboardList, Search, User, CalendarDays, CheckCircle2, Bot, ExternalLink, AlertCircle, Filter, ListFilter, Check
} from 'lucide-react';
import { format, startOfDay, endOfDay, subDays, startOfWeek } from 'date-fns';
import { formatDistanceToNow } from 'date-fns';
import { hu } from 'date-fns/locale';
import { UserActivityDialog } from './UserActivityDialog';

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

type TimePeriod = 'today' | 'yesterday' | 'week' | 'custom' | 'all';

// ─── Config maps ───────────────────────────────────────────────────────────────
const ACTION_CONFIG: Record<string, { icon: typeof Plus; color: string; label: string }> = {
  'létrehozás': { icon: Plus, color: 'text-emerald-500 bg-emerald-50 dark:bg-emerald-950/30', label: 'létrehozott' },
  'módosítás': { icon: Pencil, color: 'text-blue-500 bg-blue-50 dark:bg-blue-950/30', label: 'módosított' },
  'törlés': { icon: Trash2, color: 'text-red-500 bg-red-50 dark:bg-red-950/30', label: 'törölt' },
  'feltöltés': { icon: Upload, color: 'text-cyan-500 bg-cyan-50 dark:bg-cyan-950/30', label: 'feltöltött' },
  'párosítás': { icon: Link2, color: 'text-purple-500 bg-purple-50 dark:bg-purple-950/30', label: 'párosított' },
};

const AVAILABLE_ACTIONS = [
  { id: 'feltöltés', label: 'Feltöltések', icon: Upload, color: 'text-cyan-500 bg-cyan-50 dark:bg-cyan-950/30' },
  { id: 'feldolgozás', label: 'Feldolgozások', icon: CheckCircle2, color: 'text-green-600 bg-green-50 dark:bg-green-950/30' },
  { id: 'törlés', label: 'Törlések', icon: Trash2, color: 'text-red-500 bg-red-50 dark:bg-red-950/30' },
  { id: 'módosítás', label: 'Módosítások', icon: Pencil, color: 'text-blue-500 bg-blue-50 dark:bg-blue-950/30' },
  { id: 'létrehozás', label: 'Létrehozások', icon: Plus, color: 'text-emerald-500 bg-emerald-50 dark:bg-emerald-950/30' },
  { id: 'párosítás', label: 'Párosítások', icon: Link2, color: 'text-purple-500 bg-purple-50 dark:bg-purple-950/30' }
];

const ENTITY_CONFIG: Record<string, { icon: typeof FileText; label: string }> = {
  'számla': { icon: FileText, label: 'számlát' },
  'bérjegyzék': { icon: Banknote, label: 'bérjegyzéket' },
  'tranzakció': { icon: ArrowLeftRight, label: 'tranzakciót' },
  'kategória': { icon: Tag, label: 'kategóriát' },
  'dokumentum': { icon: ClipboardList, label: 'dokumentumot' },
};

// Removed PERIOD_BUTTONS array

// ─── Date helpers ──────────────────────────────────────────────────────────────
function getDateRange(customFrom: string, customTo: string): { from: string; to: string } {
  const now = new Date();
  return {
    from: customFrom ? new Date(customFrom).toISOString() : new Date(0).toISOString(),
    to: customTo ? new Date(customTo).toISOString() : endOfDay(now).toISOString()
  };
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
// ─── Custom Selects (Bypass Portals) ──────────────────────────────────────────
const CURRENT_YEAR = new Date().getFullYear();
const YEAR_OPTIONS = Array.from({length: CURRENT_YEAR - 2000 + 1}, (_, i) => {
  const y = CURRENT_YEAR - i;
  return { label: y.toString(), value: y.toString() };
});
const MONTH_OPTIONS = Array.from({length: 12}, (_, i) => ({ label: (i+1).toString().padStart(2, '0'), value: (i+1).toString().padStart(2, '0') }));
const DAY_OPTIONS = Array.from({length: 31}, (_, i) => ({ label: (i+1).toString().padStart(2, '0'), value: (i+1).toString().padStart(2, '0') }));
const HOUR_OPTIONS = Array.from({length: 24}, (_, i) => ({ value: i.toString().padStart(2, '0'), label: i.toString().padStart(2, '0') }));
const MIN_OPTIONS = Array.from({length: 12}, (_, i) => ({ value: (i * 5).toString().padStart(2, '0'), label: (i * 5).toString().padStart(2, '0') }));

function LocalSelect({ 
  value, 
  onChange, 
  options, 
  placeholder, 
  className = '',
  onOpenChange
}: { 
  value: string, 
  onChange: (v: string) => void, 
  options: {value: string, label: string}[], 
  placeholder: string,
  className?: string,
  onOpenChange?: (open: boolean) => void
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const toggleOpen = (newOpen: boolean) => {
    setOpen(newOpen);
    onOpenChange?.(newOpen);
    if (!newOpen) {
      setSearch('');
    } else {
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  };

  useEffect(() => {
    if (!open) return;
    const clickHandler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        toggleOpen(false);
      }
    };
    document.addEventListener('mousedown', clickHandler);
    return () => document.removeEventListener('mousedown', clickHandler);
  }, [open]);

  const filteredOptions = options.filter(o => o.label.toLowerCase().includes(search.toLowerCase()));
  
  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <div 
        className="flex h-8 w-full items-center justify-between rounded-md border border-input bg-background/50 px-2 py-1 text-xs shadow-sm cursor-text hover:bg-accent/50 transition-colors"
        onClick={() => {
          if (!open) toggleOpen(true);
        }}
      >
        {open ? (
          <input
            ref={inputRef}
            type="text"
            className="w-full bg-transparent outline-none truncate font-medium placeholder:text-muted-foreground leading-none"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && filteredOptions.length === 1) {
                e.preventDefault();
                onChange(filteredOptions[0].value);
                toggleOpen(false);
              }
            }}
            placeholder={options.find(o => o.value === value)?.label || placeholder}
            onBlur={() => {
              if (search && filteredOptions.length === 1) {
                onChange(filteredOptions[0].value);
              }
              toggleOpen(false);
            }}
          />
        ) : (
          <span className="truncate font-medium leading-none">{options.find(o => o.value === value)?.label || placeholder}</span>
        )}
      </div>
      {open && (
        <div className="absolute z-[100] top-full mt-1 left-0 w-full min-w-[60px] rounded-md border bg-popover text-popover-foreground shadow-lg font-medium outline-none animate-in fade-in-0 zoom-in-95">
          <div 
            className="max-h-48 flex flex-col overflow-y-auto p-1 pointer-events-auto [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-border [&::-webkit-scrollbar-thumb]:rounded-full"
            onWheel={(e) => e.stopPropagation()} 
          >
            {filteredOptions.length > 0 ? filteredOptions.map(o => (
              <div 
                key={o.value} 
                className={`flex w-full cursor-pointer select-none items-center rounded-sm py-1.5 px-2 text-xs outline-none hover:bg-accent hover:text-accent-foreground ${value === o.value ? 'bg-accent/40 font-bold' : ''}`}
                onMouseDown={(e) => { 
                  e.preventDefault();
                  e.stopPropagation(); 
                  onChange(o.value); 
                  toggleOpen(false); 
                }}
              >
                {o.label}
              </div>
            )) : (
              <div className="py-1.5 px-2 text-xs text-muted-foreground text-center">
                Nincs találat
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export function ActivityLogSheet() {
  const { selectedCompany } = useCompany();
  const companyId = selectedCompany?.id;

  // Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [uploaderFilter, setUploaderFilter] = useState('all');
  
  // Real active filter state
  const [customFrom, setCustomFrom] = useState<string>('');
  const [customTo, setCustomTo] = useState<string>('');
  const [isFilterActive, setIsFilterActive] = useState(false);
  const [selectedActions, setSelectedActions] = useState<string[]>([]);
  const [isActionFilterActive, setIsActionFilterActive] = useState(false);
  
  // Temporary state for the popover inputs
  const [tempYearFrom, setTempYearFrom] = useState<string>('');
  const [tempMonthFrom, setTempMonthFrom] = useState<string>('');
  const [tempDayFrom, setTempDayFrom] = useState<string>('');
  const [tempHourFrom, setTempHourFrom] = useState('');
  const [tempMinFrom, setTempMinFrom] = useState('');
  
  const [tempYearTo, setTempYearTo] = useState<string>('');
  const [tempMonthTo, setTempMonthTo] = useState<string>('');
  const [tempDayTo, setTempDayTo] = useState<string>('');
  const [tempHourTo, setTempHourTo] = useState('');
  const [tempMinTo, setTempMinTo] = useState('');
  
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [isActionFilterOpen, setIsActionFilterOpen] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [activeDropdowns, setActiveDropdowns] = useState(0);

  const filterTimeoutRef = useRef<NodeJS.Timeout>();
  const actionFilterTimeoutRef = useRef<NodeJS.Timeout>();

  const handleMouseEnter = () => {
    if (filterTimeoutRef.current) clearTimeout(filterTimeoutRef.current);
    if (!isFilterOpen) {
      if (customFrom || customTo) {
        if (customFrom) {
          const d = new Date(customFrom);
          setTempYearFrom(format(d, 'yyyy'));
          setTempMonthFrom(format(d, 'MM'));
          setTempDayFrom(format(d, 'dd'));
          setTempHourFrom(format(d, 'HH'));
          const m = Math.round(d.getMinutes() / 5) * 5;
          setTempMinFrom(m.toString().padStart(2, '0'));
        }
        if (customTo) {
          const d = new Date(customTo);
          setTempYearTo(format(d, 'yyyy'));
          setTempMonthTo(format(d, 'MM'));
          setTempDayTo(format(d, 'dd'));
          setTempHourTo(format(d, 'HH'));
          const m = Math.round(d.getMinutes() / 5) * 5;
          setTempMinTo(m.toString().padStart(2, '0'));
        }
      } else {
        setTempYearFrom('');
        setTempMonthFrom('');
        setTempDayFrom('');
        setTempHourFrom('');
        setTempMinFrom('');
        
        setTempYearTo('');
        setTempMonthTo('');
        setTempDayTo('');
        setTempHourTo('');
        setTempMinTo('');
      }
      setIsFilterOpen(true);
    }
  };

  const handleMouseLeave = () => {
    if (activeDropdowns > 0) return;
    filterTimeoutRef.current = setTimeout(() => {
      setIsFilterOpen(false);
    }, 800);
  };

  const handleFilterClick = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsFilterActive(prev => !prev);
  };

  useEffect(() => {
    if (!isFilterOpen) return;
    
    if (tempYearFrom && tempMonthFrom && tempDayFrom) {
      const fromD = new Date(`${tempYearFrom}-${tempMonthFrom}-${tempDayFrom}T00:00:00`);
      fromD.setHours(tempHourFrom ? parseInt(tempHourFrom, 10) : 0, tempMinFrom ? parseInt(tempMinFrom, 10) : 0, 0, 0);
      setCustomFrom(fromD.toISOString());
    } else {
      setCustomFrom('');
    }

    if (tempYearTo && tempMonthTo && tempDayTo) {
      const toD = new Date(`${tempYearTo}-${tempMonthTo}-${tempDayTo}T00:00:00`);
      toD.setHours(tempHourTo ? parseInt(tempHourTo, 10) : 23, tempMinTo ? parseInt(tempMinTo, 10) : 59, 59, 999);
      setCustomTo(toD.toISOString());
    } else {
      setCustomTo('');
    }
  }, [tempYearFrom, tempMonthFrom, tempDayFrom, tempYearTo, tempMonthTo, tempDayTo, tempHourFrom, tempHourTo, tempMinFrom, tempMinTo, isFilterOpen]);

  // Auto-activate filter as soon as a value is set
  useEffect(() => {
    if (customFrom || customTo) {
      setIsFilterActive(true);
    }
  }, [customFrom, customTo]);

  // PDF Preview State
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewTitle, setPreviewTitle] = useState<string | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isLoadingPdf, setIsLoadingPdf] = useState(false);
  const [pdfError, setPdfError] = useState(false);

  // User Activity Dialog State
  const [selectedUserDialog, setSelectedUserDialog] = useState<{
    userId: string | null;
    userName: string;
    isSystem: boolean;
  } | null>(null);

  const dateRange = useMemo(
    () => {
      if (!isFilterActive) return getDateRange('', '');
      return getDateRange(customFrom, customTo);
    },
    [customFrom, customTo, isFilterActive]
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

  // ── Client-side text search & action filters ─────────────────────────────────
  const filteredLogs = useMemo(() => {
    let result = logs;

    if (isActionFilterActive && selectedActions.length > 0) {
      result = result.filter(log => {
        const isProcessed = isProcessingComplete(log);
        if (isProcessed) return selectedActions.includes('feldolgozás');
        return selectedActions.includes(log.action);
      });
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(log =>
        (log.entity_name && log.entity_name.toLowerCase().includes(q)) ||
        log.action.toLowerCase().includes(q) ||
        log.entity.toLowerCase().includes(q)
      );
    }

    return result;
  }, [logs, searchQuery, selectedActions]);

  // ── Handlers ─────────────────────────────────────────────────────────────


  const isLikelyPdf = (log: AuditLogRow) => {
    return log.entity_name?.toLowerCase().endsWith('.pdf') ||
      log.entity === 'számla' ||
      log.entity === 'bérjegyzék' ||
      log.action === 'feltöltés';
  };

  const getDisplayName = (log: AuditLogRow) => {
    if (!log.entity_name) return '';
    if (isLikelyPdf(log) && !log.entity_name.toLowerCase().endsWith('.pdf')) {
      return `${log.entity_name}.pdf`;
    }
    return log.entity_name;
  };

  const handlePdfClick = async (log: AuditLogRow) => {
    if (!isLikelyPdf(log)) return;

    setPreviewTitle(getDisplayName(log));
    setIsPreviewOpen(true);
    setIsLoadingPdf(true);
    setPdfError(false);

    try {
      let url = null;
      const originalName = log.entity_name || '';

      if (log.entity === 'számla') {
        const { data } = await supabase.from('invoices').select('image_url, melleklet_url').eq('bizonylatsorszam', originalName).limit(1).maybeSingle();
        url = data?.melleklet_url || data?.image_url;
      }

      if (!url) {
        const details = log.details as any;
        const sourceTable = details?.table;
        const tablesToCheck = sourceTable ? [sourceTable] : ['invoice_uploads', 'salary_files', 'bank_statement_uploads'];

        for (const t of tablesToCheck) {
          let { data } = await supabase.from(t as any).select('file_url').eq('file_name', originalName).limit(1).maybeSingle();
          let currentData = data as any;
          if (!currentData?.file_url && !originalName.toLowerCase().endsWith('.pdf')) {
            const res = await supabase.from(t as any).select('file_url').eq('file_name', originalName + '.pdf').limit(1).maybeSingle();
            currentData = res.data as any;
          }
          if (currentData?.file_url) {
            url = currentData.file_url;
            break;
          }
        }
      }

      if (!url) throw new Error('File not found in any related tables');
      setPreviewUrl(url);
    } catch (err) {
      console.error('PDF Preview Error:', err);
      setPdfError(true);
    } finally {
      setIsLoadingPdf(false);
    }
  };

  return (
    <>
      <Sheet open={isOpen} onOpenChange={setIsOpen}>
        <SheetTrigger asChild>
          <Button variant="outline" size="sm" className="h-9">
            <History className="mr-2 h-4 w-4" />
            Műveleti napló
          </Button>
        </SheetTrigger>
        <SheetContent className="w-full sm:max-w-4xl flex flex-col overflow-hidden p-0" onCloseAutoFocus={(e) => e.preventDefault()}>
          <SheetHeader className="px-12 pt-6 pb-0">
            <SheetTitle>Műveleti napló</SheetTitle>
            <SheetDescription>Az aktuális cég eseményeinek idővonala.</SheetDescription>
          </SheetHeader>

          {/* ── STICKY FILTER BAR ─────────────────────────────────────────── */}
          <div className="sticky top-0 z-20 bg-background border-b border-border/50 px-12 py-3 space-y-3">

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
          </div>

          {/* ── TIMELINE CONTENT ──────────────────────────────────────────── */}
          <div className="flex-1 overflow-y-auto px-12 py-4">

            {/* Timeline Header Row (for filters) */}
            <div className="flex flex-col px-3 mb-2">
              {/* Row 1: Buttons — mirrors table row layout: w-[42px] icon | gap-4 | min-w-[48px] time */}
              <div className="flex items-center">
                {/* Action filter button — sits in icon column position (w-[42px]) */}
                <div className="w-[42px] flex justify-center shrink-0">
                  <Popover open={isActionFilterOpen} onOpenChange={setIsActionFilterOpen}>
                    <PopoverTrigger asChild>
                      <div
                        onMouseEnter={() => {
                          if (actionFilterTimeoutRef.current) clearTimeout(actionFilterTimeoutRef.current);
                          setIsActionFilterOpen(true);
                        }}
                        onMouseLeave={() => {
                          actionFilterTimeoutRef.current = setTimeout(() => setIsActionFilterOpen(false), 800);
                        }}
                      >
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className={`h-9 w-9 rounded-full flex items-center justify-center transition-none ${(isActionFilterActive && selectedActions.length > 0) ? 'bg-primary/20 text-primary' : 'text-muted-foreground hover:bg-secondary'}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (selectedActions.length > 0) {
                              setIsActionFilterActive(prev => !prev);
                            } else {
                              setIsActionFilterOpen(prev => !prev);
                            }
                          }}
                        >
                          <Filter className={`h-[18px] w-[18px] ${(isActionFilterActive && selectedActions.length > 0) ? 'fill-primary' : ''}`} />
                        </Button>
                      </div>
                    </PopoverTrigger>
                    <PopoverContent 
                      className="w-[200px] p-2 z-[200]" 
                      align="start"
                      alignOffset={-48}
                      sideOffset={4}
                      onMouseEnter={() => {
                        if (actionFilterTimeoutRef.current) clearTimeout(actionFilterTimeoutRef.current);
                      }}
                      onMouseLeave={() => {
                        actionFilterTimeoutRef.current = setTimeout(() => setIsActionFilterOpen(false), 800);
                      }}
                    >
                      <div className="space-y-1">
                        <div className="px-2 pt-1 pb-2">
                          <h4 className="font-medium text-xs leading-none">Műveletek szűrése</h4>
                        </div>
                        <div className="grid grid-cols-1 gap-0.5">
                          {AVAILABLE_ACTIONS.map(action => {
                            const isSelected = selectedActions.includes(action.id);
                            return (
                              <div 
                                key={action.id}
                                className={`flex items-center justify-between px-2 py-1.5 rounded-md cursor-pointer hover:bg-accent group ${isSelected ? 'bg-accent/50' : ''}`}
                                onClick={() => {
                                  setSelectedActions(prev => {
                                    const next = isSelected 
                                      ? prev.filter(id => id !== action.id)
                                      : [...prev, action.id];
                                    if (next.length > 0) setIsActionFilterActive(true);
                                    else setIsActionFilterActive(false);
                                    return next;
                                  });
                                }}
                              >
                                <div className="flex items-center gap-2">
                                  <div className={`h-4 w-4 rounded-full flex items-center justify-center ${action.color}`}>
                                    <action.icon className="h-2 w-2" />
                                  </div>
                                  <span className={`text-xs ${isSelected ? 'font-medium' : ''}`}>{action.label}</span>
                                </div>
                                {isSelected && <Check className="h-3 w-3" />}
                              </div>
                            );
                          })}
                        </div>
                        {selectedActions.length > 0 && (
                          <div className="pt-2 px-1">
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="w-full h-7 text-[10px] text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors" 
                              onClick={() => {
                                setSelectedActions([]);
                                setIsActionFilterActive(false);
                              }}
                            >
                              Szűrések törlése
                            </Button>
                          </div>
                        )}
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>

                {/* gap-4 spacer to match table gap */}
                <div className="w-4 shrink-0" />

                {/* Time Filter button — sits in time column position (w-[48px], centered) */}
                <div className="w-[48px] flex justify-center shrink-0">
                  <Popover open={isFilterOpen} onOpenChange={setIsFilterOpen}>
                    <PopoverTrigger asChild>
                      <div 
                        onMouseEnter={handleMouseEnter}
                        onMouseLeave={handleMouseLeave}
                      >
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className={`h-9 w-9 rounded-full flex items-center justify-center transition-none ${(isFilterActive && (customFrom || customTo)) ? 'bg-primary/20 text-primary' : 'text-muted-foreground hover:bg-secondary'}`}
                          onClick={handleFilterClick}
                        >
                          <Filter className={`h-[18px] w-[18px] ${(isFilterActive && (customFrom || customTo)) ? 'fill-primary' : ''}`} />
                        </Button>
                      </div>
                    </PopoverTrigger>
                    <PopoverContent 
                      className="w-[280px] p-3 z-[200]" 
                      align="center"
                      sideOffset={4}
                      onMouseEnter={handleMouseEnter}
                      onMouseLeave={handleMouseLeave}
                    >
                      <div className="space-y-3">
                        <h4 className="font-medium text-sm leading-none text-center">Időszak szűrése</h4>
                        
                        <div className="space-y-2">
                          <div className="space-y-2 bg-secondary/10 p-2.5 rounded-md border border-border/50 pointer-events-auto">
                            <label className="text-xs font-semibold text-foreground">Mettől</label>
                            <div className="space-y-1.5">
                              <div className="flex justify-center">
                                <LocalSelect 
                                  value={tempYearFrom} 
                                  onChange={(v) => {
                                    setTempYearFrom(v);
                                    if (!tempMonthFrom) setTempMonthFrom('01');
                                    if (!tempDayFrom) setTempDayFrom('01');
                                  }} 
                                  options={YEAR_OPTIONS} 
                                  placeholder="Év"
                                  className="w-[90px]"
                                  onOpenChange={(op) => setActiveDropdowns(p => op ? p + 1 : Math.max(0, p - 1))}
                                />
                              </div>
                              <div className="flex gap-1.5 items-center">
                                <LocalSelect 
                                  value={tempMonthFrom} 
                                  onChange={setTempMonthFrom} 
                                  options={MONTH_OPTIONS} 
                                  placeholder="Hó"
                                  className="flex-1"
                                  onOpenChange={(op) => setActiveDropdowns(p => op ? p + 1 : Math.max(0, p - 1))}
                                />
                                <LocalSelect 
                                  value={tempDayFrom} 
                                  onChange={setTempDayFrom} 
                                  options={DAY_OPTIONS} 
                                  placeholder="Nap"
                                  className="flex-1"
                                  onOpenChange={(op) => setActiveDropdowns(p => op ? p + 1 : Math.max(0, p - 1))}
                                />
                              </div>
                              <div className="flex gap-1.5 items-center">
                                <LocalSelect 
                                  value={tempHourFrom} 
                                  onChange={setTempHourFrom} 
                                  options={HOUR_OPTIONS} 
                                  placeholder="Óra"
                                  className="flex-1"
                                  onOpenChange={(op) => setActiveDropdowns(p => op ? p + 1 : Math.max(0, p - 1))}
                                />
                                <span className="font-bold text-muted-foreground pb-0.5">:</span>
                                <LocalSelect 
                                  value={tempMinFrom} 
                                  onChange={setTempMinFrom} 
                                  options={MIN_OPTIONS} 
                                  placeholder="Perc"
                                  className="flex-1"
                                  onOpenChange={(op) => setActiveDropdowns(p => op ? p + 1 : Math.max(0, p - 1))}
                                />
                              </div>
                            </div>
                          </div>

                          <div className="space-y-2 bg-secondary/10 p-2.5 rounded-md border border-border/50 pointer-events-auto">
                            <label className="text-xs font-semibold text-foreground">Meddig</label>
                            <div className="space-y-1.5">
                              <div className="flex justify-center">
                                <LocalSelect 
                                  value={tempYearTo} 
                                  onChange={(v) => {
                                    setTempYearTo(v);
                                    if (!tempMonthTo) setTempMonthTo('01');
                                    if (!tempDayTo) setTempDayTo('01');
                                  }} 
                                  options={YEAR_OPTIONS} 
                                  placeholder="Év"
                                  className="w-[90px]"
                                  onOpenChange={(op) => setActiveDropdowns(p => op ? p + 1 : Math.max(0, p - 1))}
                                />
                              </div>
                              <div className="flex gap-1.5 items-center">
                                <LocalSelect 
                                  value={tempMonthTo} 
                                  onChange={setTempMonthTo} 
                                  options={MONTH_OPTIONS} 
                                  placeholder="Hó"
                                  className="flex-1"
                                  onOpenChange={(op) => setActiveDropdowns(p => op ? p + 1 : Math.max(0, p - 1))}
                                />
                                <LocalSelect 
                                  value={tempDayTo} 
                                  onChange={setTempDayTo} 
                                  options={DAY_OPTIONS} 
                                  placeholder="Nap"
                                  className="flex-1"
                                  onOpenChange={(op) => setActiveDropdowns(p => op ? p + 1 : Math.max(0, p - 1))}
                                />
                              </div>
                              <div className="flex gap-1.5 items-center">
                                <LocalSelect 
                                  value={tempHourTo} 
                                  onChange={setTempHourTo} 
                                  options={HOUR_OPTIONS} 
                                  placeholder="Óra"
                                  className="flex-1"
                                  onOpenChange={(op) => setActiveDropdowns(p => op ? p + 1 : Math.max(0, p - 1))}
                                />
                                <span className="font-bold text-muted-foreground pb-0.5">:</span>
                                <LocalSelect 
                                  value={tempMinTo} 
                                  onChange={setTempMinTo} 
                                  options={MIN_OPTIONS} 
                                  placeholder="Perc"
                                  className="flex-1"
                                  onOpenChange={(op) => setActiveDropdowns(p => op ? p + 1 : Math.max(0, p - 1))}
                                />
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="pt-1 flex gap-2">
                          {(tempYearFrom || tempYearTo || customFrom || customTo) && (
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="flex-1 h-8 text-xs text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors" 
                              onClick={(e) => {
                                e.preventDefault();
                                setIsFilterActive(false);
                                setTempYearFrom('');
                                setTempMonthFrom('');
                                setTempDayFrom('');
                                setTempHourFrom('');
                                setTempMinFrom('');
                                setTempYearTo('');
                                setTempMonthTo('');
                                setTempDayTo('');
                                setTempHourTo('');
                                setTempMinTo('');
                                setCustomFrom('');
                                setCustomTo('');
                              }}
                            >
                              Szűrés törlése
                            </Button>
                          )}
                        </div>
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="flex-1" />
              </div>

              {/* Row 2: Indicators — same column structure as table rows */}
              {((isActionFilterActive && selectedActions.length > 0) || (isFilterActive && (customFrom || customTo))) && (
                <div className="flex items-start mt-2">
                  {/* Action icons — single column, no circle, 20% smaller, fits within w-[42px] */}
                  <div className="w-[42px] flex justify-center shrink-0 overflow-visible">
                    {(isActionFilterActive && selectedActions.length > 0) && (
                      <div className="flex flex-col items-center gap-0.5">
                        {selectedActions.map(id => {
                          const action = AVAILABLE_ACTIONS.find(a => a.id === id);
                          if (!action) return null;
                          const iconColorClass = action.color.split(' ').find(c => c.startsWith('text-')) || 'text-primary';
                          return (
                            <action.icon key={id} className={`h-[29px] w-[29px] ${iconColorClass}`} />
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* gap-4 spacer */}
                  <div className="w-4 shrink-0" />

                  {/* Time display — exact w-[48px] so center is fixed at same position as time button */}
                  <div className="w-[48px] flex justify-center shrink-0 overflow-visible">
                    {(isFilterActive && (customFrom || customTo)) && (
                      <div className="flex flex-col items-center text-[9px] font-bold text-primary/70 tracking-wider whitespace-nowrap pointer-events-none leading-tight">
                        {customFrom ? (
                          <>
                            <span>{format(new Date(customFrom), 'yyyy')}</span>
                            <span>{format(new Date(customFrom), 'MM.dd. HH:mm')}</span>
                          </>
                        ) : (
                          <>
                            <span className="opacity-0">0000</span>
                            <span className="opacity-0">00.00. 00:00</span>
                          </>
                        )}
                        <span className="my-0.5">-</span>
                        {customTo ? (
                          <>
                            <span>{format(new Date(customTo), 'yyyy')}</span>
                            <span>{format(new Date(customTo), 'MM.dd. HH:mm')}</span>
                          </>
                        ) : (
                          <>
                            <span className="opacity-0">0000</span>
                            <span className="opacity-0">00.00. 00:00</span>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>


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
                <div className="space-y-1">
                  {filteredLogs.map((log, index) => {
                    const processed = isProcessingComplete(log);
                    const actionCfg = processed
                      ? { icon: CheckCircle2, color: 'text-green-600 bg-green-50 dark:bg-green-950/30', label: 'feldolgozta' }
                      : (ACTION_CONFIG[log.action] || ACTION_CONFIG['módosítás']);
                    const entityCfg = ENTITY_CONFIG[log.entity] || { label: log.entity, icon: FileText };
                    const userName = getUserName(log.user_id);
                    const ActionIcon = actionCfg.icon;
                    const isSystemAction = processed; // is_system from trigger details

                    return (
                      <div key={log.id} className={`relative flex items-center gap-4 py-3 px-3 rounded-lg transition-colors ${index % 2 === 0 ? 'bg-secondary/30' : 'bg-transparent'}`}>
                        {/* Icon dot */}
                        <div className="relative z-10 shrink-0">
                          <div className={`flex h-[42px] w-[42px] items-center justify-center rounded-full border border-border/50 ${actionCfg.color}`}>
                            <ActionIcon className="h-5 w-5" />
                          </div>
                          <button
                            onClick={() => setSelectedUserDialog({ userId: log.user_id, userName, isSystem: !log.user_id || isSystemAction })}
                            className={`absolute -bottom-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full border-2 border-background transition-transform hover:scale-110 outline-none ${(!log.user_id || isSystemAction) ? 'bg-indigo-100 text-indigo-600' : 'bg-blue-100 text-blue-600'}`}
                            title={`Kattints a részletekért: ${userName}`}
                          >
                            {(!log.user_id || isSystemAction) ? (
                              <Bot className="h-[10px] w-[10px]" />
                            ) : (
                              <User className="h-[10px] w-[10px]" />
                            )}
                          </button>
                        </div>

                        {/* Time & Date */}
                        <div className="shrink-0 flex flex-col items-center justify-center min-w-[48px] text-center">
                          <span className="text-[15px] font-bold text-foreground tracking-tight leading-none mb-1">
                            {format(new Date(log.created_at), 'HH:mm', { locale: hu })}
                          </span>
                          <div className="flex flex-col items-center text-[10px] text-muted-foreground font-medium uppercase tracking-wide leading-tight mt-0.5">
                            <span>{format(new Date(log.created_at), 'MMM', { locale: hu })}</span>
                            <span>{format(new Date(log.created_at), 'd.', { locale: hu })}</span>
                          </div>
                        </div>

                        {/* Content */}
                        <div className="min-w-0 flex-1">
                          {isSystemAction ? (
                            // Processing complete message — attributed to original uploader
                            <p className="text-sm leading-snug">
                              <button
                                onClick={() => setSelectedUserDialog({ userId: log.user_id, userName, isSystem: !log.user_id || isSystemAction })}
                                className="font-semibold hover:text-primary transition-colors hover:underline outline-none align-bottom overflow-hidden inline"
                              >
                                {userName}
                              </button>
                              {' '}
                              <span className="text-muted-foreground">feltöltése feldolgozva:</span>
                              {' '}
                              <span className="font-medium text-green-600 dark:text-green-400">
                                {getDisplayName(log) ? (
                                  isLikelyPdf(log) ? (
                                    <button onClick={() => handlePdfClick(log)} className="hover:underline hover:text-green-700 dark:hover:text-green-300 inline-flex items-center gap-1 transition-colors relative top-px">
                                      {getDisplayName(log)}
                                    </button>
                                  ) : getDisplayName(log)
                                ) : 'ismeretlen fájl'}
                              </span>
                            </p>
                          ) : (
                            // Normal activity message
                            <p className="text-sm leading-snug">
                              <button
                                onClick={() => setSelectedUserDialog({ userId: log.user_id, userName, isSystem: !log.user_id || isSystemAction })}
                                className="font-semibold hover:text-primary transition-colors hover:underline outline-none align-bottom overflow-hidden inline"
                              >
                                {userName}
                              </button>
                              {' '}
                              <span className="text-muted-foreground">{actionCfg.label} egy {entityCfg.label}</span>
                              {getDisplayName(log) && (
                                <>
                                  {': '}
                                  {isLikelyPdf(log) ? (
                                    <button onClick={() => handlePdfClick(log)} className="font-medium text-blue-500 hover:text-blue-600 hover:underline inline-flex items-center gap-1 transition-colors relative top-px">
                                      {getDisplayName(log)}
                                      <ExternalLink className="h-3 w-3" />
                                    </button>
                                  ) : (
                                    <span className="font-medium text-foreground">{getDisplayName(log)}</span>
                                  )}
                                </>
                              )}
                            </p>
                          )}
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

      {/* Custom PDF Preview Dialog specific to Audit Logs */}
      <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col p-6">
          <DialogHeader className="mb-2">
            <DialogTitle className="truncate pr-8" title={previewTitle || ''}>{previewTitle}</DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-auto min-h-[50vh] flex flex-col relative w-full items-center justify-center p-0 rounded-md border bg-muted/20">
            {isLoadingPdf && (
              <div className="absolute inset-0 flex items-center justify-center bg-background/50 z-10 backdrop-blur-sm">
                <div className="flex flex-col items-center gap-3 text-muted-foreground">
                  <div className="h-6 w-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                  <p className="text-sm font-medium">Dokumentum keresése és betöltése...</p>
                </div>
              </div>
            )}

            {pdfError ? (
              <div className="text-center p-8 text-muted-foreground flex flex-col items-center max-w-sm">
                <AlertCircle className="h-10 w-10 text-destructive mb-3" />
                <p className="font-medium text-foreground">A dokumentum nem tölthető be.</p>
                <p className="text-sm opacity-80 mt-1">Lehet, hogy a fájl törlésre került a tárhelyről, vagy a korábbi naplóbejegyzésből nem azonosítható be a forrás.</p>
              </div>
            ) : previewUrl ? (
              <iframe
                src={previewUrl}
                className={`w-full h-[65vh] transition-opacity duration-300 ${isLoadingPdf ? 'opacity-0' : 'opacity-100'}`}
                onLoad={() => setIsLoadingPdf(false)}
                onError={() => {
                  setPdfError(true);
                  setIsLoadingPdf(false);
                }}
              />
            ) : null}
          </div>

          {previewUrl && !pdfError && !isLoadingPdf && (
            <div className="flex justify-center mt-4">
              <Button onClick={() => window.open(previewUrl, '_blank')} variant="outline" size="sm">
                <ExternalLink className="h-4 w-4 mr-2" />
                Megnyitás új ablakban
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {selectedUserDialog && (
        <UserActivityDialog
          userId={selectedUserDialog.userId}
          userName={selectedUserDialog.userName}
          isSystem={selectedUserDialog.isSystem}
          companyId={companyId!}
          open={!!selectedUserDialog}
          onOpenChange={(open) => {
            if (!open) setSelectedUserDialog(null);
          }}
        />
      )}
    </>
  );
}
