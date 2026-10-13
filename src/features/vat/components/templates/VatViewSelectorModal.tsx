import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  LayoutGrid, Plus, Check, Trash2, Search, X, 
  Sparkles, Loader2, TableProperties, ShieldCheck 
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
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
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useVatViewTemplates } from '@/hooks/useVatViewTemplates';
import { VatTemplatePreview } from './VatTemplatePreview';
import { VatTemplateUploadDialog } from './VatTemplateUploadDialog';
import type { VatViewTemplate, VatSampleRow } from '@/types/vatTemplate';
import { cn } from '@/lib/utils';

interface VatViewSelectorModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function VatViewSelectorModal({
  open,
  onOpenChange,
}: VatViewSelectorModalProps) {
  const { t } = useTranslation(['accounting', 'common']);
  const {
    templates,
    activeTemplateId,
    activeTemplate,
    canShareWithFirm,
    isLoading,
    isApplying,
    applyTemplate,
    createTemplate,
    deleteTemplate,
  } = useVatViewTemplates();

  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(activeTemplateId);
  const [searchQuery, setSearchQuery] = useState('');
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [templateToDelete, setTemplateToDelete] = useState<VatViewTemplate | null>(null);
  const [customSampleRowsMap, setCustomSampleRowsMap] = useState<Record<string, VatSampleRow[]>>({});

  // Sync selectedTemplateId with activeTemplateId during render when modal opens (Oxlint/React 19 pattern)
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

  // Handle template selection & activation
  const handleApply = async () => {
    if (!previewTemplate) return;
    try {
      await applyTemplate(previewTemplate.id);
      onOpenChange(false);
    } catch (e) {
      console.error('Failed to apply VAT template:', e);
    }
  };

  const handleUploadSuccess = async (newTemplate: {
    name: string;
    description?: string;
    columns: any[];
    source_file_name?: string;
    sampleRows?: VatSampleRow[];
    shareWithFirm?: boolean;
  }) => {
    const created = await createTemplate({
      name: newTemplate.name,
      description: newTemplate.description,
      columns: newTemplate.columns,
      source_file_name: newTemplate.source_file_name,
      shareWithFirm: newTemplate.shareWithFirm,
    });

    if (newTemplate.sampleRows && created?.id) {
      setCustomSampleRowsMap((prev) => ({
        ...prev,
        [created.id]: newTemplate.sampleRows!,
      }));
    }

    if (created?.id) {
      setSelectedTemplateId(created.id);
    }
    setUploadDialogOpen(false);
  };

  const handleDeleteConfirm = async () => {
    if (!templateToDelete) return;
    try {
      await deleteTemplate(templateToDelete.id);
      if (selectedTemplateId === templateToDelete.id) {
        setSelectedTemplateId('official_nav65_12col');
      }
    } catch (e) {
      console.error('Failed to delete template:', e);
    } finally {
      setTemplateToDelete(null);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-5xl w-[95vw] h-[85vh] flex flex-col p-0 gap-0 overflow-hidden bg-background border-border shadow-2xl">
          {/* Fejléc */}
          <DialogHeader className="px-5 py-3.5 border-b border-border/70 flex flex-row items-center justify-between space-y-0 shrink-0 bg-muted/20">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                <TableProperties className="w-4 h-4" />
              </div>
              <div>
                <DialogTitle className="text-base font-semibold text-foreground flex items-center gap-2">
                  <span>ÁFA analitika nézetválasztó és egyedi sablonkészítő</span>
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">
                  Válassza ki a cége számára optimális ÁFA analitika és export szerkezetet, vagy töltsön fel saját mintát.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {/* Kétosztatú Főtartalom */}
          <div className="flex-1 flex flex-col md:flex-row overflow-hidden min-h-0">
            {/* Bal Oldal: Sablonok Listája */}
            <div className="w-full md:w-[360px] lg:w-[380px] border-r border-border/70 flex flex-col h-full bg-muted/10 shrink-0">
              {/* Keresősáv */}
              <div className="p-3 border-b border-border/60">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                  <Input
                    placeholder="ÁFA sablon keresése..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="h-8 pl-8 pr-7 text-xs bg-background"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Sablonkártyák Görgethető Listája */}
              <ScrollArea className="flex-1 p-3">
                <div className="space-y-2 pr-2">
                  {isLoading ? (
                    <div className="flex flex-col items-center justify-center py-12 gap-2 text-muted-foreground">
                      <Loader2 className="w-6 h-6 animate-spin text-primary" />
                      <span className="text-xs">Sablonok betöltése...</span>
                    </div>
                  ) : filteredTemplates.length === 0 ? (
                    <div className="text-center py-8 text-xs text-muted-foreground">
                      Nincs a keresésnek megfelelő ÁFA sablon.
                    </div>
                  ) : (
                    filteredTemplates.map((tpl) => {
                      const isSelected = previewTemplate?.id === tpl.id;
                      const isCurrentActive = activeTemplateId === tpl.id;

                      return (
                        <div
                          key={tpl.id}
                          onClick={() => setSelectedTemplateId(tpl.id)}
                          className={cn(
                            "relative group rounded-xl p-3 border transition-all cursor-pointer flex flex-col gap-1.5 text-left select-none",
                            isSelected
                              ? "bg-primary/5 border-primary shadow-xs"
                              : "bg-card hover:bg-muted/40 border-border/70",
                            isCurrentActive && !isSelected && "border-emerald-500/40"
                          )}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-1.5 flex-wrap flex-1">
                              <span className={cn(
                                "font-semibold text-xs tracking-tight",
                                isSelected ? "text-primary" : "text-foreground"
                              )}>
                                {tpl.name}
                              </span>
                            </div>

                            {/* Törlés gomb egyedi sablonokhoz */}
                            {tpl.template_type === 'custom' && (
                              <button
                                type="button"
                                title="Sablon törlése"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setTemplateToDelete(tpl);
                                }}
                                className="opacity-0 group-hover:opacity-100 hover:text-destructive text-muted-foreground transition-opacity p-1 -mr-1"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>

                          <p className="text-[11px] text-muted-foreground line-clamp-2 leading-relaxed">
                            {tpl.description || 'ÁFA tételes kimutatási sablon.'}
                          </p>

                          <div className="flex items-center justify-between pt-1 border-t border-border/40 text-[10px]">
                            <div className="flex items-center gap-1.5">
                              {tpl.template_type === 'builtin' ? (
                                <Badge variant="secondary" className="text-[9px] px-1.5 py-0 h-4 font-mono">
                                  Standard
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 border-purple-500/30 text-purple-600 dark:text-purple-400 font-mono">
                                  Egyedi
                                </Badge>
                              )}
                              <span className="font-mono text-muted-foreground">
                                {tpl.columns?.length || 0} oszlop
                              </span>
                            </div>

                            {isCurrentActive && (
                              <span className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                                <Check className="w-3 h-3" />
                                <span>Aktív</span>
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </ScrollArea>

              {/* Lista alja: Új Sablon Feltöltése gomb */}
              <div className="p-3 border-t border-border/70 bg-background/50">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setUploadDialogOpen(true)}
                  className="w-full gap-2 text-xs border-dashed hover:border-primary hover:text-primary transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Új ÁFA sablon feltöltése (.xlsx, .csv)</span>
                </Button>
              </div>
            </div>

            {/* Jobb Oldal: Élő Előnézet és Alkalmazás */}
            <div className="flex-1 flex flex-col h-full overflow-hidden bg-background p-4 gap-3">
              <div className="flex-1 overflow-hidden min-h-0">
                {previewTemplate ? (
                  <VatTemplatePreview
                    template={previewTemplate}
                    isActive={activeTemplateId === previewTemplate.id}
                    customSampleRows={customSampleRowsMap[previewTemplate.id]}
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-2">
                    <LayoutGrid className="w-8 h-8 stroke-1" />
                    <span className="text-xs">Válasszon egy sablont a bal oldali listából.</span>
                  </div>
                )}
              </div>

              {/* Lábléc Műveletek */}
              <div className="flex items-center justify-between pt-2 border-t border-border/60 shrink-0">
                <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
                  Mégse
                </Button>

                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    onClick={handleApply}
                    disabled={!previewTemplate || isApplying}
                    className="gap-2 min-w-[160px] shadow-sm font-semibold"
                  >
                    {isApplying ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Check className="w-4 h-4" />
                    )}
                    <span>
                      {isApplying ? 'Alkalmazás...' : 'Sablon alkalmazása cég alapértelmezettként'}
                    </span>
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Feltöltő Modális */}
      <VatTemplateUploadDialog
        open={uploadDialogOpen}
        onOpenChange={setUploadDialogOpen}
        canShareWithFirm={canShareWithFirm}
        onSuccess={handleUploadSuccess}
      />

      {/* Törlés Megerősítő Dialógus */}
      <AlertDialog
        open={!!templateToDelete}
        onOpenChange={(v) => !v && setTemplateToDelete(null)}
      >
        <AlertDialogContent className="sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base">
              Biztosan törli ezt az egyedi ÁFA sablont?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs">
              A(z) „{templateToDelete?.name}” sablon véglegesen törlődik a cég könyvtárából. Amennyiben ez a sablon volt beállítva alapértelmezettként, a rendszer automatikusan visszavált a hivatalos NAV 65-ös nézetre.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="text-xs h-8">Mégse</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="text-xs h-8 bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Sablon törlése
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
