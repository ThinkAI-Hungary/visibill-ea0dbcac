import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useCompany } from '@/contexts/CompanyContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Plus, Trash2, Sparkles, Brain, Lightbulb, CheckCircle2, ChevronRight, ToggleLeft, Activity, Info, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

interface PromptRule {
  id: string;
  company_id: string;
  rule_name: string;
  rule_prompt: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

const RULE_TEMPLATES = [
  {
    name: 'Szoftver licenc előfizetések',
    prompt: "Minden 'szoftver', 'licenc' vagy 'előfizetés' nevű bejövő (INBOUND) tételt (pl. Cashbook, Adobe, Slack, Zoom) könyvelj a 529-es Egyéb igénybevett szolgáltatások közé.",
    icon: Brain,
    badge: 'Költség'
  },
  {
    name: 'Kisértékű eszközök értékhatár',
    prompt: "Ha a tétel informatikai eszköz (pl. billentyűzet, egér, kábel, adapter, monitor) és az összege 100 000 Ft alatti, könyveld 511-es anyagköltségbe tárgyi eszköz helyett.",
    icon: Lightbulb,
    badge: 'Eszköz'
  },
  {
    name: 'MOL üzemanyag beszerzés',
    prompt: "Minden üzemanyag vagy gázolaj beszerzést (pl. MOL, OMV, Shell) könyvelj az 513-as üzemanyag költség számlára.",
    icon: Sparkles,
    badge: 'Költség'
  },
  {
    name: 'Könyvelési és jogi díjak',
    prompt: "A könyvelési díjakat, ügyvédi költségeket és adótanácsadást minden esetben a 522-es Könyvvizsgálati, jogi és szakértői díjak közé sorold.",
    icon: Brain,
    badge: 'Szolgáltatás'
  }
];

export default function PromptsPage() {
  const { selectedCompany } = useCompany();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [isOpen, setIsOpen] = useState(false);
  const [newRuleName, setNewRuleName] = useState('');
  const [newRulePrompt, setNewRulePrompt] = useState('');

  // Fetch rules
  const { data: rules = [], isLoading } = useQuery<PromptRule[]>({
    queryKey: ['company-prompt-rules', selectedCompany?.id],
    queryFn: async () => {
      if (!selectedCompany?.id) return [];
      const { data, error } = await supabase
        .from('company_prompt_rules')
        .select('*')
        .eq('company_id', selectedCompany.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as PromptRule[];
    },
    enabled: !!selectedCompany?.id,
  });

  // Add rule mutation
  const addRuleMutation = useMutation({
    mutationFn: async ({ name, prompt }: { name: string; prompt: string }) => {
      if (!selectedCompany?.id || !user?.id) throw new Error('Cég vagy felhasználó hiányzik');
      const { error } = await supabase
        .from('company_prompt_rules')
        .insert({
          company_id: selectedCompany.id,
          rule_name: name.trim(),
          rule_prompt: prompt.trim(),
          is_active: true,
          created_by: user.id,
        });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company-prompt-rules', selectedCompany?.id] });
      toast({ title: 'Szabály létrehozva', description: 'Az egyedi szabály sikeresen hozzáadva a szabálytárhoz.' });
      setNewRuleName('');
      setNewRulePrompt('');
      setIsOpen(false);
    },
    onError: (err: any) => {
      toast({ variant: 'destructive', title: 'Hiba történt', description: err.message || 'Nem sikerült menteni a szabályt.' });
    }
  });

  // Toggle active status mutation
  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from('company_prompt_rules')
        .update({ is_active })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company-prompt-rules', selectedCompany?.id] });
    },
    onError: (err: any) => {
      toast({ variant: 'destructive', title: 'Módosítás sikertelen', description: err.message });
    }
  });

  // Delete rule mutation
  const deleteRuleMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('company_prompt_rules')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company-prompt-rules', selectedCompany?.id] });
      toast({ title: 'Szabály törölve', description: 'A szabály eltávolítva a könyvtárból.' });
    },
    onError: (err: any) => {
      toast({ variant: 'destructive', title: 'Törlés sikertelen', description: err.message });
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRuleName.trim() || !newRulePrompt.trim()) return;
    addRuleMutation.mutate({ name: newRuleName, prompt: newRulePrompt });
  };

  const handleApplyTemplate = (template: typeof RULE_TEMPLATES[number]) => {
    setNewRuleName(template.name);
    setNewRulePrompt(template.prompt);
    setIsOpen(true);
  };

  if (!selectedCompany) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-center p-6">
        <Building2 className="h-16 w-16 text-muted-foreground/40 mb-4 animate-pulse" />
        <h2 className="text-xl font-bold text-slate-800 dark:text-slate-200">Nincs kiválasztott cég</h2>
        <p className="text-sm text-muted-foreground mt-2 max-w-sm">Kérjük, válassz ki egy céget a felső navigációs sávban a szabályok kezeléséhez.</p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-[1200px] mx-auto space-y-8 page-animate">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Brain className="h-8 w-8 text-primary" />
            Könyvelési Szabályok (Prompt Library)
          </h1>
          <p className="text-sm text-muted-foreground mt-1.5 max-w-[800px]">
            Határozz meg egyedi AI prompt szabályokat a(z) <strong>{selectedCompany.name}</strong> cégre szabva. Az itt bekapcsolt instrukciók a legmagasabb prioritással futnak le az AI főkönyvi osztályozásakor.
          </p>
        </div>

        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2 shrink-0 shadow-md">
              <Plus className="h-4 w-4" />
              Új szabály hozzáadása
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <form onSubmit={handleSubmit}>
              <DialogHeader>
                <DialogTitle>Egyedi könyvelési szabály felvétele</DialogTitle>
                <DialogDescription>
                  Fogalmazd meg magyarul, hogy az AI milyen logika alapján könyveljen egyes tételeket.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-4">
                <div className="space-y-1.5">
                  <Label htmlFor="rule-name">Szabály neve</Label>
                  <Input
                    id="rule-name"
                    value={newRuleName}
                    onChange={(e) => setNewRuleName(e.target.value)}
                    placeholder="Pl. Telekom számlák kontírozása"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="rule-prompt">AI Instrukció (Prompt)</Label>
                  <Textarea
                    id="rule-prompt"
                    value={newRulePrompt}
                    onChange={(e) => setNewRulePrompt(e.target.value)}
                    placeholder="Pl. Ha a tétel partnere a 'Telekom' és a megnevezésben szerepel a 'mobil', könyveld az 525-ös telekommunikációs költség számlára."
                    rows={4}
                    required
                  />
                </div>
              </div>

              <DialogFooter>
                <Button type="button" variant="ghost" onClick={() => setIsOpen(false)}>Mégse</Button>
                <Button type="submit" disabled={addRuleMutation.isPending}>
                  {addRuleMutation.isPending ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Mentés...</>
                  ) : 'Szabály mentése'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Content Area */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="border-border/60 shadow-soft">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg font-bold flex items-center gap-1.5">
                    <Activity className="h-4 w-4 text-primary" />
                    Aktív Szabályok
                  </CardTitle>
                  <CardDescription>A jelenlegi céghez beállított AI kontírozási instrukciók</CardDescription>
                </div>
                <div className="text-xs bg-muted px-2.5 py-1 rounded-full font-medium text-muted-foreground">
                  {rules.length} szabály
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="flex flex-col items-center justify-center p-12 text-muted-foreground">
                  <Loader2 className="h-8 w-8 animate-spin text-primary mb-2" />
                  <p className="text-sm">Szabályok betöltése...</p>
                </div>
              ) : rules.length === 0 ? (
                <div className="flex flex-col items-center justify-center text-center p-12 border-t border-border/40">
                  <div className="w-14 h-14 rounded-full bg-slate-50 dark:bg-slate-900 border flex items-center justify-center text-muted-foreground/60 mb-4 shadow-inner">
                    <ToggleLeft className="h-6 w-6" />
                  </div>
                  <h3 className="font-semibold text-slate-800 dark:text-slate-200">Nincsenek egyedi szabályok</h3>
                  <p className="text-sm text-muted-foreground mt-1 max-w-sm">Még nem adtál hozzá egyedi prompt szabályt ehhez a céghez. Használj sablont a jobb oldalon, vagy hozz létre újat!</p>
                </div>
              ) : (
                <div className="divide-y divide-border/40 border-t border-border/40">
                  {rules.map((rule) => (
                    <div 
                      key={rule.id} 
                      className={cn(
                        "p-5 flex items-start justify-between gap-4 transition-colors hover:bg-slate-50/50 dark:hover:bg-slate-900/10",
                        !rule.is_active && "opacity-75 bg-slate-50/30"
                      )}
                    >
                      <div className="space-y-1.5 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className={cn("font-semibold text-slate-900 dark:text-slate-100 text-sm", !rule.is_active && "line-through text-muted-foreground")}>
                            {rule.rule_name}
                          </h4>
                          {rule.is_active ? (
                            <span className="text-[10px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-medium px-2 py-0.5 rounded-full border border-emerald-500/10">
                              Aktív
                            </span>
                          ) : (
                            <span className="text-[10px] bg-slate-200 dark:bg-slate-800 text-slate-500 font-medium px-2 py-0.5 rounded-full">
                              Inaktív
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed font-mono bg-slate-50/50 dark:bg-slate-950/40 p-3 rounded-lg border border-border/40">
                          {rule.rule_prompt}
                        </p>
                        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                          <span>Utoljára frissítve:</span>
                          <span className="font-medium text-foreground/80">{new Date(rule.updated_at || rule.created_at).toLocaleString('hu-HU')}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        <Switch
                          checked={rule.is_active}
                          onCheckedChange={(checked) => toggleActiveMutation.mutate({ id: rule.id, is_active: checked })}
                          aria-label="Szabály állapota"
                          className="data-[state=checked]:bg-primary"
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10 rounded-full"
                          onClick={() => {
                            if (confirm('Biztosan törlöd ezt a könyvelési szabályt?')) {
                              deleteRuleMutation.mutate(rule.id);
                            }
                          }}
                          title="Törlés"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Templates and Helpers Sidebar */}
        <div className="space-y-6">
          <Card className="border-border/60 shadow-soft bg-gradient-to-b from-primary/5 via-card to-card">
            <CardHeader className="pb-4">
              <CardTitle className="text-md font-bold flex items-center gap-1.5 text-primary">
                <Sparkles className="h-4 w-4" />
                Gyors Sablonok
              </CardTitle>
              <CardDescription>Válassz a gyakran használt szabálysablonokból, és igazítsd a cégedre</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {RULE_TEMPLATES.map((tpl, i) => {
                const IconComponent = tpl.icon;
                return (
                  <button
                    key={i}
                    onClick={() => handleApplyTemplate(tpl)}
                    className="w-full text-left p-3.5 rounded-xl border border-border/50 bg-card hover:bg-slate-50/50 hover:border-primary/20 dark:hover:bg-slate-900/10 transition-all flex items-start gap-3 group hover:shadow-soft"
                  >
                    <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                      <IconComponent className="h-4 w-4" />
                    </div>
                    <div className="space-y-1 min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-semibold text-xs text-slate-800 dark:text-slate-200 group-hover:text-primary transition-colors truncate">
                          {tpl.name}
                        </p>
                        <span className="text-[9px] bg-slate-100 dark:bg-slate-800 text-slate-500 font-medium px-2 py-0.5 rounded-full">
                          {tpl.badge}
                        </span>
                      </div>
                      <p className="text-[10px] text-muted-foreground line-clamp-2 leading-relaxed">
                        {tpl.prompt}
                      </p>
                    </div>
                    <ChevronRight className="h-3.5 w-3.5 text-slate-400 self-center shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </button>
                );
              })}
            </CardContent>
          </Card>

          <Card className="border-border/60 shadow-soft bg-muted/20">
            <CardHeader className="pb-3">
              <CardTitle className="text-xs font-bold flex items-center gap-1 text-slate-700 dark:text-slate-300">
                <Info className="h-3.5 w-3.5" />
                Hogyan írj hatékony könyvelési szabályokat?
              </CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-slate-600 dark:text-slate-400 space-y-2.5 leading-relaxed">
              <p>
                1. <strong>Légy pontos:</strong> Ha lehetséges, említsd meg a konkrét partnert (pl. <em>„MOL”</em>, <em>„Cashbook”</em>) vagy a tétel megnevezésében előforduló kulcsszavakat.
              </p>
              <p>
                2. <strong>Add meg a főkönyvi számot:</strong> Instrukciódban írd le a pontos főkönyvi számot (pl. <em>„522”</em>, <em>„511”</em>), amire könyvelni kell az adott feltétel esetén.
              </p>
              <p>
                3. <strong>Csatorna/irány figyelembevétele:</strong> Szükség szerint említsd meg, hogy a szabály csak bejövő (INBOUND/költség) vagy kimenő (OUTBOUND/árbevétel) tételekre vonatkozik.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
