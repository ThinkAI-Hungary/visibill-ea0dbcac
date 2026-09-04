import React, { useState, useCallback, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { supabase } from '@/integrations/supabase/client';
import { useCompany } from '@/contexts/CompanyContext';
import { useToast } from '@/hooks/use-toast';
import { useActivePreset } from '@/hooks/useActivePreset';
import { UploadCloud, FileText, Loader2, CheckCircle2, AlertTriangle } from 'lucide-react';
import { CustomTooltip } from '@/components/ui/custom-tooltip';
import { cn } from '@/lib/utils';

interface UploadAuditXmlModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function UploadAuditXmlModal({ open, onOpenChange, onSuccess }: UploadAuditXmlModalProps) {
  const { selectedCompany } = useCompany();
  const { toast } = useToast();
  const { presets } = useActivePreset(selectedCompany?.id);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [presetMode, setPresetMode] = useState<'original' | 'existing'>('original');
  const [selectedPresetId, setSelectedPresetId] = useState<string>('');
  const [uploading, setUploading] = useState(false);
  const [status, setStatus] = useState<'idle' | 'uploading' | 'processing' | 'done' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [dryRun, setDryRun] = useState(false);
  const [previewData, setPreviewData] = useState<any | null>(null);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile && droppedFile.name.endsWith('.xml')) {
      setFile(droppedFile);
      setStatus('idle');
    } else {
      toast({ title: 'Csak XML fájlokat tölthetsz fel', variant: 'destructive' });
    }
  }, [toast]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) {
      setFile(selected);
      setStatus('idle');
    }
  }, []);

  const handleUpload = async () => {
    if (!file || !selectedCompany?.id) return;

    setUploading(true);
    setStatus('uploading');
    setErrorMsg('');

    try {
      const { data: { user } } = await supabase.auth.getUser();

      // 1. Upload XML to Supabase Storage
      const safeFileName = file.name
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')  // remove accents
        .replace(/\s+/g, '_')                              // spaces → underscores
        .replace(/[^a-zA-Z0-9._-]/g, '');                  // strip remaining special chars
      const storagePath = `audit-xml/${selectedCompany.id}/${safeFileName}`;
      const { error: storageError } = await supabase.storage
        .from('gl_uploads')
        .upload(storagePath, file, { upsert: true });

      if (storageError) throw new Error(`Storage hiba: ${storageError.message}`);

      setStatus('processing');

      // 2. Create gl_audit_imports row (status=pending triggers worker)
      const importRow = {
        company_id: selectedCompany.id,
        file_name: file.name,
        storage_path: storagePath,
        period_start: '2025-01-01',  // Will be updated by parser
        period_end: '2025-12-31',    // Will be updated by parser
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

      if (insertError || !insertedData) throw new Error(`Import hiba: ${insertError?.message || 'Nem sikerült elmenteni az import rekordot'}`);

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
            setErrorMsg('Nem sikerült ellenőrizni a státuszt.');
            setUploading(false);
            return;
          }

          if (rowData.processing_status === 'completed') {
            clearInterval(checkStatus);
            setPreviewData(rowData);
            setStatus('done');
            setUploading(false);
            toast({
              title: 'Ellenőrzés kész!',
              description: 'Az XML fájl elemzése sikeresen lefutott.',
              className: 'bg-green-50 text-green-900 border-green-200',
            });
          } else if (rowData.processing_status === 'error') {
            clearInterval(checkStatus);
            setStatus('error');
            setErrorMsg(rowData.error_message || 'Hiba történt a száraz futás során.');
            setUploading(false);
          } else if (attempts > 40) {
            clearInterval(checkStatus);
            setStatus('error');
            setErrorMsg('Időtúllépés az előnézet feldolgozása közben.');
            setUploading(false);
          }
        }, 1500);
      } else {
        setStatus('done');
        toast({
          title: 'XML feltöltve!',
          description: 'A feldolgozás megkezdődött. A főkönyvi adatok hamarosan megjelennek.',
          className: 'bg-green-50 text-green-900 border-green-200',
        });

        onSuccess?.();

        // Auto-close after 2 seconds
        setTimeout(() => {
          onOpenChange(false);
          resetState();
        }, 2000);
      }

    } catch (err: any) {
      setStatus('error');
      setErrorMsg(err.message || 'Ismeretlen hiba');
      toast({ title: 'Hiba a feltöltés során', description: err.message, variant: 'destructive' });
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
  };

  const isPreviewDone = status === 'done' && dryRun && previewData;

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) resetState(); }}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <FileText className="w-5 h-5 text-primary" />
            Audit XML Import
          </DialogTitle>
          <DialogDescription>
            {isPreviewDone 
              ? 'A fájl parszolása sikeresen befejeződött. Ellenőrizd az előnézeti adatokat.'
              : 'Importálj könyvelőprogramból exportált audit XML fájlt a főkönyvi kivonat megtekintéséhez.'
            }
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {isPreviewDone ? (
            <div className="space-y-4 content-animate">
              <div className="flex items-center gap-3 p-3.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-600">
                <CheckCircle2 className="w-5 h-5 shrink-0" />
                <div>
                  <p className="font-bold text-sm">Sikeres ellenőrzés (Dry Run)</p>
                  <p className="text-xs opacity-90">A fájl formailag helyes, nem történt adat-beszúrás.</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-card border p-3 rounded-xl">
                  <div className="text-[10px] text-muted-foreground">Időszak</div>
                  <div className="text-xs font-semibold mt-0.5">
                    {previewData.period_start?.replace(/-/g, '.')} – {previewData.period_end?.replace(/-/g, '.')}
                  </div>
                </div>
                <div className="bg-card border p-3 rounded-xl">
                  <div className="text-[10px] text-muted-foreground">Forrásprogram</div>
                  <CustomTooltip content={`${previewData.source_program} ${previewData.source_version || ''}`} side="top">
                    <div className="text-xs font-semibold mt-0.5 truncate">
                      {previewData.source_program || 'Ismeretlen'}
                    </div>
                  </CustomTooltip>
                </div>
                <div className="bg-card border p-3 rounded-xl">
                  <div className="text-[10px] text-muted-foreground">Főkönyvi számok</div>
                  <div className="text-sm font-bold mt-0.5 tabular-nums text-foreground">
                    {previewData.account_count?.toLocaleString()} db
                  </div>
                </div>
                <div className="bg-card border p-3 rounded-xl">
                  <div className="text-[10px] text-muted-foreground">Könyvelési tételek</div>
                  <div className="text-sm font-bold mt-0.5 tabular-nums text-foreground">
                    {previewData.entry_count?.toLocaleString()} db
                  </div>
                </div>
                <div className="bg-card border p-3 rounded-xl">
                  <div className="text-[10px] text-muted-foreground">Bizonylatok</div>
                  <div className="text-sm font-bold mt-0.5 tabular-nums text-foreground">
                    {previewData.voucher_count?.toLocaleString()} db
                  </div>
                </div>
                <div className="bg-card border p-3 rounded-xl">
                  <div className="text-[10px] text-muted-foreground">Partnerek</div>
                  <div className="text-sm font-bold mt-0.5 tabular-nums text-foreground">
                    {previewData.partner_count?.toLocaleString()} db
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <>
              {/* Drop zone */}
              <div
                className={cn(
                  "border-2 border-dashed rounded-xl p-8 text-center transition-all cursor-pointer",
                  isDragging && "border-primary bg-primary/5 scale-[1.02]",
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
                  accept=".xml"
                  className="hidden"
                  onChange={handleFileSelect}
                />
                {file ? (
                  <div className="flex flex-col items-center gap-2">
                    <CheckCircle2 className="w-8 h-8 text-emerald-500" />
                    <p className="font-medium text-sm">{file.name}</p>
                    <p className="text-xs text-muted-foreground">{(file.size / 1_048_576).toFixed(1)} MB</p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2">
                    <UploadCloud className="w-8 h-8 text-muted-foreground/60" />
                    <p className="text-sm font-medium">Húzd ide az XML fájlt</p>
                    <p className="text-xs text-muted-foreground">vagy kattints a tallózáshoz</p>
                  </div>
                )}
              </div>

              {/* Preset selection */}
              <div className="space-y-3">
                <Label className="text-sm font-medium">Számlatükör sablon</Label>
                <Select value={presetMode} onValueChange={(v: 'original' | 'existing') => setPresetMode(v)}>
                  <SelectTrigger className="h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="original">
                      <span className="flex items-center gap-2">
                        <FileText className="w-3.5 h-3.5 text-primary" />
                        Eredeti sablon (XML-ből)
                      </span>
                    </SelectItem>
                    <SelectItem value="existing">
                      <span className="flex items-center gap-2">
                        <FileText className="w-3.5 h-3.5 text-amber-500" />
                        Meglévő sablon használata
                      </span>
                    </SelectItem>
                  </SelectContent>
                </Select>

                {presetMode === 'original' && (
                  <p className="text-xs text-muted-foreground px-1">
                    Az XML fájlban található számlatükör automatikusan létrehozásra kerül új sablonként.
                  </p>
                )}

                {presetMode === 'existing' && (
                  <Select value={selectedPresetId} onValueChange={setSelectedPresetId}>
                    <SelectTrigger className="h-10">
                      <SelectValue placeholder="Válassz sablont..." />
                    </SelectTrigger>
                    <SelectContent>
                      {presets?.map(p => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name} {p.type === 'generic' ? '(Beépített)' : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              {/* Dry Run Checkbox */}
              <div className="flex items-start space-x-2.5 pt-3 border-t border-border/40">
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
                    Dry run (Csak előnézet)
                  </Label>
                  <p className="text-[10px] text-muted-foreground">
                    Ellenőrzi a fájl formátumát és beolvassa a darabszámokat tranzakciós mentés nélkül.
                  </p>
                </div>
              </div>
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
              <span>Feltöltés sikeres! A feldolgozás a háttérben folytatódik...</span>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          {isPreviewDone ? (
            <>
              <Button variant="outline" onClick={() => { onOpenChange(false); resetState(); }} className="w-full">
                Bezárás
              </Button>
              <Button variant="secondary" onClick={resetState} className="w-full">
                Új feltöltés
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => { onOpenChange(false); resetState(); }} disabled={uploading}>
                Mégse
              </Button>
              <Button
                onClick={handleUpload}
                disabled={!file || uploading || (presetMode === 'existing' && !selectedPresetId)}
                className="gap-2"
              >
                {uploading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {status === 'uploading' ? 'Feltöltés...' : 'Ellenőrzés...'}
                  </>
                ) : (
                  <>
                    <UploadCloud className="w-4 h-4" />
                    {dryRun ? 'Ellenőrzés indítása' : 'Importálás'}
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
