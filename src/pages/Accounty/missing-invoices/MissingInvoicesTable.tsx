import React from 'react';
import {
  CheckCircle, Eye, XCircle, MoreVertical, Trash2,
} from 'lucide-react';
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
    <div className="bg-card border border-border rounded-xl shadow-soft overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-border dark:bg-slate-900/50">
              <th className="py-4 px-4 w-12">
                <input 
                  type="checkbox" 
                  checked={isAllSelected}
                  onChange={onSelectAll}
                  className="rounded border-slate-300 text-primary focus:ring-primary cursor-pointer" 
                />
              </th>
              <th className="py-4 px-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Szállító</th>
              <th className="py-4 px-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Időszak</th>
              <th className="py-4 px-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Becsült összeg</th>
              <th className="py-4 px-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Forrás</th>
              <th className="py-4 px-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Prioritás</th>
              <th className="py-4 px-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider min-w-[130px]">Státusz</th>
              <th className="py-4 px-4 w-12 text-center"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {filteredInvoices.length > 0 ? (
              filteredInvoices.map((invoice) => (
                <tr key={invoice.id} className={`hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors group ${selectedIds.includes(invoice.id) ? 'bg-slate-50 dark:bg-slate-800/30' : ''}`}>
                  <td className="py-4 px-4">
                    <input 
                      type="checkbox" 
                      checked={selectedIds.includes(invoice.id)}
                      onChange={() => onSelectItem(invoice.id)}
                      className="rounded border-slate-300 text-primary focus:ring-primary cursor-pointer" 
                    />
                  </td>
                  <td className="py-4 px-4">
                    <div className="font-semibold text-slate-900 dark:text-slate-100 text-sm">{invoice.vendor}</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">{invoice.subtext}</div>
                  </td>
                  <td className="py-4 px-4 text-sm text-slate-600 dark:text-slate-400">{invoice.period}</td>
                  <td className="py-4 px-4 text-sm font-semibold text-slate-900 dark:text-slate-100">{invoice.amount}</td>
                  <td className="py-4 px-4 text-sm text-slate-600 dark:text-slate-400">{invoice.source}</td>
                  <td className="py-4 px-4">{getPriorityBadge(invoice.priority)}</td>
                  <td className="py-4 px-4">{getStatusBadge(invoice.status, invoice.statusVariant)}</td>
                  <td className="py-4 px-4 text-center" onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 dark:text-slate-400 p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-all outline-none">
                          <MoreVertical className="w-5 h-5" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-56 bg-card border-border">
                        <DropdownMenuItem 
                          className="gap-2.5 cursor-pointer text-slate-700 dark:text-slate-300 py-2"
                          onClick={() => onViewDetails(invoice)}
                        >
                          <Eye className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                          <span className="font-medium text-sm">Részletek</span>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator className="bg-slate-100 dark:bg-slate-800" />
                        {invoice.statusVariant === 'success' ? (
                          <DropdownMenuItem 
                            className="gap-2.5 cursor-pointer text-red-500 dark:text-red-400 py-2"
                            onClick={() => onUnresolve(invoice.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                            <span className="font-medium text-sm">Feltöltött file eltávolítása</span>
                          </DropdownMenuItem>
                        ) : (
                          <DropdownMenuItem 
                            className="gap-2.5 cursor-pointer text-slate-700 dark:text-slate-300 py-2"
                            onClick={() => onResolve(invoice.id)}
                          >
                            <CheckCircle className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                            <span className="font-medium text-sm">Megérkezettnek jelöl</span>
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem 
                          className="gap-2.5 cursor-pointer text-slate-700 dark:text-slate-300 py-2"
                          onClick={() => onDelete(invoice.id)}
                        >
                          <XCircle className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                          <span className="font-medium text-sm">Téves találatnak jelöl</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          className="gap-2.5 cursor-pointer text-red-600 focus:text-red-600 focus:bg-red-50 dark:focus:bg-red-900/20 py-2"
                          onClick={() => onDelete(invoice.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                          <span className="font-medium text-sm">Törlés</span>
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={8} className="py-8 text-center text-slate-500 dark:text-slate-400">
                  Nincs a keresésnek megfelelő találat.
                </td>
              </tr>
            )}
          </tbody>
        </table>
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
