import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Trash2, Edit2, Check, X, Database, AlertTriangle, ArrowRight, ShieldAlert, CheckCircle2 } from 'lucide-react';
import { CustomTooltip } from '@/components/ui/custom-tooltip';
import { invalidateGlQueries } from '@/lib/cache';

interface Preset {
  id: string;
  name: string;
  type: string;
  company_id: string | null;
  is_active: boolean | null;
}

interface ManagePresetsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  presets: Preset[];
  companyId: string | undefined;
}

interface PresetUsage {
  preset_id: string;
  preset_name: string;
  is_active: boolean;
  company_id: string;
  accounts_count: number;
  journal_lines_count: number;
  invoices_count: number;
  transactions_count: number;
  nav_invoices_count: number;
  fixed_assets_count: number;
  annual_reports_count?: number;
  accrual_entries_count?: number;
  total_references: number;
  can_delete_directly: boolean;
  sample_used_accounts: { gl_number: string; short_name: string }[];
}

export function ManagePresetsModal({ open, onOpenChange, presets, companyId }: ManagePresetsModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [checkingUsageId, setCheckingUsageId] = useState<string | null>(null);

  const [confirmDialogState, setConfirmDialogState] = useState<{
    preset: Preset;
    usage: PresetUsage;
    targetPresetId?: string;
  } | null>(null);

  // Csak a céghez tartozó egyéni sablonokat listázzuk a fő listában
  const customPresets = presets.filter(p => p.type === 'custom' && p.company_id === companyId);
  // Lehetséges célsablonok: a cég többi sablonja vagy a beépített sablonok
  const availableTargetPresets = presets.filter(p => p.id !== confirmDialogState?.preset.id);

  const deleteMutation = useMutation({
    mutationKey: ['deletePreset', companyId],
    mutationFn: async ({ presetId, targetPresetId }: { presetId: string; targetPresetId?: string }) => {
      const { data, error } = await supabase.rpc('delete_chart_of_accounts_preset', {
        p_preset_id: presetId,
        p_target_preset_id: targetPresetId || null,
      });

      if (error) throw error;
      return data;
    },
    onSuccess: async (data: any) => {
      await queryClient.invalidateQueries({ queryKey: ['coaPresets', companyId] });
      if (companyId) {
        await invalidateGlQueries(queryClient, companyId, data?.deleted_preset_id);
        if (data?.target_preset_id) {
          await invalidateGlQueries(queryClient, companyId, data.target_preset_id);
        }
        await queryClient.invalidateQueries({ queryKey: ['glBalances'] });
        await queryClient.invalidateQueries({ queryKey: ['glItems'] });
        await queryClient.invalidateQueries({ queryKey: ['invoices', companyId] });
        await queryClient.invalidateQueries({ queryKey: ['transactions', companyId] });
      }
      setConfirmDialogState(null);

      const remappedTotal = 
        (data?.remapped_journal_lines || 0) + 
        (data?.remapped_transactions || 0) + 
        (data?.remapped_invoices || 0) +
        (data?.remapped_nav_invoices || 0) +
        (data?.remapped_fixed_assets || 0);

      if (remappedTotal > 0) {
        toast({
          title: 'Sablon törölve és tételek átkötve',
          description: `A(z) "${data?.deleted_preset_name}" sablon törölve. ${remappedTotal} db hivatkozás sikeresen átkötve az új számlatükörbe.`,
          className: 'bg-green-50 dark:bg-green-950/50 border-green-200 dark:border-green-800 text-green-900 dark:text-green-100',
        });
      } else {
        toast({
          title: 'Sablon törölve',
          description: 'A számlatükör sablon sikeresen eltávolításra került.',
        });
      }
    },
    onError: (error: any) => {
      toast({
        title: 'Törlési hiba',
        description: error.message || 'Nem sikerült a sablon törlése.',
        variant: 'destructive',
      });
    }
  });

  const renameMutation = useMutation({
    mutationKey: ['renamePreset', companyId],
    mutationFn: async ({ id, newName }: { id: string; newName: string }) => {
      if (!newName.trim()) throw new Error("A név nem lehet üres.");
      const { error } = await supabase
        .from('chart_of_accounts_presets')
        .update({ name: newName.trim() })
        .eq('id', id);
        
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['coaPresets', companyId] });
      setEditingId(null);
      toast({ title: 'Sikeres átnevezés', description: 'A sablon neve frissítésre került.' });
    },
    onError: (error: any) => {
      toast({ title: 'Hiba történt', description: error.message, variant: 'destructive' });
    }
  });

  const handleStartDelete = async (preset: Preset) => {
    if (preset.is_active) {
      toast({
        title: 'Aktív sablon nem törölhető',
        description: 'Ez a számlatükör jelenleg az aktív sablon a cégnél. Kérjük, előbb aktiválj egy másik sablont!',
        variant: 'destructive',
      });
      return;
    }

    setCheckingUsageId(preset.id);
    try {
      const { data, error } = await supabase.rpc('check_chart_of_accounts_preset_usage', {
        p_preset_id: preset.id,
      });

      if (error) throw error;

      const usage = data as unknown as PresetUsage;
      const targets = presets.filter(p => p.id !== preset.id);
      const defaultTarget = targets.find(p => p.is_active)?.id || targets[0]?.id;

      setConfirmDialogState({
        preset,
        usage,
        targetPresetId: defaultTarget,
      });
    } catch (err: any) {
      toast({
        title: 'Hiba az ellenőrzéskor',
        description: err.message || 'Nem sikerült ellenőrizni a számlatükör használatát.',
        variant: 'destructive',
      });
    } finally {
      setCheckingUsageId(null);
    }
  };

  const handleConfirmDelete = () => {
    if (!confirmDialogState) return;
    deleteMutation.mutate({
      presetId: confirmDialogState.preset.id,
      targetPresetId: confirmDialogState.usage.total_references > 0 ? confirmDialogState.targetPresetId : undefined,
    });
  };

  const startEditing = (preset: Preset) => {
    setEditingId(preset.id);
    setEditName(preset.name);
  };

  const saveEdit = (id: string) => {
    renameMutation.mutate({ id, newName: editName });
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl font-bold">
              <Database className="w-5 h-5 text-primary" />
              Egyéni Sablonok Kezelése
            </DialogTitle>
            <DialogDescription>
              Tekintsd meg, nevezd át vagy töröld az általad feltöltött egyéni számlatükör sablonokat.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-4 space-y-3 max-h-[300px] overflow-y-auto pr-2">
            {customPresets.length === 0 ? (
              <div className="text-center p-6 bg-muted/30 rounded-lg border border-dashed border-border/60">
                <p className="text-muted-foreground text-sm">Még nem töltöttél fel saját számlatükröt.</p>
              </div>
            ) : (
              customPresets.map((preset) => {
                const isChecking = checkingUsageId === preset.id;
                const isDeleting = deleteMutation.isPending && deleteMutation.variables?.presetId === preset.id;

                return (
                  <div 
                    key={preset.id} 
                    className={`flex items-center justify-between p-3 rounded-lg border shadow-sm transition-colors ${
                      preset.is_active ? 'bg-primary/5 border-primary/20' : 'bg-card border-border/60'
                    }`}
                  >
                    <div className="flex-1 min-w-0 mr-4">
                      {editingId === preset.id ? (
                        <div className="flex items-center gap-2">
                          <Input
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            className="h-8 text-sm"
                            autoFocus
                            onKeyDown={(e) => e.key === 'Enter' && saveEdit(preset.id)}
                          />
                        </div>
                      ) : (
                        <div className="flex flex-col">
                          <span className="font-medium text-sm truncate">{preset.name}</span>
                          {preset.is_active && (
                            <span className="text-[10px] font-semibold text-primary uppercase tracking-wider mt-0.5">
                              Aktiválva
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      {editingId === preset.id ? (
                        <>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-100 dark:hover:bg-green-950/40"
                            onClick={() => saveEdit(preset.id)}
                            disabled={renameMutation.isPending}
                          >
                            {renameMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground"
                            onClick={() => setEditingId(null)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={`Sablon átnevezése: ${preset.name}`}
                            className="h-8 w-8 text-muted-foreground hover:text-foreground"
                            onClick={() => startEditing(preset)}
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          
                          {preset.is_active ? (
                            <CustomTooltip content="Az aktív számlatükör sablon nem törölhető. Előbb aktiválj egy másik sablont!">
                              <span>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  aria-label={`Aktív sablon nem törölhető: ${preset.name}`}
                                  className="h-8 w-8 text-muted-foreground/40 cursor-not-allowed"
                                  disabled
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </span>
                            </CustomTooltip>
                          ) : (
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label={`Sablon törlése: ${preset.name}`}
                              className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-100 dark:hover:bg-red-950/40"
                              onClick={() => handleStartDelete(preset)}
                              disabled={isChecking || isDeleting}
                            >
                              {isChecking || isDeleting ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Trash2 className="h-4 w-4" />
                              )}
                            </Button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="flex justify-end mt-4 pt-4 border-t border-border/40">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Bezárás
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Biztonságos Törlési & Átkötési AlertDialog (P-067 és Visibill-dev előírás) */}
      <AlertDialog open={!!confirmDialogState} onOpenChange={(val) => !val && !deleteMutation.isPending && setConfirmDialogState(null)}>
        <AlertDialogContent className="max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="w-5 h-5 text-destructive" />
              Számlatükör Sablon Törlése
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-sm text-foreground/90 mt-2">
                <p>
                  Biztosan törölni szeretnéd a(z) <strong className="font-semibold text-foreground">"{confirmDialogState?.preset.name}"</strong> sablont?
                </p>

                {confirmDialogState?.usage.total_references === 0 ? (
                  <div className="p-3 bg-muted/40 rounded-lg border text-xs text-muted-foreground">
                    A sablonhoz tartozó {confirmDialogState?.usage.accounts_count} db főkönyvi számla véglegesen törlődik. A sablonra jelenleg nem hivatkozik könyvelési adat.
                  </div>
                ) : (
                  <div className="space-y-3 p-3.5 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                    <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400 font-medium text-xs">
                      <ShieldAlert className="w-4 h-4 shrink-0" />
                      Ez a számlatükör jelenleg használatban van:
                    </div>
                    <ul className="list-disc list-inside text-xs space-y-1 text-muted-foreground pl-1">
                      {confirmDialogState?.usage.journal_lines_count ? (
                        <li><strong className="text-foreground">{confirmDialogState.usage.journal_lines_count} db</strong> lekönyvelt naplótétel</li>
                      ) : null}
                      {confirmDialogState?.usage.transactions_count ? (
                        <li><strong className="text-foreground">{confirmDialogState.usage.transactions_count} db</strong> banki tranzakció</li>
                      ) : null}
                      {confirmDialogState?.usage.invoices_count ? (
                        <li><strong className="text-foreground">{confirmDialogState.usage.invoices_count} db</strong> számla</li>
                      ) : null}
                      {confirmDialogState?.usage.nav_invoices_count ? (
                        <li><strong className="text-foreground">{confirmDialogState.usage.nav_invoices_count} db</strong> NAV számla</li>
                      ) : null}
                      {confirmDialogState?.usage.fixed_assets_count ? (
                        <li><strong className="text-foreground">{confirmDialogState.usage.fixed_assets_count} db</strong> tárgyi eszköz</li>
                      ) : null}
                      {confirmDialogState?.usage.annual_reports_count ? (
                        <li><strong className="text-foreground">{confirmDialogState.usage.annual_reports_count} db</strong> éves beszámoló</li>
                      ) : null}
                      {confirmDialogState?.usage.accrual_entries_count ? (
                        <li><strong className="text-foreground">{confirmDialogState.usage.accrual_entries_count} db</strong> elhatárolás</li>
                      ) : null}
                    </ul>

                    {availableTargetPresets.length === 0 ? (
                      <p className="text-xs text-destructive font-medium">
                        Nem törölhető, mert nincs másik számlatükör sablon, amibe a hivatkozott tételeket átköthetnénk. Előbb hozz létre vagy aktiválj egy másik sablont!
                      </p>
                    ) : (
                      <div className="space-y-1.5 pt-1">
                        <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                          <ArrowRight className="w-3.5 h-3.5 text-primary" />
                          Hová kössük át a hivatkozásokat a törlés előtt?
                        </label>
                        <Select
                          value={confirmDialogState?.targetPresetId || ''}
                          onValueChange={(val) => setConfirmDialogState(prev => prev ? { ...prev, targetPresetId: val } : null)}
                        >
                          <SelectTrigger className="h-9 text-xs">
                            <SelectValue placeholder="Válassz célszámlatükröt..." />
                          </SelectTrigger>
                          <SelectContent>
                            {availableTargetPresets.map(target => (
                              <SelectItem key={target.id} value={target.id} className="text-xs">
                                {target.name} {target.is_active ? '(Aktív)' : ''}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <p className="text-[11px] text-muted-foreground leading-relaxed">
                          A rendszer automatikusan átköti a tételeket az azonos főkönyvi számú számlákra a kiválasztott sablonban.
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>

          <AlertDialogFooter className="mt-4">
            <AlertDialogCancel disabled={deleteMutation.isPending}>
              Mégse
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
              disabled={
                deleteMutation.isPending || 
                (confirmDialogState?.usage.total_references ? !confirmDialogState.targetPresetId || availableTargetPresets.length === 0 : false)
              }
              onClick={(e) => {
                e.preventDefault();
                handleConfirmDelete();
              }}
            >
              {deleteMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Törlés folyamatban...
                </>
              ) : confirmDialogState?.usage.total_references ? (
                'Átkötés és törlés'
              ) : (
                'Végleges törlés'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
