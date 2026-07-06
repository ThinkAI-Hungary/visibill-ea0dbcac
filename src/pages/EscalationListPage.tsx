import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCompany } from '@/contexts/CompanyContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from '@/components/ui/alert-dialog';
import {
  AlertTriangle,
  Check,
  X,
  ArrowLeftRight,
  FileText,
  Truck,
  HelpCircle,
  Inbox,
  Link,
  Unlink,
  ChevronRight,
  ExternalLink,
  Package,
  Search,
  CheckCircle2,
  Clock,
} from 'lucide-react';
import { format } from 'date-fns';
import { hu } from 'date-fns/locale';
import { formatCurrency } from '@/lib/utils';
import InvoiceImageDialog from '@/components/InvoiceImageDialog';

// ── Types ──────────────────────────────────────────────────────────────────

interface EscalatedMatch {
  id: string;
  confidence_score: number | null;
  discrepancies: string[];
  status: string;
  invoice_id: string;
  shipment_id: string | null;
  created_at: string;
  invoice: {
    id: string;
    bizonylatsorszam: string;
    elado_nev: string;
    brutto_vegosszeg: number;
    penznem: string;
    kibocsatas_datuma: string | null;
    planned_payment_date: string | null;
    position_numbers: string[] | null;
  };
  shipment: {
    id: string;
    position_number: string;
    carrier_name: string | null;
    pickup_date: string | null;
    delivery_date: string | null;
    calculated_amount_huf: number | null;
    calculated_amount_eur: number | null;
  } | null;
}

interface EscalatedUpload {
  id: string;
  user_id: string;
  file_name: string;
  file_size: number;
  file_url: string;
  file_type: string;
  processing_status: string;
  error_message: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
  document_category: string | null;
}

interface TransportDoc {
  id: string;
  file_name: string;
  file_path: string | null;
  position_number: string | null;
  status: string;
  linked_shipment_id: string | null;
}

// CMR keresési eredmény — mindkét forrásból (transport_documents + invoice_uploads)
interface CmrSearchResult {
  cmr_id: string;          // transport_documents.id
  upload_id: string | null; // invoice_uploads.id (ha onnan jött)
  file_name: string;
  file_path: string | null;
  position_number: string | null;
  source: 'transport_doc' | 'upload';
}

interface BatchItem {
  upload: {
    id: string;
    file_name: string;
    file_size: number;
    file_url: string;
    processing_status: string;
    created_at: string;
    metadata: Record<string, unknown> | null;
  };
  transportDoc: {
    id: string;
    file_name: string;
    position_number: string | null;
    status: string;
    linked_invoice_id: string | null;
    linked_shipment_id: string | null;
    invoice_bizonylatsorszam?: string | null;
    shipment_position?: string | null;
    shipment_carrier?: string | null;
  } | null;
}

// ── Status helpers ─────────────────────────────────────────────────────────

function getUploadStatusBadge(status: string) {
  const map: Record<string, { label: string; className: string }> = {
    processed:       { label: 'Feldolgozva',        className: 'bg-success/10 text-success border-success/20' },
    cmr_attached:    { label: 'Dokumentum párosítva', className: 'bg-info/10 text-info border-info/20' },
    cmr_escalated:   { label: 'Eszkaláció',          className: 'bg-warning/10 text-warning border-warning/20' },
    cmr_orphaned:    { label: 'Vár a számlára',       className: 'bg-muted/30 text-muted-foreground border-border' },
    error:           { label: 'Hiba',                className: 'bg-destructive/10 text-destructive border-destructive/20' },
    pending:         { label: 'Feldolgozás alatt',   className: 'bg-muted/30 text-muted-foreground border-border' },
  };
  const s = map[status] ?? { label: status, className: 'bg-muted/30 text-muted-foreground border-border' };
  return <Badge variant="outline" className={`text-[9px] px-1.5 py-0 font-bold ${s.className}`}>{s.label}</Badge>;
}

function getTransportStatusBadge(status: string) {
  if (status === 'matched') return <Badge variant="outline" className="text-[9px] px-1.5 py-0 font-bold bg-success/10 text-success border-success/20">Párosítva</Badge>;
  if (status === 'orphaned') return <Badge variant="outline" className="text-[9px] px-1.5 py-0 font-bold bg-muted/30 text-muted-foreground border-border">Páratlan</Badge>;
  return <Badge variant="outline" className="text-[9px] px-1.5 py-0 font-bold">{status}</Badge>;
}

// ── EscalatedUploadDetail ──────────────────────────────────────────────────

