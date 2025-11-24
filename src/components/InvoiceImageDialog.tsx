import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ExternalLink, AlertCircle } from 'lucide-react';
import { useState } from 'react';

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
  const [imageError, setImageError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  if (!invoice) return null;

  const isPDF = invoice.image_url?.toLowerCase().endsWith('.pdf');
  
  console.log('InvoiceImageDialog - Invoice:', invoice);
  console.log('InvoiceImageDialog - Image URL:', invoice.image_url);
  console.log('InvoiceImageDialog - Is PDF:', isPDF);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle>Számla: {invoice.szamlaszam}</DialogTitle>
          <DialogDescription>
            {invoice.elado_nev} → {invoice.vevo_nev}
          </DialogDescription>
        </DialogHeader>
        <div className="mt-4 overflow-auto max-h-[calc(90vh-120px)]">
          {invoice.image_url ? (
            <>
              {imageError ? (
                <div className="text-center py-12 space-y-4">
                  <AlertCircle className="h-12 w-12 mx-auto text-destructive" />
                  <div>
                    <p className="text-muted-foreground mb-2">Hiba történt a kép betöltése közben</p>
                    <p className="text-sm text-muted-foreground mb-4">URL: {invoice.image_url}</p>
                    <Button 
                      onClick={() => window.open(invoice.image_url, '_blank')}
                      variant="outline"
                    >
                      <ExternalLink className="h-4 w-4 mr-2" />
                      Megnyitás új ablakban
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  {isLoading && (
                    <div className="text-center py-12 text-muted-foreground">
                      <p>Betöltés...</p>
                    </div>
                  )}
                  {isPDF ? (
                    <div className="space-y-4">
                      <div className="flex justify-center">
                        <Button 
                          onClick={() => window.open(invoice.image_url, '_blank')}
                          variant="default"
                        >
                          <ExternalLink className="h-4 w-4 mr-2" />
                          PDF megnyitása új ablakban
                        </Button>
                      </div>
                      <iframe
                        src={invoice.image_url}
                        className="w-full h-[60vh] border rounded"
                        title={`Számla: ${invoice.szamlaszam}`}
                        onLoad={() => setIsLoading(false)}
                        onError={() => {
                          console.error('PDF iframe error:', invoice.image_url);
                          setImageError(true);
                          setIsLoading(false);
                        }}
                      />
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="flex justify-center">
                        <Button 
                          onClick={() => window.open(invoice.image_url, '_blank')}
                          variant="outline"
                          size="sm"
                        >
                          <ExternalLink className="h-4 w-4 mr-2" />
                          Megnyitás új ablakban
                        </Button>
                      </div>
                      <img
                        src={invoice.image_url}
                        alt={`Számla: ${invoice.szamlaszam}`}
                        className="w-full h-auto rounded"
                        onLoad={() => setIsLoading(false)}
                        onError={(e) => {
                          console.error('Image load error:', invoice.image_url, e);
                          setImageError(true);
                          setIsLoading(false);
                        }}
                      />
                    </div>
                  )}
                </>
              )}
            </>
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
