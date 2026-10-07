import React, { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Receipt,
  Search,
  CheckCircle2,
  Clock,
  AlertCircle,
  Banknote,
  Eye,
  RotateCcw,
  Loader2,
  ChevronRight,
  ChevronDown,
  ChevronsUpDown,
  List,
  Layers,
} from 'lucide-react';
import { OpgTransactionDetailSheet } from './OpgTransactionDetailSheet';
import type {
  OpgTransaction,
  OpgCashRegister,
  OpgTransactionType,
  OpgProcessingStatus,
} from '@/types/opg';

interface OpgTransactionsTabProps {
  transactions: OpgTransaction[];
  registers: OpgCashRegister[];
  isLoading?: boolean;
  onBookTransaction: (txId: string) => Promise<any>;
  isBookingTransaction?: boolean;
  onBookAllPending: () => Promise<any>;
  isBookingAllPending?: boolean;
}

interface OpgZReportGroup {
  id: string;
  zReport: OpgTransaction | null;
  date: string;
  time: string;
  displayNumber: string;
  cashRegister?: Pick<OpgCashRegister, 'id' | 'name' | 'ap_code'> | null;
  opgId: string;
  items: OpgTransaction[];
  filteredItems: OpgTransaction[];
  totalGross: number;
  cashAmount: number;
  cardAmount: number;
  hasPendingCash: boolean;
  isOpenShift: boolean;
}

