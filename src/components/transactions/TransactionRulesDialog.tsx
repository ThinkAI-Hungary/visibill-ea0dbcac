import { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCompany } from '@/contexts/CompanyContext';
import { useActivePreset } from '@/hooks/useActivePreset';
import { supabase } from '@/integrations/supabase/client';
import { fetchAllGlAccountsByPreset } from '@/lib/glData';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Trash2, Edit2, Plus, Play, Check, ChevronsUpDown, Loader2, Sparkles, Sliders, AlertCircle, FileText } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { formatCurrency, cn } from '@/lib/utils';

interface TransactionRule {
  id: string;
  name: string;
  description_pattern: string;
  pattern_type: 'regex' | 'contains';
  amount_min: number | null;
  amount_max: number | null;
  direction: 'INFLOW' | 'OUTFLOW' | 'ALL';
  target_gl_account_id: string | null;
  auto_verify: boolean;
}

interface TransactionRulesDialogProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function TransactionRulesDialog({ open: externalOpen, onOpenChange: externalOnOpenChange }: TransactionRulesDialogProps = {}) {
  const { selectedCompany } = useCompany();
  const { activePresetId } = useActivePreset(selectedCompany?.id);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [internalOpen, setInternalOpen] = useState(false);
  const isOpen = externalOpen !== undefined ? externalOpen : internalOpen;
  const setIsOpen = externalOnOpenChange || setInternalOpen;

  const companyId = selectedCompany?.id;

  // View state: 'list' | 'create' | 'edit'
  const [viewMode, setViewMode] = useState<'list' | 'form'>('list');
  const [editingRule, setEditingRule] = useState<TransactionRule | null>(null);

  // Form states
  const [formName, setFormName] = useState('');
  const [formPatternType, setFormPatternType] = useState<'regex' | 'contains'>('contains');
  const [formPattern, setFormPattern] = useState('');
  const [formDirection, setFormDirection] = useState<'INFLOW' | 'OUTFLOW' | 'ALL'>('ALL');
  const [formAmountMin, setFormAmountMin] = useState<string>('');
  const [formAmountMax, setFormAmountMax] = useState<string>('');
  const [formGlAccountId, setFormGlAccountId] = useState<string>('');
  const [formAutoVerify, setFormAutoVerify] = useState(false);

