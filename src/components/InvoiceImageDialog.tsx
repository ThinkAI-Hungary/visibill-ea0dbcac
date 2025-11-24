import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Invoice {
  id: string;
  szamlaszam: string;
  elado_nev: string;
  vevo_nev: string;
  image_url?: string;
}

interface InvoiceImageDialogProps {
  invoice: Invoice | null;
  open: boolean;
  onClose: () => void;
}

const InvoiceImageDialog = ({ invoice, open, onClose }: InvoiceImageDialogProps) => {
  if (!invoice) return null;

  const isPDF = invoice.image_url?.toLowerCase().endsWith('.pdf');

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle>Számla: {invoice.szamlaszam}</DialogTitle>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">
            {invoice.elado_nev} → {invoice.vevo_nev}
          </p>
        </DialogHeader>
        <div className="mt-4 overflow-auto max-h-[calc(90vh-120px)]">
          {invoice.image_url ? (
            isPDF ? (
              <iframe
                src={invoice.image_url}
                className="w-full h-[70vh] border rounded"
                title={`Számla: ${invoice.szamlaszam}`}
              />
            ) : (
              <img
                src={invoice.image_url}
                alt={`Számla: ${invoice.szamlaszam}`}
                className="w-full h-auto rounded"
              />
            )
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <p>Nincs elérhető kép ehhez a számlához</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default InvoiceImageDialog;
