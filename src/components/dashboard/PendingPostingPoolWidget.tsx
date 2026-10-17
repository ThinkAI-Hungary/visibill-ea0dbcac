import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Wand2, ArrowRight, CheckCircle2, AlertCircle, FileText, Layers } from 'lucide-react';
import { useScopedNavigate } from '@/lib/navigation';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useActivePreset } from '@/hooks/useActivePreset';
import type { PostingSummary } from '@/features/posting-wizard/types';

interface PendingPostingPoolWidgetProps {
  companyId?: string;
  defaultCurrency?: string;
}

export function PendingPostingPoolWidget({
  companyId,
  defaultCurrency = 'HUF',
}: PendingPostingPoolWidgetProps) {
  const scopedNavigate = useScopedNavigate();
  const { activePresetId } = useActivePreset(companyId);

  const { data: summary, isLoading } = useQuery<PostingSummary>({
    queryKey: ['pending-posting-summary', companyId, activePresetId],
    queryFn: async () => {
      if (!companyId || !activePresetId) {
        return { pending_item_count: 0, pending_invoice_count: 0, total_net_amount: 0, currency: defaultCurrency };
      }
      const { data, error } = await (supabase.rpc as any)('get_pending_posting_summary', {
        p_company_id: companyId,
        p_preset_id: activePresetId,
      });

      if (error) throw error;
      return data as PostingSummary;
    },
    enabled: !!companyId && !!activePresetId,
    staleTime: 60000,
    refetchInterval: 60000,
  });

  if (isLoading) {
    return <Skeleton className="h-28 w-full rounded-2xl" />;
  }

  const pendingItemCount = summary?.pending_item_count || 0;
  const pendingInvoiceCount = summary?.pending_invoice_count || 0;
  const totalAmount = summary?.total_net_amount || 0;

  const formattedAmount = new Intl.NumberFormat('hu-HU', {
    maximumFractionDigits: 0,
  }).format(totalAmount);

  // If there are no pending items, show a compact success badge or state
  if (pendingItemCount === 0) {
    return (
      <Card className="border border-emerald-500/20 bg-emerald-500/[0.02] dark:bg-emerald-950/10 rounded-2xl overflow-hidden transition-all">
        <CardContent className="p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <div>
              <span className="text-sm font-semibold text-foreground">
                Kontírozási pool üres
              </span>
              <p className="text-xs text-muted-foreground">
                Minden beérkezett számlatétel sikeresen lekönyvelve.
              </p>
            </div>
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => scopedNavigate('/general-ledger?tab=wizard')}
            className="text-xs text-muted-foreground hover:text-foreground gap-1.5"
          >
            <span>Varázsló megnyitása</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Active pool with pending items
  return (
    <Card className="relative overflow-hidden border-2 border-primary/30 bg-gradient-to-r from-primary/5 via-primary/[0.02] to-background rounded-2xl shadow-sm hover:border-primary/40 transition-all">
      <CardContent className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Bal oldal: Ikon + Cím + Badge */}
        <div className="flex items-start sm:items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-primary text-primary-foreground flex items-center justify-center shrink-0 shadow-sm">
            <Wand2 className="w-5 h-5" />
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-base tracking-tight text-foreground">
                Kontírozásra váró tételek
              </h3>
              <Badge variant="default" className="text-xs bg-primary px-2 py-0.5">
                {pendingItemCount} tétel
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              Jóváhagyásra és főkönyvi ellenőrzésre váró új számlák poolja.
            </p>
          </div>
        </div>

        {/* Közép: Statisztikák (számlaszám és összeg) */}
        <div className="flex items-center gap-6 self-start md:self-center">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-muted-foreground" />
            <div>
              <span className="text-xs text-muted-foreground block">Érintett számlák</span>
              <span className="text-sm font-bold text-foreground tabular-nums">
                {pendingInvoiceCount} db
              </span>
            </div>
          </div>

          <div className="border-l border-border/70 pl-6">
            <span className="text-xs text-muted-foreground block">Összesen</span>
            <span className="text-base font-bold text-foreground tabular-nums">
              {formattedAmount} {summary?.currency || defaultCurrency}
            </span>
          </div>
        </div>

        {/* Jobb oldal: Akciógomb */}
        <Button
          onClick={() => scopedNavigate('/general-ledger?tab=wizard')}
          className="h-10 px-5 gap-2 font-semibold shadow-sm shrink-0 self-stretch sm:self-auto"
        >
          <span>Kontírozás indítása</span>
          <ArrowRight className="w-4 h-4" />
        </Button>
      </CardContent>
    </Card>
  );
}
