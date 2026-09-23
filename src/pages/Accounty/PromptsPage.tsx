import { useState } from 'react';
import { useParams, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useCompany } from '@/contexts/CompanyContext';
import { useAccountyClient } from '@/hooks/accounty';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Plus, Trash2, Sparkles, Brain, Lightbulb, CheckCircle2, ChevronRight, ToggleLeft, Activity, Info, Loader2, Building2 } from 'lucide-react';
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

const RULE_TEMPLATES_HU = [
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

const RULE_TEMPLATES_HR = [
  {
    name: 'Pretplate na softverske licence',
    prompt: "Sve ulazne (INBOUND) stavke s nazivom 'softver', 'licenca' ili 'pretplata' (npr. Adobe, Slack, Zoom, Google) knjižite na konto 412 - Troškovi softvera i intelektualnih usluga.",
    icon: Brain,
    badge: 'Trošak'
  },
  {
    name: 'Sitni inventar i oprema manje vrijednosti',
    prompt: "Ako je stavka informatička oprema (npr. tipkovnica, miš, kabel, adapter, monitor) i iznos je manji od 465 EUR, proknjižite na konto 400 - Utrošeni materijal i sitni inventar umjesto dugotrajne imovine.",
    icon: Lightbulb,
    badge: 'Imovina'
  },
  {
    name: 'Nabava INA goriva',
    prompt: "Sve nabave goriva (npr. INA, Petrol, Lukoil, Crodux) knjižite na konto 400 - Troškovi goriva i energije.",
    icon: Sparkles,
    badge: 'Trošak'
  },
  {
    name: 'Knjigovodstvene i odvjetničke naknade',
    prompt: "Knjigovodstvene naknade, odvjetničke troškove i porezno savjetovanje uvijek rasporedite na konto 412 - Intelektualne i odvjetničke usluge.",
    icon: Brain,
    badge: 'Usluga'
  }
];

export default function PromptsPage() {
  const { t, i18n } = useTranslation('accounty');
  const { pathname } = useLocation();
  const prefix = pathname.startsWith('/hr') ? '/hr' : '';
  const isHr = prefix === '/hr' || i18n.language === 'hr';
  const RULE_TEMPLATES = isHr ? RULE_TEMPLATES_HR : RULE_TEMPLATES_HU;

  const { companyId } = useParams<{ companyId: string }>();
  const { selectedCompany } = useCompany();
  const { data: client } = useAccountyClient(companyId);
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const effectiveCompanyId = companyId || selectedCompany?.id;
  const effectiveCompanyName = client?.name || selectedCompany?.name || (isHr ? 'Odabrana tvrtka' : 'Kiválasztott cég');

  const [isOpen, setIsOpen] = useState(false);
  const [newRuleName, setNewRuleName] = useState('');
  const [newRulePrompt, setNewRulePrompt] = useState('');

  // Fetch rules
  const { data: rules = [], isLoading } = useQuery<PromptRule[]>({
    queryKey: ['company-prompt-rules', effectiveCompanyId],
    queryFn: async () => {
      if (!effectiveCompanyId) return [];
      const { data, error } = await supabase
        .from('company_prompt_rules')
        .select('*')
        .eq('company_id', effectiveCompanyId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as PromptRule[];
    },
    enabled: !!effectiveCompanyId,
  });

  // Add rule mutation
  const addRuleMutation = useMutation({
    mutationFn: async ({ name, prompt }: { name: string; prompt: string }) => {
      if (!effectiveCompanyId || !user?.id) throw new Error('Cég vagy felhasználó hiányzik');
      const { error } = await supabase
        .from('company_prompt_rules')
        .insert({
          company_id: effectiveCompanyId,
          rule_name: name.trim(),
          rule_prompt: prompt.trim(),
          is_active: true,
          created_by: user.id,
        });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company-prompt-rules', effectiveCompanyId] });
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
      queryClient.invalidateQueries({ queryKey: ['company-prompt-rules', effectiveCompanyId] });
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
      queryClient.invalidateQueries({ queryKey: ['company-prompt-rules', effectiveCompanyId] });
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

  const handleApplyTemplate = (template: typeof RULE_TEMPLATES_HU[number]) => {
    setNewRuleName(template.name);
    setNewRulePrompt(template.prompt);
    setIsOpen(true);
  };

  if (!effectiveCompanyId) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-center p-6">
        <Building2 className="h-16 w-16 text-muted-foreground/40 mb-4 animate-pulse" />
        <h2 className="text-xl font-bold text-foreground">Nincs kiválasztott cég</h2>
        <p className="text-sm text-muted-foreground mt-2 max-w-sm">Kérjük, válassz ki egy céget a navigációs sávban a szabályok kezeléséhez.</p>
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
            {t('prompts_page.title')}
          </h1>
          <p className="text-sm text-muted-foreground mt-1.5 max-w-[800px]">
            {t('prompts_page.subtitle')} (<strong>{effectiveCompanyName}</strong>)
          </p>
        </div>

        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2 shrink-0 shadow-md">
              <Plus className="h-4 w-4" />
              {t('prompts_page.btn_add_rule')}
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <form onSubmit={handleSubmit}>
              <DialogHeader>
                <DialogTitle>{t('prompts_page.dialog_title')}</DialogTitle>
                <DialogDescription>
                  {t('prompts_page.dialog_desc')}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-4">
                <div className="space-y-1.5">
                  <Label htmlFor="rule-name">{t('prompts_page.field_rule_name')}</Label>
                  <Input
                    id="rule-name"
                    value={newRuleName}
                    onChange={(e) => setNewRuleName(e.target.value)}
                    placeholder={t('prompts_page.field_rule_name_placeholder')}
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="rule-prompt">{t('prompts_page.field_rule_prompt')}</Label>
                  <Textarea
                    id="rule-prompt"
                    value={newRulePrompt}
                    onChange={(e) => setNewRulePrompt(e.target.value)}
                    placeholder={t('prompts_page.field_rule_prompt_placeholder')}
                    rows={4}
                    required
                  />
                </div>
              </div>

              <DialogFooter>
                <Button type="button" variant="ghost" onClick={() => setIsOpen(false)}>{t('prompts_page.btn_cancel')}</Button>
                <Button type="submit" disabled={addRuleMutation.isPending}>
                  {addRuleMutation.isPending ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> {t('prompts_page.btn_saving')}</>
                  ) : t('prompts_page.btn_save')}
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
                    {t('prompts_page.active_rules_title')}
                  </CardTitle>
                  <CardDescription>{t('prompts_page.active_rules_desc')}</CardDescription>
                </div>
                <div className="text-xs bg-muted px-2.5 py-1 rounded-full font-medium text-muted-foreground">
                  {t('prompts_page.rules_count', { count: rules.length })}
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="flex flex-col items-center justify-center p-12 text-muted-foreground">
                  <Loader2 className="h-8 w-8 animate-spin text-primary mb-2" />
                  <p className="text-sm">{t('prompts_page.loading')}</p>
                </div>
              ) : rules.length === 0 ? (
                <div className="flex flex-col items-center justify-center text-center p-12 border-t border-border/40">
                  <div className="w-14 h-14 rounded-full bg-background border flex items-center justify-center text-muted-foreground/60 mb-4 shadow-inner">
                    <ToggleLeft className="h-6 w-6" />
                  </div>
                  <h3 className="font-semibold text-foreground">{t('prompts_page.empty_title')}</h3>
                  <p className="text-sm text-muted-foreground mt-1 max-w-sm">{t('prompts_page.empty_desc')}</p>
                </div>
              ) : (
                <div className="divide-y divide-border/40 border-t border-border/40">
                  {rules.map((rule) => (
                    <div 
                      key={rule.id} 
                      className={cn(
                        "p-5 flex items-start justify-between gap-4 transition-colors hover:bg-muted/50 dark:hover:bg-muted/30",
                        !rule.is_active && "opacity-75 bg-muted/40/30"
                      )}
                    >
                      <div className="space-y-1.5 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className={cn("font-semibold text-foreground text-sm", !rule.is_active && "line-through text-muted-foreground")}>
                            {rule.rule_name}
                          </h4>
                          {rule.is_active ? (
                            <span className="text-[10px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-medium px-2 py-0.5 rounded-full border border-emerald-500/10">
                              {t('prompts_page.badge_active')}
                            </span>
                          ) : (
                            <span className="text-[10px] bg-muted text-muted-foreground font-medium px-2 py-0.5 rounded-full">
                              {t('prompts_page.badge_inactive')}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground leading-relaxed font-mono bg-muted/40/50 dark:bg-background/40 p-3 rounded-lg border border-border/40">
                          {rule.rule_prompt}
                        </p>
                        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                          <span>{t('prompts_page.last_updated')}</span>
                          <span className="font-medium text-foreground/80">{new Date(rule.updated_at || rule.created_at).toLocaleString(isHr ? 'hr-HR' : 'hu-HU')}</span>
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
                            if (confirm(t('prompts_page.delete_confirm'))) {
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
                {t('prompts_page.templates_title')}
              </CardTitle>
              <CardDescription>{t('prompts_page.templates_desc')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {RULE_TEMPLATES.map((tpl, i) => {
                const IconComponent = tpl.icon;
                return (
                  <button
                    key={i}
                    onClick={() => handleApplyTemplate(tpl)}
                    className="w-full text-left p-3.5 rounded-lg border border-border/50 bg-card hover:bg-muted/50 hover:border-primary/20 dark:hover:bg-muted/30 transition-all flex items-start gap-3 group hover:shadow-soft"
                  >
                    <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0 group- transition-transform">
                      <IconComponent className="h-4 w-4" />
                    </div>
                    <div className="space-y-1 min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-semibold text-xs text-foreground group-hover:text-primary transition-colors truncate">
                          {tpl.name}
                        </p>
                        <span className="text-[9px] bg-muted text-muted-foreground font-medium px-2 py-0.5 rounded-full">
                          {tpl.badge}
                        </span>
                      </div>
                      <p className="text-[10px] text-muted-foreground line-clamp-2 leading-relaxed">
                        {tpl.prompt}
                      </p>
                    </div>
                    <ChevronRight className="h-3.5 w-3.5 text-muted-foreground self-center shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </button>
                );
              })}
            </CardContent>
          </Card>

          <Card className="border-border/60 shadow-soft bg-muted/20">
            <CardHeader className="pb-3">
              <CardTitle className="text-xs font-bold flex items-center gap-1 text-foreground/90">
                <Info className="h-3.5 w-3.5" />
                {t('prompts_page.guidelines_title')}
              </CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground space-y-2.5 leading-relaxed">
              <p>
                1. <strong>{t('prompts_page.guidelines_step1_title')}</strong> {t('prompts_page.guidelines_step1_desc')}
              </p>
              <p>
                2. <strong>{t('prompts_page.guidelines_step2_title')}</strong> {t('prompts_page.guidelines_step2_desc')}
              </p>
              <p>
                3. <strong>{t('prompts_page.guidelines_step3_title')}</strong> {t('prompts_page.guidelines_step3_desc')}
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
