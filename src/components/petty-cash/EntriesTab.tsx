import React, { useState, useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryKeys';
import { useAuth } from '@/contexts/AuthContext';
import { useCompany } from '@/contexts/CompanyContext';
import { useDateRange } from '@/contexts/DateRangeContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import {
  Save, Plus, ArrowRightLeft, Loader2, Filter, AlertTriangle, BookOpen, FileDown,
} from 'lucide-react';
import { format } from 'date-fns';
import { toast } from '@/hooks/use-toast';
import { UnifiedPagination } from '@/components/ui/unified-pagination';
import { useEaisybillPermissions } from '@/hooks/useEaisybillPermissions';
import type { PettyCashRegister, PettyCashEntry } from './types';
import { SOURCE_LABELS, SOURCE_COLORS, fmtAmount, fmtBalance, roundHuf } from './types';
import CashClosingDialog from './CashClosingDialog';

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  ENTRIES TAB
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export default function EntriesTab() {
  const { user } = useAuth();
  const { selectedCompany } = useCompany();
  const { dateFromFormatted, dateToFormatted } = useDateRange(); // U4: date range filtering
  const qc = useQueryClient();
  const companyId = selectedCompany?.id || '';
  const { canWrite: canWriteModule } = useEaisybillPermissions();
  const writable = canWriteModule('petty_cash');
  const [filterRegister, setFilterRegister] = useState<string>('all');
  const [filterCurrency, setFilterCurrency] = useState<string>('all');
  const [filterType, setFilterType] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [showManualDialog, setShowManualDialog] = useState(false);
  const [showClosingDialog, setShowClosingDialog] = useState(false); // F4
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

  // U4: Filter entries by global date range
  const { data: entries = [], isLoading } = useQuery({
    queryKey: [...queryKeys.pettyCashEntries(companyId), dateFromFormatted, dateToFormatted],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('petty_cash_entries' as any)
        .select('*')
        .eq('company_id', companyId)
        .gte('entry_date', dateFromFormatted)
        .lte('entry_date', dateToFormatted)
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

  // F5: Receipt numbering — B-001 (income) / K-001 (expense), sequential within the date range
  const receiptNumbers = useMemo(() => {
    // Sort all entries chronologically (ascending) for sequential numbering
    const sorted = [...entries].sort((a, b) =>
      a.entry_date.localeCompare(b.entry_date) || a.created_at.localeCompare(b.created_at)
    );
    let incomeIdx = 0;
    let expenseIdx = 0;
    const numMap: Record<string, string> = {};
    sorted.forEach(e => {
      if (e.amount >= 0) {
        incomeIdx++;
        numMap[e.id] = `B-${String(incomeIdx).padStart(3, '0')}`;
      } else {
        expenseIdx++;
        numMap[e.id] = `K-${String(expenseIdx).padStart(3, '0')}`;
      }
    });
    return numMap;
  }, [entries]);

  // Running balance per register+currency (calculated from entries in range)
  const runningBalances = useMemo(() => {
    const groups: Record<string, PettyCashEntry[]> = {};
    entries.forEach(e => {
      const key = `${e.register_id}::${e.currency}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(e);
    });
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
          {/* F4: Cash closing button */}
          <Button size="sm" variant="outline" onClick={() => setShowClosingDialog(true)} disabled={entries.length === 0}>
            <BookOpen className="w-4 h-4 mr-1" /> Pénztárzárás
          </Button>
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
                {/* F5: Receipt number column */}
                <TableHead className="w-20">Sorszám</TableHead>
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
                <TableRow><TableCell colSpan={8} className="text-center py-8"><Loader2 className="w-5 h-5 animate-spin mx-auto text-muted-foreground" /></TableCell></TableRow>
              ) : paginated.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">Nincs tétel a kiválasztott időszakban</TableCell></TableRow>
              ) : (
                paginated.map(entry => {
                  const regName = registerMap[entry.register_id]?.name || '?';
                  const bal = runningBalances[entry.id] ?? 0;
                  const receiptNo = receiptNumbers[entry.id] || '';
                  return (
                    <TableRow key={entry.id} className="group">
                      {/* F5: Receipt number */}
                      <TableCell>
                        <Badge variant="outline" className={cn(
                          'font-mono text-[10px]',
                          entry.amount >= 0 ? 'text-emerald-600 border-emerald-500/30' : 'text-destructive border-destructive/30'
                        )}>
                          {receiptNo}
                        </Badge>
                      </TableCell>
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

      {/* F4: Cash Closing Dialog */}
      <CashClosingDialog
        open={showClosingDialog}
        onOpenChange={setShowClosingDialog}
        entries={entries}
        registers={registers}
        registerMap={registerMap}
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

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  MANUAL ENTRY DIALOG  (U5: amount validation)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

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

  // U5: Amount validation
  const parsedAmount = parseFloat(form.amount) || 0;
  const isAmountValid = parsedAmount > 0;
  const isLargeAmount = form.currency === 'HUF'
    ? parsedAmount > 1_000_000
    : parsedAmount > 5_000;
  const roundedPreview = parsedAmount > 0 && form.currency === 'HUF'
    ? roundHuf(parsedAmount, 'HUF')
    : null;
  const showRoundingHint = roundedPreview !== null && roundedPreview !== parsedAmount;

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
              <Input
                type="number"
                min="0"
                value={form.amount}
                onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                placeholder="0"
                className={cn(isLargeAmount && 'border-amber-500 focus-visible:ring-amber-500')}
              />
              {/* U5: Rounding hint */}
              {showRoundingHint && (
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  Kerekítve: {roundedPreview!.toLocaleString('hu-HU')} HUF
                </p>
              )}
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
          {/* U5: Large amount warning */}
          {isLargeAmount && (
            <div className="flex items-center gap-2 p-2 rounded-md bg-amber-500/10 text-amber-600 text-xs">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              Szokatlanul nagy összeg — biztosan helyes?
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Mégse</Button>
          <Button
            onClick={() => save.mutate()}
            disabled={save.isPending || !isAmountValid || !form.description}
          >
            {save.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
            Rögzítés
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
