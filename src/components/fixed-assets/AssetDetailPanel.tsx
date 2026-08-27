import { useState, useEffect, lazy, Suspense, useRef } from 'react';
import { format } from 'date-fns';
import { hu } from 'date-fns/locale';
import { formatCurrency } from '@/lib/utils';
import { DepreciationCards } from './DepreciationCards';
import type { FixedAsset, AssetEvent } from '@/types/fixed-assets';
import { ASSET_STATUS_LABELS, ASSET_STATUS_COLORS } from '@/types/fixed-assets';
import { QrCode, FileText, ShieldCheck, ArrowRightLeft, Trash2, PlusCircle, CheckCircle, Upload, ExternalLink, Loader2, ShieldOff, Receipt, FolderKanban } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { reportError } from '@/lib/errorReporter';

// Lazy-load dialogs so they don't bloat the initial page chunk
const TransferDialog = lazy(() => import('./TransferDialog').then(m => ({ default: m.TransferDialog })));
const ReactivationDialog = lazy(() => import('./ReactivationDialog').then(m => ({ default: m.ReactivationDialog })));
const DisposalDialog = lazy(() => import('./DisposalDialog').then(m => ({ default: m.DisposalDialog })));
const QrLabelDialog = lazy(() => import('./QrLabelDialog').then(m => ({ default: m.QrLabelDialog })));

function parseLocalDate(ymdStr: string): Date {
  const parts = ymdStr.split('-');
  const y = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10) - 1; // 0-indexed
  const d = parseInt(parts[2], 10);
  return new Date(y, m, d);
}

interface AssetDetailPanelProps {
  asset: FixedAsset;
  events: AssetEvent[];
}

const EVENT_ICONS: Record<string, React.ReactNode> = {
  activation: <CheckCircle className="h-3.5 w-3.5 text-success" />,
  inventory_check: <ShieldCheck className="h-3.5 w-3.5 text-primary" />,
  transfer: <ArrowRightLeft className="h-3.5 w-3.5 text-info" />,
  project_transfer: <FolderKanban className="h-3.5 w-3.5 text-indigo-500" />,
  reactivation: <PlusCircle className="h-3.5 w-3.5 text-warning" />,
  disposal: <Trash2 className="h-3.5 w-3.5 text-destructive" />,
  value_change: <PlusCircle className="h-3.5 w-3.5 text-warning" />,
  document_upload: <Upload className="h-3.5 w-3.5 text-muted-foreground" />,
  performance_log: <PlusCircle className="h-3.5 w-3.5 text-success" />,
};

const EVENT_LABELS: Record<string, string> = {
  activation: 'Aktiválás',
  inventory_check: 'Leltár - Fellelve',
  transfer: 'Áthelyezés',
  project_transfer: 'Projekt hozzárendelés',
  reactivation: 'Ráaktiválás',
  disposal: 'Kivezetés',
  value_change: 'Értékváltozás',
  document_upload: 'Dokumentum feltöltés',
  performance_log: 'Teljesítmény rögzítés',
};

