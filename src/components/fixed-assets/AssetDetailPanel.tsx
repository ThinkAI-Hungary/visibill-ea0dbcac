import { useState, useEffect, lazy, Suspense, useRef, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import { getDateFnsLocale } from '@/lib/locale/formatters';
import { formatCurrency } from '@/lib/utils';
import { DepreciationCards } from './DepreciationCards';
import type { FixedAsset, AssetEvent } from '@/types/fixed-assets';
import { ASSET_STATUS_LABELS, ASSET_STATUS_COLORS } from '@/types/fixed-assets';
import { QrCode, FileText, ShieldCheck, ArrowRightLeft, Trash2, PlusCircle, CheckCircle, Upload, ExternalLink, Loader2, ShieldOff, Receipt, FolderKanban, RefreshCw, FileCheck, Landmark, FileDown, TrendingDown, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { useCompany } from '@/contexts/CompanyContext';
import { reportError } from '@/lib/errorReporter';
import { generateAndAttachAssetProtocolPdf } from '@/hooks/useFixedAssets';
import { useCompanyCapabilities } from '@/hooks/useCompanyCapabilities';
import { downloadAssetHandoverProtocolPdf } from '@/lib/fixed-assets/assetHandoverProtocolPdf';

// Lazy-load dialogs so they don't bloat the initial page chunk
const TransferDialog = lazy(() => import('./TransferDialog').then(m => ({ default: m.TransferDialog })));
const ReactivationDialog = lazy(() => import('./ReactivationDialog').then(m => ({ default: m.ReactivationDialog })));
const DisposalDialog = lazy(() => import('./DisposalDialog').then(m => ({ default: m.DisposalDialog })));
const DisposalApprovalDialog = lazy(() => import('./DisposalApprovalDialog').then(m => ({ default: m.DisposalApprovalDialog })));
const QrLabelDialog = lazy(() => import('./QrLabelDialog').then(m => ({ default: m.QrLabelDialog })));
const DevelopmentReserveAssignDialog = lazy(() => import('./DevelopmentReserveAssignDialog').then(m => ({ default: m.DevelopmentReserveAssignDialog })));
const MultiYearMovementTable = lazy(() => import('./MultiYearMovementTable').then(m => ({ default: m.MultiYearMovementTable })));
const AssetComponentsView = lazy(() => import('./AssetComponentsView').then(m => ({ default: m.AssetComponentsView })));
const UnplannedDepreciationDialog = lazy(() => import('./UnplannedDepreciationDialog').then(m => ({ default: m.UnplannedDepreciationDialog })));

function parseLocalDate(ymdStr: string): Date {
  const parts = ymdStr.split('-');
  const y = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10) - 1; // 0-indexed
  const d = parseInt(parts[2], 10);
  return new Date(y, m, d);
}

function getTodayDateString(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
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
  disposal_requested: <ShieldCheck className="h-3.5 w-3.5 text-warning" />,
  disposal_approved: <CheckCircle className="h-3.5 w-3.5 text-success" />,
  disposal_rejected: <ShieldOff className="h-3.5 w-3.5 text-destructive" />,
  value_change: <PlusCircle className="h-3.5 w-3.5 text-warning" />,
  document_upload: <Upload className="h-3.5 w-3.5 text-muted-foreground" />,
  performance_log: <PlusCircle className="h-3.5 w-3.5 text-success" />,
  unplanned_depreciation: <TrendingDown className="h-3.5 w-3.5 text-destructive" />,
  unplanned_depreciation_reversal: <TrendingUp className="h-3.5 w-3.5 text-success" />,
  contribution_in_kind: <PlusCircle className="h-3.5 w-3.5 text-indigo-500" />,
  free_transfer_out: <ArrowRightLeft className="h-3.5 w-3.5 text-destructive" />,
  free_transfer_in: <ArrowRightLeft className="h-3.5 w-3.5 text-success" />,
};

const EVENT_LABELS: Record<string, string> = {
  activation: 'Aktiválás',
  inventory_check: 'Leltár - Fellelve',
  transfer: 'Áthelyezés',
  project_transfer: 'Projekt hozzárendelés',
  reactivation: 'Ráaktiválás',
  disposal: 'Kivezetés',
  disposal_requested: 'Kivezetés kezdeményezve',
  disposal_approved: 'Kivezetés jóváhagyva',
  disposal_rejected: 'Kivezetés elutasítva',
  value_change: 'Értékváltozás',
  document_upload: 'Dokumentum feltöltés',
  performance_log: 'Teljesítmény rögzítés',
  unplanned_depreciation: 'Terven felüli ÉCS elszámolás',
  unplanned_depreciation_reversal: 'Terven felüli ÉCS visszaírás',
  contribution_in_kind: 'Apportálás',
  free_transfer_out: 'Térítés nélküli átadás',
  free_transfer_in: 'Térítés nélküli átvétel',
};

export function AssetDetailPanel({ asset, events }: AssetDetailPanelProps) {
  const { t: rawT } = useTranslation(['hr', 'common']);
  const t = (key: string, opts?: any): any => rawT((key.includes(':') ? key : `hr:${key}`) as any, opts);
  const [transferOpen, setTransferOpen] = useState(false);
  const [reactivationOpen, setReactivationOpen] = useState(false);
  const [disposalOpen, setDisposalOpen] = useState(false);
  const [disposalApprovalOpen, setDisposalApprovalOpen] = useState(false);
  const { canWriteLedger } = useCompanyCapabilities();
  const [qrOpen, setQrOpen] = useState(false);
  const [reserveAssignOpen, setReserveAssignOpen] = useState(false);
  const [unplannedDepOpen, setUnplannedDepOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [sourceInvoiceUrl, setSourceInvoiceUrl] = useState<string | null>(null);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [uploadCategory, setUploadCategory] = useState<'invoice' | 'warranty'>('invoice');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { selectedCompany } = useCompany();

  const isUnderRetention = asset.tax_credit_retention_until ? getTodayDateString() < asset.tax_credit_retention_until : false;

  // Protocol PDF Generation state
  const [generatingProtocol, setGeneratingProtocol] = useState(false);

  const handleGenerateProtocol = async () => {
    setGeneratingProtocol(true);
    try {
      await generateAndAttachAssetProtocolPdf(asset.id, asset.company_id);
      toast({ title: t('fixed_assets.detail.toast_protocol_success') });
      queryClient.invalidateQueries({ queryKey: ['fixedAssetDetail', asset.id] });
      queryClient.invalidateQueries({ queryKey: ['fixedAssets', asset.company_id] });
    } catch (err: any) {
      toast({ title: t('fixed_assets.detail.toast_protocol_error'), description: err?.message || 'Nem sikerült a PDF generálás', variant: 'destructive' });
    } finally {
      setGeneratingProtocol(false);
    }
  };

  const handleDownloadTransferProtocol = (event: AssetEvent) => {
    downloadAssetHandoverProtocolPdf({
      companyName: selectedCompany?.name || 'VisiBill Cég',
      companyAddress: selectedCompany?.address,
      companyTaxNumber: selectedCompany?.tax_number,
      protocolNumber: `AAT-${asset.inventory_number}-${event.event_date}`,
      eventDate: event.event_date,
      assetName: asset.name,
      inventoryNumber: asset.inventory_number,
      description: asset.description || undefined,
      vtszTeszor: asset.vtsz_teszor || undefined,
      activationDate: asset.activation_date,
      acquisitionValue: asset.acquisition_value,
      oldLocationName: event.old_values?.location || asset.location?.name,
      newLocationName: event.new_values?.location || asset.location?.name,
      oldSubLocationName: event.old_values?.sub_location || asset.sub_location?.name,
      newSubLocationName: event.new_values?.sub_location || asset.sub_location?.name,
      oldCustodianName: event.old_values?.custodian,
      newCustodianName: event.new_values?.custodian,
      oldCostCenterName: event.old_values?.cost_center,
      newCostCenterName: event.new_values?.cost_center,
      projectName: event.new_values?.project || asset.project?.name,
      notes: event.description || undefined,
    });
  };

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

      toast({ title: t('fixed_assets.detail.toast_perf_success') });
      setPerfOpen(false);
      
      queryClient.invalidateQueries({ queryKey: ['fixedAssets', asset.company_id] });
      queryClient.invalidateQueries({ queryKey: ['fixedAssetDetail', asset.id] });
      queryClient.invalidateQueries({ queryKey: ['fixed-asset-detail', asset.id] });
    } catch (err: any) {
      toast({ title: t('fixed_assets.detail.toast_perf_error'), description: err.message, variant: 'destructive' });
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
      toast({ title: t('fixed_assets.detail.toast_upload_size_error'), variant: 'destructive' });
      return;
    }

    setUploading(true);
    try {
      const userFolder = user?.id || asset.company_id;
      const storagePath = `${userFolder}/${asset.id}/${Date.now()}-${file.name}`;

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

      const label = uploadCategory === 'warranty' ? t('fixed_assets.detail.type_warranty') : t('fixed_assets.detail.type_invoice');
      toast({ title: t('fixed_assets.detail.toast_upload_success', { label }), description: file.name });

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
      toast({ title: t('fixed_assets.detail.toast_upload_error'), description: err.message, variant: 'destructive' });
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

      toast({ title: t('fixed_assets.detail.toast_delete_success') });
      queryClient.invalidateQueries({ queryKey: ['fixed-asset-detail', asset.id] });
    } catch (err: any) {
      toast({ title: t('fixed_assets.detail.toast_delete_error'), description: err.message, variant: 'destructive' });
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
                {t('fixed_assets.detail.qr_btn')}
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t('fixed_assets.detail.qr_tooltip')}</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      {/* Metadata Grid */}
      <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
        <div>
          <span className="text-muted-foreground">{t('fixed_assets.detail.gross_acquisition_value')}</span>
          <p className="font-semibold">{formatCurrency(asset.acquisition_value, asset.currency)}</p>
        </div>
        <div>
          <span className="text-muted-foreground">{t('fixed_assets.detail.purchase_date')}</span>
          <p className="font-semibold">{format(parseLocalDate(asset.purchase_date), 'yyyy.MM.dd.', { locale: getDateFnsLocale() })}</p>
        </div>
        <div>
          <span className="text-muted-foreground">{t('fixed_assets.detail.activation_date')}</span>
          <p className="font-semibold">{format(parseLocalDate(asset.activation_date), 'yyyy.MM.dd.', { locale: getDateFnsLocale() })}</p>
        </div>
        <div>
          <span className="text-muted-foreground">{t('fixed_assets.detail.supplier')}</span>
          <p className="font-semibold">{asset.supplier_name || '-'}</p>
        </div>
        <div>
          <span className="text-muted-foreground">{t('fixed_assets.detail.location')}</span>
          <p className="font-semibold">{asset.location?.name || '-'}</p>
          {asset.location?.address && (
            <p className="text-xs text-muted-foreground">{asset.location.address}</p>
          )}
        </div>
        <div>
          <span className="text-muted-foreground">Tárolóhely / Iroda</span>
          <p className="font-semibold">{asset.sub_location?.name || '-'}</p>
          {asset.sub_location?.code && (
            <p className="text-xs text-muted-foreground font-mono">({asset.sub_location.code})</p>
          )}
        </div>
        <div>
          <span className="text-muted-foreground">Felelős személy</span>
          <p className="font-semibold">
            {asset.custodian ? `${asset.custodian.last_name} ${asset.custodian.first_name}` : '-'}
          </p>
          {asset.custodian?.email && (
            <p className="text-xs text-muted-foreground truncate">{asset.custodian.email}</p>
          )}
        </div>
        <div>
          <span className="text-muted-foreground">Költséghely / Egység</span>
          <p className="font-semibold">
            {asset.cost_center ? `${asset.cost_center.code} – ${asset.cost_center.name}` : '-'}
          </p>
        </div>
        <div>
          <span className="text-muted-foreground">{t('fixed_assets.detail.project')}</span>
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
            <p className="font-semibold text-muted-foreground">{t('fixed_assets.detail.no_project')}</p>
          )}
        </div>
        <div>
          <span className="text-muted-foreground">{t('fixed_assets.detail.activated_by')}</span>
          <p className="font-semibold">{asset.activated_by_name || '-'}</p>
        </div>
        <div>
          <span className="text-muted-foreground">{t('fixed_assets.detail.status')}</span>
          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${ASSET_STATUS_COLORS[asset.status]}`}>
            {t(`fixed_assets.status.${asset.status}`, ASSET_STATUS_LABELS[asset.status])}
          </span>
          {asset.disposal_status === 'pending_approval' && (
            <span
              id="asset-disposal-pending-badge"
              className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-warning/10 text-warning"
            >
              {t('fixed_assets.detail.disposal_pending', 'Kivezetés jóváhagyásra vár')}
            </span>
          )}
          {asset.disposal_status === 'rejected' && asset.status === 'active' && (
            <span
              id="asset-disposal-rejected-badge"
              className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-destructive/10 text-destructive"
            >
              {t('fixed_assets.detail.disposal_rejected', 'Kivezetés elutasítva')}
            </span>
          )}
        </div>
        {asset.gl_account && (
          <div>
            <span className="text-muted-foreground">{t('fixed_assets.detail.gl_account')}</span>
            <p className="font-semibold font-mono text-sm">{asset.gl_account.gl_number} — {asset.gl_account.short_name}</p>
          </div>
        )}
        <div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">{t('fixed_assets.detail.dev_reserve', 'Fejlesztési tartalék')}</span>
            {isActive && (
              <Button
                variant="ghost"
                size="sm"
                className="h-5 px-1.5 text-[11px] text-amber-600 hover:text-amber-700 hover:bg-amber-50 dark:hover:bg-amber-950/40"
                onClick={() => setReserveAssignOpen(true)}
              >
                {t('common:actions.manage', 'Kezelés')}
              </Button>
            )}
          </div>
          <p className="font-semibold text-amber-600">
            {Number(asset.development_reserve_amount) > 0 ? (
              <>
                {formatCurrency(asset.development_reserve_amount, asset.currency)}
                {asset.development_reserve?.creation_year && (
                  <span className="text-xs font-normal text-muted-foreground ml-1">
                    {t('fixed_assets.detail.dev_reserve_year_frame', { year: asset.development_reserve.creation_year })}
                  </span>
                )}
              </>
            ) : (
              <span className="text-muted-foreground font-normal text-xs">{t('fixed_assets.detail.no_dev_reserve', 'Nincs hozzárendelve')}</span>
            )}
          </p>
        </div>
        {asset.disposal_date && (
          <div>
            <span className="text-muted-foreground">{t('fixed_assets.detail.disposal_date')}</span>
            <p className="font-semibold">{format(parseLocalDate(asset.disposal_date), 'yyyy.MM.dd.', { locale: getDateFnsLocale() })}</p>
          </div>
        )}

        {/* Ingatlan és Gépjármű azonosítók */}
        {asset.property_registry_number && (
          <div>
            <span className="text-muted-foreground">{t('fixed_assets.detail.property_registry_number', 'Helyrajzi szám (Hrsz.)')}</span>
            <p className="font-semibold font-mono text-sm">{asset.property_registry_number}</p>
          </div>
        )}
        {asset.license_plate && (
          <div>
            <span className="text-muted-foreground">{t('fixed_assets.detail.license_plate', 'Forgalmi rendszám')}</span>
            <p className="font-semibold font-mono text-sm uppercase tracking-wider">{asset.license_plate}</p>
          </div>
        )}
        {asset.vin_chassis_number && (
          <div>
            <span className="text-muted-foreground">{t('fixed_assets.detail.vin_chassis_number', 'Alvázszám (VIN)')}</span>
            <p className="font-semibold font-mono text-xs uppercase tracking-wider">{asset.vin_chassis_number}</p>
          </div>
        )}

        {/* Átvett nyitó karton adatok */}
        {(asset.last_depreciation_date || Number(asset.opening_accumulated_depreciation) > 0) && (
          <div className="col-span-2 p-2.5 rounded-md bg-blue-500/10 border border-blue-500/20 text-xs space-y-1">
            <span className="font-semibold text-blue-600 dark:text-blue-400 block">
              {t('fixed_assets.detail.opening_header', 'Átvett Nyitó Karton Paraméterek')}
            </span>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <span className="text-muted-foreground">Utolsó leírt hó:</span>
                <p className="font-semibold font-mono">{asset.last_depreciation_date || '-'}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Átvett számviteli ÉCS:</span>
                <p className="font-semibold font-mono">{formatCurrency(asset.opening_accumulated_depreciation || 0, asset.currency)}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Átvett TAO ÉCS:</span>
                <p className="font-semibold font-mono">{formatCurrency(asset.opening_tax_depreciation || 0, asset.currency)}</p>
              </div>
            </div>
          </div>
        )}

        {/* Pályázatos ÉCS adatok */}
        {Number(asset.grant_depreciation_base) > 0 && (
          <div className="col-span-2 p-2.5 rounded-md bg-purple-500/10 border border-purple-500/20 text-xs space-y-1">
            <span className="font-semibold text-purple-600 dark:text-purple-400 block">
              {t('fixed_assets.detail.grant_header', 'Pályázati Támogatási Adatok')}
            </span>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <span className="text-muted-foreground">Támogatott amortizációs alap:</span>
                <p className="font-semibold font-mono">{formatCurrency(asset.grant_depreciation_base, asset.currency)}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Támogatási éves kulcs:</span>
                <p className="font-semibold font-mono">{asset.grant_depreciation_rate || '-'}%</p>
              </div>
            </div>
          </div>
        )}

        {/* Beruházási Adókedvezmény és Megtartási Időszak */}
        {asset.has_tax_credit && (
          <div className="col-span-2 p-2.5 rounded-md bg-blue-500/10 border border-blue-500/20 text-xs space-y-1">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-blue-600 dark:text-blue-400">
                {t('fixed_assets.detail.tax_credit_header', 'Beruházási Adókedvezmény (Tao. tv. 22/B. §)')}
              </span>
              {asset.tax_credit_retention_until && (
                <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                  isUnderRetention
                    ? 'bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30'
                    : 'bg-green-500/20 text-green-700 dark:text-green-300 border border-green-500/30'
                }`}>
                  {isUnderRetention
                    ? 'Megtartási tilalom alatt'
                    : 'Megtartási időszak letelt'}
                </span>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2 pt-1">
              <div>
                <span className="text-muted-foreground">Kedvezmény jogcíme:</span>
                <p className="font-semibold">{
                  asset.tax_credit_type === 'KKV_BERUHAZAS'
                    ? 'Kisvállalkozói beruházási kedvezmény'
                    : asset.tax_credit_type === 'FEJLESZTESI_ADOKEDVEZMENY'
                    ? 'Fejlesztési adókedvezmény'
                    : asset.tax_credit_type === 'ENERGIAHATEKONYSAGI'
                    ? 'Energiahatékonysági célú beruházás'
                    : asset.tax_credit_type || 'Beruházási adókedvezmény'
                }</p>
              </div>
              <div>
                <span className="text-muted-foreground">Megtartási kötelezettség vége:</span>
                <p className="font-semibold font-mono">{asset.tax_credit_retention_until || '-'}</p>
              </div>
            </div>
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

      {/* Többéves Mozgástábla és Tao összehasonlítás */}
      <Suspense fallback={null}>
        <div className="pt-2">
          <MultiYearMovementTable asset={asset} />
        </div>
      </Suspense>

      {/* Komponens-elvű nyilvántartás & Pályázati források */}
      <Suspense fallback={null}>
        <div className="pt-2 border-t mt-4">
          <AssetComponentsView asset={asset} />
        </div>
      </Suspense>

      {/* Teljesítményarányos ÉCS napló */}
      {asset.depreciation_method === 'performance' && (
        <div className="space-y-3 border-t pt-4">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">{t('fixed_assets.detail.perf_log_title')}</h4>
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
              {t('fixed_assets.detail.btn_record_perf')}
            </Button>
          </div>

          <div className="rounded-lg border overflow-hidden">
            <table className="w-full text-xs text-left">
              <thead className="bg-muted/50 border-b text-muted-foreground">
                <tr>
                  <th className="py-2 px-3 font-medium">{t('fixed_assets.detail.col_date')}</th>
                  <th className="py-2 px-3 font-medium text-right">{t('fixed_assets.detail.col_period_value')}</th>
                  <th className="py-2 px-3 font-medium text-right">{t('fixed_assets.detail.col_counter_value')}</th>
                  <th className="py-2 px-3 font-medium text-right">{t('fixed_assets.detail.col_depreciation')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {events.filter(e => e.event_type === 'performance_log').length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-4 text-center text-muted-foreground italic">
                      {t('fixed_assets.detail.no_perf_logs')}
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
                            {format(parseLocalDate(event.event_date), 'yyyy.MM.dd.', { locale: getDateFnsLocale() })}
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
            <DialogTitle>{t('fixed_assets.detail.perf_modal_title')}</DialogTitle>
            <DialogDescription>
              {t('fixed_assets.detail.perf_modal_desc', {
                total: asset.total_planned_performance?.toLocaleString('hu-HU'),
                unit: asset.performance_unit,
              })}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-3 text-sm">
            <div className="space-y-2">
              <Label>{t('fixed_assets.detail.perf_modal_date')}</Label>
              <Input
                type="date"
                value={perfDate}
                onChange={e => setPerfDate(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t('fixed_assets.detail.perf_modal_period', { unit: asset.performance_unit || 'egység' })}</Label>
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
                <Label>{t('fixed_assets.detail.perf_modal_counter', { unit: asset.performance_unit || 'egység' })}</Label>
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
              {t('fixed_assets.detail.perf_modal_cancel')}
            </Button>
            <Button
              onClick={handleSavePerf}
              disabled={submittingPerf || !perfAmount || parseFloat(perfAmount) <= 0}
              className="gap-2"
            >
              {submittingPerf ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {t('fixed_assets.detail.perf_modal_save')}
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
          {t('fixed_assets.detail.btn_reactivation')}
        </Button>

        {asset.disposal_status === 'pending_approval' ? (
          <Button
            id="asset-disposal-review-btn"
            variant="outline"
            size="sm"
            className="gap-1.5 border-warning/40 text-warning hover:bg-warning/5"
            disabled={!isActive}
            onClick={() => setDisposalApprovalOpen(true)}
          >
            <ShieldCheck className="h-4 w-4" />
            {canWriteLedger
              ? t('fixed_assets.detail.btn_disposal_review', 'Kivezetés jóváhagyása')
              : t('fixed_assets.detail.btn_disposal_pending', 'Jóváhagyásra vár')}
          </Button>
        ) : (
          <Button
            id="asset-disposal-request-btn"
            variant="outline"
            size="sm"
            className="gap-1.5 border-destructive/30 text-destructive hover:bg-destructive/5"
            disabled={!isActive}
            onClick={() => setDisposalOpen(true)}
          >
            <Trash2 className="h-4 w-4" />
            {t('fixed_assets.detail.btn_disposal')}
          </Button>
        )}

        <Button
          variant="outline"
          size="sm"
          className="gap-1.5 hover:bg-muted/50"
          disabled={!isActive}
          onClick={() => setTransferOpen(true)}
        >
          <ArrowRightLeft className="h-4 w-4" />
          {t('fixed_assets.detail.btn_transfer')}
        </Button>

        <Button
          variant="outline"
          size="sm"
          className="gap-1.5 border-amber-300 text-amber-700 hover:bg-amber-50 dark:border-amber-800 dark:text-amber-400 dark:hover:bg-amber-950/40"
          disabled={!isActive}
          onClick={() => setReserveAssignOpen(true)}
        >
          <Landmark className="h-4 w-4" />
          {t('fixed_assets.detail.dev_reserve', 'Fejlesztési tartalék')}
        </Button>

        <Button
          variant="outline"
          size="sm"
          className="gap-1.5 border-rose-300 text-rose-700 hover:bg-rose-50 dark:border-rose-800 dark:text-rose-400 dark:hover:bg-rose-950/40"
          disabled={!isActive}
          onClick={() => setUnplannedDepOpen(true)}
          title="Terven felüli értékcsökkenés elszámolása (866) vagy visszaírása (966)"
        >
          <TrendingDown className="h-4 w-4" />
          {t('fixed_assets.detail.dev_unplanned_dep', 'Terven felüli ÉCS')}
        </Button>
      </div>

      {/* Timeline */}
      {events.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">{t('fixed_assets.detail.timeline_title')}</h4>
          <div className="space-y-2">
            {events.map((event) => (
              <div key={event.id} className="flex items-center justify-between gap-2 text-sm py-0.5 group">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex-shrink-0">{EVENT_ICONS[event.event_type] || <CheckCircle className="h-3.5 w-3.5" />}</div>
                  <span className="text-muted-foreground font-mono text-xs whitespace-nowrap">
                    {format(parseLocalDate(event.event_date), 'yyyy.MM.dd', { locale: getDateFnsLocale() })}
                  </span>
                  <span className="font-medium whitespace-nowrap">
                    {t(`fixed_assets.detail.events.${event.event_type}`, EVENT_LABELS[event.event_type] || event.event_type)}
                  </span>
                  {event.description && (
                    <span className="text-muted-foreground text-xs truncate">— {event.description}</span>
                  )}
                </div>
                {(event.event_type === 'transfer' || event.event_type === 'project_transfer') && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 text-[11px] px-1.5 opacity-80 group-hover:opacity-100 gap-1 text-primary hover:bg-primary/10 flex-shrink-0"
                    onClick={() => handleDownloadTransferProtocol(event)}
                    title="Kétnyelvű átadás-átvételi nyilatkozat letöltése"
                  >
                    <FileDown className="h-3 w-3" />
                    <span>PDF</span>
                  </Button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Documents */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">{t('fixed_assets.detail.docs_title')}</h4>
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
              {t('fixed_assets.detail.btn_upload_doc')}
            </Button>
          </div>
        </div>

        <div className="space-y-4">
          {/* ── Aktiválási Jegyzőkönyv szekció ── */}
          <div className="space-y-1.5 rounded-lg border border-primary/20 bg-primary/5 p-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-primary flex items-center gap-1.5">
                <FileCheck className="h-4 w-4 text-primary" /> {t('fixed_assets.detail.protocol_section_title')}
              </p>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 text-[11px] px-2 text-primary hover:bg-primary/10 gap-1"
                onClick={handleGenerateProtocol}
                disabled={generatingProtocol}
                title={t('fixed_assets.detail.btn_regenerate_protocol')}
              >
                {generatingProtocol ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                {asset.documents?.some(d => d.type === 'protocol') ? t('fixed_assets.detail.btn_regenerate_protocol') : t('fixed_assets.detail.btn_generate_protocol')}
              </Button>
            </div>

            {asset.documents?.filter(d => d.type === 'protocol').map((doc, i) => (
              <div key={i} className="flex items-center gap-2 text-sm rounded-md px-2 py-1 bg-background border border-primary/20 group hover:border-primary transition-colors">
                <FileText className="h-4 w-4 flex-shrink-0 text-primary" />
                <a href={doc.url} target="_blank" rel="noopener noreferrer" className="flex-1 truncate font-medium text-primary hover:underline">
                  {doc.name}
                </a>
                <ExternalLink className="h-3.5 w-3.5 text-muted-foreground opacity-75" />
              </div>
            ))}

            {!asset.documents?.some(d => d.type === 'protocol') && (
              <p className="text-xs text-muted-foreground italic px-1">
                {t('fixed_assets.detail.protocol_generate_hint')}
              </p>
            )}
          </div>

          {/* ── Számlák szekció ── */}
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5 px-1">
              <Receipt className="h-3.5 w-3.5" /> {t('fixed_assets.detail.invoices_section_title')}
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
                <span className="flex-1 truncate">{t('fixed_assets.detail.original_invoice_pdf', { number: asset.source_invoice_number })}</span>
                {sourceInvoiceUrl && <ExternalLink className="h-3.5 w-3.5 flex-shrink-0 opacity-60" />}
              </div>
            )}
            {/* Uploaded invoice documents */}
            {(asset.documents || []).map((doc, i) => doc.type === 'invoice' && (
              <div key={i} className="flex items-center gap-2 text-sm rounded-md px-2.5 py-1.5 group hover:bg-muted/50 transition-colors">
                <FileText className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                <a href={doc.url} target="_blank" rel="noopener noreferrer" className="flex-1 truncate text-primary hover:underline">{doc.name}</a>
                <button onClick={() => handleDeleteDoc(i)} className="opacity-0 group-hover:opacity-100 h-5 w-5 rounded flex items-center justify-center hover:bg-destructive/10 text-destructive transition-opacity" title={t('common:actions.delete', 'Törlés')}><Trash2 className="h-3 w-3" /></button>
              </div>
            ))}
            {/* Empty state for invoices */}
            {!(asset.source_invoice_type === 'submitted' && asset.source_invoice_number) && !(asset.documents || []).some(d => d.type === 'invoice') && (
              <p className="text-xs text-muted-foreground italic px-2.5">{t('fixed_assets.detail.no_invoices')}</p>
            )}
          </div>

          {/* ── Garanciajegyek szekció ── */}
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5 px-1">
              <ShieldOff className="h-3.5 w-3.5" /> {t('fixed_assets.detail.warranties_section_title')}
            </p>
            {(asset.documents || []).map((doc, i) => doc.type === 'warranty' && (
              <div key={i} className="flex items-center gap-2 text-sm rounded-md px-2.5 py-1.5 group hover:bg-muted/50 transition-colors">
                <FileText className="h-4 w-4 flex-shrink-0 text-amber-500" />
                <a href={doc.url} target="_blank" rel="noopener noreferrer" className="flex-1 truncate text-primary hover:underline">{doc.name}</a>
                <button onClick={() => handleDeleteDoc(i)} className="opacity-0 group-hover:opacity-100 h-5 w-5 rounded flex items-center justify-center hover:bg-destructive/10 text-destructive transition-opacity" title={t('common:actions.delete', 'Törlés')}><Trash2 className="h-3 w-3" /></button>
              </div>
            ))}
            {!(asset.documents || []).some(d => d.type === 'warranty') && (
              <p className="text-xs text-muted-foreground italic px-2.5">{t('fixed_assets.detail.no_warranties')}</p>
            )}
          </div>

          {/* Legacy docs (type is not 'invoice' or 'warranty') */}
          {(asset.documents || []).filter(d => d.type !== 'invoice' && d.type !== 'warranty').map((doc, i) => {
            const originalIndex = (asset.documents || []).indexOf(doc);
            return (
              <div key={`legacy-${i}`} className="flex items-center gap-2 text-sm rounded-md px-2.5 py-1.5 group hover:bg-muted/50 transition-colors">
                <FileText className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                <a href={doc.url} target="_blank" rel="noopener noreferrer" className="flex-1 truncate text-primary hover:underline">{doc.name}</a>
                <button onClick={() => handleDeleteDoc(originalIndex)} className="opacity-0 group-hover:opacity-100 h-5 w-5 rounded flex items-center justify-center hover:bg-destructive/10 text-destructive transition-opacity" title={t('common:actions.delete', 'Törlés')}><Trash2 className="h-3 w-3" /></button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Upload Type Modal */}
      <Dialog open={uploadModalOpen} onOpenChange={setUploadModalOpen}>
        <DialogContent className="max-w-xs">
          <DialogHeader>
            <DialogTitle>{t('fixed_assets.detail.modal_doc_type_title')}</DialogTitle>
            <DialogDescription>{t('fixed_assets.detail.modal_doc_type_desc')}</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3 py-2">
            <button
              onClick={() => startUpload('invoice')}
              className="flex flex-col items-center gap-2 p-4 rounded-lg border border-border hover:border-primary hover:bg-primary/5 transition-colors group"
            >
              <Receipt className="h-6 w-6 text-muted-foreground group-hover:text-primary transition-colors" />
              <span className="text-sm font-medium">{t('fixed_assets.detail.type_invoice')}</span>
            </button>
            <button
              onClick={() => startUpload('warranty')}
              className="flex flex-col items-center gap-2 p-4 rounded-lg border border-border hover:border-amber-500 hover:bg-amber-500/5 transition-colors group"
            >
              <ShieldOff className="h-6 w-6 text-muted-foreground group-hover:text-amber-500 transition-colors" />
              <span className="text-sm font-medium">{t('fixed_assets.detail.type_warranty')}</span>
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Lifecycle Dialogs — only mount when open to keep initial chunk light */}
      <Suspense fallback={null}>
        {transferOpen && <TransferDialog open={transferOpen} onOpenChange={setTransferOpen} asset={asset} />}
        {reactivationOpen && <ReactivationDialog open={reactivationOpen} onOpenChange={setReactivationOpen} asset={asset} />}
        {disposalOpen && <DisposalDialog open={disposalOpen} onOpenChange={setDisposalOpen} asset={asset} />}
        {disposalApprovalOpen && (
          <DisposalApprovalDialog
            open={disposalApprovalOpen}
            onOpenChange={setDisposalApprovalOpen}
            asset={asset}
            canApprove={canWriteLedger}
          />
        )}
        {qrOpen && <QrLabelDialog open={qrOpen} onOpenChange={setQrOpen} asset={asset} companyName={selectedCompany?.name} />}
        {reserveAssignOpen && (
          <DevelopmentReserveAssignDialog
            open={reserveAssignOpen}
            onOpenChange={setReserveAssignOpen}
            asset={asset}
          />
        )}
        {unplannedDepOpen && (
          <UnplannedDepreciationDialog
            open={unplannedDepOpen}
            onOpenChange={setUnplannedDepOpen}
            asset={asset}
            events={events}
          />
        )}
      </Suspense>
    </div>
  );
}
