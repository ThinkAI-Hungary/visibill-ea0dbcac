import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Search, Filter, ChevronRight, Check, Bot, User, Upload, CheckCircle2, Mail, Trash2, Pencil, Plus, Link2
} from 'lucide-react';
import { format } from 'date-fns';
import type { AuditLogRow } from './ActivityLogSheet';
import { normalize } from './ActivityLogSheet';

export const AVAILABLE_ACTIONS = [
  { id: 'feltöltés', label: 'Feltöltések', icon: Upload, color: 'text-cyan-500 bg-cyan-50 dark:bg-cyan-950/30' },
  { id: 'feldolgozás', label: 'Feldolgozások', icon: CheckCircle2, color: 'text-green-600 bg-green-50 dark:bg-green-950/30' },
  { id: 'email', label: 'E-mailek', icon: Mail, color: 'text-amber-500 bg-amber-50 dark:bg-amber-950/30' },
  { id: 'törlés', label: 'Törlések', icon: Trash2, color: 'text-red-500 bg-red-50 dark:bg-red-950/30' },
  { id: 'módosítás', label: 'Módosítások', icon: Pencil, color: 'text-blue-500 bg-blue-50 dark:bg-blue-950/30' },
  { id: 'létrehozás', label: 'Létrehozások', icon: Plus, color: 'text-emerald-500 bg-emerald-50 dark:bg-emerald-950/30' },
  { id: 'párosítás', label: 'Párosítások', icon: Link2, color: 'text-purple-500 bg-purple-50 dark:bg-purple-950/30' }
];

const CURRENT_YEAR = new Date().getFullYear();
const YEAR_OPTIONS = Array.from({ length: CURRENT_YEAR - 2000 + 1 }, (_, i) => {
  const y = CURRENT_YEAR - i;
  return { label: y.toString(), value: y.toString() };
});
const MONTH_OPTIONS = Array.from({ length: 12 }, (_, i) => ({
  label: (i + 1).toString().padStart(2, '0'),
  value: (i + 1).toString().padStart(2, '0'),
}));
const DAY_OPTIONS = Array.from({ length: 31 }, (_, i) => ({
  label: (i + 1).toString().padStart(2, '0'),
  value: (i + 1).toString().padStart(2, '0'),
}));
const HOUR_OPTIONS = Array.from({ length: 24 }, (_, i) => ({
  value: i.toString().padStart(2, '0'),
  label: i.toString().padStart(2, '0'),
}));
const MIN_OPTIONS = Array.from({ length: 12 }, (_, i) => ({
  value: (i * 5).toString().padStart(2, '0'),
  label: (i * 5).toString().padStart(2, '0'),
}));

interface LocalSelectProps {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  placeholder: string;
  className?: string;
  onOpenChange?: (open: boolean) => void;
}

