import React, { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useActivePreset } from '@/hooks/useActivePreset';
import { fetchAllGlAccountsByPreset } from '@/lib/glData';
import { formatCurrency } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from '@/components/ui/command';
import {
  Loader2,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  ArrowRightLeft,
  ChevronLeft,
  ChevronRight,
  Plus,
  Trash2,
  Save,
  Check,
  FileCheck,
  Layers,
} from 'lucide-react';
import type { SubledgerItem, SubledgerLineDetail, GroupedSubledgerInvoice } from '@/types/subledger';
import { subledgerQueryKeys } from '@/hooks/useSubledger';

interface EditableLine {
  id: string;
  sequence_number: number;
  gl_account_id: string;
  gl_number: string;
  gl_short_name: string;
  dc_type: 'T' | 'K';
  amount: number;
  foreign_amount?: number | null;
  vat_role?: string | null;
  vat_code?: string | null;
  description: string;
}

interface SubledgerPostingModalProps {
  isOpen: boolean;
  onClose: () => void;
  invoices: GroupedSubledgerInvoice[];
  companyId: string;
  isEditMode?: boolean;
  onOpenFullManualEditor?: (headerId: string) => void;
}

export function SubledgerPostingModal({
  isOpen,
  onClose,
  invoices,
  companyId,
  isEditMode = false,
  onOpenFullManualEditor,
}: SubledgerPostingModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { activePresetId } = useActivePreset(companyId);

  // Active invoice index when multiple invoices are selected
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  // Active item index within the current invoice (for multi-item invoices)
  const [activeItemIndex, setActiveItemIndex] = useState<number>(0);

  // Map of header_id -> EditableLine[] to support multi-item invoices
  const [itemLinesMap, setItemLinesMap] = useState<Record<string, EditableLine[]>>({});
  const [openDropdownIndex, setOpenDropdownIndex] = useState<number | null>(null);
  const [glSearchQuery, setGlSearchQuery] = useState<string>('');

  // Fetch all GL accounts for preset
  const { data: glAccounts = [], isLoading: isLoadingGl } = useQuery({
    queryKey: ['gl-accounts-lookup', activePresetId],
    queryFn: async () => {
      if (!activePresetId) return [];
      return await fetchAllGlAccountsByPreset(activePresetId);
    },
    enabled: !!activePresetId && isOpen,
  });

  // Current invoice being reviewed/edited
  const currentInvoice: GroupedSubledgerInvoice | undefined = invoices[currentIndex];
  // Active item inside the current invoice
  const activeItem: SubledgerItem | undefined =
    currentInvoice?.items[activeItemIndex] || currentInvoice?.items[0];

  // Initialize lines map when modal opens or currentIndex changes
  useEffect(() => {
    if (!currentInvoice) {
      setItemLinesMap({});
      setActiveItemIndex(0);
      return;
    }
    setActiveItemIndex(0);
    const newMap: Record<string, EditableLine[]> = {};
    currentInvoice.items.forEach((item) => {
      if (item.all_lines && item.all_lines.length > 0) {
        newMap[item.header_id] = item.all_lines.map((l, idx) => ({
          id: l.id || `temp-${idx}`,
          sequence_number: l.sequence_number || idx + 1,
          gl_account_id: l.gl_account_id || '',
          gl_number: l.gl_number || '',
          gl_short_name: l.gl_short_name || '',
          dc_type: l.dc_type,
          amount: Number(l.amount || 0),
          foreign_amount: l.foreign_amount ? Number(l.foreign_amount) : null,
          vat_role: l.vat_role || null,
          vat_code: l.vat_code || null,
          description: l.description || '',
        }));
      } else {
        newMap[item.header_id] = [
          {
            id: item.line_id,
            sequence_number: 1,
            gl_account_id: item.gl_account_id,
            gl_number: item.gl_number,
            gl_short_name: item.gl_short_name,
            dc_type: item.dc_type,
            amount: item.amount,
            foreign_amount: item.foreign_amount,
            vat_role: null,
            vat_code: null,
            description: item.description || '',
          },
        ];
      }
    });
    setItemLinesMap(newMap);
  }, [currentInvoice, isOpen]);

  // Current lines for the active item
  const lines: EditableLine[] = (activeItem && itemLinesMap[activeItem.header_id]) || [];

  const updateActiveLines = (updater: (prev: EditableLine[]) => EditableLine[]) => {
    if (!activeItem) return;
    setItemLinesMap((prev) => ({
      ...prev,
      [activeItem.header_id]: updater(prev[activeItem.header_id] || []),
    }));
  };

  // Balance calculations: sum(T) and sum(K)
  const { sumT, sumK, diff, isBalanced } = useMemo(() => {
    let t = 0;
    let k = 0;
    lines.forEach((line) => {
      const val = Number(line.amount || 0);
      if (line.dc_type === 'T') {
        t += val;
      } else {
        k += val;
      }
    });
    const d = Math.abs(t - k);
    return {
      sumT: t,
      sumK: k,
      diff: d,
      isBalanced: d < 0.01 && lines.length >= 2,
    };
  }, [lines]);

  // Filtered GL Accounts based on search input
  const filteredGlAccounts = useMemo(() => {
    if (!glSearchQuery.trim()) return glAccounts.slice(0, 80);
    const q = glSearchQuery.toLowerCase();
    return glAccounts
      .filter(
        (g: any) =>
          g.gl_number.toLowerCase().includes(q) ||
          g.short_name.toLowerCase().includes(q)
      )
      .slice(0, 80);
  }, [glAccounts, glSearchQuery]);

  // Line editing handlers for active item lines
  const handleLineChange = (index: number, field: keyof EditableLine, value: any) => {
    updateActiveLines((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const handleGlSelect = (index: number, gl: any) => {
    updateActiveLines((prev) => {
      const next = [...prev];
      next[index] = {
        ...next[index],
        gl_account_id: gl.id,
        gl_number: gl.gl_number,
        gl_short_name: gl.short_name,
      };
      return next;
    });
    setOpenDropdownIndex(null);
  };

  const handleAddLine = () => {
    const nextSeq = lines.length + 1;
    // Default to the opposite side to assist balancing
    const nextDc = sumT > sumK ? 'K' : 'T';
    const nextAmt = diff > 0.01 ? Number(diff.toFixed(2)) : 0;

    updateActiveLines((prev) => [
      ...prev,
      {
        id: `temp-${Date.now()}-${nextSeq}`,
        sequence_number: nextSeq,
        gl_account_id: '',
        gl_number: '',
        gl_short_name: '',
        dc_type: nextDc,
        amount: nextAmt,
        foreign_amount: null,
        vat_role: null,
        vat_code: null,
        description: activeItem?.description || '',
      },
    ]);
  };

  const handleDeleteLine = (index: number) => {
    if (lines.length <= 1) {
      toast({
        title: 'Nem törölhető',
        description: 'A bizonylatnak legalább egy tétellel rendelkeznie kell.',
        variant: 'destructive',
      });
      return;
    }
    updateActiveLines((prev) => prev.filter((_, idx) => idx !== index));
  };

  // Mutation to save lines
  const saveLinesMutation = useMutation({
    mutationFn: async ({ headerId, currentLines }: { headerId: string; currentLines: EditableLine[] }) => {
      // 1. Delete existing lines for this header
      const { error: delErr } = await supabase
        .from('acc_journal_lines')
        .delete()
        .eq('header_id', headerId);
      if (delErr) throw delErr;

      // 2. Insert updated lines
      const insertData = currentLines.map((line, idx) => ({
        header_id: headerId,
        sequence_number: idx + 1,
        gl_account_id: line.gl_account_id && line.gl_account_id !== '' ? line.gl_account_id : null,
        dc_type: line.dc_type,
        amount: Number(line.amount || 0),
        foreign_amount: line.foreign_amount ? Number(line.foreign_amount) : null,
        vat_role: line.vat_role || null,
        vat_code: line.vat_code || null,
        description: line.description || null,
      }));

      const { error: insErr } = await supabase
        .from('acc_journal_lines')
        .insert(insertData);
      if (insErr) throw insErr;

      return headerId;
    },
    onError: (err: any) => {
      toast({
        title: 'Mentési hiba',
        description: err.message || 'Nem sikerült elmenteni a kontírozott sorokat.',
        variant: 'destructive',
      });
    },
  });

  // Mutation to post the journal entries for the current invoice
  const postEntryMutation = useMutation({
    mutationFn: async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error('Bejelentkezés szükséges a könyveléshez.');
      if (!currentInvoice) return;

      // 1. Save lines for all items of this invoice
      for (const item of currentInvoice.items) {
        const itemLines = itemLinesMap[item.header_id];
        if (itemLines && itemLines.length > 0) {
          await saveLinesMutation.mutateAsync({
            headerId: item.header_id,
            currentLines: itemLines,
          });
        }
      }

      // 2. Call acc_post_journal_entry RPC for each header_id
      for (const headerId of currentInvoice.header_ids) {
        const { error } = await supabase.rpc('acc_post_journal_entry', {
          p_header_id: headerId,
          p_user_id: user.id,
        });
        if (error) throw error;
      }

      return currentInvoice;
    },
    onSuccess: () => {
      toast({
        title: 'Számla sikeresen lekönyvelve',
        description: `A(z) ${currentInvoice?.document_id} számla (${currentInvoice?.items.length || 1} tétel) véglegesen rögzítve lett.`,
      });
      queryClient.invalidateQueries({ queryKey: subledgerQueryKeys.all });
      queryClient.invalidateQueries({ queryKey: ['acc-journal-entries'] });

      // If more invoices, advance to next; otherwise close
      if (currentIndex < invoices.length - 1) {
        setCurrentIndex((prev) => prev + 1);
      } else {
        onClose();
      }
    },
    onError: (err: any) => {
      toast({
        title: 'Könyvelési hiba',
        description: err.message || 'A tétel könyvelése sikertelen volt.',
        variant: 'destructive',
      });
    },
  });

  // Save draft without posting
  const handleSaveDraft = async () => {
    if (!currentInvoice) return;
    try {
      for (const item of currentInvoice.items) {
        const itemLines = itemLinesMap[item.header_id];
        if (itemLines && itemLines.length > 0) {
          await saveLinesMutation.mutateAsync({
            headerId: item.header_id,
            currentLines: itemLines,
          });
        }
      }
      toast({
        title: 'Változtatások elmentve',
        description: `A(z) ${currentInvoice.document_id} számla kontírozása piszkozatként sikeresen frissítve lett.`,
      });
      queryClient.invalidateQueries({ queryKey: subledgerQueryKeys.all });
      if (currentIndex < invoices.length - 1) {
        setCurrentIndex((prev) => prev + 1);
      } else {
        onClose();
      }
    } catch {
      // Handled in onError
    }
  };

  // Post entry
  const handlePost = () => {
    if (!currentInvoice) return;
    if (!isBalanced) {
      toast({
        title: 'Nincs egyensúlyban',
        description: 'A könyveléshez a Tartozik és Követel összegeknek egyezniük kell (∑T = ∑K)!',
        variant: 'destructive',
      });
      return;
    }
    postEntryMutation.mutate();
  };

  if (!currentInvoice) return null;

  const isSaving = saveLinesMutation.isPending || postEntryMutation.isPending;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-4xl lg:max-w-5xl w-[96vw] max-h-[90vh] flex flex-col p-6 overflow-hidden">
        {/* Header with Title and Stepper */}
        <DialogHeader className="shrink-0 pb-2 border-b">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <DialogTitle className="flex items-center gap-2 text-lg font-bold">
                {isEditMode ? (
                  <>
                    <ArrowRightLeft className="w-5 h-5 text-indigo-600" />
                    <span>Számla módosítása és kontírozása</span>
                  </>
                ) : (
                  <>
                    <FileCheck className="w-5 h-5 text-indigo-600" />
                    <span>Számla könyvelése (Kontírozás ellenőrzése)</span>
                  </>
                )}
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                Ellenőrizd és szükség esetén módosítsd a Tartozik (T) és Követel (K) oldali kontírokat a számla véglegesítése előtt.
              </DialogDescription>
            </div>

            {/* Stepper when multiple invoices are selected */}
            {invoices.length > 1 && (
              <div className="flex items-center gap-2 bg-muted/60 px-3 py-1.5 rounded-lg border text-xs">
                <span className="font-medium text-foreground">
                  {currentIndex + 1} / {invoices.length} számla
                </span>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0"
                    disabled={currentIndex === 0 || isSaving}
                    onClick={() => setCurrentIndex((prev) => Math.max(0, prev - 1))}
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0"
                    disabled={currentIndex === invoices.length - 1 || isSaving}
                    onClick={() => setCurrentIndex((prev) => Math.min(invoices.length - 1, prev + 1))}
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        </DialogHeader>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto space-y-4 py-3 pr-1">
          {/* Invoice Summary Overview Card */}
          <div className="bg-muted/40 rounded-xl p-4 border space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="space-y-0.5">
                <div className="text-muted-foreground">Számlasorszám / Bizonylat:</div>
                <div className="text-base font-bold text-foreground font-mono flex items-center gap-2">
                  <span>{currentInvoice.document_id}</span>
                  <Badge variant="outline" className="text-[10px] uppercase font-mono">
                    {currentInvoice.journal_code}-{currentInvoice.journal_number || 'Piszkozat'}
                  </Badge>
                  {currentInvoice.items.length > 1 && (
                    <Badge className="bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300 border-purple-200 dark:border-purple-800 text-[10px]">
                      {currentInvoice.items.length} számlatétel
                    </Badge>
                  )}
                  {currentInvoice.status === 'GEPI_JAVASLAT' && (
                    <Badge variant="secondary" className="text-[10px] bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300">
                      Javaslat
                    </Badge>
                  )}
                </div>
              </div>

              <div className="space-y-0.5">
                <div className="text-muted-foreground">Partner:</div>
                <div className="text-sm font-semibold text-foreground">
                  {currentInvoice.partner_name || '-'}
                </div>
              </div>

              <div className="flex items-center gap-4 text-xs font-mono">
                <div>
                  <span className="text-muted-foreground">Kelt: </span>
                  <span className="font-semibold text-foreground">{currentInvoice.document_date || currentInvoice.posting_date}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Könyvelés: </span>
                  <span className="font-semibold text-foreground">{currentInvoice.posting_date}</span>
                </div>
                {currentInvoice.due_date && (
                  <div>
                    <span className="text-muted-foreground">Esedékesség: </span>
                    <span className="font-semibold text-foreground">{currentInvoice.due_date}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Financial Amounts Breakdown: Nettó, ÁFA, Bruttó */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t">
              <div className="p-2.5 rounded-lg bg-card border">
                <div className="text-[11px] text-muted-foreground uppercase font-medium">Nettó összeg</div>
                <div className="text-lg font-bold text-foreground font-mono">
                  {formatCurrency(currentInvoice.net_amount, currentInvoice.currency)}
                </div>
              </div>

              <div className="p-2.5 rounded-lg bg-card border">
                <div className="text-[11px] text-muted-foreground uppercase font-medium">ÁFA összeg</div>
                <div className="text-lg font-bold text-indigo-600 dark:text-indigo-400 font-mono">
                  {formatCurrency(currentInvoice.vat_amount, currentInvoice.currency)}
                </div>
              </div>

              <div className="p-2.5 rounded-lg bg-card border">
                <div className="text-[11px] text-muted-foreground uppercase font-medium">Bruttó összeg</div>
                <div className="text-lg font-bold text-foreground font-mono">
                  {formatCurrency(currentInvoice.amount, currentInvoice.currency)}
                </div>
              </div>
            </div>
          </div>

          {/* Sub-item Selector if multi-item invoice */}
          {currentInvoice.items.length > 1 && (
            <div className="bg-muted/30 p-2.5 rounded-xl border space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-foreground flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Számlatételek ({currentInvoice.items.length}): válaszd ki a tételt a kontírok megtekintéséhez/szerkesztéséhez</span>
                </span>
                <span className="text-muted-foreground font-mono text-[11px]">
                  Aktív: {activeItemIndex + 1} / {currentInvoice.items.length} tétel
                </span>
              </div>
              <div className="flex items-center gap-2 overflow-x-auto pb-1">
                {currentInvoice.items.map((it, idx) => (
                  <button
                    key={it.line_id || it.header_id || idx}
                    type="button"
                    onClick={() => setActiveItemIndex(idx)}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all shrink-0 ${
                      activeItemIndex === idx
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                        : 'bg-card text-foreground hover:bg-muted border-border'
                    }`}
                  >
                    <span className="font-mono font-bold">#{idx + 1}</span>
                    <span className="max-w-[160px] truncate">{it.description || `Tétel #${idx + 1}`}</span>
                    <span className={`font-mono text-[11px] ${activeItemIndex === idx ? 'text-indigo-100' : 'text-muted-foreground'}`}>
                      ({formatCurrency(it.amount, it.currency)})
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Lines Table: Both Sides (Tartozik and Követel) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="text-sm font-bold text-foreground flex items-center gap-2">
                <span>
                  Kontírozási tételek {currentInvoice.items.length > 1 ? `(#${activeItemIndex + 1}: ${activeItem?.description || ''})` : ''}
                </span>
                <span className="text-xs text-muted-foreground font-normal">({lines.length} sor)</span>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAddLine}
                className="h-8 text-xs flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Új sor hozzáadása</span>
              </Button>
            </div>

            <div className="border rounded-xl overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left border-collapse">
                  <thead>
                    <tr className="bg-muted/70 border-b text-muted-foreground font-semibold">
                      <th className="p-2.5 w-12 text-center">#</th>
                      <th className="p-2.5 w-24 text-center">Oldal (T/K)</th>
                      <th className="p-2.5 min-w-[260px]">Főkönyvi számla (Kontír)</th>
                      <th className="p-2.5 w-40 text-right">Összeg</th>
                      <th className="p-2.5 w-28">Szerepkör</th>
                      <th className="p-2.5 min-w-[180px]">Megjegyzés / Sor leírás</th>
                      <th className="p-2.5 w-12 text-center"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {lines.map((line, idx) => (
                      <tr key={line.id} className="hover:bg-muted/20 transition-colors">
                        {/* Sequence */}
                        <td className="p-2.5 text-center font-mono text-muted-foreground">
                          {idx + 1}
                        </td>

                        {/* DC Type Toggle (T / K) */}
                        <td className="p-2.5 text-center">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              handleLineChange(idx, 'dc_type', line.dc_type === 'T' ? 'K' : 'T')
                            }
                            className={`h-7 px-3 font-bold font-mono text-xs rounded-md ${
                              line.dc_type === 'T'
                                ? 'bg-blue-100 text-blue-800 hover:bg-blue-200 dark:bg-blue-950 dark:text-blue-300'
                                : 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200 dark:bg-emerald-950 dark:text-emerald-300'
                            }`}
                            title="Kattints a T/K váltáshoz"
                          >
                            {line.dc_type === 'T' ? 'T (Tartozik)' : 'K (Követel)'}
                          </Button>
                        </td>

                        {/* GL Account Searchable Dropdown */}
                        <td className="p-2.5">
                          <Popover
                            open={openDropdownIndex === idx}
                            onOpenChange={(open) => {
                              if (open) {
                                setOpenDropdownIndex(idx);
                                setGlSearchQuery('');
                              } else {
                                setOpenDropdownIndex(null);
                              }
                            }}
                          >
                            <PopoverTrigger asChild>
                              <Button
                                variant="outline"
                                role="combobox"
                                className="h-8 w-full justify-between font-mono text-xs text-left px-2 border bg-background hover:bg-muted/40"
                              >
                                <span className="truncate flex-1">
                                  {line.gl_number ? (
                                    <span>
                                      <strong>{line.gl_number}</strong> - {line.gl_short_name}
                                    </span>
                                  ) : (
                                    <span className="text-muted-foreground italic">Válassz számlát...</span>
                                  )}
                                </span>
                                <span className="text-[10px] text-muted-foreground ml-1">▼</span>
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-[380px] p-0 z-[1200]" align="start">
                              <Command shouldFilter={false}>
                                <CommandInput
                                  placeholder="Keresés számlaszámra vagy névre..."
                                  value={glSearchQuery}
                                  onValueChange={setGlSearchQuery}
                                  autoFocus
                                />
                                <CommandList className="max-h-[240px] overflow-y-auto">
                                  <CommandEmpty>Nincs találat.</CommandEmpty>
                                  <CommandGroup>
                                    {filteredGlAccounts.map((gl: any) => (
                                      <CommandItem
                                        key={gl.id}
                                        value={`${gl.gl_number} ${gl.short_name}`}
                                        onSelect={() => handleGlSelect(idx, gl)}
                                        className="cursor-pointer flex items-center justify-between py-2 text-xs"
                                      >
                                        <div className="flex flex-col min-w-0">
                                          <span className="font-mono font-bold text-foreground">
                                            {gl.gl_number}
                                          </span>
                                          <span className="text-muted-foreground truncate">
                                            {gl.short_name}
                                          </span>
                                        </div>
                                        {line.gl_account_id === gl.id && (
                                          <Check className="h-4 w-4 text-indigo-600 shrink-0" />
                                        )}
                                      </CommandItem>
                                    ))}
                                  </CommandGroup>
                                </CommandList>
                              </Command>
                            </PopoverContent>
                          </Popover>
                        </td>

                        {/* Amount */}
                        <td className="p-2.5 text-right font-mono">
                          <Input
                            type="number"
                            step="any"
                            value={line.amount}
                            onChange={(e) =>
                              handleLineChange(idx, 'amount', parseFloat(e.target.value) || 0)
                            }
                            className="h-8 text-right font-mono text-xs w-full"
                          />
                        </td>

                        {/* VAT Role / Code */}
                        <td className="p-2.5">
                          {line.vat_role ? (
                            <Badge variant="outline" className="text-[10px] uppercase font-mono">
                              {line.vat_role} {line.vat_code ? `(${line.vat_code})` : ''}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground text-[11px]">-</span>
                          )}
                        </td>

                        {/* Description */}
                        <td className="p-2.5">
                          <Input
                            value={line.description}
                            onChange={(e) => handleLineChange(idx, 'description', e.target.value)}
                            placeholder="Tétel megnevezése..."
                            className="h-8 text-xs w-full"
                          />
                        </td>

                        {/* Delete Row */}
                        <td className="p-2.5 text-center">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteLine(idx)}
                            className="h-7 w-7 p-0 text-muted-foreground hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                            title="Sor törlése"
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

            {/* Verification Balance Bar: Sum(T) vs Sum(K) */}
            <div className="bg-slate-900 text-white rounded-xl p-3.5 flex flex-wrap items-center justify-between gap-4 text-xs font-mono">
              <div className="flex flex-wrap items-center gap-6">
                <div>
                  <span className="text-slate-400">∑ Tartozik (T): </span>
                  <span className="font-bold text-white">{formatCurrency(sumT, currentInvoice.currency)}</span>
                </div>
                <div className="text-slate-600">|</div>
                <div>
                  <span className="text-slate-400">∑ Követel (K): </span>
                  <span className="font-bold text-white">{formatCurrency(sumK, currentInvoice.currency)}</span>
                </div>
                <div className="text-slate-600">|</div>
                <div>
                  <span className="text-slate-400">Különbözet (Δ): </span>
                  <span
                    className={`font-bold ${
                      isBalanced ? 'text-emerald-400' : 'text-rose-400'
                    }`}
                  >
                    {formatCurrency(diff, currentInvoice.currency)}
                  </span>
                </div>
              </div>

              <div>
                {isBalanced ? (
                  <Badge className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1.5 py-1 px-2.5 font-sans">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Mérlegben (∑T = ∑K)</span>
                  </Badge>
                ) : (
                  <Badge className="bg-rose-500/20 text-rose-300 border border-rose-500/40 flex items-center gap-1.5 py-1 px-2.5 font-sans">
                    <AlertCircle className="w-3.5 h-3.5 text-rose-400" />
                    <span>Nincs egyensúlyban</span>
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <DialogFooter className="shrink-0 pt-3 border-t flex flex-col sm:flex-row items-center justify-between gap-2">
          <div>
            {onOpenFullManualEditor && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  onClose();
                  onOpenFullManualEditor(activeItem?.header_id || currentInvoice.header_ids[0]);
                }}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Teljes kézi szerkesztő megnyitása →
              </Button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isSaving}
              className="text-xs"
            >
              Mégse
            </Button>

            <Button
              type="button"
              variant="secondary"
              onClick={handleSaveDraft}
              disabled={isSaving}
              className="text-xs flex items-center gap-1.5"
            >
              {saveLinesMutation.isPending ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Save className="w-3.5 h-3.5" />
              )}
              <span>Mentés piszkozatként</span>
            </Button>

            <Button
              type="button"
              onClick={handlePost}
              disabled={!isBalanced || isSaving}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-xs flex items-center gap-1.5 shadow-sm"
            >
              {postEntryMutation.isPending ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <CheckCircle2 className="w-3.5 h-3.5" />
              )}
              <span>Végleges Könyvelés</span>
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
