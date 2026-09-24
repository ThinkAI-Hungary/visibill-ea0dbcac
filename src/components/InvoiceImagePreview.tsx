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
  attachments?: Array<{ url: string; name?: string; type?: string }> | null;
  isOpen: boolean;
  interactive?: boolean;
  className?: string;
}

export function InvoiceImagePreview({
  invoiceId,
  imageUrl,
  mellekletUrl,
  attachments,
  isOpen,
  interactive = false,
  className,
}: InvoiceImagePreviewProps) {
  const [activeAttachmentIndex, setActiveAttachmentIndex] = useState<number | null>(null);
  const cacheKey = activeAttachmentIndex !== null ? `${invoiceId}-att-${activeAttachmentIndex}` : invoiceId;
  const [signedUrl, setSignedUrl] = useState<string | null>(signedUrlCache.get(cacheKey) ?? null);
  const [loading, setLoading] = useState(false);
  const [iframeLoading, setIframeLoading] = useState(true);
  const [error, setError] = useState(false);
  const lastFetchedKeyRef = useRef<string | null>(null);

  const hasAttachments = Array.isArray(attachments) && attachments.length > 0;
  const currentTargetUrl = activeAttachmentIndex !== null && hasAttachments
    ? attachments[activeAttachmentIndex]?.url
    : (imageUrl || mellekletUrl || (hasAttachments ? attachments[0]?.url : undefined));

  const isPDF = currentTargetUrl?.toLowerCase().split('?')[0].endsWith('.pdf');

  useEffect(() => {
    if (!isOpen || !invoiceId) return;

    // Check cache
    const cached = signedUrlCache.get(cacheKey);
    if (cached) {
      setSignedUrl(cached);
      setError(false);
      lastFetchedKeyRef.current = cacheKey;
      return;
    }

    if (lastFetchedKeyRef.current === cacheKey) return;
    lastFetchedKeyRef.current = cacheKey;

    setLoading(true);
    setError(false);
    setIframeLoading(true);

    supabase.functions.invoke('get-invoice-image-url', {
      body: { 
        invoiceId,
        attachmentIndex: activeAttachmentIndex !== null ? activeAttachmentIndex : undefined,
      }
    }).then(({ data, error: fnError }) => {
      if (fnError || !data?.signedUrl) {
        reportError({ 
          type: 'api_call', 
          component: 'InvoiceImagePreview', 
          action: 'getSignedUrl', 
          message: 'Failed to get invoice image URL', 
          error: fnError, 
          context: { invoiceId, activeAttachmentIndex } 
        });
        setError(true);
      } else {
        signedUrlCache.set(cacheKey, data.signedUrl);
        setSignedUrl(data.signedUrl);
      }
      setLoading(false);
    });
  }, [isOpen, invoiceId, cacheKey, activeAttachmentIndex]);

  const switcher = hasAttachments && (
    <div className="flex items-center gap-1 p-1 bg-muted/40 rounded-t border-b border-border/30 overflow-x-auto overflow-y-hidden shrink-0 w-full select-none">
      <button
        type="button"
        onClick={() => {
          setActiveAttachmentIndex(null);
          setIframeLoading(true);
        }}
        className={cn(
          "px-2 py-0.5 text-[10px] font-medium rounded border transition-colors whitespace-nowrap cursor-pointer shrink-0 select-none",
          activeAttachmentIndex === null
            ? "border-primary bg-primary text-primary-foreground shadow-xs"
            : "border-border/40 bg-background/80 hover:bg-background text-muted-foreground hover:text-foreground"
        )}
      >
        Számla
      </button>
      {attachments.map((att, idx) => (
        <button
          key={idx}
          type="button"
          onClick={() => {
            setActiveAttachmentIndex(idx);
            setIframeLoading(true);
          }}
          className={cn(
            "px-2 py-0.5 text-[10px] font-medium rounded border transition-colors whitespace-nowrap cursor-pointer max-w-[110px] truncate shrink-0 select-none",
            activeAttachmentIndex === idx
              ? "border-primary bg-primary text-primary-foreground shadow-xs"
              : "border-border/40 bg-background/80 hover:bg-background text-muted-foreground hover:text-foreground"
          )}
          title={att.name || `Melléklet ${idx + 1}`}
        >
          {att.name || `Melléklet ${idx + 1}`}
        </button>
      ))}
    </div>
  );

  if (loading) {
    return (
      <div className={cn("flex flex-col items-center justify-center bg-popover rounded text-muted-foreground text-xs gap-2", interactive ? "h-full min-h-[200px]" : "h-48", className)}>
        {hasAttachments && switcher}
        <div className="flex-1 flex flex-col items-center justify-center gap-2">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <span>Előnézet betöltése...</span>
        </div>
      </div>
    );
  }

  if (error || !signedUrl) {
    return (
      <div className={cn("flex flex-col items-center justify-center bg-muted rounded text-muted-foreground text-xs gap-2", interactive ? "h-full min-h-[200px]" : "h-36", className)}>
        {hasAttachments && switcher}
        <div className="flex-1 flex flex-col items-center justify-center gap-2">
          <FileText className="h-8 w-8" />
          <span>Előnézet nem elérhető</span>
        </div>
      </div>
    );
  }

  if (isPDF) {
    return (
      <div className={cn("relative w-full rounded overflow-hidden bg-white flex flex-col", interactive ? "h-full min-h-[250px]" : "h-48", className)}>
        {hasAttachments && switcher}
        <div className="relative flex-1 w-full h-full min-h-0">
          {iframeLoading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-muted/70 backdrop-blur-xs z-10 text-muted-foreground text-xs gap-2">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <span>PDF betöltése...</span>
            </div>
          )}
          <iframe
            key={signedUrl}
            src={interactive ? `${signedUrl}#toolbar=0&navpanes=0&view=FitH` : `${signedUrl}#toolbar=0&navpanes=0&scrollbar=0&view=FitH`}
            className={cn("w-full h-full border-0 transition-opacity duration-150", iframeLoading ? "opacity-0" : "opacity-100", interactive ? "pointer-events-auto" : "pointer-events-none")}
            title="Számla előnézet"
            onLoad={() => setIframeLoading(false)}
          />
        </div>
      </div>
    );
  }

  return (
    <div className={cn("w-full flex flex-col", interactive ? "h-full overflow-y-auto" : "flex justify-center", className)}>
      {hasAttachments && switcher}
      <div className="relative w-full flex-1 flex items-center justify-center">
        {iframeLoading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-muted/70 backdrop-blur-xs z-10 text-muted-foreground text-xs gap-2">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            <span>Kép betöltése...</span>
          </div>
        )}
        <img
          key={signedUrl}
          src={signedUrl}
          alt="Számla előnézet"
          onLoad={() => setIframeLoading(false)}
          onError={() => setIframeLoading(false)}
          className={cn(
            "w-full object-contain rounded transition-opacity duration-150",
            iframeLoading ? "opacity-0" : "opacity-100",
            interactive ? "h-auto" : "h-auto max-h-48"
          )}
        />
      </div>
    </div>
  );
}
