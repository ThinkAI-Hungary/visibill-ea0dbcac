import { useState, useEffect, useRef } from 'react';
import { FileText } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';

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
        setError(true);
      } else {
        signedUrlCache.set(invoiceId, data.signedUrl);
        setSignedUrl(data.signedUrl);
      }
      setLoading(false);
    });
  }, [isOpen, invoiceId]);

  if (isPDF) {
    return (
      <div className="flex flex-col items-center justify-center h-36 bg-muted rounded text-muted-foreground text-xs gap-2">
        <FileText className="h-8 w-8" />
        <span>PDF dokumentum</span>
      </div>
    );
  }

  if (loading) {
    return <Skeleton className="w-full h-36 rounded" />;
  }

  if (error || !signedUrl) {
    return (
      <div className="flex flex-col items-center justify-center h-36 bg-muted rounded text-muted-foreground text-xs gap-2">
        <FileText className="h-8 w-8" />
        <span>Előnézet nem elérhető</span>
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
