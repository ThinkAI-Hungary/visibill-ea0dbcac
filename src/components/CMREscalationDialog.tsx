import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { supabase } from '@/integrations/supabase/client';
import { useState, useEffect } from 'react';
import { toast } from '@/hooks/use-toast';
import {
  FileText, Mail, ChevronDown, ChevronRight, ExternalLink, Link2, Loader2, Eye, CheckCircle2,
} from 'lucide-react';
import { format } from 'date-fns';
import { hu } from 'date-fns/locale';

interface UploadRecord {
  id: string;
  file_name: string;
  file_url: string;
  processing_status: string;
  created_at: string;
  metadata: Record<string, any> | null;
}

interface SiblingUpload {
  id: string;
  file_name: string;
  processing_status: string;
  file_url?: string;
}

interface CMRDocData {
  id: string;
  vision_ocr_text?: string;
  email_context?: {
    sender?: string;
    subject?: string;
    received_at?: string;
    company_name?: string;
  };
  sibling_uploads?: SiblingUpload[];
  position_number?: string;
  status: string;
}

interface CMREscalationDialogProps {
  upload: UploadRecord;
  open: boolean;
  onClose: () => void;
  onResolved: () => void;
}

export default function CMREscalationDialog({ upload, open, onClose, onResolved }: CMREscalationDialogProps) {
  const [cmrData, setCmrData] = useState<CMRDocData | null>(null);
  const [loading, setLoading] = useState(true);
  const [positionInput, setPositionInput] = useState('');
  const [resolving, setResolving] = useState(false);
  const [ocrOpen, setOcrOpen] = useState(false);

  // Fetch CMR document data from cmr_documents table
  useEffect(() => {
    if (!open || !upload.id) return;

    async function fetchCMRData() {
      setLoading(true);
      try {
        // Find CMR document by source_upload_id in metadata
        const { data, error } = await (supabase as any)
          .from('transport_documents')
          .select('id, position_number, status, metadata')
          .filter('metadata->>source_upload_id', 'eq', upload.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        if (error || !data) {
          // Fallback: try using metadata from the upload record itself
          const cmrResult = upload.metadata?.cmr_result;
          if (cmrResult?.cmr_id) {
            const { data: cmrDoc } = await (supabase as any)
              .from('transport_documents')
              .select('id, position_number, status, metadata')
              .eq('id', cmrResult.cmr_id)
              .single();
            if (cmrDoc) {
              setCmrData({
                id: cmrDoc.id,
                vision_ocr_text: cmrDoc.metadata?.vision_ocr_text,
                email_context: cmrDoc.metadata?.email_context,
                sibling_uploads: cmrDoc.metadata?.sibling_uploads,
                position_number: cmrDoc.position_number,
                status: cmrDoc.status,
              });
              setLoading(false);
              return;
            }
          }
          setCmrData(null);
          setLoading(false);
          return;
        }

        setCmrData({
          id: data.id,
          vision_ocr_text: data.metadata?.vision_ocr_text,
          email_context: data.metadata?.email_context,
          sibling_uploads: data.metadata?.sibling_uploads,
          position_number: data.position_number,
          status: data.status,
        });
      } catch (err) {
        console.error('Failed to fetch CMR data:', err);
        setCmrData(null);
      } finally {
        setLoading(false);
      }
    }

    fetchCMRData();
  }, [open, upload.id, upload.metadata]);

  // Handle manual position number resolution
  const handleResolve = async () => {
    if (!positionInput.trim() || !cmrData?.id) return;

    setResolving(true);
    try {
      // Normalize position number format
      let normalizedPos = positionInput.trim().toUpperCase();
      // Auto-format: "E2627512" → "E/2627512"
      const posMatch = normalizedPos.match(/^([A-Z])[\/-]?(\d{6,7})$/);
      if (posMatch) {
        normalizedPos = `${posMatch[1]}/${posMatch[2]}`;
      }

      // Update CMR document with position number
      const { error: updateError } = await (supabase as any)
        .from('transport_documents')
        .update({
          position_number: normalizedPos,
          status: 'orphaned', // Will be rematched by worker automatically
          metadata: {
            ...(cmrData.vision_ocr_text ? { vision_ocr_text: cmrData.vision_ocr_text } : {}),
            ...(cmrData.email_context ? { email_context: cmrData.email_context } : {}),
            ...(cmrData.sibling_uploads ? { sibling_uploads: cmrData.sibling_uploads } : {}),
            manual_position: true,
            resolved_at: new Date().toISOString(),
          },
        })
        .eq('id', cmrData.id);

      if (updateError) throw updateError;

      // Update upload processing status
      await (supabase as any)
        .from('invoice_uploads')
        .update({ processing_status: 'cmr_orphaned' })
        .eq('id', upload.id);

      // Try to find matching invoice immediately
      const { data: invoices } = await (supabase as any)
        .from('invoices')
        .select('id, bizonylatsorszam, position_numbers')
        .contains('position_numbers', [normalizedPos]);

      if (invoices && invoices.length > 0) {
        // Direct match found — link them
        const invoice = invoices[0];
        await (supabase as any)
          .from('transport_documents')
          .update({
            linked_invoice_id: invoice.id,
            status: 'matched',
            match_confidence: 1.0,
          })
          .eq('id', cmrData.id);

        await (supabase as any)
          .from('invoice_uploads')
          .update({ processing_status: 'cmr_attached' })
          .eq('id', upload.id);

        toast({
          title: 'CMR párosítva! ✅',
          description: `Sikeresen párosítva a ${invoice.bizonylatsorszam} számlához (${normalizedPos}).`,
        });
      } else {
        toast({
          title: 'Pozíciószám mentve',
          description: `${normalizedPos} — jelenleg nincs hozzá számla, automatikusan párosul ha megérkezik.`,
        });
      }

      onResolved();
    } catch (err: any) {
      console.error('CMR resolution failed:', err);
      toast({
        title: 'Hiba a párosítás során',
        description: err.message || 'Ismeretlen hiba',
        variant: 'destructive',
      });
    } finally {
      setResolving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-orange-500" />
            CMR Eszkaláció
          </DialogTitle>
          <DialogDescription>
            A CMR dokumentumból nem sikerült automatikusan pozíciószámot kinyerni.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-5 mt-2">

            {/* ── File info ─────────────────────────────── */}
            <div className="rounded-lg border bg-muted/30 p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">{upload.file_name}</span>
                <Badge variant="outline" className="text-xs">
                  {format(new Date(upload.created_at), 'yyyy.MM.dd HH:mm', { locale: hu })}
                </Badge>
              </div>
              {upload.file_url && (
                <Button variant="ghost" size="sm" className="h-7 text-xs gap-1.5" onClick={() => window.open(upload.file_url, '_blank')}>
                  <Eye className="h-3.5 w-3.5" />
                  CMR megtekintése
                </Button>
              )}
            </div>

            {/* ── Email context ─────────────────────────── */}
            {cmrData?.email_context && (
              <div className="rounded-lg border p-4 space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Mail className="h-4 w-4 text-blue-500" />
                  Email kontextus
                </div>
                <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
                  <span className="text-muted-foreground">Feladó:</span>
                  <span className="font-mono text-xs">{cmrData.email_context.sender || '—'}</span>
                  <span className="text-muted-foreground">Tárgy:</span>
                  <span>{cmrData.email_context.subject || '—'}</span>
                </div>
              </div>
            )}

            {/* ── Vision OCR text ───────────────────────── */}
            {cmrData?.vision_ocr_text && (
              <Collapsible open={ocrOpen} onOpenChange={setOcrOpen}>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" className="w-full justify-between h-9 text-sm font-medium px-3">
                    <span className="flex items-center gap-2">
                      <Eye className="h-4 w-4" />
                      Vision OCR szöveg ({cmrData.vision_ocr_text.length} karakter)
                    </span>
                    {ocrOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <pre className="mt-2 max-h-[200px] overflow-auto rounded-lg border bg-muted/50 p-3 text-xs whitespace-pre-wrap font-mono">
                    {cmrData.vision_ocr_text}
                  </pre>
                </CollapsibleContent>
              </Collapsible>
            )}

            {/* ── Sibling uploads ──────────────────────── */}
            {cmrData?.sibling_uploads && cmrData.sibling_uploads.length > 0 && (
              <div className="rounded-lg border p-4 space-y-3">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Link2 className="h-4 w-4 text-purple-500" />
                  Batch társak ({cmrData.sibling_uploads.length} fájl)
                </div>
                <p className="text-xs text-muted-foreground">
                  Ugyanabban a feltöltésben/emailben érkezett fájlok:
                </p>
                <div className="space-y-1.5">
                  {cmrData.sibling_uploads.map((sib) => (
                    <div key={sib.id} className="flex items-center justify-between gap-2 rounded border bg-background px-3 py-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                        <span className="text-sm truncate">{sib.file_name}</span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Badge variant={sib.processing_status === 'processed' ? 'default' : 'secondary'} className="text-[10px]">
                          {sib.processing_status === 'processed' ? 'Feldolgozva' : sib.processing_status}
                        </Badge>
                        {sib.file_url && (
                          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => window.open(sib.file_url, '_blank')}>
                            <ExternalLink className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── Manual position number input ─────────── */}
            <div className="rounded-lg border border-orange-500/30 bg-orange-50/50 dark:bg-orange-950/20 p-4 space-y-3">
              <Label htmlFor="cmr-position" className="text-sm font-medium flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-orange-500" />
                Pozíciószám manuális megadása
              </Label>
              <p className="text-xs text-muted-foreground">
                Kérlek add meg a CMR-hez tartozó pozíciószámot (pl. E/2627512). Ha a számla már fel van töltve, automatikusan párosul.
              </p>
              <div className="flex gap-2">
                <Input
                  id="cmr-position"
                  placeholder="pl. E/2627512"
                  value={positionInput}
                  onChange={(e) => setPositionInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleResolve(); }}
                  className="font-mono"
                  disabled={resolving}
                />
                <Button
                  onClick={handleResolve}
                  disabled={!positionInput.trim() || resolving}
                  className="shrink-0"
                >
                  {resolving ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Link2 className="h-4 w-4 mr-2" />
                  )}
                  Párosítás
                </Button>
              </div>
            </div>

          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
