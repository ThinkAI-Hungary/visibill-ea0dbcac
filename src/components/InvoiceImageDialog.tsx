import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ExternalLink, AlertCircle } from 'lucide-react';
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface InvoiceForDialog {
  id: string;
  elado_nev: string;
  vevo_nev: string;
  szamlaszam?: string;
  dokumentum_azonosito?: string;
  invoice_type?: string;
  melleklet_url?: string;
}

interface InvoiceImageDialogProps {
  invoice: InvoiceForDialog | null;
  open: boolean;
  onClose: () => void;
}

const InvoiceImageDialog = ({ invoice, open, onClose }: InvoiceImageDialogProps) => {
  const [imageError, setImageError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [signedUrl, setSignedUrl] = useState<string | null>(null);

  const getInvoiceIdentifier = (invoice: InvoiceForDialog) => {
    if (invoice.szamlaszam) return invoice.szamlaszam;
    if (invoice.dokumentum_azonosito) return invoice.dokumentum_azonosito;
    if (invoice.invoice_type === 'egyszerusitett_szamla') return 'Egyszerűsített számla';
    return 'N/A';
  };

  useEffect(() => {
    const fetchSignedUrl = async () => {
      if (!invoice?.id || !open) {
        setSignedUrl(null);
        return;
      }

      setIsLoading(true);
      setImageError(false);

      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session) {
          console.error('No active session');
          setImageError(true);
          setIsLoading(false);
          return;
        }

        const response = await supabase.functions.invoke('get-invoice-image-url', {
          body: { invoiceId: invoice.id },
        });

        if (response.error) {
          console.error('Error fetching signed URL:', response.error);
          setImageError(true);
          setIsLoading(false);
          return;
        }

        if (response.data?.signedUrl) {
          console.log('Got signed URL successfully');
          setSignedUrl(response.data.signedUrl);
          setIsLoading(false);
        } else {
          console.error('No signed URL in response');
          setImageError(true);
          setIsLoading(false);
        }
      } catch (error) {
        console.error('Error in fetchSignedUrl:', error);
        setImageError(true);
        setIsLoading(false);
      }
    };

    fetchSignedUrl();
  }, [invoice?.id, open]);

  if (!invoice) return null;

  const displayUrl = signedUrl || invoice.melleklet_url;
  const isPDF = displayUrl?.toLowerCase().endsWith('.pdf');
  
  console.log('InvoiceImageDialog - Invoice:', invoice);
  console.log('InvoiceImageDialog - Display URL:', displayUrl);
  console.log('InvoiceImageDialog - Is PDF:', isPDF);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle>Számla: {getInvoiceIdentifier(invoice)}</DialogTitle>
          <DialogDescription>
            {invoice.elado_nev} → {invoice.vevo_nev}
          </DialogDescription>
        </DialogHeader>
        <div className="mt-4 overflow-auto max-h-[calc(90vh-120px)]">
          {displayUrl ? (
            <>
              {imageError ? (
                <div className="text-center py-12 space-y-4">
                  <AlertCircle className="h-12 w-12 mx-auto text-destructive" />
                  <div>
                    <p className="text-muted-foreground mb-2">Hiba történt a kép betöltése közben</p>
                    <p className="text-sm text-muted-foreground mb-4">URL: {displayUrl}</p>
                    <Button 
                      onClick={() => window.open(displayUrl, '_blank')}
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
                          onClick={() => window.open(displayUrl, '_blank')}
                          variant="default"
                        >
                          <ExternalLink className="h-4 w-4 mr-2" />
                          PDF megnyitása új ablakban
                        </Button>
                      </div>
                      <iframe
                        src={displayUrl}
                        className="w-full h-[60vh] border rounded"
                        title={`Számla: ${getInvoiceIdentifier(invoice)}`}
                        onLoad={() => setIsLoading(false)}
                        onError={() => {
                          console.error('PDF iframe error:', displayUrl);
                          setImageError(true);
                          setIsLoading(false);
                        }}
                      />
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="flex justify-center">
                        <Button 
                          onClick={() => window.open(displayUrl, '_blank')}
                          variant="outline"
                          size="sm"
                        >
                          <ExternalLink className="h-4 w-4 mr-2" />
                          Megnyitás új ablakban
                        </Button>
                      </div>
                      <img
                        src={displayUrl}
                        alt={`Számla: ${getInvoiceIdentifier(invoice)}`}
                        className="w-full h-auto rounded"
                        onLoad={() => setIsLoading(false)}
                        onError={(e) => {
                          console.error('Image load error:', displayUrl, e);
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