function LocalSelect({
  value,
  onChange,
  options,
  placeholder,
  className = '',
  onOpenChange,
}: LocalSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const searchRef = useRef('');

  const updateSearch = (v: string) => {
    setSearch(v);
    searchRef.current = v;
  };

  const tryAutoSelect = () => {
    const currentSearch = searchRef.current;
    if (!currentSearch) return;
    const matched = options.filter((o) => o.label.toLowerCase().includes(currentSearch.toLowerCase()));
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
        tryAutoSelect();
        closeSelect();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open, options, onChange]);

  const filteredOptions = options.filter((o) => o.label.toLowerCase().includes(search.toLowerCase()));

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <div
        className="flex h-8 w-full items-center justify-between rounded-md border border-input bg-background/50 px-2 py-1 text-xs shadow-sm cursor-text hover:bg-accent/50 transition-colors"
        onClick={() => {
          if (!open) openSelect();
        }}
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
            placeholder={options.find((o) => o.value === value)?.label || placeholder}
            onBlur={() => {
              tryAutoSelect();
              closeSelect();
            }}
          />
        ) : (
          <span className="truncate font-medium leading-none">
            {options.find((o) => o.value === value)?.label || placeholder}
          </span>
        )}
      </div>
      {open && (
        <div className="absolute z-[100] top-full mt-1 left-0 w-full min-w-[60px] rounded-md border bg-popover text-popover-foreground shadow-lg font-medium outline-none animate-in fade-in-0 zoom-in-95">
          <div
            className="max-h-48 flex flex-col overflow-y-auto p-1 pointer-events-auto [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-border [&::-webkit-scrollbar-thumb]:rounded-full"
            onWheel={(e) => e.stopPropagation()}
          >
            {filteredOptions.length > 0 ? (
              filteredOptions.map((o) => (
                <div
                  key={o.value}
                  className={`flex w-full cursor-pointer select-none items-center rounded-sm py-1.5 px-2 text-xs outline-none hover:bg-accent hover:text-accent-foreground ${
                    value === o.value ? 'bg-accent/40 font-bold' : ''
                  }`}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onChange(o.value);
                    closeSelect();
                  }}
                >
                  {o.label}
                </div>
              ))
            ) : (
              <div className="py-1.5 px-2 text-xs text-muted-foreground text-center">Nincs találat</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export interface ActivityLogFiltersProps {
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  selectedActions: string[];
  setSelectedActions: React.Dispatch<React.SetStateAction<string[]>>;
  isActionFilterActive: boolean;
  setIsActionFilterActive: (active: boolean) => void;
  customFrom: string;
  setCustomFrom: (val: string) => void;
  customTo: string;
  setCustomTo: (val: string) => void;
  isFilterActive: boolean;
  setIsFilterActive: (active: boolean) => void;
  selectedUserIds: string[];
  setSelectedUserIds: React.Dispatch<React.SetStateAction<string[]>>;
  isUserFilterActive: boolean;
  setIsUserFilterActive: (active: boolean) => void;
  companyMembers: { user_id: string; name: string | null }[];
  profileMap: Map<string, string>;
  docSearchQuery: string;
  setDocSearchQuery: (q: string) => void;
  isDocFilterActive: boolean;
  setIsDocFilterActive: (active: boolean) => void;
  logs: AuditLogRow[];
}

export function ActivityLogFilters({
  searchQuery,
  setSearchQuery,
  selectedActions,
  setSelectedActions,
  isActionFilterActive,
  setIsActionFilterActive,
  customFrom,
  setCustomFrom,
  customTo,
  setCustomTo,
  isFilterActive,
  setIsFilterActive,
  selectedUserIds,
  setSelectedUserIds,
  isUserFilterActive,
  setIsUserFilterActive,
  companyMembers,
  profileMap,
  docSearchQuery,
  setDocSearchQuery,
  isDocFilterActive,
  setIsDocFilterActive,
  logs,
}: ActivityLogFiltersProps) {
  const [isMainFilterOpen, setIsMainFilterOpen] = useState(false);
  const [activeSubPanel, setActiveSubPanel] = useState<'actions' | 'time' | 'users' | 'docs' | null>(null);
  const mainFilterTimeoutRef = useRef<NodeJS.Timeout>();
  const [userSearch, setUserSearch] = useState('');

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

  useEffect(() => {
    if (activeSubPanel !== 'time') return;
    if (tempYearFrom && tempMonthFrom && tempDayFrom) {
      const fromD = new Date(`${tempYearFrom}-${tempMonthFrom}-${tempDayFrom}T00:00:00`);
      if (tempHourFrom) fromD.setHours(parseInt(tempHourFrom, 10));
      if (tempMinFrom) fromD.setMinutes(parseInt(tempMinFrom, 10));
      setCustomFrom(fromD.toISOString());
      setIsFilterActive(true);
    }
    if (tempYearTo && tempMonthTo && tempDayTo) {
      const toD = new Date(`${tempYearTo}-${tempMonthTo}-${tempDayTo}T00:00:00`);
      toD.setHours(tempHourTo ? parseInt(tempHourTo, 10) : 23);
      toD.setMinutes(tempMinTo ? parseInt(tempMinTo, 10) : 59);
      toD.setSeconds(59);
      toD.setMilliseconds(999);
      setCustomTo(toD.toISOString());
      setIsFilterActive(true);
    }
  }, [tempYearFrom, tempMonthFrom, tempDayFrom, tempHourFrom, tempMinFrom, tempYearTo, tempMonthTo, tempDayTo, tempHourTo, tempMinTo, activeSubPanel]);

  const hasAnyFilterActive =
    (isActionFilterActive && selectedActions.length > 0) ||
    (isFilterActive && (customFrom || customTo)) ||
    (isUserFilterActive && selectedUserIds.length > 0) ||
    (isDocFilterActive && docSearchQuery.trim());

  return (
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
        <div className="flex items-center">
          <div className="w-[42px] flex justify-center shrink-0">
            <Popover
              open={isMainFilterOpen}
              onOpenChange={(open) => {
                setIsMainFilterOpen(open);
                if (!open) setActiveSubPanel(null);
              }}
            >
              <PopoverTrigger asChild>
                <div
                  onMouseEnter={handleMainFilterMouseEnter}
                  onMouseLeave={handleMainFilterMouseLeave}
                >
                  <Button
                    variant="ghost"
                    size="icon"
                    className={`h-9 w-9 rounded-full flex items-center justify-center transition-none cursor-pointer ${
                      hasAnyFilterActive ? 'bg-primary/20 text-primary' : 'text-muted-foreground hover:bg-secondary'
                    }`}
                  >
                    <Filter
                      className={`h-[18px] w-[18px] ${hasAnyFilterActive ? 'fill-primary' : ''}`}
                    />
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
                  {/* Left panel: category list */}
                  <div className="w-full py-1">
                    {([
                      { id: 'actions' as const, label: 'Műveletek szűrése', active: isActionFilterActive && selectedActions.length > 0 },
                      { id: 'time' as const, label: 'Időszak szűrése', active: isFilterActive && !!(customFrom || customTo) },
                      { id: 'users' as const, label: 'Felhasználók szűrése', active: isUserFilterActive && selectedUserIds.length > 0 },
                      { id: 'docs' as const, label: 'Dokumentumok szűrése', active: isDocFilterActive && !!docSearchQuery.trim() },
                    ] as const).map((item) => (
                      <div
                        key={item.id}
                        className={`flex items-center justify-between px-3 py-2 cursor-pointer text-xs transition-colors ${
                          activeSubPanel === item.id ? 'bg-accent text-accent-foreground' : 'hover:bg-accent/60'
                        }`}
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

                  {/* Right panel: sub-content */}
                  {activeSubPanel && (
                    <div className="absolute left-full top-0 border border-border/50 rounded-md bg-popover shadow-lg max-w-[540px]">
                      {/* Actions sub-panel */}
                      {activeSubPanel === 'actions' && (
                        <div className="p-2 space-y-1">
                          <div className="px-2 pt-1 pb-2 flex items-center justify-between">
                            <h4 className="font-medium text-xs leading-none">Műveletek</h4>
                            {selectedActions.length > 0 && (
                              <button
                                className="text-[10px] text-muted-foreground hover:text-destructive cursor-pointer"
                                onClick={() => {
                                  setSelectedActions([]);
                                  setIsActionFilterActive(false);
                                }}
                              >
                                Törlés
                              </button>
                            )}
                          </div>
                          {AVAILABLE_ACTIONS.map((action) => {
                            const isSelected = selectedActions.includes(action.id);
                            return (
                              <div
                                key={action.id}
                                className={`flex items-center justify-between px-2 py-1.5 rounded-md cursor-pointer hover:bg-accent ${
                                  isSelected ? 'bg-accent/50' : ''
                                }`}
                                onClick={() => {
                                  setSelectedActions((prev) => {
                                    const next = isSelected ? prev.filter((id) => id !== action.id) : [...prev, action.id];
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
                              <button
                                className="text-[10px] text-muted-foreground hover:text-destructive cursor-pointer"
                                onClick={() => {
                                  setIsFilterActive(false);
                                  setCustomFrom('');
                                  setCustomTo('');
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
                                }}
                              >
                                Törlés
                              </button>
                            )}
                          </div>
                          <div className="space-y-2 bg-secondary/10 p-2.5 rounded-md border border-border/50">
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
                                  onOpenChange={(op) => setActiveDropdowns((p) => (op ? p + 1 : Math.max(0, p - 1)))}
                                />
                              </div>
                              <div className="flex gap-1.5 items-center">
                                <LocalSelect
                                  value={tempMonthFrom}
                                  onChange={setTempMonthFrom}
                                  options={MONTH_OPTIONS}
                                  placeholder="Hó"
                                  className="flex-1"
                                  onOpenChange={(op) => setActiveDropdowns((p) => (op ? p + 1 : Math.max(0, p - 1)))}
                                />
                                <LocalSelect
                                  value={tempDayFrom}
                                  onChange={setTempDayFrom}
                                  options={DAY_OPTIONS}
                                  placeholder="Nap"
                                  className="flex-1"
                                  onOpenChange={(op) => setActiveDropdowns((p) => (op ? p + 1 : Math.max(0, p - 1)))}
                                />
                              </div>
                              <div className="flex gap-1.5 items-center">
                                <LocalSelect
                                  value={tempHourFrom}
                                  onChange={setTempHourFrom}
                                  options={HOUR_OPTIONS}
                                  placeholder="Óra"
                                  className="flex-1"
                                  onOpenChange={(op) => setActiveDropdowns((p) => (op ? p + 1 : Math.max(0, p - 1)))}
                                />
                                <span className="font-bold text-muted-foreground pb-0.5">:</span>
                                <LocalSelect
                                  value={tempMinFrom}
                                  onChange={setTempMinFrom}
                                  options={MIN_OPTIONS}
                                  placeholder="Perc"
                                  className="flex-1"
                                  onOpenChange={(op) => setActiveDropdowns((p) => (op ? p + 1 : Math.max(0, p - 1)))}
                                />
                              </div>
                            </div>
                          </div>
                          <div className="space-y-2 bg-secondary/10 p-2.5 rounded-md border border-border/50">
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
                                  onOpenChange={(op) => setActiveDropdowns((p) => (op ? p + 1 : Math.max(0, p - 1)))}
                                />
                              </div>
                              <div className="flex gap-1.5 items-center">
                                <LocalSelect
                                  value={tempMonthTo}
                                  onChange={setTempMonthTo}
                                  options={MONTH_OPTIONS}
                                  placeholder="Hó"
                                  className="flex-1"
                                  onOpenChange={(op) => setActiveDropdowns((p) => (op ? p + 1 : Math.max(0, p - 1)))}
                                />
                                <LocalSelect
                                  value={tempDayTo}
                                  onChange={setTempDayTo}
                                  options={DAY_OPTIONS}
                                  placeholder="Nap"
                                  className="flex-1"
                                  onOpenChange={(op) => setActiveDropdowns((p) => (op ? p + 1 : Math.max(0, p - 1)))}
                                />
                              </div>
                              <div className="flex gap-1.5 items-center">
                                <LocalSelect
                                  value={tempHourTo}
                                  onChange={setTempHourTo}
                                  options={HOUR_OPTIONS}
                                  placeholder="Óra"
                                  className="flex-1"
                                  onOpenChange={(op) => setActiveDropdowns((p) => (op ? p + 1 : Math.max(0, p - 1)))}
                                />
                                <span className="font-bold text-muted-foreground pb-0.5">:</span>
                                <LocalSelect
                                  value={tempMinTo}
                                  onChange={setTempMinTo}
                                  options={MIN_OPTIONS}
                                  placeholder="Perc"
                                  className="flex-1"
                                  onOpenChange={(op) => setActiveDropdowns((p) => (op ? p + 1 : Math.max(0, p - 1)))}
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Users sub-panel */}
                      {activeSubPanel === 'users' && (() => {
                        const normalizedUserSearch = userSearch.toLowerCase();
                        const sortedMembers = [...companyMembers].sort((a, b) =>
                          (a.name || '').localeCompare(b.name || '', 'hu')
                        );
                        const filteredMembers = sortedMembers.filter((m) =>
                          (m.name || 'Névtelen').toLowerCase().includes(normalizedUserSearch)
                        );
                        const showSystem = 'rendszer'.includes(normalizedUserSearch);
                        return (
                          <div className="p-2 space-y-1 w-[220px]">
                            <div className="px-2 pt-1 pb-1 flex items-center justify-between">
                              <h4 className="font-medium text-xs leading-none">Felhasználók</h4>
                              {selectedUserIds.length > 0 && (
                                <button
                                  className="text-[10px] text-muted-foreground hover:text-destructive cursor-pointer"
                                  onClick={() => {
                                    setSelectedUserIds([]);
                                    setIsUserFilterActive(false);
                                  }}
                                >
                                  Törlés
                                </button>
                              )}
                            </div>
                            <div className="relative px-1 pb-1">
                              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                              <input
                                type="text"
                                placeholder="Keresés..."
                                value={userSearch}
                                onChange={(e) => setUserSearch(e.target.value)}
                                className="w-full pl-6 pr-2 py-1 text-xs bg-secondary/30 border border-border/50 rounded-md outline-none focus:ring-1 focus:ring-primary/40"
                              />
                            </div>
                            <div className="max-h-[220px] overflow-y-auto space-y-0.5 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-border [&::-webkit-scrollbar-thumb]:rounded-full">
                              {showSystem && (() => {
                                const isSelected = selectedUserIds.includes('__system__');
                                return (
                                  <div
                                    className={`flex items-center justify-between px-2 py-1.5 rounded-md cursor-pointer hover:bg-accent ${
                                      isSelected ? 'bg-accent/50' : ''
                                    }`}
                                    onClick={() => {
                                      setSelectedUserIds((prev) => {
                                        const next = isSelected ? prev.filter((id) => id !== '__system__') : [...prev, '__system__'];
                                        setIsUserFilterActive(next.length > 0);
                                        return next;
                                      });
                                    }}
                                  >
                                    <div className="flex items-center gap-2">
                                      <Bot className="h-3.5 w-3.5 text-muted-foreground" />
                                      <span className={`text-xs ${isSelected ? 'font-medium' : ''}`}>Rendszer</span>
                                    </div>
                                    {isSelected && <Check className="h-3 w-3 shrink-0" />}
                                  </div>
                                );
                              })()}
                              {filteredMembers.map((member) => {
                                const isSelected = selectedUserIds.includes(member.user_id);
                                return (
                                  <div
                                    key={member.user_id}
                                    className={`flex items-center justify-between px-2 py-1.5 rounded-md cursor-pointer hover:bg-accent ${
                                      isSelected ? 'bg-accent/50' : ''
                                    }`}
                                    onClick={() => {
                                      setSelectedUserIds((prev) => {
                                        const next = isSelected ? prev.filter((id) => id !== member.user_id) : [...prev, member.user_id];
                                        setIsUserFilterActive(next.length > 0);
                                        return next;
                                      });
                                    }}
                                  >
                                    <div className="flex items-center gap-2">
                                      <User className="h-3.5 w-3.5 text-muted-foreground" />
                                      <span className={`text-xs ${isSelected ? 'font-medium' : ''}`}>
                                        {member.name || 'Névtelen'}
                                      </span>
                                    </div>
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
                              <button
                                className="text-[10px] text-muted-foreground hover:text-destructive cursor-pointer"
                                onClick={() => {
                                  setDocSearchQuery('');
                                  setIsDocFilterActive(false);
                                }}
                              >
                                Törlés
                              </button>
                            )}
                          </div>
                          <div className="relative">
                            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                            <Input
                              placeholder="Fájlnév keresése..."
                              value={docSearchQuery}
                              onChange={(e) => {
                                setDocSearchQuery(e.target.value);
                                setIsDocFilterActive(!!e.target.value.trim());
                              }}
                              className="pl-6 h-7 text-xs bg-secondary/30 border-border/50"
                              autoFocus
                            />
                          </div>
                          {docSearchQuery.trim() && (
                            <div className="space-y-0.5 max-h-[160px] overflow-y-auto">
                              {logs
                                .filter((l) => l.entity_name && normalize(l.entity_name).includes(normalize(docSearchQuery)))
                                .slice(0, 8)
                                .map((l, i) => (
                                  <div key={i} className="px-2 py-1 text-xs text-muted-foreground rounded hover:bg-accent truncate">
                                    {l.entity_name}
                                  </div>
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

          {/* Indicator rows */}
          {hasAnyFilterActive && (
            <div className="flex flex-col gap-1 ml-2 self-start pt-2">
              {/* 1. Time row */}
              {isFilterActive && (customFrom || customTo) && (
                <div className="text-[9px] font-bold text-primary/70 tracking-wider whitespace-nowrap leading-tight">
                  {customFrom ? format(new Date(customFrom), 'yyyy MM.dd. HH:mm') : '??'}{' - '}
                  {customTo ? format(new Date(customTo), 'yyyy MM.dd. HH:mm') : '??'}
                </div>
              )}

              {/* 2. Actions row */}
              {isActionFilterActive && selectedActions.length > 0 && (
                <div className="flex flex-wrap gap-0.5 items-center">
                  {selectedActions.map((id) => {
                    const action = AVAILABLE_ACTIONS.find((a) => a.id === id);
                    if (!action) return null;
                    const iconColorClass = action.color.split(' ').find((c) => c.startsWith('text-')) || 'text-primary';
                    return <action.icon key={id} className={`h-5 w-5 ${iconColorClass}`} />;
                  })}
                </div>
              )}

              {/* 3. Users row */}
              {isUserFilterActive && selectedUserIds.length > 0 && (
                <div className="flex flex-wrap gap-0.5">
                  {selectedUserIds.map((uid) => (
                    <span key={uid} className="text-[9px] font-bold text-primary/70 bg-primary/10 px-1.5 py-0.5 rounded-full whitespace-nowrap">
                      {uid === '__system__' ? 'Rendszer' : profileMap.get(uid) || 'Felh.'}
                    </span>
                  ))}
                </div>
              )}

              {/* 4. Docs row */}
              {isDocFilterActive && docSearchQuery.trim() && (
                <span className="text-[9px] font-bold text-primary/70 bg-primary/10 px-1.5 py-0.5 rounded-full whitespace-nowrap max-w-[200px] truncate">
                  📄 {docSearchQuery}
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