  const [glSearchQuery, setGlSearchQuery] = useState('');
  const [glComboOpen, setGlComboOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // Test state
  const [testResults, setTestResults] = useState<{ matchedCount: number; samples: any[] } | null>(null);
  const [testing, setTesting] = useState(false);

  // Fetch transaction rules
  const { data: rules = [], isLoading: rulesLoading } = useQuery({
    queryKey: ['transaction_rules', companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('transaction_rules' as any)
        .select('*')
        .eq('company_id', companyId!)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as TransactionRule[];
    },
    enabled: !!companyId && isOpen,
  });

  // Fetch GL accounts (paginated)
  const { data: glAccounts = [] } = useQuery({
    queryKey: ['glAccounts_rules', activePresetId],
    queryFn: async () => {
      if (!activePresetId) return [];
      return await fetchAllGlAccountsByPreset(activePresetId);
    },
    enabled: !!activePresetId && isOpen,
  });

  const glAccountMap = useMemo(() => {
    const map = new Map<string, { gl_number: string; short_name: string }>();
    glAccounts.forEach(gl => map.set(gl.id, { gl_number: gl.gl_number, short_name: gl.short_name }));
    return map;
  }, [glAccounts]);

  const cleanGlNum = (num: any) => num ? String(num).replace(/\./g, '') : '';

  // Get GL account display label
  const getGlLabel = (id: string | null) => {
    if (!id) return 'Válassz főkönyvi számot...';
    const acc = glAccountMap.get(id);
    return acc ? `${acc.gl_number} ${acc.short_name}` : 'Nincs besorolva';
  };

  // Open creation form
  const handleOpenCreate = () => {
    setEditingRule(null);
    setFormName('');
    setFormPatternType('contains');
    setFormPattern('');
    setFormDirection('ALL');
    setFormAmountMin('');
    setFormAmountMax('');
    setFormGlAccountId('');
    setFormAutoVerify(false);
    setTestResults(null);
    setViewMode('form');
  };

  // Open edit form
  const handleOpenEdit = (rule: TransactionRule) => {
    setEditingRule(rule);
    setFormName(rule.name);
    setFormPatternType(rule.pattern_type);
    setFormPattern(rule.description_pattern);
    setFormDirection(rule.direction);
    setFormAmountMin(rule.amount_min !== null ? String(rule.amount_min) : '');
    setFormAmountMax(rule.amount_max !== null ? String(rule.amount_max) : '');
    setFormGlAccountId(rule.target_gl_account_id || '');
    setFormAutoVerify(rule.auto_verify);
    setTestResults(null);
    setViewMode('form');
  };

  // Save rule
  const handleSaveRule = async () => {
    if (!formName || !formPattern || !companyId) {
      toast({ title: 'Hiba', description: 'A név és a minta megadása kötelező!', variant: 'destructive' });
      return;
    }

    setSaving(true);
    const amountMin = formAmountMin ? parseFloat(formAmountMin) : null;
    const amountMax = formAmountMax ? parseFloat(formAmountMax) : null;

    const payload = {
      company_id: companyId,
      name: formName,
      description_pattern: formPattern,
      pattern_type: formPatternType,
      amount_min: amountMin,
      amount_max: amountMax,
      direction: formDirection,
      target_gl_account_id: formGlAccountId || null,
      auto_verify: formAutoVerify,
    };

    try {
      if (editingRule) {
        const { error } = await supabase
          .from('transaction_rules' as any)
          .update(payload)
          .eq('id', editingRule.id);
        if (error) throw error;
        toast({ title: 'Szabály frissítve', description: 'A szabály sikeresen mentésre került.', className: 'bg-green-50 text-green-900 border-green-200' });
      } else {
        const { error } = await supabase
          .from('transaction_rules' as any)
          .insert([payload]);
        if (error) throw error;
        toast({ title: 'Szabály létrehozva', description: 'Az új szabály sikeresen rögzítve lett.', className: 'bg-green-50 text-green-900 border-green-200' });
      }
      queryClient.invalidateQueries({ queryKey: ['transaction_rules', companyId] });
      setViewMode('list');
    } catch (err: any) {
      toast({ title: 'Mentési hiba', description: err.message || 'Hiba történt a mentés során.', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  // Delete rule
  const handleDeleteRule = async (id: string) => {
    if (!confirm('Biztosan törlöd ezt a szabályt?')) return;
    try {
      const { error } = await supabase
        .from('transaction_rules' as any)
        .delete()
        .eq('id', id);
      if (error) throw error;
      toast({ title: 'Szabály törölve', description: 'A szabály véglegesen törlésre került.' });
      queryClient.invalidateQueries({ queryKey: ['transaction_rules', companyId] });
    } catch (err: any) {
      toast({ title: 'Hiba', description: err.message || 'Hiba történt a törlés során.', variant: 'destructive' });
    }
  };

  const highlightMatch = (text: string, pattern: string, isRegex: boolean) => {
    if (!text || !pattern) return text;
    try {
      if (isRegex) {
        const regex = new RegExp(`(${pattern})`, 'gi');
        const parts = text.split(regex);
        return parts.map((part, i) => 
          regex.test(part) 
            ? <span key={i} className="bg-primary/20 text-primary-foreground font-semibold px-0.5 rounded">{part}</span> 
            : part
        );
      } else {
        const index = text.toLowerCase().indexOf(pattern.toLowerCase());
        if (index === -1) return text;
        const length = pattern.length;
        return (
          <>
            {text.slice(0, index)}
            <span className="bg-primary/20 text-primary-foreground font-semibold px-0.5 rounded">
              {text.slice(index, index + length)}
            </span>
            {text.slice(index + length)}
          </>
        );
      }
    } catch (e) {
      return text;
    }
  };

  // Test rule locally in JS against unverified transactions
  const handleTestRule = async () => {
    if (!formPattern || !companyId) return;
    setTesting(true);

    try {
      // Query unverified transactions (suggested + unmatched)
      const { data: txs, error } = await supabase
        .from('transactions')
        .select('id, description, amount, transaction_date')
        .or('is_verified.is.null,is_verified.eq.false')
        .eq('company_id', companyId)
        .limit(300);

      if (error) throw error;

      const amountMin = formAmountMin ? parseFloat(formAmountMin) : null;
      const amountMax = formAmountMax ? parseFloat(formAmountMax) : null;

      let regex: RegExp | null = null;
      if (formPatternType === 'regex') {
        try {
          regex = new RegExp(formPattern, 'i');
        } catch (e) {
          toast({ title: 'Érvénytelen Regex', description: 'A megadott minta hibás reguláris kifejezés.', variant: 'destructive' });
          setTesting(false);
          return;
        }
      }

      const matches = (txs || []).filter(tx => {
        // Direction check
        if (formDirection !== 'ALL') {
          const isTxInflow = tx.amount > 0;
          if (formDirection === 'INFLOW' && !isTxInflow) return false;
          if (formDirection === 'OUTFLOW' && isTxInflow) return false;
        }

        // Amount check
        const absAmount = Math.abs(tx.amount);
        if (amountMin !== null && absAmount < amountMin) return false;
        if (amountMax !== null && absAmount > amountMax) return false;

        // Description check
        const desc = tx.description || '';
        if (formPatternType === 'contains') {
          return desc.toLowerCase().includes(formPattern.toLowerCase());
        } else if (regex) {
          return regex.test(desc);
        }
        return false;
      });

      setTestResults({
        matchedCount: matches.length,
        samples: matches.slice(0, 15),
      });
    } catch (err: any) {
      toast({ title: 'Tesztelési hiba', description: err.message, variant: 'destructive' });
    } finally {
      setTesting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      {externalOpen === undefined && (
        <DialogTrigger asChild>
          <Button variant="outline" size="sm">
            <Sliders className="h-4 w-4 mr-2" />
            Könyvelési szabályok
          </Button>
        </DialogTrigger>
      )}
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sliders className="h-5 w-5 text-primary" />
            Automatikus könyvelési szabályok
          </DialogTitle>
          <DialogDescription>
            Definiáljon szabályokat, amelyek automatikusan besorolják a banki tranzakciókat a leírás vagy összeg alapján.
          </DialogDescription>
        </DialogHeader>

        {viewMode === 'list' ? (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">
                Aktív szabályok száma: {rules.length} db
              </span>
              <Button size="sm" onClick={handleOpenCreate} className="gap-1">
                <Plus className="h-4 w-4" />
                Új szabály
              </Button>
            </div>

            {rulesLoading ? (
              <div className="flex justify-center items-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : rules.length === 0 ? (
              <div className="text-center py-12 border border-dashed rounded-lg bg-muted/20">
                <AlertCircle className="h-8 w-8 mx-auto mb-2 text-muted-foreground/60" />
                <p className="font-semibold text-muted-foreground">Nincsenek létrehozott szabályok.</p>
                <p className="text-xs text-muted-foreground/75 mt-1">Hozzon létre egyet a bankbizonylatok automata feldolgozásához.</p>
              </div>
            ) : (
              <div className="rounded-lg border border-border/50 overflow-x-auto">
                <Table className="compact-table">
                  <TableHeader>
                    <TableRow className="bg-muted/30">
                      <TableHead>Név</TableHead>
                      <TableHead>Minta</TableHead>
                      <TableHead>Irány / Összeg</TableHead>
                      <TableHead>Cél főkönyvi szám</TableHead>
                      <TableHead className="text-center">Azonnali jóváhagyás</TableHead>
                      <TableHead className="text-right">Műveletek</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rules.map((rule) => (
                      <TableRow key={rule.id} data-row-hover>
                        <TableCell className="font-semibold">{rule.name}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono text-xs bg-slate-100 dark:bg-secondary border px-1.5 py-0.5 rounded text-foreground">
                              {rule.description_pattern}
                            </span>
                            <span className="text-[10px] text-muted-foreground uppercase border px-1 rounded">
                              {rule.pattern_type === 'regex' ? 'regex' : 'tartalmaz'}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">
                          <div className="space-y-0.5">
                            <p className="font-medium text-xs">
                              {rule.direction === 'ALL' ? 'Minden tranzakció' : (rule.direction === 'INFLOW' ? 'Csak bevételek' : 'Csak kiadások')}
                            </p>
                            {(rule.amount_min !== null || rule.amount_max !== null) && (
                              <p className="text-[11px] text-muted-foreground font-mono">
                                {rule.amount_min !== null && `Min: ${formatCurrency(rule.amount_min, 'HUF')}`}
                                {rule.amount_max !== null && ` Max: ${formatCurrency(rule.amount_max, 'HUF')}`}
                              </p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="font-semibold text-xs">
                          {rule.target_gl_account_id ? (
                            <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                              {getGlLabel(rule.target_gl_account_id)}
                            </span>
                          ) : (
                            <span className="text-muted-foreground italic">Nincs megadva</span>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          <span className={cn(
                            "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold",
                            rule.auto_verify ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" : "bg-muted text-muted-foreground"
                          )}>
                            {rule.auto_verify ? 'Igen' : 'Nem'}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0"
                              onClick={() => handleOpenEdit(rule)}
                            >
                              <Edit2 className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                              onClick={() => handleDeleteRule(rule.id)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
              {/* Form panel */}
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-semibold">Szabály neve</label>
                  <Input
                    placeholder="pl. MVM Automata, Kártyás Vásárlás..."
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-semibold">Illeszkedés típusa</label>
                    <Select value={formPatternType} onValueChange={(v: 'regex' | 'contains') => setFormPatternType(v)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="contains">Szöveg tartalmazás</SelectItem>
                        <SelectItem value="regex">Reguláris kifejezés (Regex)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-semibold">Tranzakció iránya</label>
                    <Select value={formDirection} onValueChange={(v: 'INFLOW' | 'OUTFLOW' | 'ALL') => setFormDirection(v)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ALL">Összes irány</SelectItem>
                        <SelectItem value="INFLOW">Csak bevételek (+)</SelectItem>
                        <SelectItem value="OUTFLOW">Csak kiadások (-)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-semibold">Tranzakció leírásában keresendő minta</label>
                  <Input
                    placeholder={formPatternType === 'contains' ? "pl. MVM, Raiffeisen bank, NAV..." : "pl. ^MVM.*Zrt$"}
                    value={formPattern}
                    onChange={(e) => setFormPattern(e.target.value)}
                    className="font-mono"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-semibold">Minimum összeg (opcionális)</label>
                    <Input
                      type="number"
                      placeholder="Min Ft"
                      value={formAmountMin}
                      onChange={(e) => setFormAmountMin(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-semibold">Maximum összeg (opcionális)</label>
                    <Input
                      type="number"
                      placeholder="Max Ft"
                      value={formAmountMax}
                      onChange={(e) => setFormAmountMax(e.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-2 flex flex-col">
                  <label className="text-sm font-semibold mb-1">Cél főkönyvi szám</label>
                  <Popover open={glComboOpen} onOpenChange={setGlComboOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={glComboOpen}
                        className="justify-between w-full font-medium"
                      >
                        <span className="truncate">{getGlLabel(formGlAccountId)}</span>
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[400px] p-0 z-[1100]">
                      <Command shouldFilter={false}>
                        <CommandInput
                          placeholder="Főkönyvi szám keresése..."
                          value={glSearchQuery}
                          onValueChange={setGlSearchQuery}
                        />
                        <CommandList>
                          <CommandEmpty>Nincs találat.</CommandEmpty>
                          <CommandGroup>
                            {glAccounts
                              ?.filter(gl => !glSearchQuery || `${gl.gl_number} ${gl.short_name}`.toLowerCase().includes(glSearchQuery.toLowerCase()))
                              .slice()
                              .sort((a, b) => cleanGlNum(a.gl_number).localeCompare(cleanGlNum(b.gl_number)))
                              .map(gl => {
                                // Only show leaf nodes
                                const isLeaf = !glAccounts.some(sub => cleanGlNum(sub.gl_number).startsWith(cleanGlNum(gl.gl_number)) && sub.id !== gl.id);
                                if (!isLeaf) return null;
                                return (
                                  <CommandItem
                                    key={gl.id}
                                    value={`${gl.gl_number} ${gl.short_name}`}
                                    onSelect={() => {
                                      setFormGlAccountId(gl.id);
                                      setGlComboOpen(false);
                                    }}
                                  >
                                    <Check
                                      className={cn(
                                        "mr-2 h-4 w-4 text-primary",
                                        formGlAccountId === gl.id ? "opacity-100" : "opacity-0"
                                      )}
                                    />
                                    {gl.gl_number} {gl.short_name}
                                  </CommandItem>
                                );
                              })}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="flex items-center justify-between p-3 border rounded-lg bg-muted/20">
                  <div className="space-y-0.5">
                    <p className="text-sm font-semibold">Azonnali jóváhagyás (Auto-verify)</p>
                    <p className="text-xs text-muted-foreground">A szabály illeszkedésekor a rendszer lezártként és könyveltként rögzíti a tranzakciót.</p>
                  </div>
                  <Switch
                    checked={formAutoVerify}
                    onCheckedChange={setFormAutoVerify}
                  />
                </div>
              </div>

              {/* Live Testing Simulator Panel */}
              <div className="border rounded-xl p-5 bg-gradient-to-br from-primary/5 via-transparent to-primary/5 flex flex-col h-full justify-between min-h-[350px]">
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-primary">
                    <Sparkles className="h-5 w-5 animate-pulse" />
                    <h3 className="font-bold text-sm">Interaktív szabályszimuláció</h3>
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    Szimulálja a szabály működését valós időben a jelenlegi lekönyveletlen tranzakciókon.
                  </p>

                  {testResults !== null && (
                    <div className="space-y-3.5 animate-in fade-in duration-200">
                      <div className="flex items-center gap-3 p-3 bg-white dark:bg-slate-900/60 rounded-xl border border-primary/20 shadow-sm">
                        <div className="p-2 rounded-lg bg-green-500/10 text-green-600 dark:text-green-400">
                          <Check className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Szimulált találatok:</p>
                          <p className="text-lg font-bold text-foreground tabular-nums">{testResults.matchedCount} tranzakció</p>
                        </div>
                      </div>

                      {testResults.matchedCount > 0 && (
                        <div className="space-y-2">
                          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Szimulált illeszkedések:</p>
                          <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                            {testResults.samples.map((sample, idx) => (
                              <div key={idx} className="p-2.5 bg-muted/40 hover:bg-muted/60 dark:bg-secondary/20 dark:hover:bg-secondary/35 rounded-lg border border-border/40 text-xs transition-all">
                                <div className="flex justify-between items-start gap-1">
                                  <div className="flex items-center gap-1.5 min-w-0">
                                    {sample.amount > 0 ? (
                                      <span className="text-[9px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1 py-0.5 rounded shrink-0">BE</span>
                                    ) : (
                                      <span className="text-[9px] font-bold text-rose-600 dark:text-rose-400 bg-rose-500/10 px-1 py-0.5 rounded shrink-0">KI</span>
                                    )}
                                    <span className="text-[10px] text-muted-foreground font-mono shrink-0">
                                      {sample.transaction_date ? sample.transaction_date.slice(5).replace('-', '.') : ''}
                                    </span>
                                    <span className="truncate font-medium text-foreground min-w-0" title={sample.description}>
                                      {highlightMatch(sample.description, formPattern, formPatternType === 'regex')}
                                    </span>
                                  </div>
                                  <span className="font-mono font-bold whitespace-nowrap text-right shrink-0">
                                    {formatCurrency(sample.amount, 'HUF')}
                                  </span>
                                </div>
                                <div className="flex items-center justify-between mt-1.5 pt-1.5 border-t border-border/10">
                                  <div className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                                    <span className="opacity-60">Cél GL:</span>
                                    <strong>{formGlAccountId ? getGlLabel(formGlAccountId) : 'Nincs rendelve'}</strong>
                                  </div>
                                  {formAutoVerify && (
                                    <span className="text-[9px] font-bold bg-green-500/10 text-green-700 dark:text-green-400 px-1.5 py-0.5 rounded">
                                      Auto-verify
                                    </span>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="pt-4 border-t border-border/50">
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full gap-2 border-primary/20 hover:border-primary/50 text-primary h-9 font-medium"
                    onClick={handleTestRule}
                    disabled={!formPattern || testing}
                  >
                    {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                    Szabály tesztelése a tranzakciókon
                  </Button>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button variant="outline" onClick={() => setViewMode('list')} disabled={saving}>Mégse</Button>
              <Button onClick={handleSaveRule} disabled={saving} className="gap-2">
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                Mentés
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
