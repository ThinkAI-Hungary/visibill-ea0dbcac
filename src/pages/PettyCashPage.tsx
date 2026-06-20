import React, { useState, useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryKeys';
import { useAuth } from '@/contexts/AuthContext';
import { useCompany } from '@/contexts/CompanyContext';
import { supabase } from '@/integrations/supabase/client';
import { ContentSkeleton } from '@/components/ui/content-skeleton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { cn, formatCurrency } from '@/lib/utils';
import { CalendarIcon, Save, Banknote, Settings2, Plus, Trash2, Edit2, ArrowRightLeft, Star, MapPin, Loader2, ChevronDown, ChevronRight, Zap, Filter } from 'lucide-react';
import { format } from 'date-fns';
import { hu } from 'date-fns/locale';
import { toast } from '@/hooks/use-toast';
import { UnifiedPagination } from '@/components/ui/unified-pagination';
import { reportError } from '@/lib/errorReporter';
import { useEaisybillPermissions } from '@/hooks/useEaisybillPermissions';

// ── Types ──────────────────────────────────────────────────

interface PettyCashRegister {
  id: string;
  company_id: string;
  name: string;
  location: string | null;
  currencies: string[];
  is_default: boolean;
  created_at: string;
}

interface OpeningBalance {
  id: string;
  register_id: string;
  currency: string;
  amount: number;
  start_date: string | null;
}

interface PettyCashEntry {
  id: string;
  company_id: string;
  register_id: string;
  entry_date: string;
  description: string | null;
  amount: number;
  currency: string;
  source_type: string;
  source_id: string | null;
  source_table: string | null;
  routed_by: string;
  created_at: string;
}

interface RoutingRule {
  id: string;
  company_id: string;
  target_register_id: string;
  priority: number;
  match_currency: string | null;
  match_source_type: string | null;
  match_description_pattern: string | null;
  match_partner_pattern: string | null;
  is_active: boolean;
}

interface SummaryRow {
  register_id: string;
  register_name: string;
  is_default: boolean;
  currency: string;
  opening_balance: number;
  start_date: string | null;
  total_income: number;
  total_expense: number;
  current_balance: number;
}

const COMMON_CURRENCIES = ['HUF', 'EUR', 'USD', 'GBP', 'CHF', 'CZK', 'PLN', 'RON', 'HRK', 'RSD'];
const SOURCE_LABELS: Record<string, string> = {
  withdrawal: 'KP felvétel',
  cash_deposit: 'KP befizetés',
  cash_sale: 'KP értékesítés',
  cash_expense: 'KP kiadás',
  manual: 'Manuális',
  transfer: 'Átvezetés',
};
const SOURCE_COLORS: Record<string, string> = {
  withdrawal: 'bg-primary/10 text-primary',
  cash_deposit: 'bg-orange-500/10 text-orange-500',
  cash_sale: 'bg-emerald-500/10 text-emerald-500',
  cash_expense: 'bg-destructive/10 text-destructive',
  manual: 'bg-violet-500/10 text-violet-500',
  transfer: 'bg-sky-500/10 text-sky-500',
};

/** Round HUF to nearest 5 */
const roundHuf = (amount: number, currency: string): number => {
  if (currency !== 'HUF') return Math.round(amount * 100) / 100;
  return Math.round(amount / 5) * 5;
};

const fmtAmount = (amount: number, currency: string): string => {
  const rounded = roundHuf(amount, currency);
  const formatted = Math.abs(rounded).toLocaleString('hu-HU', { maximumFractionDigits: currency === 'HUF' ? 0 : 2 });
  const sign = rounded >= 0 ? '+' : '-';
  return `${sign}${formatted} ${currency}`;
};

const fmtBalance = (amount: number, currency: string): string => {
  const rounded = roundHuf(amount, currency);
  return `${rounded.toLocaleString('hu-HU', { maximumFractionDigits: currency === 'HUF' ? 0 : 2 })} ${currency}`;
};


// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  REGISTER MANAGEMENT TAB
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function RegistersTab() {
  const { user } = useAuth();
  const { selectedCompany } = useCompany();
  const qc = useQueryClient();
  const { canWrite: canWriteModule } = useEaisybillPermissions();
  const writable = canWriteModule('petty_cash');
  const [showDialog, setShowDialog] = useState(false);
  const [editing, setEditing] = useState<PettyCashRegister | null>(null);
  const [editingBalances, setEditingBalances] = useState<string | null>(null);

  const companyId = selectedCompany?.id || '';

  const { data: registers = [], isLoading } = useQuery({
    queryKey: queryKeys.pettyCashRegisters(companyId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('petty_cash_registers' as any)
        .select('*')
        .eq('company_id', companyId)
        .order('is_default', { ascending: false })
        .order('name');
      if (error) throw error;
      return (data || []) as unknown as PettyCashRegister[];
    },
    enabled: !!companyId,
  });

  const saveRegister = useMutation({
    mutationFn: async (reg: Partial<PettyCashRegister>) => {
      if (reg.id) {
        const { error } = await supabase.from('petty_cash_registers' as any)
          .update({ name: reg.name, location: reg.location, currencies: reg.currencies } as any)
          .eq('id', reg.id);
        if (error) throw error;
      } else {
        // Check if there's already a default register for this company
        const { count } = await supabase.from('petty_cash_registers' as any)
          .select('id', { count: 'exact', head: true })
          .eq('company_id', companyId)
          .eq('is_default', true);
        const hasDefault = (count ?? 0) > 0;

        const { error } = await supabase.from('petty_cash_registers' as any)
          .insert({
            company_id: companyId,
            name: reg.name,
            location: reg.location,
            currencies: reg.currencies || ['HUF'],
            is_default: !hasDefault,
            created_by: user?.id,
          } as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.pettyCashRegisters(companyId) });
      qc.invalidateQueries({ queryKey: queryKeys.pettyCashSummary(companyId) });
      setShowDialog(false);
      setEditing(null);
      toast({ title: 'Pénztár mentve' });
    },
    onError: (e: any) => toast({ title: 'Hiba', description: e.message, variant: 'destructive' }),
  });

  const setDefault = useMutation({
    mutationFn: async (registerId: string) => {
      // Remove old default
      const { error: e1 } = await supabase.from('petty_cash_registers' as any)
        .update({ is_default: false } as any)
        .eq('company_id', companyId)
        .eq('is_default', true);
      if (e1) throw e1;
      // Set new default
      const { error: e2 } = await supabase.from('petty_cash_registers' as any)
        .update({ is_default: true } as any)
        .eq('id', registerId);
      if (e2) throw e2;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.pettyCashRegisters(companyId) });
      qc.invalidateQueries({ queryKey: queryKeys.pettyCashSummary(companyId) });
      toast({ title: 'Alapértelmezett pénztár módosítva' });
    },
  });

  const deleteRegister = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('petty_cash_registers' as any).delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.pettyCashRegisters(companyId) });
      qc.invalidateQueries({ queryKey: queryKeys.pettyCashSummary(companyId) });
      toast({ title: 'Pénztár törölve' });
    },
    onError: (e: any) => toast({ title: 'Hiba', description: e.message, variant: 'destructive' }),
  });

  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Pénztárak</h2>
          <p className="text-sm text-muted-foreground">Házipénztárak kezelése, valuták és helyszínek</p>
        </div>
        <Button onClick={() => { setEditing(null); setShowDialog(true); }} disabled={!writable}>
          <Plus className="w-4 h-4 mr-2" /> Új pénztár
        </Button>
      </div>

      {registers.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 gap-3">
            <Banknote className="w-10 h-10 text-muted-foreground/40" />
            <p className="text-muted-foreground">Nincs még pénztár létrehozva</p>
            <Button onClick={() => { setEditing(null); setShowDialog(true); }} disabled={!writable}>
              <Plus className="w-4 h-4 mr-2" /> Első pénztár létrehozása
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {registers.map(reg => (
            <Card key={reg.id} className={cn(
              'relative transition-all hover:shadow-md',
              reg.is_default && 'ring-2 ring-primary/30 border-primary/40'
            )}>
              {reg.is_default && (
                <div className="absolute -top-2.5 left-4">
                  <Badge className="bg-primary text-primary-foreground text-[10px] gap-1">
                    <Star className="w-3 h-3" /> Alapértelmezett
                  </Badge>
                </div>
              )}
              <CardHeader className="pb-3 pt-5">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-base">{reg.name}</CardTitle>
                    {reg.location && (
                      <CardDescription className="flex items-center gap-1 mt-1">
                        <MapPin className="w-3 h-3" /> {reg.location}
                      </CardDescription>
                    )}
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEditing(reg); setShowDialog(true); }}>
                      <Edit2 className="w-3.5 h-3.5" />
                    </Button>
                    {!reg.is_default && (
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteRegister.mutate(reg.id)}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex flex-wrap gap-1.5">
                  {reg.currencies.map(c => (
                    <Badge key={c} variant="outline" className="text-xs">{c}</Badge>
                  ))}
                </div>
                <div className="flex gap-2">
                  {!reg.is_default && (
                    <Button variant="outline" size="sm" className="text-xs" onClick={() => setDefault.mutate(reg.id)}>
                      <Star className="w-3 h-3 mr-1" /> Alapértelmezetté
                    </Button>
                  )}
                  <Button variant="outline" size="sm" className="text-xs" onClick={() => setEditingBalances(editingBalances === reg.id ? null : reg.id)}>
                    <Settings2 className="w-3 h-3 mr-1" /> Nyitó egyenlegek
                  </Button>
                </div>
                {editingBalances === reg.id && (
                  <OpeningBalancesEditor registerId={reg.id} currencies={reg.currencies} />
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Register Edit Dialog */}
      <RegisterDialog
        open={showDialog}
        onOpenChange={setShowDialog}
        register={editing}
        onSave={(r) => saveRegister.mutate(r)}
        saving={saveRegister.isPending}
      />
    </div>
  );
}

function RegisterDialog({ open, onOpenChange, register, onSave, saving }: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  register: PettyCashRegister | null;
  onSave: (r: Partial<PettyCashRegister>) => void;
  saving: boolean;
}) {
  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [currencies, setCurrencies] = useState<string[]>(['HUF']);

  React.useEffect(() => {
    if (register) {
      setName(register.name);
      setLocation(register.location || '');
      setCurrencies(register.currencies);
    } else {
      setName('');
      setLocation('');
      setCurrencies(['HUF']);
    }
  }, [register, open]);

  const toggleCurrency = (cur: string) => {
    setCurrencies(prev => prev.includes(cur) ? prev.filter(c => c !== cur) : [...prev, cur]);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{register ? 'Pénztár szerkesztése' : 'Új pénztár'}</DialogTitle>
          <DialogDescription>Add meg a pénztár nevét, helyszínét és az elfogadott valutákat.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <Label>Név</Label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="Központi pénztár" />
          </div>
          <div>
            <Label>Helyszín (opcionális)</Label>
            <Input value={location} onChange={e => setLocation(e.target.value)} placeholder="Budapest, Fő u. 1." />
          </div>
          <div>
            <Label className="mb-2 block">Valuták</Label>
            <div className="flex flex-wrap gap-2">
              {COMMON_CURRENCIES.map(cur => (
                <button
                  key={cur}
                  className={cn(
                    'px-3 py-1.5 text-xs font-medium rounded-lg border transition-all',
                    currencies.includes(cur)
                      ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                      : 'bg-muted/30 text-muted-foreground border-border hover:bg-muted/50'
                  )}
                  onClick={() => toggleCurrency(cur)}
                >
                  {cur}
                </button>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Mégse</Button>
          <Button onClick={() => onSave({ ...(register ? { id: register.id } : {}), name, location: location || null, currencies })}
            disabled={saving || !name || currencies.length === 0}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
            Mentés
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function OpeningBalancesEditor({ registerId, currencies }: { registerId: string; currencies: string[] }) {
  const qc = useQueryClient();

  const { data: balances = [] } = useQuery({
    queryKey: queryKeys.pettyCashOpeningBalances(registerId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('petty_cash_opening_balances' as any)
        .select('*')
        .eq('register_id', registerId);
      if (error) throw error;
      return (data || []) as unknown as OpeningBalance[];
    },
  });

  const [drafts, setDrafts] = useState<Record<string, { amount: string; startDate: string }>>({});

  React.useEffect(() => {
    const d: typeof drafts = {};
    currencies.forEach(cur => {
      const existing = balances.find(b => b.currency === cur);
      d[cur] = {
        amount: existing ? String(existing.amount) : '0',
        startDate: existing?.start_date || '',
      };
    });
    setDrafts(d);
  }, [balances, currencies]);

  const save = useMutation({
    mutationFn: async () => {
      for (const cur of currencies) {
        const draft = drafts[cur];
        if (!draft) continue;
        const amount = parseFloat(draft.amount) || 0;
        const rounded = roundHuf(amount, cur);
        const { error } = await supabase.from('petty_cash_opening_balances' as any)
          .upsert({
            register_id: registerId,
            currency: cur,
            amount: rounded,
            start_date: draft.startDate || null,
          } as any, { onConflict: 'register_id,currency' });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.pettyCashOpeningBalances(registerId) });
      qc.invalidateQueries({ queryKey: queryKeys.pettyCashSummary('') }); // broad invalidation
      toast({ title: 'Nyitó egyenlegek mentve' });
    },
    onError: (e: any) => toast({ title: 'Hiba', description: e.message, variant: 'destructive' }),
  });

  return (
    <div className="space-y-3 pt-2 border-t border-border/40 animate-in fade-in slide-in-from-top-1 duration-200">
      {currencies.map(cur => (
        <div key={cur} className="grid grid-cols-3 gap-2 items-end">
          <div>
            <Label className="text-xs text-muted-foreground">{cur} nyitó</Label>
            <Input
              type="number"
              className="h-8 text-sm"
              value={drafts[cur]?.amount || ''}
              onChange={e => setDrafts(prev => ({ ...prev, [cur]: { ...prev[cur], amount: e.target.value } }))}
            />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Kezdő dátum</Label>
            <Input
              type="date"
              className="h-8 text-sm"
              value={drafts[cur]?.startDate || ''}
              onChange={e => setDrafts(prev => ({ ...prev, [cur]: { ...prev[cur], startDate: e.target.value } }))}
            />
          </div>
          <div />
        </div>
      ))}
      <Button size="sm" onClick={() => save.mutate()} disabled={save.isPending}>
        {save.isPending ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Save className="w-3 h-3 mr-1" />}
        Mentés
      </Button>
    </div>
  );
}


// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  ENTRIES TAB
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function EntriesTab() {
  const { user } = useAuth();
  const { selectedCompany } = useCompany();
  const qc = useQueryClient();
  const companyId = selectedCompany?.id || '';
  const { canWrite: canWriteModule } = useEaisybillPermissions();
  const writable = canWriteModule('petty_cash');
  const [filterRegister, setFilterRegister] = useState<string>('all');
  const [filterCurrency, setFilterCurrency] = useState<string>('all');
  const [filterType, setFilterType] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [showManualDialog, setShowManualDialog] = useState(false);
  const [moveEntry, setMoveEntry] = useState<PettyCashEntry | null>(null);
  const pageSize = 25;

  const { data: registers = [] } = useQuery({
    queryKey: queryKeys.pettyCashRegisters(companyId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('petty_cash_registers' as any).select('*').eq('company_id', companyId)
        .order('is_default', { ascending: false }).order('name');
      if (error) throw error;
      return (data || []) as unknown as PettyCashRegister[];
    },
    enabled: !!companyId,
  });

  const { data: entries = [], isLoading } = useQuery({
    queryKey: queryKeys.pettyCashEntries(companyId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('petty_cash_entries' as any)
        .select('*')
        .eq('company_id', companyId)
        .order('entry_date', { ascending: false })
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as PettyCashEntry[];
    },
    enabled: !!companyId,
  });

  const registerMap = useMemo(() => {
    const m: Record<string, PettyCashRegister> = {};
    registers.forEach(r => { m[r.id] = r; });
    return m;
  }, [registers]);

  const filtered = useMemo(() => {
    let result = entries;
    if (filterRegister !== 'all') result = result.filter(e => e.register_id === filterRegister);
    if (filterCurrency !== 'all') result = result.filter(e => e.currency === filterCurrency);
    if (filterType !== 'all') result = result.filter(e => e.source_type === filterType);
    return result;
  }, [entries, filterRegister, filterCurrency, filterType]);

  const totalPages = Math.ceil(filtered.length / pageSize);
  const paginated = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, currentPage]);

  // Running balance per register+currency (calculated from all entries, not just filtered)
  const runningBalances = useMemo(() => {
    // Group by register+currency, sort ascending
    const groups: Record<string, PettyCashEntry[]> = {};
    entries.forEach(e => {
      const key = `${e.register_id}::${e.currency}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(e);
    });
    // Build running balance map: entry.id → balance
    const balMap: Record<string, number> = {};
    Object.values(groups).forEach(group => {
      const sorted = [...group].sort((a, b) => a.entry_date.localeCompare(b.entry_date) || a.created_at.localeCompare(b.created_at));
      let running = 0;
      sorted.forEach(e => {
        running += e.amount;
        balMap[e.id] = running;
      });
    });
    return balMap;
  }, [entries]);

  const moveEntryMutation = useMutation({
    mutationFn: async ({ entryId, targetRegisterId }: { entryId: string; targetRegisterId: string }) => {
      const { error } = await supabase.from('petty_cash_entries' as any)
        .update({ register_id: targetRegisterId, routed_by: 'manual' } as any)
        .eq('id', entryId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.pettyCashEntries(companyId) });
      qc.invalidateQueries({ queryKey: queryKeys.pettyCashSummary(companyId) });
      setMoveEntry(null);
      toast({ title: 'Tétel áthelyezve' });
    },
    onError: (e: any) => toast({ title: 'Hiba', description: e.message, variant: 'destructive' }),
  });

  const allCurrencies = useMemo(() => {
    const s = new Set<string>();
    entries.forEach(e => s.add(e.currency));
    return Array.from(s).sort();
  }, [entries]);

  const allSourceTypes = useMemo(() => {
    const s = new Set<string>();
    entries.forEach(e => s.add(e.source_type));
    return Array.from(s).sort();
  }, [entries]);

  const syncEntries = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc('sync_petty_cash_entries', { p_company_id: companyId });
      if (error) throw error;
      return data as any;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: queryKeys.pettyCashEntries(companyId) });
      qc.invalidateQueries({ queryKey: queryKeys.pettyCashSummary(companyId) });
      const row = Array.isArray(data) ? data[0] : data;
      const count = row?.inserted_count ?? 0;
      toast({ title: `Szinkronizálás kész`, description: `${count} új tétel importálva` });
    },
    onError: (e: any) => toast({ title: 'Hiba', description: e.message, variant: 'destructive' }),
  });

  return (
    <div className="space-y-4">
      {/* Filters + Actions */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <Filter className="w-4 h-4 text-muted-foreground" />
          <Select value={filterRegister} onValueChange={v => { setFilterRegister(v); setCurrentPage(1); }}>
            <SelectTrigger className="w-40 h-8 text-xs"><SelectValue placeholder="Pénztár" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Összes pénztár</SelectItem>
              {registers.map(r => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterCurrency} onValueChange={v => { setFilterCurrency(v); setCurrentPage(1); }}>
            <SelectTrigger className="w-24 h-8 text-xs"><SelectValue placeholder="Valuta" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Összes</SelectItem>
              {allCurrencies.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterType} onValueChange={v => { setFilterType(v); setCurrentPage(1); }}>
            <SelectTrigger className="w-36 h-8 text-xs"><SelectValue placeholder="Típus" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Összes típus</SelectItem>
              {allSourceTypes.map(t => <SelectItem key={t} value={t}>{SOURCE_LABELS[t] || t}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => syncEntries.mutate()} disabled={syncEntries.isPending}>
            {syncEntries.isPending ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <ArrowRightLeft className="w-4 h-4 mr-1" />}
            Szinkronizálás
          </Button>
          <Button size="sm" onClick={() => setShowManualDialog(true)} disabled={!writable}>
            <Plus className="w-4 h-4 mr-1" /> Manuális tétel
          </Button>
        </div>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-28">Dátum</TableHead>
                <TableHead className="w-28">Pénztár</TableHead>
                <TableHead className="w-24">Típus</TableHead>
                <TableHead>Leírás</TableHead>
                <TableHead className="text-right w-36">Összeg</TableHead>
                <TableHead className="text-right w-36">Egyenleg</TableHead>
                <TableHead className="w-16" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8"><Loader2 className="w-5 h-5 animate-spin mx-auto text-muted-foreground" /></TableCell></TableRow>
              ) : paginated.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Nincs tétel</TableCell></TableRow>
              ) : (
                paginated.map(entry => {
                  const regName = registerMap[entry.register_id]?.name || '?';
                  const bal = runningBalances[entry.id] ?? 0;
                  return (
                    <TableRow key={entry.id} className="group">
                      <TableCell className="whitespace-nowrap text-sm tabular-nums">
                        {entry.entry_date ? format(new Date(entry.entry_date), 'yyyy. MM. dd.') : '—'}
                      </TableCell>
                      <TableCell>
                        <span className="text-xs font-medium">{regName}</span>
                      </TableCell>
                      <TableCell>
                        <span className={cn('px-2 py-0.5 rounded text-[10px] font-medium', SOURCE_COLORS[entry.source_type] || 'bg-muted text-muted-foreground')}>
                          {SOURCE_LABELS[entry.source_type] || entry.source_type}
                        </span>
                      </TableCell>
                      <TableCell className="max-w-[250px] truncate text-sm">{entry.description || '—'}</TableCell>
                      <TableCell className={cn('text-right font-medium text-sm tabular-nums whitespace-nowrap', entry.amount >= 0 ? 'text-emerald-500' : 'text-destructive')}>
                        {fmtAmount(entry.amount, entry.currency)}
                      </TableCell>
                      <TableCell className="text-right text-sm tabular-nums whitespace-nowrap">
                        {fmtBalance(bal, entry.currency)}
                      </TableCell>
                      <TableCell>
                        {registers.length > 1 && (
                          <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={() => setMoveEntry(entry)} title="Áthelyezés másik pénztárba">
                            <ArrowRightLeft className="w-3.5 h-3.5" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {totalPages > 1 && (
        <UnifiedPagination currentPage={currentPage} totalPages={totalPages} totalItems={filtered.length} pageSize={pageSize} onPageChange={setCurrentPage} onPageSizeChange={() => {}} />
      )}

      {/* Manual Entry Dialog */}
      <ManualEntryDialog
        open={showManualDialog}
        onOpenChange={setShowManualDialog}
        registers={registers}
        companyId={companyId}
        userId={user?.id || ''}
      />

      {/* Move Entry Dialog */}
      {moveEntry && (
        <Dialog open={!!moveEntry} onOpenChange={() => setMoveEntry(null)}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Tétel áthelyezése</DialogTitle>
              <DialogDescription>Válaszd ki a cél pénztárat az áthelyezéshez.</DialogDescription>
            </DialogHeader>
            <div className="space-y-2 py-2">
              {registers.filter(r => r.id !== moveEntry.register_id).map(r => (
                <Button key={r.id} variant="outline" className="w-full justify-start" onClick={() => moveEntryMutation.mutate({ entryId: moveEntry.id, targetRegisterId: r.id })}>
                  <ArrowRightLeft className="w-4 h-4 mr-2" />
                  {r.name}
                  {r.is_default && <Badge variant="secondary" className="ml-auto text-[9px]">default</Badge>}
                </Button>
              ))}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

function ManualEntryDialog({ open, onOpenChange, registers, companyId, userId }: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  registers: PettyCashRegister[];
  companyId: string;
  userId: string;
}) {
  const qc = useQueryClient();
  const defaultReg = registers.find(r => r.is_default) || registers[0];
  const [form, setForm] = useState({
    register_id: defaultReg?.id || '',
    entry_date: format(new Date(), 'yyyy-MM-dd'),
    description: '',
    amount: '',
    currency: 'HUF',
    isExpense: false,
  });

  React.useEffect(() => {
    if (open && defaultReg) {
      setForm({
        register_id: defaultReg.id,
        entry_date: format(new Date(), 'yyyy-MM-dd'),
        description: '',
        amount: '',
        currency: defaultReg.currencies[0] || 'HUF',
        isExpense: false,
      });
    }
  }, [open, defaultReg]);

  const selectedReg = registers.find(r => r.id === form.register_id);

  const save = useMutation({
    mutationFn: async () => {
      const rawAmount = parseFloat(form.amount) || 0;
      const signed = form.isExpense ? -Math.abs(rawAmount) : Math.abs(rawAmount);
      const rounded = roundHuf(signed, form.currency);
      const { error } = await supabase.from('petty_cash_entries' as any)
        .insert({
          company_id: companyId,
          register_id: form.register_id,
          entry_date: form.entry_date,
          description: form.description,
          amount: rounded,
          currency: form.currency,
          source_type: 'manual',
          routed_by: 'manual',
          created_by: userId,
        } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.pettyCashEntries(companyId) });
      qc.invalidateQueries({ queryKey: queryKeys.pettyCashSummary(companyId) });
      onOpenChange(false);
      toast({ title: 'Manuális tétel rögzítve' });
    },
    onError: (e: any) => toast({ title: 'Hiba', description: e.message, variant: 'destructive' }),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Manuális pénztári tétel</DialogTitle>
          <DialogDescription>Kézi bevétel vagy kiadás rögzítése a házipénztárba.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Pénztár</Label>
              <Select value={form.register_id} onValueChange={v => setForm(f => ({ ...f, register_id: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {registers.map(r => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Dátum</Label>
              <Input type="date" value={form.entry_date} onChange={e => setForm(f => ({ ...f, entry_date: e.target.value }))} />
            </div>
          </div>
          <div>
            <Label>Leírás</Label>
            <Input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Pl. Irodaszer vásárlás" />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label>Összeg</Label>
              <Input type="number" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} placeholder="0" />
            </div>
            <div>
              <Label>Valuta</Label>
              <Select value={form.currency} onValueChange={v => setForm(f => ({ ...f, currency: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(selectedReg?.currencies || ['HUF']).map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end pb-1">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <Switch checked={form.isExpense} onCheckedChange={v => setForm(f => ({ ...f, isExpense: v }))} />
                <span className={form.isExpense ? 'text-destructive' : 'text-emerald-500'}>{form.isExpense ? 'Kiadás' : 'Bevétel'}</span>
              </label>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Mégse</Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending || !form.amount || !form.description}>
            {save.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
            Rögzítés
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  ROUTING RULES TAB
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function RoutingRulesTab() {
  const { selectedCompany } = useCompany();
  const qc = useQueryClient();
  const companyId = selectedCompany?.id || '';
  const [showDialog, setShowDialog] = useState(false);
  const [editing, setEditing] = useState<RoutingRule | null>(null);

  const { data: registers = [] } = useQuery({
    queryKey: queryKeys.pettyCashRegisters(companyId),
    queryFn: async () => {
      const { data, error } = await supabase.from('petty_cash_registers' as any).select('*').eq('company_id', companyId);
      if (error) throw error;
      return (data || []) as unknown as PettyCashRegister[];
    },
    enabled: !!companyId,
  });

  const { data: rules = [], isLoading } = useQuery({
    queryKey: queryKeys.pettyCashRoutingRules(companyId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('petty_cash_routing_rules' as any).select('*').eq('company_id', companyId).order('priority', { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as RoutingRule[];
    },
    enabled: !!companyId,
  });

  const registerMap = useMemo(() => {
    const m: Record<string, string> = {};
    registers.forEach(r => { m[r.id] = r.name; });
    return m;
  }, [registers]);

  const saveRule = useMutation({
    mutationFn: async (rule: Partial<RoutingRule>) => {
      if (rule.id) {
        const { error } = await supabase.from('petty_cash_routing_rules' as any)
          .update(rule as any).eq('id', rule.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('petty_cash_routing_rules' as any)
          .insert({ ...rule, company_id: companyId } as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.pettyCashRoutingRules(companyId) });
      setShowDialog(false);
      setEditing(null);
      toast({ title: 'Szabály mentve' });
    },
    onError: (e: any) => toast({ title: 'Hiba', description: e.message, variant: 'destructive' }),
  });

  const deleteRule = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('petty_cash_routing_rules' as any).delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.pettyCashRoutingRules(companyId) });
      toast({ title: 'Szabály törölve' });
    },
  });

  const toggleActive = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await supabase.from('petty_cash_routing_rules' as any)
        .update({ is_active: active } as any).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.pettyCashRoutingRules(companyId) }),
  });

  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Routing szabályok</h2>
          <p className="text-sm text-muted-foreground">Automatikus hozzárendelés szabályok — a magasabb prioritású fut előbb</p>
        </div>
        <Button onClick={() => { setEditing(null); setShowDialog(true); }} disabled={registers.length < 2}>
          <Plus className="w-4 h-4 mr-2" /> Új szabály
        </Button>
      </div>

      {registers.length < 2 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-8 gap-2">
            <Zap className="w-8 h-8 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">Legalább 2 pénztár szükséges a routing szabályokhoz</p>
          </CardContent>
        </Card>
      ) : rules.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-8 gap-2">
            <Zap className="w-8 h-8 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">Nincs routing szabály — minden tétel a default pénztárba kerül</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-20">Prioritás</TableHead>
                  <TableHead>Feltétel</TableHead>
                  <TableHead>Cél pénztár</TableHead>
                  <TableHead className="w-20">Aktív</TableHead>
                  <TableHead className="w-20" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {rules.map(rule => (
                  <TableRow key={rule.id}>
                    <TableCell>
                      <Badge variant="outline" className="font-mono">{rule.priority}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {rule.match_currency && <Badge variant="secondary" className="text-[10px]">Valuta: {rule.match_currency}</Badge>}
                        {rule.match_source_type && <Badge variant="secondary" className="text-[10px]">Típus: {SOURCE_LABELS[rule.match_source_type] || rule.match_source_type}</Badge>}
                        {rule.match_description_pattern && <Badge variant="secondary" className="text-[10px]">Leírás: {rule.match_description_pattern}</Badge>}
                        {rule.match_partner_pattern && <Badge variant="secondary" className="text-[10px]">Partner: {rule.match_partner_pattern}</Badge>}
                        {!rule.match_currency && !rule.match_source_type && !rule.match_description_pattern && !rule.match_partner_pattern && (
                          <span className="text-xs text-muted-foreground italic">Nincs feltétel (mindent elkapó)</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="font-medium text-sm">{registerMap[rule.target_register_id] || '?'}</TableCell>
                    <TableCell>
                      <Switch checked={rule.is_active} onCheckedChange={v => toggleActive.mutate({ id: rule.id, active: v })} />
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEditing(rule); setShowDialog(true); }}>
                          <Edit2 className="w-3.5 h-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteRule.mutate(rule.id)}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Rule Dialog */}
      <RoutingRuleDialog
        open={showDialog}
        onOpenChange={setShowDialog}
        rule={editing}
        registers={registers}
        onSave={r => saveRule.mutate(r)}
        saving={saveRule.isPending}
      />
    </div>
  );
}

function RoutingRuleDialog({ open, onOpenChange, rule, registers, onSave, saving }: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  rule: RoutingRule | null;
  registers: PettyCashRegister[];
  onSave: (r: Partial<RoutingRule>) => void;
  saving: boolean;
}) {
  const nonDefault = registers.filter(r => !r.is_default);
  const [form, setForm] = useState({
    target_register_id: nonDefault[0]?.id || '',
    priority: 10,
    match_currency: '',
    match_source_type: '',
    match_description_pattern: '',
    match_partner_pattern: '',
    is_active: true,
  });

  React.useEffect(() => {
    if (rule) {
      setForm({
        target_register_id: rule.target_register_id,
        priority: rule.priority,
        match_currency: rule.match_currency || '',
        match_source_type: rule.match_source_type || '',
        match_description_pattern: rule.match_description_pattern || '',
        match_partner_pattern: rule.match_partner_pattern || '',
        is_active: rule.is_active,
      });
    } else {
      setForm({
        target_register_id: nonDefault[0]?.id || '',
        priority: 10,
        match_currency: '',
        match_source_type: '',
        match_description_pattern: '',
        match_partner_pattern: '',
        is_active: true,
      });
    }
  }, [rule, open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{rule ? 'Szabály szerkesztése' : 'Új routing szabály'}</DialogTitle>
          <DialogDescription>Ha egy tétel megfelel a feltételeknek, automatikusan a cél pénztárba kerül.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Cél pénztár</Label>
              <Select value={form.target_register_id} onValueChange={v => setForm(f => ({ ...f, target_register_id: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {registers.map(r => <SelectItem key={r.id} value={r.id}>{r.name}{r.is_default ? ' ⭐' : ''}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Prioritás</Label>
              <Input type="number" value={form.priority} onChange={e => setForm(f => ({ ...f, priority: +e.target.value }))} />
            </div>
          </div>
          <div className="border-t border-border/40 pt-3">
            <Label className="text-muted-foreground text-xs uppercase tracking-wider mb-2 block">Feltételek (üres = nem szűr)</Label>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Valuta</Label>
                <Select value={form.match_currency || '_none'} onValueChange={v => setForm(f => ({ ...f, match_currency: v === '_none' ? '' : v }))}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">Bármelyik</SelectItem>
                    {COMMON_CURRENCIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Forrás típus</Label>
                <Select value={form.match_source_type || '_none'} onValueChange={v => setForm(f => ({ ...f, match_source_type: v === '_none' ? '' : v }))}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">Bármelyik</SelectItem>
                    {Object.entries(SOURCE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Leírás minta</Label>
                <Input className="h-8 text-xs" value={form.match_description_pattern} onChange={e => setForm(f => ({ ...f, match_description_pattern: e.target.value }))} placeholder="%euró%" />
              </div>
              <div>
                <Label className="text-xs">Partner minta</Label>
                <Input className="h-8 text-xs" value={form.match_partner_pattern} onChange={e => setForm(f => ({ ...f, match_partner_pattern: e.target.value }))} placeholder="%GmbH%" />
              </div>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Mégse</Button>
          <Button onClick={() => onSave({
            ...(rule ? { id: rule.id } : {}),
            target_register_id: form.target_register_id,
            priority: form.priority,
            match_currency: form.match_currency || null,
            match_source_type: form.match_source_type || null,
            match_description_pattern: form.match_description_pattern || null,
            match_partner_pattern: form.match_partner_pattern || null,
            is_active: form.is_active,
          })} disabled={saving || !form.target_register_id}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
            Mentés
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  MAIN PAGE
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const PettyCashPage = () => {
  const { user } = useAuth();
  const { selectedCompany } = useCompany();
  const companyId = selectedCompany?.id || '';

  // Summary computed from raw tables (RPC get_petty_cash_summary not deployed yet)
  const { data: summary = [], isLoading } = useQuery({
    queryKey: queryKeys.pettyCashSummary(companyId),
    queryFn: async () => {
      console.log('[PettyCash] Computing summary from raw tables for company:', companyId);

      const [regRes, obRes, entRes] = await Promise.all([
        supabase.from('petty_cash_registers' as any).select('*').eq('company_id', companyId),
        supabase.from('petty_cash_opening_balances' as any).select('*'),
        supabase.from('petty_cash_entries' as any).select('register_id, currency, amount').eq('company_id', companyId),
      ]);

      console.log('[PettyCash] Registers:', regRes.data?.length, 'error:', regRes.error?.message);
      console.log('[PettyCash] Opening balances:', obRes.data?.length, 'error:', obRes.error?.message);
      console.log('[PettyCash] Entries:', entRes.data?.length, 'error:', entRes.error?.message);

      const registers = (regRes.data || []) as any[];
      const openingBalances = (obRes.data || []) as any[];
      const entries = (entRes.data || []) as any[];

      if (registers.length === 0) {
        console.warn('[PettyCash] No registers found — summary will be empty');
        return [];
      }

      const regIds = new Set(registers.map((r: any) => r.id));
      const filteredOB = openingBalances.filter((ob: any) => regIds.has(ob.register_id));

      const summaryMap: Record<string, SummaryRow> = {};

      // Seed from opening balances
      filteredOB.forEach((ob: any) => {
        const reg = registers.find((r: any) => r.id === ob.register_id);
        if (!reg) return;
        const key = `${ob.register_id}::${ob.currency}`;
        summaryMap[key] = {
          register_id: ob.register_id,
          register_name: reg.name,
          is_default: reg.is_default,
          currency: ob.currency,
          opening_balance: Number(ob.amount || 0),
          start_date: ob.start_date,
          total_income: 0,
          total_expense: 0,
          current_balance: 0,
        };
      });

      // Aggregate entries
      entries.forEach((e: any) => {
        const key = `${e.register_id}::${e.currency}`;
        if (!summaryMap[key]) {
          const reg = registers.find((r: any) => r.id === e.register_id);
          if (!reg) return;
          summaryMap[key] = {
            register_id: e.register_id,
            register_name: reg.name,
            is_default: reg.is_default,
            currency: e.currency,
            opening_balance: 0,
            start_date: null,
            total_income: 0,
            total_expense: 0,
            current_balance: 0,
          };
        }
        const amount = Number(e.amount || 0);
        if (amount > 0) summaryMap[key].total_income += amount;
        else summaryMap[key].total_expense += amount;
      });

      // Compute current_balance
      Object.values(summaryMap).forEach(row => {
        const raw = row.opening_balance + row.total_income + row.total_expense;
        row.current_balance = row.currency === 'HUF' ? Math.round(raw / 5) * 5 : raw;
      });

      const result = Object.values(summaryMap).sort((a, b) =>
        (b.is_default ? 1 : 0) - (a.is_default ? 1 : 0) || a.register_name.localeCompare(b.register_name) || a.currency.localeCompare(b.currency)
      );
      console.log('[PettyCash] Summary result:', result);
      return result;
    },
    enabled: !!user && !!companyId,
    staleTime: 0,
  });

  // Aggregate by currency (total across all registers)
  const totalByCurrency = useMemo(() => {
    const m: Record<string, number> = {};
    summary.forEach(r => {
      m[r.currency] = (m[r.currency] || 0) + r.current_balance;
    });
    return Object.entries(m).sort(([a], [b]) => a === 'HUF' ? -1 : b === 'HUF' ? 1 : a.localeCompare(b));
  }, [summary]);

  // Group by register
  const registerSummaries = useMemo(() => {
    const m: Record<string, { name: string; is_default: boolean; currencies: { currency: string; balance: number }[] }> = {};
    summary.forEach(r => {
      if (!m[r.register_id]) m[r.register_id] = { name: r.register_name, is_default: r.is_default, currencies: [] };
      m[r.register_id].currencies.push({ currency: r.currency, balance: r.current_balance });
    });
    return Object.entries(m)
      .sort(([, a], [, b]) => (b.is_default ? 1 : 0) - (a.is_default ? 1 : 0) || a.name.localeCompare(b.name));
  }, [summary]);

  if (!selectedCompany) {
    return (
      <div className="flex items-center justify-center h-[50vh]">
        <p className="text-muted-foreground">Válassz egy céget a folytatáshoz</p>
      </div>
    );
  }

  if (isLoading) return <ContentSkeleton />;

  return (
    <div className="h-full bg-background page-animate">
      <main className="w-full max-w-none px-4 py-4 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Banknote className="h-7 w-7 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Házipénztár</h1>
            <p className="text-muted-foreground text-sm">Többpénztáras készpénzforgalom nyilvántartás</p>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="flex flex-wrap gap-3">
          {/* Total card */}
          <Card className="border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-transparent min-w-[200px]">
            <CardContent className="p-4">
              <div className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-2">Összesítés</div>
              {totalByCurrency.length === 0 ? (
                <div className="text-lg font-bold text-muted-foreground">—</div>
              ) : (
                <div className="space-y-1">
                  {totalByCurrency.map(([cur, bal]) => (
                    <div key={cur} className={cn('text-lg font-bold tabular-nums', bal >= 0 ? 'text-foreground' : 'text-destructive')}>
                      {fmtBalance(bal, cur)}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Per-register cards */}
          {registerSummaries.map(([regId, reg]) => (
            <Card key={regId} className={cn(
              'min-w-[160px] transition-all',
              reg.is_default && 'border-primary/30'
            )}>
              <CardContent className="p-4">
                <div className="flex items-center gap-1.5 mb-2">
                  {reg.is_default && <Star className="w-3 h-3 text-primary fill-primary" />}
                  <span className="text-xs font-medium text-muted-foreground">{reg.name}</span>
                </div>
                <div className="space-y-0.5">
                  {reg.currencies.map(c => (
                    <div key={c.currency} className={cn('text-base font-semibold tabular-nums', c.balance >= 0 ? 'text-foreground' : 'text-destructive')}>
                      {fmtBalance(c.balance, c.currency)}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Tabs */}
        <Tabs defaultValue="entries" className="w-full">
          <TabsList>
            <TabsTrigger value="entries" className="gap-1.5">
              <Banknote className="w-4 h-4" /> Tételek
            </TabsTrigger>
            <TabsTrigger value="registers" className="gap-1.5">
              <Settings2 className="w-4 h-4" /> Pénztárak
            </TabsTrigger>
            <TabsTrigger value="rules" className="gap-1.5">
              <Zap className="w-4 h-4" /> Routing szabályok
            </TabsTrigger>
          </TabsList>

          <TabsContent value="entries" className="mt-4">
            <EntriesTab />
          </TabsContent>
          <TabsContent value="registers" className="mt-4">
            <RegistersTab />
          </TabsContent>
          <TabsContent value="rules" className="mt-4">
            <RoutingRulesTab />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default PettyCashPage;
