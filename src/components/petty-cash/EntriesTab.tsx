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
  ChevronDown, ChevronUp, Edit2, Trash2, FileText, Check
} from 'lucide-react';
import { format } from 'date-fns';
import { toast } from '@/hooks/use-toast';
import { UnifiedPagination } from '@/components/ui/unified-pagination';
import { useEaisybillPermissions } from '@/hooks/useEaisybillPermissions';
import type { PettyCashRegister, PettyCashEntry, OpenOutboundInvoice } from './types';
import { SOURCE_LABELS, SOURCE_COLORS, fmtAmount, fmtBalance, roundHuf } from './types';
import CashClosingDialog from './CashClosingDialog';

// Add display label for opening balance source type
const DISPLAY_SOURCE_LABELS: Record<string, string> = {
  ...SOURCE_LABELS,
  opening_balance: 'Nyitó egyenleg',
};

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
  const [expandedEntries, setExpandedEntries] = useState<Set<string>>(new Set());
  const [editingEntry, setEditingEntry] = useState<PettyCashEntry | null>(null);
  const pageSize = 25;

  const toggleRow = (id: string) => {
    setExpandedEntries(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const { data: registers = [] } = useQuery({
    queryKey: queryKeys.pettyCashRegisters(companyId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('petty_cash_registers').select('*').eq('company_id', companyId)
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
        .from('petty_cash_entries')
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

  // Load opening balances for registers
  const { data: openingBalances = [] } = useQuery({
    queryKey: ['petty-cash-entries-opening-balances', companyId],
    queryFn: async () => {
      const regIds = registers.map(r => r.id);
      if (regIds.length === 0) return [];
      const { data, error } = await supabase
        .from('petty_cash_opening_balances')
        .select('*')
        .in('register_id', regIds);
      if (error) throw error;
      return data || [];
    },
    enabled: registers.length > 0,
  });

  // Convert opening balances to virtual entry rows
  const virtualOpeningEntries = useMemo(() => {
    return openingBalances.map(ob => ({
      id: `opening-${ob.register_id}-${ob.currency}`,
      company_id: companyId,
      register_id: ob.register_id,
      entry_date: ob.start_date || '1970-01-01',
      description: 'Nyitó egyenleg',
      amount: ob.amount,
      currency: ob.currency,
      source_type: 'opening_balance',
      created_at: '1970-01-01T00:00:00.000Z',
      is_opening: true,
    })) as unknown as PettyCashEntry[];
  }, [openingBalances, companyId]);

  const registerMap = useMemo(() => {
    const m: Record<string, PettyCashRegister> = {};
    registers.forEach(r => { m[r.id] = r; });
    return m;
  }, [registers]);

  // Combine real entries and active opening balances
  const allEntriesWithOpening = useMemo(() => {
    const activeOpenings = virtualOpeningEntries.filter(v => v.amount !== 0);
    return [...entries, ...activeOpenings];
  }, [entries, virtualOpeningEntries]);

  const filtered = useMemo(() => {
    let result = allEntriesWithOpening;

    // Filter by global date range
    result = result.filter(e => e.entry_date >= dateFromFormatted && e.entry_date <= dateToFormatted);

    if (filterRegister !== 'all') result = result.filter(e => e.register_id === filterRegister);
    if (filterCurrency !== 'all') result = result.filter(e => e.currency === filterCurrency);
    if (filterType !== 'all') result = result.filter(e => e.source_type === filterType);
    return result;
  }, [allEntriesWithOpening, dateFromFormatted, dateToFormatted, filterRegister, filterCurrency, filterType]);

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
      if ((e as any).is_opening) return;
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

  // Running balance per register+currency (calculated from entries + opening balances)
  const runningBalances = useMemo(() => {
    const groups: Record<string, PettyCashEntry[]> = {};
    const all = [...entries, ...virtualOpeningEntries.filter(v => v.amount !== 0)];
    all.forEach(e => {
      const key = `${e.register_id}::${e.currency}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(e);
    });
    const balMap: Record<string, number> = {};
    Object.values(groups).forEach(group => {
      const sorted = [...group].sort((a, b) =>
        a.entry_date.localeCompare(b.entry_date) || a.created_at.localeCompare(b.created_at)
      );
      let running = 0;
      sorted.forEach(e => {
        running += e.amount;
        balMap[e.id] = running;
      });
    });
    return balMap;
  }, [entries, virtualOpeningEntries]);

  const moveEntryMutation = useMutation({
    mutationFn: async ({ entryId, targetRegisterId }: { entryId: string; targetRegisterId: string }) => {
      const { error } = await supabase.from('petty_cash_entries')
        .update({ register_id: targetRegisterId, routed_by: 'manual' })
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
              {allSourceTypes.map(t => <SelectItem key={t} value={t}>{DISPLAY_SOURCE_LABELS[t] || t}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="flex gap-2">
          {/* F4: Cash closing button */}
          <Button size="sm" variant="outline" onClick={() => setShowClosingDialog(true)} disabled={entries.length === 0} className="border-indigo-500/20 hover:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
            <BookOpen className="w-4 h-4 mr-1 text-indigo-500" /> Pénztárzárás
          </Button>
          <Button size="sm" variant="outline" onClick={() => syncEntries.mutate()} disabled={syncEntries.isPending} className="border-emerald-500/20 hover:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
            {syncEntries.isPending ? <Loader2 className="w-4 h-4 mr-1 animate-spin text-emerald-500" /> : <ArrowRightLeft className="w-4 h-4 mr-1 text-emerald-500" />}
            Szinkronizálás
          </Button>
          <Button size="sm" onClick={() => { setEditingEntry(null); setShowManualDialog(true); }} disabled={!writable} className="bg-primary hover:bg-primary/95 text-primary-foreground shadow-sm">
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
                <TableHead className="w-10" />
                {/* F5: Receipt number column */}
                <TableHead className="w-20">Sorszám</TableHead>
                <TableHead className="w-28">Dátum</TableHead>
                <TableHead className="w-28">Pénztár</TableHead>
                <TableHead className="w-24">Típus</TableHead>
                <TableHead>Leírás</TableHead>
                <TableHead className="text-right w-36">Összeg</TableHead>
                <TableHead className="text-right w-36">Egyenleg</TableHead>
                <TableHead className="w-20" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={9} className="text-center py-8"><Loader2 className="w-5 h-5 animate-spin mx-auto text-muted-foreground" /></TableCell></TableRow>
              ) : paginated.length === 0 ? (
                <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-8">Nincs tétel a kiválasztott időszakban</TableCell></TableRow>
              ) : (
                paginated.flatMap(entry => {
                  const regName = registerMap[entry.register_id]?.name || '?';
                  const bal = runningBalances[entry.id] ?? 0;
                  const receiptNo = receiptNumbers[entry.id] || '';
                  const isOpening = (entry as any).is_opening;
                  const isExpanded = expandedEntries.has(entry.id);

                  const mainRow = (
                    <TableRow key={entry.id} className="group">
                      <TableCell>
                        {!isOpening && (
                          <Button variant="ghost" size="icon" className="h-6 w-6 p-0" onClick={() => toggleRow(entry.id)}>
                            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                          </Button>
                        )}
                      </TableCell>
                      {/* F5: Receipt number */}
                      <TableCell>
                        {isOpening ? (
                          <Badge variant="secondary" className="bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20 text-[10px]">
                            NYITÓ
                          </Badge>
                        ) : (
                          <Badge variant="outline" className={cn(
                            'font-mono text-[10px]',
                            entry.amount >= 0 ? 'text-emerald-600 border-emerald-500/30' : 'text-destructive border-destructive/30'
                          )}>
                            {receiptNo}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-sm tabular-nums">
                        {entry.entry_date ? format(new Date(entry.entry_date), 'yyyy. MM. dd.') : '—'}
                      </TableCell>
                      <TableCell>
                        <span className="text-xs font-medium">{regName}</span>
                      </TableCell>
                      <TableCell>
                        <span className={cn('px-2 py-0.5 rounded text-[10px] font-medium', SOURCE_COLORS[entry.source_type] || 'bg-muted text-muted-foreground')}>
                          {DISPLAY_SOURCE_LABELS[entry.source_type] || entry.source_type}
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
                        <div className="flex items-center gap-1 justify-end">
                          {entry.source_type === 'manual' && writable && (
                            <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={() => { setEditingEntry(entry); setShowManualDialog(true); }} title="Szerkesztés">
                              <Edit2 className="w-3.5 h-3.5 text-muted-foreground hover:text-foreground" />
                            </Button>
                          )}
                          {registers.length > 1 && !isOpening && (
                            <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={() => setMoveEntry(entry)} title="Áthelyezés másik pénztárba">
                              <ArrowRightLeft className="w-3.5 h-3.5 text-muted-foreground hover:text-foreground" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );

                  if (isExpanded) {
                    return [
                      mainRow,
                      <ExpandedEntryRow key={`expanded-${entry.id}`} entry={entry} colSpan={9} />
                    ];
                  }

                  return [mainRow];
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
        editingEntry={editingEntry}
        onCancelEditing={() => setEditingEntry(null)}
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
//  EXPANDED ENTRY ROW  (Lazy query for linked documents)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function ExpandedEntryRow({ entry, colSpan }: { entry: PettyCashEntry; colSpan: number }) {
  const sourceTable = entry.source_table;
  const sourceId = entry.source_id;

  const { data: sourceData, isLoading, error } = useQuery({
    queryKey: ['petty-cash-entry-source', sourceTable, sourceId],
    queryFn: async () => {
      if (!sourceTable || !sourceId) return null;
      const { data, error } = await supabase
        .from(sourceTable)
        .select('*')
        .eq('id', sourceId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!sourceTable && !!sourceId,
  });

  if (!sourceTable || !sourceId) {
    return (
      <TableRow className="bg-muted/10 hover:bg-muted/10 border-none">
        <TableCell colSpan={colSpan} className="py-3 px-8 text-xs text-muted-foreground italic">
          Kézzel rögzített tétel, nincs közvetlen számla vagy banki tranzakció kapcsolat.
        </TableCell>
      </TableRow>
    );
  }

  return (
    <TableRow className="bg-muted/10 hover:bg-muted/10 border-t border-b border-border/30">
      <TableCell colSpan={colSpan} className="py-4 px-8">
        <div className="max-w-2xl bg-card border border-border/40 p-4 rounded-lg shadow-sm space-y-3 animate-in fade-in slide-in-from-top-1 duration-200">
          <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            <ArrowRightLeft className="h-3.5 w-3.5 text-primary" />
            Kapcsolódó bizonylat részletei ({sourceTable === 'invoices' ? 'Számla' : sourceTable === 'nav_invoices' ? 'NAV számla' : 'Banki tranzakció'})
          </div>

          {isLoading ? (
            <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> Betöltés...
            </div>
          ) : error ? (
            <div className="text-xs text-destructive py-2">Hiba az adatok lekérésekor.</div>
          ) : !sourceData ? (
            <div className="text-xs text-muted-foreground italic py-2">A kapcsolódó dokumentum nem található (lehetséges, hogy törölték).</div>
          ) : (
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
              {sourceTable === 'invoices' && (
                <>
                  <div className="col-span-2">
                    <span className="text-muted-foreground">Bizonylatsorszám:</span>
                    <span className="ml-1 font-mono font-medium">{sourceData.bizonylatsorszam || '-'}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Bruttó összeg:</span>
                    <span className="ml-1 font-mono font-medium">{fmtAmount(sourceData.brutto_vegosszeg, sourceData.penznem || 'HUF')}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Kiállítás dátuma:</span>
                    <span className="ml-1">{sourceData.kibocsatas_datuma ? format(new Date(sourceData.kibocsatas_datuma), 'yyyy. MM. dd.') : '-'}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Kiállító:</span>
                    <span className="ml-1 font-medium">{sourceData.elado_nev || '-'}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Vevő:</span>
                    <span className="ml-1 font-medium">{sourceData.vevo_nev || '-'}</span>
                  </div>
                  {sourceData.image_url && (
                    <div className="col-span-2 mt-2 pt-2 border-t border-border/20">
                      <a href={sourceData.image_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline font-medium">
                        <BookOpen className="w-3.5 h-3.5" /> Bizonylat megtekintése új lapon
                      </a>
                    </div>
                  )}
                </>
              )}

              {sourceTable === 'nav_invoices' && (
                <>
                  <div className="col-span-2">
                    <span className="text-muted-foreground">Bizonylatsorszám:</span>
                    <span className="ml-1 font-mono font-medium">{sourceData.invoice_number || '-'}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Bruttó összeg:</span>
                    <span className="ml-1 font-mono font-medium">{fmtAmount(sourceData.invoice_gross_amount, sourceData.currency || 'HUF')}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Kiállítás dátuma:</span>
                    <span className="ml-1">{sourceData.invoice_issue_date ? format(new Date(sourceData.invoice_issue_date), 'yyyy. MM. dd.') : '-'}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Szállító:</span>
                    <span className="ml-1 font-medium">{sourceData.supplier_name || '-'}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Vevő:</span>
                    <span className="ml-1 font-medium">{sourceData.customer_name || '-'}</span>
                  </div>
                </>
              )}

              {sourceTable === 'transactions' && (
                <>
                  <div>
                    <span className="text-muted-foreground">Tranzakció dátuma:</span>
                    <span className="ml-1 font-medium">{sourceData.transaction_date ? format(new Date(sourceData.transaction_date), 'yyyy. MM. dd.') : '-'}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Összeg:</span>
                    <span className="ml-1 font-mono font-medium">{fmtAmount(sourceData.amount, sourceData.currency || 'HUF')}</span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-muted-foreground">Leírás:</span>
                    <span className="ml-1 font-mono">{sourceData.description || '-'}</span>
                  </div>
                  {sourceData.partner_name && (
                    <div className="col-span-2">
                      <span className="text-muted-foreground">Partner:</span>
                      <span className="ml-1 font-medium">{sourceData.partner_name}</span>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </TableCell>
    </TableRow>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  MANUAL ENTRY DIALOG  (U5: amount validation + editing/deleting)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function ManualEntryDialog({ open, onOpenChange, registers, companyId, userId, editingEntry, onCancelEditing }: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  registers: PettyCashRegister[];
  companyId: string;
  userId: string;
  editingEntry?: PettyCashEntry | null;
  onCancelEditing?: () => void;
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

  // ─── Invoice settlement mode ────────────────────────────────────────────
  const [invoiceMode, setInvoiceMode] = useState(false);
  const [selectedInvoiceIds, setSelectedInvoiceIds] = useState<Set<string>>(new Set());

  // Fetch open outbound invoices for this company
  const { data: openInvoices = [] } = useQuery({
    queryKey: ['open-outbound-invoices', companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('invoices')
        .select('id, bizonylatsorszam, vevo_nev, brutto_vegosszeg, kibocsatas_datuma, fizetesi_hatarido, penznem')
        .eq('company_id', companyId)
        .in('invoice_direction', ['OUTBOUND', 'outbound'])
        .eq('fizetve', false)
        .is('transaction_id', null)
        .not('exclude_from_accounting', 'is', true)
        .order('fizetesi_hatarido', { ascending: true });
      if (error) throw error;
      return (data || []) as OpenOutboundInvoice[];
    },
    enabled: !!companyId && open,
  });

  React.useEffect(() => {
    if (open) {
      // Reset invoice mode on open
      setInvoiceMode(false);
      setSelectedInvoiceIds(new Set());

      if (editingEntry) {
        setForm({
          register_id: editingEntry.register_id,
          entry_date: editingEntry.entry_date,
          description: editingEntry.description || '',
          amount: String(Math.abs(editingEntry.amount)),
          currency: editingEntry.currency,
          isExpense: editingEntry.amount < 0,
        });
      } else if (defaultReg) {
        setForm({
          register_id: defaultReg.id,
          entry_date: format(new Date(), 'yyyy-MM-dd'),
          description: '',
          amount: '',
          currency: defaultReg.currencies[0] || 'HUF',
          isExpense: false,
        });
      }
    }
  }, [open, editingEntry, defaultReg]);

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
      if (invoiceMode) {
        // Invoice settlement mode — create entry from selected invoices
        const selectedInvs = openInvoices.filter(inv => selectedInvoiceIds.has(inv.id));
        const totalAmount = selectedInvs.reduce((sum, inv) => sum + (Number(inv.brutto_vegosszeg) || 0), 0);
        const bizSorszamok = selectedInvs.map(inv => inv.bizonylatsorszam).join(', ');
        const description = `Utalásos számla KP-ban rendezve: ${bizSorszamok}`;
        const rounded = roundHuf(totalAmount, 'HUF');

        // 1. Insert petty cash entry
        const { error: insertError } = await supabase.from('petty_cash_entries')
          .insert({
            company_id: companyId,
            register_id: form.register_id,
            entry_date: form.entry_date,
            description,
            amount: rounded,
            currency: 'HUF',
            source_type: 'invoice_settlement',
            source_id: selectedInvs.length === 1 ? selectedInvs[0].id : null,
            source_table: selectedInvs.length === 1 ? 'invoices' : null,
            routed_by: 'manual',
            created_by: userId,
          });
        if (insertError) throw insertError;

        // 2. Mark invoices as paid
        const { error: updateError } = await supabase
          .from('invoices')
          .update({ fizetve: true })
          .in('id', Array.from(selectedInvoiceIds));
        if (updateError) {
          console.error('Failed to mark invoices as paid:', updateError);
          // Don't throw — entry was created; notify user about partial failure
          toast({
            title: 'Figyelem',
            description: 'A pénztári tétel rögzítve, de a számla(k) fizetve jelölése sikertelen.',
            variant: 'destructive',
          });
        }
        return { isInvoice: true, count: selectedInvs.length };
      }

      // Regular manual entry
      const rawAmount = parseFloat(form.amount) || 0;
      const signed = form.isExpense ? -Math.abs(rawAmount) : Math.abs(rawAmount);
      const rounded = roundHuf(signed, form.currency);
      
      if (editingEntry) {
        // UPDATE
        const { error } = await supabase.from('petty_cash_entries')
          .update({
            register_id: form.register_id,
            entry_date: form.entry_date,
            description: form.description,
            amount: rounded,
            currency: form.currency,
          })
          .eq('id', editingEntry.id);
        if (error) throw error;
      } else {
        // INSERT
        const { error } = await supabase.from('petty_cash_entries')
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
          });
        if (error) throw error;
      }
      return { isInvoice: false };
    },
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: queryKeys.pettyCashEntries(companyId) });
      qc.invalidateQueries({ queryKey: queryKeys.pettyCashSummary(companyId) });
      if (result?.isInvoice) {
        qc.invalidateQueries({ queryKey: ['open-outbound-invoices', companyId] });
      }
      onOpenChange(false);
      if (onCancelEditing) onCancelEditing();
      if (result?.isInvoice) {
        toast({ title: 'Számla rendezve', description: `${result.count} számla KP-ban rendezve és fizetve jelölve.` });
      } else {
        toast({ title: editingEntry ? 'Tétel módosítva' : 'Manuális tétel rögzítve' });
      }
    },
    onError: (e: any) => toast({ title: 'Hiba', description: e.message, variant: 'destructive' }),
  });

  const deleteEntry = useMutation({
    mutationFn: async () => {
      if (!editingEntry) return;
      const { error } = await supabase.from('petty_cash_entries')
        .delete()
        .eq('id', editingEntry.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.pettyCashEntries(companyId) });
      qc.invalidateQueries({ queryKey: queryKeys.pettyCashSummary(companyId) });
      onOpenChange(false);
      if (onCancelEditing) onCancelEditing();
      toast({ title: 'Tétel törölve' });
    },
    onError: (e: any) => toast({ title: 'Hiba a törlés során', description: e.message, variant: 'destructive' }),
  });

  const handleClose = () => {
    onOpenChange(false);
    if (onCancelEditing) onCancelEditing();
  };

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) handleClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{editingEntry ? 'Pénztári tétel szerkesztése' : invoiceMode ? 'Utalásos számla KP-ban rendezve' : 'Manuális pénztári tétel'}</DialogTitle>
          <DialogDescription>{invoiceMode
            ? 'Válaszd ki a nyitott kimenő számlákat, amelyeket készpénzben rendeztek.'
            : 'Kézi bevétel vagy kiadás rögzítése vagy módosítása a házipénztárba.'}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          {/* Invoice settlement toggle — only for new entries */}
          {!editingEntry && openInvoices.length > 0 && (
            <button
              onClick={() => {
                setInvoiceMode(prev => !prev);
                if (!invoiceMode) {
                  setSelectedInvoiceIds(new Set());
                }
              }}
              className={cn(
                'w-full flex items-center gap-3 p-3 rounded-lg border-2 text-left transition-all',
                invoiceMode
                  ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-500 text-blue-700 dark:text-blue-400 shadow-sm ring-1 ring-blue-500/20'
                  : 'border-dashed border-muted-foreground/30 text-muted-foreground hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50/50 dark:hover:bg-blue-900/10'
              )}
            >
              <div className={cn(
                'w-7 h-7 rounded-md flex items-center justify-center shrink-0',
                invoiceMode ? 'bg-blue-500 text-white' : 'bg-muted text-muted-foreground'
              )}>
                <FileText className="w-3.5 h-3.5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold">Utalásos számla KP-ban rendezve</p>
                <p className="text-[10px] opacity-70 mt-0.5">
                  {invoiceMode
                    ? `${selectedInvoiceIds.size} számla kiválasztva`
                    : `${openInvoices.length} nyitott kimenő számla érhető el`
                  }
                </p>
              </div>
              <div className={cn(
                'w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all',
                invoiceMode
                  ? 'bg-blue-500 border-blue-500 text-white'
                  : 'border-muted-foreground/30'
              )}>
                {invoiceMode && <Check className="w-3 h-3" />}
              </div>
            </button>
          )}

          {/* Invoice multiselect panel */}
          {invoiceMode && (
            <div className="space-y-2 animate-in slide-in-from-top-2 duration-200">
              <div className="flex items-center justify-between">
                <Label className="text-xs">
                  Számlák kiválasztása ({selectedInvoiceIds.size}/{openInvoices.length})
                </Label>
                {selectedInvoiceIds.size > 0 && (
                  <p className="text-xs font-bold text-blue-600 dark:text-blue-400 font-mono tabular-nums">
                    Σ {openInvoices
                      .filter(inv => selectedInvoiceIds.has(inv.id))
                      .reduce((s, inv) => s + (Number(inv.brutto_vegosszeg) || 0), 0)
                      .toLocaleString('hu-HU')} HUF
                  </p>
                )}
              </div>
              <div className="max-h-48 overflow-y-auto rounded-lg border border-border divide-y divide-border/50">
                {openInvoices.map(inv => {
                  const isSelected = selectedInvoiceIds.has(inv.id);
                  const amount = Number(inv.brutto_vegosszeg) || 0;
                  return (
                    <button
                      key={inv.id}
                      onClick={() => {
                        setSelectedInvoiceIds(prev => {
                          const next = new Set(prev);
                          if (next.has(inv.id)) next.delete(inv.id);
                          else next.add(inv.id);
                          return next;
                        });
                      }}
                      className={cn(
                        'w-full flex items-center gap-3 px-3 py-2 text-left transition-all',
                        isSelected
                          ? 'bg-blue-50 dark:bg-blue-900/15'
                          : 'hover:bg-muted/50'
                      )}
                    >
                      <div className={cn(
                        'rounded border-2 flex items-center justify-center shrink-0 transition-all',
                        isSelected
                          ? 'bg-blue-500 border-blue-500 text-white'
                          : 'border-muted-foreground/30'
                      )} style={{ width: '18px', height: '18px' }}>
                        {isSelected && <Check className="w-3 h-3" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-xs font-bold text-foreground font-mono">
                            {inv.bizonylatsorszam}
                          </p>
                          <span className="text-[10px] text-muted-foreground">
                            {inv.kibocsatas_datuma}
                          </span>
                        </div>
                        <p className="text-[10px] text-muted-foreground truncate mt-0.5">
                          {inv.vevo_nev}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-xs font-bold font-mono tabular-nums text-foreground">
                          {amount.toLocaleString('hu-HU')} {inv.penznem || 'HUF'}
                        </p>
                        {inv.fizetesi_hatarido && (
                          <p className={cn(
                            'text-[10px] font-mono tabular-nums',
                            new Date(inv.fizetesi_hatarido) < new Date() ? 'text-destructive' : 'text-muted-foreground'
                          )}>
                            {new Date(inv.fizetesi_hatarido) < new Date() ? 'Lejárt: ' : 'Hat.idő: '}
                            {inv.fizetesi_hatarido}
                          </p>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Standard form fields — only visible when NOT in invoice mode */}
          {!invoiceMode && (
            <>
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
            </>
          )}

          {/* Invoice mode: register + date selector */}
          {invoiceMode && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Cél pénztár</Label>
                <Select value={form.register_id} onValueChange={v => setForm(f => ({ ...f, register_id: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {registers.map(r => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Rendezés dátuma</Label>
                <Input type="date" value={form.entry_date} onChange={e => setForm(f => ({ ...f, entry_date: e.target.value }))} />
              </div>
            </div>
          )}
        </div>
        <DialogFooter className="flex justify-between items-center w-full gap-2 sm:gap-0">
          {editingEntry ? (
            <Button
              variant="destructive"
              size="sm"
              onClick={() => deleteEntry.mutate()}
              disabled={deleteEntry.isPending || save.isPending}
            >
              {deleteEntry.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Trash2 className="w-4 h-4 mr-2" />}
              Törlés
            </Button>
          ) : <div />}
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleClose}>Mégse</Button>
            <Button
              onClick={() => save.mutate()}
              disabled={save.isPending || (invoiceMode ? selectedInvoiceIds.size === 0 : (!isAmountValid || !form.description))}
            >
              {save.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
              {editingEntry ? 'Mentés' : 'Rögzítés'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
