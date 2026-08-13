import React, { useState, useMemo, useEffect } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  ArrowLeft, ChevronRight, BookOpen, Plus, Filter,
  Search, Calendar, Download, ChevronDown, Lock,
  ArrowUpRight, ArrowDownRight, FileText, AlertCircle, Loader2, Import,
  CheckSquare, Square, X, Check
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { useAccountyClient } from '@/hooks/accounty';
import { formatHuf } from '@/lib/evCalculations';
import { useCashbookEntries, useEvClientSettings, useCreateCashbookEntry, type PenztarkonyvTetel, type PenztarkonyvCategory } from '@/hooks/useEvData';
import { useDateRange } from '@/contexts/DateRangeContext';
import CashbookEntryForm, { type CashbookEntryFormData } from './CashbookEntryForm';
import { toast } from '@/hooks/use-toast';
import { exportEvCashbookAnykXml, exportEvCashbookOnyaXml } from '@/lib/evCashbookXml';
import { UnifiedPagination } from '@/components/ui/unified-pagination';

// ─── Category labels (constant, not mock) ────────────────────────────────────

const CATEGORY_LABELS: Record<string, { label: string; color: string }> = {
  bevetel_adokoteles: { label: 'Adóköteles bevétel', color: 'text-green-600' },
  bevetel_fizetendo_afa: { label: 'Fizetendő ÁFA', color: 'text-teal-600' },
  bevetel_be_nem_szamito: { label: 'Be nem számító bevétel', color: 'text-slate-500' },
  kiadas_anyag_arubeszerzes: { label: 'Anyag/árubeszerzés', color: 'text-red-600' },
  kiadas_kozvetitett_szolgaltatas: { label: 'Közvetített szolgáltatás', color: 'text-orange-600' },
  kiadas_alkalmazott_ber_kozteher: { label: 'Bér és közteher', color: 'text-violet-600' },
  kiadas_vallalkozoi_kivet: { label: 'Vállalkozói kivét', color: 'text-purple-600' },
  kiadas_egyeb_koltseg: { label: 'Egyéb költség', color: 'text-amber-600' },
  kiadas_beruhazasi_koltseg: { label: 'Beruházási költség', color: 'text-rose-600' },
  kiadas_levonhato_afa: { label: 'Levonható ÁFA', color: 'text-cyan-600' },
  kiadas_egyeb_nem_koltseg: { label: 'Egyéb nem költség', color: 'text-slate-400' },
};

type FilterDirection = 'all' | 'bevetel' | 'kiadas';

