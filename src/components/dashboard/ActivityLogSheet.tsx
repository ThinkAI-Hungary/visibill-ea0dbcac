import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useCompany } from '@/contexts/CompanyContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

import {
  Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger,
} from '@/components/ui/sheet';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  History, Plus, Pencil, Trash2, Upload, Link2, FileText, Banknote,
  ArrowLeftRight, Tag, ClipboardList, Search, User, CalendarDays, CheckCircle2, Bot, ExternalLink, AlertCircle, Filter, ListFilter, Check, ChevronRight
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

function isInvoiceProcessed(log: AuditLogRow): boolean {
  if (!isProcessingComplete(log)) return false;
  const d = log.details as Record<string, any>;
  return d.processing_type === 'invoice_processed';
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
  // Always-fresh ref so the document mousedown handler can read current search
  const searchRef = useRef('');

  const updateSearch = (v: string) => {
    setSearch(v);
    searchRef.current = v;
  };

  const tryAutoSelect = () => {
    const currentSearch = searchRef.current;
    if (!currentSearch) return;
    const matched = options.filter(o => o.label.toLowerCase().includes(currentSearch.toLowerCase()));
    if (matched.length === 1) {
      onChange(matched[0].value);
    }
  };

  const closeSelect = () => {
    setOpen(false);
    onOpenChange?.(false);
    searchRef.current = '';
    setSearch('');
  };

  const openSelect = () => {
    setOpen(true);
    onOpenChange?.(true);
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        // Auto-select before closing if exactly one option matches
        tryAutoSelect();
        closeSelect();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open, options, onChange]);

  const filteredOptions = options.filter(o => o.label.toLowerCase().includes(search.toLowerCase()));
  
  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <div 
        className="flex h-8 w-full items-center justify-between rounded-md border border-input bg-background/50 px-2 py-1 text-xs shadow-sm cursor-text hover:bg-accent/50 transition-colors"
        onClick={() => { if (!open) openSelect(); }}
      >
        {open ? (
          <input
            ref={inputRef}
            type="text"
            className="w-full bg-transparent outline-none truncate font-medium placeholder:text-muted-foreground leading-none"
            value={search}
            onChange={(e) => updateSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && filteredOptions.length === 1) {
                e.preventDefault();
                onChange(filteredOptions[0].value);
                closeSelect();
              }
              if (e.key === 'Escape') closeSelect();
            }}
            placeholder={options.find(o => o.value === value)?.label || placeholder}
            onBlur={() => {
              // Fallback: fires when the entire browser window loses focus
              tryAutoSelect();
              closeSelect();
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
                  closeSelect(); 
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

  // ── Filter state ─────────────────────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState('');

  // Unified filter menu
  const [isMainFilterOpen, setIsMainFilterOpen] = useState(false);
  const [activeSubPanel, setActiveSubPanel] = useState<'actions' | 'time' | 'users' | 'docs' | null>(null);
  const mainFilterTimeoutRef = useRef<NodeJS.Timeout>();
  const [userSearch, setUserSearch] = useState('');

  // Action filter
  const [selectedActions, setSelectedActions] = useState<string[]>([]);
  const [isActionFilterActive, setIsActionFilterActive] = useState(false);

  // Time filter
  const [customFrom, setCustomFrom] = useState<string>('');
  const [customTo, setCustomTo] = useState<string>('');
  const [isFilterActive, setIsFilterActive] = useState(false);
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
  const [activeDropdowns, setActiveDropdowns] = useState(0);
  const filterTimeoutRef = useRef<NodeJS.Timeout>();

  // User filter (multi-select, client-side)
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [isUserFilterActive, setIsUserFilterActive] = useState(false);

  // Document filter
  const [docSearchQuery, setDocSearchQuery] = useState('');
  const [isDocFilterActive, setIsDocFilterActive] = useState(false);

  const [isOpen, setIsOpen] = useState(false);

  // Time sub-panel: populate temp values when panel opens
  const handleTimeSubPanelOpen = () => {
    if (customFrom) {
      const d = new Date(customFrom);
      setTempYearFrom(format(d, 'yyyy'));
      setTempMonthFrom(format(d, 'MM'));
      setTempDayFrom(format(d, 'dd'));
      setTempHourFrom(format(d, 'HH'));
      setTempMinFrom((Math.round(d.getMinutes() / 5) * 5).toString().padStart(2, '0'));
    }
    if (customTo) {
      const d = new Date(customTo);
      setTempYearTo(format(d, 'yyyy'));
      setTempMonthTo(format(d, 'MM'));
      setTempDayTo(format(d, 'dd'));
      setTempHourTo(format(d, 'HH'));
      setTempMinTo((Math.round(d.getMinutes() / 5) * 5).toString().padStart(2, '0'));
    }
  };

  const handleMainFilterMouseEnter = () => {
    if (mainFilterTimeoutRef.current) clearTimeout(mainFilterTimeoutRef.current);
    setIsMainFilterOpen(true);
  };

  const handleMainFilterMouseLeave = () => {
    if (activeDropdowns > 0) return;
    mainFilterTimeoutRef.current = setTimeout(() => {
      setIsMainFilterOpen(false);
      setActiveSubPanel(null);
    }, 600);
  };

  // Build customFrom/customTo from temp values whenever time sub-panel is active
  useEffect(() => {
    if (activeSubPanel !== 'time') return;
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
  }, [tempYearFrom, tempMonthFrom, tempDayFrom, tempYearTo, tempMonthTo, tempDayTo, tempHourFrom, tempHourTo, tempMinFrom, tempMinTo, activeSubPanel]);

  // Auto-activate time filter when values are set
  useEffect(() => {
    if (customFrom || customTo) setIsFilterActive(true);
  }, [customFrom, customTo]);

  // PDF Preview State
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewTitle, setPreviewTitle] = useState<string | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isLoadingPdf, setIsLoadingPdf] = useState(false);
  const [pdfError, setPdfError] = useState(false);
  const [pdfErrorType, setPdfErrorType] = useState<'not_found' | 'unreachable' | 'invalid_format' | null>(null);
  // For non-PDF files that are images: show inline with a notice
  const [previewIsImage, setPreviewIsImage] = useState(false);
  const [previewActualExt, setPreviewActualExt] = useState<string | null>(null);
  // Track the log entry currently being previewed (for retry)
  const [currentPreviewLog, setCurrentPreviewLog] = useState<AuditLogRow | null>(null);
  // Track blob URL so we can revoke it when a new one is created
  const blobUrlRef = useRef<string | null>(null);

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
    queryKey: ['audit_logs', companyId, dateRange.from, dateRange.to],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('audit_logs' as any)
        .select('*')
        .eq('company_id', companyId!)
        .gte('created_at', dateRange.from)
        .lte('created_at', dateRange.to)
        .order('created_at', { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data || []) as unknown as AuditLogRow[];
    },
    enabled: !!companyId && isOpen,
    staleTime: 30_000,
  });

  // ── Company members ──────────────────────────────────────────────────────
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
      return (profiles || []).map(p => ({ user_id: p.user_id, name: p.name })) as CompanyMember[];
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

  // Strips everything that isn't a letter or digit — ignores dots, dashes, underscores, spaces, etc.
  const normalize = (s: string) => s.replace(/[^a-zA-Z0-9\u00C0-\u024F]/g, '').toLowerCase();

  const filteredLogs = useMemo(() => {
    let result = logs;

    // 1. Action filter
    if (isActionFilterActive && selectedActions.length > 0) {
      result = result.filter(log => {
        const isProcessed = isProcessingComplete(log);
        if (isProcessed) return selectedActions.includes('feldolgozás');
        return selectedActions.includes(log.action);
      });
    }

    // 2. Time filter (already applied server-side via customFrom/customTo, but guard here too)
    if (isFilterActive && (customFrom || customTo)) {
      result = result.filter(log => {
        const t = new Date(log.created_at).getTime();
        if (customFrom && t < new Date(customFrom).getTime()) return false;
        if (customTo && t > new Date(customTo).getTime()) return false;
        return true;
      });
    }

    // 3. User filter
    if (isUserFilterActive && selectedUserIds.length > 0) {
      result = result.filter(log => {
        if (selectedUserIds.includes('__system__') && !log.user_id) return true;
        return log.user_id ? selectedUserIds.includes(log.user_id) : false;
      });
    }

    // 4. Doc filter — alphanumeric only, ignores all punctuation
    if (isDocFilterActive && docSearchQuery.trim()) {
      const q = normalize(docSearchQuery);
      result = result.filter(log => {
        const raw = log.entity_name || '';
        const name = normalize(raw);
        // Also match against display name (getDisplayName may append .pdf)
        const nameWithPdf = raw.toLowerCase().endsWith('.pdf') ? name : normalize(raw + '.pdf');
        return name.includes(q) || nameWithPdf.includes(q);
      });
    }

    // 5. Search bar — runs on top of already-filtered result, alphanumeric only
    if (searchQuery.trim()) {
      const q = normalize(searchQuery);
      result = result.filter(log => {
        const raw = log.entity_name || '';
        const name = normalize(raw);
        // Also match against display name (getDisplayName may append .pdf)
        const nameWithPdf = raw.toLowerCase().endsWith('.pdf') ? name : normalize(raw + '.pdf');
        const action = normalize(log.action);
        const entity = normalize(log.entity);
        const user = normalize(getUserName(log.user_id));
        return name.includes(q) || nameWithPdf.includes(q) || action.includes(q) || entity.includes(q) || user.includes(q);
      });
    }

    return result;
  }, [logs, searchQuery, selectedActions, isActionFilterActive, selectedUserIds, isUserFilterActive, docSearchQuery, isDocFilterActive, isFilterActive, customFrom, customTo, getUserName]);


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

    // Revoke previous blob URL to free memory
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = null;
    }

    setCurrentPreviewLog(log);
    setPreviewTitle(getDisplayName(log));
    setIsPreviewOpen(true);
    setIsLoadingPdf(true);
    setPdfError(false);
    setPdfErrorType(null);
    setPreviewIsImage(false);
    setPreviewActualExt(null);
    setPreviewUrl('');

    try {
      let url: string | null = null;
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

      if (!url) {
        setPdfErrorType('not_found');
        throw new Error('File not found in any related tables');
      }

      // Fetch as blob to bypass Content-Disposition: attachment headers
      const response = await fetch(url);
      if (!response.ok) {
        setPdfErrorType('unreachable');
        throw new Error(`HTTP ${response.status}`);
      }
      const blob = await response.blob();

      // Detect actual file type from magic bytes (first 12 bytes)
      const headerBytes = await blob.slice(0, 12).arrayBuffer();
      const h = new Uint8Array(headerBytes);

      const isPdf  = h[0]===0x25 && h[1]===0x50 && h[2]===0x44 && h[3]===0x46; // %PDF
      const isPng  = h[0]===0x89 && h[1]===0x50 && h[2]===0x4E && h[3]===0x47; // \x89PNG
      const isJpeg = h[0]===0xFF && h[1]===0xD8 && h[2]===0xFF;
      const isGif  = h[0]===0x47 && h[1]===0x49 && h[2]===0x46 && h[3]===0x38; // GIF8
      const isWebp = h[0]===0x52 && h[1]===0x49 && h[2]===0x46 && h[3]===0x46 && // RIFF
                     h[8]===0x57 && h[9]===0x45 && h[10]===0x42 && h[11]===0x50; // WEBP
      const isBmp  = h[0]===0x42 && h[1]===0x4D; // BM

      if (isPdf) {
        const blobUrl = URL.createObjectURL(new Blob([blob], { type: 'application/pdf' }));
        blobUrlRef.current = blobUrl;
        setPreviewUrl(blobUrl);
      } else if (isPng || isJpeg || isGif || isWebp || isBmp) {
        const mimeMap: Record<string, string> = {
          png: 'image/png', jpg: 'image/jpeg', gif: 'image/gif',
          webp: 'image/webp', bmp: 'image/bmp',
        };
        const ext = isPng ? 'png' : isJpeg ? 'jpg' : isGif ? 'gif' : isWebp ? 'webp' : 'bmp';
        const mime = mimeMap[ext];
        const blobUrl = URL.createObjectURL(new Blob([blob], { type: mime }));
        blobUrlRef.current = blobUrl;
        setPreviewIsImage(true);
        setPreviewActualExt(ext);
        setPreviewUrl(blobUrl);
      } else {
        setPdfErrorType('invalid_format');
        throw new Error('Unrecognized file format');
      }
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
        <SheetContent className="w-full sm:max-w-[720px] flex flex-col overflow-hidden p-0" onCloseAutoFocus={(e) => e.preventDefault()}>
          <SheetHeader className="px-12 pt-6 pb-0">
            <SheetTitle>Műveleti napló</SheetTitle>
            <SheetDescription>Az aktuális cég eseményeinek idővonala.</SheetDescription>
          </SheetHeader>

          {/* ── STICKY HEADER (search + filter) ─────────────────────────────── */}
          <div className="sticky top-0 z-20 bg-background border-b border-border/50 px-12 py-3 space-y-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Keresés név, művelet..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 h-8 text-sm bg-secondary/30 border-border/50"
              />
            </div>



            {/* Unified filter button + indicators */}
            <div className="flex flex-col px-3">
              {/* Filter button row — at icon column position */}
              <div className="flex items-center">
                <div className="w-[42px] flex justify-center shrink-0">
                  <Popover open={isMainFilterOpen} onOpenChange={(open) => { setIsMainFilterOpen(open); if (!open) setActiveSubPanel(null); }}>
                    <PopoverTrigger asChild>
                      <div
                        onMouseEnter={handleMainFilterMouseEnter}
                        onMouseLeave={handleMainFilterMouseLeave}
                      >
                        <Button
                          variant="ghost"
                          size="icon"
                          className={`h-9 w-9 rounded-full flex items-center justify-center transition-none ${
                            (isActionFilterActive && selectedActions.length > 0) || (isFilterActive && (customFrom || customTo)) || (isUserFilterActive && selectedUserIds.length > 0) || (isDocFilterActive && docSearchQuery.trim())
                              ? 'bg-primary/20 text-primary'
                              : 'text-muted-foreground hover:bg-secondary'
                          }`}
                        >
                          <Filter className={`h-[18px] w-[18px] ${
                            (isActionFilterActive && selectedActions.length > 0) || (isFilterActive && (customFrom || customTo)) || (isUserFilterActive && selectedUserIds.length > 0) || (isDocFilterActive && docSearchQuery.trim())
                              ? 'fill-primary' : ''
                          }`} />
                        </Button>
                      </div>
                    </PopoverTrigger>
                    <PopoverContent
                      className="w-[180px] p-0 z-[200] overflow-visible"
                      align="start"
                      sideOffset={4}
                      onMouseEnter={handleMainFilterMouseEnter}
                      onMouseLeave={handleMainFilterMouseLeave}
                    >
                      <div className="relative">
                        {/* Left panel: category list — fixed width, matches popover */}
                        <div className="w-full py-1">
                          {([
                            { id: 'actions' as const, label: 'Műveletek szűrése', active: isActionFilterActive && selectedActions.length > 0 },
                            { id: 'time' as const, label: 'Időszak szűrése', active: isFilterActive && !!(customFrom || customTo) },
                            { id: 'users' as const, label: 'Felhasználók szűrése', active: isUserFilterActive && selectedUserIds.length > 0 },
                            { id: 'docs' as const, label: 'Dokumentumok szűrése', active: isDocFilterActive && !!docSearchQuery.trim() },
                          ] as const).map(item => (
                            <div
                              key={item.id}
                              className={`flex items-center justify-between px-3 py-2 cursor-pointer text-xs transition-colors ${activeSubPanel === item.id ? 'bg-accent text-accent-foreground' : 'hover:bg-accent/60'}`}
                              onMouseEnter={() => {
                                setActiveSubPanel(item.id);
                                if (item.id === 'time') handleTimeSubPanelOpen();
                              }}
                            >
                              <span className={item.active ? 'font-semibold text-primary' : ''}>{item.label}</span>
                              <div className="flex items-center gap-1">
                                {item.active && <div className="h-1.5 w-1.5 rounded-full bg-primary" />}
                                <ChevronRight className="h-3 w-3 text-muted-foreground" />
                              </div>
                            </div>
                          ))}
                        </div>

                        {/* Right panel: sub-content — floats absolutely to the right */}
                        {activeSubPanel && (
                          <div className="absolute left-full top-0 border border-border/50 rounded-md bg-popover shadow-lg max-w-[540px]">

                            {/* Actions sub-panel */}
                            {activeSubPanel === 'actions' && (
                              <div className="p-2 space-y-1">
                                <div className="px-2 pt-1 pb-2 flex items-center justify-between">
                                  <h4 className="font-medium text-xs leading-none">Műveletek</h4>
                                  {selectedActions.length > 0 && (
                                    <button className="text-[10px] text-muted-foreground hover:text-destructive" onClick={() => { setSelectedActions([]); setIsActionFilterActive(false); }}>Törlés</button>
                                  )}
                                </div>
                                {AVAILABLE_ACTIONS.map(action => {
                                  const isSelected = selectedActions.includes(action.id);
                                  return (
                                    <div
                                      key={action.id}
                                      className={`flex items-center justify-between px-2 py-1.5 rounded-md cursor-pointer hover:bg-accent ${isSelected ? 'bg-accent/50' : ''}`}
                                      onClick={() => {
                                        setSelectedActions(prev => {
                                          const next = isSelected ? prev.filter(id => id !== action.id) : [...prev, action.id];
                                          setIsActionFilterActive(next.length > 0);
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
                                      {isSelected && <Check className="h-3 w-3 shrink-0" />}
                                    </div>
                                  );
                                })}
                              </div>
                            )}

                            {/* Time sub-panel */}
                            {activeSubPanel === 'time' && (
                              <div className="p-2 space-y-2 w-[280px]">
                                <div className="px-1 pt-1 flex items-center justify-between">
                                  <h4 className="font-medium text-xs leading-none">Időszak</h4>
                                  {(customFrom || customTo) && (
                                    <button className="text-[10px] text-muted-foreground hover:text-destructive" onClick={() => {
                                      setIsFilterActive(false);
                                      setCustomFrom(''); setCustomTo('');
                                      setTempYearFrom(''); setTempMonthFrom(''); setTempDayFrom(''); setTempHourFrom(''); setTempMinFrom('');
                                      setTempYearTo(''); setTempMonthTo(''); setTempDayTo(''); setTempHourTo(''); setTempMinTo('');
                                    }}>Törlés</button>
                                  )}
                                </div>
                                <div className="space-y-2 bg-secondary/10 p-2.5 rounded-md border border-border/50">
                                  <label className="text-xs font-semibold text-foreground">Mettől</label>
                                  <div className="space-y-1.5">
                                    <div className="flex justify-center">
                                      <LocalSelect value={tempYearFrom} onChange={(v) => { setTempYearFrom(v); if (!tempMonthFrom) setTempMonthFrom('01'); if (!tempDayFrom) setTempDayFrom('01'); }} options={YEAR_OPTIONS} placeholder="Év" className="w-[90px]" onOpenChange={(op) => setActiveDropdowns(p => op ? p + 1 : Math.max(0, p - 1))} />
                                    </div>
                                    <div className="flex gap-1.5 items-center">
                                      <LocalSelect value={tempMonthFrom} onChange={setTempMonthFrom} options={MONTH_OPTIONS} placeholder="Hó" className="flex-1" onOpenChange={(op) => setActiveDropdowns(p => op ? p + 1 : Math.max(0, p - 1))} />
                                      <LocalSelect value={tempDayFrom} onChange={setTempDayFrom} options={DAY_OPTIONS} placeholder="Nap" className="flex-1" onOpenChange={(op) => setActiveDropdowns(p => op ? p + 1 : Math.max(0, p - 1))} />
                                    </div>
                                    <div className="flex gap-1.5 items-center">
                                      <LocalSelect value={tempHourFrom} onChange={setTempHourFrom} options={HOUR_OPTIONS} placeholder="Óra" className="flex-1" onOpenChange={(op) => setActiveDropdowns(p => op ? p + 1 : Math.max(0, p - 1))} />
                                      <span className="font-bold text-muted-foreground pb-0.5">:</span>
                                      <LocalSelect value={tempMinFrom} onChange={setTempMinFrom} options={MIN_OPTIONS} placeholder="Perc" className="flex-1" onOpenChange={(op) => setActiveDropdowns(p => op ? p + 1 : Math.max(0, p - 1))} />
                                    </div>
                                  </div>
                                </div>
                                <div className="space-y-2 bg-secondary/10 p-2.5 rounded-md border border-border/50">
                                  <label className="text-xs font-semibold text-foreground">Meddig</label>
                                  <div className="space-y-1.5">
                                    <div className="flex justify-center">
                                      <LocalSelect value={tempYearTo} onChange={(v) => { setTempYearTo(v); if (!tempMonthTo) setTempMonthTo('01'); if (!tempDayTo) setTempDayTo('01'); }} options={YEAR_OPTIONS} placeholder="Év" className="w-[90px]" onOpenChange={(op) => setActiveDropdowns(p => op ? p + 1 : Math.max(0, p - 1))} />
                                    </div>
                                    <div className="flex gap-1.5 items-center">
                                      <LocalSelect value={tempMonthTo} onChange={setTempMonthTo} options={MONTH_OPTIONS} placeholder="Hó" className="flex-1" onOpenChange={(op) => setActiveDropdowns(p => op ? p + 1 : Math.max(0, p - 1))} />
                                      <LocalSelect value={tempDayTo} onChange={setTempDayTo} options={DAY_OPTIONS} placeholder="Nap" className="flex-1" onOpenChange={(op) => setActiveDropdowns(p => op ? p + 1 : Math.max(0, p - 1))} />
                                    </div>
                                    <div className="flex gap-1.5 items-center">
                                      <LocalSelect value={tempHourTo} onChange={setTempHourTo} options={HOUR_OPTIONS} placeholder="Óra" className="flex-1" onOpenChange={(op) => setActiveDropdowns(p => op ? p + 1 : Math.max(0, p - 1))} />
                                      <span className="font-bold text-muted-foreground pb-0.5">:</span>
                                      <LocalSelect value={tempMinTo} onChange={setTempMinTo} options={MIN_OPTIONS} placeholder="Perc" className="flex-1" onOpenChange={(op) => setActiveDropdowns(p => op ? p + 1 : Math.max(0, p - 1))} />
                                    </div>
                                  </div>
                                </div>
                              </div>
                            )}

                            {/* Users sub-panel */}
                            {activeSubPanel === 'users' && (() => {
                              const normalizedUserSearch = userSearch.toLowerCase();
                              const sortedMembers = [...companyMembers].sort((a, b) => (a.name || '').localeCompare(b.name || '', 'hu'));
                              const filteredMembers = sortedMembers.filter(m => (m.name || 'Névtelen').toLowerCase().includes(normalizedUserSearch));
                              const showSystem = 'rendszer'.includes(normalizedUserSearch);
                              return (
                                <div className="p-2 space-y-1 w-[220px]">
                                  <div className="px-2 pt-1 pb-1 flex items-center justify-between">
                                    <h4 className="font-medium text-xs leading-none">Felhasználók</h4>
                                    {selectedUserIds.length > 0 && (
                                      <button className="text-[10px] text-muted-foreground hover:text-destructive" onClick={() => { setSelectedUserIds([]); setIsUserFilterActive(false); }}>Törlés</button>
                                    )}
                                  </div>
                                  <div className="relative px-1 pb-1">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                                    <input
                                      type="text"
                                      placeholder="Keresés..."
                                      value={userSearch}
                                      onChange={e => setUserSearch(e.target.value)}
                                      className="w-full pl-6 pr-2 py-1 text-xs bg-secondary/30 border border-border/50 rounded-md outline-none focus:ring-1 focus:ring-primary/40"
                                    />
                                  </div>
                                  <div className="max-h-[220px] overflow-y-auto space-y-0.5 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-border [&::-webkit-scrollbar-thumb]:rounded-full">
                                    {showSystem && (() => {
                                      const isSelected = selectedUserIds.includes('__system__');
                                      return (
                                        <div
                                          className={`flex items-center justify-between px-2 py-1.5 rounded-md cursor-pointer hover:bg-accent ${isSelected ? 'bg-accent/50' : ''}`}
                                          onClick={() => { setSelectedUserIds(prev => { const next = isSelected ? prev.filter(id => id !== '__system__') : [...prev, '__system__']; setIsUserFilterActive(next.length > 0); return next; }); }}
                                        >
                                          <div className="flex items-center gap-2"><Bot className="h-3.5 w-3.5 text-muted-foreground" /><span className={`text-xs ${isSelected ? 'font-medium' : ''}`}>Rendszer</span></div>
                                          {isSelected && <Check className="h-3 w-3 shrink-0" />}
                                        </div>
                                      );
                                    })()}
                                    {filteredMembers.map(member => {
                                      const isSelected = selectedUserIds.includes(member.user_id);
                                      return (
                                        <div
                                          key={member.user_id}
                                          className={`flex items-center justify-between px-2 py-1.5 rounded-md cursor-pointer hover:bg-accent ${isSelected ? 'bg-accent/50' : ''}`}
                                          onClick={() => { setSelectedUserIds(prev => { const next = isSelected ? prev.filter(id => id !== member.user_id) : [...prev, member.user_id]; setIsUserFilterActive(next.length > 0); return next; }); }}
                                        >
                                          <div className="flex items-center gap-2"><User className="h-3.5 w-3.5 text-muted-foreground" /><span className={`text-xs ${isSelected ? 'font-medium' : ''}`}>{member.name || 'Névtelen'}</span></div>
                                          {isSelected && <Check className="h-3 w-3 shrink-0" />}
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              );
                            })()}

                            {/* Docs sub-panel */}
                            {activeSubPanel === 'docs' && (
                              <div className="p-3 w-[180px] min-h-[152px] space-y-2">
                                <div className="flex items-center justify-between">
                                  <h4 className="font-medium text-xs leading-none">Dokumentumok</h4>
                                  {docSearchQuery && (
                                    <button className="text-[10px] text-muted-foreground hover:text-destructive" onClick={() => { setDocSearchQuery(''); setIsDocFilterActive(false); }}>Törlés</button>
                                  )}
                                </div>
                                <div className="relative">
                                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                                  <Input
                                    placeholder="Fájlnév keresése..."
                                    value={docSearchQuery}
                                    onChange={(e) => { setDocSearchQuery(e.target.value); setIsDocFilterActive(!!e.target.value.trim()); }}
                                    className="pl-6 h-7 text-xs bg-secondary/30 border-border/50"
                                    autoFocus
                                  />
                                </div>
                                {docSearchQuery.trim() && (
                                  <div className="space-y-0.5 max-h-[160px] overflow-y-auto">
                                    {logs
                                      .filter(l => l.entity_name && normalize(l.entity_name).includes(normalize(docSearchQuery)))
                                      .slice(0, 8)
                                      .map((l, i) => (
                                        <div key={i} className="px-2 py-1 text-xs text-muted-foreground rounded hover:bg-accent truncate">{l.entity_name}</div>
                                      ))}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>

                {/* Indicator rows — each filter category on its own row, to the right of the icon */}
                {((isActionFilterActive && selectedActions.length > 0) || (isFilterActive && (customFrom || customTo)) || (isUserFilterActive && selectedUserIds.length > 0) || (isDocFilterActive && docSearchQuery.trim())) && (
                  <div className="flex flex-col gap-1 ml-2 self-start pt-2">

                    {/* 1. Time row — single line: from - to */}
                    {(isFilterActive && (customFrom || customTo)) && (
                      <div className="text-[9px] font-bold text-primary/70 tracking-wider whitespace-nowrap leading-tight">
                        {customFrom ? format(new Date(customFrom), 'yyyy MM.dd. HH:mm') : '??'}{' - '}{customTo ? format(new Date(customTo), 'yyyy MM.dd. HH:mm') : '??'}
                      </div>
                    )}

                    {/* 2. Actions row */}
                    {(isActionFilterActive && selectedActions.length > 0) && (
                      <div className="flex flex-wrap gap-0.5 items-center">
                        {selectedActions.map(id => {
                          const action = AVAILABLE_ACTIONS.find(a => a.id === id);
                          if (!action) return null;
                          const iconColorClass = action.color.split(' ').find(c => c.startsWith('text-')) || 'text-primary';
                          return <action.icon key={id} className={`h-5 w-5 ${iconColorClass}`} />;
                        })}
                      </div>
                    )}

                    {/* 3. Users row */}
                    {(isUserFilterActive && selectedUserIds.length > 0) && (
                      <div className="flex flex-wrap gap-0.5">
                        {selectedUserIds.map(uid => (
                          <span key={uid} className="text-[9px] font-bold text-primary/70 bg-primary/10 px-1.5 py-0.5 rounded-full whitespace-nowrap">
                            {uid === '__system__' ? 'Rendszer' : (profileMap.get(uid) || 'Felh.')}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* 4. Docs row */}
                    {(isDocFilterActive && docSearchQuery.trim()) && (
                      <span className="text-[9px] font-bold text-primary/70 bg-primary/10 px-1.5 py-0.5 rounded-full whitespace-nowrap max-w-[200px] truncate">
                        📄 {docSearchQuery}
                      </span>
                    )}

                  </div>
                )}
              </div>

          </div>

          </div>

          {/* ── TIMELINE CONTENT ──────────────────────────────────────────── */}
          <div className="flex-1 overflow-y-auto px-12 py-4">

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
                      <div key={log.id} className={`relative flex items-center gap-4 py-3 px-3 rounded-lg transition-colors border-b border-border/60 ${index % 2 === 0 ? 'bg-slate-100 dark:bg-secondary/30' : 'bg-white dark:bg-transparent'}`}>
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
                            <span>{format(new Date(log.created_at), 'yyyy', { locale: hu })}</span>
                          </div>
                        </div>

                        {/* Content — two rows */}
                        <div className="min-w-0 flex-1">
                          {isSystemAction ? (
                            <>
                              {/* Row 1: action sentence */}
                              <p className="text-sm leading-snug">
                                <button
                                  onClick={() => setSelectedUserDialog({ userId: log.user_id, userName, isSystem: !log.user_id || isSystemAction })}
                                  className="font-semibold hover:text-primary transition-colors hover:underline outline-none"
                                >
                                  {userName}
                                </button>
                                {' '}
                                <span className="text-muted-foreground">
                                  {isInvoiceProcessed(log)
                                    ? 'által feltöltött számla feldolgozva'
                                    : 'feltöltése feldolgozva'}
                                </span>
                              </p>
                              {/* Row 2: filename */}
                              {getDisplayName(log) && (
                                <p className="text-xs mt-0.5">
                                  {isLikelyPdf(log) ? (
                                    <button onClick={() => handlePdfClick(log)} className="font-medium text-green-600 dark:text-green-400 hover:underline hover:text-green-700 dark:hover:text-green-300 inline-flex items-center gap-1 transition-colors">
                                      <FileText className="h-3 w-3 shrink-0" />
                                      {getDisplayName(log)}
                                    </button>
                                  ) : (
                                    <span className="font-medium text-foreground">{getDisplayName(log)}</span>
                                  )}
                                </p>
                              )}
                            </>
                          ) : (
                            <>
                              {/* Row 1: action sentence */}
                              <p className="text-sm leading-snug">
                                <button
                                  onClick={() => setSelectedUserDialog({ userId: log.user_id, userName, isSystem: !log.user_id || isSystemAction })}
                                  className="font-semibold hover:text-primary transition-colors hover:underline outline-none"
                                >
                                  {userName}
                                </button>
                                {' '}
                                <span className="text-muted-foreground">{actionCfg.label} egy {entityCfg.label}</span>
                              </p>
                              {/* Row 2: filename */}
                              {getDisplayName(log) && (
                                <p className="text-xs mt-0.5">
                                  {isLikelyPdf(log) ? (
                                    <button onClick={() => handlePdfClick(log)} className="font-medium text-blue-500 hover:text-blue-600 hover:underline inline-flex items-center gap-1 transition-colors">
                                      <FileText className="h-3 w-3 shrink-0" />
                                      {getDisplayName(log)}
                                    </button>
                                  ) : (
                                    <span className="font-medium text-foreground">{getDisplayName(log)}</span>
                                  )}
                                </p>
                              )}
                            </>
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
            {previewIsImage && previewActualExt && (
              <div className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 rounded-md px-2.5 py-1.5 mt-1 w-fit">
                <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                Ez a fájl nem PDF, hanem <span className="font-semibold">.{previewActualExt}</span> formátumú.
              </div>
            )}
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
              <div className="text-center p-8 text-muted-foreground flex flex-col items-center max-w-sm gap-3">
                <AlertCircle className="h-10 w-10 text-destructive mb-1" />
                {pdfErrorType === 'not_found' ? (
                  <>
                    <p className="font-medium text-foreground">A fájl nem található.</p>
                    <p className="text-sm opacity-80">Ez a fájl már nem létezik a rendszerben — valószínűleg törölve lett, vagy soha nem került feltöltésre.</p>
                  </>
                ) : pdfErrorType === 'invalid_format' ? (
                  <>
                    <p className="font-medium text-foreground">A fájl nem PDF formátumú.</p>
                    <p className="text-sm opacity-80">A fájl neve .pdf-re végződik, de a tartalma nem PDF dokumentum, ezért nem jeleníthető meg.</p>
                  </>
                ) : pdfErrorType === 'unreachable' ? (
                  <>
                    <p className="font-medium text-foreground">A fájl jelenleg nem elérhető.</p>
                    <p className="text-sm opacity-80">A rendszer megtalálta a fájlt, de nem sikerült letölteni. Ellenőrizd az internetkapcsolatot, vagy próbáld újra később.</p>
                  </>
                ) : (
                  <>
                    <p className="font-medium text-foreground">A dokumentum nem tölthető be.</p>
                    <p className="text-sm opacity-80">Ismeretlen hiba történt a fájl betöltése közben.</p>
                  </>
                )}
                {currentPreviewLog && pdfErrorType !== 'not_found' && pdfErrorType !== 'invalid_format' && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePdfClick(currentPreviewLog)}
                    className="mt-1"
                  >
                    Újratöltés
                  </Button>
                )}
              </div>
            ) : previewUrl ? (
              previewIsImage ? (
                <img
                  src={previewUrl}
                  alt={previewTitle || ''}
                  className={`max-w-full max-h-[65vh] object-contain transition-opacity duration-300 ${isLoadingPdf ? 'opacity-0' : 'opacity-100'}`}
                  onLoad={() => setIsLoadingPdf(false)}
                />
              ) : (
                <embed
                  src={previewUrl}
                  type="application/pdf"
                  className={`w-full h-[65vh] transition-opacity duration-300 ${isLoadingPdf ? 'opacity-0' : 'opacity-100'}`}
                  onLoad={() => setIsLoadingPdf(false)}
                />
              )
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
