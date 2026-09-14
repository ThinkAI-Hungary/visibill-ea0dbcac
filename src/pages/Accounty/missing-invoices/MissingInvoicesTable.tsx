import React from 'react';
import {
  CheckCircle, Eye, XCircle, MoreVertical, Trash2,
} from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { TableEmptyState } from "@/components/ui/table-empty-state";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getPriorityBadge, getStatusBadge } from './badges';
import type { InvoiceItem } from './InvoiceDetailModal';
import { UnifiedPagination } from '@/components/ui/unified-pagination';

interface MissingInvoicesTableProps {
  filteredInvoices: InvoiceItem[];
  selectedIds: string[];
  isAllSelected: boolean;
  onSelectAll: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onSelectItem: (id: string) => void;
  onViewDetails: (invoice: InvoiceItem) => void;
  onResolve: (id: string) => void;
  onUnresolve: (id: string) => void;
  onDelete: (id: string) => void;
  // Pagination
  currentPage: number;
  totalPages: number;
  totalCount: number;
  pageSize: number;
  onPageChange: (page: number) => void;
}

export function MissingInvoicesTable({
  filteredInvoices,
  selectedIds,
  isAllSelected,
  onSelectAll,
  onSelectItem,
  onViewDetails,
  onResolve,
  onUnresolve,
  onDelete,
  currentPage,
  totalPages,
  totalCount,
  pageSize,
  onPageChange,
}: MissingInvoicesTableProps) {
  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden">
      <div className="overflow-x-auto">
        <Table className="compact-table min-w-[900px]">
          <TableHeader>
            <TableRow className="border-b border-border bg-muted/40">
              <TableHead className="w-12 px-4">
                <Checkbox 
                  checked={isAllSelected}
                  onCheckedChange={onSelectAll}
                  className="cursor-pointer" 
                />
              </TableHead>
              <TableHead className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Szállító</TableHead>
              <TableHead className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Időszak</TableHead>
              <TableHead className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Becsült összeg</TableHead>
              <TableHead className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Forrás</TableHead>
              <TableHead className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Prioritás</TableHead>
              <TableHead className="text-xs font-semibold text-muted-foreground uppercase tracking-wider min-w-[130px]">Státusz</TableHead>
              <TableHead className="w-12 text-center"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredInvoices.length > 0 ? (
              filteredInvoices.map((invoice) => (
                <TableRow 
                  key={invoice.id} 
                  className={`border-l-2 border-l-transparent hover:border-l-primary hover:bg-muted/40 transition-colors group ${selectedIds.includes(invoice.id) ? 'bg-muted/30 border-l-primary' : ''}`}
                >
                  <TableCell className="px-4">
                    <Checkbox 
                      checked={selectedIds.includes(invoice.id)}
                      onCheckedChange={() => onSelectItem(invoice.id)}
                      className="cursor-pointer" 
                    />
                  </TableCell>
                  <TableCell className="px-4">
                    <div className="font-semibold text-foreground text-sm">{invoice.vendor}</div>
                    <div className="text-xs text-muted-foreground">{invoice.subtext}</div>
                  </TableCell>
                  <TableCell className="px-4 text-sm text-muted-foreground">{invoice.period}</TableCell>
                  <TableCell className="px-4 text-sm font-mono tabular-nums text-foreground">{invoice.amount}</TableCell>
                  <TableCell className="px-4 text-sm text-muted-foreground">{invoice.source}</TableCell>
                  <TableCell className="px-4">{getPriorityBadge(invoice.priority)}</TableCell>
                  <TableCell className="px-4">{getStatusBadge(invoice.status, invoice.statusVariant)}</TableCell>
                  <TableCell className="px-4 text-center" onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button className="text-muted-foreground hover:text-foreground p-1.5 rounded-md hover:bg-muted transition-colors outline-none">
                          <MoreVertical className="w-4 h-4" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-56 bg-card border-border">
                        <DropdownMenuItem 
                          className="gap-2.5 cursor-pointer text-foreground/90 py-2"
                          onClick={() => onViewDetails(invoice)}
                        >
                          <Eye className="w-4 h-4 text-muted-foreground" />
                          <span className="font-medium text-sm">Részletek</span>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator className="bg-muted" />
                        {invoice.statusVariant === 'success' ? (
                          <DropdownMenuItem 
                            className="gap-2.5 cursor-pointer text-destructive py-2"
                            onClick={() => onUnresolve(invoice.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                            <span className="font-medium text-sm">Feltöltött file eltávolítása</span>
                          </DropdownMenuItem>
                        ) : (
                          <DropdownMenuItem 
                            className="gap-2.5 cursor-pointer text-foreground/90 py-2"
                            onClick={() => onResolve(invoice.id)}
                          >
                            <CheckCircle className="w-4 h-4 text-muted-foreground" />
                            <span className="font-medium text-sm">Megérkezettnek jelöl</span>
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem 
                          className="gap-2.5 cursor-pointer text-foreground/90 py-2"
                          onClick={() => onDelete(invoice.id)}
                        >
                          <XCircle className="w-4 h-4 text-muted-foreground" />
                          <span className="font-medium text-sm">Téves találatnak jelöl</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          className="gap-2.5 cursor-pointer text-destructive focus:text-destructive focus:bg-destructive/10 py-2"
                          onClick={() => onDelete(invoice.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                          <span className="font-medium text-sm">Törlés</span>
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableEmptyState colSpan={8} title="Nincs hiányzó bizonylat" description="A megadott szűrők alapján nincs rögzített hiányzó bizonylat." />
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination controls */}
      {totalPages > 1 && (
        <div className="border-t border-border px-6 py-3 bg-card">
          <UnifiedPagination
            currentPage={currentPage + 1}
            totalPages={totalPages}
            totalItems={totalCount}
            pageSize={pageSize}
            onPageChange={(page) => onPageChange(page - 1)}
            onPageSizeChange={() => {}}
            pageSizeOptions={[100]}
            disableScrollToTop={true}
          />
        </div>
      )}
    </div>
  );
}
