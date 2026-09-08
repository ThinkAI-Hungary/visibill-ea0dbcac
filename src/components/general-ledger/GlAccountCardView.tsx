import React, { useState, useMemo, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { 
  Search, Download, FileText, Printer, RefreshCw, ChevronLeft, ChevronRight, 
  ChevronsLeft, ChevronsRight, Filter 
} from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { generateGlAccountCardPdf, GlAccountCardPdfData } from '@/lib/ledgerCardPdfs';
import { GlDateBasis, GlPostingStatus } from '@/lib/glData';
import * as XLSX from 'xlsx';

interface GlAccountCardViewProps {
  companyId: string | undefined;
  presetId: string | undefined;
  dateFrom: string;
  dateTo: string;
  dateBasis: GlDateBasis;
  postingStatus: GlPostingStatus;
  companyName?: string;
}

export function GlAccountCardView({
  companyId,
  presetId,
  dateFrom,
  dateTo,
  dateBasis,
  postingStatus,
  companyName = 'Cég',
}: GlAccountCardViewProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [selectedGlNumber, setSelectedGlNumber] = useState<string>('311');
  const [selectedGlName, setSelectedGlName] = useState<string>('Vevők');
  const [includeOpening, setIncludeOpening] = useState<boolean>(true);
  const [journalFilter, setJournalFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');

  // ── Pagination State ──
  const [pageSize, setPageSize] = useState<number | 'all'>(50);
  const [currentPage, setCurrentPage] = useState<number>(1);

  // Reset pagination when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedGlNumber, journalFilter, searchTerm, pageSize, dateFrom, dateTo, dateBasis, postingStatus]);

  // ── Query G/L accounts for dropdown (Optimized to combine preset_id, company_id & active ledger accounts) ──
  const { data: glAccounts = [] } = useQuery({
    queryKey: ['glAccountsListCombined', companyId, presetId],
    queryFn: async () => {
      if (!companyId && !presetId) return [];

      // 1. Fetch from gl_accounts by preset_id or company_id
      let query = supabase.from('gl_accounts').select('id, gl_number, short_name');
      if (presetId && companyId) {
        query = query.or(`preset_id.eq.${presetId},company_id.eq.${companyId}`);
      } else if (presetId) {
        query = query.eq('preset_id', presetId);
      } else if (companyId) {
        query = query.eq('company_id', companyId);
      }

      const { data: presetAccs, error } = await query.order('gl_number', { ascending: true }).limit(2000);
      
      const accMap = new Map<string, { id: string; gl_number: string; short_name: string }>();
      (presetAccs || []).forEach(a => {
        const cleanNum = a.gl_number.replace(/\.$/, '');
        accMap.set(cleanNum, { id: a.id, gl_number: cleanNum, short_name: a.short_name });
      });

      // 2. Add defaults if map empty
      if (!accMap.has('311')) accMap.set('311', { id: '311', gl_number: '311', short_name: 'Vevők' });
      if (!accMap.has('454')) accMap.set('454', { id: '454', gl_number: '454', short_name: 'Szállítók' });
      if (!accMap.has('381')) accMap.set('381', { id: '381', gl_number: '381', short_name: 'Házipénztár' });
      if (!accMap.has('384')) accMap.set('384', { id: '384', gl_number: '384', short_name: 'Elszámolási számla (Bank)' });

      return Array.from(accMap.values()).sort((a, b) => a.gl_number.localeCompare(b.gl_number, undefined, { numeric: true }));
    },
    staleTime: 5 * 60 * 1000,
    enabled: !!companyId || !!presetId,
  });

  // Update selectedGlName when selectedGlNumber matches
  useEffect(() => {
    if (!glAccounts.length) return;
    const clean = selectedGlNumber.replace(/\.$/, '');
    const found = glAccounts.find(g => g.gl_number === clean || g.gl_number.startsWith(clean));
    if (found) {
      setSelectedGlName(found.short_name);
    }
  }, [selectedGlNumber, glAccounts]);

  // ── Query Card Data with RPC or client-side fallback ──
  const { data: cardData, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['glAccountCardItems', companyId, presetId, selectedGlNumber, dateFrom, dateTo, includeOpening, dateBasis, postingStatus],
    queryFn: async () => {
      if (!companyId) return { openingBalance: 0, items: [], totalDebit: 0, totalCredit: 0, closingBalance: 0 };

      const cleanGlPrefix = selectedGlNumber.replace(/\.$/, '');

      // 1. Try RPC first
      const { data: rpcData, error: rpcErr } = await supabase.rpc('get_gl_account_card_items', {
        p_company_id: companyId,
        p_preset_id: presetId || null,
        p_gl_account_id: null,
        p_gl_number_prefix: cleanGlPrefix || null,
        p_date_from: dateFrom,
        p_date_to: dateTo,
        p_include_opening: includeOpening,
        p_date_basis: dateBasis,
        p_posting_status: postingStatus,
      });

      if (!rpcErr && Array.isArray(rpcData)) {
        const items = rpcData as any[];
        const openingRow = items.find(i => i.document_id === 'NYITÓ');
        const openingBal = openingRow ? (openingRow.debit_amount - openingRow.credit_amount) : 0;
        
        let tDebit = 0;
        let tCredit = 0;
        items.forEach(i => {
          if (i.document_id !== 'NYITÓ') {
            tDebit += Number(i.debit_amount || 0);
            tCredit += Number(i.credit_amount || 0);
          }
        });

        const lastRow = items[items.length - 1];
        const closingBal = lastRow ? Number(lastRow.running_balance || 0) : openingBal;

        return {
          openingBalance: openingBal,
          items,
          totalDebit: tDebit,
          totalCredit: tCredit,
          closingBalance: closingBal,
        };
      }

      // 2. Client-side fallback engine (Fully optimized column selection)
      const { data: rawLines, error: linesErr } = await supabase
        .from('acc_journal_lines')
        .select(`
          id,
          dc_type,
          amount,
          foreign_amount,
          description,
          sequence_number,
          gl_account:gl_accounts(id, gl_number, short_name),
          header:acc_journal_headers!inner(
            id,
            company_id,
            posting_date,
            document_date,
            document_id,
            description,
            status,
            currency,
            journal:acc_journals(code, name),
            partner:partners(id, name, tax_number)
          ),
          project:projects(name)
        `)
        .eq('header.company_id', companyId);

      if (linesErr) throw linesErr;

      // Filter lines matching G/L number prefix
      const filteredLines = (rawLines || []).filter((line: any) => {
        const gNum = (line.gl_account?.gl_number || '').replace(/\.$/, '');
        const matchesGl = cleanGlPrefix ? gNum.startsWith(cleanGlPrefix) : true;
        const matchesStatus = postingStatus === 'all' || line.header?.status === 'KONYVELT';
        return matchesGl && matchesStatus;
      });

      // Split into opening (prior to dateFrom) and period items
      let openDeb = 0;
      let openCred = 0;
      const periodItems: any[] = [];

      filteredLines.forEach((line: any) => {
        const hDate = dateBasis === 'teljesites' ? line.header?.document_date : line.header?.posting_date;
        if (hDate < dateFrom) {
          if (line.dc_type === 'T') openDeb += Number(line.amount || 0);
          else openCred += Number(line.amount || 0);
        } else if (hDate <= dateTo) {
          periodItems.push(line);
        }
      });

      const openingBal = openDeb - openCred;
      let running = openingBal;
      let tDebit = 0;
      let tCredit = 0;

      // Sort period items chronologically
      periodItems.sort((a, b) => {
        const dA = dateBasis === 'teljesites' ? a.header?.document_date : a.header?.posting_date;
        const dB = dateBasis === 'teljesites' ? b.header?.document_date : b.header?.posting_date;
        return (dA || '').localeCompare(dB || '');
      });

      const processedItems: any[] = [];

      if (includeOpening) {
        processedItems.push({
          line_id: 'NYITO',
          header_id: null,
          posting_date: dateFrom,
          document_date: dateFrom,
          document_id: 'NYITÓ',
          journal_code: 'NY',
          journal_name: 'Nyitó napló',
          gl_number: cleanGlPrefix || '000',
          gl_short_name: selectedGlName || 'Nyitó egyenleg',
          contra_gl_number: '-',
          contra_gl_name: '-',
          partner_name: '-',
          description: 'Időszak eleji nyitó egyenleg',
          dc_type: openingBal >= 0 ? 'T' : 'K',
          debit_amount: openingBal >= 0 ? openingBal : 0,
          credit_amount: openingBal < 0 ? Math.abs(openingBal) : 0,
          running_balance: running,
        });
      }

      periodItems.forEach((line: any) => {
        const deb = line.dc_type === 'T' ? Number(line.amount || 0) : 0;
        const cred = line.dc_type === 'K' ? Number(line.amount || 0) : 0;
        running += deb - cred;
        tDebit += deb;
        tCredit += cred;

        processedItems.push({
          line_id: line.id,
          header_id: line.header?.id,
          posting_date: line.header?.posting_date,
          document_date: line.header?.document_date,
          document_id: line.header?.document_id,
          journal_code: line.header?.journal?.code || 'VE',
          journal_name: line.header?.journal?.name || 'Vegyes',
          gl_number: line.gl_account?.gl_number,
          gl_short_name: line.gl_account?.short_name,
          contra_gl_number: '-',
          contra_gl_name: '-',
          partner_name: line.header?.partner?.name || '-',
          description: line.description || line.header?.description || '',
          dc_type: line.dc_type,
          debit_amount: deb,
          credit_amount: cred,
          foreign_amount: line.foreign_amount,
          currency: line.header?.currency || 'HUF',
          project_name: line.project?.name,
          running_balance: running,
        });
      });

      return {
        openingBalance: openingBal,
        items: processedItems,
        totalDebit: tDebit,
        totalCredit: tCredit,
        closingBalance: running,
      };
    },
    enabled: !!companyId,
  });

  // Handle Manual Refresh Button Click
  const handleRefresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ['glAccountCardItems'] });
    await refetch();
    toast({
      title: 'Főkönyvi karton frissítve',
      description: 'A könyvelési tételek sikeresen újratöltve.',
    });
  };

  // Filtered items based on local controls (Journal, Search)
  const filteredItems = useMemo(() => {
    if (!cardData?.items) return [];
    return cardData.items.filter((item: any) => {
      if (item.document_id === 'NYITÓ') return true;
      if (journalFilter !== 'all' && item.journal_code !== journalFilter) return false;
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        const docId = (item.document_id || '').toLowerCase();
        const desc = (item.description || '').toLowerCase();
        const part = (item.partner_name || '').toLowerCase();
        const contra = (item.contra_gl_number || '').toLowerCase();
        if (!docId.includes(term) && !desc.includes(term) && !part.includes(term) && !contra.includes(term)) {
          return false;
        }
      }
      return true;
    });
  }, [cardData?.items, journalFilter, searchTerm]);

  // ── Pagination Math ──
  const totalItems = filteredItems.length;
  const totalPages = pageSize === 'all' ? 1 : Math.ceil(totalItems / pageSize) || 1;
  const validCurrentPage = Math.min(currentPage, totalPages);

  const paginatedItems = useMemo(() => {
    if (pageSize === 'all') return filteredItems;
    const start = (validCurrentPage - 1) * pageSize;
    return filteredItems.slice(start, start + pageSize);
  }, [filteredItems, pageSize, validCurrentPage]);

  // Handle PDF Export
  const handleExportPdf = () => {
    if (!cardData) return;
    const pdfData: GlAccountCardPdfData = {
      companyName,
      glNumber: selectedGlNumber,
      glShortName: selectedGlName,
      dateFrom,
      dateTo,
      openingBalance: cardData.openingBalance,
      totalDebit: cardData.totalDebit,
      totalCredit: cardData.totalCredit,
      closingBalance: cardData.closingBalance,
      items: filteredItems.map((i: any) => ({
        posting_date: i.posting_date,
        document_date: i.document_date,
        document_id: i.document_id,
        journal_code: i.journal_code,
        contra_gl_number: i.contra_gl_number || '-',
        contra_gl_name: i.contra_gl_name || '-',
        partner_name: i.partner_name,
        description: i.description,
        debit_amount: Number(i.debit_amount || 0),
        credit_amount: Number(i.credit_amount || 0),
        running_balance: Number(i.running_balance || 0),
      })),
    };

    const pdfDoc = generateGlAccountCardPdf(pdfData);
    pdfDoc.save(`Fokonyvi_Karton_${selectedGlNumber}_${dateFrom}_${dateTo}.pdf`);
  };

  // Handle Excel Export
  const handleExportExcel = () => {
    if (!filteredItems.length) return;
    const exportRows = filteredItems.map((item: any) => ({
      'Könyvelés dátuma': item.posting_date,
      'Teljesítés dátuma': item.document_date || '-',
      'Bizonylatszám': item.document_id,
      'Napló': item.journal_code,
      'Főkönyvi számla': item.gl_number,
      'Ellenszámla': item.contra_gl_number || '-',
      'Partner': item.partner_name || '-',
      'Megjegyzés / Szöveg': item.description,
      'Tartozik (Ft)': Number(item.debit_amount || 0),
      'Követel (Ft)': Number(item.credit_amount || 0),
      'Göngyölt egyenleg (Ft)': Number(item.running_balance || 0),
    }));

    const ws = XLSX.utils.json_to_sheet(exportRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `Karton_${selectedGlNumber}`);
    XLSX.writeFile(wb, `Fokonyvi_Karton_${selectedGlNumber}_${dateFrom}_${dateTo}.xlsx`);
  };

  return (
    <div className="space-y-4">
      {/* ── Selection & Filter Controls ── */}
      <div className="bg-card p-4 rounded-xl border border-border shadow-xs space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
          {/* G/L Account Selector */}
          <div className="space-y-1.5 md:col-span-2">
            <Label className="text-xs font-semibold">Főkönyvi számla kiválasztása *</Label>
            <div className="flex gap-2">
              <Select
                value={selectedGlNumber}
                onValueChange={(val) => {
                  setSelectedGlNumber(val);
                  const found = glAccounts.find(g => g.gl_number === val);
                  if (found) setSelectedGlName(found.short_name);
                }}
              >
                <SelectTrigger className="w-full h-9 font-mono text-sm">
                  <SelectValue placeholder="Válassz számlát..." />
                </SelectTrigger>
                <SelectContent className="max-h-[320px]">
                  {glAccounts.map(a => (
                    <SelectItem key={a.id || a.gl_number} value={a.gl_number} className="font-mono text-xs">
                      {a.gl_number} — {a.short_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                className="w-28 h-9 font-mono text-sm shrink-0"
                value={selectedGlNumber}
                onChange={e => setSelectedGlNumber(e.target.value)}
                placeholder="pl. 311"
                title="Kézi számlaszám vagy prefix megadása (pl. 311, 454)"
              />
            </div>
          </div>

          {/* Journal Filter */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Napló szűrő</Label>
            <Select value={journalFilter} onValueChange={setJournalFilter}>
              <SelectTrigger className="h-9 text-xs">
                <SelectValue placeholder="Összes napló" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Összes napló</SelectItem>
                <SelectItem value="B1">Bank (B1)</SelectItem>
                <SelectItem value="P1">Pénztár (P1)</SelectItem>
                <SelectItem value="V">Vevő (V)</SelectItem>
                <SelectItem value="SZ">Szállító (SZ)</SelectItem>
                <SelectItem value="VE">Vegyes (VE)</SelectItem>
                <SelectItem value="NY">Nyitó (NY)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Search Input */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Keresés</Label>
            <div className="relative">
              <Search className="w-4 h-4 absolute left-2.5 top-2.5 text-muted-foreground" />
              <Input
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                placeholder="Bizonylatszám, partner..."
                className="pl-8 h-9 text-xs"
              />
            </div>
          </div>
        </div>

        {/* Second Row: Checkbox & Actions */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-border/50">
          <div className="flex items-center gap-2">
            <Checkbox
              id="opening-check"
              checked={includeOpening}
              onCheckedChange={(v) => setIncludeOpening(!!v)}
            />
            <Label htmlFor="opening-check" className="text-xs cursor-pointer select-none">
              Nyitó egyenleg megjelenítése a karton elején
            </Label>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isFetching} className="h-8 text-xs gap-1.5">
              <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin' : ''}`} /> Frissítés
            </Button>
            <Button variant="outline" size="sm" onClick={handleExportExcel} className="h-8 text-xs gap-1.5">
              <Download className="w-3.5 h-3.5" /> Excel export
            </Button>
            <Button size="sm" onClick={handleExportPdf} className="h-8 text-xs gap-1.5 bg-primary text-primary-foreground">
              <Printer className="w-3.5 h-3.5" /> Karton PDF
            </Button>
          </div>
        </div>
      </div>

      {/* ── Summary Cards Banner ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-card border border-border/60 rounded-xl p-3 flex flex-col justify-between">
          <span className="text-xs text-muted-foreground font-medium">Nyitó egyenleg</span>
          <span className={`text-base font-bold tabular-nums mt-1 ${cardData?.openingBalance && cardData.openingBalance < 0 ? 'text-destructive' : 'text-foreground'}`}>
            {formatCurrency(cardData?.openingBalance || 0)}
          </span>
        </div>
        <div className="bg-card border border-amber-500/20 bg-amber-500/5 rounded-xl p-3 flex flex-col justify-between">
          <span className="text-xs text-amber-700 dark:text-amber-400 font-medium">Időszaki Tartozik (T)</span>
          <span className="text-base font-bold tabular-nums text-amber-600 dark:text-amber-400 mt-1">
            +{formatCurrency(cardData?.totalDebit || 0)}
          </span>
        </div>
        <div className="bg-card border border-sky-500/20 bg-sky-500/5 rounded-xl p-3 flex flex-col justify-between">
          <span className="text-xs text-sky-700 dark:text-sky-400 font-medium">Időszaki Követel (K)</span>
          <span className="text-base font-bold tabular-nums text-sky-600 dark:text-sky-400 mt-1">
            -{formatCurrency(cardData?.totalCredit || 0)}
          </span>
        </div>
        <div className="bg-card border border-emerald-500/20 bg-emerald-500/5 rounded-xl p-3 flex flex-col justify-between">
          <span className="text-xs text-emerald-700 dark:text-emerald-400 font-medium">Záró egyenleg</span>
          <span className="text-base font-bold tabular-nums text-emerald-600 dark:text-emerald-400 mt-1">
            {formatCurrency(cardData?.closingBalance || 0)}
          </span>
        </div>
      </div>

      {/* ── Itemized Ledger Table ── */}
      <Card className="border-border/60 shadow-sm overflow-hidden">
        <CardHeader className="py-3 px-4 bg-muted/40 border-b flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <FileText className="w-4 h-4 text-primary" />
              {selectedGlNumber} — {selectedGlName} Karton Tételei ({filteredItems.length} tétel)
            </CardTitle>
            <span className="text-xs font-mono text-muted-foreground hidden md:inline">
              ({dateFrom.replace(/-/g, '.')} – {dateTo.replace(/-/g, '.')})
            </span>
          </div>

          {/* ── Top Pagination Controls & Selector ── */}
          <div className="flex flex-wrap items-center gap-3 text-xs">
            <div className="flex items-center gap-1.5">
              <span className="text-muted-foreground font-medium">Megjelenítés:</span>
              <Select
                value={String(pageSize)}
                onValueChange={(val) => setPageSize(val === 'all' ? 'all' : Number(val))}
              >
                <SelectTrigger className="h-8 w-28 text-xs bg-background">
                  <SelectValue placeholder="50" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="50">50 / oldal</SelectItem>
                  <SelectItem value="100">100 / oldal</SelectItem>
                  <SelectItem value="200">200 / oldal</SelectItem>
                  <SelectItem value="all">Összes tétel</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <span className="text-muted-foreground font-mono">
              {pageSize === 'all' ? (
                `1 – ${totalItems} tétel`
              ) : (
                `${(validCurrentPage - 1) * pageSize + 1} – ${Math.min(validCurrentPage * pageSize, totalItems)} / ${totalItems} tétel`
              )}
            </span>

            {pageSize !== 'all' && totalPages > 1 && (
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-7 w-7 bg-background"
                  disabled={validCurrentPage <= 1}
                  onClick={() => setCurrentPage(1)}
                  title="Első oldal"
                >
                  <ChevronsLeft className="w-3.5 h-3.5" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-7 w-7 bg-background"
                  disabled={validCurrentPage <= 1}
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  title="Előző oldal"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </Button>

                <span className="px-1 font-mono font-bold text-foreground">
                  {validCurrentPage} / {totalPages}
                </span>

                <Button
                  variant="outline"
                  size="icon"
                  className="h-7 w-7 bg-background"
                  disabled={validCurrentPage >= totalPages}
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  title="Következő oldal"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-7 w-7 bg-background"
                  disabled={validCurrentPage >= totalPages}
                  onClick={() => setCurrentPage(totalPages)}
                  title="Utolsó oldal"
                >
                  <ChevronsRight className="w-3.5 h-3.5" />
                </Button>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          {isLoading ? (
            <div className="p-6 space-y-3">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground text-sm italic">
              Nincs megjeleníthető könyvelési tétel a megadott szűrési feltételekkel.
            </div>
          ) : (
            <table className="w-full text-xs text-left">
              <thead className="bg-muted/50 border-b text-muted-foreground font-semibold">
                <tr>
                  <th className="py-2.5 px-3">Dátum</th>
                  <th className="py-2.5 px-3">Bizonylatszám</th>
                  <th className="py-2.5 px-3 text-center">Napló</th>
                  <th className="py-2.5 px-3">Ellenszámla (Kontírpár)</th>
                  <th className="py-2.5 px-3">Partner</th>
                  <th className="py-2.5 px-3">Megjegyzés / Szöveg</th>
                  <th className="py-2.5 px-3 text-right">Tartozik (T)</th>
                  <th className="py-2.5 px-3 text-right">Követel (K)</th>
                  <th className="py-2.5 px-3 text-right font-bold">Göngyölt egyenleg</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {paginatedItems.map((item: any, idx: number) => {
                  const isOpening = item.document_id === 'NYITÓ';
                  return (
                    <tr
                      key={item.line_id || idx}
                      className={`hover:bg-muted/40 transition-colors ${isOpening ? 'bg-muted/30 font-semibold' : ''}`}
                    >
                      <td className="py-2 px-3 font-mono text-muted-foreground">
                        {item.posting_date ? item.posting_date.replace(/-/g, '.') : '-'}
                      </td>
                      <td className="py-2 px-3 font-mono font-bold text-foreground">
                        {item.document_id}
                      </td>
                      <td className="py-2 px-3 text-center">
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-mono">
                          {item.journal_code}
                        </Badge>
                      </td>
                      <td className="py-2 px-3 font-mono font-semibold text-primary">
                        {item.contra_gl_number}
                        {item.contra_gl_name && item.contra_gl_name !== '-' && (
                          <span className="text-[10px] text-muted-foreground font-normal ml-1">({item.contra_gl_name})</span>
                        )}
                      </td>
                      <td className="py-2 px-3 truncate max-w-[160px]" title={item.partner_name}>
                        {item.partner_name || '-'}
                      </td>
                      <td className="py-2 px-3 max-w-[240px] truncate" title={item.description}>
                        {item.description}
                      </td>
                      <td className="py-2 px-3 text-right tabular-nums text-amber-600 dark:text-amber-400 font-medium">
                        {item.debit_amount > 0 ? `+${formatCurrency(item.debit_amount)}` : '-'}
                      </td>
                      <td className="py-2 px-3 text-right tabular-nums text-sky-600 dark:text-sky-400 font-medium">
                        {item.credit_amount > 0 ? `-${formatCurrency(item.credit_amount)}` : '-'}
                      </td>
                      <td className="py-2 px-3 text-right tabular-nums font-bold text-foreground">
                        {formatCurrency(item.running_balance)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

