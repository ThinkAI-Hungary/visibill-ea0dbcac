import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Trash2, Edit2, Check, X, Database } from 'lucide-react';

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

export function ManagePresetsModal({ open, onOpenChange, presets, companyId }: ManagePresetsModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  // Csak a céghez tartozó egyéni sablonokat listázzuk
  const customPresets = presets.filter(p => p.type === 'custom' && p.company_id === companyId);

  const deleteMutation = useMutation({
    mutationFn: async (presetId: string) => {
      // Előbb töröljük a főkönyvi elemeket, nehogy foreign key constraint hibát kapjunk 
      const { error: itemsError } = await supabase
        .from('gl_accounts')
        .delete()
        .eq('preset_id', presetId);
        
      if (itemsError) throw itemsError;

      // Utána magát a sablont
      const { error } = await supabase
        .from('chart_of_accounts_presets')
        .delete()
        .eq('id', presetId);
        
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['coaPresets'] });
      toast({ title: 'Sablon törölve', description: 'A számlatükör sablon sikeresen eltávolításra került.' });
    },
    onError: (error: any) => {
      toast({ title: 'Hiba történt', description: error.message, variant: 'destructive' });
    }
  });

  const renameMutation = useMutation({
    mutationFn: async ({ id, newName }: { id: string; newName: string }) => {
      if (!newName.trim()) throw new Error("A név nem lehet üres.");
      const { error } = await supabase
        .from('chart_of_accounts_presets')
        .update({ name: newName.trim() })
        .eq('id', id);
        
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['coaPresets'] });
      setEditingId(null);
      toast({ title: 'Sikeres átnevezés', description: 'A sablon neve frissítésre került.' });
    },
    onError: (error: any) => {
      toast({ title: 'Hiba történt', description: error.message, variant: 'destructive' });
    }
  });

  const handleDelete = (id: string, name: string) => {
    if (confirm(`Biztosan törölni szeretnéd a(z) "${name}" nevű sablont? Ez minden hozzá tartozó feltöltött adatot törölni fog!`)) {
      deleteMutation.mutate(id);
    }
  };

  const startEditing = (preset: Preset) => {
    setEditingId(preset.id);
    setEditName(preset.name);
  };

  const saveEdit = (id: string) => {
    renameMutation.mutate({ id, newName: editName });
  };

  return (
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
            customPresets.map((preset) => (
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
                        className="h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-100"
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
                        className="h-8 w-8 text-muted-foreground hover:text-foreground"
                        onClick={() => startEditing(preset)}
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-100"
                        onClick={() => handleDelete(preset.id, preset.name)}
                        disabled={deleteMutation.isPending}
                      >
                        {deleteMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                      </Button>
                    </>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        <div className="flex justify-end mt-4 pt-4 border-t border-border/40">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Bezárás
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
