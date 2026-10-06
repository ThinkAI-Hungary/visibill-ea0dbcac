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
  Filter,
  CheckCircle2,
  Clock,
  AlertCircle,
  Banknote,
  CreditCard,
  Eye,
  Building2,
  RotateCcw,
  Loader2,
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

  // Kliensoldali szűrés
  const filteredTransactions = useMemo(() => {
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

  const pendingCount = useMemo(() => {
    return filteredTransactions.filter(
      (tx) => tx.processing_status === 'new' && tx.cash_amount > 0
    ).length;
  }, [filteredTransactions]);

  const handleOpenDetail = (tx: OpgTransaction) => {
    setActiveTransaction(tx);
    setDetailSheetOpen(true);
  };

  const handleSingleBook = async (txId: string) => {
    setBookingTxId(txId);
    try {
      await onBookTransaction(txId);
      // Ha a detail sheet nyitva van, frissítsük a belső állapotot
      if (activeTransaction && activeTransaction.id === txId) {
        setActiveTransaction((prev) =>
          prev ? { ...prev, processing_status: 'processed' } : null
        );
      }
    } finally {
      setBookingTxId(null);
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
      {/* Szűrősáv */}
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

      {/* Tranzakció táblázat */}
      {isLoading ? (
        <div className="flex items-center justify-center p-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : filteredTransactions.length === 0 ? (
        <div className="p-12 text-center border rounded-xl bg-card">
          <Receipt className="h-10 w-10 text-muted-foreground/60 mx-auto mb-3" />
          <h4 className="text-sm font-semibold">Nem található a feltételeknek megfelelő bizonylat</h4>
          <p className="text-xs text-muted-foreground mt-1">
            Módosítsa a szűrőfeltételeket, vagy indítson egy NAV OPG szinkronizációt.
          </p>
        </div>
      ) : (
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
              {filteredTransactions.map((tx) => {
                const isStorno = tx.transaction_type === 'storno' || tx.transaction_type === 'refund';
                const isBookingThis = bookingTxId === tx.id;

                return (
                  <TableRow
                    key={tx.id}
                    className="hover:bg-muted/30 cursor-pointer transition-colors"
                    onClick={() => handleOpenDetail(tx)}
                  >
                    {/* Időpont */}
                    <TableCell className="text-xs font-mono text-muted-foreground whitespace-nowrap">
                      {tx.transaction_date}{' '}
                      <span className="text-foreground/80 font-medium">{tx.transaction_time}</span>
                    </TableCell>

                    {/* Bizonylatszám */}
                    <TableCell className="font-mono font-medium text-xs text-primary">
                      {tx.receipt_number}
                    </TableCell>

                    {/* Pénztárgép */}
                    <TableCell className="text-xs">
                      <div className="font-medium truncate max-w-[130px]">
                        {tx.cash_register?.name || 'N/A'}
                      </div>
                      <div className="text-[10px] text-muted-foreground font-mono">
                        {tx.cash_register?.ap_code}
                      </div>
                    </TableCell>

                    {/* Típus */}
                    <TableCell>{getTypeBadge(tx.transaction_type)}</TableCell>

                    {/* Bruttó összeg */}
                    <TableCell
                      className={`text-right font-mono font-semibold text-xs whitespace-nowrap ${
                        isStorno ? 'text-destructive' : 'text-foreground'
                      }`}
                    >
                      {isStorno ? '-' : ''}
                      {fmtCurrency(tx.total_gross_amount)}
                    </TableCell>

                    {/* Készpénz */}
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

                    {/* Bankkártya */}
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

                    {/* Házipénztár állapot */}
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      {getStatusBadge(tx.processing_status, tx.cash_amount)}
                    </TableCell>

                    {/* Műveletek */}
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
