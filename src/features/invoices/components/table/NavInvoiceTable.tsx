import React from 'react';
import { Table, TableBody, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger } from '@/components/ui/context-menu';
import { UnifiedPagination } from '@/components/ui/unified-pagination';
import { TableSkeleton } from '@/components/ui/table-skeleton';
import { TableEmptyState } from '@/components/ui/table-empty-state';
import { TablePlaceholderRows } from '@/components/ui/table-placeholder-rows';
import { ArrowUpDown, Info, ChevronsUpDown, ChevronsDownUp } from 'lucide-react';
import { NavInvoiceRow } from './NavInvoiceRow';
import { useInvoiceContext } from '../../context/useInvoiceContext';
import type { SubmittedInvoice, TransactionRecord } from '../../types';

interface NavInvoiceTableProps {
  navToSubmittedMap: Map<string, SubmittedInvoice[]>;
  pageInvoiceIdToTransactionsMap: Map<string, TransactionRecord[]>;
  onRowClick: (invoiceId: string, e: React.MouseEvent) => void;
  onToggleExclude: (invoiceId: string, currentValue: boolean) => Promise<void>;
}

export function NavInvoiceTable({
  navToSubmittedMap,
  pageInvoiceIdToTransactionsMap,
  onRowClick,
  onToggleExclude,
}: NavInvoiceTableProps) {
  const {
    activeTab,
    loading,
    tabFetching,
    paginatedNavInvoices,
    navCurrentPage,
    setNavCurrentPage,
    navPageSize,
    setNavPageSize,
    navTotalPages,
    navTotalCount,
    handleSort,
    kpiFilter,
    setKpiFilter,
    clearFilters,
    isAllSelected,
    toggleSelectAll,
    expandAllRows,
    collapseAllRows,
  } = useInvoiceContext();

  const isColSpan15 = activeTab === 'INBOUND';
  const colSpan = isColSpan15 ? 15 : 13;

  return (
    <>
      <UnifiedPagination
        currentPage={navCurrentPage}
        totalPages={navTotalPages}
        totalItems={navTotalCount}
        pageSize={navPageSize}
        onPageChange={setNavCurrentPage}
        onPageSizeChange={(size) => {
          setNavPageSize(size);
          setNavCurrentPage(1);
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
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm bg-orange-500/10 border-l-2 border-l-orange-400" />
          <span>Kompenzálandó</span>
        </div>
      </div>

      {/* Table with Context Menu */}
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
                    onClick={() => handleSort('partner_name')}
                  >
                    <div className="flex items-center gap-1">
                      Partner
                      <ArrowUpDown className="h-3 w-3 text-muted-foreground" />
                    </div>
                  </TableHead>

                  <TableHead
                    className="cursor-pointer hover:bg-muted/50 font-semibold text-center whitespace-nowrap"
                    onClick={() => handleSort('invoice_issue_date')}
                  >
                    <div className="flex items-center justify-center gap-1">
                      Kiáll.
                      <ArrowUpDown className="h-3 w-3 text-muted-foreground" />
                    </div>
                  </TableHead>

                  <TableHead
                    className="cursor-pointer hover:bg-muted/50 font-semibold text-center whitespace-nowrap"
                    onClick={() => handleSort('invoice_delivery_date')}
                  >
                    <div className="flex items-center justify-center gap-1">
                      Telj.
                      <ArrowUpDown className="h-3 w-3 text-muted-foreground" />
                    </div>
                  </TableHead>

                  <TableHead
                    className="cursor-pointer hover:bg-muted/50 font-semibold whitespace-nowrap min-w-[110px]"
                    onClick={() => handleSort('invoice_number')}
                  >
                    <div className="flex items-center gap-1">
                      Biz.szám
                      <ArrowUpDown className="h-3 w-3 text-muted-foreground" />
                    </div>
                  </TableHead>

                  <TableHead
                    className="text-right cursor-pointer hover:bg-muted/50 font-semibold whitespace-nowrap"
                    onClick={() => handleSort('invoice_net_amount')}
                  >
                    <div className="flex items-center justify-end gap-1">
                      <ArrowUpDown className="h-3 w-3 text-muted-foreground" />
                      Nettó
                    </div>
                  </TableHead>

                  <TableHead
                    className="text-right cursor-pointer hover:bg-muted/50 font-semibold whitespace-nowrap"
                    onClick={() => handleSort('invoice_gross_amount')}
                  >
                    <div className="flex items-center justify-end gap-1">
                      <ArrowUpDown className="h-3 w-3 text-muted-foreground" />
                      Bruttó
                    </div>
                  </TableHead>

                  <TableHead
                    className="text-right cursor-pointer hover:bg-muted/50 font-semibold whitespace-nowrap"
                    onClick={() => handleSort('invoice_vat_amount')}
                  >
                    <div className="flex items-center justify-end gap-1">
                      <ArrowUpDown className="h-3 w-3 text-muted-foreground" />
                      ÁFA
                    </div>
                  </TableHead>

                  <TableHead className="font-semibold text-center whitespace-nowrap">
                    <div className="flex items-center justify-center gap-1">
                      Státusz
                      <TooltipProvider delayDuration={0}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Info className="h-3 w-3 text-muted-foreground/60 cursor-help" />
                          </TooltipTrigger>
                          <TooltipContent side="top" align="end" sideOffset={8} className="max-w-[280px] whitespace-normal">
                            <p className="text-xs font-normal normal-case tracking-normal leading-relaxed whitespace-normal">
                              A számla fizetési állapota automatikusan változik: „Kifizetve" lesz, ha a számlához tartozó
                              tranzakció párosítva van.
                            </p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                  </TableHead>

                  {activeTab === 'INBOUND' && (
                    <TableHead className="font-semibold text-center whitespace-nowrap">Beküldve</TableHead>
                  )}
                  {activeTab === 'INBOUND' && (
                    <TableHead className="font-semibold text-center whitespace-nowrap">Kategória</TableHead>
                  )}

                  <TableHead className="font-semibold text-center whitespace-nowrap">Projekt</TableHead>
                  <TableHead className="font-semibold text-center whitespace-nowrap">Fiz. mód</TableHead>
                  <TableHead className="font-semibold text-center whitespace-nowrap">Számla kép</TableHead>
                  <TableHead className="font-semibold text-center whitespace-nowrap">Tételek</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {loading || tabFetching ? (
                  <TableSkeleton rows={10} columns={colSpan} />
                ) : paginatedNavInvoices.length === 0 ? (
                  <TableEmptyState
                    colSpan={colSpan}
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
                    onClearFilters={kpiFilter !== 'all' ? () => setKpiFilter('all') : clearFilters}
                  />
                ) : (
                  paginatedNavInvoices.map((invoice) => (
                    <NavInvoiceRow
                      key={invoice.id}
                      invoice={invoice}
                      navToSubmittedMap={navToSubmittedMap}
                      pageInvoiceIdToTransactionsMap={pageInvoiceIdToTransactionsMap}
                      onRowClick={onRowClick}
                      onToggleExclude={onToggleExclude}
                    />
                  ))
                )}
                <TablePlaceholderRows
                  currentCount={paginatedNavInvoices.length}
                  pageSize={navPageSize}
                  columns={colSpan}
                />
              </TableBody>
            </Table>
          </div>
        </ContextMenuTrigger>

        <ContextMenuContent>
          <ContextMenuItem onClick={() => expandAllRows(paginatedNavInvoices.map(i => i.id))}>
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
        currentPage={navCurrentPage}
        totalPages={navTotalPages}
        totalItems={navTotalCount}
        pageSize={navPageSize}
        onPageChange={setNavCurrentPage}
        onPageSizeChange={(size) => {
          setNavPageSize(size);
          setNavCurrentPage(1);
        }}
        className="mt-3"
      />
    </>
  );
}