export default function CashbookMainPage() {
  const { companyId, dateRange } = useParams<{ companyId: string; dateRange: string }>();
  const id = companyId;
  const { data: client } = useAccountyClient(id);
  const [searchParams, setSearchParams] = useSearchParams();
  const { dateFrom, setDateFrom, setDateTo, dateFromFormatted, dateToFormatted } = useDateRange();
  const taxYear = dateFrom.getFullYear();
  const [searchQuery, setSearchQuery] = useState('');
  const [filterDirection, setFilterDirection] = useState<FilterDirection>('all');
  const [showNewEntryForm, setShowNewEntryForm] = useState(false);
  const [showExportDropdown, setShowExportDropdown] = useState(false);
  
  const queryClient = useQueryClient();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [lastSelectedIdx, setLastSelectedIdx] = useState<number | null>(null);
  const [isBulkUpdating, setIsBulkUpdating] = useState(false);

  const handleBulkCategoryChange = async (newCategory: PenztarkonyvCategory) => {
    if (selectedIds.size === 0 || !id) return;
    setIsBulkUpdating(true);
    try {
      const { error } = await supabase
        .from('accounty_penztarkonyv_tetel')
        .update({ main_category: newCategory })
        .in('id', Array.from(selectedIds));

      if (error) throw error;

      toast({
        title: 'Sikeres tömeges módosítás!',
        description: `${selectedIds.size} pénztárkönyv tétel kategóriája frissítve.`
      });

      setSelectedIds(new Set());
      setLastSelectedIdx(null);
      
      queryClient.invalidateQueries({ queryKey: ['cashbook-entries', id] });
      queryClient.invalidateQueries({ queryKey: ['cashbook-totals', id] });
    } catch (err: any) {
      console.error('Bulk category update error:', err);
      toast({
        title: 'Hiba a módosítás során',
        description: err?.message || 'Nem sikerült tömegesen frissíteni a tételeket.',
        variant: 'destructive'
      });
    } finally {
      setIsBulkUpdating(false);
    }
  };

  const handleAnykExport = async () => {
    try {
      await exportEvCashbookAnykXml({
        companyName: client?.name || 'Egyéni Vállalkozó',
        companyTaxNumber: client?.taxNumber || '',
        companyAddress: (client as any)?.address || '1054 Budapest, Alkotmány utca 4.',
        taxYear,
        periodFrom: dateFromFormatted || `${taxYear}-01-01`,
        periodTo: dateToFormatted || `${taxYear}-12-31`,
        entries: filtered,
      });
      toast({ title: 'Sikeres export', description: 'ÁNYK XML sikeresen legenerálva és letöltve.' });
    } catch (err: any) {
      toast({
        title: 'Hiba történt',
        description: err?.message || 'Nem sikerült generálni az ÁNYK XML-t.',
        variant: 'destructive',
      });
    }
    setShowExportDropdown(false);
  };

  const handleOnyaExport = async () => {
    try {
      await exportEvCashbookOnyaXml({
        companyName: client?.name || 'Egyéni Vállalkozó',
        companyTaxNumber: client?.taxNumber || '',
        companyAddress: (client as any)?.address || '1054 Budapest, Alkotmány utca 4.',
        taxYear,
        periodFrom: dateFromFormatted || `${taxYear}-01-01`,
        periodTo: dateToFormatted || `${taxYear}-12-31`,
        entries: filtered,
      });
      toast({ title: 'Siker', description: 'ONYA XML sikeresen legenerálva és letöltve.' });
    } catch (err: any) {
      toast({
        title: 'Hiba történt',
        description: err?.message || 'Nem sikerült generálni az ONYA XML-t.',
        variant: 'destructive',
      });
    }
    setShowExportDropdown(false);
  };

  // ─── Real data from Supabase ───────────────────────────────────────────────
  const { data: rawEntries, isLoading } = useCashbookEntries(id, taxYear);
  const { data: evSettings } = useEvClientSettings(id, taxYear);
  const createEntry = useCreateCashbookEntry();

  const entries = useMemo(() => {
    return (rawEntries || []).map((e: PenztarkonyvTetel) => ({
      id: e.id,
      serialNumber: e.serial_number,
      entryDate: e.entry_date,
      documentNumber: e.document_number || '',
      description: e.description,
      direction: e.entry_direction,
      category: e.main_category,
      categoryLabel: CATEGORY_LABELS[e.main_category]?.label || e.main_category,
      amount: e.amount,
      vatAmount: e.vat_amount,
      periodClosed: e.period_closed,
      isStorno: e.is_storno,
    }));
  }, [rawEntries]);

  const filtered = useMemo(() => {
    let list = entries;
    // Date range filter from global date picker
    if (dateFromFormatted) {
      list = list.filter(e => e.entryDate >= dateFromFormatted);
    }
    if (dateToFormatted) {
      list = list.filter(e => e.entryDate <= dateToFormatted);
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter(e =>
        e.description.toLowerCase().includes(q) ||
        e.documentNumber.toLowerCase().includes(q) ||
        e.categoryLabel.toLowerCase().includes(q)
      );
    }
    if (filterDirection !== 'all') {
      list = list.filter(e => e.direction === filterDirection);
    }
    return list;
  }, [entries, searchQuery, filterDirection, dateFromFormatted, dateToFormatted]);

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  // Reset page and selection when filters change
  useEffect(() => {
    setCurrentPage(1);
    setSelectedIds(new Set());
    setLastSelectedIdx(null);
  }, [searchQuery, filterDirection, dateFromFormatted, dateToFormatted]);

  const totalItems = filtered.length;
  const totalPages = Math.ceil(totalItems / pageSize);

  const paginated = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, currentPage, pageSize]);

  // Totals based on filtered data (respects date range)
  const totalBevetel = filtered.filter(e => e.direction === 'bevetel').reduce((s, e) => s + e.amount, 0);
  const totalKiadas = filtered.filter(e => e.direction === 'kiadas').reduce((s, e) => s + e.amount, 0);
  const balance = totalBevetel - totalKiadas;
  const closedCount = filtered.filter(e => e.periodClosed).length;

  return (
    <div className="w-full space-y-6 animate-in fade-in duration-500">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <Link to={`/eaisybooks/${id}/${dateRange}/ev?year=${taxYear}`} className="hover:text-indigo-600 transition-colors flex items-center gap-1">
          <ArrowLeft className="w-3.5 h-3.5" /> EV Főoldal
        </Link>
        <ChevronRight className="w-3 h-3" />
        <span className="text-slate-900 dark:text-slate-100 font-medium">Pénztárkönyv</span>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-gradient-to-br from-violet-500 to-fuchsia-600 rounded-xl shadow-lg shadow-violet-500/25">
            <BookOpen className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Pénztárkönyv</h1>
            <p className="text-sm text-slate-500">Szja tv. 5. sz. melléklet — {client?.name || 'Ügyfél'} ({taxYear}. adóév)</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={taxYear}
            onChange={(e) => ((y) => { setDateFrom(new Date(y, 0, 1)); setDateTo(new Date(y, 11, 31)); })(Number(e.target.value))}
            className="text-sm border border-border rounded-lg px-3 py-1.5 bg-card text-foreground mr-2"
          >
            <option value={2026}>2026. adóév</option>
            <option value={2025}>2025. adóév</option>
          </select>
          <Link
            to={`/eaisybooks/${id}/${dateRange}/ev/cashbook/ledger?year=${taxYear}`}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
          >
            <FileText className="w-3.5 h-3.5" /> Főkönyvi nézet
          </Link>
          <Link
            to={`/eaisybooks/${id}/${dateRange}/ev/cashbook/close?year=${taxYear}`}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
          >
            <Lock className="w-3.5 h-3.5" /> Periódus zárás
          </Link>
          <div className="relative">
            <button
              onClick={() => setShowExportDropdown(!showExportDropdown)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              XML Export
              <ChevronDown className={cn("w-3 h-3 transition-transform", showExportDropdown && "rotate-180")} />
            </button>
            {showExportDropdown && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowExportDropdown(false)} />
                <div className="absolute right-0 mt-1.5 w-56 rounded-xl border border-border bg-card p-1 shadow-lg z-20 animate-in fade-in slide-in-from-top-1 duration-150">
                  <button
                    onClick={handleAnykExport}
                    className="flex items-center gap-2 w-full rounded-lg px-3 py-2.5 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-colors"
                  >
                    <div className="p-1 rounded-lg bg-blue-50 dark:bg-blue-900/30 text-blue-600">
                      <Download className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="font-semibold text-slate-900 dark:text-slate-100">ÁNYK XML</p>
                      <p className="text-[10px] text-slate-400">ÁNYK-ba importálható formátum</p>
                    </div>
                  </button>
                  <button
                    onClick={handleOnyaExport}
                    className="flex items-center gap-2 w-full rounded-lg px-3 py-2.5 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-colors"
                  >
                    <div className="p-1 rounded-lg bg-violet-50 dark:bg-violet-900/30 text-violet-600">
                      <FileText className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="font-semibold text-slate-900 dark:text-slate-100">ONYA XML</p>
                      <p className="text-[10px] text-slate-400">ONYA-ba feltölthető formátum</p>
                    </div>
                  </button>
                </div>
              </>
            )}
          </div>
          <Link
            to={`/eaisybooks/${id}/${dateRange}/ev/cashbook/import-nav?year=${taxYear}`}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
          >
            <Import className="w-3.5 h-3.5" /> NAV számlák
          </Link>
          <button
            onClick={() => setShowNewEntryForm(!showNewEntryForm)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" /> Új tétel
          </button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-card rounded-xl border border-border p-4 shadow-soft">
          <p className="text-xs text-slate-500 mb-1 flex items-center gap-1">
            <ArrowUpRight className="w-3 h-3 text-green-500" /> Összes bevétel
          </p>
          <p className="text-xl font-bold text-green-600">{formatHuf(totalBevetel)}</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-4 shadow-soft">
          <p className="text-xs text-slate-500 mb-1 flex items-center gap-1">
            <ArrowDownRight className="w-3 h-3 text-red-500" /> Összes kiadás
          </p>
          <p className="text-xl font-bold text-red-500">{formatHuf(totalKiadas)}</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-4 shadow-soft">
          <p className="text-xs text-slate-500 mb-1">Egyenleg</p>
          <p className={cn('text-xl font-bold', balance >= 0 ? 'text-slate-900 dark:text-slate-100' : 'text-red-600')}>
            {formatHuf(balance)}
          </p>
        </div>
        <div className="bg-card rounded-xl border border-border p-4 shadow-soft">
          <p className="text-xs text-slate-500 mb-1">Tételek</p>
          <div className="flex items-end gap-2">
            <p className="text-xl font-bold text-slate-900 dark:text-slate-100">{entries.length}</p>
            <p className="text-xs text-slate-400 pb-0.5">
              <Lock className="w-3 h-3 inline mr-0.5" />{closedCount} lezárt
            </p>
          </div>
        </div>
      </div>

      {/* New entry form — using the dedicated CashbookEntryForm component */}
      {showNewEntryForm && (
        <CashbookEntryForm
          nextSerialNumber={entries.length + 1}
          taxpayerForm={evSettings?.taxpayer_form}
          vatStatus={evSettings?.vat_status}
          onCancel={() => setShowNewEntryForm(false)}
          onSave={(data: CashbookEntryFormData) => {
            if (!id) return;
            createEntry.mutate(
              {
                company_id: id,
                tax_year: taxYear,
                serial_number: entries.length + 1,
                entry_date: data.entryDate,
                document_number: data.documentNumber || null,
                description: data.description,
                entry_direction: data.direction,
                main_category: data.category as PenztarkonyvTetel['main_category'],
                amount: data.amount,
                vat_amount: data.vatAmount,
                document_url: null,
                storno_of_id: null,
                is_storno: false,
                linked_record_type: null,
                linked_record_id: null,
                created_by: null,
              },
              {
                onSuccess: () => {
                  toast({ title: 'Tétel mentve', description: 'Az új pénztárkönyv tétel sikeresen rögzítve.' });
                  setShowNewEntryForm(false);
                },
                onError: (err) => {
                  toast({
                    title: 'Hiba történt',
                    description: err instanceof Error ? err.message : 'Nem sikerült menteni a tételt.',
                    variant: 'destructive',
                  });
                },
              }
            );
          }}
        />
      )}

      {/* Filter bar */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            placeholder="Keresés leírás, bizonylat..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="pl-9 bg-card border-border"
          />
        </div>
        <div className="flex gap-1 bg-slate-100 dark:bg-slate-800/50 rounded-lg p-0.5">
          {([
            ['all', 'Mind'],
            ['bevetel', '↗ Bevétel'],
            ['kiadas', '↘ Kiadás'],
          ] as [FilterDirection, string][]).map(([v, l]) => (
            <button
              key={v}
              onClick={() => setFilterDirection(v)}
              className={cn(
                'px-3 py-1.5 rounded-md text-xs font-medium transition-all',
                filterDirection === v
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-sm'
                  : 'text-slate-500'
              )}
            >
              {l}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-card rounded-xl border border-border shadow-soft overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border dark:bg-slate-900/30">
                <th className="px-4 py-3 text-center w-12">
                  <input
                    type="checkbox"
                    checked={paginated.length > 0 && paginated.every(e => selectedIds.has(e.id))}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedIds(prev => {
                          const next = new Set(prev);
                          paginated.forEach(entry => next.add(entry.id));
                          return next;
                        });
                      } else {
                        setSelectedIds(prev => {
                          const next = new Set(prev);
                          paginated.forEach(entry => next.delete(entry.id));
                          return next;
                        });
                      }
                    }}
                    className="rounded border-border bg-card text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                  />
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider w-12">#</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Dátum</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Bizonylat</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Megnevezés</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Kategória</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Összeg</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">ÁFA</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider w-12"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {isLoading ? (
                <tr>
                  <td colSpan={9} className="py-16 text-center text-sm text-slate-400">
                    <Loader2 className="w-8 h-8 mx-auto mb-3 text-indigo-400 animate-spin" />
                    Betöltés...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-16 text-center text-sm text-slate-400">
                    <BookOpen className="w-10 h-10 mx-auto mb-3 text-slate-300" />
                    {entries.length === 0 ? 'Nincs még pénztárkönyv tétel' : 'Nincs találat'}
                  </td>
                </tr>
              ) : (
                paginated.map((entry, index) => {
                  const catInfo = CATEGORY_LABELS[entry.category] || { label: entry.categoryLabel, color: 'text-slate-500' };
                  return (
                    <tr
                      key={entry.id}
                      className={cn(
                        'hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors',
                        entry.isStorno && 'opacity-50 line-through',
                        entry.periodClosed && 'bg-slate-50/50 dark:bg-slate-800/20',
                        selectedIds.has(entry.id) && 'bg-indigo-50 dark:bg-indigo-900/10'
                      )}
                    >
                      <td className="px-4 py-3 text-center">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(entry.id)}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) => {
                            const shiftKey = (e.nativeEvent as MouseEvent).shiftKey;
                            setSelectedIds(prev => {
                              const next = new Set(prev);
                              const currentIdx = paginated.findIndex(item => item.id === entry.id);
                              
                              if (shiftKey && lastSelectedIdx !== null && currentIdx !== -1) {
                                const start = Math.min(lastSelectedIdx, currentIdx);
                                const end = Math.max(lastSelectedIdx, currentIdx);
                                for (let i = start; i <= end; i++) {
                                  if (e.target.checked) next.add(paginated[i].id);
                                  else next.delete(paginated[i].id);
                                }
                              } else {
                                if (e.target.checked) next.add(entry.id);
                                else next.delete(entry.id);
                              }
                              setLastSelectedIdx(currentIdx);
                              return next;
                            });
                          }}
                          className="rounded border-border bg-card text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                        />
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-400 font-mono tabular-nums">
                        {entry.serialNumber}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-700 dark:text-slate-300 tabular-nums">
                        {entry.entryDate}
                      </td>
                      <td className="px-4 py-3 text-xs font-mono text-slate-500">
                        {entry.documentNumber}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-900 dark:text-slate-100 font-medium max-w-xs truncate">
                        {entry.description}
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn('text-xs font-medium', catInfo.color)}>
                          {catInfo.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className={cn(
                          'text-sm font-semibold font-mono tabular-nums',
                          entry.direction === 'bevetel' ? 'text-green-600' : 'text-red-500'
                        )}>
                          {entry.direction === 'bevetel' ? '+' : '–'} {formatHuf(entry.amount)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-xs text-slate-400 font-mono tabular-nums">
                        {entry.vatAmount > 0 ? formatHuf(entry.vatAmount) : '—'}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {entry.periodClosed && (
                          <span title="Lezárt időszak">
                            <Lock className="w-3.5 h-3.5 text-slate-300 mx-auto" />
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="border-t border-border px-4 py-3 bg-card">
            <UnifiedPagination
              currentPage={currentPage}
              totalPages={totalPages}
              totalItems={totalItems}
              pageSize={pageSize}
              onPageChange={setCurrentPage}
              onPageSizeChange={setPageSize}
              pageSizeOptions={[25, 50, 100]}
            />
          </div>
        )}

        {/* Footer totals */}
        <div className="border-t border-border px-4 py-3 bg-slate-50 dark:bg-slate-900/30 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <span className="text-xs text-slate-500">{filtered.length} tétel</span>
          </div>
          <div className="flex items-center gap-6">
            <div className="text-right">
              <p className="text-[10px] text-slate-400">Bevételek</p>
              <p className="text-sm font-bold text-green-600 font-mono tabular-nums">
                {formatHuf(filtered.filter(e => e.direction === 'bevetel').reduce((s, e) => s + e.amount, 0))}
              </p>
            </div>
            <div className="text-right">
              <p className="text-[10px] text-slate-400">Kiadások</p>
              <p className="text-sm font-bold text-red-500 font-mono tabular-nums">
                {formatHuf(filtered.filter(e => e.direction === 'kiadas').reduce((s, e) => s + e.amount, 0))}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Floating Action Bar */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 bg-card/90 backdrop-blur-md border border-border shadow-2xl px-6 py-3.5 rounded-2xl flex items-center justify-between gap-6 z-40 w-[95%] max-w-4xl animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-indigo-600 dark:text-indigo-400">{selectedIds.size} tétel kijelölve</span>
          </div>
          
          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-500 font-medium">Tömeges kategória:</span>
            <select
              disabled={isBulkUpdating}
              onChange={(e) => {
                if (e.target.value) {
                  handleBulkCategoryChange(e.target.value as PenztarkonyvCategory);
                  e.target.value = ''; // Reset select
                }
              }}
              className="text-xs bg-card border border-border rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-medium cursor-pointer"
              defaultValue=""
            >
              <option value="" disabled>Válassz kategóriát...</option>
              {Object.entries(CATEGORY_LABELS).map(([key, value]) => (
                <option key={key} value={key}>
                  {value.label}
                </option>
              ))}
            </select>
            <button
              onClick={() => { setSelectedIds(new Set()); setLastSelectedIdx(null); }}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              title="Kijelölés törlése"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
