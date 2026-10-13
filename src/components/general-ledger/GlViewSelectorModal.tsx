import React, { useState, useMemo, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  Table2, UploadCloud, Search, Check, Sparkles, 
  Trash2, Layers, CheckCircle2, ArrowRight, Loader2,
  FileSpreadsheet
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { CustomTooltip } from '@/components/ui/custom-tooltip';
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
import { useGlViewTemplates } from '@/hooks/useGlViewTemplates';
import { GlTemplatePreview } from '@/components/general-ledger/GlTemplatePreview';
import { GlTemplateUploadDialog } from '@/components/general-ledger/GlTemplateUploadDialog';
import type { GlViewTemplate, GlSampleRow } from '@/types/glTemplate';
import { cn } from '@/lib/utils';

interface GlViewSelectorModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function GlViewSelectorModal({ open, onOpenChange }: GlViewSelectorModalProps) {
  const { t } = useTranslation(['accounting', 'common']);
  const {
    templates,
    activeTemplateId,
    activeTemplate,
    isLoading,
    isApplying,
    applyTemplate,
    createTemplate,
    deleteTemplate,
  } = useGlViewTemplates();

  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(activeTemplateId);
  const [searchQuery, setSearchQuery] = useState('');
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [templateToDelete, setTemplateToDelete] = useState<GlViewTemplate | null>(null);
  const [customSampleRowsMap, setCustomSampleRowsMap] = useState<Record<string, GlSampleRow[]>>({});

  // Sync selectedTemplateId with activeTemplateId when modal opens
  const [prevOpen, setPrevOpen] = useState(open);
  if (prevOpen !== open) {
    setPrevOpen(open);
    if (open) {
      setSelectedTemplateId(activeTemplateId);
      setSearchQuery('');
    }
  }

  // Currently previewed template
  const previewTemplate = useMemo(() => {
    return templates.find((t) => t.id === selectedTemplateId) || activeTemplate || templates[0];
  }, [templates, selectedTemplateId, activeTemplate]);

  // Filter templates
  const filteredTemplates = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return templates;
    return templates.filter((t) => 
      t.name.toLowerCase().includes(q) ||
      (t.description && t.description.toLowerCase().includes(q))
    );
  }, [templates, searchQuery]);

  const builtinTemplates = useMemo(() => {
    return filteredTemplates.filter((t) => t.template_type === 'builtin');
  }, [filteredTemplates]);

  const customTemplates = useMemo(() => {
    return filteredTemplates.filter((t) => t.template_type === 'custom');
  }, [filteredTemplates]);

  const handleApply = async () => {
    if (!selectedTemplateId || selectedTemplateId === activeTemplateId) return;
    await applyTemplate(selectedTemplateId);
    onOpenChange(false);
  };

  const handleCreateSuccess = async (newTemplate: {
    name: string;
    description?: string;
    columns: any[];
    source_file_name?: string;
    sampleRows?: GlSampleRow[];
  }) => {
    const created: any = await createTemplate({
      name: newTemplate.name,
      description: newTemplate.description,
      columns: newTemplate.columns,
      template_type: 'custom',
      source_file_name: newTemplate.source_file_name,
    });

    if (created && created.id && newTemplate.sampleRows) {
      setCustomSampleRowsMap(prev => ({
        ...prev,
        [created.id]: newTemplate.sampleRows!
      }));
      setSelectedTemplateId(created.id);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!templateToDelete) return;
    await deleteTemplate(templateToDelete.id);
    if (selectedTemplateId === templateToDelete.id) {
      setSelectedTemplateId('standard_3col');
    }
    setTemplateToDelete(null);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-5xl h-[700px] max-h-[92vh] flex flex-col p-5 gap-4 overflow-hidden">
          {/* ── Modal Fejléc ── */}
          <DialogHeader className="border-b border-border/60 pb-3">
            <div className="flex items-center justify-between">
              <div>
                <DialogTitle className="flex items-center gap-2.5 text-lg font-bold text-foreground">
                  <Table2 className="w-5 h-5 text-primary" />
                  <span>{t('accounting:general_ledger.view_modal.title', 'Főkönyvi nézetválasztó és egyedi sablonkészítő')}</span>
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                  {t('accounting:general_ledger.view_modal.subtitle', 'Válassza ki a cégéhez illeszkedő főkönyvi elrendezést, vagy hozzon létre új saját sablont mintafájlból. A beállítás mind a képernyőn, mind az Excel exportban érvényesül.')}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {/* ── Kétoldalas Fő Tartalom ── */}
          <div className="flex-1 grid grid-cols-1 md:grid-cols-12 gap-4 overflow-hidden min-h-0">
            {/* ── Bal oldal: Sablonok Listája (4 oszlop a 12-ből) ── */}
            <div className="md:col-span-4 flex flex-col h-full border-r border-border/60 pr-3 gap-3 overflow-hidden">
              {/* Kereső sáv */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder={t('accounting:general_ledger.view_modal.search_placeholder', 'Sablon keresése...')}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 h-8 text-xs"
                />
              </div>

              {/* Új sablon feltöltése akciógomb */}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setUploadDialogOpen(true)}
                className="w-full justify-center gap-2 border-dashed border-primary/50 hover:bg-primary/5 hover:border-primary text-xs font-semibold h-9 shrink-0 shadow-xs"
              >
                <UploadCloud className="w-4 h-4 text-primary" />
                <span>{t('accounting:general_ledger.view_modal.upload_new_btn', '+ Új sablon feltöltése...')}</span>
              </Button>

              {/* Görgőzhető Sablonlista */}
              <div className="flex-1 overflow-y-auto space-y-3.5 pr-1">
                {/* 1. Beépített Rendszerszintű Sablonok */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between px-1">
                    <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                      {t('accounting:general_ledger.view_modal.section_builtin', 'Beépített sablonok')}
                    </span>
                    <span className="text-[10px] text-muted-foreground/70 font-mono">
                      {builtinTemplates.length}
                    </span>
                  </div>

                  <div className="space-y-1">
                    {builtinTemplates.map((item) => {
                      const isSelected = previewTemplate?.id === item.id;
                      const isCurrentActive = activeTemplateId === item.id;

                      return (
                        <div
                          key={item.id}
                          onClick={() => setSelectedTemplateId(item.id)}
                          className={cn(
                            "group p-2.5 rounded-lg border transition-all cursor-pointer flex flex-col gap-1 relative",
                            isSelected 
                              ? "bg-primary/10 border-primary shadow-xs ring-1 ring-primary/30" 
                              : "bg-card hover:bg-muted/50 border-border/70 hover:border-border",
                            isCurrentActive && !isSelected ? "border-emerald-500/40 bg-emerald-500/5" : ""
                          )}
                        >
                          <div className="flex items-center justify-between gap-1.5">
                            <span className={cn(
                              "text-xs font-semibold truncate",
                              isSelected ? "text-primary" : "text-foreground"
                            )}>
                              {item.name}
                            </span>
                            {isCurrentActive && (
                              <Badge className="text-[9px] bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 font-bold px-1.5 py-0 shrink-0">
                                Aktív
                              </Badge>
                            )}
                          </div>

                          <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                            <span>{item.columns.length} oszlopos elrendezés</span>
                            {isSelected && (
                              <span className="text-primary font-medium flex items-center gap-0.5">
                                Megtekintve <ArrowRight className="w-2.5 h-2.5" />
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* 2. Saját Egyedi Sablonok */}
                <div className="space-y-1.5 pt-1">
                  <div className="flex items-center justify-between px-1">
                    <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                      <Sparkles className="w-3 h-3 text-purple-500" />
                      <span>{t('accounting:general_ledger.view_modal.section_custom', 'Saját sablonok')}</span>
                    </span>
                    <span className="text-[10px] text-muted-foreground/70 font-mono">
                      {customTemplates.length}
                    </span>
                  </div>

                  {customTemplates.length === 0 ? (
                    <div className="p-3 rounded-lg border border-dashed border-border/80 bg-muted/20 text-center">
                      <p className="text-[11px] text-muted-foreground">
                        {t('accounting:general_ledger.view_modal.no_custom_templates', 'Még nincs feltöltött egyedi sablon.')}
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      {customTemplates.map((item) => {
                        const isSelected = previewTemplate?.id === item.id;
                        const isCurrentActive = activeTemplateId === item.id;

                        return (
                          <div
                            key={item.id}
                            onClick={() => setSelectedTemplateId(item.id)}
                            className={cn(
                              "group p-2.5 rounded-lg border transition-all cursor-pointer flex flex-col gap-1 relative",
                              isSelected 
                                ? "bg-purple-500/10 border-purple-500 shadow-xs ring-1 ring-purple-500/30" 
                                : "bg-card hover:bg-muted/50 border-border/70 hover:border-border",
                              isCurrentActive && !isSelected ? "border-emerald-500/40 bg-emerald-500/5" : ""
                            )}
                          >
                            <div className="flex items-center justify-between gap-1.5">
                              <span className={cn(
                                "text-xs font-semibold truncate",
                                isSelected ? "text-purple-600 dark:text-purple-400" : "text-foreground"
                              )}>
                                {item.name}
                              </span>
                              <div className="flex items-center gap-1 shrink-0">
                                {isCurrentActive && (
                                  <Badge className="text-[9px] bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 font-bold px-1.5 py-0">
                                    Aktív
                                  </Badge>
                                )}
                                <CustomTooltip content="Egyedi sablon törlése" side="top">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setTemplateToDelete(item);
                                    }}
                                    className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive p-0.5 rounded transition-opacity"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </CustomTooltip>
                              </div>
                            </div>

                            <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                              <span>{item.columns.length} oszlop ({item.source_file_name || 'fájl'})</span>
                              {isSelected && (
                                <span className="text-purple-600 dark:text-purple-400 font-medium flex items-center gap-0.5">
                                  Megtekintve <ArrowRight className="w-2.5 h-2.5" />
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* ── Jobb oldal: Interaktív Minta-Előnézet (8 oszlop a 12-ből) ── */}
            <div className="md:col-span-8 flex flex-col h-full min-h-0 overflow-hidden">
              {previewTemplate ? (
                <GlTemplatePreview
                  template={previewTemplate}
                  isActive={activeTemplateId === previewTemplate.id}
                  customSampleRows={customSampleRowsMap[previewTemplate.id]}
                />
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-muted-foreground">
                  <Table2 className="w-10 h-10 opacity-30 mb-2" />
                  <p className="text-xs">Válasszon ki egy sablont a bal oldali listából az előnézet megjelenítéséhez.</p>
                </div>
              )}
            </div>
          </div>

          {/* ── Modal Alsó Vezérlősáv (Footer) ── */}
          <DialogFooter className="flex items-center justify-between sm:justify-between border-t border-border/60 pt-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="font-medium text-foreground">Jelenleg aktív sablon:</span>
              <span className="font-semibold text-primary">{activeTemplate?.name || 'Standard 3 oszlopos'}</span>
            </div>

            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
                Mégse
              </Button>
              <Button
                size="sm"
                onClick={handleApply}
                disabled={isApplying || !selectedTemplateId || selectedTemplateId === activeTemplateId}
                className="gap-2 min-w-[150px]"
              >
                {isApplying ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Mentés...</span>
                  </>
                ) : selectedTemplateId === activeTemplateId ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    <span>Ez az aktív sablon</span>
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    <span>Kiválasztás és alkalmazás</span>
                  </>
                )}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Új Sablon Feltöltése Sub-Dialog ── */}
      <GlTemplateUploadDialog
        open={uploadDialogOpen}
        onOpenChange={setUploadDialogOpen}
        onSuccess={handleCreateSuccess}
      />

      {/* ── Törlés Megerősítése Sub-Dialog ── */}
      <AlertDialog open={!!templateToDelete} onOpenChange={(val) => !val && setTemplateToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Biztosan törölni szeretné ezt a sablont?</AlertDialogTitle>
            <AlertDialogDescription className="text-xs">
              A(z) „{templateToDelete?.name}” egyedi sablon véglegesen törlődik. Amennyiben ez volt a céghez beállított aktív sablon, a rendszer automatikusan visszaáll a standard 3 oszlopos nézetre.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Mégse</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm} className="bg-destructive hover:bg-destructive/90 text-destructive-foreground">
              Sablon törlése
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
