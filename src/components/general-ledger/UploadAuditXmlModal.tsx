import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/integrations/supabase/client';
import { useCompany } from '@/contexts/CompanyContext';
import { useToast } from '@/hooks/use-toast';
import { useActivePreset } from '@/hooks/useActivePreset';
import {
  UploadCloud,
  FileText,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  FileSpreadsheet,
  Building2,
  Calendar,
  Layers,
  Users,
} from 'lucide-react';
import { CustomTooltip } from '@/components/ui/custom-tooltip';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';
import {
  detectRlbFileFormat,
  parseRlbAuditXml,
  parseRlbCsvLedger,
  readRlbFileAsText,
  type RlbDetectedFormat,
  type RlbXmlParseResult,
  type RlbCsvParseResult,
} from '@/lib/rlb/rlbParser';
import {
  importRlbAuditXml,
  importRlbCsvLedger,
  type RlbImportProgress,
} from '@/lib/rlb/rlbImportService';

interface UploadAuditXmlModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function UploadAuditXmlModal({ open, onOpenChange, onSuccess }: UploadAuditXmlModalProps) {
  const { t } = useTranslation(['accounting', 'common']);
  const { selectedCompany } = useCompany();
  const { toast } = useToast();
  const { presets } = useActivePreset(selectedCompany?.id);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [presetMode, setPresetMode] = useState<'original' | 'existing'>('original');
  const [selectedPresetId, setSelectedPresetId] = useState<string>('');
  const [uploading, setUploading] = useState(false);
  const [status, setStatus] = useState<'idle' | 'parsing' | 'uploading' | 'processing' | 'done' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [dryRun, setDryRun] = useState(false);
  const [previewData, setPreviewData] = useState<any | null>(null);

  // RLB client-side state
  const [detectedFormat, setDetectedFormat] = useState<RlbDetectedFormat>('unknown');
  const [parsedRlbXml, setParsedRlbXml] = useState<RlbXmlParseResult | null>(null);
  const [parsedRlbCsv, setParsedRlbCsv] = useState<RlbCsvParseResult | null>(null);
  const [importProgress, setImportProgress] = useState<RlbImportProgress | null>(null);