export function AssetDetailPanel({ asset, events }: AssetDetailPanelProps) {
  const [transferOpen, setTransferOpen] = useState(false);
  const [reactivationOpen, setReactivationOpen] = useState(false);
  const [disposalOpen, setDisposalOpen] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [sourceInvoiceUrl, setSourceInvoiceUrl] = useState<string | null>(null);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [uploadCategory, setUploadCategory] = useState<'invoice' | 'warranty'>('invoice');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const { user } = useAuth();

  // Performance Log States
  const [perfOpen, setPerfOpen] = useState(false);
  const [perfDate, setPerfDate] = useState('');
  const [perfAmount, setPerfAmount] = useState('');
  const [perfCumulative, setPerfCumulative] = useState('');
  const [submittingPerf, setSubmittingPerf] = useState(false);

  const handleSavePerf = async () => {
    if (!user?.id || !perfAmount) return;
    setSubmittingPerf(true);
    
    try {
      const periodAmount = parseFloat(perfAmount);
      const cumulativeValue = perfCumulative ? parseFloat(perfCumulative) : null;
      
      const depreciableBase = Math.max(0, asset.acquisition_value - asset.residual_value);
      const planned = Number(asset.total_planned_performance) || 1;
      const calculatedDep = Math.round(depreciableBase * (periodAmount / planned));

      const { error } = await supabase.from('asset_events').insert({
        asset_id: asset.id,
        company_id: asset.company_id,
        user_id: user.id,
        event_type: 'performance_log',
        event_date: perfDate,
        description: `Teljesítmény: ${periodAmount.toLocaleString('hu-HU')} ${asset.performance_unit} (+${calculatedDep.toLocaleString('hu-HU')} Ft ÉCS)`,
        new_values: {
          period_performance: periodAmount,
          cumulative_reading: cumulativeValue,
          calculated_depreciation: calculatedDep,
        }
      });

      if (error) throw error;

      toast({ title: 'Teljesítmény sikeresen rögzítve' });
      setPerfOpen(false);
      
      queryClient.invalidateQueries({ queryKey: ['fixedAssets', asset.company_id] });
      queryClient.invalidateQueries({ queryKey: ['fixedAssetDetail', asset.id] });
      queryClient.invalidateQueries({ queryKey: ['fixed-asset-detail', asset.id] });
    } catch (err: any) {
      toast({ title: 'Hiba a mentés során', description: err.message, variant: 'destructive' });
    } finally {
      setSubmittingPerf(false);
    }
  };

  const isActive = asset.status === 'active';

  // Fetch source invoice PDF URL
  useEffect(() => {
    setSourceInvoiceUrl(null);
    if (!asset.source_invoice_id || !asset.source_invoice_type) return;

    if (asset.source_invoice_type === 'submitted') {
      (async () => {
        const { data } = await supabase
          .from('invoices')
          .select('image_url, melleklet_url')
          .eq('id', asset.source_invoice_id!)
          .maybeSingle();
        if (data?.image_url) setSourceInvoiceUrl(data.image_url);
        else if (data?.melleklet_url) setSourceInvoiceUrl(data.melleklet_url);
      })();
    }
  }, [asset.source_invoice_id, asset.source_invoice_type]);

  // Trigger file picker after category is selected
  const startUpload = (category: 'invoice' | 'warranty') => {
    setUploadCategory(category);
    setUploadModalOpen(false);
    // Slight delay so the modal closes before file picker opens
    setTimeout(() => fileInputRef.current?.click(), 100);
  };

  // Handle document upload with category
  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const maxSize = 10 * 1024 * 1024; // 10 MB
    if (file.size > maxSize) {
      toast({ title: 'A fájl mérete meghaladja a 10MB korlátot', variant: 'destructive' });
      return;
    }

    setUploading(true);
    try {
      const storagePath = `${asset.company_id}/${asset.id}/${Date.now()}-${file.name}`;

      const { error: uploadError } = await supabase.storage
        .from('asset-documents')
        .upload(storagePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('asset-documents')
        .getPublicUrl(storagePath);

      // type = 'invoice' or 'warranty' based on selected category
      const newDoc = { name: file.name, url: publicUrl, type: uploadCategory };
      const updatedDocs = [...(asset.documents || []), newDoc];

      const { error: dbError } = await supabase
        .from('fixed_assets')
        .update({ documents: updatedDocs })
        .eq('id', asset.id);

      if (dbError) throw dbError;

      const label = uploadCategory === 'warranty' ? 'Garanciajegy' : 'Számla';
      toast({ title: `${label} feltöltve`, description: file.name });

      // Record event in asset timeline
      if (user?.id) {
        await supabase.from('asset_events').insert({
          asset_id: asset.id,
          company_id: asset.company_id,
          user_id: user.id,
          event_type: 'document_upload',
          event_date: new Date().toISOString().slice(0, 10),
          description: `${label}: ${file.name}`,
        });
      }

      queryClient.invalidateQueries({ queryKey: ['fixed-asset-detail', asset.id] });
    } catch (err: any) {
      reportError({ type: 'db_query', component: 'AssetDetailPanel', action: 'error', message: 'Upload error:', error: err });
      toast({ title: 'Hiba a feltöltés során', description: err.message, variant: 'destructive' });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Handle document delete
  const handleDeleteDoc = async (docIndex: number) => {
    const doc = asset.documents[docIndex];
    try {
      // Try to extract storage path from public URL for deletion
      const urlParts = doc.url.split('/asset-documents/');
      if (urlParts[1]) {
        await supabase.storage.from('asset-documents').remove([urlParts[1]]);
      }

      const updatedDocs = asset.documents.filter((_: any, i: number) => i !== docIndex);
      const { error } = await supabase
        .from('fixed_assets')
        .update({ documents: updatedDocs })
        .eq('id', asset.id);

      if (error) throw error;

      toast({ title: 'Dokumentum törölve' });
      queryClient.invalidateQueries({ queryKey: ['fixed-asset-detail', asset.id] });
    } catch (err: any) {
      toast({ title: 'Hiba a törlés során', description: err.message, variant: 'destructive' });
    }
  };

  return (
    <div className="h-full overflow-y-auto overflow-x-hidden p-5 space-y-6 min-w-0">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="text-xl font-bold break-words">{asset.name}</h2>
          <p className="text-sm font-mono text-muted-foreground">({asset.inventory_number})</p>
        </div>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2 shrink-0" onClick={() => setQrOpen(true)}>
                <QrCode className="h-4 w-4" />
                Címke QR
              </Button>
            </TooltipTrigger>
            <TooltipContent>QR címke generálása nyomtatáshoz</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      {/* Metadata Grid */}
      <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
        <div>
          <span className="text-muted-foreground">Bruttó bekerülési érték:</span>
          <p className="font-semibold">{formatCurrency(asset.acquisition_value, asset.currency)}</p>
        </div>
        <div>
          <span className="text-muted-foreground">Beszerzés dátuma:</span>
          <p className="font-semibold">{format(parseLocalDate(asset.purchase_date), 'yyyy.MM.dd.', { locale: hu })}</p>
        </div>
        <div>
          <span className="text-muted-foreground">Aktiválás dátuma:</span>
          <p className="font-semibold">{format(parseLocalDate(asset.activation_date), 'yyyy.MM.dd.', { locale: hu })}</p>
        </div>
        <div>
          <span className="text-muted-foreground">Szállító:</span>
          <p className="font-semibold">{asset.supplier_name || '-'}</p>
        </div>
        <div>
          <span className="text-muted-foreground">Helyszín:</span>
          <p className="font-semibold">{asset.location?.name || '-'}</p>
          {asset.location?.address && (
            <p className="text-xs text-muted-foreground">{asset.location.address}</p>
          )}
        </div>
        <div>
          <span className="text-muted-foreground">Projekt:</span>
          {asset.project ? (
            <div className="flex items-center gap-1.5 mt-0.5">
              <span
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary border border-primary/20"
                style={asset.project.color ? { borderColor: asset.project.color, color: asset.project.color } : undefined}
              >
                <FolderKanban className="h-3 w-3 shrink-0" />
                <span className="truncate max-w-[140px]">{asset.project.name}</span>
                {asset.project.project_code && (
                  <span className="opacity-75 font-mono text-[10px]">({asset.project.project_code})</span>
                )}
              </span>
            </div>
          ) : (
            <p className="font-semibold text-muted-foreground">-</p>
          )}
        </div>
        <div>
          <span className="text-muted-foreground">Aktiválta:</span>
          <p className="font-semibold">{asset.activated_by_name || '-'}</p>
        </div>
        <div>
          <span className="text-muted-foreground">Státusz:</span>
          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${ASSET_STATUS_COLORS[asset.status]}`}>
            {ASSET_STATUS_LABELS[asset.status]}
          </span>
        </div>
        {asset.gl_account && (
          <div>
            <span className="text-muted-foreground">Főkönyvi számla:</span>
            <p className="font-semibold font-mono text-sm">{asset.gl_account.gl_number} — {asset.gl_account.short_name}</p>
          </div>
        )}
        {asset.disposal_date && (
          <div>
            <span className="text-muted-foreground">Kivezetés dátuma:</span>
            <p className="font-semibold">{format(parseLocalDate(asset.disposal_date), 'yyyy.MM.dd.', { locale: hu })}</p>
          </div>
        )}
      </div>

      {/* Depreciation Cards */}
      <DepreciationCards
        asset={asset}
        performanceLogs={events
          .filter(e => e.event_type === 'performance_log')
          .map(e => ({ date: e.event_date, amount: e.new_values?.period_performance || 0 }))
        }
      />

      {/* Teljesítményarányos ÉCS napló */}
      {asset.depreciation_method === 'performance' && (
        <div className="space-y-3 border-t pt-4">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Teljesítmény Napló</h4>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 h-7 text-xs border-success/30 text-success hover:bg-success/5"
              onClick={() => {
                setPerfAmount('');
                setPerfCumulative('');
                setPerfDate(new Date().toISOString().slice(0, 10));
                setPerfOpen(true);
              }}
              disabled={!isActive}
            >
              <PlusCircle className="h-3.5 w-3.5" />
              Teljesítmény rögzítése
            </Button>
          </div>

          <div className="rounded-lg border overflow-hidden">
            <table className="w-full text-xs text-left">
              <thead className="bg-muted/50 border-b text-muted-foreground">
                <tr>
                  <th className="py-2 px-3 font-medium">Dátum</th>
                  <th className="py-2 px-3 font-medium text-right">Időszaki érték</th>
                  <th className="py-2 px-3 font-medium text-right">Számlálóállás</th>
                  <th className="py-2 px-3 font-medium text-right">Elszámolt ÉCS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {events.filter(e => e.event_type === 'performance_log').length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-4 text-center text-muted-foreground italic">
                      Nincs még rögzített teljesítmény bejegyzés.
                    </td>
                  </tr>
                ) : (
                  events
                    .filter(e => e.event_type === 'performance_log')
                    .map((event) => {
                      const pVal = event.new_values?.period_performance || 0;
                      const cVal = event.new_values?.cumulative_reading;
                      const decVal = event.new_values?.calculated_depreciation || 0;
                      return (
                        <tr key={event.id} className="hover:bg-muted/20">
                          <td className="py-2 px-3 font-mono">
                            {format(parseLocalDate(event.event_date), 'yyyy.MM.dd.', { locale: hu })}
                          </td>
                          <td className="py-2 px-3 text-right tabular-nums">
                            {pVal.toLocaleString('hu-HU')} {asset.performance_unit}
                          </td>
                          <td className="py-2 px-3 text-right tabular-nums text-muted-foreground">
                            {cVal ? `${cVal.toLocaleString('hu-HU')} ${asset.performance_unit}` : '-'}
                          </td>
                          <td className="py-2 px-3 text-right tabular-nums font-semibold text-success">
                            +{decVal.toLocaleString('hu-HU')} Ft
                          </td>
                        </tr>
                      );
                    })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Teljesítmény Rögzítése Dialog */}
      <Dialog open={perfOpen} onOpenChange={setPerfOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Új Teljesítmény Rögzítése</DialogTitle>
            <DialogDescription>
              Add meg az eszköz által teljesített egységet a leíráshoz (Tervezett összesen: {asset.total_planned_performance?.toLocaleString('hu-HU')} {asset.performance_unit}).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-3 text-sm">
            <div className="space-y-2">
              <Label>Dátum *</Label>
              <Input
                type="date"
                value={perfDate}
                onChange={e => setPerfDate(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Időszaki érték ({asset.performance_unit || 'egység'}) *</Label>
                <Input
                  type="number"
                  value={perfAmount}
                  onChange={e => {
                    setPerfAmount(e.target.value);
                    setPerfCumulative('');
                  }}
                  placeholder="pl. 5000"
                />
              </div>
              <div className="space-y-2">
                <Label>Vagy új állás ({asset.performance_unit || 'egység'})</Label>
                <Input
                  type="number"
                  value={perfCumulative}
                  onChange={e => {
                    setPerfCumulative(e.target.value);
                    const logs = events.filter(ev => ev.event_type === 'performance_log');
                    const lastOdo = logs.length > 0 ? Number(logs[logs.length - 1].new_values?.cumulative_reading || 0) : 0;
                    const val = parseFloat(e.target.value) || 0;
                    if (val >= lastOdo) {
                      setPerfAmount(String(val - lastOdo));
                    }
                  }}
                  placeholder="pl. 15000"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPerfOpen(false)} disabled={submittingPerf}>
              Mégse
            </Button>
            <Button
              onClick={handleSavePerf}
              disabled={submittingPerf || !perfAmount || parseFloat(perfAmount) <= 0}
              className="gap-2"
            >
              {submittingPerf ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Mentés
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Action Buttons */}
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5 border-primary/30 text-primary hover:bg-primary/5"
          disabled={!isActive}
          onClick={() => setReactivationOpen(true)}
        >
          <PlusCircle className="h-4 w-4" />
          Ráaktiválás
        </Button>

        <Button
          variant="outline"
          size="sm"
          className="gap-1.5 border-destructive/30 text-destructive hover:bg-destructive/5"
          disabled={!isActive}
          onClick={() => setDisposalOpen(true)}
        >
          <Trash2 className="h-4 w-4" />
          Selejtezés / Kivezetés
        </Button>

        <Button
          variant="outline"
          size="sm"
          className="gap-1.5 hover:bg-muted/50"
          disabled={!isActive}
          onClick={() => setTransferOpen(true)}
        >
          <ArrowRightLeft className="h-4 w-4" />
          Áthelyezés
        </Button>
      </div>

      {/* Timeline */}
      {events.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Életút</h4>
          <div className="space-y-2">
            {events.map((event) => (
              <div key={event.id} className="flex items-center gap-3 text-sm">
                <div className="flex-shrink-0">{EVENT_ICONS[event.event_type] || <CheckCircle className="h-3.5 w-3.5" />}</div>
                <span className="text-muted-foreground font-mono text-xs">
                  {format(parseLocalDate(event.event_date), 'yyyy.MM.dd', { locale: hu })}
                </span>
                <span className="font-medium">
                  {EVENT_LABELS[event.event_type] || event.event_type}
                </span>
                {event.description && (
                  <span className="text-muted-foreground text-xs truncate">— {event.description}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Documents */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Dokumentumtár</h4>
          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,.webp"
              className="hidden"
              onChange={handleUpload}
            />
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 h-7 text-xs"
              onClick={() => setUploadModalOpen(true)}
              disabled={uploading}
            >
              {uploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
              Dokumentum feltöltés
            </Button>
          </div>
        </div>

        <div className="space-y-4">
          {/* ── Számlák szekció ── */}
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5 px-1">
              <Receipt className="h-3.5 w-3.5" /> Számlák
            </p>
            {/* Source Invoice PDF — only for submitted invoices */}
            {asset.source_invoice_type === 'submitted' && asset.source_invoice_number && (
              <div
                className={`flex items-center gap-2 text-sm rounded-md px-2.5 py-1.5 transition-colors ${
                  sourceInvoiceUrl
                    ? 'text-primary cursor-pointer hover:bg-primary/5'
                    : 'text-muted-foreground'
                }`}
                onClick={() => sourceInvoiceUrl && window.open(sourceInvoiceUrl, '_blank')}
              >
                <FileText className="h-4 w-4 flex-shrink-0" />
                <span className="flex-1 truncate">Eredeti Számla PDF — {asset.source_invoice_number}</span>
                {sourceInvoiceUrl && <ExternalLink className="h-3.5 w-3.5 flex-shrink-0 opacity-60" />}
              </div>
            )}
            {/* Uploaded invoice documents */}
            {(asset.documents || []).map((doc, i) => doc.type === 'invoice' && (
              <div key={i} className="flex items-center gap-2 text-sm rounded-md px-2.5 py-1.5 group hover:bg-muted/50 transition-colors">
                <FileText className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                <a href={doc.url} target="_blank" rel="noopener noreferrer" className="flex-1 truncate text-primary hover:underline">{doc.name}</a>
                <button onClick={() => handleDeleteDoc(i)} className="opacity-0 group-hover:opacity-100 h-5 w-5 rounded flex items-center justify-center hover:bg-destructive/10 text-destructive transition-opacity" title="Törlés"><Trash2 className="h-3 w-3" /></button>
              </div>
            ))}
            {/* Empty state for invoices */}
            {!(asset.source_invoice_type === 'submitted' && asset.source_invoice_number) && !(asset.documents || []).some(d => d.type === 'invoice') && (
              <p className="text-xs text-muted-foreground italic px-2.5">Nincs számla dokumentum.</p>
            )}
          </div>

          {/* ── Garanciajegyek szekció ── */}
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5 px-1">
              <ShieldOff className="h-3.5 w-3.5" /> Garanciajegyek
            </p>
            {(asset.documents || []).map((doc, i) => doc.type === 'warranty' && (
              <div key={i} className="flex items-center gap-2 text-sm rounded-md px-2.5 py-1.5 group hover:bg-muted/50 transition-colors">
                <FileText className="h-4 w-4 flex-shrink-0 text-amber-500" />
                <a href={doc.url} target="_blank" rel="noopener noreferrer" className="flex-1 truncate text-primary hover:underline">{doc.name}</a>
                <button onClick={() => handleDeleteDoc(i)} className="opacity-0 group-hover:opacity-100 h-5 w-5 rounded flex items-center justify-center hover:bg-destructive/10 text-destructive transition-opacity" title="Törlés"><Trash2 className="h-3 w-3" /></button>
              </div>
            ))}
            {!(asset.documents || []).some(d => d.type === 'warranty') && (
              <p className="text-xs text-muted-foreground italic px-2.5">Nincs garanciajegy.</p>
            )}
          </div>

          {/* Legacy docs (type is not 'invoice' or 'warranty') */}
          {(asset.documents || []).filter(d => d.type !== 'invoice' && d.type !== 'warranty').map((doc, i) => {
            const originalIndex = (asset.documents || []).indexOf(doc);
            return (
              <div key={`legacy-${i}`} className="flex items-center gap-2 text-sm rounded-md px-2.5 py-1.5 group hover:bg-muted/50 transition-colors">
                <FileText className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                <a href={doc.url} target="_blank" rel="noopener noreferrer" className="flex-1 truncate text-primary hover:underline">{doc.name}</a>
                <button onClick={() => handleDeleteDoc(originalIndex)} className="opacity-0 group-hover:opacity-100 h-5 w-5 rounded flex items-center justify-center hover:bg-destructive/10 text-destructive transition-opacity" title="Törlés"><Trash2 className="h-3 w-3" /></button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Upload Type Modal */}
      <Dialog open={uploadModalOpen} onOpenChange={setUploadModalOpen}>
        <DialogContent className="max-w-xs">
          <DialogHeader>
            <DialogTitle>Dokumentum típusa</DialogTitle>
            <DialogDescription>Válaszd ki a feltöltendő dokumentum típusát.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3 py-2">
            <button
              onClick={() => startUpload('invoice')}
              className="flex flex-col items-center gap-2 p-4 rounded-lg border border-border hover:border-primary hover:bg-primary/5 transition-colors group"
            >
              <Receipt className="h-6 w-6 text-muted-foreground group-hover:text-primary transition-colors" />
              <span className="text-sm font-medium">Számla</span>
            </button>
            <button
              onClick={() => startUpload('warranty')}
              className="flex flex-col items-center gap-2 p-4 rounded-lg border border-border hover:border-amber-500 hover:bg-amber-500/5 transition-colors group"
            >
              <ShieldOff className="h-6 w-6 text-muted-foreground group-hover:text-amber-500 transition-colors" />
              <span className="text-sm font-medium">Garanciajegy</span>
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Lifecycle Dialogs — only mount when open to keep initial chunk light */}
      <Suspense fallback={null}>
        {transferOpen && <TransferDialog open={transferOpen} onOpenChange={setTransferOpen} asset={asset} />}
        {reactivationOpen && <ReactivationDialog open={reactivationOpen} onOpenChange={setReactivationOpen} asset={asset} />}
        {disposalOpen && <DisposalDialog open={disposalOpen} onOpenChange={setDisposalOpen} asset={asset} />}
        {qrOpen && <QrLabelDialog open={qrOpen} onOpenChange={setQrOpen} asset={asset} />}
      </Suspense>
    </div>
  );
}