export const OpgTransactionsTab: React.FC<OpgTransactionsTabProps> = ({
  transactions,
  registers,
  isLoading = false,
  onBookTransaction,
  isBookingTransaction = false,
  onBookAllPending,
  isBookingAllPending = false,
}) => {
  const [search, setSearch] = useState('');
  const [selectedRegisterId, setSelectedRegisterId] = useState<string>('all');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [activeTransaction, setActiveTransaction] = useState<OpgTransaction | null>(null);
  const [detailSheetOpen, setDetailSheetOpen] = useState(false);
  const [bookingTxId, setBookingTxId] = useState<string | null>(null);

  // Nézet mód: csoportosított (Napi zárások szerint) vagy lapos lista
  const [viewMode, setViewMode] = useState<'grouped' | 'flat'>('grouped');

  // Lenyitott napi zárás azonosítók halmaza
  const [expandedGroupIds, setExpandedGroupIds] = useState<Set<string>>(new Set());

  // Kliensoldali lapos szűrés (a lapos nézethez és a függő számláláshoz)
  const filteredFlatTransactions = useMemo(() => {
    return transactions.filter((tx) => {
      if (selectedRegisterId !== 'all' && tx.opg_id !== selectedRegisterId) {
        return false;
      }
      if (selectedType !== 'all' && tx.transaction_type !== selectedType) {
        return false;
      }
      if (selectedStatus !== 'all' && tx.processing_status !== selectedStatus) {
        return false;
      }
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        const num = (tx.receipt_number || '').toLowerCase();
        const ext = (tx.external_transaction_id || '').toLowerCase();
        const ap = (tx.cash_register?.ap_code || '').toLowerCase();
        if (!num.includes(q) && !ext.includes(q) && !ap.includes(q)) {
          return false;
        }
      }
      return true;
    });
  }, [transactions, selectedRegisterId, selectedType, selectedStatus, search]);

  // Tranzakciók csoportosítása napi zárások (Z-riportok) szerint
  const zGroups = useMemo(() => {
    const zReports = transactions.filter((tx) => tx.transaction_type === 'z_report');
    const otherTxs = transactions.filter((tx) => tx.transaction_type !== 'z_report');

    const groupMap = new Map<string, OpgZReportGroup>();

    // 1. Z-zárásokból csoportok létrehozása
    for (const z of zReports) {
      const groupId = `z_${z.id}`;
      groupMap.set(groupId, {
        id: groupId,
        zReport: z,
        date: z.transaction_date,
        time: z.transaction_time,
        displayNumber: z.receipt_number,
        cashRegister: z.cash_register,
        opgId: z.opg_id,
        items: [],
        filteredItems: [],
        totalGross: z.total_gross_amount,
        cashAmount: z.cash_amount,
        cardAmount: z.card_amount,
        hasPendingCash: z.cash_amount > 0 && z.processing_status === 'new',
        isOpenShift: false,
      });
    }

    // 2. Nyugták és egyéb bizonylatok hozzárendelése a megfelelő Z-záráshoz
    for (const tx of otherTxs) {
      let matchedGroup: OpgZReportGroup | undefined;

      // Preferált: Előtag alapján (pl. "1905/00001" -> "1905")
      for (const group of groupMap.values()) {
        if (!group.isOpenShift && group.zReport) {
          const isSameRegister = !group.opgId || !tx.opg_id || group.opgId === tx.opg_id;
          const zNo = group.displayNumber.trim();
          if (isSameRegister && zNo && tx.receipt_number.startsWith(`${zNo}/`)) {
            matchedGroup = group;
            break;
          }
        }
      }

      // Másodlagos: Dátum és pénztárgép egyezés alapján
      if (!matchedGroup) {
        for (const group of groupMap.values()) {
          if (!group.isOpenShift && group.zReport) {
            const isSameRegister = !group.opgId || !tx.opg_id || group.opgId === tx.opg_id;
            if (isSameRegister && group.date === tx.transaction_date) {
              matchedGroup = group;
              break;
            }
          }
        }
      }

      // Harmadlagos: Ha nincs Z-zárás ehhez a naphoz -> Nyitott forgalom csoport
      if (!matchedGroup) {
        const openId = `open_${tx.opg_id || 'reg'}_${tx.transaction_date}`;
        if (!groupMap.has(openId)) {
          groupMap.set(openId, {
            id: openId,
            zReport: null,
            date: tx.transaction_date,
            time: tx.transaction_time,
            displayNumber: 'Nyitott forgalom',
            cashRegister: tx.cash_register,
            opgId: tx.opg_id,
            items: [],
            filteredItems: [],
            totalGross: 0,
            cashAmount: 0,
            cardAmount: 0,
            hasPendingCash: false,
            isOpenShift: true,
          });
        }
        matchedGroup = groupMap.get(openId)!;
      }

      matchedGroup.items.push(tx);
    }

    // 3. Csoportok összegzése és sorrendezése
    const results: OpgZReportGroup[] = [];
    for (const group of groupMap.values()) {
      group.items.sort((a, b) => {
        const cmpDate = (b.transaction_date || '').localeCompare(a.transaction_date || '');
        if (cmpDate !== 0) return cmpDate;
        const cmpTime = (b.transaction_time || '').localeCompare(a.transaction_time || '');
        if (cmpTime !== 0) return cmpTime;
        return (b.receipt_number || '').localeCompare(a.receipt_number || '');
      });

      if (group.isOpenShift) {
        let gross = 0;
        let cash = 0;
        let card = 0;
        let hasPending = false;
        for (const it of group.items) {
          const mult = it.transaction_type === 'storno' || it.transaction_type === 'refund' ? -1 : 1;
          gross += it.total_gross_amount * mult;
          cash += it.cash_amount * mult;
          card += it.card_amount * mult;
          if (it.cash_amount > 0 && it.processing_status === 'new') hasPending = true;
        }
        group.totalGross = gross;
        group.cashAmount = cash;
        group.cardAmount = card;
        group.hasPendingCash = hasPending;
      } else {
        const itemsCash = group.items.reduce(
          (s, it) => s + (it.transaction_type === 'storno' || it.transaction_type === 'refund' ? -it.cash_amount : it.cash_amount),
          0
        );
        const itemsCard = group.items.reduce(
          (s, it) => s + (it.transaction_type === 'storno' || it.transaction_type === 'refund' ? -it.card_amount : it.card_amount),
          0
        );
        if (group.cashAmount === 0 && itemsCash > 0) {
          group.cashAmount = itemsCash;
        }
        if (group.cardAmount === 0 && itemsCard > 0) {
          group.cardAmount = itemsCard;
        }
        if (group.items.some((it) => it.cash_amount > 0 && it.processing_status === 'new')) {
          group.hasPendingCash = true;
        }
      }

      results.push(group);
    }

    results.sort((a, b) => {
      const cmpDate = (b.date || '').localeCompare(a.date || '');
      if (cmpDate !== 0) return cmpDate;
      const cmpTime = (b.time || '').localeCompare(a.time || '');
      if (cmpTime !== 0) return cmpTime;
      return (b.displayNumber || '').localeCompare(a.displayNumber || '');
    });

    return results;
  }, [transactions]);

  // Csoportok szűrése a beállított keresési és szűrési feltételek alapján
  const filteredGroups = useMemo(() => {
    return zGroups
      .map((group) => {
        if (selectedRegisterId !== 'all' && group.opgId !== selectedRegisterId) {
          return null;
        }

        const matchingItems = group.items.filter((item) => {
          if (selectedType !== 'all' && item.transaction_type !== selectedType) {
            return false;
          }
          if (selectedStatus !== 'all' && item.processing_status !== selectedStatus) {
            return false;
          }
          if (search.trim()) {
            const q = search.trim().toLowerCase();
            const num = (item.receipt_number || '').toLowerCase();
            const ext = (item.external_transaction_id || '').toLowerCase();
            const ap = (item.cash_register?.ap_code || '').toLowerCase();
            if (!num.includes(q) && !ext.includes(q) && !ap.includes(q)) {
              return false;
            }
          }
          return true;
        });

        const zMatchesType = selectedType === 'all' || selectedType === 'z_report';
        const zMatchesStatus =
          selectedStatus === 'all' ||
          (group.zReport && group.zReport.processing_status === selectedStatus);
        const zMatchesSearch =
          !search.trim() ||
          (group.displayNumber || '').toLowerCase().includes(search.trim().toLowerCase()) ||
          (group.cashRegister?.ap_code || '').toLowerCase().includes(search.trim().toLowerCase()) ||
          (group.cashRegister?.name || '').toLowerCase().includes(search.trim().toLowerCase());

        const zMatchesDirectly = !group.isOpenShift && zMatchesType && zMatchesStatus && zMatchesSearch;

        // Ha sem a zárás, sem az alá tartozó tételek nem felelnek meg a szűrőnek, eldobjuk
        if (!zMatchesDirectly && matchingItems.length === 0) {
          return null;
        }

        return {
          ...group,
          filteredItems: matchingItems,
        };
      })
      .filter((g): g is NonNullable<typeof g> => g !== null);
  }, [zGroups, selectedRegisterId, selectedType, selectedStatus, search]);

  const isSearching = search.trim().length > 0;

  // Lenyitási állapot ellenőrzése (kereséskor a találatot tartalmazó csoport automatikusan nyitva van)
  const isGroupExpanded = (group: OpgZReportGroup) => {
    if (isSearching && group.filteredItems.length > 0) return true;
    return expandedGroupIds.has(group.id);
  };

  const toggleGroup = (groupId: string) => {
    setExpandedGroupIds((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }
      return next;
    });
  };

  const allGroupIds = useMemo(() => filteredGroups.map((g) => g.id), [filteredGroups]);
  const isAllExpanded = allGroupIds.length > 0 && allGroupIds.every((id) => expandedGroupIds.has(id));

  const toggleExpandAll = () => {
    if (isAllExpanded) {
      setExpandedGroupIds(new Set());
    } else {
      setExpandedGroupIds(new Set(allGroupIds));
    }
  };

  const pendingCount = useMemo(() => {
    return filteredFlatTransactions.filter(
      (tx) => tx.processing_status === 'new' && tx.cash_amount > 0
    ).length;
  }, [filteredFlatTransactions]);

  const handleOpenDetail = (tx: OpgTransaction) => {
    setActiveTransaction(tx);
    setDetailSheetOpen(true);
  };

  const handleSingleBook = async (txId: string) => {
    setBookingTxId(txId);
    try {
      await onBookTransaction(txId);
      if (activeTransaction && activeTransaction.id === txId) {
        setActiveTransaction((prev) =>
          prev ? { ...prev, processing_status: 'processed' } : null
        );
      }
    } finally {
      setBookingTxId(null);
    }
  };

  const handleBookGroupCash = async (group: OpgZReportGroup) => {
    if (group.zReport && group.zReport.cash_amount > 0 && group.zReport.processing_status === 'new') {
      await handleSingleBook(group.zReport.id);
      return;
    }
    const pendingItems = group.items.filter((it) => it.cash_amount > 0 && it.processing_status === 'new');
    for (const item of pendingItems) {
      await handleSingleBook(item.id);
    }
  };

  const fmtCurrency = (val: number) => {
    return new Intl.NumberFormat('hu-HU', {
      style: 'currency',
      currency: 'HUF',
      maximumFractionDigits: 0,
    }).format(val || 0);
  };

  const getTypeBadge = (type: OpgTransactionType) => {
    switch (type) {
      case 'receipt':
        return <Badge variant="outline" className="font-normal text-xs">Nyugta</Badge>;
      case 'z_report':
        return <Badge className="bg-primary/10 text-primary border-primary/20 text-xs">Napi Z-zárás</Badge>;
      case 'storno':
        return <Badge variant="destructive" className="text-xs">Sztornó</Badge>;
      case 'refund':
        return <Badge variant="destructive" className="text-xs">Visszáru</Badge>;
      case 'simplified_invoice':
        return <Badge variant="secondary" className="text-xs">Egysz. számla</Badge>;
      default:
        return <Badge variant="outline">{type}</Badge>;
    }
  };

  const getStatusBadge = (status: OpgProcessingStatus, cashAmount: number) => {
    switch (status) {
      case 'processed':
        return (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600">
            <CheckCircle2 className="h-3.5 w-3.5" /> Könyvelve
          </span>
        );
      case 'new':
        if (cashAmount === 0) {
          return <span className="text-xs text-muted-foreground">Készpénz nélküli</span>;
        }
        return (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-600">
            <Clock className="h-3.5 w-3.5" /> Függőben
          </span>
        );
      case 'skipped':
        return <span className="text-xs text-muted-foreground">Átugorva</span>;
      case 'error':
        return (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-destructive">
            <AlertCircle className="h-3.5 w-3.5" /> Hiba
          </span>
        );
      default:
        return <span className="text-xs">{status}</span>;
    }
  };

  const resetFilters = () => {
    setSearch('');
    setSelectedRegisterId('all');
    setSelectedType('all');
    setSelectedStatus('all');
  };

  return (
    <div className="space-y-4">
      {/* Szűrősáv és Vezérlők */}
      <div className="flex flex-col lg:flex-row gap-3 items-stretch lg:items-center justify-between p-4 bg-card border rounded-xl shadow-sm">
        <div className="flex flex-wrap items-center gap-2.5 flex-1">
          {/* Keresőmező */}
          <div className="relative min-w-[200px] flex-1 max-w-xs">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Keresés nyugtaszámra, AP-ra..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9 text-xs"
            />
          </div>

          {/* Pénztárgép választó */}
          <Select value={selectedRegisterId} onValueChange={setSelectedRegisterId}>
            <SelectTrigger className="w-[180px] h-9 text-xs">
              <SelectValue placeholder="Pénztárgép" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Minden pénztárgép</SelectItem>
              {registers.map((r) => (
                <SelectItem key={r.id} value={r.id}>
                  {r.name} ({r.ap_code})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Bizonylat típus szűrő */}
          <Select value={selectedType} onValueChange={setSelectedType}>
            <SelectTrigger className="w-[150px] h-9 text-xs">
              <SelectValue placeholder="Típus" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Minden típus</SelectItem>
              <SelectItem value="receipt">Nyugta</SelectItem>
              <SelectItem value="z_report">Napi Z-zárás</SelectItem>
              <SelectItem value="storno">Sztornó</SelectItem>
              <SelectItem value="refund">Visszáru</SelectItem>
              <SelectItem value="simplified_invoice">Egyszerűsített számla</SelectItem>
            </SelectContent>
          </Select>

          {/* Könyvelési állapot */}
          <Select value={selectedStatus} onValueChange={setSelectedStatus}>
            <SelectTrigger className="w-[150px] h-9 text-xs">
              <SelectValue placeholder="Könyvelési státusz" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Minden státusz</SelectItem>
              <SelectItem value="new">Függőben</SelectItem>
              <SelectItem value="processed">Könyvelve</SelectItem>
              <SelectItem value="skipped">Átugorva</SelectItem>
              <SelectItem value="error">Hiba</SelectItem>
            </SelectContent>
          </Select>

          {(search || selectedRegisterId !== 'all' || selectedType !== 'all' || selectedStatus !== 'all') && (
            <Button
              variant="ghost"
              size="sm"
              onClick={resetFilters}
              className="h-9 px-2.5 text-xs text-muted-foreground gap-1"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Alaphelyzet
            </Button>
          )}
        </div>

        {/* Jobb oldali műveleti sáv */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Nézetváltó gombok */}
          <div className="flex items-center border rounded-lg p-0.5 bg-muted/40">
            <Button
              variant={viewMode === 'grouped' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('grouped')}
              className="h-8 px-2.5 text-xs gap-1.5"
              title="Napi zárások szerinti csoportosítás"
            >
              <Layers className="h-3.5 w-3.5 text-primary" />
              <span className="hidden sm:inline">Napi zárások</span>
            </Button>
            <Button
              variant={viewMode === 'flat' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('flat')}
              className="h-8 px-2.5 text-xs gap-1.5"
              title="Lapos tételes lista"
            >
              <List className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Lapos lista</span>
            </Button>
          </div>

          {/* Összes lenyitása / becsukása gomb (csak csoportosított nézetben) */}
          {viewMode === 'grouped' && filteredGroups.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={toggleExpandAll}
              className="h-9 px-2.5 text-xs gap-1 text-muted-foreground"
              title={isAllExpanded ? 'Minden zárás összecsukása' : 'Minden zárás lenyitása'}
            >
              <ChevronsUpDown className="h-3.5 w-3.5" />
              <span className="hidden md:inline">
                {isAllExpanded ? 'Összes becsukása' : 'Összes lenyitása'}
              </span>
            </Button>
          )}

          {/* Kötegelt műveleti gomb */}
          {pendingCount > 0 && (
            <Button
              size="sm"
              onClick={onBookAllPending}
              disabled={isBookingAllPending}
              className="gap-2 bg-amber-600 hover:bg-amber-700 text-white shrink-0 h-9 text-xs"
            >
              {isBookingAllPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Banknote className="h-3.5 w-3.5" />
              )}
              {pendingCount} db függő tétel könyvelése
            </Button>
          )}
        </div>
      </div>

      {/* Tranzakció táblázat */}
      {isLoading ? (
        <div className="flex items-center justify-center p-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (viewMode === 'grouped' ? filteredGroups.length === 0 : filteredFlatTransactions.length === 0) ? (
        <div className="p-12 text-center border rounded-xl bg-card">
          <Receipt className="h-10 w-10 text-muted-foreground/60 mx-auto mb-3" />
          <h4 className="text-sm font-semibold">Nem található a feltételeknek megfelelő bizonylat</h4>
          <p className="text-xs text-muted-foreground mt-1">
            Módosítsa a szűrőfeltételeket, vagy indítson egy NAV OPG szinkronizációt.
          </p>
        </div>
      ) : viewMode === 'grouped' ? (
        /* ================= 1. NAPI ZÁRÁSOK SZERINT CSOPORTOSÍTOTT NÉZET ================= */
        <div className="border rounded-xl overflow-hidden bg-card shadow-sm">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40">
                <TableHead className="w-[180px]">Időpont / Dátum</TableHead>
                <TableHead>Z-zárás / Bizonylatszám</TableHead>
                <TableHead>Pénztárgép</TableHead>
                <TableHead>Típus</TableHead>
                <TableHead className="text-right">Napi forgalom</TableHead>
                <TableHead className="text-right">Készpénz</TableHead>
                <TableHead className="text-right">Bankkártya</TableHead>
                <TableHead>Házipénztár</TableHead>
                <TableHead className="text-right w-[110px]">Művelet</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredGroups.map((group) => {
                const isExpanded = isGroupExpanded(group);
                const hasChildren = group.items.length > 0;
                const isBookingGroup = group.zReport && bookingTxId === group.zReport.id;

                return (
                  <React.Fragment key={group.id}>
                    {/* Fő Napi Z-zárás Sor */}
                    <TableRow
                      onClick={() => toggleGroup(group.id)}
                      className={`hover:bg-muted/40 cursor-pointer transition-colors border-b select-none ${
                        isExpanded ? 'bg-muted/20 font-medium' : ''
                      }`}
                    >
                      {/* Időpont és lenyitó ikon */}
                      <TableCell className="text-xs">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            className="p-0.5 rounded hover:bg-muted text-muted-foreground transition-transform"
                            aria-label={isExpanded ? 'Összecsukás' : 'Lenyitás'}
                          >
                            {isExpanded ? (
                              <ChevronDown className="h-4 w-4 text-primary" />
                            ) : (
                              <ChevronRight className="h-4 w-4" />
                            )}
                          </button>
                          <span className="font-mono text-muted-foreground whitespace-nowrap">
                            {group.date}{' '}
                            <span className="text-foreground/80 font-medium">{group.time}</span>
                          </span>
                        </div>
                      </TableCell>

                      {/* Bizonylatszám + Tételszám Badge */}
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-semibold text-xs text-primary">
                            {group.displayNumber}
                          </span>
                          <Badge
                            variant="secondary"
                            className="text-[10px] px-1.5 py-0 h-4 font-normal gap-1 shrink-0"
                          >
                            <Receipt className="h-2.5 w-2.5 text-muted-foreground" />
                            {group.items.length} tétel
                          </Badge>
                        </div>
                      </TableCell>

                      {/* Pénztárgép */}
                      <TableCell className="text-xs">
                        <div className="font-medium truncate max-w-[130px]">
                          {group.cashRegister?.name || 'N/A'}
                        </div>
                        <div className="text-[10px] text-muted-foreground font-mono">
                          {group.cashRegister?.ap_code}
                        </div>
                      </TableCell>

                      {/* Típus */}
                      <TableCell>
                        {group.zReport ? (
                          getTypeBadge(group.zReport.transaction_type)
                        ) : (
                          <Badge
                            variant="outline"
                            className="text-amber-600 border-amber-300 bg-amber-50/50 dark:bg-amber-950/20 text-xs font-normal"
                          >
                            Nyitott műszak
                          </Badge>
                        )}
                      </TableCell>

                      {/* Bruttó összeg */}
                      <TableCell className="text-right font-mono font-bold text-xs whitespace-nowrap text-foreground">
                        {fmtCurrency(group.totalGross)}
                      </TableCell>

                      {/* Készpénz */}
                      <TableCell className="text-right font-mono font-semibold text-xs text-emerald-600 whitespace-nowrap">
                        {group.cashAmount > 0 ? (
                          fmtCurrency(group.cashAmount)
                        ) : (
                          <span className="text-muted-foreground/50">-</span>
                        )}
                      </TableCell>

                      {/* Bankkártya */}
                      <TableCell className="text-right font-mono font-semibold text-xs text-blue-600 whitespace-nowrap">
                        {group.cardAmount > 0 ? (
                          fmtCurrency(group.cardAmount)
                        ) : (
                          <span className="text-muted-foreground/50">-</span>
                        )}
                      </TableCell>

                      {/* Házipénztár állapot */}
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        {group.hasPendingCash ? (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-600">
                            <Clock className="h-3.5 w-3.5" /> Függőben
                          </span>
                        ) : group.cashAmount > 0 ? (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600">
                            <CheckCircle2 className="h-3.5 w-3.5" /> Könyvelve
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">Készpénz nélküli</span>
                        )}
                      </TableCell>

                      {/* Műveletek */}
                      <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1">
                          {group.hasPendingCash && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleBookGroupCash(group)}
                              disabled={isBookingGroup || isBookingTransaction}
                              className="h-7 px-2 text-xs gap-1 text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                              title="Zárás készpénzének könyvelése házipénztárba"
                            >
                              {isBookingGroup ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <Banknote className="h-3 w-3" />
                              )}
                              Könyvel
                            </Button>
                          )}

                          {group.zReport && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleOpenDetail(group.zReport!)}
                              className="h-7 w-7 text-muted-foreground hover:text-foreground"
                              title="Napi Z-zárás részletei"
                            >
                              <Eye className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>

                    {/* Lenyitható Belső Tételek Lista (Accordion Body) */}
                    {isExpanded && (
                      <TableRow className="bg-muted/15 hover:bg-muted/15 border-b">
                        <TableCell colSpan={9} className="p-0">
                          <div className="pl-7 pr-4 py-3 bg-muted/20 border-l-4 border-l-primary/70">
                            {!hasChildren || group.filteredItems.length === 0 ? (
                              <div className="py-4 text-center text-xs text-muted-foreground italic">
                                {hasChildren
                                  ? 'A megadott szűrőknek nem felel meg egyetlen nyugtatétel sem ebből a zárásból.'
                                  : 'Ehhez a napi záráshoz nem tartoznak külön rögzített részletes nyugtatételek.'}
                              </div>
                            ) : (
                              <div className="space-y-2">
                                <div className="flex items-center justify-between text-xs text-muted-foreground font-medium px-1">
                                  <span className="flex items-center gap-1.5 text-foreground/90 font-semibold">
                                    <Receipt className="h-3.5 w-3.5 text-primary" />
                                    A záráshoz tartozó bizonylatok és nyugták ({group.filteredItems.length} db)
                                  </span>
                                  <span className="text-[11px] text-muted-foreground">
                                    Kattintson egy sorra a tétel részleteinek megtekintéséhez
                                  </span>
                                </div>

                                <div className="rounded-lg border bg-background overflow-hidden shadow-xs">
                                  <Table className="text-xs">
                                    <TableHeader>
                                      <TableRow className="bg-muted/50 hover:bg-muted/50 text-[11px]">
                                        <TableHead className="py-2 h-8 w-[140px]">Időpont</TableHead>
                                        <TableHead className="py-2 h-8">Nyugtaszám</TableHead>
                                        <TableHead className="py-2 h-8">Típus</TableHead>
                                        <TableHead className="py-2 h-8 text-right">Bruttó összeg</TableHead>
                                        <TableHead className="py-2 h-8 text-right">Készpénz</TableHead>
                                        <TableHead className="py-2 h-8 text-right">Bankkártya</TableHead>
                                        <TableHead className="py-2 h-8">Házipénztár</TableHead>
                                        <TableHead className="py-2 h-8 text-right w-[100px]">Művelet</TableHead>
                                      </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                      {group.filteredItems.map((item) => {
                                        const isItemStorno =
                                          item.transaction_type === 'storno' || item.transaction_type === 'refund';
                                        const isBookingThis = bookingTxId === item.id;

                                        return (
                                          <TableRow
                                            key={item.id}
                                            className="hover:bg-muted/30 cursor-pointer transition-colors border-b last:border-b-0"
                                            onClick={() => handleOpenDetail(item)}
                                          >
                                            <TableCell className="py-2 font-mono text-muted-foreground whitespace-nowrap">
                                              {item.transaction_date}{' '}
                                              <span className="text-foreground/80 font-medium">
                                                {item.transaction_time}
                                              </span>
                                            </TableCell>
                                            <TableCell className="py-2 font-mono font-medium text-primary">
                                              {item.receipt_number}
                                            </TableCell>
                                            <TableCell className="py-2">
                                              {getTypeBadge(item.transaction_type)}
                                            </TableCell>
                                            <TableCell
                                              className={`py-2 text-right font-mono font-medium ${
                                                isItemStorno ? 'text-destructive' : 'text-foreground'
                                              }`}
                                            >
                                              {isItemStorno ? '-' : ''}
                                              {fmtCurrency(item.total_gross_amount)}
                                            </TableCell>
                                            <TableCell className="py-2 text-right font-mono text-emerald-600">
                                              {item.cash_amount > 0 ? (
                                                <span>
                                                  {isItemStorno ? '-' : ''}
                                                  {fmtCurrency(item.cash_amount)}
                                                </span>
                                              ) : (
                                                <span className="text-muted-foreground/50">-</span>
                                              )}
                                            </TableCell>
                                            <TableCell className="py-2 text-right font-mono text-blue-600">
                                              {item.card_amount > 0 ? (
                                                <span>
                                                  {isItemStorno ? '-' : ''}
                                                  {fmtCurrency(item.card_amount)}
                                                </span>
                                              ) : (
                                                <span className="text-muted-foreground/50">-</span>
                                              )}
                                            </TableCell>
                                            <TableCell className="py-2" onClick={(e) => e.stopPropagation()}>
                                              {getStatusBadge(item.processing_status, item.cash_amount)}
                                            </TableCell>
                                            <TableCell
                                              className="py-2 text-right"
                                              onClick={(e) => e.stopPropagation()}
                                            >
                                              <div className="flex items-center justify-end gap-1">
                                                {item.cash_amount > 0 && item.processing_status !== 'processed' && (
                                                  <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => handleSingleBook(item.id)}
                                                    disabled={isBookingThis || isBookingTransaction}
                                                    className="h-6 px-1.5 text-[11px] gap-1 text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                                                    title="Könyvelés házipénztárba"
                                                  >
                                                    {isBookingThis ? (
                                                      <Loader2 className="h-3 w-3 animate-spin" />
                                                    ) : (
                                                      <Banknote className="h-3 w-3" />
                                                    )}
                                                    Könyvel
                                                  </Button>
                                                )}
                                                <Button
                                                  variant="ghost"
                                                  size="icon"
                                                  onClick={() => handleOpenDetail(item)}
                                                  className="h-6 w-6 text-muted-foreground hover:text-foreground"
                                                  title="Részletek megtekintése"
                                                >
                                                  <Eye className="h-3 w-3" />
                                                </Button>
                                              </div>
                                            </TableCell>
                                          </TableRow>
                                        );
                                      })}
                                    </TableBody>
                                  </Table>
                                </div>
                              </div>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </React.Fragment>
                );
              })}
            </TableBody>
          </Table>
        </div>
      ) : (
        /* ================= 2. LAPOS / HAGYOMÁNYOS TÉTELES LISTA NÉZET ================= */
        <div className="border rounded-xl overflow-hidden bg-card shadow-sm">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40">
                <TableHead className="w-[150px]">Időpont</TableHead>
                <TableHead>Bizonylatszám</TableHead>
                <TableHead>Pénztárgép</TableHead>
                <TableHead>Típus</TableHead>
                <TableHead className="text-right">Bruttó összeg</TableHead>
                <TableHead className="text-right">Készpénz</TableHead>
                <TableHead className="text-right">Bankkártya</TableHead>
                <TableHead>Házipénztár</TableHead>
                <TableHead className="text-right">Művelet</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredFlatTransactions.map((tx) => {
                const isStorno = tx.transaction_type === 'storno' || tx.transaction_type === 'refund';
                const isBookingThis = bookingTxId === tx.id;

                return (
                  <TableRow
                    key={tx.id}
                    className="hover:bg-muted/30 cursor-pointer transition-colors"
                    onClick={() => handleOpenDetail(tx)}
                  >
                    <TableCell className="text-xs font-mono text-muted-foreground whitespace-nowrap">
                      {tx.transaction_date}{' '}
                      <span className="text-foreground/80 font-medium">{tx.transaction_time}</span>
                    </TableCell>

                    <TableCell className="font-mono font-medium text-xs text-primary">
                      {tx.receipt_number}
                    </TableCell>

                    <TableCell className="text-xs">
                      <div className="font-medium truncate max-w-[130px]">
                        {tx.cash_register?.name || 'N/A'}
                      </div>
                      <div className="text-[10px] text-muted-foreground font-mono">
                        {tx.cash_register?.ap_code}
                      </div>
                    </TableCell>

                    <TableCell>{getTypeBadge(tx.transaction_type)}</TableCell>

                    <TableCell
                      className={`text-right font-mono font-semibold text-xs whitespace-nowrap ${
                        isStorno ? 'text-destructive' : 'text-foreground'
                      }`}
                    >
                      {isStorno ? '-' : ''}
                      {fmtCurrency(tx.total_gross_amount)}
                    </TableCell>

                    <TableCell className="text-right font-mono text-xs text-emerald-600 whitespace-nowrap">
                      {tx.cash_amount > 0 ? (
                        <span>
                          {isStorno ? '-' : ''}
                          {fmtCurrency(tx.cash_amount)}
                        </span>
                      ) : (
                        <span className="text-muted-foreground/60">-</span>
                      )}
                    </TableCell>

                    <TableCell className="text-right font-mono text-xs text-blue-600 whitespace-nowrap">
                      {tx.card_amount > 0 ? (
                        <span>
                          {isStorno ? '-' : ''}
                          {fmtCurrency(tx.card_amount)}
                        </span>
                      ) : (
                        <span className="text-muted-foreground/60">-</span>
                      )}
                    </TableCell>

                    <TableCell onClick={(e) => e.stopPropagation()}>
                      {getStatusBadge(tx.processing_status, tx.cash_amount)}
                    </TableCell>

                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">
                        {tx.cash_amount > 0 && tx.processing_status !== 'processed' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleSingleBook(tx.id)}
                            disabled={isBookingThis || isBookingTransaction}
                            className="h-7 px-2 text-xs gap-1 text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                            title="Könyvelés házipénztárba"
                          >
                            {isBookingThis ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <Banknote className="h-3 w-3" />
                            )}
                            Könyvel
                          </Button>
                        )}

                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleOpenDetail(tx)}
                          className="h-7 w-7 text-muted-foreground hover:text-foreground"
                          title="Részletek megtekintése"
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Részletek Modal / Sheet */}
      <OpgTransactionDetailSheet
        open={detailSheetOpen}
        onOpenChange={setDetailSheetOpen}
        transaction={activeTransaction}
        onBookToPettyCash={handleSingleBook}
        isBooking={bookingTxId === activeTransaction?.id}
      />
    </div>
  );
};
