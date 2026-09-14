import { Send, CheckCircle, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FloatingBulkBar } from '@/components/ui/floating-bulk-bar';
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
    <FloatingBulkBar
      count={selectedIds.length}
      label="Kijelölt számlák:"
      itemUnit="db"
      onCancel={onClearSelection}
      cancelLabel="Mégse"
      hideSaveButton={true}
    >
      <Button
        type="button"
        size="sm"
        onClick={() => {
          const selectedItems = invoices.filter(inv => selectedIds.includes(inv.id));
          onSendToApprovalQueue(selectedItems);
          onClearSelection();
        }}
        className="h-9 text-xs gap-1.5 rounded-lg font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm shrink-0"
      >
        <Send className="w-3.5 h-3.5" />
        Felszólítás küldése
      </Button>
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="h-9 text-xs gap-1.5 rounded-lg border-border/80 bg-background/80 hover:bg-muted transition-colors font-medium shrink-0"
      >
        <CheckCircle className="w-3.5 h-3.5" />
        Megérkezett
      </Button>
      <Button
        type="button"
        size="sm"
        variant="destructive"
        onClick={onBulkDelete}
        className="h-9 text-xs gap-1.5 rounded-lg font-semibold shadow-sm shrink-0"
      >
        <Trash2 className="w-3.5 h-3.5" />
        Törlés
      </Button>
    </FloatingBulkBar>
  );
}