  const processSelectedFile = useCallback(async (selectedFile: File) => {
    setFile(selectedFile);
    setStatus('parsing');
    setErrorMsg('');
    setParsedRlbXml(null);
    setParsedRlbCsv(null);
    setDetectedFormat('unknown');

    try {
      const rawText = await readRlbFileAsText(selectedFile);
      const fmt = detectRlbFileFormat(rawText, selectedFile.name);
      setDetectedFormat(fmt);

      if (fmt === 'rlb_audit_xml') {
        const parsed = parseRlbAuditXml(rawText);
        setParsedRlbXml(parsed);
      } else if (fmt === 'rlb_csv_ledger') {
        const parsed = parseRlbCsvLedger(rawText, selectedFile.name);
        setParsedRlbCsv(parsed);
      }
      setStatus('idle');
    } catch (err: any) {
      console.error('File parsing error:', err);
      // Keep file attached so user can still attempt server upload if wanted, but show warning
      setDetectedFormat('unknown');
      setStatus('idle');
      if (selectedFile.name.endsWith('.csv')) {
        setErrorMsg(err.message || 'Nem sikerült feldolgozni az RLB CSV fájlt.');
      }
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile && (droppedFile.name.endsWith('.xml') || droppedFile.name.endsWith('.csv'))) {
      processSelectedFile(droppedFile);
    } else {
      toast({ title: 'Csak XML vagy CSV formátumú könyvelési fájl tölthető fel.', variant: 'destructive' });
    }
  }, [processSelectedFile, toast]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) {
      processSelectedFile(selected);
    }
  }, [processSelectedFile]);

  const handleUpload = async () => {
    if (!file || !selectedCompany?.id) return;

    setUploading(true);
    setStatus('uploading');
    setErrorMsg('');
    setImportProgress(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();

      // CASE A: Client-side parsed RLB Audit XML
      if (detectedFormat === 'rlb_audit_xml' && parsedRlbXml) {
        // 1. Upload XML to storage in background (audit trail / archive)
        let storagePath: string | null = null;
        try {
          const safeFileName = file.name
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
            .replace(/\s+/g, '_')
            .replace(/[^a-zA-Z0-9._-]/g, '');
          storagePath = `audit-xml/${selectedCompany.id}/${safeFileName}`;
          await supabase.storage
            .from('gl_uploads')
            .upload(storagePath, file, { upsert: true });
        } catch (storageErr) {
          console.warn('Storage upload error (continuing with database import):', storageErr);
        }

        // 2. Run client-side batch ingestion service
        const importResult = await importRlbAuditXml({
          companyId: selectedCompany.id,
          userId: user?.id,
          fileName: file.name,
          storagePath,
          xmlResult: parsedRlbXml,
          presetMode,
          selectedPresetId,
          dryRun,
          onProgress: setImportProgress,
        });

        if (!importResult.success) {
          throw new Error(importResult.error || 'Hiba történt az RLB XML importálása közben.');
        }

        if (dryRun) {
          setPreviewData({
            period_start: parsedRlbXml.meta.periodStart,
            period_end: parsedRlbXml.meta.periodEnd,
            source_program: parsedRlbXml.meta.sourceProgram,
            source_version: parsedRlbXml.meta.sourceVersion,
            account_count: importResult.accountsImported,
            entry_count: importResult.entriesImported,
            voucher_count: importResult.vouchersImported,
            partner_count: importResult.partnersImported,
          });
          setStatus('done');
          setUploading(false);
          toast({
            title: 'RLB Próbafuttatás sikeres',
            description: `${importResult.accountsImported} számla, ${importResult.entriesImported} tétel ellenőrizve.`,
            className: 'bg-green-50 text-green-900 border-green-200',
          });
          return;
        }

        setStatus('done');
        toast({
          title: 'RLB Importálás sikeresen befejeződött!',
          description: `${importResult.accountsImported} számla és ${importResult.entriesImported} naplósor elmentve.`,
          className: 'bg-green-50 text-green-900 border-green-200',
        });

        onSuccess?.();
        setTimeout(() => {
          onOpenChange(false);
          resetState();
        }, 2000);
        return;
      }

      // CASE B: Client-side parsed RLB CSV (Főkönyvi Kivonat)
      if (detectedFormat === 'rlb_csv_ledger' && parsedRlbCsv) {
        const importResult = await importRlbCsvLedger({
          companyId: selectedCompany.id,
          userId: user?.id,
          fileName: file.name,
          csvResult: parsedRlbCsv,
          presetMode,
          selectedPresetId,
          onProgress: setImportProgress,
        });

        if (!importResult.success) {
          throw new Error(importResult.error || 'Hiba történt az RLB CSV importálása közben.');
        }

        setStatus('done');
        toast({
          title: 'RLB Főkönyvi számlatükör sikeresen importálva!',
          description: `${importResult.accountsImported} főkönyvi számla elmentve a számlatükörbe.`,
          className: 'bg-green-50 text-green-900 border-green-200',
        });

        onSuccess?.();
        setTimeout(() => {
          onOpenChange(false);
          resetState();
        }, 2000);
        return;
      }

      // CASE C: Fallback standard backend storage upload + worker queue
      const safeFileName = file.name
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/\s+/g, '_')
        .replace(/[^a-zA-Z0-9._-]/g, '');
      const storagePath = `audit-xml/${selectedCompany.id}/${safeFileName}`;
      const { error: storageError } = await supabase.storage
        .from('gl_uploads')
        .upload(storagePath, file, { upsert: true });

      if (storageError) throw new Error(`Storage: ${storageError.message}`);

      setStatus('processing');

      const importRow = {
        company_id: selectedCompany.id,
        file_name: file.name,
        storage_path: storagePath,
        period_start: '2026-01-01',
        period_end: '2026-12-31',
        processing_status: 'pending',
        imported_by: user?.id || null,
        dry_run: dryRun,
        ...(presetMode === 'existing' && selectedPresetId ? { preset_id: selectedPresetId } : {}),
      };

      const { data: insertedData, error: insertError } = await supabase
        .from('gl_audit_imports')
        .insert(importRow)
        .select('id')
        .single();

      if (insertError || !insertedData) throw new Error(`Import: ${insertError?.message || t('accounting:dialogs.upload_audit_xml.status_check_error')}`);

      if (dryRun) {
        let attempts = 0;
        const checkStatus = setInterval(async () => {
          attempts++;
          const { data: rowData, error: queryError } = await supabase
            .from('gl_audit_imports')
            .select('*')
            .eq('id', insertedData.id)
            .single();

          if (queryError || !rowData) {
            clearInterval(checkStatus);
            setStatus('error');
            setErrorMsg(t('accounting:dialogs.upload_audit_xml.status_check_error'));
            setUploading(false);
            return;
          }

          if (rowData.processing_status === 'completed') {
            clearInterval(checkStatus);
            setPreviewData(rowData);
            setStatus('done');
            setUploading(false);
            toast({
              title: t('accounting:dialogs.upload_audit_xml.dry_run_completed_toast_title'),
              description: t('accounting:dialogs.upload_audit_xml.dry_run_completed_toast_desc'),
              className: 'bg-green-50 text-green-900 border-green-200',
            });
          } else if (rowData.processing_status === 'error') {
            clearInterval(checkStatus);
            setStatus('error');
            setErrorMsg(rowData.error_message || t('accounting:dialogs.upload_audit_xml.dry_run_error'));
            setUploading(false);
          } else if (attempts > 40) {
            clearInterval(checkStatus);
            setStatus('error');
            setErrorMsg(t('accounting:dialogs.upload_audit_xml.timeout_error'));
            setUploading(false);
          }
        }, 1500);
      } else {
        setStatus('done');
        toast({
          title: t('accounting:dialogs.upload_audit_xml.upload_success_toast_title'),
          description: t('accounting:dialogs.upload_audit_xml.upload_success_toast_desc'),
          className: 'bg-green-50 text-green-900 border-green-200',
        });

        onSuccess?.();
        setTimeout(() => {
          onOpenChange(false);
          resetState();
        }, 2000);
      }

    } catch (err: any) {
      setStatus('error');
      setErrorMsg(err.message || t('accounting:dialogs.upload_audit_xml.unknown_error'));
      toast({ title: t('accounting:dialogs.upload_audit_xml.upload_error_toast_title'), description: err.message, variant: 'destructive' });
      setUploading(false);
    }
  };

  const resetState = () => {
    setFile(null);
    setStatus('idle');
    setErrorMsg('');
    setPresetMode('original');
    setSelectedPresetId('');
    setDryRun(false);
    setPreviewData(null);
    setDetectedFormat('unknown');
    setParsedRlbXml(null);
    setParsedRlbCsv(null);
    setImportProgress(null);
  };

  const isPreviewDone = status === 'done' && dryRun && previewData;

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) resetState(); }}>
      <DialogContent className={cn("transition-all duration-200", (parsedRlbXml || parsedRlbCsv) ? "sm:max-w-[560px]" : "sm:max-w-[520px]")}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <FileText className="w-5 h-5 text-primary" />
            {t('accounting:dialogs.upload_audit_xml.title')}
          </DialogTitle>
          <DialogDescription>
            {isPreviewDone 
              ? t('accounting:dialogs.upload_audit_xml.preview_done_desc')
              : 'Audit XML (.xml) vagy RLB Főkönyvi Kivonat (.csv) fájl importálása és azonnali számlatükör szinkronizáció.'
            }
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {isPreviewDone ? (
            <div className="space-y-4 content-animate">
              <div className="flex items-center gap-3 p-3.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="w-5 h-5 shrink-0" />
                <div>
                  <p className="font-bold text-sm">{t('accounting:dialogs.upload_audit_xml.dry_run_success_title')}</p>
                  <p className="text-xs opacity-90">{t('accounting:dialogs.upload_audit_xml.dry_run_success_desc')}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-card border p-3 rounded-xl">
                  <div className="text-[10px] text-muted-foreground">{t('accounting:dialogs.upload_audit_xml.period')}</div>
                  <div className="text-xs font-semibold mt-0.5">
                    {previewData.period_start?.replace(/-/g, '.')} – {previewData.period_end?.replace(/-/g, '.')}
                  </div>
                </div>
                <div className="bg-card border p-3 rounded-xl">
                  <div className="text-[10px] text-muted-foreground">{t('accounting:dialogs.upload_audit_xml.source_program')}</div>
                  <CustomTooltip content={`${previewData.source_program} ${previewData.source_version || ''}`} side="top">
                    <div className="text-xs font-semibold mt-0.5 truncate">
                      {previewData.source_program || t('accounting:dialogs.upload_audit_xml.unknown')}
                    </div>
                  </CustomTooltip>
                </div>
                <div className="bg-card border p-3 rounded-xl">
                  <div className="text-[10px] text-muted-foreground">{t('accounting:dialogs.upload_audit_xml.accounts_count')}</div>
                  <div className="text-sm font-bold mt-0.5 tabular-nums text-foreground">
                    {previewData.account_count?.toLocaleString()} {t('accounting:dialogs.upload_audit_xml.count_unit')}
                  </div>
                </div>
                <div className="bg-card border p-3 rounded-xl">
                  <div className="text-[10px] text-muted-foreground">{t('accounting:dialogs.upload_audit_xml.entries_count')}</div>
                  <div className="text-sm font-bold mt-0.5 tabular-nums text-foreground">
                    {previewData.entry_count?.toLocaleString()} {t('accounting:dialogs.upload_audit_xml.count_unit')}
                  </div>
                </div>
                <div className="bg-card border p-3 rounded-xl">
                  <div className="text-[10px] text-muted-foreground">{t('accounting:dialogs.upload_audit_xml.vouchers_count')}</div>
                  <div className="text-sm font-bold mt-0.5 tabular-nums text-foreground">
                    {previewData.voucher_count?.toLocaleString()} {t('accounting:dialogs.upload_audit_xml.count_unit')}
                  </div>
                </div>
                <div className="bg-card border p-3 rounded-xl">
                  <div className="text-[10px] text-muted-foreground">{t('accounting:dialogs.upload_audit_xml.partners_count')}</div>
                  <div className="text-sm font-bold mt-0.5 tabular-nums text-foreground">
                    {previewData.partner_count?.toLocaleString()} {t('accounting:dialogs.upload_audit_xml.count_unit')}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <>
              {/* Drop zone */}
              <div
                className={cn(
                  "border-2 border-dashed rounded-xl p-6 text-center transition-all cursor-pointer",
                  isDragging && "border-primary bg-primary/5 scale-[1.01]",
                  file ? "border-emerald-400 bg-emerald-50/50 dark:bg-emerald-900/10" : "border-border hover:border-primary/50 hover:bg-muted/30",
                )}
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xml,.csv"
                  className="hidden"
                  onChange={handleFileSelect}
                />
                {file ? (
                  <div className="flex flex-col items-center gap-1.5">
                    {status === 'parsing' ? (
                      <Loader2 className="w-7 h-7 text-primary animate-spin" />
                    ) : (
                      <CheckCircle2 className="w-7 h-7 text-emerald-500" />
                    )}
                    <p className="font-medium text-sm text-foreground truncate max-w-[420px]">{file.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {(file.size / 1_048_576).toFixed(2)} MB
                      {status === 'parsing' ? ' • Elemzés folyamatban...' : ''}
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2">
                    <UploadCloud className="w-8 h-8 text-muted-foreground/60" />
                    <p className="text-sm font-medium">Húzd ide a fájlt vagy kattints a tallózáshoz</p>
                    <p className="text-xs text-muted-foreground">Támogatott: RLB Könyvvizsgálói XML (.xml) vagy RLB Főkönyvi Kivonat (.csv)</p>
                  </div>
                )}
              </div>

              {/* RLB XML Live Preview Card */}
              {detectedFormat === 'rlb_audit_xml' && parsedRlbXml && (
                <div className="rounded-xl border border-indigo-500/20 bg-indigo-50/40 dark:bg-indigo-950/20 p-4 space-y-3 animate-in fade-in-50 duration-200">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <Badge variant="outline" className="bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border-indigo-500/30 gap-1.5 font-semibold py-1">
                      <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
                      RLB 26.6 Könyvvizsgálói Feladás
                    </Badge>
                    <div className="text-[11px] text-muted-foreground flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5" />
                      {parsedRlbXml.meta.periodStart?.replace(/-/g, '.')} – {parsedRlbXml.meta.periodEnd?.replace(/-/g, '.')}
                    </div>
                  </div>

                  <div className="text-xs text-foreground/80 flex items-center gap-2">
                    <Building2 className="w-3.5 h-3.5 text-muted-foreground" />
                    <span className="font-semibold">{parsedRlbXml.meta.companyName || 'Cég'}</span>
                    {parsedRlbXml.meta.taxNumber && (
                      <span className="text-muted-foreground">({parsedRlbXml.meta.taxNumber})</span>
                    )}
                  </div>

                  <div className="grid grid-cols-4 gap-2 pt-1 text-center">
                    <div className="bg-background/80 rounded-lg p-2 border border-border/50">
                      <div className="text-[10px] text-muted-foreground">Számlák</div>
                      <div className="text-sm font-bold text-foreground tabular-nums">
                        {parsedRlbXml.accounts.length}
                      </div>
                    </div>
                    <div className="bg-background/80 rounded-lg p-2 border border-border/50">
                      <div className="text-[10px] text-muted-foreground">Partnerek</div>
                      <div className="text-sm font-bold text-foreground tabular-nums">
                        {parsedRlbXml.partners.length}
                      </div>
                    </div>
                    <div className="bg-background/80 rounded-lg p-2 border border-border/50">
                      <div className="text-[10px] text-muted-foreground">Bizonylatok</div>
                      <div className="text-sm font-bold text-foreground tabular-nums">
                        {parsedRlbXml.meta.voucherCount}
                      </div>
                    </div>
                    <div className="bg-background/80 rounded-lg p-2 border border-border/50">
                      <div className="text-[10px] text-muted-foreground">Naplósorok</div>
                      <div className="text-sm font-bold text-foreground tabular-nums">
                        {parsedRlbXml.entries.length}
                      </div>
                    </div>
                  </div>

                  {parsedRlbXml.stats.isBalanced ? (
                    <div className="flex items-center gap-2 text-xs text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-2.5 py-1.5">
                      <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-500" />
                      <span>Kettős könyvviteli egyezőség: <strong>{parsedRlbXml.stats.totalDebit.toLocaleString()} Ft</strong> (T = K egyezik)</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-xs text-amber-700 dark:text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-lg px-2.5 py-1.5">
                      <AlertTriangle className="w-4 h-4 shrink-0 text-amber-500" />
                      <span>Eltérés: {parsedRlbXml.stats.balanceDiff.toLocaleString()} Ft (T: {parsedRlbXml.stats.totalDebit.toLocaleString()} / K: {parsedRlbXml.stats.totalCredit.toLocaleString()})</span>
                    </div>
                  )}
                </div>
              )}

              {/* RLB CSV Live Preview Card */}
              {detectedFormat === 'rlb_csv_ledger' && parsedRlbCsv && (
                <div className="rounded-xl border border-emerald-500/20 bg-emerald-50/40 dark:bg-emerald-950/20 p-4 space-y-3 animate-in fade-in-50 duration-200">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <Badge variant="outline" className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 gap-1.5 font-semibold py-1">
                      <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-500" />
                      RLB Főkönyvi Kivonat (CSV)
                    </Badge>
                    {parsedRlbCsv.companyName && (
                      <span className="text-xs font-semibold text-foreground/80">{parsedRlbCsv.companyName}</span>
                    )}
                  </div>

                  <div className="grid grid-cols-3 gap-2 pt-1 text-center">
                    <div className="bg-background/80 rounded-lg p-2 border border-border/50">
                      <div className="text-[10px] text-muted-foreground">Összes számla</div>
                      <div className="text-sm font-bold text-foreground tabular-nums">
                        {parsedRlbCsv.stats.totalAccounts}
                      </div>
                    </div>
                    <div className="bg-background/80 rounded-lg p-2 border border-border/50">
                      <div className="text-[10px] text-muted-foreground">Részletező</div>
                      <div className="text-sm font-bold text-foreground tabular-nums">
                        {parsedRlbCsv.stats.detailAccountsCount}
                      </div>
                    </div>
                    <div className="bg-background/80 rounded-lg p-2 border border-border/50">
                      <div className="text-[10px] text-muted-foreground">Összesítő</div>
                      <div className="text-sm font-bold text-foreground tabular-nums">
                        {parsedRlbCsv.stats.groupAccountsCount}
                      </div>
                    </div>
                  </div>

                  <div className="text-xs text-muted-foreground flex justify-between px-1">
                    <span>Forgalom T: <strong className="text-foreground">{parsedRlbCsv.stats.totalTurnoverDebit.toLocaleString()} Ft</strong></span>
                    <span>Forgalom K: <strong className="text-foreground">{parsedRlbCsv.stats.totalTurnoverCredit.toLocaleString()} Ft</strong></span>
                  </div>
                </div>
              )}

              {/* Progress bar during batch import */}
              {uploading && importProgress && (
                <div className="space-y-2 p-3 bg-muted/40 rounded-xl border border-border">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">{importProgress.message}</span>
                    {importProgress.total > 0 && (
                      <span className="tabular-nums font-semibold">
                        {Math.round((importProgress.current / importProgress.total) * 100)}%
                      </span>
                    )}
                  </div>
                  <Progress
                    value={
                      importProgress.total > 0
                        ? Math.round((importProgress.current / importProgress.total) * 100)
                        : undefined
                    }
                    className="h-2"
                  />
                </div>
              )}

              {/* Preset selection */}
              <div className="space-y-3">
                <Label className="text-sm font-medium">{t('accounting:dialogs.upload_audit_xml.preset_template')}</Label>
                <Select value={presetMode} onValueChange={(v: 'original' | 'existing') => setPresetMode(v)}>
                  <SelectTrigger className="h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="original">
                      <span className="flex items-center gap-2">
                        <FileText className="w-3.5 h-3.5 text-primary" />
                        {detectedFormat.startsWith('rlb_') 
                          ? `Új dedikált RLB sablon létrehozása (${parsedRlbXml?.meta?.companyName || parsedRlbCsv?.companyName || selectedCompany?.name || 'Cég'} - RLB Számlatükör)`
                          : t('accounting:dialogs.upload_audit_xml.preset_original')}
                      </span>
                    </SelectItem>
                    <SelectItem value="existing">
                      <span className="flex items-center gap-2">
                        <Layers className="w-3.5 h-3.5 text-amber-500" />
                        {t('accounting:dialogs.upload_audit_xml.preset_existing')}
                      </span>
                    </SelectItem>
                  </SelectContent>
                </Select>

                {presetMode === 'original' && (
                  <p className="text-xs text-muted-foreground px-1">
                    {detectedFormat.startsWith('rlb_')
                      ? 'Automatikusan létrehozza a céghez kötött számlatükör sablont és feltölti a fájlban szereplő főkönyvi számlaszámokkal.'
                      : t('accounting:dialogs.upload_audit_xml.preset_original_desc')}
                  </p>
                )}

                {presetMode === 'existing' && (
                  <Select value={selectedPresetId} onValueChange={setSelectedPresetId}>
                    <SelectTrigger className="h-10">
                      <SelectValue placeholder={t('accounting:dialogs.upload_audit_xml.select_preset_placeholder')} />
                    </SelectTrigger>
                    <SelectContent>
                      {presets?.map(p => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name} {p.type === 'generic' ? ` ${t('accounting:dialogs.upload_audit_xml.builtin_badge')}` : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              {/* Dry Run Checkbox (only relevant for XML) */}
              {detectedFormat !== 'rlb_csv_ledger' && (
                <div className="flex items-start space-x-2.5 pt-2 border-t border-border/40">
                  <Checkbox
                    id="dry_run"
                    checked={dryRun}
                    onCheckedChange={(checked) => setDryRun(!!checked)}
                  />
                  <div className="grid gap-1 leading-none">
                    <Label
                      htmlFor="dry_run"
                      className="text-xs font-semibold leading-none cursor-pointer"
                    >
                      {t('accounting:dialogs.upload_audit_xml.dry_run_label')}
                    </Label>
                    <p className="text-[10px] text-muted-foreground">
                      {t('accounting:dialogs.upload_audit_xml.dry_run_desc')}
                    </p>
                  </div>
                </div>
              )}
            </>
          )}

          {/* Status display */}
          {status === 'error' && (
            <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 p-3 rounded-lg">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {status === 'done' && !dryRun && (
            <div className="flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50 dark:bg-emerald-900/20 dark:text-emerald-400 p-3 rounded-lg">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{t('accounting:dialogs.upload_audit_xml.upload_success')}</span>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          {isPreviewDone ? (
            <>
              <Button variant="outline" onClick={() => { onOpenChange(false); resetState(); }} className="w-full">
                {t('accounting:dialogs.upload_audit_xml.close')}
              </Button>
              <Button variant="secondary" onClick={resetState} className="w-full">
                {t('accounting:dialogs.upload_audit_xml.new_upload')}
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => { onOpenChange(false); resetState(); }} disabled={uploading}>
                {t('accounting:dialogs.upload_audit_xml.cancel')}
              </Button>
              <Button
                onClick={handleUpload}
                disabled={!file || uploading || (presetMode === 'existing' && !selectedPresetId)}
                className="gap-2"
              >
                {uploading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Feldolgozás folyamatban...</span>
                  </>
                ) : (
                  <>
                    <UploadCloud className="w-4 h-4" />
                    {detectedFormat === 'rlb_audit_xml'
                      ? (dryRun ? 'RLB Próbafuttatás' : 'Azonnali RLB Importálás')
                      : detectedFormat === 'rlb_csv_ledger'
                      ? 'RLB Számlatükör Mentése'
                      : (dryRun ? t('accounting:dialogs.upload_audit_xml.dry_run_action') : t('accounting:dialogs.upload_audit_xml.upload_action'))
                    }
                  </>
                )}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
