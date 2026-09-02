import React from 'react';
import { Table, TableBody, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger } from '@/components/ui/context-menu';
import { UnifiedPagination } from '@/components/ui/unified-pagination';
import { TableSkeleton } from '@/components/ui/table-skeleton';
import { TableEmptyState } from '@/components/ui/table-empty-state';
import { TablePlaceholderRows } from '@/components/ui/table-placeholder-rows';
import { ArrowUpDown, ChevronsUpDown, ChevronsDownUp } from 'lucide-react';
import { SubmittedInvoiceRow } from './SubmittedInvoiceRow';
import { useInvoiceContext } from '../../context/useInvoiceContext';
import type { NavInvoice, TransactionRecord } from '../../types';

interface SubmittedInvoiceTableProps {
  submittedToNavMap: Map<string, NavInvoice[]>;
  pageInvoiceIdToTransactionsMap: Map<string, TransactionRecord[]>;
  onRowClick: (invoiceId: string, e: React.MouseEvent) => void;
  onToggleExclude: (invoiceId: string, currentValue: boolean) => Promise<void>;
}

export function SubmittedInvoiceTable({
  submittedToNavMap,
  pageInvoiceIdToTransactionsMap,
  onRowClick,
  onToggleExclude,
}: SubmittedInvoiceTableProps) {
  const {
    activeTab,
    loading,
    tabFetching,
    paginatedSubmittedInvoices,
    submittedCurrentPage,
    setSubmittedCurrentPage,
    submittedPageSize,
    setSubmittedPageSize,
    submittedTotalPages,
    submittedTotalCount,
    handleSort,
    kpiFilter,
    isAllSelected,
    toggleSelectAll,
    expandAllRows,
    collapseAllRows,
  } = useInvoiceContext();

  return (
    <>
      <UnifiedPagination
        currentPage={submittedCurrentPage}
        totalPages={submittedTotalPages}
        totalItems={submittedTotalCount}
        pageSize={submittedPageSize}
        onPageChange={setSubmittedCurrentPage}
        onPageSizeChange={(size) => {
          setSubmittedPageSize(size);
          setSubmittedCurrentPage(1);
        }}
        className="mb-3"
      />

      <div className="flex items-center gap-4 mb-2 text-[11px] text-muted-foreground flex-wrap">
        <span className="font-medium">Jelmagyarázat:</span>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm bg-[var(--row-matched-bg)] border-l-2 border-l-[var(--row-matched-border)]" />
          <span>Párosított / Kifizetve</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm bg-blue-500/15 border-l-2 border-l-blue-500" />
          <span>Részben fizetve</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm bg-[var(--row-suggested-bg)] border-l-2 border-l-[var(--row-suggested-border)]" />
          <span>AI javaslat (jóváhagyásra vár)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm bg-destructive/10 border-l-2 border-l-destructive" />
          <span>Nem kifizetve</span>
        </div>
      </div>

      {/* Submitted Invoice Table */}
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div className="rounded-lg border border-border/50 overflow-x-auto">
            <Table className="compact-table w-full tight-table">
              <TableHeader>
                <TableRow className="bg-muted/30 hover:bg-muted/30">
                  <TableHead className="w-[40px] pl-2">
                    <div className="flex items-center gap-2">
                      <div className="w-3.5" />
                      <Checkbox
                        checked={isAllSelected}
                        onCheckedChange={() => toggleSelectAll()}
                        aria-label="Összes kijelölése"
                      />
                    </div>
                  </TableHead>

                  <TableHead
                    className="cursor-pointer hover:bg-muted/50 font-semibold"
                    onClick={() => handleSort(activeTab === 'SUBMITTED_INBOUND' ? 'elado_nev' : 'vevo_nev')}
                  >
                    <div className="flex items-center gap-1">
                      Partner
                      <ArrowUpDown className="h-3 w-3 text-muted-foreground" />
                    </div>
                  </TableHead>

                  <TableHead
                    className="cursor-pointer hover:bg-muted/50 font-semibold text-center whitespace-nowrap"
                    onClick={() => handleSort('kibocsatas_datuma')}
                  >
                    <div className="flex items-center justify-center gap-1">
                      Kiáll.
                      <ArrowUpDown className="h-3 w-3 text-muted-foreground" />
                    </div>
                  </TableHead>

                  <TableHead
                    className="cursor-pointer hover:bg-muted/50 font-semibold text-center whitespace-nowrap"
                    onClick={() => handleSort('teljesites_datuma')}
                  >
                    <div className="flex items-center justify-center gap-1">
                      Telj.
                      <ArrowUpDown className="h-3 w-3 text-muted-foreground" />
                    </div>
                  </TableHead>

                  <TableHead
                    className="cursor-pointer hover:bg-muted/50 font-semibold whitespace-nowrap"
                    onClick={() => handleSort('bizonylatsorszam')}
                  >
                    <div className="flex items-center gap-1">
                      Biz.szám
                      <ArrowUpDown className="h-3 w-3 text-muted-foreground" />
                    </div>
                  </TableHead>

                  <TableHead
                    className="text-right cursor-pointer hover:bg-muted/50 font-semibold whitespace-nowrap"
                    onClick={() => handleSort('adoalap_osszesen')}
                  >
                    <div className="flex items-center justify-end gap-1">
                      <ArrowUpDown className="h-3 w-3 text-muted-foreground" />
                      Nettó
                    </div>
                  </TableHead>

                  <TableHead
                    className="text-right cursor-pointer hover:bg-muted/50 font-semibold whitespace-nowrap"
                    onClick={() => handleSort('brutto_vegosszeg')}
                  >
                    <div className="flex items-center justify-end gap-1">
                      <ArrowUpDown className="h-3 w-3 text-muted-foreground" />
                      Bruttó
                    </div>
                  </TableHead>

                  <TableHead
                    className="text-right cursor-pointer hover:bg-muted/50 font-semibold whitespace-nowrap"
                    onClick={() => handleSort('afa_osszeg_osszesen')}
                  >
                    <div className="flex items-center justify-end gap-1">
                      <ArrowUpDown className="h-3 w-3 text-muted-foreground" />
                      ÁFA
                    </div>
                  </TableHead>

                  <TableHead className="font-semibold text-center whitespace-nowrap">Fiz. mód</TableHead>
                  <TableHead className="font-semibold text-center whitespace-nowrap">Tételek</TableHead>
                  <TableHead className="font-semibold text-center whitespace-nowrap">Számla kép</TableHead>
                  <TableHead className="text-center font-semibold whitespace-nowrap">Műveletek</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {loading || tabFetching ? (
                  <TableSkeleton rows={10} columns={12} />
                ) : paginatedSubmittedInvoices.length === 0 ? (
                  <TableEmptyState
                    colSpan={12}
                    title={
                      kpiFilter !== 'all'
                        ? 'Nincs ilyen státuszú számla ezen az oldalon'
                        : 'Nincs megjeleníthető számla'
                    }
                    description={
                      kpiFilter !== 'all'
                        ? 'Kattints az "Összes találat" KPI kártyára a szűrő törléséhez.'
                        : 'Próbáld módosítani a szűrőket vagy keresési feltételeket.'
                    }
                  />
                ) : (
                  paginatedSubmittedInvoices.map((invoice) => (
                    <SubmittedInvoiceRow
                      key={invoice.id}
                      invoice={invoice}
                      submittedToNavMap={submittedToNavMap}
                      pageInvoiceIdToTransactionsMap={pageInvoiceIdToTransactionsMap}
                      onRowClick={onRowClick}
                      onToggleExclude={onToggleExclude}
                    />
                  ))
                )}
                <TablePlaceholderRows
                  currentCount={paginatedSubmittedInvoices.length}
                  pageSize={submittedPageSize}
                  columns={12}
                />
              </TableBody>
            </Table>
          </div>
        </ContextMenuTrigger>

        <ContextMenuContent>
          <ContextMenuItem onClick={() => expandAllRows(paginatedSubmittedInvoices.map(i => i.id))}>
            <ChevronsUpDown className="h-3.5 w-3.5 mr-2" />
            Összes lenyitás
          </ContextMenuItem>
          <ContextMenuItem onClick={() => collapseAllRows()}>
            <ChevronsDownUp className="h-3.5 w-3.5 mr-2" />
            Összes bezárás
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>

      <UnifiedPagination
        currentPage={submittedCurrentPage}
        totalPages={submittedTotalPages}
        totalItems={submittedTotalCount}
        pageSize={submittedPageSize}
        onPageChange={setSubmittedCurrentPage}
        onPageSizeChange={(size) => {
          setSubmittedPageSize(size);
          setSubmittedCurrentPage(1);
        }}
        className="mt-3"
      />
    </>
  );
}
