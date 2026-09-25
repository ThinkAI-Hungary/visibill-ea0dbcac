import { useState, useRef } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  FileText,
  UploadCloud,
  CheckCircle2,
  Clock,
  Sparkles,
  Download,
  Trash2,
  RotateCw,
  AlertTriangle,
  Loader2,
  Eye,
  History,
  Shield,
  FileCheck,
} from 'lucide-react';
import { useAccountingPolicy } from '@/hooks/useAccountingPolicy';
import { AccountingPolicyRulesDialog } from './AccountingPolicyRulesDialog';
import { formatFileSize } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import type { CompanyAccountingPolicy } from '@/types/accountingPolicy';

interface Props {
  companyId?: string;
  isOwner: boolean;
}

export function AccountingPolicySection({ companyId, isOwner }: Props) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [showRulesDialog, setShowRulesDialog] = useState(false);
  const [selectedPolicyForRules, setSelectedPolicyForRules] = useState<CompanyAccountingPolicy | null>(null);
  const [showHistory, setShowHistory] = useState(false);

  const {
    policies,
    activePolicy,
    latestPolicy,
    rules,
    isLoading,
    uploadPolicyMutation,
    processPolicyMutation,
    activatePolicyMutation,
    updateRuleMutation,
    deletePolicyMutation,
    getPolicyDownloadUrl,
  } = useAccountingPolicy(companyId);

  const handleFileSelected = async (file: File) => {
    if (!companyId) return;

    const ext = file.name.split('.').pop()?.toLowerCase();
    if (ext !== 'pdf' && ext !== 'docx') {
      toast({
        variant: 'destructive',
        title: 'Nem támogatott fájlformátum',
        description: 'Kérjük, PDF vagy DOCX formátumú számviteli politikát tölts fel.',
      });
      return;
    }

    if (file.size > 50 * 1024 * 1024) {
      toast({
        variant: 'destructive',
        title: 'A fájl túl nagy',
        description: 'A maximális megengedett fájlméret 50 MB.',
      });
      return;
    }

    try {
      await uploadPolicyMutation.mutateAsync({ file });
    } catch (e) {
      // toast handled in hook
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
    if (!isOwner) return;

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileSelected(e.dataTransfer.files[0]);
    }
  };

  const handleDownload = async (policy: CompanyAccountingPolicy) => {
    try {
      const url = await getPolicyDownloadUrl(policy.file_path);
      const a = document.createElement('a');
      a.href = url;
      a.download = policy.file_name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Letöltési hiba',
        description: err.message || 'Nem sikerült letölteni a dokumentumot.',
      });
    }
  };

  const handleOpenRules = (policy: CompanyAccountingPolicy) => {
    setSelectedPolicyForRules(policy);
    setShowRulesDialog(true);
  };

  const currentDisplayPolicy = latestPolicy || activePolicy;
  const isProcessing = uploadPolicyMutation.isPending || (currentDisplayPolicy?.status === 'processing');

  return (
    <div className="space-y-4 pt-3 border-t border-border/60">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div className="flex items-center gap-2">
          <Shield className="h-4.5 w-4.5 text-primary shrink-0" />
          <h3 className="text-base font-semibold tracking-tight text-foreground">
            Számviteli politika
          </h3>
          <Badge variant="outline" className="text-[11px] font-normal text-muted-foreground border-border/60">
            Opcionális
          </Badge>
          {activePolicy && (
            <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 text-[11px]">
              <CheckCircle2 className="h-3 w-3 mr-1" />
              Aktív szabályzat (v{activePolicy.version})
            </Badge>
          )}
        </div>

        {policies.length > 1 && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setShowHistory(prev => !prev)}
            className="h-7 text-xs text-muted-foreground hover:text-foreground gap-1 px-2"
          >
            <History className="h-3.5 w-3.5" />
            {showHistory ? 'Előzmények elrejtése' : `Verziótörténet (${policies.length})`}
          </Button>
        )}
      </div>

      <p className="text-xs text-muted-foreground leading-relaxed">
        Töltsd fel a cég hivatalos számviteli politikáját (PDF vagy DOCX formátumban). Rendszerünk automatikusan elemzi a dokumentumot, kinyeri a cég könyvelési szabályait (kisértékű eszköz leírási határ, értékcsökkenési kulcsok, pénzkezelési limitek, devizaértékelés), és ezeket érvényesíti a könyvelési modulokban.
      </p>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        className="hidden"
        onChange={(e) => {
          if (e.target.files && e.target.files[0]) {
            handleFileSelected(e.target.files[0]);
          }
        }}
      />

      {/* Current Policy Card (if exists) */}
      {currentDisplayPolicy && (
        <div className="bg-card border border-border/80 rounded-xl p-4 shadow-2xs space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-lg bg-primary/10 text-primary shrink-0 mt-0.5">
                <FileText className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h4 className="font-semibold text-sm truncate max-w-sm" title={currentDisplayPolicy.file_name}>
                    {currentDisplayPolicy.file_name}
                  </h4>
                  <Badge variant="outline" className="text-[10px] font-mono">
                    v{currentDisplayPolicy.version}
                  </Badge>
                  {currentDisplayPolicy.is_active ? (
                    <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 text-[10px]">
                      Élesített
                    </Badge>
                  ) : currentDisplayPolicy.status === 'processing' ? (
                    <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30 text-[10px] flex items-center gap-1">
                      <Loader2 className="h-2.5 w-2.5 animate-spin" />
                      Feldolgozás alatt
                    </Badge>
                  ) : currentDisplayPolicy.status === 'error' ? (
                    <Badge variant="destructive" className="text-[10px]">
                      Feldolgozási hiba
                    </Badge>
                  ) : (
                    <Badge className="bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30 text-[10px]">
                      Jóváhagyásra vár
                    </Badge>
                  )}
                </div>

                <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                  <span>{formatFileSize(currentDisplayPolicy.file_size)}</span>
                  <span>&bull;</span>
                  <span>Feltöltve: {new Date(currentDisplayPolicy.created_at).toLocaleDateString('hu-HU')}</span>
                  {rules.length > 0 && (
                    <>
                      <span>&bull;</span>
                      <span className="text-primary font-medium">{rules.length} kinyert szabály</span>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
              {rules.length > 0 && (
                <Button
                  type="button"
                  size="sm"
                  variant={currentDisplayPolicy.is_active ? 'outline' : 'default'}
                  onClick={() => handleOpenRules(currentDisplayPolicy)}
                  className="h-8 text-xs gap-1.5 font-medium"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  Szabályok megtekintése
                </Button>
              )}

              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => handleDownload(currentDisplayPolicy)}
                className="h-8 text-xs gap-1"
                title="Dokumentum letöltése"
              >
                <Download className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Letöltés</span>
              </Button>

              {isOwner && (
                <>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isProcessing}
                    className="h-8 text-xs gap-1"
                    title="Új verzió feltöltése"
                  >
                    <UploadCloud className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Új verzió</span>
                  </Button>

                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      if (confirm('Biztosan törölni szeretnéd a feltöltött számviteli politikát és annak szabályait?')) {
                        deletePolicyMutation.mutate(currentDisplayPolicy);
                      }
                    }}
                    disabled={deletePolicyMutation.isPending}
                    className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                    title="Törlés"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </>
              )}
            </div>
          </div>

          {currentDisplayPolicy.status === 'processing' && (
            <div className="flex items-center gap-2 text-xs text-amber-600 dark:text-amber-400 bg-amber-500/10 p-2.5 rounded-lg border border-amber-500/20">
              <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" />
              <span>A dokumentum szövegének elemzése és a számviteli szabályok automatikus kinyerése folyamatban van...</span>
            </div>
          )}

          {currentDisplayPolicy.status === 'error' && (
            <div className="flex items-center justify-between gap-2 text-xs text-destructive bg-destructive/10 p-2.5 rounded-lg border border-destructive/20">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                <span>{currentDisplayPolicy.error_message || 'Hiba történt a dokumentum feldolgozása közben.'}</span>
              </div>
              {isOwner && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => processPolicyMutation.mutate({ policyId: currentDisplayPolicy.id })}
                  disabled={processPolicyMutation.isPending}
                  className="h-6.5 text-[11px] px-2 gap-1 border-destructive/30 hover:bg-destructive/20"
                >
                  <RotateCw className={`h-3 w-3 ${processPolicyMutation.isPending ? 'animate-spin' : ''}`} />
                  Újrapróbálás
                </Button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Upload Dropzone (shown if no policy exists OR during drag & drop) */}
      {(!currentDisplayPolicy || isDragOver) && (
        <div
          onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={handleDrop}
          onClick={() => isOwner && !isProcessing && fileInputRef.current?.click()}
          className={`
            border-2 border-dashed rounded-xl p-6 text-center transition-all cursor-pointer
            ${isDragOver 
              ? 'border-primary bg-primary/10 scale-[1.005]' 
              : 'border-border/70 hover:border-primary/50 hover:bg-muted/30 bg-muted/10'}
            ${!isOwner ? 'opacity-60 cursor-not-allowed' : ''}
          `}
        >
          <div className="flex flex-col items-center justify-center gap-2">
            <div className="p-3 rounded-full bg-primary/10 text-primary">
              {isProcessing ? (
                <Loader2 className="h-6 w-6 animate-spin" />
              ) : (
                <UploadCloud className="h-6 w-6" />
              )}
            </div>
            <div>
              <p className="text-sm font-semibold">
                {isProcessing
                  ? 'Dokumentum feldolgozása és szabályok kinyerése...'
                  : 'Húzd ide a számviteli politika fájlt, vagy kattints a tallózáshoz'}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Támogatott formátumok: PDF vagy DOCX (max. 50 MB)
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Version History List (Collapsible) */}
      {showHistory && policies.length > 0 && (
        <div className="bg-muted/20 border border-border/60 rounded-lg p-3 space-y-2 mt-2">
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <History className="h-3 w-3" />
            Korábbi szabályzatok története
          </h4>
          <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
            {policies.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between text-xs p-2 rounded-md bg-background border border-border/40 hover:bg-muted/30 transition-colors"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-mono font-semibold text-muted-foreground">v{p.version}</span>
                  <span className="truncate max-w-[200px]" title={p.file_name}>{p.file_name}</span>
                  {p.is_active && (
                    <Badge className="h-4 text-[9px] px-1 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30">
                      Aktív
                    </Badge>
                  )}
                  <span className="text-[11px] text-muted-foreground">
                    ({new Date(p.created_at).toLocaleDateString('hu-HU')})
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => handleOpenRules(p)}
                    className="h-6 px-1.5 text-[11px] gap-1"
                  >
                    <Eye className="h-3 w-3" />
                    Szabályok
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDownload(p)}
                    className="h-6 w-6 p-0"
                    title="Letöltés"
                  >
                    <Download className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Rules Review & Confirmation Dialog */}
      <AccountingPolicyRulesDialog
        open={showRulesDialog}
        onOpenChange={setShowRulesDialog}
        policy={selectedPolicyForRules}
        rules={rules}
        onActivate={async (policyId) => {
          await activatePolicyMutation.mutateAsync(policyId);
        }}
        onUpdateRule={async (ruleId, val, status) => {
          await updateRuleMutation.mutateAsync({ ruleId, ruleValue: val, status });
        }}
        isActivating={activatePolicyMutation.isPending}
        isOwner={isOwner}
      />
    </div>
  );
}