function EscalatedUploadDetail({
  upload,
  companyId,
  onResolved,
}: {
  upload: EscalatedUpload;
  companyId: string;
  onResolved: () => void;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [assignPos, setAssignPos] = useState('');
  const [foundInvoice, setFoundInvoice] = useState<{ id: string; bizonylatsorszam: string; position_numbers: string[] | null; shipment_match_status: string | null } | null>(null);
  const [invoiceResults, setInvoiceResults] = useState<{ id: string; bizonylatsorszam: string; position_numbers: string[] | null; shipment_match_status: string | null }[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isAssigning, setIsAssigning] = useState(false);

  // Get cmr_id from metadata
  const cmrResult = (upload.metadata?.cmr_result as Record<string, unknown> | undefined);
  const cmrId = cmrResult?.cmr_id as string | undefined;

  // Fetch batch — uploads from same user_id within ±5 min
  const batchFrom = new Date(new Date(upload.created_at).getTime() - 5 * 60 * 1000).toISOString();
  const batchTo   = new Date(new Date(upload.created_at).getTime() + 5 * 60 * 1000).toISOString();

  const { data: batchItems = [], isLoading: batchLoading } = useQuery<BatchItem[]>({
    queryKey: ['upload-batch', upload.id],
    queryFn: async () => {
      // 1. Fetch all uploads in the same time window (same company, same user)
      const { data: uploads, error: upErr } = await supabase
        .from('invoice_uploads')
        .select('id, file_name, file_size, file_url, processing_status, created_at, metadata')
        .eq('company_id', companyId)
        .eq('user_id', upload.user_id)
        .gte('created_at', batchFrom)
        .lte('created_at', batchTo)
        .order('created_at', { ascending: true });
      if (upErr) throw upErr;

      // 2. Collect all cmr_ids from those uploads
      const cmrIds: string[] = [];
      for (const u of uploads ?? []) {
        const cr = (u.metadata as Record<string, unknown> | null)?.cmr_result as Record<string, unknown> | undefined;
        const cid = cr?.cmr_id as string | undefined;
        if (cid) cmrIds.push(cid);
      }

      // 3. Fetch transport_documents for those cmr_ids (with joined invoice/shipment info)
      let tdMap: Record<string, BatchItem['transportDoc']> = {};
      if (cmrIds.length > 0) {
        const { data: tds } = await supabase
          .from('transport_documents')
          .select(`
            id, file_name, position_number, status, linked_invoice_id, linked_shipment_id,
            invoice:invoices(bizonylatsorszam),
            shipment:shipments(position_number, carrier_name)
          `)
          .in('id', cmrIds);

        for (const td of tds ?? []) {
          const inv = Array.isArray(td.invoice) ? td.invoice[0] : td.invoice;
          const sh  = Array.isArray(td.shipment)  ? td.shipment[0]  : td.shipment;
          tdMap[td.id] = {
            id: td.id,
            file_name: td.file_name,
            position_number: td.position_number,
            status: td.status,
            linked_invoice_id: td.linked_invoice_id,
            linked_shipment_id: td.linked_shipment_id,
            invoice_bizonylatsorszam: (inv as any)?.bizonylatsorszam ?? null,
            shipment_position: (sh as any)?.position_number ?? null,
            shipment_carrier: (sh as any)?.carrier_name ?? null,
          };
        }
      }

      // 4. Pair uploads with their transport docs
      return (uploads ?? []).map<BatchItem>((u) => {
        const cr = (u.metadata as Record<string, unknown> | null)?.cmr_result as Record<string, unknown> | undefined;
        const cid = cr?.cmr_id as string | undefined;
        return { upload: u as BatchItem['upload'], transportDoc: cid ? tdMap[cid] ?? null : null };
      });
    },
    enabled: !!upload.id && !!companyId,
  });

  // Search shipment by position number
  // ── Invoice keresés pozíciószám alapján ──
  const handleSearchInvoice = async (silent = false) => {
    if (!assignPos.trim() || !companyId) return;
    setIsSearching(true);
    setFoundInvoice(null);
    setInvoiceResults([]);
    try {
      // Search invoices where position_numbers array contains the search term
      const { data } = await supabase
        .from('invoices')
        .select('id, bizonylatsorszam, position_numbers, shipment_match_status')
        .eq('company_id', companyId)
        .contains('position_numbers', [assignPos.trim()])
        .limit(6);
      // If no exact array match, fall back to ilike on bizonylatsorszam
      let rows = (data ?? []) as { id: string; bizonylatsorszam: string; position_numbers: string[] | null; shipment_match_status: string | null }[];
      if (rows.length === 0) {
        const { data: fallback } = await supabase
          .from('invoices')
          .select('id, bizonylatsorszam, position_numbers, shipment_match_status')
          .eq('company_id', companyId)
          .or(`bizonylatsorszam.ilike.%${assignPos.trim()}%,position_numbers.cs.{"${assignPos.trim()}"}` )
          .limit(6);
        rows = (fallback ?? []) as typeof rows;
      }
      if (rows.length === 1) {
        setFoundInvoice(rows[0]);
      } else if (rows.length > 1) {
        setInvoiceResults(rows);
      } else if (!silent) {
        toast({ variant: 'destructive', title: 'Nem található', description: `Nincs számla „${assignPos.trim()}” pozíciószámmal.` });
      }
    } finally {
      setIsSearching(false);
    }
  };

  // ── CMR → Invoice → Shipment hozzárendelés ──
  const handleAssign = async () => {
    if (!foundInvoice || !cmrId) return;
    setIsAssigning(true);
    try {
      // 1. Link CMR → invoice
      const { error: tdErr } = await supabase
        .from('transport_documents')
        .update({ linked_invoice_id: foundInvoice.id, status: 'linked' })
        .eq('id', cmrId);
      if (tdErr) throw tdErr;

      // 2. Mark invoice_upload as cmr_attached
      const { error: upErr } = await supabase
        .from('invoice_uploads')
        .update({ processing_status: 'cmr_attached' })
        .eq('id', upload.id);
      if (upErr) throw upErr;

      // 3. If invoice already has a matched shipment, also link CMR → that shipment
      const { data: matchRow } = await supabase
        .from('shipment_matches')
        .select('shipment_id')
        .eq('invoice_id', foundInvoice.id)
        .eq('status', 'confirmed')
        .maybeSingle();
      const linkedShipmentId = (matchRow as any)?.shipment_id as string | undefined;
      if (linkedShipmentId) {
        await supabase
          .from('transport_documents')
          .update({ linked_shipment_id: linkedShipmentId, status: 'matched' })
          .eq('id', cmrId);
      }

      toast({ title: 'CMR csatolva', description: `${upload.file_name} → ${foundInvoice.bizonylatsorszam}` });
      queryClient.invalidateQueries({ queryKey: ['escalated-uploads', companyId] });
      queryClient.invalidateQueries({ queryKey: ['upload-batch', upload.id] });
      queryClient.invalidateQueries({ queryKey: ['shipments-matching', companyId] });
      onResolved();
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Hozzárendelés sikertelen', description: err.message });
    } finally {
      setIsAssigning(false);
    }
  };

  // Debounced auto-suggest: trigger search as user types (>=2 chars)
  useEffect(() => {
    if (assignPos.trim().length < 2) {
      setFoundInvoice(null);
      setInvoiceResults([]);
      return;
    }
    const timer = setTimeout(() => {
      handleSearchInvoice(true); // silent — no toast on auto-search
    }, 350);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assignPos, companyId]);

  return (
    <Card className="border border-border/50 bg-card shadow-sm h-[calc(100vh-220px)] flex flex-col overflow-hidden">
      {/* Header */}
      <CardHeader className="p-5 border-b border-border/40 shrink-0">
        <div className="flex justify-between items-start gap-4">
          <div className="min-w-0">
            <CardTitle className="text-lg font-bold flex items-center gap-2 truncate">
              <FileText className="h-5 w-5 text-warning shrink-0" />
              <span className="truncate">{upload.file_name}</span>
            </CardTitle>
            <CardDescription>
              {(upload.file_size / 1024).toFixed(1)} KB · {upload.file_type || 'PDF'} ·{' '}
              {format(new Date(upload.created_at), 'yyyy. MM. dd. HH:mm', { locale: hu })}
            </CardDescription>
          </div>
          <Badge className="bg-warning/10 text-warning border-warning/20 font-semibold shrink-0">Eszkaláció</Badge>
        </div>
      </CardHeader>

      <CardContent className="p-0 flex-1 overflow-y-auto">

        {/* ── Feltöltési munkamenet ── */}
        <div className="px-5 pt-5 pb-3">
          <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5 mb-3">
            <Package className="h-3.5 w-3.5" />
            Feltöltési munkamenet ({batchLoading ? '…' : batchItems.length} fájl)
          </h3>

          {batchLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-14 rounded-lg" />)}
            </div>
          ) : batchItems.length === 0 ? (
            <p className="text-xs text-muted-foreground italic">Nincsenek egyéb fájlok ebben a munkamenetben.</p>
          ) : (
            <div className="space-y-2">
              {batchItems.map((item) => {
                const isThis = item.upload.id === upload.id;
                const td = item.transportDoc;
                return (
                  <div
                    key={item.upload.id}
                    className={`rounded-lg border p-3 text-xs transition-colors ${
                      isThis
                        ? 'border-warning/40 bg-warning/5'
                        : 'border-border/50 bg-card'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      {/* File info */}
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className={`font-semibold truncate ${isThis ? 'text-warning' : 'text-foreground'}`}>
                            {item.upload.file_name}
                            {isThis && <span className="ml-1 text-[9px] text-warning font-normal">(ez a dokumentum)</span>}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-muted-foreground">{(item.upload.file_size / 1024).toFixed(0)} KB</span>
                          {getUploadStatusBadge(item.upload.processing_status)}

                          {/* Transport doc info */}
                          {td && (
                            <>
                              {td.position_number && (
                                <span className="font-mono text-primary font-bold text-[10px]">
                                  #{td.position_number}
                                </span>
                              )}
                              {getTransportStatusBadge(td.status)}
                              {td.invoice_bizonylatsorszam && (
                                <span className="text-muted-foreground">
                                  → {td.invoice_bizonylatsorszam}
                                </span>
                              )}
                              {td.shipment_position && (
                                <span className="text-muted-foreground flex items-center gap-0.5">
                                  <Truck className="h-2.5 w-2.5" />
                                  {td.shipment_position}
                                  {td.shipment_carrier && ` · ${td.shipment_carrier}`}
                                </span>
                              )}
                            </>
                          )}
                          {!td && (
                            <span className="text-muted-foreground italic text-[10px]">Nincs dokumentum adat</span>
                          )}
                        </div>
                      </div>

                      {/* Open file button */}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 shrink-0"
                        title="Fájl megnyitása"
                        onClick={() => window.open(item.upload.file_url, '_blank')}
                      >
                        <ExternalLink className="h-3.5 w-3.5 text-muted-foreground hover:text-primary" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── CMR részletek ── */}
        {cmrResult && (
          <div className="px-5 py-3 border-t border-border/30">
            <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5 mb-2">
              <AlertTriangle className="h-3.5 w-3.5 text-warning" />
              AI feldolgozás eredménye
            </h3>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-muted-foreground font-semibold">Beazonosítás</span>
                <p className="font-bold text-foreground mt-0.5">
                  {(cmrResult.ai_classification as string | undefined) ?? (upload.metadata?.ai_classification as string | undefined) ?? '—'}
                </p>
              </div>
              <div>
                <span className="text-muted-foreground font-semibold">Kinyert pozíciószám</span>
                <p className={`font-mono font-bold mt-0.5 ${cmrResult.position_number ? 'text-primary' : 'text-muted-foreground italic'}`}>
                  {(cmrResult.position_number as string | null) ?? 'Nem azonosítható'}
                </p>
              </div>
              <div>
                <span className="text-muted-foreground font-semibold">Konfidencia</span>
                <p className="font-bold text-foreground mt-0.5">{String(cmrResult.confidence ?? 0)}%</p>
              </div>
              <div>
                <span className="text-muted-foreground font-semibold">CMR jelleg</span>
                <p className="font-bold text-foreground mt-0.5">{cmrResult.is_cmr ? 'Igen' : 'Nem'}</p>
              </div>
            </div>
          </div>
        )}

        {/* ── Manuális hozzárendelés fuvarhoz ── */}
        <div className="px-5 py-4 border-t border-border/30">
          <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5 mb-3">
            <Link className="h-3.5 w-3.5" />
            CMR csatolása számlához pozíciószám alapján
          </h3>
          <p className="text-[11px] text-muted-foreground mb-3">
            Add meg a fuvar pozíciószámát (pl. E/2627512) — a rendszer megkeresi a megfelelő számlát és hozzácsatolja a CMR-t.
          </p>

          <div className="flex gap-2">
            <Input
              placeholder="Pozíciószám (pl. B/2631247, E/2634119...)"
              value={assignPos}
              onChange={(e) => { setAssignPos(e.target.value); setFoundInvoice(null); setInvoiceResults([]); }}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSearchInvoice(); }}
              className="bg-card font-mono text-sm h-9"
            />
            <Button
              variant="outline"
              size="sm"
              className="h-9 shrink-0"
              onClick={() => handleSearchInvoice()}
              disabled={isSearching || !assignPos.trim()}
            >
              {isSearching ? (
                <span className="h-3.5 w-3.5 rounded-full border-2 border-primary border-t-transparent animate-spin" />
              ) : (
                <Search className="h-3.5 w-3.5" />
              )}
            </Button>
          </div>

          {/* Found invoice: single result */}
          {foundInvoice && (
            <div className="mt-3 rounded-lg border border-success/30 bg-success/5 p-3 flex items-center justify-between gap-3 animate-in slide-in-from-top-1 duration-200">
              <div className="space-y-0.5">
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5 text-success" />
                  <span className="font-bold text-xs text-foreground font-mono">{foundInvoice.bizonylatsorszam}</span>
                </div>
                {foundInvoice.position_numbers && (
                  <p className="text-[11px] text-muted-foreground pl-5 font-mono">{foundInvoice.position_numbers.join(', ')}</p>
                )}
                {foundInvoice.shipment_match_status === 'matched' && (
                  <p className="text-[10px] text-success pl-5">✓ Fuvarhoz párosítva — CMR is linkelődik</p>
                )}
              </div>
              <Button
                size="sm"
                className="bg-success hover:bg-success/90 text-success-foreground h-8 shrink-0"
                onClick={handleAssign}
                disabled={isAssigning}
              >
                {isAssigning ? (
                  <span className="h-3 w-3 rounded-full border-2 border-white border-t-transparent animate-spin mr-1.5" />
                ) : (
                  <Check className="h-3.5 w-3.5 mr-1.5" />
                )}
                CMR csatolása
              </Button>
            </div>
          )}

          {/* Found invoices: multiple results list */}
          {invoiceResults.length > 0 && !foundInvoice && (
            <div className="mt-2 space-y-1.5 max-h-44 overflow-y-auto">
              <p className="text-[10px] text-muted-foreground font-medium">{invoiceResults.length} találat — válaszd ki a megfelelőt:</p>
              {invoiceResults.map((inv) => (
                <div
                  key={inv.id}
                  className="flex items-center justify-between gap-2 p-2 rounded bg-card border border-border/40 text-xs cursor-pointer hover:border-primary/30 hover:bg-primary/5 transition-colors"
                  onClick={() => { setFoundInvoice(inv); setInvoiceResults([]); }}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <FileText className="h-3.5 w-3.5 text-primary shrink-0" />
                    <div className="min-w-0">
                      <p className="font-bold font-mono truncate">{inv.bizonylatsorszam}</p>
                      {inv.position_numbers && <p className="text-[10px] text-muted-foreground font-mono">{inv.position_numbers.join(', ')}</p>}
                    </div>
                  </div>
                  <Check className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                </div>
              ))}
            </div>
          )}

          {!cmrId && (
            <p className="text-[11px] text-muted-foreground italic mt-2">
              Nincs transport_document azonosító — a hozzárendelés nem lehetséges.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────

export default function EscalationListPage() {
  const { selectedCompany } = useCompany();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [selectedMatch, setSelectedMatch] = useState<EscalatedMatch | null>(null);
  const [selectedUpload, setSelectedUpload] = useState<EscalatedUpload | null>(null);
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [reassignPos, setReassignPos] = useState('');
  const [showReassignInput, setShowReassignInput] = useState(false);

  // ── Pending shipment manuális hozzárendelés state ──
  const [pendingAssignPos, setPendingAssignPos] = useState('');
  const [pendingFoundShipment, setPendingFoundShipment] = useState<{ id: string; position_number: string; carrier_name: string | null } | null>(null);
  const [pendingShipmentResults, setPendingShipmentResults] = useState<{ id: string; position_number: string; carrier_name: string | null }[]>([]);
  const [pendingIsSearching, setPendingIsSearching] = useState(false);
  const [pendingIsAssigning, setPendingIsAssigning] = useState(false);

  // ── Dokumentum néző modal ──
  const [docViewerOpen, setDocViewerOpen] = useState(false);
  const [docViewerInvoice, setDocViewerInvoice] = useState<{
    id: string; elado_nev: string; vevo_nev: string;
    bizonylatsorszam?: string; image_url?: string; melleklet_url?: string;
  } | null>(null);

  const openDocViewer = (url: string | null | undefined, title: string) => {
    if (!url) return;
    setDocViewerInvoice({
      id: title,
      elado_nev: title,
      vevo_nev: '',
      bizonylatsorszam: title,
      melleklet_url: url,
    });
    setDocViewerOpen(true);
  };

  // ── CMR csatolás / leválasztás state ──
  const [cmrSearchQuery, setCmrSearchQuery] = useState('');
  const [cmrSearchResults, setCmrSearchResults] = useState<CmrSearchResult[]>([]);
  const [cmrIsSearching, setCmrIsSearching] = useState(false);
  const [cmrIsAttaching, setCmrIsAttaching] = useState<string | null>(null);
  const [cmrDetachTarget, setCmrDetachTarget] = useState<TransportDoc | null>(null);
  const [cmrDetachOpen, setCmrDetachOpen] = useState(false);
  const [cmrIsDetaching, setCmrIsDetaching] = useState(false);

  // ── Shipment leválasztás state ──
  const [shipmentDetachOpen, setShipmentDetachOpen] = useState(false);
  const [isDetachingShipment, setIsDetachingShipment] = useState(false);

  // ── Escalated matches (eltérések + várakozó riport) ──
  const { data: matches = [], isLoading } = useQuery<EscalatedMatch[]>({
    queryKey: ['escalated-matches', selectedCompany?.id],
    queryFn: async () => {
      if (!selectedCompany?.id) return [];
      const { data, error } = await supabase
        .from('shipment_matches')
        .select(`
          id, confidence_score, discrepancies, status, invoice_id, shipment_id, created_at,
          invoice:invoices(id, bizonylatsorszam, elado_nev, vevo_nev, brutto_vegosszeg, penznem, kibocsatas_datuma, planned_payment_date, position_numbers, melleklet_url, image_url),
          shipment:shipments(id, position_number, carrier_name, pickup_date, delivery_date, calculated_amount_huf, calculated_amount_eur)
        `)
        .eq('company_id', selectedCompany.id)
        // DR-032: 'pending' (eltérés) + 'pending_shipment' (várakozó futárriport)
        .in('status', ['pending', 'pending_shipment'])
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as EscalatedMatch[];
    },
    enabled: !!selectedCompany?.id,
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
  });

  const { data: escalatedUploads = [], isLoading: uploadsLoading } = useQuery<EscalatedUpload[]>({
    queryKey: ['escalated-uploads', selectedCompany?.id],
    queryFn: async () => {
      if (!selectedCompany?.id) return [];
      const { data, error } = await supabase
        .from('invoice_uploads')
        .select('id, user_id, file_name, file_size, file_url, file_type, processing_status, error_message, metadata, created_at, updated_at, document_category')
        .eq('company_id', selectedCompany.id)
        .eq('processing_status', 'cmr_escalated')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as EscalatedUpload[];
    },
    enabled: !!selectedCompany?.id,
    staleTime: 0,
    refetchOnMount: true,
  });

  // ── CMR dokumentumok a kiválasztott számlához (pending_shipment és pending státusznál) ──
  const { data: pendingCmrDocs = [], refetch: refetchCmrDocs } = useQuery<TransportDoc[]>({
    queryKey: ['pending-shipment-cmrs', selectedMatch?.invoice_id],
    queryFn: async () => {
      if (!selectedMatch?.invoice_id) return [];
      const { data, error } = await supabase
        .from('transport_documents')
        .select('id, file_name, file_path, position_number, status, linked_shipment_id')
        .eq('linked_invoice_id', selectedMatch.invoice_id)
        .order('position_number');
      if (error) throw error;
      return (data || []) as TransportDoc[];
    },
    enabled: !!selectedMatch?.invoice_id && ['pending_shipment', 'pending'].includes(selectedMatch?.status ?? ''),
    staleTime: 0,
  });


  const handleAcceptMatch = async (match: EscalatedMatch) => {
    setIsActionLoading(true);
    try {
      const { error: matchError } = await supabase.from('shipment_matches').update({ status: 'confirmed' }).eq('id', match.id);
      if (matchError) throw matchError;
      await supabase.from('shipments').update({ match_status: 'matched', matched_invoice_id: match.invoice.id }).eq('id', match.shipment.id);
      await supabase.from('invoices').update({ shipment_match_status: 'matched' }).eq('id', match.invoice.id);
      toast({ title: 'Párosítás elfogadva', description: 'A manuális párosítás rögzítve.' });
      setSelectedMatch(null);
      queryClient.invalidateQueries({ queryKey: ['escalated-matches', selectedCompany?.id] });
      queryClient.invalidateQueries({ queryKey: ['shipments-matching', selectedCompany?.id] });
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Sikertelen mentés', description: err.message });
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleRejectMatch = async (match: EscalatedMatch) => {
    setIsActionLoading(true);
    try {
      const { error: matchError } = await supabase.from('shipment_matches').update({ status: 'rejected' }).eq('id', match.id);
      if (matchError) throw matchError;
      await supabase.from('shipments').update({ match_status: 'unmatched', matched_invoice_id: null }).eq('id', match.shipment.id);
      await supabase.from('invoices').update({ shipment_match_status: 'unmatched' }).eq('id', match.invoice.id);
      toast({ title: 'Párosítás elutasítva', description: 'A javasolt párosítás elutasítva.' });
      setSelectedMatch(null);
      queryClient.invalidateQueries({ queryKey: ['escalated-matches', selectedCompany?.id] });
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Művelet sikertelen', description: err.message });
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleReassignMatch = async (match: EscalatedMatch) => {
    if (!reassignPos.trim()) return;
    setIsActionLoading(true);
    try {
      const { data: newShipment, error: findError } = await supabase
        .from('shipments')
        .select('id, carrier_name')
        .eq('company_id', selectedCompany?.id)
        .eq('position_number', reassignPos.trim())
        .maybeSingle();
      if (findError) throw findError;
      if (!newShipment) {
        toast({ variant: 'destructive', title: 'Pozíció nem található', description: `Nem található „${reassignPos.trim()}" pozíciószám.` });
        setIsActionLoading(false);
        return;
      }
      await supabase.from('shipment_matches').delete().eq('id', match.id);
      const { error: matchError } = await supabase.from('shipment_matches').insert({
        company_id: selectedCompany?.id,
        invoice_id: match.invoice.id,
        shipment_id: (newShipment as any).id,
        match_type: 'manual',
        confidence_score: 100,
        status: 'confirmed',
        match_details: { reassigned_from: match.shipment.position_number },
      });
      if (matchError) throw matchError;
      await supabase.from('shipments').update({ match_status: 'matched', matched_invoice_id: match.invoice.id }).eq('id', (newShipment as any).id);
      await supabase.from('invoices').update({ shipment_match_status: 'matched' }).eq('id', match.invoice.id);
      toast({ title: 'Sikeres átirányítás', description: `Számla hozzárendelve: „${reassignPos.trim()}"` });
      setSelectedMatch(null);
      setReassignPos('');
      setShowReassignInput(false);
      queryClient.invalidateQueries({ queryKey: ['escalated-matches', selectedCompany?.id] });
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Átirányítás sikertelen', description: err.message });
    } finally {
      setIsActionLoading(false);
    }
  };

  // ── Pending shipment manuális hozzárendelés kezelők ─────────────────────────
  const handlePendingManualSearch = async (silent = false) => {
    if (!pendingAssignPos.trim() || !selectedCompany?.id) return;
    setPendingIsSearching(true);
    setPendingFoundShipment(null);
    setPendingShipmentResults([]);
    try {
      const { data } = await supabase
        .from('shipments')
        .select('id, position_number, carrier_name')
        .eq('company_id', selectedCompany.id)
        .ilike('position_number', `%${pendingAssignPos.trim()}%`)
        .limit(6);
      const results = (data ?? []) as { id: string; position_number: string; carrier_name: string | null }[];
      if (results.length === 1) {
        // Single match → auto-select
        setPendingFoundShipment(results[0]);
      } else if (results.length > 1) {
        setPendingShipmentResults(results);
      } else if (!silent) {
        toast({
          variant: 'destructive',
          title: 'Nem található',
          description: `Nincs importált fuvar „${pendingAssignPos.trim()}” pozíciószámmal. Előbb töltsd fel az Excel importot.`,
        });
      }
    } finally {
      setPendingIsSearching(false);
    }
  };

  const handlePendingManualAssign = async (shipment?: { id: string; position_number: string; carrier_name: string | null }) => {
    const target = shipment || pendingFoundShipment;
    if (!target || !selectedMatch) return;
    setPendingIsAssigning(true);
    try {
      // 1. pending_shipment match rekord frissítése → confirmed
      const { error: matchErr } = await supabase
        .from('shipment_matches')
        .update({
          shipment_id: target.id,
          match_type: 'manual',
          confidence_score: 100,
          status: 'confirmed',
          match_details: { manual_assign: true, assigned_position: target.position_number },
          discrepancies: [],
        })
        .eq('id', selectedMatch.id);
      if (matchErr) throw matchErr;

      // 2. Shipment: matched állapotba
      await supabase
        .from('shipments')
        .update({ match_status: 'matched', matched_invoice_id: selectedMatch.invoice_id })
        .eq('id', target.id);

      // 3. Invoice: matched állapotba
      await supabase
        .from('invoices')
        .update({ shipment_match_status: 'matched' })
        .eq('id', selectedMatch.invoice_id);

      // 4. Transport docs: linked_shipment_id beállítása
      await supabase
        .from('transport_documents')
        .update({ linked_shipment_id: target.id })
        .eq('linked_invoice_id', selectedMatch.invoice_id)
        .is('linked_shipment_id', null);

      toast({
        title: 'Párosítás rögzítve',
        description: `Számla sikeresen hozzárendelve: ${target.position_number}`,
      });
      setSelectedMatch(null);
      setPendingAssignPos('');
      setPendingFoundShipment(null);
      setPendingShipmentResults([]);
      queryClient.invalidateQueries({ queryKey: ['escalated-matches', selectedCompany?.id] });
      queryClient.invalidateQueries({ queryKey: ['shipments-matching', selectedCompany?.id] });
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Hozzárendelés sikertelen', description: err.message });
    } finally {
      setPendingIsAssigning(false);
    }
  };


  // CMR search handler
  const handleCmrSearch = async (silent = false) => {
    if (!cmrSearchQuery.trim() || !selectedCompany?.id || !selectedMatch) return;
    setCmrIsSearching(true);
    setCmrSearchResults([]);
    try {
      const q = "%" + cmrSearchQuery.trim() + "%";
      const { data: tdRows } = await supabase
        .from('transport_documents')
        .select('id, file_name, file_path, position_number')
        .eq('company_id', selectedCompany.id)
        .is('linked_invoice_id', null)
        .or("file_name.ilike." + q + ",position_number.ilike." + q)
        .limit(8);
      const { data: upRows } = await supabase
        .from('invoice_uploads')
        .select('id, file_name, metadata')
        .eq('company_id', selectedCompany.id)
        .eq('processing_status', 'cmr_escalated')
        .ilike('file_name', q)
        .limit(8);
      const results: CmrSearchResult[] = [];
      for (const td of tdRows ?? []) {
        results.push({ cmr_id: td.id, upload_id: null, file_name: td.file_name, file_path: td.file_path, position_number: td.position_number, source: 'transport_doc' });
      }
      const existingIds = new Set(results.map(r => r.cmr_id));
      for (const up of upRows ?? []) {
        const cmrId = (up.metadata as any)?.cmr_result?.cmr_id as string | undefined;
        if (cmrId && !existingIds.has(cmrId)) {
          results.push({ cmr_id: cmrId, upload_id: up.id, file_name: up.file_name, file_path: null, position_number: null, source: 'upload' });
        }
      }
      if (results.length === 0 && !silent) {
        toast({ variant: 'destructive', title: 'Nincs találat', description: 'Nem található szabad CMR dokumentum.' });
      }
      setCmrSearchResults(results);
    } finally {
      setCmrIsSearching(false);
    }
  };

  // CMR attach handler
  const handleCmrAttach = async (result: CmrSearchResult) => {
    if (!selectedMatch) return;
    setCmrIsAttaching(result.cmr_id);
    try {
      const { error: tdErr } = await supabase
        .from('transport_documents')
        .update({ linked_invoice_id: selectedMatch.invoice_id, status: 'linked' })
        .eq('id', result.cmr_id);
      if (tdErr) throw tdErr;
      // Always update any matching invoice_uploads (source-agnostic: covers both transport_doc and upload CMRs)
      if (result.upload_id) {
        // Direct match by upload ID (fastest path when CMR came from invoice_uploads search)
        await supabase.from('invoice_uploads').update({ processing_status: 'cmr_attached' }).eq('id', result.upload_id);
      } else {
        // Fallback: find invoice_uploads linked to this transport_document via metadata->cmr_result->cmr_id
        await (supabase as any)
          .from('invoice_uploads')
          .update({ processing_status: 'cmr_attached' })
          .eq('company_id', selectedCompany?.id ?? '')
          .filter('metadata->cmr_result->>cmr_id', 'eq', result.cmr_id);
      }
      toast({ title: 'CMR csatolva', description: result.file_name + ' hozzárendelve.' });
      setCmrSearchQuery('');
      setCmrSearchResults([]);
      queryClient.invalidateQueries({ queryKey: ['pending-shipment-cmrs', selectedMatch.invoice_id] });
      queryClient.invalidateQueries({ queryKey: ['escalated-uploads', selectedCompany?.id] });
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'CMR csatolás sikertelen', description: err.message });
    } finally {
      setCmrIsAttaching(null);
    }
  };

  // CMR detach confirm handler
  const handleCmrDetachConfirm = async () => {
    if (!cmrDetachTarget || !selectedMatch) return;
    setCmrIsDetaching(true);
    try {
      await supabase.from('transport_documents').update({ linked_invoice_id: null, status: 'orphaned' }).eq('id', cmrDetachTarget.id);
      // Fetch matching upload, patch metadata.manual_detach=true to suppress realtime toast
      const { data: uploadRows } = await (supabase as any)
        .from('invoice_uploads')
        .select('id, metadata')
        .eq('company_id', selectedCompany?.id ?? '')
        .filter('metadata->cmr_result->>cmr_id', 'eq', cmrDetachTarget.id);
      for (const uRow of uploadRows ?? []) {
        const mergedMeta = { ...(uRow.metadata ?? {}), manual_detach: true };
        await supabase.from('invoice_uploads').update({ processing_status: 'cmr_escalated', metadata: mergedMeta }).eq('id', uRow.id);
      }
      toast({ title: 'CMR leválasztva', description: cmrDetachTarget.file_name + ' visszakerül az eszkalációba.' });
      setCmrDetachOpen(false);
      setCmrDetachTarget(null);
      queryClient.invalidateQueries({ queryKey: ['pending-shipment-cmrs', selectedMatch.invoice_id] });
      queryClient.invalidateQueries({ queryKey: ['escalated-uploads', selectedCompany?.id] });
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Leválasztás sikertelen', description: err.message });
    } finally {
      setCmrIsDetaching(false);
    }
  };


  // Shipment detach confirm handler (CMR-invoice link stays)
  const handleShipmentDetachConfirm = async () => {
    if (!selectedMatch) return;
    setIsDetachingShipment(true);
    try {
      const prevShipmentId = selectedMatch.shipment_id;
      await (supabase as any).from('shipment_matches').update({ shipment_id: null, status: 'pending_shipment', confidence_score: null, discrepancies: [] }).eq('id', selectedMatch.id);
      if (prevShipmentId) await (supabase as any).from('shipments').update({ match_status: 'unmatched', matched_invoice_id: null }).eq('id', prevShipmentId);
      await supabase.from('invoices').update({ shipment_match_status: 'matched_no_shipment' }).eq('id', selectedMatch.invoice_id);
      await supabase.from('transport_documents').update({ linked_shipment_id: null }).eq('linked_invoice_id', selectedMatch.invoice_id).not('linked_shipment_id', 'is', null);
      toast({ title: 'Fuvarriport leválasztva', description: 'A számla visszakerül a várakozó riport listába.' });
      setShipmentDetachOpen(false);
      setSelectedMatch(null);
      queryClient.invalidateQueries({ queryKey: ['escalated-matches', selectedCompany?.id] });
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Leválasztás sikertelen', description: err.message });
    } finally {
      setIsDetachingShipment(false);
    }
  };

  // Live CMR search — debounced auto-suggest (>=2 chars)
  const [cmrAutoSearchActive, setCmrAutoSearchActive] = useState(false);
  useEffect(() => {
    if (cmrSearchQuery.trim().length < 2) {
      setCmrSearchResults([]);
      return;
    }
    setCmrAutoSearchActive(true);
    const timer = setTimeout(() => {
      handleCmrSearch(true).finally(() => setCmrAutoSearchActive(false)); // silent — no toast on auto-search
    }, 350);
    return () => {
      clearTimeout(timer);
      setCmrAutoSearchActive(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cmrSearchQuery, selectedMatch?.invoice_id]);

  // Live shipment search — debounced auto-suggest (>=2 chars)
  useEffect(() => {
    if (pendingAssignPos.trim().length < 2) {
      setPendingFoundShipment(null);
      setPendingShipmentResults([]);
      return;
    }
    const timer = setTimeout(() => {
      handlePendingManualSearch(true); // silent — no toast on auto-search
    }, 400);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingAssignPos, selectedMatch?.invoice_id]);


  return (
    <>
    <div className="container mx-auto px-4 py-8 page-animate">
      <div className="space-y-6">

        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold">Eszkalációs lista</h1>
          <p className="text-muted-foreground font-medium text-sm">
            Felülvizsgálatra váró számlák, dokumentumok és párosítások — emberi döntés szükséges
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-3">

          {/* ── Left panel ── */}
          <div className="md:col-span-1 space-y-4">
            <Card className="border border-border/50 bg-card shadow-sm h-[calc(100vh-220px)] flex flex-col">
              <CardHeader className="p-4 border-b border-border/40 shrink-0">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-warning" />
                  Összes eszkaláció ({matches.length + escalatedUploads.length} db)
                </CardTitle>
              </CardHeader>
              <CardContent className="p-2 overflow-y-auto flex-1 space-y-1 min-h-0">

                {/* Várakozó futárriport (invoice-first szcenárió) */}
                {matches.filter(m => m.status === 'pending_shipment').length > 0 && (
                  <div className="px-1 pt-2 pb-1">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                      <Clock className="h-3 w-3 text-yellow-500" />
                      Várakozó futárriport ({matches.filter(m => m.status === 'pending_shipment').length})
                    </span>
                  </div>
                )}
                {matches.filter(m => m.status === 'pending_shipment').map((m) => (
                  <div
                    key={m.id}
                    className={`p-3 rounded-lg border text-left cursor-pointer transition-all duration-150 flex items-center justify-between group ${
                      selectedMatch?.id === m.id ? 'border-yellow-500/50 bg-yellow-500/5' : 'border-yellow-500/20 hover:bg-yellow-500/5 hover:border-yellow-500/40'
                    }`}
                    onClick={() => { setSelectedMatch(m); setSelectedUpload(null); setShowReassignInput(false); }}
                  >
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm truncate block">{m.invoice?.bizonylatsorszam}</span>
                        <Badge variant="outline" className="text-[9px] px-1 py-0 border-yellow-500/30 text-yellow-600 bg-yellow-500/10 font-semibold shrink-0">
                          Várakozó riport
                        </Badge>
                      </div>
                      <span className="text-xs text-muted-foreground truncate block">{m.invoice?.elado_nev}</span>
                      <span className="text-[10px] font-mono text-yellow-600 font-semibold block">
                        {(m.invoice?.position_numbers as string[] | null)?.[0] ?? '—'}
                      </span>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-yellow-500 transition-colors shrink-0 ml-2" />
                  </div>
                ))}

                {/* Párosítási eltérések */}
                {(isLoading || matches.filter(m => m.status === 'pending').length > 0) && (
                  <div className="px-1 pt-2 pb-1">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                      <ArrowLeftRight className="h-3 w-3" />
                      Párosítási eltérések ({matches.filter(m => m.status === 'pending').length})
                    </span>
                  </div>
                )}
                {isLoading ? (
                  Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-lg" />)
                ) : (
                  matches.filter(m => m.status === 'pending').map((m) => (
                    <div
                      key={m.id}
                      className={`p-3 rounded-lg border text-left cursor-pointer transition-all duration-150 flex items-center justify-between group ${
                        selectedMatch?.id === m.id ? 'border-primary bg-primary/5' : 'border-border/50 hover:bg-muted/40 hover:border-primary/20'
                      }`}
                      onClick={() => { setSelectedMatch(m); setSelectedUpload(null); setShowReassignInput(false); }}
                    >
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-sm truncate block">{m.invoice.bizonylatsorszam}</span>
                          <Badge variant="outline" className="text-[9px] px-1 py-0 border-destructive/20 text-destructive bg-destructive/5 font-semibold shrink-0">
                            {m.confidence_score}% Match
                          </Badge>
                        </div>
                        <span className="text-xs text-muted-foreground truncate block">{m.invoice.elado_nev}</span>
                        <span className="text-[10px] font-mono text-primary font-semibold block">{m.shipment?.position_number}</span>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors shrink-0 ml-2" />
                    </div>
                  ))
                )}


                {/* Eszkalált dokumentumok */}
                {(uploadsLoading || escalatedUploads.length > 0) && (
                  <div className="px-1 pt-3 pb-1">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                      <FileText className="h-3 w-3" />
                      Eszkalált dokumentumok ({escalatedUploads.length})
                    </span>
                  </div>
                )}
                {uploadsLoading ? (
                  Array.from({ length: 2 }).map((_, i) => <Skeleton key={`u-${i}`} className="h-14 w-full rounded-lg" />)
                ) : (
                  escalatedUploads.map((u) => (
                    <div
                      key={u.id}
                      className={`p-3 rounded-lg border text-left cursor-pointer transition-all duration-150 flex items-center justify-between group ${
                        selectedUpload?.id === u.id ? 'border-warning bg-warning/5' : 'border-border/50 hover:bg-muted/40 hover:border-warning/20'
                      }`}
                      onClick={() => { setSelectedUpload(u); setSelectedMatch(null); setShowReassignInput(false); }}
                    >
                      <div className="min-w-0 flex-1 space-y-0.5">
                        <span className="font-semibold text-sm truncate block">{u.file_name}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-muted-foreground">{(u.file_size / 1024).toFixed(0)} KB</span>
                          <Badge variant="outline" className="text-[9px] px-1 py-0 border-warning/30 text-warning bg-warning/5 font-semibold">Eszkaláció</Badge>
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-warning transition-colors shrink-0 ml-2" />
                    </div>
                  ))
                )}

                {/* Empty state */}
                {!isLoading && !uploadsLoading && matches.length === 0 && escalatedUploads.length === 0 && (
                  <div className="text-center text-sm text-muted-foreground italic py-10 flex flex-col items-center justify-center gap-2">
                    <Inbox className="h-8 w-8 text-muted-foreground" />
                    Nincs felülvizsgálandó tétel.
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* ── Right panel ── */}
          <div className="md:col-span-2">
            {selectedUpload && selectedCompany ? (
              <EscalatedUploadDetail
                upload={selectedUpload}
                companyId={selectedCompany.id}
                onResolved={() => setSelectedUpload(null)}
              />
            ) : selectedMatch ? (
              selectedMatch.status === 'pending_shipment' ? (
                // ── Várakozó futárriport panel ──
                <Card className="border border-yellow-500/30 bg-card shadow-sm h-[calc(100vh-220px)] flex flex-col overflow-hidden">
                  <CardHeader className="p-5 border-b border-yellow-500/20 shrink-0">
                    <div className="flex justify-between items-start gap-4">
                      <div>
                        <CardTitle className="text-lg font-bold flex items-center gap-2">
                          <Clock className="h-5 w-5 text-yellow-500" />
                          Várakozó futárriport
                        </CardTitle>
                        <CardDescription>A számla feldolgozva, de a Selexped import még nem érkezett be</CardDescription>
                      </div>
                      <Badge className="bg-yellow-500/10 text-yellow-600 border-yellow-500/30 font-semibold shrink-0">
                        Várakozó riport
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="p-6 flex-1 overflow-y-auto space-y-6">
                    {/* Invoice details */}
                    <div className="border border-border/40 p-4 rounded-lg bg-muted/10 space-y-4">
                      <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5 border-b pb-2">
                        <FileText className="h-4 w-4 text-info" /> Számla Adatok (OCR)
                      </h4>
                      <div className="space-y-3 text-xs">
                        <div>
                          <span className="text-muted-foreground font-semibold">Számlaszám</span>
                          {(selectedMatch.invoice?.melleklet_url || selectedMatch.invoice?.image_url) ? (
                            <p
                              className="font-bold text-primary mt-0.5 cursor-pointer hover:underline flex items-center gap-1 w-fit"
                              onClick={() => openDocViewer(
                                selectedMatch.invoice?.melleklet_url || selectedMatch.invoice?.image_url,
                                selectedMatch.invoice?.bizonylatsorszam ?? 'Számla'
                              )}
                              title="Számla megnyitása"
                            >
                              {selectedMatch.invoice?.bizonylatsorszam}
                              <ExternalLink className="h-3 w-3 opacity-60" />
                            </p>
                          ) : (
                            <p className="font-bold text-foreground mt-0.5">{selectedMatch.invoice?.bizonylatsorszam}</p>
                          )}
                        </div>
                        <div><span className="text-muted-foreground font-semibold">Partner</span><p className="font-bold text-foreground mt-0.5">{selectedMatch.invoice?.elado_nev}</p></div>
                        <div><span className="text-muted-foreground font-semibold">Összeg</span><p className="font-mono font-bold text-foreground mt-0.5">{formatCurrency(selectedMatch.invoice?.brutto_vegosszeg, selectedMatch.invoice?.penznem)}</p></div>
                        <div><span className="text-muted-foreground font-semibold">Keresett pozíciószám</span>
                          <p className="font-mono font-bold text-yellow-600 mt-0.5">
                            {(selectedMatch.invoice?.position_numbers as string[] | null)?.join(', ') ?? '—'}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* CMR dokumentumok */}
                    <div className="border border-border/40 p-4 rounded-lg bg-muted/10 space-y-3">
                      <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5 border-b pb-2">
                        <FileText className="h-4 w-4 text-emerald-500" /> Csatolt CMR dokumentumok
                        <span className="ml-auto font-normal text-[10px] bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 rounded px-1.5 py-0.5">
                          {pendingCmrDocs.length} db
                        </span>
                      </h4>
                      {pendingCmrDocs.length === 0 ? (
                        <p className="text-xs text-muted-foreground italic">Nincs csatolt CMR dokumentum</p>
                      ) : (
                        <div className="space-y-2">
                          {pendingCmrDocs.map((doc) => (
                            <div key={doc.id} className="flex items-center justify-between gap-2 p-2 rounded bg-card border border-border/30 text-xs transition-colors hover:border-border/60">
                              <div
                                className={`flex items-center gap-2 min-w-0 flex-1 ${doc.file_path ? 'cursor-pointer' : ''}`}
                                onClick={() => doc.file_path && openDocViewer(doc.file_path, doc.file_name)}
                                title={doc.file_path ? 'Dokumentum megnyitasa' : ''}
                              >
                                <FileText className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                                <span className={`font-semibold truncate ${doc.file_path ? 'text-emerald-600 hover:underline' : ''}`}>{doc.file_name}</span>
                                {doc.position_number && <span className="font-mono text-[10px] text-muted-foreground shrink-0">{doc.position_number}</span>}
                                {doc.file_path && <ExternalLink className="h-3 w-3 text-muted-foreground opacity-50 shrink-0" />}
                              </div>
                              <div className="flex items-center gap-1.5 shrink-0">
                                <Badge variant="outline" className="text-[9px] px-1 py-0 border-emerald-500/30 text-emerald-600 bg-emerald-500/10 font-semibold">CMR csatolva</Badge>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 px-1.5 text-[10px] text-destructive hover:text-destructive hover:bg-destructive/10"
                                  onClick={(e) => { e.stopPropagation(); setCmrDetachTarget(doc); setCmrDetachOpen(true); }}
                                  title="CMR levalasztasa"
                                >
                                  <Unlink className="h-3 w-3 mr-0.5" /> Leválaszt
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                      {/* CMR hozzacsatolas keresobar */}
                      <div className="border-t border-border/30 pt-3 space-y-2">
                        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                          <Link className="h-3 w-3" /> CMR dokumentum csatolása
                        </span>
                        <div className="flex gap-2">
                          <Input
                            placeholder="Fájlnév vagy pozíciószám..."
                            value={cmrSearchQuery}
                            onChange={(e) => { setCmrSearchQuery(e.target.value); setCmrSearchResults([]); }}
                            onKeyDown={(e) => e.key === 'Enter' && handleCmrSearch()}
                            className="bg-card font-mono text-xs h-8"
                          />
                          <Button size="sm" variant="outline" className="h-8 px-3" onClick={handleCmrSearch} disabled={cmrIsSearching || cmrAutoSearchActive || !cmrSearchQuery.trim()}>
                            {(cmrIsSearching || cmrAutoSearchActive) ? <span className="h-3 w-3 rounded-full border-2 border-primary border-t-transparent animate-spin" /> : <Search className="h-3 w-3" />}
                          </Button>
                        </div>
                        {cmrSearchResults.length > 0 && (
                          <div className="space-y-1.5 max-h-48 overflow-y-auto">
                            {cmrSearchResults.map((r) => (
                              <div key={r.cmr_id} className="flex items-center justify-between gap-2 p-2 rounded bg-card border border-border/40 text-xs">
                                <div className="flex items-center gap-2 min-w-0">
                                  <FileText className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                                  <div className="min-w-0">
                                    <p className="font-semibold truncate">{r.file_name}</p>
                                    {r.position_number && <p className="font-mono text-[10px] text-muted-foreground">{r.position_number}</p>}
                                    <p className="text-[9px] text-muted-foreground">{r.source === 'upload' ? 'Eszkalált CMR' : 'Feldolgozott CMR'}</p>
                                  </div>
                                </div>
                                <Button
                                  size="sm"
                                  className="h-6 px-2 text-[10px] shrink-0 bg-emerald-600 hover:bg-emerald-700"
                                  onClick={() => handleCmrAttach(r)}
                                  disabled={cmrIsAttaching === r.cmr_id}
                                >
                                  {cmrIsAttaching === r.cmr_id ? <span className="h-3 w-3 rounded-full border-2 border-white border-t-transparent animate-spin" /> : 'Csatolás'}
                                </Button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Waiting state info */}
                    <div className="bg-yellow-500/5 border border-yellow-500/20 rounded-lg p-4 flex items-start gap-3">
                      <Clock className="h-5 w-5 text-yellow-500 shrink-0 mt-0.5" />
                      <div className="space-y-1">
                        <span className="font-bold text-sm block text-yellow-600">Selexped Excel import szükséges</span>
                        <p className="text-xs text-muted-foreground">
                          A számla sikeresen feldolgozva és a pozíciószám kinyerve. Amint az Excel import megtörténik,
                          a rendszer automatikusan párosítja a fuvarral.
                        </p>
                        {selectedMatch.discrepancies?.length > 0 && (
                          <ul className="list-disc pl-4 text-xs text-yellow-700 mt-2 space-y-0.5">
                            {selectedMatch.discrepancies.map((d, i) => <li key={i}>{d}</li>)}
                          </ul>
                        )}
                      </div>
                    </div>

                    {/* Manuális hozzárendelés fuvarhoz */}
                    <div className="border border-border/40 p-4 rounded-lg bg-muted/10 space-y-3">
                      <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                        <Link className="h-3.5 w-3.5" />
                        Manuális hozzárendelés importált fuvarhoz
                      </h4>
                      <p className="text-[11px] text-muted-foreground">
                        Ha már feltöltötted az Excel importot, keresd meg a fuvarrekordot pozíciószám alapján és rendeld hozzá manuálisan.
                      </p>
                      <div className="flex gap-2">
                        <Input
                          placeholder="Pozíciószám (pl. E/2627512, B/1234567...)"
                          value={pendingAssignPos}
                          onChange={(e) => {
                             setPendingAssignPos(e.target.value);
                             setPendingFoundShipment(null);
                             setPendingShipmentResults([]);
                           }}
                          onKeyDown={(e) => { if (e.key === 'Enter') handlePendingManualSearch(); }}
                          className="bg-card font-mono text-sm h-9"
                        />
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-9 shrink-0"
                          onClick={handlePendingManualSearch}
                          disabled={pendingIsSearching || !pendingAssignPos.trim()}
                        >
                          {pendingIsSearching ? (
                            <span className="h-3.5 w-3.5 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                          ) : (
                            <Search className="h-3.5 w-3.5" />
                          )}
                        </Button>
                      </div>

                      {/* Talált fuvar preview */}
                      {pendingFoundShipment && (
                        <div className="rounded-lg border border-success/30 bg-success/5 p-3 flex items-center justify-between gap-3 animate-in slide-in-from-top-1 duration-200">
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-1.5">
                              <CheckCircle2 className="h-3.5 w-3.5 text-success" />
                              <span className="font-bold text-xs font-mono text-foreground">{pendingFoundShipment.position_number}</span>
                            </div>
                            {pendingFoundShipment.carrier_name && (
                              <p className="text-[11px] text-muted-foreground pl-5">{pendingFoundShipment.carrier_name}</p>
                            )}
                          </div>
                          <Button
                            size="sm"
                            className="bg-success hover:bg-success/90 text-success-foreground h-8 shrink-0"
                            onClick={() => handlePendingManualAssign()}

                            disabled={pendingIsAssigning}
                          >
                            {pendingIsAssigning ? (
                              <span className="h-3 w-3 rounded-full border-2 border-white border-t-transparent animate-spin mr-1.5" />
                            ) : (
                              <Check className="h-3.5 w-3.5 mr-1.5" />
                            )}
                            Párosítás rögzítése
                          </Button>
                        </div>
                      )}

                      {/* Több találat esetén selectable lista */}
                      {pendingShipmentResults.length > 1 && (
                        <div className="space-y-1.5 max-h-44 overflow-y-auto">
                          <p className="text-[10px] text-muted-foreground font-medium">{pendingShipmentResults.length} találat — válaszd ki a megfelelőt:</p>
                          {pendingShipmentResults.map((s) => (
                            <div
                              key={s.id}
                              className="flex items-center justify-between gap-2 p-2 rounded-lg border border-border/40 bg-card text-xs hover:border-primary/30 hover:bg-primary/5 transition-colors cursor-pointer"
                              onClick={() => { setPendingFoundShipment(s); setPendingShipmentResults([]); }}
                            >
                              <div className="space-y-0.5 min-w-0">
                                <p className="font-bold font-mono text-foreground">{s.position_number}</p>
                                {s.carrier_name && <p className="text-muted-foreground truncate">{s.carrier_name}</p>}
                              </div>
                              <Check className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                            </div>
                          ))}
                        </div>
                      )}

                    {/* Shipment levalasztas (csak ha van mar rendelt fuvar) */}
                    {selectedMatch.shipment_id && (
                      <div className="border border-destructive/20 bg-destructive/5 rounded-lg p-3 flex items-center justify-between gap-3">
                        <div className="space-y-0.5">
                          <span className="text-xs font-bold text-destructive flex items-center gap-1.5">
                            <Unlink className="h-3.5 w-3.5" /> Hozzárendelt fuvar leválasztása
                          </span>
                          <p className="text-[11px] text-muted-foreground">A CMR-számla kapcsolat megmarad, csak a fuvarriport kapcs. törlődik.</p>
                        </div>
                        <Button
                          variant="destructive"
                          size="sm"
                          className="h-8 shrink-0"
                          onClick={() => setShipmentDetachOpen(true)}
                          disabled={isDetachingShipment}
                        >
                          <Unlink className="h-3.5 w-3.5 mr-1.5" /> Leválaszt
                        </Button>
                      </div>
                    )}
                    </div>
                  </CardContent>
                </Card>

              ) : (
              // ── Párosítás összehasonlító panel ──
              <Card className="border border-border/50 bg-card shadow-sm h-[calc(100vh-220px)] flex flex-col overflow-hidden">
                <CardHeader className="p-5 border-b border-border/40 shrink-0">
                  <div className="flex justify-between items-start gap-4">
                    <div>
                      <CardTitle className="text-lg font-bold">Összehasonlító panel</CardTitle>
                      <CardDescription>Vizsgáld meg az eltéréseket a számla és a Selexped kalkuláció között</CardDescription>
                    </div>
                    <Badge className="bg-warning/10 text-warning border-warning/20 font-semibold shrink-0">
                      Felülvizsgálat szükséges
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="p-6 flex-1 overflow-y-auto space-y-6">
                  {/* Discrepancies Alert */}
                  {selectedMatch.discrepancies?.length > 0 && (
                    <div className="bg-destructive/5 border border-destructive/10 text-destructive p-4 rounded-lg flex items-start gap-3">
                      <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
                      <div className="space-y-1">
                        <span className="font-bold text-sm block">Detektált eltérések</span>
                        <ul className="list-disc pl-4 text-xs font-semibold space-y-1">
                          {selectedMatch.discrepancies.map((d, i) => <li key={i}>{d}</li>)}
                        </ul>
                      </div>
                    </div>
                  )}


                  {/* CMR dokumentumok a pending szamlához */}
                  <div className="border border-border/40 p-4 rounded-lg bg-muted/10 space-y-3">
                    <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5 border-b pb-2">
                      <FileText className="h-4 w-4 text-emerald-500" /> Csatolt CMR dokumentumok
                      <span className="ml-auto font-normal text-[10px] bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 rounded px-1.5 py-0.5">
                        {pendingCmrDocs.length} db
                      </span>
                    </h4>
                    {pendingCmrDocs.length === 0 ? (
                      <p className="text-xs text-muted-foreground italic">Nincs csatolt CMR dokumentum</p>
                    ) : (
                      <div className="space-y-2">
                        {pendingCmrDocs.map((doc) => (
                          <div key={doc.id} className="flex items-center justify-between gap-2 p-2 rounded bg-card border border-border/30 text-xs transition-colors hover:border-border/60">
                            <div
                              className={`flex items-center gap-2 min-w-0 flex-1 ${doc.file_path ? 'cursor-pointer' : ''}`}
                              onClick={() => doc.file_path && openDocViewer(doc.file_path, doc.file_name)}
                            >
                              <FileText className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                              <span className={`font-semibold truncate ${doc.file_path ? 'text-emerald-600 hover:underline' : ''}`}>{doc.file_name}</span>
                              {doc.position_number && <span className="font-mono text-[10px] text-muted-foreground shrink-0">{doc.position_number}</span>}
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <Badge variant="outline" className="text-[9px] px-1 py-0 border-emerald-500/30 text-emerald-600 bg-emerald-500/10 font-semibold">CMR csatolva</Badge>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 px-1.5 text-[10px] text-destructive hover:text-destructive hover:bg-destructive/10"
                                onClick={(e) => { e.stopPropagation(); setCmrDetachTarget(doc); setCmrDetachOpen(true); }}
                              >
                                <Unlink className="h-3 w-3 mr-0.5" /> Leválaszt
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    {/* CMR csatolas kereso */}
                    <div className="border-t border-border/30 pt-3 space-y-2">
                      <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                        <Link className="h-3 w-3" /> CMR dokumentum csatolása
                      </span>
                      <div className="flex gap-2">
                        <Input
                          placeholder="Fájlnév vagy pozíciószám..."
                          value={cmrSearchQuery}
                          onChange={(e) => { setCmrSearchQuery(e.target.value); setCmrSearchResults([]); }}
                          onKeyDown={(e) => e.key === 'Enter' && handleCmrSearch()}
                          className="bg-card font-mono text-xs h-8"
                        />
                        <Button size="sm" variant="outline" className="h-8 px-3" onClick={handleCmrSearch} disabled={cmrIsSearching || cmrAutoSearchActive || !cmrSearchQuery.trim()}>
                          {(cmrIsSearching || cmrAutoSearchActive) ? <span className="h-3 w-3 rounded-full border-2 border-primary border-t-transparent animate-spin" /> : <Search className="h-3 w-3" />}
                        </Button>
                      </div>
                      {cmrSearchResults.length > 0 && (
                        <div className="space-y-1.5 max-h-40 overflow-y-auto">
                          {cmrSearchResults.map((r) => (
                            <div key={r.cmr_id} className="flex items-center justify-between gap-2 p-2 rounded bg-card border border-border/40 text-xs">
                              <div className="flex items-center gap-2 min-w-0">
                                <FileText className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                                <div className="min-w-0">
                                  <p className="font-semibold truncate">{r.file_name}</p>
                                  {r.position_number && <p className="font-mono text-[10px] text-muted-foreground">{r.position_number}</p>}
                                </div>
                              </div>
                              <Button size="sm" className="h-6 px-2 text-[10px] shrink-0 bg-emerald-600 hover:bg-emerald-700" onClick={() => handleCmrAttach(r)} disabled={cmrIsAttaching === r.cmr_id}>
                                {cmrIsAttaching === r.cmr_id ? <span className="h-3 w-3 rounded-full border-2 border-white border-t-transparent animate-spin" /> : 'Csatolás'}
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  {/* Comparison Grid */}
                  <div className="grid md:grid-cols-7 gap-4 items-stretch">
                    <div className="md:col-span-3 border border-border/40 p-4 rounded-lg bg-muted/10 space-y-4">
                      <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5 border-b pb-2">
                        <FileText className="h-4 w-4 text-info" /> Számla Adatok (OCR)
                      </h4>
                      <div className="space-y-3 text-xs">
                        <div><span className="text-muted-foreground font-semibold">Számlaszám</span><p className="font-bold text-foreground mt-0.5">{selectedMatch.invoice.bizonylatsorszam}</p></div>
                        <div><span className="text-muted-foreground font-semibold">Partner</span><p className="font-bold text-foreground mt-0.5">{selectedMatch.invoice.elado_nev}</p></div>
                        <div><span className="text-muted-foreground font-semibold">Összeg</span><p className="font-mono font-bold text-foreground mt-0.5">{formatCurrency(selectedMatch.invoice.brutto_vegosszeg, selectedMatch.invoice.penznem)}</p></div>
                        <div><span className="text-muted-foreground font-semibold">Dátum</span><p className="font-bold text-foreground mt-0.5">{selectedMatch.invoice.kibocsatas_datuma ? format(new Date(selectedMatch.invoice.kibocsatas_datuma), 'yyyy. MM. dd.') : '—'}</p></div>
                      </div>
                    </div>
                    <div className="md:col-span-1 flex md:flex-col items-center justify-center gap-2 py-4">
                      <div className="h-px w-8 md:h-8 md:w-px bg-border/60" />
                      <ArrowLeftRight className="h-5 w-5 text-muted-foreground" />
                      <div className="h-px w-8 md:h-8 md:w-px bg-border/60" />
                    </div>
                    <div className="md:col-span-3 border border-border/40 p-4 rounded-lg bg-muted/10 space-y-4">
                      <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5 border-b pb-2">
                        <Truck className="h-4 w-4 text-primary" /> Selexped Kalkuláció
                      </h4>
                      <div className="space-y-3 text-xs">
                        <div><span className="text-muted-foreground font-semibold">Pozíciószám</span><p className="font-mono font-bold text-primary mt-0.5">{selectedMatch.shipment?.position_number ?? '—'}</p></div>
                        <div><span className="text-muted-foreground font-semibold">Fuvaros</span><p className="font-bold text-foreground mt-0.5">{selectedMatch.shipment?.carrier_name || '—'}</p></div>
                        <div>
                          <span className="text-muted-foreground font-semibold">Kalkulált összeg</span>
                          <p className="font-mono font-bold text-foreground mt-0.5">
                            {selectedMatch.invoice.penznem === 'EUR'
                              ? selectedMatch.shipment?.calculated_amount_eur !== null ? formatCurrency(Math.abs(selectedMatch.shipment?.calculated_amount_eur), 'EUR') : '—'
                              : selectedMatch.shipment?.calculated_amount_huf !== null ? formatCurrency(Math.abs(selectedMatch.shipment?.calculated_amount_huf), 'HUF') : '—'}
                          </p>
                        </div>
                        <div><span className="text-muted-foreground font-semibold">Lerakás</span><p className="font-bold text-foreground mt-0.5">{selectedMatch.shipment?.delivery_date ? format(new Date(selectedMatch.shipment.delivery_date), 'yyyy. MM. dd.') : '—'}</p></div>
                      </div>
                    </div>
                  </div>

                  {/* Reassign */}
                  {showReassignInput && (
                    <div className="border border-primary/20 bg-primary/5 p-4 rounded-lg space-y-3 animate-in slide-in-from-top-2 duration-200">
                      <span className="text-xs font-bold text-primary flex items-center gap-1.5">
                        <Link className="h-4 w-4" /> Számla átirányítása másik pozícióra
                      </span>
                      <div className="flex gap-2">
                        <Input placeholder="Új pozíciószám (pl. B/2627471)..." value={reassignPos} onChange={(e) => setReassignPos(e.target.value)} className="bg-card font-mono" />
                        <Button size="sm" onClick={() => handleReassignMatch(selectedMatch)} disabled={isActionLoading}>Hozzárendelés</Button>
                        <Button size="sm" variant="ghost" onClick={() => setShowReassignInput(false)}>Mégse</Button>
                      </div>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex flex-wrap gap-2 pt-4 border-t justify-end">
                    <Button variant="outline" className="border-primary/30 hover:bg-primary/10 text-primary" onClick={() => setShowReassignInput(true)} disabled={isActionLoading}>
                      <Link className="h-4 w-4 mr-2" /> Másik fuvarhoz rendelés
                    </Button>
                    <Button variant="outline" className="border-destructive/30 hover:bg-destructive/10 text-destructive" onClick={() => handleRejectMatch(selectedMatch)} disabled={isActionLoading}>
                      <X className="h-4 w-4 mr-2" /> Párosítás elutasítása
                    </Button>
                    <Button className="bg-success hover:bg-success/90 text-success-foreground" onClick={() => handleAcceptMatch(selectedMatch)} disabled={isActionLoading}>
                      <Check className="h-4 w-4 mr-2" /> Elfogadás (manuális match)
                    </Button>
                  </div>
                </CardContent>
              </Card>
              )

            ) : (
              <Card className="border border-border/50 bg-card shadow-sm h-[calc(100vh-220px)] flex flex-col justify-center items-center text-center p-10">
                <HelpCircle className="h-16 w-16 text-muted-foreground mb-4" />
                <h3 className="text-lg font-bold">Válassz ki egy eszkalált tételt</h3>
                <p className="text-muted-foreground text-sm max-w-sm mt-1">
                  A bal oldali listából válaszd ki a felülvizsgálandó dokumentumot vagy párosítást.
                </p>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>


    {/* CMR levalasztas megerosito dialog */}
    <AlertDialog open={cmrDetachOpen && !!cmrDetachTarget} onOpenChange={(open) => { if (!open) { setCmrDetachOpen(false); setCmrDetachTarget(null); } }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>CMR dokumentum leválasztása</AlertDialogTitle>
          <AlertDialogDescription>
            Biztosan leválasztod a <strong>{cmrDetachTarget?.file_name}</strong> dokumentumot erről a számláról?
            A CMR visszakerül az eszkalált dokumentumok közé.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={cmrIsDetaching}>Megse</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive hover:bg-destructive/90"
            onClick={handleCmrDetachConfirm}
            disabled={cmrIsDetaching}
          >
            {cmrIsDetaching ? <span className="h-3 w-3 rounded-full border-2 border-white border-t-transparent animate-spin mr-1.5" /> : null}
            Levalaszt
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>

    {/* Shipment levalasztas megerosito dialog */}
    <AlertDialog open={shipmentDetachOpen} onOpenChange={(open) => { if (!open) setShipmentDetachOpen(false); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Fuvarriport leválasztása</AlertDialogTitle>
          <AlertDialogDescription>
            Biztosan leválasztod a hozzárendelt fuvarriportot erről a számláról?
            A számla visszakerül a várakozó riport állapotba. A CMR-számla kapcsolat megmarad.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDetachingShipment}>Megse</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive hover:bg-destructive/90"
            onClick={handleShipmentDetachConfirm}
            disabled={isDetachingShipment}
          >
            {isDetachingShipment ? <span className="h-3 w-3 rounded-full border-2 border-white border-t-transparent animate-spin mr-1.5" /> : null}
            Levalaszt
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    {/* ── Dokumentum néző modal ── */}
    <InvoiceImageDialog
      invoice={docViewerInvoice}
      open={docViewerOpen}
      onClose={() => { setDocViewerOpen(false); setDocViewerInvoice(null); }}
    />
    </>
  );
}
