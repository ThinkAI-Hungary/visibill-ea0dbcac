import React, { useState, useMemo } from 'react';
import {
  FolderOpen,
  Plus,
  Check,
  ChevronsUpDown,
  Edit3,
  X,
  Loader2,
  Building,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { useProjectList } from '@/hooks/useProjectList';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

export interface ProjectSelectOrAddComboboxProps {
  companyId: string;
  value: string;
  projectId?: string | null;
  onChange: (value: string, projectId?: string | null) => void;
  className?: string;
  placeholder?: string;
  disabled?: boolean;
}

export default function ProjectSelectOrAddCombobox({
  companyId,
  value,
  projectId,
  onChange,
  className,
  placeholder = 'Válassz projektet vagy költséghelyet…',
  disabled = false,
}: ProjectSelectOrAddComboboxProps) {
  const { user } = useAuth();
  const { projects, isLoading, refetch } = useProjectList(companyId);

  const [open, setOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectCode, setNewProjectCode] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [isCustomMode, setIsCustomMode] = useState(false);

  // Match existing project by id or exact name
  const matchedProject = useMemo(() => {
    if (projectId) {
      const byId = projects.find(p => p.id === projectId);
      if (byId) return byId;
    }
    if (value) {
      return projects.find(
        p => p.name.toLowerCase() === value.trim().toLowerCase()
      );
    }
    return null;
  }, [projects, projectId, value]);

  const handleSelectProject = (proj: { id: string; name: string }) => {
    onChange(proj.name, proj.id);
    setIsCustomMode(false);
    setOpen(false);
  };

  const handleCreateProject = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!newProjectName.trim()) {
      toast({
        title: 'Hiányzó név',
        description: 'Kérlek add meg a projekt nevét!',
        variant: 'destructive',
      });
      return;
    }

    if (!user?.id || !companyId) {
      toast({
        title: 'Hiba',
        description: 'Hiányzó felhasználói vagy cég azonosító.',
        variant: 'destructive',
      });
      return;
    }

    setIsCreating(true);
    try {
      const { data, error } = await supabase
        .from('projects')
        .insert({
          user_id: user.id,
          company_id: companyId,
          name: newProjectName.trim(),
          project_code: newProjectCode.trim() || undefined,
          status: 'active',
          icon: 'FolderOpen',
          color: 'hsl(217, 91%, 60%)',
        })
        .select()
        .single();

      if (error) throw error;

      toast({
        title: 'Projekt sikeresen létrehozva!',
        description: `${data.name} hozzáadva a cég projektjeihez.`,
      });

      await refetch();
      onChange(data.name, data.id);
      setIsCustomMode(false);
      setDialogOpen(false);
      setNewProjectName('');
      setNewProjectCode('');
    } catch (err: any) {
      toast({
        title: 'Nem sikerült létrehozni a projektet',
        description: err?.message || 'Váratlan hiba történt.',
        variant: 'destructive',
      });
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className={cn('space-y-1.5', className)}>
      <div className="flex items-center gap-2">
        {!isCustomMode ? (
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="outline"
                role="combobox"
                aria-expanded={open}
                disabled={disabled}
                className={cn(
                  'w-full justify-between h-9 px-3 font-normal text-sm border-border bg-background hover:bg-accent hover:text-accent-foreground transition-colors',
                  !value && 'text-muted-foreground'
                )}
              >
                <div className="flex items-center gap-2 truncate">
                  <FolderOpen className="w-3.5 h-3.5 text-primary shrink-0" />
                  <span className="truncate">
                    {matchedProject
                      ? `${matchedProject.name}${matchedProject.project_code ? ` (${matchedProject.project_code})` : ''}`
                      : value || placeholder}
                  </span>
                </div>
                <div className="flex items-center gap-1 shrink-0 ml-2">
                  {value && (
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={(e) => {
                        e.stopPropagation();
                        onChange('', null);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.stopPropagation();
                          onChange('', null);
                        }
                      }}
                      className="p-0.5 hover:bg-muted rounded-full text-muted-foreground hover:text-foreground cursor-pointer"
                      title="Költséghely törlése"
                    >
                      <X className="w-3.5 h-3.5" />
                    </span>
                  )}
                  <ChevronsUpDown className="h-4 w-4 opacity-50" />
                </div>
              </Button>
            </PopoverTrigger>

            <PopoverContent
              className="w-[var(--radix-popover-trigger-width)] min-w-[320px] p-0 border-border bg-popover text-popover-foreground shadow-lg"
              align="start"
            >
              <Command className="bg-popover text-popover-foreground">
                <CommandInput
                  placeholder="Keresés projekt neve vagy kódja alapján…"
                  className="h-9 border-none focus:ring-0 text-sm"
                />
                <CommandList className="max-h-[280px]">
                  <CommandEmpty className="p-3 text-xs text-muted-foreground text-center">
                    {isLoading ? 'Projektek betöltése…' : 'Nincs találat a projektek között.'}
                  </CommandEmpty>

                  {projects.length > 0 && (
                    <CommandGroup heading="Cég aktív projektjei">
                      {projects.map((proj) => {
                        const isSelected =
                          matchedProject?.id === proj.id ||
                          (!matchedProject && value === proj.name);
                        return (
                          <CommandItem
                            key={proj.id}
                            value={`${proj.name} ${proj.project_code || ''}`}
                            onSelect={() => handleSelectProject(proj)}
                            className="flex items-center justify-between py-2 px-2.5 cursor-pointer aria-selected:bg-accent aria-selected:text-accent-foreground"
                          >
                            <div className="flex items-center gap-2 truncate">
                              <Check
                                className={cn(
                                  'h-4 w-4 shrink-0 text-primary',
                                  isSelected ? 'opacity-100' : 'opacity-0'
                                )}
                              />
                              <FolderOpen className="w-3.5 h-3.5 text-primary/70 shrink-0" />
                              <span className={cn('truncate text-sm', isSelected && 'font-semibold text-foreground')}>
                                {proj.name}
                              </span>
                            </div>
                            {proj.project_code && (
                              <Badge
                                variant="outline"
                                className="text-[10px] font-mono shrink-0 ml-2 px-1.5 py-0 h-4 bg-muted/60 border-border text-muted-foreground"
                              >
                                {proj.project_code}
                              </Badge>
                            )}
                          </CommandItem>
                        );
                      })}
                    </CommandGroup>
                  )}

                  <CommandSeparator className="bg-border" />

                  <CommandGroup heading="Egyéb lehetőségek">
                    <CommandItem
                      value="__NEW_PROJECT__ + új projekt hozzáadása felvitele létrehozása"
                      onSelect={() => {
                        setOpen(false);
                        setNewProjectName('');
                        setNewProjectCode('');
                        setDialogOpen(true);
                      }}
                      className="flex items-center gap-2 py-2 px-2.5 text-primary cursor-pointer aria-selected:bg-accent aria-selected:text-primary font-medium"
                    >
                      <Plus className="w-4 h-4 shrink-0 text-primary" />
                      <span>+ Új projekt létrehozása…</span>
                    </CommandItem>

                    <CommandItem
                      value="__CUSTOM__ egyedi költséghely szöveg megadása beírása"
                      onSelect={() => {
                        setOpen(false);
                        setIsCustomMode(true);
                      }}
                      className="flex items-center gap-2 py-2 px-2.5 text-muted-foreground cursor-pointer aria-selected:bg-accent aria-selected:text-foreground"
                    >
                      <Edit3 className="w-3.5 h-3.5 shrink-0" />
                      <span>Egyedi költséghely szöveg beírása…</span>
                    </CommandItem>
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        ) : (
          <div className="flex items-center gap-2 flex-1">
            <div className="relative flex-1">
              <Input
                type="text"
                value={value || ''}
                onChange={(e) => onChange(e.target.value, null)}
                placeholder="pl. Iroda, IT vagy saját költséghely"
                className="h-9 px-3 text-sm border-border bg-background text-foreground"
                autoFocus
              />
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsCustomMode(false)}
              className="h-9 px-2.5 text-xs shrink-0 gap-1 border-border text-muted-foreground hover:text-foreground hover:bg-accent"
              title="Vissza a projektek választóhoz"
            >
              <FolderOpen className="w-3.5 h-3.5 text-primary" />
              Projektek
            </Button>
          </div>
        )}

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            setNewProjectName('');
            setNewProjectCode('');
            setDialogOpen(true);
          }}
          className="shrink-0 h-9 gap-1.5 text-xs font-medium border-border bg-background text-foreground hover:bg-accent hover:text-accent-foreground"
          title="Új projekt hozzáadása"
        >
          <Plus className="w-3.5 h-3.5 text-primary" />
          Új projekt
        </Button>
      </div>

      {/* Quick Add Project Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <FolderOpen className="w-5 h-5 text-primary" />
              Új projekt felvitele
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleCreateProject} className="space-y-4 py-2">
            <div>
              <label className="block text-xs font-medium text-foreground mb-1">
                Projekt neve <span className="text-destructive">*</span>
              </label>
              <Input
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
                placeholder="pl. Mandala Étterem Bővítés 2026"
                autoFocus
                required
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-foreground mb-1">
                Projekt kódja <span className="text-muted-foreground text-[10px]">(opcionális)</span>
              </label>
              <Input
                value={newProjectCode}
                onChange={(e) => setNewProjectCode(e.target.value)}
                placeholder="pl. PRJ-2026-01"
              />
            </div>

            <DialogFooter className="gap-2 sm:gap-0 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
                disabled={isCreating}
              >
                Mégse
              </Button>
              <Button
                type="submit"
                disabled={isCreating || !newProjectName.trim()}
                className="gap-1.5"
              >
                {isCreating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Mentés...
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    Projekt mentése
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
