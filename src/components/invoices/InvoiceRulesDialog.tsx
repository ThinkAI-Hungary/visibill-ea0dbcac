import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  InvoiceItemRulesManager,
  InvoiceItemRule,
  InvoiceItemRulesManagerProps,
} from './InvoiceItemRulesManager';

export type { InvoiceItemRule, InvoiceItemRulesManagerProps };

export interface InvoiceRulesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function InvoiceRulesDialog({ open, onOpenChange }: InvoiceRulesDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[85vh] flex flex-col p-6">
        <InvoiceItemRulesManager asDialog isOpen={open} onClose={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}
