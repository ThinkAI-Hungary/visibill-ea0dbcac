import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCompany } from '@/contexts/CompanyContext';
import { useToast } from '@/hooks/use-toast';
import { useActivePreset } from '@/hooks/useActivePreset';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2, Loader2, AlertCircle } from 'lucide-react';
import { cn, formatCurrency } from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';

interface AddManualJournalEntryModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entryId?: string | null;
}

interface JournalLineInput {
  id?: string;
  gl_account_id: string;
  dc_type: 'T' | 'K';
  amount: number;
  project_id: string | null;
  description: string;
}

export default function AddManualJournalEntryModal({ open, onOpenChange, entryId }: AddManualJournalEntryModalProps) {
  const { selectedCompany } = useCompany();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { activePresetId } = useActivePreset(selectedCompany?.id);

  // Form states
  const [journalId, setJournalId] = useState<string>('');
  const [postingDate, setPostingDate] = useState<string>(new Date().toISOString().substring(0, 10));
  const [documentDate, setDocumentDate] = useState<string>(new Date().toISOString().substring(0, 10));
  const [documentId, setDocumentId] = useState<string>('');
  const [partnerId, setPartnerId] = useState<string>('none');
  const [description, setDescription] = useState<string>('');
  const [justification, setJustification] = useState<string>('');
  const [lines, setLines] = useState<JournalLineInput[]>([
    { gl_account_id: '', dc_type: 'T', amount: 0, project_id: null, description: '' },
    { gl_account_id: '', dc_type: 'K', amount: 0, project_id: null, description: '' },
  ]);
  const [openDropdownIndex, setOpenDropdownIndex] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch Lookups
  const { data: journals = [] } = useQuery({
    queryKey: ['acc-journals-lookup', selectedCompany?.id],
    queryFn: async () => {
      if (!selectedCompany?.id) return [];
      const { data, error } = await supabase
        .from('acc_journals')
        .select('id, code, name')
        .eq('company_id', selectedCompany.id);
      if (error) throw error;
      return data;
    },
    enabled: !!selectedCompany?.id,
  });

  // Set default journal to VE (Vegyes) if available
  useEffect(() => {
    if (journals.length > 0 && !journalId && !entryId) {
      const veJournal = journals.find((j: any) => j.code === 'VE');
      setJournalId(veJournal ? veJournal.id : journals[0].id);
    }
  }, [journals, journalId, entryId]);

  const { data: glAccounts = [] } = useQuery({
    queryKey: ['gl-accounts-lookup', activePresetId],
    queryFn: async () => {
      if (!activePresetId) return [];
      const { data, error } = await supabase
        .from('gl_accounts')
        .select('id, gl_number, short_name')
        .eq('preset_id', activePresetId)
        .order('gl_number');
      if (error) throw error;
      return data;
    },
    enabled: !!activePresetId,
  });

  const { data: partners = [] } = useQuery({
    queryKey: ['partners-lookup', selectedCompany?.id],
    queryFn: async () => {
      if (!selectedCompany?.id) return [];
      const { data, error } = await supabase
        .from('partners')
        .select('id, name')
        .eq('company_id', selectedCompany.id)
        .order('name');
      if (error) throw error;
      return data;
    },
    enabled: !!selectedCompany?.id,
  });

  const { data: projects = [] } = useQuery({
    queryKey: ['projects-lookup', selectedCompany?.id],
    queryFn: async () => {
      if (!selectedCompany?.id) return [];
      const { data, error } = await supabase
        .from('projects')
        .select('id, name')
        .eq('company_id', selectedCompany.id)
        .order('name');
      if (error) throw error;
      return data;
    },
    enabled: !!selectedCompany?.id,
  });

  // Load entry for editing if editing
  const { data: existingEntry, isLoading: loadingEntry } = useQuery({
    queryKey: ['acc-journal-entry-detail', entryId],
    queryFn: async () => {
      if (!entryId) return null;
      const { data, error } = await supabase
        .from('acc_journal_headers')
        .select('*, lines:acc_journal_lines(*)')
        .eq('id', entryId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!entryId && open,
  });

  useEffect(() => {
    if (existingEntry) {
      setJournalId(existingEntry.journal_id);
      setPostingDate(existingEntry.posting_date);
      setDocumentDate(existingEntry.document_date);
      setDocumentId(existingEntry.document_id);
      setPartnerId(existingEntry.partner_id || 'none');
      setDescription(existingEntry.description);
      setJustification(existingEntry.justification || '');
      if (existingEntry.lines && existingEntry.lines.length > 0) {
        setLines(existingEntry.lines.map((l: any) => ({
          id: l.id,
          gl_account_id: l.gl_account_id || '',
          dc_type: l.dc_type,
          amount: Number(l.amount),
          project_id: l.project_id || null,
          description: l.description || '',
        })));
      }
    }
  }, [existingEntry]);

  // Balance calculation
  const totalDebit = lines.reduce((sum, line) => (line.dc_type === 'T' ? sum + Number(line.amount) : sum), 0);
  const totalCredit = lines.reduce((sum, line) => (line.dc_type === 'K' ? sum + Number(line.amount) : sum), 0);
  const difference = totalDebit - totalCredit;
  const isBalanced = difference === 0;

  // Add line
  const handleAddLine = () => {
    setLines([...lines, { gl_account_id: '', dc_type: 'T', amount: 0, project_id: null, description: '' }]);
  };

  // Remove line
  const handleRemoveLine = (index: number) => {
    if (lines.length <= 2) {
      toast({ title: "Figyelmeztetés", description: "Egy bizonylatnak legalább két sorból kell állnia." });
      return;
    }
    setLines(lines.filter((_, i) => i !== index));
  };

  // Update line field
  const handleUpdateLine = (index: number, field: keyof JournalLineInput, value: any) => {
    const newLines = [...lines];
    newLines[index] = { ...newLines[index], [field]: value };
    setLines(newLines);
  };

  // Submit Mutation
  const saveMutation = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Bejelentkezés szükséges");

      const headerData = {
        company_id: selectedCompany!.id,
        journal_id: journalId,
        accounting_year: Number(postingDate.substring(0, 4)),
        status: 'KEZI_PISZKOZAT',
        posting_date: postingDate,
        document_date: documentDate,
        document_id: documentId,
        partner_id: partnerId === 'none' ? null : partnerId,
        description: description,
        justification: justification || null,
        created_by: user.id,
      };

      let headerIdResult = entryId;

      if (entryId) {
        // Update header
        const { error: headerErr } = await supabase
          .from('acc_journal_headers')
          .update(headerData)
          .eq('id', entryId);
        if (headerErr) throw headerErr;

        // Delete old lines
        const { error: deleteLinesErr } = await supabase
          .from('acc_journal_lines')
          .delete()
          .eq('header_id', entryId);
        if (deleteLinesErr) throw deleteLinesErr;
      } else {
        // Insert header
        const { data: newHeader, error: headerErr } = await supabase
          .from('acc_journal_headers')
          .insert(headerData)
          .select('id')
          .single();
        if (headerErr) throw headerErr;
        headerIdResult = newHeader.id;
      }

      // Insert new lines
      const linesData = lines.map((line, index) => ({
        header_id: headerIdResult!,
        sequence_number: index + 1,
        gl_account_id: line.gl_account_id || null,
        dc_type: line.dc_type,
        amount: line.amount,
        project_id: line.project_id || null,
        description: line.description || null,
      }));

      const { error: linesErr } = await supabase
        .from('acc_journal_lines')
        .insert(linesData);
      if (linesErr) throw linesErr;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['acc-journal-entries'] });
      onOpenChange(false);
      toast({ title: entryId ? "Tétel sikeresen frissítve" : "Kézi bizonylat sikeresen elmentve" });
    },
    onError: (err) => {
      toast({ title: "Mentési hiba", description: err.message, variant: "destructive" });
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!journalId) {
      toast({ title: "Figyelmeztetés", description: "Válasszon naplót!", variant: "destructive" });
      return;
    }
    if (!documentId.trim()) {
      toast({ title: "Figyelmeztetés", description: "A bizonylatszám kitöltése kötelező!", variant: "destructive" });
      return;
    }
    if (!description.trim()) {
      toast({ title: "Figyelmeztetés", description: "A megnevezés kitöltése kötelező!", variant: "destructive" });
      return;
    }
    if (lines.some(l => !l.gl_account_id)) {
      toast({ title: "Figyelmeztetés", description: "Minden sorban kötelező főkönyvi számot választani!", variant: "destructive" });
      return;
    }
    if (lines.some(l => l.amount <= 0)) {
      toast({ title: "Figyelmeztetés", description: "Az összeg csak pozitív szám lehet!", variant: "destructive" });
      return;
    }
    saveMutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{entryId ? 'Vegyes bizonylat szerkesztése' : 'Új vegyes bizonylat rögzítése'}</DialogTitle>
        </DialogHeader>

        {entryId && loadingEntry ? (
          <div className="py-12 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Header Fields */}
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="journal">Napló</Label>
                <Select value={journalId} onValueChange={setJournalId}>
                  <SelectTrigger id="journal">
                    <SelectValue placeholder="Válasszon naplót..." />
                  </SelectTrigger>
                  <SelectContent>
                    {journals.map((j: any) => (
                      <SelectItem key={j.id} value={j.id}>{j.code} - {j.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="documentId">Bizonylatszám</Label>
                <Input
                  id="documentId"
                  value={documentId}
                  onChange={e => setDocumentId(e.target.value)}
                  placeholder="pl. VE-2026/001"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="partner">Partner</Label>
                <Select value={partnerId} onValueChange={setPartnerId}>
                  <SelectTrigger id="partner">
                    <SelectValue placeholder="Válasszon partnert..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— Nincs partner —</SelectItem>
                    {partners.map((p: any) => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="postingDate">Teljesítés dátuma</Label>
                <Input
                  id="postingDate"
                  type="date"
                  value={postingDate}
                  onChange={e => setPostingDate(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="documentDate">Kelt (Bizonylat kelte)</Label>
                <Input
                  id="documentDate"
                  type="date"
                  value={documentDate}
                  onChange={e => setDocumentDate(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="description">Megnevezés / Fej leírás</Label>
                <Input
                  id="description"
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="pl. Bérfeladás 2026. augusztus"
                />
              </div>

              <div className="col-span-3 space-y-1.5">
                <Label htmlFor="justification">Indoklás / Helyesbítés megjegyzés</Label>
                <Input
                  id="justification"
                  value={justification}
                  onChange={e => setJustification(e.target.value)}
                  placeholder="pl. Stornó ok / Helyesbítő hivatkozás leírása..."
                />
              </div>
            </div>

            {/* Lines Editor */}
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <h4 className="text-sm font-semibold text-foreground">Bizonylat tételek</h4>
                <Button type="button" variant="outline" size="sm" onClick={handleAddLine} className="gap-1">
                  <Plus className="w-3.5 h-3.5" /> Új sor
                </Button>
              </div>

              <div className="border rounded-lg overflow-hidden bg-card/40">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-muted border-b border-border/40 font-semibold text-muted-foreground uppercase text-[10px]">
                      <th className="p-2.5 w-[240px]">Főkönyvi számlaszám</th>
                      <th className="p-2.5 w-[110px] text-center">Jelleg (T/K)</th>
                      <th className="p-2.5 w-[150px] text-right">Összeg (HUF)</th>
                      <th className="p-2.5 w-[160px]">Projekt</th>
                      <th className="p-2.5">Megjegyzés sor</th>
                      <th className="p-2.5 w-[50px] text-center"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/20">
                    {lines.map((line, index) => (
                      <tr key={index} className="hover:bg-muted/10">
                        {/* GL Account Select */}
                        <td className="p-2">
                          <Popover 
                            open={openDropdownIndex === index} 
                            onOpenChange={(open) => {
                              if (open) {
                                setOpenDropdownIndex(index);
                                setSearchQuery('');
                              } else {
                                setOpenDropdownIndex(null);
                              }
                            }}
                          >
                            <PopoverTrigger asChild>
                              <Button
                                variant="outline"
                                role="combobox"
                                className="h-8 w-full justify-between font-mono text-xs text-left px-2 border-input/60 hover:bg-muted/50"
                              >
                                <span className="truncate">
                                  {line.gl_account_id
                                    ? (() => {
                                        const gl = glAccounts.find((g: any) => g.id === line.gl_account_id);
                                        return gl ? `${gl.gl_number} - ${gl.short_name}` : 'Válasszon főkönyvet...';
                                      })()
                                    : 'Válasszon főkönyvet...'}
                                </span>
                                <span className="text-[10px] text-muted-foreground ml-1">▼</span>
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent 
                              className="w-[450px] max-w-[85vw] p-0 z-[1200]" 
                              align="start"
                              onWheel={(e) => e.stopPropagation()}
                              onTouchMove={(e) => e.stopPropagation()}
                            >
                              <Command shouldFilter={false}>
                                <CommandInput
                                  placeholder="Keresés (pl. 111, anyag)..."
                                  value={searchQuery}
                                  onValueChange={setSearchQuery}
                                />
                                <CommandList className="max-h-[250px] overflow-y-auto">
                                  <CommandEmpty>Nincs találat.</CommandEmpty>
                                  <CommandGroup>
                                    {glAccounts
                                      ?.filter((gl: any) => 
                                        !searchQuery || 
                                        `${gl.gl_number} ${gl.short_name}`.toLowerCase().includes(searchQuery.toLowerCase())
                                      )
                                      .map((gl: any) => (
                                        <CommandItem
                                          key={gl.id}
                                          value={`${gl.gl_number} ${gl.short_name}`}
                                          onSelect={() => {
                                            handleUpdateLine(index, 'gl_account_id', gl.id);
                                            setOpenDropdownIndex(null);
                                          }}
                                          className="font-mono text-xs cursor-pointer hover:bg-accent hover:text-accent-foreground"
                                        >
                                          {gl.gl_number} - {gl.short_name}
                                        </CommandItem>
                                      ))}
                                  </CommandGroup>
                                </CommandList>
                              </Command>
                            </PopoverContent>
                          </Popover>
                        </td>

                        {/* T/K Select */}
                        <td className="p-2">
                          <Select
                            value={line.dc_type}
                            onValueChange={v => handleUpdateLine(index, 'dc_type', v as any)}
                          >
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="T">T - Tartozik</SelectItem>
                              <SelectItem value="K">K - Követel</SelectItem>
                            </SelectContent>
                          </Select>
                        </td>

                        {/* Amount */}
                        <td className="p-2">
                          <Input
                            type="number"
                            value={line.amount || ''}
                            onChange={e => handleUpdateLine(index, 'amount', Number(e.target.value))}
                            className="h-8 text-right font-semibold text-xs"
                            min="0.01"
                            step="0.01"
                          />
                        </td>

                        {/* Project Select */}
                        <td className="p-2">
                          <Select
                            value={line.project_id || 'none'}
                            onValueChange={v => handleUpdateLine(index, 'project_id', v === 'none' ? null : v)}
                          >
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue placeholder="Nincs projekt" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">Nincs projekt</SelectItem>
                              {projects.map((p: any) => (
                                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </td>

                        {/* Line Description */}
                        <td className="p-2">
                          <Input
                            value={line.description}
                            onChange={e => handleUpdateLine(index, 'description', e.target.value)}
                            placeholder="Tétel megnevezése..."
                            className="h-8 text-xs"
                          />
                        </td>

                        {/* Delete Row */}
                        <td className="p-2 text-center">
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="w-8 h-8 text-destructive hover:bg-destructive/10"
                            onClick={() => handleRemoveLine(index)}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Balance Footer Warning */}
            <div className="flex items-center justify-between bg-muted/40 p-4 rounded-lg border text-xs">
              <div className="flex gap-4">
                <div>
                  <span className="text-muted-foreground block">Összes Tartozik (T)</span>
                  <span className="font-bold text-emerald-600 text-sm">{formatCurrency(totalDebit)}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block">Összes Követel (K)</span>
                  <span className="font-bold text-rose-600 text-sm">{formatCurrency(totalCredit)}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block">Különbözet</span>
                  <span className={cn("font-bold text-sm", isBalanced ? "text-foreground" : "text-destructive")}>
                    {formatCurrency(difference)}
                  </span>
                </div>
              </div>
              
              {!isBalanced && (
                <div className="flex items-center gap-1.5 text-destructive font-medium">
                  <AlertCircle className="w-4 h-4" /> A könyvelési bizonylat egyenlege nem egyezik (T ≠ K)!
                </div>
              )}
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Mégse
              </Button>
              <Button type="submit" className="bg-emerald-600 hover:bg-emerald-500" disabled={!isBalanced || saveMutation.isPending}>
                {saveMutation.isPending && <Loader2 className="w-4 h-4 animate-spin mr-1.5" />}
                Piszkozat mentése
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
