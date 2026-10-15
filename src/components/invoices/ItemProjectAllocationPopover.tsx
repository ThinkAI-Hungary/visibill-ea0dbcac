import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Plus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Percent,
  FolderOpen,
  Loader2,
  Scale,
  Wand2,
  RotateCcw,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ItemProjectAllocation } from '@/types/invoices';
import {
  validateProjectAllocations,
  distributeEqually,
  fillRemainder,
} from '@/lib/projectAllocationValidation';

export interface ProjectOption {
  id: string;
  name: string;
}

export interface ItemProjectAllocationPopoverProps {
  children?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  currentAllocations?: ItemProjectAllocation[] | null;
  currentProjectId?: string | null;
  parentProjectId?: string | null;
  projectList: ProjectOption[];
  lineDescription?: string | null;
  lineNumber?: number;
  onSave: (allocations: ItemProjectAllocation[] | null) => Promise<void>;
  disabled?: boolean;
}

export const ItemProjectAllocationPopover: React.FC<ItemProjectAllocationPopoverProps> = ({
  children,
  open: controlledOpen,
  onOpenChange: setControlledOpen,
  currentAllocations,
  currentProjectId,
  parentProjectId,
  projectList,
  lineDescription,
  lineNumber,
  onSave,
  disabled = false,
}) => {
  const { t } = useTranslation(['invoices', 'common']);
  const [internalOpen, setInternalOpen] = useState(false);
  const isOpen = controlledOpen !== undefined ? controlledOpen : internalOpen;
  const setIsOpen = setControlledOpen || setInternalOpen;

  const [allocations, setAllocations] = useState<ItemProjectAllocation[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  const handleOpenChange = useCallback((open: boolean) => {
    if (open) {
      if (currentAllocations && currentAllocations.length > 0) {
        setAllocations(currentAllocations.map(a => ({ ...a, percentage: Number(a.percentage) })));
      } else if (currentProjectId) {
        setAllocations([{ project_id: currentProjectId, percentage: 100 }]);
      } else if (parentProjectId) {
        setAllocations([{ project_id: parentProjectId, percentage: 100 }]);
      } else {
        setAllocations([]);
      }
    }
    setIsOpen(open);
  }, [currentAllocations, currentProjectId, parentProjectId, setIsOpen]);

  const validation = useMemo(() => {
    return validateProjectAllocations(allocations);
  }, [allocations]);

  const handleAddProject = useCallback(() => {
    if (allocations.length >= projectList.length) return;

    // Pick first project not yet selected
    const selectedIds = new Set(allocations.map(a => a.project_id));
    const available = projectList.find(p => !selectedIds.has(p.id));
    const nextProjectId = available ? available.id : (projectList[0]?.id || '');

    const currentSum = allocations.reduce((acc, c) => acc + (Number(c.percentage) || 0), 0);
    const remaining = Math.max(0, Math.round((100 - currentSum) * 100) / 100);

    setAllocations(prev => [
      ...prev,
      { project_id: nextProjectId, percentage: remaining > 0 ? remaining : 10 },
    ]);
  }, [allocations, projectList]);

  const handleRemoveProject = useCallback((index: number) => {
    setAllocations(prev => prev.filter((_, i) => i !== index));
  }, []);

  const handleProjectChange = useCallback((index: number, newProjectId: string) => {
    setAllocations(prev =>
      prev.map((item, i) => (i === index ? { ...item, project_id: newProjectId } : item))
    );
  }, []);

  const handlePercentageChange = useCallback((index: number, valStr: string) => {
    const val = parseFloat(valStr);
    setAllocations(prev =>
      prev.map((item, i) =>
        i === index ? { ...item, percentage: isNaN(val) ? 0 : val } : item
      )
    );
  }, []);

  const handleEqualSplit = useCallback(() => {
    if (allocations.length === 0) return;
    const projectIds = allocations.map(a => a.project_id);
    setAllocations(distributeEqually(projectIds));
  }, [allocations]);

  const handleFillRemainder = useCallback(() => {
    if (allocations.length === 0) return;
    setAllocations(prev => fillRemainder(prev));
  }, [allocations]);

  const handleResetToInherited = useCallback(async () => {
    try {
      setIsSaving(true);
      await onSave(null);
      setIsOpen(false);
    } finally {
      setIsSaving(false);
    }
  }, [onSave, setIsOpen]);

  const handleSave = useCallback(async () => {
    if (!validation.isValid && allocations.length > 0) return;

    try {
      setIsSaving(true);
      if (allocations.length === 0) {
        await onSave(null);
      } else {
        await onSave(allocations);
      }
      setIsOpen(false);
    } finally {
      setIsSaving(false);
    }
  }, [allocations, validation.isValid, onSave, setIsOpen]);

  // Available projects for a specific row
  const getAvailableProjectsForRow = (currentIndex: number) => {
    const selectedElsewhere = new Set(
      allocations.filter((_, i) => i !== currentIndex).map(a => a.project_id)
    );
    return projectList.filter(p => !selectedElsewhere.has(p.id));
  };

  return (
    <Popover open={isOpen} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild disabled={disabled}>
        {children || (
          <Button
            type="button"
            variant="outline"
            role="combobox"
            size="sm"
            style={{ outline: 'none' }}
            className={cn(
              "h-8 px-2 text-xs gap-1.5 transition-colors duration-150",
              "outline-none focus:outline-none focus-visible:outline-none focus:ring-0 focus-visible:ring-0 ring-0 focus-visible:ring-offset-0",
              "[outline:none!important] focus:[outline:none!important] focus-visible:[outline:none!important]",
              "[box-shadow:none!important] focus:[box-shadow:none!important] focus-visible:[box-shadow:none!important]"
            )}
            disabled={disabled}
          >
            <Percent className="w-3.5 h-3.5 text-primary" />
            <span>Költségmegosztás</span>
          </Button>
        )}
      </PopoverTrigger>

      <PopoverContent
        align="start"
        sideOffset={6}
        onCloseAutoFocus={(e) => {
          e.preventDefault();
        }}
        className="w-[380px] p-4 text-xs shadow-xl border-border/80 bg-background/95 backdrop-blur-sm z-[100]"
      >
        {/* Header */}
        <div className="flex items-start justify-between pb-3 border-b border-border/60">
          <div className="space-y-0.5 pr-2">
            <div className="flex items-center gap-1.5 font-semibold text-sm text-foreground">
              <FolderOpen className="w-4 h-4 text-primary shrink-0" />
              <span>Projekt költségmegosztás</span>
            </div>
            {lineNumber !== undefined && (
              <p className="text-[11px] text-muted-foreground truncate max-w-[280px]">
                {lineNumber}. tétel: {lineDescription || 'Nincs leírás'}
              </p>
            )}
          </div>
          <Badge
            variant={
              allocations.length === 0
                ? 'secondary'
                : validation.isValid
                ? 'outline'
                : 'destructive'
            }
            className={cn(
              'shrink-0 text-[11px] font-mono font-medium',
              validation.isValid && allocations.length > 0 && 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30'
            )}
          >
            {validation.sum}%
          </Badge>
        </div>

        {/* Dynamic Project Allocation Rows */}
        <div
          className="py-3 space-y-2.5 max-h-[220px] overflow-y-auto overscroll-contain"
          onWheel={(e) => e.stopPropagation()}
          onTouchMove={(e) => e.stopPropagation()}
        >
          {allocations.length === 0 ? (
            <div className="py-6 text-center space-y-2 rounded-lg border border-dashed border-border/60 bg-muted/20">
              <p className="text-xs text-muted-foreground">
                Jelenleg nincs egyedi projekt-megosztás definiálva.
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAddProject}
                className="h-7 text-xs gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Projekt hozzáadása</span>
              </Button>
            </div>
          ) : (
            allocations.map((alloc, idx) => {
              const availableProjects = getAvailableProjectsForRow(idx);
              return (
                <div key={idx} className="flex items-center gap-2">
                  <div className="flex-1 min-w-0">
                    <Select
                      value={alloc.project_id}
                      onValueChange={(val) => handleProjectChange(idx, val)}
                    >
                      <SelectTrigger className="h-8 text-xs bg-background">
                        <SelectValue placeholder="Válassz projektet..." />
                      </SelectTrigger>
                      <SelectContent className="max-w-[260px] z-[110]">
                        {availableProjects.map((p) => (
                          <SelectItem key={p.id} value={p.id} className="text-xs">
                            {p.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="relative w-20 shrink-0">
                    <Input
                      type="number"
                      min={1}
                      max={100}
                      step={0.5}
                      value={alloc.percentage === 0 ? '' : alloc.percentage}
                      onChange={(e) => handlePercentageChange(idx, e.target.value)}
                      placeholder="0"
                      className="h-8 text-xs font-mono text-right pr-6"
                    />
                    <span className="absolute right-2 top-2 text-[11px] text-muted-foreground pointer-events-none">
                      %
                    </span>
                  </div>

                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => handleRemoveProject(idx)}
                    className="h-8 w-8 text-muted-foreground hover:text-destructive shrink-0"
                    title="Projekt eltávolítása"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              );
            })
          )}
        </div>

        {/* Quick actions bar */}
        {allocations.length > 0 && (
          <div className="flex items-center justify-between pt-1 pb-3 text-[11px] gap-1.5 flex-wrap">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleAddProject}
              disabled={allocations.length >= projectList.length}
              className="h-6 px-2 text-[11px] gap-1"
            >
              <Plus className="w-3 h-3" />
              <span>Hozzáadás</span>
            </Button>

            <div className="flex items-center gap-1.5 ml-auto">
              {allocations.length >= 2 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleEqualSplit}
                  className="h-6 px-2 text-[11px] gap-1 text-muted-foreground hover:text-foreground"
                  title="Százalékok egyenlő arányú elosztása"
                >
                  <Scale className="w-3 h-3" />
                  <span>Egyenlő</span>
                </Button>
              )}
              {validation.remaining !== 0 && allocations.length > 0 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleFillRemainder}
                  className="h-6 px-2 text-[11px] gap-1 text-primary hover:text-primary/80"
                  title="Hiányzó százalék automatikus kitöltése"
                >
                  <Wand2 className="w-3 h-3" />
                  <span>Maradék</span>
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Validation Status Banner */}
        <div className="pt-2.5 pb-3 border-t border-border/60">
          {allocations.length > 0 && (
            <div
              className={cn(
                'p-2 rounded-md flex items-start gap-2 text-[11px] leading-tight transition-colors',
                validation.isValid
                  ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20'
                  : 'bg-destructive/10 text-destructive border border-destructive/20'
              )}
            >
              {validation.isValid ? (
                <>
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 mt-0.5" />
                  <div>
                    <span className="font-semibold">Érvényes 100%-os elosztás!</span>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      A költség {allocations.length} projekt között kerül felosztásra.
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <AlertCircle className="w-4 h-4 shrink-0 text-destructive mt-0.5" />
                  <div>
                    <span className="font-semibold">{validation.error}</span>
                    <p className="text-[10px] opacity-80 mt-0.5">
                      A mentéshez az összegnek pontosan 100%-nak kell lennie.
                    </p>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* Footer Buttons */}
        <div className="flex items-center justify-between pt-2 border-t border-border/60">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleResetToInherited}
            disabled={isSaving}
            className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground gap-1"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Örökölt</span>
          </Button>

          <div className="flex items-center gap-1.5">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsOpen(false)}
              disabled={isSaving}
              className="h-7 px-2.5 text-xs"
            >
              Mégse
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleSave}
              disabled={isSaving || (allocations.length > 0 && !validation.isValid)}
              className="h-7 px-3 text-xs gap-1.5"
            >
              {isSaving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>Mentés</span>
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
};
