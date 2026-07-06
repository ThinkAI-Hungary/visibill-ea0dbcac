import { Send, CheckCircle, Trash2 } from 'lucide-react';
import type { InvoiceItem } from './InvoiceDetailModal';

interface BulkBarProps {
  selectedIds: string[];
  invoices: InvoiceItem[];
  onSendToApprovalQueue: (items: InvoiceItem[]) => void;
  onBulkDelete: () => void;
  onClearSelection: () => void;
}

export function MissingInvoicesBulkBar({
  selectedIds, invoices, onSendToApprovalQueue, onBulkDelete, onClearSelection,
}: BulkBarProps) {
  if (selectedIds.length === 0) return null;

  return (
    <div className="fixed bottom-8 left-1/2 -translate-x-1/2 w-full max-w-4xl bg-slate-100/95 dark:bg-slate-800/95 backdrop-blur-sm border border-slate-200 dark:border-slate-700 p-4 rounded-2xl shadow-xl flex items-center justify-between animate-in slide-in-from-bottom-10 fade-in duration-300 z-50">
      <div className="text-sm font-semibold text-slate-700 dark:text-slate-300 pl-2">
        {selectedIds.length} kijelölve
      </div>
      <div className="flex items-center gap-3">
        <button
          onClick={() => {
            const selectedItems = invoices.filter(inv => selectedIds.includes(inv.id));
            onSendToApprovalQueue(selectedItems);
            onClearSelection();
          }}
          className="flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground rounded-xl hover:bg-card/80 dark:hover:bg-primary/90 transition-colors text-sm font-medium shadow-soft"
        >
          <Send className="w-4 h-4" />
          Felszólítás küldése
        </button>
        <button className="flex items-center gap-2 px-5 py-2.5 bg-card border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors text-sm font-medium shadow-soft">
          <CheckCircle className="w-4 h-4" />
          Megérkezett
        </button>
        <button
          onClick={onBulkDelete}
          className="flex items-center gap-2 px-5 py-2.5 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/30 text-red-600 dark:text-red-400 rounded-xl hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors text-sm font-medium shadow-soft"
        >
          <Trash2 className="w-4 h-4" />
          Törlés
        </button>
      </div>
    </div>
  );
}
