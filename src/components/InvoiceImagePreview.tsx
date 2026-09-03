import { useState, useEffect, useRef } from 'react';
import { FileText, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { reportError } from '@/lib/errorReporter';
import { cn } from '@/lib/utils';

// Module-level cache so signed URLs persist across re-renders
const signedUrlCache = new Map<string, string>();

interface InvoiceImagePreviewProps {
  invoiceId: string;
  imageUrl?: string | null;
  mellekletUrl?: string | null;
  isOpen: boolean;
  interactive?: boolean;
  className?: string;
}

export function InvoiceImagePreview({
  invoiceId,
  imageUrl,
  mellekletUrl,
  isOpen,
  interactive = false,
  className,
}: InvoiceImagePreviewProps) {
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
      <div className={cn("flex flex-col items-center justify-center bg-popover rounded text-muted-foreground text-xs gap-2", interactive ? "h-full min-h-[200px]" : "h-48", className)}>
        <Loader2 className="h-6 w-6 animate-spin" />
        <span>Előnézet betöltése...</span>
      </div>
    );
  }

  if (error || !signedUrl) {
    return (
      <div className={cn("flex flex-col items-center justify-center bg-muted rounded text-muted-foreground text-xs gap-2", interactive ? "h-full min-h-[200px]" : "h-36", className)}>
        <FileText className="h-8 w-8" />
        <span>Előnézet nem elérhető</span>
      </div>
    );
  }

  if (isPDF) {
    return (
      <div className={cn("relative w-full rounded overflow-hidden bg-white", interactive ? "h-full min-h-[250px]" : "h-48", className)}>
        {iframeLoading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-muted/50 z-10 text-muted-foreground text-xs gap-2">
            <Loader2 className="h-6 w-6 animate-spin" />
            <span>PDF betöltése...</span>
          </div>
        )}
        <iframe
          src={interactive ? `${signedUrl}#toolbar=0&navpanes=0&view=FitH` : `${signedUrl}#toolbar=0&navpanes=0&scrollbar=0&view=FitH`}
          className={cn("w-full h-full border-0", interactive ? "pointer-events-auto" : "pointer-events-none")}
          title="Számla előnézet"
          onLoad={() => setIframeLoading(false)}
        />
      </div>
    );
  }

  return (
    <div className={cn("w-full", interactive ? "h-full overflow-y-auto" : "flex justify-center", className)}>
      <img
        src={signedUrl}
        alt="Számla előnézet"
        className={cn(
          "w-full object-contain rounded",
          interactive ? "h-auto" : "h-auto max-h-48"
        )}
      />
    </div>
  );
}
