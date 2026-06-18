import { useState, useEffect, useRef } from 'react';
import { FileText, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { reportError } from '@/lib/errorReporter';

// Module-level cache so signed URLs persist across re-renders
const signedUrlCache = new Map<string, string>();

interface InvoiceImagePreviewProps {
  invoiceId: string;
  imageUrl?: string | null;
  mellekletUrl?: string | null;
  isOpen: boolean;
}

export function InvoiceImagePreview({ invoiceId, imageUrl, mellekletUrl, isOpen }: InvoiceImagePreviewProps) {
  const [signedUrl, setSignedUrl] = useState<string | null>(signedUrlCache.get(invoiceId) ?? null);
  const [loading, setLoading] = useState(false);
  const [iframeLoading, setIframeLoading] = useState(true);
  const [error, setError] = useState(false);
  const fetchedRef = useRef(false);

  const displayUrl = imageUrl || mellekletUrl;
  const isPDF = displayUrl?.toLowerCase().endsWith('.pdf');

  useEffect(() => {
    if (!isOpen || !invoiceId || fetchedRef.current) return;

    // Check cache
    const cached = signedUrlCache.get(invoiceId);
    if (cached) {
      setSignedUrl(cached);
      return;
    }

    fetchedRef.current = true;
    setLoading(true);

    supabase.functions.invoke('get-invoice-image-url', {
      body: { invoiceId }
    }).then(({ data, error: fnError }) => {
      if (fnError || !data?.signedUrl) {
        reportError({ type: 'api_call', component: 'InvoiceImagePreview', action: 'getSignedUrl', message: 'Failed to get invoice image URL', error: fnError, context: { invoiceId } });
        setError(true);
      } else {
        signedUrlCache.set(invoiceId, data.signedUrl);
        setSignedUrl(data.signedUrl);
      }
      setLoading(false);
    });
  }, [isOpen, invoiceId]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-48 bg-popover rounded text-muted-foreground text-xs gap-2">
        <Loader2 className="h-6 w-6 animate-spin" />
        <span>Előnézet betöltése...</span>
      </div>
    );
  }

  if (error || !signedUrl) {
    return (
      <div className="flex flex-col items-center justify-center h-36 bg-muted rounded text-muted-foreground text-xs gap-2">
        <FileText className="h-8 w-8" />
        <span>Előnézet nem elérhető</span>
      </div>
    );
  }

  if (isPDF) {
    return (
      <div className="relative w-full h-48 rounded overflow-hidden bg-white">
        {iframeLoading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-muted/50 z-10 text-muted-foreground text-xs gap-2">
            <Loader2 className="h-6 w-6 animate-spin" />
            <span>PDF betöltése...</span>
          </div>
        )}
        <iframe
          src={`${signedUrl}#toolbar=0&navpanes=0&scrollbar=0&view=FitH`}
          className="w-full h-full border-0 pointer-events-none"
          title="Számla előnézet"
          onLoad={() => setIframeLoading(false)}
        />
      </div>
    );
  }

  return (
    <img
      src={signedUrl}
      alt="Számla előnézet"
      className="w-full h-auto max-h-48 object-contain rounded"
    />
  );
}
