import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePostingWizard } from '@/features/posting-wizard/hooks/usePostingWizard';
import { usePostingKeyboardNav } from '@/features/posting-wizard/hooks/usePostingKeyboardNav';
import { PostingWizardHeader } from '@/features/posting-wizard/components/PostingWizardHeader';
import { PostingGroupAccordion } from '@/features/posting-wizard/components/PostingGroupAccordion';
import { PostingRuleDialog } from '@/features/posting-wizard/components/PostingRuleDialog';
import { PostingGlReassignModal } from '@/features/posting-wizard/components/PostingGlReassignModal';
import { Accordion } from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { CheckCircle2, ArrowRight, Sparkles, LayoutDashboard, RefreshCw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import type { RuleScopeOption, RuleToCreate, PostingItem } from '@/features/posting-wizard/types';

interface PostingWizardViewProps {
  companyId?: string;
  onExit?: () => void;
}

export function PostingWizardView({ companyId, onExit }: PostingWizardViewProps) {
  const navigate = useNavigate();

  const {
    postingMode,
    summary,
    items,
    groups,
    isItemsLoading,
    glAccounts,
    currentPage,
    setCurrentPage,
    pageSize,
    approvedItemIds,
    focusedItemId,
    setFocusedItemId,
    handleToggleItemApproval,
    handleApproveGroup,
    handleApproveAllInBatch,
    handleQuickReassign,
    approveBatchMutation,
    setPostingModeMutation,
    totalPendingInBatch,
    approvedInBatchCount,
    isBatchFullyApproved,
  } = usePostingWizard(companyId);

  const [isRuleModalOpen, setIsRuleModalOpen] = useState(false);
  const [reassignTargetItem, setReassignTargetItem] = useState<PostingItem | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [userOpenGroups, setUserOpenGroups] = useState<string[] | null>(null);
  const { toast } = useToast();

  // Purely derived open groups without any cascading render useEffect
  const activeAccordionValues = userOpenGroups ?? groups.map((g) => g.gl_number);

  const handleSyncInvoices = async () => {
    if (!companyId) return;
    setIsSyncing(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Nem sikerült azonosítani a felhasználót');

      const dateTo = new Date();
      const dateFrom = new Date();
      dateFrom.setDate(dateFrom.getDate() - 30);
      const dateToStr = dateTo.toISOString().split('T')[0];
      const dateFromStr = dateFrom.toISOString().split('T')[0];

      toast({
        title: 'Számlák letöltése',
        description: 'NAV számlák lekérdezése folyamatban (30 napos ablak)...',
      });

      const [outboundRes, inboundRes] = await Promise.all([
        supabase.functions.invoke('nav-query-outbound-invoices', {
          body: { dateFrom: dateFromStr, dateTo: dateToStr, invoiceDirection: 'OUTBOUND', companyId },
          headers: { Authorization: `Bearer ${session.access_token}` },
        }),
        supabase.functions.invoke('nav-query-outbound-invoices', {
          body: { dateFrom: dateFromStr, dateTo: dateToStr, invoiceDirection: 'INBOUND', companyId },
          headers: { Authorization: `Bearer ${session.access_token}` },
        }),
      ]);

      if (outboundRes.error || inboundRes.error) {
        throw new Error(outboundRes.error?.message || inboundRes.error?.message || 'Hiba történt a számlák letöltése közben');
      }

      toast({
        title: 'Szinkronizálás sikeres',
        description: 'A számlák frissültek a jóváhagyási poolban.',
      });

      // Reload window to re-trigger queries cleanly
      window.location.reload();
    } catch (err: any) {
      toast({
        title: 'Szinkronizálási hiba',
        description: err.message || 'Nem sikerült letölteni a számlákat a NAV-ból.',
        variant: 'destructive',
      });
    } finally {
      setIsSyncing(false);
    }
  };

  // Keyboard navigation setup
  usePostingKeyboardNav({
    items,
    focusedItemId,
    setFocusedItemId,
    onToggleApproval: handleToggleItemApproval,
    onBatchSubmit: () => {
      if (approvedInBatchCount > 0) {
        setIsRuleModalOpen(true);
      }
    },
    isBatchFullyApproved,
    enabled: !isRuleModalOpen && !reassignTargetItem,
  });

  // Handle final rule dialog confirm
  const handleConfirmBatch = async (ruleScope: RuleScopeOption, rulesToCreate: RuleToCreate[]) => {
    await approveBatchMutation.mutateAsync({
      ruleScope,
      rulesToCreate,
    });
  };

  const approvedItemsList = React.useMemo(() => {
    return items.filter((i) => approvedItemIds.has(i.item_id));
  }, [items, approvedItemIds]);

  return (
    <div className="space-y-6 pb-24 content-animate">
      {/* 1. Header with Mode switcher, Progress & Page controls */}
      <PostingWizardHeader
        postingMode={postingMode}
        onPostingModeChange={(newMode) => setPostingModeMutation.mutate(newMode)}
        currentPage={currentPage}
        pageSize={pageSize}
        totalPendingInBatch={totalPendingInBatch}
        approvedInBatchCount={approvedInBatchCount}
        summary={summary}
        onApproveAllInBatch={handleApproveAllInBatch}
        onPageChange={(newPage) => setCurrentPage(newPage)}
        onOpenBatchDialog={() => setIsRuleModalOpen(true)}
      />

      {/* 2. Loading State */}
      {isItemsLoading && (
        <div className="space-y-4">
          <Skeleton className="h-16 w-full rounded-xl" />
          <Skeleton className="h-16 w-full rounded-xl" />
          <Skeleton className="h-16 w-full rounded-xl" />
        </div>
      )}

      {/* 3. Empty State (Zero State: All items posted) */}
      {!isItemsLoading && items.length === 0 && (
        <Card className="border-2 border-emerald-500/30 bg-emerald-500/[0.03] dark:bg-emerald-950/20 text-center py-12">
          <CardContent className="space-y-4 max-w-md mx-auto">
            <div className="w-16 h-16 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-8 h-8" />
            </div>

            <div className="space-y-2">
              <h2 className="text-xl font-bold text-foreground">
                Minden tétel lekönyvelve!
              </h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Nincs további jóváhagyásra váró számlatétel a poolban. A könyvelés naprakész.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => onExit ? onExit() : navigate(-1)}
                className="gap-2 w-full sm:w-auto"
              >
                <LayoutDashboard className="w-4 h-4" />
                Vissza a Főkönyvhöz
              </Button>
              <Button
                variant="default"
                size="sm"
                disabled={isSyncing}
                onClick={handleSyncInvoices}
                className="gap-2 w-full sm:w-auto"
              >
                <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
                {isSyncing ? 'Letöltés...' : 'Számlák frissítése a NAV-ból'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 4. Groups Accordion (Inverted GL Grouping - Zero Lag Controlled State) */}
      {!isItemsLoading && items.length > 0 && (
        <Accordion
          type="multiple"
          value={activeAccordionValues}
          onValueChange={setUserOpenGroups}
          className="w-full space-y-1"
        >
          {groups.map((group) => (
            <PostingGroupAccordion
              key={group.gl_number}
              group={group}
              approvedItemIds={approvedItemIds}
              focusedItemId={focusedItemId}
              onToggleApproval={handleToggleItemApproval}
              onFocusItem={setFocusedItemId}
              onOpenReassign={(item) => setReassignTargetItem(item)}
              onApproveGroup={handleApproveGroup}
            />
          ))}
        </Accordion>
      )}

      {/* 5. Fixed Bottom Action Bar */}
      {!isItemsLoading && items.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-40 p-4 bg-background/90 backdrop-blur-md border-t border-border shadow-lg">
          <div className="container mx-auto max-w-6xl flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-foreground">
                Jóváhagyva: {approvedInBatchCount} / {totalPendingInBatch} tétel
              </span>
              {approvedInBatchCount < totalPendingInBatch && (
                <span className="text-xs text-muted-foreground hidden sm:inline">
                  (Jelöld ki a tételeket vagy használd az „Összes jóváhagyása” gombot)
                </span>
              )}
            </div>

            <div className="flex items-center gap-3">
              <Button
                size="default"
                disabled={approvedInBatchCount === 0 || approveBatchMutation.isPending}
                onClick={() => setIsRuleModalOpen(true)}
                className="min-w-[220px] font-semibold gap-2 shadow-sm transition-all"
              >
                <Sparkles className="w-4 h-4" />
                <span>Köteg jóváhagyása és tovább</span>
                <span className="text-xs opacity-75 font-mono hidden sm:inline">(Ctrl+Enter)</span>
                <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 6. Single Shared Lightweight GL Reassign Modal */}
      <PostingGlReassignModal
        item={reassignTargetItem}
        open={!!reassignTargetItem}
        onOpenChange={(open) => !open && setReassignTargetItem(null)}
        glAccounts={glAccounts}
        onSelectGlAccount={handleQuickReassign}
      />

      {/* 7. 3-Way Rule Creation Modal */}
      <PostingRuleDialog
        open={isRuleModalOpen}
        onOpenChange={setIsRuleModalOpen}
        approvedItems={approvedItemsList}
        isSubmitting={approveBatchMutation.isPending}
        onConfirm={handleConfirmBatch}
      />
    </div>
  );
}
