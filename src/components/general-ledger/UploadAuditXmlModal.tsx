import React, { useState, useCallback, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useCompany } from '@/contexts/CompanyContext';
import { useToast } from '@/hooks/use-toast';
import { useActivePreset } from '@/hooks/useActivePreset';
import { UploadCloud, FileText, Loader2, CheckCircle2, AlertTriangle } from 'lucide-react';
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
      // Sanitize filename for storage (no spaces, no special chars)
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
      const importRow: Record<string, any> = {
        company_id: selectedCompany.id,
        file_name: file.name,
        storage_path: storagePath,
        period_start: '2025-01-01',  // Will be updated by parser
        period_end: '2025-12-31',    // Will be updated by parser
        processing_status: 'pending',
        imported_by: user?.id || null,
      };

      // If using existing preset, set it
      if (presetMode === 'existing' && selectedPresetId) {
        importRow.preset_id = selectedPresetId;
      }

      const { error: insertError } = await supabase
        .from('gl_audit_imports')
        .insert(importRow);

      if (insertError) throw new Error(`Import hiba: ${insertError.message}`);

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

    } catch (err: any) {
      setStatus('error');
      setErrorMsg(err.message || 'Ismeretlen hiba');
      toast({ title: 'Hiba a feltöltés során', description: err.message, variant: 'destructive' });
    } finally {
      setUploading(false);
    }
  };

  const resetState = () => {
    setFile(null);
    setStatus('idle');
    setErrorMsg('');
    setPresetMode('original');
    setSelectedPresetId('');
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) resetState(); }}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <FileText className="w-5 h-5 text-primary" />
            Audit XML Import
          </DialogTitle>
          <DialogDescription>
            Importálj könyvelőprogramból exportált audit XML fájlt a főkönyvi kivonat megtekintéséhez.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
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

          {/* Status display */}
          {status === 'error' && (
            <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 p-3 rounded-lg">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {status === 'done' && (
            <div className="flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50 dark:bg-emerald-900/20 dark:text-emerald-400 p-3 rounded-lg">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>Feltöltés sikeres! A feldolgozás a háttérben folytatódik...</span>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => { onOpenChange(false); resetState(); }}>
            Mégse
          </Button>
          <Button
            onClick={handleUpload}
            disabled={!file || uploading || status === 'done' || (presetMode === 'existing' && !selectedPresetId)}
            className="gap-2"
          >
            {uploading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                {status === 'uploading' ? 'Feltöltés...' : 'Feldolgozás...'}
              </>
            ) : (
              <>
                <UploadCloud className="w-4 h-4" />
                Importálás
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
