import { useDateRange } from '@/contexts/DateRangeContext';
import React, { useState, useMemo, useEffect } from 'react';
import { UnifiedPagination } from '@/components/ui/unified-pagination';
import { Link, useParams, useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft, ChevronRight, Import, ShieldAlert, Sparkles,
  Loader2, CheckSquare, Square, Check, AlertCircle
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAccountyClient } from '@/hooks/accounty';
import {
  useCashbookEntries,
  useCreateCashbookEntry,
  useEvClientSettings,
  type PenztarkonyvCategory,
  type PenztarkonyvDirection,
  type PenztarkonyvTetel
} from '@/hooks/useEvData';
import { useCompanyInvoices } from '@/hooks/accounty';

const CATEGORIES: { key: PenztarkonyvCategory; label: string; direction: PenztarkonyvDirection }[] = [
  { key: 'bevetel_adokoteles', label: 'I. Adóköteles bevétel', direction: 'bevetel' },
  { key: 'bevetel_fizetendo_afa', label: 'II. Fizetendő ÁFA', direction: 'bevetel' },
  { key: 'bevetel_be_nem_szamito', label: 'III. Be nem számító bevétel', direction: 'bevetel' },
  { key: 'kiadas_anyag_arubeszerzes', label: 'IV. 1. Anyag/árubeszerzés', direction: 'kiadas' },
  { key: 'kiadas_kozvetitett_szolgaltatas', label: 'IV. 2. Közvetített szolgáltatás', direction: 'kiadas' },
  { key: 'kiadas_alkalmazott_ber_kozteher', label: 'IV. 3. Bér és közteher', direction: 'kiadas' },
  { key: 'kiadas_vallalkozoi_kivet', label: 'IV. 4. Vállalkozói kivét', direction: 'kiadas' },
  { key: 'kiadas_egyeb_koltseg', label: 'IV. 5. Egyéb költség', direction: 'kiadas' },
  { key: 'kiadas_beruhazasi_koltseg', label: 'V. Beruházási költség', direction: 'kiadas' },
  { key: 'kiadas_levonhato_afa', label: 'VI. Levonható ÁFA', direction: 'kiadas' },
  { key: 'kiadas_egyeb_nem_koltseg', label: 'VII. Egyéb nem költség', direction: 'kiadas' },
];

interface GridRow {
  invoiceId: string;
  invoiceNumber: string;
  partnerName: string;
  date: string;
  grossAmount: number;
  vatAmount: number;
  direction: 'bejovo' | 'kimeno';
  category: PenztarkonyvCategory;
  description: string;
  selected: boolean;
  isPredicting: boolean;
  ruleApplied?: boolean;
}

