import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Package,
  Coins,
  Landmark,
  FileSpreadsheet,
  CheckCircle2,
  Clock,
  Quote,
  Pencil,
  Check,
  RotateCcw,
  Sparkles,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import type { 
  CompanyAccountingPolicy, 
  CompanyAccountingRule, 
  AccountingRuleCategory 
} from '@/types/accountingPolicy';
import { ACCOUNTING_RULE_CATEGORIES } from '@/types/accountingPolicy';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  policy: CompanyAccountingPolicy | null;
  rules: CompanyAccountingRule[];
  onActivate: (policyId: string) => Promise<void>;
  onUpdateRule: (ruleId: string, ruleValue: Record<string, any>, status?: 'draft' | 'active' | 'inactive') => Promise<void>;
  isActivating: boolean;
  isOwner: boolean;
}

export function AccountingPolicyRulesDialog({
  open,
  onOpenChange,
  policy,
  rules,
  onActivate,
  onUpdateRule,
  isActivating,
  isOwner,
}: Props) {
  const [activeTab, setActiveTab] = useState<AccountingRuleCategory>('fixed_assets');
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<Record<string, any>>({});
  const [isSavingRule, setIsSavingRule] = useState(false);

  if (!policy) return null;

  const getCategoryIcon = (category: AccountingRuleCategory) => {
    switch (category) {
      case 'fixed_assets':
        return <Package className="h-4 w-4" />;
      case 'petty_cash':
        return <Coins className="h-4 w-4" />;
      case 'currency':
        return <Landmark className="h-4 w-4" />;
      case 'inventory_gl':
        return <FileSpreadsheet className="h-4 w-4" />;
    }
  };

  const handleStartEdit = (rule: CompanyAccountingRule) => {
    setEditingRuleId(rule.id);
    setEditValues({ ...rule.rule_value });
  };

  const handleCancelEdit = () => {
    setEditingRuleId(null);
    setEditValues({});
  };

  const handleSaveRule = async (ruleId: string) => {
    setIsSavingRule(true);
    try {
      await onUpdateRule(ruleId, editValues);
      setEditingRuleId(null);
      setEditValues({});
    } finally {
      setIsSavingRule(false);
    }
  };

  const handleActivateAll = async () => {
    await onActivate(policy.id);
    onOpenChange(false);
  };

  const currentCategoryRules = rules.filter(r => r.rule_category === activeTab);
  const isDraftPolicy = !policy.is_active || rules.some(r => r.status === 'draft');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[96vw] max-w-4xl max-h-[90vh] flex flex-col p-4 sm:p-6 overflow-hidden">
        <DialogHeader className="shrink-0 pb-3 border-b border-border/50">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pr-6">
            <div>
              <div className="flex items-center gap-2">
                <DialogTitle className="text-xl font-bold flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-primary" />
                  Kinyert számviteli szabályok
                </DialogTitle>
                <Badge variant={policy.is_active ? 'default' : 'secondary'} className="capitalize">
                  {policy.is_active ? 'Éles szabályzat (v' + policy.version + ')' : 'Jóváhagyásra vár (v' + policy.version + ')'}
                </Badge>
              </div>
              <DialogDescription className="text-xs text-muted-foreground mt-1">
                Forrás: <strong>{policy.file_name}</strong> &bull; Ellenőrizd a dokumentumból kinyert értékeket az élesítés előtt.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {policy.extracted_summary && (
          <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 text-xs leading-relaxed shrink-0 my-1">
            <span className="font-semibold text-primary mr-1.5">Összefoglaló:</span>
            {policy.extracted_summary}
          </div>
        )}

        <Tabs
          value={activeTab}
          onValueChange={(val) => setActiveTab(val as AccountingRuleCategory)}
          className="flex-1 flex flex-col min-h-0 mt-2"
        >
          <TabsList className="grid grid-cols-2 md:grid-cols-4 h-auto p-1 bg-muted/60 shrink-0">
            {ACCOUNTING_RULE_CATEGORIES.map((cat) => {
              const catCount = rules.filter(r => r.rule_category === cat.key).length;
              return (
                <TabsTrigger
                  key={cat.key}
                  value={cat.key}
                  className="flex items-center gap-1.5 py-2 px-2 text-xs data-[state=active]:bg-background data-[state=active]:shadow-xs"
                >
                  {getCategoryIcon(cat.key)}
                  <span className="truncate">{cat.label.split(' ')[0]}</span>
                  <Badge variant="outline" className="h-4.5 px-1 text-[10px] ml-0.5">
                    {catCount}
                  </Badge>
                </TabsTrigger>
              );
            })}
          </TabsList>

          {ACCOUNTING_RULE_CATEGORIES.map((cat) => (
            <TabsContent
              key={cat.key}
              value={cat.key}
              className="flex-1 min-h-0 mt-3 focus-visible:outline-none"
            >
              <ScrollArea className="h-[46vh] pr-3">
                <div className="space-y-3 pb-2">
                  <div className="text-xs text-muted-foreground mb-2 flex items-center gap-1.5">
                    <span className="font-medium text-foreground">{cat.label}:</span>
                    <span>{cat.description}</span>
                  </div>

                  {currentCategoryRules.length === 0 ? (
                    <div className="text-center py-10 border border-dashed rounded-lg text-muted-foreground text-xs">
                      <AlertCircle className="h-6 w-6 mx-auto mb-2 opacity-40" />
                      Ebben a kategóriában a rendszer nem talált explicit szabályt a feltöltött dokumentumban.
                    </div>
                  ) : (
                    currentCategoryRules.map((rule) => {
                      const isEditing = editingRuleId === rule.id;

                      return (
                        <div
                          key={rule.id}
                          className="bg-card border border-border/70 rounded-lg p-3.5 space-y-2.5 transition-all shadow-2xs hover:border-border"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="flex items-center gap-2">
                                <h4 className="font-semibold text-sm">{rule.rule_name}</h4>
                                <Badge
                                  variant={rule.status === 'active' ? 'default' : 'outline'}
                                  className="text-[10px] h-4.5"
                                >
                                  {rule.status === 'active' ? 'Aktív' : 'Tervezet'}
                                </Badge>
                                {rule.user_overridden && (
                                  <Badge variant="secondary" className="text-[10px] h-4.5">
                                    Kézzel módosítva
                                  </Badge>
                                )}
                              </div>
                              {rule.description && (
                                <p className="text-xs text-muted-foreground mt-0.5 leading-snug">
                                  {rule.description}
                                </p>
                              )}
                            </div>

                            {isOwner && !isEditing && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => handleStartEdit(rule)}
                                className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground shrink-0"
                              >
                                <Pencil className="h-3 w-3 mr-1" />
                                Módosítás
                              </Button>
                            )}
                          </div>

                          {/* Rule value display / edit */}
                          <div className="bg-muted/40 rounded-md p-2.5 text-xs font-mono">
                            {isEditing ? (
                              <div className="space-y-2">
                                {Object.entries(editValues).map(([k, v]) => (
                                  <div key={k} className="flex items-center gap-2">
                                    <span className="text-muted-foreground w-24 shrink-0 truncate">{k}:</span>
                                    {typeof v === 'number' ? (
                                      <Input
                                        type="number"
                                        value={v}
                                        onChange={(e) => setEditValues(prev => ({ ...prev, [k]: parseFloat(e.target.value) || 0 }))}
                                        className="h-7 text-xs font-mono"
                                      />
                                    ) : (
                                      <Input
                                        type="text"
                                        value={typeof v === 'object' ? JSON.stringify(v) : String(v)}
                                        onChange={(e) => setEditValues(prev => ({ ...prev, [k]: e.target.value }))}
                                        className="h-7 text-xs font-mono"
                                      />
                                    )}
                                  </div>
                                ))}
                                <div className="flex justify-end gap-1.5 pt-1">
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={handleCancelEdit}
                                    className="h-6.5 text-[11px] px-2"
                                  >
                                    Mégse
                                  </Button>
                                  <Button
                                    type="button"
                                    size="sm"
                                    disabled={isSavingRule}
                                    onClick={() => handleSaveRule(rule.id)}
                                    className="h-6.5 text-[11px] px-2 gap-1"
                                  >
                                    {isSavingRule ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                                    Mentés
                                  </Button>
                                </div>
                              </div>
                            ) : (
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="font-semibold text-primary">Beállított érték:</span>
                                {Object.entries(rule.rule_value || {}).map(([k, v]) => (
                                  <span key={k} className="bg-background px-1.5 py-0.5 rounded border border-border/50 text-[11px]">
                                    <span className="text-muted-foreground mr-1">{k}:</span>
                                    <strong>{typeof v === 'object' ? JSON.stringify(v) : String(v)}</strong>
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>

                          {/* Source quote from document */}
                          {rule.source_quote && (
                            <div className="flex items-start gap-1.5 text-[11px] text-muted-foreground bg-background/50 p-2 rounded border border-border/40 italic">
                              <Quote className="h-3.5 w-3.5 text-primary/60 shrink-0 mt-0.5" />
                              <span className="leading-snug">&ldquo;{rule.source_quote}&rdquo;</span>
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </ScrollArea>
            </TabsContent>
          ))}
        </Tabs>

        <DialogFooter className="shrink-0 pt-3 border-t border-border/50 flex items-center justify-between sm:justify-between w-full">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            <span>Összesen {rules.length} kinyert szabály</span>
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Bezárás
            </Button>

            {isOwner && isDraftPolicy && (
              <Button
                type="button"
                onClick={handleActivateAll}
                disabled={isActivating || rules.length === 0}
                className="gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90"
              >
                {isActivating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                Szabályok jóváhagyása és élesítése
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
