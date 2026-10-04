import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { useCompany } from '@/contexts/CompanyContext';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Sliders, Brain } from 'lucide-react';
import { InvoiceItemRulesManager } from '@/components/invoices/InvoiceItemRulesManager';
import { CompanyPromptRulesManager } from './CompanyPromptRulesManager';

export interface AccountingRulesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultTab?: 'item_rules' | 'ai_prompts';
}

export function AccountingRulesDialog({
  open,
  onOpenChange,
  defaultTab = 'item_rules',
}: AccountingRulesDialogProps) {
  const { t } = useTranslation(['accounting', 'accounty', 'invoices', 'common']);
  const { selectedCompany } = useCompany();
  const companyId = selectedCompany?.id;

  const [activeTab, setActiveTab] = useState<'item_rules' | 'ai_prompts'>(defaultTab);

  // Fetch deterministic invoice item rules count for the badge
  const { data: itemRules = [] } = useQuery<any[]>({
    queryKey: ['invoice_item_rules', companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const { data, error } = await supabase
        .from('invoice_item_rules' as any)
        .select('id, is_active')
        .or(`company_id.eq.${companyId},scope.eq.tenant,scope.eq.global`);
      if (error) throw error;
      return (data || []) as any[];
    },
    enabled: !!companyId && open,
  });

  // Fetch AI prompt rules count for the badge
  const { data: promptRules = [] } = useQuery<any[]>({
    queryKey: ['company-prompt-rules', companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const { data, error } = await supabase
        .from('company_prompt_rules')
        .select('id, is_active')
        .eq('company_id', companyId);
      if (error) throw error;
      return (data || []) as any[];
    },
    enabled: !!companyId && open,
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[900px] md:max-w-5xl max-h-[90vh] flex flex-col p-6 overflow-hidden">
        <DialogHeader className="pb-3 border-b shrink-0">
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Sliders className="h-5 w-5 text-primary" />
            {t('accounting:rules.dialog_title', { defaultValue: 'Könyvelési Szabályok' })}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            {t('accounting:rules.dialog_desc', {
              defaultValue: 'Kezeld a számlatételek automatikus kontírozási és ÁFA szabályait, valamint az egyedi AI prompt instrukciókat.'
            })}
            {selectedCompany?.name ? ` (${selectedCompany.name})` : ''}
          </DialogDescription>
        </DialogHeader>

        <Tabs
          value={activeTab}
          onValueChange={(val: any) => setActiveTab(val)}
          className="flex-1 flex flex-col min-h-0 pt-3"
        >
          <TabsList className="grid grid-cols-2 w-full sm:w-[440px] h-9 p-1 bg-muted/60 border border-border/50 shrink-0">
            <TabsTrigger value="item_rules" className="gap-2 text-xs font-semibold">
              <Sliders className="h-3.5 w-3.5" />
              <span>{t('accounting:rules.tab_item_rules', { defaultValue: 'Számlatétel szabályok' })}</span>
              <Badge
                variant="secondary"
                className="ml-1 px-1.5 py-0 h-4 text-[10px] font-mono bg-background border border-border/40"
              >
                {itemRules.length}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="ai_prompts" className="gap-2 text-xs font-semibold">
              <Brain className="h-3.5 w-3.5" />
              <span>{t('accounting:rules.tab_ai_prompts', { defaultValue: 'AI Prompt könyvtár' })}</span>
              <Badge
                variant="secondary"
                className="ml-1 px-1.5 py-0 h-4 text-[10px] font-mono bg-background border border-border/40"
              >
                {promptRules.length}
              </Badge>
            </TabsTrigger>
          </TabsList>

          <div className="flex-1 overflow-y-auto mt-3 pr-1 scrollbar-thin">
            <TabsContent value="item_rules" className="m-0 focus-visible:outline-none">
              <InvoiceItemRulesManager asDialog isOpen={open} onClose={() => onOpenChange(false)} />
            </TabsContent>
            <TabsContent value="ai_prompts" className="m-0 focus-visible:outline-none">
              <CompanyPromptRulesManager companyId={companyId} asDialog />
            </TabsContent>
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