export default function EvCashbookImportNavPage() {
  const { companyId, dateRange } = useParams<{ companyId: string; dateRange: string }>();
  const id = companyId;
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const { dateFrom, setDateFrom, setDateTo, dateFromFormatted, dateToFormatted } = useDateRange();
  const taxYear = dateFrom.getFullYear();
  const [gridData, setGridData] = useState<GridRow[]>([]);
  const [dataInitialized, setDataInitialized] = useState(false);
  const [isPredictingAll, setIsPredictingAll] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [processedCount, setProcessedCount] = useState(0);
  const [lastSelectedIndex, setLastSelectedIndex] = useState<number | null>(null);

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  // Reset page when data changes
  useEffect(() => {
    setCurrentPage(1);
  }, [dataInitialized]);

  const totalItems = gridData.length;
  const totalPages = Math.ceil(totalItems / pageSize);

  const paginatedGridData = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return gridData.slice(start, start + pageSize);
  }, [gridData, currentPage, pageSize]);

  // Queries
  const { data: client } = useAccountyClient(id);
  const { data: invoices, isLoading: invoicesLoading } = useCompanyInvoices(id || '');
  const { data: cashbookEntries, isLoading: entriesLoading } = useCashbookEntries(id, taxYear);
  const createCashbookEntry = useCreateCashbookEntry();

  // Find which invoices are already imported in the cashbook
  const importedInvoiceIds = useMemo(() => {
    if (!cashbookEntries) return new Set<string>();
    const ids = new Set<string>();
    cashbookEntries.forEach(entry => {
      if (entry.linked_record_id) {
        ids.add(entry.linked_record_id);
      }
    });
    return ids;
  }, [cashbookEntries]);

  // Filter invoices to get those NOT already imported
  const importableInvoices = useMemo(() => {
    if (!invoices) return [];
    return invoices.filter(inv => !importedInvoiceIds.has(inv.id));
  }, [invoices, importedInvoiceIds]);

  // Initialize grid once data is loaded
  if (invoices && cashbookEntries && !dataInitialized) {
    const initialGrid = importableInvoices.map(inv => {
      const isSales = inv.type === 'kimeno';
      
      // Load local rules for category prediction fallback
      let defaultCat: PenztarkonyvCategory = isSales ? 'bevetel_adokoteles' : 'kiadas_egyeb_koltseg';
      let ruleApplied = false;
      try {
        const localRules = JSON.parse(localStorage.getItem(`cashbook_rules_${id}`) || '{}');
        const partnerKey = inv.partnerName.trim().toLowerCase();
        if (localRules[partnerKey]) {
          defaultCat = localRules[partnerKey];
          ruleApplied = true;
        }
      } catch (err) {}

      if (!ruleApplied) {
        const lowerPartner = inv.partnerName.toLowerCase();
        if (!isSales) {
          if (lowerPartner.includes('nav') || lowerPartner.includes('adó') || lowerPartner.includes('vám')) {
            defaultCat = 'kiadas_egyeb_nem_koltseg';
          } else if (lowerPartner.includes('tesco') || lowerPartner.includes('auchan') || lowerPartner.includes('obi') || lowerPartner.includes('praktiker') || lowerPartner.includes('lild') || lowerPartner.includes('aldi') || lowerPartner.includes('irodaszer')) {
            defaultCat = 'kiadas_anyag_arubeszerzes';
          }
        }
      }

      return {
        invoiceId: inv.id,
        invoiceNumber: inv.invoiceNumber,
        partnerName: inv.partnerName,
        date: inv.rawDate || new Date().toISOString().slice(0, 10),
        grossAmount: inv.grossAmount,
        vatAmount: inv.vatAmount,
        direction: isSales ? 'kimeno' : 'bejovo',
        category: defaultCat,
        description: ruleApplied 
          ? `${inv.partnerName} - Szabály alapján besorolva` 
          : `${inv.partnerName} - Számla: ${inv.invoiceNumber}`,
        selected: true,
        isPredicting: false,
        ruleApplied,
      };
    });
    setGridData(initialGrid);
    setDataInitialized(true);
  }

  // Handle individual row updates
  const handleUpdateRow = (invoiceId: string, updates: Partial<GridRow>) => {
    setGridData(prev => prev.map(row => row.invoiceId === invoiceId ? { ...row, ...updates } : row));
  };

  // Handle Shift + click multiselect
  const handleCheckboxClick = (e: React.MouseEvent, index: number) => {
    const targetRow = gridData[index];
    const newSelected = !targetRow.selected;

    if (e.shiftKey && lastSelectedIndex !== null) {
      const start = Math.min(lastSelectedIndex, index);
      const end = Math.max(lastSelectedIndex, index);
      setGridData(prev =>
        prev.map((row, i) => (i >= start && i <= end ? { ...row, selected: newSelected } : row))
      );
    } else {
      handleUpdateRow(targetRow.invoiceId, { selected: newSelected });
      setLastSelectedIndex(index);
    }
  };

  // Toggle selection
  const handleToggleSelectAll = () => {
    const allSelected = gridData.every(r => r.selected);
    setGridData(prev => prev.map(r => ({ ...r, selected: !allSelected })));
  };

  // AI Auto-Prediction with batching to avoid timeouts
  const handleAiPredictAll = async () => {
    const selectedRows = gridData.filter(r => r.selected);
    if (selectedRows.length === 0) {
      toast({
        title: 'Figyelmeztetés',
        description: 'Válassz ki legalább egy számlát a jósláshoz!',
        variant: 'destructive',
      });
      return;
    }

    setIsPredictingAll(true);
    setProcessedCount(0);
    
    try {
      const payload = selectedRows.map(r => ({
        id: r.invoiceId,
        partnerName: r.partnerName,
        grossAmount: r.grossAmount,
        direction: r.direction === 'bejovo' ? 'bejovo' as const : 'kimeno' as const,
      }));

      // Chunk payload into batches of 50 to prevent timeout
      const BATCH_SIZE = 50;
      const batches: typeof payload[] = [];
      for (let i = 0; i < payload.length; i += BATCH_SIZE) {
        batches.push(payload.slice(i, i + BATCH_SIZE));
      }

      const predictionsMap = new Map<string, { category: PenztarkonyvCategory; explanation: string }>();

      for (let i = 0; i < batches.length; i++) {
        const batch = batches[i];
        
        const { data: responseData, error } = await supabase.functions.invoke('accounty-ai-categorize', {
          body: { invoices: batch }
        });

        if (error || !responseData?.predictions) {
          throw error || new Error(`Hiba történt a(z) ${i + 1}. csoport feldolgozásánál.`);
        }

        responseData.predictions.forEach((pred: any) => {
          predictionsMap.set(pred.id, {
            category: pred.category as PenztarkonyvCategory,
            explanation: pred.explanation
          });
        });

        setProcessedCount(prev => prev + batch.length);
      }

      setGridData(prev => prev.map(row => {
        if (!row.selected) return row;
        
        // Prioritize local rules first
        try {
          const localRules = JSON.parse(localStorage.getItem(`cashbook_rules_${id}`) || '{}');
          const partnerKey = row.partnerName.trim().toLowerCase();
          if (localRules[partnerKey]) {
            return {
              ...row,
              category: localRules[partnerKey],
              ruleApplied: true,
              description: `${row.partnerName} - Szabály alapján besorolva`
            };
          }
        } catch (e) {}

        const pred = predictionsMap.get(row.invoiceId);
        if (pred) {
          return {
            ...row,
            category: pred.category,
            ruleApplied: false,
            description: `${row.partnerName} - ${pred.explanation || `Számla: ${row.invoiceNumber}`}`
          };
        }
        return row;
      }));

      toast({
        title: 'Sikeres AI kategorizálás',
        description: `Minden kategória sikeresen frissítve ${selectedRows.length} számlánál.`,
      });
    } catch (err: any) {
      console.error('AI Prediction error:', err);
      toast({
        title: 'AI Hiba',
        description: err.message || 'Sikertelen AI kategória jóslás.',
        variant: 'destructive',
      });
    } finally {
      setIsPredictingAll(false);
      setProcessedCount(0);
    }
  };

  // Perform Import
  const handleImportSelected = async () => {
    const selectedRows = gridData.filter(r => r.selected);
    if (selectedRows.length === 0) {
      toast({
        title: 'Figyelmeztetés',
        description: 'Nincs kijelölt számla az importhoz!',
        variant: 'destructive',
      });
      return;
    }

    setIsImporting(true);
    let successCount = 0;
    let errorCount = 0;

    try {
      const nextSerialStart = (cashbookEntries?.length || 0) + 1;

      for (let i = 0; i < selectedRows.length; i++) {
        const row = selectedRows[i];
        try {
          await createCashbookEntry.mutateAsync({
            company_id: id || '',
            tax_year: taxYear,
            serial_number: nextSerialStart + i,
            entry_date: row.date,
            document_number: row.invoiceNumber,
            description: row.description,
            entry_direction: row.direction === 'bejovo' ? 'kiadas' : 'bevetel',
            main_category: row.category,
            amount: row.grossAmount,
            vat_amount: row.vatAmount,
            document_url: null,
            storno_of_id: null,
            is_storno: false,
            linked_record_type: row.direction === 'bejovo' ? 'nav_invoice' : 'invoice',
            linked_record_id: row.invoiceId,
            created_by: null,
          });
          successCount++;
        } catch (err) {
          console.error(`Import failed for invoice ${row.invoiceNumber}:`, err);
          errorCount++;
        }
      }

      toast({
        title: 'Importálás kész',
        description: `${successCount} számla sikeresen importálva a pénztárkönyvbe.${errorCount > 0 ? ` ${errorCount} sikertelen.` : ''}`,
      });

      // Clear the grid and navigate back to cashbook
      navigate(`/eaisybooks/${id}/${dateRange}/ev/cashbook?year=${taxYear}`);
    } catch (err: any) {
      toast({
        title: 'Hiba történt',
        description: 'Váratlan hiba az importálás során.',
        variant: 'destructive',
      });
    } finally {
      setIsImporting(false);
    }
  };

  const selectedCount = gridData.filter(r => r.selected).length;
  const selectedGross = gridData.filter(r => r.selected).reduce((sum, r) => sum + r.grossAmount, 0);
  const selectedVat = gridData.filter(r => r.selected).reduce((sum, r) => sum + r.vatAmount, 0);

  const isLoading = invoicesLoading || entriesLoading;

  return (
    <div className="w-full space-y-6 pb-24 animate-in fade-in duration-500">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <Link to={`/eaisybooks/${id}/${dateRange}/ev/cashbook?year=${taxYear}`} className="hover:text-indigo-600 transition-colors flex items-center gap-1">
          <ArrowLeft className="w-3.5 h-3.5" /> Pénztárkönyv
        </Link>
        <ChevronRight className="w-3 h-3" />
        <span className="text-slate-900 dark:text-slate-100 font-medium">NAV Import Varázsló</span>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-xl shadow-lg shadow-indigo-500/25">
            <Import className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">NAV Számla Import Varázsló</h1>
            <p className="text-sm text-slate-500">NAV Online Számla adatok átvitele a pénztárkönyvbe kategória-jóslással</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            onClick={handleAiPredictAll}
            disabled={selectedCount === 0 || isPredictingAll || isImporting}
            className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white font-medium shadow-md shadow-indigo-500/20 gap-2"
          >
            {isPredictingAll ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Feldolgozás ({processedCount}/{selectedCount})...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                AI Kategorizálás
              </>
            )}
          </Button>
        </div>
      </div>

      {/* GDPR & Usage Alert */}
      <div className="p-4 bg-amber-50/80 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 rounded-xl flex items-start gap-3">
        <ShieldAlert className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
        <div>
          <h4 className="text-sm font-bold text-amber-900 dark:text-amber-400">Biztonsági és AI tudnivalók</h4>
          <p className="text-xs text-amber-700 dark:text-amber-500 leading-relaxed mt-1">
            Az AI kategória jóslás a számlapartner neve és a bruttó összeg alapján történik. Személyes adatokat és részletes tétel szintű leírást nem továbbítunk az AI szolgáltatónak. Kérjük, az importálás előtt ellenőrizd és igazítsd be a kategóriákat a táblázatban.
          </p>
        </div>
      </div>

      {/* Grid Container */}
      <div className="bg-card rounded-xl border border-border shadow-soft overflow-hidden">
        {isLoading ? (
          <div className="py-24 text-center text-sm text-slate-400">
            <Loader2 className="w-8 h-8 mx-auto mb-3 text-indigo-400 animate-spin" />
            Adatok betöltése és egyeztetése...
          </div>
        ) : gridData.length === 0 ? (
          <div className="py-24 text-center text-slate-400 flex flex-col items-center">
            <div className="w-12 h-12 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-4">
              <Check className="w-6 h-6 text-green-500" />
            </div>
            <h3 className="font-semibold text-slate-900 dark:text-slate-100 mb-1">Minden számla importálva!</h3>
            <p className="text-xs text-slate-500 max-w-sm">Nincs több új NAV számla, amit a pénztárkönyvbe kellene importálni ebben az adóévben.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-border dark:bg-slate-900/30">
                  <th className="px-4 py-3 text-center w-12">
                    <button
                      onClick={handleToggleSelectAll}
                      className="text-slate-400 hover:text-slate-600 transition-colors mx-auto block"
                    >
                      {gridData.every(r => r.selected) ? (
                        <CheckSquare className="w-4 h-4 text-indigo-600" />
                      ) : (
                        <Square className="w-4 h-4" />
                      )}
                    </button>
                  </th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Számla szám</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Partner és Dátum</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Típus</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">Összegek</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Pénztárkönyv Kategória</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Megjegyzés / Leírás</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {paginatedGridData.map((row, index) => {
                  const absoluteIndex = (currentPage - 1) * pageSize + index;
                  return (
                    <tr
                      key={row.invoiceId}
                      className={cn(
                        "hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors",
                        !row.selected && "opacity-60"
                      )}
                    >
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={(e) => handleCheckboxClick(e, absoluteIndex)}
                          className="text-slate-400 hover:text-slate-600 transition-colors mx-auto block"
                        >
                          {row.selected ? (
                            <CheckSquare className="w-4 h-4 text-indigo-600" />
                          ) : (
                            <Square className="w-4 h-4" />
                          )}
                        </button>
                      </td>
                      <td className="px-4 py-3 text-xs font-mono font-medium text-slate-900 dark:text-slate-100">
                        {row.invoiceNumber}
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                          {row.partnerName}
                        </div>
                        <div className="text-xs text-slate-400">
                          {row.date}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn(
                          "text-[10px] font-bold px-2 py-0.5 rounded-full",
                          row.direction === 'kimeno'
                            ? "bg-green-100 text-green-700 dark:bg-green-950/30 dark:text-green-400"
                            : "bg-red-100 text-red-700 dark:bg-red-950/30 dark:text-red-400"
                        )}>
                          {row.direction === 'kimeno' ? 'Kimenő' : 'Bejövő'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="text-sm font-bold text-slate-900 dark:text-slate-100 font-mono tabular-nums">
                          {new Intl.NumberFormat('hu-HU', { style: 'currency', currency: 'HUF', minimumFractionDigits: 0 }).format(row.grossAmount)}
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono tabular-nums">
                          ÁFA: {new Intl.NumberFormat('hu-HU', { style: 'currency', currency: 'HUF', minimumFractionDigits: 0 }).format(row.vatAmount)}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5 min-w-[200px]">
                          <select
                            value={row.category}
                            onChange={(e) => handleUpdateRow(row.invoiceId, { category: e.target.value as PenztarkonyvCategory, ruleApplied: false })}
                            className={cn(
                              "flex-1 text-xs bg-card border rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-medium transition-colors",
                              row.ruleApplied
                                ? "border-indigo-500/50 bg-indigo-50/30 dark:bg-indigo-950/20 text-indigo-700 dark:text-indigo-400"
                                : "border-border"
                            )}
                          >
                            {CATEGORIES.filter(cat => cat.direction === (row.direction === 'kimeno' ? 'bevetel' : 'kiadas')).map(cat => (
                              <option key={cat.key} value={cat.key}>
                                {cat.label}
                              </option>
                            ))}
                          </select>
                          <button
                            onClick={() => {
                              try {
                                const localRules = JSON.parse(localStorage.getItem(`cashbook_rules_${id}`) || '{}');
                                localRules[row.partnerName.trim().toLowerCase()] = row.category;
                                localStorage.setItem(`cashbook_rules_${id}`, JSON.stringify(localRules));
                                handleUpdateRow(row.invoiceId, { ruleApplied: true, description: `${row.partnerName} - Szabály alapján besorolva` });
                                toast({
                                  title: 'Szabály mentve!',
                                  description: `A(z) "${row.partnerName}" partner kategóriája elmentve.`
                                });
                              } catch (err) {}
                            }}
                            className="p-1 rounded bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-500 hover:text-indigo-600 transition-colors shrink-0"
                            title="Mentés szabályként ehhez a partnerhez"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <Input
                          value={row.description}
                          onChange={(e) => handleUpdateRow(row.invoiceId, { description: e.target.value })}
                          className="text-xs bg-card border-border font-medium h-8"
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
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
      </div>

      {/* Floating Action Bar */}
      {gridData.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-card/85 backdrop-blur-md border-t border-border shadow-2xl p-4 flex items-center justify-between z-40 max-w-7xl mx-auto rounded-t-2xl">
          <div className="flex items-center gap-6">
            <div>
              <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Kijelölve</p>
              <p className="text-lg font-bold text-indigo-600">{selectedCount} számla</p>
            </div>
            <div className="h-8 w-px bg-border" />
            <div>
              <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Bruttó összeg</p>
              <p className="text-sm font-bold font-mono text-slate-800 dark:text-slate-200">
                {new Intl.NumberFormat('hu-HU', { style: 'currency', currency: 'HUF', minimumFractionDigits: 0 }).format(selectedGross)}
              </p>
            </div>
            <div className="h-8 w-px bg-border hidden sm:block" />
            <div className="hidden sm:block">
              <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">ÁFA tartalom</p>
              <p className="text-xs font-bold font-mono text-slate-500 dark:text-slate-400">
                {new Intl.NumberFormat('hu-HU', { style: 'currency', currency: 'HUF', minimumFractionDigits: 0 }).format(selectedVat)}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              onClick={() => navigate(`/eaisybooks/${id}/${dateRange}/ev/cashbook?year=${taxYear}`)}
              className="border-border text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              Mégse
            </Button>
            <Button
              onClick={handleImportSelected}
              disabled={selectedCount === 0 || isImporting || isPredictingAll}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold gap-2 shadow-lg shadow-indigo-500/20"
            >
              {isImporting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Importálás...
                </>
              ) : (
                <>
                  <Import className="w-4 h-4" />
                  Kijelöltek importálása
                </>
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
