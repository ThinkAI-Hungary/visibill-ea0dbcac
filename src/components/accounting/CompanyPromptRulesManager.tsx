import React, { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
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
import { Label } from '@/components/ui/label';
import {
  Plus,
  Trash2,
  Sparkles,
  Brain,
  Lightbulb,
  ChevronRight,
  ToggleLeft,
  Activity,
  Info,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

export interface PromptRule {
  id: string;
  company_id: string;
  rule_name: string;
  rule_prompt: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export const RULE_TEMPLATES_HU = [
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

export const RULE_TEMPLATES_HR = [
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

export interface CompanyPromptRulesManagerProps {
  companyId?: string;
  asDialog?: boolean;
}

export function CompanyPromptRulesManager({
  companyId: propCompanyId,
  asDialog = false,
}: CompanyPromptRulesManagerProps) {
  const { t, i18n } = useTranslation(['accounty', 'common']);
  const { pathname } = useLocation();
  const prefix = pathname.startsWith('/hr') ? '/hr' : '';
  const isHr = prefix === '/hr' || i18n.language === 'hr';
  const RULE_TEMPLATES = isHr ? RULE_TEMPLATES_HR : RULE_TEMPLATES_HU;

  const { selectedCompany } = useCompany();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const effectiveCompanyId = propCompanyId || selectedCompany?.id;

  const [isOpen, setIsOpen] = useState(false);
  const [newRuleName, setNewRuleName] = useState('');
  const [newRulePrompt, setNewRulePrompt] = useState('');

  // Fetch AI prompt rules
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
      toast({
        title: t('prompts_page.toast_created', { defaultValue: 'Szabály létrehozva' }),
        description: t('prompts_page.toast_created_desc', { defaultValue: 'Az egyedi szabály sikeresen hozzáadva a szabálytárhoz.' }),
      });
      setNewRuleName('');
      setNewRulePrompt('');
      setIsOpen(false);
    },
    onError: (err: any) => {
      toast({
        variant: 'destructive',
        title: t('common:status.error', { defaultValue: 'Hiba történt' }),
        description: err.message || t('prompts_page.toast_save_error', { defaultValue: 'Nem sikerült menteni a szabályt.' }),
      });
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
      toast({
        variant: 'destructive',
        title: t('prompts_page.toast_update_error', { defaultValue: 'Módosítás sikertelen' }),
        description: err.message,
      });
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
      toast({
        title: t('prompts_page.toast_deleted', { defaultValue: 'Szabály törölve' }),
        description: t('prompts_page.toast_deleted_desc', { defaultValue: 'A szabály eltávolítva a könyvtárból.' }),
      });
    },
    onError: (err: any) => {
      toast({
        variant: 'destructive',
        title: t('prompts_page.toast_delete_error', { defaultValue: 'Törlés sikertelen' }),
        description: err.message,
      });
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

  return (
    <div className={cn("space-y-4", asDialog && "pt-1")}>
      <div className="flex items-center justify-between pb-2">
        <div>
          <h3 className="text-sm font-bold flex items-center gap-1.5 text-foreground">
            <Activity className="h-4 w-4 text-primary" />
            {t('prompts_page.active_rules_title', { defaultValue: 'Céges AI Prompt Szabályok' })}
          </h3>
          <p className="text-xs text-muted-foreground">
            {t('prompts_page.active_rules_desc', { defaultValue: 'Természetes nyelvű instrukciók a mesterséges intelligencia számára.' })}
          </p>
        </div>
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1.5 h-8 text-xs shadow-xs">
              <Plus className="h-3.5 w-3.5" />
              {t('prompts_page.btn_add_rule', { defaultValue: '+ Új szabály hozzáadása' })}
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <form onSubmit={handleSubmit}>
              <DialogHeader>
                <DialogTitle>{t('prompts_page.dialog_title', { defaultValue: 'Egyedi könyvelési szabály felvétele' })}</DialogTitle>
                <DialogDescription>
                  {t('prompts_page.dialog_desc', { defaultValue: 'Fogalmazd meg természetes nyelven, milyen szabályt kövessen az AI.' })}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-4">
                <div className="space-y-1.5">
                  <Label htmlFor="rule-name">{t('prompts_page.field_rule_name', { defaultValue: 'Szabály megnevezése' })}</Label>
                  <Input
                    id="rule-name"
                    value={newRuleName}
                    onChange={(e) => setNewRuleName(e.target.value)}
                    placeholder={t('prompts_page.field_rule_name_placeholder', { defaultValue: 'Pl. MOL üzemanyag kontírozás' })}
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="rule-prompt">{t('prompts_page.field_rule_prompt', { defaultValue: 'AI Instrukció (Prompt)' })}</Label>
                  <Textarea
                    id="rule-prompt"
                    value={newRulePrompt}
                    onChange={(e) => setNewRulePrompt(e.target.value)}
                    placeholder={t('prompts_page.field_rule_prompt_placeholder', { defaultValue: 'Írd le pontosan a szabályt...' })}
                    rows={4}
                    required
                  />
                </div>
              </div>

              <DialogFooter>
                <Button type="button" variant="ghost" onClick={() => setIsOpen(false)}>
                  {t('prompts_page.btn_cancel', { defaultValue: 'Mégse' })}
                </Button>
                <Button type="submit" disabled={addRuleMutation.isPending}>
                  {addRuleMutation.isPending ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> {t('prompts_page.btn_saving', { defaultValue: 'Mentés...' })}</>
                  ) : t('prompts_page.btn_save', { defaultValue: 'Szabály mentése' })}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className={cn(
        "grid gap-4",
        asDialog ? "grid-cols-1" : "grid-cols-1 lg:grid-cols-3"
      )}>
        {/* Rules List Column */}
        <div className={cn(asDialog ? "space-y-3" : "lg:col-span-2 space-y-4")}>
          <Card className="border-border/60 shadow-xs">
            <CardContent className="p-0">
              {isLoading ? (
                <div className="flex flex-col items-center justify-center p-8 text-muted-foreground">
                  <Loader2 className="h-6 w-6 animate-spin text-primary mb-2" />
                  <p className="text-xs">{t('prompts_page.loading', { defaultValue: 'Szabályok betöltése...' })}</p>
                </div>
              ) : rules.length === 0 ? (
                <div className="flex flex-col items-center justify-center text-center p-8 border-t border-border/40">
                  <div className="w-12 h-12 rounded-full bg-background border flex items-center justify-center text-muted-foreground/60 mb-3 shadow-inner">
                    <ToggleLeft className="h-6 w-6" />
                  </div>
                  <h3 className="font-semibold text-foreground text-sm">{t('prompts_page.empty_title', { defaultValue: 'Még nincsenek egyedi szabályok' })}</h3>
                  <p className="text-xs text-muted-foreground mt-1 max-w-sm">{t('prompts_page.empty_desc', { defaultValue: 'Hozz létre új szabályt a fenti gombbal, vagy válassz az alábbi sablonokból.' })}</p>
                </div>
              ) : (
                <div className={cn(
                  "divide-y divide-border/40 border-t border-border/40",
                  asDialog && "max-h-[45vh] overflow-y-auto pr-1"
                )}>
                  {rules.map((rule) => (
                    <div 
                      key={rule.id} 
                      className={cn(
                        "p-3.5 flex items-start justify-between gap-3 transition-colors hover:bg-muted/40",
                        !rule.is_active && "opacity-75 bg-muted/20"
                      )}
                    >
                      <div className="space-y-1.5 min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className={cn("font-semibold text-foreground text-xs", !rule.is_active && "line-through text-muted-foreground")}>
                            {rule.rule_name}
                          </h4>
                          {rule.is_active ? (
                            <span className="text-[10px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-medium px-2 py-0.5 rounded-full border border-emerald-500/10">
                              {t('prompts_page.badge_active', { defaultValue: 'Aktív' })}
                            </span>
                          ) : (
                            <span className="text-[10px] bg-muted text-muted-foreground font-medium px-2 py-0.5 rounded-full">
                              {t('prompts_page.badge_inactive', { defaultValue: 'Inaktív' })}
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-muted-foreground leading-relaxed font-mono bg-muted/40 p-2 rounded border border-border/40">
                          {rule.rule_prompt}
                        </p>
                        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                          <span>{t('prompts_page.last_updated', { defaultValue: 'Utoljára frissítve:' })}</span>
                          <span className="font-medium text-foreground/80">{new Date(rule.updated_at || rule.created_at).toLocaleDateString(isHr ? 'hr-HR' : 'hu-HU')}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2.5 shrink-0 pt-0.5">
                        <Switch
                          checked={rule.is_active}
                          onCheckedChange={(checked) => toggleActiveMutation.mutate({ id: rule.id, is_active: checked })}
                          aria-label={t('prompts_page.aria_rule_status', { defaultValue: 'Szabály állapota' })}
                          className="data-[state=checked]:bg-primary"
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10 rounded-full"
                          onClick={() => {
                            if (confirm(t('prompts_page.delete_confirm', { defaultValue: 'Biztosan törlöd ezt a könyvelési szabályt?' }))) {
                              deleteRuleMutation.mutate(rule.id);
                            }
                          }}
                          title={t('common:actions.delete', { defaultValue: 'Törlés' })}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Templates Sidebar / Bottom Panel */}
        <div className="space-y-4">
          <Card className="border-border/60 shadow-xs bg-gradient-to-b from-primary/5 via-card to-card">
            <CardHeader className="pb-3 pt-4 px-4">
              <CardTitle className="text-xs font-bold flex items-center gap-1.5 text-primary">
                <Sparkles className="h-3.5 w-3.5" />
                {t('prompts_page.templates_title', { defaultValue: 'Gyors Sablonok' })}
              </CardTitle>
              <CardDescription className="text-[11px]">
                {t('prompts_page.templates_desc', { defaultValue: 'Kattints egy bevált könyvelési sablonra az azonnali használathoz.' })}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 p-4 pt-0">
              {RULE_TEMPLATES.map((tpl, i) => {
                const IconComponent = tpl.icon;
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => handleApplyTemplate(tpl)}
                    className="w-full text-left p-2.5 rounded-lg border border-border/50 bg-card hover:bg-muted/50 hover:border-primary/20 dark:hover:bg-muted/30 transition-all flex items-start gap-2.5 group"
                  >
                    <div className="w-7 h-7 rounded-md bg-primary/10 text-primary flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform mt-0.5">
                      <IconComponent className="h-3.5 w-3.5" />
                    </div>
                    <div className="space-y-0.5 min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-1.5">
                        <p className="font-semibold text-xs text-foreground group-hover:text-primary transition-colors truncate">
                          {tpl.name}
                        </p>
                        <span className="text-[9px] bg-muted text-muted-foreground font-medium px-1.5 py-0.2 rounded shrink-0">
                          {tpl.badge}
                        </span>
                      </div>
                      <p className="text-[10px] text-muted-foreground line-clamp-1 leading-relaxed">
                        {tpl.prompt}
                      </p>
                    </div>
                    <ChevronRight className="h-3.5 w-3.5 text-muted-foreground self-center shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </button>
                );
              })}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
